import React, { useState } from "react";
import io from "socket.io-client";
import "deep-chat";

const socket = io("http://localhost:5001");

const Chatroom = () => {
  const [room, setRoom] = useState("");
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);

  const joinRoom = () => {
    socket.emit("joinRoom", room);
    setAuthenticated(true);
  };

  const sendMessage = async (message) => {
    socket.emit("message", { room, text: message });
  };

  return (
    <div>
      {!authenticated ? (
        <div>
          <input placeholder="Room Name" onChange={(e) => setRoom(e.target.value)} />
          <button onClick={joinRoom}>Join Room</button>
        </div>
      ) : (
        <deep-chat request={{ onSend: sendMessage }}></deep-chat>
      )}
    </div>
  );
};

export default Chatroom;

