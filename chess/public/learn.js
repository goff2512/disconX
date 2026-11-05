(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const STAGES = window.LESSON_STAGES;
  const ALL = STAGES.flatMap((st) => st.lessons);
  const GLYPH = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
  const NAME = { P: 'pawn', N: 'knight', B: 'bishop', R: 'rook', Q: 'queen', K: 'king' };
  const KEY = 'chess-lessons-done';
  const sqIndex = (n) => (8 - +n[1]) * 8 + 'abcdefgh'.indexOf(n[0]);
  const sqName = (i) => Chess.sqName(i);
  const glyph = (p) => `<span class="pc ${p[0]}">${GLYPH[p[1]]}&#xFE0E;</span>`;

  /* ---------- progress ---------- */
  function loadDone() {
    try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) { return new Set(); }
  }
  function saveDone(set) {
    try { localStorage.setItem(KEY, JSON.stringify([...set])); } catch (e) { /* storage blocked */ }
  }
  let done = loadDone();

  /* ---------- sound ---------- */
  let audio = null;
  function ding(good) {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const notes = good ? [660, 880] : [300, 220];
      notes.forEach((f, i) => {
        const o = audio.createOscillator(), g = audio.createGain();
        const t = audio.currentTime + 0.02 + i * 0.12;
        o.frequency.value = f;
        o.type = good ? 'sine' : 'triangle';
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(good ? 0.2 : 0.12, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        o.connect(g).connect(audio.destination);
        o.start(t);
        o.stop(t + 0.4);
      });
    } catch (e) { /* no sound */ }
  }

  /* ---------- lesson list ---------- */
  function showList() {
    $('#lesson').hidden = true;
    $('#done').hidden = true;
    $('#list').hidden = false;
    history.replaceState(null, '', location.pathname);
    const next = ALL.find((l) => !done.has(l.id));
    let html = '';
    for (const st of STAGES) {
      html += `<section class="stage"><h3>${st.title}</h3><div class="lesson-grid">`;
      for (const l of st.lessons) {
        const isDone = done.has(l.id), isNext = next && next.id === l.id;
        html += `<button type="button" class="lesson-card${isDone ? ' done' : ''}${isNext ? ' next' : ''}" data-id="${l.id}">
          <span class="check">${isDone ? '✓' : isNext ? '▶' : ''}</span>
          <span class="t">${l.title}</span><span class="d">${l.desc}</span></button>`;
      }
      html += '</div></section>';
    }
    $('#stages').innerHTML = html;
    $('#progressBar').style.width = `${Math.round((done.size / ALL.length) * 100)}%`;
    $('#progress').title = `${done.size} of ${ALL.length} lessons done`;
    document.querySelectorAll('.lesson-card').forEach((b) => { b.onclick = () => openLesson(b.dataset.id); });
    window.scrollTo(0, 0);
  }

  /* ---------- lesson runner ---------- */
  let lesson = null, stepIdx = 0, step = null;
  // per-step state
  let s = null, stars = null, selected = null, marks = new Map(), tapIdx = 0, quizIdx = 0, locked = false, lastMove = null;

  function openLesson(id) {
    lesson = ALL.find((l) => l.id === id);
    if (!lesson) return showList();
    history.replaceState(null, '', '?lesson=' + id);
    $('#list').hidden = true;
    $('#lesson').hidden = false;
    $('#lessonTitle').textContent = lesson.title;
    startStep(0);
    window.scrollTo(0, 0);
  }

  function startStep(i) {
    stepIdx = i;
    step = lesson.steps[i];
    $('#stepCount').textContent = `Step ${i + 1} of ${lesson.steps.length}`;
    $('#instruction').innerHTML = step.text || '';
    feedback('');
    $('#nextBtn').hidden = true;
    $('#restartBtn').hidden = !['tap', 'stars', 'capture', 'safe', 'mate', 'escape', 'special'].includes(step.type);
    $('#quiz').hidden = step.type !== 'quiz';
    selected = null; locked = false; tapIdx = 0; quizIdx = 0; marks = new Map();
    lastMove = step.lastMove ? { from: sqIndex(step.lastMove[0]), to: sqIndex(step.lastMove[1]) } : null;
    s = step.fen ? Chess.fromFEN(step.fen) : null;
    stars = new Set((step.stars || []).map(sqIndex));
    $('#boardWrap').hidden = !s && step.type !== 'tap';
    if (step.type === 'tap' && !s) s = Chess.fromFEN('8/8/8/8/8/8/8/8 w - - 0 1');

    if (step.type === 'card') {
      $('#nextBtn').hidden = false;
      $('#nextBtn').textContent = i === lesson.steps.length - 1 ? 'Finish ✓' : 'Next →';
    } else if (step.type === 'tap') {
      askTap();
    } else if (step.type === 'quiz') {
      showQuestion();
    } else {
      feedback(goalText(), 'goal');
    }
    drawBoard();
  }

  function goalText() {
    switch (step.type) {
      case 'stars': case 'safe': return `Stars left: ${stars.size}`;
      case 'capture': return `Black pieces left: ${blackCount()}`;
      default: return '';
    }
  }
  const blackCount = () => s.board.filter((p) => p && p[0] === 'b').length;

  function feedback(html, cls) {
    const f = $('#feedback');
    f.className = 'feedback' + (cls ? ' ' + cls : '');
    f.innerHTML = html;
  }

  function stepComplete(msg) {
    locked = true;
    ding(true);
    const last = stepIdx === lesson.steps.length - 1;
    feedback(`⭐ ${msg || 'Well done!'}`, 'good');
    $('#nextBtn').hidden = false;
    $('#nextBtn').textContent = last ? 'Finish ✓' : 'Next →';
  }

  function retry(msg, delay) {
    locked = true;
    ding(false);
    feedback(msg, 'bad');
    $('#boardWrap').classList.add('shake');
    setTimeout(() => $('#boardWrap').classList.remove('shake'), 500);
    setTimeout(() => {
      const keep = $('#feedback').innerHTML;
      startStep(stepIdx);
      feedback(keep + ' <span class="again">Try again!</span>', 'bad');
    }, delay || 1600);
  }

  function finishLesson() {
    done.add(lesson.id);
    saveDone(done);
    const idx = ALL.indexOf(lesson);
    const next = ALL[idx + 1];
    $('#doneText').innerHTML = `You finished <b>${lesson.title}</b>!` + (next ? `<br>Next up: <b>${next.title}</b>` : '<br>That was the last lesson. Time to play a real game!');
    $('#doneNext').hidden = !next;
    $('#doneNext').onclick = () => { $('#done').hidden = true; openLesson(next.id); };
    $('#doneList').onclick = () => showList();
    $('#done').hidden = false;
    ding(true);
  }

  $('#nextBtn').onclick = () => {
    if (stepIdx < lesson.steps.length - 1) startStep(stepIdx + 1);
    else finishLesson();
  };
  $('#restartBtn').onclick = () => startStep(stepIdx);
  $('#backBtn').onclick = showList;
  $('#resetProgress').onclick = () => {
    if (confirm('Start the lessons over? Your ✓ marks will be cleared.')) { done = new Set(); saveDone(done); showList(); }
  };

  /* ---------- tap the square ---------- */
  function askTap() {
    feedback(`Tap the square <b class="big">${step.targets[tapIdx]}</b> <span class="muted">(${tapIdx + 1} of ${step.targets.length})</span>`, 'goal');
  }

  function onTapSquare(sq) {
    const want = sqIndex(step.targets[tapIdx]);
    if (sq === want) {
      marks.set(sq, 'good-sq');
      tapIdx++;
      drawBoard();
      if (tapIdx >= step.targets.length) return stepComplete('You found them all!');
      ding(true);
      setTimeout(() => { marks.delete(sq); askTap(); drawBoard(); }, 450);
    } else {
      const name = sqName(sq), w = step.targets[tapIdx];
      ding(false);
      marks.set(sq, 'bad-sq');
      drawBoard();
      feedback(`That's <b>${name}</b>. Look for column <b>${w[0]}</b> (bottom edge) and row <b>${w[1]}</b> (left edge). Tap <b class="big">${w}</b>.`, 'bad');
      setTimeout(() => { marks.delete(sq); drawBoard(); }, 600);
    }
  }

  /* ---------- quiz ---------- */
  function showQuestion() {
    const q = step.questions[quizIdx];
    const choices = q.choices.slice().sort(() => Math.random() - 0.5);
    $('#quiz').innerHTML =
      `<p class="q-count">Question ${quizIdx + 1} of ${step.questions.length}</p>` +
      (q.glyph ? `<div class="q-glyph">${glyph(q.glyph)}</div>` : '') +
      `<p class="q">${q.q}</p><div class="choices">` +
      choices.map((c) => `<button type="button" class="choice" data-c="${c.replace(/"/g, '&quot;')}">${c}</button>`).join('') + '</div>';
    document.querySelectorAll('.choice').forEach((b) => {
      b.onclick = () => {
        if (locked) return;
        if (b.dataset.c === q.answer) {
          b.classList.add('right');
          locked = true;
          ding(true);
          feedback(`✓ Right!${q.why ? ' ' + q.why : ''}`, 'good');
          setTimeout(() => {
            locked = false;
            quizIdx++;
            if (quizIdx >= step.questions.length) { $('#quiz').hidden = true; stepComplete('All answers correct!'); } else { feedback(''); showQuestion(); }
          }, q.why ? 1800 : 900);
        } else {
          b.classList.add('wrong');
          b.disabled = true;
          ding(false);
          feedback(`Not quite. ${q.why || 'Try another answer.'}`, 'bad');
        }
      };
    });
  }

  /* ---------- board puzzles ---------- */
  function legalFrom(from) {
    return Chess.legalMoves(s).filter((m) => m.from === from && (!step.only || s.board[from][1] === step.only));
  }

  function onBoardSquare(sq) {
    if (locked || !s) return;
    if (step.type === 'tap') return onTapSquare(sq);
    if (!['stars', 'capture', 'safe', 'mate', 'escape', 'special'].includes(step.type)) return;
    if (selected !== null) {
      const ms = legalFrom(selected).filter((m) => m.to === sq);
      if (ms.length) {
        const m = ms.find((x) => !x.promo || x.promo === 'Q');
        selected = null;
        return playMove(m);
      }
    }
    const p = s.board[sq];
    selected = p && p[0] === 'w' && legalFrom(sq).length && selected !== sq ? sq : null;
    if (p && p[0] === 'w' && !legalFrom(sq).length && step.only && p[1] !== step.only) {
      feedback(`In this step, move the <b>${NAME[step.only]}</b>.`, 'goal');
    }
    drawBoard();
  }

  function playMove(m) {
    const before = s;
    const moved = before.board[m.from];
    const captured = m.enPassant ? 'bP' : before.board[m.to];
    lastMove = { from: m.from, to: m.to };

    if (step.type === 'stars' || step.type === 'capture' || step.type === 'safe') {
      // Black never moves in these lessons: it's always White's turn.
      s = Object.assign(Chess.advance(before, m), { turn: 'w', ep: null });
      if (step.type === 'safe' && Chess.isAttacked(s.board, m.to, 'b')) {
        const attacker = s.board.findIndex((p, i) => p && p[0] === 'b' && Chess.attackersOf(s.board, m.to, 'b').includes(i));
        marks = new Map([[m.to, 'bad-sq']]);
        if (attacker >= 0) marks.set(attacker, 'danger');
        drawBoard();
        return retry(`Oh no! The black ${NAME[s.board[attacker][1]]} could capture your ${NAME[moved[1]]} there.`);
      }
      stars.delete(m.to);
      if (moved[1] === 'P' && m.promo) feedback('Your pawn became a queen!', 'good');
      drawBoard();
      if (step.type === 'capture' ? blackCount() === 0 : stars.size === 0) {
        return stepComplete(step.type === 'capture' ? 'You captured them all!' : 'All stars collected!');
      }
      return feedback(goalText(), 'goal');
    }

    const n = Chess.makeMove(before, m);
    if (step.type === 'mate') {
      s = n;
      drawBoard();
      if (n.result && n.result.reason === 'checkmate') return stepComplete('Checkmate! You win!');
      if (n.inCheck) return retry('That\'s check, but the king can still escape. Look for a move that leaves no way out.', 2200);
      return retry('That isn\'t check. Find a move that attacks the king so it can\'t escape.', 2200);
    }
    if (step.type === 'escape') {
      const way = moved[1] === 'K' ? 'king' : captured ? 'capture' : 'block';
      const say = { king: 'moved the king', block: 'blocked the attack', capture: 'captured the attacker' };
      s = n;
      drawBoard();
      if (step.want && way !== step.want) {
        return retry(`You ${say[way]}, and that works too! But this time try to <b>${step.want === 'king' ? 'move the king' : step.want === 'block' ? 'block' : 'capture the attacker'}</b>.`, 2600);
      }
      return stepComplete(`You ${say[way]}. Out of check!`);
    }
    if (step.type === 'special') {
      s = n;
      drawBoard();
      const ok = { castleK: m.castle === 'K', castleQ: m.castle === 'Q', castle: !!m.castle, enPassant: !!m.enPassant, promo: !!m.promo }[step.kind];
      if (ok) {
        const msg = { castleK: 'You castled! The king is tucked away and the rook joins the game.', castleQ: 'You castled the long way!', castle: 'You castled on the safe side!', enPassant: 'En passant! You captured the pawn as it passed by.', promo: 'Your pawn became a queen!' }[step.kind];
        return stepComplete(msg);
      }
      const how = { castleK: 'tap the king, then the square two steps to the right', castleQ: 'tap the king, then the square two steps to the left', castle: 'move the king two squares toward a rook', enPassant: 'move your pawn diagonally behind the black pawn', promo: 'move the pawn to the very last row' }[step.kind];
      return retry(`That's a legal move, but not the one we're practising. To do it, ${how}.`, 2600);
    }
  }

  /* ---------- drawing ---------- */
  const boardEl = $('#board');
  const squares = [];
  for (let i = 0; i < 64; i++) {
    const d = document.createElement('div');
    d.className = 'sq';
    d.addEventListener('click', () => onBoardSquare(i));
    boardEl.appendChild(d);
    squares.push(d);
  }

  function drawBoard() {
    if (!s) return;
    const b = s.board;
    let targets = new Map();
    if (selected !== null) {
      for (const m of legalFrom(selected)) {
        let cls = m.capture ? 'target cap' : 'target';
        if (step.type === 'safe') {
          const nb = Chess.applyToBoard(b, m);
          cls += Chess.isAttacked(nb, m.to, 'b') ? ' unsafe' : ' safe';
        }
        targets.set(m.to, cls);
      }
    }
    if (step.showMoves) {
      const from = sqIndex(step.showMoves);
      const demo = Object.assign({}, s, { turn: b[from][0] });
      targets = new Map(Chess.legalMoves(demo).filter((m) => m.from === from).map((m) => [m.to, m.capture ? 'target cap' : 'target']));
    }
    const danger = new Set();
    if (step.showAttacks || step.showDanger) {
      for (let i = 0; i < 64; i++) if (!b[i] || b[i][0] !== 'b') { if (Chess.isAttacked(b, i, 'b')) danger.add(i); }
    }
    const mk = step.marks || {};
    const gold = new Set((mk.squares || []).map(sqIndex).concat(mk.square ? [sqIndex(mk.square)] : []));
    const check = s.inCheck ? b.indexOf(s.turn + 'K') : -1;

    for (let i = 0; i < 64; i++) {
      const r = i >> 3, c = i & 7;
      let cls = 'sq ' + ((r + c) % 2 ? 'd' : 'l');
      if (mk.file === c || (mk.rank && 8 - r === mk.rank)) cls += ' band';
      if (gold.has(i)) cls += ' gold';
      if (lastMove && (lastMove.from === i || lastMove.to === i)) cls += ' last';
      if (i === selected) cls += ' sel';
      if (targets.has(i)) cls += ' ' + targets.get(i);
      if (danger.has(i)) cls += ' dangerSq';
      if (i === check) cls += ' check';
      if (marks.has(i)) cls += ' ' + marks.get(i);
      squares[i].className = cls;
      let html = b[i] ? glyph(b[i]) : stars.has(i) ? '<span class="star">★</span>' : '';
      if (c === 0) html += `<span class="coord rank">${8 - r}</span>`;
      if (r === 7) html += `<span class="coord file">${'abcdefgh'[c]}</span>`;
      if (step.labels === 'all' && !b[i]) html += `<span class="sqname big-name">${sqName(i)}</span>`;
      squares[i].innerHTML = html;
      squares[i].setAttribute('aria-label', sqName(i) + (b[i] ? ' ' + NAME[b[i][1]] : stars.has(i) ? ' star' : ''));
    }
  }

  /* ---------- start ---------- */
  const want = new URLSearchParams(location.search).get('lesson');
  if (want && ALL.some((l) => l.id === want)) openLesson(want);
  else showList();
})();
