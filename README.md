# MoneyMovement

Aplikasi web mobile-first untuk mencatat aset (cash & investasi) dan liabilitas (utang), serta melacak networth.

**Networth = Cash + Investasi − Liabilitas.**

```
frontend/  React + Vite + TypeScript (mobile-first UI, grafik dengan Recharts)
backend/   API Gateway: Node.js + Fastify + TypeScript
supabase/  SQL migration (tabel, trigger snapshot, RLS)
```

Alur request: `Browser -> /api/v1/* (Vite proxy) -> Gateway (helmet, CORS, rate limit, auth JWT, validasi Zod) -> Supabase`.
Query data user memakai JWT user sehingga **Row Level Security** tetap berlaku. Service role key hanya dipakai di backend untuk register dan lookup username saat login.

### Struktur modul backend
```
backend/src/modules/<modul>/
  <modul>.routes.ts    # HTTP: validasi input -> panggil service -> kirim response
  <modul>.schemas.ts   # skema Zod (input request)
  <modul>.service.ts   # logika bisnis + akses Supabase, tanpa ketergantungan ke Fastify
```
Semua modul (`auth`, `assets`, `networth`) memakai pola ini.

Migration dijalankan berurutan: `001_init.sql`, `002_asset_balance_changes.sql`, lalu `003_liabilities.sql`.

## Setup

### 1. Database
Buka Supabase Dashboard > **SQL Editor**, lalu jalankan seluruh isi `supabase/migrations/001_init.sql`.

### 2. Backend
```powershell
cd backend
Copy-Item .env.example .env   # isi SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev                   # http://localhost:4000
```
Key ada di Supabase Dashboard > Project Settings > API. Key format baru (`sb_publishable_...` / `sb_secret_...`) juga bisa dipakai.

### 3. Frontend
```powershell
cd frontend
npm install
npm run dev                   # http://localhost:5173
```
Untuk mencoba dari HP di jaringan Wi-Fi yang sama, buka `http://<IP-laptop>:5173`.

## API (prefix `/api/v1`)

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| POST | `/auth/register` | - | `{ username, email, phone, password }` |
| POST | `/auth/login` | - | `{ username, password }` |
| POST | `/auth/refresh` | - | `{ refreshToken }` |
| GET | `/auth/me` | Bearer | profil user |
| GET | `/assets?type=cash\|investment\|liability` | Bearer | daftar aset |
| POST | `/assets` | Bearer | `{ type: cash\|investment\|liability, name, category, balance }` (untuk liability, `balance` = sisa utang, positif) |
| PATCH | `/assets/:id` | Bearer | `{ name?, category?, balance? }` |
| DELETE | `/assets/:id` | Bearer | hapus aset |
| POST | `/assets/:id/balance` | Bearer | `{ balance }` set saldo baru, response berisi selisih + timestamp |
| GET | `/assets/:id/balance-changes?limit=20` | Bearer | riwayat perubahan saldo, terbaru di atas |
| GET | `/networth/summary` | Bearer | total cash, investasi, liabilitas, networth, per kategori |
| GET | `/networth/history?range=1M\|3M\|6M\|1Y\|2Y` | Bearer | titik grafik harian (WIB) |

Format error: `{ "error": { "code", "message", "details"? } }`.

## Cara kerja riwayat networth
Trigger `assets_record_snapshot` membuat baris di `networth_snapshots` setiap kali aset dibuat, saldonya diubah, atau dihapus. Grafik mengambil nilai terakhir per hari (zona Asia/Jakarta), ditambah nilai yang berlaku di awal rentang, dan garisnya diperpanjang sampai hari ini.

## Batasan saat ini
- Email tidak diverifikasi saat register (`email_confirm: true`).
- Token disimpan di `localStorage`. Untuk production, pertimbangkan cookie httpOnly.
- Hanya IDR, nilai investasi diinput manual.
