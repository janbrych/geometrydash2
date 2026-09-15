const { GameSimulator, MODES } = require('./sim_engine.js');

let sim = new GameSimulator();
sim.player.mode = MODES.SHIP;
sim.gameDistance = 20000;
sim.player.y = 350;

// Ship section in level 3
for (let i = 0; i < 8; i++) {
    let yCenter = 300 + Math.sin(i * 0.7) * 120;
    sim.addSection(20000 + i * 850, [
        { x: 0, y: 0, type: 'block', w: 150, h: Math.max(0, yCenter - 140) },
        { x: 0, y: yCenter + 140, type: 'block', w: 150, h: Math.max(0, 600 - (yCenter + 140)) },
        { x: 450, y: yCenter - 140, type: 'spike' }
    ]);
}

console.log("Checking level 3 ship section...");
