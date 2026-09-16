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

// Level Configurations & Themes
const LEVEL_CONFIGS = [
    {
        id: 0,
        title: 'CYBER RAVE',
        audioSrc: 'techno_level1.wav',
        playerColor: '#00ffff',
        bgHueOffset: 180,
        initialMode: MODES.CUBE,
        builder: buildLevel1
    },
    {
        id: 1,
        title: 'ACID DISTRICT',
        audioSrc: 'techno_level2.wav',
        playerColor: '#aaff00',
        bgHueOffset: 80,
        initialMode: MODES.BALL,
        builder: buildLevel2
    },
    {
        id: 2,
        title: 'INDUSTRIAL HELL',
        audioSrc: 'techno_level3.wav',
        playerColor: '#ff2255',
        bgHueOffset: 340,
        initialMode: MODES.WAVE,
        builder: buildLevel3
    }
];

let currentLevelIdx = 0;
let levelBestScores = [0, 0, 0];

// Audio setup
let bgMusic = new Audio(LEVEL_CONFIGS[0].audioSrc);
bgMusic.loop = true;
bgMusic.volume = 0.6;

// Game State
let gameState = 'LOBBY'; // LOBBY, START, PLAYING, DEAD
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
let totalLevelLength = 60000; // Longer final level
let particles = [];
let screenShake = 0;
let deathFlash = 0;
let transitionFlash = 0;

// Input
let jumpPressed = false;
let jumpProcessed = false;

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        if (gameState === 'START') startGame();
        jumpPressed = true;
    } else if (e.code === 'KeyB') {
        botMode = !botMode;
    } else if (e.code === 'Escape') {
        returnToLobby();
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
    constructor(x, y, color, size, vx, vy) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = size;
        this.vx = vx;
        this.vy = vy;
        this.life = 1.0;
        this.decay = 0.01 + Math.random() * 0.02;
    }
    update() {
        this.x += this.vx - SPEED;
        this.y += this.vy;
        this.vy += 0.2 * player.gravityDir;
        this.life -= this.decay;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.translate(this.x, this.y);
        ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
        ctx.restore();
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

// LEVEL 1 BUILDER
function buildLevel1() {
    let curX = 1200;
    addSection(curX, [
        { x: 300, y: 0, type: 'spike' },
        { x: 800, y: 0, type: 'spike' },
        { x: 1300, y: 0, type: 'block', h: 30, w: 100 },
        { x: 1400, y: 0, type: 'block', h: 60, w: 100 },
        { x: 1800, y: 0, type: 'spike' },
        { x: 2200, y: 0, type: 'ring', h: 100 },
        { x: 2400, y: 100, type: 'block', w: 120, h: 20 },
        { x: 2900, y: 0, type: 'spike' },
        { x: 3300, y: 0, type: 'spike' },
    ]);
    curX += 3800;

    addSection(curX, [
        { x: 300, y: 0, type: 'pad' },
        { x: 700, y: 140, type: 'block', w: 120, h: 20 },
        { x: 1000, y: 140, type: 'ring', h: 50 },
        { x: 1300, y: 220, type: 'block', w: 120, h: 20 },
        { x: 1600, y: 220, type: 'ring', h: 50 },
        { x: 1900, y: 300, type: 'block', w: 120, h: 20 },
        { x: 2300, y: 0, type: 'spike' },
    ]);
    curX += 2900;

    transitions.push({ x: curX, mode: MODES.SHIP });
    curX += 1000;

    for (let i = 0; i < 8; i++) {
        let yCenter = 300 + Math.sin(i * 0.6) * 100;
        addSection(curX + i * 850, [
            { x: 0, y: 0, type: 'block', w: 150, h: Math.max(0, yCenter - 140) },
            { x: 0, y: yCenter + 140, type: 'block', w: 150, h: Math.max(0, 600 - (yCenter + 140)) },
            { x: 450, y: yCenter - 140, type: 'spike' }
        ]);
    }
    curX += 7100;

    transitions.push({ x: curX, mode: MODES.BALL });
    curX += 1000;

    for (let i = 0; i < 6; i++) {
        let isFloor = (i % 2 === 0);
        addSection(curX + i * 1100, [
            { x: 300, y: isFloor ? 0 : 550, type: 'spike' },
            { x: 800, y: isFloor ? 550 : 0, type: 'block', w: 150, h: 50 }
        ]);
    }
    curX += 7000;

    transitions.push({ x: curX, mode: MODES.UFO });
    curX += 1000;

    for (let i = 0; i < 6; i++) {
        addSection(curX + i * 900, [
            { x: 0, y: 0, type: 'spike' },
            { x: 300, y: 150, type: 'block', w: 120, h: 20 },
            { x: 600, y: 0, type: 'spike' },
            { x: 600, y: 550, type: 'spike' },
            { x: 750, y: 250, type: 'ring', h: 40 }
        ]);
    }
    curX += 5800;

    transitions.push({ x: curX, mode: MODES.WAVE });
    curX += 1000;

    for (let i = 0; i < 8; i++) {
        let isTop = (i % 2 === 0);
        addSection(curX + i * 850, [
            { x: 0, y: isTop ? 320 : 0, type: 'block', w: 250, h: 180 },
            { x: 500, y: isTop ? 0 : 550, type: 'spike' }
        ]);
    }
    curX += 7100;

    transitions.push({ x: curX, mode: MODES.CUBE });
    curX += 1000;
    addSection(curX, [
        { x: 300, y: 0, type: 'pad' },
        { x: 800, y: 0, type: 'pad' },
        { x: 1300, y: 0, type: 'pad' },
        { x: 1700, y: 200, type: 'ring', h: 40 },
        { x: 2100, y: 200, type: 'ring', h: 40 },
        { x: 2500, y: 0, type: 'spike' },
        { x: 2900, y: 0, type: 'spike' },
    ]);
    curX += 3400;
    totalLevelLength = curX + 1000;
}

// LEVEL 2 BUILDER
function buildLevel2() {
    let curX = 1200;

    for (let i = 0; i < 6; i++) {
        let isFloor = (i % 2 === 0);
        addSection(curX + i * 1100, [
            { x: 300, y: isFloor ? 0 : 550, type: 'spike' },
            { x: 800, y: isFloor ? 550 : 0, type: 'block', w: 150, h: 50 }
        ]);
    }
    curX += 7000;

    transitions.push({ x: curX, mode: MODES.CUBE });
    curX += 1000;

    addSection(curX, [
        { x: 300, y: 0, type: 'pad' },
        { x: 700, y: 140, type: 'block', w: 120, h: 20 },
        { x: 1000, y: 140, type: 'ring', h: 50 },
        { x: 1300, y: 220, type: 'block', w: 120, h: 20 },
        { x: 1700, y: 0, type: 'spike' },
        { x: 2100, y: 0, type: 'spike' },
    ]);
    curX += 2600;

    transitions.push({ x: curX, mode: MODES.WAVE });
    curX += 1000;

    for (let i = 0; i < 8; i++) {
        let isTop = (i % 2 === 0);
        addSection(curX + i * 850, [
            { x: 0, y: isTop ? 320 : 0, type: 'block', w: 250, h: 180 },
            { x: 500, y: isTop ? 0 : 550, type: 'spike' }
        ]);
    }
    curX += 7100;

    transitions.push({ x: curX, mode: MODES.SHIP });
    curX += 1000;

    for (let i = 0; i < 8; i++) {
        let yCenter = 300 + Math.cos(i * 0.6) * 100;
        addSection(curX + i * 850, [
            { x: 0, y: 0, type: 'block', w: 150, h: Math.max(0, yCenter - 140) },
            { x: 0, y: yCenter + 140, type: 'block', w: 150, h: Math.max(0, 600 - (yCenter + 140)) },
            { x: 450, y: yCenter - 140, type: 'spike' }
        ]);
    }
    curX += 7100;

    transitions.push({ x: curX, mode: MODES.UFO });
    curX += 1000;

    for (let i = 0; i < 6; i++) {
        addSection(curX + i * 900, [
            { x: 0, y: 0, type: 'spike' },
            { x: 300, y: 150, type: 'block', w: 120, h: 20 },
            { x: 600, y: 0, type: 'spike' },
            { x: 750, y: 250, type: 'ring', h: 40 }
        ]);
    }
    curX += 5800;

    transitions.push({ x: curX, mode: MODES.CUBE });
    curX += 1000;

    addSection(curX, [
        { x: 300, y: 0, type: 'pad' },
        { x: 800, y: 0, type: 'spike' },
        { x: 1300, y: 0, type: 'spike' },
    ]);
    curX += 2000;
    totalLevelLength = curX + 1000;
}

// LEVEL 3 BUILDER
function buildLevel3() {
    let curX = 1200;

    for (let i = 0; i < 8; i++) {
        let isTop = (i % 2 === 0);
        addSection(curX + i * 850, [
            { x: 0, y: isTop ? 320 : 0, type: 'block', w: 250, h: 180 },
            { x: 500, y: isTop ? 0 : 550, type: 'spike' }
        ]);
    }
    curX += 7100;

    transitions.push({ x: curX, mode: MODES.UFO });
    curX += 1000;

    for (let i = 0; i < 6; i++) {
        addSection(curX + i * 900, [
            { x: 0, y: 0, type: 'spike' },
            { x: 300, y: 150, type: 'block', w: 120, h: 20 },
            { x: 600, y: 0, type: 'spike' },
            { x: 750, y: 250, type: 'ring', h: 40 }
        ]);
    }
    curX += 5800;

    transitions.push({ x: curX, mode: MODES.SHIP });
    curX += 1000;

    for (let i = 0; i < 8; i++) {
        let yCenter = 300 + Math.sin(i * 0.6) * 100;
        addSection(curX + i * 850, [
            { x: 0, y: 0, type: 'block', w: 150, h: Math.max(0, yCenter - 140) },
            { x: 0, y: yCenter + 140, type: 'block', w: 150, h: Math.max(0, 600 - (yCenter + 140)) },
            { x: 450, y: yCenter - 140, type: 'spike' }
        ]);
    }
    curX += 7100;

    transitions.push({ x: curX, mode: MODES.BALL });
    curX += 1000;

    for (let i = 0; i < 6; i++) {
        let isFloor = (i % 2 === 0);
        addSection(curX + i * 1100, [
            { x: 300, y: isFloor ? 0 : 550, type: 'spike' },
            { x: 800, y: isFloor ? 550 : 0, type: 'block', w: 150, h: 50 }
        ]);
    }
    curX += 7000;

    transitions.push({ x: curX, mode: MODES.CUBE });
    curX += 1000;

    addSection(curX, [
        { x: 300, y: 0, type: 'pad' },
        { x: 800, y: 0, type: 'pad' },
        { x: 1300, y: 0, type: 'spike' },
        { x: 1700, y: 0, type: 'spike' },
    ]);
    curX += 2400;
    totalLevelLength = curX + 1000;
}

function initLevel() {
    obstacles = [];
    transitions = [];
    gameDistance = 0;
    const config = LEVEL_CONFIGS[currentLevelIdx];

    player.mode = config.initialMode;
    player.color = config.playerColor;
    player.gravityDir = 1;

    config.builder();
}

function selectLevel(idx) {
    currentLevelIdx = idx;
    const config = LEVEL_CONFIGS[currentLevelIdx];

    // Change soundtrack
    bgMusic.pause();
    bgMusic = new Audio(config.audioSrc);
    bgMusic.loop = true;
    bgMusic.volume = 0.6;

    // Hide lobby overlay
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('btnExitLobby').style.display = 'block';

    attempts = 1;
    startGame();
}

function returnToLobby() {
    gameState = 'LOBBY';
    bgMusic.pause();
    document.getElementById('lobby').style.display = 'flex';
    document.getElementById('btnExitLobby').style.display = 'none';
}

function startGame() {
    gameState = 'PLAYING';
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

function createLandingEffect() {
    for (let i = 0; i < 10; i++) {
        particles.push(new Particle(
            player.x + player.width / 2,
            player.gravityDir === 1 ? player.y + player.height : player.y,
            '#fff',
            Math.random() * 4 + 1,
            (Math.random() - 0.5) * 8,
            (Math.random() - 1) * 4 * player.gravityDir
        ));
    }
}

function createDeathEffect() {
    screenShake = 30;
    deathFlash = 1.0;
    gameState = 'DEAD';

    // Update personal best score
    let pct = Math.floor((gameDistance / totalLevelLength) * 100);
    if (pct > levelBestScores[currentLevelIdx]) {
        levelBestScores[currentLevelIdx] = pct;
        document.getElementById(`progress-${currentLevelIdx}`).style.width = `${pct}%`;
        document.getElementById(`best-${currentLevelIdx}`).innerText = `Best: ${pct}%`;
    }

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

    // Collisions
    obstacles.forEach(obs => {
        const obsX = obs.x - gameDistance;
        const obsY = groundLevel - obs.y;

        // Performance optimization: only check nearby obstacles
        if (obsX > -player.width && obsX < player.x + player.width + 100) {
            if (obs.type === 'pad') {
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

    // Enhanced player trail & mode-specific particle effects
    player.trail.push({ x: player.x, y: player.y, rotation: player.rotation, mode: player.mode, life: 1.0 });
    if (player.trail.length > 12) player.trail.shift();
    player.trail.forEach(t => { t.x -= SPEED * 0.8; t.life -= 0.08; });

    // Continuous trailing particles behind player
    if (gameState === 'PLAYING') {
        const px = player.x + player.width / 2;
        const py = player.y + player.height / 2;

        if (Math.random() < 0.8) {
            let pColor = player.color;
            let vx = -SPEED * (0.2 + Math.random() * 0.4);
            let vy = (Math.random() - 0.5) * 3;
            let size = Math.random() * 6 + 2;

            if (player.mode === MODES.SHIP) {
                pColor = Math.random() > 0.5 ? '#ffaa00' : '#ff3300'; // Thruster flame
                vx = -SPEED * 1.2;
            } else if (player.mode === MODES.WAVE) {
                pColor = '#ffffff';
                size = Math.random() * 4 + 2;
            } else if (player.mode === MODES.BALL) {
                pColor = player.gravityDir === 1 ? '#00ffaa' : '#ff00aa';
            }

            particles.push(new Particle(px - player.width / 2, py, pColor, size, vx, vy));
        }
    }

    particles.forEach(p => p.update());
    particles = particles.filter(p => p.life > 0);
    if (gameDistance > totalLevelLength) {
        levelBestScores[currentLevelIdx] = 100;
        document.getElementById(`progress-${currentLevelIdx}`).style.width = `100%`;
        document.getElementById(`best-${currentLevelIdx}`).innerText = `Best: 100%`;
        returnToLobby();
    }
}

function draw() {
    ctx.save();
    if (screenShake > 1) ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);

    const config = LEVEL_CONFIGS[currentLevelIdx];
    const hue = (config.bgHueOffset + (gameDistance / 150)) % 360;
    ctx.fillStyle = `hsl(${hue}, 40%, 6%)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Far background grid (parallax)
    const bgOffsetFar = (gameDistance * 0.2) % 200;
    ctx.strokeStyle = `hsl(${hue}, 40%, 10%)`;
    ctx.lineWidth = 2;
    for (let x = -bgOffsetFar; x < canvas.width; x += 200) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }

    // Near background grid (parallax with pulsating strobe)
    const pulse = 0.15 + Math.sin(gameDistance * 0.05) * 0.08;
    const bgOffset = (gameDistance * 0.5) % 100;
    ctx.strokeStyle = `hsla(${hue}, 50%, 25%, ${pulse})`;
    ctx.lineWidth = 1;
    for (let x = -bgOffset; x < canvas.width; x += 100) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }

    // Distracting floating background geometric shapes & optical illusions
    ctx.save();
    for (let i = 0; i < 6; i++) {
        let shapeX = ((i * 350 + gameDistance * 0.3) % (canvas.width + 400)) - 200;
        let shapeY = 180 + Math.sin(i * 1.5 + gameDistance * 0.02) * 120;
        let rot = gameDistance * 0.02 * (i % 2 === 0 ? 1 : -1);

        ctx.save();
        ctx.translate(canvas.width - shapeX, shapeY);
        ctx.rotate(rot);
        ctx.strokeStyle = `hsla(${(hue + i * 60) % 360}, 60%, 40%, 0.18)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (i % 2 === 0) {
            ctx.rect(-30, -30, 60, 60);
        } else {
            ctx.moveTo(0, -35); ctx.lineTo(30, 25); ctx.lineTo(-30, 25); ctx.closePath();
        }
        ctx.stroke();
        ctx.restore();
    }

    const groundY = canvas.height - GROUND_HEIGHT;
    const ceilY = CEILING_HEIGHT;

    // Optical Illusion Fake Non-Colliding Spikes/Blocks (Distractions)
    for (let i = 0; i < 4; i++) {
        let fakeX = ((i * 1200 + gameDistance * 0.6) % (totalLevelLength)) - gameDistance;
        let fakeY = groundY - 120 - Math.sin(i * 2.3) * 80;
        if (fakeX > -100 && fakeX < canvas.width + 100) {
            ctx.save();
            ctx.globalAlpha = 0.12; // Low opacity fake distraction
            ctx.fillStyle = player.color;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(fakeX, fakeY); ctx.lineTo(fakeX + 25, fakeY - 50); ctx.lineTo(fakeX + 50, fakeY);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.restore();
        }
    }
    ctx.restore();
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
            if (obs.type === 'spike') {
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
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = player.color; ctx.font = 'bold 60px Arial'; ctx.textAlign = 'center';
        ctx.fillText('GEOMETRY DASH', canvas.width/2, canvas.height/2 - 50);
        ctx.fillStyle = '#fff'; ctx.font = '30px Arial';
        ctx.fillText('Press SPACE or CLICK to Start', canvas.width/2, canvas.height/2 + 50);
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
