import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io('http://localhost:5001', {
  autoConnect: false,
  transports: ['websocket']
});

export default function App() {
  const [room, setRoom] = useState('');
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [evalLoading, setEvalLoading] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [iterLoading, setIterLoading] = useState(false);

  useEffect(() => {
    socket.connect();
    
    socket.on('message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    return () => {
      socket.off('message');
      socket.disconnect();
    };
  }, []);

  const joinRoom = () => {
    if (!room || !password) return alert('Missing fields');
    socket.emit('joinRoom', { room, password }, (response) => {
      response.success ? setAuthenticated(true) : alert(response.message);
    });
  };

  const handlePreview = async () => {
    if (!message.trim()) return alert('Enter message first');
    
    try {
      setLoading(true);
      setMetrics(null);
      const response = await fetch('http://localhost:5001/preview', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ text: message }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Preview failed');
      }

      const data = await response.json();
      setPreview(data.preview);
    } catch (error) {
      console.error('Preview Error:', error);
      alert(`Preview Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluate = async () => {
    if (!message.trim()) return alert('Enter message first');
    const outputText = preview || message;
    if (!outputText.trim()) return alert('Nothing to evaluate');

    try {
      setEvalLoading(true);
      const response = await fetch('http://localhost:5001/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          inputText: message,
          outputText,
          toneLevel: 3,
          strategy: 'therapist'
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Evaluation failed');
      }

      const data = await response.json();
      setMetrics(data.metrics || null);
    } catch (error) {
      console.error('Evaluate Error:', error);
      alert(`Evaluate Error: ${error.message}`);
    } finally {
      setEvalLoading(false);
    }
  };

  const sendMessage = () => {
    const finalText = preview || message;
    if (!finalText.trim()) return alert('Cannot send empty');
    
    socket.emit('message', { room, text: finalText });
    setMessage('');
    setPreview(null);
    setMetrics(null);
  };

  const handleImprove = async () => {
    if (!message.trim()) return alert('Enter message first');
    const current = preview || message;
    if (!current.trim()) return alert('Nothing to improve');

    try {
      setIterLoading(true);
      const response = await fetch('http://localhost:5001/iterate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          inputText: message,
          outputText: current,
          toneLevel: 3,
          strategy: 'therapist'
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Iteration failed');
      }

      const data = await response.json();
      // Only update preview if applied per backend monotonic guard
      if (data.applied) {
        setPreview(data.improved || '');
      }
      setMetrics(data.metrics || null);
    } catch (error) {
      console.error('Iterate Error:', error);
      alert(`Iterate Error: ${error.message}`);
    } finally {
      setIterLoading(false);
    }
  };

  return (
    <div className="container">
      {!authenticated ? (
        <div className="auth-box">
          <h2>Relationship Chat</h2>
          <input
            className="auth-input"
            placeholder="Room Name"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
          />
          <input
            type="password"
            className="auth-input"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="auth-button" onClick={joinRoom}>
            Join Room
          </button>
        </div>
      ) : (
        <div className="chat-container">
          <div className="chat-header">
            <h3>Room: {room}</h3>
          </div>

          <div className="message-area">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`message-bubble ${msg.sender}-message`}
              >
                {msg.text}
              </div>
            ))}

            {preview && (
              <div className="message-bubble preview-message">
                {preview}
                <div className="preview-actions">
                  <button onClick={sendMessage}>Confirm</button>
                  <button onClick={() => setPreview(null)}>Edit</button>
                </div>
              </div>
            )}

            {metrics && (
              <div className="eval-card">
                <div className="eval-row"><span>Content</span><strong>{Math.round(metrics.content_preservation * 100)}%</strong></div>
                <div className="eval-row"><span>Tone</span><strong>{Math.round(metrics.tone_alignment * 100)}%</strong></div>
                <div className="eval-row"><span>Language</span><strong>{Math.round(metrics.language_match * 100)}%</strong></div>
                <div className="eval-row"><span>Safety</span><strong>{Math.round(metrics.safety * 100)}%</strong></div>
                <div className="eval-row overall"><span>Overall</span><strong>{metrics.overall}</strong></div>
                {metrics.feedback && <div className="eval-feedback">{metrics.feedback}</div>}
              </div>
            )}
          </div>

          <div className="input-container">
            <textarea
              className="message-input"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              rows={2}
              disabled={loading}
            />
            <div className="button-group">
              <button 
                className="preview-button" 
                onClick={handlePreview}
                disabled={loading || !message.trim()}
              >
                {loading ? 'Generating...' : 'Preview'}
              </button>
              <button 
                className="evaluate-button" 
                onClick={handleEvaluate}
                disabled={evalLoading || !message.trim()}
              >
                {evalLoading ? 'Evaluating...' : 'Evaluate'}
              </button>
              <button 
                className="improve-button" 
                onClick={handleImprove}
                disabled={iterLoading || (!preview && !message.trim())}
              >
                {iterLoading ? 'Improving...' : 'Improve'}
              </button>
              <button 
                className="send-button" 
                onClick={sendMessage}
                disabled={!message.trim() && !preview}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}