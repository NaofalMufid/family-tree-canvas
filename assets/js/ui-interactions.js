// ============================================================================
// 11E. QUICK SEARCH & FOCUS ZOOM (100% IN-MEMORY COMMAND PALETTE)
// ============================================================================
const searchPaletteModal = document.getElementById('search-palette-modal');
const searchPaletteDialog = document.getElementById('search-palette-dialog');
const searchPaletteInput = document.getElementById('search-palette-input');
const searchResultsList = document.getElementById('search-results-list');
const searchMatchCount = document.getElementById('search-match-count');
const btnClearSearch = document.getElementById('btn-clear-search');
const searchShortcutBadge = document.getElementById('search-shortcut-badge');

let filteredSearchResults = [];
let activeSearchIndex = 0;

const isMacPlatform = /Mac|iPhone|iPod|iPad/i.test(navigator.platform || navigator.userAgent);
if (searchShortcutBadge) {
    searchShortcutBadge.textContent = isMacPlatform ? '⌘K' : 'Ctrl+K';
}

function isSearchPaletteOpen() {
    return !searchPaletteModal.classList.contains('hidden');
}

function cancelCameraAnimation() {
    if (cameraAnimationFrameId !== null) {
        cancelAnimationFrame(cameraAnimationFrameId);
        cameraAnimationFrameId = null;
    }
}

function buildNodeRelationContext(nodeId, nodeMap) {
    const parentNames = [];
    const spouseNames = [];
    const childNames = [];

    appState.edges.forEach(edge => {
        if (edge.type === 'parent-child') {
            if (edge.target === nodeId) {
                const parent = nodeMap.get(edge.source);
                if (parent && parent.name) parentNames.push(parent.name);
            } else if (edge.source === nodeId) {
                const child = nodeMap.get(edge.target);
                if (child && child.name) childNames.push(child.name);
            }
        } else if (edge.type === 'spouse') {
            if (edge.source === nodeId) {
                const spouse = nodeMap.get(edge.target);
                if (spouse && spouse.name) spouseNames.push(spouse.name);
            } else if (edge.target === nodeId) {
                const spouse = nodeMap.get(edge.source);
                if (spouse && spouse.name) spouseNames.push(spouse.name);
            }
        }
    });

    if (parentNames.length > 0) {
        return `Anak dari ${parentNames.slice(0, 2).join(' & ')}`;
    }
    if (spouseNames.length > 0) {
        return `Pasangan dari ${spouseNames[0]}`;
    }
    if (childNames.length > 0) {
        const extra = childNames.length > 2 ? ` +${childNames.length - 2} lainnya` : '';
        return `Orang tua dari ${childNames.slice(0, 2).join(', ')}${extra}`;
    }
    return 'Anggota keluarga mandiri';
}

function highlightMatchedText(text, query) {
    const safeText = escapeHtml(text || '');
    if (!query) return safeText;
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return safeText.replace(regex, '<mark class="bg-indigo-100 text-indigo-800 font-semibold rounded px-0.5">$1</mark>');
}

function renderSearchResults(rawQuery = '') {
    const query = rawQuery.trim().toLowerCase();
    const nodeMap = new Map(appState.nodes.map(n => [n.id, n]));

    const enrichedNodes = appState.nodes.map(node => ({
        node,
        relationContext: buildNodeRelationContext(node.id, nodeMap)
    }));

    if (!query) {
        filteredSearchResults = enrichedNodes;
    } else {
        filteredSearchResults = enrichedNodes.filter(({ node, relationContext }) => {
            const nameMatch = (node.name || '').toLowerCase().includes(query);
            const yearsMatch = (node.years || '').toLowerCase().includes(query);
            const roleMatch = (node.role || '').toLowerCase().includes(query);
            const relationMatch = relationContext.toLowerCase().includes(query);
            return nameMatch || yearsMatch || roleMatch || relationMatch;
        });
    }

    if (activeSearchIndex >= filteredSearchResults.length) {
        activeSearchIndex = Math.max(0, filteredSearchResults.length - 1);
    }

    searchMatchCount.textContent = query
        ? `${filteredSearchResults.length} dari ${appState.nodes.length} anggota`
        : `${appState.nodes.length} anggota tersedia`;

    if (filteredSearchResults.length === 0) {
        searchResultsList.innerHTML = `
            <div class="py-10 px-4 text-center">
                <div class="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2.5">
                    <i data-lucide="user-x" class="w-5 h-5"></i>
                </div>
                <p class="text-xs sm:text-sm font-semibold text-slate-700">Anggota keluarga tidak ditemukan</p>
                <p class="text-[11px] text-slate-400 mt-1">Coba kata kunci nama, tahun lahir, atau peran lainnya.</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons({ root: searchResultsList });
        return;
    }

    searchResultsList.innerHTML = filteredSearchResults.map(({ node, relationContext }, index) => {
        const isSelected = index === activeSearchIndex;
        const genderInfo = getGenderBadgeInfo(node.gender);
        const initials = (node.name || 'A')
            .split(' ')
            .slice(0, 2)
            .map(w => w[0])
            .join('')
            .toUpperCase();

        return `
            <button type="button" role="option" aria-selected="${isSelected}" data-search-index="${index}" data-node-id="${node.id}"
                class="w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition cursor-pointer ${isSelected ? 'bg-indigo-50/95 ring-1 ring-indigo-200' : 'hover:bg-slate-50'}">
                <div class="w-10 h-10 rounded-xl border overflow-hidden flex items-center justify-center shrink-0 ${genderInfo.avatarBg}">
                    ${node.photo
                        ? `<img src="${node.photo}" alt="${escapeHtml(node.name)}" class="w-full h-full object-cover">`
                        : `<span class="font-display font-bold text-xs">${initials || '?'}</span>`
                    }
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2">
                        <p class="font-display font-bold text-xs sm:text-sm text-slate-900 truncate">
                            ${highlightMatchedText(node.name || 'Tanpa Nama', rawQuery.trim())}
                        </p>
                        ${node.years ? `<span class="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md shrink-0">${highlightMatchedText(node.years, rawQuery.trim())}</span>` : ''}
                    </div>
                    <div class="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 truncate">
                        <span class="text-indigo-600 font-medium shrink-0">${highlightMatchedText(relationContext, rawQuery.trim())}</span>
                        ${node.role ? `<span class="text-slate-300">•</span><span class="truncate">${highlightMatchedText(node.role, rawQuery.trim())}</span>` : ''}
                    </div>
                </div>
                <div class="shrink-0 text-slate-400 ${isSelected ? 'text-indigo-600' : ''}">
                    <i data-lucide="corner-down-left" class="w-3.5 h-3.5"></i>
                </div>
            </button>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons({ root: searchResultsList });

    searchResultsList.querySelectorAll('[data-node-id]').forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            const idx = Number(btn.dataset.searchIndex);
            if (idx !== activeSearchIndex) {
                activeSearchIndex = idx;
                updateActiveSearchSelectionVisuals();
            }
        });
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.nodeId;
            closeSearchPalette();
            focusAndHighlightNode(targetId);
        });
    });
}

function updateActiveSearchSelectionVisuals() {
    const items = searchResultsList.querySelectorAll('[data-search-index]');
    items.forEach((el, idx) => {
        const isSelected = idx === activeSearchIndex;
        el.setAttribute('aria-selected', String(isSelected));
        if (isSelected) {
            el.classList.add('bg-indigo-50/95', 'ring-1', 'ring-indigo-200');
            el.classList.remove('hover:bg-slate-50');
            el.scrollIntoView({ block: 'nearest' });
        } else {
            el.classList.remove('bg-indigo-50/95', 'ring-1', 'ring-indigo-200');
            el.classList.add('hover:bg-slate-50');
        }
    });
}

function openSearchPalette() {
    privacyPopover.classList.add('hidden');
    searchPaletteModal.classList.remove('hidden');
    searchPaletteModal.classList.add('flex');
    searchPaletteInput.value = '';
    btnClearSearch.classList.add('hidden');
    activeSearchIndex = 0;
    renderSearchResults('');
    requestAnimationFrame(() => {
        searchPaletteInput.focus();
    });
}

function closeSearchPalette() {
    searchPaletteModal.classList.add('hidden');
    searchPaletteModal.classList.remove('flex');
}

function toggleSearchPalette() {
    if (isSearchPaletteOpen()) {
        closeSearchPalette();
    } else {
        openSearchPalette();
    }
}

function focusAndHighlightNode(nodeId) {
    const node = appState.nodes.find(n => n.id === nodeId);
    if (!node) return;

    cancelCameraAnimation();

    const actualH = getNodeActualHeight(node.id);
    const nodeCenterX = node.x + NODE_WIDTH / 2;
    const nodeCenterY = node.y + actualH / 2;

    const targetScale = 1.15;
    const targetX = (window.innerWidth / 2) - nodeCenterX * targetScale;
    const targetY = (window.innerHeight / 2) - nodeCenterY * targetScale;

    const startX = appState.viewport.x;
    const startY = appState.viewport.y;
    const startScale = appState.viewport.scale;

    const duration = 360;
    const startTime = performance.now();

    function stepCamera(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);

        appState.viewport.x = startX + (targetX - startX) * ease;
        appState.viewport.y = startY + (targetY - startY) * ease;
        appState.viewport.scale = startScale + (targetScale - startScale) * ease;

        applyViewportTransform();

        if (progress < 1) {
            cameraAnimationFrameId = requestAnimationFrame(stepCamera);
        } else {
            cameraAnimationFrameId = null;
            appState.viewport.x = Math.round(targetX);
            appState.viewport.y = Math.round(targetY);
            appState.viewport.scale = targetScale;
            applyViewportTransform();
            scheduleViewportSave();
        }
    }

    cameraAnimationFrameId = requestAnimationFrame(stepCamera);

    const cardEl = document.getElementById(`node-el-${node.id}`);
    if (cardEl) {
        cardEl.classList.remove('search-highlight-ring');
        void cardEl.offsetWidth;
        cardEl.classList.add('search-highlight-ring');
        setTimeout(() => {
            cardEl.classList.remove('search-highlight-ring');
        }, 2050);
    }
}

document.getElementById('btn-open-search').addEventListener('click', openSearchPalette);
document.getElementById('btn-close-search').addEventListener('click', closeSearchPalette);

searchPaletteModal.addEventListener('pointerdown', (e) => {
    if (!searchPaletteDialog.contains(e.target)) {
        closeSearchPalette();
    }
});

btnClearSearch.addEventListener('click', () => {
    searchPaletteInput.value = '';
    btnClearSearch.classList.add('hidden');
    activeSearchIndex = 0;
    renderSearchResults('');
    searchPaletteInput.focus();
});

searchPaletteInput.addEventListener('input', (e) => {
    const val = e.target.value;
    if (val.length > 0) {
        btnClearSearch.classList.remove('hidden');
    } else {
        btnClearSearch.classList.add('hidden');
    }
    activeSearchIndex = 0;
    renderSearchResults(val);
});

searchPaletteInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (filteredSearchResults.length > 0) {
            activeSearchIndex = (activeSearchIndex + 1) % filteredSearchResults.length;
            updateActiveSearchSelectionVisuals();
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (filteredSearchResults.length > 0) {
            activeSearchIndex = (activeSearchIndex - 1 + filteredSearchResults.length) % filteredSearchResults.length;
            updateActiveSearchSelectionVisuals();
        }
    } else if (e.key === 'Enter') {
        e.preventDefault();
        const selectedItem = filteredSearchResults[activeSearchIndex];
        if (selectedItem) {
            closeSearchPalette();
            focusAndHighlightNode(selectedItem.node.id);
        }
    }
});

// ============================================================================
// 12. EVENT LISTENERS KANVAS (PAN, ZOOM, SHORTCUT & TOOLBAR)
// ============================================================================
canvasContainer.addEventListener('pointerdown', (e) => {
    const isCanvasArea = e.target === canvasContainer || e.target === viewportEl || e.target === edgesLayer || e.target === nodesLayer;
    if (isCanvasArea || e.button === 1 || spacePressed) {
        cancelCameraAnimation();
        isPanning = true;
        canvasContainer.classList.add('is-panning');
        panStart = {
            x: e.clientX - appState.viewport.x,
            y: e.clientY - appState.viewport.y
        };
        canvasContainer.setPointerCapture(e.pointerId);
    }
});

canvasContainer.addEventListener('pointermove', (e) => {
    if (!isPanning) return;
    appState.viewport.x = Math.round(e.clientX - panStart.x);
    appState.viewport.y = Math.round(e.clientY - panStart.y);
    applyViewportTransform();
});

const stopPanning = (e) => {
    if (!isPanning) return;
    isPanning = false;
    canvasContainer.classList.remove('is-panning');
    if (canvasContainer.hasPointerCapture(e.pointerId)) {
        canvasContainer.releasePointerCapture(e.pointerId);
    }
    scheduleViewportSave();
};

canvasContainer.addEventListener('pointerup', stopPanning);
canvasContainer.addEventListener('pointercancel', stopPanning);

canvasContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    cancelCameraAnimation();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    zoomAtPoint(appState.viewport.scale * zoomFactor, e.clientX, e.clientY);
}, { passive: false });

window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        e.stopPropagation();
        toggleSearchPalette();
        return;
    }

    if (e.key === 'Escape') {
        if (isSearchPaletteOpen()) {
            e.preventDefault();
            closeSearchPalette();
            return;
        }
        privacyPopover.classList.add('hidden');
    }

    if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT' && !isSearchPaletteOpen()) {
        spacePressed = true;
        canvasContainer.style.cursor = 'grab';
    }
}, true);

window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        spacePressed = false;
        if (!isPanning) canvasContainer.style.cursor = '';
    }
});

// Toolbar & Zoom Button Events
document.getElementById('btn-add-node').addEventListener('click', addStandaloneNode);
document.getElementById('btn-auto-layout').addEventListener('click', runAutoLayout);

document.getElementById('btn-zoom-in').addEventListener('click', () => {
    cancelCameraAnimation();
    zoomAtPoint(appState.viewport.scale * 1.2, window.innerWidth / 2, window.innerHeight / 2);
});

document.getElementById('btn-zoom-out').addEventListener('click', () => {
    cancelCameraAnimation();
    zoomAtPoint(appState.viewport.scale / 1.2, window.innerWidth / 2, window.innerHeight / 2);
});

document.getElementById('btn-reset-view').addEventListener('click', () => fitTreeToScreen(true));

document.getElementById('btn-load-sample').addEventListener('click', () => {
    openConfirmDialog({
        title: 'Muat Contoh Keluarga 3 Generasi?',
        message: 'Data kanvas saat ini akan diganti dengan contoh silsilah 3 generasi.',
        confirmText: 'Muat Contoh',
        onConfirm: () => {
            unlinkDriveFile(false);
            const sample = getSampleFamilyData();
            appState.nodes = sample.nodes;
            appState.edges = sample.edges;
            renderAll();
            requestAnimationFrame(() => fitTreeToScreen(true));
            scheduleAutoSave();
            showToast('Contoh silsilah 3 generasi dimuat', 'success');
        }
    });
});

document.getElementById('btn-reset-empty').addEventListener('click', () => {
    openConfirmDialog({
        title: 'Mulai Silsilah Baru dari Kosong?',
        message: 'Semua kartu di kanvas akan dihapus dan diganti dengan 1 kartu awal untuk Anda mulai.',
        confirmText: 'Reset Kosong',
        onConfirm: () => {
            unlinkDriveFile(false);
            appState.nodes = [
                {
                    id: generateId('node'),
                    name: 'Kepala Keluarga',
                    years: '1980 - Sekarang',
                    role: 'Klik untuk edit nama & foto',
                    gender: 'neutral',
                    photo: null,
                    x: 0,
                    y: 0
                }
            ];
            appState.edges = [];
            renderAll();
            requestAnimationFrame(() => fitTreeToScreen(true));
            scheduleAutoSave();
            showToast('Kanvas direset ke 1 kartu awal', 'info');
        }
    });
});

// ============================================================================
// 13. INISIALISASI APLIKASI SAAT HALAMAN DIMUAT
// ============================================================================
window.addEventListener('load', async () => {
    if (window.lucide) lucide.createIcons();

    const savedState = await loadStateFromStorage();
    if (savedState && savedState.nodes.length > 0) {
        appState.nodes = savedState.nodes;
        appState.edges = savedState.edges || [];
        renderAll();
        if (savedState.viewport && Number.isFinite(savedState.viewport.scale)) {
            appState.viewport = savedState.viewport;
            applyViewportTransform();
        } else {
            requestAnimationFrame(() => fitTreeToScreen(false));
        }
    } else {
        const sample = getSampleFamilyData();
        appState.nodes = sample.nodes;
        appState.edges = sample.edges;
        renderAll();
        requestAnimationFrame(() => {
            fitTreeToScreen(false);
            saveStateToStorage();
        });
    }
});
