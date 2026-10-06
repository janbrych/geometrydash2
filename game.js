const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
resize();

// Constants
const GROUND_HEIGHT = 100;
const CEILING_HEIGHT = 100;
let currentSpeed = 10.5;

// Use shared constants from PhysicsEngine if loaded, otherwise fallback
const PLAYER_SIZE_GAME = typeof PhysicsEngine !== 'undefined' ? PhysicsEngine.PLAYER_SIZE : 40;
const MODES_GAME = typeof PhysicsEngine !== 'undefined' ? PhysicsEngine.MODES : {
    CUBE: 'cube',
    SHIP: 'ship',
    BALL: 'ball',
    UFO: 'ufo',
    WAVE: 'wave'
};
const PORTAL_COLORS_GAME = typeof PhysicsEngine !== 'undefined' ? PhysicsEngine.PORTAL_COLORS : {
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
let botMode = false;

let player = null;
let jumpProcessedState = { value: false };

let levelCoinsCollectedInRun = 0;
let particles = [];
let screenShake = 0;
let deathFlash = 0;
let transitionFlash = 0;
let currentTransitionBanner = null;
let transitionBannerTimer = 0;

// Input
let jumpPressed = false;

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
        jumpProcessedState.value = false;
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
    jumpProcessedState.value = false;
});

// UI Event Handling
function initUI() {
    updateCoinDisplays();
    updateThemeUI();

    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            blurActiveElement();
            isDarkTheme = !isDarkTheme;
            localStorage.setItem('gd_theme', isDarkTheme ? 'dark' : 'light');
            updateThemeUI();
        });
    }

    const openShopBtn = document.getElementById('openShopBtn');
    const closeShopBtn = document.getElementById('closeShopBtn');
    if (openShopBtn) openShopBtn.addEventListener('click', openShop);
    if (closeShopBtn) closeShopBtn.addEventListener('click', closeShop);

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
            <div class="mode-sequence">START MODE: ${(lvl.startPosition ? lvl.startPosition.mode : lvl.initialMode || 'CUBE').toUpperCase()}</div>
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
        const themeIcon = document.getElementById('themeIcon');
        const themeLabel = document.getElementById('themeLabel');
        if (themeIcon) themeIcon.textContent = '☀️';
        if (themeLabel) themeLabel.textContent = 'Light';
    } else {
        document.body.classList.remove('theme-dark');
        document.body.classList.add('theme-light');
        const themeIcon = document.getElementById('themeIcon');
        const themeLabel = document.getElementById('themeLabel');
        if (themeIcon) themeIcon.textContent = '🌙';
        if (themeLabel) themeLabel.textContent = 'Dark';
    }
}

function updateCoinDisplays() {
    const lCoins = document.getElementById('lobbyCoinCount');
    const sCoins = document.getElementById('shopCoinCount');
    const hCoins = document.getElementById('hudCoinCount');
    if (lCoins) lCoins.textContent = userCoins;
    if (sCoins) sCoins.textContent = userCoins;
    if (hCoins) hCoins.textContent = levelCoinsCollectedInRun;
    localStorage.setItem('gd_coins', userCoins.toString());
}

function openShop() {
    blurActiveElement();
    const shopModal = document.getElementById('shopModal');
    if (shopModal) shopModal.classList.remove('hidden');
    renderSkinShopGrid();
}

function closeShop() {
    blurActiveElement();
    const shopModal = document.getElementById('shopModal');
    if (shopModal) shopModal.classList.add('hidden');
}

function openCommunityModal() {
    const list = document.getElementById('communityLevelsList');
    if (!list) return;
    list.innerHTML = '';
    const levels = typeof LevelDB !== 'undefined' ? LevelDB.getAllLevels() : [];

    if (levels.length === 0) {
        list.innerHTML = '<p style="color:#8b95a5; text-align:center;">Zatím nebyly vytvořeny žádné komunitní levely.</p>';
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
                startLevel(lvl);
            });
            list.appendChild(card);
        });
    }

    const modal = document.getElementById('communityModal');
    if (modal) modal.classList.remove('hidden');
}

function closeCommunityModal() {
    const modal = document.getElementById('communityModal');
    if (modal) modal.classList.add('hidden');
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
    if (typeof LevelDB !== 'undefined') {
        currentActiveLevel = LevelDB.migrateLevel(levelData);
    } else {
        currentActiveLevel = levelData;
    }

    currentSpeed = currentActiveLevel.speed || 10.5;

    bgMusic.pause();
    bgMusic = new Audio(currentActiveLevel.music || 'techno_level1.wav');
    bgMusic.loop = true;
    bgMusic.volume = 0.6;

    const lobbyOverlay = document.getElementById('lobbyOverlay');
    const hudOverlay = document.getElementById('hudOverlay');
    if (lobbyOverlay) lobbyOverlay.classList.add('hidden');
    if (hudOverlay) hudOverlay.classList.remove('hidden');

    resetGame();
    gameState = 'PLAYING';
    bgMusic.play().catch(() => {});
}

function returnToLobby() {
    blurActiveElement();
    bgMusic.pause();
    gameState = 'LOBBY';
    const lobbyOverlay = document.getElementById('lobbyOverlay');
    const hudOverlay = document.getElementById('hudOverlay');
    if (lobbyOverlay) lobbyOverlay.classList.remove('hidden');
    if (hudOverlay) hudOverlay.classList.add('hidden');
    updateCoinDisplays();
    renderLobbyLevels();
}

function resetGame() {
    const startPos = currentActiveLevel && currentActiveLevel.startPosition ?
        currentActiveLevel.startPosition : { x: 100, y: 0, mode: currentActiveLevel ? currentActiveLevel.initialMode : 'cube' };

    player = PhysicsEngine.createPlayerState(startPos);
    jumpProcessedState.value = false;

    levelCoinsCollectedInRun = 0;
    updateCoinDisplays();
}

// Bot Mode Auto Solver
function handleBotSolver() {
    if (!botMode || gameState !== 'PLAYING' || !player) return;

    let shouldJump = false;
    const lookAhead = 120;

    if (currentActiveLevel && currentActiveLevel.obstacles) {
        for (let obs of currentActiveLevel.obstacles) {
            if (obs.x - player.x > 0 && obs.x - player.x < lookAhead) {
                if (obs.type === 'spike' || obs.type === 'block' || obs.type === 'yellow_ring') {
                    shouldJump = true;
                    break;
                }
            }
        }
    }

    if (player.mode === MODES_GAME.SHIP || player.mode === MODES_GAME.WAVE) {
        if (player.y < 80) shouldJump = true;
        if (player.y > 300) shouldJump = false;
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

function drawParticles(cam) {
    particles.forEach(p => {
        const sx = (p.x - cam.x) + 150;
        const sy = canvas.height - GROUND_HEIGHT - p.y;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(sx, sy, 3 * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    });
}

// GAME PHYSICS UPDATE
function update() {
    if (gameState !== 'PLAYING' || !player) return;

    handleBotSolver();

    PhysicsEngine.stepPlayerPhysics(
        player,
        currentActiveLevel ? currentActiveLevel.obstacles : [],
        jumpPressed,
        jumpProcessedState,
        currentSpeed
    );

    if (player.dead) {
        handleDeath();
        return;
    }

    const totalLength = currentActiveLevel ? currentActiveLevel.totalLength : 20000;
    let currentProgress = Math.min(100, Math.floor((player.x / totalLength) * 100));

    if (currentActiveLevel) {
        const lvlId = currentActiveLevel.id;
        if (!levelBestScores[lvlId] || currentProgress > levelBestScores[lvlId]) {
            levelBestScores[lvlId] = currentProgress;
            localStorage.setItem(`gd_best_${lvlId}`, currentProgress.toString());
        }
    }

    if (player.x >= totalLength) {
        alert('🎉 Level Dokončen!');
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
        case MODES_GAME.CUBE:
            ctx.fillRect(-halfW, -halfH, width, height);
            ctx.strokeRect(-halfW, -halfH, width, height);
            ctx.fillStyle = '#000000';
            ctx.fillRect(-8, -8, 5, 5);
            ctx.fillRect(3, -8, 5, 5);
            ctx.fillRect(-6, 4, 12, 3);
            break;

        case MODES_GAME.SHIP:
            ctx.beginPath();
            ctx.moveTo(halfW, 0);
            ctx.lineTo(-halfW, -halfH);
            ctx.lineTo(-halfW + 10, 0);
            ctx.lineTo(-halfW, halfH);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#00ffff';
            ctx.beginPath();
            ctx.arc(0, -2, 7, 0, Math.PI * 2);
            ctx.fill();
            break;

        case MODES_GAME.BALL:
            ctx.beginPath();
            ctx.arc(0, 0, halfW, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
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

    if (gameState !== 'PLAYING' || !player) return;

    const hue = (player.x / 10 + 180) % 360;
    ctx.fillStyle = `hsl(${hue}, 40%, 8%)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    if (screenShake > 0) {
        const sx = (Math.random() - 0.5) * screenShake;
        const sy = (Math.random() - 0.5) * screenShake;
        ctx.translate(sx, sy);
        screenShake *= 0.9;
        if (screenShake < 0.5) screenShake = 0;
    }

    // Camera follow player
    const cam = { x: player.x, y: 0 };

    // Baseline Floor & Ceiling
    const groundScreenY = canvas.height - GROUND_HEIGHT;
    ctx.fillStyle = '#111625';
    ctx.fillRect(0, groundScreenY, canvas.width, GROUND_HEIGHT);
    ctx.fillRect(0, 0, canvas.width, CEILING_HEIGHT);

    ctx.strokeStyle = `hsl(${hue}, 80%, 50%)`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, groundScreenY);
    ctx.lineTo(canvas.width, groundScreenY);
    ctx.moveTo(0, CEILING_HEIGHT);
    ctx.lineTo(canvas.width, CEILING_HEIGHT);
    ctx.stroke();

    // Render Level Obstacles
    if (currentActiveLevel && currentActiveLevel.obstacles) {
        currentActiveLevel.obstacles.forEach(obs => {
            const screenX = (obs.x - cam.x) + 150;
            const obsH = obs.h || 40;
            const obsW = obs.w || 40;
            const screenY = groundScreenY - (obs.y + obsH);

            if (screenX > -100 && screenX < canvas.width + 100) {
                if (obs.type === 'block') {
                    ctx.fillStyle = obs.isFloor ? '#1e293b' : '#111827';
                    ctx.strokeStyle = obs.isFloor ? '#334155' : '#00f0ff';
                    ctx.lineWidth = 2;
                    ctx.fillRect(screenX, screenY, obsW, obsH);
                    ctx.strokeRect(screenX, screenY, obsW, obsH);
                } else if (obs.type === 'spike') {
                    ctx.fillStyle = '#ff0055';
                    ctx.beginPath();
                    ctx.moveTo(screenX, screenY + obsH);
                    ctx.lineTo(screenX + obsW / 2, screenY);
                    ctx.lineTo(screenX + obsW, screenY + obsH);
                    ctx.closePath();
                    ctx.fill();
                } else if (obs.type === 'portal') {
                    const portalColor = PORTAL_COLORS_GAME[obs.mode] || '#ffffff';
                    ctx.fillStyle = portalColor;
                    ctx.globalAlpha = 0.25;
                    ctx.fillRect(screenX, screenY, obsW, obsH);
                    ctx.globalAlpha = 1.0;
                    ctx.strokeStyle = portalColor;
                    ctx.lineWidth = 3;
                    ctx.strokeRect(screenX, screenY, obsW, obsH);
                }
            }
        });
    }

    // Render Particles & Player
    const skin = getEquippedSkinObj();
    drawParticles(cam);

    // Player screen position
    const playerScreenX = 150;
    const playerScreenY = groundScreenY - (player.y + player.h);

    ctx.save();
    ctx.translate(playerScreenX + player.w / 2, playerScreenY + player.h / 2);
    ctx.rotate(player.rotation);

    drawPlayerShape(player.mode, player.w, player.h, skin.color, skin.secondaryColor);

    ctx.restore();
    ctx.restore(); // Screen shake
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

// Main Game Loop with Fixed Timestep Accumulator
let lastGameTime = performance.now();
let gameAccumulator = 0;

function gameLoop(time) {
    const dt = Math.min((time - lastGameTime) / 1000, 0.1);
    lastGameTime = time;

    if (gameState === 'PLAYING') {
        gameAccumulator += dt;
        while (gameAccumulator >= PhysicsEngine.FIXED_DT) {
            update();
            gameAccumulator -= PhysicsEngine.FIXED_DT;
        }
    }

    draw();

    if (gameState === 'LOBBY') {
        renderPreviewCanvas();
    }

    requestAnimationFrame(gameLoop);
}

// Initialize UI & Start Loop
initUI();
requestAnimationFrame(gameLoop);
