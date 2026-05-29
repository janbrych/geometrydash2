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
const GROUND_HEIGHT = 100;
const CEILING_HEIGHT = 100;
const PLAYER_SIZE = 40;
const ROTATION_SPEED = 0.15;
const SPEED = 7;

const MODES = {
    CUBE: 'cube',
    SHIP: 'ship',
    BALL: 'ball',
    UFO: 'ufo',
    WAVE: 'wave'
};

// Game State
let player = {
    x: 150,
    y: 400,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    velocityY: 0,
    isGrounded: true,
    rotation: 0,
    gravityDir: 1,
    color: '#00ffff',
    trail: [],
    dead: false,
    mode: MODES.CUBE
};

let obstacles = [];
let transitions = [];
let gameDistance = 0;
let totalLevelLength = 40000;
let particles = [];
let screenShake = 0;
let deathFlash = 0;
let transitionFlash = 0;

// Input
let jumpPressed = false;
let jumpProcessed = false;

window.addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'ArrowUp') jumpPressed = true; });
window.addEventListener('keyup', (e) => { if (e.code === 'Space' || e.code === 'ArrowUp') { jumpPressed = false; jumpProcessed = false; } });
window.addEventListener('mousedown', () => { jumpPressed = true; });
window.addEventListener('mouseup', () => { jumpPressed = false; jumpProcessed = false; });
window.addEventListener('touchstart', (e) => { jumpPressed = true; e.preventDefault(); }, {passive: false});
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

function initLevel() {
    obstacles = [];
    transitions = [];
    gameDistance = 0;
    player.mode = MODES.CUBE;
    player.gravityDir = 1;

    let curX = 1000;

    // --- CUBE (10 Parts) ---
    for(let i=0; i<10; i++) {
        addSection(curX, [{ x: 0, y: 0, type: 'spike' }]);
        if (i > 3) addSection(curX, [{ x: 200, y: 0, type: 'block' }]);
        if (i > 6) addSection(curX, [{ x: 200, y: 50, type: 'spike' }]);
        curX += 600;
    }
    transitions.push({ x: curX, mode: MODES.SHIP });
    curX += 1000;

    // --- SHIP (10 Parts) ---
    for(let i=0; i<10; i++) {
        let gap = 150 - (i * 5); // Getting tighter
        addSection(curX, [
            { x: 0, y: 0, type: 'block', h: 100 + Math.random()*50 },
            { x: 0, y: 400 - (100 + Math.random()*50), type: 'block', h: 100 }
        ]);
        curX += 800;
    }
    transitions.push({ x: curX, mode: MODES.BALL });
    curX += 1000;

    // --- BALL (10 Parts) ---
    for(let i=0; i<10; i++) {
        addSection(curX, [{ x: 0, y: i%2==0 ? 0 : 350, type: 'spike' }]);
        if (i > 5) addSection(curX, [{ x: 200, y: i%2==0 ? 350 : 0, type: 'spike' }]);
        curX += 700;
    }
    transitions.push({ x: curX, mode: MODES.UFO });
    curX += 1000;

    // --- UFO (10 Parts) ---
    for(let i=0; i<10; i++) {
        addSection(curX, [{ x: 0, y: 150 + Math.sin(i)*100, type: 'block', w: 100, h: 40 }]);
        if (i % 3 == 0) addSection(curX, [{ x: 50, y: 150 + Math.sin(i)*100 + 40, type: 'spike' }]);
        curX += 800;
    }
    transitions.push({ x: curX, mode: MODES.WAVE });
    curX += 1000;

    // --- WAVE (10 Parts) ---
    for(let i=0; i<10; i++) {
        let y = 100 + (i%2)*200;
        addSection(curX, [{ x: 0, y: y, type: 'block', w: 400, h: 50 }]);
        curX += 600;
    }

    totalLevelLength = curX + 2000;
}

initLevel();

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
    screenShake = 25; deathFlash = 1.0;
    for (let i = 0; i < 40; i++) {
        particles.push(new Particle(
            player.x + player.width / 2, player.y + player.height / 2, player.color,
            Math.random() * 15 + 5, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30
        ));
    }
}

function resetGame() {
    player.dead = false; player.y = 200; player.velocityY = 0; player.rotation = 0;
    player.trail = []; player.gravityDir = 1; gameDistance = 0; initLevel();
}

function update() {
    if (screenShake > 0) screenShake *= 0.9;
    if (deathFlash > 0) deathFlash -= 0.05;
    if (transitionFlash > 0) transitionFlash -= 0.05;

    if (player.dead) {
        particles.forEach(p => p.update());
        particles = particles.filter(p => p.life > 0);
        if (particles.length === 0 && screenShake < 1) resetGame();
        return;
    }

    gameDistance += SPEED;

    transitions.forEach(t => {
        if (gameDistance >= t.x && gameDistance < t.x + SPEED) {
            player.mode = t.mode;
            transitionFlash = 1.0; screenShake = 10;
        }
    });

    // Physics
    switch(player.mode) {
        case MODES.CUBE:
            if (jumpPressed && player.isGrounded) { player.velocityY = JUMP_FORCE; player.isGrounded = false; }
            player.velocityY += GRAVITY;
            break;
        case MODES.SHIP:
            if (jumpPressed) player.velocityY -= 0.6; else player.velocityY += 0.6;
            player.velocityY = Math.max(-8, Math.min(8, player.velocityY));
            player.rotation = player.velocityY * 0.05;
            break;
        case MODES.BALL:
            if (jumpPressed && !jumpProcessed) { player.gravityDir *= -1; player.isGrounded = false; jumpProcessed = true; }
            player.velocityY += GRAVITY * player.gravityDir;
            break;
        case MODES.UFO:
            if (jumpPressed && !jumpProcessed) { player.velocityY = JUMP_FORCE * 0.7; jumpProcessed = true; }
            player.velocityY += GRAVITY;
            break;
        case MODES.WAVE:
            if (jumpPressed) player.velocityY = -SPEED * 1.2; else player.velocityY = SPEED * 1.2;
            player.rotation = jumpPressed ? -Math.PI/4 : Math.PI/4;
            break;
    }

    player.y += player.velocityY;

    const groundLevel = canvas.height - GROUND_HEIGHT;
    const ceilLevel = CEILING_HEIGHT;

    if (player.y + player.height > groundLevel) {
        if (!player.isGrounded) createLandingEffect();
        player.y = groundLevel - player.height; player.velocityY = 0; player.isGrounded = true;
    } else if (player.y < ceilLevel) {
        player.y = ceilLevel; player.velocityY = 0;
        if (player.mode === MODES.BALL && player.gravityDir === -1) player.isGrounded = true;
    } else {
        player.isGrounded = false;
    }

    if (player.mode === MODES.CUBE && !player.isGrounded) player.rotation += ROTATION_SPEED;
    else if (player.mode === MODES.BALL) player.rotation += 0.1 * player.gravityDir;

    obstacles.forEach(obs => {
        const obsX = obs.x - gameDistance;
        const obsY = groundLevel - obs.y;
        if (obsX > player.x - 100 && obsX < player.x + 100) {
            if (obs.type === 'spike') {
                const spikeTop = obsY - obs.h;
                if (player.x + player.width > obsX + 10 && player.x < obsX + obs.w - 10 &&
                    player.y + player.height > spikeTop && player.y < obsY) {
                    player.dead = true; createDeathEffect();
                }
            } else if (obs.type === 'block') {
                if (player.x + player.width > obsX && player.x < obsX + obs.w &&
                    player.y + player.height > obsY - obs.h && player.y < obsY) {
                    if (player.velocityY * player.gravityDir >= 0 &&
                        ((player.gravityDir === 1 && player.y + player.height < obsY - obs.h + 20) ||
                         (player.gravityDir === -1 && player.y > obsY - 20))) {
                        player.y = player.gravityDir === 1 ? obsY - obs.h - player.height : obsY;
                        player.velocityY = 0; player.isGrounded = true;
                    } else {
                        player.dead = true; createDeathEffect();
                    }
                }
            }
        }
    });

    player.trail.push({ x: player.x, y: player.y, rotation: player.rotation, life: 1.0 });
    if (player.trail.length > 10) player.trail.shift();
    player.trail.forEach(t => { t.x -= SPEED * 0.8; t.life -= 0.1; });

    particles.forEach(p => p.update());
    particles = particles.filter(p => p.life > 0);
    if (gameDistance > totalLevelLength) resetGame();
}

function draw() {
    ctx.save();
    if (screenShake > 1) ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);

    const hue = (gameDistance / 100) % 360;
    ctx.fillStyle = `hsl(${hue}, 30%, 5%)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const bgOffset = (gameDistance * 0.5) % 100;
    ctx.strokeStyle = `hsl(${hue}, 30%, 15%)`;
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

    // Progress Bar
    ctx.fillStyle = '#222'; ctx.fillRect(canvas.width/2 - 200, 30, 400, 10);
    ctx.fillStyle = player.color; ctx.fillRect(canvas.width/2 - 200, 30, (gameDistance / totalLevelLength) * 400, 10);

    obstacles.forEach(obs => {
        const obsX = obs.x - gameDistance;
        const obsY = groundY - obs.y;
        if (obsX > -100 && obsX < canvas.width + 100) {
            if (obs.type === 'spike') {
                ctx.fillStyle = '#ff3366'; ctx.beginPath();
                ctx.moveTo(obsX, obsY); ctx.lineTo(obsX + obs.w/2, obsY - obs.h); ctx.lineTo(obsX + obs.w, obsY);
                ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
            } else if (obs.type === 'block') {
                ctx.fillStyle = '#222'; ctx.fillRect(obsX, obsY - obs.h, obs.w, obs.h);
                ctx.strokeStyle = player.color; ctx.lineWidth = 2; ctx.strokeRect(obsX, obsY - obs.h, obs.w, obs.h);
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

    // Player
    if (!player.dead) {
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

    if (deathFlash > 0) { ctx.fillStyle = `rgba(255, 255, 255, ${deathFlash * 0.5})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    if (transitionFlash > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${transitionFlash})`; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#000'; ctx.font = 'bold 60px Arial'; ctx.textAlign = 'center'; ctx.fillText(player.mode.toUpperCase(), canvas.width/2, canvas.height/2);
    }
    ctx.restore();
}

function loop() { update(); draw(); requestAnimationFrame(loop); }
loop();
