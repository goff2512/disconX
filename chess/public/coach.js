/*
 * Learning-mode helpers: piece explanations, danger detection, and a small
 * hint engine. Runs only in the browser of the player who switched it on.
 */
(function (root) {
  'use strict';
  const C = root.Chess || (typeof require !== 'undefined' ? require('./chess.js') : null);

  const NAME = { P: 'pawn', N: 'knight', B: 'bishop', R: 'rook', Q: 'queen', K: 'king' };
  const WORTH = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 100 };
  const COLOR = { w: 'White', b: 'Black' };

  const PIECE_INFO = {
    P: 'Pawn (worth 1). Moves straight forward one square, or two on its very first move. It captures one square diagonally forward. If it reaches the far side, it becomes a queen.',
    N: 'Knight (worth 3). Moves in an "L": two squares one way, then one square to the side. It\'s the only piece that can jump over others.',
    B: 'Bishop (worth 3). Moves any distance diagonally. It stays on the same square colour all game.',
    R: 'Rook (worth 5). Moves any distance straight up, down, left or right.',
    Q: 'Queen (worth 9). Your strongest piece: moves any distance in a straight line or diagonally. Keep her safe!',
    K: 'King (protect it!). Moves one square in any direction, but never onto a square that is attacked. If your king is trapped and attacked, that\'s checkmate and the game is over.',
  };

  const TIPS = [
    'Pieces in the middle of the board control more squares. Try to put pawns on the centre squares early.',
    'Bring out your knights and bishops early. They do nothing while they sit at the back.',
    'Castle early to tuck your king safely in the corner.',
    'Don\'t bring your queen out too early. She can get chased around.',
    'Before every move, ask: "What is my opponent threatening?"',
    'Piece values: pawn 1, knight 3, bishop 3, rook 5, queen 9. Only trade when you get at least as much back.',
    'A piece that is attacked but not defended can be taken for free. Look for those, on both sides!',
    'Checks, captures, threats: look at those moves first.',
    'Rooks love open lines with no pawns in the way.',
    'Try to move each piece only once in the opening, then get the next one out.',
  ];

  const sq = (i) => C.sqName(i);
  const named = (p) => NAME[p[1]];

  // How much material the piece on `at` would lose if the opponent captures it now.
  function exposure(board, at) {
    const p = board[at];
    if (!p || p[1] === 'K') return null;
    const me = p[0], them = C.opp(me);
    const defenders = C.attackersOf(board, at, me);
    let attackers = C.attackersOf(board, at, them);
    if (defenders.length) attackers = attackers.filter((a) => board[a][1] !== 'K');
    if (!attackers.length) return null;
    attackers.sort((a, b) => WORTH[board[a][1]] - WORTH[board[b][1]]);
    const cheapest = attackers[0];
    const loss = defenders.length ? WORTH[p[1]] - WORTH[board[cheapest][1]] : WORTH[p[1]];
    return loss > 0 ? { square: at, piece: p, loss, attacker: cheapest, attackerPiece: board[cheapest], defended: defenders.length > 0 } : null;
  }

  // All pieces of `color` that are hanging or attacked by something cheaper.
  function threats(board, color) {
    const out = [];
    for (let i = 0; i < 64; i++) {
      if (board[i] && board[i][0] === color) {
        const e = exposure(board, i);
        if (e) out.push(e);
      }
    }
    return out.sort((a, b) => b.loss - a.loss);
  }

  function capturedBy(s, m) {
    if (m.enPassant) return C.opp(s.turn) + 'P';
    return s.board[m.to];
  }

  // Would this move give material away? Returns details or null.
  function moveRisk(s, m) {
    const nb = C.applyToBoard(s.board, m);
    const e = exposure(nb, m.to);
    if (!e) return null;
    const gain = m.capture ? WORTH[capturedBy(s, m)[1]] : 0;
    const net = e.loss - gain;
    return net > 0 ? Object.assign(e, { net }) : null;
  }

  function checkers(s) {
    const k = s.board.indexOf(s.turn + 'K');
    return k < 0 ? [] : C.attackersOf(s.board, k, C.opp(s.turn));
  }

  /* ---------- Hint engine: 2-ply search + capture search ---------- */
  const VAL = { P: 100, N: 310, B: 320, R: 500, Q: 900, K: 0 };
  const MATE = 100000;

  function evaluate(s) {
    let score = 0;
    const b = s.board;
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (!p) continue;
      const r = i >> 3, c = i & 7, t = p[1];
      const adv = p[0] === 'w' ? 7 - r : r; // 0 = own back rank
      const centre = 3.5 - Math.max(Math.abs(3.5 - r), Math.abs(3.5 - c)); // 0.5 edge … 3.5 centre
      let v = VAL[t];
      if (t === 'P') v += adv * 4 + ((c === 3 || c === 4) && adv >= 2 ? 15 : 0);
      else if (t === 'N' || t === 'B') v += centre * 8 - (adv === 0 ? 15 : 0);
      else if (t === 'K') v += adv === 0 && (c <= 2 || c >= 6) ? 25 : 0;
      score += p[0] === s.turn ? v : -v;
    }
    return score;
  }

  function order(moves, board) {
    const key = (m) => (m.capture ? 10 * VAL[(board[m.to] || 'xP')[1]] - VAL[board[m.from][1]] / 10 : 0) + (m.promo ? 800 : 0);
    return moves.sort((a, b) => key(b) - key(a));
  }

  function inCheck(s) {
    return C.isAttacked(s.board, s.board.indexOf(s.turn + 'K'), C.opp(s.turn));
  }

  function quiesce(s, alpha, beta, ply, qd) {
    const moves = C.legalMoves(s);
    if (!moves.length) return inCheck(s) ? -MATE + ply : 0;
    const stand = evaluate(s);
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    if (qd >= 4) return alpha;
    for (const m of order(moves.filter((x) => x.capture || x.promo), s.board)) {
      const v = -quiesce(C.advance(s, m), -beta, -alpha, ply + 1, qd + 1);
      if (v >= beta) return beta;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }

  function search(s, depth, alpha, beta, ply) {
    if (depth === 0) return quiesce(s, alpha, beta, ply, 0);
    const moves = C.legalMoves(s);
    if (!moves.length) return inCheck(s) ? -MATE + ply : 0;
    for (const m of order(moves, s.board)) {
      const v = -search(C.advance(s, m), depth - 1, -beta, -alpha, ply + 1);
      if (v >= beta) return beta;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }

  function bestMove(s, plain) {
    const moves = order(C.legalMoves(s), s.board);
    let best = null, bestScore = -Infinity;
    for (const m of moves) {
      const alpha = Math.max(bestScore, -MATE - 1);
      const v = -search(C.advance(s, m), 1, -MATE - 1, -alpha, 1);
      if (v > bestScore) { bestScore = v; best = m; }
    }
    return best && { move: best, why: explainMove(s, best, plain) };
  }

  // plain = true: no square names (for players who don't know them yet). The hint's
  // squares are shown on the board: a blue ring on the piece, a blue square where it goes.
  function explainMove(s, m, plain) {
    const p = s.board[m.from];
    const at = (i) => (plain ? '' : ` on ${sq(i)}`);
    const what = plain ? `Move your ${named(p)} (blue ring) to the blue square.` : `Move your ${named(p)} from ${sq(m.from)} to ${sq(m.to)}.`;
    const n = C.makeMove(s, m);
    if (n && n.result && n.result.reason === 'checkmate') return `${what} That's checkmate. You win!`;
    if (m.castle) return `Castle! Your king moves two squares and the rook jumps over it. The king is safer and the rook joins the game.`;
    if (m.promo) return `${what} Your pawn reaches the end and becomes a queen!`;
    if (m.capture) {
      const cap = capturedBy(s, m);
      const free = !C.attackersOf(s.board, m.to, C.opp(s.turn)).length;
      if (free) return `${what} You capture their ${named(cap)} and it isn't protected, so it's free.`;
      if (WORTH[cap[1]] > WORTH[p[1]]) return `${what} You trade your ${named(p)} (worth ${WORTH[p[1]]}) for their ${named(cap)} (worth ${WORTH[cap[1]]}). Good deal!`;
      return `${what} You capture their ${named(cap)}.`;
    }
    const danger = exposure(s.board, m.from);
    if (danger) return `${what} Your ${named(p)} is under attack by their ${named(danger.attackerPiece)}${at(danger.attacker)}. This gets it to safety.`;
    const after = new Set(threats(C.applyToBoard(s.board, m), s.turn).map((t) => t.square));
    const saved = threats(s.board, s.turn).find((t) => t.square !== m.from && !after.has(t.square));
    if (saved) return `${what} This protects your ${named(saved.piece)}${at(saved.square)}, which was under attack.`;
    if (n && n.inCheck) return `${what} It puts their king in check, so they must deal with it.`;
    if (s.history.length < 16 && (p[1] === 'N' || p[1] === 'B') && ((m.from >> 3) === 0 || (m.from >> 3) === 7)) {
      return `${what} This brings a new piece into the game.`;
    }
    if (p[1] === 'P' && ((m.to & 7) === 3 || (m.to & 7) === 4)) return `${what} This pawn helps control the centre of the board.`;
    return `${what} It improves your position and doesn't leave anything hanging.`;
  }

  // Extra notes about special moves the selected piece can make right now.
  function specialNotes(s, from, legal) {
    const notes = [];
    const ms = legal.filter((m) => m.from === from);
    if (ms.some((m) => m.castle)) notes.push('You can castle now: tap the square two steps to the side of your king.');
    if (ms.some((m) => m.enPassant)) notes.push('Special move "en passant": this pawn can capture the pawn that just moved two squares past it, as if it had only moved one.');
    if (ms.some((m) => m.promo)) notes.push('This pawn can reach the last row and turn into a queen (or another piece).');
    if (!ms.length) notes.push('This piece has no legal moves right now.');
    return notes;
  }

  function describeLastMove(prev, g, plain) {
    if (!prev || !g.lastMove) return '';
    const { from, to } = g.lastMove;
    const p = prev.board[from];
    if (!p) return '';
    const who = COLOR[p[0]];
    const san = g.history[g.history.length - 1] || '';
    if (san.startsWith('O-O')) return `${who} castled.`;
    const cap = prev.board[to] || (p[1] === 'P' && (from & 7) !== (to & 7) ? C.opp(p[0]) + 'P' : null);
    if (plain) return `${who} moved a ${named(p)}${cap ? ` and captured your ${named(cap)}` : ''}. The yellow squares show where it came from and where it went.`;
    let text = `${who} moved a ${named(p)} from ${sq(from)} to ${sq(to)}`;
    if (cap) text += ` and captured your ${named(cap)}`;
    return text + '.';
  }

  const api = { NAME, WORTH, PIECE_INFO, TIPS, threats, exposure, moveRisk, checkers, bestMove, explainMove, specialNotes, describeLastMove };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Coach = api;
})(typeof self !== 'undefined' ? self : this);
