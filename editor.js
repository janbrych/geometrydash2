/* Geometry Dash Level Editor Core Engine */

// Imports / Global Checks
const LevelDBManager = typeof LevelDB !== 'undefined' ? LevelDB : (typeof require !== 'undefined' ? require('./level_db.js') : null);
const Physics = typeof PhysicsEngine !== 'undefined' ? PhysicsEngine : (typeof require !== 'undefined' ? require('./sim_engine.js') : null);

const canvas = document.getElementById('editorCanvas');
const ctx = canvas.getContext('2d');
const timelineCanvas = document.getElementById('timelineCanvas');
const tCtx = timelineCanvas ? timelineCanvas.getContext('2d') : null;

// Grid Constants
const GRID_SIZE = 40;
const PORTAL_COLORS_EDITOR = (Physics && Physics.PORTAL_COLORS) ? Physics.PORTAL_COLORS : {
    cube: '#00ff66',
    ship: '#ff00aa',
    ball: '#ff2200',
    ufo: '#ff9900',
    wave: '#0099ff'
};

// Editor Viewport State (Persistent World Camera)
const editorCamera = {
    x: 100,
    y: 0,
    zoom: 1.0
};

// Runtime Viewport State (Temporary Camera for Playtest / Bot Test)
const runtimeCamera = {
    x: 100,
    y: 0,
    zoom: 1.0
};

let isPanning = false;
let startPanMouseX = 0;
let startPanMouseY = 0;
let startPanCamX = 0;
let startPanCamY = 0;
let showGrid = true;
let isFloorLocked = true;

// Tool & Selection State
let currentTool = 'draw'; // 'draw', 'erase'
let selectedObjectType = 'block';
let selectedPortalMode = 'ship';

// Current Level Data Structure
let currentLevel = {
    id: null,
    title: 'Custom Level 1',
    author: 'Player',
    speed: 10.5,
    bpm: 120,
    music: 'techno_level2.wav',
    customMusic: null,
    totalLength: 20000,
    initialMode: 'cube',
    startPosition: { x: 100, y: 0, mode: 'cube' },
    floorLocked: true,
    obstacles: []
};

// Undo / Redo History Stack (up to 50 states)
const historyStack = [];
let historyIndex = -1;

// Central Editor State Machine
let editorMode = 'EDIT'; // 'EDIT', 'PLAYTEST', 'BOT_TEST'
let playtestState = null;
let botSuiteState = null;
let animFrameId = null;
let playtestAudio = null;

// UI Elements
const levelTitleInput = document.getElementById('levelTitleInput');
const speedSelect = document.getElementById('speedSelect');
const musicSelect = document.getElementById('musicSelect');
const levelLengthInput = document.getElementById('levelLengthInput');
const bpmInput = document.getElementById('bpmInput');
const cursorXEl = document.getElementById('cursorX');
const objectCountEl = document.getElementById('objectCount');

// Canvas Resize
function resizeCanvas() {
    if (canvas && canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
    }
    if (timelineCanvas && timelineCanvas.parentElement) {
        timelineCanvas.width = timelineCanvas.parentElement.clientWidth;
        timelineCanvas.height = timelineCanvas.parentElement.clientHeight;
    }
}
window.addEventListener('resize', resizeCanvas);

// Coordinate Conversions
function worldToScreen(wx, wy, cam = editorCamera) {
    const sx = (wx - cam.x) * cam.zoom + canvas.width / 2;
    const sy = canvas.height - 100 - (wy - cam.y) * cam.zoom;
    return { x: sx, y: sy };
}

function screenToWorld(sx, sy, cam = editorCamera) {
    const wx = (sx - canvas.width / 2) / cam.zoom + cam.x;
    const wy = (canvas.height - 100 - sy) / cam.zoom + cam.y;
    return { x: wx, y: wy };
}

function snapToGrid(val) {
    return Math.floor(val / GRID_SIZE) * GRID_SIZE;
}

// History & Undo / Redo System
function saveHistoryState() {
    if (historyIndex < historyStack.length - 1) {
        historyStack.splice(historyIndex + 1);
    }

    const snapshot = JSON.parse(JSON.stringify({
        title: currentLevel.title,
        author: currentLevel.author,
        speed: currentLevel.speed,
        bpm: currentLevel.bpm,
        music: currentLevel.music,
        customMusic: currentLevel.customMusic,
        totalLength: currentLevel.totalLength,
        initialMode: currentLevel.initialMode,
        startPosition: currentLevel.startPosition,
        floorLocked: isFloorLocked,
        obstacles: currentLevel.obstacles
    }));

    historyStack.push(snapshot);
    if (historyStack.length > 50) historyStack.shift();
    historyIndex = historyStack.length - 1;

    updateUndoRedoButtons();
}

function undo() {
    if (editorMode !== 'EDIT' || historyIndex <= 0) return;
    historyIndex--;
    loadHistorySnapshot(historyStack[historyIndex]);
}

function redo() {
    if (editorMode !== 'EDIT' || historyIndex >= historyStack.length - 1) return;
    historyIndex++;
    loadHistorySnapshot(historyStack[historyIndex]);
}

function loadHistorySnapshot(snapshot) {
    if (!snapshot) return;
    currentLevel.title = snapshot.title;
    currentLevel.author = snapshot.author;
    currentLevel.speed = snapshot.speed;
    currentLevel.bpm = snapshot.bpm;
    currentLevel.music = snapshot.music;
    currentLevel.customMusic = snapshot.customMusic;
    currentLevel.totalLength = snapshot.totalLength;
    currentLevel.initialMode = snapshot.initialMode;
    currentLevel.startPosition = snapshot.startPosition;
    isFloorLocked = snapshot.floorLocked;
    currentLevel.obstacles = JSON.parse(JSON.stringify(snapshot.obstacles));

    updateUIFromLevel();
    updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
    const btnUndo = document.getElementById('btnUndo');
    const btnRedo = document.getElementById('btnRedo');
    if (btnUndo) btnUndo.disabled = historyIndex <= 0;
    if (btnRedo) btnRedo.disabled = historyIndex >= historyStack.length - 1;
}

// Initialization
function initEditor() {
    resizeCanvas();
    if (LevelDBManager) {
        const levels = LevelDBManager.getAllLevels();
        if (levels && levels.length > 0) {
            currentLevel = LevelDBManager.migrateLevel(levels[0]);
        }
    }
    isFloorLocked = currentLevel.floorLocked !== false;

    setupEventListeners();
    updateUIFromLevel();
    saveHistoryState();
    requestAnimationFrame(editorLoop);
}

function updateUIFromLevel() {
    if (levelTitleInput) levelTitleInput.value = currentLevel.title || 'Custom Level';
    if (speedSelect) speedSelect.value = (currentLevel.speed || 10.5).toString();
    if (musicSelect) musicSelect.value = currentLevel.music || 'techno_level2.wav';
    if (levelLengthInput) levelLengthInput.value = currentLevel.totalLength || 20000;
    if (bpmInput) bpmInput.value = currentLevel.bpm || 120;
    if (objectCountEl) objectCountEl.textContent = currentLevel.obstacles.length;

    const btnFloorLock = document.getElementById('btnFloorLock');
    if (btnFloorLock) {
        btnFloorLock.textContent = isFloorLocked ? '🔒 Floor [LOCKED]' : '🔓 Floor [UNLOCKED]';
        btnFloorLock.classList.toggle('active', isFloorLocked);
    }

    const resolvedBadge = document.getElementById('resolvedTrackBadge');
    const resolvedText = document.getElementById('resolvedTrackText');
    if (currentLevel.customMusic && resolvedBadge && resolvedText) {
        resolvedText.textContent = `🎵 ${currentLevel.customMusic.title} (${currentLevel.customMusic.artist || 'Custom'})`;
        resolvedBadge.classList.remove('hidden');
    } else if (resolvedBadge) {
        resolvedBadge.classList.add('hidden');
    }
}

function updateLevelFromUI() {
    if (levelTitleInput) currentLevel.title = levelTitleInput.value || 'Custom Level';
    if (speedSelect) currentLevel.speed = parseFloat(speedSelect.value) || 10.5;
    if (musicSelect) currentLevel.music = musicSelect.value || 'techno_level2.wav';
    if (levelLengthInput) currentLevel.totalLength = parseInt(levelLengthInput.value, 10) || 20000;
    if (bpmInput) currentLevel.bpm = parseInt(bpmInput.value, 10) || 120;
    currentLevel.floorLocked = isFloorLocked;
}

// Event Listeners Setup
function setupEventListeners() {
    // Canvas Navigation
    canvas.addEventListener('mousedown', (e) => {
        if (editorMode !== 'EDIT') return;

        if (e.button === 1 || e.button === 2 || e.shiftKey) {
            isPanning = true;
            startPanMouseX = e.clientX;
            startPanMouseY = e.clientY;
            startPanCamX = editorCamera.x;
            startPanCamY = editorCamera.y;
            e.preventDefault();
            return;
        }

        if (e.button === 0) {
            handleCanvasClick(e);
        }
    });

    canvas.addEventListener('contextmenu', e => e.preventDefault());

    window.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        if (isPanning) {
            const dx = (e.clientX - startPanMouseX) / editorCamera.zoom;
            const dy = (e.clientY - startPanMouseY) / editorCamera.zoom;
            editorCamera.x = startPanCamX - dx;
            editorCamera.y = startPanCamY + dy;
            return;
        }

        const world = screenToWorld(mouseX, mouseY, editorCamera);
        if (cursorXEl) cursorXEl.textContent = Math.round(world.x) + 'px';

        if (e.buttons === 1 && editorMode === 'EDIT' && currentTool === 'draw') {
            handleCanvasClick(e);
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (e.button === 1 || e.button === 2 || e.shiftKey) {
            isPanning = false;
        }
    });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        if (e.ctrlKey || e.metaKey) {
            // Mouse-Centered Zoom
            const worldPos = screenToWorld(mouseX, mouseY, editorCamera);
            const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
            const newZoom = Math.max(0.2, Math.min(3.5, editorCamera.zoom * zoomFactor));

            editorCamera.zoom = newZoom;
            editorCamera.x = worldPos.x - (mouseX - canvas.width / 2) / newZoom;
            editorCamera.y = worldPos.y - (canvas.height - 100 - mouseY) / newZoom;
        } else {
            // Horizontal Pan
            editorCamera.x += e.deltaY / editorCamera.zoom;
        }
    }, { passive: false });

    // Keybindings
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.code === 'KeyZ') {
                e.preventDefault();
                if (e.shiftKey) redo(); else undo();
            } else if (e.code === 'KeyY') {
                e.preventDefault();
                redo();
            }
        }

        if (editorMode === 'PLAYTEST') {
            if (e.code === 'Space' || e.code === 'ArrowUp') {
                if (playtestState) playtestState.jumpPressed = true;
            } else if (e.code === 'Escape') {
                setEditorMode('EDIT');
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        if (editorMode === 'PLAYTEST') {
            if (e.code === 'Space' || e.code === 'ArrowUp') {
                if (playtestState) {
                    playtestState.jumpPressed = false;
                    playtestState.jumpProcessed = false;
                }
            }
        }
    });

    // Toolbar Buttons
    const btnDraw = document.getElementById('btnToolDraw');
    const btnErase = document.getElementById('btnToolErase');
    const btnClear = document.getElementById('btnClearAll');
    const btnGrid = document.getElementById('btnGridToggle');
    const btnResetView = document.getElementById('btnResetView');
    const btnFloorLock = document.getElementById('btnFloorLock');
    const btnUndo = document.getElementById('btnUndo');
    const btnRedo = document.getElementById('btnRedo');

    if (btnDraw) btnDraw.addEventListener('click', () => setTool('draw'));
    if (btnErase) btnErase.addEventListener('click', () => setTool('erase'));
    if (btnUndo) btnUndo.addEventListener('click', undo);
    if (btnRedo) btnRedo.addEventListener('click', redo);

    if (btnClear) {
        btnClear.addEventListener('click', () => {
            if (confirm('Opravdu chcete vymazat všechny vlastní objekty v levelu?')) {
                currentLevel.obstacles = currentLevel.obstacles.filter(o => o.isFloor);
                if (objectCountEl) objectCountEl.textContent = currentLevel.obstacles.length;
                saveHistoryState();
            }
        });
    }

    if (btnGrid) {
        btnGrid.addEventListener('click', () => {
            showGrid = !showGrid;
            btnGrid.textContent = showGrid ? '🌐 Mřížka [ZAP]' : '🌐 Mřížka [VYP]';
        });
    }

    if (btnResetView) {
        btnResetView.addEventListener('click', () => {
            editorCamera.x = currentLevel.startPosition ? currentLevel.startPosition.x + 100 : 100;
            editorCamera.y = 0;
            editorCamera.zoom = 1.0;
        });
    }

    if (btnFloorLock) {
        btnFloorLock.addEventListener('click', () => {
            isFloorLocked = !isFloorLocked;
            currentLevel.floorLocked = isFloorLocked;
            btnFloorLock.textContent = isFloorLocked ? '🔒 Floor [LOCKED]' : '🔓 Floor [UNLOCKED]';
            btnFloorLock.classList.toggle('active', isFloorLocked);
            saveHistoryState();
        });
    }

    // Item Palette Selection
    document.querySelectorAll('.palette-grid .item-btn, .portals-grid .portal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.palette-grid .item-btn, .portals-grid .portal-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedObjectType = btn.dataset.type;
            if (btn.dataset.mode) selectedPortalMode = btn.dataset.mode;
            setTool('draw');
        });
    });

    // Custom Music Resolver Controls
    const btnResolveMusic = document.getElementById('btnResolveMusic');
    const customMusicUrlInput = document.getElementById('customMusicUrlInput');
    const resolvedTrackBadge = document.getElementById('resolvedTrackBadge');
    const resolvedTrackText = document.getElementById('resolvedTrackText');
    const btnRemoveCustomMusic = document.getElementById('btnRemoveCustomMusic');

    if (btnResolveMusic && customMusicUrlInput) {
        btnResolveMusic.addEventListener('click', async () => {
            const url = customMusicUrlInput.value.trim();
            if (!url) return;

            btnResolveMusic.disabled = true;
            btnResolveMusic.textContent = '...';

            try {
                const res = await fetch(`/api/music/resolve?url=${encodeURIComponent(url)}`);
                const data = await res.json();

                if (data.success) {
                    currentLevel.customMusic = {
                        title: data.title,
                        artist: data.artist,
                        audioUrl: data.audioUrl,
                        thumbnail: data.thumbnail
                    };
                    currentLevel.music = data.audioUrl;
                    if (data.bpm) {
                        currentLevel.bpm = data.bpm;
                        if (bpmInput) bpmInput.value = data.bpm;
                    }

                    if (resolvedTrackText) resolvedTrackText.textContent = `🎵 ${data.title} (${data.artist})`;
                    if (resolvedTrackBadge) resolvedTrackBadge.classList.remove('hidden');
                    saveHistoryState();
                } else {
                    alert(data.error || 'Neplatná hudební URL.');
                }
            } catch (e) {
                currentLevel.customMusic = {
                    title: 'Custom Track',
                    artist: 'External Stream',
                    audioUrl: url
                };
                currentLevel.music = url;
                if (resolvedTrackText) resolvedTrackText.textContent = `🎵 Custom Audio Stream`;
                if (resolvedTrackBadge) resolvedTrackBadge.classList.remove('hidden');
                saveHistoryState();
            } finally {
                btnResolveMusic.disabled = false;
                btnResolveMusic.textContent = 'Load';
            }
        });
    }

    if (btnRemoveCustomMusic) {
        btnRemoveCustomMusic.addEventListener('click', () => {
            currentLevel.customMusic = null;
            currentLevel.music = 'techno_level2.wav';
            if (musicSelect) musicSelect.value = 'techno_level2.wav';
            if (resolvedTrackBadge) resolvedTrackBadge.classList.add('hidden');
            if (customMusicUrlInput) customMusicUrlInput.value = '';
            saveHistoryState();
        });
    }

    // Level Settings Inputs
    if (levelTitleInput) levelTitleInput.addEventListener('change', () => { updateLevelFromUI(); saveHistoryState(); });
    if (speedSelect) speedSelect.addEventListener('change', () => { updateLevelFromUI(); saveHistoryState(); });
    if (musicSelect) musicSelect.addEventListener('change', () => { updateLevelFromUI(); saveHistoryState(); });
    if (levelLengthInput) levelLengthInput.addEventListener('change', () => {
        updateLevelFromUI();
        if (LevelDBManager) currentLevel = LevelDBManager.migrateLevel(currentLevel);
        saveHistoryState();
    });
    if (bpmInput) bpmInput.addEventListener('change', () => { updateLevelFromUI(); saveHistoryState(); });

    // Save, Load, Import, Export
    const btnSaveDb = document.getElementById('btnSaveDb');
    const btnOpenDb = document.getElementById('btnOpenDb');
    const btnCloseDbModal = document.getElementById('btnCloseDbModal');
    const btnExportJson = document.getElementById('btnExportJson');
    const btnImportJson = document.getElementById('btnImportJson');
    const jsonFileInput = document.getElementById('jsonFileInput');

    if (btnSaveDb) {
        btnSaveDb.addEventListener('click', () => {
            updateLevelFromUI();
            if (LevelDBManager) {
                LevelDBManager.saveLevel(currentLevel);
                alert(`Level "${currentLevel.title}" byl úspěšně uložen do DB!`);
            }
        });
    }

    if (btnOpenDb) btnOpenDb.addEventListener('click', openDbModal);
    if (btnCloseDbModal) btnCloseDbModal.addEventListener('click', closeDbModal);

    if (btnExportJson) {
        btnExportJson.addEventListener('click', () => {
            updateLevelFromUI();
            if (LevelDBManager) {
                const jsonStr = LevelDBManager.exportToJson(currentLevel);
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${currentLevel.title.toLowerCase().replace(/\s+/g, '_')}_level.json`;
                a.click();
                URL.revokeObjectURL(url);
            }
        });
    }

    if (btnImportJson && jsonFileInput) {
        btnImportJson.addEventListener('click', () => jsonFileInput.click());
        jsonFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                if (LevelDBManager) {
                    const imported = LevelDBManager.importFromJson(event.target.result);
                    if (imported) {
                        currentLevel = imported;
                        isFloorLocked = currentLevel.floorLocked !== false;
                        updateUIFromLevel();
                        saveHistoryState();
                        alert(`Level "${imported.title}" byl úspěšně importován!`);
                    }
                }
            };
            reader.readAsText(file);
            e.target.value = '';
        });
    }

    // Test Buttons
    const btnTestYourself = document.getElementById('btnTestYourself');
    const btnBotTest = document.getElementById('btnBotTest');
    const btnStopBotTest = document.getElementById('btnStopBotTest');

    if (btnTestYourself) {
        btnTestYourself.addEventListener('click', () => {
            if (editorMode === 'PLAYTEST') setEditorMode('EDIT'); else setEditorMode('PLAYTEST');
        });
    }

    if (btnBotTest) {
        btnBotTest.addEventListener('click', () => {
            if (editorMode === 'BOT_TEST') setEditorMode('EDIT'); else setEditorMode('BOT_TEST');
        });
    }

    if (btnStopBotTest) {
        btnStopBotTest.addEventListener('click', () => setEditorMode('EDIT'));
    }
}

function setTool(tool) {
    currentTool = tool;
    const btnDraw = document.getElementById('btnToolDraw');
    const btnErase = document.getElementById('btnToolErase');
    if (btnDraw) btnDraw.classList.toggle('active', tool === 'draw');
    if (btnErase) btnErase.classList.toggle('active', tool === 'erase');
}

// Canvas Click Handler
function handleCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const world = screenToWorld(mouseX, mouseY, editorCamera);

    const gridX = Math.max(0, snapToGrid(world.x));
    const gridY = snapToGrid(world.y);

    if (currentTool === 'erase') {
        const origCount = currentLevel.obstacles.length;
        currentLevel.obstacles = currentLevel.obstacles.filter(obs => {
            if (obs.isFloor && isFloorLocked) return true;
            const hit = Math.abs(obs.x - gridX) < 20 && Math.abs(obs.y - gridY) < 20;
            return !hit;
        });

        if (currentLevel.obstacles.length !== origCount) {
            if (objectCountEl) objectCountEl.textContent = currentLevel.obstacles.length;
            saveHistoryState();
        }
        return;
    }

    if (currentTool === 'draw') {
        if (selectedObjectType === 'start') {
            currentLevel.obstacles = currentLevel.obstacles.filter(o => o.type !== 'start');
            currentLevel.startPosition = {
                x: gridX,
                y: Math.max(0, gridY),
                mode: selectedPortalMode || currentLevel.initialMode || 'cube'
            };
            currentLevel.obstacles.push({
                type: 'start',
                x: currentLevel.startPosition.x,
                y: currentLevel.startPosition.y,
                mode: currentLevel.startPosition.mode,
                w: 40,
                h: 40
            });
            if (objectCountEl) objectCountEl.textContent = currentLevel.obstacles.length;
            saveHistoryState();
            return;
        }

        const exists = currentLevel.obstacles.some(obs => Math.abs(obs.x - gridX) < 10 && Math.abs(obs.y - gridY) < 10);
        if (exists) return;

        let newObj = {
            type: selectedObjectType,
            x: gridX,
            y: gridY,
            w: 40,
            h: 40
        };

        if (selectedObjectType === 'spike_ceiling') {
            newObj.type = 'spike';
            newObj.ceiling = true;
            newObj.y = 400;
        } else if (selectedObjectType === 'yellow_pad' || selectedObjectType === 'magenta_pad') {
            newObj.h = 10;
        } else if (selectedObjectType === 'yellow_ring' || selectedObjectType === 'magenta_ring' || selectedObjectType === 'coin') {
            newObj.w = 30;
            newObj.h = 30;
        } else if (selectedObjectType === 'portal') {
            newObj.mode = selectedPortalMode;
            newObj.w = 40;
            newObj.h = 200;
        }

        currentLevel.obstacles.push(newObj);
        if (objectCountEl) objectCountEl.textContent = currentLevel.obstacles.length;
        saveHistoryState();
    }
}

// Database Modal
function openDbModal() {
    const listContainer = document.getElementById('dbLevelsList');
    if (!listContainer || !LevelDBManager) return;
    listContainer.innerHTML = '';
    const levels = LevelDBManager.getAllLevels();

    if (levels.length === 0) {
        listContainer.innerHTML = '<p style="color:#64748b; text-align:center;">Žádné uložené levely.</p>';
    } else {
        levels.forEach(lvl => {
            const item = document.createElement('div');
            item.className = 'db-level-item';
            item.innerHTML = `
                <div class="db-level-info">
                    <h4>${lvl.title}</h4>
                    <p>Objektů: ${lvl.obstacles.length} • Rychlost: ${lvl.speed}x • ${new Date(lvl.createdAt || Date.now()).toLocaleDateString()}</p>
                </div>
                <div class="db-level-actions">
                    <button class="btn btn-primary btn-load-lvl">Načíst</button>
                    <button class="btn btn-warning btn-del-lvl" style="background:#ff0055; color:#fff; border-color:#ff0055;">Smazat</button>
                </div>
            `;

            item.querySelector('.btn-load-lvl').addEventListener('click', () => {
                currentLevel = LevelDBManager.migrateLevel(lvl);
                isFloorLocked = currentLevel.floorLocked !== false;
                updateUIFromLevel();
                saveHistoryState();
                closeDbModal();
            });

            item.querySelector('.btn-del-lvl').addEventListener('click', () => {
                if (confirm(`Opravdu chcete smazat level "${lvl.title}"?`)) {
                    LevelDBManager.deleteLevel(lvl.id);
                    openDbModal();
                }
            });

            listContainer.appendChild(item);
        });
    }

    const modal = document.getElementById('dbModal');
    if (modal) modal.classList.remove('hidden');
}

function closeDbModal() {
    const modal = document.getElementById('dbModal');
    if (modal) modal.classList.add('hidden');
}

// CENTRAL STATE TRANSITIONS
function setEditorMode(newMode) {
    if (editorMode === newMode) return;

    if (editorMode === 'PLAYTEST') {
        exitPlaytestMode();
    } else if (editorMode === 'BOT_TEST') {
        exitBotTestMode();
    }

    editorMode = newMode;

    if (newMode === 'EDIT') {
        enterEditMode();
    } else if (newMode === 'PLAYTEST') {
        enterPlaytestMode();
    } else if (newMode === 'BOT_TEST') {
        enterBotTestMode();
    }
}

function enterEditMode() {
    playtestState = null;
    botSuiteState = null;
}

function enterPlaytestMode() {
    updateLevelFromUI();

    const startPos = currentLevel.startPosition || { x: 100, y: 0, mode: 'cube' };
    playtestState = Physics.createPlayerState(startPos);

    runtimeCamera.x = startPos.x;
    runtimeCamera.y = startPos.y;
    runtimeCamera.zoom = editorCamera.zoom;

    const playBtn = document.getElementById('btnTestYourself');
    if (playBtn) {
        playBtn.textContent = '⏹️ Stop Playtest';
        playBtn.classList.add('active');
    }

    if (currentLevel.music) {
        try {
            playtestAudio = new Audio(currentLevel.music);
            playtestAudio.loop = true;
            playtestAudio.volume = 0.6;
            playtestAudio.play().catch(() => {});
        } catch (e) {}
    }
}

function exitPlaytestMode() {
    if (playtestAudio) {
        playtestAudio.pause();
        playtestAudio.currentTime = 0;
        playtestAudio = null;
    }
    playtestState = null;

    const playBtn = document.getElementById('btnTestYourself');
    if (playBtn) {
        playBtn.textContent = '🎮 Test Yourself';
        playBtn.classList.remove('active');
    }
}

function enterBotTestMode() {
    updateLevelFromUI();

    const startPos = currentLevel.startPosition || { x: 100, y: 0, mode: 'cube' };
    const bots = [];
    for (let i = 0; i < 20; i++) {
        const bot = Physics.createPlayerState(startPos);
        bot.id = i;
        bot.color = `hsla(${(i * 18) % 360}, 100%, 60%, 0.7)`;
        bot.lookAhead = 80 + i * 6;
        bot.jumpProcessedState = { value: false };
        bots.push(bot);
    }

    botSuiteState = {
        bots: bots,
        aliveCount: 20,
        maxDistance: startPos.x,
        completedBot: null
    };

    runtimeCamera.x = startPos.x;
    runtimeCamera.y = startPos.y;
    runtimeCamera.zoom = editorCamera.zoom;

    const botOverlay = document.getElementById('botStatusOverlay');
    if (botOverlay) botOverlay.classList.remove('hidden');

    const botBtn = document.getElementById('btnBotTest');
    if (botBtn) {
        botBtn.textContent = '⏹️ Stop Bot Suite';
        botBtn.classList.add('active');
    }
}

function exitBotTestMode() {
    if (playtestAudio) {
        playtestAudio.pause();
        playtestAudio.currentTime = 0;
        playtestAudio = null;
    }
    botSuiteState = null;

    const botOverlay = document.getElementById('botStatusOverlay');
    if (botOverlay) botOverlay.classList.add('hidden');

    const botBtn = document.getElementById('btnBotTest');
    if (botBtn) {
        botBtn.textContent = '🤖 20-Bot Suite';
        botBtn.classList.remove('active');
    }
}

// MAIN RENDER & PHYSICS LOOP
let lastFrameTime = performance.now();
let physicsAccumulator = 0;

function editorLoop(time) {
    const dt = Math.min((time - lastFrameTime) / 1000, 0.1);
    lastFrameTime = time;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (editorMode === 'EDIT') {
        renderGridAndLevel(editorCamera);
    } else if (editorMode === 'PLAYTEST') {
        physicsAccumulator += dt;
        while (physicsAccumulator >= Physics.FIXED_DT) {
            updatePlaytestPhysics();
            physicsAccumulator -= Physics.FIXED_DT;
        }
        renderPlaytest();
    } else if (editorMode === 'BOT_TEST') {
        physicsAccumulator += dt;
        while (physicsAccumulator >= Physics.FIXED_DT) {
            updateBotSuitePhysics();
            physicsAccumulator -= Physics.FIXED_DT;
        }
        renderBotSuite();
    }

    renderTimeline();

    animFrameId = requestAnimationFrame(editorLoop);
}

// RENDER TIMELINE
function renderTimeline() {
    if (!timelineCanvas || !tCtx) return;
    const width = timelineCanvas.width;
    const height = timelineCanvas.height;

    tCtx.clearRect(0, 0, width, height);
    tCtx.fillStyle = '#141722';
    tCtx.fillRect(0, 0, width, height);

    const activeCam = (editorMode === 'EDIT') ? editorCamera : runtimeCamera;
    const bpm = currentLevel.bpm || 120;
    const speed = currentLevel.speed || 10.5;

    const bpmLabel = document.getElementById('timelineBpmLabel');
    if (bpmLabel) bpmLabel.textContent = `🎵 ${bpm} BPM`;

    const pxPerSec = speed * 60;
    const secPerBeat = 60 / bpm;
    const distPerBeat = pxPerSec * secPerBeat;

    const topLeftWorld = screenToWorld(0, 0, activeCam);
    const bottomRightWorld = screenToWorld(canvas.width, canvas.height, activeCam);

    const startBeat = Math.max(0, Math.floor(topLeftWorld.x / distPerBeat));
    const endBeat = Math.ceil(bottomRightWorld.x / distPerBeat);

    tCtx.strokeStyle = '#2b3147';
    tCtx.lineWidth = 1;

    for (let b = startBeat; b <= endBeat; b++) {
        const worldX = b * distPerBeat;
        const screenX = worldToScreen(worldX, 0, activeCam).x;

        if (screenX >= 0 && screenX <= width) {
            const timeSec = (b * secPerBeat).toFixed(1);
            tCtx.beginPath();
            tCtx.moveTo(screenX, 0);
            tCtx.lineTo(screenX, height);
            tCtx.stroke();

            tCtx.fillStyle = '#00f0ff';
            tCtx.font = '10px Outfit';
            tCtx.fillText(`${timeSec}s`, screenX + 4, 14);
        }
    }

    let playheadX = null;
    if (editorMode === 'PLAYTEST' && playtestState) {
        playheadX = playtestState.x;
    } else if (editorMode === 'BOT_TEST' && botSuiteState) {
        playheadX = botSuiteState.maxDistance;
    }

    if (playheadX !== null) {
        const screenX = worldToScreen(playheadX, 0, activeCam).x;
        tCtx.strokeStyle = '#ff0055';
        tCtx.lineWidth = 2;
        tCtx.beginPath();
        tCtx.moveTo(screenX, 0);
        tCtx.lineTo(screenX, height);
        tCtx.stroke();
    }
}

// RENDER GRID & LEVEL IN WORLD SPACE
function renderGridAndLevel(cam) {
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (showGrid) {
        ctx.strokeStyle = '#1a2236';
        ctx.lineWidth = 1;

        const topLeft = screenToWorld(0, 0, cam);
        const bottomRight = screenToWorld(canvas.width, canvas.height, cam);

        const startX = snapToGrid(topLeft.x) - GRID_SIZE;
        const endX = snapToGrid(bottomRight.x) + GRID_SIZE;
        const startY = snapToGrid(bottomRight.y) - GRID_SIZE;
        const endY = snapToGrid(topLeft.y) + GRID_SIZE;

        for (let x = startX; x <= endX; x += GRID_SIZE) {
            const sx = worldToScreen(x, 0, cam).x;
            ctx.beginPath();
            ctx.moveTo(sx, 0);
            ctx.lineTo(sx, canvas.height);
            ctx.stroke();
        }

        for (let y = startY; y <= endY; y += GRID_SIZE) {
            const sy = worldToScreen(0, y, cam).y;
            ctx.beginPath();
            ctx.moveTo(0, sy);
            ctx.lineTo(canvas.width, sy);
            ctx.stroke();
        }
    }

    const groundScreenY = worldToScreen(0, 0, cam).y;
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2 * cam.zoom;
    ctx.beginPath();
    ctx.moveTo(0, groundScreenY);
    ctx.lineTo(canvas.width, groundScreenY);
    ctx.stroke();

    currentLevel.obstacles.forEach(obs => {
        const screen = worldToScreen(obs.x, obs.y + (obs.h || 40), cam);
        const w = (obs.w || 40) * cam.zoom;
        const h = (obs.h || 40) * cam.zoom;

        if (obs.type === 'start') {
            ctx.fillStyle = 'rgba(0, 255, 102, 0.2)';
            ctx.fillRect(screen.x, screen.y, w, h);
            ctx.strokeStyle = '#00ff66';
            ctx.lineWidth = 3 * cam.zoom;
            ctx.strokeRect(screen.x, screen.y, w, h);

            ctx.fillStyle = '#00ff66';
            ctx.font = `bold ${Math.max(10, Math.round(12 * cam.zoom))}px Outfit`;
            ctx.textAlign = 'center';
            ctx.fillText('START', screen.x + w / 2, screen.y + h / 2);
        } else if (obs.type === 'block') {
            ctx.fillStyle = obs.isFloor ? '#1e293b' : '#111827';
            ctx.strokeStyle = obs.isFloor ? '#334155' : '#00f0ff';
            ctx.lineWidth = 2 * cam.zoom;
            ctx.fillRect(screen.x, screen.y, w, h);
            ctx.strokeRect(screen.x, screen.y, w, h);
        } else if (obs.type === 'spike') {
            ctx.fillStyle = '#ff0055';
            ctx.beginPath();
            if (obs.ceiling) {
                ctx.moveTo(screen.x, screen.y);
                ctx.lineTo(screen.x + w / 2, screen.y + h);
                ctx.lineTo(screen.x + w, screen.y);
            } else {
                ctx.moveTo(screen.x, screen.y + h);
                ctx.lineTo(screen.x + w / 2, screen.y);
                ctx.lineTo(screen.x + w, screen.y + h);
            }
            ctx.closePath();
            ctx.fill();
        } else if (obs.type === 'yellow_pad') {
            ctx.fillStyle = '#ffd700';
            ctx.fillRect(screen.x, screen.y, w, h);
        } else if (obs.type === 'magenta_pad') {
            ctx.fillStyle = '#ff00ff';
            ctx.fillRect(screen.x, screen.y, w, h);
        } else if (obs.type === 'yellow_ring') {
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 3 * cam.zoom;
            ctx.beginPath();
            ctx.arc(screen.x + w / 2, screen.y + h / 2, w / 2, 0, Math.PI * 2);
            ctx.stroke();
        } else if (obs.type === 'magenta_ring') {
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 3 * cam.zoom;
            ctx.beginPath();
            ctx.arc(screen.x + w / 2, screen.y + h / 2, w / 2, 0, Math.PI * 2);
            ctx.stroke();
        } else if (obs.type === 'coin') {
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(screen.x + w / 2, screen.y + h / 2, w / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.font = `bold ${Math.max(8, Math.round(12 * cam.zoom))}px Outfit`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', screen.x + w / 2, screen.y + h / 2);
        } else if (obs.type === 'portal') {
            const portalColor = PORTAL_COLORS_EDITOR[obs.mode] || '#ffffff';
            ctx.fillStyle = portalColor;
            ctx.globalAlpha = 0.25;
            ctx.fillRect(screen.x, screen.y, w, h);
            ctx.globalAlpha = 1.0;

            ctx.strokeStyle = portalColor;
            ctx.lineWidth = 3 * cam.zoom;
            ctx.strokeRect(screen.x, screen.y, w, h);

            ctx.fillStyle = portalColor;
            ctx.font = `bold ${Math.max(10, Math.round(14 * cam.zoom))}px Outfit`;
            ctx.textAlign = 'center';
            ctx.fillText((obs.mode || 'CUBE').toUpperCase(), screen.x + w / 2, screen.y + h / 2);
        }
    });

    const finishX = currentLevel.totalLength;
    const finishScreenX = worldToScreen(finishX, 0, cam).x;
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 4 * cam.zoom;
    ctx.beginPath();
    ctx.moveTo(finishScreenX, 0);
    ctx.lineTo(finishScreenX, canvas.height);
    ctx.stroke();

    ctx.fillStyle = '#10b981';
    ctx.font = `bold ${Math.max(12, Math.round(16 * cam.zoom))}px Outfit`;
    ctx.fillText('FINISH', finishScreenX + 10, 30);
}

// PLAYTEST PHYSICS & RENDER
function updatePlaytestPhysics() {
    if (!playtestState || playtestState.dead) return;

    if (!playtestState.jumpProcessedState) {
        playtestState.jumpProcessedState = { value: false };
    }

    Physics.stepPlayerPhysics(
        playtestState,
        currentLevel.obstacles,
        playtestState.jumpPressed,
        playtestState.jumpProcessedState,
        currentLevel.speed
    );

    if (playtestState.x >= currentLevel.totalLength) {
        alert('🎉 Level Dokončen! Playtest proběhl úspěšně.');
        setEditorMode('EDIT');
    }
}

function renderPlaytest() {
    const p = playtestState;

    runtimeCamera.x = p.x + 100;
    runtimeCamera.y = Math.max(0, p.y - 100);

    renderGridAndLevel(runtimeCamera);

    if (!p.dead) {
        const screen = worldToScreen(p.x, p.y + p.h, runtimeCamera);
        const w = p.w * runtimeCamera.zoom;
        const h = p.h * runtimeCamera.zoom;

        ctx.save();
        ctx.translate(screen.x + w / 2, screen.y + h / 2);
        ctx.rotate(p.rotation);

        ctx.fillStyle = '#00f0ff';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3 * runtimeCamera.zoom;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeRect(-w / 2, -h / 2, w, h);

        ctx.restore();
    } else {
        ctx.fillStyle = '#ff0055';
        ctx.font = 'bold 24px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('CRASHED! stiskněte Space / Click pro nový pokus', canvas.width / 2, canvas.height / 2);
        if (p.jumpPressed) {
            const startPos = currentLevel.startPosition || { x: 100, y: 0, mode: 'cube' };
            playtestState = Physics.createPlayerState(startPos);
        }
    }
}

// 20-BOT SUITE PHYSICS & RENDER
function updateBotSuitePhysics() {
    if (!botSuiteState) return;

    let alive = 0;
    let maxDist = botSuiteState.maxDistance;

    botSuiteState.bots.forEach(b => {
        if (b.dead) return;

        let shouldJump = false;
        currentLevel.obstacles.forEach(obs => {
            if (obs.x - b.x > 0 && obs.x - b.x < b.lookAhead) {
                if (obs.type === 'spike' || obs.type === 'block' || obs.type === 'yellow_ring') {
                    shouldJump = true;
                }
            }
        });

        if (b.mode === 'ship' || b.mode === 'wave') {
            if (b.y < 80) shouldJump = true;
            if (b.y > 300) shouldJump = false;
        }

        b.jumpPressed = shouldJump;

        Physics.stepPlayerPhysics(
            b,
            currentLevel.obstacles,
            b.jumpPressed,
            b.jumpProcessedState,
            currentLevel.speed
        );

        if (!b.dead) {
            alive++;
            if (b.x > maxDist) maxDist = b.x;
            if (b.x >= currentLevel.totalLength) {
                botSuiteState.completedBot = b;
            }
        }
    });

    botSuiteState.aliveCount = alive;
    botSuiteState.maxDistance = maxDist;

    const progressPercent = Math.min(100, Math.floor((maxDist / currentLevel.totalLength) * 100));

    const aliveEl = document.getElementById('aliveBotsCount');
    const progEl = document.getElementById('botProgressPercent');
    if (aliveEl) aliveEl.textContent = alive;
    if (progEl) progEl.textContent = progressPercent + '%';

    if (botSuiteState.completedBot) {
        alert('✅ 20-Bot Suite POTVRDILA: Level je 100% BEATABLE!');
        setEditorMode('EDIT');
    } else if (alive === 0) {
        alert('❌ Všech 20 botů zemřelo! Level obsahuje neprůchozí sekci.');
        setEditorMode('EDIT');
    }
}

function renderBotSuite() {
    if (!botSuiteState) return;

    const leadBot = botSuiteState.bots.find(b => !b.dead) || botSuiteState.bots[0];
    runtimeCamera.x = leadBot.x + 100;
    runtimeCamera.y = Math.max(0, leadBot.y - 100);

    renderGridAndLevel(runtimeCamera);

    botSuiteState.bots.forEach(b => {
        if (b.dead) return;

        const screen = worldToScreen(b.x, b.y + b.h, runtimeCamera);
        const w = b.w * runtimeCamera.zoom;
        const h = b.h * runtimeCamera.zoom;

        ctx.save();
        ctx.translate(screen.x + w / 2, screen.y + h / 2);
        ctx.rotate(b.rotation);

        ctx.fillStyle = b.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 * runtimeCamera.zoom;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeRect(-w / 2, -h / 2, w, h);

        ctx.restore();
    });
}

// Start Editor Core Engine
initEditor();
