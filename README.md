# Long Distance Chatbox 🚀

## 📌 Overview
Long Distance Chatbox is a private, AI-powered chatroom where messages are **rephrased politely** before sending. This helps improve communication in sensitive conversations.

## 🎯 Features
✅ **Real-time messaging** via Socket.io  
✅ **ChatGPT-powered rephrasing** for polite conversations  
✅ **Private chatrooms** with password protection  
✅ **Modern UI** using Deep Chat  
✅ **Scalable backend** with Node.js & Express  

## 🚀 Setup Instructions
### 1️⃣ Clone the Repository
```sh
git clone https://github.com/xinyuan8960/long_distance_chatbox.git
cd long_distance_chatbox
```

### 2️⃣ Setup Backend
```sh
cd backend
npm install
cp .env.example .env  # Add your OpenAI API key in .env
node server.js
```
Backend should now run at http://localhost:5001.

### 3️⃣ Setup Frontend
```sh
cd ../frontend
npm install
npm start
```
Frontend should now run at http://localhost:3000.

## 📂 Folder Structure
```sh
long_distance_chatbox/
│── backend/                # Backend API with OpenAI & Socket.io
│   ├── server.js           # Main server file
│   ├── .env.example        # Example environment file
│   ├── package.json        # Backend dependencies
│── frontend/               # React app with Deep Chat
│   ├── src/                # UI components
│   ├── public/             # Static files
│   ├── package.json        # Frontend dependencies
│── .gitignore              # Ignore unnecessary files
│── README.md               # Main project documentation
```

## 🚀 Deployment

