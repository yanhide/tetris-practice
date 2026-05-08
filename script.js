// ====== HTML の要素を取得 ======
const canvas = document.getElementById('game');
const context = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextContext = nextCanvas.getContext('2d');
const scoreElement = document.getElementById('score');
const messageElement = document.getElementById('message');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');
const effectBanner = document.getElementById('effect-banner');
const garbageCountdownElement = document.getElementById('garbage-countdown');
const freezeCountdownElement = document.getElementById('freeze-countdown');

// ====== ゲームの基本設定 ======
const COLS = 10; // 盤面の横マス数
const ROWS = 20; // 盤面の縦マス数
const BLOCK_SIZE = 30; // 1マスの大きさ（px）
const NEXT_BLOCK_SIZE = 24; // 次ブロック表示用の1マスの大きさ
const EMPTY = 0; // 盤面が空のときの値
const DROP_SPEED = 700; // 通常の落下間隔（ミリ秒）
const GARBAGE_INTERVAL = 15000; // お邪魔ブロックがせり上がる間隔
const FREEZE_DURATION = 8000; // 時間停止アイテムの効果時間

// テトリミノ（落ちてくるブロック）の形と色です。
// 1 はブロックあり、0 は空白を表します。
const TETROMINOES = [
  {
    name: 'I',
    color: '#22d3ee',
    matrix: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]
  },
  {
    name: 'J',
    color: '#60a5fa',
    matrix: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ]
  },
  {
    name: 'L',
    color: '#fb923c',
    matrix: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ]
  },
  {
    name: 'O',
    color: '#facc15',
    matrix: [
      [1, 1],
      [1, 1]
    ]
  },
  {
    name: 'S',
    color: '#4ade80',
    matrix: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ]
  },
  {
    name: 'T',
    color: '#c084fc',
    matrix: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ]
  },
  {
    name: 'Z',
    color: '#f87171',
    matrix: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ]
  }
];

// アイテムは1マスの特別なブロックとして落ちてきます。
const ITEMS = [
  { name: '爆弾', effect: 'bomb', label: 'B', color: '#f43f5e', message: '爆弾で周囲を消去！' },
  { name: '1列消去', effect: 'line', label: 'L', color: '#fbbf24', message: '1列消去アイテム発動！' },
  { name: '時間停止', effect: 'freeze', label: 'T', color: '#67e8f9', message: '時間停止！お邪魔が止まる！' }
];

let board;
let currentPiece;
let nextPiece;
let score;
let isGameOver;
let isRunning;
let isPaused;
let dropTimerId;
let statusTimerId;
let pieceCount;
let nextGarbageAt;
let freezeUntil;

// ====== 初期表示 ======
resetGame();
draw();

// ====== ゲームの状態を最初から作り直す ======
function resetGame() {
  board = createBoard();
  currentPiece = createPiece();
  nextPiece = createPiece();
  score = 0;
  isGameOver = false;
  isRunning = false;
  isPaused = false;
  pieceCount = 0;
  nextGarbageAt = Date.now() + GARBAGE_INTERVAL;
  freezeUntil = 0;
  scoreElement.textContent = score;
  messageElement.textContent = 'Enter でスタート';
  startButton.textContent = 'ゲーム開始';
  stopTimers();
  updateStatusPanel();
}

// 20行 x 10列の空の盤面を作ります。
function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
}

// ランダムに次のブロック、またはアイテムを作ります。
function createPiece() {
  // 5個に1個くらいの確率でアイテムを出します。
  if (pieceCount > 0 && pieceCount % 5 === 0) {
    return createItemPiece();
  }

  const type = TETROMINOES[Math.floor(Math.random() * TETROMINOES.length)];
  return {
    kind: 'tetromino',
    name: type.name,
    color: type.color,
    // map と slice で、元データを壊さないようにコピーします。
    matrix: type.matrix.map(row => row.slice()),
    x: Math.floor(COLS / 2) - Math.ceil(type.matrix[0].length / 2),
    y: 0
  };
}

function createItemPiece() {
  const item = ITEMS[Math.floor(Math.random() * ITEMS.length)];
  return {
    kind: 'item',
    name: item.name,
    effect: item.effect,
    label: item.label,
    color: item.color,
    message: item.message,
    matrix: [[1]],
    x: Math.floor(COLS / 2),
    y: 0
  };
}

// ====== ゲーム開始 / 一時停止 / 再開 ======
function handleStartButton() {
  if (isGameOver) {
    resetGame();
    startGame();
  } else if (!isRunning && !isPaused) {
    startGame();
  } else if (isRunning) {
    pauseGame();
  } else if (isPaused) {
    resumeGame();
  }
}

function startGame() {
  isRunning = true;
  isPaused = false;
  nextGarbageAt = Date.now() + GARBAGE_INTERVAL;
  messageElement.textContent = 'プレイ中';
  startButton.textContent = '一時停止';
  startTimers();
  draw();
}

function pauseGame() {
  isRunning = false;
  isPaused = true;
  stopTimers();
  messageElement.textContent = '一時停止中（Enter で再開）';
  startButton.textContent = '再開';
}

function resumeGame() {
  isRunning = true;
  isPaused = false;
  // 再開直後にお邪魔がすぐ来ないよう、少し猶予を作ります。
  nextGarbageAt = Date.now() + Math.max(2500, nextGarbageAt - Date.now());
  messageElement.textContent = 'プレイ中';
  startButton.textContent = '一時停止';
  startTimers();
  draw();
}

// mainブランチにあった「リスタート」動作も壊さないよう、専用ボタンで残します。
function restartGame() {
  resetGame();
  startGame();
}

function startTimers() {
  stopTimers();
  dropTimerId = setInterval(moveDown, DROP_SPEED);
  statusTimerId = setInterval(tickStatus, 250);
}

function stopTimers() {
  if (dropTimerId) {
    clearInterval(dropTimerId);
    dropTimerId = null;
  }

  if (statusTimerId) {
    clearInterval(statusTimerId);
    statusTimerId = null;
  }
}

// 画面横の「お邪魔まで」「時間停止」表示を更新します。
function tickStatus() {
  if (!isRunning) return;

  if (isTimeFrozen()) {
    updateStatusPanel();
    return;
  }

  if (Date.now() >= nextGarbageAt) {
    addGarbageRow();
    nextGarbageAt = Date.now() + GARBAGE_INTERVAL;
  }

  updateStatusPanel();
}

function updateStatusPanel() {
  const garbageSeconds = Math.max(0, Math.ceil((nextGarbageAt - Date.now()) / 1000));
  garbageCountdownElement.textContent = isRunning ? `${garbageSeconds}秒` : '--';

  if (isTimeFrozen()) {
    const freezeSeconds = Math.ceil((freezeUntil - Date.now()) / 1000);
    freezeCountdownElement.textContent = `${freezeSeconds}秒`;
  } else {
    freezeCountdownElement.textContent = 'なし';
  }
}

function isTimeFrozen() {
  return Date.now() < freezeUntil;
}

// ====== 描画処理 ======
function draw() {
  clearCanvas(context, canvas);
  drawBoard();
  drawPiece(context, currentPiece, BLOCK_SIZE);
  drawNextPiece();
}

function clearCanvas(targetContext, targetCanvas) {
  targetContext.fillStyle = '#020617';
  targetContext.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
}

// 固定済みのブロックとグリッド線を描きます。
function drawBoard() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x] !== EMPTY) {
        drawBlock(context, x, y, BLOCK_SIZE, board[y][x]);
      }
      drawGridLine(context, x, y, BLOCK_SIZE);
    }
  }
}

// 落下中のブロックを描きます。
function drawPiece(targetContext, piece, size, offsetX = 0, offsetY = 0) {
  piece.matrix.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (value) {
        const blockX = offsetX + piece.x + colIndex;
        const blockY = offsetY + piece.y + rowIndex;
        drawBlock(targetContext, blockX, blockY, size, piece);
      }
    });
  });
}

function drawNextPiece() {
  clearCanvas(nextContext, nextCanvas);

  // 次ブロック用のcanvas中央に表示するため、一時的な座標を作ります。
  const displayPiece = {
    ...nextPiece,
    x: Math.floor((nextCanvas.width / NEXT_BLOCK_SIZE - nextPiece.matrix[0].length) / 2),
    y: Math.floor((nextCanvas.height / NEXT_BLOCK_SIZE - nextPiece.matrix.length) / 2)
  };

  drawPiece(nextContext, displayPiece, NEXT_BLOCK_SIZE);
}

function drawBlock(targetContext, x, y, size, block) {
  targetContext.fillStyle = block.color;
  targetContext.fillRect(x * size, y * size, size, size);
  targetContext.strokeStyle = 'rgba(15, 23, 42, 0.55)';
  targetContext.lineWidth = 2;
  targetContext.strokeRect(x * size + 1, y * size + 1, size - 2, size - 2);

  // アイテムは文字を描くと効果が分かりやすくなります。
  if (block.kind === 'item') {
    targetContext.fillStyle = '#020617';
    targetContext.font = `bold ${Math.floor(size * 0.62)}px sans-serif`;
    targetContext.textAlign = 'center';
    targetContext.textBaseline = 'middle';
    targetContext.fillText(block.label, x * size + size / 2, y * size + size / 2 + 1);
  }
}

function drawGridLine(targetContext, x, y, size) {
  targetContext.strokeStyle = 'rgba(148, 163, 184, 0.16)';
  targetContext.lineWidth = 1;
  targetContext.strokeRect(x * size, y * size, size, size);
}

// ====== 移動・回転 ======
function moveHorizontal(direction) {
  if (!isRunning) return;

  currentPiece.x += direction;
  if (hasCollision(currentPiece)) {
    // 壁や他のブロックにぶつかったら、移動を取り消します。
    currentPiece.x -= direction;
  }
  draw();
}

function moveDown() {
  if (!isRunning) return;

  currentPiece.y += 1;
  if (hasCollision(currentPiece)) {
    // 下にぶつかったので1マス戻して固定します。
    currentPiece.y -= 1;
    lockCurrentPiece();
  }
  draw();
}

function rotatePiece() {
  if (!isRunning || currentPiece.kind === 'item') return;

  const originalMatrix = currentPiece.matrix;
  const rotatedMatrix = rotateMatrix(originalMatrix);
  currentPiece.matrix = rotatedMatrix;

  // 回転後にぶつかる場合、左右に少しずらして入る場所を探します。
  const originalX = currentPiece.x;
  const offsets = [0, -1, 1, -2, 2];
  const canRotate = offsets.some(offset => {
    currentPiece.x = originalX + offset;
    return !hasCollision(currentPiece);
  });

  if (!canRotate) {
    currentPiece.matrix = originalMatrix;
    currentPiece.x = originalX;
  }
  draw();
}

// 行と列を入れ替えて、時計回りに90度回転した配列を作ります。
function rotateMatrix(matrix) {
  return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]).reverse());
}

// ====== 当たり判定 ======
function hasCollision(piece) {
  for (let y = 0; y < piece.matrix.length; y++) {
    for (let x = 0; x < piece.matrix[y].length; x++) {
      if (!piece.matrix[y][x]) continue;

      const boardX = piece.x + x;
      const boardY = piece.y + y;

      // 左右の壁・床の外に出たら衝突です。
      if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
        return true;
      }

      // 画面上の見えない位置は許可します。
      if (boardY < 0) {
        continue;
      }

      // すでに固定されたブロックに重なったら衝突です。
      if (board[boardY][boardX] !== EMPTY) {
        return true;
      }
    }
  }
  return false;
}

// ====== ブロックの固定、ライン消去、アイテム処理 ======
function lockCurrentPiece() {
  if (currentPiece.kind === 'item') {
    activateItem(currentPiece);
  } else {
    mergePieceToBoard();
    clearLines();
  }

  spawnNextPiece();
}

function spawnNextPiece() {
  pieceCount += 1;
  currentPiece = nextPiece;
  nextPiece = createPiece();

  // 新しいブロックが置けないならゲームオーバーです。
  if (hasCollision(currentPiece)) {
    finishGame();
  }
}

function mergePieceToBoard() {
  currentPiece.matrix.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (!value) return;

      const boardY = currentPiece.y + rowIndex;
      const boardX = currentPiece.x + colIndex;
      if (boardY >= 0) {
        board[boardY][boardX] = createBoardBlock(currentPiece.color);
      }
    });
  });
}

function createBoardBlock(color, kind = 'tetromino', label = '') {
  return { color, kind, label };
}

function clearLines() {
  let clearedLines = 0;

  // 下の行から確認すると、消した後に詰める処理が簡単です。
  for (let y = ROWS - 1; y >= 0; y--) {
    const isFull = board[y].every(cell => cell !== EMPTY);
    if (isFull) {
      board.splice(y, 1); // そろった行を削除します。
      board.unshift(Array(COLS).fill(EMPTY)); // 一番上に空の行を追加します。
      clearedLines += 1;
      y += 1; // 同じ行番号に落ちてきた行をもう一度確認します。
    }
  }

  if (clearedLines > 0) {
    // まとめて消すほど高得点にしています。
    score += clearedLines * clearedLines * 100;
    scoreElement.textContent = score;
  }

  if (clearedLines === 4) {
    showSpecialEffect('TETRIS! 4ライン消し!');
    score += 400; // 4ライン消しのボーナス点です。
    scoreElement.textContent = score;
  }
}

function activateItem(piece) {
  const itemX = piece.x;
  const itemY = piece.y;

  if (piece.effect === 'bomb') {
    clearBombArea(itemX, itemY);
    score += 150;
  } else if (piece.effect === 'line') {
    clearSingleLine(itemY);
    score += 120;
  } else if (piece.effect === 'freeze') {
    freezeUntil = Date.now() + FREEZE_DURATION;
    // お邪魔ブロックの予定時刻も後ろへずらして、本当に時間が止まったようにします。
    nextGarbageAt += FREEZE_DURATION;
    score += 80;
  }

  scoreElement.textContent = score;
  showSpecialEffect(piece.message);
}

// 爆弾は着地位置を中心に3x3マスを消します。
function clearBombArea(centerX, centerY) {
  for (let y = centerY - 1; y <= centerY + 1; y++) {
    for (let x = centerX - 1; x <= centerX + 1; x++) {
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
        board[y][x] = EMPTY;
      }
    }
  }
}

// 1列消去アイテムは、着地した横一列を消して上から空行を足します。
function clearSingleLine(rowIndex) {
  if (rowIndex < 0 || rowIndex >= ROWS) return;
  board.splice(rowIndex, 1);
  board.unshift(Array(COLS).fill(EMPTY));
}

// ====== お邪魔ブロック ======
function addGarbageRow() {
  // 一番上にブロックがある状態でせり上がるとゲームオーバーです。
  if (board[0].some(cell => cell !== EMPTY)) {
    finishGame();
    return;
  }

  board.shift();

  const holeIndex = Math.floor(Math.random() * COLS);
  const garbageRow = Array.from({ length: COLS }, (_, index) => {
    if (index === holeIndex) return EMPTY;
    return createBoardBlock('#64748b');
  });
  board.push(garbageRow);

  // 落下中ブロックも1マス上に押し上げます。
  currentPiece.y -= 1;
  if (hasCollision(currentPiece)) {
    finishGame();
  }

  showSpecialEffect('お邪魔ブロック上昇!');
  draw();
}

// ====== 特別エフェクト ======
function showSpecialEffect(text) {
  effectBanner.textContent = text;
  effectBanner.classList.remove('show');
  canvas.classList.remove('tetris-flash');

  // classを付け直してアニメーションを毎回再生します。
  requestAnimationFrame(() => {
    effectBanner.classList.add('show');
    if (text.includes('TETRIS')) {
      canvas.classList.add('tetris-flash');
    }
  });

  messageElement.textContent = text;
}

// ====== ゲームオーバー ======
function finishGame() {
  isRunning = false;
  isPaused = false;
  isGameOver = true;
  stopTimers();
  messageElement.textContent = 'ゲームオーバー！Enter で再挑戦';
  startButton.textContent = 'リスタート';
  updateStatusPanel();
  draw();
}

// ====== キーボードとボタンの操作 ======
document.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    handleStartButton();
    return;
  }

  const isSpaceKey = event.key === ' ' || event.code === 'Space';

  // 矢印キーとSpaceでページがスクロールしないようにします。
  if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp'].includes(event.key) || isSpaceKey) {
    event.preventDefault();
  }

  if (event.key === 'ArrowLeft') {
    moveHorizontal(-1);
  } else if (event.key === 'ArrowRight') {
    moveHorizontal(1);
  } else if (event.key === 'ArrowDown') {
    moveDown();
  } else if (event.key === 'ArrowUp' || isSpaceKey) {
    rotatePiece();
  }
});

startButton.addEventListener('click', handleStartButton);
restartButton.addEventListener('click', restartGame);
