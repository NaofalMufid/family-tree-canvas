// ============================================================================
// MODUL INTERNASIONALISASI (i18n) — 100% CLIENT-SIDE & EXTENSIBLE
// ============================================================================
// Cara menambah bahasa baru (untuk kontributor):
// 1. Tambahkan 1 objek bahasa ke array SUPPORTED_LANGUAGES di bawah ini.
// 2. Salin 1 blok bahasa di objek `translations` (misal dari `en`), lalu
//    terjemahkan seluruh nilainya tanpa mengubah nama key.
// ============================================================================

const SUPPORTED_LANGUAGES = [
    { code: 'id', label: 'Indonesia', short: 'ID', dir: 'ltr' },
    { code: 'en', label: 'English', short: 'EN', dir: 'ltr' }
];

const translations = {
    id: {
        app: {
            pageTitle: 'Family Tree Canvas — Silsilah Keluarga',
            title: 'Kanvas Silsilah Keluarga',
            watermark: 'Family Tree Canvas • Local-First & Privat'
        },
        header: {
            savedLocal: 'Tersimpan lokal',
            saving: 'Menyimpan...',
            memberCount: '{count} anggota',
            viewOnlyBadge: '👁️ Mode Lihat Saja (View Only)'
        },
        toolbar: {
            searchTitle: 'Cari Anggota (Ctrl/Cmd + K)',
            searchAria: 'Cari anggota keluarga',
            addMember: '+ Anggota',
            addMemberTitle: 'Tambah Anggota Keluarga Baru',
            autoLayout: 'Auto-Layout',
            autoLayoutTitle: 'Auto-Layout (Rapikan Posisi)',
            autoLayoutAria: 'Auto-Layout posisi hierarki otomatis',
            drive: 'Drive',
            driveTitle: 'Simpan atau buka dari Google Drive',
            file: 'File',
            fileTitle: 'File, Import, dan Export',
            installApp: 'Install App',
            installAppTitle: 'Install App ke perangkat untuk akses offline instan',
            languageTitle: 'Pilih bahasa',
            languageAria: 'Pilih bahasa',
            driveSave: 'Simpan ke Drive',
            driveModeNew: 'Baru',
            driveModeOverwrite: 'Timpa',
            driveSaveAs: 'Simpan sebagai file baru',
            driveOpen: 'Buka dari Drive',
            driveShare: 'Bagikan (Share)',
            driveCopyLink: 'Salin Tautan',
            driveUnlink: 'Lepas tautan file',
            exportPng: 'Export PNG HD',
            exportJson: 'Export JSON',
            importJson: 'Import JSON',
            loadSample: 'Muat Contoh 3 Generasi',
            resetCanvas: 'Reset Canvas'
        },
        zoom: {
            zoomOutTitle: 'Perkecil (Zoom Out)',
            zoomInTitle: 'Perbesar (Zoom In)',
            resetView: 'Reset View',
            resetViewTitle: 'Pusatkan Pohon (Fit to Screen)'
        },
        privacy: {
            title: 'Arsitektur Local-First & Privat',
            subtitle: 'Zero-Backend • Offline-Ready',
            closeTitle: 'Tutup',
            item1Title: 'Zero Server Database:',
            item1Desc: 'Semua data silsilah dan foto hanya diproses dan disimpan di memori browser perangkat Anda.',
            item2Title: 'Tanpa Tracking / Analytics:',
            item2Desc: 'Tidak ada telemetri. Data hanya dikirim ke Google Drive ketika Anda memilih aksi simpan atau buka.',
            item3Title: 'Kendali Penuh:',
            item3Desc: 'Backup lokal maupun file di Google Drive pribadi sepenuhnya berada dalam kendali Anda.',
            controlsHint: 'Geser: Drag area kosong • Zoom: Scroll',
            policyLink: 'Kebijakan Privasi →',
            badgePrefix: '🔒 Zero-Database • Data Hanya di Browser & Google Drive Anda'
        },
        pwa: {
            offlineBadge: '⚡ Mode Offline • Data aman tersimpan lokal'
        },
        node: {
            genderMale: 'Laki-laki',
            genderFemale: 'Perempuan',
            genderNeutral: 'Netral',
            toggleGenderTitle: 'Klik untuk mengubah warna/gender',
            deleteTitle: 'Hapus anggota ini',
            uploadAvatarTitle: 'Klik untuk mengunggah foto profil',
            namePlaceholder: 'Nama lengkap...',
            yearsPlaceholder: 'Tahun lahir - wafat...',
            rolePlaceholder: 'Peran / catatan singkat...',
            addParent: '+ Orang Tua',
            addParentTitle: 'Tambah orang tua di atasnya',
            addSpouse: '+ Pasangan',
            addSpouseTitle: 'Tambah pasangan di sampingnya',
            addChild: '+ Anak',
            addChildTitle: 'Tambah anak di bawahnya',
            untitled: 'Tanpa Nama',
            newMemberName: 'Anggota Baru',
            newMemberRole: 'Klik untuk mengisi catatan',
            newParentName: 'Orang Tua Baru',
            newSpouseName: 'Pasangan Baru',
            newChildName: 'Anak Baru',
            relationParent: 'Orang Tua',
            relationSpouse: 'Pasangan',
            relationChild: 'Anak',
            resetInitialName: 'Kepala Keluarga',
            resetInitialYears: '1980 - Sekarang',
            resetInitialRole: 'Klik untuk mengedit nama & foto'
        },
        modal: {
            confirmTitle: 'Konfirmasi Tindakan',
            confirmMessage: 'Apakah Anda yakin ingin melanjutkan?',
            confirmCancel: 'Batal',
            confirmOk: 'Ya, Lanjutkan',
            pngTitle: 'Export PNG HD',
            pngSubtitle: 'Auto-crop seluruh pohon • Resolusi Retina 2x',
            pngBgLabel: 'Pilih Latar Belakang Gambar:',
            pngBgWhiteTitle: 'Putih Bersih',
            pngBgWhiteDesc: 'Siap cetak / dokumen',
            pngBgGridTitle: 'Grid Titik Tipis',
            pngBgGridDesc: 'Gaya kanvas modern',
            pngDownloadBtn: 'Unduh PNG HD',
            jsonTitleDownload: 'Export Data Silsilah (JSON)',
            jsonDescDownload: 'Termasuk seluruh anggota, relasi, & foto',
            jsonTitleDrive: 'Simpan ke Google Drive',
            jsonDescDrive: 'Pilih apakah file Google Drive akan dilindungi password',
            jsonEncryptToggle: 'Kunci file dengan Password (Opsional)',
            jsonEncryptDescDownload: 'Enkripsi lokal AES-GCM 256-bit sebelum diunduh',
            jsonEncryptDescDrive: 'Enkripsi lokal AES-GCM 256-bit sebelum diunggah',
            jsonPwdLabel: 'Buat Password File:',
            jsonPwdPlaceholder: 'Masukkan password...',
            jsonTogglePwdTitle: 'Tampilkan/Sembunyikan Password',
            jsonDownloadBtn: 'Unduh JSON',
            jsonDriveSaveBtn: 'Simpan ke Drive',
            jsonEncryptDownloadBtn: 'Enkripsi & Unduh',
            jsonEncryptSaveBtn: 'Enkripsi & Simpan',
            jsonPwdMinError: 'Masukkan password minimal 4 karakter.',
            jsonPrepareError: 'Gagal menyiapkan file JSON di browser.',
            decryptTitle: 'File Silsilah Terkunci',
            decryptSubtitle: 'Masukkan password untuk mendekripsi di browser',
            decryptPwdLabel: 'Password File JSON:',
            decryptPwdPlaceholder: 'Masukkan password file...',
            decryptDefaultError: 'Password salah atau file rusak',
            decryptEmptyError: 'Silakan masukkan password terlebih dahulu.',
            decryptFailedError: 'Password salah atau file rusak. Data Canvas saat ini tetap aman.',
            decryptSubmitBtn: 'Buka & Muat Silsilah',
            conflictTitle: 'Konflik Versi Google Drive',
            conflictMessage: 'File di Google Drive telah diperbarui oleh pengguna lain sejak terakhir kali Anda buka. Pilih tindakan untuk menghindari kehilangan data:',
            conflictReload: 'Muat Versi Terbaru',
            conflictOverwrite: 'Tetap Timpa (Overwrite)',
            shareTitle: 'Bagikan Silsilah (Google Drive)',
            shareSubtitle: 'Undang kerabat atau salin tautan langsung',
            shareEmailLabel: 'Undang via Email Google:',
            shareEmailPlaceholder: 'nama@gmail.com',
            shareRoleViewer: 'Viewer (Lihat Saja)',
            shareRoleEditor: 'Editor (Bisa Edit)',
            shareAddBtn: 'Undang',
            shareAnyoneLabel: 'Akses Tautan Umum:',
            shareAnyoneOff: 'Terbatas (Hanya yang diundang)',
            shareAnyoneViewer: 'Siapa saja dengan tautan (Viewer)',
            shareAnyoneEditor: 'Siapa saja dengan tautan (Editor)',
            sharePeopleTitle: 'Orang dengan akses:',
            shareOwnerBadge: 'Pemilik',
            shareRemoveTitle: 'Cabut akses',
            shareCopyLinkBtn: 'Salin Tautan Aplikasi',
            shareOpenDriveLink: 'Buka di Google Drive ↗',
            shareLoading: 'Memuat daftar akses...',
            shareEmptyEmail: 'Masukkan alamat email yang valid.',
            shareAddedToast: 'Akses dibagikan ke {email}',
            shareRemovedToast: 'Akses dicabut',
            shareAnyoneUpdatedToast: 'Pengaturan akses tautan diperbarui'
        },
        search: {
            placeholder: 'Cari nama lengkap, tahun lahir/wafat, atau peran...',
            clearTitle: 'Hapus teks',
            closeTitle: 'Tutup (Esc)',
            navSelect: 'Pilih',
            navFocus: 'Fokus ke Kartu',
            countFiltered: '{filtered} dari {total} anggota',
            countAvailable: '{total} anggota tersedia',
            emptyTitle: 'Anggota keluarga tidak ditemukan',
            emptySubtitle: 'Coba kata kunci nama, tahun lahir, atau peran lainnya.',
            childOf: 'Anak dari {parents}',
            spouseOf: 'Pasangan dari {spouse}',
            parentOf: 'Orang tua dari {children}',
            parentOfExtra: ' +{count} lainnya',
            standalone: 'Anggota keluarga mandiri'
        },
        drive: {
            statusDefault: '☁️ Tersimpan di Google Drive',
            statusSyncing: '⏳ Menyimpan ke Google Drive: {fileName}...',
            statusSynced: '☁️ Tersimpan di Google Drive: {fileName}',
            newFileFallback: 'file baru',
            quickSyncTitle: 'Simpan ulang ke file Google Drive yang terhubung',
            quickSyncBtn: 'Sync',
            shareBtnTitle: 'Bagikan akses file Google Drive',
            copyLinkBtnTitle: 'Salin tautan langsung ke silsilah ini',
            linkCopiedToast: 'Tautan silsilah berhasil disalin',
            unlinkedToast: 'Tautan file Google Drive dilepas',
            errMissingClientId: 'GOOGLE_CLIENT_ID belum diisi di google-config.js.',
            errMissingApiKey: 'GOOGLE_API_KEY belum diisi di google-config.js.',
            errMissingAppId: 'GOOGLE_APP_ID tidak valid pada google-config.js.',
            errOffline: 'Google Drive memerlukan koneksi internet. Data lokal tetap aman.',
            errAuthNotReady: 'Layanan login Google belum siap. Periksa koneksi lalu coba lagi.',
            errAuthCancelled: 'Login Google dibatalkan.',
            errScopeDenied: 'Izin akses file Google Drive tidak diberikan.',
            errPopupBlocked: 'Pop-up login diblokir browser. Izinkan pop-up lalu coba lagi.',
            errPopupClosed: 'Jendela login Google ditutup sebelum proses selesai.',
            errPopupFailed: 'Jendela login Google gagal dibuka.',
            errPickerNotReady: 'Google Picker belum siap. Periksa koneksi lalu coba lagi.',
            errPickerLoadFailed: 'Google Picker gagal dimuat.',
            errPickerTimeout: 'Google Picker terlalu lama merespons.',
            errShareLoadFailed: 'Dialog Bagikan Google Drive gagal dimuat.',
            promptFileName: 'Nama file di Google Drive:',
            defaultFileName: 'silsilah-keluarga.json',
            errOldFileMissing: 'File Google Drive lama tidak ditemukan. Simpan kembali sebagai file baru.',
            errSaveHttp: 'Gagal menyimpan (HTTP {status}).',
            savedToast: 'Tersimpan di Google Drive: {fileName}',
            loadedViewOnlyToast: 'Dibuka dalam mode Lihat Saja (View Only): {fileName}',
            reloadedLatestToast: 'Versi terbaru dari Google Drive berhasil dimuat',
            pickerTitle: 'Pilih File Silsilah (JSON) dari Google Drive',
            errOpenFile: 'Gagal membuka file Google Drive: {message}',
            errPrefix: 'Google Drive: {message}'
        },
        alerts: {
            memberAdded: 'Anggota keluarga baru ditambahkan',
            relationAdded: '{relation} ditambahkan',
            memberDeleted: 'Anggota keluarga dihapus',
            avatarUpdated: 'Foto profil dikompresi & diperbarui',
            layoutTidied: 'Posisi pohon silsilah dirapikan',
            exportEmptyCanvas: 'Canvas masih kosong, tidak ada yang dapat di-export',
            pngHdDownloaded: 'Gambar PNG HD (2x) berhasil diunduh',
            pngDownloaded: 'Gambar PNG berhasil diunduh',
            jsonEncryptedDownloaded: 'File JSON terenkripsi AES-256 berhasil diunduh',
            jsonDownloaded: 'File silsilah JSON berhasil diunduh',
            jsonDecryptedLoaded: 'File terenkripsi berhasil dibuka dan dimuat',
            jsonImportSuccess: 'Berhasil memuat {count} anggota keluarga',
            jsonInvalidFile: 'File JSON tidak valid atau rusak',
            jsonInvalidFormat: 'Format silsilah tidak valid',
            encryptedInvalidStructure: 'Struktur file terenkripsi tidak valid',
            loadSampleTitle: 'Muat Contoh Keluarga 3 Generasi?',
            loadSampleMessage: 'Data Canvas saat ini akan diganti dengan contoh silsilah 3 generasi.',
            loadSampleConfirm: 'Muat Contoh',
            loadSampleSuccess: 'Contoh silsilah 3 generasi berhasil dimuat',
            resetTitle: 'Mulai Silsilah Baru dari Kosong?',
            resetMessage: 'Semua kartu di Canvas akan dihapus dan diganti dengan 1 kartu awal untuk Anda mulai.',
            resetConfirm: 'Reset Canvas',
            resetSuccess: 'Canvas di-reset ke 1 kartu awal'
        }
    },

    en: {
        app: {
            pageTitle: 'Family Tree Canvas — Family Tree Builder',
            title: 'Family Tree Canvas',
            watermark: 'Family Tree Canvas • Local-First & Private'
        },
        header: {
            savedLocal: 'Saved locally',
            saving: 'Saving...',
            memberCount: '{count} members',
            viewOnlyBadge: '👁️ View Only'
        },
        toolbar: {
            searchTitle: 'Search Members (Ctrl/Cmd + K)',
            searchAria: 'Search family members',
            addMember: '+ Member',
            addMemberTitle: 'Add New Family Member',
            autoLayout: 'Auto-Layout',
            autoLayoutTitle: 'Auto-Layout (Tidy Positions)',
            autoLayoutAria: 'Automatically arrange tree hierarchy',
            drive: 'Drive',
            driveTitle: 'Save to or open from Google Drive',
            file: 'File',
            fileTitle: 'File, Import, and Export',
            installApp: 'Install App',
            installAppTitle: 'Install App on your device for instant offline access',
            languageTitle: 'Select language',
            languageAria: 'Select language',
            driveSave: 'Save to Drive',
            driveModeNew: 'New',
            driveModeOverwrite: 'Overwrite',
            driveSaveAs: 'Save as new file',
            driveOpen: 'Open from Drive',
            driveShare: 'Share',
            driveCopyLink: 'Copy Link',
            driveUnlink: 'Unlink file',
            exportPng: 'Export HD PNG',
            exportJson: 'Export JSON',
            importJson: 'Import JSON',
            loadSample: 'Load 3-Generation Sample',
            resetCanvas: 'Reset Canvas'
        },
        zoom: {
            zoomOutTitle: 'Zoom Out',
            zoomInTitle: 'Zoom In',
            resetView: 'Reset View',
            resetViewTitle: 'Center Tree (Fit to Screen)'
        },
        privacy: {
            title: 'Local-First & Private Architecture',
            subtitle: 'Zero-Backend • Offline-Ready',
            closeTitle: 'Close',
            item1Title: 'Zero Server Database:',
            item1Desc: 'All family tree data and photos are processed and stored locally in your device browser memory.',
            item2Title: 'No Tracking / Analytics:',
            item2Desc: 'Zero telemetry. Data is only sent to Google Drive when you explicitly choose to save or open.',
            item3Title: 'Full Control:',
            item3Desc: 'Both local backups and files in your personal Google Drive remain completely under your control.',
            controlsHint: 'Pan: Drag empty area • Zoom: Scroll',
            policyLink: 'Privacy Policy →',
            badgePrefix: '🔒 Zero-Database • Data Only in Your Browser & Google Drive'
        },
        pwa: {
            offlineBadge: '⚡ Offline Mode • Data safely stored locally'
        },
        node: {
            genderMale: 'Male',
            genderFemale: 'Female',
            genderNeutral: 'Neutral',
            toggleGenderTitle: 'Click to change color/gender',
            deleteTitle: 'Delete this member',
            uploadAvatarTitle: 'Click to upload profile photo',
            namePlaceholder: 'Full name...',
            yearsPlaceholder: 'Birth - death years...',
            rolePlaceholder: 'Role / short note...',
            addParent: '+ Parent',
            addParentTitle: 'Add parent above',
            addSpouse: '+ Spouse',
            addSpouseTitle: 'Add spouse beside',
            addChild: '+ Child',
            addChildTitle: 'Add child below',
            untitled: 'Unnamed',
            newMemberName: 'New Member',
            newMemberRole: 'Click to add note',
            newParentName: 'New Parent',
            newSpouseName: 'New Spouse',
            newChildName: 'New Child',
            relationParent: 'Parent',
            relationSpouse: 'Spouse',
            relationChild: 'Child',
            resetInitialName: 'Head of Family',
            resetInitialYears: '1980 - Present',
            resetInitialRole: 'Click to edit name & photo'
        },
        modal: {
            confirmTitle: 'Confirm Action',
            confirmMessage: 'Are you sure you want to continue?',
            confirmCancel: 'Cancel',
            confirmOk: 'Yes, Continue',
            pngTitle: 'Export HD PNG',
            pngSubtitle: 'Auto-crop entire tree • 2x Retina Resolution',
            pngBgLabel: 'Choose Image Background:',
            pngBgWhiteTitle: 'Clean White',
            pngBgWhiteDesc: 'Print & document ready',
            pngBgGridTitle: 'Subtle Dot Grid',
            pngBgGridDesc: 'Modern canvas style',
            pngDownloadBtn: 'Download HD PNG',
            jsonTitleDownload: 'Export Family Tree Data (JSON)',
            jsonDescDownload: 'Includes all members, relations, & photos',
            jsonTitleDrive: 'Save to Google Drive',
            jsonDescDrive: 'Choose whether to protect your Google Drive file with a password',
            jsonEncryptToggle: 'Lock file with Password (Optional)',
            jsonEncryptDescDownload: 'Local AES-GCM 256-bit encryption before download',
            jsonEncryptDescDrive: 'Local AES-GCM 256-bit encryption before upload',
            jsonPwdLabel: 'Create File Password:',
            jsonPwdPlaceholder: 'Enter password...',
            jsonTogglePwdTitle: 'Show/Hide Password',
            jsonDownloadBtn: 'Download JSON',
            jsonDriveSaveBtn: 'Save to Drive',
            jsonEncryptDownloadBtn: 'Encrypt & Download',
            jsonEncryptSaveBtn: 'Encrypt & Save',
            jsonPwdMinError: 'Please enter a password of at least 4 characters.',
            jsonPrepareError: 'Failed to prepare JSON file in browser.',
            decryptTitle: 'Locked Family Tree File',
            decryptSubtitle: 'Enter password to decrypt in browser',
            decryptPwdLabel: 'JSON File Password:',
            decryptPwdPlaceholder: 'Enter file password...',
            decryptDefaultError: 'Incorrect password or corrupted file',
            decryptEmptyError: 'Please enter a password first.',
            decryptFailedError: 'Incorrect password or corrupted file. Your current Canvas data remains safe.',
            decryptSubmitBtn: 'Unlock & Load Tree',
            conflictTitle: 'Google Drive Version Conflict',
            conflictMessage: 'This file was updated on Google Drive by someone else since you last opened it. Choose how to proceed to avoid losing data:',
            conflictReload: 'Load Latest Version',
            conflictOverwrite: 'Overwrite Anyway',
            shareTitle: 'Share Family Tree (Google Drive)',
            shareSubtitle: 'Invite relatives or copy a direct link',
            shareEmailLabel: 'Invite via Google Email:',
            shareEmailPlaceholder: 'name@gmail.com',
            shareRoleViewer: 'Viewer (View Only)',
            shareRoleEditor: 'Editor (Can Edit)',
            shareAddBtn: 'Invite',
            shareAnyoneLabel: 'General Link Access:',
            shareAnyoneOff: 'Restricted (Invited only)',
            shareAnyoneViewer: 'Anyone with the link (Viewer)',
            shareAnyoneEditor: 'Anyone with the link (Editor)',
            sharePeopleTitle: 'People with access:',
            shareOwnerBadge: 'Owner',
            shareRemoveTitle: 'Remove access',
            shareCopyLinkBtn: 'Copy App Link',
            shareOpenDriveLink: 'Open in Google Drive ↗',
            shareLoading: 'Loading access list...',
            shareEmptyEmail: 'Please enter a valid email address.',
            shareAddedToast: 'Access shared with {email}',
            shareRemovedToast: 'Access removed',
            shareAnyoneUpdatedToast: 'Link access updated'
        },
        search: {
            placeholder: 'Search full name, birth/death year, or role...',
            clearTitle: 'Clear text',
            closeTitle: 'Close (Esc)',
            navSelect: 'Select',
            navFocus: 'Focus on Card',
            countFiltered: '{filtered} of {total} members',
            countAvailable: '{total} members available',
            emptyTitle: 'No family members found',
            emptySubtitle: 'Try searching by name, birth year, or role.',
            childOf: 'Child of {parents}',
            spouseOf: 'Spouse of {spouse}',
            parentOf: 'Parent of {children}',
            parentOfExtra: ' +{count} more',
            standalone: 'Standalone member'
        },
        drive: {
            statusDefault: '☁️ Saved to Google Drive',
            statusSyncing: '⏳ Saving to Google Drive: {fileName}...',
            statusSynced: '☁️ Saved to Google Drive: {fileName}',
            newFileFallback: 'new file',
            quickSyncTitle: 'Re-save to connected Google Drive file',
            quickSyncBtn: 'Sync',
            shareBtnTitle: 'Share Google Drive file access',
            copyLinkBtnTitle: 'Copy direct link to this family tree',
            linkCopiedToast: 'Family tree link copied to clipboard',
            unlinkedToast: 'Google Drive file unlinked',
            errMissingClientId: 'GOOGLE_CLIENT_ID is not set in google-config.js.',
            errMissingApiKey: 'GOOGLE_API_KEY is not set in google-config.js.',
            errMissingAppId: 'GOOGLE_APP_ID is invalid in google-config.js.',
            errOffline: 'Google Drive requires an internet connection. Local data remains safe.',
            errAuthNotReady: 'Google sign-in service is not ready. Check your connection and try again.',
            errAuthCancelled: 'Google sign-in was cancelled.',
            errScopeDenied: 'Google Drive file access permission was not granted.',
            errPopupBlocked: 'Sign-in pop-up was blocked by your browser. Allow pop-ups and try again.',
            errPopupClosed: 'Google sign-in window was closed before completion.',
            errPopupFailed: 'Failed to open Google sign-in window.',
            errPickerNotReady: 'Google Picker is not ready. Check your connection and try again.',
            errPickerLoadFailed: 'Failed to load Google Picker.',
            errPickerTimeout: 'Google Picker timed out.',
            errShareLoadFailed: 'Failed to load Google Drive Share dialog.',
            promptFileName: 'File name in Google Drive:',
            defaultFileName: 'family-tree.json',
            errOldFileMissing: 'Previous Google Drive file was not found. Save again as a new file.',
            errSaveHttp: 'Failed to save (HTTP {status}).',
            savedToast: 'Saved to Google Drive: {fileName}',
            loadedViewOnlyToast: 'Opened in View Only mode: {fileName}',
            reloadedLatestToast: 'Latest version loaded from Google Drive',
            pickerTitle: 'Select Family Tree File (JSON) from Google Drive',
            errOpenFile: 'Failed to open Google Drive file: {message}',
            errPrefix: 'Google Drive: {message}'
        },
        alerts: {
            memberAdded: 'New family member added',
            relationAdded: '{relation} added',
            memberDeleted: 'Family member deleted',
            avatarUpdated: 'Profile photo compressed & updated',
            layoutTidied: 'Family tree layout tidied',
            exportEmptyCanvas: 'Canvas is empty, nothing to export',
            pngHdDownloaded: 'HD PNG image (2x) downloaded',
            pngDownloaded: 'PNG image downloaded',
            jsonEncryptedDownloaded: 'AES-256 encrypted JSON file downloaded',
            jsonDownloaded: 'Family tree JSON file downloaded',
            jsonDecryptedLoaded: 'Encrypted file unlocked and loaded',
            jsonImportSuccess: 'Successfully loaded {count} family members',
            jsonInvalidFile: 'Invalid or corrupted JSON file',
            jsonInvalidFormat: 'Invalid family tree format',
            encryptedInvalidStructure: 'Invalid encrypted file structure',
            loadSampleTitle: 'Load 3-Generation Sample Family?',
            loadSampleMessage: 'Your current Canvas data will be replaced with a 3-generation sample family tree.',
            loadSampleConfirm: 'Load Sample',
            loadSampleSuccess: '3-generation sample family tree loaded',
            resetTitle: 'Start a New Blank Family Tree?',
            resetMessage: 'All cards on the Canvas will be removed and replaced with 1 starter card.',
            resetConfirm: 'Reset Canvas',
            resetSuccess: 'Canvas reset to 1 starter card'
        }
    }
};

function getLanguageConfig(langCode) {
    return SUPPORTED_LANGUAGES.find(lang => lang.code === langCode) || null;
}

function detectInitialLanguage() {
    try {
        const saved = localStorage.getItem('lang');
        if (saved && getLanguageConfig(saved)) return saved;
    } catch (e) {
        // Ignore storage errors
    }

    const browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
    if (browserLang.startsWith('id')) {
        return getLanguageConfig('id') ? 'id' : SUPPORTED_LANGUAGES[0].code;
    }
    return getLanguageConfig('en') ? 'en' : SUPPORTED_LANGUAGES[0].code;
}

let currentLang = detectInitialLanguage();

function resolveTranslationKey(langCode, key) {
    const dict = translations[langCode];
    if (!dict) return undefined;
    if (Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];

    const parts = key.split('.');
    let cursor = dict;
    for (let i = 0; i < parts.length; i++) {
        if (cursor && typeof cursor === 'object' && Object.prototype.hasOwnProperty.call(cursor, parts[i])) {
            cursor = cursor[parts[i]];
        } else {
            return undefined;
        }
    }
    return typeof cursor === 'string' ? cursor : undefined;
}

function t(key, params = {}) {
    let text = resolveTranslationKey(currentLang, key);
    if (text === undefined && currentLang !== 'en') {
        text = resolveTranslationKey('en', key);
    }
    if (text === undefined) {
        text = key;
    }

    return String(text).replace(/\{(\w+)\}/g, (match, token) => {
        return Object.prototype.hasOwnProperty.call(params, token) ? params[token] : match;
    });
}

function populateLanguageSwitcher() {
    const switcher = document.getElementById('lang-switcher');
    if (!switcher) return;

    switcher.innerHTML = SUPPORTED_LANGUAGES
        .map(lang => `<option value="${lang.code}">${lang.short}</option>`)
        .join('');
    switcher.value = currentLang;

    if (!switcher.dataset.i18nBound) {
        switcher.addEventListener('change', (e) => {
            setLanguage(e.target.value);
        });
        switcher.dataset.i18nBound = 'true';
    }
}

function applyTranslations() {
    const langMeta = getLanguageConfig(currentLang) || { code: currentLang, dir: 'ltr' };
    document.documentElement.lang = langMeta.code;
    document.documentElement.dir = langMeta.dir || 'ltr';
    document.title = t('app.pageTitle');

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key) el.textContent = t(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key) el.setAttribute('placeholder', t(key));
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (key) el.setAttribute('title', t(key));
    });

    document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
        const key = el.getAttribute('data-i18n-aria-label');
        if (key) el.setAttribute('aria-label', t(key));
    });

    const switcher = document.getElementById('lang-switcher');
    if (switcher && switcher.value !== currentLang) {
        switcher.value = currentLang;
    }

    if (typeof renderAll === 'function') {
        renderAll();
    }
    if (typeof updateDriveUI === 'function') {
        updateDriveUI();
    }
    if (typeof isSearchPaletteOpen === 'function' && isSearchPaletteOpen() && typeof renderSearchResults === 'function') {
        const searchInput = document.getElementById('search-palette-input');
        renderSearchResults(searchInput ? searchInput.value : '');
    }
}

function setLanguage(langCode) {
    const config = getLanguageConfig(langCode);
    if (!config) return;
    currentLang = config.code;
    try {
        localStorage.setItem('lang', currentLang);
    } catch (e) {
        // Ignore storage errors
    }
    applyTranslations();
}

window.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;
window.translations = translations;
window.t = t;
window.setLanguage = setLanguage;
window.applyTranslations = applyTranslations;

populateLanguageSwitcher();
applyTranslations();
