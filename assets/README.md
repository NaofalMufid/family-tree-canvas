# Struktur aset Family Tree Canvas

Aplikasi tetap berupa static web tanpa bundler. Urutan `<script>` di `index.html`
bersifat penting karena setiap file memakai global browser yang sama.

| File | Tanggung jawab |
| --- | --- |
| `css/app.css` | Reset, kanvas, kartu keluarga, animasi, dan style khusus non-Tailwind |
| `js/tailwind-config.js` | Token font dan shadow Tailwind Play CDN |
| `js/google-config.js` | Client ID, browser API key, dan scope Google Drive |
| `js/app-core.js` | State utama, IndexedDB/localStorage, render kanvas, node, foto, auto-layout, privasi, dan export PNG |
| `js/data-transfer.js` | Export/import JSON serta enkripsi/dekripsi AES-GCM |
| `js/google-drive.js` | OAuth GIS, Google Picker, create/update/download file Drive, dan UI sinkronisasi |
| `js/ui-interactions.js` | Quick Search, pan/zoom, toolbar, shortcut, serta inisialisasi aplikasi |
| `js/pwa.js` | Registrasi service worker, status jaringan, dan install prompt |

Jika menambah aset lokal baru yang dibutuhkan saat offline, tambahkan path-nya ke
`CORE_ASSETS` di `sw.js` dan naikkan versi `CACHE_NAME`.
