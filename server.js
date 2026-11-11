const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const users = new Map();
const dialogs = new Map();
const dialogKey = (a, b) => [a, b].sort().join('|');

io.on('connection', (socket) => {
  let currentNick = null;

  socket.on('login', (nick, cb) => {
    nick = (nick || '').trim();
    if (!nick) return cb({ ok: false, error: 'Введи ник' });
    if (users.has(nick)) return cb({ ok: false, error: 'Ник занят' });

    currentNick = nick;
    users.set(nick, { socketId: socket.id });
    socket.join('user:' + nick);
    io.emit('users', [...users.keys()]);
    cb({ ok: true });
  });

  socket.on('send', ({ to, text }) => {
    if (!currentNick || !to) return;
    text = (text || '').trim();
    if (!text) return;

    const msg = { from: currentNick, to, text, ts: Date.now() };
    const key = dialogKey(currentNick, to);
    if (!dialogs.has(key)) dialogs.set(key, []);
    dialogs.get(key).push(msg);

    io.to('user:' + to).emit('message', msg);
    socket.emit('message', msg);
  });

  socket.on('history', (withNick, cb) => {
    if (!currentNick) return cb([]);
    cb(dialogs.get(dialogKey(currentNick, withNick)) || []);
  });

  socket.on('typing', ({ to, isTyping }) => {
    if (!currentNick || !to) return;
    io.to('user:' + to).emit('typing', { from: currentNick, isTyping });
  });

  socket.on('disconnect', () => {
    if (currentNick) {
      users.delete(currentNick);
      io.emit('users', [...users.keys()]);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`▶ http://localhost:${PORT}`));