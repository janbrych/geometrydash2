/* Geometry Dash Level Editor Core Engine */

const canvas = document.getElementById('editorCanvas');
const ctx = canvas.getContext('2d');

// Constants
const GRID_SIZE = 40;
const GROUND_HEIGHT = 100;
const CEILING_HEIGHT = 100;
const PORTAL_COLORS = {
    cube: '#00ff66',
    ship: '#ff00aa',
    ball: '#ff2200',
    ufo: '#ff9900',
    wave: '#0099ff'
};

// Editor Viewport State
let cameraX = 0;
let cameraY = 0;
let customAudioUrl = null;
let bgAudioPlayer = new Audio();
let zoom = 1.0;
let isPanning = false;
let startPanX = 0;
let startPanY = 0;
let showGrid = true;

// Tool & Selection State
let currentTool = 'draw'; // 'draw', 'erase'
let selectedObjectType = 'block'; // 'block', 'spike', 'spike_ceiling', 'yellow_pad', 'yellow_ring', 'magenta_pad', 'magenta_ring', 'coin', 'portal', 'start_marker', 'finish_marker'
let selectedPortalMode = 'ship';

// Current Level Data
let currentLevel = {
    id: null,
    title: 'Custom Level 1',
    author: 'Player',
    speed: 10.5,
    music: 'techno_level2.wav',
    startPos: 0,
    totalLength: 20000,
    initialMode: 'cube',
    obstacles: []
};

// Playtest & Bot Simulation State
let editorMode = 'EDIT'; // 'EDIT', 'PLAYTEST', 'BOT_TEST'
let playtestPlayer = null;
let idleBotPlayer = null;
let botSuiteState = null;
let botSimulationSpeed = 1;

// UI Elements
const levelTitleInput = document.getElementById('levelTitleInput');
const speedSelect = document.getElementById('speedSelect');
const musicSelect = document.getElementById('musicSelect');
const levelLengthInput = document.getElementById('levelLengthInput');
const cursorXEl = document.getElementById('cursorX');
const objectCountEl = document.getElementById('objectCount');

// Resize canvas
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Coordinate Conversions
function screenToWorld(sx, sy) {
    const wx = (sx - cameraX) / zoom;
    const wy = (sy - cameraY) / zoom;
    return { x: wx, y: wy };
}

function worldToScreen(wx, wy) {
    const sx = wx * zoom + cameraX;
    const sy = wy * zoom + cameraY;
    return { x: sx, y: sy };
}

function snapToGrid(val) {
    return Math.floor(val / GRID_SIZE) * GRID_SIZE;
}

// Editor Initialization
function initEditor() {
    setupEventListeners();
    updateUIFromLevel();
    idleBotPlayer = new SimPlayer();
    idleBotPlayer.reset(currentLevel.startPos || 0, currentLevel.initialMode || 'cube');
    requestAnimationFrame(editorLoop);
}

function updateUIFromLevel() {
    levelTitleInput.value = currentLevel.title;
    speedSelect.value = currentLevel.speed.toString();
    musicSelect.value = currentLevel.music;
    if (currentLevel.startPos === undefined) currentLevel.startPos = 0;
    levelLengthInput.value = currentLevel.totalLength;
    objectCountEl.textContent = currentLevel.obstacles.length;
}

function updateLevelFromUI() {
    currentLevel.title = levelTitleInput.value || 'Custom Level';
    currentLevel.speed = parseFloat(speedSelect.value);
    currentLevel.music = musicSelect.value;
    if (currentLevel.startPos === undefined) currentLevel.startPos = 0;
    currentLevel.totalLength = parseInt(levelLengthInput.value, 10) || 20000;
}

// Event Listeners Setup
function setupEventListeners() {
    // Canvas Pan & Zoom
    canvas.addEventListener('mousedown', (e) => {
        if (editorMode !== 'EDIT') return;

        if (e.button === 1 || e.button === 2 || e.shiftKey) { // Middle click, Right click, or Shift+Click
            isPanning = true;
            startPanX = e.clientX - cameraX;
            startPanY = e.clientY - cameraY;
            e.preventDefault();
            return;
        }

        if (e.button === 0) { // Left Click
            handleCanvasClick(e);
        }
    });

    canvas.addEventListener('contextmenu', e => e.preventDefault());

    window.addEventListener('mousemove', (e) => {
        if (isPanning) {
            cameraX = e.clientX - startPanX;
            cameraY = e.clientY - startPanY;
            return;
        }

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const world = screenToWorld(mouseX, mouseY);
        cursorXEl.textContent = Math.round(world.x) + 'px';

        if (e.buttons === 1 && editorMode === 'EDIT') {
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
        if (e.ctrlKey) {
            const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
            zoom = Math.max(0.3, Math.min(3.0, zoom * zoomFactor));
        } else {
            cameraX -= e.deltaY;
        }
    }, { passive: false });

    // Header Toolbar Buttons
    document.getElementById('btnToolDraw').addEventListener('click', () => setTool('draw'));
    document.getElementById('btnToolErase').addEventListener('click', () => setTool('erase'));
    document.getElementById('btnClearAll').addEventListener('click', () => {
        if (confirm('Opravdu chcete vymazat všechny objekty v levelu?')) {
            currentLevel.obstacles = [];
            objectCountEl.textContent = 0;
        }
    });
    document.getElementById('btnGridToggle').addEventListener('click', (e) => {
        showGrid = !showGrid;
        e.target.textContent = showGrid ? '🌐 Mřížka [ZAP]' : '🌐 Mřížka [VYP]';
    });

    // Palette Items Selection
    document.querySelectorAll('.palette-grid .item-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.palette-grid .item-btn, .portals-grid .portal-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedObjectType = btn.dataset.type;
            setTool('draw');
        });
    });

    document.querySelectorAll('.portals-grid .portal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.palette-grid .item-btn, .portals-grid .portal-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedObjectType = 'portal';
            selectedPortalMode = btn.dataset.mode;
            setTool('draw');
        });
    });

    // Settings input change listeners
    levelTitleInput.addEventListener('input', updateLevelFromUI);
    speedSelect.addEventListener('change', updateLevelFromUI);
    musicSelect.addEventListener('change', updateLevelFromUI);
    levelLengthInput.addEventListener('input', updateLevelFromUI);

    const customAudioInput = document.getElementById('customAudioInput');
    const customAudioStatus = document.getElementById('customAudioStatus');
    if (customAudioInput) {
        customAudioInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                customAudioUrl = URL.createObjectURL(file);
                if (customAudioStatus) customAudioStatus.textContent = `Nahráno: ${file.name}`;
                musicSelect.value = 'custom';
                currentLevel.music = 'custom';
            }
        });
    }

    // Save & Load DB
    document.getElementById('btnSaveDb').addEventListener('click', () => {
        updateLevelFromUI();
        LevelDB.saveLevel(currentLevel);
        alert(`Level "${currentLevel.title}" byl úspěšně uložen do databáze!`);
    });

    document.getElementById('btnOpenDb').addEventListener('click', openDbModal);
    document.getElementById('btnCloseDbModal').addEventListener('click', closeDbModal);

    // Export & Import
    document.getElementById('btnExportJson').addEventListener('click', () => {
        updateLevelFromUI();
        const jsonStr = LevelDB.exportToJson(currentLevel);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentLevel.title.toLowerCase().replace(/\s+/g, '_')}_gd_level.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    document.getElementById('btnImportJson').addEventListener('click', () => {
        document.getElementById('jsonFileInput').click();
    });

    document.getElementById('jsonFileInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const imported = LevelDB.importFromJson(event.target.result);
            if (imported) {
                currentLevel = imported;
                updateUIFromLevel();
                if (idleBotPlayer) idleBotPlayer.reset(currentLevel.startPos || 0, currentLevel.initialMode || 'cube');
                alert(`Level "${imported.title}" byl úspěšně importován!`);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });

    // On-screen jump button
    const btnCanvasJump = document.getElementById('btnCanvasJump');
    if (btnCanvasJump) {
        const triggerJumpStart = (e) => {
            e.preventDefault();
            if (playtestPlayer) playtestPlayer._manualJump = true;
        };
        const triggerJumpEnd = (e) => {
            e.preventDefault();
            if (playtestPlayer) playtestPlayer._manualJump = false;
        };

        btnCanvasJump.addEventListener('mousedown', triggerJumpStart);
        btnCanvasJump.addEventListener('mouseup', triggerJumpEnd);
        btnCanvasJump.addEventListener('touchstart', triggerJumpStart);
        btnCanvasJump.addEventListener('touchend', triggerJumpEnd);
    }

    // Playtest & Bot Test Buttons
    document.getElementById('btnTestYourself').addEventListener('click', togglePlaytest);
    document.getElementById('btnBotTest').addEventListener('click', startBotTest);
    document.getElementById('btnStopBotTest').addEventListener('click', stopBotTest);

    // Keyboard shortcuts in playtest
    window.addEventListener('keydown', (e) => {
        if (editorMode === 'PLAYTEST') {
            if (e.code === 'Space' || e.code === 'ArrowUp') {
                if (playtestPlayer) playtestPlayer._manualJump = true;
            } else if (e.code === 'Escape') {
                togglePlaytest();
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        if (editorMode === 'PLAYTEST') {
            if (e.code === 'Space' || e.code === 'ArrowUp') {
                if (playtestPlayer) playtestPlayer._manualJump = false;
            }
        }
    });
}

function setTool(tool) {
    currentTool = tool;
    document.getElementById('btnToolDraw').classList.toggle('active', tool === 'draw');
    document.getElementById('btnToolErase').classList.toggle('active', tool === 'erase');
}

// Canvas Click Handler
function handleCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const world = screenToWorld(mouseX, mouseY);

    const groundY = canvas.height - GROUND_HEIGHT;
    const relativeY = groundY - world.y;
    const gridX = snapToGrid(world.x);
    const gridY = snapToGrid(relativeY);

    if (gridX < 0) return;

    if (currentTool === 'erase') {
        currentLevel.obstacles = currentLevel.obstacles.filter(obs => {
            return !(Math.abs(obs.x - gridX) < 10 && Math.abs(obs.y - gridY) < 10);
        });
        objectCountEl.textContent = currentLevel.obstacles.length;
        return;
    }

    if (currentTool === 'draw') {
        if (selectedObjectType === 'start_marker') {
            currentLevel.startPos = Math.max(0, gridX);
            if (idleBotPlayer) idleBotPlayer.reset(currentLevel.startPos, currentLevel.initialMode || 'cube');
            return;
        }

        if (selectedObjectType === 'finish_marker') {
            currentLevel.totalLength = Math.max((currentLevel.startPos || 0) + 1000, gridX);
            levelLengthInput.value = currentLevel.totalLength;
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
        objectCountEl.textContent = currentLevel.obstacles.length;
    }
}

// Database Modal Functions
function openDbModal() {
    const listContainer = document.getElementById('dbLevelsList');
    listContainer.innerHTML = '';
    const levels = LevelDB.getAllLevels();

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
                currentLevel = lvl;
                updateUIFromLevel();
                if (idleBotPlayer) idleBotPlayer.reset(currentLevel.startPos || 0, currentLevel.initialMode || 'cube');
                closeDbModal();
            });

            item.querySelector('.btn-del-lvl').addEventListener('click', () => {
                if (confirm(`Opravdu chcete smazat level "${lvl.title}"?`)) {
                    LevelDB.deleteLevel(lvl.id);
                    openDbModal();
                }
            });

            listContainer.appendChild(item);
        });
    }

    document.getElementById('dbModal').classList.remove('hidden');
}

function closeDbModal() {
    document.getElementById('dbModal').classList.add('hidden');
}

// Playtest Mode Setup
function togglePlaytest() {
    if (editorMode === 'PLAYTEST') {
        editorMode = 'EDIT';
        playtestPlayer = null;
        document.getElementById('btnTestYourself').textContent = '🎮 Hráč Test';
        document.getElementById('btnTestYourself').classList.remove('active');
        document.getElementById('playtestJumpOverlay').classList.add('hidden');
        if (bgAudioPlayer) {
            bgAudioPlayer.pause();
            bgAudioPlayer.currentTime = 0;
        }
        return;
    }

    updateLevelFromUI();
    editorMode = 'PLAYTEST';
    document.getElementById('btnTestYourself').textContent = '⏹️ Zastavit Test';
    document.getElementById('btnTestYourself').classList.add('active');
    document.getElementById('playtestJumpOverlay').classList.remove('hidden');

    if (currentLevel.music === 'custom' && customAudioUrl) {
        bgAudioPlayer.src = customAudioUrl;
        bgAudioPlayer.loop = true;
        bgAudioPlayer.play().catch(() => {});
    } else if (currentLevel.music) {
        bgAudioPlayer.src = currentLevel.music;
        bgAudioPlayer.loop = true;
        bgAudioPlayer.play().catch(() => {});
    }

    playtestPlayer = new SimPlayer();
    playtestPlayer.reset(currentLevel.startPos || 0, currentLevel.initialMode || 'cube');
    playtestPlayer._manualJump = false;
}

// 20-Bot Suite Simulation Setup
function startBotTest() {
    updateLevelFromUI();
    editorMode = 'BOT_TEST';
    document.getElementById('botStatusOverlay').classList.remove('hidden');

    const bots = [];
    for (let i = 0; i < 20; i++) {
        const bot = new SimPlayer();
        bot.reset(currentLevel.startPos || 0, currentLevel.initialMode || 'cube');
        bot.id = i;
        bot.color = `hsla(${(i * 18) % 360}, 100%, 60%, 0.6)`;
        bot.lookAhead = 80 + (i * 6);
        bots.push(bot);
    }

    botSuiteState = {
        bots: bots,
        aliveCount: 20,
        completedBot: null
    };

    document.querySelectorAll('.btn-speed').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.btn-speed').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            botSimulationSpeed = parseInt(btn.dataset.speed, 10) || 1;
        });
    });
}

function stopBotTest() {
    editorMode = 'EDIT';
    botSuiteState = null;
    document.getElementById('botStatusOverlay').classList.add('hidden');
}

// Idle Auto-Bot Engine using true SimEngine Physics
function updateIdleBotPhysics() {
    if (editorMode !== 'EDIT') return;

    if (!idleBotPlayer || idleBotPlayer.dead || idleBotPlayer.distance >= (currentLevel.totalLength || 20000)) {
        idleBotPlayer = new SimPlayer();
        idleBotPlayer.reset(currentLevel.startPos || 0, currentLevel.initialMode || 'cube');
        idleBotPlayer.lookAhead = 100;
    }

    const b = idleBotPlayer;

    // Solver lookahead policy
    let jumpInput = false;
    currentLevel.obstacles.forEach(obs => {
        if (obs.x - b.distance > 0 && obs.x - b.distance < (b.lookAhead || 100)) {
            if (obs.type === 'spike' || obs.type === 'block' || obs.type === 'yellow_ring' || obs.type === 'magenta_ring') {
                jumpInput = true;
            }
        }
    });

    if (b.mode === 'ship' || b.mode === 'wave') {
        const playerCanvasY = b.y;
        if (playerCanvasY > canvas.height - GROUND_HEIGHT - 70) jumpInput = true;
        if (playerCanvasY < CEILING_HEIGHT + 70) jumpInput = false;
    }

    b.stepPhysics(currentLevel.obstacles, currentLevel.speed, jumpInput);
}

function renderIdleBot() {
    if (!idleBotPlayer || idleBotPlayer.dead) return;

    const b = idleBotPlayer;
    const screenPos = worldToScreen(b.distance, 0);

    ctx.save();
    ctx.translate(screenPos.x + b.w / 2, b.y + b.h / 2);
    ctx.rotate(b.rotation);

    ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
    ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);

    ctx.restore();
}

// Main Loop
function editorLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (editorMode === 'EDIT') {
        updateIdleBotPhysics();
        renderGridAndLevel();
        renderIdleBot();
    } else if (editorMode === 'PLAYTEST') {
        updatePlaytestPhysics();
        renderPlaytest();
    } else if (editorMode === 'BOT_TEST') {
        for (let s = 0; s < botSimulationSpeed; s++) {
            updateBotSuitePhysics();
        }
        renderBotSuite();
    }

    requestAnimationFrame(editorLoop);
}

// RENDER CANVAS GRID & LEVEL
function renderGridAndLevel() {
    const groundY = canvas.height - GROUND_HEIGHT;

    // Dark canvas background
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grid Lines
    if (showGrid) {
        ctx.strokeStyle = '#1d2235';
        ctx.lineWidth = 1;

        const startX = snapToGrid(screenToWorld(0, 0).x) - GRID_SIZE;
        const endX = screenToWorld(canvas.width, 0).x + GRID_SIZE;

        for (let x = startX; x <= endX; x += GRID_SIZE) {
            const screenX = worldToScreen(x, 0).x;
            ctx.beginPath();
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, canvas.height);
            ctx.stroke();
        }

        for (let y = 0; y <= canvas.height; y += GRID_SIZE * zoom) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
    }

    // Render Level Obstacles & Portals
    currentLevel.obstacles.forEach(obs => {
        const screen = worldToScreen(obs.x, groundY - obs.y - obs.h);
        const w = obs.w * zoom;
        const h = obs.h * zoom;

        if (obs.type === 'block') {
            ctx.fillStyle = '#111827';
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 2;
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
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(screen.x + w / 2, screen.y + h / 2, w / 2, 0, Math.PI * 2);
            ctx.stroke();
        } else if (obs.type === 'magenta_ring') {
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(screen.x + w / 2, screen.y + h / 2, w / 2, 0, Math.PI * 2);
            ctx.stroke();
        } else if (obs.type === 'coin') {
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(screen.x + w / 2, screen.y + h / 2, w / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.font = 'bold 12px Outfit';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', screen.x + w / 2, screen.y + h / 2);
        } else if (obs.type === 'portal') {
            const portalColor = PORTAL_COLORS[obs.mode] || '#ffffff';
            ctx.fillStyle = portalColor;
            ctx.globalAlpha = 0.25;
            ctx.fillRect(screen.x, screen.y, w, h);
            ctx.globalAlpha = 1.0;

            ctx.strokeStyle = portalColor;
            ctx.lineWidth = 3;
            ctx.strokeRect(screen.x, screen.y, w, h);

            ctx.fillStyle = portalColor;
            ctx.font = 'bold 14px Outfit';
            ctx.textAlign = 'center';
            ctx.fillText(obs.mode.toUpperCase(), screen.x + w / 2, screen.y + h / 2);
        }
    });

    // Render Start Marker (Always rendered ON TOP of objects/grid)
    const startX = currentLevel.startPos || 0;
    const startScreenX = worldToScreen(startX, 0).x;
    ctx.save();
    ctx.strokeStyle = '#00ff66';
    ctx.shadowColor = '#00ff66';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(startScreenX, 0);
    ctx.lineTo(startScreenX, canvas.height);
    ctx.stroke();

    ctx.fillStyle = 'rgba(0, 255, 102, 0.35)';
    ctx.fillRect(startScreenX, 20, 110, 36);
    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 2;
    ctx.strokeRect(startScreenX, 20, 110, 36);

    ctx.fillStyle = '#00ff66';
    ctx.font = 'bold 14px Outfit';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🚩 START', startScreenX + 55, 38);
    ctx.restore();

    // Render End / Finish Line Marker
    const endX = currentLevel.totalLength || 20000;
    const endScreenX = worldToScreen(endX, 0).x;
    ctx.save();
    ctx.strokeStyle = '#ffd700';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(endScreenX, 0);
    ctx.lineTo(endScreenX, canvas.height);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 215, 0, 0.35)';
    ctx.fillRect(endScreenX - 110, 20, 110, 36);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.strokeRect(endScreenX - 110, 20, 110, 36);

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 14px Outfit';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏁 FINISH', endScreenX - 55, 38);
    ctx.restore();
}

// PLAYTEST PHYSICS & RENDER
function updatePlaytestPhysics() {
    if (!playtestPlayer || playtestPlayer.dead) return;

    const p = playtestPlayer;
    p.stepPhysics(currentLevel.obstacles, currentLevel.speed, p._manualJump);

    if (p.distance >= currentLevel.totalLength) {
        alert('🎉 Level Dokončen! Test proběhl úspěšně.');
        togglePlaytest();
    }
}

function renderPlaytest() {
    const p = playtestPlayer;

    cameraX = 150 - p.distance;
    cameraY = 0;
    zoom = 1.0;

    renderGridAndLevel();

    if (!p.dead) {
        ctx.save();
        ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
        ctx.rotate(p.rotation);

        ctx.fillStyle = '#00f0ff';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);

        ctx.restore();
    } else {
        ctx.fillStyle = '#ff0055';
        ctx.font = 'bold 24px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('CRASHED! Stiskněte Mezerník pro opakování', canvas.width / 2, canvas.height / 2);
        if (p._manualJump) {
            playtestPlayer = new SimPlayer();
            playtestPlayer.reset(currentLevel.startPos || 0, currentLevel.initialMode || 'cube');
            playtestPlayer._manualJump = false;
        }
    }
}

// 20-BOT SUITE PHYSICS & RENDER
function updateBotSuitePhysics() {
    if (!botSuiteState) return;

    let alive = 0;
    let maxDistance = 0;

    botSuiteState.bots.forEach(b => {
        if (b.dead) return;

        if (b.distance > maxDistance) maxDistance = b.distance;

        let jumpInput = false;
        currentLevel.obstacles.forEach(obs => {
            if (obs.x - b.distance > 0 && obs.x - b.distance < (b.lookAhead || 100)) {
                if (obs.type === 'spike' || obs.type === 'block' || obs.type === 'yellow_ring' || obs.type === 'magenta_ring') {
                    jumpInput = true;
                }
            }
        });

        if (b.mode === 'ship' || b.mode === 'wave') {
            if (b.y > canvas.height - GROUND_HEIGHT - 70) jumpInput = true;
            if (b.y < CEILING_HEIGHT + 70) jumpInput = false;
        }

        b.stepPhysics(currentLevel.obstacles, currentLevel.speed, jumpInput);

        if (!b.dead) {
            alive++;
            if (b.distance >= currentLevel.totalLength) {
                botSuiteState.completedBot = b;
            }
        }
    });

    botSuiteState.aliveCount = alive;
    const progressPercent = Math.min(100, Math.floor((maxDistance / currentLevel.totalLength) * 100));

    const leadBot = botSuiteState.bots.find(b => !b.dead) || botSuiteState.bots[0];
    const leadingModeEl = document.getElementById('botLeadingMode');
    if (leadingModeEl && leadBot) {
        leadingModeEl.textContent = leadBot.mode.toUpperCase();
    }

    document.getElementById('aliveBotsCount').textContent = alive;
    document.getElementById('botProgressPercent').textContent = progressPercent + '%';

    if (botSuiteState.completedBot) {
        alert('✅ 20-Bot Suite POTVRDILA: Level je 100% BEATABLE!');
        stopBotTest();
    } else if (alive === 0) {
        alert('❌ Všech 20 botů zemřelo! Level pravděpodobně obsahuje neprůchozí sekci nebo pád do propasti.');
        stopBotTest();
    }
}

function renderBotSuite() {
    if (!botSuiteState) return;

    const leadBot = botSuiteState.bots.find(b => !b.dead) || botSuiteState.bots[0];
    cameraX = 150 - leadBot.distance;
    cameraY = 0;
    zoom = 1.0;

    renderGridAndLevel();

    botSuiteState.bots.forEach(b => {
        if (b.dead) return;

        ctx.save();
        ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
        ctx.rotate(b.rotation);

        ctx.fillStyle = b.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);

        ctx.restore();
    });
}

// Start Editor
initEditor();
