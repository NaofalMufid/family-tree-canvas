# Family Tree Canvas

![Architecture](https://img.shields.io/badge/architecture-zero--backend%20%7C%20local--first-059669)
![Privacy](https://img.shields.io/badge/privacy-100%25%20client--side-2563eb)
![PWA](https://img.shields.io/badge/PWA-offline--ready-7c3aed)
![Hosting](https://img.shields.io/badge/hosting-static%20web-f48120)

Family Tree Canvas adalah aplikasi web berbasis *infinite canvas* untuk menyusun,
memvisualisasikan, dan mencadangkan silsilah keluarga. Aplikasi berjalan sebagai
static web: tidak memiliki backend aplikasi, database pusat, atau proses data di
server milik pengembang.

Data silsilah dan foto diproses di browser pengguna. Integrasi Google Drive
bersifat opsional dan, ketika digunakan, berkomunikasi langsung dari browser ke
Google API atas tindakan eksplisit pengguna.

**Live demo:** [family-tree-canvas.valnobcc.workers.dev](https://family-tree-canvas.valnobcc.workers.dev/)

## Fitur

- Kanvas interaktif dengan pan, zoom, drag kartu, dan reset viewport.
- Penambahan relasi orang tua, pasangan, dan anak.
- Penyuntingan data anggota langsung pada kartu.
- Auto-layout untuk merapikan hierarki keluarga.
- Kompresi foto profil di browser hingga maksimal `200 × 200` piksel.
- Quick Search dengan `Ctrl+K` atau `Cmd+K` dan fokus otomatis ke kartu.
- Auto-save lokal menggunakan IndexedDB dengan fallback localStorage.
- Export dan import JSON, termasuk enkripsi opsional berbasis password.
- PBKDF2 SHA-256 dan AES-GCM 256-bit melalui Web Crypto API.
- Export keseluruhan pohon sebagai PNG HD.
- Integrasi Google Drive opsional menggunakan OAuth, Google Picker, dan Drive
  REST API v3.
- Progressive Web App yang dapat dipasang dan digunakan kembali saat offline.

## Arsitektur dan alur data

```text
Interaksi pengguna
       │
       ├── Edit silsilah / foto / relasi
       │        └── IndexedDB → fallback localStorage
       │
       ├── Export JSON
       │        ├── JSON biasa → file lokal
       │        └── PBKDF2 + AES-GCM → file terenkripsi
       │
       ├── Google Drive (opsional)
       │        ├── GIS OAuth token disimpan sementara di memori
       │        ├── Google Picker memilih file
       │        └── Browser ↔ Google Drive REST API
       │
       └── PWA
                └── Service worker → cache aset aplikasi
```

| Area | Implementasi |
| --- | --- |
| UI dan graph engine | HTML, Tailwind Play CDN, CSS, dan JavaScript browser |
| Penyimpanan utama | IndexedDB |
| Fallback penyimpanan | localStorage |
| Enkripsi cadangan | Web Crypto API: PBKDF2 SHA-256 + AES-GCM 256-bit |
| Google Drive | Google Identity Services, Picker API, dan Drive REST API v3 |
| Izin Google Drive | `https://www.googleapis.com/auth/drive.file` |
| Offline | Web App Manifest dan vanilla service worker |
| Hosting | Static hosting, termasuk Cloudflare Pages |

Token OAuth Google hanya disimpan di memori halaman. ID dan nama file Drive yang
sedang terhubung disimpan di browser agar fitur Quick Sync dapat dilanjutkan
setelah reload. Service worker tidak menyimpan response Google API atau request
yang memakai header otorisasi.

Informasi selengkapnya tersedia di [Kebijakan Privasi](./privacy.html).

## Struktur proyek

```text
family-tree-canvas/
├── assets/
│   ├── README.md                 # Peta tanggung jawab aset dan urutan script
│   ├── css/
│   │   └── app.css               # Style khusus kanvas, kartu, dan animasi
│   └── js/
│       ├── tailwind-config.js     # Token font dan shadow Tailwind
│       ├── google-config.js       # Konfigurasi browser Google API
│       ├── app-core.js            # State, storage, graph, render, foto, layout
│       ├── data-transfer.js       # Import/export JSON dan enkripsi
│       ├── google-drive.js        # OAuth, Picker, dan operasi Drive
│       ├── ui-interactions.js     # Search, pan/zoom, toolbar, inisialisasi
│       └── pwa.js                 # Registrasi PWA dan status jaringan
├── index.html                     # Struktur UI aplikasi
├── privacy.html                   # Kebijakan privasi dan Google API disclosure
├── manifest.json                  # Web App Manifest
├── sw.js                          # Service worker dan strategi cache
├── icon.svg                       # Ikon aplikasi
├── .gitignore
└── README.md
```

Proyek tidak memakai bundler. Urutan script lokal di `index.html` penting karena
file JavaScript berbagi browser global yang sama. Penjelasan setiap file tersedia
di [`assets/README.md`](./assets/README.md).

## Persyaratan

Untuk menjalankan fitur utama:

- Browser modern yang mendukung IndexedDB, Web Crypto API, service worker, dan
  JavaScript modern.
- Static HTTP server lokal. Membuka `index.html` melalui `file://` tidak cukup
  untuk service worker dan OAuth Google.
- Koneksi internet pada kunjungan awal karena Tailwind, Lucide,
  `html-to-image`, Google Fonts, dan library Google dimuat dari CDN.

Untuk fitur Google Drive, dibutuhkan project Google Cloud dengan:

- Google Drive API aktif.
- Google Picker API aktif.
- OAuth consent screen yang telah dikonfigurasi.
- OAuth Client ID bertipe **Web application**.
- Browser API key.

Node.js, npm, database, dan server backend tidak diperlukan.

## Menjalankan secara lokal

Clone repository dan masuk ke direktorinya:

```bash
git clone <repository-url>
cd family-tree-canvas
```

Jalankan salah satu static server berikut.

Dengan Python:

```bash
python3 -m http.server 8000
```

Atau dengan PHP:

```bash
php -S localhost:8000
```

Buka `http://localhost:8000` di browser.

Untuk menguji PWA atau perubahan service worker:

1. Buka DevTools → Application → Service Workers.
2. Pastikan `sw.js` terdaftar dan aktif.
3. Reload sekali saat online agar cache terbaru terpasang.
4. Aktifkan mode Offline pada DevTools, lalu reload.

Jika cache lama masih digunakan setelah mengubah service worker, naikkan nilai
`CACHE_NAME` di `sw.js`.

## Mengaktifkan Google Drive

Fitur lain tetap dapat digunakan tanpa konfigurasi Google Drive.

1. Buat atau pilih project di Google Cloud Console.
2. Aktifkan **Google Drive API** dan **Google Picker API**.
3. Konfigurasikan OAuth consent screen dan tambahkan scope:

   ```text
   https://www.googleapis.com/auth/drive.file
   ```

4. Buat OAuth Client ID bertipe **Web application**.
5. Tambahkan authorized JavaScript origins, misalnya:

   ```text
   http://localhost:8000
   https://domain-production-anda.example
   ```

6. Buat Browser API key. Batasi key berdasarkan HTTP referrer dan API yang
   diperlukan.
7. Isi konfigurasi di [`assets/js/google-config.js`](./assets/js/google-config.js):

   ```js
   const GOOGLE_CLIENT_ID = "YOUR_CLIENT_ID.apps.googleusercontent.com";
   const GOOGLE_API_KEY = "YOUR_BROWSER_API_KEY";
   const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
   ```

Browser API key bukan secret karena dikirim ke browser dan dapat dilihat oleh
pengguna. Keamanannya harus berasal dari pembatasan HTTP referrer, pembatasan API,
dan OAuth authorized origins di Google Cloud Console. Jangan memakai service
account key atau client secret pada repository ini.

## Deploy ke Cloudflare Pages

Repository ini dapat dipublikasikan sebagai static site tanpa proses build.

| Pengaturan | Nilai |
| --- | --- |
| Framework preset | `None` |
| Build command | Kosong |
| Build output directory | `.` (root repository) |

Setelah domain production aktif:

1. Tambahkan origin HTTPS production ke OAuth Client ID.
2. Tambahkan domain tersebut ke HTTP referrer restriction pada Browser API key.
3. Pastikan `privacy.html` dapat diakses secara publik.
4. Uji login, Picker, Save, Open, PATCH/Quick Sync, dan file terenkripsi.

## Alur pengembangan

Saat menambah atau mengubah fitur:

1. Tempatkan perubahan pada file sesuai tanggung jawabnya.
2. Hindari menambahkan data keluarga asli atau file backup ke repository.
3. Jika menambah aset yang wajib tersedia offline, masukkan path-nya ke
   `CORE_ASSETS` pada `sw.js`.
4. Naikkan `CACHE_NAME` ketika isi cache aplikasi berubah.
5. Uji desktop dan mobile, khususnya toolbar, pan/zoom, modal, dan dropdown.
6. Uji aplikasi dalam keadaan online dan offline.

Checklist minimum sebelum mengirim perubahan:

- Tambah, edit, drag, dan hapus anggota tetap berfungsi.
- Relasi orang tua, pasangan, dan anak tetap tergambar.
- Auto-save lokal serta reload state berhasil.
- Pan/zoom tidak memicu indikator perubahan data.
- Export/import JSON biasa dan terenkripsi berhasil.
- Export PNG berhasil.
- Quick Search dan shortcut keyboard berhasil.
- Google Drive Save, Open, dan Quick Sync berhasil jika konfigurasi tersedia.
- Tidak ada error baru pada console browser.
- Tidak ada elemen UI yang saling menutupi pada mobile dan laptop.

## Berkontribusi

Kontribusi berupa perbaikan bug, peningkatan aksesibilitas, optimasi performa,
penyempurnaan dokumentasi, dan fitur baru sangat diterima.

1. Fork repository.
2. Buat branch dengan nama yang jelas:

   ```bash
   git checkout -b fix/mobile-toolbar
   ```

3. Lakukan perubahan dengan scope kecil dan fokus.
4. Jalankan checklist pengujian di atas.
5. Commit dengan pesan yang menjelaskan hasil perubahan:

   ```bash
   git commit -m "fix: prevent mobile toolbar overlap"
   ```

6. Push branch dan buka Pull Request.

Dalam Pull Request, sertakan:

- Ringkasan masalah dan solusi.
- Langkah pengujian.
- Screenshot atau rekaman untuk perubahan UI.
- Catatan dampak pada storage, privasi, OAuth, atau service worker jika ada.

Jangan memasukkan data silsilah nyata, token OAuth, client secret, service account
key, atau file backup pengguna ke issue maupun Pull Request.

## Privasi dan keamanan

- Aplikasi tidak mempunyai backend aplikasi atau database pusat.
- Data lokal tidak dikirim otomatis ke pengembang.
- Google Drive hanya digunakan saat pengguna memilih Save/Open/Sync.
- Password dan kunci enkripsi tidak dikirim ke server aplikasi.
- Kehilangan password file terenkripsi tidak dapat dipulihkan oleh pengembang.
- Temuan keamanan sebaiknya dilaporkan secara privat melalui kontak yang tertera
  pada [`privacy.html`](./privacy.html), bukan bersama data pengguna pada issue
  publik.
