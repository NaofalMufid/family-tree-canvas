// ============================================================================
// 11C. ENKRIPSI & DEKRIPSI JSON NATIVE WEB CRYPTO API (PBKDF2 + AES-GCM 256)
// ============================================================================
function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

async function deriveAesKeyFromPassword(password, saltBuffer) {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );
    return window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: saltBuffer,
            iterations: 150000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

async function encryptJsonPayload(plainObject, password) {
    const enc = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const aesKey = await deriveAesKeyFromPassword(password, salt.buffer);

    const plaintextBytes = enc.encode(JSON.stringify(plainObject));
    const ciphertextBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        plaintextBytes
    );

    return {
        encrypted: true,
        version: 1,
        algorithm: 'PBKDF2-SHA256-AES-GCM-256',
        salt: bufferToBase64(salt.buffer),
        iv: bufferToBase64(iv.buffer),
        ciphertext: bufferToBase64(ciphertextBuffer)
    };
}

async function decryptJsonEnvelope(envelope, password) {
    if (!envelope || !envelope.salt || !envelope.iv || !envelope.ciphertext) {
        throw new Error(t('alerts.encryptedInvalidStructure'));
    }
    const saltBuffer = base64ToBuffer(envelope.salt);
    const ivBuffer = base64ToBuffer(envelope.iv);
    const ciphertextBuffer = base64ToBuffer(envelope.ciphertext);

    const aesKey = await deriveAesKeyFromPassword(password, saltBuffer);
    const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
        aesKey,
        ciphertextBuffer
    );

    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decryptedBuffer));
}

// Kontrol Modal Export JSON
const chkEncryptJson = document.getElementById('chk-encrypt-json');
const exportPasswordSection = document.getElementById('export-password-section');
const inputExportPassword = document.getElementById('input-export-password');
const exportJsonError = document.getElementById('export-json-error');
const lblConfirmExportJson = document.getElementById('lbl-confirm-export-json');
const exportJsonTitle = document.getElementById('export-json-title');
const exportJsonDescription = document.getElementById('export-json-description');
const exportEncryptionDescription = document.getElementById('export-encryption-description');

function createTreeExportPayload() {
    return {
        app: 'Kanvas Silsilah Keluarga',
        exportedAt: new Date().toISOString(),
        nodes: appState.nodes,
        edges: appState.edges,
        viewport: appState.viewport
    };
}

function openExportJsonModal(options = {}) {
    exportDestination = {
        type: options.type === 'drive' ? 'drive' : 'download',
        forceNewFile: Boolean(options.forceNewFile)
    };
    chkEncryptJson.checked = false;
    exportPasswordSection.classList.add('hidden');
    inputExportPassword.value = '';
    inputExportPassword.type = 'password';
    exportJsonError.classList.add('hidden');
    const isDrive = exportDestination.type === 'drive';
    exportJsonTitle.textContent = isDrive ? t('modal.jsonTitleDrive') : t('modal.jsonTitleDownload');
    exportJsonDescription.textContent = isDrive
        ? t('modal.jsonDescDrive')
        : t('modal.jsonDescDownload');
    exportEncryptionDescription.textContent = isDrive
        ? t('modal.jsonEncryptDescDrive')
        : t('modal.jsonEncryptDescDownload');
    lblConfirmExportJson.textContent = isDrive ? t('modal.jsonDriveSaveBtn') : t('modal.jsonDownloadBtn');
    exportJsonModal.classList.remove('hidden');
    exportJsonModal.classList.add('flex');
}

function closeExportJsonModal() {
    exportJsonModal.classList.add('hidden');
    exportJsonModal.classList.remove('flex');
}

document.getElementById('btn-export').addEventListener('click', () => openExportJsonModal());
document.getElementById('btn-close-export-json').addEventListener('click', closeExportJsonModal);
document.getElementById('btn-cancel-export-json').addEventListener('click', closeExportJsonModal);
exportJsonModal.addEventListener('pointerdown', (e) => {
    if (e.target === exportJsonModal) closeExportJsonModal();
});

chkEncryptJson.addEventListener('change', () => {
    exportJsonError.classList.add('hidden');
    if (chkEncryptJson.checked) {
        exportPasswordSection.classList.remove('hidden');
        lblConfirmExportJson.textContent = exportDestination.type === 'drive' ? t('modal.jsonEncryptSaveBtn') : t('modal.jsonEncryptDownloadBtn');
        requestAnimationFrame(() => inputExportPassword.focus());
    } else {
        exportPasswordSection.classList.add('hidden');
        lblConfirmExportJson.textContent = exportDestination.type === 'drive' ? t('modal.jsonDriveSaveBtn') : t('modal.jsonDownloadBtn');
    }
});

document.getElementById('btn-toggle-export-pwd').addEventListener('click', () => {
    inputExportPassword.type = inputExportPassword.type === 'password' ? 'text' : 'password';
});

document.getElementById('btn-confirm-export-json').addEventListener('click', async () => {
    const rawPayload = createTreeExportPayload();
    const dateStr = new Date().toISOString().slice(0, 10);
    const pwd = inputExportPassword.value;
    if (chkEncryptJson.checked && (!pwd || pwd.trim().length < 4)) {
        exportJsonError.textContent = t('modal.jsonPwdMinError');
        exportJsonError.classList.remove('hidden');
        inputExportPassword.focus();
        return;
    }

    try {
        const outputPayload = chkEncryptJson.checked
            ? await encryptJsonPayload(rawPayload, pwd)
            : rawPayload;
        const jsonContent = JSON.stringify(outputPayload, null, 2);
        const destination = { ...exportDestination };
        const wasEncrypted = chkEncryptJson.checked;
        closeExportJsonModal();

        if (destination.type === 'drive') {
            await uploadJsonToGoogleDrive(jsonContent, destination.forceNewFile);
            return;
        }

        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        triggerDownloadUrl(url, wasEncrypted
            ? `silsilah-keluarga-terkunci-${dateStr}.json`
            : `silsilah-keluarga-${dateStr}.json`);
        URL.revokeObjectURL(url);
        showToast(wasEncrypted
            ? t('alerts.jsonEncryptedDownloaded')
            : t('alerts.jsonDownloaded'), 'success');
    } catch (err) {
        if (!exportJsonModal.classList.contains('hidden')) {
            exportJsonError.textContent = t('modal.jsonPrepareError');
            exportJsonError.classList.remove('hidden');
        } else {
            showToast(t('drive.errPrefix', { message: err.message }), 'error');
        }
    }
});

// Kontrol Import & Dekripsi JSON
const inputDecryptPassword = document.getElementById('input-decrypt-password');
const decryptErrorBox = document.getElementById('decrypt-error-box');
const decryptErrorText = document.getElementById('decrypt-error-text');

function openDecryptModal(envelope, context = { source: 'local' }) {
    pendingEncryptedEnvelope = envelope;
    pendingImportContext = context;
    inputDecryptPassword.value = '';
    inputDecryptPassword.type = 'password';
    decryptErrorBox.classList.add('hidden');
    decryptJsonModal.classList.remove('hidden');
    decryptJsonModal.classList.add('flex');
    requestAnimationFrame(() => inputDecryptPassword.focus());
}

function closeDecryptModal() {
    pendingEncryptedEnvelope = null;
    pendingImportContext = null;
    decryptJsonModal.classList.add('hidden');
    decryptJsonModal.classList.remove('flex');
}

document.getElementById('btn-close-decrypt-modal').addEventListener('click', closeDecryptModal);
document.getElementById('btn-cancel-decrypt').addEventListener('click', closeDecryptModal);
decryptJsonModal.addEventListener('pointerdown', (e) => {
    if (e.target === decryptJsonModal) closeDecryptModal();
});

document.getElementById('btn-toggle-decrypt-pwd').addEventListener('click', () => {
    inputDecryptPassword.type = inputDecryptPassword.type === 'password' ? 'text' : 'password';
});

async function handleDecryptSubmit() {
    if (!pendingEncryptedEnvelope) return;
    const pwd = inputDecryptPassword.value;
    if (!pwd) {
        decryptErrorText.textContent = t('modal.decryptEmptyError');
        decryptErrorBox.classList.remove('hidden');
        return;
    }

    try {
        const decryptedData = await decryptJsonEnvelope(pendingEncryptedEnvelope, pwd);
        const importContext = pendingImportContext;
        applyImportedTreeData(decryptedData);
        completeImportContext(importContext);
        closeDecryptModal();
        showToast(t('alerts.jsonDecryptedLoaded'), 'success');
    } catch (err) {
        // Jangan ubah state kanvas aktif jika password salah
        decryptErrorText.textContent = t('modal.decryptFailedError');
        decryptErrorBox.classList.remove('hidden');
        inputDecryptPassword.select();
    }
}

document.getElementById('btn-confirm-decrypt').addEventListener('click', handleDecryptSubmit);
inputDecryptPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleDecryptSubmit();
    }
});

function applyImportedTreeData(parsed) {
    if (!parsed || !Array.isArray(parsed.nodes)) {
        throw new Error(t('alerts.jsonInvalidFormat'));
    }
    appState.nodes = parsed.nodes;
    appState.edges = Array.isArray(parsed.edges) ? parsed.edges : [];
    renderAll();
    requestAnimationFrame(() => fitTreeToScreen(true));
    scheduleAutoSave();
}

function completeImportContext(context) {
    if (context && context.source === 'drive') {
        driveState.currentDriveFileId = context.fileId;
        driveState.currentDriveFileName = context.fileName || t('drive.defaultFileName');
        driveState.lastKnownModifiedTime = context.modifiedTime || null;
        appState.isReadOnly = context.canEdit === false;
        if (typeof applyReadOnlyState === 'function') applyReadOnlyState();
        renderAll();
        updateDriveUI();
    } else {
        appState.isReadOnly = false;
        if (typeof applyReadOnlyState === 'function') applyReadOnlyState();
        unlinkDriveFile(false);
    }
}

function importJsonText(rawText, context = { source: 'local' }) {
    const parsed = JSON.parse(rawText);
    if (parsed && parsed.encrypted === true) {
        openDecryptModal(parsed, context);
        return false;
    }
    applyImportedTreeData(parsed);
    completeImportContext(context);
    if (context && context.source === 'drive' && context.canEdit === false) {
        showToast(t('drive.loadedViewOnlyToast', { fileName: driveState.currentDriveFileName }), 'info');
    } else if (context && context.reloadedLatest) {
        showToast(t('drive.reloadedLatestToast'), 'success');
    } else {
        showToast(t('alerts.jsonImportSuccess', { count: appState.nodes.length }), 'success');
    }
    return true;
}

// ============================================================================
// PARSER CSV RINGAN (EXCEL / GOOGLE SHEETS) & UNDUH TEMPLATE CSV
// ============================================================================
function detectCsvDelimiter(headerLine) {
    let commas = 0;
    let semicolons = 0;
    let inQuotes = false;
    for (let i = 0; i < headerLine.length; i++) {
        const ch = headerLine[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (!inQuotes) {
            if (ch === ',') commas++;
            else if (ch === ';') semicolons++;
        }
    }
    return semicolons > commas ? ';' : ',';
}

function parseCsvRows(rawText) {
    const cleaned = String(rawText || '').replace(/^\uFEFF/, '');
    const firstLineBreak = cleaned.search(/\r?\n/);
    const headerSample = firstLineBreak === -1 ? cleaned : cleaned.slice(0, firstLineBreak);
    const delimiter = detectCsvDelimiter(headerSample);

    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < cleaned.length; i++) {
        const ch = cleaned[i];
        const next = cleaned[i + 1];

        if (ch === '"') {
            if (inQuotes && next === '"') {
                currentCell += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === delimiter && !inQuotes) {
            currentRow.push(currentCell.trim());
            currentCell = '';
        } else if ((ch === '\r' || ch === '\n') && !inQuotes) {
            if (ch === '\r' && next === '\n') i++;
            currentRow.push(currentCell.trim());
            if (currentRow.some(cell => cell !== '')) {
                rows.push(currentRow);
            }
            currentRow = [];
            currentCell = '';
        } else {
            currentCell += ch;
        }
    }

    currentRow.push(currentCell.trim());
    if (currentRow.some(cell => cell !== '')) {
        rows.push(currentRow);
    }
    return rows;
}

function normalizeCsvGender(rawGender) {
    const val = String(rawGender || '').trim().toLowerCase();
    if (['male', 'm', 'l', 'laki-laki', 'pria'].includes(val)) return 'male';
    if (['female', 'f', 'p', 'perempuan', 'wanita'].includes(val)) return 'female';
    return '';
}

function parseCsvToTreeData(rawText) {
    const rows = parseCsvRows(rawText);
    if (rows.length === 0) {
        throw new Error(t('alerts.csvEmptyData'));
    }

    const headers = rows[0].map(h => h.toLowerCase().trim());
    const colIndex = (name) => headers.indexOf(name);

    const idIdx = colIndex('id');
    const nameIdx = colIndex('name');
    if (idIdx === -1 || nameIdx === -1) {
        throw new Error(t('alerts.csvMissingColumns'));
    }

    const genderIdx = colIndex('gender');
    const yearsIdx = colIndex('years');
    const roleIdx = colIndex('role');
    const fatherIdx = colIndex('father_id');
    const motherIdx = colIndex('mother_id');
    const spouseIdx = colIndex('spouse_id');

    const dataRows = rows.slice(1);
    if (dataRows.length === 0) {
        throw new Error(t('alerts.csvEmptyData'));
    }

    const nodes = [];
    const nodeIdSet = new Set();
    const rowRelations = [];

    dataRows.forEach((row) => {
        const id = (row[idIdx] || '').trim();
        const name = (row[nameIdx] || '').trim();
        if (!id || !name || nodeIdSet.has(id)) return;

        nodeIdSet.add(id);
        nodes.push({
            id,
            name,
            gender: genderIdx !== -1 ? normalizeCsvGender(row[genderIdx]) : '',
            years: yearsIdx !== -1 ? (row[yearsIdx] || '').trim() : '',
            role: roleIdx !== -1 ? (row[roleIdx] || '').trim() : '',
            photo: null,
            x: 0,
            y: 0
        });

        rowRelations.push({
            id,
            fatherId: fatherIdx !== -1 ? (row[fatherIdx] || '').trim() : '',
            motherId: motherIdx !== -1 ? (row[motherIdx] || '').trim() : '',
            spouseId: spouseIdx !== -1 ? (row[spouseIdx] || '').trim() : ''
        });
    });

    if (nodes.length === 0) {
        throw new Error(t('alerts.csvEmptyData'));
    }

    const edges = [];
    const parentChildSeen = new Set();
    const spouseSeen = new Set();

    rowRelations.forEach((rel) => {
        if (rel.fatherId && rel.fatherId !== rel.id && nodeIdSet.has(rel.fatherId)) {
            const pcKey = `${rel.fatherId}->${rel.id}`;
            if (!parentChildSeen.has(pcKey)) {
                parentChildSeen.add(pcKey);
                edges.push({
                    id: generateId('edge'),
                    type: 'parent-child',
                    source: rel.fatherId,
                    target: rel.id
                });
            }
        }
        if (rel.motherId && rel.motherId !== rel.id && nodeIdSet.has(rel.motherId)) {
            const pcKey = `${rel.motherId}->${rel.id}`;
            if (!parentChildSeen.has(pcKey)) {
                parentChildSeen.add(pcKey);
                edges.push({
                    id: generateId('edge'),
                    type: 'parent-child',
                    source: rel.motherId,
                    target: rel.id
                });
            }
        }
        if (rel.spouseId && rel.spouseId !== rel.id && nodeIdSet.has(rel.spouseId)) {
            const spKey = [rel.id, rel.spouseId].sort().join('__');
            if (!spouseSeen.has(spKey)) {
                spouseSeen.add(spKey);
                edges.push({
                    id: generateId('edge'),
                    type: 'spouse',
                    source: rel.id,
                    target: rel.spouseId
                });
            }
        }
    });

    return { nodes, edges };
}

function importCsvText(rawText) {
    const parsed = parseCsvToTreeData(rawText);
    appState.nodes = parsed.nodes;
    appState.edges = parsed.edges;
    appState.isReadOnly = false;
    if (typeof applyReadOnlyState === 'function') applyReadOnlyState();
    unlinkDriveFile(false);
    renderAll();
    if (typeof runAutoLayout === 'function') {
        runAutoLayout();
    } else {
        requestAnimationFrame(() => fitTreeToScreen(true));
        scheduleAutoSave();
    }
    showToast(t('alerts.csvImportSuccess', { count: appState.nodes.length }), 'success');
    return true;
}

function downloadCsvTemplate() {
    const templateRows = [
        ['id', 'name', 'gender', 'years', 'role', 'father_id', 'mother_id', 'spouse_id'],
        ['1', 'Budi Santoso', 'Laki-laki', '1970 - Sekarang', 'Ayah, Arsitek', '', '', '2'],
        ['2', 'Siti Aminah', 'Perempuan', '1973 - Sekarang', 'Ibu, Guru', '', '', '1'],
        ['3', 'Andi Pratama', 'Laki-laki', '1998 - Sekarang', 'Anak Pertama', '1', '2', ''],
        ['4', 'Nadia Putri', 'Perempuan', '2002 - Sekarang', 'Anak Kedua', '1', '2', '']
    ];

    const csvContent = templateRows
        .map(row => row.map(cell => (/[,"\n\r;]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(','))
        .join('\r\n');

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    triggerDownloadUrl(url, 'template-silsilah.csv');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(t('alerts.csvTemplateDownloaded'), 'success');
}

document.getElementById('btn-import').addEventListener('click', () => {
    fileImportInput.value = '';
    fileImportInput.click();
});

document.getElementById('btn-download-csv-template')?.addEventListener('click', downloadCsvTemplate);

fileImportInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv';
    const reader = new FileReader();
    reader.onload = (ev) => {
        if (isCsv) {
            try {
                importCsvText(ev.target.result);
            } catch (err) {
                showToast(err?.message || t('alerts.csvInvalidFile'), 'error');
            }
            return;
        }
        try {
            importJsonText(ev.target.result, { source: 'local' });
        } catch (err) {
            showToast(t('alerts.jsonInvalidFile'), 'error');
        }
    };
    reader.readAsText(file);
});

