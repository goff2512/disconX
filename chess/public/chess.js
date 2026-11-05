/*
 * Chess rules engine shared by the browser and the Node server.
 * Board: array of 64 squares, index 0 = a8, 7 = h8, 56 = a1, 63 = h1.
 * Pieces are strings like "wK", "bP"; empty squares are null.
 */
(function (root) {
  'use strict';

  const FILES = 'abcdefgh';
  const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  const onBoard = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const idx = (r, c) => r * 8 + c;
  const opp = (c) => (c === 'w' ? 'b' : 'w');
  const sqName = (i) => FILES[i & 7] + (8 - (i >> 3));

  function newGame() {
    const b = Array(64).fill(null);
    const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    for (let f = 0; f < 8; f++) {
      b[f] = 'b' + back[f];
      b[8 + f] = 'bP';
      b[48 + f] = 'wP';
      b[56 + f] = 'w' + back[f];
    }
    return finishInit({ board: b, turn: 'w', castling: { wK: true, wQ: true, bK: true, bQ: true }, ep: null, halfmove: 0, fullmove: 1 });
  }

  function fromFEN(fen) {
    const [pos, turn, cast, ep, hm, fm] = fen.trim().split(/\s+/);
    const b = [];
    for (const ch of pos.replace(/\//g, '')) {
      if (/\d/.test(ch)) for (let i = 0; i < +ch; i++) b.push(null);
      else b.push((ch === ch.toUpperCase() ? 'w' : 'b') + ch.toUpperCase());
    }
    const c = cast || '-';
    return finishInit({
      board: b,
      turn: turn || 'w',
      castling: { wK: c.includes('K'), wQ: c.includes('Q'), bK: c.includes('k'), bQ: c.includes('q') },
      ep: ep && ep !== '-' ? (8 - +ep[1]) * 8 + FILES.indexOf(ep[0]) : null,
      halfmove: +(hm || 0),
      fullmove: +(fm || 1),
    });
  }

  function finishInit(s) {
    s.history = [];
    s.lastMove = null;
    s.result = null;
    s.inCheck = isAttacked(s.board, s.board.indexOf(s.turn + 'K'), opp(s.turn));
    s.positions = { [positionKey(s)]: 1 };
    return s;
  }

  function positionKey(s) {
    const c = s.castling;
    return s.board.map((p) => p || '--').join('') + s.turn +
      (c.wK ? 'K' : '') + (c.wQ ? 'Q' : '') + (c.bK ? 'k' : '') + (c.bQ ? 'q' : '') + (s.ep == null ? '-' : s.ep);
  }

  function isAttacked(board, sq, by) {
    if (sq < 0) return false;
    const r = sq >> 3, c = sq & 7;
    const pr = by === 'w' ? r + 1 : r - 1;
    for (const dc of [-1, 1]) {
      if (onBoard(pr, c + dc) && board[idx(pr, c + dc)] === by + 'P') return true;
    }
    for (const [dr, dc] of KNIGHT) {
      if (onBoard(r + dr, c + dc) && board[idx(r + dr, c + dc)] === by + 'N') return true;
    }
    for (const [dr, dc] of KING) {
      if (onBoard(r + dr, c + dc) && board[idx(r + dr, c + dc)] === by + 'K') return true;
    }
    const slide = (dirs, a, b) => {
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (onBoard(rr, cc)) {
          const p = board[idx(rr, cc)];
          if (p) {
            if (p === by + a || p === by + b) return true;
            break;
          }
          rr += dr; cc += dc;
        }
      }
      return false;
    };
    return slide(ROOK_DIRS, 'R', 'Q') || slide(BISHOP_DIRS, 'B', 'Q');
  }

  // Squares of pieces of color `by` that attack `sq` (also finds defenders of a piece).
  function attackersOf(board, sq, by) {
    const out = [];
    const r = sq >> 3, c = sq & 7;
    const pr = by === 'w' ? r + 1 : r - 1;
    for (const dc of [-1, 1]) {
      if (onBoard(pr, c + dc) && board[idx(pr, c + dc)] === by + 'P') out.push(idx(pr, c + dc));
    }
    for (const [dr, dc] of KNIGHT) {
      if (onBoard(r + dr, c + dc) && board[idx(r + dr, c + dc)] === by + 'N') out.push(idx(r + dr, c + dc));
    }
    for (const [dr, dc] of KING) {
      if (onBoard(r + dr, c + dc) && board[idx(r + dr, c + dc)] === by + 'K') out.push(idx(r + dr, c + dc));
    }
    const slide = (dirs, a, b) => {
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (onBoard(rr, cc)) {
          const p = board[idx(rr, cc)];
          if (p) {
            if (p === by + a || p === by + b) out.push(idx(rr, cc));
            break;
          }
          rr += dr; cc += dc;
        }
      }
    };
    slide(ROOK_DIRS, 'R', 'Q');
    slide(BISHOP_DIRS, 'B', 'Q');
    return out;
  }

  function pseudoMoves(s, from) {
    const b = s.board, p = b[from];
    if (!p) return [];
    const col = p[0], t = p[1], r = from >> 3, c = from & 7, out = [];
    const add = (to, extra) => out.push(Object.assign({ from, to }, extra));

    if (t === 'P') {
      const dir = col === 'w' ? -1 : 1, start = col === 'w' ? 6 : 1, last = col === 'w' ? 0 : 7;
      const push = (to, extra) => {
        if ((to >> 3) === last) for (const pr of ['Q', 'R', 'B', 'N']) add(to, Object.assign({ promo: pr }, extra));
        else add(to, extra);
      };
      const r1 = r + dir;
      if (onBoard(r1, c) && !b[idx(r1, c)]) {
        push(idx(r1, c));
        if (r === start && !b[idx(r + 2 * dir, c)]) add(idx(r + 2 * dir, c), { double: true });
      }
      for (const dc of [-1, 1]) {
        const cc = c + dc;
        if (!onBoard(r1, cc)) continue;
        const to = idx(r1, cc);
        if (b[to] && b[to][0] !== col) push(to, { capture: true });
        else if (to === s.ep && !b[to]) add(to, { capture: true, enPassant: true });
      }
    } else if (t === 'N' || t === 'K') {
      for (const [dr, dc] of t === 'N' ? KNIGHT : KING) {
        const rr = r + dr, cc = c + dc;
        if (!onBoard(rr, cc)) continue;
        const to = idx(rr, cc);
        if (!b[to]) add(to);
        else if (b[to][0] !== col) add(to, { capture: true });
      }
      const home = col === 'w' ? 60 : 4, them = opp(col);
      if (t === 'K' && from === home && !isAttacked(b, home, them)) {
        const cr = s.castling;
        if (cr[col + 'K'] && !b[home + 1] && !b[home + 2] && b[home + 3] === col + 'R' &&
            !isAttacked(b, home + 1, them) && !isAttacked(b, home + 2, them)) add(home + 2, { castle: 'K' });
        if (cr[col + 'Q'] && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === col + 'R' &&
            !isAttacked(b, home - 1, them) && !isAttacked(b, home - 2, them)) add(home - 2, { castle: 'Q' });
      }
    } else {
      const dirs = t === 'R' ? ROOK_DIRS : t === 'B' ? BISHOP_DIRS : ROOK_DIRS.concat(BISHOP_DIRS);
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (onBoard(rr, cc)) {
          const to = idx(rr, cc);
          if (!b[to]) add(to);
          else {
            if (b[to][0] !== col) add(to, { capture: true });
            break;
          }
          rr += dr; cc += dc;
        }
      }
    }
    return out;
  }

  function applyToBoard(board, m) {
    const b = board.slice(), p = b[m.from], col = p[0];
    b[m.to] = m.promo ? col + m.promo : p;
    b[m.from] = null;
    if (m.enPassant) b[m.to + (col === 'w' ? 8 : -8)] = null;
    if (m.castle === 'K') { b[m.from + 1] = b[m.from + 3]; b[m.from + 3] = null; }
    if (m.castle === 'Q') { b[m.from - 1] = b[m.from - 4]; b[m.from - 4] = null; }
    return b;
  }

  function legalMoves(s) {
    const out = [];
    for (let i = 0; i < 64; i++) {
      if (!s.board[i] || s.board[i][0] !== s.turn) continue;
      for (const m of pseudoMoves(s, i)) {
        const nb = applyToBoard(s.board, m);
        if (!isAttacked(nb, nb.indexOf(s.turn + 'K'), opp(s.turn))) out.push(m);
      }
    }
    return out;
  }

  // Bare position update (used by perft and makeMove).
  function advance(s, m) {
    const p = s.board[m.from], col = s.turn;
    const castling = Object.assign({}, s.castling);
    if (p[1] === 'K') { castling[col + 'K'] = false; castling[col + 'Q'] = false; }
    for (const sq of [m.from, m.to]) {
      if (sq === 63) castling.wK = false;
      if (sq === 56) castling.wQ = false;
      if (sq === 7) castling.bK = false;
      if (sq === 0) castling.bQ = false;
    }
    return {
      board: applyToBoard(s.board, m),
      turn: opp(col),
      castling,
      ep: m.double ? (m.from + m.to) / 2 : null,
      halfmove: p[1] === 'P' || m.capture ? 0 : s.halfmove + 1,
      fullmove: s.fullmove + (col === 'b' ? 1 : 0),
    };
  }

  function insufficientMaterial(board) {
    const rest = [];
    board.forEach((p, i) => { if (p && p[1] !== 'K') rest.push([p, i]); });
    if (rest.length === 0) return true;
    if (rest.length === 1 && (rest[0][0][1] === 'N' || rest[0][0][1] === 'B')) return true;
    if (rest.every(([p]) => p[1] === 'B')) {
      const shade = (i) => ((i >> 3) + (i & 7)) % 2;
      return rest.every(([, i]) => shade(i) === shade(rest[0][1]));
    }
    return false;
  }

  function toSAN(s, m, legal) {
    if (m.castle) return m.castle === 'K' ? 'O-O' : 'O-O-O';
    const p = s.board[m.from], t = p[1];
    if (t === 'P') {
      return (m.capture ? FILES[m.from & 7] + 'x' : '') + sqName(m.to) + (m.promo ? '=' + m.promo : '');
    }
    const others = legal.filter((o) => o.to === m.to && o.from !== m.from && s.board[o.from] === p);
    let dis = '';
    if (others.length) {
      const sameFile = others.some((o) => (o.from & 7) === (m.from & 7));
      const sameRank = others.some((o) => (o.from >> 3) === (m.from >> 3));
      if (!sameFile) dis = FILES[m.from & 7];
      else if (!sameRank) dis = String(8 - (m.from >> 3));
      else dis = sqName(m.from);
    }
    return t + dis + (m.capture ? 'x' : '') + sqName(m.to);
  }

  // Returns the new game state, or null if the move is illegal.
  function makeMove(s, req) {
    if (!s || s.result || !req) return null;
    const legal = legalMoves(s);
    const m = legal.find((x) => x.from === req.from && x.to === req.to && (!x.promo || x.promo === (req.promo || 'Q')));
    if (!m) return null;
    let san = toSAN(s, m, legal);
    const n = advance(s, m);
    const key = positionKey(n);
    n.positions = Object.assign({}, s.positions);
    n.positions[key] = (n.positions[key] || 0) + 1;
    n.inCheck = isAttacked(n.board, n.board.indexOf(n.turn + 'K'), s.turn);
    n.lastMove = { from: m.from, to: m.to };
    n.result = null;
    const replies = legalMoves(n);
    if (!replies.length) {
      if (n.inCheck) { san += '#'; n.result = { winner: s.turn, reason: 'checkmate' }; }
      else n.result = { winner: null, reason: 'stalemate' };
    } else {
      if (n.inCheck) san += '+';
      if (n.halfmove >= 100) n.result = { winner: null, reason: '50-move rule' };
      else if (n.positions[key] >= 3) n.result = { winner: null, reason: 'threefold repetition' };
      else if (insufficientMaterial(n.board)) n.result = { winner: null, reason: 'insufficient material' };
    }
    n.history = s.history.concat([san]);
    return n;
  }

  function perft(s, depth) {
    if (depth === 0) return 1;
    const moves = legalMoves(s);
    if (depth === 1) return moves.length;
    let n = 0;
    for (const m of moves) n += perft(advance(s, m), depth - 1);
    return n;
  }

  const api = { newGame, fromFEN, legalMoves, makeMove, advance, isAttacked, attackersOf, applyToBoard, sqName, opp, perft };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Chess = api;
})(typeof self !== 'undefined' ? self : this);
