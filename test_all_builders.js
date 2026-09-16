const { GameSimulator, MODES } = require('./sim_engine.js');

function solveLevel(builderFunc, speed, initialMode, levelName) {
    const sim = new GameSimulator();
    sim.reset(speed);
    sim.player.mode = initialMode;
    builderFunc(sim);

    let maxObs = sim.obstacles.length > 0 ? Math.max(...sim.obstacles.map(o => o.x)) : 0;

    console.log(`\n----------------------------------------------------`);
    console.log(`TESTING: ${levelName} (Speed: ${speed}, Initial Mode: ${initialMode}, Obstacles: ${sim.obstacles.length}, Max Dist: ${maxObs})`);
    console.log(`----------------------------------------------------`);

    let queue = [{ state: sim, totalFrames: 0 }];
    let visited = new Set();
    let bestDist = 0;
    let foundSolution = null;

    while (queue.length > 0) {
        queue.sort((a, b) => b.state.gameDistance - a.state.gameDistance);
        if (queue.length > 1500) queue = queue.slice(0, 1500);

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
                let key = `${Math.floor(nextSim.gameDistance / 10)}_${Math.floor(nextSim.player.y / 10)}_${Math.floor(nextSim.player.velocityY)}_${nextSim.player.mode}_${nextSim.player.gravityDir}_${nextSim.jumpProcessed}`;
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
        console.log(`[PASS] ${levelName} is 100% DEATHLESS BEATABLE! (Reached ${bestDist}px in ${foundSolution.totalFrames} frames)`);
        return true;
    } else {
        console.log(`[FAIL] ${levelName} STUCK at dist ${bestDist} / ${maxObs}`);
        return false;
    }
}

// BUILDER LEVEL 1 (CYBER RAVE - INSANE, Speed 9.0)
function buildLevel1(sim) {
    let curX = 1200;

    // CUBE MODE: Multi-elevation platforms, Pad launch, Orb chains, Triple Spikes
    sim.addSection(curX, [
        { x: 300, y: 0, type: 'pad' }, // Launch to platform 1
        { x: 750, y: 180, type: 'block', w: 140, h: 20 },
        { x: 1000, y: 180, type: 'ring', h: 60 }, // Mid-air orb 1
        { x: 1350, y: 280, type: 'block', w: 140, h: 20 },
        { x: 1600, y: 280, type: 'ring', h: 60 }, // Mid-air orb 2
        { x: 1950, y: 380, type: 'block', w: 160, h: 20 },
        { x: 2600, y: 0, type: 'spike' },
        { x: 2650, y: 0, type: 'spike' },
        { x: 3100, y: 0, type: 'pad' },
    ]);
    curX += 3600;

    sim.transitions.push({ x: curX, mode: MODES.SHIP });
    curX += 1000;

    // SHIP MODE: Narrow fly-throughs & obstacles at varying heights
    for (let i = 0; i < 6; i++) {
        let yCenter = 300 + Math.sin(i * 0.9) * 110;
        sim.addSection(curX + i * 850, [
            { x: 0, y: 0, type: 'block', w: 150, h: Math.max(0, yCenter - 110) },
            { x: 0, y: yCenter + 110, type: 'block', w: 150, h: Math.max(0, 600 - (yCenter + 110)) },
            { x: 450, y: yCenter - 110, type: 'spike' }
        ]);
    }
    curX += 5400;

    sim.transitions.push({ x: curX, mode: MODES.BALL });
    curX += 1000;

    // BALL MODE: Precision gravity switching, floor/ceiling spikes
    for (let i = 0; i < 6; i++) {
        let isFloor = (i % 2 === 0);
        sim.addSection(curX + i * 1100, [
            { x: 400, y: isFloor ? 0 : 550, type: 'spike' },
            { x: 900, y: isFloor ? 0 : 550, type: 'spike' }
        ]);
    }
    curX += 7000;

    sim.transitions.push({ x: curX, mode: MODES.UFO });
    curX += 1000;

    // UFO MODE: Flappy multi-tier jumps with mid-air Orbs
    for (let i = 0; i < 5; i++) {
        sim.addSection(curX + i * 900, [
            { x: 0, y: 0, type: 'spike' },
            { x: 300, y: 150 + (i % 2) * 80, type: 'block', w: 120, h: 20 },
            { x: 600, y: 0, type: 'spike' },
            { x: 600, y: 550, type: 'spike' },
            { x: 750, y: 250, type: 'ring', h: 40 }
        ]);
    }
    curX += 5000;

    sim.transitions.push({ x: curX, mode: MODES.WAVE });
    curX += 1000;

    // WAVE MODE: Fast diagonal slalom corridors (~90px gap)
    for (let i = 0; i < 6; i++) {
        let isTop = (i % 2 === 0);
        sim.addSection(curX + i * 850, [
            { x: 0, y: isTop ? 310 : 0, type: 'block', w: 260, h: 190 },
            { x: 450, y: isTop ? 0 : 500, type: 'spike' }
        ]);
    }
    curX += 5500;
}

// BUILDER LEVEL 2 (ACID DISTRICT - DEMON, Speed 10.5)
function buildLevel2(sim) {
    let curX = 1200;

    // BALL MODE START: Rapid ceiling/floor flips with floor/ceiling spikes
    for (let i = 0; i < 6; i++) {
        let isFloor = (i % 2 === 0);
        sim.addSection(curX + i * 1200, [
            { x: 450, y: isFloor ? 0 : 550, type: 'spike' },
            { x: 950, y: isFloor ? 550 : 0, type: 'spike' }
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

// BUILDER LEVEL 3 (INDUSTRIAL HELL - EXTREME DEMON, Speed 12.0)
function buildLevel3(sim) {
    let curX = 1200;

    // WAVE MODE START: Extreme Speed Wave Slalom
    for (let i = 0; i < 6; i++) {
        let isTop = (i % 2 === 0);
        sim.addSection(curX + i * 1050, [
            { x: 0, y: isTop ? 320 : 0, type: 'block', w: 280, h: 180 },
            { x: 600, y: isTop ? 0 : 540, type: 'spike' }
        ]);
    }
    curX += 6800;

    sim.transitions.push({ x: curX, mode: MODES.UFO });
    curX += 1000;

    // UFO MODE: High Speed Precision Jumps
    for (let i = 0; i < 5; i++) {
        sim.addSection(curX + i * 1050, [
            { x: 0, y: 0, type: 'spike' },
            { x: 400, y: 180 + (i % 2) * 90, type: 'block', w: 140, h: 20 },
            { x: 750, y: 0, type: 'spike' },
            { x: 900, y: 270, type: 'ring', h: 40 }
        ]);
    }
    curX += 5800;

    sim.transitions.push({ x: curX, mode: MODES.SHIP });
    curX += 1000;

    // SHIP MODE: Fast tight tunnel navigation
    for (let i = 0; i < 6; i++) {
        let yCenter = 300 + Math.sin(i * 0.9) * 100;
        sim.addSection(curX + i * 1000, [
            { x: 0, y: 0, type: 'block', w: 180, h: Math.max(0, yCenter - 110) },
            { x: 0, y: yCenter + 110, type: 'block', w: 180, h: Math.max(0, 600 - (yCenter + 110)) },
            { x: 600, y: yCenter - 110, type: 'spike' }
        ]);
    }
    curX += 6500;

    sim.transitions.push({ x: curX, mode: MODES.BALL });
    curX += 1000;

    // BALL MODE: Extreme Speed Gravity Flips
    for (let i = 0; i < 6; i++) {
        let isFloor = (i % 2 === 0);
        sim.addSection(curX + i * 1250, [
            { x: 450, y: isFloor ? 0 : 550, type: 'spike' },
            { x: 950, y: isFloor ? 550 : 0, type: 'spike' }
        ]);
    }
    curX += 7800;

    sim.transitions.push({ x: curX, mode: MODES.CUBE });
    curX += 1000;

    // CUBE MODE FINALE: High Speed Superjump Pad & Orb chain
    sim.addSection(curX, [
        { x: 350, y: 0, type: 'pad' },
        { x: 900, y: 220, type: 'block', w: 150, h: 20 },
        { x: 1250, y: 220, type: 'ring', h: 60 },
        { x: 1650, y: 340, type: 'block', w: 150, h: 20 },
        { x: 2050, y: 0, type: 'spike' },
        { x: 2120, y: 0, type: 'spike' },
    ]);
    curX += 3000;
}

let res1 = solveLevel(buildLevel1, 9.0, MODES.CUBE, "LEVEL 1: CYBER RAVE (INSANE)");
let res2 = solveLevel(buildLevel2, 10.5, MODES.BALL, "LEVEL 2: ACID DISTRICT (DEMON)");
let res3 = solveLevel(buildLevel3, 12.0, MODES.WAVE, "LEVEL 3: INDUSTRIAL HELL (EXTREME DEMON)");

if (res1 && res2 && res3) {
    console.log(`\n====================================================`);
    console.log(`ALL 3 HIGH-SPEED EXTREME LEVELS VERIFIED 100% BEATABLE!`);
    console.log(`====================================================`);
} else {
    console.log(`\n====================================================`);
    console.log(`VERIFICATION FAILED FOR ONE OR MORE LEVELS!`);
    console.log(`====================================================`);
}
