(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const GLYPH = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
  const VALUE = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
  const START = { P: 8, N: 2, B: 2, R: 2, Q: 1 };
  const COLOR_NAME = { w: 'White', b: 'Black' };
  const TEXT = '︎'; // ask for text glyphs, not emoji

  const store = {
    get(area, k) { try { return window[area].getItem(k); } catch (e) { return null; } },
    set(area, k, v) { try { window[area].setItem(k, v); } catch (e) { /* storage blocked */ } },
  };
  function randId(n) {
    const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)];
    return s;
  }

  // One identity per browser tab, so two tabs on one computer can play each other.
  let token = store.get('sessionStorage', 'chess-token');
  if (!token) { token = randId(20); store.set('sessionStorage', 'chess-token', token); }

  const params = new URLSearchParams(location.search);
  const room = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  let name = store.get('localStorage', 'chess-name') || '';

  function glyph(piece) {
    return `<span class="pc ${piece[0]}">${GLYPH[piece[1]]}${TEXT}</span>`;
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  async function shareBase() {
    try {
      const info = await (await fetch('/api/info')).json();
      const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname);
      if (local && info.ips.length) return `${location.protocol}//${info.ips[0]}:${info.port}`;
      return location.origin;
    } catch (e) {
      return location.origin;
    }
  }

  /* ---------------- Lobby ---------------- */
  if (!room) {
    $('#lobby').hidden = false;
    $('#name').value = name;
    const go = (code) => {
      store.set('localStorage', 'chess-name', $('#name').value.trim());
      location.search = '?room=' + code;
    };
    $('#create').onclick = () => go(randId(4));
    $('#joinForm').onsubmit = (e) => {
      e.preventDefault();
      const code = $('#code').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (code) go(code);
      else $('#code').focus();
    };
    shareBase().then((base) => {
      $('#addrs').textContent = `Other devices on your network can open ${base}`;
    });
    return;
  }

  /* ---------------- Game ---------------- */
  $('#game').hidden = false;
  $('#roomCode').textContent = room;
  document.title = `LAN Chess · ${room}`;

  let view = null;        // latest state from the server
  let selected = null;    // selected square index
  let flipLocal = false;  // manual flip toggle
  let pending = false;    // a move is in flight

  shareBase().then((base) => {
    const link = `${base}/?room=${room}`;
    $('#link').textContent = link;
    $('#copy').onclick = async () => {
      try { await navigator.clipboard.writeText(link); toast('Link copied'); }
      catch (e) {
        const r = document.createRange();
        r.selectNodeContents($('#link'));
        getSelection().removeAllRanges();
        getSelection().addRange(r);
        toast('Select-all done — press Ctrl+C / ⌘C');
      }
    };
  });

  // Build the 64 squares once.
  const boardEl = $('#board');
  const squares = [];
  for (let i = 0; i < 64; i++) {
    const d = document.createElement('div');
    d.className = 'sq';
    d.addEventListener('click', () => onSquare(+d.dataset.sq));
    boardEl.appendChild(d);
    squares.push(d);
  }

  function connect() {
    const q = new URLSearchParams({ room, token, name });
    const es = new EventSource('/api/events?' + q);
    const conn = $('#conn');
    es.addEventListener('state', (e) => {
      view = JSON.parse(e.data);
      pending = false;
      conn.textContent = 'Connected';
      conn.classList.remove('bad');
      render();
    });
    es.onerror = () => {
      conn.textContent = 'Reconnecting…';
      conn.classList.add('bad');
    };
  }

  async function act(type, extra) {
    try {
      const r = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ room, token, name, type }, extra)),
      });
      const data = await r.json();
      if (!r.ok) { toast(data.error || 'Something went wrong'); pending = false; render(); }
    } catch (e) {
      toast('Lost connection to the server');
      pending = false;
      render();
    }
  }

  function myLegalMoves() {
    if (!view || pending) return [];
    const g = view.game;
    if (g.result || view.you !== g.turn) return [];
    return Chess.legalMoves(g);
  }

  function onSquare(sq) {
    if (!view) return;
    const g = view.game;
    const legal = myLegalMoves();
    if (selected !== null) {
      const ms = legal.filter((m) => m.from === selected && m.to === sq);
      if (ms.length) {
        const from = selected;
        selected = null;
        if (ms[0].promo) choosePromotion(view.you).then((p) => p && sendMove(from, sq, p));
        else sendMove(from, sq);
        render();
        return;
      }
    }
    const p = g.board[sq];
    selected = p && p[0] === view.you && legal.some((m) => m.from === sq) && selected !== sq ? sq : null;
    render();
  }

  function sendMove(from, to, promo) {
    // Show the move right away; the server's reply confirms or corrects it.
    const next = Chess.makeMove(view.game, { from, to, promo });
    if (!next) return;
    view.game = next;
    view.drawOffer = null;
    pending = true;
    render();
    act('move', { move: { from, to, promo } });
  }

  function choosePromotion(color) {
    return new Promise((resolve) => {
      const modal = $('#promo');
      const box = $('#promoChoices');
      box.innerHTML = '';
      for (const t of ['Q', 'R', 'B', 'N']) {
        const b = document.createElement('button');
        b.type = 'button';
        b.innerHTML = glyph(color + t);
        b.onclick = () => { modal.hidden = true; resolve(t); };
        box.appendChild(b);
      }
      modal.onclick = (e) => { if (e.target === modal) { modal.hidden = true; resolve(null); } };
      modal.hidden = false;
    });
  }

  function capturedBy(board, color) {
    // Pieces of the other color missing from the board.
    const them = Chess.opp(color);
    const left = { P: 0, N: 0, B: 0, R: 0, Q: 0 };
    for (const p of board) if (p && p[0] === them && p[1] !== 'K') left[p[1]]++;
    const out = [];
    for (const t of ['Q', 'R', 'B', 'N', 'P']) {
      // Promotions can leave more pieces than the start; count those as zero missing.
      for (let i = 0; i < START[t] - left[t]; i++) out.push(them + t);
    }
    return out;
  }

  function material(board, color) {
    return board.reduce((s, p) => s + (p && p[0] === color ? VALUE[p[1]] : 0), 0);
  }

  function renderPlayer(el, color) {
    const g = view.game;
    const label = view.names[color] || COLOR_NAME[color];
    const seated = view.seated[color];
    const caps = capturedBy(g.board, color).map(glyph).join('');
    const diff = material(g.board, color) - material(g.board, Chess.opp(color));
    el.innerHTML =
      `<span class="dot ${view.online[color] ? 'on' : ''}" title="${view.online[color] ? 'online' : 'offline'}"></span>` +
      `<span>${seated ? escapeHTML(label) : `<span class="you">Waiting for ${COLOR_NAME[color]}…</span>`}</span>` +
      (view.you === color ? '<span class="you">(you)</span>' : '') +
      `<span class="caps">${caps}</span>` +
      (diff > 0 ? `<span class="adv">+${diff}</span>` : '') +
      (!g.result && g.turn === color ? '<span class="turn">to move</span>' : '');
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function statusText() {
    const g = view.game, me = view.you, r = g.result;
    if (r) {
      if (r.reason === 'checkmate') return [`Checkmate — ${COLOR_NAME[r.winner]} wins`, me ? (r.winner === me ? 'Well played!' : 'Good game.') : ''];
      if (r.reason === 'resignation') return [`${COLOR_NAME[Chess.opp(r.winner)]} resigned — ${COLOR_NAME[r.winner]} wins`, ''];
      return ['Draw', r.reason === 'agreement' ? 'By agreement' : r.reason[0].toUpperCase() + r.reason.slice(1)];
    }
    const check = g.inCheck ? 'Check! ' : '';
    if (!view.seated.w || !view.seated.b) return ['Waiting for an opponent…', 'Send them the invite link below.'];
    if (!me) return [`${check}${COLOR_NAME[g.turn]} to move`, 'You are watching'];
    if (g.turn === me) return [`${check}Your move`, `You play ${COLOR_NAME[me]}`];
    return [`${check}Opponent's move`, view.online[g.turn] ? `You play ${COLOR_NAME[me]}` : 'Opponent is offline'];
  }

  function renderActions() {
    const g = view.game, me = view.you, el = $('#actions');
    el.innerHTML = '';
    const add = (label, fn, cls, disabled) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      if (cls) b.className = cls;
      b.disabled = !!disabled;
      b.onclick = fn;
      el.appendChild(b);
    };
    if (me) {
      if (g.result) {
        add('Rematch (swap colors)', () => act('rematch'), 'primary');
      } else {
        const started = g.history.length > 0;
        if (view.drawOffer === Chess.opp(me)) {
          add('Accept draw', () => act('draw-accept'), 'primary');
          add('Decline', () => act('draw-decline'));
        } else if (view.drawOffer === me) {
          add('Draw offered…', null, '', true);
        } else {
          add('Offer draw', () => act('draw-offer'), '', !started);
        }
        add('Resign', () => { if (confirm('Resign this game?')) act('resign'); }, '', !started);
      }
    } else {
      for (const c of ['w', 'b']) {
        if (!view.online[c]) add(`Play as ${COLOR_NAME[c]}`, () => act('take-seat', { seat: c }), 'primary');
      }
    }
  }

  function renderMoves() {
    const h = view.game.history, el = $('#moves');
    let html = '';
    for (let i = 0; i < h.length; i += 2) {
      const cur = (j) => (j === h.length - 1 ? ' class="cur"' : '');
      html += `<li><span class="n">${i / 2 + 1}.</span><span${cur(i)}>${h[i]}</span><span${cur(i + 1)}>${h[i + 1] || ''}</span></li>`;
    }
    el.innerHTML = html;
    el.scrollTop = el.scrollHeight;
  }

  function render() {
    if (!view) return;
    const g = view.game;
    const flip = (view.you === 'b') !== flipLocal;
    const legal = myLegalMoves();
    if (selected !== null && !legal.some((m) => m.from === selected)) selected = null;
    const targets = new Map();
    if (selected !== null) for (const m of legal) if (m.from === selected) targets.set(m.to, m.capture);
    const kingInCheck = g.inCheck ? g.board.indexOf(g.turn + 'K') : -1;

    for (let pos = 0; pos < 64; pos++) {
      const sq = flip ? 63 - pos : pos;
      const r = sq >> 3, c = sq & 7;
      const el = squares[pos];
      el.dataset.sq = sq;
      let cls = 'sq ' + ((r + c) % 2 ? 'd' : 'l');
      if (g.lastMove && (g.lastMove.from === sq || g.lastMove.to === sq)) cls += ' last';
      if (sq === selected) cls += ' sel';
      if (targets.has(sq)) cls += ' target' + (targets.get(sq) ? ' cap' : '');
      if (sq === kingInCheck) cls += ' check';
      el.className = cls;
      let html = g.board[sq] ? glyph(g.board[sq]) : '';
      if (pos % 8 === 0) html += `<span class="coord rank">${8 - r}</span>`;
      if (pos >= 56) html += `<span class="coord file">${'abcdefgh'[c]}</span>`;
      el.innerHTML = html;
      el.setAttribute('aria-label', Chess.sqName(sq) + (g.board[sq] ? ' ' + COLOR_NAME[g.board[sq][0]] + ' ' + g.board[sq][1] : ''));
    }

    const bottom = flip ? 'b' : 'w';
    renderPlayer($('#bottomPlayer'), bottom);
    renderPlayer($('#topPlayer'), Chess.opp(bottom));
    const [main, small] = statusText();
    $('#status').innerHTML = escapeHTML(main) + (small ? `<span class="small">${escapeHTML(small)}</span>` : '');
    renderActions();
    renderMoves();
  }

  $('#flip').onclick = () => { flipLocal = !flipLocal; render(); };
  connect();
})();
