const socket = io();
let me = null;
let currentTo = null;
let unreadCounts = {}; // Счетчики непрочитанных
const $ = (id) => document.getElementById(id);

// --- Генерация аватарки ---
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
  
  // Отправляем на сервер
  socket.emit('login', nick, (res) => {
    if (!res.ok) { 
      $('loginErr').textContent = res.error; 
      return; 
    }
    me = nick;
    $('me').textContent = me;
    
    // Установка аватарки
    const myAvatarCont = $('myAvatar');
    if(myAvatarCont) myAvatarCont.replaceWith(createAvatarElement(me));
    
    // Переключение экранов
    $('login').classList.add('hidden');
    $('app').classList.remove('hidden');
  });
};
// Вход по Enter
$('nick').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('loginBtn').click();
});

// --- Список пользователей ---
socket.on('users', (list) => {
if (!me) return;
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
    
    // Счетчик непрочитанных
    if (unreadCounts[u] && unreadCounts[u] > 0) {
      const badge = document.createElement('span');
      badge.className = 'unread-badge';
      badge.textContent = unreadCounts[u];
      li.appendChild(badge);
    }
    
    li.onclick = () => openDialog(u);
    ul.appendChild(li);
  });
});

// --- Открытие диалога ---
function openDialog(user) {
  currentTo = user;
  unreadCounts[user] = 0; // Сбрасываем счетчик
  document.title = 'MuyleeGram';
  
  $('chatHeaderText').textContent = 'Чат с ' + user;
  $('msgInput').disabled = false;
  $('sendBtn').disabled = false;
  $('msgInput').focus();
  $('messages').innerHTML = '';
  $('typing').classList.remove('visible');

  // Для мобилок
  $('app').classList.add('chat-open');

  // Загружаем историю
  socket.emit('history', user, (msgs) => {
    msgs.forEach(renderMessage);
    scrollBottom();
  });

  // Обновляем активный класс в списке
  [...$('users').children].forEach((li) => {
    if (li.classList.contains('empty')) return;
    const name = li.querySelector('.user-name').textContent;
    li.classList.toggle('active', name === user);
    const badge = li.querySelector('.unread-badge');
    if (badge) badge.remove();
  });
}

// Кнопка "Назад"
$('backBtn').onclick = () => {
  $('app').classList.remove('chat-open');
  currentTo = null;
};

// --- Рендер сообщения ---
function renderMessage(m) {
  const isMine = m.from === me;
  const div = document.createElement('div');
  div.className = 'msg ' + (isMine ? 'mine' : 'theirs');
  
  if (!isMine) div.appendChild(createAvatarElement(m.from, 28));

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

// --- Отправка ---
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
  } else if (m.from !== me) {
    if (!unreadCounts[m.from]) unreadCounts[m.from] = 0;
    unreadCounts[m.from]++;
    document.title = `(${unreadCounts[m.from]}) MuyleeGram`;
    
    // Обновляем список, чтобы показать счетчик
    const ul = $('users');
    const listItems = [...ul.children];
    const existingLi = listItems.find(li => li.querySelector('.user-name')?.textContent === m.from);
    
    if (existingLi) {
      let badge = existingLi.querySelector('.unread-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'unread-badge';
        existingLi.appendChild(badge);
      }
      badge.textContent = unreadCounts[m.from];
    }
  }
});

// --- Индикатор печати ---
let typingTimeout = null;
const typingTimers = {};
socket.on('typing', ({ from, isTyping }) => {
  if (from !== currentTo) return;
  const el = $('typing');
  
  if (isTyping) {
    // Вставляем HTML с отдельными точками
    el.innerHTML = 'печатает <span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>';
    el.classList.add('visible');
    clearTimeout(typingTimers[from]);
    typingTimers[from] = setTimeout(() => { 
      el.classList.remove('visible'); 
    }, 2000);
  } else {
    el.classList.remove('visible');
  }
});