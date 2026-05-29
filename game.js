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
const PLAYER_SIZE = 50;
const ROTATION_SPEED = 0.15;
const SPEED = 7;

// Game State
let player = {
    x: 150,
    y: 0,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    velocityY: 0,
    isGrounded: true,
    rotation: 0,
    color: '#00ffff',
    trail: [],
    dead: false
};

let obstacles = [];
let gameDistance = 0;
let levelLength = 20000;
let particles = [];
let screenShake = 0;
let deathFlash = 0;

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
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.2; // gravity
        this.vx *= 0.98;
        this.life -= this.decay;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.life * 10);
        ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
        ctx.restore();
    }
}

function initLevel() {
    obstacles = [];
    gameDistance = 0;
    // Simple level pattern
    for (let x = 800; x < levelLength; x += 400 + Math.random() * 300) {
        const r = Math.random();
        if (r < 0.4) {
            obstacles.push({ x, type: 'spike' });
        } else if (r < 0.7) {
            obstacles.push({ x, type: 'block' });
        } else {
            obstacles.push({ x, type: 'block' });
            obstacles.push({ x: x + 50, type: 'block' });
            obstacles.push({ x: x + 25, y: 50, type: 'spike' });
        }
    }
}

initLevel();

let jumpPressed = false;
window.addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'ArrowUp') jumpPressed = true; });
window.addEventListener('keyup', (e) => { if (e.code === 'Space' || e.code === 'ArrowUp') jumpPressed = false; });
window.addEventListener('mousedown', () => jumpPressed = true);
window.addEventListener('mouseup', () => jumpPressed = false);
window.addEventListener('touchstart', (e) => { jumpPressed = true; e.preventDefault(); }, {passive: false});
window.addEventListener('touchend', () => { jumpPressed = false; });

function createLandingEffect() {
    for (let i = 0; i < 10; i++) {
        particles.push(new Particle(
            player.x + player.width / 2,
            player.y + player.height,
            '#fff',
            Math.random() * 4 + 1,
            (Math.random() - 0.5) * 8,
            (Math.random() - 1) * 4
        ));
    }
}

function createDeathEffect() {
    screenShake = 25;
    deathFlash = 1.0;
    for (let i = 0; i < 40; i++) {
        particles.push(new Particle(
            player.x + player.width / 2,
            player.y + player.height / 2,
            player.color,
            Math.random() * 15 + 5,
            (Math.random() - 0.5) * 30,
            (Math.random() - 0.5) * 30
        ));
    }
}

function resetGame() {
    player.dead = false;
    player.y = 0;
    player.velocityY = 0;
    player.rotation = 0;
    player.trail = [];
    gameDistance = 0;
    initLevel();
}

function update() {
    if (screenShake > 0) screenShake *= 0.9;
    if (deathFlash > 0) deathFlash -= 0.05;

    if (player.dead) {
        particles.forEach(p => p.update());
        particles = particles.filter(p => p.life > 0);
        if (particles.length === 0 && screenShake < 1) resetGame();
        return;
    }

    gameDistance += SPEED;

    if (jumpPressed && player.isGrounded) {
        player.velocityY = JUMP_FORCE;
        player.isGrounded = false;
    }

    player.velocityY += GRAVITY;
    player.y += player.velocityY;

    const groundLevel = canvas.height - GROUND_HEIGHT;

    // Check ground
    if (player.y + player.height > groundLevel) {
        if (!player.isGrounded) {
            createLandingEffect();
            player.rotation = Math.round(player.rotation / (Math.PI / 2)) * (Math.PI / 2);
        }
        player.y = groundLevel - player.height;
        player.velocityY = 0;
        player.isGrounded = true;
    } else {
        // We might be falling off a block
        player.isGrounded = false;
    }

    // Obstacle collision & Block standing
    obstacles.forEach(obs => {
        const obsX = obs.x - gameDistance;
        const obsY = groundLevel - (obs.y || 0);

        if (obsX > player.x - 100 && obsX < player.x + 100) {
            if (obs.type === 'spike') {
                if (player.x + player.width > obsX + 15 && player.x < obsX + 35 &&
                    player.y + player.height > obsY - 40 && player.y < obsY) {
                    player.dead = true;
                    createDeathEffect();
                }
            } else if (obs.type === 'block') {
                if (player.x + player.width > obsX && player.x < obsX + 50 &&
                    player.y + player.height > obsY - 50 && player.y < obsY) {

                    if (player.y + player.height < obsY - 20 && player.velocityY >= 0) {
                        player.y = obsY - 50 - player.height;
                        player.velocityY = 0;
                        player.isGrounded = true;
                    } else {
                        player.dead = true;
                        createDeathEffect();
                    }
                }
            }
        }
    });

    if (!player.isGrounded) {
        player.rotation += ROTATION_SPEED;
    }

    // Trail
    player.trail.push({ x: player.x, y: player.y, rotation: player.rotation, life: 1.0 });
    if (player.trail.length > 15) player.trail.shift();
    player.trail.forEach(t => t.life -= 0.07);

    particles.forEach(p => p.update());
    particles = particles.filter(p => p.life > 0);

    if (gameDistance > levelLength) resetGame();
}

function draw() {
    ctx.save();
    if (screenShake > 1) {
        ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
    }

    const hue = (gameDistance / 100) % 360;
    ctx.fillStyle = `hsl(${hue}, 30%, 5%)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const bgOffset = (gameDistance * 0.5) % 100;
    ctx.strokeStyle = `hsl(${hue}, 30%, 15%)`;
    ctx.lineWidth = 1;
    for (let x = -bgOffset; x < canvas.width; x += 100) {
        ctx.beginPath();
        ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }

    const groundY = canvas.height - GROUND_HEIGHT;
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, groundY, canvas.width, GROUND_HEIGHT);
    ctx.strokeStyle = player.color;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(canvas.width, groundY); ctx.stroke();

    // Progress Bar
    ctx.fillStyle = '#222';
    ctx.fillRect(canvas.width/2 - 200, 30, 400, 10);
    ctx.fillStyle = player.color;
    ctx.fillRect(canvas.width/2 - 200, 30, (gameDistance / levelLength) * 400, 10);

    obstacles.forEach(obs => {
        const obsX = obs.x - gameDistance;
        const obsY = groundY - (obs.y || 0);
        if (obsX > -100 && obsX < canvas.width + 100) {
            if (obs.type === 'spike') {
                ctx.fillStyle = '#ff3366';
                ctx.beginPath();
                ctx.moveTo(obsX, obsY);
                ctx.lineTo(obsX + 25, obsY - 50);
                ctx.lineTo(obsX + 50, obsY);
                ctx.fill();
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
            } else if (obs.type === 'block') {
                ctx.fillStyle = '#222';
                ctx.fillRect(obsX, obsY - 50, 50, 50);
                ctx.strokeStyle = player.color; ctx.lineWidth = 2;
                ctx.strokeRect(obsX, obsY - 50, 50, 50);
            }
        }
    });

    // Trail
    player.trail.forEach(t => {
        ctx.save();
        ctx.globalAlpha = t.life * 0.3;
        ctx.translate(t.x + player.width/2, t.y + player.height/2);
        ctx.rotate(t.rotation);
        ctx.fillStyle = player.color;
        ctx.fillRect(-player.width/2, -player.height/2, player.width, player.height);
        ctx.restore();
    });

    particles.forEach(p => p.draw());

    if (!player.dead) {
        ctx.save();
        ctx.translate(player.x + player.width/2, player.y + player.height/2);
        ctx.rotate(player.rotation);
        ctx.shadowBlur = 20; ctx.shadowColor = player.color;
        ctx.fillStyle = player.color;
        ctx.fillRect(-player.width/2, -player.height/2, player.width, player.height);
        ctx.strokeStyle = '#000'; ctx.lineWidth = 5;
        ctx.strokeRect(-player.width/2 + 5, -player.height/2 + 5, player.width - 10, player.height - 10);
        ctx.fillStyle = '#000';
        ctx.fillRect(-12, -10, 8, 8); ctx.fillRect(4, -10, 8, 8);
        ctx.restore();
    }

    if (deathFlash > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${deathFlash * 0.5})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.restore();
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

loop();
