const socket = io();
let me = null;
let currentTo = null;
const $ = (id) => document.getElementById(id);
let unreadCounts = {}; // Объект для счетчиков

// ... (Функции getAvatarData, createAvatarElement, логин, список пользователей остаются прежними) ...

// Обновляем рендер списка пользователей для счетчика
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
    
    // Добавляем счетчик, если есть непрочитанные
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

// Обновляем открытие диалога
function openDialog(user) {
  currentTo = user;
  unreadCounts[user] = 0; // Сбрасываем счетчик
  document.title = 'MuyleeGram';// Сбрасываем заголовок
  
  $('chatHeaderText').textContent = 'Чат с ' + user;
  $('msgInput').disabled = false;
  $('sendBtn').disabled = false;
  $('msgInput').focus();
  $('messages').innerHTML = '';
  $('typing').classList.remove('visible');

  // Мобильный режим: показываем чат
  $('app').classList.add('chat-open');

  socket.emit('history', user, (msgs) => {
    msgs.forEach(renderMessage);
    scrollBottom();
  });

  // Обновляем список, чтобы убрать счетчик
  socket.emit('get_users'); // Предполагаем, что сервер может запросить список заново
  // Или просто перерисовываем локально (упрощенный вариант)
  [...$('users').children].forEach((li) => {
    if (li.classList.contains('empty')) return;
    const name = li.querySelector('.user-name').textContent;
    li.classList.toggle('active', name === user);
    const badge = li.querySelector('.unread-badge');
    if (badge) badge.remove();
  });
}

// Кнопка "Назад" для мобильных
$('backBtn').onclick = () => {
  $('app').classList.remove('chat-open');
  currentTo = null;
};

// Обработка новых сообщений (звук, счетчики)
socket.on('message', (m) => {
  const inCurrent = currentTo && ((m.from === me && m.to === currentTo) || (m.from === currentTo && m.to === me));
  
  if (inCurrent) {
    renderMessage(m);
    scrollBottom();
  } else if (m.from !== me) {
    // Сообщение от другого человека, но диалог не открыт
    if (!unreadCounts[m.from]) unreadCounts[m.from] = 0;
    unreadCounts[m.from]++;
    
    // Проигрываем звук
    const sound = $('notifySound');
    sound.currentTime = 0;
    sound.play().catch(e => console.log('Звук заблокирован браузером'));

    // Меняем заголовок вкладки
    document.title = `(${unreadCounts[m.from]}) Новое сообщение!`;
    
    // Перерисовываем список (упрощенно)
    socket.emit('request_users'); 
  }
});

// Запрос списка пользователей (нужно добавить на сервере)
// server.js: socket.on('request_users', () => io.emit('users', [...users.keys()]));