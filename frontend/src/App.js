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

  const sendMessage = () => {
    const finalText = preview || message;
    if (!finalText.trim()) return alert('Cannot send empty');
    
    socket.emit('message', { room, text: finalText });
    setMessage('');
    setPreview(null);
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