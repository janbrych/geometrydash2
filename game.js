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
const SPEED = 7.5; // Slightly faster for more challenge

const MODES = {
    CUBE: 'cube',
    SHIP: 'ship',
    BALL: 'ball',
    UFO: 'ufo',
    WAVE: 'wave'
};

// Audio setup
const bgMusic = new Audio('techno.wav');
bgMusic.loop = true;
bgMusic.volume = 0.6;

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
        sparkType: 'fire',
        pattern: 'angry_eyes',
        desc: 'Leaves a trailing flame stream.'
    },
    {
        id: 'golden_king',
        name: 'Royal Monarch',
        color: '#ffd700',
        secondaryColor: '#ffffff',
        price: 30,
        sparkType: 'golden',
        pattern: 'crown',
        desc: 'Shines with golden embers.'
    },
    {
        id: 'electric_neon',
        name: 'Neon Voltage',
        color: '#a855f7',
        secondaryColor: '#00f0ff',
        price: 45,
        sparkType: 'electric',
        pattern: 'bolt',
        desc: 'Shoots high-voltage sparks.'
    },
    {
        id: 'toxic_hazard',
        name: 'Toxic Ooze',
        color: '#22c55e',
        secondaryColor: '#a3e635',
        price: 60,
        sparkType: 'bubbles',
        pattern: 'hazard',
        desc: 'Emits glowing toxic bubbles.'
    },
    {
        id: 'retro_pixel',
        name: '8-Bit Retro',
        color: '#f97316',
        secondaryColor: '#facc15',
        price: 75,
        sparkType: 'pixels',
        pattern: 'pixel_face',
        desc: 'Retro pixel blocks emission.'
    },
    {
        id: 'shadow_phantom',
        name: 'Void Phantom',
        color: '#818cf8',
        secondaryColor: '#38bdf8',
        price: 90,
        sparkType: 'smoke',
        pattern: 'ninja',
        desc: 'Surrounded by shadow wisps.'
    },
    {
        id: 'starlight_cosmic',
        name: 'Starlight Galaxy',
        color: '#ec4899',
        secondaryColor: '#f43f5e',
        price: 100,
        sparkType: 'stars',
        pattern: 'star_eye',
        desc: 'Leaves a trail of twinkling stars.'
    },
    {
        id: 'plasma_vortex',
        name: 'Plasma Core',
        color: '#14b8a6',
        secondaryColor: '#06b6d4',
        price: 120,
        sparkType: 'plasma',
        pattern: 'vortex',
        desc: 'High energy plasma discharge.'
    },
    {
        id: 'rainbow_overlord',
        name: 'Prism Overlord',
        color: '#ff007f',
        secondaryColor: '#00ffff',
        price: 150,
        sparkType: 'rainbow',
        pattern: 'overlord',
        desc: 'Dynamic spectral prism particles.'
    }
];

// Persistent State Economy & Preferences
let userCoins = parseInt(localStorage.getItem('gd_coins') || '0', 10);
let unlockedSkinIds = JSON.parse(localStorage.getItem('gd_unlocked_skins') || '["default_cyan"]');
let equippedSkinId = localStorage.getItem('gd_equipped_skin') || 'default_cyan';
let currentTheme = localStorage.getItem('gd_theme') || 'light'; // Default light mode as requested

function getEquippedSkin() {
    return SKINS.find(s => s.id === equippedSkinId) || SKINS[0];
}

function saveState() {
    localStorage.setItem('gd_coins', userCoins.toString());
    localStorage.setItem('gd_unlocked_skins', JSON.stringify(unlockedSkinIds));
    localStorage.setItem('gd_equipped_skin', equippedSkinId);
    localStorage.setItem('gd_theme', currentTheme);
}

// Game State
let gameState = 'START'; // START, PLAYING, DEAD
let attempts = 1;
let botMode = false; // BOT for testing
let lobbyParticles = [];

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
    color: getEquippedSkin().color,
    secondaryColor: getEquippedSkin().secondaryColor,
    skinId: equippedSkinId,
    trail: [],
    mode: MODES.CUBE
};

let obstacles = [];
let transitions = [];
let gameDistance = 0;
let totalLevelLength = 60000; // Longer final level
let particles = [];
let screenShake = 0;
let deathFlash = 0;
let transitionFlash = 0;

// Input & UI DOM Binding
let jumpPressed = false;
let jumpProcessed = false;

// DOM Elements
const lobbyOverlay = document.getElementById('lobbyOverlay');
const hudOverlay = document.getElementById('hudOverlay');
const lobbyCoinCount = document.getElementById('lobbyCoinCount');
const shopCoinCount = document.getElementById('shopCoinCount');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeIcon = document.getElementById('themeIcon');
const themeLabel = document.getElementById('themeLabel');
const playBtn = document.getElementById('playBtn');
const openShopBtn = document.getElementById('openShopBtn');
const closeShopBtn = document.getElementById('closeShopBtn');
const shopModal = document.getElementById('shopModal');
const skinGrid = document.getElementById('skinGrid');
const previewCanvas = document.getElementById('previewCanvas');
const previewCtx = previewCanvas ? previewCanvas.getContext('2d') : null;
const selectedSkinBadge = document.getElementById('selectedSkinBadge');
const skinDescText = document.getElementById('skinDescText');
const lobbyReturnBtn = document.getElementById('lobbyReturnBtn');

function applyTheme(theme) {
    currentTheme = theme;
    saveState();
    if (theme === 'dark') {
        document.body.classList.remove('theme-light');
        document.body.classList.add('theme-dark');
        if (themeIcon) themeIcon.textContent = '☀️';
        if (themeLabel) themeLabel.textContent = 'Light';
    } else {
        document.body.classList.remove('theme-dark');
        document.body.classList.add('theme-light');
        if (themeIcon) themeIcon.textContent = '🌙';
        if (themeLabel) themeLabel.textContent = 'Dark';
    }
}

function updateLobbyCoinsDisplay() {
    if (lobbyCoinCount) lobbyCoinCount.textContent = userCoins;
    if (shopCoinCount) shopCoinCount.textContent = userCoins;
}

function renderSkinShop() {
    if (!skinGrid) return;
    skinGrid.innerHTML = '';

    SKINS.forEach(skin => {
        const isUnlocked = unlockedSkinIds.includes(skin.id);
        const isEquipped = equippedSkinId === skin.id;

        const card = document.createElement('div');
        card.className = `skin-card ${isEquipped ? 'equipped' : ''}`;

        let actionBtnHtml = '';
        if (isEquipped) {
            actionBtnHtml = `<button class="btn-skin-action equipped" disabled>EQUIPPED</button>`;
        } else if (isUnlocked) {
            actionBtnHtml = `<button class="btn-skin-action equip" onclick="equipSkin('${skin.id}')">EQUIP</button>`;
        } else {
            const canAfford = userCoins >= skin.price;
            actionBtnHtml = `<button class="btn-skin-action buy" ${!canAfford ? 'style="opacity:0.5;cursor:not-allowed;"' : ''} onclick="buySkin('${skin.id}')">BUY FOR ${skin.price} $</button>`;
        }

        card.innerHTML = `
            <div class="skin-name">${skin.name}</div>
            <div class="skin-preview-mini">
                <canvas id="miniCanvas_${skin.id}" width="60" height="60"></canvas>
            </div>
            <p style="font-size:0.8rem; color:var(--text-secondary); text-align:center;">${skin.desc}</p>
            ${actionBtnHtml}
        `;

        skinGrid.appendChild(card);

        // Render miniature preview
        setTimeout(() => {
            const miniCv = document.getElementById(`miniCanvas_${skin.id}`);
            if (miniCv) {
                const mCtx = miniCv.getContext('2d');
                drawSkinMiniPreview(mCtx, skin, 60, 60);
            }
        }, 10);
    });
}

function drawLobbyCharacterPreview() {
    if (!previewCtx || !previewCanvas) return;
    const w = previewCanvas.width;
    const h = previewCanvas.height;
    previewCtx.clearRect(0, 0, w, h);

    // Spawn lobby preview sparks
    if (Math.random() < 0.6) {
        createSparkTrailEffect(w / 2 + (Math.random() - 0.5) * 20, h / 2 + 15, true);
    }

    // Update and draw lobby sparks
    lobbyParticles.forEach(p => p.update());
    lobbyParticles = lobbyParticles.filter(p => p.life > 0);
    lobbyParticles.forEach(p => p.draw(previewCtx));

    // Draw active skin cube
    const skin = getEquippedSkin();
    previewCtx.save();
    previewCtx.translate(w / 2, h / 2);

    let bobY = Math.sin(Date.now() * 0.005) * 6;
    previewCtx.translate(0, bobY);

    previewCtx.shadowBlur = 20;
    previewCtx.shadowColor = skin.color;
    previewCtx.fillStyle = skin.color;
    previewCtx.fillRect(-30, -30, 60, 60);

    previewCtx.strokeStyle = skin.secondaryColor || '#000';
    previewCtx.lineWidth = 4;
    previewCtx.strokeRect(-22, -22, 44, 44);

    previewCtx.restore();
}

function drawSkinMiniPreview(pCtx, skin, w, h) {
    pCtx.clearRect(0, 0, w, h);
    pCtx.save();
    pCtx.translate(w / 2, h / 2);
    pCtx.fillStyle = skin.color;
    pCtx.shadowBlur = 10;
    pCtx.shadowColor = skin.color;
    pCtx.fillRect(-18, -18, 36, 36);

    pCtx.strokeStyle = skin.secondaryColor || '#000';
    pCtx.lineWidth = 3;
    pCtx.strokeRect(-14, -14, 28, 28);
    pCtx.restore();
}

function equipSkin(skinId) {
    equippedSkinId = skinId;
    const skin = getEquippedSkin();
    player.color = skin.color;
    player.secondaryColor = skin.secondaryColor;
    player.skinId = skinId;
    if (selectedSkinBadge) selectedSkinBadge.textContent = skin.name.toUpperCase();
    if (skinDescText) skinDescText.textContent = skin.desc;
    saveState();
    renderSkinShop();
}

function buySkin(skinId) {
    const skin = SKINS.find(s => s.id === skinId);
    if (skin && userCoins >= skin.price && !unlockedSkinIds.includes(skinId)) {
        userCoins -= skin.price;
        unlockedSkinIds.push(skinId);
        saveState();
        updateLobbyCoinsDisplay();
        equipSkin(skinId);
    }
}

// Event Listeners for UI
if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        applyTheme(currentTheme === 'light' ? 'dark' : 'light');
    });
}

if (playBtn) {
    playBtn.addEventListener('click', () => {
        startGame();
    });
}

if (openShopBtn) {
    openShopBtn.addEventListener('click', () => {
        renderSkinShop();
        if (shopModal) shopModal.classList.remove('hidden');
    });
}

if (closeShopBtn) {
    closeShopBtn.addEventListener('click', () => {
        if (shopModal) shopModal.classList.add('hidden');
    });
}

if (lobbyReturnBtn) {
    lobbyReturnBtn.addEventListener('click', () => {
        gameState = 'START';
        if (lobbyOverlay) lobbyOverlay.classList.remove('hidden');
        if (hudOverlay) hudOverlay.classList.add('hidden');
    });
}

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        if (gameState === 'START' && (!shopModal || shopModal.classList.contains('hidden'))) {
            startGame();
        }
        jumpPressed = true;
    } else if (e.code === 'KeyB') {
        botMode = !botMode;
    }
});
window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        jumpPressed = false;
        jumpProcessed = false;
    }
});
window.addEventListener('mousedown', () => {
    if (gameState === 'START') startGame();
    jumpPressed = true;
});
window.addEventListener('mouseup', () => { jumpPressed = false; jumpProcessed = false; });
window.addEventListener('touchstart', (e) => {
    if (gameState === 'START') startGame();
    jumpPressed = true; e.preventDefault();
}, {passive: false});
window.addEventListener('touchend', () => { jumpPressed = false; jumpProcessed = false; });

class Particle {
    constructor(x, y, color, size, vx, vy, sparkType = 'default') {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = size;
        this.vx = vx;
        this.vy = vy;
        this.life = 1.0;
        this.decay = 0.015 + Math.random() * 0.02;
        this.sparkType = sparkType;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.2;
    }
    update() {
        this.x += this.vx - (gameState === 'PLAYING' ? SPEED : 0);
        this.y += this.vy;
        if (this.sparkType === 'fire' || this.sparkType === 'smoke') {
            this.vy -= 0.15; // float upward
        } else if (this.sparkType === 'bubbles') {
            this.vy -= 0.1;
            this.vx += Math.sin(Date.now() * 0.01) * 0.2;
        } else {
            this.vy += 0.1 * player.gravityDir;
        }
        this.rotation += this.rotSpeed;
        this.life -= this.decay;
    }
    draw(targetCtx = ctx) {
        targetCtx.save();
        targetCtx.globalAlpha = Math.max(0, this.life);
        targetCtx.translate(this.x, this.y);
        targetCtx.rotate(this.rotation);

        if (this.sparkType === 'stars') {
            targetCtx.fillStyle = this.color;
            targetCtx.beginPath();
            for (let i = 0; i < 5; i++) {
                targetCtx.lineTo(Math.cos((18 + i * 72) * Math.PI / 180) * this.size, Math.sin((18 + i * 72) * Math.PI / 180) * this.size);
                targetCtx.lineTo(Math.cos((54 + i * 72) * Math.PI / 180) * (this.size / 2), Math.sin((54 + i * 72) * Math.PI / 180) * (this.size / 2));
            }
            targetCtx.closePath();
            targetCtx.fill();
        } else if (this.sparkType === 'bubbles') {
            targetCtx.strokeStyle = this.color;
            targetCtx.lineWidth = 1.5;
            targetCtx.beginPath();
            targetCtx.arc(0, 0, this.size, 0, Math.PI * 2);
            targetCtx.stroke();
        } else if (this.sparkType === 'electric') {
            targetCtx.strokeStyle = this.color;
            targetCtx.lineWidth = 2;
            targetCtx.beginPath();
            targetCtx.moveTo(-this.size, -this.size);
            targetCtx.lineTo(0, this.size / 2);
            targetCtx.lineTo(this.size, -this.size / 2);
            targetCtx.stroke();
        } else if (this.sparkType === 'rainbow') {
            const hue = (Date.now() * 0.5 + this.x) % 360;
            targetCtx.fillStyle = `hsl(${hue}, 100%, 60%)`;
            targetCtx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        } else {
            targetCtx.fillStyle = this.color;
            targetCtx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        }

        targetCtx.restore();
    }
}

function addSection(startX, obstaclesList) {
    obstaclesList.forEach(obs => {
        obstacles.push({
            x: startX + obs.x,
            y: obs.y,
            type: obs.type,
            w: obs.w || 50,
            h: obs.h || 50
        });
    });
}

function initLevel() {
    obstacles = [];
    transitions = [];
    gameDistance = 0;
    player.mode = MODES.CUBE;
    player.gravityDir = 1;

    let curX = 1200;

    // Part 1: Cube - Rhythmic Intro with Coins
    addSection(curX, [
        { x: 150, y: 40, type: 'coin', w: 30, h: 30 },
        { x: 300, y: 0, type: 'spike' },
        { x: 800, y: 0, type: 'spike' },
        { x: 1300, y: 0, type: 'block', h: 30, w: 100 },
        { x: 1400, y: 0, type: 'block', h: 60, w: 100 },
        { x: 1430, y: 110, type: 'coin', w: 30, h: 30 },
        { x: 1800, y: 0, type: 'spike' },
        { x: 2200, y: 0, type: 'ring', h: 100 },
        { x: 2300, y: 250, type: 'coin', w: 30, h: 30 },
        { x: 2400, y: 100, type: 'block', w: 120, h: 20 },
        { x: 2900, y: 0, type: 'spike' },
        { x: 3300, y: 0, type: 'spike' },
    ]);
    curX += 3800;

    // Part 2: Cube - Pads & Orbs Verticality
    addSection(curX, [
        { x: 300, y: 0, type: 'pad' },
        { x: 450, y: 280, type: 'coin', w: 30, h: 30 },
        { x: 700, y: 140, type: 'block', w: 120, h: 20 },
        { x: 1000, y: 140, type: 'ring', h: 50 },
        { x: 1300, y: 220, type: 'block', w: 120, h: 20 },
        { x: 1600, y: 220, type: 'ring', h: 50 },
        { x: 1750, y: 420, type: 'coin', w: 30, h: 30 },
        { x: 1900, y: 300, type: 'block', w: 120, h: 20 },
        { x: 2300, y: 0, type: 'spike' },
    ]);
    curX += 2900;

    // Transition to Ship
    transitions.push({ x: curX, mode: MODES.SHIP });
    curX += 1000;

    // Part 3: Ship - Smooth Cavern
    for (let i = 0; i < 10; i++) {
        let yCenter = 300 + Math.sin(i * 0.6) * 100;
        let obsList = [
            { x: 0, y: 0, type: 'block', w: 150, h: Math.max(0, yCenter - 140) },
            { x: 0, y: yCenter + 140, type: 'block', w: 150, h: Math.max(0, 600 - (yCenter + 140)) },
            { x: 450, y: yCenter - 140, type: 'spike' }
        ];
        if (i % 2 === 1) {
            obsList.push({ x: 200, y: yCenter, type: 'coin', w: 30, h: 30 });
        }
        addSection(curX + i * 850, obsList);
    }
    curX += 8800;

    // Transition to Ball
    transitions.push({ x: curX, mode: MODES.BALL });
    curX += 1000;

    // Part 4: Ball - Gravity Corridors
    for (let i = 0; i < 8; i++) {
        let isFloor = (i % 2 === 0);
        let obsList = [
            { x: 300, y: isFloor ? 0 : 550, type: 'spike' },
            { x: 800, y: isFloor ? 550 : 0, type: 'block', w: 150, h: 50 }
        ];
        if (i % 3 === 0) {
            obsList.push({ x: 550, y: 280, type: 'coin', w: 30, h: 30 });
        }
        addSection(curX + i * 1100, obsList);
    }
    curX += 9200;

    // Transition to UFO
    transitions.push({ x: curX, mode: MODES.UFO });
    curX += 1000;

    // Part 5: UFO - Rhythmic Bounces
    for (let i = 0; i < 8; i++) {
        let obsList = [
            { x: 0, y: 0, type: 'spike' },
            { x: 300, y: 150, type: 'block', w: 120, h: 20 },
            { x: 600, y: 0, type: 'spike' },
            { x: 600, y: 550, type: 'spike' },
            { x: 750, y: 250, type: 'ring', h: 40 }
        ];
        if (i % 2 === 0) {
            obsList.push({ x: 350, y: 230, type: 'coin', w: 30, h: 30 });
        }
        addSection(curX + i * 900, obsList);
    }
    curX += 7600;

    // Transition to Wave
    transitions.push({ x: curX, mode: MODES.WAVE });
    curX += 1000;

    // Part 6: Wave - Open Slalom
    for (let i = 0; i < 10; i++) {
        let isTop = (i % 2 === 0);
        let obsList = [
            { x: 0, y: isTop ? 320 : 0, type: 'block', w: 250, h: 180 },
            { x: 500, y: isTop ? 0 : 550, type: 'spike' }
        ];
        if (i % 2 === 1) {
            obsList.push({ x: 250, y: 280, type: 'coin', w: 30, h: 30 });
        }
        addSection(curX + i * 850, obsList);
    }
    curX += 8800;

    // Transition back to Cube - Final Sprint
    transitions.push({ x: curX, mode: MODES.CUBE });
    curX += 1000;
    addSection(curX, [
        { x: 300, y: 0, type: 'pad' },
        { x: 800, y: 0, type: 'pad' },
        { x: 1300, y: 0, type: 'pad' },
        { x: 1500, y: 350, type: 'coin', w: 30, h: 30 },
        { x: 1700, y: 200, type: 'ring', h: 40 },
        { x: 2100, y: 200, type: 'ring', h: 40 },
        { x: 2300, y: 350, type: 'coin', w: 30, h: 30 },
        { x: 2500, y: 0, type: 'spike' },
        { x: 2900, y: 0, type: 'spike' },
    ]);
    curX += 3400;

    totalLevelLength = curX + 1000;
}

function startGame() {
    gameState = 'PLAYING';
    if (lobbyOverlay) lobbyOverlay.classList.add('hidden');
    if (hudOverlay) hudOverlay.classList.remove('hidden');
    if (bgMusic.paused) {
        bgMusic.play().catch(() => {});
    }
    resetGame(false);
}

function resetGame(incrementAttempts = true) {
    if (incrementAttempts) attempts++;
    player.y = 400;
    player.velocityY = 0;
    player.rotation = 0;
    player.trail = [];
    player.gravityDir = 1;
    gameDistance = 0;
    initLevel();
    if (gameState !== 'START') gameState = 'PLAYING';
}

function createSparkTrailEffect(x, y, isLobby = false) {
    const skin = getEquippedSkin();
    let sparkColor = skin.color;
    if (skin.sparkType === 'fire') sparkColor = Math.random() > 0.5 ? '#ff2a2a' : '#ffaa00';
    if (skin.sparkType === 'golden') sparkColor = Math.random() > 0.5 ? '#ffd700' : '#ffffff';
    if (skin.sparkType === 'smoke') sparkColor = Math.random() > 0.5 ? '#818cf8' : '#334155';

    let vx = (Math.random() - 0.5) * 3 - 2;
    let vy = (Math.random() - 0.5) * 3;
    let size = Math.random() * 6 + 3;

    if (isLobby) {
        lobbyParticles.push(new Particle(x, y, sparkColor, size, vx, vy, skin.sparkType));
    } else {
        particles.push(new Particle(x, y, sparkColor, size, vx, vy, skin.sparkType));
    }
}

function createLandingEffect() {
    const skin = getEquippedSkin();
    for (let i = 0; i < 10; i++) {
        particles.push(new Particle(
            player.x + player.width / 2,
            player.gravityDir === 1 ? player.y + player.height : player.y,
            skin.color,
            Math.random() * 4 + 1,
            (Math.random() - 0.5) * 8,
            (Math.random() - 1) * 4 * player.gravityDir,
            skin.sparkType
        ));
    }
}

function createCoinPickupEffect(cx, cy) {
    for (let i = 0; i < 20; i++) {
        let angle = Math.random() * Math.PI * 2;
        let speed = Math.random() * 8 + 2;
        particles.push(new Particle(
            cx, cy, '#ffd700',
            Math.random() * 6 + 3,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed
        ));
    }
}

function createDeathEffect() {
    screenShake = 30;
    deathFlash = 1.0;
    gameState = 'DEAD';
    for (let i = 0; i < 50; i++) {
        particles.push(new Particle(
            player.x + player.width / 2, player.y + player.height / 2, player.color,
            Math.random() * 15 + 5, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40
        ));
    }
}

function runBot() {
    if (!botMode) return;

    const groundLevel = canvas.height - GROUND_HEIGHT;

    // Fast predictive trajectory lookahead for in-game bot solver
    function checkSafety(doJump, frames = 10) {
        let simY = player.y;
        let simVy = player.velocityY;
        let simGrounded = player.isGrounded;
        let simGravityDir = player.gravityDir;
        let simCoyote = player.coyoteCounter;
        let simJumpBuffer = doJump ? BUFFER_TIME : 0;
        let simJumpProcessed = jumpProcessed;

        for (let f = 0; f < frames; f++) {
            let simX = player.x;
            let currentDist = gameDistance + (f + 1) * SPEED;

            // Physics step simulation
            switch(player.mode) {
                case MODES.CUBE:
                    if (simJumpBuffer > 0 && (simGrounded || simCoyote > 0)) {
                        simVy = JUMP_FORCE;
                        simGrounded = false;
                        simCoyote = 0;
                        simJumpBuffer = 0;
                    }
                    simVy += GRAVITY;
                    break;
                case MODES.SHIP:
                    if (doJump) simVy -= 0.75; else simVy += 0.75;
                    simVy = Math.max(-9, Math.min(9, simVy));
                    break;
                case MODES.BALL:
                    if (doJump && !simJumpProcessed) { simGravityDir *= -1; simGrounded = false; simJumpProcessed = true; }
                    simVy += GRAVITY * simGravityDir;
                    break;
                case MODES.UFO:
                    if (doJump && !simJumpProcessed) { simVy = JUMP_FORCE * 0.75; simJumpProcessed = true; }
                    simVy += GRAVITY;
                    break;
                case MODES.WAVE:
                    if (doJump) simVy = -SPEED * 1.3; else simVy = SPEED * 1.3;
                    break;
            }

            simY += simVy;

            if (simY + player.height > groundLevel) {
                simY = groundLevel - player.height; simVy = 0; simGrounded = true; simCoyote = COYOTE_TIME;
            } else if (simY < CEILING_HEIGHT) {
                simY = CEILING_HEIGHT; simVy = 0;
                if (player.mode === MODES.BALL && simGravityDir === -1) { simGrounded = true; simCoyote = COYOTE_TIME; }
            } else {
                simGrounded = false;
                if (simCoyote > 0) simCoyote--;
            }

            // Collision test
            for (let i = 0; i < obstacles.length; i++) {
                const obs = obstacles[i];
                const obsX = obs.x - currentDist;
                const obsY = groundLevel - obs.y;

                if (obsX > -player.width && obsX < simX + player.width + 50) {
                    if (obs.type === 'spike') {
                        const margin = 14;
                        if (simX + player.width > obsX + margin && simX < obsX + obs.w - margin &&
                            simY + player.height > obsY - obs.h + margin && simY < obsY - 2) {
                            return false;
                        }
                    } else if (obs.type === 'block') {
                        const sideMargin = 8;
                        if (simX + player.width > obsX + sideMargin && simX < obsX + obs.w - sideMargin &&
                            simY + player.height > obsY - obs.h + 5 && simY < obsY - 5) {
                            return false;
                        }
                    }
                }
            }
        }
        return true;
    }

    let safeNoJump = checkSafety(false, 12);
    let safeJump = checkSafety(true, 12);

    if (safeJump && !safeNoJump) {
        jumpPressed = true;
    } else if (safeNoJump && !safeJump) {
        jumpPressed = false;
    } else {
        // Mode specific preference when both safe
        if (player.mode === MODES.SHIP || player.mode === MODES.WAVE) {
            // Target open mid-screen area
            let targetY = (groundLevel + CEILING_HEIGHT) / 2 - player.height / 2;
            jumpPressed = (player.y > targetY);
        } else if (player.mode === MODES.CUBE) {
            jumpPressed = false;
        } else {
            jumpPressed = false;
        }
    }
}

function update() {
    if (botMode) runBot();

    // Jump Buffering
    if (jumpPressed) player.jumpBufferCounter = BUFFER_TIME;
    else if (player.jumpBufferCounter > 0) player.jumpBufferCounter--;

    if (screenShake > 0) screenShake *= 0.9;
    if (deathFlash > 0) deathFlash -= 0.05;
    if (transitionFlash > 0) transitionFlash -= 0.05;

    if (gameState === 'DEAD') {
        particles.forEach(p => p.update());
        particles = particles.filter(p => p.life > 0);
        if (particles.length === 0 && screenShake < 1) resetGame();
        return;
    }

    if (gameState === 'START') {
        return;
    }

    gameDistance += SPEED;

    transitions.forEach(t => {
        if (gameDistance >= t.x && gameDistance < t.x + SPEED) {
            player.mode = t.mode;
            transitionFlash = 1.0; screenShake = 15;
        }
    });

    // Physics
    switch(player.mode) {
        case MODES.CUBE:
            if (player.jumpBufferCounter > 0 && (player.isGrounded || player.coyoteCounter > 0)) {
                player.velocityY = JUMP_FORCE;
                player.isGrounded = false;
                player.coyoteCounter = 0;
                player.jumpBufferCounter = 0;
            }
            player.velocityY += GRAVITY;
            break;
        case MODES.SHIP:
            if (jumpPressed) player.velocityY -= 0.75; else player.velocityY += 0.75;
            player.velocityY = Math.max(-9, Math.min(9, player.velocityY));
            player.rotation = player.velocityY * 0.06;
            break;
        case MODES.BALL:
            if (jumpPressed && !jumpProcessed) { player.gravityDir *= -1; player.isGrounded = false; jumpProcessed = true; }
            player.velocityY += GRAVITY * player.gravityDir;
            break;
        case MODES.UFO:
            if (jumpPressed && !jumpProcessed) { player.velocityY = JUMP_FORCE * 0.75; jumpProcessed = true; }
            player.velocityY += GRAVITY;
            break;
        case MODES.WAVE:
            if (jumpPressed) player.velocityY = -SPEED * 1.3; else player.velocityY = SPEED * 1.3;
            player.rotation = jumpPressed ? -Math.PI/4 : Math.PI/4;
            break;
    }

    player.y += player.velocityY;

    const groundLevel = canvas.height - GROUND_HEIGHT;
    const ceilLevel = CEILING_HEIGHT;

    if (player.y + player.height > groundLevel) {
        if (!player.isGrounded) {
            createLandingEffect();
            if (player.mode === MODES.CUBE) player.rotation = Math.round(player.rotation / (Math.PI / 2)) * (Math.PI / 2);
        }
        player.y = groundLevel - player.height; player.velocityY = 0;
        player.isGrounded = true;
        player.coyoteCounter = COYOTE_TIME;
    } else if (player.y < ceilLevel) {
        if (!player.isGrounded && player.mode === MODES.BALL && player.gravityDir === -1) createLandingEffect();
        player.y = ceilLevel; player.velocityY = 0;
        if (player.mode === MODES.BALL && player.gravityDir === -1) {
            player.isGrounded = true;
            player.coyoteCounter = COYOTE_TIME;
        }
    } else {
        player.isGrounded = false;
        if (player.coyoteCounter > 0) player.coyoteCounter--;
    }

    if (player.mode === MODES.CUBE && !player.isGrounded) player.rotation += ROTATION_SPEED;
    else if (player.mode === MODES.BALL) player.rotation += 0.12 * player.gravityDir;

    // Continuous Spark Particles Emission
    if (Math.random() < 0.6) {
        createSparkTrailEffect(player.x, player.y + player.height / 2);
    }

    // Collisions
    obstacles.forEach(obs => {
        const obsX = obs.x - gameDistance;
        const obsY = groundLevel - obs.y;

        // Performance optimization: only check nearby obstacles
        if (obsX > -player.width && obsX < player.x + player.width + 100) {
            if (obs.type === 'coin') {
                if (!obs.collected &&
                    player.x + player.width > obsX && player.x < obsX + obs.w &&
                    player.y + player.height > obsY - obs.h && player.y < obsY) {
                    obs.collected = true;
                    userCoins++;
                    saveState();
                    if (typeof updateLobbyCoinsDisplay === 'function') updateLobbyCoinsDisplay();
                    createCoinPickupEffect(obsX + obs.w/2, obsY - obs.h/2);
                }
            } else if (obs.type === 'pad') {
                if (player.x + player.width > obsX && player.x < obsX + obs.w &&
                    player.y + player.height > obsY - 10 && player.y + player.height < obsY + 20) {
                    player.velocityY = JUMP_FORCE * 1.4;
                    player.isGrounded = false;
                    createLandingEffect();
                }
            } else if (obs.type === 'ring') {
                if (player.x + player.width > obsX && player.x < obsX + obs.w &&
                    player.y + player.height > obsY - obs.h && player.y < obsY) {
                    if (jumpPressed && !jumpProcessed) {
                        player.velocityY = JUMP_FORCE;
                        jumpProcessed = true;
                        createLandingEffect();
                    }
                }
            } else if (obs.type === 'spike') {
                const margin = 14;
                if (player.x + player.width > obsX + margin && player.x < obsX + obs.w - margin &&
                    player.y + player.height > obsY - obs.h + margin && player.y < obsY - 2) {
                    createDeathEffect();
                }
            } else if (obs.type === 'block') {
                if (player.x + player.width > obsX && player.x < obsX + obs.w) {
                    if (player.gravityDir === 1 && player.y + player.height >= obsY - obs.h && player.y + player.height <= obsY - obs.h + 25 && player.velocityY >= 0) {
                        if (!player.isGrounded) {
                            createLandingEffect();
                            if (player.mode === MODES.CUBE) player.rotation = Math.round(player.rotation / (Math.PI / 2)) * (Math.PI / 2);
                        }
                        player.y = obsY - obs.h - player.height; player.velocityY = 0; player.isGrounded = true;
                        return;
                    } else if (player.gravityDir === -1 && player.y <= obsY && player.y >= obsY - 25 && player.velocityY <= 0) {
                        if (!player.isGrounded) createLandingEffect();
                        player.y = obsY; player.velocityY = 0; player.isGrounded = true;
                        return;
                    }
                }
                const sideMargin = 8;
                if (player.x + player.width > obsX + sideMargin && player.x < obsX + obs.w - sideMargin &&
                    player.y + player.height > obsY - obs.h + 5 && player.y < obsY - 5) {
                    createDeathEffect();
                }
            }
        }
    });

    player.trail.push({ x: player.x, y: player.y, rotation: player.rotation, life: 1.0 });
    if (player.trail.length > 10) player.trail.shift();
    player.trail.forEach(t => { t.x -= SPEED * 0.8; t.life -= 0.1; });

    particles.forEach(p => p.update());
    particles = particles.filter(p => p.life > 0);
    if (gameDistance > totalLevelLength) { gameState = 'START'; attempts = 1; resetGame(false); }
}

function draw() {
    ctx.save();
    if (screenShake > 1) ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);

    const hue = (gameDistance / 150) % 360;
    ctx.fillStyle = `hsl(${hue}, 40%, 6%)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Far background grid (parallax)
    const bgOffsetFar = (gameDistance * 0.2) % 200;
    ctx.strokeStyle = `hsl(${hue}, 40%, 10%)`;
    ctx.lineWidth = 2;
    for (let x = -bgOffsetFar; x < canvas.width; x += 200) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }

    // Near background grid (parallax)
    const bgOffset = (gameDistance * 0.5) % 100;
    ctx.strokeStyle = `hsl(${hue}, 40%, 15%)`;
    ctx.lineWidth = 1;
    for (let x = -bgOffset; x < canvas.width; x += 100) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }

    const groundY = canvas.height - GROUND_HEIGHT;
    const ceilY = CEILING_HEIGHT;
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, groundY, canvas.width, GROUND_HEIGHT);
    ctx.fillRect(0, 0, canvas.width, ceilY);
    ctx.strokeStyle = player.color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(canvas.width, groundY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, ceilY); ctx.lineTo(canvas.width, ceilY); ctx.stroke();

    // Progress Bar & Attempt Counter
    if (gameState !== 'START') {
        ctx.fillStyle = '#222'; ctx.fillRect(canvas.width/2 - 200, 30, 400, 10);
        ctx.fillStyle = player.color; ctx.fillRect(canvas.width/2 - 200, 30, (gameDistance / totalLevelLength) * 400, 10);
        ctx.fillStyle = '#fff'; ctx.font = '20px Arial'; ctx.textAlign = 'center';
        ctx.fillText(`Attempt ${attempts}`, canvas.width/2, 65);
    }

    obstacles.forEach(obs => {
        const obsX = obs.x - gameDistance;
        const obsY = groundY - obs.y;
        if (obsX > -100 && obsX < canvas.width + 100) {
            if (obs.type === 'coin') {
                if (!obs.collected) {
                    ctx.save();
                    ctx.translate(obsX + obs.w/2, obsY - obs.h/2);
                    let pulse = Math.sin(Date.now() * 0.008) * 2;
                    ctx.fillStyle = '#ffd700';
                    ctx.shadowBlur = 12; ctx.shadowColor = '#ffd700';
                    ctx.beginPath();
                    ctx.arc(0, 0, obs.w/2 + pulse, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
                    ctx.stroke();
                    // Inner star / coin detail
                    ctx.fillStyle = '#b8860b';
                    ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText('$', 0, 1);
                    ctx.restore();
                }
            } else if (obs.type === 'spike') {
                ctx.fillStyle = '#ff3366'; ctx.beginPath();
                ctx.moveTo(obsX, obsY); ctx.lineTo(obsX + obs.w/2, obsY - obs.h); ctx.lineTo(obsX + obs.w, obsY);
                ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
            } else if (obs.type === 'block') {
                ctx.fillStyle = '#111'; ctx.fillRect(obsX, obsY - obs.h, obs.w, obs.h);
                ctx.strokeStyle = player.color; ctx.lineWidth = 2; ctx.strokeRect(obsX, obsY - obs.h, obs.w, obs.h);
            } else if (obs.type === 'pad') {
                ctx.fillStyle = '#ffff00';
                ctx.fillRect(obsX, obsY - 10, obs.w, 10);
                ctx.shadowBlur = 10; ctx.shadowColor = '#ffff00';
                ctx.strokeStyle = '#fff'; ctx.strokeRect(obsX, obsY - 10, obs.w, 10);
                ctx.shadowBlur = 0;
            } else if (obs.type === 'ring') {
                ctx.beginPath();
                ctx.arc(obsX + obs.w/2, obsY - obs.h/2, 20, 0, Math.PI*2);
                ctx.strokeStyle = '#ffff00'; ctx.lineWidth = 4;
                ctx.stroke();
                ctx.shadowBlur = 15; ctx.shadowColor = '#ffff00';
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
        }
    });

    // Trail
    ctx.save(); ctx.beginPath(); ctx.strokeStyle = player.color; ctx.lineWidth = player.mode === MODES.WAVE ? 4 : 20;
    for (let i = 0; i < player.trail.length; i++) {
        const t = player.trail[i]; ctx.globalAlpha = t.life * 0.4;
        const tx = t.x + player.width/2; const ty = t.y + player.height/2;
        if (i === 0) ctx.moveTo(tx, ty); else ctx.lineTo(tx, ty);
    }
    ctx.stroke(); ctx.restore();

    particles.forEach(p => p.draw());

    if (gameState !== 'DEAD') {
        ctx.save();
        ctx.translate(player.x + player.width/2, player.y + player.height/2);
        ctx.rotate(player.rotation);
        ctx.shadowBlur = 20; ctx.shadowColor = player.color; ctx.fillStyle = player.color;
        switch(player.mode) {
            case MODES.CUBE:
                ctx.fillRect(-player.width/2, -player.height/2, player.width, player.height);
                ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
                ctx.strokeRect(-player.width/2+4, -player.height/2+4, player.width-8, player.height-8);
                break;
            case MODES.SHIP:
                ctx.beginPath(); ctx.moveTo(-20, 10); ctx.lineTo(20, 10); ctx.lineTo(10, -15); ctx.lineTo(-10, -15); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#000'; ctx.fillRect(-5, -5, 10, 10);
                break;
            case MODES.BALL:
                ctx.beginPath(); ctx.arc(0, 0, player.width/2, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(20, 0); ctx.stroke();
                break;
            case MODES.UFO:
                ctx.beginPath(); ctx.ellipse(0, 0, 25, 12, 0, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, -5, 10, Math.PI, 0); ctx.fill();
                break;
            case MODES.WAVE:
                ctx.beginPath(); ctx.moveTo(-20, 15); ctx.lineTo(20, 0); ctx.lineTo(-20, -15); ctx.closePath(); ctx.fill();
                break;
        }
        ctx.restore();
    }

    if (gameState === 'START') {
        // Draw background canvas grid according to current light/dark theme
        const isDark = currentTheme === 'dark';
        ctx.fillStyle = isDark ? '#090d16' : '#f8fafc';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 2;

        let gridOffset = (Date.now() * 0.05) % 80;
        for (let x = -gridOffset; x < canvas.width; x += 80) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 80) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }

        // Render Character Preview Canvas if visible
        if (previewCtx && previewCanvas) {
            drawLobbyCharacterPreview();
        }
    }

    if (deathFlash > 0) { ctx.fillStyle = `rgba(255, 255, 255, ${deathFlash * 0.5})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    if (transitionFlash > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${transitionFlash})`; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#000'; ctx.font = 'bold 60px Arial'; ctx.textAlign = 'center'; ctx.fillText(player.mode.toUpperCase(), canvas.width/2, canvas.height/2);
    }
    ctx.restore();
}

function loop() { update(); draw(); requestAnimationFrame(loop); }
initLevel();
loop();
