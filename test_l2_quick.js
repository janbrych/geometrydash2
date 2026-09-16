const { GameSimulator, MODES } = require('./sim_engine.js');

function testL2(builderFunc) {
    const sim = new GameSimulator();
    sim.reset(10.5);
    sim.player.mode = MODES.BALL;
    builderFunc(sim);

    let maxObs = sim.obstacles.length > 0 ? Math.max(...sim.obstacles.map(o => o.x)) : 0;

    let queue = [{ state: sim, totalFrames: 0 }];
    let visited = new Set();
    let bestDist = 0;

    while (queue.length > 0) {
        queue.sort((a, b) => b.state.gameDistance - a.state.gameDistance);
        if (queue.length > 1000) queue = queue.slice(0, 1000);

        let current = queue.shift();
        let s = current.state;

        if (s.gameDistance > bestDist) bestDist = s.gameDistance;
        if (s.gameDistance >= maxObs + 1000) return true;

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
                    queue.push({ state: nextSim, totalFrames: current.totalFrames + 1 });
                }
            }
        }
    }
    console.log(`L2 failed at dist ${bestDist} / ${maxObs}`);
    return false;
}

function buildLevel2(sim) {
    let curX = 1200;

    // BALL MODE START: Spaced ceiling/floor flips
    for (let i = 0; i < 6; i++) {
        let isFloor = (i % 2 === 0);
        sim.addSection(curX + i * 1200, [
            { x: 400, y: isFloor ? 0 : 550, type: 'spike' },
            { x: 850, y: isFloor ? 550 : 0, type: 'block', w: 160, h: 50 }
        ]);
    }
    curX += 7500;

    sim.transitions.push({ x: curX, mode: MODES.CUBE });
    curX += 1000;

    // CUBE MODE: Fast staircase jump platforms + orb chains
    sim.addSection(curX, [
        { x: 300, y: 0, type: 'pad' },
        { x: 800, y: 200, type: 'block', w: 140, h: 20 },
        { x: 1100, y: 200, type: 'ring', h: 60 },
        { x: 1450, y: 320, type: 'block', w: 140, h: 20 },
        { x: 1750, y: 320, type: 'ring', h: 60 },
        { x: 2150, y: 0, type: 'spike' },
        { x: 2200, y: 0, type: 'spike' },
    ]);
    curX += 2800;

    sim.transitions.push({ x: curX, mode: MODES.WAVE });
    curX += 1000;

    // WAVE MODE: Tight Demon Slalom
    for (let i = 0; i < 6; i++) {
        let isTop = (i % 2 === 0);
        sim.addSection(curX + i * 950, [
            { x: 0, y: isTop ? 310 : 0, type: 'block', w: 280, h: 190 },
            { x: 550, y: isTop ? 0 : 520, type: 'spike' }
        ]);
    }
    curX += 6200;

    sim.transitions.push({ x: curX, mode: MODES.SHIP });
    curX += 1000;

    // SHIP MODE: Tight wave-like flying passages
    for (let i = 0; i < 6; i++) {
        let yCenter = 300 + Math.cos(i * 0.9) * 110;
        sim.addSection(curX + i * 950, [
            { x: 0, y: 0, type: 'block', w: 160, h: Math.max(0, yCenter - 110) },
            { x: 0, y: yCenter + 110, type: 'block', w: 160, h: Math.max(0, 600 - (yCenter + 110)) },
            { x: 550, y: yCenter - 110, type: 'spike' }
        ]);
    }
    curX += 6200;

    sim.transitions.push({ x: curX, mode: MODES.UFO });
    curX += 1000;

    // UFO MODE: Precision jump gaps
    for (let i = 0; i < 5; i++) {
        sim.addSection(curX + i * 1000, [
            { x: 0, y: 0, type: 'spike' },
            { x: 400, y: 160 + (i % 2) * 100, type: 'block', w: 130, h: 20 },
            { x: 750, y: 0, type: 'spike' },
            { x: 880, y: 260, type: 'ring', h: 40 }
        ]);
    }
    curX += 5500;
}

console.log("Result L2:", testL2(buildLevel2));
