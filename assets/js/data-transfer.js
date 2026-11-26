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
        throw new Error('Struktur file terenkripsi tidak valid');
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
    exportJsonTitle.textContent = isDrive ? 'Simpan ke Google Drive' : 'Export Data Silsilah (.JSON)';
    exportJsonDescription.textContent = isDrive
        ? 'Pilih apakah file Drive akan dilindungi password'
        : 'Termasuk seluruh anggota, relasi & foto';
    exportEncryptionDescription.textContent = isDrive
        ? 'Enkripsi lokal AES-GCM 256-bit sebelum diunggah'
        : 'Enkripsi lokal AES-GCM 256-bit sebelum diunduh';
    lblConfirmExportJson.textContent = isDrive ? 'Simpan ke Drive' : 'Unduh JSON';
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
        lblConfirmExportJson.textContent = exportDestination.type === 'drive' ? 'Enkripsi & Simpan' : 'Enkripsi & Unduh';
        requestAnimationFrame(() => inputExportPassword.focus());
    } else {
        exportPasswordSection.classList.add('hidden');
        lblConfirmExportJson.textContent = exportDestination.type === 'drive' ? 'Simpan ke Drive' : 'Unduh JSON';
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
        exportJsonError.textContent = 'Masukkan password minimal 4 karakter.';
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
            ? 'File JSON terenkripsi AES-256 berhasil diunduh'
            : 'File silsilah .JSON berhasil diunduh', 'success');
    } catch (err) {
        if (!exportJsonModal.classList.contains('hidden')) {
            exportJsonError.textContent = 'Gagal menyiapkan file JSON di browser.';
            exportJsonError.classList.remove('hidden');
        } else {
            showToast(`Google Drive: ${err.message}`, 'error');
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
        decryptErrorText.textContent = 'Silakan masukkan password terlebih dahulu.';
        decryptErrorBox.classList.remove('hidden');
        return;
    }

    try {
        const decryptedData = await decryptJsonEnvelope(pendingEncryptedEnvelope, pwd);
        const importContext = pendingImportContext;
        applyImportedTreeData(decryptedData);
        completeImportContext(importContext);
        closeDecryptModal();
        showToast('File terenkripsi berhasil dibuka & dimuat', 'success');
    } catch (err) {
        // Jangan ubah state kanvas aktif jika password salah
        decryptErrorText.textContent = 'Password salah atau file korup. Data kanvas saat ini tetap aman.';
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
        throw new Error('Format silsilah tidak valid');
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
        driveState.currentDriveFileName = context.fileName || 'silsilah-keluarga.json';
        updateDriveUI();
    } else {
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
    showToast(`Berhasil memuat ${appState.nodes.length} anggota keluarga`, 'success');
    return true;
}

document.getElementById('btn-import').addEventListener('click', () => {
    fileImportInput.value = '';
    fileImportInput.click();
});

fileImportInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            importJsonText(ev.target.result, { source: 'local' });
        } catch (err) {
            showToast('File JSON tidak valid atau rusak', 'error');
        }
    };
    reader.readAsText(file);
});

