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

// Game State
let gameState = 'START'; // START, PLAYING, DEAD
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

function initLevel() {
    obstacles = [];
    transitions = [];
    gameDistance = 0;
    player.mode = MODES.CUBE;
    player.gravityDir = 1;

    let curX = 1200;

    // Part 1: Cube - Intro (Rhythmic Complexity)
    addSection(curX, [
        { x: 400, y: 0, type: 'spike' },
        { x: 800, y: 0, type: 'spike' },
        { x: 1200, y: 0, type: 'block', h: 50 },
        { x: 1300, y: 0, type: 'block', h: 100 },
        { x: 1400, y: 0, type: 'block', h: 150 }, // Staircase
        { x: 1700, y: 0, type: 'spike' },
        { x: 2000, y: 0, type: 'ring', h: 120 },
        { x: 2200, y: 150, type: 'block', w: 100, h: 20 },
        { x: 2500, y: 0, type: 'spike' },
        { x: 2550, y: 0, type: 'spike' },
        { x: 2600, y: 0, type: 'spike' }, // Triple spike!
    ]);
    curX += 3000;

    // Part 2: Cube - Verticality
    addSection(curX, [
        { x: 200, y: 0, type: 'pad' },
        { x: 450, y: 150, type: 'block', w: 100, h: 30 },
        { x: 450, y: 180, type: 'spike' }, // Spike on block
        { x: 750, y: 150, type: 'ring', h: 60 },
        { x: 1000, y: 250, type: 'block', w: 100, h: 30 },
        { x: 1250, y: 250, type: 'ring', h: 60 },
        { x: 1500, y: 350, type: 'block', w: 100, h: 30 },
        { x: 1800, y: 0, type: 'spike' },
    ]);
    curX += 2000;
    transitions.push({ x: curX, mode: MODES.SHIP });
    curX += 1500;

    // Part 3: Ship - The Cave
    for(let i=0; i<10; i++) {
        let yBase = Math.sin(i * 0.8) * 100 + 150;
        addSection(curX + i*800, [
            { x: 0, y: 0, type: 'block', h: yBase - 60 },
            { x: 0, y: yBase + 100, type: 'block', h: 300 - yBase },
            { x: 400, y: yBase + 20, type: 'spike' }
        ]);
    }
    curX += 9000;
    transitions.push({ x: curX, mode: MODES.BALL });
    curX += 1500;

    // Part 4: Ball - Gravity Corridors
    for(let i=0; i<10; i++) {
        addSection(curX + i*800, [
            { x: 0, y: i%2==0 ? 0 : 350, type: 'spike' },
            { x: 400, y: i%2==0 ? 350 : 0, type: 'block', h: 50 }
        ]);
    }
    curX += 8500;
    transitions.push({ x: curX, mode: MODES.UFO });
    curX += 1500;

    // Part 5: UFO - The Bounce (Vertical Complexity)
    for(let i=0; i<10; i++) {
        addSection(curX + i*900, [
            { x: 0, y: 180, type: 'block', w: 100, h: 20 },
            { x: 150, y: 300, type: 'spike' }, // Floating spike
            { x: 300, y: 0, type: 'spike' },
            { x: 600, y: 350, type: 'spike' },
            { x: 450, y: 150, type: 'ring', h: 40 },
            { x: 750, y: 200, type: 'ring', h: 40 } // Chain
        ]);
    }
    curX += 9500;
    transitions.push({ x: curX, mode: MODES.WAVE });
    curX += 1500;

    // Part 6: Wave - The Narrow Slalom
    for(let i=0; i<12; i++) {
        addSection(curX + i*700, [
            { x: 0, y: i%2==0 ? 0 : 250, type: 'block', w: 400, h: 150 },
            { x: 350, y: i%2==0 ? 350 : 0, type: 'spike' }
        ]);
    }
    curX += 9000;

    // Part 7: Final Sprint - Mixed Cube
    transitions.push({ x: curX, mode: MODES.CUBE });
    curX += 1000;
    addSection(curX, [
        { x: 200, y: 0, type: 'pad' },
        { x: 500, y: 0, type: 'pad' },
        { x: 800, y: 0, type: 'pad' },
        { x: 1100, y: 250, type: 'ring', h: 40 },
        { x: 1300, y: 250, type: 'ring', h: 40 },
        { x: 1500, y: 250, type: 'ring', h: 40 },
        { x: 1800, y: 0, type: 'spike' },
        { x: 1850, y: 0, type: 'spike' },
        { x: 1900, y: 0, type: 'spike' },
    ]);
    curX += 3000;

    totalLevelLength = curX + 2000;
}

function startGame() {
    gameState = 'PLAYING';
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
    for (let i = 0; i < 50; i++) {
        particles.push(new Particle(
            player.x + player.width / 2, player.y + player.height / 2, player.color,
            Math.random() * 15 + 5, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40
        ));
    }
}

function runBot() {
    if (!botMode) return;

    const futureX = 80; // How far to look ahead
    const scanX = player.x + futureX;

    let danger = false;
    obstacles.forEach(obs => {
        const obsX = obs.x - gameDistance;
        const obsY = canvas.height - GROUND_HEIGHT - obs.y;

        if (obsX > player.x && obsX < player.x + 200) {
            // Very simple jump logic
            if (obs.type === 'spike' || obs.type === 'block') {
                if (obsX < player.x + 100) danger = true;
            }
            if (obs.type === 'ring') {
                 if (obsX < player.x + 50 && player.y > obsY) danger = true;
            }
        }
    });

    if (player.mode === MODES.CUBE || player.mode === MODES.UFO || player.mode === MODES.BALL) {
        if (danger) jumpPressed = true;
        else if (player.mode !== MODES.BALL) jumpPressed = false;

        if (player.mode === MODES.BALL && !danger) jumpPressed = false;
    } else if (player.mode === MODES.SHIP) {
        // Simple hover
        const targetY = 250;
        if (player.y > targetY + 20) jumpPressed = true;
        else if (player.y < targetY - 20) jumpPressed = false;

        if (danger) jumpPressed = !jumpPressed;
    } else if (player.mode === MODES.WAVE) {
        const targetY = 250;
        if (player.y > targetY) jumpPressed = true;
        else jumpPressed = false;
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
