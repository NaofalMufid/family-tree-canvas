// ============================================================================
// 11D. GOOGLE DRIVE (GIS OAUTH2 + PICKER + DRIVE REST API V3)
// ============================================================================
function updateDriveUI() {
    const hasFile = Boolean(driveState.currentDriveFileId && driveState.currentDriveFileName);
    const statusPill = document.getElementById('drive-status-pill');
    const statusText = document.getElementById('drive-status-text');
    const saveMode = document.getElementById('drive-save-mode');
    const saveAsBtn = document.getElementById('btn-drive-save-as');
    const unlinkBtn = document.getElementById('btn-drive-unlink');
    const unlinkDivider = document.getElementById('drive-unlink-divider');

    if (hasFile) {
        localStorage.setItem('ftc_drive_file_id', driveState.currentDriveFileId);
        localStorage.setItem('ftc_drive_file_name', driveState.currentDriveFileName);
    } else {
        localStorage.removeItem('ftc_drive_file_id');
        localStorage.removeItem('ftc_drive_file_name');
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
    if (hasFile) {
        saveAsBtn.classList.remove('hidden');
        saveAsBtn.classList.add('flex');
        unlinkBtn.classList.remove('hidden');
        unlinkBtn.classList.add('flex');
        unlinkDivider.classList.remove('hidden');
    } else {
        saveAsBtn.classList.add('hidden');
        saveAsBtn.classList.remove('flex');
        unlinkBtn.classList.add('hidden');
        unlinkBtn.classList.remove('flex');
        unlinkDivider.classList.add('hidden');
    }
}

function unlinkDriveFile(showNotification = true) {
    driveState.currentDriveFileId = null;
    driveState.currentDriveFileName = null;
    driveState.isSyncing = false;
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

async function beginGoogleDriveSave(forceNewFile = false) {
    try {
        await requestGoogleAccessToken(false);
        openExportJsonModal({ type: 'drive', forceNewFile });
    } catch (error) {
        showToast(t('drive.errPrefix', { message: error.message }), 'error');
    }
}

async function uploadJsonToGoogleDrive(jsonContent, forceNewFile = false) {
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
        const boundary = `family_tree_canvas_${Date.now()}`;
        const metadata = { name: fileName, mimeType: 'application/json' };
        const body = createDriveMultipartBody(metadata, jsonContent, boundary);
        const endpoint = fileId
            ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=multipart&fields=id,name,mimeType`
            : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType';

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
        const projectNumber = GOOGLE_CLIENT_ID.split('-')[0];
        const builder = new google.picker.PickerBuilder()
            .setOAuthToken(token)
            .setDeveloperKey(GOOGLE_API_KEY)
            .addView(docsView)
            .setTitle(t('drive.pickerTitle'))
            .setCallback(async (data) => {
                if (data.action !== google.picker.Action.PICKED) return;
                const file = data.docs?.[0];
                if (!file) return;

                try {
                    const response = await driveFetch(
                        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`
                    );
                    if (!response.ok) {
                        const errorPayload = await response.json().catch(() => ({}));
                        throw new Error(errorPayload?.error?.message || `HTTP ${response.status}`);
                    }
                    const rawText = await response.text();
                    importJsonText(rawText, {
                        source: 'drive',
                        fileId: file.id,
                        fileName: file.name || t('drive.defaultFileName')
                    });
                } catch (error) {
                    showToast(t('drive.errOpenFile', { message: error.message }), 'error');
                }
            });

        if (projectNumber && /^\d+$/.test(projectNumber)) builder.setAppId(projectNumber);
        if (window.location.origin !== 'null') builder.setOrigin(window.location.origin);
        builder.build().setVisible(true);
    } catch (error) {
        showToast(t('drive.errPrefix', { message: error.message }), 'error');
    }
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
document.getElementById('btn-drive-unlink').addEventListener('click', () => {
    closeDriveMenu();
    unlinkDriveFile(true);
});
document.getElementById('btn-drive-quicksync').addEventListener('click', () => beginGoogleDriveSave(false));
updateDriveUI();

