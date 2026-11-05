// Verifies the move generator against well-known perft counts.
// Run: node test/perft.js
const assert = require('assert');
const Chess = require('../public/chess.js');

const cases = [
  ['start', Chess.newGame(), [20, 400, 8902, 197281]],
  // "Kiwipete": castling, en passant, promotions, pins
  ['kiwipete', Chess.fromFEN('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1'), [48, 2039, 97862]],
  ['position 3', Chess.fromFEN('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1'), [14, 191, 2812, 43238]],
  ['position 4', Chess.fromFEN('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1'), [6, 264, 9467]],
  ['position 5', Chess.fromFEN('rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8'), [44, 1486, 62379]],
];

for (const [name, pos, expected] of cases) {
  expected.forEach((want, i) => {
    const got = Chess.perft(pos, i + 1);
    assert.strictEqual(got, want, `${name} depth ${i + 1}: expected ${want}, got ${got}`);
  });
  console.log(`ok  ${name}`);
}

// Game-end detection and notation.
let g = Chess.newGame();
const sq = (n) => (8 - +n[1]) * 8 + 'abcdefgh'.indexOf(n[0]);
for (const [f, t] of [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']]) {
  g = Chess.makeMove(g, { from: sq(f), to: sq(t) });
  assert(g, `move ${f}-${t} should be legal`);
}
assert.deepStrictEqual(g.result, { winner: 'b', reason: 'checkmate' });
assert.deepStrictEqual(g.history, ['f3', 'e5', 'g4', 'Qh4#']);
assert.strictEqual(Chess.makeMove(Chess.newGame(), { from: sq('e2'), to: sq('e5') }), null);
console.log('ok  fool\'s mate + illegal move rejected');
