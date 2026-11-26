// ============================================================================
// 11D. GOOGLE DRIVE (GIS OAUTH2 + PICKER + DRIVE REST API V3)
// ============================================================================
function updateDriveUI() {
    const hasFile = Boolean(driveState.currentDriveFileId && driveState.currentDriveFileName);
    const statusPill = document.getElementById('drive-status-pill');
    const statusText = document.getElementById('drive-status-text');
    const saveMode = document.getElementById('drive-save-mode');
    const saveAsBtn = document.getElementById('btn-drive-save-as');
    const shareBtn = document.getElementById('btn-drive-share');
    const copyLinkBtn = document.getElementById('btn-drive-copylink');
    const quickShareBtn = document.getElementById('btn-drive-quickshare');
    const unlinkBtn = document.getElementById('btn-drive-unlink');
    const unlinkDivider = document.getElementById('drive-unlink-divider');

    if (hasFile) {
        localStorage.setItem('ftc_drive_file_id', driveState.currentDriveFileId);
        localStorage.setItem('ftc_drive_file_name', driveState.currentDriveFileName);
        if (driveState.lastKnownModifiedTime) {
            localStorage.setItem('ftc_drive_modified_time', driveState.lastKnownModifiedTime);
        } else {
            localStorage.removeItem('ftc_drive_modified_time');
        }
    } else {
        localStorage.removeItem('ftc_drive_file_id');
        localStorage.removeItem('ftc_drive_file_name');
        localStorage.removeItem('ftc_drive_modified_time');
    }

    if (hasFile || driveState.isSyncing) {
        statusPill.classList.remove('hidden');
        statusPill.classList.add('inline-flex');
        statusText.textContent = driveState.isSyncing
            ? t('drive.statusSyncing', { fileName: driveState.currentDriveFileName || t('drive.newFileFallback') })
            : t('drive.statusSynced', { fileName: driveState.currentDriveFileName });
    } else {
        statusPill.classList.add('hidden');
        statusPill.classList.remove('inline-flex');
    }

    saveMode.textContent = hasFile ? t('toolbar.driveModeOverwrite') : t('toolbar.driveModeNew');
    const toggleMenuButtons = [saveAsBtn, shareBtn, copyLinkBtn, unlinkBtn];
    toggleMenuButtons.forEach((btn) => {
        if (!btn) return;
        btn.classList.toggle('hidden', !hasFile);
        btn.classList.toggle('flex', hasFile);
    });
    if (quickShareBtn) quickShareBtn.classList.toggle('hidden', !hasFile);
    if (unlinkDivider) unlinkDivider.classList.toggle('hidden', !hasFile);
    if (typeof applyReadOnlyState === 'function') applyReadOnlyState();
}

function unlinkDriveFile(showNotification = true) {
    driveState.currentDriveFileId = null;
    driveState.currentDriveFileName = null;
    driveState.lastKnownModifiedTime = null;
    driveState.isSyncing = false;
    appState.isReadOnly = false;
    if (window.location.hash && window.location.hash.startsWith('#drive=')) {
        history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
    if (typeof renderAll === 'function') renderAll();
    updateDriveUI();
    if (showNotification) showToast(t('drive.unlinkedToast'), 'info');
}

function assertGoogleConfig() {
    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes('YOUR_CLIENT_ID')) {
        throw new Error(t('drive.errMissingClientId'));
    }
    if (!GOOGLE_API_KEY || GOOGLE_API_KEY.includes('YOUR_API_KEY')) {
        throw new Error(t('drive.errMissingApiKey'));
    }
}

function requestGoogleAccessToken(forceRefresh = false) {
    return new Promise((resolve, reject) => {
        try {
            assertGoogleConfig();
        } catch (error) {
            reject(error);
            return;
        }

        if (!navigator.onLine) {
            reject(new Error(t('drive.errOffline')));
            return;
        }
        if (!window.google?.accounts?.oauth2) {
            reject(new Error(t('drive.errAuthNotReady')));
            return;
        }

        const tokenIsValid = driveState.accessToken
            && Date.now() < driveState.accessTokenExpiresAt - 60000;
        if (tokenIsValid && !forceRefresh) {
            resolve(driveState.accessToken);
            return;
        }

        driveState.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: DRIVE_SCOPE,
            callback: (response) => {
                if (response.error || !response.access_token) {
                    reject(new Error(response.error_description || t('drive.errAuthCancelled')));
                    return;
                }
                if (!google.accounts.oauth2.hasGrantedAllScopes(response, DRIVE_SCOPE)) {
                    reject(new Error(t('drive.errScopeDenied')));
                    return;
                }
                driveState.accessToken = response.access_token;
                driveState.accessTokenExpiresAt = Date.now() + (Number(response.expires_in) || 3600) * 1000;
                resolve(response.access_token);
            },
            error_callback: (error) => {
                const popupBlocked = error?.type === 'popup_failed_to_open' || error?.type === 'popup_blocked';
                const popupClosed = error?.type === 'popup_closed';
                reject(new Error(popupBlocked
                    ? t('drive.errPopupBlocked')
                    : popupClosed
                        ? t('drive.errPopupClosed')
                        : t('drive.errPopupFailed')));
            }
        });

        driveState.tokenClient.requestAccessToken(forceRefresh ? { prompt: '' } : {});
    });
}

function loadGooglePicker() {
    return new Promise((resolve, reject) => {
        if (driveState.pickerReady && window.google?.picker) {
            resolve();
            return;
        }
        if (!window.gapi) {
            reject(new Error(t('drive.errPickerNotReady')));
            return;
        }
        gapi.load('picker', {
            callback: () => {
                driveState.pickerReady = true;
                resolve();
            },
            onerror: () => reject(new Error(t('drive.errPickerLoadFailed'))),
            timeout: 10000,
            ontimeout: () => reject(new Error(t('drive.errPickerTimeout')))
        });
    });
}

async function driveFetch(url, options = {}, allowRetry = true) {
    const token = await requestGoogleAccessToken(false);
    const response = await fetch(url, {
        ...options,
        headers: {
            ...(options.headers || {}),
            Authorization: `Bearer ${token}`
        }
    });
    if (response.status !== 401 || !allowRetry) return response;

    driveState.accessToken = null;
    driveState.accessTokenExpiresAt = 0;
    const freshToken = await requestGoogleAccessToken(true);
    return fetch(url, {
        ...options,
        headers: {
            ...(options.headers || {}),
            Authorization: `Bearer ${freshToken}`
        }
    });
}

function createDriveMultipartBody(metadata, jsonContent, boundary) {
    return [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        JSON.stringify(metadata),
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        jsonContent,
        `--${boundary}--`,
        ''
    ].join('\r\n');
}

const shareModal = document.getElementById('share-modal');
const shareModalFilename = document.getElementById('share-modal-filename');
const inputShareEmail = document.getElementById('input-share-email');
const selectShareRole = document.getElementById('select-share-role');
const selectShareAnyone = document.getElementById('select-share-anyone');
const sharePermissionsList = document.getElementById('share-permissions-list');
const shareModalError = document.getElementById('share-modal-error');
const linkOpenDriveNative = document.getElementById('link-open-drive-native');

let activeAnyonePermissionId = null;

function closeShareModal() {
    if (shareModal) {
        shareModal.classList.add('hidden');
        shareModal.classList.remove('flex');
    }
}

async function fetchDrivePermissions(fileId) {
    const res = await driveFetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions?fields=permissions(id,emailAddress,role,type,displayName)`
    );
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return Array.isArray(data.permissions) ? data.permissions : [];
}

function renderSharePermissions(permissions) {
    if (!sharePermissionsList || !selectShareAnyone) return;

    const anyonePerm = permissions.find(p => p.type === 'anyone');
    activeAnyonePermissionId = anyonePerm ? anyonePerm.id : null;
    selectShareAnyone.value = anyonePerm ? (anyonePerm.role === 'writer' ? 'writer' : 'reader') : 'off';

    const userPerms = permissions.filter(p => p.type === 'user' || p.type === 'group');
    sharePermissionsList.innerHTML = userPerms.map((perm) => {
        const isOwner = perm.role === 'owner';
        const roleLabel = isOwner
            ? t('modal.shareOwnerBadge')
            : (perm.role === 'writer' ? t('modal.shareRoleEditor') : t('modal.shareRoleViewer'));
        const display = escapeHtml(perm.displayName || perm.emailAddress || perm.id);
        const emailSub = perm.displayName && perm.emailAddress
            ? `<span class="text-[10px] text-slate-400 truncate block">${escapeHtml(perm.emailAddress)}</span>`
            : '';

        return `
            <div class="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200/70">
                <div class="min-w-0 flex-1">
                    <span class="font-medium text-slate-800 truncate block">${display}</span>
                    ${emailSub}
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <span class="px-2 py-0.5 rounded-md text-[10px] font-semibold ${isOwner ? 'bg-indigo-100 text-indigo-700' : 'bg-white border border-slate-200 text-slate-600'}">${escapeHtml(roleLabel)}</span>
                    ${isOwner ? '' : `<button type="button" data-remove-perm="${escapeHtml(perm.id)}" class="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition" title="${escapeHtml(t('modal.shareRemoveTitle'))}">✕</button>`}
                </div>
            </div>
        `;
    }).join('');

    sharePermissionsList.querySelectorAll('[data-remove-perm]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const permId = btn.getAttribute('data-remove-perm');
            if (!permId || !driveState.currentDriveFileId) return;
            try {
                const delRes = await driveFetch(
                    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveState.currentDriveFileId)}/permissions/${encodeURIComponent(permId)}`,
                    { method: 'DELETE' }
                );
                if (!delRes.ok) {
                    const err = await delRes.json().catch(() => ({}));
                    throw new Error(err?.error?.message || `HTTP ${delRes.status}`);
                }
                showToast(t('modal.shareRemovedToast'), 'info');
                const updated = await fetchDrivePermissions(driveState.currentDriveFileId);
                renderSharePermissions(updated);
            } catch (error) {
                showToast(t('drive.errPrefix', { message: error.message }), 'error');
            }
        });
    });
}

async function openGoogleDriveShareDialog() {
    if (!driveState.currentDriveFileId || !shareModal) return;
    try {
        await requestGoogleAccessToken(false);
        if (shareModalFilename) {
            shareModalFilename.textContent = driveState.currentDriveFileName || t('modal.shareSubtitle');
        }
        if (linkOpenDriveNative) {
            linkOpenDriveNative.href = `https://drive.google.com/file/d/${encodeURIComponent(driveState.currentDriveFileId)}/view`;
        }
        if (shareModalError) shareModalError.classList.add('hidden');
        if (inputShareEmail) inputShareEmail.value = '';
        if (sharePermissionsList) {
            sharePermissionsList.innerHTML = `<p class="text-[11px] text-slate-400 py-2">${escapeHtml(t('modal.shareLoading'))}</p>`;
        }

        shareModal.classList.remove('hidden');
        shareModal.classList.add('flex');

        const permissions = await fetchDrivePermissions(driveState.currentDriveFileId);
        renderSharePermissions(permissions);
    } catch (error) {
        showToast(t('drive.errPrefix', { message: error.message }), 'error');
    }
}

if (shareModal) {
    shareModal.addEventListener('pointerdown', (e) => {
        if (e.target === shareModal) closeShareModal();
    });
    document.getElementById('btn-close-share-modal')?.addEventListener('click', closeShareModal);
    document.getElementById('btn-share-copylink')?.addEventListener('click', copyDriveShareLink);

    document.getElementById('btn-share-invite')?.addEventListener('click', async () => {
        const email = (inputShareEmail?.value || '').trim();
        const role = selectShareRole?.value || 'reader';
        if (!email || !email.includes('@')) {
            if (shareModalError) {
                shareModalError.textContent = t('modal.shareEmptyEmail');
                shareModalError.classList.remove('hidden');
            }
            return;
        }
        if (shareModalError) shareModalError.classList.add('hidden');

        try {
            const res = await driveFetch(
                `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveState.currentDriveFileId)}/permissions?sendNotificationEmail=true`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'user', role, emailAddress: email })
                }
            );
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error?.message || `HTTP ${res.status}`);
            }
            if (inputShareEmail) inputShareEmail.value = '';
            showToast(t('modal.shareAddedToast', { email }), 'success');
            const updated = await fetchDrivePermissions(driveState.currentDriveFileId);
            renderSharePermissions(updated);
        } catch (error) {
            if (shareModalError) {
                shareModalError.textContent = error.message;
                shareModalError.classList.remove('hidden');
            }
        }
    });

    selectShareAnyone?.addEventListener('change', async () => {
        if (!driveState.currentDriveFileId) return;
        const targetMode = selectShareAnyone.value;
        try {
            if (activeAnyonePermissionId) {
                await driveFetch(
                    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveState.currentDriveFileId)}/permissions/${encodeURIComponent(activeAnyonePermissionId)}`,
                    { method: 'DELETE' }
                );
                activeAnyonePermissionId = null;
            }
            if (targetMode === 'reader' || targetMode === 'writer') {
                const res = await driveFetch(
                    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveState.currentDriveFileId)}/permissions`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'anyone', role: targetMode })
                    }
                );
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err?.error?.message || `HTTP ${res.status}`);
                }
            }
            showToast(t('modal.shareAnyoneUpdatedToast'), 'success');
            const updated = await fetchDrivePermissions(driveState.currentDriveFileId);
            renderSharePermissions(updated);
        } catch (error) {
            showToast(t('drive.errPrefix', { message: error.message }), 'error');
        }
    });
}

async function copyDriveShareLink() {
    if (!driveState.currentDriveFileId) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}#drive=${encodeURIComponent(driveState.currentDriveFileId)}`;
    try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(shareUrl);
        } else {
            const tempInput = document.createElement('input');
            tempInput.value = shareUrl;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            tempInput.remove();
        }
        showToast(t('drive.linkCopiedToast'), 'success');
    } catch (err) {
        window.prompt(t('toolbar.driveCopyLink'), shareUrl);
    }
}

const conflictModal = document.getElementById('conflict-modal');
let pendingConflictUpload = null;

function openConflictModal({ fileId, jsonContent }) {
    pendingConflictUpload = { fileId, jsonContent };
    if (conflictModal) {
        conflictModal.classList.remove('hidden');
        conflictModal.classList.add('flex');
    }
}

function closeConflictModal() {
    pendingConflictUpload = null;
    if (conflictModal) {
        conflictModal.classList.add('hidden');
        conflictModal.classList.remove('flex');
    }
}

if (conflictModal) {
    conflictModal.addEventListener('pointerdown', (e) => {
        if (e.target === conflictModal) closeConflictModal();
    });
    document.getElementById('btn-conflict-cancel')?.addEventListener('click', closeConflictModal);
    document.getElementById('btn-conflict-reload')?.addEventListener('click', async () => {
        const ctx = pendingConflictUpload;
        closeConflictModal();
        if (ctx?.fileId) {
            await loadFileFromGoogleDriveById(ctx.fileId, { reloadedLatest: true });
        }
    });
    document.getElementById('btn-conflict-overwrite')?.addEventListener('click', async () => {
        const ctx = pendingConflictUpload;
        closeConflictModal();
        if (ctx?.jsonContent) {
            await uploadJsonToGoogleDrive(ctx.jsonContent, false, true);
        }
    });
}

async function fetchDriveFileMetadata(fileId) {
    const response = await driveFetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,modifiedTime,capabilities(canEdit)`
    );
    if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error?.message || `HTTP ${response.status}`);
    }
    return response.json();
}

async function loadFileFromGoogleDriveById(fileId, options = {}) {
    try {
        const metadata = await fetchDriveFileMetadata(fileId);
        const mediaResponse = await driveFetch(
            `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`
        );
        if (!mediaResponse.ok) {
            const errorPayload = await mediaResponse.json().catch(() => ({}));
            throw new Error(errorPayload?.error?.message || `HTTP ${mediaResponse.status}`);
        }
        const rawText = await mediaResponse.text();
        const canEdit = metadata.capabilities ? metadata.capabilities.canEdit !== false : true;

        importJsonText(rawText, {
            source: 'drive',
            fileId: metadata.id || fileId,
            fileName: metadata.name || t('drive.defaultFileName'),
            modifiedTime: metadata.modifiedTime || null,
            canEdit,
            reloadedLatest: Boolean(options.reloadedLatest)
        });
    } catch (error) {
        showToast(t('drive.errOpenFile', { message: error.message }), 'error');
    }
}

async function beginGoogleDriveSave(forceNewFile = false) {
    if (appState.isReadOnly && !forceNewFile) return;
    try {
        await requestGoogleAccessToken(false);
        openExportJsonModal({ type: 'drive', forceNewFile });
    } catch (error) {
        showToast(t('drive.errPrefix', { message: error.message }), 'error');
    }
}

async function uploadJsonToGoogleDrive(jsonContent, forceNewFile = false, skipConflictCheck = false) {
    let fileId = forceNewFile ? null : driveState.currentDriveFileId;
    let fileName = driveState.currentDriveFileName || t('drive.defaultFileName');

    if (!fileId) {
        const requestedName = window.prompt(t('drive.promptFileName'), fileName);
        if (requestedName === null) return;
        fileName = requestedName.trim() || t('drive.defaultFileName');
        if (!fileName.toLowerCase().endsWith('.json')) fileName += '.json';
    }

    driveState.isSyncing = true;
    updateDriveUI();
    try {
        // Deteksi konflik sebelum PATCH jika file sudah ada
        if (fileId && !skipConflictCheck && driveState.lastKnownModifiedTime) {
            const checkRes = await driveFetch(
                `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=modifiedTime`
            );
            if (checkRes.status === 404) {
                unlinkDriveFile(false);
                showToast(t('drive.errOldFileMissing'), 'info');
                return beginGoogleDriveSave(true);
            }
            if (checkRes.ok) {
                const remoteMeta = await checkRes.json();
                if (remoteMeta.modifiedTime && remoteMeta.modifiedTime !== driveState.lastKnownModifiedTime) {
                    driveState.isSyncing = false;
                    updateDriveUI();
                    openConflictModal({ fileId, jsonContent });
                    return;
                }
            }
        }

        const boundary = `family_tree_canvas_${Date.now()}`;
        const metadata = { name: fileName, mimeType: 'application/json' };
        const body = createDriveMultipartBody(metadata, jsonContent, boundary);
        const endpoint = fileId
            ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=multipart&fields=id,name,mimeType,modifiedTime,capabilities(canEdit)`
            : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,capabilities(canEdit)';

        const response = await driveFetch(endpoint, {
            method: fileId ? 'PATCH' : 'POST',
            headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
            body
        });

        if (response.status === 404 && fileId) {
            unlinkDriveFile(false);
            showToast(t('drive.errOldFileMissing'), 'info');
            return beginGoogleDriveSave(true);
        }
        if (!response.ok) {
            const errorPayload = await response.json().catch(() => ({}));
            throw new Error(errorPayload?.error?.message || t('drive.errSaveHttp', { status: response.status }));
        }

        const savedFile = await response.json();
        driveState.currentDriveFileId = savedFile.id;
        driveState.currentDriveFileName = savedFile.name || fileName;
        driveState.lastKnownModifiedTime = savedFile.modifiedTime || null;
        appState.isReadOnly = savedFile.capabilities ? savedFile.capabilities.canEdit === false : false;
        if (typeof renderAll === 'function') renderAll();
        showToast(t('drive.savedToast', { fileName: driveState.currentDriveFileName }), 'success');
    } finally {
        driveState.isSyncing = false;
        updateDriveUI();
    }
}

async function openFromGoogleDrive() {
    try {
        const token = await requestGoogleAccessToken(false);
        await loadGooglePicker();

        const docsView = new google.picker.DocsView(google.picker.ViewId.DOCS)
            .setMimeTypes('application/json')
            .setIncludeFolders(true)
            .setSelectFolderEnabled(false);
        const builder = new google.picker.PickerBuilder()
            .setOAuthToken(token)
            .setDeveloperKey(GOOGLE_API_KEY)
            .addView(docsView)
            .setTitle(t('drive.pickerTitle'))
            .setCallback(async (data) => {
                if (data.action !== google.picker.Action.PICKED) return;
                const file = data.docs?.[0];
                if (!file) return;
                await loadFileFromGoogleDriveById(file.id);
            });

        if (GOOGLE_APP_ID) builder.setAppId(GOOGLE_APP_ID);
        if (window.location.origin !== 'null') builder.setOrigin(window.location.origin);
        builder.build().setVisible(true);
    } catch (error) {
        showToast(t('drive.errPrefix', { message: error.message }), 'error');
    }
}

function extractDriveIdFromHash() {
    const hash = window.location.hash || '';
    if (!hash.startsWith('#drive=')) return null;
    const rawId = decodeURIComponent(hash.slice('#drive='.length)).trim();
    return rawId || null;
}

function checkAndLoadDriveHash() {
    const driveFileId = extractDriveIdFromHash();
    if (!driveFileId) return false;
    loadFileFromGoogleDriveById(driveFileId);
    return true;
}

const driveMenuButton = document.getElementById('btn-drive-menu');
const driveDropdown = document.getElementById('drive-dropdown');
const fileMenuButton = document.getElementById('btn-file-menu');
const fileDropdown = document.getElementById('file-dropdown');

function closeDriveMenu() {
    driveDropdown.classList.add('hidden');
    driveMenuButton.setAttribute('aria-expanded', 'false');
}

function closeFileMenu() {
    fileDropdown.classList.add('hidden');
    fileMenuButton.setAttribute('aria-expanded', 'false');
}

function closeToolbarMenus() {
    closeDriveMenu();
    closeFileMenu();
}

driveMenuButton.addEventListener('click', (event) => {
    event.stopPropagation();
    const willOpen = driveDropdown.classList.contains('hidden');
    closeFileMenu();
    driveDropdown.classList.toggle('hidden');
    driveMenuButton.setAttribute('aria-expanded', String(willOpen));
});
fileMenuButton.addEventListener('click', (event) => {
    event.stopPropagation();
    const willOpen = fileDropdown.classList.contains('hidden');
    closeDriveMenu();
    fileDropdown.classList.toggle('hidden');
    fileMenuButton.setAttribute('aria-expanded', String(willOpen));
});
driveDropdown.addEventListener('click', (event) => event.stopPropagation());
fileDropdown.addEventListener('click', (event) => {
    event.stopPropagation();
    if (event.target.closest('[role="menuitem"]')) closeFileMenu();
});
document.addEventListener('click', closeToolbarMenus);
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeToolbarMenus();
});
document.getElementById('btn-drive-save').addEventListener('click', () => {
    closeDriveMenu();
    beginGoogleDriveSave(false);
});
document.getElementById('btn-drive-save-as').addEventListener('click', () => {
    closeDriveMenu();
    beginGoogleDriveSave(true);
});
document.getElementById('btn-drive-open').addEventListener('click', () => {
    closeDriveMenu();
    openFromGoogleDrive();
});
document.getElementById('btn-drive-share')?.addEventListener('click', () => {
    closeDriveMenu();
    openGoogleDriveShareDialog();
});
document.getElementById('btn-drive-copylink')?.addEventListener('click', () => {
    closeDriveMenu();
    copyDriveShareLink();
});
document.getElementById('btn-drive-quickshare')?.addEventListener('click', openGoogleDriveShareDialog);
document.getElementById('btn-drive-unlink').addEventListener('click', () => {
    closeDriveMenu();
    unlinkDriveFile(true);
});
document.getElementById('btn-drive-quicksync').addEventListener('click', () => beginGoogleDriveSave(false));
window.addEventListener('hashchange', checkAndLoadDriveHash);
updateDriveUI();

