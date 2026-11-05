/*
 * Lesson content. Each lesson is a list of steps:
 *   card    – explanation, optionally with a board (fen) and highlighted squares or a piece's moves
 *   tap     – tap the named squares in order (labels: 'all' shows every square's name)
 *   quiz    – multiple-choice questions
 *   stars   – move your piece onto every star ★
 *   capture – capture every black piece (black pieces don't move)
 *   safe    – collect the stars without landing where a black piece could capture you
 *   mate    – give checkmate in one move
 *   escape  – get out of check (want: 'king' | 'block' | 'capture')
 *   special – make a special move (kind: 'castleK' | 'castleQ' | 'castle' | 'enPassant' | 'promo')
 * White is always at the bottom. "only" limits which piece type can be moved.
 */
(function () {
  'use strict';
  const G = (p) => `<span class="pc ${p[0]}">${{ K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' }[p[1]]}&#xFE0E;</span>`;
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  const pieceTable = `
    <table class="piece-table">
      <tr><td>${G('wK')}</td><td><b>King</b></td><td>The most important piece. Protect it!</td></tr>
      <tr><td>${G('wQ')}</td><td><b>Queen</b></td><td>The strongest piece. Worth 9.</td></tr>
      <tr><td>${G('wR')}</td><td><b>Rook</b></td><td>Looks like a castle tower. Worth 5.</td></tr>
      <tr><td>${G('wB')}</td><td><b>Bishop</b></td><td>Has a pointed hat. Worth 3.</td></tr>
      <tr><td>${G('wN')}</td><td><b>Knight</b></td><td>Looks like a horse. Worth 3.</td></tr>
      <tr><td>${G('wP')}</td><td><b>Pawn</b></td><td>The smallest piece. You start with 8. Worth 1.</td></tr>
    </table>`;

  const nameQuiz = (t, name, wrongs) => ({ q: 'What is this piece called?', glyph: 'w' + t, choices: [name, ...wrongs], answer: name });

  window.LESSON_STAGES = [
    {
      title: '1. The board',
      lessons: [
        {
          id: 'board-names', title: 'Squares have names', desc: 'Letters, numbers, and how to find a square',
          steps: [
            { type: 'card', fen: '8/8/8/8/8/8/8/8 w - - 0 1', labels: 'all', marks: { file: 4, rank: 4, square: 'e4' },
              text: `<p>The chessboard has <b>64 squares</b>: 8 columns and 8 rows.</p>
                     <p>The <b>columns</b> are named with letters <b>a to h</b>, from left to right.</p>
                     <p>The <b>rows</b> are numbered <b>1 to 8</b>, starting from White's side at the bottom.</p>
                     <p>Every square's name is its <b>letter + number</b>. The gold square is in column <b>e</b> and row <b>4</b>, so it's called <b>e4</b>.</p>` },
            { type: 'tap', labels: 'all', targets: ['e4', 'a1', 'h8', 'd5', 'c3'],
              text: '<p>Every square shows its name for now. Tap the square I ask for.</p>' },
          ],
        },
        {
          id: 'board-find', title: 'Find the square', desc: 'No more name tags: use the letters and numbers on the edges',
          steps: [
            { type: 'tap', labels: 'edge', targets: ['b6', 'f2', 'g7', 'd4', 'e5', 'h1', 'a8', 'c7'],
              text: '<p>Now the squares have no name tags. Find the <b>letter</b> along the bottom edge and the <b>number</b> along the left edge, then follow them to where they meet.</p>' },
          ],
        },
      ],
    },
    {
      title: '2. The pieces',
      lessons: [
        {
          id: 'pieces-meet', title: 'Meet the pieces', desc: 'Names, and what each piece is worth',
          steps: [
            { type: 'card', text: `<p>Each player starts with 16 pieces. There are six kinds:</p>${pieceTable}` },
            { type: 'card', fen: START, text: '<p>This is how a game starts. White is at the bottom, Black at the top. The queen starts on her own colour: the white queen on a light square, the black queen on a dark one.</p><p>White always moves first.</p>' },
            { type: 'quiz', questions: [
              nameQuiz('R', 'Rook', ['Bishop', 'King']),
              nameQuiz('N', 'Knight', ['Pawn', 'Queen']),
              nameQuiz('B', 'Bishop', ['Rook', 'Knight']),
              nameQuiz('Q', 'Queen', ['King', 'Bishop']),
              nameQuiz('K', 'King', ['Queen', 'Rook']),
              nameQuiz('P', 'Pawn', ['Knight', 'Bishop']),
            ] },
          ],
        },
        {
          id: 'piece-rook', title: 'The rook', desc: 'Straight lines',
          steps: [
            { type: 'card', fen: '8/8/8/8/3R4/8/8/8 w - - 0 1', showMoves: 'd4', text: `<p>${G('wR')} The <b>rook</b> moves in <b>straight lines</b>: up, down, left or right, as far as it likes. The dots show where it can go.</p><p>It can't jump over other pieces.</p>` },
            { type: 'stars', fen: '8/8/8/8/8/8/8/R7 w - - 0 1', stars: ['a5', 'e5', 'e8'], text: '<p>Move the rook onto every star ★. Tap the rook, then tap where it should go.</p>' },
            { type: 'stars', fen: '8/8/8/3P4/8/8/8/R2P4 w - - 0 1', stars: ['c1', 'c8', 'h8'], only: 'R', text: '<p>Your own pawns are in the way. The rook can\'t jump over them, so find a way around.</p>' },
          ],
        },
        {
          id: 'piece-bishop', title: 'The bishop', desc: 'Diagonals',
          steps: [
            { type: 'card', fen: '8/8/8/8/3B4/8/8/8 w - - 0 1', showMoves: 'd4', text: `<p>${G('wB')} The <b>bishop</b> moves <b>diagonally</b>, as far as it likes.</p><p>A bishop that starts on a light square stays on light squares all game. You have one of each.</p>` },
            { type: 'stars', fen: '8/8/8/8/8/8/8/2B5 w - - 0 1', stars: ['e3', 'g5', 'd8'], text: '<p>Collect all the stars with the bishop.</p>' },
            { type: 'stars', fen: '8/8/8/8/8/8/8/2B5 w - - 0 1', stars: ['a3', 'f8', 'h6'], text: '<p>Again! Notice all the stars are on dark squares, just like your bishop.</p>' },
          ],
        },
        {
          id: 'piece-queen', title: 'The queen', desc: 'Straight lines and diagonals',
          steps: [
            { type: 'card', fen: '8/8/8/8/3Q4/8/8/8 w - - 0 1', showMoves: 'd4', text: `<p>${G('wQ')} The <b>queen</b> moves like a rook <b>and</b> a bishop together: any distance in a straight line or a diagonal.</p><p>She's your strongest piece, so keep her safe!</p>` },
            { type: 'stars', fen: '8/8/8/8/8/8/8/3Q4 w - - 0 1', stars: ['d7', 'a4', 'h4', 'h8'], text: '<p>Collect all the stars with the queen.</p>' },
          ],
        },
        {
          id: 'piece-king', title: 'The king', desc: 'One step at a time',
          steps: [
            { type: 'card', fen: '8/8/8/8/3K4/8/8/8 w - - 0 1', showMoves: 'd4', text: `<p>${G('wK')} The <b>king</b> moves <b>one square</b> in any direction.</p><p>He's slow, but he's the most important piece: if your king is trapped, you lose the game.</p>` },
            { type: 'stars', fen: '8/8/8/8/8/8/8/4K3 w - - 0 1', stars: ['e2', 'f3', 'g3', 'g2'], text: '<p>Walk the king to every star.</p>' },
          ],
        },
        {
          id: 'piece-knight', title: 'The knight', desc: 'The jumping L',
          steps: [
            { type: 'card', fen: '8/8/8/8/3N4/8/8/8 w - - 0 1', showMoves: 'd4', text: `<p>${G('wN')} The <b>knight</b> moves in an <b>L shape</b>: two squares one way, then one square to the side.</p><p>It's the only piece that can <b>jump over</b> other pieces.</p>` },
            { type: 'stars', fen: '8/8/8/8/8/8/8/1N6 w - - 0 1', stars: ['c3', 'e4', 'f6', 'h7'], text: '<p>Hop the knight to every star.</p>' },
            { type: 'stars', fen: '8/8/8/8/8/2PPP3/2P1P3/1N6 w - - 0 1', stars: ['d2', 'f3', 'g5'], only: 'N', text: '<p>The knight can jump right over the pawns!</p>' },
          ],
        },
        {
          id: 'piece-pawn', title: 'The pawn', desc: 'Forward only, capture diagonally',
          steps: [
            { type: 'card', fen: '8/8/8/8/8/8/4P3/8 w - - 0 1', showMoves: 'e2', text: `<p>${G('wP')} The <b>pawn</b> moves <b>straight forward one square</b>. On its very first move it may go <b>two</b>.</p><p>Pawns never move backwards.</p>` },
            { type: 'stars', fen: '8/8/8/8/8/8/4P3/8 w - - 0 1', stars: ['e4', 'e6'], text: '<p>March the pawn to the stars. Try moving two squares on the first move.</p>' },
            { type: 'card', fen: '8/8/8/3p1p2/4P3/8/8/8 w - - 0 1', showMoves: 'e4', text: '<p>Pawns are different when they <b>capture</b>: they take a piece <b>one square diagonally forward</b>. They can\'t capture straight ahead.</p>' },
            { type: 'capture', fen: '8/8/2p5/3p4/4P3/8/8/8 w - - 0 1', text: '<p>Capture both black pawns with your pawn.</p>' },
            { type: 'special', kind: 'promo', fen: '8/4P3/8/8/8/8/8/8 w - - 0 1', text: '<p>When a pawn reaches the <b>other end</b> of the board, it turns into a queen (or a rook, bishop or knight). This is called <b>promotion</b>. Move the pawn to the last row!</p>' },
          ],
        },
      ],
    },
    {
      title: '3. Capturing',
      lessons: [
        {
          id: 'capture-basics', title: 'Capture!', desc: 'Take the enemy pieces',
          steps: [
            { type: 'card', text: '<p>To <b>capture</b>, move your piece onto the square of an enemy piece. The enemy piece is removed from the board.</p><p>You can never capture your own pieces.</p>' },
            { type: 'capture', fen: '8/8/1n6/8/8/1R2b3/8/8 w - - 0 1', text: '<p>Capture both black pieces with your rook. (In lessons, Black doesn\'t move.)</p>' },
            { type: 'capture', fen: '8/8/6p1/8/1p6/8/8/3Q4 w - - 0 1', text: '<p>Now with the queen. Capture both pawns.</p>' },
            { type: 'capture', fen: '8/8/8/3r4/8/2N1b3/8/8 w - - 0 1', text: '<p>The knight can capture too. Take both black pieces.</p>' },
          ],
        },
        {
          id: 'capture-values', title: 'What pieces are worth', desc: 'Good trades and bad trades',
          steps: [
            { type: 'card', text: `<p>Pieces have <b>points</b> to help you decide if a capture is a good idea:</p>
              <table class="piece-table">
                <tr><td>${G('wP')}</td><td>Pawn</td><td><b>1</b></td></tr>
                <tr><td>${G('wN')}</td><td>Knight</td><td><b>3</b></td></tr>
                <tr><td>${G('wB')}</td><td>Bishop</td><td><b>3</b></td></tr>
                <tr><td>${G('wR')}</td><td>Rook</td><td><b>5</b></td></tr>
                <tr><td>${G('wQ')}</td><td>Queen</td><td><b>9</b></td></tr>
                <tr><td>${G('wK')}</td><td>King</td><td>priceless</td></tr>
              </table>
              <p>If you capture something but then lose your piece, you've made a <b>trade</b>. Only trade when you get at least as much back.</p>` },
            { type: 'quiz', questions: [
              { q: 'Which is worth more?', choices: ['Rook', 'Knight'], answer: 'Rook', why: 'A rook is worth 5, a knight 3.' },
              { q: 'How many points is a queen worth?', choices: ['3', '5', '9'], answer: '9' },
              { q: 'Your knight can capture their bishop, but then their pawn captures your knight. Is that a fair trade?', choices: ['Yes', 'No'], answer: 'Yes', why: 'Knight and bishop are both worth 3, so it\'s even.' },
              { q: 'Your queen can capture a pawn, but then their knight captures your queen. Good idea?', choices: ['Yes', 'No'], answer: 'No', why: 'You win 1 point but lose 9.' },
              { q: 'Which piece is worth the least?', choices: ['Bishop', 'Pawn', 'Rook'], answer: 'Pawn' },
            ] },
          ],
        },
        {
          id: 'capture-safe', title: "Don't get captured", desc: 'Watch the squares the enemy controls',
          steps: [
            { type: 'card', fen: '8/8/8/8/3b4/8/8/8 w - - 0 1', showAttacks: 'd4', text: '<p>Enemy pieces <b>attack</b> the squares they could move to. The red squares are where this black bishop could capture.</p><p>If you put a piece on a red square, you could lose it!</p>' },
            { type: 'safe', fen: '8/8/8/8/3b4/8/8/R7 w - - 0 1', stars: ['a6', 'h6', 'h1'], showDanger: true, text: '<p>Collect the stars with your rook, but never stop on a red square.</p>' },
            { type: 'safe', fen: '8/8/8/4n3/8/8/8/3Q4 w - - 0 1', stars: ['d4', 'b6', 'b8', 'h8'], text: '<p>This time the danger squares are hidden. Think about where the knight could jump! When you tap your queen, red dots warn you.</p>' },
          ],
        },
      ],
    },
    {
      title: '4. Check and checkmate',
      lessons: [
        {
          id: 'check', title: 'Check!', desc: 'When your king is attacked',
          steps: [
            { type: 'card', fen: 'k7/8/8/8/8/8/8/r3K3 w - - 0 1', text: '<p>When a king is under attack, it\'s called <b>check</b>. Here the black rook is attacking the white king.</p><p>You <b>must</b> get out of check right away. There are three ways:</p><p>1. <b>Move</b> the king to a safe square.<br>2. <b>Block</b> the attack by putting a piece in the way.<br>3. <b>Capture</b> the attacking piece.</p>' },
            { type: 'escape', want: 'king', fen: 'k7/8/8/8/8/8/8/r3K3 w - - 0 1', text: '<p>Your king is in check from the rook. <b>Move the king</b> to a safe square (off the bottom row).</p>' },
            { type: 'escape', want: 'block', fen: 'k7/8/8/8/8/8/3R4/r3K3 w - - 0 1', text: '<p>In check again. This time <b>block</b> the attack: put your rook between the king and the black rook.</p>' },
            { type: 'escape', want: 'capture', fen: 'k7/8/8/8/8/8/1B6/r3K3 w - - 0 1', text: '<p>One more. This time <b>capture</b> the attacking rook!</p>' },
          ],
        },
        {
          id: 'checkmate', title: 'Checkmate', desc: 'How to win the game',
          steps: [
            { type: 'card', text: '<p>If a king is in check and there is <b>no way out</b> (no safe square, nothing can block, nothing can capture), that\'s <b>checkmate</b>. The game is over and the other player wins!</p><p>Let\'s find some checkmates. Each one takes just <b>one move</b>.</p>' },
            { type: 'mate', fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', text: '<p>The black king is stuck behind its own pawns. Give checkmate with your rook!</p>' },
            { type: 'mate', fen: 'k7/8/1K6/8/8/8/8/7Q w - - 0 1', text: '<p>Your king guards the squares next to the black king. Checkmate with the queen!</p>' },
            { type: 'mate', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', text: '<p>A famous trap called <b>Scholar\'s Mate</b>. Your queen and bishop are both aiming at one weak pawn. Find the checkmate!</p>' },
          ],
        },
      ],
    },
    {
      title: '5. Special moves',
      lessons: [
        {
          id: 'castling', title: 'Castling', desc: 'Tuck your king away safely',
          steps: [
            { type: 'card', fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', text: '<p><b>Castling</b> moves your king and a rook in one turn: the king slides <b>two squares</b> toward a rook, and the rook hops over to the other side of the king.</p><p>You may only castle if the king and that rook haven\'t moved yet, nothing is between them, and the king isn\'t in check or passing through an attacked square.</p>' },
            { type: 'special', kind: 'castleK', fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', text: '<p>Castle to the <b>right</b> (the short side): tap the king, then the square two steps to the right.</p>' },
            { type: 'special', kind: 'castleQ', fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', text: '<p>Now castle to the <b>left</b> (the long side): tap the king, then the square two steps to the left.</p>' },
            { type: 'special', kind: 'castle', fen: 'k4r2/8/8/8/8/8/8/R3K2R w KQ - 0 1', text: '<p>The black rook attacks a square the king would cross on one side, so castling that way isn\'t allowed. Castle on the side that\'s safe.</p>' },
          ],
        },
        {
          id: 'en-passant', title: 'En passant', desc: 'A sneaky pawn capture',
          steps: [
            { type: 'card', fen: 'k7/3p4/8/4P3/8/8/8/K7 w - - 0 1', text: '<p>This one is rare but fun. When an enemy pawn moves <b>two squares</b> forward and lands right <b>beside</b> your pawn, your pawn may capture it <b>as if it had only moved one</b>.</p><p>It\'s called <b>en passant</b> (French for "in passing") and you can only do it on the very next move.</p>' },
            { type: 'special', kind: 'enPassant', fen: 'k7/8/8/3pP3/8/8/8/K7 w - d6 0 1', lastMove: ['d7', 'd5'], text: '<p>Black just moved the pawn two squares (yellow), landing next to yours. Capture it en passant: move your pawn diagonally onto the square <b>behind</b> it.</p>' },
          ],
        },
      ],
    },
    {
      title: '6. Playing well',
      lessons: [
        {
          id: 'opening-tips', title: 'How to start a game', desc: 'Five simple rules for the opening',
          steps: [
            { type: 'card', fen: START, marks: { squares: ['d4', 'e4', 'd5', 'e5'] }, text: '<p><b>1. Control the centre.</b> The four gold squares in the middle are the most important. Move a pawn there early, like the one in front of your king.</p>' },
            { type: 'card', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', text: '<p><b>2. Bring out your knights and bishops.</b> Pieces sitting at the back don\'t help. Try to move each one once before moving any piece twice.</p>' },
            { type: 'card', fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 5 5', text: '<p><b>3. Castle early</b> to keep your king safe in the corner.</p><p><b>4. Don\'t bring your queen out too soon.</b> The other pieces can chase her around.</p><p><b>5. Before every move, ask: what is my opponent threatening?</b></p>' },
            { type: 'quiz', questions: [
              { q: 'Which squares are the most important at the start?', choices: ['The corners', 'The centre', 'The edges'], answer: 'The centre' },
              { q: 'What should you usually move out early?', choices: ['Knights and bishops', 'The king', 'The rooks'], answer: 'Knights and bishops' },
              { q: 'Why castle early?', choices: ['To keep the king safe', 'To win a pawn', 'It\'s required'], answer: 'To keep the king safe' },
            ] },
            { type: 'card', text: '<p><b>You\'ve finished the lessons!</b> 🎉</p><p>Now play a real game. In the game, set <b>Help level</b> to <b>New learner</b> at first. Once you know the square names, switch to <b>Intermediate</b>.</p>' },
          ],
        },
      ],
    },
  ];
})();
