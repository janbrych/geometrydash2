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

const PORTAL_COLORS = {
    cube: '#00ff66',
    ship: '#ff00aa',
    ball: '#ff2200',
    ufo: '#ff9900',
    wave: '#0099ff'
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

let currentActiveLevel = null;
let levelBestScores = {};

// Economy & Unlock Storage
let userCoins = parseInt(localStorage.getItem('gd_coins') || '0', 10);
let unlockedSkins = JSON.parse(localStorage.getItem('gd_unlocked_skins') || '["default_cyan"]');
let equippedSkinId = localStorage.getItem('gd_equipped_skin') || 'default_cyan';
let isDarkTheme = localStorage.getItem('gd_theme') !== 'light';

// Audio setup
let bgMusic = new Audio('techno_level1.wav');
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
let currentTransitionBanner = null;
let transitionBannerTimer = 0;

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
        if (player.mode === MODES.CUBE && player.velocityY < -3) {
            player.velocityY *= 0.5;
        }
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
    if (player.mode === MODES.CUBE && player.velocityY < -3) {
        player.velocityY *= 0.5;
    }
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

    const openCommBtn = document.getElementById('openCommunityBtn');
    const closeCommBtn = document.getElementById('closeCommunityBtn');
    if (openCommBtn) openCommBtn.addEventListener('click', openCommunityModal);
    if (closeCommBtn) closeCommBtn.addEventListener('click', closeCommunityModal);

    renderLobbyLevels();
    renderSkinShopGrid();
}

function renderLobbyLevels() {
    const container = document.getElementById('lobbyLevelCards');
    if (!container) return;
    container.innerHTML = '';

    const levels = typeof LevelDB !== 'undefined' ? LevelDB.getAllLevels() : [];

    if (levels.length === 0) {
        container.innerHTML = `<div style="color: #64748b; text-align: center; padding: 20px;">Žádné vytvořené levely. Klikněte na [LEVEL EDITOR] a vytvořte svůj první level!</div>`;
        return;
    }

    // Sort: Main levels first, then by date created
    levels.sort((a, b) => {
        if (a.isMain && !b.isMain) return -1;
        if (!a.isMain && b.isMain) return 1;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    levels.forEach(lvl => {
        const best = parseInt(localStorage.getItem(`gd_best_${lvl.id}`) || '0', 10);
        levelBestScores[lvl.id] = best;

        const card = document.createElement('div');
        card.className = `level-card ${lvl.isMain ? 'main-level-card' : ''}`;

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <div class="level-badge ${lvl.isMain ? 'badge-cyber' : 'badge-acid'}">
                    ${lvl.isMain ? '⭐ MAIN TRACK' : 'COMMUNITY TRACK'} • ${lvl.speed || 10.5}x SPEED
                </div>
                <button class="btn-toggle-main" style="background: none; border: none; font-size: 1.1rem; cursor: pointer;" title="Toggle Main Status">
                    ${lvl.isMain ? '⭐' : '☆'}
                </button>
            </div>
            <h3 style="margin-top: 4px;">${lvl.title.toUpperCase()}</h3>
            <div class="level-info">Autor: ${lvl.author || 'Player'} • Objekty: ${lvl.obstacles ? lvl.obstacles.length : 0}</div>
            <div class="mode-sequence">START MODE: ${(lvl.initialMode || 'CUBE').toUpperCase()}</div>
            <div class="level-progress-bg"><div class="level-progress-fill" style="width: ${best}%;"></div></div>
            <div class="card-footer-row">
                <span class="level-best">Best: ${best}%</span>
                <button class="btn-card-play">PLAY</button>
            </div>
        `;

        card.querySelector('.btn-card-play').addEventListener('click', (e) => {
            e.stopPropagation();
            startLevel(lvl);
        });

        card.querySelector('.btn-toggle-main').addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof LevelDB !== 'undefined') {
                LevelDB.toggleMainLevel(lvl.id);
                renderLobbyLevels();
            }
        });

        card.addEventListener('click', () => {
            startLevel(lvl);
        });

        container.appendChild(card);
    });
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
    blurActiveElement();
    document.getElementById('shopModal').classList.remove('hidden');
    renderSkinShopGrid();
}

function closeShop() {
    blurActiveElement();
    document.getElementById('shopModal').classList.add('hidden');
}

function openCommunityModal() {
    const list = document.getElementById('communityLevelsList');
    list.innerHTML = '';
    const levels = typeof LevelDB !== 'undefined' ? LevelDB.getAllLevels() : [];

    if (levels.length === 0) {
        list.innerHTML = '<p style="color:#8b95a5; text-align:center;">Zatím nebyly vytvořeny žádné komunitní levely. Vytvořte nový v Level Editoru!</p>';
    } else {
        levels.forEach(lvl => {
            const card = document.createElement('div');
            card.style.cssText = 'background: #1c2030; border: 1px solid #2b3147; border-radius: 8px; padding: 14px; display: flex; align-items: center; justify-content: space-between;';
            card.innerHTML = `
                <div>
                    <h4 style="color:#00f0ff; font-size:1.1rem; margin-bottom:4px;">${lvl.title}</h4>
                    <p style="color:#64748b; font-size:0.8rem;">Objektů: ${lvl.obstacles.length} • Rychlost: ${lvl.speed}x • Autor: ${lvl.author || 'Player'}</p>
                </div>
                <button class="btn-card-play" style="padding: 8px 18px;">HRÁT</button>
            `;
            card.querySelector('button').addEventListener('click', () => {
                closeCommunityModal();
                selectCommunityLevel(lvl);
            });
            list.appendChild(card);
        });
    }

    document.getElementById('communityModal').classList.remove('hidden');
}

function closeCommunityModal() {
    document.getElementById('communityModal').classList.add('hidden');
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

function startLevel(levelData) {
    blurActiveElement();
    currentActiveLevel = levelData;
    currentSpeed = levelData.speed || 10.5;

    bgMusic.pause();
    bgMusic = new Audio(levelData.music || 'techno_level1.wav');
    bgMusic.loop = true;
    bgMusic.volume = 0.6;

    document.getElementById('lobbyOverlay').classList.add('hidden');
    document.getElementById('hudOverlay').classList.remove('hidden');

    resetGame();
    gameState = 'PLAYING';
    bgMusic.play().catch(() => {});
}

function selectCommunityLevel(levelData) {
    startLevel(levelData);
}

function returnToLobby() {
    blurActiveElement();
    bgMusic.pause();
    gameState = 'LOBBY';
    document.getElementById('lobbyOverlay').classList.remove('hidden');
    document.getElementById('hudOverlay').classList.add('hidden');
    updateCoinDisplays();
    renderLobbyLevels();
}

function resetGame() {
    if (currentActiveLevel) {
        currentSpeed = currentActiveLevel.speed || 10.5;
        player.mode = currentActiveLevel.initialMode || MODES.CUBE;
        totalLevelLength = currentActiveLevel.totalLength || 20000;
    } else {
        currentSpeed = 10.5;
        player.mode = MODES.CUBE;
        totalLevelLength = 20000;
    }

    player.x = 150;
    player.y = canvas.height - GROUND_HEIGHT - PLAYER_SIZE;
    player.velocityY = 0;
    player.isGrounded = true;
    player.coyoteCounter = 0;
    player.jumpBufferCounter = 0;
    player.rotation = 0;
    player.gravityDir = 1;
    player.trail = [];

    const equippedSkin = getEquippedSkinObj();
    player.color = equippedSkin.color;

    obstacles = [];
    transitions = [];
    gameDistance = 0;
    levelCoinsCollectedInRun = 0;
    updateCoinDisplays();

    if (currentActiveLevel) {
        buildCustomLevel(currentActiveLevel);
    }
}

function buildCustomLevel(lvl) {
    lvl.obstacles.forEach(o => {
        if (o.type === 'portal') {
            const obs = new Obstacle('portal', o.x, 5, 1);
            obs.portalMode = o.mode;
            obstacles.push(obs);
            transitions.push({ distance: o.x, mode: o.mode });
        } else if (o.type === 'spike') {
            if (o.ceiling) {
                obstacles.push(new Obstacle('spike', o.x, 1, 1, false, true));
            } else {
                const yUnits = Math.round((o.y || 0) / 40) + 1;
                obstacles.push(new Obstacle('spike', o.x, yUnits, 1));
            }
        } else if (o.type === 'block') {
            const hUnits = Math.round((o.h || 40) / 40);
            const wUnits = Math.round((o.w || 40) / 40);
            const yUnits = Math.round((o.y || 0) / 40) + hUnits;
            obstacles.push(new Obstacle('block', o.x, yUnits, wUnits));
        } else {
            const yUnits = Math.round((o.y || 0) / 40) + 1;
            obstacles.push(new Obstacle(o.type, o.x, yUnits, 1));
        }
    });
}

// LEVEL BUILDERS FOR OFFICIAL TRACKS
function buildLevel1() {
    totalLevelLength = 50200;
    // Section 1: CUBE
    obstacles.push(new Obstacle('spike', 800));
    obstacles.push(new Obstacle('spike', 1200));
    obstacles.push(new Obstacle('block', 1500, 1, 1));
    obstacles.push(new Obstacle('spike', 1500, 1, 1, true));
    obstacles.push(new Obstacle('spike', 1900));
    obstacles.push(new Obstacle('spike', 1935));

    // Floating staircase
    obstacles.push(new Obstacle('block', 2400, 1, 1));
    obstacles.push(new Obstacle('yellow_pad', 2405, 1));
    obstacles.push(new Obstacle('block', 2800, 2, 1));
    obstacles.push(new Obstacle('coin', 2810, 3));
    obstacles.push(new Obstacle('yellow_ring', 3200, 3));
    obstacles.push(new Obstacle('block', 3500, 1, 1));

    // Colored Mode Portals
    const p1 = new Obstacle('portal', 4000, 5, 1); p1.portalMode = MODES.SHIP; obstacles.push(p1);
    transitions.push({ distance: 4000, mode: MODES.SHIP });

    // Section 2: SHIP
    obstacles.push(new Obstacle('block', 4500, 1, 4));
    obstacles.push(new Obstacle('block', 4500, 7, 3));
    obstacles.push(new Obstacle('coin', 4800, 5));
    obstacles.push(new Obstacle('block', 5200, 1, 3));
    obstacles.push(new Obstacle('block', 5200, 6, 4));

    const p2 = new Obstacle('portal', 6000, 5, 1); p2.portalMode = MODES.BALL; obstacles.push(p2);
    transitions.push({ distance: 6000, mode: MODES.BALL });

    // Section 3: BALL
    obstacles.push(new Obstacle('spike', 6500));
    obstacles.push(new Obstacle('spike', 6500, 9, 1, false, true));
    obstacles.push(new Obstacle('block', 7000, 1, 3));
    obstacles.push(new Obstacle('yellow_ring', 7300, 4));
    obstacles.push(new Obstacle('block', 7600, 7, 3));

    const p3 = new Obstacle('portal', 8000, 5, 1); p3.portalMode = MODES.UFO; obstacles.push(p3);
    transitions.push({ distance: 8000, mode: MODES.UFO });

    // Section 4: UFO
    obstacles.push(new Obstacle('block', 8500, 1, 3));
    obstacles.push(new Obstacle('block', 8500, 6, 4));
    obstacles.push(new Obstacle('coin', 8800, 4));
    obstacles.push(new Obstacle('yellow_ring', 9200, 5));

    const p4 = new Obstacle('portal', 10000, 5, 1); p4.portalMode = MODES.WAVE; obstacles.push(p4);
    transitions.push({ distance: 10000, mode: MODES.WAVE });

    // Section 5: WAVE
    obstacles.push(new Obstacle('block', 10500, 1, 4));
    obstacles.push(new Obstacle('block', 10500, 7, 3));
    obstacles.push(new Obstacle('block', 11200, 1, 3));
    obstacles.push(new Obstacle('block', 11200, 6, 4));

    const p5 = new Obstacle('portal', 12000, 5, 1); p5.portalMode = MODES.CUBE; obstacles.push(p5);
    transitions.push({ distance: 12000, mode: MODES.CUBE });

    // Final stretch
    obstacles.push(new Obstacle('yellow_pad', 12300, 1));
    obstacles.push(new Obstacle('yellow_ring', 12700, 4));
    obstacles.push(new Obstacle('spike', 13100));
}

function buildLevel2() {
    totalLevelLength = 50200;
    // BALL
    obstacles.push(new Obstacle('spike', 800));
    obstacles.push(new Obstacle('spike', 1200, 9, 1, false, true));
    obstacles.push(new Obstacle('yellow_ring', 1600, 4));
    obstacles.push(new Obstacle('block', 2000, 1, 2));
    obstacles.push(new Obstacle('coin', 2010, 3));

    const p1 = new Obstacle('portal', 2500, 5, 1); p1.portalMode = MODES.CUBE; obstacles.push(p1);
    transitions.push({ distance: 2500, mode: MODES.CUBE });

    // CUBE
    obstacles.push(new Obstacle('yellow_pad', 2800, 1));
    obstacles.push(new Obstacle('yellow_ring', 3200, 4));
    obstacles.push(new Obstacle('block', 3600, 2, 2));

    const p2 = new Obstacle('portal', 4000, 5, 1); p2.portalMode = MODES.WAVE; obstacles.push(p2);
    transitions.push({ distance: 4000, mode: MODES.WAVE });

    // WAVE
    obstacles.push(new Obstacle('block', 4500, 1, 4));
    obstacles.push(new Obstacle('block', 4500, 7, 3));
    obstacles.push(new Obstacle('coin', 4800, 5));

    const p3 = new Obstacle('portal', 5500, 5, 1); p3.portalMode = MODES.SHIP; obstacles.push(p3);
    transitions.push({ distance: 5500, mode: MODES.SHIP });

    // SHIP
    obstacles.push(new Obstacle('block', 6000, 1, 3));
    obstacles.push(new Obstacle('block', 6000, 6, 4));

    const p4 = new Obstacle('portal', 7500, 5, 1); p4.portalMode = MODES.UFO; obstacles.push(p4);
    transitions.push({ distance: 7500, mode: MODES.UFO });

    // UFO
    obstacles.push(new Obstacle('yellow_ring', 8000, 4));
    obstacles.push(new Obstacle('yellow_ring', 8400, 6));
    obstacles.push(new Obstacle('spike', 8900));
}

function buildLevel3() {
    totalLevelLength = 50200;
    // WAVE
    obstacles.push(new Obstacle('block', 800, 1, 4));
    obstacles.push(new Obstacle('block', 800, 7, 3));
    obstacles.push(new Obstacle('coin', 1200, 5));

    const p1 = new Obstacle('portal', 1600, 5, 1); p1.portalMode = MODES.UFO; obstacles.push(p1);
    transitions.push({ distance: 1600, mode: MODES.UFO });

    // UFO
    obstacles.push(new Obstacle('yellow_ring', 2000, 4));
    obstacles.push(new Obstacle('yellow_ring', 2400, 6));

    const p2 = new Obstacle('portal', 2800, 5, 1); p2.portalMode = MODES.SHIP; obstacles.push(p2);
    transitions.push({ distance: 2800, mode: MODES.SHIP });

    // SHIP
    obstacles.push(new Obstacle('block', 3200, 1, 3));
    obstacles.push(new Obstacle('block', 3200, 6, 4));

    const p3 = new Obstacle('portal', 4000, 5, 1); p3.portalMode = MODES.BALL; obstacles.push(p3);
    transitions.push({ distance: 4000, mode: MODES.BALL });

    // BALL
    obstacles.push(new Obstacle('spike', 4400));
    obstacles.push(new Obstacle('yellow_ring', 4800, 4));

    const p4 = new Obstacle('portal', 5200, 5, 1); p4.portalMode = MODES.CUBE; obstacles.push(p4);
    transitions.push({ distance: 5200, mode: MODES.CUBE });

    // CUBE
    obstacles.push(new Obstacle('yellow_pad', 5500, 1));
    obstacles.push(new Obstacle('yellow_ring', 5900, 4));
    obstacles.push(new Obstacle('spike', 6300));
}

// Obstacle Constructor Class
class Obstacle {
    constructor(type, x, heightUnits = 1, widthUnits = 1, onTop = false, ceiling = false) {
        this.type = type; // 'spike', 'block', 'yellow_pad', 'yellow_ring', 'coin', 'portal'
        this.x = x;
        this.heightUnits = heightUnits;
        this.widthUnits = widthUnits;
        this.width = widthUnits * 40;
        this.height = heightUnits * 40;
        this.ceiling = ceiling;
        this.collected = false;
        this.portalMode = null;

        if (this.ceiling) {
            this.y = CEILING_HEIGHT;
        } else if (onTop) {
            this.y = canvas.height - GROUND_HEIGHT - (heightUnits * 40) - 40;
        } else {
            this.y = canvas.height - GROUND_HEIGHT - (heightUnits * 40);
        }

        if (this.type === 'yellow_ring' || this.type === 'magenta_ring') {
            this.y = canvas.height - GROUND_HEIGHT - (heightUnits * 40);
            this.width = 30;
            this.height = 30;
        } else if (this.type === 'yellow_pad' || this.type === 'magenta_pad') {
            this.height = 10;
            this.y = canvas.height - GROUND_HEIGHT - ((heightUnits - 1) * 40) - 10;
        } else if (this.type === 'coin') {
            this.width = 30;
            this.height = 30;
            this.y = canvas.height - GROUND_HEIGHT - (heightUnits * 40);
        } else if (this.type === 'portal') {
            this.width = 40;
            this.height = 200;
            this.y = canvas.height - GROUND_HEIGHT - 200;
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
        } else if (this.type === 'magenta_pad') {
            ctx.fillStyle = '#ff00ff';
            ctx.shadowColor = '#ff00ff';
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
        } else if (this.type === 'magenta_ring') {
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 4;
            ctx.shadowColor = '#ff00ff';
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
        } else if (this.type === 'portal') {
            const portalColor = PORTAL_COLORS[this.portalMode] || '#ffffff';
            ctx.fillStyle = portalColor;
            ctx.globalAlpha = 0.25;
            ctx.fillRect(screenX, this.y, this.width, this.height);
            ctx.globalAlpha = 1.0;

            ctx.strokeStyle = portalColor;
            ctx.shadowColor = portalColor;
            ctx.shadowBlur = 16;
            ctx.lineWidth = 4;
            ctx.strokeRect(screenX, this.y, this.width, this.height);

            ctx.fillStyle = portalColor;
            ctx.font = 'bold 14px Outfit';
            ctx.textAlign = 'center';
            ctx.fillText(this.portalMode ? this.portalMode.toUpperCase() : 'PORTAL', screenX + this.width / 2, this.y + this.height / 2);
            ctx.shadowBlur = 0;
        }
    }

    checkCollision(p, screenX) {
        if (this.collected) return false;

        const pBox = { x: p.x, y: p.y, width: p.width, height: p.height };
        const minY = Math.min(this.y, this.y + (this.height || 0));
        const absHeight = Math.abs(this.height);
        const oBox = { x: screenX, y: minY, width: this.width, height: absHeight };

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

        if (this.type === 'yellow_pad' || this.type === 'yellow_ring' || this.type === 'magenta_pad' || this.type === 'magenta_ring') {
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
            if (obs.type === 'spike' || obs.type === 'block' || obs.type === 'yellow_ring' || obs.type === 'magenta_ring') {
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
                currentTransitionBanner = tr.mode.toUpperCase() + ' MODE!';
                transitionBannerTimer = 60;
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
    let groundedThisFrame = false;
    const groundY = canvas.height - GROUND_HEIGHT - player.height;
    if (player.y >= groundY) {
        player.y = groundY;
        player.velocityY = 0;
        groundedThisFrame = true;
        if (player.mode === MODES.CUBE) {
            // Snap angle
            player.rotation = Math.round(player.rotation / (Math.PI / 2)) * (Math.PI / 2);
        }
    } else if (player.y <= CEILING_HEIGHT) {
        player.y = CEILING_HEIGHT;
        player.velocityY = 0;
        if (player.mode === MODES.BALL && player.gravityDir === -1) {
            groundedThisFrame = true;
        }
    }

    // Player Trail
    player.trail.push({ x: player.x, y: player.y + player.height / 2 });
    if (player.trail.length > 15) player.trail.shift();

    // Check Collisions
    obstacles.forEach(obs => {
        let obsScreenX = obs.x - gameDistance;
        if (obsScreenX > -100 && obsScreenX < canvas.width + 100) {
            if (obs.type === 'block') {
                const obsY = obs.y;
                const obsH = Math.abs(obs.height);
                const obsW = obs.width;

                if (player.x + player.width > obsScreenX && player.x < obsScreenX + obsW) {
                    // Standing on top of block (normal gravity)
                    if (player.gravityDir === 1 &&
                        player.y + player.height >= obsY &&
                        player.y + player.height <= obsY + 25 &&
                        player.velocityY >= 0) {
                        player.y = obsY - player.height;
                        player.velocityY = 0;
                        groundedThisFrame = true;
                        player.coyoteCounter = COYOTE_TIME;
                        if (player.mode === MODES.CUBE) {
                            player.rotation = Math.round(player.rotation / (Math.PI / 2)) * (Math.PI / 2);
                        }
                        return;
                    }
                    // Attached to bottom of ceiling block (inverted gravity)
                    else if (player.gravityDir === -1 &&
                             player.y <= obsY + obsH &&
                             player.y >= obsY + obsH - 25 &&
                             player.velocityY <= 0) {
                        player.y = obsY + obsH;
                        player.velocityY = 0;
                        groundedThisFrame = true;
                        player.coyoteCounter = COYOTE_TIME;
                        return;
                    }
                    // Bouncing off bottom of block in normal gravity
                    else if (player.gravityDir === 1 &&
                             player.y <= obsY + obsH &&
                             player.y >= obsY + obsH - 20 &&
                             player.velocityY < 0) {
                        player.y = obsY + obsH;
                        player.velocityY = 0;
                        return;
                    }
                }

                // Side / fatal collision with block
                const sideMargin = 8;
                if (player.x + player.width > obsScreenX + sideMargin &&
                    player.x < obsScreenX + obsW - sideMargin &&
                    player.y + player.height > obsY + 5 &&
                    player.y < obsY + obsH - 5) {
                    handleDeath();
                }
            } else if (obs.checkCollision(player, obsScreenX)) {
                if (obs.type === 'yellow_pad') {
                    player.velocityY = JUMP_FORCE * 1.3;
                    player.isGrounded = false;
                    createSparks(player.x, player.y);
                } else if (obs.type === 'magenta_pad') {
                    player.velocityY = JUMP_FORCE * 0.8;
                    player.isGrounded = false;
                    createSparks(player.x, player.y);
                } else if (obs.type === 'yellow_ring') {
                    if (jumpPressed) {
                        player.velocityY = JUMP_FORCE;
                        player.isGrounded = false;
                        createSparks(player.x, player.y);
                    }
                } else if (obs.type === 'magenta_ring') {
                    if (jumpPressed) {
                        player.velocityY = JUMP_FORCE * 0.7;
                        player.isGrounded = false;
                        createSparks(player.x, player.y);
                    }
                } else if (obs.type === 'spike') {
                    handleDeath();
                }
            }
        }
    });

    player.isGrounded = groundedThisFrame;

    // Progress % calculation
    let currentProgress = Math.min(100, Math.floor((gameDistance / totalLevelLength) * 100));
    if (currentActiveLevel) {
        const lvlId = currentActiveLevel.id;
        if (!levelBestScores[lvlId] || currentProgress > levelBestScores[lvlId]) {
            levelBestScores[lvlId] = currentProgress;
            localStorage.setItem(`gd_best_${lvlId}`, currentProgress.toString());
        }
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

function drawPlayerShape(mode, width, height, color, secondaryColor) {
    const halfW = width / 2;
    const halfH = height / 2;

    ctx.fillStyle = color;
    ctx.strokeStyle = secondaryColor;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;

    switch (mode) {
        case MODES.CUBE:
            ctx.fillRect(-halfW, -halfH, width, height);
            ctx.strokeRect(-halfW, -halfH, width, height);
            // Face details
            ctx.fillStyle = '#000000';
            ctx.fillRect(-8, -8, 5, 5);
            ctx.fillRect(3, -8, 5, 5);
            ctx.fillRect(-6, 4, 12, 3);
            break;

        case MODES.SHIP:
            ctx.beginPath();
            ctx.moveTo(halfW, 0);
            ctx.lineTo(-halfW, -halfH);
            ctx.lineTo(-halfW + 10, 0);
            ctx.lineTo(-halfW, halfH);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Cockpit dome
            ctx.fillStyle = '#00ffff';
            ctx.beginPath();
            ctx.arc(0, -2, 7, 0, Math.PI * 2);
            ctx.fill();

            // Thruster flame when holding jump
            if (jumpPressed) {
                ctx.fillStyle = '#ffaa00';
                ctx.beginPath();
                ctx.moveTo(-halfW + 5, -5);
                ctx.lineTo(-halfW - 15, 0);
                ctx.lineTo(-halfW + 5, 5);
                ctx.closePath();
                ctx.fill();
            }
            break;

        case MODES.BALL:
            ctx.beginPath();
            ctx.arc(0, 0, halfW, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.strokeStyle = secondaryColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-halfW + 5, 0); ctx.lineTo(halfW - 5, 0);
            ctx.moveTo(0, -halfH + 5); ctx.lineTo(0, halfH - 5);
            ctx.stroke();

            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI * 2);
            ctx.fill();
            break;

        case MODES.UFO:
            // Saucer base
            ctx.beginPath();
            ctx.ellipse(0, 4, halfW, halfH * 0.45, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Dome canopy
            ctx.fillStyle = 'rgba(0, 240, 255, 0.75)';
            ctx.beginPath();
            ctx.arc(0, -1, halfW * 0.55, Math.PI, 0);
            ctx.fill();
            ctx.stroke();

            // Core beam light
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.arc(0, 6, 4, 0, Math.PI * 2);
            ctx.fill();
            break;

        case MODES.WAVE:
            ctx.beginPath();
            ctx.moveTo(halfW + 5, 0);
            ctx.lineTo(-halfW, -halfH);
            ctx.lineTo(-halfW + 8, 0);
            ctx.lineTo(-halfW, halfH);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(-2, 0, 4, 0, Math.PI * 2);
            ctx.fill();
            break;

        default:
            ctx.fillRect(-halfW, -halfH, width, height);
            ctx.strokeRect(-halfW, -halfH, width, height);
            break;
    }

    ctx.shadowBlur = 0;
}

// RENDER FUNCTION
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dynamic Visual Background
    const hue = (gameDistance / 10 + 180) % 360;
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
    ctx.rotate(player.rotation);

    drawPlayerShape(player.mode, player.width, player.height, skin.color, skin.secondaryColor);

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

    // Check for upcoming portal
    let upcomingPortal = null;
    for (let obs of obstacles) {
        if (obs.type === 'portal' && obs.x > gameDistance && obs.x - gameDistance < 800) {
            upcomingPortal = obs;
            break;
        }
    }

    if (upcomingPortal && gameState === 'PLAYING') {
        const portalColor = PORTAL_COLORS[upcomingPortal.portalMode] || '#ffffff';
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = portalColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(canvas.width / 2 - 110, CEILING_HEIGHT + 20, 220, 36, 18);
        } else {
            ctx.rect(canvas.width / 2 - 110, CEILING_HEIGHT + 20, 220, 36);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = portalColor;
        ctx.font = '800 14px Outfit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`NEXT MODE: ${upcomingPortal.portalMode.toUpperCase()}`, canvas.width / 2, CEILING_HEIGHT + 38);
    }

    // Render Mode Change Center Banner
    if (transitionBannerTimer > 0 && currentTransitionBanner && gameState === 'PLAYING') {
        const alpha = Math.min(1.0, transitionBannerTimer / 20);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, canvas.height / 2 - 50, canvas.width, 100);

        ctx.fillStyle = PORTAL_COLORS[player.mode] || '#ffffff';
        ctx.shadowColor = PORTAL_COLORS[player.mode] || '#ffffff';
        ctx.shadowBlur = 20;
        ctx.font = '900 36px Outfit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(currentTransitionBanner, canvas.width / 2, canvas.height / 2);
        ctx.restore();

        transitionBannerTimer--;
    }
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
    const size = 70;

    pCtx.save();
    pCtx.translate(cx, cy);

    pCtx.fillStyle = skin.color;
    pCtx.strokeStyle = skin.secondaryColor;
    pCtx.lineWidth = 4;
    pCtx.shadowColor = skin.color;
    pCtx.shadowBlur = 16;

    pCtx.fillRect(-size / 2, -size / 2, size, size);
    pCtx.strokeRect(-size / 2, -size / 2, size, size);

    pCtx.fillStyle = '#000';
    pCtx.fillRect(-14, -14, 8, 8);
    pCtx.fillRect(6, -14, 8, 8);
    pCtx.fillRect(-10, 8, 20, 5);

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
