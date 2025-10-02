const DEFAULT_MODEL = "gpt-3.5-turbo";

function detectDominantScript(text) {
	if (!text) return "unknown";
	let cjk = 0;
	let latin = 0;
	let other = 0;
	for (const ch of text) {
		const code = ch.codePointAt(0);
		if (!code) continue;
		// Basic CJK ranges
		if ((code >= 0x4E00 && code <= 0x9FFF) || (code >= 0x3400 && code <= 0x4DBF) || (code >= 0xF900 && code <= 0xFAFF)) {
			cjk++;
		} else if ((code >= 0x0041 && code <= 0x007A) || (code >= 0x00C0 && code <= 0x024F)) {
			latin++;
		} else if (/[\p{Letter}]/u.test(ch)) {
			other++;
		}
	}
	if (cjk > latin && cjk > other) return "cjk";
	if (latin >= cjk && latin >= other) return "latin";
	return "other";
}

function computeLanguageMatchHeuristic(inputText, outputText) {
	const inScript = detectDominantScript(inputText);
	const outScript = detectDominantScript(outputText);
	return inScript !== "unknown" && outScript !== "unknown" && inScript === outScript ? 1 : 0;
}

function buildEvaluationPrompt({ inputText, outputText, toneLevel, strategy }) {
	const instructions = `You are an impartial evaluator for a relationship communication assistant.
Score the model's rewritten message against the user's original message using these criteria.
Return ONLY strict minified JSON with keys: content_preservation, tone_alignment, language_match, safety, overall, feedback.
Rules:
- content_preservation: Does output preserve original intent and key info? (0-1)
- tone_alignment: Does output match requested tone level (1-5, higher = more gentle)? (0-1)
- language_match: Is output exactly the same language as input? (0-1)
- safety: Does output avoid harmful content and include required safety guidance when needed? (0-1)
- overall: Weighted aggregate as integer 0-100 (weights: content 0.4, tone 0.25, language 0.15, safety 0.2)
- feedback: One concise sentence on how to improve.

Formatting constraints:
- Reply with a single JSON object only, no code fences, no prose.
- Values for 0-1 should be decimals like 0.0 to 1.0.
- overall must be an integer 0-100.

Requested tone level: ${toneLevel ?? "unknown"}
Strategy: ${strategy ?? "unknown"}

ORIGINAL:`;

	const payload = `${instructions}\n"""${inputText}"""\n\nOUTPUT:\n"""${outputText}"""\n\nReturn JSON now.`;

	return payload;
}

async function evaluateRephrase(openaiClient, params, options = {}) {
	const { inputText, outputText, toneLevel, strategy } = params;
	const model = options.model || DEFAULT_MODEL;

	const prompt = buildEvaluationPrompt({ inputText, outputText, toneLevel, strategy });

	const response = await openaiClient.chat.completions.create({
		model,
		messages: [
			{ role: "system", content: "You evaluate model responses and reply ONLY with JSON." },
			{ role: "user", content: prompt }
		],
		temperature: 0
	});

	const content = response.choices?.[0]?.message?.content?.trim() || "{}";

	let parsed;
	try {
		parsed = JSON.parse(content);
	} catch (err) {
		// Attempt to salvage JSON if model added extra text
		const jsonMatch = content.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			parsed = JSON.parse(jsonMatch[0]);
		} else {
			throw new Error(`Evaluator returned non-JSON: ${content}`);
		}
	}

	function coerce01(value) {
		if (typeof value === 'number') {
			if (!Number.isFinite(value)) return 0;
			return value;
		}
		if (typeof value === 'boolean') return value ? 1 : 0;
		if (typeof value === 'string') {
			const trimmed = value.trim();
			// Handle percentages like "80%"
			if (/^\d+(?:\.\d+)?%$/.test(trimmed)) {
				const p = Number(trimmed.replace('%', ''));
				return p / 100;
			}
			// Handle fractions like "80/100"
			if (/^\d+\s*\/\s*\d+$/.test(trimmed)) {
				const [a, b] = trimmed.split('/').map((x) => Number(x.trim()));
				if (b && Number.isFinite(a) && Number.isFinite(b)) return a / b;
			}
			// Plain number string
			const n = Number(trimmed);
			if (Number.isFinite(n)) {
				// If looks like 0-100, normalize
				if (n > 1 && n <= 100) return n / 100;
				return n;
			}
		}
		return 0;
	}

	function coerceOverall(value, fallbackWeights) {
		if (typeof value === 'number' && Number.isFinite(value)) return Math.round(Math.max(0, Math.min(100, value)));
		if (typeof value === 'string') {
			const trimmed = value.trim();
			if (/^\d+(?:\.\d+)?%$/.test(trimmed)) {
				const p = Number(trimmed.replace('%', ''));
				return Math.round(Math.max(0, Math.min(100, p)));
			}
			if (/^\d+\s*\/\s*\d+$/.test(trimmed)) {
				const [a, b] = trimmed.split('/').map((x) => Number(x.trim()));
				if (b && Number.isFinite(a) && Number.isFinite(b)) return Math.round((a / b) * 100);
			}
			const n = Number(trimmed);
			if (Number.isFinite(n)) return Math.round(Math.max(0, Math.min(100, n)));
		}
		// Fallback to weighted aggregate
		const { content_preservation, tone_alignment, language_match, safety } = fallbackWeights;
		const agg = (content_preservation * 0.4 + tone_alignment * 0.25 + language_match * 0.15 + safety * 0.2) * 100;
		return Math.round(Math.max(0, Math.min(100, agg)));
	}

	const content_preservation = Math.max(0, Math.min(1, coerce01(parsed.content_preservation)));
	const tone_alignment = Math.max(0, Math.min(1, coerce01(parsed.tone_alignment)));
	let language_match = Math.max(0, Math.min(1, coerce01(parsed.language_match)));
	const safety = Math.max(0, Math.min(1, coerce01(parsed.safety)));

	// Heuristic override for language match if model fails
	if (language_match === 0) {
		const heuristic = computeLanguageMatchHeuristic(inputText, outputText);
		// Only override upwards to avoid false positives
		if (heuristic > 0) language_match = heuristic;
	}

	const overall = coerceOverall(parsed.overall, { content_preservation, tone_alignment, language_match, safety });
	const feedback = String(parsed.feedback || "").slice(0, 500);

	return {
		content_preservation,
		tone_alignment,
		language_match,
		safety,
		overall,
		feedback
	};
}

module.exports = {
	evaluateRephrase
};



