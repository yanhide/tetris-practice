// ====== HTML要素の取得 ======
const canvas = document.getElementById('game');
const context = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const messageElement = document.getElementById('message');
const restartButton = document.getElementById('restart-button');

// ====== 盤面の基本設定 ======
const COLS = 10; // 横10マス
const ROWS = 20; // 縦20マス
const BLOCK_SIZE = 30; // 1マス30px（canvasは300x600）
const EMPTY = null;
const DROP_INTERVAL = 700; // 自動で1マス落ちる間隔（ミリ秒）

// テトリスで使う7種類のブロックです。
// 1がブロックあり、0が空白を表します。
const TETROMINOES = [
  {
    color: '#22d3ee',
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]
  },
  {
    color: '#60a5fa',
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ]
  },
  {
    color: '#fb923c',
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ]
  },
  {
    color: '#facc15',
    shape: [
      [1, 1],
      [1, 1]
    ]
  },
  {
    color: '#4ade80',
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ]
  },
  {
    color: '#c084fc',
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ]
  },
  {
    color: '#f87171',
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ]
  }
];

let board;
let currentPiece;
let score;
let isGameOver;
let timerId;

// 最初に空の盤面を表示します。
resetGame();
draw();

function resetGame() {
  board = createBoard();
  currentPiece = createPiece();
  score = 0;
  isGameOver = false;
  scoreElement.textContent = score;
  messageElement.textContent = 'プレイ中です';
  stopTimer();
  startTimer();
}

// ROWS x COLS の空の配列を作ります。
function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
}

// ランダムなブロックを1つ作ります。
function createPiece() {
  const template = TETROMINOES[Math.floor(Math.random() * TETROMINOES.length)];
  const shape = template.shape.map(row => row.slice());

  return {
    shape,
    color: template.color,
    x: Math.floor(COLS / 2) - Math.ceil(shape[0].length / 2),
    y: 0
  };
}

function startTimer() {
  timerId = setInterval(dropPiece, DROP_INTERVAL);
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

// ====== 描画処理 ======
function draw() {
  clearCanvas();
  drawBoard();
  drawPiece(currentPiece);
}

function clearCanvas() {
  context.fillStyle = '#020617';
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function drawBoard() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x]) {
        drawBlock(x, y, board[y][x]);
      }
      drawGrid(x, y);
    }
  }
}

function drawPiece(piece) {
  piece.shape.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell) {
        drawBlock(piece.x + colIndex, piece.y + rowIndex, piece.color);
      }
    });
  });
}

function drawBlock(x, y, color) {
  context.fillStyle = color;
  context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
  context.strokeStyle = 'rgba(15, 23, 42, 0.7)';
  context.lineWidth = 2;
  context.strokeRect(x * BLOCK_SIZE + 1, y * BLOCK_SIZE + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
}

function drawGrid(x, y) {
  context.strokeStyle = 'rgba(148, 163, 184, 0.14)';
  context.lineWidth = 1;
  context.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
}

// ====== ブロック操作 ======
function movePiece(dx) {
  if (isGameOver) return;

  currentPiece.x += dx;
  if (hasCollision(currentPiece)) {
    currentPiece.x -= dx;
  }
  draw();
}

function dropPiece() {
  if (isGameOver) return;

  currentPiece.y += 1;
  if (hasCollision(currentPiece)) {
    currentPiece.y -= 1;
    fixPiece();
    clearLines();
    spawnNextPiece();
  }
  draw();
}

function rotatePiece() {
  if (isGameOver) return;

  const oldShape = currentPiece.shape;
  const oldX = currentPiece.x;
  currentPiece.shape = rotateShape(currentPiece.shape);

  // 回転後に壁へ当たる場合、少し横へずらして入る場所を探します。
  const offsets = [0, -1, 1, -2, 2];
  const canRotate = offsets.some(offset => {
    currentPiece.x = oldX + offset;
    return !hasCollision(currentPiece);
  });

  if (!canRotate) {
    currentPiece.shape = oldShape;
    currentPiece.x = oldX;
  }
  draw();
}

// 行と列を入れ替えて、時計回りに90度回転した形を作ります。
function rotateShape(shape) {
  return shape[0].map((_, colIndex) => shape.map(row => row[colIndex]).reverse());
}

function hasCollision(piece) {
  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (!piece.shape[y][x]) continue;

      const nextX = piece.x + x;
      const nextY = piece.y + y;

      // 左右の壁や床に当たったら衝突です。
      if (nextX < 0 || nextX >= COLS || nextY >= ROWS) {
        return true;
      }

      // 画面上の見えない位置は許可します。
      if (nextY < 0) continue;

      if (board[nextY][nextX]) {
        return true;
      }
    }
  }
  return false;
}

function fixPiece() {
  currentPiece.shape.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (!cell) return;

      const boardX = currentPiece.x + colIndex;
      const boardY = currentPiece.y + rowIndex;
      if (boardY >= 0) {
        board[boardY][boardX] = currentPiece.color;
      }
    });
  });
}

function clearLines() {
  let cleared = 0;

  // 下から上に確認すると、行を消したあとも処理しやすいです。
  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y].every(cell => cell !== EMPTY)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(EMPTY));
      cleared += 1;
      y += 1;
    }
  }

  if (cleared > 0) {
    score += cleared * cleared * 100;
    scoreElement.textContent = score;
  }
}

function spawnNextPiece() {
  currentPiece = createPiece();

  if (hasCollision(currentPiece)) {
    finishGame();
  }
}

function finishGame() {
  isGameOver = true;
  stopTimer();
  messageElement.textContent = 'ゲームオーバー！リスタートしてください';
}

// ====== キーボード・ボタン操作 ======
document.addEventListener('keydown', event => {
  if (isGameOver) return;

  const isSpaceKey = event.key === ' ' || event.code === 'Space';

  if (['ArrowLeft', 'ArrowRight', 'ArrowDown'].includes(event.key) || isSpaceKey) {
    event.preventDefault();
  }

  if (event.key === 'ArrowLeft') {
    movePiece(-1);
  } else if (event.key === 'ArrowRight') {
    movePiece(1);
  } else if (event.key === 'ArrowDown') {
    dropPiece();
  } else if (isSpaceKey) {
    rotatePiece();
  }
});

restartButton.addEventListener('click', resetGame);
