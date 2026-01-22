/* =========================================================
   TEST DATABASE (LOCAL ONLY)
========================================================= */

const TEST_USERS = {
  "you@YOU1": {
    username: "you",
    code: "YOU1",
    contacts: []
  },
  "test@TEST": {
    username: "test",
    code: "TEST",
    contacts: []
  }
};

/* INIT USERS IN LOCALSTORAGE */
if (!localStorage.getItem("users")) {
  localStorage.setItem("users", JSON.stringify(TEST_USERS));
}




const state = {
  user: { id: "local", name: "You" },
  chats: [],
  activeChatId: null
};

const chatListEl = document.querySelector(".chat-list");
const chatListEmpty = document.querySelector(".chat-list-empty");
const messagesEl = document.querySelector(".messages");
const headerEl = document.querySelector(".chat-header");
const inputArea = document.querySelector(".chat-input-area");
const input = document.getElementById("messageInput");
const sendBtn = document.querySelector(".send-btn");


/* INIT */
createChat();
render();

/* CORE */
function render() {
  renderChatList();
  renderHeader();
  renderMessages();
  renderInputState();
}

function createChat() {
  const id = crypto.randomUUID();
  state.chats.push({
    id,
    title: "New Conversation",
    messages: [],
    unread: 0
  });
  state.activeChatId = id;
}

/* CHAT LIST */
function renderChatList() {
  chatListEl.innerHTML = "";

  if (!state.chats.length) {
    chatListEmpty.classList.add("show");
    return;
  }

  chatListEmpty.classList.remove("show");
  chatListEmpty.style.display = "block";
  chatListEmpty.style.display = "none";



  state.chats.forEach(chat => {
    const el = document.createElement("div");
    el.className = "chat-item" + (chat.id === state.activeChatId ? " active" : "");
    el.onclick = () => {
      state.activeChatId = chat.id;
      render();
    };

    el.innerHTML = `
      <div class="chat-avatar">${chat.title[0]}</div>
      <div class="chat-meta">
        <div class="chat-name">${chat.title}</div>
        <div class="chat-preview">
          ${chat.messages.at(-1)?.text || "No messages yet"}
        </div>
      </div>
    `;

    chatListEl.appendChild(el);
  });
}

/* HEADER */
function renderHeader() {
  if (!state.activeChatId) {
    headerEl.classList.add("empty");
    headerEl.innerHTML = "";
    return;
  }

  const chat = getChat();
  headerEl.classList.remove("empty");
headerEl.innerHTML = `
  <div class="chat-header-left">
    <div class="chat-avatar-large"></div>

    <div class="chat-header-text">
      <div class="chat-title">${chat.title}</div>
      <div class="chat-subtitle">Secure chat · Online</div>
    </div>
  </div>

  <div class="chat-header-actions">
    <button class="icon-btn">📞</button>
    <button class="icon-btn">🎥</button>
    <button class="icon-btn">⋮</button>
  </div>
`;

}

/* MESSAGES */
function renderMessages() {
  messagesEl.innerHTML = "";

  const chat = getChat();
  if (!chat || !chat.messages.length) {
    messagesEl.classList.add("empty");
    messagesEl.innerHTML = `
      <div class="empty-icon">📡</div>
      <p>No messages yet</p>
    `;
    return;
  }

  messagesEl.classList.remove("empty");

  chat.messages.forEach(msg => {
    const el = document.createElement("div");
    el.className = "message " + (msg.from === "local" ? "outgoing" : "incoming");
    el.innerHTML = `
      <div class="bubble">${msg.text}</div>
      <span class="timestamp">${msg.time}</span>
    `;
    messagesEl.appendChild(el);
  });

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

/* INPUT */
function renderInputState() {
  if (!state.activeChatId) {
    inputArea.classList.add("disabled");
    input.disabled = true;
    sendBtn.disabled = true;
  } else {
    inputArea.classList.remove("disabled");
    input.disabled = false;
    sendBtn.disabled = false;
  }
}

sendBtn.onclick = sendMessage;
input.addEventListener("keydown", e => {
  if (e.key === "Enter") sendMessage();
});

function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  getChat().messages.push({
    from: "local",
    text,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  });

  input.value = "";
  render();

  setTimeout(() => {
    getChat().messages.push({
      from: "remote",
      text: "Received.",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    });
    render();
  }, 800);
}

function getChat() {
  return state.chats.find(c => c.id === state.activeChatId);
}

/* =========================================================
   ANCHORED POPUP LOGIC
   ========================================================= */

const callBtn   = document.querySelectorAll(".chat-header-actions .icon-btn")[0];
const videoBtn  = document.querySelectorAll(".chat-header-actions .icon-btn")[1];
const menuBtn   = document.querySelectorAll(".chat-header-actions .icon-btn")[2];

const callPopup  = document.getElementById("callWindow");
const videoPopup = document.getElementById("videoWindow");
const menuPopup  = document.getElementById("contactMenu");

function closeAllPopups() {
  callPopup.classList.add("hidden");
  videoPopup.classList.add("hidden");
  menuPopup.classList.add("hidden");
}

/* POSITION POPUP FROM BUTTON */
function openPopupFromButton(btn, popup) {
  closeAllPopups();

  // eerst zichtbaar maken (maar onzichtbaar)
  popup.classList.remove("hidden");
  popup.style.visibility = "hidden";

  // laat browser layout berekenen
  requestAnimationFrame(() => {
    const rect = btn.getBoundingClientRect();
    const popupWidth = popup.offsetWidth;

    popup.style.top  = `${rect.bottom + 8}px`;
    popup.style.left = `${rect.left - popupWidth - 8}px`;

    popup.style.visibility = "visible";
  });
}


/* BUTTON EVENTS */

callBtn.onclick = (e) => {
  e.stopPropagation();
  openPopupFromButton(callBtn, callPopup);
};

videoBtn.onclick = (e) => {
  e.stopPropagation();
  openPopupFromButton(videoBtn, videoPopup);
};

menuBtn.onclick = (e) => {
  e.stopPropagation();
  openPopupFromButton(menuBtn, menuPopup);
};

/* CLICK OUTSIDE TO CLOSE */
document.addEventListener("click", () => {
  closeAllPopups();
});

/* PREVENT SELF-CLOSE */
[callPopup, videoPopup, menuPopup].forEach(popup => {
  popup.addEventListener("click", e => e.stopPropagation());
});

const settingsBtn = document.querySelector(".settings-btn");
const settingsScreen = document.getElementById("settingsScreen");


document.querySelector(".close-settings").onclick = () => {
  settingsScreen.classList.add("hidden");
};


settingsBtn.onclick = (e) => {
  e.stopPropagation();
  settingsScreen.classList.remove("hidden");
};

settingsScreen.addEventListener("click", (e) => {
  if (e.target === settingsScreen) {
    settingsScreen.classList.add("hidden");
  }
});

const addContactBtn = document.querySelector(".add-contact-btn");
const addContactScreen = document.getElementById("addContactScreen");

addContactBtn.onclick = (e) => {
  e.stopPropagation();
  addContactScreen.classList.remove("hidden");
};

document.querySelector(".close-add-contact").onclick = () => {
  addContactScreen.classList.add("hidden");
};

addContactScreen.addEventListener("click", (e) => {
  if (e.target === addContactScreen) {
    addContactScreen.classList.add("hidden");
  }
});

/* =========================================================
   LOGIN / SIGNUP LOGIC
========================================================= */

const loginScreen = document.getElementById("loginScreen");
const appShell = document.querySelector(".app-shell");

const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");

let currentUser = null;

/* UTIL */
function getUsers() {
  return JSON.parse(localStorage.getItem("users")) || {};
}

function saveUsers(users) {
  localStorage.setItem("users", JSON.stringify(users));
}

function generateCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

/* LOGIN */
loginBtn.onclick = () => {
  const username = document
    .getElementById("loginUsername")
    .value.trim()
    .toLowerCase();

  const code = document
    .getElementById("loginCode")
    .value.trim()
    .toUpperCase();

  const key = `${username}@${code}`;
  const users = getUsers();

  if (!users[key]) {
    alert("User not found");
    return;
  }

  currentUser = users[key];
  localStorage.setItem("currentUser", key);

  loginScreen.classList.add("hidden");
  appShell.style.display = "grid";

  loadContacts();
};


/* SIGNUP */
signupBtn.onclick = () => {
  const username = document.getElementById("loginUsername").value.trim();
  if (!username) {
    alert("Enter username");
    return;
  }

  const users = getUsers();
  let code, key;

  do {
    code = generateCode();
    key = `${username}@${code}`;
  } while (users[key]);

  users[key] = {
    username,
    code,
    contacts: []
  };

  saveUsers(users);

  // AUTO LOGIN NA SIGNUP
  localStorage.setItem("currentUser", key);
  currentUser = users[key];

  loginScreen.classList.add("hidden");
  appShell.style.display = "grid";

  loadContacts();

  alert(`Account created:\n${key}`);
};


/* =========================================================
   ADD CONTACT LOGIC
========================================================= */

const addContactInput = document.querySelector(
  "#addContactScreen input"
);
const addContactBtnAction = document.querySelector(
  ".contact-action-btn"
);

addContactBtnAction.onclick = () => {
  const value = addContactInput.value.trim();
  const users = getUsers();
  const currentKey = localStorage.getItem("currentUser");

  if (!users[value]) {
    alert("User not found");
    return;
  }

  if (value === currentKey) {
    alert("You cannot add yourself");
    return;
  }

  const me = users[currentKey];

  if (me.contacts.includes(value)) {
    alert("Already in contacts");
    return;
  }

  me.contacts.push(value);
  saveUsers(users);

  alert("Contact added");
  addContactInput.value = "";

  loadContacts();
};

function loadContacts() {
  const users = getUsers();
  const key = localStorage.getItem("currentUser");
  const me = users[key];

  const list = document.querySelector(".chat-list");
  list.innerHTML = "";

  me.contacts.forEach(contactKey => {
    const contact = users[contactKey];

    const div = document.createElement("div");
    div.className = "chat-item";
    div.innerHTML = `
      <div class="chat-avatar">${contact.username[0]}</div>
      <div class="chat-meta">
        <div class="chat-name">${contact.username}</div>
        <div class="chat-preview">${contact.username}@${contact.code}</div>
      </div>
    `;
    list.appendChild(div);
  });
}

