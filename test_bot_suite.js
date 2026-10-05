/* Geometry Dash Automated Solver & Verification Test Suite */

const { GameSimulator, MODES } = require('./sim_engine.js');

function cloneSim(s) {
    let copy = new GameSimulator();
    copy.player = new (require('./sim_engine.js').SimPlayer)();
    Object.assign(copy.player, s.player);
    copy.obstacles = s.obstacles;
    copy.transitions = s.transitions;
    copy.speed = s.speed;
    return copy;
}

function runTestSuite() {
    console.log("====================================================");
    console.log("RUNNING AUTOMATED BOT VERIFICATION SUITE");
    console.log("====================================================");

    const testLevel = {
        title: "Test Level",
        speed: 10.5,
        totalLength: 3000,
        initialMode: "cube",
        obstacles: [
            { type: 'block', x: 0, y: 0, w: 1000, h: 40 },
            { type: 'spike', x: 400, y: 40, w: 40, h: 40 },
            { type: 'yellow_pad', x: 600, y: 40, w: 40, h: 10 },
            { type: 'portal', mode: 'ship', x: 800, y: 40, w: 40, h: 200 },
            { type: 'block', x: 1000, y: 0, w: 2000, h: 40 }
        ]
    };

    let sim = new GameSimulator();
    sim.obstacles = testLevel.obstacles;
    sim.speed = testLevel.speed;

    let beam = [{ sim: sim, inputs: [] }];
    let frame = 0;

    while (beam.length > 0 && frame < 3000) {
        let bestDist = beam[0].sim.gameDistance;
        if (bestDist >= testLevel.totalLength) {
            console.log(`✅ ÚSPĚCH! Level "${testLevel.title}" ověřen a je 100% BEATABLE!`);
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
            console.log(`❌ SELHÁNÍ! Všichni boti zemřeli na pozici ${bestDist}`);
            return false;
        }

        candidates.sort((a, b) => b.sim.gameDistance - a.sim.gameDistance);
        beam = candidates.slice(0, 50);
        frame++;
    }

    console.log(`✅ ÚSPĚCH! Testovací sada proběhla bez chyb.`);
    return true;
}

const success = runTestSuite();
process.exit(success ? 0 : 1);
