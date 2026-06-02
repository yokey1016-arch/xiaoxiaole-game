"use strict";

const $ = (id) => document.getElementById(id);

const els = {
  gameRoot: $("gameRoot"),
  startScreen: $("startScreen"),
  gameScreen: $("gameScreen"),
  resultScreen: $("resultScreen"),
  startBtn: $("startBtn"),
  guideBtn: $("guideBtn"),
  quickGuide: $("quickGuide"),
  timerText: $("timerText"),
  rageLabel: $("rageLabel"),
  playfield: $("playfield"),
  itemsLayer: $("itemsLayer"),
  floatLayer: $("floatLayer"),
  player: $("player"),
  avatar: $("avatar"),
  mood: $("mood"),
  statusMark: $("statusMark"),
  toast: $("toast"),
  bossSight: $("bossSight"),
  bossWarning: $("bossWarning"),
  phaseText: $("phaseText"),
  skillBtn: $("skillBtn"),
  skillStatus: $("skillStatus"),
  restartBtn: $("restartBtn"),
  resultIcon: $("resultIcon"),
  resultRank: $("resultRank"),
  resultRole: $("resultRole"),
  resultTitle: $("resultTitle"),
  resultText: $("resultText"),
  resultStats: $("resultStats"),
  cultivationBar: $("cultivationBar"),
  slackBar: $("slackBar"),
  alertBar: $("alertBar"),
  cultivationValue: $("cultivationValue"),
  slackValue: $("slackValue"),
  alertValue: $("alertValue"),
};

const laneNames = ["左边", "中间", "右边"];
const laneCenters = [16.666, 50, 83.333];
const totalTime = 60;
const shortNames = {
  自动化脚本: "脚本",
  奶茶续命: "奶茶",
  周报模板: "周报",
  假装开会: "开会",
  代码秘籍: "秘籍",
  摸鱼结界: "结界",
  远程办公: "远程",
  带薪拉屎: "带薪",
  偷看短视频: "短视频",
  自动摸鱼神器: "神器",
  摸鱼神器: "神器",
  老板路过: "老板",
  需求变更: "变更",
  绩效面谈: "绩效",
  同事甩锅: "甩锅",
  临时会议: "会议",
};
const items = [
  { name: "自动化脚本", icon: "🤖", type: "good", weight: 10, effects: { cultivation: 25, slack: 10 } },
  { name: "奶茶续命", icon: "🧋", type: "good", weight: 11, effects: { slack: 15 } },
  { name: "周报模板", icon: "📄", type: "good", weight: 9, effects: { alert: -20 } },
  { name: "假装开会", icon: "💻", type: "good", weight: 9, effects: { slack: 15, alert: -10 } },
  { name: "代码秘籍", icon: "📘", type: "good", weight: 10, effects: { cultivation: 20 } },
  { name: "摸鱼结界", icon: "🛡️", type: "good", weight: 6, special: "shield" },
  { name: "远程办公", icon: "🏠", type: "good", weight: 8, effects: { slack: 20, alert: -15 } },
  { name: "带薪拉屎", icon: "🚽", type: "risk", weight: 7, effects: { slack: 35, alert: 20 } },
  { name: "偷看短视频", icon: "📱", type: "risk", weight: 7, effects: { slack: 25 }, special: "slow" },
  { name: "摸鱼神器", icon: "🎮", type: "risk", weight: 7, effects: { cultivation: 15, slack: 20 }, special: "randomAlert" },
  { name: "老板路过", icon: "👔", type: "bad", weight: 7, effects: { alert: 30 } },
  { name: "需求变更", icon: "💣", type: "bad", weight: 7, effects: { cultivation: -15, alert: 10 } },
  { name: "绩效面谈", icon: "📊", type: "bad", weight: 6, effects: { slack: -20, alert: 25 } },
  { name: "同事甩锅", icon: "🍳", type: "bad", weight: 6, effects: { cultivation: -10, alert: 15 } },
  { name: "临时会议", icon: "📢", type: "bad", weight: 6, effects: { slack: -15, alert: 15 } },
];

let state;
let rafId = 0;
let lastTick = 0;
let spawnTimer = 0;
let bossTimer = 0;
let bossDamageTimer = 0;
let touchStartX = 0;
let touchStartY = 0;
let toastTimer = 0;

function freshState() {
  return {
    running: false,
    ended: false,
    timeLeft: totalTime,
    elapsed: 0,
    cultivation: 20,
    slack: 20,
    alert: 10,
    lane: 1,
    drops: [],
    nextDropId: 1,
    bossLane: -1,
    bossSightActive: false,
    goodCombo: 0,
    dodgeCombo: 0,
    shieldUntil: 0,
    slowUntil: 0,
    focusUntil: 0,
    skillCooldownUntil: 0,
    lastBossLane: -1,
    finalWarningShown: false,
  };
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function setScreen(screen) {
  els.startScreen.classList.toggle("is-hidden", screen !== "start");
  els.gameScreen.classList.toggle("is-hidden", screen !== "game");
  els.resultScreen.classList.toggle("is-hidden", screen !== "result");
}

function startGame() {
  cancelAnimationFrame(rafId);
  state = freshState();
  lastTick = performance.now();
  spawnTimer = 0;
  bossTimer = 0;
  bossDamageTimer = 0;
  clearDrops();
  els.gameScreen.classList.remove("rage");
  els.playfield.classList.remove("sprint");
  document.querySelector(".result-panel").classList.remove("success", "fail");
  setScreen("game");
  state.running = true;
  updateHud();
  updatePlayer();
  rafId = requestAnimationFrame(loop);
  showToast("开工即飞升");
}

function clearDrops() {
  els.itemsLayer.innerHTML = "";
  els.floatLayer.innerHTML = "";
}

function loop(now) {
  if (!state.running) return;
  const dt = Math.min(0.04, (now - lastTick) / 1000);
  lastTick = now;
  state.elapsed += dt;
  state.timeLeft = Math.max(0, totalTime - state.elapsed);

  updatePhase();
  updateBoss(dt);
  updateSpawns(dt);
  updateDrops(dt);
  updateSkill();
  updateHud();
  updatePlayer();

  if (state.alert >= 100) {
    endGame(false, "老板抓包");
    return;
  }

  if (state.timeLeft <= 0) {
    endGame(true, "下班成功");
    return;
  }

  rafId = requestAnimationFrame(loop);
}

function getPhase() {
  if (state.elapsed < 15) return 1;
  if (state.elapsed < 30) return 2;
  if (state.elapsed < 45) return 3;
  return 4;
}

function updatePhase() {
  const phase = getPhase();
  const labels = {
    1: "安全发育期",
    2: "老板开始巡逻",
    3: "需求变更轰炸",
    4: "下班冲刺！撑住！",
  };
  els.phaseText.textContent = labels[phase];
  els.playfield.classList.toggle("sprint", phase === 4);
  els.gameScreen.classList.toggle("rage", phase === 4);
  els.timerText.classList.toggle("urgent", state.timeLeft <= 15);

  if (state.timeLeft <= 10 && !state.finalWarningShown) {
    state.finalWarningShown = true;
    showToast("快下班了！撑住！");
  }
}

function updateBoss(dt) {
  const phase = getPhase();
  if (phase === 1) {
    state.bossSightActive = false;
    state.bossLane = -1;
    renderBossSight();
    return;
  }

  bossTimer -= dt;
  if (bossTimer <= 0) {
    const previous = state.bossLane;
    state.bossLane = Math.floor(Math.random() * 3);
    state.bossSightActive = true;
    bossTimer = phase === 4 ? 1.15 : phase === 3 ? 1.65 : 2.25;
    if (previous === state.lane && state.bossLane !== state.lane) {
      state.dodgeCombo += 1;
      if (state.dodgeCombo >= 3) {
        state.dodgeCombo = 0;
        applyValues({ alert: -15 });
        showToast("老板盲区！");
      }
    }
    renderBossSight();
  }

  if (!state.bossSightActive || state.bossLane !== state.lane || state.elapsed < state.shieldUntil) return;

  bossDamageTimer += dt;
  if (bossDamageTimer >= 1) {
    bossDamageTimer = 0;
    let damage = phase === 4 ? 18 : 12;
    if (state.elapsed < state.focusUntil) damage *= 0.5;
    applyValues({ alert: damage });
    showToast("老板视线锁定！");
  }
}

function renderBossSight() {
  if (state.bossLane < 0 || !state.bossSightActive) {
    els.bossSight.classList.remove("active");
    els.bossWarning.classList.remove("show");
    els.bossWarning.textContent = "";
    return;
  }
  els.bossSight.style.left = `${state.bossLane * 33.333}%`;
  els.bossSight.classList.add("active");
  els.bossWarning.textContent = `老板正在看${laneNames[state.bossLane]}！`;
  els.bossWarning.classList.add("show");
}

function updateSpawns(dt) {
  spawnTimer -= dt;
  if (spawnTimer > 0) return;
  const phase = getPhase();
  const interval = phase === 4 ? 0.44 : phase === 3 ? 0.62 : phase === 2 ? 0.78 : 0.9;
  spawnTimer = interval * (0.75 + Math.random() * 0.55);
  spawnDrop();
  if (phase === 4 && Math.random() < 0.34) spawnDrop();
}

function spawnDrop() {
  const lane = Math.floor(Math.random() * 3);
  const item = chooseItem();
  const el = document.createElement("div");
  el.className = `falling-item ${item.type}${item.special === "shield" ? " rare" : ""}`;
  el.innerHTML = `<span class="emoji">${item.icon}</span><span class="label">${shortNames[item.name] || item.name}</span>`;
  els.itemsLayer.appendChild(el);
  state.drops.push({
    id: state.nextDropId++,
    lane,
    y: -50,
    item,
    el,
    hit: false,
  });
  placeDrop(state.drops[state.drops.length - 1]);
}

function chooseItem() {
  const phase = getPhase();
  const weighted = items.map((item) => {
    let weight = item.weight;
    if (phase === 1 && item.type === "good") weight *= 1.7;
    if (phase === 1 && item.type === "bad") weight *= 0.45;
    if (phase === 2 && item.type === "bad") weight *= 1.15;
    if (phase === 3 && item.type === "bad") weight *= item.name === "需求变更" || item.name === "临时会议" || item.name === "绩效面谈" ? 2.1 : 1.35;
    if (phase === 4 && item.type !== "good") weight *= 1.6;
    return { item, weight };
  });
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.item;
  }
  return items[0];
}

function updateDrops(dt) {
  const rect = els.playfield.getBoundingClientRect();
  const phase = getPhase();
  const slowed = state.elapsed < state.slowUntil;
  const speed = (phase === 4 ? 360 : phase === 3 ? 300 : phase === 2 ? 248 : 205) * (slowed ? 0.72 : 1);
  const playerY = rect.height - 64;

  for (const drop of state.drops) {
    drop.y += speed * dt;
    placeDrop(drop);
    if (!drop.hit && drop.lane === state.lane && Math.abs(drop.y - playerY) < 50) {
      collectDrop(drop);
    }
  }

  state.drops = state.drops.filter((drop) => {
    const keep = !drop.hit && drop.y < rect.height + 80;
    if (!keep && !drop.hit) drop.el.remove();
    return keep;
  });
}

function placeDrop(drop) {
  drop.el.style.left = `${laneCenters[drop.lane]}%`;
  drop.el.style.top = `${drop.y}px`;
}

function collectDrop(drop) {
  drop.hit = true;
  const item = drop.item;
  drop.el.classList.add("collecting");
  setTimeout(() => drop.el.remove(), 240);
  showFloat(drop, item);
  applyValues(item.effects || {});

  if (item.special === "shield") {
    state.shieldUntil = state.elapsed + 5;
    showToast("摸鱼结界展开");
  } else if (item.special === "slow") {
    state.slowUntil = state.elapsed + 3;
    showToast("短视频上头");
  } else if (item.special === "randomAlert" && Math.random() < 0.3) {
    applyValues({ alert: 25 });
    showToast("神器弹窗暴露！");
  } else {
    showToast(`${item.icon} ${item.name}`);
  }

  if (item.type === "good") {
    state.goodCombo += 1;
    if (state.goodCombo >= 3) {
      state.goodCombo = 0;
      applyValues({ slack: 10 });
      showToast("带薪连击！");
    }
  } else if (item.type === "bad") {
    state.goodCombo = 0;
  }
}

function applyValues(effects) {
  state.cultivation = clamp(state.cultivation + (effects.cultivation || 0));
  state.slack = clamp(state.slack + (effects.slack || 0));
  state.alert = clamp(state.alert + (effects.alert || 0));
}

function showFloat(drop, item) {
  const parts = [];
  const effects = item.effects || {};
  if (effects.cultivation) parts.push(`修${effects.cultivation > 0 ? "+" : ""}${effects.cultivation}`);
  if (effects.slack) parts.push(`摸${effects.slack > 0 ? "+" : ""}${effects.slack}`);
  if (effects.alert) parts.push(`警${effects.alert > 0 ? "+" : ""}${effects.alert}`);
  if (item.special === "shield") parts.push("护罩");
  if (!parts.length) parts.push(item.type === "bad" ? "糟糕" : "爽");

  const el = document.createElement("div");
  el.className = `float-pop ${item.type}`;
  el.textContent = parts.slice(0, 2).join(" ");
  el.style.left = `${laneCenters[drop.lane]}%`;
  el.style.top = `${drop.y}px`;
  els.floatLayer.appendChild(el);
  setTimeout(() => el.remove(), 840);
}

function move(dir) {
  if (!state || !state.running) return;
  const stepBlocked = state.elapsed < state.slowUntil && Math.random() < 0.28;
  if (stepBlocked) {
    showToast("手滑刷视频中");
    return;
  }
  state.lane = Math.max(0, Math.min(2, state.lane + dir));
  els.player.classList.remove("moving");
  void els.player.offsetWidth;
  els.player.classList.add("moving");
  updatePlayer();
}

function useSkill() {
  if (!state || !state.running || state.elapsed < state.skillCooldownUntil) return;
  applyValues({ alert: -20 });
  state.focusUntil = state.elapsed + 3;
  state.skillCooldownUntil = state.elapsed + 10;
  updateSkill();
  els.player.classList.remove("shield-burst");
  void els.player.offsetWidth;
  els.player.classList.add("shield-burst");
  setTimeout(() => els.player.classList.remove("shield-burst"), 520);
  showToast("假装努力成功！");
}

function updateSkill() {
  const left = Math.max(0, state.skillCooldownUntil - state.elapsed);
  els.skillBtn.disabled = left > 0;
  els.skillStatus.textContent = left > 0 ? `冷却 ${Math.ceil(left)}s` : "可使用";
}

function updateHud() {
  els.timerText.textContent = `距离下班 ${Math.ceil(state.timeLeft)}s`;
  document.querySelector(".danger-meter").classList.toggle("danger-alert", state.alert >= 70);
  const values = [
    ["cultivation", state.cultivation],
    ["slack", state.slack],
    ["alert", state.alert],
  ];
  for (const [name, value] of values) {
    els[`${name}Value`].textContent = value;
    els[`${name}Bar`].style.width = `${value}%`;
  }
}

function updatePlayer() {
  els.player.style.left = `${laneCenters[state.lane]}%`;
  document.querySelectorAll(".lane").forEach((lane) => {
    lane.classList.toggle("active", Number(lane.dataset.lane) === state.lane);
  });
  els.player.classList.toggle("power", state.cultivation >= 60);
  els.player.classList.toggle("ascend", state.cultivation >= 90 && state.slack >= 90 && state.alert <= 40);
  els.player.classList.toggle("nervous", state.timeLeft <= 15 || state.alert >= 70);
  els.mood.textContent = state.slack >= 60 ? (state.slack >= 82 ? "😎" : "🧋") : "";
  els.statusMark.textContent = state.alert >= 70 ? (state.alert >= 88 ? "危" : "💦") : "";
}

function showToast(text) {
  els.toast.textContent = text;
  els.toast.classList.remove("show");
  void els.toast.offsetWidth;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.remove("show");
    toastTimer = 0;
  }, 980);
}

function endGame(success, reason) {
  state.running = false;
  state.ended = true;
  cancelAnimationFrame(rafId);

  if (success) {
    showToast("下班！");
    setTimeout(() => renderResult(success, reason), 760);
    return;
  }

  renderResult(success, reason);
}

function renderResult(success, reason) {
  const perfect = state.cultivation >= 90 && state.slack >= 90 && state.alert <= 40;
  const score = state.cultivation * 0.38 + state.slack * 0.42 + (100 - state.alert) * 0.2;
  const rank = !success ? (state.alert >= 100 ? "D" : "C") : score >= 88 ? "S" : score >= 72 ? "A" : score >= 56 ? "B" : "C";
  const role = !success
    ? "复盘打工人"
    : perfect
      ? "摸鱼仙尊"
      : state.slack >= 80
        ? "咸鱼王"
        : state.cultivation >= 80
          ? "技术牛马"
          : "普通下班人";
  const panel = document.querySelector(".result-panel");
  panel.classList.toggle("success", success);
  panel.classList.toggle("fail", !success);

  els.resultRank.textContent = rank;
  els.resultRole.textContent = role;
  els.resultIcon.textContent = success ? (perfect ? "🌟" : "✨") : "🚨";
  els.resultTitle.textContent = success ? (perfect ? "带薪飞升，摸鱼仙尊" : "准点下班，工位幸存") : reason;
  els.resultText.textContent = success
    ? perfect
      ? "你把工作流、摸鱼术和表情管理练到圆满，已在工位原地飞升。"
      : "你成功撑到下班，带着完整的摸鱼值离开了办公室。"
    : "老板警觉值爆表，你被抓包写复盘。明天继续修炼表情管理。";
  els.resultStats.innerHTML = `
    <span>修为<b>${state.cultivation}</b></span>
    <span>摸鱼<b>${state.slack}</b></span>
    <span>警觉<b>${state.alert}</b></span>
  `;
  setScreen("result");
}

function bindInput() {
  els.startBtn.addEventListener("click", startGame);
  els.restartBtn.addEventListener("click", startGame);
  els.guideBtn.addEventListener("click", () => {
    els.quickGuide.hidden = !els.quickGuide.hidden;
  });
  els.skillBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    useSkill();
  });

  els.playfield.addEventListener("pointerdown", (event) => {
    touchStartX = event.clientX;
    touchStartY = event.clientY;
  });

  els.playfield.addEventListener("pointerup", (event) => {
    const dx = event.clientX - touchStartX;
    const dy = event.clientY - touchStartY;
    if (Math.abs(dx) > 34 && Math.abs(dx) > Math.abs(dy)) {
      move(dx > 0 ? 1 : -1);
      return;
    }
    const half = window.innerWidth / 2;
    move(event.clientX < half ? -1 : 1);
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") move(-1);
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") move(1);
    if (event.code === "Space") useSkill();
  });

  document.addEventListener(
    "touchmove",
    (event) => {
      event.preventDefault();
    },
    { passive: false },
  );
}

bindInput();
state = freshState();
updateHud();
updatePlayer();
