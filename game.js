const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
resize();

// Game constants
const GRAVITY = 0.8;
const JUMP_FORCE = -12;
const COYOTE_TIME = 5; // Frames allowed to jump after leaving ledge
const BUFFER_TIME = 5; // Frames jump input is remembered before landing
const GROUND_HEIGHT = 100;
const CEILING_HEIGHT = 100;
const PLAYER_SIZE = 40;
const ROTATION_SPEED = 0.15;
let currentSpeed = 9.0;

const MODES = {
    CUBE: 'cube',
    SHIP: 'ship',
    BALL: 'ball',
    UFO: 'ufo',
    WAVE: 'wave'
};

// 10+ Skins Definition
const SKINS = [
    {
        id: 'default_cyan',
        name: 'Cyber Cyan',
        color: '#00ffff',
        secondaryColor: '#0088cc',
        price: 0,
        sparkType: 'cyan_sparks',
        pattern: 'classic',
        desc: 'The original cyber cube.'
    },
    {
        id: 'fire_demon',
        name: 'Inferno Demon',
        color: '#ff2a2a',
        secondaryColor: '#ffaa00',
        price: 15,
        sparkType: 'fire_trail',
        pattern: 'stripes',
        desc: 'Blazes with demonic hellfire.'
    },
    {
        id: 'golden_god',
        name: 'Midas Touch',
        color: '#ffd700',
        secondaryColor: '#ffffff',
        price: 30,
        sparkType: 'gold_sparkle',
        pattern: 'diamond',
        desc: 'Pure solid gold prestige.'
    },
    {
        id: 'shadow_ninja',
        name: 'Void Shadow',
        color: '#8000ff',
        secondaryColor: '#ff00ff',
        price: 10,
        sparkType: 'shadow_smoke',
        pattern: 'ninja',
        desc: 'Forged in dark purple nebula.'
    },
    {
        id: 'electric_blue',
        name: 'Plasma Storm',
        color: '#0066ff',
        secondaryColor: '#00ffff',
        price: 20,
        sparkType: 'electric_sparks',
        pattern: 'circuit',
        desc: 'High-voltage electric discharges.'
    },
    {
        id: 'toxic_slime',
        name: 'Acid Slime',
        color: '#39ff14',
        secondaryColor: '#ccff00',
        price: 15,
        sparkType: 'bubble_pop',
        pattern: 'hazmat',
        desc: 'Radioactive green glow.'
    },
    {
        id: 'starlight',
        name: 'Cosmic Nova',
        color: '#ffffff',
        secondaryColor: '#ff7700',
        price: 25,
        sparkType: 'star_dust',
        pattern: 'star',
        desc: 'Sparkles like distant supernovae.'
    },
    {
        id: 'emerald_gem',
        name: 'Emerald Core',
        color: '#00ff88',
        secondaryColor: '#006633',
        price: 18,
        sparkType: 'emerald_shine',
        pattern: 'grid',
        desc: 'Crystalline green precision.'
    },
    {
        id: 'rainbow_prisim',
        name: 'Prism Overdrive',
        color: '#ff00ff',
        secondaryColor: '#00ffff',
        price: 50,
        sparkType: 'rainbow_glow',
        pattern: 'cross',
        desc: 'Shifts through the full spectral color matrix.'
    },
    {
        id: 'cyber_pink',
        name: 'Neon Magenta',
        color: '#ff00a0',
        secondaryColor: '#7900ff',
        price: 12,
        sparkType: 'neon_magenta',
        pattern: 'dots',
        desc: 'Vibrant underground synthwave vibe.'
    }
];

// Level Configurations
const LEVEL_CONFIGS = [
    {
        id: 0,
        title: 'CYBER RAVE',
        difficulty: 'INSANE',
        speed: 9.0,
        audioSrc: 'techno_level1.wav',
        playerColor: '#00ffff',
        bgHueOffset: 180,
        initialMode: MODES.CUBE,
        builder: buildLevel1
    },
    {
        id: 1,
        title: 'ACID DISTRICT',
        difficulty: 'DEMON',
        speed: 10.5,
        audioSrc: 'techno_level2.wav',
        playerColor: '#aaff00',
        bgHueOffset: 80,
        initialMode: MODES.BALL,
        builder: buildLevel2
    },
    {
        id: 2,
        title: 'INDUSTRIAL HELL',
        difficulty: 'EXTREME DEMON',
        speed: 12.0,
        audioSrc: 'techno_level3.wav',
        playerColor: '#ff2255',
        bgHueOffset: 340,
        initialMode: MODES.WAVE,
        builder: buildLevel3
    }
];

let currentLevelIdx = 0;
let levelBestScores = [0, 0, 0];

// Economy & Unlock Storage
let userCoins = parseInt(localStorage.getItem('gd_coins') || '0', 10);
let unlockedSkins = JSON.parse(localStorage.getItem('gd_unlocked_skins') || '["default_cyan"]');
let equippedSkinId = localStorage.getItem('gd_equipped_skin') || 'default_cyan';
let isDarkTheme = localStorage.getItem('gd_theme') !== 'light';

// Audio setup
let bgMusic = new Audio(LEVEL_CONFIGS[0].audioSrc);
bgMusic.loop = true;
bgMusic.volume = 0.6;

// Game State
let gameState = 'LOBBY'; // LOBBY, PLAYING, DEAD
let attempts = 1;
let botMode = false; // BOT for testing

let player = {
    x: 150,
    y: 400,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    velocityY: 0,
    isGrounded: true,
    coyoteCounter: 0,
    jumpBufferCounter: 0,
    rotation: 0,
    gravityDir: 1,
    color: '#00ffff',
    trail: [],
    mode: MODES.CUBE
};

let obstacles = [];
let transitions = [];
let gameDistance = 0;
let totalLevelLength = 50200;
let levelCoinsCollectedInRun = 0;
let particles = [];
let screenShake = 0;
let deathFlash = 0;
let transitionFlash = 0;

let modeBannerText = '';
let modeBannerColor = '#ffffff';
let modeBannerTimer = 0;

const MODE_INFO = {
    [MODES.CUBE]: { name: 'CUBE MODE', icon: '🟩', color: '#00ff66' },
    [MODES.SHIP]: { name: 'SHIP MODE', icon: '🚀', color: '#ff00aa' },
    [MODES.BALL]: { name: 'BALL MODE', icon: '⚽', color: '#ff2222' },
    [MODES.UFO]: { name: 'UFO MODE', icon: '🛸', color: '#ffaa00' },
    [MODES.WAVE]: { name: 'WAVE MODE', icon: '⚡', color: '#00f0ff' }
};

// Input
let jumpPressed = false;
let jumpProcessed = false;

function blurActiveElement() {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }
}

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (gameState === 'PLAYING') {
            jumpPressed = true;
        }
    } else if (e.code === 'KeyB') {
        botMode = !botMode;
    } else if (e.code === 'Escape') {
        returnToLobby();
    }
});
window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jumpPressed = false;
        jumpProcessed = false;
    }
});

window.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'CANVAS') {
        if (gameState === 'PLAYING') {
            jumpPressed = true;
        }
    }
});
window.addEventListener('mouseup', () => {
    jumpPressed = false;
    jumpProcessed = false;
});

// UI Event Handling Setup
function initUI() {
    updateCoinDisplays();
    updateThemeUI();

    document.getElementById('themeToggleBtn').addEventListener('click', () => {
        blurActiveElement();
        isDarkTheme = !isDarkTheme;
        localStorage.setItem('gd_theme', isDarkTheme ? 'dark' : 'light');
        updateThemeUI();
    });

    document.getElementById('openShopBtn').addEventListener('click', () => {
        blurActiveElement();
        openShop();
    });
    document.getElementById('closeShopBtn').addEventListener('click', () => {
        blurActiveElement();
        closeShop();
    });

    // Initial Best Scores
    LEVEL_CONFIGS.forEach((cfg, idx) => {
        let best = localStorage.getItem(`gd_best_level_${idx}`) || '0';
        levelBestScores[idx] = parseInt(best, 10);
        updateLevelProgressUI(idx, levelBestScores[idx]);
    });

    renderSkinShopGrid();
}

function updateThemeUI() {
    if (isDarkTheme) {
        document.body.classList.remove('theme-light');
        document.body.classList.add('theme-dark');
        document.getElementById('themeIcon').textContent = '☀️';
        document.getElementById('themeLabel').textContent = 'Light';
    } else {
        document.body.classList.remove('theme-dark');
        document.body.classList.add('theme-light');
        document.getElementById('themeIcon').textContent = '🌙';
        document.getElementById('themeLabel').textContent = 'Dark';
    }
}

function updateCoinDisplays() {
    document.getElementById('lobbyCoinCount').textContent = userCoins;
    document.getElementById('shopCoinCount').textContent = userCoins;
    document.getElementById('hudCoinCount').textContent = levelCoinsCollectedInRun;
    localStorage.setItem('gd_coins', userCoins.toString());
}

function updateLevelProgressUI(idx, percent) {
    const fillEl = document.getElementById(`progress-${idx}`);
    const bestEl = document.getElementById(`best-${idx}`);
    if (fillEl) fillEl.style.width = `${percent}%`;
    if (bestEl) bestEl.textContent = `Best: ${percent}%`;
}

function openShop() {
    document.getElementById('shopModal').classList.remove('hidden');
    renderSkinShopGrid();
}

function closeShop() {
    document.getElementById('shopModal').classList.add('hidden');
}

function getEquippedSkinObj() {
    return SKINS.find(s => s.id === equippedSkinId) || SKINS[0];
}

function renderSkinShopGrid() {
    const grid = document.getElementById('skinGrid');
    if (!grid) return;
    grid.innerHTML = '';

    SKINS.forEach(skin => {
        const isUnlocked = unlockedSkins.includes(skin.id);
        const isEquipped = skin.id === equippedSkinId;

        const card = document.createElement('div');
        card.className = `skin-card ${isEquipped ? 'selected' : ''}`;

        card.innerHTML = `
            <div class="skin-preview-swatch" style="background: linear-gradient(135deg, ${skin.color}, ${skin.secondaryColor});"></div>
            <div class="skin-name">${skin.name}</div>
            <div class="skin-price">${isUnlocked ? 'UNLOCKED' : `🪙 ${skin.price}`}</div>
            <button class="btn-skin-action ${isEquipped ? 'btn-equipped' : isUnlocked ? 'btn-equip' : 'btn-buy'}">
                ${isEquipped ? 'EQUIPPED' : isUnlocked ? 'EQUIP' : 'BUY'}
            </button>
        `;

        const actionBtn = card.querySelector('.btn-skin-action');
        actionBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            blurActiveElement();
            if (isUnlocked) {
                equippedSkinId = skin.id;
                localStorage.setItem('gd_equipped_skin', skin.id);
                renderSkinShopGrid();
                updatePreviewBadge();
            } else if (userCoins >= skin.price) {
                userCoins -= skin.price;
                unlockedSkins.push(skin.id);
                equippedSkinId = skin.id;
                localStorage.setItem('gd_unlocked_skins', JSON.stringify(unlockedSkins));
                localStorage.setItem('gd_equipped_skin', skin.id);
                updateCoinDisplays();
                renderSkinShopGrid();
                updatePreviewBadge();
            } else {
                alert('Not enough coins to buy this skin!');
            }
        });

        grid.appendChild(card);
    });

    updatePreviewBadge();
}

function updatePreviewBadge() {
    const skin = getEquippedSkinObj();
    const badge = document.getElementById('selectedSkinBadge');
    const desc = document.getElementById('skinDescText');
    if (badge) {
        badge.textContent = skin.name.toUpperCase();
        badge.style.color = skin.color;
        badge.style.borderColor = skin.color;
    }
    if (desc) desc.textContent = skin.desc;
}

// Select level from lobby
function selectLevel(idx) {
    blurActiveElement();
    currentLevelIdx = idx;
    const config = LEVEL_CONFIGS[currentLevelIdx];
    currentSpeed = config.speed;

    bgMusic.pause();
    bgMusic = new Audio(config.audioSrc);
    bgMusic.loop = true;
    bgMusic.volume = 0.6;

    document.getElementById('lobbyOverlay').classList.add('hidden');
    document.getElementById('hudOverlay').classList.remove('hidden');

    resetGame();
    gameState = 'PLAYING';
    bgMusic.play().catch(() => {});
}

function returnToLobby() {
    blurActiveElement();
    bgMusic.pause();
    gameState = 'LOBBY';
    document.getElementById('lobbyOverlay').classList.remove('hidden');
    document.getElementById('hudOverlay').classList.add('hidden');
    updateCoinDisplays();
}

function resetGame() {
    const config = LEVEL_CONFIGS[currentLevelIdx];
    currentSpeed = config.speed;

    player.x = 150;
    player.y = canvas.height - GROUND_HEIGHT - PLAYER_SIZE;
    player.velocityY = 0;
    player.isGrounded = true;
    player.coyoteCounter = 0;
    player.jumpBufferCounter = 0;
    player.rotation = 0;
    player.gravityDir = 1;
    player.mode = config.initialMode;
    player.trail = [];

    const equippedSkin = getEquippedSkinObj();
    player.color = equippedSkin.color;

    obstacles = [];
    transitions = [];
    gameDistance = 0;
    levelCoinsCollectedInRun = 0;
    updateCoinDisplays();

    // Call level builder
    config.builder();
}

// LEVEL BUILDERS
function buildLevel1() {
    totalLevelLength = 50200;
    let curX = 1200;

    // Part 1: Cube - Rhythmic Intro
    obstacles.push(new Obstacle('spike', curX + 300));
    obstacles.push(new Obstacle('spike', curX + 800));
    obstacles.push(new Obstacle('block', curX + 1300, 1, 2.5));
    obstacles.push(new Obstacle('block', curX + 1400, 2, 2.5));
    obstacles.push(new Obstacle('spike', curX + 1800));
    obstacles.push(new Obstacle('yellow_ring', curX + 2200, 2.5));
    obstacles.push(new Obstacle('block', curX + 2400, 2.5, 3));
    obstacles.push(new Obstacle('spike', curX + 2900));
    obstacles.push(new Obstacle('spike', curX + 3300));
    curX += 3800;

    // Part 2: Cube - Pads & Orbs Verticality
    obstacles.push(new Obstacle('yellow_pad', curX + 300, 1));
    obstacles.push(new Obstacle('block', curX + 700, 3.5, 3));
    obstacles.push(new Obstacle('yellow_ring', curX + 1000, 3.5));
    obstacles.push(new Obstacle('block', curX + 1300, 5.5, 3));
    obstacles.push(new Obstacle('yellow_ring', curX + 1600, 5.5));
    obstacles.push(new Obstacle('block', curX + 1900, 7.5, 3));
    obstacles.push(new Obstacle('spike', curX + 2300));
    curX += 2900;

    // Transition to Ship
    transitions.push({ distance: curX, mode: MODES.SHIP });
    curX += 1000;

    // Part 3: Ship - Cavern
    for (let i = 0; i < 10; i++) {
        let yCenterUnits = 3.5 + Math.sin(i * 0.6) * 1.5;
        let gapTop = yCenterUnits + 2.5;
        let gapBottom = Math.max(0, yCenterUnits - 2.5);

        if (gapBottom > 0) {
            obstacles.push(new Obstacle('block', curX + i * 850, gapBottom, 3.75));
        }
        let topHeight = Math.max(0, 12 - gapTop);
        if (topHeight > 0) {
            obstacles.push(new Obstacle('block', curX + i * 850, topHeight, 3.75, false, true));
        }
        if (i % 2 === 1) {
            obstacles.push(new Obstacle('coin', curX + i * 850 + 200, yCenterUnits));
        }
    }
    curX += 8800;

    // Transition to Ball
    transitions.push({ distance: curX, mode: MODES.BALL });
    curX += 1000;

    // Part 4: Ball - Gravity Corridors
    for (let i = 0; i < 8; i++) {
        let isFloor = (i % 2 === 0);
        if (isFloor) {
            obstacles.push(new Obstacle('spike', curX + i * 1100 + 300));
            obstacles.push(new Obstacle('block', curX + i * 1100 + 800, 1.25, 3.75, false, true));
        } else {
            obstacles.push(new Obstacle('spike', curX + i * 1100 + 300, 1, 1, false, true));
            obstacles.push(new Obstacle('block', curX + i * 1100 + 800, 1.25, 3.75));
        }
        if (i % 3 === 0) {
            obstacles.push(new Obstacle('coin', curX + i * 1100 + 550, 4.5));
        }
    }
    curX += 9200;

    // Transition to UFO
    transitions.push({ distance: curX, mode: MODES.UFO });
    curX += 1000;

    // Part 5: UFO - Rhythmic Bounces
    for (let i = 0; i < 8; i++) {
        obstacles.push(new Obstacle('spike', curX + i * 900));
        obstacles.push(new Obstacle('block', curX + i * 900 + 300, 3.75, 3));
        obstacles.push(new Obstacle('spike', curX + i * 900 + 600));
        obstacles.push(new Obstacle('spike', curX + i * 900 + 600, 1, 1, false, true));
        obstacles.push(new Obstacle('yellow_ring', curX + i * 900 + 750, 4));
    }
    curX += 7600;

    // Transition to Wave
    transitions.push({ distance: curX, mode: MODES.WAVE });
    curX += 1000;

    // Part 6: Wave - Open Slalom
    for (let i = 0; i < 10; i++) {
        let isTop = (i % 2 === 0);
        if (isTop) {
            obstacles.push(new Obstacle('block', curX + i * 850, 4.5, 6.25));
            obstacles.push(new Obstacle('spike', curX + i * 850 + 500));
        } else {
            obstacles.push(new Obstacle('block', curX + i * 850, 4.5, 6.25, false, true));
            obstacles.push(new Obstacle('spike', curX + i * 850 + 500, 1, 1, false, true));
        }
    }
    curX += 8800;

    // Transition back to Cube - Final Sprint
    transitions.push({ distance: curX, mode: MODES.CUBE });
    curX += 1000;
    obstacles.push(new Obstacle('yellow_pad', curX + 300, 1));
    obstacles.push(new Obstacle('yellow_pad', curX + 800, 1));
    obstacles.push(new Obstacle('yellow_pad', curX + 1300, 1));
    obstacles.push(new Obstacle('yellow_ring', curX + 1700, 3.5));
    obstacles.push(new Obstacle('yellow_ring', curX + 2100, 3.5));
    obstacles.push(new Obstacle('spike', curX + 2500));
    obstacles.push(new Obstacle('spike', curX + 2900));
    curX += 3400;
}

function buildLevel2() {
    totalLevelLength = 50200;
    let curX = 1200;

    // Part 1: Ball
    for (let i = 0; i < 6; i++) {
        let isFloor = (i % 2 === 0);
        if (isFloor) {
            obstacles.push(new Obstacle('spike', curX + i * 1100 + 300));
            obstacles.push(new Obstacle('block', curX + i * 1100 + 800, 1.25, 3.75, false, true));
        } else {
            obstacles.push(new Obstacle('spike', curX + i * 1100 + 300, 1, 1, false, true));
            obstacles.push(new Obstacle('block', curX + i * 1100 + 800, 1.25, 3.75));
        }
    }
    curX += 7000;

    // Transition to Cube
    transitions.push({ distance: curX, mode: MODES.CUBE });
    curX += 1000;

    // Part 2: Cube
    obstacles.push(new Obstacle('yellow_pad', curX + 300, 1));
    obstacles.push(new Obstacle('block', curX + 700, 3.5, 3));
    obstacles.push(new Obstacle('yellow_ring', curX + 1000, 3.5));
    obstacles.push(new Obstacle('block', curX + 1300, 5.5, 3));
    curX += 6000;

    // Transition to Wave
    transitions.push({ distance: curX, mode: MODES.WAVE });
    curX += 1000;

    // Part 3: Wave
    for (let i = 0; i < 10; i++) {
        let isTop = (i % 2 === 0);
        if (isTop) {
            obstacles.push(new Obstacle('block', curX + i * 850, 4.5, 6.25));
        } else {
            obstacles.push(new Obstacle('block', curX + i * 850, 4.5, 6.25, false, true));
        }
    }
    curX += 9000;

    // Transition to Ship
    transitions.push({ distance: curX, mode: MODES.SHIP });
    curX += 1000;

    // Part 4: Ship
    for (let i = 0; i < 10; i++) {
        let yCenterUnits = 3.5 + Math.sin(i * 0.6) * 1.5;
        let gapTop = yCenterUnits + 2.5;
        let gapBottom = Math.max(0, yCenterUnits - 2.5);

        if (gapBottom > 0) {
            obstacles.push(new Obstacle('block', curX + i * 850, gapBottom, 3.75));
        }
        let topHeight = Math.max(0, 12 - gapTop);
        if (topHeight > 0) {
            obstacles.push(new Obstacle('block', curX + i * 850, topHeight, 3.75, false, true));
        }
    }
    curX += 9000;

    // Transition to UFO
    transitions.push({ distance: curX, mode: MODES.UFO });
    curX += 1000;

    // Part 5: UFO
    for (let i = 0; i < 8; i++) {
        obstacles.push(new Obstacle('spike', curX + i * 900));
        obstacles.push(new Obstacle('block', curX + i * 900 + 300, 3.75, 3));
        obstacles.push(new Obstacle('yellow_ring', curX + i * 900 + 750, 4));
    }
    curX += 8000;

    // Transition to Cube
    transitions.push({ distance: curX, mode: MODES.CUBE });
    curX += 1000;
    obstacles.push(new Obstacle('yellow_pad', curX + 300, 1));
    obstacles.push(new Obstacle('yellow_pad', curX + 800, 1));
    obstacles.push(new Obstacle('spike', curX + 1300));
}

function buildLevel3() {
    totalLevelLength = 50200;
    let curX = 1200;

    // Part 1: Wave
    for (let i = 0; i < 10; i++) {
        let isTop = (i % 2 === 0);
        if (isTop) {
            obstacles.push(new Obstacle('block', curX + i * 850, 4.5, 6.25));
        } else {
            obstacles.push(new Obstacle('block', curX + i * 850, 4.5, 6.25, false, true));
        }
    }
    curX += 9000;

    // Transition to UFO
    transitions.push({ distance: curX, mode: MODES.UFO });
    curX += 1000;

    // Part 2: UFO
    for (let i = 0; i < 8; i++) {
        obstacles.push(new Obstacle('spike', curX + i * 900));
        obstacles.push(new Obstacle('block', curX + i * 900 + 300, 3.75, 3));
        obstacles.push(new Obstacle('yellow_ring', curX + i * 900 + 750, 4));
    }
    curX += 8000;

    // Transition to Ship
    transitions.push({ distance: curX, mode: MODES.SHIP });
    curX += 1000;

    // Part 3: Ship
    for (let i = 0; i < 10; i++) {
        let yCenterUnits = 3.5 + Math.sin(i * 0.6) * 1.5;
        let gapTop = yCenterUnits + 2.5;
        let gapBottom = Math.max(0, yCenterUnits - 2.5);

        if (gapBottom > 0) {
            obstacles.push(new Obstacle('block', curX + i * 850, gapBottom, 3.75));
        }
        let topHeight = Math.max(0, 12 - gapTop);
        if (topHeight > 0) {
            obstacles.push(new Obstacle('block', curX + i * 850, topHeight, 3.75, false, true));
        }
    }
    curX += 9000;

    // Transition to Ball
    transitions.push({ distance: curX, mode: MODES.BALL });
    curX += 1000;

    // Part 4: Ball
    for (let i = 0; i < 6; i++) {
        let isFloor = (i % 2 === 0);
        if (isFloor) {
            obstacles.push(new Obstacle('spike', curX + i * 1100 + 300));
            obstacles.push(new Obstacle('block', curX + i * 1100 + 800, 1.25, 3.75, false, true));
        } else {
            obstacles.push(new Obstacle('spike', curX + i * 1100 + 300, 1, 1, false, true));
            obstacles.push(new Obstacle('block', curX + i * 1100 + 800, 1.25, 3.75));
        }
    }
    curX += 7000;

    // Transition to Cube
    transitions.push({ distance: curX, mode: MODES.CUBE });
    curX += 1000;

    // Part 5: Cube
    obstacles.push(new Obstacle('yellow_pad', curX + 300, 1));
    obstacles.push(new Obstacle('yellow_pad', curX + 800, 1));
    obstacles.push(new Obstacle('yellow_ring', curX + 1300, 3.5));
    obstacles.push(new Obstacle('spike', curX + 1800));
}

// Obstacle Constructor Class
class Obstacle {
    constructor(type, x, heightUnits = 1, widthUnits = 1, onTop = false, ceiling = false) {
        this.type = type; // 'spike', 'block', 'yellow_pad', 'yellow_ring', 'coin'
        this.x = x;
        this.heightUnits = heightUnits;
        this.widthUnits = widthUnits;
        this.width = widthUnits * 40;
        this.height = heightUnits * 40;
        this.ceiling = ceiling;
        this.collected = false;

        if (this.ceiling) {
            this.y = CEILING_HEIGHT;
        } else if (onTop) {
            this.y = canvas.height - GROUND_HEIGHT - (heightUnits * 40) - 40;
        } else {
            this.y = canvas.height - GROUND_HEIGHT - (heightUnits * 40);
        }

        if (this.type === 'yellow_ring') {
            this.y = canvas.height - GROUND_HEIGHT - (heightUnits * 40);
            this.width = 30;
            this.height = 30;
        } else if (this.type === 'yellow_pad') {
            this.height = 10;
            this.y = canvas.height - GROUND_HEIGHT - 10;
        } else if (this.type === 'coin') {
            this.width = 30;
            this.height = 30;
            this.y = canvas.height - GROUND_HEIGHT - (heightUnits * 40);
        }
    }

    draw(screenX) {
        if (this.collected) return;

        if (this.type === 'spike') {
            ctx.fillStyle = '#ff0055';
            ctx.shadowColor = '#ff0055';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            if (this.ceiling) {
                ctx.moveTo(screenX, this.y);
                ctx.lineTo(screenX + this.width / 2, this.y + this.height);
                ctx.lineTo(screenX + this.width, this.y);
            } else {
                ctx.moveTo(screenX, this.y + this.height);
                ctx.lineTo(screenX + this.width / 2, this.y);
                ctx.lineTo(screenX + this.width, this.y + this.height);
            }
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
        } else if (this.type === 'block') {
            ctx.fillStyle = '#111827';
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 2;
            ctx.fillRect(screenX, this.y, this.width, this.height);
            ctx.strokeRect(screenX, this.y, this.width, this.height);
        } else if (this.type === 'yellow_pad') {
            ctx.fillStyle = '#ffd700';
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 12;
            ctx.fillRect(screenX, this.y, this.width, this.height);
            ctx.shadowBlur = 0;
        } else if (this.type === 'yellow_ring') {
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 4;
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(screenX + 15, this.y + 15, 12, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        } else if (this.type === 'coin') {
            ctx.fillStyle = '#ffd700';
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(screenX + 15, this.y + 15, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.font = 'bold 12px Outfit';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', screenX + 15, this.y + 15);
            ctx.shadowBlur = 0;
        }
    }

    checkCollision(p, screenX) {
        if (this.collected) return false;

        const pBox = { x: p.x, y: p.y, width: p.width, height: p.height };
        const oBox = { x: screenX, y: this.y, width: this.width, height: this.height };

        if (this.type === 'coin') {
            if (pBox.x < oBox.x + oBox.width &&
                pBox.x + pBox.width > oBox.x &&
                pBox.y < oBox.y + oBox.height &&
                pBox.y + pBox.height > oBox.y) {
                this.collected = true;
                levelCoinsCollectedInRun++;
                userCoins++;
                updateCoinDisplays();
                return false;
            }
        }

        if (this.type === 'spike') {
            const margin = 8;
            return (pBox.x + margin < oBox.x + oBox.width - margin &&
                    pBox.x + pBox.width - margin > oBox.x + margin &&
                    pBox.y + margin < oBox.y + oBox.height - margin &&
                    pBox.y + pBox.height - margin > oBox.y + margin);
        }

        if (this.type === 'block') {
            return (pBox.x < oBox.x + oBox.width &&
                    pBox.x + pBox.width > oBox.x &&
                    pBox.y < oBox.y + oBox.height &&
                    pBox.y + pBox.height > oBox.y);
        }

        if (this.type === 'yellow_pad' || this.type === 'yellow_ring') {
            return (pBox.x < oBox.x + oBox.width &&
                    pBox.x + pBox.width > oBox.x &&
                    pBox.y < oBox.y + oBox.height &&
                    pBox.y + pBox.height > oBox.y);
        }

        return false;
    }
}

// Bot Mode Auto Solver logic
function handleBotSolver() {
    if (!botMode || gameState !== 'PLAYING') return;

    // Look ahead to check if jump is needed
    let shouldJump = false;
    const lookAhead = 120;

    for (let obs of obstacles) {
        let obsScreenX = obs.x - gameDistance;
        if (obsScreenX > player.x && obsScreenX < player.x + lookAhead) {
            if (obs.type === 'spike' || obs.type === 'block' || obs.type === 'yellow_ring') {
                shouldJump = true;
                break;
            }
        }
    }

    if (player.mode === MODES.SHIP || player.mode === MODES.WAVE) {
        // Simple ceiling / floor avoidance
        if (player.y > canvas.height - GROUND_HEIGHT - 80) shouldJump = true;
        if (player.y < CEILING_HEIGHT + 80) shouldJump = false;
    }

    jumpPressed = shouldJump;
}

// Particle Spark System
function createSparks(x, y, count = 5) {
    const skin = getEquippedSkinObj();
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            life: 1.0,
            color: skin.color
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.04;
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles() {
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    });
}

// GAME UPDATE & LOOP
function update() {
    if (gameState !== 'PLAYING') return;

    handleBotSolver();

    gameDistance += currentSpeed;

    // Mode Transitions Check
    transitions.forEach(tr => {
        if (Math.abs(gameDistance - tr.distance) < currentSpeed / 2) {
            if (player.mode !== tr.mode) {
                player.mode = tr.mode;
                transitionFlash = 1.0;
                const info = MODE_INFO[tr.mode] || { name: tr.mode.toUpperCase() + ' MODE', color: '#ffffff' };
                modeBannerText = info.name;
                modeBannerColor = info.color;
                modeBannerTimer = 80;
            }
        }
    });

    // Input coyote & buffer counters
    if (player.isGrounded) {
        player.coyoteCounter = COYOTE_TIME;
    } else {
        player.coyoteCounter--;
    }

    if (jumpPressed) {
        player.jumpBufferCounter = BUFFER_TIME;
    } else {
        player.jumpBufferCounter--;
    }

    // Physics per Mode
    if (player.mode === MODES.CUBE) {
        player.velocityY += GRAVITY;
        if (player.jumpBufferCounter > 0 && player.coyoteCounter > 0) {
            player.velocityY = JUMP_FORCE;
            player.isGrounded = false;
            player.jumpBufferCounter = 0;
            createSparks(player.x, player.y + player.height);
        }
        player.rotation += ROTATION_SPEED;
    } else if (player.mode === MODES.SHIP) {
        if (jumpPressed) {
            player.velocityY -= 0.6;
        } else {
            player.velocityY += 0.4;
        }
        player.velocityY = Math.max(-8, Math.min(8, player.velocityY));
        player.rotation = player.velocityY * 0.05;
    } else if (player.mode === MODES.BALL) {
        player.velocityY += GRAVITY * player.gravityDir;
        if (jumpPressed && !jumpProcessed && player.isGrounded) {
            player.gravityDir *= -1;
            player.isGrounded = false;
            jumpProcessed = true;
            createSparks(player.x, player.y);
        }
        player.rotation += ROTATION_SPEED * player.gravityDir;
    } else if (player.mode === MODES.UFO) {
        player.velocityY += GRAVITY * 0.8;
        if (jumpPressed && !jumpProcessed) {
            player.velocityY = JUMP_FORCE * 0.75;
            jumpProcessed = true;
            createSparks(player.x, player.y + player.height);
        }
        player.rotation = player.velocityY * 0.03;
    } else if (player.mode === MODES.WAVE) {
        if (jumpPressed) {
            player.velocityY = -currentSpeed * 0.8;
        } else {
            player.velocityY = currentSpeed * 0.8;
        }
        player.rotation = jumpPressed ? -0.4 : 0.4;
    }

    player.y += player.velocityY;

    // Floor / Ceiling Boundaries
    const groundY = canvas.height - GROUND_HEIGHT - player.height;
    if (player.y >= groundY) {
        player.y = groundY;
        player.velocityY = 0;
        player.isGrounded = true;
        if (player.mode === MODES.CUBE) {
            // Snap angle
            player.rotation = Math.round(player.rotation / (Math.PI / 2)) * (Math.PI / 2);
        }
    } else if (player.y <= CEILING_HEIGHT) {
        player.y = CEILING_HEIGHT;
        player.velocityY = 0;
        if (player.mode === MODES.BALL && player.gravityDir === -1) {
            player.isGrounded = true;
        }
    }

    // Player Trail
    player.trail.push({ x: player.x, y: player.y + player.height / 2 });
    if (player.trail.length > 15) player.trail.shift();

    // Check Collisions
    obstacles.forEach(obs => {
        let obsScreenX = obs.x - gameDistance;
        if (obsScreenX > -100 && obsScreenX < canvas.width + 100) {
            if (obs.checkCollision(player, obsScreenX)) {
                if (obs.type === 'yellow_pad') {
                    player.velocityY = JUMP_FORCE * 1.3;
                    createSparks(player.x, player.y);
                } else if (obs.type === 'yellow_ring') {
                    if (jumpPressed) {
                        player.velocityY = JUMP_FORCE;
                        createSparks(player.x, player.y);
                    }
                } else if (obs.type === 'spike' || obs.type === 'block') {
                    handleDeath();
                }
            }
        }
    });

    // Progress % calculation
    let currentProgress = Math.min(100, Math.floor((gameDistance / totalLevelLength) * 100));
    if (currentProgress > levelBestScores[currentLevelIdx]) {
        levelBestScores[currentLevelIdx] = currentProgress;
        localStorage.setItem(`gd_best_level_${currentLevelIdx}`, currentProgress.toString());
        updateLevelProgressUI(currentLevelIdx, currentProgress);
    }

    if (gameDistance >= totalLevelLength) {
        // Level Complete Win!
        returnToLobby();
    }

    updateParticles();
}

function handleDeath() {
    deathFlash = 1.0;
    screenShake = 15;
    attempts++;
    resetGame();
}

// RENDER FUNCTION
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dynamic Visual Background
    const config = LEVEL_CONFIGS[currentLevelIdx] || LEVEL_CONFIGS[0];
    const hue = (gameDistance / 10 + config.bgHueOffset) % 360;
    ctx.fillStyle = `hsl(${hue}, 40%, 8%)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Screen Shake Offset
    ctx.save();
    if (screenShake > 0) {
        const sx = (Math.random() - 0.5) * screenShake;
        const sy = (Math.random() - 0.5) * screenShake;
        ctx.translate(sx, sy);
        screenShake *= 0.9;
        if (screenShake < 0.5) screenShake = 0;
    }

    // Floor and Ceiling
    ctx.fillStyle = '#111625';
    ctx.fillRect(0, canvas.height - GROUND_HEIGHT, canvas.width, GROUND_HEIGHT);
    ctx.fillRect(0, 0, canvas.width, CEILING_HEIGHT);

    ctx.strokeStyle = `hsl(${hue}, 80%, 50%)`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - GROUND_HEIGHT);
    ctx.lineTo(canvas.width, canvas.height - GROUND_HEIGHT);
    ctx.moveTo(0, CEILING_HEIGHT);
    ctx.lineTo(canvas.width, CEILING_HEIGHT);
    ctx.stroke();

    // Render Obstacles
    obstacles.forEach(obs => {
        let obsScreenX = obs.x - gameDistance;
        if (obsScreenX > -100 && obsScreenX < canvas.width + 100) {
            obs.draw(obsScreenX);
        }
    });

    // Render Mode Transition Portals
    drawPortals();

    // Draw Player Trail
    const skin = getEquippedSkinObj();
    ctx.strokeStyle = skin.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    player.trail.forEach((t, idx) => {
        if (idx === 0) ctx.moveTo(t.x, t.y);
        else ctx.lineTo(t.x, t.y);
    });
    ctx.stroke();

    // Draw Particles
    drawParticles();

    // Draw Player
    ctx.save();
    ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
    drawPlayerShape(ctx, player.mode, player.width, player.height, player.rotation, skin, jumpPressed);
    ctx.restore();

    ctx.restore(); // Screen shake restore

    // Transition / Flash Effects
    if (transitionFlash > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${transitionFlash})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        transitionFlash -= 0.08;
    }

    if (deathFlash > 0) {
        ctx.fillStyle = `rgba(255, 0, 85, ${deathFlash})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        deathFlash -= 0.1;
    }

    // Render Next Mode HUD & Transition Banner
    drawHUDModeIndicators();
}

function drawPortals() {
    transitions.forEach(tr => {
        let screenX = tr.distance - gameDistance;
        if (screenX > -100 && screenX < canvas.width + 100) {
            const info = MODE_INFO[tr.mode] || { color: '#00f0ff', icon: '🌀' };
            const portalY = CEILING_HEIGHT;
            const portalH = canvas.height - GROUND_HEIGHT - CEILING_HEIGHT;
            const portalW = 44;

            ctx.save();
            ctx.shadowColor = info.color;
            ctx.shadowBlur = 20;

            // Outer portal capsule
            ctx.strokeStyle = info.color;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.roundRect(screenX - portalW / 2, portalY + 10, portalW, portalH - 20, 20);
            ctx.stroke();

            // Inner glowing core line
            ctx.fillStyle = info.color;
            ctx.globalAlpha = 0.2 + Math.sin(Date.now() / 150) * 0.1;
            ctx.beginPath();
            ctx.roundRect(screenX - portalW / 2 + 6, portalY + 16, portalW - 12, portalH - 32, 14);
            ctx.fill();

            // Center mode icon
            ctx.globalAlpha = 1.0;
            ctx.font = 'bold 24px Outfit';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(info.icon, screenX, portalY + portalH / 2);

            ctx.restore();
        }
    });
}

function drawHUDModeIndicators() {
    if (gameState !== 'PLAYING') return;

    // 1. Next Mode Warning Indicator
    let nextTr = transitions.find(tr => tr.distance > gameDistance);
    if (nextTr) {
        let distLeft = nextTr.distance - gameDistance;
        if (distLeft > 0 && distLeft < 2500) {
            const info = MODE_INFO[nextTr.mode] || { name: 'NEXT MODE', icon: '🌀', color: '#00f0ff' };
            let alpha = Math.min(1.0, (2500 - distLeft) / 1000);

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = 'rgba(18, 22, 38, 0.85)';
            ctx.strokeStyle = info.color;
            ctx.lineWidth = 2;
            ctx.shadowColor = info.color;
            ctx.shadowBlur = 12;

            const boxW = 200;
            const boxH = 40;
            const boxX = canvas.width / 2 - boxW / 2;
            const boxY = 30;

            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxW, boxH, 12);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = info.color;
            ctx.font = '800 14px Outfit';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`NEXT: ${info.icon} ${info.name}`, canvas.width / 2, boxY + boxH / 2);

            ctx.restore();
        }
    }

    // 2. Mode Change Center Banner
    if (modeBannerTimer > 0) {
        let alpha = Math.min(1.0, modeBannerTimer / 30);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = '900 36px Outfit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = modeBannerColor;
        ctx.shadowColor = modeBannerColor;
        ctx.shadowBlur = 25;

        ctx.fillText(modeBannerText, canvas.width / 2, canvas.height / 3);
        ctx.restore();

        modeBannerTimer--;
    }
}

// Universal Player Drawing Function
function drawPlayerShape(context, mode, width, height, rotation, skin, isThrusting = false) {
    context.save();
    context.rotate(rotation);

    context.fillStyle = skin.color;
    context.strokeStyle = skin.secondaryColor;
    context.lineWidth = 3;
    context.shadowColor = skin.color;
    context.shadowBlur = 12;

    const halfW = width / 2;
    const halfH = height / 2;

    if (mode === MODES.SHIP) {
        // Ship / Rocket shape
        context.beginPath();
        context.moveTo(halfW + 6, 0); // Nose
        context.lineTo(-halfW, -halfH + 4); // Top rear wing
        context.lineTo(-halfW + 8, 0); // Engine recess
        context.lineTo(-halfW, halfH - 4); // Bottom rear wing
        context.closePath();
        context.fill();
        context.stroke();

        // Cockpit glass
        context.fillStyle = '#00ffff';
        context.beginPath();
        context.ellipse(2, -2, 8, 6, 0, 0, Math.PI * 2);
        context.fill();

        // Thruster flame at rear
        const flameLen = isThrusting ? (12 + Math.random() * 8) : (6 + Math.random() * 4);
        context.fillStyle = isThrusting ? '#ffcc00' : '#ff4400';
        context.shadowColor = '#ff6600';
        context.beginPath();
        context.moveTo(-halfW + 6, -6);
        context.lineTo(-halfW + 6 - flameLen, 0);
        context.lineTo(-halfW + 6, 6);
        context.closePath();
        context.fill();

    } else if (mode === MODES.BALL) {
        // Ball / Rolling Orb shape
        const radius = halfW;
        context.beginPath();
        context.arc(0, 0, radius, 0, Math.PI * 2);
        context.fill();
        context.stroke();

        // Inner spinning spokes
        context.strokeStyle = skin.secondaryColor;
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(-radius + 4, 0); context.lineTo(radius - 4, 0);
        context.moveTo(0, -radius + 4); context.lineTo(0, radius - 4);
        context.stroke();

        // Core glowing orb
        context.fillStyle = '#ffffff';
        context.beginPath();
        context.arc(0, 0, radius * 0.35, 0, Math.PI * 2);
        context.fill();

    } else if (mode === MODES.UFO) {
        // Flying Saucer shape
        // Dome
        context.fillStyle = skin.secondaryColor;
        context.beginPath();
        context.arc(0, -2, 14, Math.PI, 0);
        context.fill();
        context.stroke();

        // Pilot face in dome
        context.fillStyle = '#ffffff';
        context.beginPath();
        context.arc(0, -8, 5, 0, Math.PI * 2);
        context.fill();

        // Saucer rim
        context.fillStyle = skin.color;
        context.beginPath();
        context.ellipse(0, 4, halfW + 4, 10, 0, 0, Math.PI * 2);
        context.fill();
        context.stroke();

        // Bottom energy beam thruster
        if (isThrusting) {
            context.fillStyle = '#00ffff';
            context.shadowColor = '#00ffff';
            context.beginPath();
            context.moveTo(-10, 12);
            context.lineTo(0, 24 + Math.random() * 6);
            context.lineTo(10, 12);
            context.closePath();
            context.fill();
        }

    } else if (mode === MODES.WAVE) {
        // Sharp Dart / Arrowhead
        context.beginPath();
        context.moveTo(halfW + 8, 0);
        context.lineTo(-halfW, -halfH);
        context.lineTo(-halfW + 10, 0);
        context.lineTo(-halfW, halfH);
        context.closePath();
        context.fill();
        context.stroke();

        // Inner glowing core
        context.fillStyle = '#ffffff';
        context.beginPath();
        context.moveTo(halfW - 2, 0);
        context.lineTo(-halfW + 10, -halfH + 10);
        context.lineTo(-halfW + 10, halfH - 10);
        context.closePath();
        context.fill();

    } else {
        // MODES.CUBE
        context.fillRect(-halfW, -halfH, width, height);
        context.strokeRect(-halfW, -halfH, width, height);

        // Inner square accent
        context.strokeStyle = skin.secondaryColor;
        context.lineWidth = 2;
        context.strokeRect(-halfW + 6, -halfH + 6, width - 12, height - 12);

        // Inner Face details
        context.fillStyle = '#000';
        context.fillRect(-8, -8, 5, 5);
        context.fillRect(3, -8, 5, 5);
        context.fillRect(-6, 4, 12, 3);
    }

    context.shadowBlur = 0;
    context.restore();
}

// Character Preview Renderer for Lobby
function renderPreviewCanvas() {
    const prevCanvas = document.getElementById('previewCanvas');
    if (!prevCanvas) return;
    const pCtx = prevCanvas.getContext('2d');
    pCtx.clearRect(0, 0, prevCanvas.width, prevCanvas.height);

    const skin = getEquippedSkinObj();
    const cx = prevCanvas.width / 2;
    const cy = prevCanvas.height / 2;

    pCtx.save();
    pCtx.translate(cx, cy);

    const modesArr = [MODES.CUBE, MODES.SHIP, MODES.BALL, MODES.UFO, MODES.WAVE];
    const previewMode = modesArr[Math.floor(Date.now() / 2500) % modesArr.length];
    drawPlayerShape(pCtx, previewMode, 70, 70, 0, skin, true);

    pCtx.restore();
}

// Main Animation Loop
function gameLoop() {
    update();
    draw();
    if (gameState === 'LOBBY') {
        renderPreviewCanvas();
    }
    requestAnimationFrame(gameLoop);
}

// Initialize UI & Start Loop
initUI();
requestAnimationFrame(gameLoop);
