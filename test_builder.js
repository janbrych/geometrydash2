const { GameSimulator, MODES } = require('./sim_engine.js');

function runTest(builderFunc, speed, levelName) {
    const sim = new GameSimulator();
    sim.reset(speed);
    builderFunc(sim);

    let maxObs = sim.obstacles.length > 0 ? Math.max(...sim.obstacles.map(o => o.x)) : 0;

    console.log(`Testing ${levelName} (Speed: ${speed}, Obstacles: ${sim.obstacles.length}, Max Dist: ${maxObs})`);

    let queue = [{ state: sim, totalFrames: 0 }];
    let visited = new Set();
    let bestDist = 0;
    let foundSolution = null;

    while (queue.length > 0) {
        queue.sort((a, b) => b.state.gameDistance - a.state.gameDistance);
        if (queue.length > 1000) queue = queue.slice(0, 1000);

        let current = queue.shift();
        let s = current.state;

        if (s.gameDistance > bestDist) bestDist = s.gameDistance;

        if (s.gameDistance >= maxObs + 1000) {
            foundSolution = current;
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
                let key = `${Math.floor(nextSim.gameDistance / 10)}_${Math.floor(nextSim.player.y / 8)}_${Math.floor(nextSim.player.velocityY)}_${nextSim.player.mode}_${nextSim.player.gravityDir}`;
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

    if (foundSolution) {
        console.log(`[PASS] ${levelName} is 100% BEATABLE! (Reached ${bestDist}px in ${foundSolution.totalFrames} frames)`);
        return true;
    } else {
        console.log(`[FAIL] ${levelName} stuck at dist ${bestDist} / ${maxObs}`);
        return false;
    }
}

function buildTestLevel1(sim) {
    let curX = 1200;
    sim.addSection(curX, [
        { x: 300, y: 0, type: 'pad' }, // Yellow pad launch
        { x: 750, y: 180, type: 'block', w: 140, h: 20 },
        { x: 1000, y: 180, type: 'ring', h: 60 }, // Mid-air orb
        { x: 1350, y: 280, type: 'block', w: 140, h: 20 },
        { x: 1600, y: 280, type: 'ring', h: 60 }, // Second orb
        { x: 1950, y: 380, type: 'block', w: 160, h: 20 },
        { x: 2600, y: 0, type: 'spike' },
        { x: 3100, y: 0, type: 'pad' },
    ]);
    curX += 3600;

    sim.transitions.push({ x: curX, mode: MODES.WAVE });
    curX += 1000;

    // Tight Wave Slalom (corridor ~100px)
    for (let i = 0; i < 6; i++) {
        let isTop = (i % 2 === 0);
        sim.addSection(curX + i * 850, [
            { x: 0, y: isTop ? 320 : 0, type: 'block', w: 280, h: 180 },
            { x: 450, y: isTop ? 0 : 500, type: 'spike' }
        ]);
    }
    curX += 6000;
}

runTest(buildTestLevel1, 9.0, "Test Level 1 (INSANE)");
