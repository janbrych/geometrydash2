const { GameSimulator, MODES } = require('./sim_engine.js');

const sim = new GameSimulator();
sim.reset(10.5);
sim.player.mode = MODES.BALL;

let curX = 1200;
sim.addSection(curX, [
    { x: 450, y: 0, type: 'spike' },
    { x: 950, y: 550, type: 'spike' }
]);

let maxObs = Math.max(...sim.obstacles.map(o => o.x));

let queue = [{ state: sim }];
let visited = new Set();
let bestDist = 0;

while (queue.length > 0) {
    queue.sort((a, b) => b.state.gameDistance - a.state.gameDistance);
    if (queue.length > 1000) queue = queue.slice(0, 1000);

    let current = queue.shift();
    let s = current.state;

    if (s.gameDistance > bestDist) bestDist = s.gameDistance;
    if (s.gameDistance >= maxObs + 500) {
        console.log("SUCCESS!");
        break;
    }

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
            let key = `${Math.floor(nextSim.gameDistance / 10)}_${Math.floor(nextSim.player.y / 10)}_${Math.floor(nextSim.player.velocityY)}_${nextSim.player.mode}_${nextSim.player.gravityDir}_${nextSim.jumpProcessed}`;
            if (!visited.has(key)) {
                visited.add(key);
                queue.push({ state: nextSim });
            }
        }
    }
}
console.log(`bestDist: ${bestDist} / ${maxObs}`);
