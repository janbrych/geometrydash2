/* Shared Geometry Dash Physics & Simulation Engine */

const GRAVITY = 0.8;
const JUMP_FORCE = 12;
const COYOTE_TIME = 5;
const BUFFER_TIME = 5;
const PLAYER_SIZE = 40;
const DEFAULT_SPEED = 10.5;
const FIXED_DT = 1 / 60;

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

function createPlayerState(startPos = { x: 100, y: 0, mode: 'cube' }) {
    return {
        x: startPos.x || 100,
        y: startPos.y || 0,
        w: PLAYER_SIZE,
        h: PLAYER_SIZE,
        velocityY: 0,
        isGrounded: true,
        coyoteCounter: COYOTE_TIME,
        jumpBufferCounter: 0,
        gravityDir: 1,
        rotation: 0,
        mode: startPos.mode || MODES.CUBE,
        dead: false
    };
}

function stepPlayerPhysics(p, obstacles, jumpPressed, jumpProcessedState, speed = DEFAULT_SPEED) {
    if (p.dead) return;

    p.x += speed;

    // Input state counters
    if (p.isGrounded) {
        p.coyoteCounter = COYOTE_TIME;
    } else {
        if (p.coyoteCounter > 0) p.coyoteCounter--;
    }

    if (jumpPressed) {
        p.jumpBufferCounter = BUFFER_TIME;
    } else {
        if (p.jumpBufferCounter > 0) p.jumpBufferCounter--;
    }

    // Gamemode physics (World Y increases UPWARDS into the air)
    switch (p.mode) {
        case MODES.CUBE:
            p.velocityY -= GRAVITY * p.gravityDir;
            if (p.jumpBufferCounter > 0 && (p.isGrounded || p.coyoteCounter > 0)) {
                p.velocityY = JUMP_FORCE * p.gravityDir;
                p.isGrounded = false;
                p.coyoteCounter = 0;
                p.jumpBufferCounter = 0;
            }
            if (!p.isGrounded) {
                p.rotation += 0.15 * p.gravityDir;
            } else {
                p.rotation = Math.round(p.rotation / (Math.PI / 2)) * (Math.PI / 2);
            }
            break;

        case MODES.SHIP:
            if (jumpPressed) p.velocityY += 0.6; else p.velocityY -= 0.4;
            p.velocityY = Math.max(-8, Math.min(8, p.velocityY));
            p.rotation = -p.velocityY * 0.05;
            break;

        case MODES.BALL:
            p.velocityY -= GRAVITY * p.gravityDir;
            if (jumpPressed && !jumpProcessedState.value && p.isGrounded) {
                p.gravityDir *= -1;
                p.isGrounded = false;
                jumpProcessedState.value = true;
            }
            p.rotation += 0.15 * p.gravityDir;
            break;

        case MODES.UFO:
            p.velocityY -= GRAVITY * 0.8;
            if (jumpPressed && !jumpProcessedState.value) {
                p.velocityY = JUMP_FORCE * 0.75;
                jumpProcessedState.value = true;
            }
            p.rotation = -p.velocityY * 0.03;
            break;

        case MODES.WAVE:
            p.velocityY = jumpPressed ? speed * 0.8 : -speed * 0.8;
            p.rotation = jumpPressed ? 0.4 : -0.4;
            break;
    }

    p.y += p.velocityY;

    // Floor Baseline check (Y = 0)
    let groundedThisFrame = false;
    if (p.gravityDir === 1 && p.y <= 0) {
        p.y = 0;
        p.velocityY = 0;
        groundedThisFrame = true;
        if (p.mode === MODES.CUBE) {
            p.rotation = Math.round(p.rotation / (Math.PI / 2)) * (Math.PI / 2);
        }
    } else if (p.y >= 600) {
        p.y = 600;
        p.velocityY = 0;
        if (p.mode === MODES.BALL && p.gravityDir === -1) {
            groundedThisFrame = true;
        }
    }

    // Check Obstacles Collisions
    if (Array.isArray(obstacles)) {
        for (let i = 0; i < obstacles.length; i++) {
            const obs = obstacles[i];
            const obsW = obs.w || 40;
            const obsH = obs.h || 40;

            if (obs.x > p.x - 100 && obs.x < p.x + 100) {
                if (obs.type === 'portal') {
                    if (Math.abs(p.x - obs.x) < speed) {
                        p.mode = obs.mode || 'cube';
                    }
                } else if (obs.type === 'yellow_pad' || obs.type === 'pad') {
                    if (p.x + p.w > obs.x && p.x < obs.x + obsW && p.y <= obs.y + obsH + 10 && p.y + p.h >= obs.y) {
                        p.velocityY = JUMP_FORCE * 1.3;
                        p.isGrounded = false;
                    }
                } else if (obs.type === 'magenta_pad') {
                    if (p.x + p.w > obs.x && p.x < obs.x + obsW && p.y <= obs.y + obsH + 10 && p.y + p.h >= obs.y) {
                        p.velocityY = JUMP_FORCE * 0.8;
                        p.isGrounded = false;
                    }
                } else if (obs.type === 'yellow_ring' || obs.type === 'ring') {
                    if (p.x + p.w > obs.x && p.x < obs.x + obsW && p.y <= obs.y + obsH + 10 && p.y + p.h >= obs.y) {
                        if (jumpPressed && !jumpProcessedState.value) {
                            p.velocityY = JUMP_FORCE;
                            p.isGrounded = false;
                            jumpProcessedState.value = true;
                        }
                    }
                } else if (obs.type === 'magenta_ring') {
                    if (p.x + p.w > obs.x && p.x < obs.x + obsW && p.y <= obs.y + obsH + 10 && p.y + p.h >= obs.y) {
                        if (jumpPressed && !jumpProcessedState.value) {
                            p.velocityY = JUMP_FORCE * 0.7;
                            p.isGrounded = false;
                            jumpProcessedState.value = true;
                        }
                    }
                } else if (obs.type === 'spike') {
                    const margin = 8;
                    if (p.x + p.w - margin > obs.x + margin && p.x + margin < obs.x + obsW - margin &&
                        p.y + p.h - margin > obs.y + margin && p.y + margin < obs.y + obsH - margin) {
                        p.dead = true;
                        return;
                    }
                } else if (obs.type === 'block') {
                    if (p.x + p.w > obs.x && p.x < obs.x + obsW) {
                        // Landing on top of block
                        if (p.gravityDir === 1 && p.y <= obs.y + obsH + 5 && p.y >= obs.y + obsH - 12 && p.velocityY <= 0) {
                            p.y = obs.y + obsH;
                            p.velocityY = 0;
                            groundedThisFrame = true;
                            if (p.mode === MODES.CUBE) {
                                p.rotation = Math.round(p.rotation / (Math.PI / 2)) * (Math.PI / 2);
                            }
                            continue;
                        }
                        // Attached to bottom of block (inverted gravity)
                        else if (p.gravityDir === -1 && p.y + p.h >= obs.y - 5 && p.y + p.h <= obs.y + 12 && p.velocityY >= 0) {
                            p.y = obs.y - p.h;
                            p.velocityY = 0;
                            groundedThisFrame = true;
                            continue;
                        }
                    }

                    // Side / head-on collision
                    const sideMargin = 6;
                    if (p.x + p.w - sideMargin > obs.x && p.x + sideMargin < obs.x + obsW &&
                        p.y + p.h - 5 > obs.y && p.y + 5 < obs.y + obsH) {
                        p.dead = true;
                        return;
                    }
                }
            }
        }
    }

    p.isGrounded = groundedThisFrame;
}

class GameSimulator {
    constructor() {
        this.reset();
    }

    reset(startPos = { x: 100, y: 0, mode: 'cube' }) {
        this.player = createPlayerState(startPos);
        this.obstacles = [];
        this.transitions = [];
        this.gameDistance = this.player.x;
        this.jumpPressed = false;
        this.jumpProcessedState = { value: false };
        this.dead = false;
    }

    addSection(startX, list) {
        list.forEach(obs => {
            this.obstacles.push({
                x: startX + obs.x,
                y: obs.y,
                type: obs.type,
                w: obs.w || 40,
                h: obs.h || 40,
                mode: obs.mode
            });
        });
    }

    step(jumpInput, speed = DEFAULT_SPEED) {
        if (this.dead) return;

        if (jumpInput && !this.jumpPressed) {
            this.jumpProcessedState.value = false;
        }
        this.jumpPressed = jumpInput;

        stepPlayerPhysics(this.player, this.obstacles, this.jumpPressed, this.jumpProcessedState, speed);
        this.gameDistance = this.player.x;
        this.dead = this.player.dead;
    }
}

const PhysicsEngine = {
    GRAVITY,
    JUMP_FORCE,
    COYOTE_TIME,
    BUFFER_TIME,
    PLAYER_SIZE,
    DEFAULT_SPEED,
    FIXED_DT,
    MODES,
    PORTAL_COLORS,
    createPlayerState,
    stepPlayerPhysics,
    GameSimulator
};

if (typeof module !== 'undefined') {
    module.exports = PhysicsEngine;
}
