import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:5001', {
  autoConnect: false,
  transports: ['websocket']
});

const Chatroom = () => {
  const [room, setRoom] = useState('');
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [toneLevel, setToneLevel] = useState(3);

  useEffect(() => {
    socket.connect();
    
    socket.on('connect', () => {
      console.log('Connected to server');
    });

    socket.on('message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    return () => {
      socket.off('connect');
      socket.disconnect();
    };
  }, []);

  const joinRoom = () => {
    if (!room || !password) return alert('Please fill all fields');
    
    socket.emit('joinRoom', { room, password }, (response) => {
      if (response.success) {
        setAuthenticated(true);
      } else {
        alert(response.message || 'Join room failed');
      }
    });
  };

  const sendMessage = () => {
    if (!message.trim()) return;
    
    socket.emit('message', { 
      room, 
      text: message,
      toneLevel 
    });
    
    setMessage('');
  };

  return (
    <div style={styles.container}>
      {!authenticated ? (
        <div style={styles.authBox}>
          <h2>Relationship Chatroom 💬</h2>
          <input
            placeholder="Room Name"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            style={styles.input}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
          />
          <button onClick={joinRoom} style={styles.button}>
            Join Room
          </button>
        </div>
      ) : (
        <div style={styles.chatContainer}>
          <div style={styles.header}>
            <h3>Room: {room}</h3>
            <div style={styles.toneControl}>
              <label>Tone Level: </label>
              <input
                type="range"
                min="1"
                max="5"
                value={toneLevel}
                onChange={(e) => setToneLevel(parseInt(e.target.value))}
                style={{ width: '200px' }}
              />
              <span style={{ marginLeft: '10px' }}>
                {['Gentle', 'Moderate', 'Assertive'][Math.floor((toneLevel-1)/2)]}
              </span>
            </div>
          </div>

          <div style={styles.messageArea}>
            {messages.map((msg, index) => (
              <div key={index} style={styles.messageBubble}>
                <div style={styles.originalText}>Original: {msg.original}</div>
                <div style={styles.rephrasedText}>Suggested: {msg.rephrased}</div>
              </div>
            ))}
          </div>

          <div style={styles.inputArea}>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type your message..."
              style={styles.messageInput}
            />
            <button onClick={sendMessage} style={styles.sendButton}>
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Style definitions remain the same (no Chinese characters)
const styles = { /* ... */ };

export default Chatroom;