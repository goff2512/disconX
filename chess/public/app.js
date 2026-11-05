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
  let coachOn = store.get('localStorage', 'chess-coach') === '1';
  let hint = null;        // { move, why } from the hint button
  let prevGame = null;    // position before the last move, for describing it

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

  // Live updates arrive over a Server-Sent Events stream. Some tunnels and proxies hold
  // that stream back, so if nothing arrives quickly we fall back to polling once a second.
  let polling = false;
  let inFlight = 0;     // actions being sent; polls wait so they don't show a stale board
  let lastRaw = '';
  const conn = $('#conn');

  function onState(raw) {
    if (raw === lastRaw) return;
    lastRaw = raw;
    const next = JSON.parse(raw);
    const oldGame = view && view.game;
    if (!oldGame || next.game.history.join() !== oldGame.history.join()) {
      hint = null;
      if (oldGame && next.game.history.length === oldGame.history.length + 1) prevGame = oldGame;
      else if (next.game.history.length === 0) prevGame = null;
    }
    view = next;
    pending = false;
    conn.textContent = 'Connected';
    conn.classList.remove('bad');
    render();
  }

  function connect() {
    const q = new URLSearchParams({ room, token, name });
    const es = new EventSource('/api/events?' + q);
    let got = false;
    es.addEventListener('state', (e) => { got = true; onState(e.data); });
    es.onerror = () => {
      if (polling) return;
      conn.textContent = 'Reconnecting…';
      conn.classList.add('bad');
    };
    setTimeout(() => {
      if (got) return;
      es.close();
      polling = true;
      poll();
    }, 4000);
  }

  async function poll() {
    clearTimeout(poll.timer);
    if (!inFlight) {
      try {
        const r = await fetch('/api/state?' + new URLSearchParams({ room, token, name }), { cache: 'no-store' });
        if (r.ok && !inFlight) onState(await r.text());
      } catch (e) {
        conn.textContent = 'Reconnecting…';
        conn.classList.add('bad');
      }
    }
    poll.timer = setTimeout(poll, 1000);
  }

  async function act(type, extra) {
    inFlight++;
    try {
      const r = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ room, token, name, type }, extra)),
      });
      const data = await r.json();
      if (!r.ok) { toast(data.error || 'Something went wrong'); failed(); }
    } catch (e) {
      toast('Lost connection to the server');
      failed();
    } finally {
      inFlight--;
      if (polling) poll();
    }
  }

  // Undo an optimistic move by reloading the real state from the server.
  function failed() {
    pending = false;
    lastRaw = '';
    fetch('/api/state?' + new URLSearchParams({ room, token, name }), { cache: 'no-store' })
      .then((r) => r.text()).then(onState).catch(() => render());
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
        const go = () => {
          if (ms[0].promo) choosePromotion(view.you).then((p) => p && sendMove(from, sq, p));
          else sendMove(from, sq);
        };
        const risk = coachOn && Coach.moveRisk(g, ms[0]);
        if (risk && risk.net >= 3) {
          confirmMove(`Careful! Your ${Coach.NAME[risk.piece[1]]} on ${Chess.sqName(sq)} could be captured by the ${Coach.NAME[risk.attackerPiece[1]]} on ${Chess.sqName(risk.attacker)}` +
            (risk.defended ? '. You would lose more than you get back.' : ', and nothing protects it.'), go, () => { selected = from; render(); });
        } else go();
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
    prevGame = view.game;
    hint = null;
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

  function confirmMove(text, yes, no) {
    const modal = $('#confirm');
    $('#confirmText').textContent = text;
    modal.hidden = false;
    $('#confirmYes').onclick = () => { modal.hidden = true; yes(); };
    $('#confirmNo').onclick = () => { modal.hidden = true; no(); };
    modal.onclick = (e) => { if (e.target === modal) { modal.hidden = true; no(); } };
  }

  /* ---------------- Learning mode ---------------- */
  function coachMarks() {
    // Square -> extra CSS classes for the board.
    const marks = new Map();
    const add = (sq, cls) => marks.set(sq, (marks.get(sq) || '') + ' ' + cls);
    if (!coachOn || !view.you) return marks;
    const g = view.game;
    if (g.result) return marks;
    for (const t of Coach.threats(g.board, view.you)) add(t.square, 'danger');
    if (g.turn === view.you) {
      for (const t of Coach.threats(g.board, Chess.opp(view.you))) add(t.square, 'win');
      if (g.inCheck) for (const c of Coach.checkers(g)) add(c, 'danger');
    }
    if (hint) { add(hint.move.from, 'hint'); add(hint.move.to, 'hint'); }
    return marks;
  }

  function coachText() {
    const g = view.game, me = view.you;
    const P = (txt, cls) => `<p${cls ? ` class="${cls}"` : ''}>${escapeHTML(txt)}</p>`;
    if (!me) return P('Learning mode helps the players. Take a seat to use it.');
    if (g.result) return P(g.result.winner === me ? 'You won! Click Rematch to play again.' : 'Every game teaches something. Click Rematch to play again.');
    let html = '';
    const last = Coach.describeLastMove(prevGame, g);
    if (last && prevGame && prevGame.turn !== me) html += P(last);
    if (g.turn !== me) {
      html += P('Tip: ' + Coach.TIPS[Math.floor(g.history.length / 2) % Coach.TIPS.length]);
      const mine = Coach.threats(g.board, me);
      if (mine.length) html += P('Watch out: pieces with a red ring could be captured.', 'warn');
      return html;
    }
    if (hint) return html + P('Hint: ' + hint.why, 'good');
    if (g.inCheck) {
      return html + P('You are in CHECK! Your king is under attack (red ring). You must do one of these:', 'warn') +
        P('1. Move the king to a safe square.  2. Block the attack with another piece.  3. Capture the attacking piece.');
    }
    if (selected !== null) {
      const p = g.board[selected];
      html += P(Coach.PIECE_INFO[p[1]]);
      for (const n of Coach.specialNotes(g, selected, myLegalMoves())) html += P(n);
      html += P('Green dots are safe squares. Red dots are squares where it could be captured.');
      return html;
    }
    const mine = Coach.threats(g.board, me);
    if (mine.length) {
      const t = mine[0];
      html += P(`Your ${Coach.NAME[t.piece[1]]} on ${Chess.sqName(t.square)} is under attack by the ${Coach.NAME[t.attackerPiece[1]]} on ${Chess.sqName(t.attacker)}. Move it, protect it, or capture the attacker.`, 'warn');
    }
    const theirs = Coach.threats(g.board, Chess.opp(me));
    if (theirs.length) {
      const t = theirs[0];
      html += P(`Look! Their ${Coach.NAME[t.piece[1]]} on ${Chess.sqName(t.square)} (green ring) can be won. Can you find how?`, 'good');
    }
    return html + P('Your turn. Tap one of your pieces to see where it can go.');
  }

  function renderCoach() {
    $('#coachToggle').checked = coachOn;
    $('#coach').hidden = !coachOn;
    if (!coachOn) return;
    $('#coachText').innerHTML = coachText();
    const g = view.game;
    $('#hintBtn').disabled = !view.you || !!g.result || g.turn !== view.you || pending;
  }

  $('#coachToggle').onchange = (e) => {
    coachOn = e.target.checked;
    store.set('localStorage', 'chess-coach', coachOn ? '1' : '0');
    hint = null;
    render();
  };
  $('#hintBtn').onclick = () => {
    if (!view) return;
    $('#hintBtn').disabled = true;
    $('#coachText').innerHTML = '<p>Thinking…</p>';
    setTimeout(() => {
      hint = Coach.bestMove(view.game);
      selected = null;
      render();
    }, 30);
  };

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

  const lastCaps = {};
  const popAt = {};
  function renderPlayer(el, color) {
    const g = view.game;
    const label = view.names[color] || COLOR_NAME[color];
    const seated = view.seated[color];
    const capList = capturedBy(g.board, color);
    const before = lastCaps[color];
    const hl = g.history.length;
    if (before && before.hl !== hl) {
      // A capture on the latest move: remember which tray piece is new until the next move.
      const idx = before.list.length < capList.length
        ? capList.findIndex((p, i) => capList.indexOf(p) === i && capList.filter((q) => q === p).length > before.list.filter((q) => q === p).length)
        : -1;
      popAt[color] = idx >= 0 ? { hl, idx } : null;
    }
    lastCaps[color] = { hl, list: capList };
    const newIdx = popAt[color] && popAt[color].hl === hl ? popAt[color].idx : -1;
    const caps = capList.map((p, i) => glyph(p).replace('class="pc ', i === newIdx ? 'class="pc new ' : 'class="pc ')).join('');
    const diff = material(g.board, color) - material(g.board, Chess.opp(color));
    const html =
      `<span class="dot ${view.online[color] ? 'on' : ''}" title="${view.online[color] ? 'online' : 'offline'}"></span>` +
      `<span>${seated ? escapeHTML(label) : `<span class="you">Waiting for ${COLOR_NAME[color]}…</span>`}</span>` +
      (view.you === color ? '<span class="you">(you)</span>' : '') +
      `<span class="caps">${caps}</span>` +
      (diff > 0 ? `<span class="adv">+${diff}</span>` : '') +
      (!g.result && g.turn === color ? '<span class="turn">to move</span>' : '');
    if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
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
    const marks = coachMarks();
    const showSafety = coachOn && selected !== null;

    for (let pos = 0; pos < 64; pos++) {
      const sq = flip ? 63 - pos : pos;
      const r = sq >> 3, c = sq & 7;
      const el = squares[pos];
      el.dataset.sq = sq;
      let cls = 'sq ' + ((r + c) % 2 ? 'd' : 'l');
      if (g.lastMove && (g.lastMove.from === sq || g.lastMove.to === sq)) cls += ' last';
      if (sq === selected) cls += ' sel';
      if (targets.has(sq)) {
        cls += ' target' + (targets.get(sq) ? ' cap' : '');
        if (showSafety) {
          const m = legal.find((x) => x.from === selected && x.to === sq);
          cls += Coach.moveRisk(g, m) ? ' unsafe' : ' safe';
        }
      }
      if (marks.has(sq)) cls += marks.get(sq);
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
    renderCoach();
    renderMoves();
  }

  $('#flip').onclick = () => { flipLocal = !flipLocal; render(); };
  connect();
})();
