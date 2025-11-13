# 📚 Dokumentasi Lengkap Sistem Rule-Based Adaptif - Adaptivin

## 📋 Daftar Isi

1. [Penjelasan Dasar Sistem](#1-penjelasan-dasar-sistem)
2. [Kategori Kecepatan Jawaban](#2-kategori-kecepatan-jawaban)
3. [Sistem Poin Consecutive (Berturut-turut)](#3-sistem-poin-consecutive-berturut-turut)
4. [Aturan NAIK Level](#4-aturan-naik-level)
5. [Aturan TURUN Level](#5-aturan-turun-level)
6. [Aturan TETAP di Level](#6-aturan-tetap-di-level)
7. [Sliding Window (5 Soal Terakhir)](#7-sliding-window-5-soal-terakhir)
8. [Contoh Skenario Lengkap](#8-contoh-skenario-lengkap)
9. [Flowchart & Diagram](#9-flowchart--diagram)
10. [Keunggulan Sistem](#10-keunggulan-sistem)

---

## 1. Penjelasan Dasar Sistem

### 1.1 Apa itu Sistem Rule-Based Adaptif?

**Analogi Sederhana:**
Bayangkan Anda sedang bermain game RPG. Saat Anda mengalahkan monster dengan mudah, game akan memberikan monster yang lebih kuat. Tapi kalau Anda kesulitan, game akan menurunkan tingkat kesulitannya. **Itulah yang dilakukan sistem kami pada soal kuis!**

### 1.2 Komponen Utama

```
┌─────────────────────────────────────────┐
│   🎯 6 LEVEL KESULITAN SOAL             │
├─────────────────────────────────────────┤
│   Level 1: Sangat Mudah (Dasar)        │
│   Level 2: Mudah                        │
│   Level 3: Sedang (START HERE!)         │ ← Semua siswa mulai di sini
│   Level 4: Sulit                        │
│   Level 5: Sangat Sulit                 │
│   Level 6: Expert (Paling Sulit)        │
└─────────────────────────────────────────┘
```

**Kenapa mulai dari Level 3?**

- Tidak terlalu mudah (bosan)
- Tidak terlalu sulit (frustasi)
- Sweet spot untuk mulai belajar

---

## 2. Kategori Kecepatan Jawaban

### 2.1 Apa itu Durasi Soal?

**PENJELASAN SEDERHANA:**
Durasi Soal adalah **waktu maksimal yang ditetapkan guru** untuk mengerjakan soal tersebut. Setiap soal memiliki durasi yang berbeda tergantung tingkat kesulitannya.

**Contoh:**

```
Soal Mudah: "Apa ibu kota Indonesia?"
Durasi yang ditetapkan guru: 30 detik

Soal Sedang: "Berapa 15 × 8?"
Durasi yang ditetapkan guru: 60 detik

Soal Sulit: "Jelaskan proses fotosintesis!"
Durasi yang ditetapkan guru: 120 detik
```

### 2.2 Bagaimana Sistem Menghitung Kecepatan?

Sistem membandingkan **waktu siswa menjawab** dengan **durasi yang ditetapkan guru**.

**Contoh Perhitungan:**

```
Soal Matematika: "Berapa 15 × 8?"
Durasi yang ditetapkan guru: 60 detik

Data 3 siswa:
- Siswa A: 30 detik → 30/60 = 50% → CEPAT 🚀
- Siswa B: 45 detik → 45/60 = 75% → SEDANG ⏱️
- Siswa C: 70 detik → 70/60 = 117% → LAMBAT 🐌

┌─────────────────────────────────────────┐
│  Waktu Siswa    │  Persentase  │  Kategori  │
├─────────────────────────────────────────┤
│  30 detik       │  50%         │  🚀 CEPAT  │
│  45 detik       │  75%         │  ⏱️ SEDANG │
│  60 detik       │  100%        │  ⏱️ SEDANG │
│  70 detik       │  117%        │  🐌 LAMBAT │
└─────────────────────────────────────────┘
```

### 2.3 Formula Kecepatan

```javascript
Persentase = (Waktu Siswa / Durasi Soal) × 100%

Jika Persentase < 70%    → CEPAT 🚀
Jika Persentase 70-110%  → SEDANG ⏱️
Jika Persentase > 110%   → LAMBAT 🐌
```

**Penjelasan Threshold:**

- **< 70%**: Siswa menjawab jauh lebih cepat dari waktu yang disediakan
- **70-110%**: Siswa menjawab dalam rentang waktu normal
- **> 110%**: Siswa menjawab melebihi waktu yang seharusnya (lebih lambat)

### 2.4 Contoh Kasus Nyata

**Kasus 1: Soal Mudah**

```
Soal: "Siapa presiden pertama Indonesia?"
Durasi: 30 detik (soal mudah, waktu singkat)

Siswa A jawab dalam 10 detik:
- Persentase: 10/30 = 33% → CEPAT ✅
  (Siswa paham betul, jawab cepat!)

Siswa B jawab dalam 40 detik:
- Persentase: 40/30 = 133% → LAMBAT ✅
  (Siswa ragu-ragu, melebihi waktu yang disediakan)
```

**Kasus 2: Soal Sulit**

```
Soal: "Jelaskan proses fotosintesis lengkap dengan tahapannya!"
Durasi: 180 detik (soal sulit, waktu lama)

Siswa A jawab dalam 120 detik:
- Persentase: 120/180 = 67% → CEPAT ✅
  (Meskipun 2 menit, ini termasuk cepat untuk soal sulit)

Siswa B jawab dalam 150 detik:
- Persentase: 150/180 = 83% → SEDANG ✅
  (Waktu normal untuk soal dengan tingkat kesulitan ini)
```

**Kesimpulan:** Kategori kecepatan **relatif terhadap durasi soal**, bukan nilai absolut!

---

## 3. Sistem Poin Consecutive (Berturut-turut)

### 3.1 Apa itu Poin Consecutive?

**PENJELASAN SEDERHANA:**
Poin consecutive adalah **sistem tracking** untuk menghitung jawaban BENAR berturut-turut. Sistem ini berhenti ketika ada jawaban SALAH.

**Analogi:**
Bayangkan Anda sedang main game "combo". Setiap pukulan yang kena, combo bertambah. Tapi kalau meleset satu kali, combo reset ke 0!

### 3.2 Tabel Poin

| Status Jawaban | Kecepatan | Poin | Alasan                                        |
| -------------- | --------- | ---- | --------------------------------------------- |
| ✅ Benar       | 🚀 Cepat  | 0    | **Langsung naik level!** (reward instant)     |
| ✅ Benar       | ⏱️ Sedang | +2   | Paham materi (akumulasi, naik di ≥4 poin)     |
| ✅ Benar       | 🐌 Lambat | 0    | Paham tapi butuh waktu (naik di 3x konsisten) |
| ❌ Salah       | 🚀 Cepat  | 0    | Mungkin teledor/gegabah                       |
| ❌ Salah       | ⏱️ Sedang | 0    | Belum paham                                   |
| ❌ Salah       | 🐌 Lambat | 0    | Tidak paham & lambat                          |

**PENTING:**

- **Benar + Cepat = TIDAK DAPAT POIN** (langsung naik level, bukan akumulasi!)
- **Benar + Sedang = +2 POIN** (sistem akumulasi, naik di ≥4 poin)
- **Benar + Lambat = 0 POIN** (sistem konsistensi, harus 3x berturut-turut)
- **Semua Salah = 0 POIN** (reset semua progress)

### 3.3 Contoh Perhitungan Poin Consecutive

#### Contoh A: Full Combo ✅✅✅

```
Siswa Level 3, Poin: 0

Soal 1: Benar + Cepat
  → LANGSUNG NAIK! (tidak pakai poin)
  → Level: 3 → 4 (NAIK!)
  → Poin direset ke 0

Soal 2: Benar + Sedang
  → Poin: 0 + 2 = 2
  → Level: 4 (TETAP, butuh 4 poin untuk naik)

Soal 3: Benar + Cepat
  → LANGSUNG NAIK! (tidak pakai poin)
  → Level: 4 → 5 (NAIK!)
  → Poin direset ke 0

Soal 4: Benar + Sedang
  → Poin: 0 + 2 = 2
  → Level: 5 (TETAP, butuh 4 poin untuk naik)
```

**Kesimpulan:** Benar+Cepat SELALU langsung naik level, tanpa perlu akumulasi poin!

---

#### Contoh B: Akumulasi Poin dari Benar+Sedang

```
Siswa Level 3, Poin: 0

Soal 1: Benar + Sedang
  → Poin: 0 + 2 = 2
  → Level: 3 (TETAP, butuh 4 poin untuk naik)

Soal 2: Benar + Sedang
  → Poin: 2 + 2 = 4
  → Level: 3 → 4 (NAIK! karena poin ≥4)
  → Poin direset ke 0
```

**Kesimpulan:** Butuh 2x Benar+Sedang untuk naik level (2 + 2 = 4 poin)!

---

#### Contoh C: Combo Putus di Tengah ❌

```
Siswa Level 3, Poin: 0

Soal 1: Benar + Sedang
  → Poin: 0 + 2 = 2
  → Level: 3 (TETAP)

Soal 2: Benar + Sedang
  → Poin: 2 + 2 = 4
  → Level: 3 → 4 (NAIK!)
  → Poin direset ke 0

Soal 3: Salah + Sedang ❌ (COMBO PUTUS!)
  → Poin: 0 (RESET karena salah!)
  → Level: 4 (TETAP, karena baru 1x salah)

Soal 4: Benar + Sedang (COMBO MULAI LAGI)
  → Poin: 0 + 2 = 2
  → Level: 4 (TETAP)

Soal 5: Benar + Sedang
  → Poin: 2 + 2 = 4
  → Level: 4 → 5 (NAIK!)
  → Poin direset ke 0
```

**Kesimpulan:** Meskipun combo putus, siswa tetap bisa naik dengan mengumpulkan poin lagi!

---

#### Contoh D: Konsistensi Benar+Lambat (3x berturut-turut)

```
Siswa Level 4, Poin: 0

Soal 1: Benar + Lambat
  → Konsistensi: 1/3
  → Level: 4 (TETAP, butuh 3x berturut-turut)

Soal 2: Benar + Lambat
  → Konsistensi: 2/3
  → Level: 4 (TETAP)

Soal 3: Benar + Lambat
  → Konsistensi: 3/3 ✅
  → Level: 4 → 5 (NAIK! 3x Benar+Lambat berturut-turut!)

Soal 4: Benar + Sedang
  → Poin: 0 + 2 = 2
  → Level: 5 (TETAP)

Soal 5: Benar + Cepat
  → LANGSUNG NAIK!
  → Level: 5 → 6 (NAIK!)
```

**Kesimpulan:** Benar+Lambat tidak dapat poin, tapi bisa naik kalau konsisten 3x berturut-turut!

---

### 3.4 Kapan Poin Direset ke 0?

Poin consecutive akan **RESET ke 0** dalam 3 kondisi:

1. **Jawaban SALAH** ❌

   ```
   Soal 1: Benar+Cepat (langsung naik) → Poin: 0
   Soal 2: Benar+Sedang (+2) → Poin: 2
   Soal 3: Salah+Lambat ❌ → Poin: 0 (RESET!)
   ```

2. **Level NAIK** ⬆️

   ```
   Soal 1: Benar+Cepat → Level naik 3→4, Poin: 0 (RESET!)
   Soal 2: Benar+Sedang (+2) → Poin: 2
   Soal 3: Benar+Sedang (+2) → Poin: 4 → Level naik 4→5, Poin: 0 (RESET!)
   ```

3. **Level TURUN** ⬇️
   ```
   Soal 1: Salah+Lambat → Level turun 4→3, Poin: 0 (RESET!)
   ```

---

## 4. Aturan NAIK Level

### Aturan #1: Benar + Cepat (Langsung Naik!) 🚀

**Kondisi:**

- Jawaban terakhir: ✅ Benar
- Kecepatan: 🚀 Cepat (< 70% median)

**Aksi:**

```
Level Baru = Level Sekarang + 1
Poin = 0 (tidak pakai poin, langsung naik)
```

**Contoh:**

```
📍 Siswa Level 3, Median Time: 60 detik

Soal: "Apa ibu kota Indonesia?"
Jawaban: "Jakarta" ✅ Benar
Waktu: 35 detik (58% dari median) → CEPAT!

HASIL:
✅ Level 3 → Level 4 (NAIK!)
🔄 Poin: 0 (tidak pakai poin)
💬 Reason: "Benar + Cepat → Naik 1 level"
```

**Kenapa Langsung Naik?**

- Siswa terbukti PAHAM materi
- Siswa EFISIEN dalam menjawab
- Layak dicoba soal lebih sulit
- **Reward instant** untuk performa terbaik!

---

### Aturan #2: Akumulasi Poin ≥ 3 (Benar + Sedang) ⏱️

**Kondisi:**

- Jawaban terakhir: ✅ Benar
- Poin consecutive ≥ 3
- **SISTEM AKUMULASI** (bukan harus 3x Benar+Sedang berturut-turut)

**Aksi:**

```
Level Baru = Level Sekarang + 1
Poin = 0 (reset)
```

**Penjelasan AKUMULASI:**
Berbeda dengan Benar+Lambat yang butuh **KONSISTENSI** (3x berturut-turut dengan kecepatan lambat), Benar+Sedang menggunakan **AKUMULASI POIN**. Artinya, poin bisa dikumpulkan dari kombinasi:

- Benar + Sedang (+2 poin)
- Benar + Lambat (+0 poin)
- Benar + Cepat langsung naik (tidak akumulasi)

**Contoh A: Pure Benar + Sedang**

```
📍 Siswa Level 2

Soal 1: Benar + Sedang (+2 poin)
  → Poin: 1, Level: 2 (TETAP)

Soal 2: Benar + Sedang (+2 poin)
  → Poin: 2, Level: 2 (TETAP)

Soal 3: Benar + Sedang (+2 poin)
  → Poin: 3, Level: 2 → 3 (NAIK!)
  💬 "Akumulasi poin 4 (>= 4) → Naik 1 level"

HASIL: Level 2 → 3 (dengan 2x Benar+Sedang)
```

**Contoh B: Campuran Sedang + Lambat (AKUMULASI)**

```
📍 Siswa Level 3

Soal 1: Benar + Sedang (+2 poin)
  → Poin: 1, Level: 3 (TETAP)

Soal 2: Benar + Lambat (+0 poin)
  → Poin: 1, Level: 3 (TETAP)

Soal 3: Benar + Sedang (+2 poin)
  → Poin: 2, Level: 3 (TETAP)

Soal 4: Benar + Sedang (+2 poin)
  → Poin: 3, Level: 3 → 4 (NAIK!)
  � "Akumulasi poin 4 (>= 4) → Naik 1 level"

HASIL: Level 3 → 4
(Campuran: 2x Sedang + 1x Lambat, total poin = 4)
```

**Contoh C: Akumulasi dari Sedang + Lambat berbeda urutan**

```
� Siswa Level 4

Soal 1: Benar + Lambat (+0 poin)
  → Poin: 0, Level: 4 (TETAP, 1/3 konsistensi lambat)

Soal 2: Benar + Sedang (+2 poin)
  → Poin: 1, Level: 4 (TETAP, streak lambat putus)

Soal 3: Benar + Lambat (+0 poin)
  → Poin: 1, Level: 4 (TETAP, 1/3 konsistensi lambat lagi)

Soal 4: Benar + Sedang (+2 poin)
  → Poin: 2, Level: 4 (TETAP)

Soal 5: Benar + Sedang (+2 poin)
  → Poin: 3, Level: 4 → 5 (NAIK!)
  💬 "Akumulasi poin 4 (>= 4) → Naik 1 level"

HASIL: Level 4 → 5
(Campuran: 2x Sedang + 2x Lambat = 4 poin)
```

**Kenapa Pakai AKUMULASI?**

- Lebih fleksibel (bisa campuran kecepatan)
- Siswa tidak harus konsisten 100% sedang
- Menghargai setiap jawaban benar
- Lebih realistis untuk pembelajaran

---

### Aturan #3: 3x Benar + Lambat Berturut-turut 🐌🐌🐌 (KONSISTENSI)

**Kondisi:**

- 3 jawaban terakhir: ✅✅✅ Benar
- Kecepatan: 🐌 Lambat (semua 3 soal **BERTURUT-TURUT**)
- **SISTEM KONSISTENSI** (harus 3x dengan kecepatan lambat berturut-turut)

**Aksi:**

```
Level Baru = Level Sekarang + 1
Poin = 0 (reset)
```

**Perbedaan dengan Benar+Sedang:**
| Aspek | Benar + Sedang | Benar + Lambat |
|-------|----------------|----------------|
| Sistem | **AKUMULASI** | **KONSISTENSI** |
| Poin | +1 per soal | 0 per soal |
| Syarat Naik | Akumulasi 3 poin (bisa campuran) | 3x berturut-turut (harus semua lambat) |
| Fleksibilitas | Tinggi (bisa mixed) | Rendah (harus konsisten) |

**Contoh KONSISTENSI (Benar + Lambat):**

```
📍 Siswa Level 3

Soal 1: Benar + Lambat (75 detik, median 60) → 1/3 ✅
  → Poin: 0, Level: 3 (TETAP)

Soal 2: Benar + Lambat (80 detik, median 70) → 2/3 ✅
  → Poin: 0, Level: 3 (TETAP)

Soal 3: Benar + Lambat (90 detik, median 75) → 3/3 ✅
  → Poin: 0, Level: 3 → 4 (NAIK!)
  💬 "3x Benar + Lambat berturut-turut (konsistensi terjaga) → Naik 1 level"

HASIL: Level 3 → 4
```

**Contoh KONSISTENSI PUTUS (Tidak Naik):**

```
📍 Siswa Level 3

Soal 1: Benar + Lambat → 1/3 ✅
  → Poin: 0, Level: 3 (TETAP)

Soal 2: Benar + Lambat → 2/3 ✅
  → Poin: 0, Level: 3 (TETAP)

Soal 3: Benar + Sedang ⏱️ (KONSISTENSI PUTUS!)
  → Poin: 1, Level: 3 (TETAP)
  → Streak lambat reset ke 0

Soal 4: Benar + Lambat → 1/3 ✅ (mulai hitung lagi)
  → Poin: 1, Level: 3 (TETAP)

HASIL: TIDAK NAIK karena konsistensi lambat putus
Tapi poin masih 1 (dari Benar+Sedang di soal 3)
```

**Kenapa Tetap Naik Meskipun Lambat?**

- Siswa PAHAM materi (3x benar!)
- Hanya butuh waktu lebih lama (masih belajar)
- Layak dicoba level lebih tinggi (dengan konsistensi)

**Kenapa Harus KONSISTENSI (bukan AKUMULASI)?**

- Benar+Lambat memberikan 0 poin
- Kalau pakai akumulasi, tidak akan pernah naik
- Konsistensi 3x membuktikan siswa benar-benar paham (bukan keberuntungan)
- Memberikan kesempatan siswa lambat untuk naik level

---

## 5. Aturan TURUN Level

### Aturan #1: Salah + Lambat 🐌❌

**Kondisi:**

- Jawaban terakhir: ❌ Salah
- Kecepatan: 🐌 Lambat (> 110% median)

**Aksi:**

```
Level Baru = Level Sekarang - 1
Poin = 0 (reset)
```

**Contoh:**

```
📍 Siswa Level 4, Median Time: 60 detik

Soal: "Sebutkan rumus teorema Pythagoras"
Jawaban: "a + b = c" ❌ Salah
Waktu: 85 detik (142% dari median) → LAMBAT!

HASIL:
⬇️ Level 4 → Level 3 (TURUN!)
🔄 Poin: 0 (reset)
💬 Reason: "Salah + Lambat (tidak paham materi) → Turun 1 level"
```

**Kenapa Turun?**

- Siswa TIDAK PAHAM materi (salah)
- Siswa LAMBAT (butuh waktu lama tapi tetap salah)
- Indikasi level terlalu sulit

---

### Aturan #2: 2x Salah Berturut-turut ❌❌

**Kondisi:**

- 2 jawaban terakhir: ❌❌ Salah (apapun kecepatannya)

**Aksi:**

```
Level Baru = Level Sekarang - 1
Poin = 0 (reset)
```

**Contoh A: Salah + Cepat, lalu Salah + Sedang**

```
📍 Siswa Level 5

Soal 1: Salah + Cepat (20 detik, median 60) → 1/2 ❌
        → TETAP di Level 5 (diberi kesempatan, mungkin teledor)

Soal 2: Salah + Sedang (55 detik, median 60) → 2/2 ❌
        → HASIL: Level 5 → Level 4 (TURUN!)

💬 Reason: "2x Salah berturut-turut → Turun 1 level"
```

**Contoh B: Salah + Sedang, lalu Salah + Lambat**

```
📍 Siswa Level 3

Soal 1: Salah + Sedang (50 detik, median 60) → 1/2 ❌
        → TETAP di Level 3

Soal 2: Salah + Lambat (80 detik, median 60) → 2/2 ❌
        → HASIL: Level 3 → Level 2 (TURUN!)

💬 Reason: "2x Salah berturut-turut → Turun 1 level"
```

**Kenapa 2x?**

- 1x salah bisa jadi teledor/kurang fokus
- 2x salah = indikasi kuat level terlalu sulit
- Perlu turun untuk membangun confidence

---

## 6. Aturan TETAP di Level

### Kondisi TETAP #1: Benar + Sedang (< 3x) ⏱️

**Contoh:**

```
📍 Siswa Level 3

Soal 1: Benar + Sedang → 1/3 ✅
        → TETAP di Level 3
        💬 "Benar + Sedang (1/3 konsistensi) → Tetap (Perlu 3x berturut-turut untuk naik)"

Soal 2: Benar + Sedang → 2/3 ✅
        → TETAP di Level 3
        💬 "Benar + Sedang (2/3 konsistensi) → Tetap (Perlu 3x berturut-turut untuk naik)"

Soal 3: Benar + Sedang → 3/3 ✅
        → NAIK ke Level 4!
        💬 "3x Benar + Sedang berturut-turut → Naik 1 level"
```

---

### Kondisi TETAP #2: Benar + Lambat (< 3x) 🐌

**Contoh:**

```
📍 Siswa Level 4

Soal 1: Benar + Lambat → 1/3 ✅
        → TETAP di Level 4
        💬 "Benar + Lambat (1/3 konsistensi) → Tetap (Perlu 3x berturut-turut untuk naik)"

Soal 2: Benar + Cepat → Combo putus! 🚀
        → NAIK ke Level 5! (Benar+Cepat langsung naik)

Soal 3: Benar + Lambat → 1/3 ✅ (mulai hitung lagi)
        → TETAP di Level 5
```

---

### Kondisi TETAP #3: Salah + Cepat (Pertama kali) ❌🚀

**Contoh:**

```
📍 Siswa Level 4

Soal 1: Benar + Sedang ✅
Soal 2: Benar + Cepat → NAIK ke Level 5! 🚀
Soal 3: Salah + Cepat → 1x ❌
        → TETAP di Level 5
        💬 "Salah + Cepat (mungkin teledor) → Tetap (Diberi kesempatan)"

Soal 4: Benar + Sedang ✅
        → TETAP di Level 5 (poin consecutive: 1)
```

**Kenapa Tetap?**

- Mungkin hanya teledor/kurang fokus
- Diberi kesempatan 1x
- Kalau salah lagi → turun

---

### Kondisi TETAP #4: Salah + Sedang (Pertama kali) ❌⏱️

**Contoh:**

```
📍 Siswa Level 3

Soal 1: Benar + Sedang (poin: 1) ✅
Soal 2: Benar + Sedang (poin: 2) ✅
Soal 3: Salah + Sedang → 1x ❌
        → TETAP di Level 3
        → Poin direset ke 0
        💬 "Salah + Sedang (pertama kali) → Tetap (Poin direset ke 0)"

Soal 4: Benar + Cepat ✅
        → NAIK ke Level 4! (Benar+Cepat langsung naik)
```

---

## 7. Sliding Window (5 Soal Terakhir)

### 7.1 Apa itu Sliding Window?

**PENJELASAN SEDERHANA:**
Sistem hanya melihat **5 soal terakhir** untuk menentukan level, bukan semua history.

**Analogi:**
Bayangkan guru melihat nilai ujian Anda:

- ❌ Sistem Lama: Melihat nilai dari awal semester (nilai jelek di awal terus diingat)
- ✅ Sistem Kami: Hanya melihat 5 ujian terakhir (fokus pada perkembangan terkini!)

### 7.2 Contoh Kasus

```
Siswa menjawab 10 soal:

Soal 1-5 (Diabaikan):
❌ Salah + Lambat
❌ Salah + Sedang
❌ Salah + Cepat
✅ Benar + Lambat
✅ Benar + Lambat

Soal 6-10 (Window Aktif - Yang Dihitung):
✅ Benar + Sedang (poin: 1)
✅ Benar + Sedang (poin: 2)
✅ Benar + Sedang (poin: 3) → NAIK! (3x Benar+Sedang)
✅ Benar + Cepat → NAIK! (Benar+Cepat)
✅ Benar + Sedang (poin: 1)

HASIL:
📈 Siswa naik 2 level (dari 3 → 5)
💡 Meskipun 3 soal pertama salah, sistem tidak menghukum!
```

### 7.3 Keuntungan Sliding Window

1. **Fokus pada Perkembangan Terkini**

   - Siswa yang belajar dari kesalahan tidak dihukum
   - Performance terbaru lebih penting

2. **Fair untuk Siswa**

   - Kesalahan lama tidak terus diingat
   - Setiap siswa punya kesempatan fresh start

3. **Responsif**
   - Cepat menyesuaikan dengan kemampuan siswa
   - Tidak terlalu lambat bereaksi

---

## 8. Contoh Skenario Lengkap

### Skenario 1: Siswa Pintar & Cepat 🌟

```
📍 START: Level 3, Poin: 0

─────────────────────────────────────────────────────────────────
Soal 1: "Apa ibu kota Jepang?"
  Jawaban: "Tokyo" ✅
  Waktu: 10 detik (Median: 30 detik) → 33% = CEPAT! 🚀

  Poin: 0 + 2 = 2
  Level: 3 → 4 (NAIK! Benar+Cepat)
  Poin: 0 (reset)

─────────────────────────────────────────────────────────────────
Soal 2: "Berapa 25 × 4?"
  Jawaban: "100" ✅
  Waktu: 8 detik (Median: 20 detik) → 40% = CEPAT! 🚀

  Poin: 0 + 2 = 2
  Level: 4 → 5 (NAIK! Benar+Cepat)
  Poin: 0 (reset)

─────────────────────────────────────────────────────────────────
Soal 3: "Sebutkan rumus luas lingkaran"
  Jawaban: "πr²" ✅
  Waktu: 25 detik (Median: 40 detik) → 63% = CEPAT! 🚀

  Poin: 0 + 2 = 2
  Level: 5 → 6 (NAIK! Benar+Cepat)
  Poin: 0 (reset)

─────────────────────────────────────────────────────────────────
HASIL AKHIR:
🎯 Level: 3 → 6 (Naik 3 level!)
📊 Statistik: 3 soal, 3 benar, semua cepat
⭐ Performa: EXCELLENT
💬 Kesimpulan: Siswa sangat menguasai materi!
```

---

### Skenario 2: Siswa dengan Akumulasi Sedang 📈

```
📍 START: Level 3, Poin: 0

─────────────────────────────────────────────────────────────────
Soal 1: "Apa nama planet terbesar?"
  Jawaban: "Jupiter" ✅
  Waktu: 40 detik (Median: 50 detik) → 80% = SEDANG ⏱️

  Poin: 0 + 1 = 1
  Level: 3 (TETAP, akumulasi poin: 1/3)

─────────────────────────────────────────────────────────────────
Soal 2: "Siapa penemu lampu?"
  Jawaban: "Thomas Edison" ✅
  Waktu: 35 detik (Median: 45 detik) → 78% = SEDANG ⏱️

  Poin: 1 + 1 = 2
  Level: 3 (TETAP, akumulasi poin: 2/3)

─────────────────────────────────────────────────────────────────
Soal 3: "Berapa hari dalam 1 tahun?"
  Jawaban: "365 hari" ✅
  Waktu: 30 detik (Median: 35 detik) → 86% = SEDANG ⏱️

  Poin: 2 + 1 = 3
  Level: 3 → 4 (NAIK! Akumulasi poin 3)
  Poin: 0 (reset)
  💬 "Akumulasi poin 4 (>= 4) → Naik 1 level"

─────────────────────────────────────────────────────────────────
Soal 4: "Apa simbol kimia air?"
  Jawaban: "H2O" ✅
  Waktu: 45 detik (Median: 50 detik) → 90% = SEDANG ⏱️

  Poin: 0 + 1 = 1
  Level: 4 (TETAP, akumulasi poin: 1/3)

─────────────────────────────────────────────────────────────────
Soal 5: "Berapa sisi pada segitiga?"
  Jawaban: "3" ✅
  Waktu: 15 detik (Median: 20 detik) → 75% = SEDANG ⏱️

  Poin: 1 + 1 = 2
  Level: 4 (TETAP, akumulasi poin: 2/3)

─────────────────────────────────────────────────────────────────
HASIL AKHIR:
🎯 Level: 3 → 4 (Naik 1 level)
📊 Statistik: 5 soal, 5 benar, semua sedang
⭐ Performa: GOOD
💬 Kesimpulan: Siswa konsisten dengan sistem akumulasi poin!
```

---

### Skenario 3: Siswa Lambat Tapi Konsisten 🐢

```
📍 START: Level 3, Poin: 0

─────────────────────────────────────────────────────────────────
Soal 1: "Sebutkan 3 warna primer"
  Jawaban: "Merah, Kuning, Biru" ✅
  Waktu: 80 detik (Median: 60 detik) → 133% = LAMBAT 🐌

  Poin: 0 + 0 = 0 (Lambat = 0 poin)
  Level: 3 (TETAP, 1/3 konsistensi lambat)

─────────────────────────────────────────────────────────────────
Soal 2: "Apa ibu kota Indonesia?"
  Jawaban: "Jakarta" ✅
  Waktu: 70 detik (Median: 50 detik) → 140% = LAMBAT 🐌

  Poin: 0 + 0 = 0
  Level: 3 (TETAP, 2/3 konsistensi lambat)

─────────────────────────────────────────────────────────────────
Soal 3: "Berapa 10 + 15?"
  Jawaban: "25" ✅
  Waktu: 55 detik (Median: 40 detik) → 138% = LAMBAT 🐌

  Poin: 0 + 0 = 0
  Level: 3 → 4 (NAIK! 3x Benar+Lambat berturut-turut)
  Poin: 0 (reset)
  💬 "3x Benar + Lambat berturut-turut (konsistensi terjaga) → Naik 1 level"

─────────────────────────────────────────────────────────────────
HASIL AKHIR:
🎯 Level: 3 → 4 (Naik 1 level)
📊 Statistik: 3 soal, 3 benar, semua lambat
⭐ Performa: GOOD (konsisten!)
💬 Kesimpulan: Siswa paham materi, hanya butuh waktu lebih lama
```

---

### Skenario 4: Siswa Kesulitan 😓

```
📍 START: Level 4, Poin: 0

─────────────────────────────────────────────────────────────────
Soal 1: "Sebutkan rumus integral x²"
  Jawaban: "x³" ❌ (Seharusnya: x³/3 + C)
  Waktu: 90 detik (Median: 60 detik) → 150% = LAMBAT 🐌

  Level: 4 → 3 (TURUN! Salah+Lambat)
  Poin: 0 (reset)
  💬 "Salah + Lambat (tidak paham materi) → Turun 1 level"

─────────────────────────────────────────────────────────────────
Soal 2: "Apa hasil dari 8 × 7?"
  Jawaban: "56" ✅
  Waktu: 45 detik (Median: 40 detik) → 113% = LAMBAT 🐌

  Poin: 0 + 0 = 0
  Level: 3 (TETAP, 1/3 konsistensi lambat)

─────────────────────────────────────────────────────────────────
Soal 3: "Siapa presiden pertama RI?"
  Jawaban: "Soekarno" ✅
  Waktu: 25 detik (Median: 30 detik) → 83% = SEDANG ⏱️

  Poin: 0 (reset karena berbeda kecepatan)
  Poin: 0 + 1 = 1
  Level: 3 (TETAP, 1/3 konsistensi sedang)

─────────────────────────────────────────────────────────────────
Soal 4: "Berapa 15 - 8?"
  Jawaban: "7" ✅
  Waktu: 20 detik (Median: 25 detik) → 80% = SEDANG ⏱️

  Poin: 1 + 1 = 2
  Level: 3 (TETAP, 2/3 konsistensi sedang)

─────────────────────────────────────────────────────────────────
Soal 5: "Apa ibu kota Jepang?"
  Jawaban: "Tokyo" ✅
  Waktu: 18 detik (Median: 30 detik) → 60% = CEPAT 🚀

  Level: 3 → 4 (NAIK! Benar+Cepat)
  Poin: 0 (reset)

─────────────────────────────────────────────────────────────────
HASIL AKHIR:
🎯 Level: 4 → 4 (Turun ke 3, lalu naik kembali ke 4)
📊 Statistik: 5 soal, 4 benar, 1 salah
⭐ Performa: RECOVERY
💬 Kesimpulan: Siswa belajar dari kesalahan dan recover!
```

---

### Skenario 5: Siswa Gegabah (Salah Berturut-turut) 😅

```
📍 START: Level 5, Poin: 0

─────────────────────────────────────────────────────────────────
Soal 1: "Sebutkan rumus turunan sin(x)"
  Jawaban: "sin(x)" ❌ (Seharusnya: cos(x))
  Waktu: 15 detik (Median: 50 detik) → 30% = CEPAT 🚀

  Level: 5 (TETAP, 1x salah - mungkin teledor)
  Poin: 0 (reset)
  💬 "Salah + Cepat (mungkin teledor) → Tetap (Diberi kesempatan)"

─────────────────────────────────────────────────────────────────
Soal 2: "Apa hasil dari ∫x dx?"
  Jawaban: "x" ❌ (Seharusnya: x²/2 + C)
  Waktu: 40 detik (Median: 50 detik) → 80% = SEDANG ⏱️

  Level: 5 → 4 (TURUN! 2x Salah berturut-turut)
  Poin: 0 (reset)
  💬 "2x Salah berturut-turut → Turun 1 level"

─────────────────────────────────────────────────────────────────
Soal 3: "Berapa 12 × 8?"
  Jawaban: "96" ✅
  Waktu: 30 detik (Median: 40 detik) → 75% = SEDANG ⏱️

  Poin: 0 + 1 = 1
  Level: 4 (TETAP, 1/3 konsistensi sedang)

─────────────────────────────────────────────────────────────────
Soal 4: "Apa ibu kota Prancis?"
  Jawaban: "Paris" ✅
  Waktu: 20 detik (Median: 35 detik) → 57% = CEPAT 🚀

  Level: 4 → 5 (NAIK! Benar+Cepat)
  Poin: 0 (reset)

─────────────────────────────────────────────────────────────────
HASIL AKHIR:
🎯 Level: 5 → 5 (Turun ke 4, lalu kembali ke 5)
📊 Statistik: 4 soal, 2 benar, 2 salah
⭐ Performa: RECOVERY
💬 Kesimpulan: Siswa gegabah di awal, tapi bisa recover!
```

---

## 9. Flowchart & Diagram

### 9.1 Flowchart Utama

```
                    START
                      │
                      ▼
        ┌─────────────────────────┐
        │   Siswa Jawab Soal      │
        │ (correct, timeTaken)    │
        └───────────┬─────────────┘
                    │
                    ▼
        ┌─────────────────────────┐
        │ Hitung Kecepatan        │
        │ (cepat/sedang/lambat)   │
        └───────────┬─────────────┘
                    │
                    ▼
        ┌─────────────────────────┐
        │ Ambil 5 Soal Terakhir   │
        │ (Sliding Window)        │
        └───────────┬─────────────┘
                    │
                    ▼
            ┌───────┴───────┐
            │ Jawaban Benar?│
            └───────┬───────┘
          ┌─────────┴──────────┐
         YA                    TIDAK
          │                      │
          ▼                      ▼
    ┌──────────┐          ┌───────────┐
    │ CEPAT?   │          │ LAMBAT?   │
    └────┬─────┘          └─────┬─────┘
        YA│   TIDAK           YA│   TIDAK
          │                      │
          ▼                      ▼
    ┌──────────┐          ┌───────────┐
    │ NAIK +1  │          │ TURUN -1  │
    │ (Reset)  │          │ (Reset)   │
    └──────────┘          └───────────┘
          │                      │
          │                      ▼
          │               ┌───────────┐
          │               │2x Salah?  │
          │               └─────┬─────┘
          │                   YA│   TIDAK
          │                     │
          ▼                     ▼
    ┌──────────┐          ┌───────────┐
    │ SEDANG?  │          │ TURUN -1  │
    └────┬─────┘          │ (Reset)   │
      YA │   TIDAK        └───────────┘
         │                      │
         ▼                      │
    ┌──────────┐                │
    │3x Sedang?│                │
    └────┬─────┘                │
      YA │   TIDAK              │
         │                      │
         ▼                      ▼
    ┌──────────┐          ┌───────────┐
    │ NAIK +1  │          │  TETAP    │
    │ (Reset)  │          │(Poin: 0)  │
    └──────────┘          └───────────┘
         │                      │
         │                      │
         ▼                      ▼
    ┌──────────┐                │
    │ LAMBAT?  │                │
    └────┬─────┘                │
      YA │   TIDAK              │
         │                      │
         ▼                      │
    ┌──────────┐                │
    │3x Lambat?│                │
    └────┬─────┘                │
      YA │   TIDAK              │
         │                      │
         ▼                      ▼
    ┌──────────┐          ┌───────────┐
    │ NAIK +1  │          │  TETAP    │
    │ (Reset)  │          │(Simpan Poin)│
    └──────────┘          └───────────┘
         │                      │
         └──────────┬───────────┘
                    │
                    ▼
        ┌─────────────────────────┐
        │   Return Result:        │
        │ - New Level             │
        │ - Level Change          │
        │ - Reason                │
        │ - Points                │
        └─────────────────────────┘
                    │
                    ▼
                    END
```

### 9.2 Diagram Sistem Poin

```
CONSECUTIVE POINTS SYSTEM
═══════════════════════════════════════════════

Jawaban BENAR Berturut-turut:
┌─────┬─────┬─────┬─────┬─────┐
│ +2  │ +1  │ +2  │ +1  │ +0  │
│Cepat│Sedng│Cepat│Sedng│Lambat│
└──┬──┴──┬──┴──┬──┴──┬──┴──┬──┘
   │     │     │     │     │
   2     3     5    (NAIK) 0
                    RESET

Jawaban SALAH (Combo Putus):
┌─────┬─────┬─────┐
│ +2  │ +1  │  ❌ │
│Cepat│Sedng│Salah│
└──┬──┴──┬──┴──┬──┘
   │     │     │
   2     3     0 (RESET!)
```

### 9.3 Timeline Kenaikan Level

```
FAST TRACK (Benar + Cepat):
════════════════════════════
Level 3 ─🚀─> Level 4 ─🚀─> Level 5 ─🚀─> Level 6
        (1x)         (1x)         (1x)

Total: 3 soal untuk naik 3 level!


STEADY TRACK (Benar + Sedang):
═══════════════════════════════
Level 3 ─⏱️─⏱️─⏱️─> Level 4 ─⏱️─⏱️─⏱️─> Level 5
        (3x)              (3x)

Total: 6 soal untuk naik 2 level


SLOW TRACK (Benar + Lambat):
════════════════════════════
Level 3 ─🐌─🐌─🐌─> Level 4 ─🐌─🐌─🐌─> Level 5
        (3x)              (3x)

Total: 6 soal untuk naik 2 level


MIXED TRACK (Kombinasi):
════════════════════════
Level 3 ─⏱️─⏱️─🚀─> Level 4 ─🐌─🐌─⏱️─> Level 5
        (1+1+naik)        (0+0+1)

Fleksibel tergantung performa!
```

---

## 10. Keunggulan Sistem

### 10.1 Untuk Siswa 👨‍🎓

1. **Personalized Learning**

   - Setiap siswa belajar sesuai kecepatannya
   - Tidak ada siswa yang terlalu cepat atau terlalu lambat

2. **Fair & Tidak Menghukum**

   - Kesalahan lama tidak terus diingat (sliding window)
   - Diberi kesempatan untuk belajar dari kesalahan

3. **Motivasi Tinggi**

   - Benar+Cepat langsung naik → instant gratification!
   - Tidak frustasi karena level sesuai kemampuan

4. **Transparan**
   - Setiap keputusan ada reasoningnya
   - Siswa tahu kenapa level naik/turun

### 10.2 Untuk Guru 👨‍🏫

1. **Data-Driven Insights**

   - Melihat pola belajar siswa secara real-time
   - Identifikasi siswa yang butuh bantuan ekstra

2. **Efisien**

   - Tidak perlu manual adjust tingkat kesulitan
   - Sistem otomatis menyesuaikan

3. **Explainable AI**
   - Reasoning jelas untuk setiap keputusan
   - Mudah dijelaskan ke orang tua/stakeholder

### 10.3 Untuk Sistem 🤖

1. **Robust & Stabil**

   - Stabilizer mencegah fluktuasi level terlalu cepat
   - Sliding window fokus pada performa terkini

2. **Multi-Dimensional**

   - Tidak hanya melihat benar/salah
   - Mempertimbangkan kecepatan & konsistensi

3. **Adaptif & Responsif**
   - Real-time adjustment
   - Cepat bereaksi terhadap perubahan performa

---

## 11. FAQ (Pertanyaan yang Sering Ditanya)

### Q1: Kenapa Benar + Cepat langsung naik, tapi Benar + Sedang perlu akumulasi 3 poin?

**A:** Karena Benar + Cepat menunjukkan **2 bukti sekaligus**:

1. Siswa PAHAM materi (benar)
2. Siswa EFISIEN (cepat)

Sedangkan Benar + Sedang hanya menunjukkan 1 bukti (paham). Jadi perlu **akumulasi 3 poin** untuk membuktikan performa yang cukup baik.

**Perbedaan Penting:**

- Benar + Sedang = **AKUMULASI** (poin bisa dikumpulkan dari berbagai jawaban benar)
- Benar + Lambat = **KONSISTENSI** (harus 3x berturut-turut dengan kecepatan lambat)

---

### Q2: Apa bedanya AKUMULASI (Benar+Sedang) vs KONSISTENSI (Benar+Lambat)?

**A:** Ini adalah **perbedaan paling penting** dalam sistem kami!

#### **AKUMULASI (Benar + Sedang):**

```
✅ Fleksibel: Poin bisa dikumpulkan dari kombinasi jawaban
✅ Mixed speed: Bisa campuran Sedang, Lambat, bahkan Cepat
✅ Toleran: Satu jawaban lambat tidak reset poin
✅ Target: 3 poin untuk naik level

Contoh:
Soal 1: Benar+Sedang (+1) → Poin: 1
Soal 2: Benar+Lambat (+0) → Poin: 1 (tidak reset!)
Soal 3: Benar+Sedang (+1) → Poin: 2
Soal 4: Benar+Sedang (+1) → Poin: 3 → NAIK! ✅
```

#### **KONSISTENSI (Benar + Lambat):**

```
❌ Ketat: Harus 3x berturut-turut dengan kecepatan lambat
❌ Strict: Satu jawaban non-lambat = reset streak
❌ No mixed: Tidak bisa campuran
✅ Target: 3x berturut-turut untuk naik level

Contoh:
Soal 1: Benar+Lambat → Streak: 1
Soal 2: Benar+Lambat → Streak: 2
Soal 3: Benar+Sedang ⏱️ → Streak: 0 (RESET!) ❌
Soal 4: Benar+Lambat → Streak: 1 (mulai lagi)
```

**Kenapa Berbeda?**

- Benar+Sedang memberikan +1 poin → bisa akumulasi
- Benar+Lambat memberikan 0 poin → kalau pakai akumulasi, tidak akan pernah naik!
- Jadi Benar+Lambat pakai sistem konsistensi untuk tetap bisa naik level

---

### Q3: Bisakah siswa naik level dengan kombinasi Sedang dan Lambat?

**A:** **YA!** Inilah keunggulan sistem AKUMULASI!

**Contoh:**

```
Siswa Level 3, Poin: 0

Soal 1: Benar+Sedang (+1) → Poin: 1
Soal 2: Benar+Lambat (+0) → Poin: 1 (tidak reset!)
Soal 3: Benar+Sedang (+1) → Poin: 2
Soal 4: Benar+Lambat (+0) → Poin: 2 (tidak reset!)
Soal 5: Benar+Sedang (+1) → Poin: 3 → NAIK! ✅

Total: 3x Sedang + 2x Lambat = 3 poin = NAIK LEVEL!
```

**Tapi untuk Benar+Lambat:**

```
Soal 1: Benar+Lambat → Streak: 1
Soal 2: Benar+Lambat → Streak: 2
Soal 3: Benar+Sedang → Streak: 0 (KONSISTENSI PUTUS!) ❌
Soal 4: Benar+Lambat → Streak: 1 (mulai dari awal)
Soal 5: Benar+Lambat → Streak: 2 (belum naik)

Tidak naik karena konsistensi lambat putus di soal 3!
```

---

### Q4: Kenapa Benar + Lambat tetap bisa naik level?

**A:** Karena yang penting adalah **PEMAHAMAN**, bukan kecepatan. Siswa yang lambat bukan berarti bodoh, mungkin:

- Masih belajar dan butuh waktu lebih lama
- Lebih teliti dalam menjawab
- Belum terbiasa dengan format soal

Dengan konsistensi 3x Benar + Lambat, terbukti siswa **PAHAM** materi, hanya butuh waktu lebih lama.

**Bedanya dengan Benar+Sedang:**

- Benar+Sedang: AKUMULASI poin (fleksibel, bisa mixed)
- Benar+Lambat: KONSISTENSI (harus 3x berturut-turut)

---

### Q5: Kenapa Salah + Cepat tidak langsung turun?

**A:** Karena mungkin siswa hanya **TELEDOR** atau **GEGABAH**, bukan tidak paham. Diberi kesempatan 1x. Kalau salah lagi (2x berturut-turut), baru turun.

**Contoh:**

```
Soal: "Apa ibu kota Indonesia?"
Siswa jawab: "Bandung" ❌ (30% dari median) → CEPAT

Kemungkinan:
1. Siswa terburu-buru (teledor)
2. Salah baca soal
3. Klik tombol yang salah

Bukan berarti tidak tahu jawabannya!
```

---

### Q6: Apa bedanya consecutive points dengan total points?

**A:**

**Consecutive Points:**

- Hanya menghitung jawaban BENAR berturut-turut
- Reset ke 0 jika ada jawaban SALAH
- Digunakan untuk sistem AKUMULASI (naik level)
- Tidak bisa negatif

**Total Points (tidak dipakai lagi):**

- Menghitung SEMUA jawaban (benar & salah)
- Bisa negatif
- Lebih rumit & tidak fair
- Sudah ditinggalkan

**Contoh:**

```
Soal 1: Benar+Sedang (+1)
Soal 2: Benar+Sedang (+1)
Soal 3: Salah+Lambat

Consecutive Points: 0 (reset karena salah) ✅ Yang kami pakai
Total Points: 1+1-2 = 0 (tidak reset) ❌ Tidak dipakai

Kami pakai Consecutive karena lebih fair!
```

---

### Q7: Kenapa sliding window hanya 5 soal?

**A:**

**Terlalu kecil (< 5):**

- Terlalu sensitif
- Bisa naik/turun terlalu cepat
- Tidak stabil

**Terlalu besar (> 5):**

- Terlalu lambat bereaksi
- Kesalahan lama terus diingat
- Tidak fair untuk siswa yang belajar

**5 soal = Sweet spot!**

- Cukup untuk melihat pola
- Tidak terlalu sensitif
- Responsif terhadap perubahan

---

### Q8: Bagaimana kalau siswa asal jawab semua soal dengan cepat?

**A:** Sistem kami mencegah ini dengan:

1. **Benar + Cepat = Naik** (positif reinforcement)
2. **Salah + Cepat (pertama) = Tetap** (peringatan)
3. **Salah 2x berturut-turut = Turun** (hukuman)

**Contoh:**

```
Siswa asal jawab cepat:
Soal 1: Salah+Cepat → TETAP (peringatan)
Soal 2: Salah+Cepat → TURUN! (2x salah)
Soal 3: Salah+Cepat → TURUN lagi!

Hasilnya: Level turun terus sampai Level 1
```

Jadi sistem **TIDAK** bisa di-exploit!

---

## 12. Kesimpulan

Sistem Rule-Based Adaptif Adaptivin adalah solusi pembelajaran yang:

✅ **Personalized** - Setiap siswa belajar sesuai kecepatannya
✅ **Fair** - Tidak menghukum kesalahan lama
✅ **Transparent** - Setiap keputusan ada alasannya
✅ **Motivating** - Instant feedback untuk performa baik
✅ **Robust** - Stabil dan tidak mudah di-exploit
✅ **Explainable** - Mudah dipahami oleh semua pihak

Dengan kombinasi aturan yang komprehensif dan sistem poin yang fair, kami memberikan **pengalaman belajar adaptif terbaik** untuk setiap siswa!

---

## 13. Referensi Teknis

### Input Format

```javascript
{
  currentLevel: 3,              // Level siswa saat ini (1-6)
  answers: [                    // Array 5 jawaban terakhir
    {
      correct: true,            // Benar/salah
      timeTaken: 35,           // Waktu yang digunakan (detik)
      medianTime: 60,          // Median waktu soal (detik)
      questionLevel: 3         // Level soal (opsional)
    },
    // ... 4 jawaban lainnya
  ],
  currentPoints: 0             // Poin consecutive saat ini
}
```

### Output Format

```javascript
{
  newLevel: 4,                 // Level baru
  levelChange: "naik",         // "naik" | "turun" | "tetap"
  reason: "Benar + Cepat → Naik 1 level",
  points: 0,                   // Poin setelah perubahan
  analysis: {                  // Detail analisis
    totalPoints: 2,
    consecutiveCorrect: 3,
    consecutiveWrong: 0,
    consecutiveFastCorrect: 1,
    consecutiveMediumCorrect: 2,
    consecutiveSlowCorrect: 0,
    recentAnswers: [...]       // Detail per soal
  }
}
```

---

**Dokumentasi ini disusun untuk:**

- **Lomba Inovasi Digital Mahasiswa (LIDM)**
- **Tim Adaptivin - 2025**
- **Kategori: Pendidikan Adaptif**

---

**Kontak:**

- Email: adaptivin@example.com
- Website: adaptivin.com
- GitHub: github.com/adaptivin

---

**Terima kasih telah menggunakan Adaptivin! 🎓✨**
