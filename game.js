"use strict";

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CONFIG = {
  size: 7,
  startMoves: 25,
  targetScore: 3000,
  swapMs: 260,
  clearMs: 320,
  fallMs: 280,
};

const PIECES = [
  { name: "草莓软糖", emoji: "🍓", face: "⌒‿⌒", color: "#ff6f9f" },
  { name: "蓝莓星星", emoji: "⭐", face: "•ᴗ•", color: "#68baff" },
  { name: "柠檬小熊", emoji: "🐻", face: "˘ᴗ˘", color: "#ffe05c" },
  { name: "葡萄猫爪", emoji: "🐾", face: "｡◕‿◕｡", color: "#a177ff" },
  { name: "橙子小兔", emoji: "🐰", face: "ᵔᴥᵔ", color: "#ff9e4d" },
  { name: "薄荷爱心", emoji: "💗", face: "♡‿♡", color: "#63e1b6" },
];

const els = {
  startScreen: $("startScreen"),
  gameScreen: $("gameScreen"),
  startBtn: $("startBtn"),
  board: $("board"),
  scoreText: $("scoreText"),
  targetText: $("targetText"),
  movesText: $("movesText"),
  comboText: $("comboText"),
  restartBtn: $("restartBtn"),
  helpBtn: $("helpBtn"),
  helpModal: $("helpModal"),
  closeHelpBtn: $("closeHelpBtn"),
  resultModal: $("resultModal"),
  resultIcon: $("resultIcon"),
  resultTitle: $("resultTitle"),
  resultScore: $("resultScore"),
  againBtn: $("againBtn"),
};

const game = {
  board: [],
  tileId: 1,
  domMap: new Map(),
  selected: null,
  locked: false,
  score: 0,
  moves: CONFIG.startMoves,
  pointerStart: null,
  running: false,
};

function randomType() {
  return Math.floor(Math.random() * PIECES.length);
}

function createTile(type = randomType()) {
  return {
    id: game.tileId++,
    type,
    isNew: true,
  };
}

function inBounds(row, col) {
  return row >= 0 && row < CONFIG.size && col >= 0 && col < CONFIG.size;
}

function cellKey(row, col) {
  return `${row},${col}`;
}

function getCellMetrics() {
  const width = els.board.clientWidth || 360;
  const gap = width <= 360 ? 6 : 7;
  const tileSize = (width - gap * (CONFIG.size - 1)) / CONFIG.size;
  return { gap, tileSize };
}

function vibrate(ms) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

function setScreen(screen) {
  els.startScreen.classList.toggle("is-active", screen === "start");
  els.gameScreen.classList.toggle("is-active", screen === "game");
}

function openModal(modal) {
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(modal) {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
}

function setComboText(text) {
  els.comboText.textContent = text;
  els.comboText.classList.remove("is-pop");
  void els.comboText.offsetWidth;
  els.comboText.classList.add("is-pop");
}

// 初始化游戏：重置状态、清理 DOM、生成新棋盘。
function initGame() {
  game.board = [];
  game.tileId = 1;
  game.domMap.clear();
  game.selected = null;
  game.locked = false;
  game.score = 0;
  game.moves = CONFIG.startMoves;
  game.pointerStart = null;
  game.running = true;
  els.board.innerHTML = "";
  closeModal(els.resultModal);
  generateBoard();
  updateStats();
  setComboText("甜甜开局");
  renderBoard();
}

function startGame() {
  setScreen("game");
  initGame();
}

// 重新开始游戏。
function restartGame() {
  initGame();
}

function wouldMakeInitialMatch(row, col, type) {
  const horizontal = col >= 2 &&
    game.board[row][col - 1]?.type === type &&
    game.board[row][col - 2]?.type === type;
  const vertical = row >= 2 &&
    game.board[row - 1][col]?.type === type &&
    game.board[row - 2][col]?.type === type;
  return horizontal || vertical;
}

// 生成棋盘：保证开局无可消除组合，并且有可移动组合。
function generateBoard() {
  let guard = 0;

  do {
    guard++;
    game.board = Array.from({ length: CONFIG.size }, () => Array(CONFIG.size).fill(null));

    for (let row = 0; row < CONFIG.size; row++) {
      for (let col = 0; col < CONFIG.size; col++) {
        let type = randomType();
        let tries = 0;

        while (wouldMakeInitialMatch(row, col, type) && tries < 40) {
          type = randomType();
          tries++;
        }

        game.board[row][col] = createTile(type);
      }
    }
  } while ((detectMatches().length > 0 || !hasAvailableMove()) && guard < 100);
}

function createTileNode(tile) {
  const node = document.createElement("button");
  const piece = PIECES[tile.type];

  node.type = "button";
  node.className = `tile kind-${tile.type}`;
  node.setAttribute("aria-label", piece.name);
  node.innerHTML = `
    <span class="tile-inner" data-face="${piece.face}">
      <span class="symbol">${piece.emoji}</span>
    </span>
  `;

  node.addEventListener("click", (event) => {
    event.preventDefault();
    handleTap(Number(node.dataset.row), Number(node.dataset.col));
  });

  node.addEventListener("pointerdown", (event) => {
    if (game.locked) return;
    game.pointerStart = {
      row: Number(node.dataset.row),
      col: Number(node.dataset.col),
      x: event.clientX,
      y: event.clientY,
    };
  });

  node.addEventListener("pointerup", (event) => {
    if (!game.pointerStart || game.locked) return;

    const dx = event.clientX - game.pointerStart.x;
    const dy = event.clientY - game.pointerStart.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (Math.max(absX, absY) > 24) {
      const target = { row: game.pointerStart.row, col: game.pointerStart.col };
      if (absX > absY) target.col += dx > 0 ? 1 : -1;
      else target.row += dy > 0 ? 1 : -1;

      if (inBounds(target.row, target.col)) {
        processSwap(game.pointerStart, target);
      }
    }

    game.pointerStart = null;
  });

  return node;
}

// 渲染棋盘：使用绝对定位，交换和下落依靠 CSS transition。
function renderBoard() {
  if (!els.board) return;

  const { gap, tileSize } = getCellMetrics();
  const alive = new Set();

  for (let row = 0; row < CONFIG.size; row++) {
    for (let col = 0; col < CONFIG.size; col++) {
      const tile = game.board[row][col];
      if (!tile) continue;

      alive.add(tile.id);
      let node = game.domMap.get(tile.id);

      if (!node) {
        node = createTileNode(tile);
        game.domMap.set(tile.id, node);
        els.board.appendChild(node);
      }

      node.dataset.row = String(row);
      node.dataset.col = String(col);
      node.style.width = `${tileSize}px`;
      node.style.height = `${tileSize}px`;
      node.style.transform = `translate(${col * (tileSize + gap)}px, ${row * (tileSize + gap)}px)`;
      node.classList.toggle("is-selected", Boolean(game.selected && game.selected.row === row && game.selected.col === col));

      if (tile.isNew) {
        node.classList.add("is-new");
        window.setTimeout(() => node.classList.remove("is-new"), 380);
        tile.isNew = false;
      }
    }
  }

  for (const [id, node] of game.domMap.entries()) {
    if (!alive.has(id)) {
      node.remove();
      game.domMap.delete(id);
    }
  }
}

// 判断是否相邻。
function isAdjacent(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

function handleTap(row, col) {
  if (game.locked || !game.running || !inBounds(row, col)) return;

  if (!game.selected) {
    game.selected = { row, col };
    renderBoard();
    return;
  }

  if (game.selected.row === row && game.selected.col === col) {
    game.selected = null;
    renderBoard();
    return;
  }

  const first = game.selected;
  const second = { row, col };
  game.selected = null;
  renderBoard();

  if (isAdjacent(first, second)) {
    processSwap(first, second);
  } else {
    game.selected = second;
    renderBoard();
  }
}

// 交换棋子。
function swapTiles(a, b) {
  const temp = game.board[a.row][a.col];
  game.board[a.row][a.col] = game.board[b.row][b.col];
  game.board[b.row][b.col] = temp;
}

async function processSwap(a, b) {
  if (game.locked || !game.running || !isAdjacent(a, b)) return;
  game.locked = true;

  swapTiles(a, b);
  renderBoard();
  await wait(CONFIG.swapMs);

  const matches = detectMatches();

  if (matches.length === 0) {
    swapTiles(a, b);
    renderBoard();
    shakeInvalid(a, b);
    vibrate(30);
    await wait(CONFIG.swapMs + 120);
    game.locked = false;
    return;
  }

  game.moves = clamp(game.moves - 1);
  await resolveCascade();
  updateStats();
  checkWinLose();
  game.locked = false;
}

function shakeInvalid(a, b) {
  els.board.classList.add("is-shaking");

  [a, b].forEach((pos) => {
    const tile = game.board[pos.row][pos.col];
    const node = tile ? game.domMap.get(tile.id) : null;
    if (node) node.classList.add("is-shaking");
  });

  window.setTimeout(() => {
    els.board.classList.remove("is-shaking");
    document.querySelectorAll(".tile.is-shaking").forEach((node) => node.classList.remove("is-shaking"));
  }, 360);
}

// 检测可消除组合：横向和纵向 3 个及以上。
function detectMatches() {
  const groups = [];

  for (let row = 0; row < CONFIG.size; row++) {
    let start = 0;

    for (let col = 1; col <= CONFIG.size; col++) {
      const same = col < CONFIG.size &&
        game.board[row][col] &&
        game.board[row][start] &&
        game.board[row][col].type === game.board[row][start].type;

      if (!same) {
        const length = col - start;
        if (length >= 3) {
          groups.push({
            length,
            cells: Array.from({ length }, (_, index) => ({ row, col: start + index })),
          });
        }
        start = col;
      }
    }
  }

  for (let col = 0; col < CONFIG.size; col++) {
    let start = 0;

    for (let row = 1; row <= CONFIG.size; row++) {
      const same = row < CONFIG.size &&
        game.board[row][col] &&
        game.board[start][col] &&
        game.board[row][col].type === game.board[start][col].type;

      if (!same) {
        const length = row - start;
        if (length >= 3) {
          groups.push({
            length,
            cells: Array.from({ length }, (_, index) => ({ row: start + index, col })),
          });
        }
        start = row;
      }
    }
  }

  return groups;
}

// 执行消除：去重、计分、播放粒子。
async function clearMatches(matches, combo) {
  const clearMap = new Map();
  let extraScore = 0;

  matches.forEach((group) => {
    group.cells.forEach((cell) => clearMap.set(cellKey(cell.row, cell.col), cell));
    if (group.length >= 4) extraScore += (group.length - 3) * 80;
  });

  for (const cell of clearMap.values()) {
    const tile = game.board[cell.row][cell.col];
    if (!tile) continue;

    const node = game.domMap.get(tile.id);
    if (node) node.classList.add("is-clearing");
    createParticles(cell.row, cell.col, PIECES[tile.type].color);
    game.board[cell.row][cell.col] = null;
  }

  const count = clearMap.size;
  game.score = clamp(game.score + Math.floor(count / 3) * 100 * combo + extraScore * combo, Number.MAX_SAFE_INTEGER);

  if (combo > 1) showComboBubble(combo);
  updateStats();
  vibrate(18);
  await wait(CONFIG.clearMs);

  for (const [id, node] of game.domMap.entries()) {
    if (node.classList.contains("is-clearing")) {
      node.remove();
      game.domMap.delete(id);
    }
  }
}

function createParticles(row, col, color) {
  const { gap, tileSize } = getCellMetrics();
  const centerX = col * (tileSize + gap) + tileSize / 2;
  const centerY = row * (tileSize + gap) + tileSize / 2;

  for (let index = 0; index < 8; index++) {
    const particle = document.createElement("span");
    const angle = (Math.PI * 2 * index) / 8 + Math.random() * .4;
    const distance = 22 + Math.random() * 28;

    particle.className = "particle";
    particle.style.left = `${centerX}px`;
    particle.style.top = `${centerY}px`;
    particle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    particle.style.setProperty("--color", index % 2 ? color : "#fff3a0");

    els.board.appendChild(particle);
    window.setTimeout(() => particle.remove(), 650);
  }
}

// 棋子下落。
async function dropTiles() {
  for (let col = 0; col < CONFIG.size; col++) {
    const stack = [];

    for (let row = CONFIG.size - 1; row >= 0; row--) {
      if (game.board[row][col]) stack.push(game.board[row][col]);
    }

    for (let row = CONFIG.size - 1; row >= 0; row--) {
      game.board[row][col] = stack[CONFIG.size - 1 - row] || null;
    }
  }

  renderBoard();
  await wait(CONFIG.fallMs);
}

// 补充新棋子。
async function fillNewTiles() {
  for (let col = 0; col < CONFIG.size; col++) {
    for (let row = 0; row < CONFIG.size; row++) {
      if (!game.board[row][col]) {
        game.board[row][col] = createTile();
      }
    }
  }

  renderBoard();
  await wait(240);
}

async function resolveCascade() {
  let combo = 1;

  while (game.running) {
    const matches = detectMatches();
    if (matches.length === 0) break;

    setComboText(combo > 1 ? `Combo x${combo} 甜甜连消！` : "消除成功！");
    await clearMatches(matches, combo);
    await dropTiles();
    await fillNewTiles();
    combo++;
  }

  setComboText("继续滑动软糖吧");

  if (!hasAvailableMove()) {
    setComboText("没有可走步，正在重排");
    await wait(350);
    reshuffleBoard();
  }
}

function showComboBubble(combo) {
  const bubble = document.createElement("div");
  bubble.className = "combo-bubble";
  bubble.textContent = `Combo x${combo}`;
  els.board.appendChild(bubble);
  window.setTimeout(() => bubble.remove(), 900);
}

function clamp(value, max = 100) {
  if (max === Number.MAX_SAFE_INTEGER) return Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, value));
  return Math.max(0, Math.min(max, value));
}

// 更新分数和步数。
function updateStats() {
  els.scoreText.textContent = String(game.score);
  els.targetText.textContent = String(CONFIG.targetScore);
  els.movesText.textContent = String(game.moves);
}

// 判断胜利失败。
function checkWinLose() {
  if (game.score >= CONFIG.targetScore) {
    endGame(true);
  } else if (game.moves <= 0) {
    endGame(false);
  }
}

function endGame(isWin) {
  game.running = false;
  game.locked = true;
  els.resultIcon.textContent = isWin ? "✨" : "💫";
  els.resultTitle.textContent = isWin ? "太棒啦！" : "差一点点！";
  els.resultScore.textContent = `最终分数：${game.score}`;
  els.againBtn.textContent = isWin ? "再玩一次" : "重新挑战";

  window.setTimeout(() => {
    openModal(els.resultModal);
    if (isWin) launchConfetti();
  }, 450);
}

function launchConfetti() {
  const colors = ["#ff72ad", "#fff071", "#7ce5bd", "#74c3ff", "#b994ff", "#ffad5e"];

  for (let index = 0; index < 48; index++) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.animationDelay = `${Math.random() * .45}s`;
    piece.style.setProperty("--c", colors[index % colors.length]);
    document.body.appendChild(piece);
    window.setTimeout(() => piece.remove(), 2200);
  }
}

// 检测是否还有可移动组合。
function hasAvailableMove() {
  for (let row = 0; row < CONFIG.size; row++) {
    for (let col = 0; col < CONFIG.size; col++) {
      const directions = [[0, 1], [1, 0]];

      for (const [rowOffset, colOffset] of directions) {
        const targetRow = row + rowOffset;
        const targetCol = col + colOffset;
        if (!inBounds(targetRow, targetCol)) continue;

        swapTiles({ row, col }, { row: targetRow, col: targetCol });
        const canMove = detectMatches().length > 0;
        swapTiles({ row, col }, { row: targetRow, col: targetCol });

        if (canMove) return true;
      }
    }
  }

  return false;
}

// 自动重排棋盘。
function reshuffleBoard() {
  generateBoard();
  game.domMap.clear();
  els.board.innerHTML = "";
  renderBoard();
}

function bindEvents() {
  els.startBtn.addEventListener("click", startGame);
  els.restartBtn.addEventListener("click", restartGame);
  els.againBtn.addEventListener("click", restartGame);
  els.helpBtn.addEventListener("click", () => openModal(els.helpModal));
  els.closeHelpBtn.addEventListener("click", () => closeModal(els.helpModal));

  els.helpModal.addEventListener("click", (event) => {
    if (event.target === els.helpModal) closeModal(els.helpModal);
  });

  window.addEventListener("resize", renderBoard);

  document.addEventListener("gesturestart", (event) => event.preventDefault());
  document.addEventListener("dblclick", (event) => event.preventDefault(), { passive: false });
  document.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });
}

bindEvents();
