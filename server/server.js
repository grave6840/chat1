import express from "express";
import Database from "better-sqlite3";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cors from "cors";
import { WebSocketServer } from "ws";
import http from "http";


const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = "DEV_SECRET_CHANGE_LATER";

app.use(cors());
app.use(express.json());
app.options("*", cors());
/* =========================
   DATABASE
========================= */

const db = new Database("database.db");

db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    code TEXT,
    tag TEXT UNIQUE,
    password TEXT
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_tag TEXT,
    contact_tag TEXT,
    UNIQUE(owner_tag, contact_tag)
  )
`).run();


db.prepare(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_tag TEXT,
    receiver_tag TEXT,
    text TEXT,
    timestamp INTEGER
  )
`).run();


/* =========================
   UTILS
========================= */

function generateCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.sendStatus(401);

  const token = header.split(" ")[1];
  if (!token) return res.sendStatus(401);

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.sendStatus(403);
  }
}

/* =========================
   SIGNUP
========================= */

app.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Missing fields" });

  let code, tag;

  do {
    code = generateCode();
    tag = `${username}@${code}`;
  } while (
    db.prepare("SELECT 1 FROM users WHERE tag = ?").get(tag)
  );

  const hash = await bcrypt.hash(password, 10);

  try {
    db.prepare(`
      INSERT INTO users (username, code, tag, password)
      VALUES (?, ?, ?, ?)
    `).run(username, code, tag, hash);
  } catch {
    return res.status(500).json({ error: "Signup failed" });
  }

  const token = jwt.sign({ tag }, JWT_SECRET);
  res.json({ tag, token });
});

/* =========================
   LOGIN
========================= */

app.post("/login", async (req, res) => {
  const { tag, password } = req.body;

  const user = db.prepare(
    "SELECT * FROM users WHERE tag = ?"
  ).get(tag);

  if (!user)
    return res.status(401).json({ error: "User not found" });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok)
    return res.status(401).json({ error: "Wrong password" });

  const token = jwt.sign({ tag }, JWT_SECRET);
  res.json({ tag, token });
});

/* =========================
   ADD CONTACT
========================= */

app.post("/add-contact", auth, (req, res) => {
  const owner = req.user.tag;
  const { contactTag } = req.body;

  if (!contactTag || owner === contactTag) {
    return res.status(400).json({ error: "Invalid contact" });
  }

  const exists = db
    .prepare("SELECT 1 FROM users WHERE tag = ?")
    .get(contactTag);

  if (!exists) {
    return res.status(404).json({ error: "User not found" });
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO contacts (owner_tag, contact_tag)
    VALUES (?, ?)
  `);

  // 🔑 SYMMETRISCH TOEVOEGEN
  insert.run(owner, contactTag);
  insert.run(contactTag, owner);

  res.json({ success: true });
});


/* =========================
   GET CONTACTS
========================= */

app.get("/contacts", auth, (req, res) => {
  const rows = db.prepare(`
    SELECT contact_tag
    FROM contacts
    WHERE owner_tag = ?
  `).all(req.user.tag);

  res.json(rows.map(r => r.contact_tag));
});

app.post("/messages/send", auth, (req, res) => {
  const sender = req.user.tag;
  const { to, text } = req.body;

  if (!to || !text) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const receiverExists = db
    .prepare("SELECT 1 FROM users WHERE tag = ?")
    .get(to);

  if (!receiverExists) {
    return res.status(404).json({ error: "Receiver not found" });
  }

  db.prepare(`
    INSERT INTO messages (sender_tag, receiver_tag, text, timestamp)
    VALUES (?, ?, ?, ?)
  `).run(sender, to, text, Date.now());

  res.json({ success: true });
});

app.get("/messages/:contactTag", auth, (req, res) => {
  const me = req.user.tag;
  const other = req.params.contactTag;

  const messages = db.prepare(`
    SELECT sender_tag, receiver_tag, text, timestamp
    FROM messages
    WHERE
      (sender_tag = ? AND receiver_tag = ?)
      OR
      (sender_tag = ? AND receiver_tag = ?)
    ORDER BY timestamp ASC
  `).all(me, other, other, me);

  res.json(messages);
});


/* =========================
   START
========================= */

const server = http.createServer(app);

const wss = new WebSocketServer({ server });
const clients = new Map();

wss.on("connection", (ws, req) => {
  ws.on("message", msg => {
    try {
      const payload = JSON.parse(msg.toString());

      // eerste bericht = registratie
      if (payload.type === "register") {
        clients.set(payload.tag, ws);
        ws.tag = payload.tag;
        return;
      }

      // signaling doorsturen
      const target = clients.get(payload.to);
      if (target) {
        target.send(JSON.stringify(payload));
      }

    } catch (e) {
      console.error("WS error:", e);
    }
  });

  ws.on("close", () => {
    if (ws.tag) clients.delete(ws.tag);
  });
});

server.listen(PORT, () => {
  console.log(`HTTP + WS server running on ${PORT}`);
});

const ws = new WebSocket("wss://chat1-gnea.onrender.com");

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: "register",
    tag: localStorage.getItem("myTag")
  }));
};

