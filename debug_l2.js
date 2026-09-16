const { GameSimulator, MODES } = require('./sim_engine.js');

function buildLevel2(sim) {
    let curX = 1200;

    // BALL MODE START: Rapid ceiling/floor flips with floating hazard blocks
    for (let i = 0; i < 6; i++) {
        let isFloor = (i % 2 === 0);
        sim.addSection(curX + i * 1100, [
            { x: 350, y: isFloor ? 0 : 550, type: 'spike' },
            { x: 800, y: isFloor ? 550 : 0, type: 'block', w: 160, h: 50 }
        ]);
    }
}

const sim = new GameSimulator();
sim.reset(10.5);
sim.player.mode = MODES.BALL;
buildLevel2(sim);

let queue = [{ state: sim, totalFrames: 0 }];
let visited = new Set();
let bestDist = 0;

while (queue.length > 0) {
    queue.sort((a, b) => b.state.gameDistance - a.state.gameDistance);
    if (queue.length > 2000) queue = queue.slice(0, 2000);

    let current = queue.shift();
    let s = current.state;

    if (s.gameDistance > bestDist) bestDist = s.gameDistance;

    for (let press of [false, true]) {
        let nextSim = new GameSimulator();
        nextSim.speed = s.speed;
        nextSim.player = JSON.parse(JSON.stringify(s.player));
        nextSim.obstacles = s.obstacles;
        nextSim.transitions = s.transitions;
        nextSim.gameDistance = s.gameDistance;
        nextSim.jumpPressed = s.jumpPressed;
        nextSim.jumpProcessed = s.jumpProcessed;
        nextSim.dead = s.dead;

        nextSim.step(press);

        if (!nextSim.dead) {
            let key = `${Math.floor(nextSim.gameDistance / 5)}_${Math.floor(nextSim.player.y / 5)}_${Math.floor(nextSim.player.velocityY)}_${nextSim.player.mode}_${nextSim.player.gravityDir}`;
            if (!visited.has(key)) {
                visited.add(key);
                queue.push({
                    state: nextSim,
                    totalFrames: current.totalFrames + 1
                });
            }
        }
    }
}

console.log(`Best dist achieved in L2 Ball start: ${bestDist}`);
