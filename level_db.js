/* Level Database & Storage Manager */

const STORAGE_KEY = 'gd_custom_levels';

const LevelDB = {
    getAllLevels() {
        const raw = localStorage.getItem(STORAGE_KEY);
        let levels = [];
        if (!raw) {
            levels = this.getDefaultLevels();
        } else {
            try {
                levels = JSON.parse(raw);
            } catch (e) {
                console.error('Failed to parse custom levels from storage', e);
                levels = this.getDefaultLevels();
            }
        }
        return levels.map(lvl => this.migrateLevel(lvl));
    },

    getDefaultLevels() {
        const defaultLevel = {
            id: 'custom_starter_1',
            title: 'Neon Cyber Genesis',
            author: 'Community',
            isMain: true,
            createdAt: new Date().toISOString(),
            speed: 10.5,
            bpm: 120,
            music: 'techno_level1.wav',
            totalLength: 12000,
            initialMode: 'cube',
            startPosition: { x: 100, y: 0, mode: 'cube' },
            floorLocked: true,
            obstacles: [
                { type: 'spike', x: 800, y: 0, w: 40, h: 40 },
                { type: 'spike', x: 1200, y: 0, w: 40, h: 40 },
                { type: 'block', x: 1600, y: 0, w: 40, h: 40 },
                { type: 'yellow_pad', x: 1600, y: 40, w: 40, h: 10 },
                { type: 'block', x: 2000, y: 0, w: 40, h: 80 },
                { type: 'portal', mode: 'ship', x: 2400, y: 0, w: 40, h: 200 },
                { type: 'block', x: 2800, y: 0, w: 40, h: 160 },
                { type: 'block', x: 2800, y: 280, w: 40, h: 160 },
                { type: 'portal', mode: 'ball', x: 3400, y: 0, w: 40, h: 200 },
                { type: 'spike', x: 3800, y: 0, w: 40, h: 40 },
                { type: 'yellow_ring', x: 4200, y: 120, w: 30, h: 30 },
                { type: 'portal', mode: 'cube', x: 4600, y: 0, w: 40, h: 200 },
                { type: 'coin', x: 4900, y: 120, w: 30, h: 30 }
            ]
        };
        const migrated = [this.migrateLevel(defaultLevel)];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
    },

    migrateLevel(level) {
        if (!level) return null;
        const totalLength = parseInt(level.totalLength, 10) || 20000;
        level.totalLength = totalLength;
        level.speed = parseFloat(level.speed) || 10.5;
        level.bpm = parseInt(level.bpm, 10) || 120;
        level.initialMode = level.initialMode || 'cube';
        level.music = level.music || 'techno_level1.wav';
        if (typeof level.floorLocked === 'undefined') {
            level.floorLocked = true;
        }

        if (!Array.isArray(level.obstacles)) {
            level.obstacles = [];
        }

        // Migrate Start Position & START Block
        let existingStart = level.obstacles.find(o => o.type === 'start');
        if (!level.startPosition) {
            if (existingStart) {
                level.startPosition = {
                    x: existingStart.x,
                    y: existingStart.y,
                    mode: existingStart.mode || level.initialMode || 'cube'
                };
            } else {
                level.startPosition = { x: 100, y: 0, mode: level.initialMode || 'cube' };
            }
        }

        // Ensure single START object in obstacles matching startPosition
        level.obstacles = level.obstacles.filter(o => o.type !== 'start');
        level.obstacles.push({
            type: 'start',
            x: level.startPosition.x,
            y: level.startPosition.y,
            mode: level.startPosition.mode || level.initialMode || 'cube',
            w: 40,
            h: 40
        });

        // Migrate Floor Blocks
        const hasFloor = level.obstacles.some(o => o.isFloor || o.type === 'floor');
        if (!hasFloor) {
            const floorBlocks = [];
            for (let x = 0; x <= totalLength + 2000; x += 40) {
                floorBlocks.push({
                    type: 'block',
                    x: x,
                    y: -40,
                    w: 40,
                    h: 40,
                    isFloor: true
                });
            }
            level.obstacles = [...floorBlocks, ...level.obstacles];
        }

        return level;
    },

    toggleMainLevel(id) {
        const levels = this.getAllLevels();
        const lvl = levels.find(l => l.id === id);
        if (lvl) {
            lvl.isMain = !lvl.isMain;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(levels));
        }
        return lvl;
    },

    getLevelById(id) {
        const levels = this.getAllLevels();
        return levels.find(lvl => lvl.id === id) || null;
    },

    saveLevel(levelData) {
        const migrated = this.migrateLevel(levelData);
        const levels = this.getAllLevels();

        if (!migrated.id) {
            migrated.id = 'level_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
            migrated.createdAt = new Date().toISOString();
        } else {
            migrated.updatedAt = new Date().toISOString();
        }

        const existingIdx = levels.findIndex(lvl => lvl.id === migrated.id);
        if (existingIdx >= 0) {
            levels[existingIdx] = migrated;
        } else {
            levels.push(migrated);
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(levels));
        return migrated;
    },

    deleteLevel(id) {
        let levels = this.getAllLevels();
        levels = levels.filter(lvl => lvl.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(levels));
    },

    exportToJson(levelData) {
        const migrated = this.migrateLevel(levelData);
        return JSON.stringify(migrated, null, 2);
    },

    importFromJson(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            if (!data.title || !Array.isArray(data.obstacles)) {
                throw new Error('Neplatný formát levelu.');
            }
            data.id = 'level_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
            data.createdAt = new Date().toISOString();
            const saved = this.saveLevel(data);
            return saved;
        } catch (e) {
            alert('Chyba při importu levelu: ' + e.message);
            return null;
        }
    }
};

if (typeof module !== 'undefined') {
    module.exports = LevelDB;
}
