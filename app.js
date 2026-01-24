const API_BASE = "";





let localStream = null;
let peerConnection = null;
let callState = "idle"; 
// idle | outgoing | incoming | connected

let activeCallWith = null;

document.addEventListener("DOMContentLoaded", () => {
  const call = document.getElementById("callScreen");
  if (call) call.classList.add("hidden");
});



const ws = new WebSocket(
  location.protocol === "https:"
    ? `wss://${location.host}`
    : `ws://${location.host}`
);

function registerWS() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const tag = localStorage.getItem("myTag");
  if (!tag) return;

  ws.send(JSON.stringify({
    type: "register",
    tag
  }));

  console.log("WS REGISTERED AS", tag);
}


ws.onmessage = async (event) => {
  const payload = JSON.parse(event.data);

  // =========================
  // INCOMING CALL
  // =========================
  if (payload.type === "call-offer") {
    callState = "incoming";
    activeCallWith = payload.from;

    showCallScreen(payload.from, "Incoming call…");
    document.getElementById("callAcceptBtn").classList.remove("hidden");

    window.pendingOffer = payload.offer;
    return;
  }

  // =========================
  // CALL ANSWER
  // =========================
  if (payload.type === "call-answer") {
    await peerConnection.setRemoteDescription(payload.answer);
    callState = "connected";
    updateCallStatus("Connected");
    return;
  }

  // =========================
// ICE CANDIDATE
// =========================
if (payload.type === "ice") {
  if (peerConnection && payload.candidate) {
    try {
      await peerConnection.addIceCandidate(payload.candidate);
    } catch (err) {
      console.error("ICE error:", err);
    }
  }
  return;
}


  // =========================
  // CALL END
  // =========================
  if (payload.type === "call-end") {
    hideCallScreen();
    callState = "idle";
    activeCallWith = null;
    return;
  }
};




const rtcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};


const state = {
  chats: [],
  activeChatId: null,
  unreadCounts: JSON.parse(localStorage.getItem('unreadCounts') || '{}')
};

function getCleanUrl(url) {
  if (!url || url === 'none' || url === '') return null;
  return url.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
};

function sendSignal(payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn("WebSocket not connected, cannot send signal");
    return;
  }

  ws.send(JSON.stringify(payload));
}





/* =========================
   DOM REFERENCES
   ========================= */
const loginScreen = document.getElementById("loginScreen");
const appShell = document.querySelector(".app-shell");
const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const chatListEl = document.querySelector(".chat-list");
const chatListEmpty = document.querySelector(".chat-list-empty");
const messagesEl = document.querySelector(".messages");
const inputArea = document.querySelector(".chat-input-area");
const input = document.getElementById("messageInput");
const sendBtn = document.querySelector(".send-btn");
const addContactBtn = document.querySelector(".add-contact-btn");
const addContactScreen = document.getElementById("addContactScreen");
const settingsBtn = document.querySelector(".settings-btn");
const settingsScreen = document.getElementById("settingsScreen");
const profileCache = JSON.parse(localStorage.getItem('profileCache') || '{}');

/* =========================
   AUTH HELPERS
   ========================= */
function setAuth(token, tag) {
  localStorage.setItem("authToken", token);
  localStorage.setItem("myTag", tag);
}
function getAuth() { return localStorage.getItem("authToken"); }
function authHeaders() {
  return { "Content-Type": "application/json", "Authorization": "Bearer " + getAuth() };
}

/* =========================
   APP CORE LOGIC
   ========================= */
function enterApp() {
  callState = "idle";
hideCallScreen();

  const savedPin = localStorage.getItem("app-pin");
  if (savedPin) {
    const enteredPin = prompt("Voer je pincode in om NovaChat te openen:");
    if (enteredPin !== savedPin) {
      alert("Verkeerde pincode!");
      return;
    }
  }

  loginScreen.classList.add("hidden");
  loginScreen.style.display = "none";
  appShell.style.display = "grid"; 
  appShell.classList.remove("hidden");
  appShell.classList.add("active");

  loadContacts();
  console.log("App entered as:", localStorage.getItem("myTag"));
}

async function loadContacts() {
  try {
    const res = await fetch(`${API_BASE}/contacts`, { headers: authHeaders() });
    if (!res.ok) return;
    const contacts = await res.json();

    const newChats = contacts.map(tag => {
      const existing = state.chats.find(c => c.id === tag);
      return {
        id: tag,
        title: tag.split("@")[0],
        // HEEL BELANGRIJK: Behoud de bestaande berichten en previews
        messages: existing ? existing.messages : [],
        lastMessage: existing ? existing.lastMessage : null,
        pfp: existing ? existing.pfp : null,
        displayName: existing ? existing.displayName : null
      };
    });

    state.chats = newChats;
    renderChatList();
  } catch (err) {
    console.error(err);
  }
}

async function loadMessages(chatId) {
  const res = await fetch(`${API_BASE}/messages/${chatId}`, { headers: authHeaders() });
  if (!res.ok) return;
  const messages = await res.json();
  
  const chat = state.chats.find(c => c.id === chatId);
  if (!chat) return;

  // 1. Bewaar hoeveel berichten we al hadden VOORDAT we de lijst updaten
  const oldMessageCount = chat.messages.length;
  const newMessageCount = messages.length;

  // 2. Update de berichtenlijst
  chat.messages = messages.map(m => ({
    text: m.text,
    fromMe: m.sender_tag === localStorage.getItem("myTag"),
    timestamp: m.timestamp
  }));

  // 3. Zet het laatste bericht in de preview
  if (messages.length > 0) {
    chat.lastMessage = messages[messages.length - 1].text;
  }

  // 4. Badge logica
  if (chatId === state.activeChatId) {
    state.unreadCounts[chatId] = 0;
    renderMessages();
  } else if (newMessageCount > oldMessageCount && oldMessageCount > 0) {
    // Alleen het VERSCHIL toevoegen als we al berichten hadden geladen
    const diff = newMessageCount - oldMessageCount;
    state.unreadCounts[chatId] = (state.unreadCounts[chatId] || 0) + diff;
  } else if (newMessageCount > 0 && oldMessageCount === 0) {
    // Eerste keer laden? Dan geen badges voor oude berichten
    state.unreadCounts[chatId] = 0;
  }

  localStorage.setItem('unreadCounts', JSON.stringify(state.unreadCounts));
  renderChatList(); 
}

/* =========================
   RENDERING & UI
   ========================= */
function renderChatList() {
  chatListEl.innerHTML = "";
  const myTag = localStorage.getItem("myTag");

  if (state.chats.length === 0) {
    chatListEmpty.style.display = "block";
    return;
  }
  chatListEmpty.style.display = "none";

  state.chats.forEach(chatItem => {
    const el = document.createElement("div");
    el.className = `chat-item ${chatItem.id === state.activeChatId ? "active" : ""}`;
    el.onclick = () => selectChat(chatItem.id);

    // --- BEPAAL NAAM EN FOTO ---
    let dName = chatItem.displayName || chatItem.title;
    let pfpUrl = chatItem.pfp;

    // Als dit mijn eigen profiel is, dwing de lokale data af
    if (chatItem.id === myTag) {
      dName = localStorage.getItem('myDisplayName') || dName;
      pfpUrl = localStorage.getItem('myPFP') || pfpUrl;
    }

    // Badge logica
    const unread = state.unreadCounts[chatItem.id] || 0;
    const badgeHtml = unread > 0 ? `<div class="unread-badge">${unread}</div>` : '';

    // Foto styling
    let avatarStyle = "";
    if (pfpUrl && pfpUrl !== 'none') {
      // Zorg dat de URL schoon in url() staat
      const cleanUrl = pfpUrl.replace('url("', '').replace('")', '').replace('url(', '').replace(')', '');
      avatarStyle = `style="background-image: url('${cleanUrl}'); background-size: cover; background-position: center; color: transparent;"`;
    }

    el.innerHTML = `
      <div class="chat-avatar" ${avatarStyle}>${dName[0].toUpperCase()}</div>
      <div class="chat-meta">
        <div class="chat-name">${dName}</div>
        <div class="chat-preview">${chatItem.lastMessage || 'Click to chat'}</div>
      </div>
      ${badgeHtml}
    `;
    chatListEl.appendChild(el);
  });
}

function selectChat(chatId) {
  state.activeChatId = chatId;

  // DIRECT de badge op 0 zetten voor de geselecteerde chat
  state.unreadCounts[chatId] = 0;
  localStorage.setItem('unreadCounts', JSON.stringify(state.unreadCounts));

  // Direct de lijst verversen zodat het rode bolletje verdwijnt
  renderChatList();
  
  renderChatHeader();
  renderInputState();
  loadMessages(chatId);
}

function getChat() {
  return state.chats.find(c => c.id === state.activeChatId);
}

function renderChatHeader() {
  const chat = getChat();
  const header = document.querySelector(".chat-header");
  const myTag = localStorage.getItem("myTag");
  if (!chat || !header) return;

  // Bepaal Display Info
  let dName = chat.displayName || chat.title;
  let bioText = chat.bio || "Online";
  let pfpUrl = chat.pfp;

  if (chat.id === myTag) {
    dName = localStorage.getItem('myDisplayName') || dName;
    bioText = localStorage.getItem('myBio') || bioText;
    pfpUrl = localStorage.getItem('myPFP') || pfpUrl;
  }

  header.querySelector(".chat-title").textContent = dName;
  header.querySelector(".chat-subtitle").textContent = bioText;
  
  const avatar = header.querySelector(".chat-avatar-large");
  const cleanUrl = getCleanUrl(pfpUrl);
  
  if (avatar) {
    if (cleanUrl) {
      avatar.style.backgroundImage = `url('${cleanUrl}')`;
      avatar.style.backgroundSize = "cover";
      avatar.style.backgroundPosition = "center";
      avatar.textContent = '';
    } else {
      avatar.style.backgroundImage = 'none';
      avatar.textContent = dName[0].toUpperCase();
    }
  }
  
  avatar.style.display = "grid";
  avatar.style.placeItems = "center";
  bindHeaderActions();
}

function bindHeaderActions() {

}

// 2. Verbeterde togglePopup die ALTIJD de juiste knop pakt
function togglePopup(event, popupId, btnElement) {
    event.preventDefault();
    event.stopPropagation();
    
    const popup = document.getElementById(popupId);
    if (!popup || !btnElement) return;

    // Sluit alle andere popups
    document.querySelectorAll('.popup').forEach(p => {
        if (p.id !== popupId) p.classList.add('hidden');
    });

    const isNowVisible = popup.classList.toggle('hidden') === false;

    if (isNowVisible) {
        const rect = btnElement.getBoundingClientRect();
        popup.style.position = 'fixed';
        popup.style.top = (rect.bottom + 8) + 'px';
        const rightOffset = window.innerWidth - rect.right;
        popup.style.right = rightOffset + 'px';
        popup.style.left = 'auto';
        popup.style.zIndex = '9999';
    }
}


function renderMessages() {
  const chat = getChat();
  messagesEl.innerHTML = "";
  if (!chat || !chat.messages.length) {
    messagesEl.innerHTML = '<div class="messages-empty">No messages yet</div>';
    return;
  }
  chat.messages.forEach(m => {
    const el = document.createElement("div");
    el.className = `message ${m.fromMe ? "outgoing" : "incoming"}`;
    el.innerHTML = `<div class="message-bubble"><p class="message-text">${m.text}</p></div>`;
    messagesEl.appendChild(el);
  });
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderInputState() {
  const active = state.activeChatId !== null;
  input.disabled = !active;
  sendBtn.disabled = !active;
  inputArea.classList.toggle("disabled", !active);
  if (active) input.focus();
}

/* =========================
   ACTIONS & SETTINGS
   ========================= */
async function sendMessage() {
  const text = input.value.trim();
  if (!text || !state.activeChatId) return;
  const res = await fetch(`${API_BASE}/messages/send`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ to: state.activeChatId, text })
  });
  if (res.ok) {
    input.value = "";
    loadMessages(state.activeChatId);
  }
}

function applyTheme(themeName) {
  document.body.classList.remove('theme-light', 'theme-dark', 'theme-midnight');
  if (themeName !== 'dark') document.body.classList.add(`theme-${themeName}`);
  localStorage.setItem('nova-theme', themeName);
}

function applyAccent(color) {
  document.documentElement.style.setProperty('--accent', color);
  localStorage.setItem('nova-accent', color);
}

function updateDensity(val) {
  document.documentElement.style.setProperty('--chat-gap', `${val}px`);
  document.documentElement.style.setProperty('--chat-padding', `${val * 1.5}px`);
  localStorage.setItem("chat-density-value", val);
}

function applyChatBackground(url) {
  if (url) messagesEl.style.backgroundImage = `url('${url}')`;
  else messagesEl.style.backgroundImage = "none";
}

/* =========================
   PRIVACY & SECURITY
   ========================= */
function toggleChatLock(isEnabled) {
    if (isEnabled) {
        const pin = prompt("Stel een 4-cijferige pincode in:");
        if (pin && pin.length === 4) {
            localStorage.setItem("app-pin", pin);
            alert("Lock enabled.");
        } else {
            document.getElementById("lockToggle").checked = false;
        }
    } else localStorage.removeItem("app-pin");
}

function toggleLastSeen(isEnabled) {
    localStorage.setItem("hide-last-seen", isEnabled);
}

async function sendContactRequest() {
    const inputField = document.getElementById("actualAddContactInput");
    const tag = inputField.value.trim(); // Zorgt dat spaties voor/na de naam weg zijn

    if (!tag || !tag.includes('@')) {
        return alert("Please enter the full tag: username@1234");
    }

    console.log("Sending request to add:", tag);

    try {
        const res = await fetch(`${API_BASE}/add-contact`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ contactTag: tag })
        });

        const data = await res.json();

        if (res.ok) {
            alert("Contact added successfully!");
            inputField.value = "";
            document.getElementById("addContactScreen").classList.add("hidden");
            loadContacts(); // Vernieuw de lijst
        } else {
            // De server geeft hier de "User not found" fout
            console.error("Server returned error:", data);
            alert("Error: " + (data.error || "Could not add contact"));
        }
    } catch (err) {
        console.error("Network error:", err);
        alert("Network error. Check your connection or server status.");
    }
}

function loadPrivacySettings() {
    const pin = localStorage.getItem("app-pin");
    const hideSeen = localStorage.getItem("hide-last-seen") === "true";
    const receipts = localStorage.getItem("chat-read-receipts") === "true";

    const lockT = document.getElementById("lockToggle");
    const seenT = document.getElementById("lastSeenToggle");
    const readT = document.getElementById("readReceiptToggle");

    if (lockT) lockT.checked = (pin !== null && pin !== "");
    if (seenT) seenT.checked = hideSeen;
    if (readT) readT.checked = receipts;
}

/* =========================
   EVENT LISTENERS (SINGLE SETUP)
   ========================= */

// Centraal opstartpunt
window.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('nova-theme');
  const savedAccent = localStorage.getItem('nova-accent');
  if (savedTheme) applyTheme(savedTheme);
  if (savedAccent) applyAccent(savedAccent);

  loadChatSettings();
  loadPrivacySettings();

  const token = getAuth();
  if (token) enterApp();
});

function loadChatSettings() {
  const savedBg = localStorage.getItem("custom-chat-bg");
  if (savedBg) applyChatBackground(savedBg);

  const savedDensity = localStorage.getItem("chat-density-value");
  if (savedDensity) {
    const slider = document.getElementById("densitySlider");
    if (slider) slider.value = savedDensity;
    updateDensity(savedDensity);
  }
}

/* =========================================================
   UI CONTROLLER (DE MASTER FIX)
   ========================================================= */

// Luister naar ELKE klik in de app
document.addEventListener('click', (e) => {
    const t = e.target;

    // =========================
// START VOICE CALL
// =========================
if (t.closest('.call-action') && t.closest('#callWindow')) {
  console.log("📞 Start call clicked");
  startCall();
  return;
}


    // --- SIGNUP ACTIE (Create New Account) ---
// --- SIGNUP ACTIE ---
    if (t.id === 'signupBtn') {
        e.preventDefault();
        const u = document.getElementById("loginUsername").value.trim();
        const p = document.getElementById("loginPassword").value.trim();

        fetch(`${API_BASE}/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: u, password: p })
        })
        .then(res => res.json())
        .then(data => {
            if (data.token) {
                // 1. Vul de code-box automatisch in
                const code = data.tag.split("@")[1];
                document.getElementById("userCode").value = code;
                
                // 2. Sla de boel alvast op
                setAuth(data.token, data.tag);
                
                alert("Account created! Your code is: " + code + ". You can now click Login.");
            } else {
                alert("Signup failed: " + (data.error || "Error"));
            }
        });
        return;
    }

// --- LOGIN ACTIE ---
if (t.id === 'loginBtn') {
  e.preventDefault();
  e.stopPropagation();

  const u = document.getElementById("loginUsername").value.trim();
  const c = document.getElementById("userCode").value.trim();
  const p = document.getElementById("loginPassword").value.trim();

  let tag = u;
  if (c && !u.includes('@')) tag = `${u}@${c}`;

  fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tag, password: p })
  })
    .then(res => res.json())
    .then(data => {
      if (!data.token) {
        alert("Login failed. Check your username, code and password.");
        return;
      }

      setAuth(data.token, data.tag);
      enterApp();

      // ✅ REGISTREER WEBSOCKET PAS NA LOGIN
      registerWS();
    })
    .catch(err => {
      console.error("Login error:", err);
      alert("Login failed due to a network or server error.");
    });

  return;
}


    // 1. SETTINGS (Open/Sluit) met extra beveiliging
    if (t.closest('.settings-btn')) {
        console.log("Settings button clicked"); // Debug check
        const screen = document.getElementById("settingsScreen");
        
        if (screen) {
            try {
                renderSettingsProfile();
                loadPrivacySettings();
            } catch (err) {
                console.warn("Kleine fout bij laden settings data:", err);
            }
            screen.classList.remove("hidden");
        }
        return;
    }

    // 2. SETTINGS SLUITEN
    if (t.closest('.close-settings')) {
        document.getElementById("settingsScreen").classList.add("hidden");
        return;
    }

    // 3. ADD CONTACT OPENEN (Nu direct werkend!)
    if (t.closest('.add-contact-btn')) {
        document.getElementById("addContactScreen").classList.remove("hidden");
        return;
    }

    // --- ADD CONTACT ACTIE (De "Send Request" knop zelf) ---
    if (t.closest('#addContactScreen .contact-action-btn')) {
        sendContactRequest();
        return;
    }

    // --- LOGOUT ACTIE ---
    if (t.closest('.danger') && t.textContent.includes('Logout')) {
        if (confirm("Are you sure you want to logout?")) {
            localStorage.clear();
            location.reload();
        }
        return;
    }

    if (t.closest('.add-contact-btn')) {
        const myTag = localStorage.getItem("myTag");
        document.getElementById("displayMyOwnTag").textContent = myTag; // Toon je eigen ID
        document.getElementById("addContactScreen").classList.remove("hidden");
        return;

    }
    
    // 4. ADD CONTACT SLUITEN
    if (t.closest('.close-add-contact')) {
        document.getElementById("addContactScreen").classList.add("hidden");
        return;
    }

    // --- SAVE PROFILE CHANGES ---
    if (t.closest('.settings-section .contact-action-btn') && t.textContent.includes('Save')) {
        saveProfileData();
        return;
    }

    // 5. HEADER POPUPS (Call, Video, Menu)
    const callTrigger = t.closest('.call-btn');
    if (callTrigger) { togglePopupFixed(callTrigger, "callWindow"); return; }

    const videoTrigger = t.closest('.video-btn');
    if (videoTrigger) { togglePopupFixed(videoTrigger, "videoWindow"); return; }

    const menuTrigger = t.closest('.menu-btn');
    if (menuTrigger) { togglePopupFixed(menuTrigger, "contactMenu"); return; }

    // 6. SLUIT POPUPS ALS JE ERNAAST KLIKT
    if (!t.closest('.popup') && !t.closest('.icon-btn')) {
        document.querySelectorAll('.popup').forEach(p => p.classList.add('hidden'));
    }
});


// Verbeterde functie voor popups die ALTIJD op de juiste plek verschijnen
function togglePopupFixed(btn, popupId) {
    const popup = document.getElementById(popupId);
    if (!popup) return;

    // Sluit alle andere popups
    document.querySelectorAll('.popup').forEach(p => {
        if (p.id !== popupId) p.classList.add('hidden');
    });

    // Toggle zichtbaarheid
    const isHidden = popup.classList.toggle('hidden');

    if (!isHidden) {
        const rect = btn.getBoundingClientRect();
        popup.style.position = 'fixed';
        popup.style.top = (rect.bottom + 10) + 'px';
        popup.style.right = (window.innerWidth - rect.right) + 'px';
        popup.style.left = 'auto';
        popup.style.zIndex = '10001';
    }
}



// Zorg dat input werkt
input.onkeydown = (e) => { if (e.key === "Enter") sendMessage(); };
if (sendBtn) sendBtn.onclick = sendMessage;

// Interval voor berichten
function renderSettingsProfile() {
    // 1. Haal de tag op uit localStorage
    const myTag = localStorage.getItem("myTag");
    
    // 2. Zoek het element in de HTML
    const tagDisplay = document.getElementById("settingsMyTag");
    
    if (tagDisplay) {
        if (myTag) {
            tagDisplay.textContent = myTag;
            console.log("Tag succesvol geladen in settings:", myTag);
        } else {
            tagDisplay.textContent = "Tag niet gevonden";
            console.error("Fout: Geen 'myTag' gevonden in localStorage. Log opnieuw in.");
        }
    } else {
        console.error("Fout: Element #settingsMyTag niet gevonden in de HTML.");
    }
}

// --- Profiel Bewerken Functies ---

function previewProfilePic(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('pfpPreview').style.backgroundImage = `url('${e.target.result}')`;
    document.getElementById('pfpPreview').textContent = ''; // Initialen weghalen
  };
  reader.readAsDataURL(file);
}

async function saveProfileData() {
  const displayName = document.getElementById('editDisplayName').value.trim();
  const bio = document.getElementById('editBio').value.trim();
  const pfp = document.getElementById('pfpPreview').style.backgroundImage;

  // 1. Lokaal opslaan
  if (displayName) localStorage.setItem('myDisplayName', displayName);
  if (bio) localStorage.setItem('myBio', bio);
  if (pfp && pfp !== 'none') localStorage.setItem('myPFP', pfp);

  // 2. Naar server sturen zodat anderen het zien
  try {
    await fetch(`${API_BASE}/update-profile`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        displayName: displayName,
        bio: bio,
        pfp: pfp // Let op: als de foto te groot is, kan de server dit weigeren.
      })
    });
  } catch (err) {
    console.error("Server profiel update mislukt:", err);
  }

  alert("Profile updated and synced!");
  document.getElementById('settingsScreen').classList.add('hidden');
  renderSettingsProfile();
}

// Breid de bestaande renderSettingsProfile uit
const originalRenderSettings = renderSettingsProfile;
renderSettingsProfile = function() {
  originalRenderSettings(); // Roep de oude versie aan voor de ID

  // Vul de bewerk-velden in
  const savedName = localStorage.getItem('myDisplayName');
  const savedBio = localStorage.getItem('myBio');
  const savedPFP = localStorage.getItem('myPFP');

  if (savedName) document.getElementById('editDisplayName').value = savedName;
  if (savedBio) document.getElementById('editBio').value = savedBio;
  if (savedPFP) {
    document.getElementById('pfpPreview').style.backgroundImage = savedPFP;
    document.getElementById('pfpPreview').textContent = '';
  } else {
    // Toon initialen als er geen foto is
    const tag = localStorage.getItem('myTag') || "U";
    document.getElementById('pfpPreview').textContent = tag[0].toUpperCase();
  }
};

// --- Update Chat Header (Zodat je de ander ziet) ---

function renderChatHeader() {
  const chat = getChat();
  const header = document.querySelector(".chat-header");
  if (!chat || !header) return;

  header.querySelector(".chat-title").textContent = chat.displayName || chat.title;
  header.querySelector(".chat-subtitle").textContent = chat.bio || "Online";
  
  const avatar = header.querySelector(".chat-avatar-large");
  
  if (chat.pfp && chat.pfp !== 'none') {
    const imgUrl = chat.pfp.includes('url(') ? chat.pfp : `url(${chat.pfp})`;
    avatar.style.backgroundImage = imgUrl;
    avatar.style.backgroundSize = "cover";
    avatar.textContent = '';
  } else {
    avatar.style.backgroundImage = 'none';
    avatar.textContent = (chat.displayName || chat.title)[0].toUpperCase();
  }
  
  avatar.style.display = "grid";
  avatar.style.placeItems = "center";
  bindHeaderActions();
}

setInterval(() => {
    if (!getAuth()) return;

    // 1. Ververs contactenlijst (nieuwe mensen)
    loadContacts(); 

    // 2. Check voor nieuwe berichten in ALLE chats (voor de rode badges)
    state.chats.forEach(chat => {
        loadMessages(chat.id);
    });
}, 4000); // Elke 5 seconden is genoeg voor een gratis server

function getCleanUrl(url) {
  if (!url || url === 'none' || url === '') return null;
  // Verwijder url("..."), url('...') of url(...) en hou alleen de link over
  return url.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
}

async function initAudio() {
  const md = window.navigator.mediaDevices;

  if (!md || !md.getUserMedia) {
    alert("Microfoon wordt niet ondersteund in deze browser/context.");
    throw new Error("mediaDevices unavailable");
  }

  localStream = await md.getUserMedia({ audio: true });
}



function createPeer() {
  peerConnection = new RTCPeerConnection(rtcConfig);

  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  }

  peerConnection.onicecandidate = (e) => {
    if (e.candidate) {
      sendSignal({
        type: "ice",
        from: state.myTag,
        to: activeCallWith,
        candidate: e.candidate
      });
    }
  };

  peerConnection.ontrack = (event) => {
    const audio = document.getElementById("remoteAudio");
    audio.srcObject = event.streams[0];
  };
}






async function startCall() {
  if (callState !== "idle") return;
  callState = "outgoing";
  activeCallWith = state.activeChatId;
  console.log("CALL FROM", state.myTag, "TO", activeCallWith);


  showCallScreen(activeCallWith, "Calling…"); // Fix: gebruik activeCallWith

  await initAudio();
  createPeer();

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  sendSignal({
    type: "call-offer",
    from: localStorage.getItem("myTag"),
    to: activeCallWith,
    offer
  });
} // <--- DEZE MASSIF ONTBRAK

async function receiveOffer(offer) {
  await initAudio();
  createPeer();

  await peerConnection.setRemoteDescription(offer);

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  sendSignal({
    type: "answer",
    answer
  });
}

function showCallScreen(name, status) {
  document.getElementById("callScreen").classList.remove("hidden");
  document.querySelector(".call-name").textContent = name;
  document.querySelector(".call-status").textContent = status;
}

function updateCallStatus(text) {
  document.querySelector(".call-status").textContent = text;
}

function hideCallScreen() {
  document.getElementById("callScreen").classList.add("hidden");
}

document.getElementById("callAcceptBtn").onclick = async () => {
  callState = "connected";
  updateCallStatus("Connected");

  document.getElementById("callAcceptBtn").classList.add("hidden");

  await initAudio();
  createPeer();

  await peerConnection.setRemoteDescription(window.pendingOffer);

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  // DEZE MOET HIERBINNEN:
  sendSignal({
    type: "call-answer",
    from: localStorage.getItem("myTag"),
    to: activeCallWith,
    answer
  });
};

document.getElementById("callEndBtn").onclick = (e) => {
   e.stopPropagation();
  if (peerConnection) peerConnection.close();
  peerConnection = null;

  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }

  // Stuur signaal VOORDAT we de variabelen leegmaken
  sendSignal({
    type: "call-end",
    from: localStorage.getItem("myTag"),
    to: activeCallWith
  });

  callState = "idle";
  activeCallWith = null;
  hideCallScreen();
};

document.getElementById("callMuteBtn").onclick = (e) => {
  e.stopPropagation(); // 🔴 BELANGRIJK

  toggleMute();
};










