
// ============================================================================
// 1. DEKLARASI EKSPLISIT REFERENSI ELEMEN DOM & KONSTANTA GLOBAL
// ============================================================================
const canvasContainer = document.getElementById('canvas-container');
const viewportEl = document.getElementById('viewport');
const worldLayer = viewportEl; // Alias eksplisit untuk transformasi layer kanvas
const edgesLayer = document.getElementById('edges-layer');
const nodesLayer = document.getElementById('nodes-layer');

const zoomIndicator = document.getElementById('zoom-indicator');
const saveStatusEl = document.getElementById('save-status');
const statsCounterEl = document.getElementById('stats-counter');
const avatarUploadInput = document.getElementById('avatar-upload-input');
const fileImportInput = document.getElementById('file-import-input');
const toastContainer = document.getElementById('toast-container');

const confirmModal = document.getElementById('confirm-modal');
const confirmTitleEl = document.getElementById('confirm-title');
const confirmMessageEl = document.getElementById('confirm-message');
const confirmOkBtn = document.getElementById('confirm-ok');
const confirmCancelBtn = document.getElementById('confirm-cancel');

const privacyWidget = document.getElementById('privacy-widget');
const privacyPopover = document.getElementById('privacy-popover');
const btnPrivacyBadge = document.getElementById('btn-privacy-badge');
const btnClosePrivacy = document.getElementById('btn-close-privacy');

const exportPngModal = document.getElementById('export-png-modal');
const exportJsonModal = document.getElementById('export-json-modal');
const decryptJsonModal = document.getElementById('decrypt-json-modal');

// Konstanta Dimensi Kartu & Zoom
const NODE_WIDTH = 268;
const DEFAULT_NODE_HEIGHT = 176;
const MIN_SCALE = 0.25;
const MAX_SCALE = 2.25;
const STORAGE_KEY = 'family_tree_canvas_v1';
const DB_NAME = 'FamilyTreeCanvasDB';
const DB_STORE = 'trees';

// ============================================================================
// 2. STATE APLIKASI UTAMA (100% CLIENT-SIDE IN-MEMORY)
// ============================================================================
const appState = {
    nodes: [],
    edges: [], // { id, type: 'spouse' | 'parent-child', source, target }
    isReadOnly: false,
    viewport: {
        x: 0,
        y: 0,
        scale: 1
    }
};

const driveState = {
    accessToken: null,
    accessTokenExpiresAt: 0,
    tokenClient: null,
    pickerReady: false,
    shareClientReady: false,
    currentDriveFileId: localStorage.getItem('ftc_drive_file_id') || null,
    currentDriveFileName: localStorage.getItem('ftc_drive_file_name') || null,
    lastKnownModifiedTime: localStorage.getItem('ftc_drive_modified_time') || null,
    isSyncing: false
};

// Variabel Interaksi UI
let activeUploadNodeId = null;
let isPanning = false;
let panStart = { x: 0, y: 0 };
let spacePressed = false;
let saveTimeout = null;
let viewportSaveTimeout = null;
let confirmCallback = null;
let pendingEncryptedEnvelope = null;
let pendingImportContext = null;
let exportDestination = { type: 'download', forceNewFile: false };
let cameraAnimationFrameId = null;

// ============================================================================
// 3. UTILITAS UMUM, TOAST & CONFIRMATION MODAL
// ============================================================================
function generateId(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    const styles = {
        success: 'bg-slate-900 text-white border-slate-700',
        info: 'bg-indigo-600 text-white border-indigo-500',
        error: 'bg-rose-600 text-white border-rose-500'
    };
    const icons = {
        success: 'check-circle-2',
        info: 'info',
        error: 'alert-circle'
    };

    toast.className = `pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full border shadow-xl text-xs sm:text-sm font-medium transition-all duration-300 opacity-0 translate-y-2 ${styles[type] || styles.success}`;
    toast.innerHTML = `<i data-lucide="${icons[type] || 'check-circle-2'}" class="w-4 h-4 shrink-0"></i><span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);
    if (window.lucide) lucide.createIcons({ root: toast });

    requestAnimationFrame(() => {
        toast.classList.remove('opacity-0', 'translate-y-2');
    });

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 2800);
}

function openConfirmDialog({ title, message, confirmText = t('modal.confirmOk'), onConfirm }) {
    confirmTitleEl.textContent = title;
    confirmMessageEl.textContent = message;
    confirmOkBtn.textContent = confirmText;
    confirmCallback = onConfirm;
    confirmModal.classList.remove('hidden');
    confirmModal.classList.add('flex');
}

function closeConfirmDialog() {
    confirmModal.classList.add('hidden');
    confirmModal.classList.remove('flex');
    confirmCallback = null;
}

confirmCancelBtn.addEventListener('click', closeConfirmDialog);
confirmOkBtn.addEventListener('click', () => {
    if (typeof confirmCallback === 'function') confirmCallback();
    closeConfirmDialog();
});
confirmModal.addEventListener('pointerdown', (e) => {
    if (e.target === confirmModal) closeConfirmDialog();
});

// ============================================================================
// 4. PERSISTENCE LOKAL (INDEXEDDB + FALLBACK LOCALSTORAGE)
// ============================================================================
function openIndexedDB() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) return reject(new Error('IndexedDB tidak didukung'));
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(DB_STORE)) {
                db.createObjectStore(DB_STORE, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveStateToStorage({ updateStatus = true } = {}) {
    const payload = {
        id: 'primary_tree',
        updatedAt: new Date().toISOString(),
        nodes: appState.nodes,
        edges: appState.edges,
        viewport: appState.viewport
    };

    try {
        const db = await openIndexedDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(DB_STORE, 'readwrite');
            tx.objectStore(DB_STORE).put(payload);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (err) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch (lsErr) {
            console.warn('Gagal menyimpan ke localStorage:', lsErr);
        }
    }

    if (updateStatus && saveStatusEl) {
        saveStatusEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> <span>${escapeHtml(t('header.savedLocal'))}</span>`;
    }
}

async function loadStateFromStorage() {
    try {
        const db = await openIndexedDB();
        const data = await new Promise((resolve, reject) => {
            const tx = db.transaction(DB_STORE, 'readonly');
            const req = tx.objectStore(DB_STORE).get('primary_tree');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        if (data && Array.isArray(data.nodes)) return data;
    } catch (err) {
        // Fallback ke localStorage
    }

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.nodes)) return parsed;
        }
    } catch (err) {
        console.warn('Gagal membaca localStorage:', err);
    }
    return null;
}

function scheduleAutoSave() {
    if (saveStatusEl) {
        saveStatusEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span> <span>${escapeHtml(t('header.saving'))}</span>`;
    }
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveStateToStorage();
    }, 350);
}

// Perubahan kamera (pan/zoom/focus) disimpan agar posisi tampilan pulih
// setelah reload, tetapi bukan perubahan data silsilah sehingga status
// "Menyimpan..." tidak perlu ditampilkan.
function scheduleViewportSave() {
    clearTimeout(viewportSaveTimeout);
    viewportSaveTimeout = setTimeout(() => {
        saveStateToStorage({ updateStatus: false });
    }, 500);
}

// ============================================================================
// 5. CONTOH DATA KELUARGA 3 GENERASI
// ============================================================================
function getSampleFamilyData() {
    return {
        nodes: [
            // Generasi 1 (Kakek & Nenek)
            {
                id: 'node_g1_1',
                name: 'H. Ahmad Wijaya',
                years: '1948 - 2021',
                role: 'Kakek • Pensiunan Guru',
                gender: 'male',
                photo: null,
                x: -170,
                y: -260
            },
            {
                id: 'node_g1_2',
                name: 'Hj. Siti Aminah',
                years: '1952 - Sekarang',
                role: 'Nenek • Ibu Rumah Tangga',
                gender: 'female',
                photo: null,
                x: 150,
                y: -260
            },
            // Generasi 2 (Orang Tua & Paman/Bibi)
            {
                id: 'node_g2_1',
                name: 'Budi Santoso Wijaya',
                years: '1976 - Sekarang',
                role: 'Anak Pertama • Arsitek',
                gender: 'male',
                photo: null,
                x: -330,
                y: 10
            },
            {
                id: 'node_g2_2',
                name: 'Ratna Dewi Kusuma',
                years: '1979 - Sekarang',
                role: 'Menantu • Dokter Umum',
                gender: 'female',
                photo: null,
                x: -10,
                y: 10
            },
            {
                id: 'node_g2_3',
                name: 'Rina Marlina Wijaya',
                years: '1983 - Sekarang',
                role: 'Anak Kedua • Dosen',
                gender: 'female',
                photo: null,
                x: 330,
                y: 10
            },
            // Generasi 3 (Cucu)
            {
                id: 'node_g3_1',
                name: 'Dimas Pratama Wijaya',
                years: '2004 - Sekarang',
                role: 'Cucu Pertama • Mahasiswa IT',
                gender: 'male',
                photo: null,
                x: -330,
                y: 280
            },
            {
                id: 'node_g3_2',
                name: 'Nadia Putri Wijaya',
                years: '2008 - Sekarang',
                role: 'Cucu Kedua • Pelajar SMA',
                gender: 'female',
                photo: null,
                x: -10,
                y: 280
            }
        ],
        edges: [
            // Pasangan Generasi 1
            { id: 'edge_sp_1', type: 'spouse', source: 'node_g1_1', target: 'node_g1_2' },
            // Anak dari Generasi 1
            { id: 'edge_pc_1', type: 'parent-child', source: 'node_g1_1', target: 'node_g2_1' },
            { id: 'edge_pc_2', type: 'parent-child', source: 'node_g1_2', target: 'node_g2_1' },
            { id: 'edge_pc_3', type: 'parent-child', source: 'node_g1_1', target: 'node_g2_3' },
            { id: 'edge_pc_4', type: 'parent-child', source: 'node_g1_2', target: 'node_g2_3' },
            // Pasangan Generasi 2
            { id: 'edge_sp_2', type: 'spouse', source: 'node_g2_1', target: 'node_g2_2' },
            // Anak dari Generasi 2 (Cucu)
            { id: 'edge_pc_5', type: 'parent-child', source: 'node_g2_1', target: 'node_g3_1' },
            { id: 'edge_pc_6', type: 'parent-child', source: 'node_g2_2', target: 'node_g3_1' },
            { id: 'edge_pc_7', type: 'parent-child', source: 'node_g2_1', target: 'node_g3_2' },
            { id: 'edge_pc_8', type: 'parent-child', source: 'node_g2_2', target: 'node_g3_2' }
        ]
    };
}

// ============================================================================
// 6. TRANSFORMASI KAMERA KANVAS (PAN, ZOOM & DOT GRID SYNC)
// ============================================================================
function applyViewportTransform() {
    const { x, y, scale } = appState.viewport;
    viewportEl.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;

    // Sinkronkan dot-grid background dengan skala dan posisi kanvas
    const gridSpacing = 24 * scale;
    canvasContainer.style.backgroundSize = `${gridSpacing}px ${gridSpacing}px`;
    canvasContainer.style.backgroundPosition = `${x}px ${y}px`;

    if (zoomIndicator) {
        zoomIndicator.textContent = `${Math.round(scale * 100)}%`;
    }
}

function zoomAtPoint(newScale, clientX, clientY) {
    const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
    const oldScale = appState.viewport.scale;
    if (Math.abs(clampedScale - oldScale) < 0.0001) return;

    const worldX = (clientX - appState.viewport.x) / oldScale;
    const worldY = (clientY - appState.viewport.y) / oldScale;

    appState.viewport.scale = clampedScale;
    appState.viewport.x = clientX - worldX * clampedScale;
    appState.viewport.y = clientY - worldY * clampedScale;

    applyViewportTransform();
    scheduleViewportSave();
}

function getNodeActualHeight(nodeId) {
    const el = document.getElementById(`node-el-${nodeId}`);
    return el ? el.offsetHeight : DEFAULT_NODE_HEIGHT;
}

function fitTreeToScreen(animate = true) {
    if (appState.nodes.length === 0) {
        appState.viewport = {
            x: Math.round(window.innerWidth / 2),
            y: Math.round(window.innerHeight / 2),
            scale: 1
        };
        applyViewportTransform();
        return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    appState.nodes.forEach(node => {
        const h = getNodeActualHeight(node.id);
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + NODE_WIDTH);
        maxY = Math.max(maxY, node.y + h);
    });

    const treeW = Math.max(100, maxX - minX);
    const treeH = Math.max(100, maxY - minY);
    const padding = 110;

    const availW = Math.max(240, window.innerWidth - padding * 2);
    const availH = Math.max(240, window.innerHeight - padding * 2);

    const targetScale = Math.min(1.05, Math.max(MIN_SCALE, Math.min(availW / treeW, availH / treeH)));
    const centerX = minX + treeW / 2;
    const centerY = minY + treeH / 2;

    const targetX = Math.round(window.innerWidth / 2 - centerX * targetScale);
    const targetY = Math.round(window.innerHeight / 2 - centerY * targetScale);

    if (!animate) {
        appState.viewport = { x: targetX, y: targetY, scale: targetScale };
        applyViewportTransform();
        return;
    }

    cancelCameraAnimation();
    const startX = appState.viewport.x;
    const startY = appState.viewport.y;
    const startScale = appState.viewport.scale;
    const duration = 340;
    const startTime = performance.now();

    function step(now) {
        const t = Math.min((now - startTime) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        appState.viewport.x = startX + (targetX - startX) * ease;
        appState.viewport.y = startY + (targetY - startY) * ease;
        appState.viewport.scale = startScale + (targetScale - startScale) * ease;
        applyViewportTransform();

        if (t < 1) {
            cameraAnimationFrameId = requestAnimationFrame(step);
        } else {
            cameraAnimationFrameId = null;
            scheduleViewportSave();
        }
    }
    cameraAnimationFrameId = requestAnimationFrame(step);
}

// ============================================================================
// 7. RENDERING KARTU NODE & GARIS RELASI SVG DINAMIS
// ============================================================================
function getGenderBadgeInfo(gender) {
    if (gender === 'male') {
        return {
            label: t('node.genderMale'),
            badgeClass: 'bg-blue-100/80 text-blue-700 border-blue-200 hover:bg-blue-200/70',
            avatarBg: 'bg-blue-100 text-blue-700 border-blue-200',
            icon: '♂'
        };
    }
    if (gender === 'female') {
        return {
            label: t('node.genderFemale'),
            badgeClass: 'bg-rose-100/80 text-rose-700 border-rose-200 hover:bg-rose-200/70',
            avatarBg: 'bg-rose-100 text-rose-700 border-rose-200',
            icon: '♀'
        };
    }
    return {
        label: t('node.genderNeutral'),
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/70',
        avatarBg: 'bg-slate-100 text-slate-600 border-slate-200',
        icon: '•'
    };
}

function cycleGender(current) {
    if (current === 'male') return 'female';
    if (current === 'female') return 'neutral';
    return 'male';
}

function renderEdges() {
    const nodeMap = new Map(appState.nodes.map(n => [n.id, n]));
    const svgParts = [];

    // 1. Gambar garis pasangan (spouse)
    const spousePairs = new Map();
    appState.edges.forEach(edge => {
        if (edge.type !== 'spouse') return;
        const a = nodeMap.get(edge.source);
        const b = nodeMap.get(edge.target);
        if (!a || !b) return;

        const pairKey = [a.id, b.id].sort().join('__');
        spousePairs.set(pairKey, [a, b]);

        const hA = getNodeActualHeight(a.id);
        const hB = getNodeActualHeight(b.id);
        const leftNode = a.x <= b.x ? a : b;
        const rightNode = a.x <= b.x ? b : a;
        const hLeft = a.x <= b.x ? hA : hB;
        const hRight = a.x <= b.x ? hB : hA;

        const x1 = leftNode.x + NODE_WIDTH;
        const y1 = leftNode.y + hLeft / 2;
        const x2 = rightNode.x;
        const y2 = rightNode.y + hRight / 2;

        // Jika pasangan berjauhan horizontal, hubungkan sisi dalam; jika vertikal, hubungkan tengah
        const dx = Math.abs(x2 - x1);
        const cpx = Math.max(36, dx * 0.45);
        const d = `M ${x1} ${y1} C ${x1 + cpx} ${y1}, ${x2 - cpx} ${y2}, ${x2} ${y2}`;

        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;

        svgParts.push(`
            <g>
                <path d="${d}" fill="none" stroke="#f43f5e" stroke-width="2.2" stroke-opacity="0.65" class="spouse-edge-path" />
                <circle cx="${midX}" cy="${midY}" r="9" fill="#fff1f2" stroke="#fda4af" stroke-width="1.5" />
                <text x="${midX}" y="${midY + 3.5}" text-anchor="middle" font-size="10" fill="#e11d48">♥</text>
            </g>
        `);
    });

    // 2. Gambar garis orang tua -> anak (parent-child)
    // Kelompokkan orang tua dari setiap anak agar jika punya 2 orang tua yang berpasangan, garis turun dari titik tengah pasangan
    const childParentsMap = new Map();
    appState.edges.forEach(edge => {
        if (edge.type !== 'parent-child') return;
        if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) return;
        if (!childParentsMap.has(edge.target)) {
            childParentsMap.set(edge.target, []);
        }
        childParentsMap.get(edge.target).push(edge.source);
    });

    childParentsMap.forEach((parentIds, childId) => {
        const child = nodeMap.get(childId);
        if (!child) return;

        const targetX = child.x + NODE_WIDTH / 2;
        const targetY = child.y;

        // Cek apakah 2 orang tua adalah pasangan
        let usedCombinedCouple = false;
        if (parentIds.length >= 2) {
            for (let i = 0; i < parentIds.length; i++) {
                for (let j = i + 1; j < parentIds.length; j++) {
                    const key = [parentIds[i], parentIds[j]].sort().join('__');
                    if (spousePairs.has(key)) {
                        const p1 = nodeMap.get(parentIds[i]);
                        const p2 = nodeMap.get(parentIds[j]);
                        const h1 = getNodeActualHeight(p1.id);
                        const h2 = getNodeActualHeight(p2.id);

                        const startX = ((p1.x + NODE_WIDTH / 2) + (p2.x + NODE_WIDTH / 2)) / 2;
                        const startY = Math.max(p1.y + h1 / 2, p2.y + h2 / 2);
                        const midY = startY + (targetY - startY) * 0.52;

                        const d = `M ${startX} ${startY} C ${startX} ${midY}, ${targetX} ${midY}, ${targetX} ${targetY}`;
                        svgParts.push(`
                            <g>
                                <path d="${d}" fill="none" stroke="#6366f1" stroke-width="2.2" stroke-opacity="0.65" />
                                <circle cx="${targetX}" cy="${targetY}" r="3.5" fill="#6366f1" />
                            </g>
                        `);
                        usedCombinedCouple = true;
                        break;
                    }
                }
                if (usedCombinedCouple) break;
            }
        }

        if (!usedCombinedCouple) {
            parentIds.forEach(pid => {
                const parent = nodeMap.get(pid);
                if (!parent) return;
                const hP = getNodeActualHeight(parent.id);
                const startX = parent.x + NODE_WIDTH / 2;
                const startY = parent.y + hP;
                const midY = startY + (targetY - startY) * 0.5;
                const d = `M ${startX} ${startY} C ${startX} ${midY}, ${targetX} ${midY}, ${targetX} ${targetY}`;
                svgParts.push(`
                    <g>
                        <path d="${d}" fill="none" stroke="#6366f1" stroke-width="2.2" stroke-opacity="0.65" />
                        <circle cx="${targetX}" cy="${targetY}" r="3.5" fill="#6366f1" />
                    </g>
                `);
            });
        }
    });

    edgesLayer.innerHTML = svgParts.join('');
}

function createNodeElement(node) {
    const isReadOnly = Boolean(appState.isReadOnly);
    const el = document.createElement('div');
    el.id = `node-el-${node.id}`;
    el.className = 'family-node shadow-node p-3.5 select-none';
    el.dataset.nodeId = node.id;
    el.dataset.gender = node.gender || 'neutral';
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;

    const genderInfo = getGenderBadgeInfo(node.gender);
    const initials = (node.name || 'A')
        .split(' ')
        .slice(0, 2)
        .map(w => w[0])
        .join('')
        .toUpperCase();

    const roInputAttr = isReadOnly ? 'readonly tabindex="-1"' : '';
    const roInputClass = isReadOnly ? 'pointer-events-none' : '';

    el.innerHTML = `
        <!-- Top Accent Bar -->
        <div class="node-accent-bar absolute top-0 left-4 right-4 h-1 rounded-b-full opacity-80"></div>

        <!-- Header Kartu: Toggle Gender & Hapus -->
        <div class="flex items-center justify-between gap-2 mb-2.5">
            <button type="button" data-action="toggle-gender" ${isReadOnly ? 'disabled' : ''} class="no-export inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold transition ${isReadOnly ? 'cursor-default' : 'cursor-pointer'} ${genderInfo.badgeClass}" ${isReadOnly ? '' : `title="${escapeHtml(t('node.toggleGenderTitle'))}"`}>
                <span>${genderInfo.icon}</span>
                <span>${genderInfo.label}</span>
            </button>
            ${isReadOnly ? '' : `
            <button type="button" data-action="delete-node" class="no-export p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer" title="${escapeHtml(t('node.deleteTitle'))}">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>`}
        </div>

        <!-- Konten Utama: Avatar + Direct Inline Inputs -->
        <div class="flex items-start gap-3">
            <!-- Avatar dengan Upload & Kompresi Lokal -->
            <button type="button" data-action="upload-avatar" ${isReadOnly ? 'disabled' : ''} class="group relative w-12 h-12 rounded-2xl border overflow-hidden flex items-center justify-center shrink-0 transition ${isReadOnly ? 'cursor-default' : 'cursor-pointer'} ${genderInfo.avatarBg}" ${isReadOnly ? '' : `title="${escapeHtml(t('node.uploadAvatarTitle'))}"`}>
                ${node.photo
                    ? `<img src="${node.photo}" alt="${escapeHtml(node.name)}" class="w-full h-full object-cover">`
                    : `<span class="font-display font-bold text-sm">${initials || '?'}</span>`
                }
                ${isReadOnly ? '' : `
                <div class="no-export absolute inset-0 bg-slate-900/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                    <i data-lucide="camera" class="w-4 h-4"></i>
                </div>`}
            </button>

            <!-- Direct Inline Editing Fields -->
            <div class="flex-1 min-w-0 space-y-1">
                <input type="text" data-field="name" value="${escapeHtml(node.name)}" ${roInputAttr} placeholder="${escapeHtml(t('node.namePlaceholder'))}" class="inline-input ${roInputClass} font-display font-bold text-sm text-slate-900 leading-snug" />
                <input type="text" data-field="years" value="${escapeHtml(node.years)}" ${roInputAttr} placeholder="${escapeHtml(t('node.yearsPlaceholder'))}" class="inline-input ${roInputClass} text-[11px] font-medium text-slate-500" />
                <input type="text" data-field="role" value="${escapeHtml(node.role)}" ${roInputAttr} placeholder="${escapeHtml(t('node.rolePlaceholder'))}" class="inline-input ${roInputClass} text-[11px] text-slate-600" />
            </div>
        </div>

        ${isReadOnly ? '' : `
        <!-- Quick Relation Action Buttons (Disembunyikan saat Export PNG) -->
        <div class="no-export grid grid-cols-3 gap-1.5 mt-3 pt-2.5 border-t border-slate-100">
            <button type="button" data-action="add-parent" class="flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200/70 hover:border-indigo-200 text-[10px] font-semibold transition cursor-pointer whitespace-nowrap" title="${escapeHtml(t('node.addParentTitle'))}">
                <span>${escapeHtml(t('node.addParent'))}</span>
            </button>
            <button type="button" data-action="add-spouse" class="flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200/70 hover:border-rose-200 text-[10px] font-semibold transition cursor-pointer whitespace-nowrap" title="${escapeHtml(t('node.addSpouseTitle'))}">
                <span>${escapeHtml(t('node.addSpouse'))}</span>
            </button>
            <button type="button" data-action="add-child" class="flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200/70 hover:border-emerald-200 text-[10px] font-semibold transition cursor-pointer whitespace-nowrap" title="${escapeHtml(t('node.addChildTitle'))}">
                <span>${escapeHtml(t('node.addChild'))}</span>
            </button>
        </div>`}
    `;

    // Event: Direct Inline Input Updates
    el.querySelectorAll('.inline-input').forEach(input => {
        input.addEventListener('pointerdown', (e) => {
            if (!appState.isReadOnly) e.stopPropagation();
        });
        input.addEventListener('input', (e) => {
            if (appState.isReadOnly) return;
            const field = e.target.dataset.field;
            node[field] = e.target.value;
            if (field === 'name' && !node.photo) {
                const avatarSpan = el.querySelector('[data-action="upload-avatar"] span');
                if (avatarSpan) {
                    const newInitials = (node.name || 'A')
                        .split(' ')
                        .slice(0, 2)
                        .map(w => w[0])
                        .join('')
                        .toUpperCase();
                    avatarSpan.textContent = newInitials || '?';
                }
            }
            scheduleAutoSave();
        });
    });

    // Event: Quick Buttons on Card
    el.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('pointerdown', (e) => {
            if (!appState.isReadOnly) e.stopPropagation();
        });
        btn.addEventListener('click', (e) => {
            if (appState.isReadOnly) return;
            e.stopPropagation();
            const action = btn.dataset.action;
            if (action === 'toggle-gender') {
                node.gender = cycleGender(node.gender);
                renderAll();
                scheduleAutoSave();
            } else if (action === 'delete-node') {
                deleteNode(node.id);
            } else if (action === 'upload-avatar') {
                activeUploadNodeId = node.id;
                avatarUploadInput.value = '';
                avatarUploadInput.click();
            } else if (action === 'add-parent') {
                addRelatedNode(node.id, 'parent');
            } else if (action === 'add-spouse') {
                addRelatedNode(node.id, 'spouse');
            } else if (action === 'add-child') {
                addRelatedNode(node.id, 'child');
            }
        });
    });

    // Event: Drag-and-Drop Kartu Node
    let isDraggingNode = false;
    let dragStartMouse = { x: 0, y: 0 };
    let dragStartNodePos = { x: 0, y: 0 };

    el.addEventListener('pointerdown', (e) => {
        if (appState.isReadOnly) return;
        if (e.button !== 0 || spacePressed) return;
        if (e.target.closest('input') || e.target.closest('button')) return;

        e.stopPropagation();
        cancelCameraAnimation();
        isDraggingNode = true;
        el.classList.add('is-dragging');
        el.classList.remove('is-animating');
        dragStartMouse = { x: e.clientX, y: e.clientY };
        dragStartNodePos = { x: node.x, y: node.y };
        el.setPointerCapture(e.pointerId);
    });

    el.addEventListener('pointermove', (e) => {
        if (!isDraggingNode) return;
        const dx = (e.clientX - dragStartMouse.x) / appState.viewport.scale;
        const dy = (e.clientY - dragStartMouse.y) / appState.viewport.scale;
        node.x = Math.round(dragStartNodePos.x + dx);
        node.y = Math.round(dragStartNodePos.y + dy);
        el.style.left = `${node.x}px`;
        el.style.top = `${node.y}px`;
        renderEdges();
    });

    const finishNodeDrag = (e) => {
        if (!isDraggingNode) return;
        isDraggingNode = false;
        el.classList.remove('is-dragging');
        if (el.hasPointerCapture(e.pointerId)) {
            el.releasePointerCapture(e.pointerId);
        }
        scheduleAutoSave();
    };

    el.addEventListener('pointerup', finishNodeDrag);
    el.addEventListener('pointercancel', finishNodeDrag);

    return el;
}

function applyReadOnlyState() {
    const isReadOnly = Boolean(appState.isReadOnly);
    const readonlyBadge = document.getElementById('readonly-badge');
    const btnAddNode = document.getElementById('btn-add-node');
    const btnAutoLayout = document.getElementById('btn-auto-layout');
    const btnDriveSave = document.getElementById('btn-drive-save');
    const btnDriveQuickSync = document.getElementById('btn-drive-quicksync');

    if (readonlyBadge) {
        readonlyBadge.classList.toggle('hidden', !isReadOnly);
        readonlyBadge.classList.toggle('inline-flex', isReadOnly);
    }
    if (btnAddNode) btnAddNode.classList.toggle('hidden', isReadOnly);
    if (btnAutoLayout) btnAutoLayout.classList.toggle('hidden', isReadOnly);
    if (btnDriveSave) btnDriveSave.classList.toggle('hidden', isReadOnly);
    if (btnDriveQuickSync) btnDriveQuickSync.classList.toggle('hidden', isReadOnly);
}

function renderAll() {
    nodesLayer.innerHTML = '';
    appState.nodes.forEach(node => {
        nodesLayer.appendChild(createNodeElement(node));
    });
    if (window.lucide) lucide.createIcons({ root: nodesLayer });
    renderEdges();
    updateStatsCounter();
    applyReadOnlyState();
}

function updateStatsCounter() {
    if (statsCounterEl) {
        statsCounterEl.textContent = t('header.memberCount', { count: appState.nodes.length });
    }
}

// ============================================================================
// 8. MANIPULASI NODE & RELASI (TAMBAH ORTU, PASANGAN, ANAK, HAPUS)
// ============================================================================
function addStandaloneNode() {
    if (appState.isReadOnly) return;
    const centerWorldX = (window.innerWidth / 2 - appState.viewport.x) / appState.viewport.scale - NODE_WIDTH / 2;
    const centerWorldY = (window.innerHeight / 2 - appState.viewport.y) / appState.viewport.scale - DEFAULT_NODE_HEIGHT / 2;
    const jitterX = Math.round((Math.random() - 0.5) * 80);
    const jitterY = Math.round((Math.random() - 0.5) * 80);

    const newNode = {
        id: generateId('node'),
        name: t('node.newMemberName'),
        years: '',
        role: t('node.newMemberRole'),
        gender: 'neutral',
        photo: null,
        x: Math.round(centerWorldX + jitterX),
        y: Math.round(centerWorldY + jitterY)
    };

    appState.nodes.push(newNode);
    renderAll();
    scheduleAutoSave();
    showToast(t('alerts.memberAdded'), 'info');
}

function addRelatedNode(anchorNodeId, relationType) {
    if (appState.isReadOnly) return;
    const anchor = appState.nodes.find(n => n.id === anchorNodeId);
    if (!anchor) return;

    const newNode = {
        id: generateId('node'),
        name: relationType === 'parent' ? t('node.newParentName') : relationType === 'spouse' ? t('node.newSpouseName') : t('node.newChildName'),
        years: '',
        role: '',
        gender: relationType === 'spouse'
            ? (anchor.gender === 'male' ? 'female' : anchor.gender === 'female' ? 'male' : 'neutral')
            : 'neutral',
        photo: null,
        x: anchor.x,
        y: anchor.y
    };

    if (relationType === 'spouse') {
        newNode.x = anchor.x + NODE_WIDTH + 64;
        newNode.y = anchor.y;
        appState.nodes.push(newNode);
        appState.edges.push({
            id: generateId('edge'),
            type: 'spouse',
            source: anchor.id,
            target: newNode.id
        });
    } else if (relationType === 'child') {
        // Cek apakah anchor punya pasangan; jika ya, hubungkan anak ke kedua orang tua
        const spouseEdge = appState.edges.find(
            e => e.type === 'spouse' && (e.source === anchor.id || e.target === anchor.id)
        );
        const spouseId = spouseEdge ? (spouseEdge.source === anchor.id ? spouseEdge.target : spouseEdge.source) : null;
        const spouseNode = spouseId ? appState.nodes.find(n => n.id === spouseId) : null;

        const existingChildrenCount = appState.edges.filter(
            e => e.type === 'parent-child' && e.source === anchor.id
        ).length;

        const baseMidX = spouseNode ? (anchor.x + spouseNode.x) / 2 : anchor.x;
        newNode.x = Math.round(baseMidX + existingChildrenCount * 60);
        newNode.y = anchor.y + DEFAULT_NODE_HEIGHT + 95;

        appState.nodes.push(newNode);
        appState.edges.push({
            id: generateId('edge'),
            type: 'parent-child',
            source: anchor.id,
            target: newNode.id
        });
        if (spouseNode) {
            appState.edges.push({
                id: generateId('edge'),
                type: 'parent-child',
                source: spouseNode.id,
                target: newNode.id
            });
        }
    } else if (relationType === 'parent') {
        const existingParentsCount = appState.edges.filter(
            e => e.type === 'parent-child' && e.target === anchor.id
        ).length;

        newNode.x = anchor.x + (existingParentsCount === 0 ? -150 : 170);
        newNode.y = anchor.y - DEFAULT_NODE_HEIGHT - 95;
        if (existingParentsCount === 1) {
            newNode.gender = 'female';
        } else {
            newNode.gender = 'male';
        }

        // Jika sudah ada 1 orang tua, otomatis jadikan orang tua baru ini pasangannya
        const existingParentEdge = appState.edges.find(
            e => e.type === 'parent-child' && e.target === anchor.id
        );

        appState.nodes.push(newNode);
        appState.edges.push({
            id: generateId('edge'),
            type: 'parent-child',
            source: newNode.id,
            target: anchor.id
        });

        if (existingParentEdge && existingParentsCount === 1) {
            appState.edges.push({
                id: generateId('edge'),
                type: 'spouse',
                source: existingParentEdge.source,
                target: newNode.id
            });
        }
    }

    renderAll();
    scheduleAutoSave();
    const labelMap = {
        parent: t('node.relationParent'),
        spouse: t('node.relationSpouse'),
        child: t('node.relationChild')
    };
    showToast(t('alerts.relationAdded', { relation: labelMap[relationType] }), 'success');
}

function deleteNode(nodeId) {
    if (appState.isReadOnly) return;
    appState.nodes = appState.nodes.filter(n => n.id !== nodeId);
    appState.edges = appState.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    renderAll();
    scheduleAutoSave();
    showToast(t('alerts.memberDeleted'), 'info');
}

// ============================================================================
// 9. KOMPRESI FOTO PROFIL SISI KLIEN (MAX 200x200px JPEG)
// ============================================================================
avatarUploadInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file || !activeUploadNodeId) return;

    const targetNode = appState.nodes.find(n => n.id === activeUploadNodeId);
    if (!targetNode) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
            const MAX_SIZE = 200;
            const canvas = document.createElement('canvas');
            canvas.width = MAX_SIZE;
            canvas.height = MAX_SIZE;
            const ctx = canvas.getContext('2d');

            // Center crop persegi agar foto tidak gepeng
            const minSide = Math.min(img.width, img.height);
            const sx = (img.width - minSide) / 2;
            const sy = (img.height - minSide) / 2;

            ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, MAX_SIZE, MAX_SIZE);
            targetNode.photo = canvas.toDataURL('image/jpeg', 0.82);

            renderAll();
            scheduleAutoSave();
            showToast(t('alerts.avatarUpdated'), 'success');
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
});

// ============================================================================
// 10. AUTO-LAYOUT HIERARKIS ANTI-TUMPUK ("RAPIKAN POSISI")
// ============================================================================
function runAutoLayout() {
    if (appState.isReadOnly || appState.nodes.length === 0) return;

    const nodeIds = appState.nodes.map(n => n.id);
    const levelMap = new Map(nodeIds.map(id => [id, 0]));

    // Propagasi level generasi: anak selalu minimal +1 di bawah orang tua, pasangan sejajar
    let changed = true;
    let guard = 0;
    while (changed && guard < 50) {
        changed = false;
        guard++;

        appState.edges.forEach(edge => {
            if (edge.type === 'parent-child') {
                const pLvl = levelMap.get(edge.source) ?? 0;
                const cLvl = levelMap.get(edge.target) ?? 0;
                if (cLvl < pLvl + 1) {
                    levelMap.set(edge.target, pLvl + 1);
                    changed = true;
                }
            } else if (edge.type === 'spouse') {
                const l1 = levelMap.get(edge.source) ?? 0;
                const l2 = levelMap.get(edge.target) ?? 0;
                const maxL = Math.max(l1, l2);
                if (l1 !== maxL) {
                    levelMap.set(edge.source, maxL);
                    changed = true;
                }
                if (l2 !== maxL) {
                    levelMap.set(edge.target, maxL);
                    changed = true;
                }
            }
        });
    }

    // Kelompokkan per generasi dan rapatkan pasangan agar berdampingan
    const generations = new Map();
    appState.nodes.forEach(node => {
        const lvl = levelMap.get(node.id) ?? 0;
        if (!generations.has(lvl)) generations.set(lvl, []);
        generations.get(lvl).push(node);
    });

    const spouseAdj = new Map();
    appState.edges.forEach(e => {
        if (e.type === 'spouse') {
            spouseAdj.set(e.source, e.target);
            spouseAdj.set(e.target, e.source);
        }
    });

    const sortedLevels = Array.from(generations.keys()).sort((a, b) => a - b);
    const H_GAP = 56;
    const V_GAP = 105;

    sortedLevels.forEach((lvl, rowIdx) => {
        const rowNodes = generations.get(lvl);
        // Urutkan berdasarkan posisi x lama terlebih dahulu agar urutan keluarga tetap alami
        rowNodes.sort((a, b) => a.x - b.x);

        const ordered = [];
        const visited = new Set();

        rowNodes.forEach(node => {
            if (visited.has(node.id)) return;
            visited.add(node.id);
            ordered.push(node);

            const partnerId = spouseAdj.get(node.id);
            if (partnerId && !visited.has(partnerId)) {
                const partnerNode = rowNodes.find(n => n.id === partnerId);
                if (partnerNode) {
                    visited.add(partnerNode.id);
                    ordered.push(partnerNode);
                }
            }
        });

        const totalRowWidth = ordered.length * NODE_WIDTH + Math.max(0, ordered.length - 1) * H_GAP;
        let cursorX = -totalRowWidth / 2;
        const targetY = rowIdx * (DEFAULT_NODE_HEIGHT + V_GAP) - 240;

        ordered.forEach(node => {
            node.x = Math.round(cursorX);
            node.y = Math.round(targetY);
            cursorX += NODE_WIDTH + H_GAP;
        });
    });

    // Animasi perpindahan kartu secara halus
    appState.nodes.forEach(node => {
        const el = document.getElementById(`node-el-${node.id}`);
        if (el) {
            el.classList.add('is-animating');
            el.style.left = `${node.x}px`;
            el.style.top = `${node.y}px`;
        }
    });

    // Perbarui garis selama dan setelah animasi
    let frameCount = 0;
    function syncEdgesDuringLayout() {
        renderEdges();
        frameCount++;
        if (frameCount < 30) {
            requestAnimationFrame(syncEdgesDuringLayout);
        } else {
            appState.nodes.forEach(node => {
                const el = document.getElementById(`node-el-${node.id}`);
                if (el) el.classList.remove('is-animating');
            });
            renderEdges();
            fitTreeToScreen(true);
            scheduleAutoSave();
        }
    }
    requestAnimationFrame(syncEdgesDuringLayout);
    showToast(t('alerts.layoutTidied'), 'success');
}

// ============================================================================
// 11A. FLOATING PRIVACY BADGE & POPOVER
// ============================================================================
btnPrivacyBadge.addEventListener('click', (e) => {
    e.stopPropagation();
    privacyPopover.classList.toggle('hidden');
});

btnClosePrivacy.addEventListener('click', (e) => {
    e.stopPropagation();
    privacyPopover.classList.add('hidden');
});

document.addEventListener('pointerdown', (e) => {
    if (!privacyWidget.contains(e.target)) {
        privacyPopover.classList.add('hidden');
    }
});

// ============================================================================
// 11B. EXPORT GAMBAR HD (PNG) DENGAN AUTO-CROP (RETINA 2X)
// ============================================================================
function openExportPngModal() {
    if (appState.nodes.length === 0) {
        showToast(t('alerts.exportEmptyCanvas'), 'error');
        return;
    }
    exportPngModal.classList.remove('hidden');
    exportPngModal.classList.add('flex');
}

function closeExportPngModal() {
    exportPngModal.classList.add('hidden');
    exportPngModal.classList.remove('flex');
}

document.getElementById('btn-export-png').addEventListener('click', openExportPngModal);
document.getElementById('btn-close-png-modal').addEventListener('click', closeExportPngModal);
document.getElementById('btn-cancel-png').addEventListener('click', closeExportPngModal);
exportPngModal.addEventListener('pointerdown', (e) => {
    if (e.target === exportPngModal) closeExportPngModal();
});

document.getElementById('btn-confirm-png').addEventListener('click', async () => {
    const bgRadio = document.querySelector('input[name="png-bg-style"]:checked');
    const bgStyle = bgRadio ? bgRadio.value : 'white';
    closeExportPngModal();
    await exportTreeToHDImage(bgStyle);
});

function loadImageAsync(src) {
    return new Promise((resolve) => {
        if (!src) return resolve(null);
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

function drawCanvasTruncatedText(ctx, text, x, y, maxWidth) {
    if (!text) return;
    let str = String(text);
    if (ctx.measureText(str).width <= maxWidth) {
        ctx.fillText(str, x, y);
        return;
    }
    while (str.length > 1 && ctx.measureText(`${str}…`).width > maxWidth) {
        str = str.slice(0, -1);
    }
    ctx.fillText(`${str}…`, x, y);
}

function drawExportEdges(ctx, offsetX, offsetY) {
    const nodeMap = new Map(appState.nodes.map(n => [n.id, n]));
    const spousePairs = new Map();

    // 1. Garis pasangan (spouse)
    appState.edges.forEach(edge => {
        if (edge.type !== 'spouse') return;
        const a = nodeMap.get(edge.source);
        const b = nodeMap.get(edge.target);
        if (!a || !b) return;

        spousePairs.set([a.id, b.id].sort().join('__'), [a, b]);

        const hA = getNodeActualHeight(a.id);
        const hB = getNodeActualHeight(b.id);
        const leftNode = a.x <= b.x ? a : b;
        const rightNode = a.x <= b.x ? b : a;
        const hLeft = a.x <= b.x ? hA : hB;
        const hRight = a.x <= b.x ? hB : hA;

        const x1 = leftNode.x + NODE_WIDTH + offsetX;
        const y1 = leftNode.y + hLeft / 2 + offsetY;
        const x2 = rightNode.x + offsetX;
        const y2 = rightNode.y + hRight / 2 + offsetY;

        const dx = Math.abs(x2 - x1);
        const cpx = Math.max(36, dx * 0.45);

        ctx.save();
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.65)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(x1 + cpx, y1, x2 - cpx, y2, x2, y2);
        ctx.stroke();

        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        ctx.fillStyle = '#fff1f2';
        ctx.strokeStyle = '#fda4af';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(midX, midY, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#e11d48';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♥', midX, midY + 0.5);
        ctx.restore();
    });

    // 2. Garis orang tua -> anak (parent-child)
    const childParentsMap = new Map();
    appState.edges.forEach(edge => {
        if (edge.type !== 'parent-child') return;
        if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) return;
        if (!childParentsMap.has(edge.target)) childParentsMap.set(edge.target, []);
        childParentsMap.get(edge.target).push(edge.source);
    });

    childParentsMap.forEach((parentIds, childId) => {
        const child = nodeMap.get(childId);
        if (!child) return;

        const targetX = child.x + NODE_WIDTH / 2 + offsetX;
        const targetY = child.y + offsetY;

        let usedCombinedCouple = false;
        if (parentIds.length >= 2) {
            for (let i = 0; i < parentIds.length; i++) {
                for (let j = i + 1; j < parentIds.length; j++) {
                    const key = [parentIds[i], parentIds[j]].sort().join('__');
                    if (spousePairs.has(key)) {
                        const p1 = nodeMap.get(parentIds[i]);
                        const p2 = nodeMap.get(parentIds[j]);
                        const h1 = getNodeActualHeight(p1.id);
                        const h2 = getNodeActualHeight(p2.id);

                        const startX = ((p1.x + NODE_WIDTH / 2) + (p2.x + NODE_WIDTH / 2)) / 2 + offsetX;
                        const startY = Math.max(p1.y + h1 / 2, p2.y + h2 / 2) + offsetY;
                        const midY = startY + (targetY - startY) * 0.52;

                        ctx.save();
                        ctx.strokeStyle = 'rgba(99, 102, 241, 0.65)';
                        ctx.lineWidth = 2.2;
                        ctx.beginPath();
                        ctx.moveTo(startX, startY);
                        ctx.bezierCurveTo(startX, midY, targetX, midY, targetX, targetY);
                        ctx.stroke();

                        ctx.fillStyle = '#6366f1';
                        ctx.beginPath();
                        ctx.arc(targetX, targetY, 3.5, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();

                        usedCombinedCouple = true;
                        break;
                    }
                }
                if (usedCombinedCouple) break;
            }
        }

        if (!usedCombinedCouple) {
            parentIds.forEach(pid => {
                const parent = nodeMap.get(pid);
                if (!parent) return;
                const hP = getNodeActualHeight(parent.id);
                const startX = parent.x + NODE_WIDTH / 2 + offsetX;
                const startY = parent.y + hP + offsetY;
                const midY = startY + (targetY - startY) * 0.5;

                ctx.save();
                ctx.strokeStyle = 'rgba(99, 102, 241, 0.65)';
                ctx.lineWidth = 2.2;
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.bezierCurveTo(startX, midY, targetX, midY, targetX, targetY);
                ctx.stroke();

                ctx.fillStyle = '#6366f1';
                ctx.beginPath();
                ctx.arc(targetX, targetY, 3.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });
        }
    });
}

async function exportTreeToHDImage(bgStyle = 'white') {
    if (appState.nodes.length === 0) return;

    const PADDING = 48;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    appState.nodes.forEach(node => {
        const h = getNodeActualHeight(node.id);
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + NODE_WIDTH);
        maxY = Math.max(maxY, node.y + h);
    });

    const exportWidth = Math.ceil((maxX - minX) + PADDING * 2);
    const exportHeight = Math.ceil((maxY - minY) + PADDING * 2);
    const offsetX = -minX + PADDING;
    const offsetY = -minY + PADDING;

    // Preload seluruh foto avatar (Data URL lokal) sebelum menggambar ke Canvas 2D
    const loadedPhotos = new Map();
    await Promise.all(
        appState.nodes.map(async (node) => {
            if (node.photo) {
                const img = await loadImageAsync(node.photo);
                if (img) loadedPhotos.set(node.id, img);
            }
        })
    );

    const scale = 2; // Retina 2x DPI
    const canvas = document.createElement('canvas');
    canvas.width = exportWidth * scale;
    canvas.height = exportHeight * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    // 1. Latar Belakang
    ctx.fillStyle = bgStyle === 'grid' ? '#f8fafc' : '#ffffff';
    ctx.fillRect(0, 0, exportWidth, exportHeight);

    if (bgStyle === 'grid') {
        ctx.fillStyle = '#cbd5e1';
        for (let gx = 0; gx < exportWidth; gx += 24) {
            for (let gy = 0; gy < exportHeight; gy += 24) {
                ctx.beginPath();
                ctx.arc(gx, gy, 1.2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // 2. Garis Relasi (Spouse & Parent-Child)
    drawExportEdges(ctx, offsetX, offsetY);

    // 3. Kartu Anggota Keluarga
    const genderTheme = {
        male: { border: '#bfdbfe', accent: '#3b82f6', badgeBg: '#dbeafe', badgeBorder: '#bfdbfe', badgeText: '#1d4ed8' },
        female: { border: '#fbcfe8', accent: '#f43f5e', badgeBg: '#ffe4e6', badgeBorder: '#fecdd3', badgeText: '#be123c' },
        neutral: { border: '#e2e8f0', accent: '#64748b', badgeBg: '#f1f5f9', badgeBorder: '#e2e8f0', badgeText: '#475569' }
    };

    appState.nodes.forEach(node => {
        const x = node.x + offsetX;
        const y = node.y + offsetY;
        const h = Math.max(118, getNodeActualHeight(node.id) - 34);
        const theme = genderTheme[node.gender] || genderTheme.neutral;
        const genderInfo = getGenderBadgeInfo(node.gender);

        // Bayangan & badan kartu
        ctx.save();
        ctx.shadowColor = 'rgba(15, 23, 42, 0.08)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(x, y, NODE_WIDTH, h, 16);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = theme.border;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x, y, NODE_WIDTH, h, 16);
        ctx.stroke();

        // Top accent bar
        ctx.fillStyle = theme.accent;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.roundRect(x + 16, y, NODE_WIDTH - 32, 4, [0, 0, 4, 4]);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Gender badge pill
        const badgeText = `${genderInfo.icon} ${genderInfo.label}`;
        ctx.font = '600 10px Inter, sans-serif';
        const badgeW = Math.min(NODE_WIDTH - 28, ctx.measureText(badgeText).width + 16);
        ctx.fillStyle = theme.badgeBg;
        ctx.strokeStyle = theme.badgeBorder;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x + 14, y + 14, badgeW, 18, 9);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = theme.badgeText;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, x + 22, y + 23.5);

        // Avatar (48x48)
        const avX = x + 14;
        const avY = y + 42;
        const avSize = 48;
        const photoImg = loadedPhotos.get(node.id);

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(avX, avY, avSize, avSize, 14);
        ctx.clip();

        if (photoImg) {
            const minSide = Math.min(photoImg.width, photoImg.height);
            const sx = (photoImg.width - minSide) / 2;
            const sy = (photoImg.height - minSide) / 2;
            ctx.drawImage(photoImg, sx, sy, minSide, minSide, avX, avY, avSize, avSize);
        } else {
            ctx.fillStyle = theme.badgeBg;
            ctx.fillRect(avX, avY, avSize, avSize);
            const initials = (node.name || 'A')
                .split(' ')
                .slice(0, 2)
                .map(w => w[0])
                .join('')
                .toUpperCase() || '?';
            ctx.fillStyle = theme.badgeText;
            ctx.font = '700 14px "Plus Jakarta Sans", Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(initials, avX + avSize / 2, avY + avSize / 2 + 0.5);
        }
        ctx.restore();

        ctx.strokeStyle = theme.badgeBorder;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(avX, avY, avSize, avSize, 14);
        ctx.stroke();

        // Teks Nama, Tahun, & Peran
        const textX = avX + avSize + 12;
        const textMaxW = (x + NODE_WIDTH - 14) - textX;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        ctx.fillStyle = '#0f172a';
        ctx.font = '700 14px "Plus Jakarta Sans", Inter, sans-serif';
        drawCanvasTruncatedText(ctx, node.name || t('node.untitled'), textX, avY + 2, textMaxW);

        if (node.years) {
            ctx.fillStyle = '#64748b';
            ctx.font = '500 11px Inter, sans-serif';
            drawCanvasTruncatedText(ctx, node.years, textX, avY + 22, textMaxW);
        }

        if (node.role) {
            ctx.fillStyle = '#475569';
            ctx.font = '400 11px Inter, sans-serif';
            drawCanvasTruncatedText(ctx, node.role, textX, avY + (node.years ? 39 : 22), textMaxW);
        }
    });

    // 4. Watermark pojok kanan bawah
    ctx.save();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(t('app.watermark'), exportWidth - 14, exportHeight - 10);
    ctx.restore();

    const filename = `silsilah-keluarga-hd-${new Date().toISOString().slice(0, 10)}.png`;
    if (typeof canvas.toBlob === 'function') {
        canvas.toBlob((blob) => {
            if (!blob) {
                triggerDownloadUrl(canvas.toDataURL('image/png'), filename);
            } else {
                const url = URL.createObjectURL(blob);
                triggerDownloadUrl(url, filename);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
            showToast(t('alerts.pngHdDownloaded'), 'success');
        }, 'image/png');
    } else {
        triggerDownloadUrl(canvas.toDataURL('image/png'), filename);
        showToast(t('alerts.pngHdDownloaded'), 'success');
    }
}

function triggerDownloadUrl(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

