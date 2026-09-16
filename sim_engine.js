const GRAVITY = 0.8;
const JUMP_FORCE = -12;
const COYOTE_TIME = 5;
const BUFFER_TIME = 5;
const GROUND_HEIGHT = 100;
const CEILING_HEIGHT = 100;
const PLAYER_SIZE = 40;
let currentSimSpeed = 9.0;
const CANVAS_HEIGHT = 800; // standard virtual height for simulation

const MODES = {
    CUBE: 'cube',
    SHIP: 'ship',
    BALL: 'ball',
    UFO: 'ufo',
    WAVE: 'wave'
};

class GameSimulator {
    constructor() {
        this.reset();
    }

    reset(speed = 9.0) {
        this.speed = speed;
        this.player = {
            x: 150,
            y: CANVAS_HEIGHT - GROUND_HEIGHT - PLAYER_SIZE,
            width: PLAYER_SIZE,
            height: PLAYER_SIZE,
            velocityY: 0,
            isGrounded: true,
            coyoteCounter: COYOTE_TIME,
            jumpBufferCounter: 0,
            gravityDir: 1,
            mode: MODES.CUBE
        };
        this.obstacles = [];
        this.transitions = [];
        this.gameDistance = 0;
        this.jumpPressed = false;
        this.jumpProcessed = false;
        this.dead = false;
    }

    addSection(startX, list) {
        list.forEach(obs => {
            this.obstacles.push({
                x: startX + obs.x,
                y: obs.y,
                type: obs.type,
                w: obs.w || 50,
                h: obs.h || 50
            });
        });
    }

    step(jumpInput) {
        if (this.dead) return;

        // Input state update
        if (jumpInput && !this.jumpPressed) {
            this.jumpProcessed = false;
        }
        this.jumpPressed = jumpInput;

        // Jump Buffering
        if (this.jumpPressed) this.player.jumpBufferCounter = BUFFER_TIME;
        else if (this.player.jumpBufferCounter > 0) this.player.jumpBufferCounter--;

        this.gameDistance += this.speed;

        // Transitions
        this.transitions.forEach(t => {
            if (this.gameDistance >= t.x && this.gameDistance < t.x + this.speed) {
                this.player.mode = t.mode;
            }
        });

        // Physics update
        switch(this.player.mode) {
            case MODES.CUBE:
                if (this.player.jumpBufferCounter > 0 && (this.player.isGrounded || this.player.coyoteCounter > 0)) {
                    this.player.velocityY = JUMP_FORCE;
                    this.player.isGrounded = false;
                    this.player.coyoteCounter = 0;
                    this.player.jumpBufferCounter = 0;
                }
                this.player.velocityY += GRAVITY;
                break;
            case MODES.SHIP:
                if (this.jumpPressed) this.player.velocityY -= 0.75; else this.player.velocityY += 0.75;
                this.player.velocityY = Math.max(-9, Math.min(9, this.player.velocityY));
                break;
            case MODES.BALL:
                if (this.jumpPressed && !this.jumpProcessed) {
                    this.player.gravityDir *= -1;
                    this.player.isGrounded = false;
                    this.jumpProcessed = true;
                }
                this.player.velocityY += GRAVITY * this.player.gravityDir;
                break;
            case MODES.UFO:
                if (this.jumpPressed && !this.jumpProcessed) {
                    this.player.velocityY = JUMP_FORCE * 0.75;
                    this.jumpProcessed = true;
                }
                this.player.velocityY += GRAVITY;
                break;
            case MODES.WAVE:
                if (this.jumpPressed) this.player.velocityY = -this.speed * 1.3; else this.player.velocityY = this.speed * 1.3;
                break;
        }

        this.player.y += this.player.velocityY;

        const groundLevel = CANVAS_HEIGHT - GROUND_HEIGHT;
        const ceilLevel = CEILING_HEIGHT;

        if (this.player.y + this.player.height > groundLevel) {
            this.player.y = groundLevel - this.player.height;
            this.player.velocityY = 0;
            this.player.isGrounded = true;
            this.player.coyoteCounter = COYOTE_TIME;
        } else if (this.player.y < ceilLevel) {
            this.player.y = ceilLevel;
            this.player.velocityY = 0;
            if (this.player.mode === MODES.BALL && this.player.gravityDir === -1) {
                this.player.isGrounded = true;
                this.player.coyoteCounter = COYOTE_TIME;
            }
        } else {
            this.player.isGrounded = false;
            if (this.player.coyoteCounter > 0) this.player.coyoteCounter--;
        }

        // Collisions
        for (let i = 0; i < this.obstacles.length; i++) {
            const obs = this.obstacles[i];
            const obsX = obs.x - this.gameDistance;
            const obsY = groundLevel - obs.y;

            if (obsX > -this.player.width && obsX < this.player.x + this.player.width + 100) {
                if (obs.type === 'pad') {
                    if (this.player.x + this.player.width > obsX && this.player.x < obsX + obs.w &&
                        this.player.y + this.player.height > obsY - 10 && this.player.y + this.player.height < obsY + 20) {
                        this.player.velocityY = JUMP_FORCE * 1.4;
                        this.player.isGrounded = false;
                    }
                } else if (obs.type === 'ring') {
                    if (this.player.x + this.player.width > obsX && this.player.x < obsX + obs.w &&
                        this.player.y + this.player.height > obsY - obs.h && this.player.y < obsY) {
                        if (this.jumpPressed && !this.jumpProcessed) {
                            this.player.velocityY = JUMP_FORCE;
                            this.jumpProcessed = true;
                        }
                    }
                } else if (obs.type === 'spike') {
                    const margin = 14;
                    if (this.player.x + this.player.width > obsX + margin && this.player.x < obsX + obs.w - margin &&
                        this.player.y + this.player.height > obsY - obs.h + margin && this.player.y < obsY - 2) {
                        this.dead = true;
                        return;
                    }
                } else if (obs.type === 'block') {
                    if (this.player.x + this.player.width > obsX && this.player.x < obsX + obs.w) {
                        // Standing on top of block
                        if (this.player.gravityDir === 1 && this.player.y + this.player.height >= obsY - obs.h && this.player.y + this.player.height <= obsY - obs.h + 25 && this.player.velocityY >= 0) {
                            this.player.y = obsY - obs.h - this.player.height;
                            this.player.velocityY = 0;
                            this.player.isGrounded = true;
                            continue;
                        }
                        // Attached to bottom of ceiling block (gravityDir === -1)
                        else if (this.player.gravityDir === -1 && this.player.y <= obsY && this.player.y >= obsY - 25 && this.player.velocityY <= 0) {
                            this.player.y = obsY;
                            this.player.velocityY = 0;
                            this.player.isGrounded = true;
                            continue;
                        }
                        // Bouncing off bottom of block in normal gravity (gravityDir === 1)
                        else if (this.player.gravityDir === 1 && this.player.y <= obsY && this.player.y >= obsY - 20 && this.player.velocityY < 0) {
                            this.player.y = obsY;
                            this.player.velocityY = 0;
                            continue;
                        }
                    }
                    const sideMargin = 8;
                    if (this.player.x + this.player.width > obsX + sideMargin && this.player.x < obsX + obs.w - sideMargin &&
                        this.player.y + this.player.height > obsY - obs.h + 5 && this.player.y < obsY - 5) {
                        this.dead = true;
                        return;
                    }
                }
            }
        }
    }
}

module.exports = { GameSimulator, MODES, GRAVITY, JUMP_FORCE, CANVAS_HEIGHT, GROUND_HEIGHT };
