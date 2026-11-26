
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
    currentDriveFileId: localStorage.getItem('ftc_drive_file_id') || null,
    currentDriveFileName: localStorage.getItem('ftc_drive_file_name') || null,
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

function openConfirmDialog({ title, message, confirmText = 'Ya, Lanjutkan', onConfirm }) {
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
        saveStatusEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Tersimpan lokal`;
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
        saveStatusEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span> Menyimpan...`;
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
            label: 'Laki-laki',
            badgeClass: 'bg-blue-100/80 text-blue-700 border-blue-200 hover:bg-blue-200/70',
            avatarBg: 'bg-blue-100 text-blue-700 border-blue-200',
            icon: '♂'
        };
    }
    if (gender === 'female') {
        return {
            label: 'Perempuan',
            badgeClass: 'bg-rose-100/80 text-rose-700 border-rose-200 hover:bg-rose-200/70',
            avatarBg: 'bg-rose-100 text-rose-700 border-rose-200',
            icon: '♀'
        };
    }
    return {
        label: 'Netral',
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

    el.innerHTML = `
        <!-- Top Accent Bar -->
        <div class="node-accent-bar absolute top-0 left-4 right-4 h-1 rounded-b-full opacity-80"></div>

        <!-- Header Kartu: Toggle Gender & Hapus -->
        <div class="flex items-center justify-between gap-2 mb-2.5">
            <button type="button" data-action="toggle-gender" class="no-export inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold transition cursor-pointer ${genderInfo.badgeClass}" title="Klik untuk ganti warna/gender">
                <span>${genderInfo.icon}</span>
                <span>${genderInfo.label}</span>
            </button>
            <button type="button" data-action="delete-node" class="no-export p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer" title="Hapus Anggota Ini">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
        </div>

        <!-- Konten Utama: Avatar + Direct Inline Inputs -->
        <div class="flex items-start gap-3">
            <!-- Avatar dengan Upload & Kompresi Lokal -->
            <button type="button" data-action="upload-avatar" class="group relative w-12 h-12 rounded-2xl border overflow-hidden flex items-center justify-center shrink-0 cursor-pointer transition ${genderInfo.avatarBg}" title="Klik untuk unggah foto profil">
                ${node.photo
                    ? `<img src="${node.photo}" alt="${escapeHtml(node.name)}" class="w-full h-full object-cover">`
                    : `<span class="font-display font-bold text-sm">${initials || '?'}</span>`
                }
                <div class="no-export absolute inset-0 bg-slate-900/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                    <i data-lucide="camera" class="w-4 h-4"></i>
                </div>
            </button>

            <!-- Direct Inline Editing Fields -->
            <div class="flex-1 min-w-0 space-y-1">
                <input type="text" data-field="name" value="${escapeHtml(node.name)}" placeholder="Nama Lengkap..." class="inline-input font-display font-bold text-sm text-slate-900 leading-snug" />
                <input type="text" data-field="years" value="${escapeHtml(node.years)}" placeholder="Tahun Lahir - Wafat..." class="inline-input text-[11px] font-medium text-slate-500" />
                <input type="text" data-field="role" value="${escapeHtml(node.role)}" placeholder="Peran / Catatan singkat..." class="inline-input text-[11px] text-slate-600" />
            </div>
        </div>

        <!-- Quick Relation Action Buttons (Disembunyikan saat Export PNG) -->
        <div class="no-export grid grid-cols-3 gap-1.5 mt-3 pt-2.5 border-t border-slate-100">
            <button type="button" data-action="add-parent" class="flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200/70 hover:border-indigo-200 text-[10px] font-semibold transition cursor-pointer" title="Tambah Orang Tua di atasnya">
                <span>+ Ortu</span>
            </button>
            <button type="button" data-action="add-spouse" class="flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200/70 hover:border-rose-200 text-[10px] font-semibold transition cursor-pointer" title="Tambah Pasangan di sampingnya">
                <span>+ Pasangan</span>
            </button>
            <button type="button" data-action="add-child" class="flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200/70 hover:border-emerald-200 text-[10px] font-semibold transition cursor-pointer" title="Tambah Anak di bawahnya">
                <span>+ Anak</span>
            </button>
        </div>
    `;

    // Event: Direct Inline Input Updates
    el.querySelectorAll('.inline-input').forEach(input => {
        input.addEventListener('pointerdown', (e) => e.stopPropagation());
        input.addEventListener('input', (e) => {
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
        btn.addEventListener('pointerdown', (e) => e.stopPropagation());
        btn.addEventListener('click', (e) => {
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

function renderAll() {
    nodesLayer.innerHTML = '';
    appState.nodes.forEach(node => {
        nodesLayer.appendChild(createNodeElement(node));
    });
    if (window.lucide) lucide.createIcons({ root: nodesLayer });
    renderEdges();
    updateStatsCounter();
}

function updateStatsCounter() {
    if (statsCounterEl) {
        statsCounterEl.textContent = `${appState.nodes.length} anggota`;
    }
}

// ============================================================================
// 8. MANIPULASI NODE & RELASI (TAMBAH ORTU, PASANGAN, ANAK, HAPUS)
// ============================================================================
function addStandaloneNode() {
    const centerWorldX = (window.innerWidth / 2 - appState.viewport.x) / appState.viewport.scale - NODE_WIDTH / 2;
    const centerWorldY = (window.innerHeight / 2 - appState.viewport.y) / appState.viewport.scale - DEFAULT_NODE_HEIGHT / 2;
    const jitterX = Math.round((Math.random() - 0.5) * 80);
    const jitterY = Math.round((Math.random() - 0.5) * 80);

    const newNode = {
        id: generateId('node'),
        name: 'Anggota Baru',
        years: '',
        role: 'Klik untuk isi catatan',
        gender: 'neutral',
        photo: null,
        x: Math.round(centerWorldX + jitterX),
        y: Math.round(centerWorldY + jitterY)
    };

    appState.nodes.push(newNode);
    renderAll();
    scheduleAutoSave();
    showToast('Anggota keluarga baru ditambahkan', 'info');
}

function addRelatedNode(anchorNodeId, relationType) {
    const anchor = appState.nodes.find(n => n.id === anchorNodeId);
    if (!anchor) return;

    const newNode = {
        id: generateId('node'),
        name: relationType === 'parent' ? 'Orang Tua Baru' : relationType === 'spouse' ? 'Pasangan Baru' : 'Anak Baru',
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
    const labelMap = { parent: 'Orang Tua', spouse: 'Pasangan', child: 'Anak' };
    showToast(`${labelMap[relationType]} ditambahkan`, 'success');
}

function deleteNode(nodeId) {
    appState.nodes = appState.nodes.filter(n => n.id !== nodeId);
    appState.edges = appState.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    renderAll();
    scheduleAutoSave();
    showToast('Anggota keluarga dihapus', 'info');
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
            showToast('Foto profil dikompresi & diperbarui', 'success');
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
});

// ============================================================================
// 10. AUTO-LAYOUT HIERARKIS ANTI-TUMPUK ("RAPIKAN POSISI")
// ============================================================================
function runAutoLayout() {
    if (appState.nodes.length === 0) return;

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
    showToast('Posisi pohon silsilah dirapikan', 'success');
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
        showToast('Kanvas masih kosong untuk diekspor', 'error');
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

async function exportTreeToHDImage(bgStyle = 'white') {
    if (appState.nodes.length === 0) return;

    const PADDING = 40;
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

    // Buat stage off-screen bersih tanpa transform zoom/pan dan tanpa tombol kontrol UI
    const stage = document.createElement('div');
    stage.style.position = 'fixed';
    stage.style.left = '-99999px';
    stage.style.top = '0';
    stage.style.width = `${exportWidth}px`;
    stage.style.height = `${exportHeight}px`;
    stage.style.overflow = 'hidden';
    stage.style.backgroundColor = bgStyle === 'grid' ? '#f8fafc' : '#ffffff';
    if (bgStyle === 'grid') {
        stage.style.backgroundImage = 'radial-gradient(#cbd5e1 1.25px, transparent 1.25px)';
        stage.style.backgroundSize = '24px 24px';
    }

    const worldClone = document.createElement('div');
    worldClone.style.position = 'absolute';
    worldClone.style.left = `${offsetX}px`;
    worldClone.style.top = `${offsetY}px`;

    // Clone SVG edges
    const svgClone = edgesLayer.cloneNode(true);
    svgClone.style.position = 'absolute';
    svgClone.style.left = '0';
    svgClone.style.top = '0';
    svgClone.style.overflow = 'visible';
    worldClone.appendChild(svgClone);

    // Clone seluruh kartu node & konversi <input> ke teks statis agar tajam dan tidak terpotong
    appState.nodes.forEach(node => {
        const origEl = document.getElementById(`node-el-${node.id}`);
        if (!origEl) return;
        const cardClone = origEl.cloneNode(true);
        cardClone.classList.remove('search-highlight-ring', 'is-dragging', 'is-animating');
        cardClone.style.left = `${node.x}px`;
        cardClone.style.top = `${node.y}px`;

        // Sembunyikan semua elemen kontrol UI (.no-export)
        cardClone.querySelectorAll('.no-export').forEach(ctrl => ctrl.remove());

        // Ganti input inline dengan div teks statis agar rendering PNG sempurna
        cardClone.querySelectorAll('input.inline-input').forEach(inp => {
            const textDiv = document.createElement('div');
            textDiv.className = inp.className.replace('inline-input', '');
            textDiv.textContent = inp.value || '';
            if (!inp.value) textDiv.style.display = 'none';
            inp.replaceWith(textDiv);
        });

        worldClone.appendChild(cardClone);
    });

    // Watermark kecil elegan di pojok kanan bawah hasil export
    const watermark = document.createElement('div');
    watermark.style.position = 'absolute';
    watermark.style.right = '14px';
    watermark.style.bottom = '10px';
    watermark.style.fontSize = '10px';
    watermark.style.fontFamily = 'Inter, sans-serif';
    watermark.style.color = '#94a3b8';
    watermark.textContent = 'Kanvas Silsilah Keluarga • 100% Lokal & Privat';

    stage.appendChild(worldClone);
    stage.appendChild(watermark);
    document.body.appendChild(stage);

    try {
        if (window.htmlToImage && typeof window.htmlToImage.toPng === 'function') {
            const dataUrl = await window.htmlToImage.toPng(stage, {
                pixelRatio: 2,
                width: exportWidth,
                height: exportHeight,
                cacheBust: true
            });
            triggerDownloadUrl(dataUrl, `silsilah-keluarga-hd-${new Date().toISOString().slice(0, 10)}.png`);
            showToast('Gambar PNG HD (2x) berhasil diunduh', 'success');
        } else {
            throw new Error('Library html-to-image tidak tersedia');
        }
    } catch (err) {
        console.warn('Fallback ke Canvas 2D renderer:', err);
        renderFallbackCanvasPng(exportWidth, exportHeight, offsetX, offsetY, bgStyle);
    } finally {
        stage.remove();
    }
}

function renderFallbackCanvasPng(width, height, offsetX, offsetY, bgStyle) {
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    ctx.fillStyle = bgStyle === 'grid' ? '#f8fafc' : '#ffffff';
    ctx.fillRect(0, 0, width, height);

    if (bgStyle === 'grid') {
        ctx.fillStyle = '#cbd5e1';
        for (let gx = 0; gx < width; gx += 24) {
            for (let gy = 0; gy < height; gy += 24) {
                ctx.beginPath();
                ctx.arc(gx, gy, 1.2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // Gambar kartu sederhana sebagai fallback offline
    appState.nodes.forEach(node => {
        const x = node.x + offsetX;
        const y = node.y + offsetY;
        const h = 115;

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = node.gender === 'male' ? '#93c5fd' : node.gender === 'female' ? '#fda4af' : '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, NODE_WIDTH, h, 14);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.fillText(node.name || 'Tanpa Nama', x + 16, y + 34, NODE_WIDTH - 32);

        ctx.fillStyle = '#64748b';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText(node.years || '', x + 16, y + 58, NODE_WIDTH - 32);
        ctx.fillText(node.role || '', x + 16, y + 80, NODE_WIDTH - 32);
    });

    triggerDownloadUrl(canvas.toDataURL('image/png'), `silsilah-keluarga-${new Date().toISOString().slice(0, 10)}.png`);
    showToast('Gambar PNG berhasil diunduh', 'success');
}

function triggerDownloadUrl(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

