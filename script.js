// ====== HTML の要素を取得 ======
const canvas = document.getElementById('game');
const context = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const messageElement = document.getElementById('message');
const startButton = document.getElementById('start-button');

// ====== ゲームの基本設定 ======
const COLS = 10; // 盤面の横マス数
const ROWS = 20; // 盤面の縦マス数
const BLOCK_SIZE = 30; // 1マスの大きさ（px）
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
let score;
let isGameOver;
let isRunning;
let dropTimerId;
let lastDropSpeed;

// ====== 初期表示 ======
resetGame();
draw();

// ====== ゲームの状態を最初から作り直す ======
function resetGame() {
  board = createBoard();
  currentPiece = createPiece();
  score = 0;
  isGameOver = false;
  isRunning = false;
  lastDropSpeed = 700; // ブロックが自動で落ちる間隔（ミリ秒）
  scoreElement.textContent = score;
  messageElement.textContent = 'Enter でスタート';
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

// ====== ゲーム開始 / リスタート ======
function startGame() {
  // プレイ中やゲームオーバー後に押した場合は、最初からやり直します。
  if (isRunning || isGameOver) {
    resetGame();
  }

  isRunning = true;
  messageElement.textContent = 'プレイ中';
  startDropTimer();
  draw();
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
  clearCanvas();
  drawBoard();
  drawPiece(currentPiece);
}

function clearCanvas() {
  context.fillStyle = '#020617';
  context.fillRect(0, 0, canvas.width, canvas.height);
}

// 固定済みのブロックとグリッド線を描きます。
function drawBoard() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x] !== EMPTY) {
        drawBlock(x, y, board[y][x]);
      }
      drawGridLine(x, y);
    }
  }
}

// 落下中のブロックを描きます。
function drawPiece(piece) {
  piece.matrix.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (value) {
        drawBlock(piece.x + colIndex, piece.y + rowIndex, piece.color);
      }
    });
  });
}

function drawBlock(x, y, color) {
  context.fillStyle = color;
  context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
  context.strokeStyle = 'rgba(15, 23, 42, 0.55)';
  context.lineWidth = 2;
  context.strokeRect(x * BLOCK_SIZE + 1, y * BLOCK_SIZE + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
}

function drawGridLine(x, y) {
  context.strokeStyle = 'rgba(148, 163, 184, 0.16)';
  context.lineWidth = 1;
  context.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
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
    currentPiece = createPiece();

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
}

// ====== ゲームオーバー ======
function finishGame() {
  isRunning = false;
  isGameOver = true;
  stopDropTimer();
  messageElement.textContent = 'ゲームオーバー！Enter で再挑戦';
  draw();
}

// ====== キーボードとボタンの操作 ======
document.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    startGame();
    return;
  }

  // 矢印キーでページがスクロールしないようにします。
  if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault();
  }

  if (event.key === 'ArrowLeft') {
    moveHorizontal(-1);
  } else if (event.key === 'ArrowRight') {
    moveHorizontal(1);
  } else if (event.key === 'ArrowDown') {
    moveDown();
  } else if (event.key === 'ArrowUp') {
    rotatePiece();
  }
});

startButton.addEventListener('click', startGame);
