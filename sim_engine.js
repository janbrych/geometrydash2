/* Geometry Dash Headless Physics Engine (sim_engine.js) */

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const GROUND_HEIGHT = 100;
const CEILING_HEIGHT = 100;

const MODES = {
    CUBE: 'cube',
    SHIP: 'ship',
    BALL: 'ball',
    UFO: 'ufo',
    WAVE: 'wave'
};

class SimPlayer {
    constructor() {
        this.reset();
    }

    reset(startPos = 0, initialMode = 'cube') {
        this.x = 150;
        this.y = CANVAS_HEIGHT - GROUND_HEIGHT - 40;
        this.w = 40;
        this.h = 40;
        this.vy = 0;
        this.mode = initialMode || 'cube';
        this.isGrounded = true;
        this.rotation = 0;
        this.dead = false;
        this.distance = startPos || 0;
        this.gravityDir = 1;
        this.coyoteCounter = 5;
        this.jumpBufferCounter = 0;
        this.jumpPressed = false;
        this.jumpProcessed = false;
    }

    get velocityY() {
        return this.vy;
    }

    stepPhysics(obstacles, speed, jumpInput) {
        if (this.dead) return;

        this.distance += speed;
        this.jumpPressed = !!jumpInput;

        // Portals Mode Switch
        if (obstacles) {
            for (let obs of obstacles) {
                if (obs.type === 'portal') {
                    if (Math.abs(this.distance - obs.x) < speed) {
                        this.mode = obs.mode;
                    }
                }
            }
        }

        if (this.isGrounded) {
            this.coyoteCounter = 5;
        } else {
            this.coyoteCounter = Math.max(0, this.coyoteCounter - 1);
        }

        if (this.jumpPressed) {
            this.jumpBufferCounter = 5;
        } else {
            this.jumpBufferCounter = Math.max(0, this.jumpBufferCounter - 1);
        }

        const GRAVITY = 0.8;
        const JUMP_FORCE = -12;

        if (this.mode === 'cube') {
            this.vy += GRAVITY * this.gravityDir;
            if (this.jumpBufferCounter > 0 && this.coyoteCounter > 0) {
                this.vy = JUMP_FORCE * this.gravityDir;
                this.isGrounded = false;
                this.coyoteCounter = 0;
                this.jumpBufferCounter = 0;
            }
            if (!this.isGrounded) {
                this.rotation += 0.15 * this.gravityDir;
            }
        } else if (this.mode === 'ship') {
            if (this.jumpPressed) this.vy -= 0.6; else this.vy += 0.4;
            this.vy = Math.max(-8, Math.min(8, this.vy));
            this.rotation = this.vy * 0.05;
        } else if (this.mode === 'ball') {
            this.vy += GRAVITY * this.gravityDir;
            if (this.jumpPressed && !this.jumpProcessed && this.isGrounded) {
                this.gravityDir *= -1;
                this.isGrounded = false;
                this.jumpProcessed = true;
            }
            if (!this.jumpPressed) {
                this.jumpProcessed = false;
            }
            this.rotation += 0.15 * this.gravityDir;
        } else if (this.mode === 'ufo') {
            this.vy += GRAVITY * 0.8;
            if (this.jumpPressed && !this.jumpProcessed) {
                this.vy = JUMP_FORCE * 0.75;
                this.jumpProcessed = true;
            }
            if (!this.jumpPressed) {
                this.jumpProcessed = false;
            }
            this.rotation = this.vy * 0.03;
        } else if (this.mode === 'wave') {
            if (this.jumpPressed) this.vy = -speed * 0.8; else this.vy = speed * 0.8;
            this.rotation = this.jumpPressed ? -0.4 : 0.4;
        }

        this.y += this.vy;

        // Default floor level if y >= canvas.height - GROUND_HEIGHT - 40
        const defaultGroundY = CANVAS_HEIGHT - GROUND_HEIGHT - this.h;
        if (this.y >= defaultGroundY) {
            this.y = defaultGroundY;
            this.vy = 0;
            this.isGrounded = true;
            if (this.mode === 'cube') {
                this.rotation = Math.round(this.rotation / (Math.PI / 2)) * (Math.PI / 2);
            }
        }

        // Ceiling boundary limit
        if (this.y <= CEILING_HEIGHT) {
            this.y = CEILING_HEIGHT;
            this.vy = 0;
        }

        // Collision detection with custom blocks and obstacles
        if (obstacles) {
            for (let obs of obstacles) {
                const obsScreenX = obs.x - this.distance + this.x;
                const obsY = CANVAS_HEIGHT - GROUND_HEIGHT - obs.y - obs.h;

                if (obsScreenX > this.x - 60 && obsScreenX < this.x + 60) {
                    if (obs.type === 'yellow_pad' || obs.type === 'pad') {
                        if (this.x + this.w > obsScreenX && this.x < obsScreenX + obs.w &&
                            this.y + this.h >= obsY && this.y <= obsY + obs.h) {
                            this.vy = JUMP_FORCE * 1.3 * this.gravityDir;
                            this.isGrounded = false;
                        }
                    } else if (obs.type === 'magenta_pad') {
                        if (this.x + this.w > obsScreenX && this.x < obsScreenX + obs.w &&
                            this.y + this.h >= obsY && this.y <= obsY + obs.h) {
                            this.vy = JUMP_FORCE * 0.8 * this.gravityDir;
                            this.isGrounded = false;
                        }
                    } else if (obs.type === 'yellow_ring' || obs.type === 'ring') {
                        if (this.x + this.w > obsScreenX && this.x < obsScreenX + obs.w &&
                            this.y + this.h >= obsY && this.y <= obsY + obs.h &&
                            this.jumpPressed && !this.jumpProcessed) {
                            this.vy = JUMP_FORCE * this.gravityDir;
                            this.jumpProcessed = true;
                        }
                    } else if (obs.type === 'magenta_ring') {
                        if (this.x + this.w > obsScreenX && this.x < obsScreenX + obs.w &&
                            this.y + this.h >= obsY && this.y <= obsY + obs.h &&
                            this.jumpPressed && !this.jumpProcessed) {
                            this.vy = JUMP_FORCE * 0.7 * this.gravityDir;
                            this.jumpProcessed = true;
                        }
                    } else if (obs.type === 'spike') {
                        const margin = 8;
                        if (this.x + margin < obsScreenX + obs.w - margin &&
                            this.x + this.w - margin > obsScreenX + margin &&
                            this.y + margin < obsY + obs.h - margin &&
                            this.y + this.h - margin > obsY + margin) {
                            this.dead = true;
                        }
                    } else if (obs.type === 'block') {
                        if (this.x + this.w - 6 > obsScreenX && this.x + 6 < obsScreenX + obs.w) {
                            if (this.vy >= 0 && this.y + this.h >= obsY && this.y + this.h <= obsY + 24) {
                                this.y = obsY - this.h;
                                this.vy = 0;
                                this.isGrounded = true;
                                if (this.mode === 'cube') {
                                    this.rotation = Math.round(this.rotation / (Math.PI / 2)) * (Math.PI / 2);
                                }
                            }
                        }

                        const sideMargin = 6;
                        if (this.x + this.w - sideMargin > obsScreenX &&
                            this.x + sideMargin < obsScreenX + obs.w &&
                            this.y + this.h - sideMargin > obsY &&
                            this.y + sideMargin < obsY + obs.h) {
                            if (!this.isGrounded) {
                                this.dead = true;
                            }
                        }
                    }
                }
            }
        }
    }
}

// GameSimulator adapter for full level solver
class GameSimulator {
    constructor() {
        this.player = new SimPlayer();
        this.obstacles = [];
        this.transitions = [];
        this.speed = 10.5;
    }

    get gameDistance() {
        return this.player.distance;
    }

    set gameDistance(val) {
        this.player.distance = val;
    }

    get jumpPressed() {
        return this.player.jumpPressed;
    }

    set jumpPressed(val) {
        this.player.jumpPressed = val;
    }

    get dead() {
        return this.player.dead;
    }

    set dead(val) {
        this.player.dead = val;
    }

    addSection(startX, obsList) {
        for (let item of obsList) {
            let obs = {
                type: item.type,
                x: startX + item.x,
                y: item.y || 0,
                w: item.w || 40,
                h: item.h || 40
            };
            this.obstacles.push(obs);
        }
    }

    step(jumpInput) {
        for (let tr of this.transitions) {
            if (Math.abs(this.player.distance - tr.x) < this.speed) {
                this.player.mode = tr.mode;
            }
        }
        this.player.stepPhysics(this.obstacles, this.speed, jumpInput);
    }
}

if (typeof module !== 'undefined') {
    module.exports = { SimPlayer, GameSimulator, MODES, CANVAS_WIDTH, CANVAS_HEIGHT, GROUND_HEIGHT, CEILING_HEIGHT };
}
