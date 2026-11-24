const gameSaveKey = "bestTdGameState";
const defaultUpgrades = {
  coinIncome: false,
  costDiscount: false,
  laser: false,
  explosive: false,
  ally: false,
  cashBoost: false,
  tier2TowerUpgrades: false,
};
const upgradePrices = {
  coinIncome: 100,
  costDiscount: 500,
  laser: 1000,
  explosive: 1500,
  ally: 2000,
  cashBoost: 3000,
  tier2TowerUpgrades: 5000,
};
const upgradePrerequisites = {
  costDiscount: "coinIncome",
  laser: "costDiscount",
  explosive: "laser",
  ally: "explosive",
  cashBoost: "ally",
  tier2TowerUpgrades: "cashBoost",
};
const upgradeNames = {
  coinIncome: "Increased Coin Income",
  costDiscount: "5% Tower Discount",
  laser: "Laser Weapon",
  explosive: "Explosive Weapon",
  ally: "Ally Weapon",
  cashBoost: "Cash Boost",
  tier2TowerUpgrades: "Tier 2 Tower Upgrades",
};
const statusIds = {
  coinIncome: "coinIncomeStatus",
  costDiscount: "discountStatus",
  laser: "laserStatus",
  explosive: "explosiveStatus",
  ally: "allyStatus",
  cashBoost: "cashBoostStatus",
  tier2TowerUpgrades: "tier2TowerUpgradesStatus",
};
const coinsDisplay = document.querySelector("#availableCoins");
const message = document.querySelector("#upgradeMessage");
let gameState = null;

function hasOwn(object, property) {
  return Object.prototype.hasOwnProperty.call(object, property);
}

function createNewGameState() {
  return {
    version: 1,
    cash: 500,
    coins: 0,
    lives: 1,
    wave: 0,
    waveActive: false,
    gameOver: false,
    spawnRemaining: 0,
    spawnTimer: 0,
    towerDesigns: [],
    towers: [],
    enemies: [],
    selectedDesignId: null,
    nextDesignId: 1,
    permanentUpgrades: { ...defaultUpgrades },
  };
}

function readGameState() {
  const savedText = window.localStorage.getItem(gameSaveKey);
  if (savedText === null) return createNewGameState();

  const savedState = JSON.parse(savedText);
  if (
    savedState === null ||
    typeof savedState !== "object" ||
    savedState.version !== 1 ||
    !Number.isFinite(savedState.cash) ||
    savedState.cash < 0 ||
    (savedState.coins !== undefined && (!Number.isInteger(savedState.coins) || savedState.coins < 0))
  ) {
    throw new Error("Saved game data is invalid.");
  }

  if (savedState.coins === undefined || savedState.coins === null) savedState.coins = 0;
  const upgrades = savedState.permanentUpgrades ?? defaultUpgrades;
  for (const [id, value] of Object.entries(upgrades)) {
    if (!hasOwn(defaultUpgrades, id) || typeof value !== "boolean") {
      throw new Error("Saved permanent upgrade data is invalid.");
    }
  }
  savedState.permanentUpgrades = { ...defaultUpgrades, ...upgrades };
  return savedState;
}

function updateShop() {
  coinsDisplay.textContent = gameState ? String(gameState.coins) : "Unavailable";

  for (const [id, price] of Object.entries(upgradePrices)) {
    const owned = gameState?.permanentUpgrades[id] === true;
    const prerequisite = upgradePrerequisites[id];
    const prerequisiteMissing = prerequisite && gameState?.permanentUpgrades[prerequisite] !== true;
    document.querySelector(`#${statusIds[id]}`).textContent = owned
      ? "Owned"
      : prerequisiteMissing
        ? `Not owned · requires ${upgradeNames[prerequisite]}`
        : "Not owned";
    const button = document.querySelector(`[data-upgrade="${id}"]`);
    button.disabled = !gameState || owned || prerequisiteMissing || gameState.coins < price;
    button.textContent = owned ? "Owned" : `Purchase for ${price.toLocaleString()} coins`;
  }
}

function reportSaveError(error) {
  console.error("Unable to load or save permanent upgrades.", error);
  gameState = null;
  message.textContent = "Could not access the saved game. Purchases are unavailable; see the console for details.";
  updateShop();
}

function loadGameState(persist = false) {
  try {
    gameState = readGameState();
    if (persist) {
      window.localStorage.setItem(gameSaveKey, JSON.stringify(gameState));
      message.textContent = "Upgrades are saved automatically when purchased.";
    }
    updateShop();
  } catch (error) {
    reportSaveError(error);
  }
}

function purchaseUpgrade(id) {
  if (!gameState) return;

  const price = upgradePrices[id];
  if (gameState.permanentUpgrades[id]) {
    message.textContent = `${upgradeNames[id]} is already owned.`;
    return;
  }
  const prerequisite = upgradePrerequisites[id];
  if (prerequisite && !gameState.permanentUpgrades[prerequisite]) {
    message.textContent = `Purchase ${upgradeNames[prerequisite]} before ${upgradeNames[id]}.`;
    return;
  }
  if (gameState.coins < price) {
    message.textContent = `You need ${price.toLocaleString()} coins to buy ${upgradeNames[id]}.`;
    return;
  }

  const updatedState = {
    ...gameState,
    coins: gameState.coins - price,
    permanentUpgrades: {
      ...gameState.permanentUpgrades,
      [id]: true,
    },
  };
  try {
    window.localStorage.setItem(gameSaveKey, JSON.stringify(updatedState));
    gameState = updatedState;
    message.textContent = `${upgradeNames[id]} purchased and saved.`;
    updateShop();
  } catch (error) {
    reportSaveError(error);
  }
}

for (const button of document.querySelectorAll("[data-upgrade]")) {
  button.addEventListener("click", () => purchaseUpgrade(button.dataset.upgrade));
}

window.addEventListener("storage", (event) => {
  if (event.key !== gameSaveKey) return;

  const previousUpgrades = gameState?.permanentUpgrades;
  loadGameState(false);
  if (
    gameState &&
    previousUpgrades &&
    Object.keys(defaultUpgrades).some((id) => previousUpgrades[id] !== gameState.permanentUpgrades[id])
  ) {
    message.textContent = "Permanent upgrades were updated in another tab.";
  }
});

loadGameState(true);
