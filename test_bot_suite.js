const { GameSimulator, MODES } = require('./sim_engine.js');
const { buildCalculatedLevel } = require('./full_level_solver.js');

function runTestSuite() {
    let sim = new GameSimulator();
    buildCalculatedLevel(sim);

    let maxDist = 0;
    for (let obs of sim.obstacles) {
        if (obs.x > maxDist) maxDist = obs.x;
    }

    console.log(`====================================================`);
    console.log(`RUNNING AUTOMATED BOT VERIFICATION SUITE (0% - 100%)`);
    console.log(`Total Level Distance: ${maxDist} px`);
    console.log(`====================================================`);

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

    let beam = [{ sim: sim, inputs: [] }];
    const BEAM_WIDTH = 120;
    let frame = 0;

    while (beam.length > 0 && frame < 15000) {
        let bestDist = beam[0].sim.gameDistance;
        if (bestDist >= maxDist + 500) {
            console.log(`[PASS] 100% Deathless Completion Verified! Total frames: ${frame}`);
            process.exit(0);
        }

        let candidates = [];
        for (let path of beam) {
            let sFalse = cloneSim(path.sim); sFalse.step(false);
            if (!sFalse.dead) candidates.push({ sim: sFalse, inputs: path.inputs.concat([false]) });

            let sTrue = cloneSim(path.sim); sTrue.step(true);
            if (!sTrue.dead) candidates.push({ sim: sTrue, inputs: path.inputs.concat([true]) });
        }

        if (candidates.length === 0) {
            console.error(`[FAIL] Bot died at frame ${frame}, distance ${bestDist.toFixed(0)}`);
            process.exit(1);
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

    console.error(`[FAIL] Simulation timed out.`);
    process.exit(1);
}

runTestSuite();
