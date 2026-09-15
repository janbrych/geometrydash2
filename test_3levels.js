const { GameSimulator, MODES } = require('./sim_engine.js');

function cloneSim(s) {
    let copy = new GameSimulator();
    copy.player = { ...s.player };
    copy.obstacles = s.obstacles;
    copy.transitions = s.transitions;
    copy.gameDistance = s.gameDistance;
    copy.jumpPressed = s.jumpPressed;
    copy.jumpProcessed = s.jumpProcessed;
    copy.dead = s.dead;
    return copy;
}

// LEVEL 1: CYBER RAVE
function buildLevel1(sim) {
    let curX = 1200;

    // Cube
    sim.addSection(curX, [
        { x: 300, y: 0, type: 'spike' },
        { x: 800, y: 0, type: 'spike' },
        { x: 1300, y: 0, type: 'block', h: 30, w: 100 },
        { x: 1400, y: 0, type: 'block', h: 60, w: 100 },
        { x: 1800, y: 0, type: 'spike' },
        { x: 2200, y: 0, type: 'ring', h: 100 },
        { x: 2400, y: 100, type: 'block', w: 120, h: 20 },
        { x: 2900, y: 0, type: 'spike' },
        { x: 3300, y: 0, type: 'spike' },
    ]);
    curX += 3800;

    // Cube - Pads & Orbs
    sim.addSection(curX, [
        { x: 300, y: 0, type: 'pad' }, // Pad boost
        { x: 700, y: 140, type: 'block', w: 120, h: 20 },
        { x: 1000, y: 140, type: 'ring', h: 50 },
        { x: 1300, y: 220, type: 'block', w: 120, h: 20 },
        { x: 1600, y: 220, type: 'ring', h: 50 },
        { x: 1900, y: 300, type: 'block', w: 120, h: 20 },
        { x: 2300, y: 0, type: 'spike' },
    ]);
    curX += 2900;

    // Transition: Ship
    sim.transitions.push({ x: curX, mode: MODES.SHIP });
    curX += 1000;

    // Ship
    for (let i = 0; i < 8; i++) {
        let yCenter = 300 + Math.sin(i * 0.6) * 100;
        sim.addSection(curX + i * 850, [
            { x: 0, y: 0, type: 'block', w: 150, h: Math.max(0, yCenter - 140) },
            { x: 0, y: yCenter + 140, type: 'block', w: 150, h: Math.max(0, 600 - (yCenter + 140)) },
            { x: 450, y: yCenter - 140, type: 'spike' }
        ]);
    }
    curX += 7100;

    // Transition: Ball
    sim.transitions.push({ x: curX, mode: MODES.BALL });
    curX += 1000;

    // Ball
    for (let i = 0; i < 6; i++) {
        let isFloor = (i % 2 === 0);
        sim.addSection(curX + i * 1100, [
            { x: 300, y: isFloor ? 0 : 550, type: 'spike' },
            { x: 800, y: isFloor ? 550 : 0, type: 'block', w: 150, h: 50 }
        ]);
    }
    curX += 7000;

    // Transition: UFO
    sim.transitions.push({ x: curX, mode: MODES.UFO });
    curX += 1000;

    // UFO
    for (let i = 0; i < 6; i++) {
        sim.addSection(curX + i * 900, [
            { x: 0, y: 0, type: 'spike' },
            { x: 300, y: 150, type: 'block', w: 120, h: 20 },
            { x: 600, y: 0, type: 'spike' },
            { x: 600, y: 550, type: 'spike' },
            { x: 750, y: 250, type: 'ring', h: 40 }
        ]);
    }
    curX += 5800;

    // Transition: Wave
    sim.transitions.push({ x: curX, mode: MODES.WAVE });
    curX += 1000;

    // Wave
    for (let i = 0; i < 8; i++) {
        let isTop = (i % 2 === 0);
        sim.addSection(curX + i * 850, [
            { x: 0, y: isTop ? 320 : 0, type: 'block', w: 250, h: 180 },
            { x: 500, y: isTop ? 0 : 550, type: 'spike' }
        ]);
    }
    curX += 7100;

    // Transition: Cube
    sim.transitions.push({ x: curX, mode: MODES.CUBE });
    curX += 1000;
    sim.addSection(curX, [
        { x: 300, y: 0, type: 'pad' },
        { x: 800, y: 0, type: 'pad' },
        { x: 1300, y: 0, type: 'pad' },
        { x: 1700, y: 200, type: 'ring', h: 40 },
        { x: 2100, y: 200, type: 'ring', h: 40 },
        { x: 2500, y: 0, type: 'spike' },
        { x: 2900, y: 0, type: 'spike' },
    ]);
    curX += 3400;
}

// LEVEL 2: ACID DISTRICT (Starts with Ball -> Cube -> Wave -> Ship -> UFO -> Cube)
function buildLevel2(sim) {
    let curX = 1200;
    sim.player.mode = MODES.BALL;

    // Part 1: Ball
    for (let i = 0; i < 6; i++) {
        let isFloor = (i % 2 === 0);
        sim.addSection(curX + i * 1100, [
            { x: 300, y: isFloor ? 0 : 550, type: 'spike' },
            { x: 800, y: isFloor ? 550 : 0, type: 'block', w: 150, h: 50 }
        ]);
    }
    curX += 7000;

    // Transition: Cube
    sim.transitions.push({ x: curX, mode: MODES.CUBE });
    curX += 1000;

    // Cube
    sim.addSection(curX, [
        { x: 300, y: 0, type: 'pad' },
        { x: 700, y: 140, type: 'block', w: 120, h: 20 },
        { x: 1000, y: 140, type: 'ring', h: 50 },
        { x: 1300, y: 220, type: 'block', w: 120, h: 20 },
        { x: 1700, y: 0, type: 'spike' },
        { x: 2100, y: 0, type: 'spike' },
    ]);
    curX += 2600;

    // Transition: Wave
    sim.transitions.push({ x: curX, mode: MODES.WAVE });
    curX += 1000;

    // Wave
    for (let i = 0; i < 8; i++) {
        let isTop = (i % 2 === 0);
        sim.addSection(curX + i * 850, [
            { x: 0, y: isTop ? 320 : 0, type: 'block', w: 250, h: 180 },
            { x: 500, y: isTop ? 0 : 550, type: 'spike' }
        ]);
    }
    curX += 7100;

    // Transition: Ship
    sim.transitions.push({ x: curX, mode: MODES.SHIP });
    curX += 1000;

    // Ship
    for (let i = 0; i < 8; i++) {
        let yCenter = 300 + Math.cos(i * 0.6) * 100;
        sim.addSection(curX + i * 850, [
            { x: 0, y: 0, type: 'block', w: 150, h: Math.max(0, yCenter - 140) },
            { x: 0, y: yCenter + 140, type: 'block', w: 150, h: Math.max(0, 600 - (yCenter + 140)) },
            { x: 450, y: yCenter - 140, type: 'spike' }
        ]);
    }
    curX += 7100;

    // Transition: UFO
    sim.transitions.push({ x: curX, mode: MODES.UFO });
    curX += 1000;

    // UFO
    for (let i = 0; i < 6; i++) {
        sim.addSection(curX + i * 900, [
            { x: 0, y: 0, type: 'spike' },
            { x: 300, y: 150, type: 'block', w: 120, h: 20 },
            { x: 600, y: 0, type: 'spike' },
            { x: 750, y: 250, type: 'ring', h: 40 }
        ]);
    }
    curX += 5800;

    // Transition: Cube
    sim.transitions.push({ x: curX, mode: MODES.CUBE });
    curX += 1000;

    sim.addSection(curX, [
        { x: 300, y: 0, type: 'pad' },
        { x: 800, y: 0, type: 'spike' },
        { x: 1300, y: 0, type: 'spike' },
    ]);
    curX += 2000;
}

// LEVEL 3: INDUSTRIAL HELL (Starts with Wave -> UFO -> Ship -> Ball -> Cube)
function buildLevel3(sim) {
    let curX = 1200;
    sim.player.mode = MODES.WAVE;

    // Part 1: Wave
    for (let i = 0; i < 8; i++) {
        let isTop = (i % 2 === 0);
        sim.addSection(curX + i * 850, [
            { x: 0, y: isTop ? 320 : 0, type: 'block', w: 250, h: 180 },
            { x: 500, y: isTop ? 0 : 550, type: 'spike' }
        ]);
    }
    curX += 7100;

    // Transition: UFO
    sim.transitions.push({ x: curX, mode: MODES.UFO });
    curX += 1000;

    // UFO
    for (let i = 0; i < 6; i++) {
        sim.addSection(curX + i * 900, [
            { x: 0, y: 0, type: 'spike' },
            { x: 300, y: 150, type: 'block', w: 120, h: 20 },
            { x: 600, y: 0, type: 'spike' },
            { x: 750, y: 250, type: 'ring', h: 40 }
        ]);
    }
    curX += 5800;

    // Transition: Ship
    sim.transitions.push({ x: curX, mode: MODES.SHIP });
    curX += 1000;

    // Ship
    for (let i = 0; i < 8; i++) {
        let yCenter = 300 + Math.sin(i * 0.7) * 120;
        sim.addSection(curX + i * 850, [
            { x: 0, y: 0, type: 'block', w: 150, h: Math.max(0, yCenter - 140) },
            { x: 0, y: yCenter + 140, type: 'block', w: 150, h: Math.max(0, 600 - (yCenter + 140)) },
            { x: 450, y: yCenter - 140, type: 'spike' }
        ]);
    }
    curX += 7100;

    // Transition: Ball
    sim.transitions.push({ x: curX, mode: MODES.BALL });
    curX += 1000;

    // Ball
    for (let i = 0; i < 6; i++) {
        let isFloor = (i % 2 === 0);
        sim.addSection(curX + i * 1100, [
            { x: 300, y: isFloor ? 0 : 550, type: 'spike' },
            { x: 800, y: isFloor ? 550 : 0, type: 'block', w: 150, h: 50 }
        ]);
    }
    curX += 7000;

    // Transition: Cube
    sim.transitions.push({ x: curX, mode: MODES.CUBE });
    curX += 1000;

    sim.addSection(curX, [
        { x: 300, y: 0, type: 'pad' },
        { x: 800, y: 0, type: 'pad' },
        { x: 1300, y: 0, type: 'spike' },
        { x: 1700, y: 0, type: 'spike' },
    ]);
    curX += 2400;
}

function verifyLevel(levelFunc, levelName) {
    let sim = new GameSimulator();
    levelFunc(sim);

    let maxDist = 0;
    for (let obs of sim.obstacles) {
        if (obs.x > maxDist) maxDist = obs.x;
    }

    console.log(`Verifying ${levelName} (Max dist: ${maxDist})...`);

    let beam = [{ sim: sim, inputs: [] }];
    const BEAM_WIDTH = 120;
    let frame = 0;

    while (beam.length > 0 && frame < 15000) {
        let bestDist = beam[0].sim.gameDistance;
        if (bestDist >= maxDist + 500) {
            console.log(`✅ ${levelName} PASSED! 100% Beatable! Total frames: ${frame}\n`);
            return true;
        }

        let candidates = [];
        for (let path of beam) {
            let sFalse = cloneSim(path.sim); sFalse.step(false);
            if (!sFalse.dead) candidates.push({ sim: sFalse, inputs: path.inputs.concat([false]) });

            let sTrue = cloneSim(path.sim); sTrue.step(true);
            if (!sTrue.dead) candidates.push({ sim: sTrue, inputs: path.inputs.concat([true]) });
        }

        if (candidates.length === 0) {
            console.error(`❌ ${levelName} FAILED at frame ${frame}, distance ${bestDist.toFixed(0)}`);
            return false;
        }

        candidates.forEach(c => {
            c.score = c.sim.gameDistance * 10;
            if (c.sim.player.mode === MODES.SHIP || c.sim.player.mode === MODES.WAVE) {
                c.score -= Math.abs(c.sim.player.y - 350) * 0.2;
            }
        });

        candidates.sort((a, b) => b.score - a.score);

        let map = new Map();
        let uniqueCandidates = [];
        for (let c of candidates) {
            let key = `${c.sim.gameDistance.toFixed(0)}_${c.sim.player.mode}_${c.sim.player.y.toFixed(0)}_${c.sim.player.velocityY.toFixed(0)}_${c.sim.player.isGrounded}_${c.sim.jumpPressed}_${c.sim.gravityDir}`;
            if (!map.has(key)) {
                map.set(key, true);
                uniqueCandidates.push(c);
                if (uniqueCandidates.length >= BEAM_WIDTH) break;
            }
        }

        beam = uniqueCandidates;
        frame++;
    }
}

verifyLevel(buildLevel1, "LEVEL 1: CYBER RAVE");
verifyLevel(buildLevel2, "LEVEL 2: ACID DISTRICT");
verifyLevel(buildLevel3, "LEVEL 3: INDUSTRIAL HELL");
