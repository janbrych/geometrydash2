/* Level Database & Storage Manager */

const STORAGE_KEY = 'gd_custom_levels';

const LevelDB = {
    getAllLevels() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return this.getDefaultLevels();
        try {
            return JSON.parse(raw);
        } catch (e) {
            console.error('Failed to parse custom levels from storage', e);
            return this.getDefaultLevels();
        }
    },

    getDefaultLevels() {
        // Sample starter custom level if none exist
        const defaultLevel = {
            id: 'custom_starter_1',
            title: 'Neon Cyber Genesis',
            author: 'Community',
            createdAt: new Date().toISOString(),
            speed: 10.5,
            music: 'techno_level1.wav',
            totalLength: 20000,
            initialMode: 'cube',
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
        const list = [defaultLevel];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        return list;
    },

    getLevelById(id) {
        const levels = this.getAllLevels();
        return levels.find(lvl => lvl.id === id) || null;
    },

    saveLevel(levelData) {
        const levels = this.getAllLevels();
        if (!levelData.id) {
            levelData.id = 'level_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
            levelData.createdAt = new Date().toISOString();
        } else {
            levelData.updatedAt = new Date().toISOString();
        }

        const existingIdx = levels.findIndex(lvl => lvl.id === levelData.id);
        if (existingIdx >= 0) {
            levels[existingIdx] = levelData;
        } else {
            levels.push(levelData);
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(levels));
        return levelData;
    },

    deleteLevel(id) {
        let levels = this.getAllLevels();
        levels = levels.filter(lvl => lvl.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(levels));
    },

    exportToJson(levelData) {
        return JSON.stringify(levelData, null, 2);
    },

    importFromJson(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            if (!data.title || !Array.isArray(data.obstacles)) {
                throw new Error('Neplatný formát levelu.');
            }
            // Generate new ID to avoid conflict
            data.id = 'level_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
            data.createdAt = new Date().toISOString();
            this.saveLevel(data);
            return data;
        } catch (e) {
            alert('Chyba při importu levelu: ' + e.message);
            return null;
        }
    }
};

if (typeof module !== 'undefined') {
    module.exports = LevelDB;
}
