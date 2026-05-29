const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 800;
canvas.height = 600;

// Audio Setup
const bgMusic = new Audio('music.mp3');
bgMusic.loop = true;

// Game Config
const CONFIG = {
    gravity: 0.6,
    jumpForce: -10,
    speed: 5.5,
    playerSize: 30,
    groundY: 500,
    ceilingY: 100
};

// Game State
const state = {
    screen: 'menu',
    scrollX: 0,
    isGravityFlipped: false,
    worldRotation: 0,
    targetRotation: 0,
    lastCheckpoint: { scrollX: 0, gravity: false, rotation: 0 },
    unlockedCheckpoints: [], // List of checkpoint indices
    bgOffset: 0,
    shake: 0,
    audioInitialized: false
};

const player = {
    x: 100,
    y: 400,
    width: CONFIG.playerSize,
    height: CONFIG.playerSize,
    vy: 0,
    onGround: false,
    rotation: 0,

    update() {
        const currentGravity = state.isGravityFlipped ? -CONFIG.gravity : CONFIG.gravity;
        this.vy += currentGravity;
        this.y += this.vy;

        if (!state.isGravityFlipped) {
            if (this.y > CONFIG.groundY - this.height) {
                this.y = CONFIG.groundY - this.height;
                this.vy = 0;
                this.onGround = true;
                this.rotation = Math.round(this.rotation / 90) * 90;
            } else {
                this.onGround = false;
                this.rotation += 5;
            }
        } else {
            if (this.y < CONFIG.ceilingY) {
                this.y = CONFIG.ceilingY;
                this.vy = 0;
                this.onGround = true;
                this.rotation = Math.round(this.rotation / 90) * 90;
            } else {
                this.onGround = false;
                this.rotation -= 5;
            }
        }

        if (state.worldRotation !== state.targetRotation) {
            const diff = state.targetRotation - state.worldRotation;
            state.worldRotation += diff * 0.05;
            if (Math.abs(diff) < 0.1) state.worldRotation = state.targetRotation;
        }

        if (state.shake > 0) state.shake *= 0.9;
    },

    jump() {
        if (this.onGround) {
            this.vy = state.isGravityFlipped ? -CONFIG.jumpForce : CONFIG.jumpForce;
        }
    },

    draw() {
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((state.worldRotation * Math.PI) / 180);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);

        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate((this.rotation * Math.PI) / 180);

        ctx.shadowBlur = 15;
        ctx.shadowColor = '#fff';

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);
        ctx.fillStyle = '#fff';
        ctx.fillRect(-this.width / 4, -this.width / 4, this.width / 2, this.height / 2);

        ctx.restore();
        ctx.restore();
    }
};

class Obstacle {
    constructor(x, y, width, height, type = 'spike', isFake = false, id = null) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type;
        this.active = true;
        this.isFake = isFake;
        this.id = id;
    }

    draw() {
        const drawX = this.x - state.scrollX;
        if (drawX + this.width < -800 || drawX > canvas.width + 800) return;

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((state.worldRotation * Math.PI) / 180);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);

        if (this.type === 'spike') {
            ctx.fillStyle = this.isFake ? '#1a0000' : '#ff0000';
            ctx.beginPath();
            ctx.moveTo(drawX, this.y);
            ctx.lineTo(drawX + this.width / 2, this.y - this.height);
            ctx.lineTo(drawX + this.width, this.y);
            ctx.fill();
        } else if (this.type === 'block') {
            ctx.strokeStyle = this.isFake ? '#111' : '#fff';
            ctx.strokeRect(drawX, this.y - this.height, this.width, this.height);
        } else if (this.type.startsWith('portal')) {
            ctx.strokeStyle = this.type.includes('flip') ? '#00ffff' : '#ff00ff';
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(drawX, this.y - this.height, this.width, this.height);
            ctx.setLineDash([]);
            ctx.fillStyle = this.active ? 'rgba(255, 255, 255, 0.1)' : 'rgba(100, 100, 100, 0.05)';
            ctx.fillRect(drawX, this.y - this.height, this.width, this.height);
        } else if (this.type === 'checkpoint') {
            ctx.fillStyle = this.active ? '#ffff00' : '#444400';
            ctx.fillRect(drawX, this.y - 150, 5, 150);
            ctx.fillStyle = '#ffff00';
            if (this.active) ctx.fillRect(drawX, this.y - 150, 20, 20);
        }

        ctx.restore();
    }

    checkCollision(p) {
        if (this.isFake) return false;
        if (!this.active && this.type.startsWith('portal')) return false;

        const drawX = this.x - state.scrollX;
        const rect1 = { x: p.x, y: p.y, w: p.width, h: p.height };

        // Correctly calculate rect bounds even for negative heights
        const rect2 = {
            x: drawX,
            y: Math.min(this.y, this.y - this.height),
            w: this.width,
            h: Math.abs(this.height)
        };

        if (this.type === 'checkpoint') {
            rect2.y = this.y - 150;
            rect2.h = 150;
        }

        const collided = rect1.x < rect2.x + rect2.w &&
                         rect1.x + rect1.w > rect2.x &&
                         rect1.y < rect2.y + rect2.h &&
                         rect1.y + rect1.h > rect2.y;

        if (collided) {
            if (this.type === 'portal-flip') {
                state.isGravityFlipped = !state.isGravityFlipped;
                this.active = false;
                state.shake = 10;
                return false;
            }
            if (this.type === 'portal-rot-90') {
                state.targetRotation += 90;
                this.active = false;
                state.shake = 15;
                return false;
            }
            if (this.type === 'checkpoint') {
                if (this.active) {
                    const cpData = {
                        scrollX: this.x - 100,
                        gravity: state.isGravityFlipped,
                        rotation: state.targetRotation,
                        id: this.id
                    };
                    state.lastCheckpoint = cpData;
                    if (!state.unlockedCheckpoints.some(c => c.id === this.id)) {
                        state.unlockedCheckpoints.push(cpData);
                        updateCheckpointMenu();
                    }
                    this.active = false;
                }
                return false;
            }
            return true;
        }
        return false;
    }
}

let gameLevel = [];

function generateLevel() {
    gameLevel = [];
    let x = 600;
    let cpId = 1;

    // INTRO
    for(let i=0; i<3; i++) {
        gameLevel.push(new Obstacle(x, CONFIG.groundY, 30, 30));
        x += 450;
    }
    gameLevel.push(new Obstacle(x, CONFIG.groundY, 20, 100, 'checkpoint', false, cpId++));
    x += 500;

    // GRAVITY CHAOS
    gameLevel.push(new Obstacle(x, CONFIG.groundY, 80, 50, 'portal-flip'));
    x += 300;
    gameLevel.push(new Obstacle(x, CONFIG.ceilingY + 30, 30, -30));
    gameLevel.push(new Obstacle(x + 150, CONFIG.ceilingY + 30, 30, -30));
    x += 500;
    gameLevel.push(new Obstacle(x, CONFIG.ceilingY + 50, 80, 50, 'portal-flip'));
    x += 200;
    gameLevel.push(new Obstacle(x, CONFIG.groundY, 30, 30));
    x += 400;
    gameLevel.push(new Obstacle(x, CONFIG.groundY, 20, 100, 'checkpoint', false, cpId++));
    x += 500;

    // OPTICAL ILLUSION SEGMENT
    gameLevel.push(new Obstacle(x, CONFIG.groundY, 30, 30, 'spike', true));
    gameLevel.push(new Obstacle(x + 150, CONFIG.groundY, 30, 30));
    x += 400;
    gameLevel.push(new Obstacle(x, CONFIG.groundY, 80, 40, 'block', true));
    gameLevel.push(new Obstacle(x + 25, CONFIG.groundY, 30, 30));
    x += 400;
    gameLevel.push(new Obstacle(x, CONFIG.groundY, 20, 100, 'checkpoint', false, cpId++));
    x += 500;

    // ROTATION MADNESS
    for (let i=0; i<4; i++) {
        gameLevel.push(new Obstacle(x, CONFIG.groundY, 80, 60, 'portal-rot-90'));
        x += 300;
        gameLevel.push(new Obstacle(x, CONFIG.groundY, 30, 30));
        x += 300;
    }

    gameLevel.push(new Obstacle(x, CONFIG.groundY, 20, 100, 'checkpoint', false, cpId++));
    x += 500;

    // FINAL GAUNTLET
    for (let i=0; i<10; i++) {
        const type = Math.random() > 0.5 ? 'portal-flip' : 'portal-rot-90';
        gameLevel.push(new Obstacle(x, CONFIG.groundY, 80, 50, type));
        x += 400;
        gameLevel.push(new Obstacle(x, CONFIG.groundY, 30, 30));
        x += 300;
    }
}

function drawBackground() {
    state.bgOffset -= CONFIG.speed * 0.3;
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 1;

    for (let i = 0; i < canvas.width + 200; i += 100) {
        ctx.beginPath();
        ctx.moveTo((i + state.bgOffset) % (canvas.width + 200), 0);
        ctx.lineTo((i + state.bgOffset) % (canvas.width + 200), canvas.height);
        ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 100) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
    }
}

const startBtn = document.getElementById('start-btn');
const mainMenu = document.getElementById('main-menu');
const gameOverScreen = document.getElementById('game-over');
const retryBtn = document.getElementById('retry-btn');
const menuBtnOver = document.getElementById('menu-btn-over');
const checkpointList = document.getElementById('checkpoint-list');
const cpContainer = document.getElementById('checkpoint-select-container');

function updateCheckpointMenu() {
    if (state.unlockedCheckpoints.length > 0) {
        cpContainer.classList.remove('hidden');
        checkpointList.innerHTML = '';
        state.unlockedCheckpoints.forEach((cp, idx) => {
            const btn = document.createElement('button');
            btn.className = 'cp-btn';
            btn.innerText = `CP ${cp.id}`;
            btn.onclick = () => startGame(cp);
            checkpointList.appendChild(btn);
        });
    }
}

function initAudio() {
    if (!state.audioInitialized) {
        bgMusic.play().catch(e => console.log("Audio play blocked."));
        state.audioInitialized = true;
    }
}

function startGame(cpData = null) {
    initAudio();
    state.screen = 'playing';
    if (cpData) {
        state.scrollX = cpData.scrollX;
        state.isGravityFlipped = cpData.gravity;
        state.targetRotation = cpData.rotation;
        state.worldRotation = cpData.rotation;
        state.lastCheckpoint = cpData;
    } else {
        state.scrollX = 0;
        state.isGravityFlipped = false;
        state.worldRotation = 0;
        state.targetRotation = 0;
        state.lastCheckpoint = { scrollX: 0, gravity: false, rotation: 0 };
        bgMusic.currentTime = 0;
    }
    player.y = state.isGravityFlipped ? CONFIG.ceilingY : CONFIG.groundY - player.height;
    player.vy = 0;
    generateLevel();
    // Mark passed obstacles as used
    gameLevel.forEach(o => {
        if (o.x < state.scrollX + 150) o.active = false;
    });
    mainMenu.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
}

startBtn.addEventListener('click', () => startGame(null));
retryBtn.addEventListener('click', () => startGame(state.lastCheckpoint));
menuBtnOver.addEventListener('click', () => {
    state.screen = 'menu';
    gameOverScreen.classList.add('hidden');
    mainMenu.classList.remove('hidden');
});

function loop() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (state.screen === 'playing') {
        state.scrollX += CONFIG.speed;
        player.update();

        ctx.save();
        if (state.shake > 0) {
            ctx.translate(Math.random() * state.shake - state.shake/2, Math.random() * state.shake - state.shake/2);
        }

        drawBackground();

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((state.worldRotation * Math.PI) / 180);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);

        ctx.strokeStyle = '#111';
        ctx.beginPath(); ctx.moveTo(-10000, CONFIG.groundY); ctx.lineTo(1000000, CONFIG.groundY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-10000, CONFIG.ceilingY); ctx.lineTo(1000000, CONFIG.ceilingY); ctx.stroke();

        ctx.restore();

        gameLevel.forEach(obs => {
            obs.draw();
            if (obs.checkCollision(player)) {
                state.screen = 'gameover';
                gameOverScreen.classList.remove('hidden');
                state.shake = 20;
            }
        });

        player.draw();
        ctx.restore();
    }

    requestAnimationFrame(loop);
}

window.addEventListener('keydown', e => {
    if (e.code === 'Space') {
        if (state.screen === 'playing') player.jump();
        else if (state.screen === 'menu') startGame(null);
        else if (state.screen === 'gameover') startGame(state.lastCheckpoint);
    }
});

loop();
