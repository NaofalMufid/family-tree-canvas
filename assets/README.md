# Struktur aset Family Tree Canvas

Aplikasi tetap berupa static web tanpa bundler. Urutan `<script>` di `index.html`
bersifat penting karena setiap file memakai global browser yang sama.

| File | Tanggung jawab |
| --- | --- |
| `css/app.css` | Reset, kanvas, kartu keluarga, animasi, dan style khusus non-Tailwind |
| `js/i18n.js` | Kamus multi-bahasa (`SUPPORTED_LANGUAGES`, `translations`), `t()`, dan `setLanguage()` |
| `js/tailwind-config.js` | Token font dan shadow Tailwind Play CDN |
| `js/google-config.js` | Client ID, browser API key, dan scope Google Drive |
| `js/app-core.js` | State utama, IndexedDB/localStorage, render kanvas, node, foto, auto-layout, privasi, dan export PNG |
| `js/data-transfer.js` | Export/import JSON serta enkripsi/dekripsi AES-GCM |
| `js/google-drive.js` | OAuth GIS, Google Picker, create/update/download file Drive, dan UI sinkronisasi |
| `js/ui-interactions.js` | Quick Search, pan/zoom, toolbar, shortcut, serta inisialisasi aplikasi |
| `js/pwa.js` | Registrasi service worker, status jaringan, dan install prompt |

## Menambah Bahasa Baru (i18n)

1. Buka `assets/js/i18n.js` lalu tambahkan 1 entri objek ke `SUPPORTED_LANGUAGES` (contoh: `{ code: 'ja', label: '日本語', short: 'JA', dir: 'ltr' }` atau `dir: 'rtl'` untuk bahasa kanan-ke-kiri).
2. Salin salah satu blok kamus di `translations` (misal `en`), ubah key induknya menjadi kode bahasa baru, dan terjemahkan nilainya.
3. Tidak perlu mengubah `index.html` maupun modul JS lainnya — *language switcher* di toolbar akan otomatis membaca daftar dari `SUPPORTED_LANGUAGES`.

Jika menambah aset lokal baru yang dibutuhkan saat offline, tambahkan path-nya ke
`CORE_ASSETS` di `sw.js` dan naikkan versi `CACHE_NAME`.
