NovaChat

NovaChat is a web-based chat application focused on simple one-to-one messaging and experimental real-time communication features.
The project combines a custom frontend with a Node.js backend and serves the client directly from the server.

This repository is an active work in progress and is not intended to be a finished or production-hardened product.

Current Features

User accounts with unique tag identifiers
Login and signup with password authentication
One-to-one chat conversations
Contact management by tag
Message history stored in SQLite
Frontend served by the backend
WebSocket signaling layer
Experimental WebRTC voice call support

Tech Stack

Frontend
HTML
CSS
Vanilla JavaScript

Backend
Node.js
Express
WebSocket
SQLite using better-sqlite3
JWT authentication

Hosting
Render
HTTPS

Repository Structure

main chat
index.html
app.js
styles.css
server
server.js
package.json
database.db

The frontend files are located in the project root.
The backend resides in the server directory and serves the frontend as static files.

Installation

Clone the repository

git clone https://github.com/grave6840/chat1.git

cd chat1

Install backend dependencies

cd server
npm install

Start the server

node server.js

The application will start on the configured port and serve the frontend automatically.

Configuration Notes

The backend uses a local SQLite database file.
JWT secrets and security-related values are currently hardcoded for development purposes.
WebRTC functionality depends on browser support and a secure HTTPS context.

Limitations

No group chats
No end-to-end encryption
No advanced permission handling
Voice calls are experimental and not fully production-ready
No mobile-specific optimizations

Status

This project is under active development.
Breaking changes may occur at any time.
Code structure and features are expected to evolve.

License

No license has been specified.
All rights reserved by the repository owner.
