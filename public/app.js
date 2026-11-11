const socket = io();
let me = null;
let currentTo = null;
const $ = (id) => document.getElementById(id);

// Функция для генерации цвета и буквы для аватарки
function getAvatarData(nick) {
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899'];
  let hash = 0;
  for (let i = 0; i < nick.length; i++) hash = nick.charCodeAt(i) + ((hash << 5) - hash);
  const color = colors[Math.abs(hash) % colors.length];
  return { letter: nick.charAt(0).toUpperCase(), color: color };
}

function createAvatarElement(nick, size = 44) {
  const { letter, color } = getAvatarData(nick);
  const div = document.createElement('div');
  div.className = 'avatar';
  div.style.width = size + 'px';
  div.style.height = size + 'px';
  div.style.backgroundColor = color;
  div.style.fontSize = (size * 0.4) + 'px';
  div.textContent = letter;
  return div;
}

// --- Логин ---
$('loginBtn').onclick = () => {
  const nick = $('nick').value.trim();
  if (!nick) return;
  socket.emit('login', nick, (res) => {
    if (!res.ok) { $('loginErr').textContent = res.error; return; }
    me = nick;
    $('me').textContent = me;
    
    // Установка своей аватарки
    const myAvatarCont = $('myAvatar');
    myAvatarCont.replaceWith(createAvatarElement(me));
    
    $('login').classList.add('hidden');
    $('app').classList.remove('hidden');
  });
};
$('nick').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('loginBtn').click();
});

// --- Список пользователей ---
socket.on('users', (list) => {
  const others = list.filter((u) => u !== me);
  const ul = $('users');
  ul.innerHTML = '';
  if (others.length === 0) {
    ul.innerHTML = '<li class="empty">Пока никого нет</li>';
    return;
  }
  others.forEach((u) => {
    const li = document.createElement('li');
    if (u === currentTo) li.classList.add('active');
    
    li.appendChild(createAvatarElement(u, 32));
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'user-name';
    nameSpan.textContent = u;
    li.appendChild(nameSpan);
    
    li.onclick = () => openDialog(u);
    ul.appendChild(li);
  });
});

// --- Открытие диалога ---
function openDialog(user) {
  currentTo = user;
  $('chatHeaderText').textContent = 'Чат с ' + user;
  $('msgInput').disabled = false;
  $('sendBtn').disabled = false;
  $('msgInput').focus();
  $('messages').innerHTML = '';
  $('typing').classList.remove('visible');

  socket.emit('history', user, (msgs) => {
    msgs.forEach(renderMessage);
    scrollBottom();
  });

  [...$('users').children].forEach((li) => {
    if (li.classList.contains('empty')) return;
    const name = li.querySelector('.user-name').textContent;
    li.classList.toggle('active', name === user);
  });
}

// --- Рендер сообщения ---
function renderMessage(m) {
  const isMine = m.from === me;
  const div = document.createElement('div');
  div.className = 'msg ' + (isMine ? 'mine' : 'theirs');
  
  if (!isMine) {
    div.appendChild(createAvatarElement(m.from, 28));
  }

  const content = document.createElement('div');
  content.style.display = 'flex';
  content.style.flexDirection = 'column';
  content.style.alignItems = isMine ? 'flex-end' : 'flex-start';

  const t = new Date(m.ts);
  const hh = String(t.getHours()).padStart(2, '0');
  const mm = String(t.getMinutes()).padStart(2, '0');

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = m.text;

  const time = document.createElement('div');
  time.className = 'time';
  time.textContent = `${hh}:${mm}`;

  content.appendChild(bubble);
  content.appendChild(time);
  div.appendChild(content);
  $('messages').appendChild(div);
}

const scrollBottom = () => {
  const m = $('messages');
  m.scrollTop = m.scrollHeight;
};

// --- Отправка и авто-растягивание поля ---
const msgInput = $('msgInput');

msgInput.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = (this.scrollHeight) + 'px';
  if (this.value === '') this.style.height = '48px';

  if (!currentTo) return;
  socket.emit('typing', { to: currentTo, isTyping: true });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('typing', { to: currentTo, isTyping: false });
  }, 1500);
});

// Отправка по Enter (Shift+Enter - перенос строки)
msgInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    $('sendForm').dispatchEvent(new Event('submit'));
  }
});

$('sendForm').onsubmit = (e) => {
  e.preventDefault();
  if (!currentTo) return;
  const text = msgInput.value.trim();
  if (!text) return;
  socket.emit('send', { to: currentTo, text });
  msgInput.value = '';
  msgInput.style.height = '48px';
  socket.emit('typing', { to: currentTo, isTyping: false });
};

// --- Прием сообщений ---
socket.on('message', (m) => {
  const inCurrent = currentTo && ((m.from === me && m.to === currentTo) || (m.from === currentTo && m.to === me));
  if (inCurrent) {
    renderMessage(m);
    scrollBottom();
  }
});

// --- Индикатор печати ---
let typingTimeout = null;
const typingTimers = {};
socket.on('typing', ({ from, isTyping }) => {
  if (from !== currentTo) return;
  const el = $('typing');
  if (isTyping) {
    el.textContent = 'печатает...';
    el.classList.add('visible');
    clearTimeout(typingTimers[from]);
    typingTimers[from] = setTimeout(() => { 
      el.classList.remove('visible'); 
    }, 2000);
  } else {
    el.classList.remove('visible');
  }
});