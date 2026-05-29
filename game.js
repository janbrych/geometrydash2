const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 800;
canvas.height = 600;

// Audio tracks
const tracks = [
    new Audio('music.mp3'),
    new Audio('music2.mp3'),
    new Audio('music3.mp3')
];
tracks.forEach(t => { t.loop = true; t.volume = 0.5; });

// Game Config
const CONFIG = {
    gravity: 0.6,
    jumpForce: -10,
    speed: 6.5,
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
    worldScale: 1,
    targetScale: 1,
    lastCheckpoint: { scrollX: 0, gravity: false, rotation: 0, mode: 'cube', track: 0, color: '#fff' },
    unlockedCheckpoints: JSON.parse(localStorage.getItem('unlockedCheckpoints') || '[]'),
    shake: 0,
    audioInitialized: false,
    currentTrack: 0,
    themeColor: '#fff',
    targetThemeColor: '#fff',
    pulse: 0
};

const player = {
    x: 100, y: 400, width: CONFIG.playerSize, height: CONFIG.playerSize, vy: 0, onGround: false, rotation: 0, mode: 'cube',
    update(isHolding) {
        const g = state.isGravityFlipped ? -CONFIG.gravity : CONFIG.gravity;

        if (this.mode === 'cube') {
            this.vy += g; this.y += this.vy;
            this.handleGroundCollision();
        } else if (this.mode === 'ship') {
            const f = 0.5;
            if (isHolding) this.vy -= state.isGravityFlipped ? -f : f;
            else this.vy += state.isGravityFlipped ? -f : f;
            this.vy *= 0.96; this.y += this.vy;
            this.handleGroundCollision();
            this.rotation = this.vy * 3;
        } else if (this.mode === 'ball') {
            this.vy += g; this.y += this.vy;
            this.handleGroundCollision();
        } else if (this.mode === 'wave') {
            const s = 7;
            if (isHolding) this.y -= state.isGravityFlipped ? -s : s;
            else this.y += state.isGravityFlipped ? -s : s;
            this.handleGroundCollision();
            this.rotation = isHolding ? (state.isGravityFlipped ? 45 : -45) : (state.isGravityFlipped ? -45 : 45);
        }

        // Smooth Camera Transitions
        if (state.worldRotation !== state.targetRotation) {
            state.worldRotation += (state.targetRotation - state.worldRotation) * 0.05;
        }
        if (state.worldScale !== state.targetScale) {
            state.worldScale += (state.targetScale - state.worldScale) * 0.05;
        }

        if (state.shake > 0) state.shake *= 0.9;
        state.pulse = Math.sin(Date.now() / 100) * 10;
    },
    handleGroundCollision() {
        if (!state.isGravityFlipped) {
            if (this.y > CONFIG.groundY - this.height) {
                this.y = CONFIG.groundY - this.height; this.vy = 0; this.onGround = true;
                if (this.mode === 'cube') this.rotation = Math.round(this.rotation / 90) * 90;
            } else this.onGround = false;
        } else {
            if (this.y < CONFIG.ceilingY) {
                this.y = CONFIG.ceilingY; this.vy = 0; this.onGround = true;
                if (this.mode === 'cube') this.rotation = Math.round(this.rotation / 90) * 90;
            } else this.onGround = false;
        }
        if (this.y < -1200 || this.y > 1800) die();
    },
    jump() {
        if (this.mode === 'cube' && this.onGround) this.vy = state.isGravityFlipped ? -CONFIG.jumpForce : CONFIG.jumpForce;
        else if (this.mode === 'ball' && this.onGround) {
            state.isGravityFlipped = !state.isGravityFlipped;
            this.vy = 0;
        }
    },
    draw() {
        ctx.save();
        applyWorldTransforms();
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate((this.rotation * Math.PI) / 180);

        ctx.shadowBlur = 20 + state.pulse;
        ctx.shadowColor = state.themeColor;
        ctx.strokeStyle = state.themeColor;
        ctx.lineWidth = 3;

        const s = this.width / 2;
        if (this.mode === 'cube') {
            ctx.strokeRect(-s, -s, this.width, this.height);
            ctx.fillStyle = state.themeColor;
            ctx.fillRect(-s/2, -s/2, s, s);
        } else if (this.mode === 'ship') {
            ctx.beginPath();
            ctx.moveTo(-s, 0); ctx.lineTo(s, -s/2); ctx.lineTo(s, s/2); ctx.closePath();
            ctx.stroke(); ctx.fill();
        } else if (this.mode === 'ball') {
            ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.stroke();
            ctx.fill();
        } else if (this.mode === 'wave') {
            ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.lineTo(0, -s); ctx.closePath();
            ctx.stroke();
        }
        ctx.restore();
        ctx.restore();
    }
};

function applyWorldTransforms() {
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((state.worldRotation * Math.PI) / 180);
    ctx.scale(state.worldScale, state.worldScale);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
}

class Obstacle {
    constructor(x, y, width, height, type = 'spike', isFake = false, id = null, data = {}) {
        this.x = x; this.y = y; this.width = width; this.height = height;
        this.type = type; this.active = true; this.isFake = isFake; this.id = id; this.data = data;
    }
    draw() {
        const drawX = this.x - state.scrollX;
        if (drawX + this.width < -1200 || drawX > canvas.width + 1200) return;
        ctx.save();
        applyWorldTransforms();
        if (this.type === 'spike') {
            ctx.fillStyle = this.isFake ? '#050505' : '#ff1111';
            ctx.beginPath(); ctx.moveTo(drawX, this.y); ctx.lineTo(drawX + this.width / 2, this.y - this.height); ctx.lineTo(drawX + this.width, this.y); ctx.fill();
        } else if (this.type === 'block') {
            ctx.strokeStyle = this.isFake ? '#020202' : state.themeColor;
            ctx.strokeRect(drawX, this.y - this.height, this.width, this.height);
            if(!this.isFake) { ctx.fillStyle = 'rgba(255,255,255,0.02)'; ctx.fillRect(drawX, this.y-this.height, this.width, this.height); }
        } else if (this.type.startsWith('portal')) {
            let color = '#fff';
            if (this.type === 'portal-flip') color = '#00ffff';
            if (this.type === 'portal-rot-90') color = '#ff00ff';
            if (this.type === 'portal-mode') color = '#00ff00';
            if (this.type === 'portal-zoom') color = '#ffff00';

            ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.setLineDash([15, 5]);
            ctx.strokeRect(drawX, this.y - this.height, this.width, this.height);
            ctx.setLineDash([]);
            ctx.fillStyle = this.active ? 'rgba(255, 255, 255, 0.15)' : 'rgba(50, 50, 50, 0.05)';
            ctx.fillRect(drawX, this.y - this.height, this.width, this.height);
        } else if (this.type === 'checkpoint') {
            ctx.fillStyle = this.active ? '#ffff00' : '#111100';
            ctx.fillRect(drawX, this.y - 300, 4, 300);
        }
        ctx.restore();
    }
    checkCollision(p) {
        if (this.isFake) return false;
        if (!this.active && this.type.startsWith('portal')) return false;
        const drawX = this.x - state.scrollX;
        const rect1 = { x: p.x, y: p.y, w: p.width, h: p.height };
        const rect2 = { x: drawX, y: Math.min(this.y, this.y - this.height), w: this.width, h: Math.abs(this.height) };
        if (this.type === 'checkpoint') { rect2.y = this.y - 300; rect2.h = 300; }

        if (rect1.x < rect2.x + rect2.w && rect1.x + rect1.w > rect2.x && rect1.y < rect2.y + rect2.h && rect1.y + rect1.h > rect2.y) {
            if (this.type === 'portal-flip') { state.isGravityFlipped = !state.isGravityFlipped; this.active = false; state.shake = 15; return false; }
            if (this.type === 'portal-rot-90') { state.targetRotation += 90; this.active = false; state.shake = 20; return false; }
            if (this.type === 'portal-zoom') { state.targetScale = this.data.scale || 1; this.active = false; return false; }
            if (this.type === 'portal-mode') {
                p.mode = this.data.mode; if (this.data.color) state.targetThemeColor = this.data.color;
                if (this.data.track !== undefined) switchTrack(this.data.track);
                this.active = false; return false;
            }
            if (this.type === 'checkpoint') {
                if (this.active) {
                    const cpData = { scrollX: this.x - 100, gravity: state.isGravityFlipped, rotation: state.targetRotation, scale: state.targetScale, mode: p.mode, track: state.currentTrack, color: state.targetThemeColor, id: this.id };
                    state.lastCheckpoint = cpData;
                    if (!state.unlockedCheckpoints.some(c => c.id === this.id)) {
                        state.unlockedCheckpoints.push(cpData);
                        localStorage.setItem('unlockedCheckpoints', JSON.stringify(state.unlockedCheckpoints));
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

function die() {
    state.screen = 'gameover';
    document.getElementById('game-over').classList.remove('hidden');
    state.shake = 40;
}

function switchTrack(index) {
    if (state.currentTrack === index) return;
    tracks[state.currentTrack].pause();
    state.currentTrack = index;
    tracks[state.currentTrack].currentTime = 0;
    tracks[state.currentTrack].play().catch(e => {});
}

function generateLevel() {
    gameLevel = []; let x = 600; let id = 1;
    // SESSION 1: THE UNDERGROUND (Cube)
    for(let i=0; i<3; i++) { gameLevel.push(new Obstacle(x, CONFIG.groundY, 30, 30)); x += 500; }
    gameLevel.push(new Obstacle(x, CONFIG.groundY, 20, 100, 'checkpoint', false, id++)); x += 600;

    // SESSION 2: VERTICAL DESCENT (Ship)
    gameLevel.push(new Obstacle(x, CONFIG.groundY, 80, 50, 'portal-mode', false, null, { mode: 'ship', color: '#00ff00', track: 1 })); x += 400;
    gameLevel.push(new Obstacle(x, CONFIG.groundY, 80, 50, 'portal-zoom', false, null, { scale: 0.7 })); x += 300;
    for(let i=0; i<8; i++) {
        gameLevel.push(new Obstacle(x, 150 + Math.random()*300, 60, 60, 'block'));
        if (i%2==0) gameLevel.push(new Obstacle(x+150, CONFIG.groundY, 80, 50, 'portal-flip'));
        x += 400;
    }
    gameLevel.push(new Obstacle(x, CONFIG.groundY, 20, 100, 'checkpoint', false, id++)); x += 600;

    // SESSION 3: OPTICAL VORTEX (Ball)
    gameLevel.push(new Obstacle(x, CONFIG.groundY, 80, 50, 'portal-mode', false, null, { mode: 'ball', color: '#ff00ff', track: 2 })); x += 400;
    gameLevel.push(new Obstacle(x, CONFIG.groundY, 80, 50, 'portal-zoom', false, null, { scale: 1.2 })); x += 300;
    for(let i=0; i<6; i++) {
        gameLevel.push(new Obstacle(x, CONFIG.groundY, 30, 30, 'spike', true)); // Deception
        gameLevel.push(new Obstacle(x+150, CONFIG.groundY, 80, 60, 'portal-rot-90')); x += 500;
        gameLevel.push(new Obstacle(x, (i%2==0?CONFIG.groundY:CONFIG.ceilingY+30), 30, (i%2==0?30:-30))); x += 500;
    }
    gameLevel.push(new Obstacle(x, CONFIG.groundY, 20, 100, 'checkpoint', false, id++)); x += 600;

    // SESSION 4: THE MOSHPIT (Wave)
    gameLevel.push(new Obstacle(x, CONFIG.groundY, 80, 50, 'portal-mode', false, null, { mode: 'wave', color: '#00ffff', track: 0 })); x += 400;
    gameLevel.push(new Obstacle(x, CONFIG.groundY, 80, 50, 'portal-zoom', false, null, { scale: 0.5 })); x += 300;
    for(let i=0; i<20; i++) {
        if(i%4==0) gameLevel.push(new Obstacle(x, CONFIG.groundY, 80, 50, 'portal-flip'));
        if(i%6==0) gameLevel.push(new Obstacle(x, CONFIG.groundY, 80, 60, 'portal-rot-90'));
        gameLevel.push(new Obstacle(x, 300, 100, 200, 'block', Math.random()>0.8));
        x += 400;
    }
    gameLevel.push(new Obstacle(x, CONFIG.groundY, 20, 100, 'checkpoint', false, id++)); x += 600;
}

const startBtn = document.getElementById('start-btn'), mainMenu = document.getElementById('main-menu'), gameOverScreen = document.getElementById('game-over'), retryBtn = document.getElementById('retry-btn'), menuBtnOver = document.getElementById('menu-btn-over'), checkpointList = document.getElementById('checkpoint-list'), cpContainer = document.getElementById('checkpoint-select-container');

function updateCheckpointMenu() {
    if (state.unlockedCheckpoints.length > 0) {
        cpContainer.classList.remove('hidden'); checkpointList.innerHTML = '';
        state.unlockedCheckpoints.sort((a,b) => a.id - b.id).forEach(cp => {
            const b = document.createElement('button'); b.className = 'cp-btn'; b.innerText = `SESSION ${cp.id}`; b.onclick = () => startGame(cp);
            checkpointList.appendChild(b);
        });
    }
}

function startGame(cp = null) {
    if (!state.audioInitialized) { tracks[0].play().catch(e => {}); state.audioInitialized = true; }
    state.screen = 'playing';
    if (cp) {
        state.scrollX = cp.scrollX; state.isGravityFlipped = cp.gravity; state.targetRotation = cp.rotation; state.worldRotation = cp.rotation;
        state.targetScale = cp.scale || 1; state.worldScale = cp.scale || 1;
        player.mode = cp.mode; state.targetThemeColor = cp.color || '#fff'; switchTrack(cp.track || 0); state.lastCheckpoint = cp;
    } else {
        state.scrollX = 0; state.isGravityFlipped = false; state.worldRotation = 0; state.targetRotation = 0; state.worldScale = 1; state.targetScale = 1;
        player.mode = 'cube'; state.targetThemeColor = '#fff'; switchTrack(0); state.lastCheckpoint = { scrollX: 0, gravity: false, rotation: 0, scale: 1, mode: 'cube', track: 0, color: '#fff' };
    }
    player.y = state.isGravityFlipped ? CONFIG.ceilingY : CONFIG.groundY - player.height; player.vy = 0; generateLevel();
    gameLevel.forEach(o => { if (o.x < state.scrollX + 200) o.active = false; });
    mainMenu.classList.add('hidden'); gameOverScreen.classList.add('hidden');
}

startBtn.onclick = () => startGame(); retryBtn.onclick = () => startGame(state.lastCheckpoint);
menuBtnOver.onclick = () => { state.screen = 'menu'; gameOverScreen.classList.add('hidden'); mainMenu.classList.remove('hidden'); updateCheckpointMenu(); };

let isHolding = false;
window.onmousedown = () => isHolding = true; window.onmouseup = () => isHolding = false;
window.onkeydown = e => { if (e.code === 'Space') { if (state.screen === 'playing') { isHolding = true; player.jump(); } else startGame(state.screen === 'gameover' ? state.lastCheckpoint : null); } };
window.onkeyup = e => { if (e.code === 'Space') isHolding = false; };

function loop() {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (state.screen === 'playing') {
        state.scrollX += CONFIG.speed; player.update(isHolding);
        ctx.save();
        if (state.shake > 0) ctx.translate(Math.random()*state.shake - state.shake/2, Math.random()*state.shake - state.shake/2);

        // Dynamic Grid
        ctx.strokeStyle = '#020202'; ctx.lineWidth = 1;
        for(let i=0; i<canvas.width+400; i+=100) { ctx.beginPath(); ctx.moveTo((i-state.scrollX*0.1)%1200, 0); ctx.lineTo((i-state.scrollX*0.1)%1200, canvas.height); ctx.stroke(); }

        ctx.save(); applyWorldTransforms();
        ctx.strokeStyle = '#060606'; ctx.beginPath(); ctx.moveTo(-10000, CONFIG.groundY); ctx.lineTo(1000000, CONFIG.groundY); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-10000, CONFIG.ceilingY); ctx.lineTo(1000000, CONFIG.ceilingY); ctx.stroke();
        ctx.restore();

        gameLevel.forEach(o => { o.draw(); if (o.checkCollision(player)) die(); });
        player.draw(); ctx.restore();
    }
    requestAnimationFrame(loop);
}
updateCheckpointMenu(); loop();
