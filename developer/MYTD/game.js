const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const towerForm = document.querySelector("#towerForm");
const towerList = document.querySelector("#towerList");
const placedTowerList = document.querySelector("#placedTowerList");
const message = document.querySelector("#gameMessage");
const cashDisplay = document.querySelector("#cash");
const coinsDisplay = document.querySelector("#coins");
const livesDisplay = document.querySelector("#lives");
const waveDisplay = document.querySelector("#wave");
const startWaveButton = document.querySelector("#startWave");
const autoStartWavesCheckbox = document.querySelector("#autoStartWaves");
const deleteModeButton = document.querySelector("#deleteMode");
const selectModeButton = document.querySelector("#selectMode");
const restartButton = document.querySelector("#restart");
const resetProgressButton = document.querySelector("#resetProgress");
const saveKey = "bestTdGameState";

const path = [
  { x: -20, y: 70 },
  { x: 100, y: 70 },
  { x: 100, y: 170 },
  { x: 290, y: 170 },
  { x: 290, y: 300 },
  { x: 420, y: 300 },
];
const pathWidth = 38;
const pathLength = path.slice(1).reduce((total, point, index) => {
  return total + Math.hypot(point.x - path[index].x, point.y - path[index].y);
}, 0);
const ranges = {
  close: { distance: 85, damageMultiplier: 1.5, allyHitLimit: 2 },
  medium: { distance: 125, damageMultiplier: 1, allyHitLimit: 4 },
  sniper: { distance: 175, damageMultiplier: 0.65, allyHitLimit: 7 },
};
const budgetDamageMultipliers = {
  100: 0.3,
  250: 0.5,
  500: 1,
  800: 1.3,
  1500: 2.5,
  2500: 3.5,
  10000: 7.5,
};
const defaultPermanentUpgrades = {
  coinIncome: false,
  costDiscount: false,
  laser: false,
  explosive: false,
  ally: false,
};
const weapons = {
  bullet: { damage: 12, interval: 0.55 },
  magic: { damage: 24, interval: 0.95 },
  spear: { damage: 45, interval: 1.4 },
  laser: { damage: 20, interval: 0, continuous: true },
  explosive: { damage: 45, interval: 1.4, splashRadius: 50 },
  ally: { damage: 30, interval: 3, allySpawner: true, allySpeed: 150, allyRadius: 9 },
};
const towerUpgrades = {
  bullet: { id: "machineGun", name: "Machine gun", description: "fires 3x as fast", intervalMultiplier: 1 / 3 },
  magic: { id: "moneySiphon", name: "Money siphon", description: "earns 3x cash for enemies it kills", rewardMultiplier: 3 },
  spear: { id: "finalBlow", name: "Final blow", description: "deals 2x damage", damageMultiplier: 2 },
  laser: { id: "tripleBeam", name: "Triple beam", description: "hits up to three enemies", targetLimit: 3 },
  explosive: { id: "explosiveBoom", name: "Explosive Boom", description: "deals 3x explosion damage", damageMultiplier: 3 },
  ally: { id: "reinforcements", name: "Reinforcements", description: "spawns allies 3x as often", intervalMultiplier: 1 / 3 },
};
const enemyTypes = {
  normal: { healthMultiplier: 1, speedMultiplier: 1, color: "#b63838", symbol: "N", radius: 10 },
  fast: { healthMultiplier: 0.45, speedMultiplier: 1.8, color: "#e5a323", symbol: "F", radius: 8 },
  tank: { healthMultiplier: 2.4, speedMultiplier: 0.55, color: "#6456a8", symbol: "T", radius: 13 },
  titan: { healthMultiplier: 8, speedMultiplier: 0.3, color: "#344f68", symbol: "X", radius: 16 },
  boss: { healthMultiplier: 24, speedMultiplier: 0.44, color: "#a52f4b", symbol: "B", radius: 19 },
};

let cash = 500;
let coins = 0;
let lives = 1;
let permanentUpgrades = { ...defaultPermanentUpgrades };
let wave = 0;
let waveActive = false;
let autoStartWaves = false;
let gameOver = false;
let deleteMode = false;
let selectMode = false;
let spawnRemaining = 0;
let spawnTimer = 0;
let enemies = [];
let allies = [];
let towers = [];
let towerDesigns = [];
let selectedDesignId = null;
let selectedTower = null;
let pointer = null;
let hoveredTower = null;
let effects = [];
let nextDesignId = 1;
let nextEnemyId = 1;
let lastFrameTime = 0;
let saveTimer = 0;
let persistenceDisabled = false;

function isValidDesign(design) {
  return design !== null &&
    typeof design === "object" &&
    Number.isInteger(design.id) &&
    typeof design.name === "string" &&
    Object.hasOwn(weapons, design.weapon) &&
    Number.isInteger(design.cost) &&
    Object.hasOwn(budgetDamageMultipliers, design.cost) &&
    design.budgetMultiplier === budgetDamageMultipliers[design.cost] &&
    Number.isFinite(design.range) &&
    Number.isFinite(design.damage) &&
    design.damage >= 1 &&
    Number.isFinite(design.interval) &&
    (design.weapon !== "ally" || design.maxEnemyHits === undefined || [2, 4, 7].includes(design.maxEnemyHits)) &&
    typeof design.color === "string" &&
    /^#[0-9a-f]{6}$/i.test(design.color) &&
    typeof design.symbol === "string";
}

function isValidPermanentUpgrades(upgrades) {
  return upgrades === undefined ||
    (upgrades !== null &&
      typeof upgrades === "object" &&
      Object.entries(upgrades).every(([id, value]) =>
        Object.hasOwn(defaultPermanentUpgrades, id) && typeof value === "boolean",
      ));
}

function isValidAlly(ally) {
  return ally !== null &&
    typeof ally === "object" &&
    Number.isFinite(ally.distance) &&
    ally.distance >= 0 &&
    ally.distance <= pathLength &&
    Number.isFinite(ally.x) &&
    Number.isFinite(ally.y) &&
    Number.isFinite(ally.speed) &&
    ally.speed > 0 &&
    Number.isFinite(ally.damage) &&
    ally.damage >= 1 &&
    Number.isFinite(ally.radius) &&
    typeof ally.color === "string" &&
    /^#[0-9a-f]{6}$/i.test(ally.color) &&
    Array.isArray(ally.hitEnemyIds) &&
    ally.hitEnemyIds.every(Number.isInteger) &&
    (ally.maxEnemyHits === undefined || (Number.isInteger(ally.maxEnemyHits) && ally.maxEnemyHits >= 2)) &&
    (ally.maxEnemyHits === undefined || ally.hitEnemyIds.length <= ally.maxEnemyHits);
}

function isValidSavedGame(state) {
  return state !== null &&
    typeof state === "object" &&
    state.version === 1 &&
    Number.isFinite(state.cash) &&
    state.cash >= 0 &&
    (state.coins === undefined || (Number.isInteger(state.coins) && state.coins >= 0)) &&
    Number.isInteger(state.lives) &&
    state.lives >= 0 &&
    state.lives <= 10 &&
    Number.isInteger(state.wave) &&
    state.wave >= 0 &&
    typeof state.waveActive === "boolean" &&
    (state.autoStartWaves === undefined || typeof state.autoStartWaves === "boolean") &&
    typeof state.gameOver === "boolean" &&
    isValidPermanentUpgrades(state.permanentUpgrades) &&
    Number.isInteger(state.spawnRemaining) &&
    state.spawnRemaining >= 0 &&
    Number.isFinite(state.spawnTimer) &&
    state.spawnTimer >= 0 &&
    Number.isInteger(state.nextDesignId) &&
    state.nextDesignId > 0 &&
    (state.nextEnemyId === undefined || (Number.isInteger(state.nextEnemyId) && state.nextEnemyId > 0)) &&
    (state.selectedDesignId === null || Number.isInteger(state.selectedDesignId)) &&
    Array.isArray(state.towerDesigns) &&
    state.towerDesigns.every(isValidDesign) &&
    Array.isArray(state.towers) &&
    state.towers.every((tower) =>
      isValidDesign(tower) &&
      Number.isInteger(tower.designId) &&
      Number.isFinite(tower.x) &&
      Number.isFinite(tower.y) &&
      Number.isFinite(tower.cooldown) &&
      (tower.upgrade === undefined || tower.upgrade === towerUpgrades[tower.weapon].id) &&
      (tower.paidCost === undefined || (Number.isInteger(tower.paidCost) && tower.paidCost >= 0)),
    ) &&
    Array.isArray(state.enemies) &&
    state.enemies.every((enemy) =>
      enemy !== null &&
      typeof enemy === "object" &&
      Number.isFinite(enemy.distance) &&
      Number.isFinite(enemy.x) &&
      Number.isFinite(enemy.y) &&
      Number.isFinite(enemy.health) &&
      Number.isFinite(enemy.maxHealth) &&
      enemy.maxHealth > 0 &&
      Number.isFinite(enemy.speed) &&
      Number.isFinite(enemy.reward) &&
      Number.isFinite(enemy.radius) &&
      (enemy.id === undefined || (Number.isInteger(enemy.id) && enemy.id > 0)) &&
      (enemy.type === undefined || Object.hasOwn(enemyTypes, enemy.type)),
    ) &&
    (state.allies === undefined || (Array.isArray(state.allies) && state.allies.every(isValidAlly)));
}

function reportPersistenceFailure(action, error) {
  persistenceDisabled = true;
  console.error(`Unable to ${action} the saved game.`, error);
  message.textContent = "The saved game could not be accessed; this session may not persist. See the console for details.";
}

function restoreGameState() {
  let savedText;
  try {
    savedText = window.localStorage.getItem(saveKey);
  } catch (error) {
    reportPersistenceFailure("read", error);
    return false;
  }
  if (savedText === null) return false;

  let state;
  try {
    state = JSON.parse(savedText);
  } catch (error) {
    reportPersistenceFailure("parse", error);
    return false;
  }
  if (!isValidSavedGame(state)) {
    reportPersistenceFailure("validate", new Error("Saved game data is invalid."));
    return false;
  }

  cash = state.cash;
  coins = state.coins ?? 0;
  lives = state.lives;
  wave = state.wave;
  autoStartWaves = state.autoStartWaves ?? false;
  permanentUpgrades = { ...defaultPermanentUpgrades, ...state.permanentUpgrades };
  waveActive = state.waveActive;
  gameOver = state.gameOver;
  spawnRemaining = state.spawnRemaining;
  spawnTimer = state.spawnTimer;
  nextEnemyId = state.nextEnemyId ?? 1;
  towerDesigns = state.towerDesigns;
  towers = state.towers;
  for (const tower of towers) {
    tower.paidCost ??= tower.cost;
    if (tower.weapon === "ally") tower.maxEnemyHits ??= getAllyHitLimit(tower.range);
  }
  enemies = state.enemies;
  for (const enemy of enemies) {
    enemy.type ??= "normal";
    if (!Number.isInteger(enemy.id)) enemy.id = nextEnemyId++;
    else nextEnemyId = Math.max(nextEnemyId, enemy.id + 1);
  }
  allies = state.allies ?? [];
  for (const ally of allies) {
    ally.maxEnemyHits ??= Math.max(4, ally.hitEnemyIds.length);
  }
  for (const design of towerDesigns) {
    if (design.weapon === "ally") design.maxEnemyHits ??= getAllyHitLimit(design.range);
  }
  selectedDesignId = towerDesigns.some((design) =>
    design.id === state.selectedDesignId && (design.weapon !== "ally" || permanentUpgrades.ally),
  )
    ? state.selectedDesignId
    : null;
  nextDesignId = state.nextDesignId;
  return true;
}

function saveGameState() {
  if (persistenceDisabled) return;

  const state = {
    version: 1,
    cash,
    coins,
    lives,
    permanentUpgrades,
    wave,
    waveActive,
    autoStartWaves,
    gameOver,
    spawnRemaining,
    spawnTimer,
    nextEnemyId,
    towerDesigns,
    towers,
    enemies,
    allies,
    selectedDesignId,
    nextDesignId,
  };
  try {
    window.localStorage.setItem(saveKey, JSON.stringify(state));
  } catch (error) {
    reportPersistenceFailure("save", error);
  }
}

function updateHud() {
  cashDisplay.textContent = String(cash);
  coinsDisplay.textContent = String(coins);
  livesDisplay.textContent = String(lives);
  waveDisplay.textContent = String(wave);
  autoStartWavesCheckbox.checked = autoStartWaves;
  startWaveButton.disabled = waveActive || gameOver;
  startWaveButton.textContent = waveActive ? `Wave ${wave} in progress` : `Start Wave ${wave + 1}`;
  restartButton.hidden = !gameOver;
}

function updateModeControls() {
  deleteModeButton.setAttribute("aria-pressed", String(deleteMode));
  deleteModeButton.textContent = `Delete map towers: ${deleteMode ? "ON" : "OFF"}`;
  selectModeButton.setAttribute("aria-pressed", String(selectMode));
  selectModeButton.textContent = `Select mode: ${selectMode ? "ON" : "OFF"}`;
  canvas.classList.toggle("delete-mode", deleteMode);
  canvas.classList.toggle("select-mode", selectMode);
}

function renderTowerList() {
  towerList.replaceChildren();
  renderPlacedTowerList();

  if (towerDesigns.length === 0) {
    towerList.textContent = "No towers yet.";
    return;
  }

  for (const design of towerDesigns) {
    const entry = document.createElement("div");
    const selectButton = document.createElement("button");
    const deleteButton = document.createElement("button");
    const placed = towers.filter((tower) => tower.designId === design.id).length;
    const placementCost = getTowerCost(design);
    const weapon = weapons[design.weapon];
    const attackStats = weapon.allySpawner
      ? `${design.damage} damage · passes ${design.maxEnemyHits} enemies · ally every ${design.interval.toFixed(1)}s · ${weapon.allySpeed}px/s`
      : weapon.continuous
        ? `${design.damage} DPS continuous`
        : `${design.damage} damage every ${design.interval.toFixed(2)}s${weapon.splashRadius ? ` · ${weapon.splashRadius}px splash` : ""}`;
    const swatch = document.createElement("span");
    entry.className = "tower-design-entry";
    swatch.className = "tower-color-swatch";
    swatch.style.backgroundColor = design.color;
    swatch.setAttribute("aria-hidden", "true");
    selectButton.type = "button";
    selectButton.className = "tower-design-select";
    selectButton.append(
      swatch,
      document.createTextNode(`${design.name} · $${placementCost}${placementCost < design.cost ? ` (was $${design.cost})` : ""} · ${design.weapon} · ${attackStats} · budget x${design.budgetMultiplier} · range ${design.range} · color ${design.color} · placed ${placed}`),
    );
    selectButton.setAttribute("aria-pressed", String(design.id === selectedDesignId));
    selectButton.disabled = design.weapon === "ally" && !permanentUpgrades.ally;
    selectButton.addEventListener("click", () => {
      selectMode = false;
      selectedTower = null;
      updateModeControls();
      selectedDesignId = design.id;
      message.textContent = deleteMode
        ? `${design.name} selected. Turn off map delete mode to place it.`
        : `${design.name} selected. Click a clear spot on the map to place it.`;
      renderTowerList();
      saveGameState();
    });

    deleteButton.type = "button";
    deleteButton.className = "delete-design";
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("aria-label", `Delete ${design.name} design`);
    deleteButton.addEventListener("click", () => {
      towerDesigns = towerDesigns.filter((item) => item.id !== design.id);
      if (selectedDesignId === design.id) selectedDesignId = null;
      message.textContent = `${design.name} removed from Towers created. Placed towers remain on the map.`;
      renderTowerList();
      saveGameState();
    });

    entry.append(selectButton, deleteButton);
    towerList.append(entry);
  }
}

function renderPlacedTowerList() {
  placedTowerList.replaceChildren();

  if (!selectedTower || !towers.includes(selectedTower)) {
    placedTowerList.textContent = towers.length === 0
      ? "No towers placed yet."
      : "Click a placed tower on the map to view its upgrade.";
    return;
  }

  const tower = selectedTower;
  const entry = document.createElement("div");
  const details = document.createElement("span");
  const upgradeButton = document.createElement("button");
  const upgrade = towerUpgrades[tower.weapon];
  const upgradeCost = tower.cost * 2;
  const upgraded = tower.upgrade === upgrade.id;

  entry.className = "placed-tower-entry";
  entry.tabIndex = -1;
  details.textContent = `${tower.name} · ${tower.weapon} · ${upgrade.name}: ${upgrade.description} · $${upgradeCost}`;
  upgradeButton.type = "button";
  upgradeButton.textContent = upgraded ? `${upgrade.name} purchased` : `Buy ${upgrade.name} ($${upgradeCost})`;
  upgradeButton.disabled = upgraded;
  upgradeButton.setAttribute("aria-label", upgraded
    ? `${upgrade.name} already purchased for ${tower.name}`
    : `Buy ${upgrade.name} for ${tower.name} at $${upgradeCost}`);
  upgradeButton.addEventListener("click", () => {
    if (tower.upgrade === upgrade.id) return;
    if (cash < upgradeCost) {
      message.textContent = `You need $${upgradeCost} to buy ${upgrade.name} for ${tower.name}.`;
      return;
    }

    cash -= upgradeCost;
    tower.upgrade = upgrade.id;
    tower.cooldown = Math.min(tower.cooldown, getTowerInterval(tower));
    message.textContent = `${tower.name} upgraded: ${upgrade.name}.`;
    updateHud();
    renderTowerList();
    saveGameState();
  });

  entry.append(details, upgradeButton);
  placedTowerList.append(entry);
}

function getSelectedDesign() {
  const design = towerDesigns.find((item) => item.id === selectedDesignId);
  return design && (design.weapon !== "ally" || permanentUpgrades.ally) ? design : null;
}

function getTowerCost(design) {
  return permanentUpgrades.costDiscount ? Math.ceil(design.cost * 0.95) : design.cost;
}

function getTowerInterval(tower) {
  const upgrade = towerUpgrades[tower.weapon];
  return tower.interval * (tower.upgrade === upgrade.id ? upgrade.intervalMultiplier ?? 1 : 1);
}

function getTowerDamage(tower) {
  const upgrade = towerUpgrades[tower.weapon];
  return tower.damage * (tower.upgrade === upgrade.id ? upgrade.damageMultiplier ?? 1 : 1);
}

function getAllyHitLimit(range) {
  return Object.values(ranges).find((rangeType) => rangeType.distance === range)?.allyHitLimit ?? 4;
}

function updateWeaponOptions() {
  for (const weapon of ["laser", "explosive", "ally"]) {
    const input = towerForm.querySelector(`input[name="towerBullet"][value="${weapon}"]`);
    const lockNote = document.querySelector(`[data-weapon-lock="${weapon}"]`);
    input.disabled = !permanentUpgrades[weapon];
    lockNote.hidden = permanentUpgrades[weapon];
  }
}

function getCanvasPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
    y: (event.clientY - bounds.top) * (canvas.height / bounds.height),
  };
}

function getPointOnPath(distance) {
  let remaining = distance;
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1];
    const to = path[index];
    const segmentLength = Math.hypot(to.x - from.x, to.y - from.y);
    if (remaining <= segmentLength) {
      const progress = remaining / segmentLength;
      return {
        x: from.x + (to.x - from.x) * progress,
        y: from.y + (to.y - from.y) * progress,
      };
    }
    remaining -= segmentLength;
  }
  return path[path.length - 1];
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const projection = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + projection * dx), point.y - (start.y + projection * dy));
}

function isValidPlacement(point) {
  const towerRadius = 13;
  if (
    point.x < towerRadius ||
    point.y < towerRadius ||
    point.x > canvas.width - towerRadius ||
    point.y > canvas.height - towerRadius
  ) {
    return false;
  }

  for (let index = 1; index < path.length; index += 1) {
    if (distanceToSegment(point, path[index - 1], path[index]) < pathWidth / 2 + towerRadius + 3) {
      return false;
    }
  }

  return towers.every((tower) => Math.hypot(point.x - tower.x, point.y - tower.y) >= 25);
}

function getTowerAtPoint(point) {
  let nearestTower = null;
  let nearestDistance = 18;
  for (const tower of towers) {
    const distance = Math.hypot(point.x - tower.x, point.y - tower.y);
    if (distance <= nearestDistance) {
      nearestTower = tower;
      nearestDistance = distance;
    }
  }
  return nearestTower;
}

function openTowerUpgradeMenu(tower) {
  selectedTower = tower;
  selectedDesignId = null;
  selectMode = true;
  deleteMode = false;
  updateModeControls();
  renderTowerList();

  const entry = placedTowerList.querySelector(".placed-tower-entry");
  if (entry) {
    entry.scrollIntoView({ behavior: "smooth", block: "center" });
    (entry.querySelector("button").disabled ? entry : entry.querySelector("button"))
      .focus({ preventScroll: true });
  }
  message.textContent = `${tower.name} selected. Its upgrade menu is highlighted below.`;
  saveGameState();
}

function spawnEnemy(type, distance = 0, point = path[0]) {
  if (type === undefined) {
    type = "normal";
    if (wave % 20 === 0 && spawnRemaining === 1) {
      type = "boss";
    } else if (wave >= 12 && spawnRemaining % 7 === 0) {
      type = "titan";
    } else if (wave >= 8 && spawnRemaining % 5 === 0) {
      type = "tank";
    } else if (wave >= 4 && spawnRemaining % 3 === 0) {
      type = "fast";
    }
  }
  const enemyType = enemyTypes[type];
  const maxHealth = Math.round((30 + wave * 7) * enemyType.healthMultiplier);
  enemies.push({
    id: nextEnemyId,
    type,
    distance,
    x: point.x,
    y: point.y,
    health: maxHealth,
    maxHealth,
    speed: (38 + wave * 2) * enemyType.speedMultiplier,
    reward: 18 + wave * 2,
    radius: enemyType.radius,
  });
  nextEnemyId += 1;
}

function damageEnemy(enemy, damage, sourceTower) {
  if (enemy.health <= 0) return;
  enemy.health -= damage;
  if (enemy.health > 0) return;

  const rewardMultiplier = sourceTower?.weapon === "magic" &&
    sourceTower.upgrade === towerUpgrades.magic.id
    ? towerUpgrades.magic.rewardMultiplier
    : 1;
  cash += enemy.reward * rewardMultiplier;
  if (enemy.type === "titan") {
    for (let index = 0; index < 3; index += 1) {
      spawnEnemy("fast", enemy.distance, enemy);
    }
  }
}

function startWave() {
  if (gameOver || waveActive) return;
  wave += 1;
  waveActive = true;
  spawnRemaining = 4 + wave * 2;
  spawnTimer = 0;
  message.textContent = `Wave ${wave}: stop the enemies before they reach the exit.`;
  updateHud();
  saveGameState();
}

function endGame() {
  gameOver = true;
  waveActive = false;
  message.textContent = "Game over. Press Play Again to restart.";
  updateHud();
  saveGameState();
}

function update(deltaTime) {
  if (waveActive && spawnRemaining > 0) {
    spawnTimer -= deltaTime;
    while (spawnTimer <= 0 && spawnRemaining > 0) {
      spawnEnemy();
      spawnRemaining -= 1;
      spawnTimer += 0.8;
    }
  }

  for (const enemy of enemies) {
    enemy.type ??= "normal";
    enemy.distance += enemy.speed * deltaTime;
    const point = getPointOnPath(enemy.distance);
    enemy.x = point.x;
    enemy.y = point.y;

    if (enemy.distance >= pathLength) {
      lives -= 1;
      enemy.health = 0;
      if (lives <= 0) {
        lives = 0;
        endGame();
        break;
      }
    }
  }
  enemies = enemies.filter((enemy) => enemy.health > 0);

  for (const ally of allies) {
    ally.distance = Math.max(0, ally.distance - ally.speed * deltaTime);
    const point = getPointOnPath(ally.distance);
    ally.x = point.x;
    ally.y = point.y;

    for (const enemy of enemies) {
      if (
        enemy.health <= 0 ||
        ally.hitEnemyIds.length >= ally.maxEnemyHits ||
        ally.hitEnemyIds.includes(enemy.id) ||
        Math.hypot(enemy.x - ally.x, enemy.y - ally.y) > ally.radius + enemy.radius
      ) {
        continue;
      }

      ally.hitEnemyIds.push(enemy.id);
      damageEnemy(enemy, ally.damage);
      effects.push({ x1: ally.x, y1: ally.y, x2: enemy.x, y2: enemy.y, life: 0.12, color: ally.color });
    }
  }
  allies = allies.filter((ally) =>
    ally.distance > 0 && ally.hitEnemyIds.length < ally.maxEnemyHits,
  );
  enemies = enemies.filter((enemy) => enemy.health > 0);

  if (!gameOver) {
    for (const tower of towers) {
      const weapon = weapons[tower.weapon];
      if (weapon.allySpawner) {
        tower.cooldown = Math.max(0, tower.cooldown - deltaTime);
        if (
          !waveActive ||
          (spawnRemaining === 0 && enemies.length === 0) ||
          tower.cooldown > 0
        ) {
          continue;
        }

        const startPoint = getPointOnPath(pathLength);
        allies.push({
          distance: pathLength,
          x: startPoint.x,
          y: startPoint.y,
          speed: weapon.allySpeed,
          damage: tower.damage,
          radius: weapon.allyRadius,
          color: tower.color,
          maxEnemyHits: tower.maxEnemyHits,
          hitEnemyIds: [],
        });
        tower.cooldown = getTowerInterval(tower);
        continue;
      }
      if (weapon.continuous) {
        tower.cooldown = 0;
      } else {
        tower.cooldown = Math.max(0, tower.cooldown - deltaTime);
        if (tower.cooldown > 0) continue;
      }

      const targetsInRange = enemies
        .filter((enemy) => enemy.health > 0 && Math.hypot(enemy.x - tower.x, enemy.y - tower.y) <= tower.range)
        .sort((a, b) => b.distance - a.distance);
      const target = targetsInRange[0];
      if (!target) continue;

      if (weapon.continuous) {
        const beamTargets = tower.upgrade === towerUpgrades.laser.id
          ? targetsInRange.slice(0, towerUpgrades.laser.targetLimit)
          : [target];
        for (const beamTarget of beamTargets) {
          damageEnemy(beamTarget, getTowerDamage(tower) * deltaTime, tower);
          effects.push({ x1: tower.x, y1: tower.y, x2: beamTarget.x, y2: beamTarget.y, life: 0.06, color: "#47c9e8" });
        }
        continue;
      }

      tower.cooldown = getTowerInterval(tower);
      const targets = weapon.splashRadius
        ? enemies.filter((enemy) =>
          enemy.health > 0 &&
          Math.hypot(enemy.x - target.x, enemy.y - target.y) <= weapon.splashRadius,
        )
        : [target];
      for (const enemy of targets) {
        damageEnemy(enemy, getTowerDamage(tower), tower);
      }
      effects.push({
        x1: tower.x,
        y1: tower.y,
        x2: target.x,
        y2: target.y,
        life: 0.16,
        color: weapon.splashRadius ? "#ff8c35" : "#fff36a",
        splashRadius: weapon.splashRadius,
      });
    }
    enemies = enemies.filter((enemy) => enemy.health > 0);
  }

  effects = effects.filter((effect) => {
    effect.life -= deltaTime;
    return effect.life > 0;
  });

  if (waveActive && spawnRemaining === 0 && enemies.length === 0 && allies.length === 0) {
    waveActive = false;
    const clearedWave = wave;
    cash += 50;
    const coinReward = permanentUpgrades.coinIncome
      ? 25 + clearedWave * 5
      : 10 + clearedWave;
    coins += coinReward;
    if (autoStartWaves) {
      startWave();
      message.textContent = `Wave ${clearedWave} cleared! You earned a $50 cash bonus and ${coinReward} coins. Wave ${wave} started.`;
    } else {
      message.textContent = `Wave ${clearedWave} cleared! You earned a $50 cash bonus and ${coinReward} coins.`;
      updateHud();
    }
    saveGameState();
  }
}

function drawPath() {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (const point of path.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.strokeStyle = "#9c8765";
  ctx.lineWidth = pathWidth;
  ctx.stroke();
  ctx.strokeStyle = "#cdbb94";
  ctx.lineWidth = pathWidth - 8;
  ctx.stroke();
}

function drawEnemy(enemy) {
  const enemyType = enemyTypes[enemy.type ?? "normal"];
  ctx.beginPath();
  ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
  ctx.fillStyle = enemyType.color;
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 9px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(enemyType.symbol, enemy.x, enemy.y + 0.5);

  const barWidth = 24;
  const healthRatio = Math.max(0, enemy.health / enemy.maxHealth);
  ctx.fillStyle = "#553333";
  ctx.fillRect(enemy.x - barWidth / 2, enemy.y - 17, barWidth, 4);
  ctx.fillStyle = "#54a34a";
  ctx.fillRect(enemy.x - barWidth / 2, enemy.y - 17, barWidth * healthRatio, 4);
}

function drawAlly(ally) {
  ctx.beginPath();
  ctx.arc(ally.x, ally.y, ally.radius, 0, Math.PI * 2);
  ctx.fillStyle = ally.color;
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 10px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("A", ally.x, ally.y + 0.5);
}

function drawTower(tower) {
  ctx.beginPath();
  ctx.arc(tower.x, tower.y, 13, 0, Math.PI * 2);
  ctx.fillStyle = tower.color;
  ctx.fill();
  ctx.strokeStyle = "#25343f";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 11px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(tower.symbol, tower.x, tower.y + 0.5);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawPath();

  for (const tower of towers) drawTower(tower);
  for (const enemy of enemies) drawEnemy(enemy);
  for (const ally of allies) drawAlly(ally);

  for (const effect of effects) {
    ctx.globalAlpha = Math.min(1, effect.life / 0.12);
    if (effect.splashRadius) {
      ctx.beginPath();
      ctx.arc(effect.x2, effect.y2, effect.splashRadius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 140, 53, 0.18)";
      ctx.fill();
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(effect.x1, effect.y1);
      ctx.lineTo(effect.x2, effect.y2);
      ctx.strokeStyle = effect.color ?? "#fff36a";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  const design = getSelectedDesign();
  if (deleteMode && hoveredTower) {
    ctx.beginPath();
    ctx.arc(hoveredTower.x, hoveredTower.y, 18, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(190, 45, 45, 0.25)";
    ctx.fill();
    ctx.strokeStyle = "#aa2323";
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (!deleteMode && design && pointer) {
    const canPlace = cash >= getTowerCost(design) && isValidPlacement(pointer);
    ctx.beginPath();
    ctx.arc(pointer.x, pointer.y, design.range, 0, Math.PI * 2);
    ctx.fillStyle = canPlace ? "rgba(54, 150, 88, 0.12)" : "rgba(190, 45, 45, 0.12)";
    ctx.fill();
    ctx.strokeStyle = canPlace ? "rgba(35, 120, 65, 0.55)" : "rgba(170, 35, 35, 0.55)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(pointer.x, pointer.y, 13, 0, Math.PI * 2);
    ctx.fillStyle = canPlace ? design.color : "#bd4545";
    ctx.globalAlpha = 0.7;
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (!deleteMode && hoveredTower) {
    ctx.beginPath();
    ctx.arc(hoveredTower.x, hoveredTower.y, hoveredTower.range, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(35, 75, 120, 0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  if (gameOver) {
    ctx.fillStyle = "rgba(20, 28, 35, 0.72)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 32px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2);
  }
}

function frame(timestamp) {
  const deltaTime = Math.min((timestamp - lastFrameTime) / 1000, 0.05);
  lastFrameTime = timestamp;
  if (!gameOver) update(deltaTime);
  saveTimer += deltaTime;
  if (saveTimer >= 1) {
    saveTimer = 0;
    saveGameState();
  }
  draw();
  updateHud();
  requestAnimationFrame(frame);
}

towerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(towerForm);
  const weapon = formData.get("towerBullet");
  const cost = Number(formData.get("budget"));
  const budgetMultiplier = budgetDamageMultipliers[cost];
  const rangeType = formData.get("range");
  const name = String(formData.get("towerName")).trim();
  const color = formData.get("towerColor");
  if (!name || !weapons[weapon] || !ranges[rangeType] || !budgetMultiplier || typeof color !== "string") return;

  if (
    (weapon === "laser" && !permanentUpgrades.laser) ||
    (weapon === "explosive" && !permanentUpgrades.explosive) ||
    (weapon === "ally" && !permanentUpgrades.ally)
  ) return;
  const symbols = { bullet: "B", magic: "M", spear: "S", laser: "L", explosive: "E", ally: "A" };
  const design = {
    id: nextDesignId,
    name,
    weapon,
    cost,
    budgetMultiplier,
    range: ranges[rangeType].distance,
    damage: Math.max(1, Math.round(
      weapons[weapon].damage * ranges[rangeType].damageMultiplier * budgetMultiplier,
    )),
    interval: weapons[weapon].interval,
    color,
    symbol: symbols[weapon],
  };
  if (weapon === "ally") design.maxEnemyHits = ranges[rangeType].allyHitLimit;
  selectMode = false;
  selectedTower = null;
  updateModeControls();
  nextDesignId += 1;
  towerDesigns.push(design);
  selectedDesignId = design.id;
  towerForm.reset();
  message.textContent = `${name} created. Click an open spot on the map to place it for $${getTowerCost(design)}.`;
  renderTowerList();
  saveGameState();
});

canvas.addEventListener("pointermove", (event) => {
  pointer = getCanvasPoint(event);
  hoveredTower = [...towers].reverse().find((tower) => Math.hypot(pointer.x - tower.x, pointer.y - tower.y) < 16) ?? null;
});

canvas.addEventListener("pointerleave", () => {
  pointer = null;
  hoveredTower = null;
});

canvas.addEventListener("click", (event) => {
  const point = getCanvasPoint(event);
  const clickedTower = getTowerAtPoint(point);
  if (deleteMode) {
    if (!clickedTower) {
      message.textContent = "Click on a placed tower to delete it.";
      return;
    }

    const towerIndex = towers.indexOf(clickedTower);
    const [removedTower] = towers.splice(towerIndex, 1);
    if (selectedTower === removedTower) selectedTower = null;
    const refund = Math.floor((removedTower.paidCost ?? removedTower.cost) / 2);
    cash += refund;
    message.textContent = `${removedTower.name} removed from the map. Refunded $${refund}.`;
    renderTowerList();
    updateHud();
    saveGameState();
    return;
  }

  if (clickedTower) {
    openTowerUpgradeMenu(clickedTower);
    return;
  }
  if (selectMode) {
    message.textContent = "Select mode is on. Click a placed tower to open its upgrades, or turn it off to place a tower.";
    return;
  }

  const design = getSelectedDesign();
  if (!design) {
    message.textContent = "Create and select a tower before placing one.";
    return;
  }
  if (design.weapon === "ally" && !permanentUpgrades.ally) {
    message.textContent = "Unlock the Ally weapon with 2,000 coins first.";
    return;
  }

  const placementCost = getTowerCost(design);
  if (cash < placementCost) {
    message.textContent = `You need $${placementCost} to place ${design.name}.`;
    return;
  }
  if (!isValidPlacement(point)) {
    message.textContent = "That spot is blocked. Place towers off the path and at least 25 pixels from other towers.";
    return;
  }

  towers.push({ ...design, designId: design.id, paidCost: placementCost, x: point.x, y: point.y, cooldown: 0 });
  cash -= placementCost;
  message.textContent = `${design.name} placed. Select another design or start the next wave.`;
  renderTowerList();
  updateHud();
  saveGameState();
});

startWaveButton.addEventListener("click", startWave);
autoStartWavesCheckbox.addEventListener("change", () => {
  autoStartWaves = autoStartWavesCheckbox.checked;
  if (autoStartWaves && !waveActive && !gameOver) {
    startWave();
  } else {
    updateHud();
    saveGameState();
  }
});
deleteModeButton.addEventListener("click", () => {
  deleteMode = !deleteMode;
  if (deleteMode) {
    selectMode = false;
    selectedTower = null;
    renderTowerList();
  }
  updateModeControls();
  message.textContent = deleteMode
    ? "Delete mode is on. Click a placed tower to remove it and refund half its cost."
    : "Delete mode is off. Select a tower design to place it.";
});
selectModeButton.addEventListener("click", () => {
  selectMode = !selectMode;
  if (selectMode) {
    deleteMode = false;
    selectedDesignId = null;
    selectedTower = null;
  }
  updateModeControls();
  renderTowerList();
  message.textContent = selectMode
    ? "Select mode is on. Click a placed tower to open its upgrades."
    : "Select mode is off. Select a tower design to place it.";
  saveGameState();
});
restartButton.addEventListener("click", () => {
  cash = 500;
  lives = 1;
  wave = 0;
  waveActive = false;
  gameOver = false;
  spawnRemaining = 0;
  spawnTimer = 0;
  enemies = [];
  allies = [];
  towers = [];
  nextEnemyId = 1;
  effects = [];
  saveGameState();
  window.location.reload();
});
resetProgressButton.addEventListener("click", () => {
  if (!window.confirm("Reset all game progress? This permanently deletes your towers, coins, upgrades, and wave progress.")) {
    return;
  }

  try {
    window.localStorage.removeItem(saveKey);
  } catch (error) {
    reportPersistenceFailure("reset", error);
    return;
  }
  persistenceDisabled = true;
  window.location.reload();
});

if (restoreGameState()) {
  message.textContent = gameOver
    ? "Saved game restored. This game is over."
    : waveActive
      ? `Saved game restored. Wave ${wave} is in progress.`
      : "Saved game restored.";
}
updateWeaponOptions();
updateModeControls();
renderTowerList();
updateHud();
if (autoStartWaves && !waveActive && !gameOver) startWave();
saveGameState();
window.addEventListener("pagehide", saveGameState);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveGameState();
});
window.addEventListener("pageshow", (event) => {
  if (!event.persisted || !restoreGameState()) return;
  updateWeaponOptions();
  renderTowerList();
  updateHud();
  if (autoStartWaves && !waveActive && !gameOver) startWave();
  message.textContent = "Saved game restored.";
});
window.addEventListener("storage", (event) => {
  if (event.key !== saveKey) return;
  if (event.newValue === null) {
    persistenceDisabled = true;
    window.location.reload();
    return;
  }
  if (!restoreGameState()) return;
  updateWeaponOptions();
  renderTowerList();
  updateHud();
  if (autoStartWaves && !waveActive && !gameOver) startWave();
});
requestAnimationFrame(frame);
