// LAN Chess server — no dependencies, just Node 18+.
// Run: node server.js   (PORT=8080 node server.js to change the port)
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Chess = require('./public/chess.js');

const PORT = +process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

const rooms = new Map();

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  return out;
}

function getRoom(id) {
  let room = rooms.get(id);
  if (!room) {
    room = { id, game: Chess.newGame(), players: { w: null, b: null }, names: { w: '', b: '' }, drawOffer: null, clients: new Set(), touched: Date.now() };
    rooms.set(id, room);
  }
  room.touched = Date.now();
  return room;
}

const colorOf = (room, token) => (room.players.w === token ? 'w' : room.players.b === token ? 'b' : null);
const isOnline = (room, color) => !!room.players[color] && [...room.clients].some((c) => c.token === room.players[color]);

function broadcast(room) {
  const online = { w: isOnline(room, 'w'), b: isOnline(room, 'b') };
  const seated = { w: !!room.players.w, b: !!room.players.b };
  for (const c of room.clients) {
    const view = { room: room.id, game: room.game, you: colorOf(room, c.token), names: room.names, online, seated, drawOffer: room.drawOffer };
    c.res.write(`event: state\ndata: ${JSON.stringify(view)}\n\n`);
  }
}

function sendJSON(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const cleanName = (s) => String(s || '').replace(/[<>]/g, '').trim().slice(0, 20);
const cleanRoom = (s) => (/^[A-Za-z0-9]{1,12}$/.test(s || '') ? s.toUpperCase() : null);

function handleEvents(req, res, url) {
  const id = cleanRoom(url.searchParams.get('room'));
  const token = url.searchParams.get('token') || '';
  if (!id || token.length < 8) return sendJSON(res, 400, { error: 'Bad room or token' });
  const room = getRoom(id);
  const name = cleanName(url.searchParams.get('name'));

  // First two distinct visitors take White, then Black. Everyone else watches.
  if (!colorOf(room, token)) {
    if (!room.players.w) room.players.w = token;
    else if (!room.players.b) room.players.b = token;
  }
  const color = colorOf(room, token);
  if (color && name) room.names[color] = name;

  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.write('retry: 2000\n\n');
  const client = { res, token };
  room.clients.add(client);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(ping);
    room.clients.delete(client);
    room.touched = Date.now();
    broadcast(room);
  });
  broadcast(room);
}

function handleAction(req, res) {
  let body = '';
  req.on('data', (d) => { body += d; if (body.length > 10000) req.destroy(); });
  req.on('end', () => {
    let msg;
    try { msg = JSON.parse(body); } catch { return sendJSON(res, 400, { error: 'Bad JSON' }); }
    const id = cleanRoom(msg.room);
    const room = id && rooms.get(id);
    if (!room) return sendJSON(res, 404, { error: 'No such game' });
    room.touched = Date.now();
    const me = colorOf(room, msg.token);
    const g = room.game;
    const fail = (error) => sendJSON(res, 400, { error });

    switch (msg.type) {
      case 'move': {
        if (!me) return fail('You are watching this game');
        if (g.turn !== me) return fail('Not your turn');
        const next = Chess.makeMove(g, msg.move);
        if (!next) return fail('Illegal move');
        room.game = next;
        room.drawOffer = null;
        break;
      }
      case 'resign':
        if (!me || g.result) return fail('Cannot resign now');
        room.game = Object.assign({}, g, { result: { winner: Chess.opp(me), reason: 'resignation' } });
        room.drawOffer = null;
        break;
      case 'draw-offer':
        if (!me || g.result) return fail('Cannot offer a draw now');
        room.drawOffer = me;
        break;
      case 'draw-accept':
        if (!me || g.result || room.drawOffer !== Chess.opp(me)) return fail('No draw offer to accept');
        room.game = Object.assign({}, g, { result: { winner: null, reason: 'agreement' } });
        room.drawOffer = null;
        break;
      case 'draw-decline':
        if (!me || room.drawOffer !== Chess.opp(me)) return fail('No draw offer to decline');
        room.drawOffer = null;
        break;
      case 'rematch':
        if (!me || !g.result) return fail('The game is still going');
        room.game = Chess.newGame();
        room.players = { w: room.players.b, b: room.players.w };
        room.names = { w: room.names.b, b: room.names.w };
        room.drawOffer = null;
        break;
      case 'take-seat': {
        const seat = msg.seat;
        if (me) return fail('You already have a seat');
        if (seat !== 'w' && seat !== 'b') return fail('Bad seat');
        if (isOnline(room, seat)) return fail('That seat is taken');
        room.players[seat] = msg.token;
        room.names[seat] = cleanName(msg.name);
        break;
      }
      default:
        return fail('Unknown action');
    }
    sendJSON(res, 200, { ok: true });
    broadcast(room);
  });
}

function serveStatic(req, res, url) {
  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = path.join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC + path.sep)) return sendJSON(res, 403, { error: 'Forbidden' });
  fs.readFile(file, (err, data) => {
    if (err) return sendJSON(res, 404, { error: 'Not found' });
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/api/events') return handleEvents(req, res, url);
  if (req.method === 'POST' && url.pathname === '/api/action') return handleAction(req, res);
  if (req.method === 'GET' && url.pathname === '/api/info') return sendJSON(res, 200, { ips: lanAddresses(), port: PORT });
  if (req.method === 'GET') return serveStatic(req, res, url);
  sendJSON(res, 405, { error: 'Method not allowed' });
});

// Forget games nobody has touched for a day.
setInterval(() => {
  const cutoff = Date.now() - 24 * 3600 * 1000;
  for (const [id, room] of rooms) if (!room.clients.size && room.touched < cutoff) rooms.delete(id);
}, 3600 * 1000).unref();

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  LAN Chess is running.\n');
  console.log(`  On this computer:   http://localhost:${PORT}`);
  for (const ip of lanAddresses()) console.log(`  On your network:    http://${ip}:${PORT}`);
  console.log('\n  Press Ctrl+C to stop.\n');
});
