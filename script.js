// ====== HTML の要素を取得 ======
const canvas = document.getElementById('game');
const context = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextContext = nextCanvas.getContext('2d');
const scoreElement = document.getElementById('score');
const messageElement = document.getElementById('message');
const startButton = document.getElementById('start-button');
const effectBanner = document.getElementById('effect-banner');

// ====== ゲームの基本設定 ======
const COLS = 10; // 盤面の横マス数
const ROWS = 20; // 盤面の縦マス数
const BLOCK_SIZE = 30; // 1マスの大きさ（px）
const NEXT_BLOCK_SIZE = 24; // 次ブロック表示用の1マスの大きさ（px）
const EMPTY = 0; // 盤面が空のときの値

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

let board;
let currentPiece;
let nextPiece;
let score;
let isGameOver;
let isRunning;
let isPaused;
let dropTimerId;
let lastDropSpeed;

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
  lastDropSpeed = 700; // ブロックが自動で落ちる間隔（ミリ秒）
  scoreElement.textContent = score;
  messageElement.textContent = 'Enter でスタート';
  startButton.textContent = 'ゲーム開始 / 一時停止 / 再開';
  effectBanner.classList.remove('show');
  canvas.classList.remove('tetris-flash');
  stopDropTimer();
}

// 20行 x 10列の空の盤面を作ります。
function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
}

// ランダムに次のブロックを作ります。
function createPiece() {
  const type = TETROMINOES[Math.floor(Math.random() * TETROMINOES.length)];
  return {
    name: type.name,
    color: type.color,
    // map と slice で、元データを壊さないようにコピーします。
    matrix: type.matrix.map(row => row.slice()),
    x: Math.floor(COLS / 2) - Math.ceil(type.matrix[0].length / 2),
    y: 0
  };
}

// ====== ゲーム開始 / 一時停止 / 再開 ======
function handleStartButton() {
  // ゲームオーバー後は、最初から作り直してスタートします。
  if (isGameOver) {
    resetGame();
    startGame();
    return;
  }

  // プレイ中なら一時停止、止まっているなら開始または再開にします。
  if (isRunning) {
    pauseGame();
  } else {
    startGame();
  }
}

function startGame() {
  isRunning = true;
  isPaused = false;
  messageElement.textContent = 'プレイ中';
  startButton.textContent = '一時停止';
  startDropTimer();
  draw();
}

function pauseGame() {
  isRunning = false;
  isPaused = true;
  messageElement.textContent = '一時停止中（Enter で再開）';
  startButton.textContent = '再開';
  stopDropTimer();
}

function startDropTimer() {
  stopDropTimer();
  dropTimerId = setInterval(moveDown, lastDropSpeed);
}

function stopDropTimer() {
  if (dropTimerId) {
    clearInterval(dropTimerId);
    dropTimerId = null;
  }
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
        drawBlock(context, x, y, board[y][x], BLOCK_SIZE);
      }
      drawGridLine(context, x, y, BLOCK_SIZE);
    }
  }
}

// 落下中のブロックを描きます。
function drawPiece(targetContext, piece, size) {
  piece.matrix.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (value) {
        drawBlock(targetContext, piece.x + colIndex, piece.y + rowIndex, piece.color, size);
      }
    });
  });
}

function drawNextPiece() {
  clearCanvas(nextContext, nextCanvas);

  // 次ブロック用canvasの中央に表示するため、一時的な座標を作ります。
  const previewPiece = {
    ...nextPiece,
    x: Math.floor((nextCanvas.width / NEXT_BLOCK_SIZE - nextPiece.matrix[0].length) / 2),
    y: Math.floor((nextCanvas.height / NEXT_BLOCK_SIZE - nextPiece.matrix.length) / 2)
  };

  drawPiece(nextContext, previewPiece, NEXT_BLOCK_SIZE);
}

function drawBlock(targetContext, x, y, color, size) {
  targetContext.fillStyle = color;
  targetContext.fillRect(x * size, y * size, size, size);
  targetContext.strokeStyle = 'rgba(15, 23, 42, 0.55)';
  targetContext.lineWidth = 2;
  targetContext.strokeRect(x * size + 1, y * size + 1, size - 2, size - 2);
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
    mergePieceToBoard();
    clearLines();
    currentPiece = nextPiece;
    nextPiece = createPiece();

    // 新しいブロックが置けないならゲームオーバーです。
    if (hasCollision(currentPiece)) {
      finishGame();
      return;
    }
  }
  draw();
}

function rotatePiece() {
  if (!isRunning) return;

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

// ====== ブロックの固定とライン消去 ======
function mergePieceToBoard() {
  currentPiece.matrix.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (!value) return;

      const boardY = currentPiece.y + rowIndex;
      const boardX = currentPiece.x + colIndex;
      if (boardY >= 0) {
        board[boardY][boardX] = currentPiece.color;
      }
    });
  });
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

  // 4ライン同時消しのときだけ、特別な「TETRIS!」演出を出します。
  if (clearedLines === 4) {
    showTetrisEffect();
  }
}

function showTetrisEffect() {
  effectBanner.textContent = 'TETRIS!';
  effectBanner.classList.remove('show');
  canvas.classList.remove('tetris-flash');

  // classを付け直すと、連続で4ライン消しをしても毎回アニメーションします。
  requestAnimationFrame(() => {
    effectBanner.classList.add('show');
    canvas.classList.add('tetris-flash');
  });

  messageElement.textContent = 'TETRIS! 4ライン消し！';
}

// ====== ゲームオーバー ======
function finishGame() {
  isRunning = false;
  isGameOver = true;
  stopDropTimer();
  messageElement.textContent = 'ゲームオーバー！Enter で再挑戦';
  startButton.textContent = '再挑戦';
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
