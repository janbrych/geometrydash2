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
let zoom = 1.0;
let isPanning = false;
let startPanX = 0;
let startPanY = 0;
let showGrid = true;

// Tool & Selection State
let currentTool = 'draw'; // 'draw', 'erase'
let selectedObjectType = 'block'; // 'block', 'spike', 'spike_ceiling', 'yellow_pad', 'yellow_ring', 'coin', 'portal'
let selectedPortalMode = 'ship';

// Current Level Data
let currentLevel = {
    id: null,
    title: 'Custom Level 1',
    author: 'Player',
    speed: 10.5,
    music: 'techno_level2.wav',
    totalLength: 20000,
    initialMode: 'cube',
    obstacles: []
};

// Playtest & Bot Simulation State
let editorMode = 'EDIT'; // 'EDIT', 'PLAYTEST', 'BOT_TEST'
let playtestState = null;
let botSuiteState = null;
let animFrameId = null;

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
    requestAnimationFrame(editorLoop);
}

function updateUIFromLevel() {
    levelTitleInput.value = currentLevel.title;
    speedSelect.value = currentLevel.speed.toString();
    musicSelect.value = currentLevel.music;
    levelLengthInput.value = currentLevel.totalLength;
    objectCountEl.textContent = currentLevel.obstacles.length;
}

function updateLevelFromUI() {
    currentLevel.title = levelTitleInput.value || 'Custom Level';
    currentLevel.speed = parseFloat(speedSelect.value);
    currentLevel.music = musicSelect.value;
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
            // Zoom
            const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
            zoom = Math.max(0.3, Math.min(3.0, zoom * zoomFactor));
        } else {
            // Horizontal Pan
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
                alert(`Level "${imported.title}" byl úspěšně importován!`);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });

    // Playtest & Bot Test Buttons
    document.getElementById('btnTestYourself').addEventListener('click', togglePlaytest);
    document.getElementById('btnBotTest').addEventListener('click', startBotTest);
    document.getElementById('btnStopBotTest').addEventListener('click', stopBotTest);

    // Keyboard shortcuts in playtest
    window.addEventListener('keydown', (e) => {
        if (editorMode === 'PLAYTEST') {
            if (e.code === 'Space' || e.code === 'ArrowUp') {
                if (playtestState) playtestState.jumpPressed = true;
            } else if (e.code === 'Escape') {
                togglePlaytest();
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
}

function setTool(tool) {
    currentTool = tool;
    document.getElementById('btnToolDraw').classList.toggle('active', tool === 'draw');
    document.getElementById('btnToolErase').classList.toggle('active', tool === 'erase');
}

// Canvas Click Handler (Add / Remove Obstacle)
function handleCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const world = screenToWorld(mouseX, mouseY);

    const groundY = canvas.height - GROUND_HEIGHT;

    // Convert Y relative to floor
    const relativeY = groundY - world.y;
    const gridX = snapToGrid(world.x);
    const gridY = snapToGrid(relativeY);

    if (gridX < 0) return;

    if (currentTool === 'erase') {
        // Remove object at grid location
        currentLevel.obstacles = currentLevel.obstacles.filter(obs => {
            return !(Math.abs(obs.x - gridX) < 10 && Math.abs(obs.y - gridY) < 10);
        });
        objectCountEl.textContent = currentLevel.obstacles.length;
        return;
    }

    if (currentTool === 'draw') {
        // Check if object already exists at location
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
            newObj.y = canvas.height - GROUND_HEIGHT - CEILING_HEIGHT;
        } else if (selectedObjectType === 'yellow_pad') {
            newObj.h = 10;
            newObj.y = 0;
        } else if (selectedObjectType === 'yellow_ring' || selectedObjectType === 'coin') {
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
        playtestState = null;
        document.getElementById('btnTestYourself').textContent = '🎮 Test Yourself';
        document.getElementById('btnTestYourself').classList.remove('active');
        return;
    }

    updateLevelFromUI();
    editorMode = 'PLAYTEST';
    document.getElementById('btnTestYourself').textContent = '⏹️ Stop Playtest';
    document.getElementById('btnTestYourself').classList.add('active');

    playtestState = {
        x: 150,
        y: canvas.height - GROUND_HEIGHT - 40,
        w: 40,
        h: 40,
        vy: 0,
        mode: currentLevel.initialMode || 'cube',
        isGrounded: true,
        coyoteCounter: 5,
        jumpBufferCounter: 0,
        gravityDir: 1,
        rotation: 0,
        distance: 0,
        jumpPressed: false,
        jumpProcessed: false,
        dead: false
    };
}

// 20-Bot Suite Simulation Setup
function startBotTest() {
    updateLevelFromUI();
    editorMode = 'BOT_TEST';
    document.getElementById('botStatusOverlay').classList.remove('hidden');

    const bots = [];
    for (let i = 0; i < 20; i++) {
        bots.push({
            id: i,
            x: 150,
            y: canvas.height - GROUND_HEIGHT - 40,
            w: 40,
            h: 40,
            vy: 0,
            mode: currentLevel.initialMode || 'cube',
            isGrounded: true,
            coyoteCounter: 5,
            jumpBufferCounter: 0,
            gravityDir: 1,
            rotation: 0,
            distance: 0,
            jumpPressed: false,
            jumpProcessed: false,
            dead: false,
            color: `hsla(${(i * 18) % 360}, 100%, 60%, 0.6)`,
            lookAhead: 90 + (i * 5) // Slightly varied lookahead policy
        });
    }

    botSuiteState = {
        bots: bots,
        aliveCount: 20,
        completedBot: null
    };
}

function stopBotTest() {
    editorMode = 'EDIT';
    botSuiteState = null;
    document.getElementById('botStatusOverlay').classList.add('hidden');
}

// Main Editor Render & Physics Loop
function editorLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (editorMode === 'EDIT') {
        renderGridAndLevel();
    } else if (editorMode === 'PLAYTEST') {
        updatePlaytestPhysics();
        renderPlaytest();
    } else if (editorMode === 'BOT_TEST') {
        updateBotSuitePhysics();
        renderBotSuite();
    }

    requestAnimationFrame(editorLoop);
}

// RENDER GRID & LEVEL IN EDIT MODE
function renderGridAndLevel() {
    const groundY = canvas.height - GROUND_HEIGHT;

    // Floor & Ceiling Background
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#121624';
    ctx.fillRect(0, groundY, canvas.width, GROUND_HEIGHT);

    // Draw Grid Lines if enabled
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

    // Floor Baseline
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(canvas.width, groundY);
    ctx.stroke();

    // Render Obstacles & Portals
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
        } else if (obs.type === 'yellow_ring') {
            ctx.strokeStyle = '#ffd700';
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
            // Colored Portal Door
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

    // Draw End Line
    const endScreenX = worldToScreen(currentLevel.totalLength, 0).x;
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(endScreenX, 0);
    ctx.lineTo(endScreenX, canvas.height);
    ctx.stroke();

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 16px Outfit';
    ctx.fillText('FINISH', endScreenX + 10, 30);
}

// PLAYTEST PHYSICS & RENDER
function updatePlaytestPhysics() {
    if (!playtestState || playtestState.dead) return;

    const p = playtestState;
    p.distance += currentLevel.speed;

    // Portals collision & Mode transitions
    currentLevel.obstacles.forEach(obs => {
        if (obs.type === 'portal') {
            if (Math.abs(p.distance - obs.x) < currentLevel.speed) {
                p.mode = obs.mode;
            }
        }
    });

    // Physics per mode
    const GRAVITY = 0.8;
    const JUMP_FORCE = -12;

    if (p.mode === 'cube') {
        p.vy += GRAVITY;
        if (p.jumpPressed && p.isGrounded) {
            p.vy = JUMP_FORCE;
            p.isGrounded = false;
        }
        p.rotation += 0.15;
    } else if (p.mode === 'ship') {
        if (p.jumpPressed) p.vy -= 0.6; else p.vy += 0.4;
        p.vy = Math.max(-8, Math.min(8, p.vy));
        p.rotation = p.vy * 0.05;
    } else if (p.mode === 'ball') {
        p.vy += GRAVITY * p.gravityDir;
        if (p.jumpPressed && !p.jumpProcessed && p.isGrounded) {
            p.gravityDir *= -1;
            p.isGrounded = false;
            p.jumpProcessed = true;
        }
        p.rotation += 0.15 * p.gravityDir;
    } else if (p.mode === 'ufo') {
        p.vy += GRAVITY * 0.8;
        if (p.jumpPressed && !p.jumpProcessed) {
            p.vy = JUMP_FORCE * 0.75;
            p.jumpProcessed = true;
        }
        p.rotation = p.vy * 0.03;
    } else if (p.mode === 'wave') {
        if (p.jumpPressed) p.vy = -currentLevel.speed * 0.8; else p.vy = currentLevel.speed * 0.8;
        p.rotation = p.jumpPressed ? -0.4 : 0.4;
    }

    p.y += p.vy;

    const groundY = canvas.height - GROUND_HEIGHT - p.h;
    if (p.y >= groundY) {
        p.y = groundY;
        p.vy = 0;
        p.isGrounded = true;
        if (p.mode === 'cube') {
            p.rotation = Math.round(p.rotation / (Math.PI / 2)) * (Math.PI / 2);
        }
    } else if (p.y <= CEILING_HEIGHT) {
        p.y = CEILING_HEIGHT;
        p.vy = 0;
    }

    // Check Obstacle Collisions
    currentLevel.obstacles.forEach(obs => {
        const obsScreenX = obs.x - p.distance + p.x;
        const obsY = canvas.height - GROUND_HEIGHT - obs.y - obs.h;

        if (obsScreenX > p.x - 50 && obsScreenX < p.x + 50) {
            if (obs.type === 'yellow_pad') {
                if (p.x + p.w > obsScreenX && p.x < obsScreenX + obs.w && p.y + p.h >= obsY) {
                    p.vy = JUMP_FORCE * 1.3;
                    p.isGrounded = false;
                }
            } else if (obs.type === 'yellow_ring') {
                if (p.x + p.w > obsScreenX && p.x < obsScreenX + obs.w && p.y + p.h >= obsY && p.jumpPressed) {
                    p.vy = JUMP_FORCE;
                }
            } else if (obs.type === 'spike') {
                const margin = 8;
                if (p.x + margin < obsScreenX + obs.w - margin && p.x + p.w - margin > obsScreenX + margin &&
                    p.y + margin < obsY + obs.h - margin && p.y + p.h - margin > obsY + margin) {
                    p.dead = true;
                }
            } else if (obs.type === 'block') {
                if (p.x + p.w > obsScreenX && p.x < obsScreenX + obs.w) {
                    if (p.y + p.h >= obsY && p.y + p.h <= obsY + 25 && p.vy >= 0) {
                        p.y = obsY - p.h;
                        p.vy = 0;
                        p.isGrounded = true;
                        return;
                    }
                }
                const sideMargin = 6;
                if (p.x + p.w - sideMargin > obsScreenX && p.x + sideMargin < obsScreenX + obs.w &&
                    p.y + p.h - sideMargin > obsY && p.y + sideMargin < obsY + obs.h) {
                    p.dead = true;
                }
            }
        }
    });

    if (p.distance >= currentLevel.totalLength) {
        alert('🎉 Level Dokončen! Test proběhl úspěšně.');
        togglePlaytest();
    }
}

function renderPlaytest() {
    const p = playtestState;

    // Set camera to follow player distance
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
        ctx.fillText('CRASHED! stiskněte Space / Click pro nový pokus', canvas.width / 2, canvas.height / 2);
        if (p.jumpPressed) {
            playtestState = {
                x: 150,
                y: canvas.height - GROUND_HEIGHT - 40,
                w: 40,
                h: 40,
                vy: 0,
                mode: currentLevel.initialMode || 'cube',
                isGrounded: true,
                coyoteCounter: 5,
                jumpBufferCounter: 0,
                gravityDir: 1,
                rotation: 0,
                distance: 0,
                jumpPressed: false,
                jumpProcessed: false,
                dead: false
            };
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

        b.distance += currentLevel.speed;
        if (b.distance > maxDistance) maxDistance = b.distance;

        // Mode Portals
        currentLevel.obstacles.forEach(obs => {
            if (obs.type === 'portal') {
                if (Math.abs(b.distance - obs.x) < currentLevel.speed) {
                    b.mode = obs.mode;
                }
            }
        });

        // Bot Policy / Solver Lookahead
        let shouldJump = false;
        currentLevel.obstacles.forEach(obs => {
            if (obs.x - b.distance > 0 && obs.x - b.distance < b.lookAhead) {
                if (obs.type === 'spike' || obs.type === 'block' || obs.type === 'yellow_ring') {
                    shouldJump = true;
                }
            }
        });

        if (b.mode === 'ship' || b.mode === 'wave') {
            if (b.y > canvas.height - GROUND_HEIGHT - 70) shouldJump = true;
            if (b.y < CEILING_HEIGHT + 70) shouldJump = false;
        }

        b.jumpPressed = shouldJump;

        // Physics
        const GRAVITY = 0.8;
        const JUMP_FORCE = -12;

        if (b.mode === 'cube') {
            b.vy += GRAVITY;
            if (b.jumpPressed && b.isGrounded) {
                b.vy = JUMP_FORCE;
                b.isGrounded = false;
            }
            b.rotation += 0.15;
        } else if (b.mode === 'ship') {
            if (b.jumpPressed) b.vy -= 0.6; else b.vy += 0.4;
            b.vy = Math.max(-8, Math.min(8, b.vy));
            b.rotation = b.vy * 0.05;
        } else if (b.mode === 'ball') {
            b.vy += GRAVITY * b.gravityDir;
            if (b.jumpPressed && !b.jumpProcessed && b.isGrounded) {
                b.gravityDir *= -1;
                b.isGrounded = false;
                b.jumpProcessed = true;
            }
            b.rotation += 0.15 * b.gravityDir;
        } else if (b.mode === 'ufo') {
            b.vy += GRAVITY * 0.8;
            if (b.jumpPressed && !b.jumpProcessed) {
                b.vy = JUMP_FORCE * 0.75;
                b.jumpProcessed = true;
            }
            b.rotation = b.vy * 0.03;
        } else if (b.mode === 'wave') {
            if (b.jumpPressed) b.vy = -currentLevel.speed * 0.8; else b.vy = currentLevel.speed * 0.8;
            b.rotation = b.jumpPressed ? -0.4 : 0.4;
        }

        b.y += b.vy;

        const groundY = canvas.height - GROUND_HEIGHT - b.h;
        if (b.y >= groundY) {
            b.y = groundY;
            b.vy = 0;
            b.isGrounded = true;
        } else if (b.y <= CEILING_HEIGHT) {
            b.y = CEILING_HEIGHT;
            b.vy = 0;
        }

        // Check Obstacle Collisions
        currentLevel.obstacles.forEach(obs => {
            const obsScreenX = obs.x - b.distance + b.x;
            const obsY = canvas.height - GROUND_HEIGHT - obs.y - obs.h;

            if (obsScreenX > b.x - 50 && obsScreenX < b.x + 50) {
                if (obs.type === 'yellow_pad') {
                    if (b.x + b.w > obsScreenX && b.x < obsScreenX + obs.w && b.y + b.h >= obsY) {
                        b.vy = JUMP_FORCE * 1.3;
                        b.isGrounded = false;
                    }
                } else if (obs.type === 'yellow_ring') {
                    if (b.x + b.w > obsScreenX && b.x < obsScreenX + obs.w && b.y + b.h >= obsY && b.jumpPressed) {
                        b.vy = JUMP_FORCE;
                    }
                } else if (obs.type === 'spike') {
                    const margin = 8;
                    if (b.x + margin < obsScreenX + obs.w - margin && b.x + b.w - margin > obsScreenX + margin &&
                        b.y + margin < obsY + obs.h - margin && b.y + b.h - margin > obsY + margin) {
                        b.dead = true;
                    }
                } else if (obs.type === 'block') {
                    if (b.x + b.w > obsScreenX && b.x < obsScreenX + obs.w) {
                        if (b.y + b.h >= obsY && b.y + b.h <= obsY + 25 && b.vy >= 0) {
                            b.y = obsY - b.h;
                            b.vy = 0;
                            b.isGrounded = true;
                            return;
                        }
                    }
                    const sideMargin = 6;
                    if (b.x + b.w - sideMargin > obsScreenX && b.x + sideMargin < obsScreenX + obs.w &&
                        b.y + b.h - sideMargin > obsY && b.y + sideMargin < obsY + obs.h) {
                        b.dead = true;
                    }
                }
            }
        });

        if (!b.dead) {
            alive++;
            if (b.distance >= currentLevel.totalLength) {
                botSuiteState.completedBot = b;
            }
        }
    });

    botSuiteState.aliveCount = alive;
    const progressPercent = Math.min(100, Math.floor((maxDistance / currentLevel.totalLength) * 100));

    document.getElementById('aliveBotsCount').textContent = alive;
    document.getElementById('botProgressPercent').textContent = progressPercent + '%';

    if (botSuiteState.completedBot) {
        alert('✅ 20-Bot Suite POTVRDILA: Level je 100% BEATABLE!');
        stopBotTest();
    } else if (alive === 0) {
        alert('❌ Všech 20 botů zemřelo! Level pravděpodobně obsahuje neprůchozí sekci.');
        stopBotTest();
    }
}

function renderBotSuite() {
    if (!botSuiteState) return;

    // Follow lead bot
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
