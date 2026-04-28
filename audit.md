# 🔍 AUDIT KODE MENDALAM - Daily Log Teknisi (PWA)
**Tanggal Audit:** 28 April 2026  
**Scope:** app.js, code.gs, index.html  
**Fokus:** Data Loss, Race Conditions, Silent Failures, State Inconsistency

---

## ⚠️ DAFTAR MASALAH YANG MASIH AKTIF

### **KATEGORI 1: RACE CONDITION & ANTREAN SYNCHRONIZATION**

#### **Masalah 1.1: Multiple jalankanSync() Calls Tanpa Throttle**
- **Lokasi:** [app.js](app.js#L2800), [app.js](app.js#L3100)
- **Deskripsi:** `jalankanSync()` dipanggil dari 3 tempat:
  1. `setInterval(..., 10000)` line ~2800
  2. `window.addEventListener('online', jalankanSync)` line ~3100
  3. Di akhir setiap operasi `eksekusiSimpanGPS()`, `kirimDataParsial()`
- **Celah:** Global flag `isSyncing` bisa diakses bersamaan jika:
  - Internet offline-online-offline terjadi cepat
  - Interval timer trigger sambil online event sedang proses
  - Pengguna switch teknisi saat sync sedang berjalan
- **Risiko:** Antrean item diproses dari multiple threads logis, leading to corrupted `antreanLog` state atau `.shift()` dijalankan berkali-kali untuk item yang sama.

#### **Masalah 1.2: jalankanSync() Loop Tidak Check Koneksi di Dalam Iterasi**
- **Lokasi:** [app.js](app.js#L2820-L2850)
- **Deskripsi:** 
  ```javascript
  while (true) {
      let antrean = JSON.parse(...);
      if (antrean.length === 0) break;
      // ... fetch execution ...
      if (resJson.status === 'success') {
          antreanUpdate.shift();  // <-- SELALU SHIFT TANPA VALIDASI BACKEND
      }
  }
  ```
- **Celah:** Loop hanya break jika `antrean.length === 0` atau catch exception. Tidak ada check `navigator.onLine` di dalam loop.
- **Risiko:** Jika koneksi terputus di tengah fetch (partial response/timeout), exception dikatch dan loop break, tapi `isSyncing = false` di finally. Saat internet balik, `jalankanSync()` dipanggil lagi dan mungkin retry item yang sudah corrupted.

#### **Masalah 1.3: Backend Silent Failure pada Update Actions**
- **Lokasi:** [code.gs](code.gs#L90-L120), [code.gs](code.gs#L55-L75)
- **Deskripsi (update_sampai/update_selesai):**
  ```javascript
  if (action === "update_sampai") {
      let lastRow = sheet.getLastRow();
      if (lastRow > 1) {
          let ids = sheet.getRange(...).getValues();
          for (let i = ids.length - 1; i >= 0; i--) { 
              if (ids[i][0] === data.taskId) {
                  sheet.getRange(i + 2, 3).setValue(data.jamSampai);
                  break;  // <-- JIKA TASKID TIDAK KETEMU, TIDAK ADA BREAK
              }
          }
      }
  }
  return ContentService.createTextOutput(JSON.stringify({ "status": "success" }))  // SELALU SUCCESS!
  ```
- **Celah:** Backend TIDAK mengecek apakah `taskId` ditemukan di sheet atau tidak. Return `success` di kedua kasus: taskId found OR taskId not found.
- **Risiko:** Frontend menerima success signal dan memanggil `.shift()` antrean, padahal data sebenarnya tidak terupdate di server. **Permanent data loss** saat pengguna restart app.

#### **Masalah 1.4: Backend delete_task Juga Silent Failure**
- **Lokasi:** [code.gs](code.gs#L55-L70)
- **Deskripsi:** Mirip dengan update actions, `delete_task` tidak validate apakah row berhasil dihapus.
- **Celah:** Return success meskipun taskId tidak ditemukan di sheet.
- **Risiko:** Jika pengguna batalkan tugas saat offline, antrean punya `delete_task` action. Saat online, jika task sudah terhapus dari sheet (atau di history), backend return success, frontend shift, tapi sebenarnya row yang salah terhapus atau tidak ada yang terhapus.

---

### **KATEGORI 2: KETIDAKKONSISTENAN UI STATE VS DATA**

#### **Masalah 2.1: tiketTugasAktif State Tidak Atomic Terhadap Antrean**
- **Lokasi:** [app.js](app.js#L2450), [app.js](app.js#L2470)
- **Deskripsi:** 
  - `simpanStateTiket()` simpan state ke localStorage
  - `kirimDataParsial()` push payload ke antrean
  - Dua write operations tidak atomic
- **Celah:** Browser crash antara kedua operasi → state tersimpan tapi payload belum di antrean OR sebaliknya.
- **Risiko:** 
  - User lihat UI state SAMPAI, tapi antrean kosong → task hilang sama sekali
  - Antrean punya payload tapi state file incomplete → inconsistent recovery saat app restart

#### **Masalah 2.2: logData Global Variable vs localStorage Dualisme**
- **Lokasi:** [app.js](app.js#L30), [app.js](app.js#L2665)
- **Deskripsi:**
  ```javascript
  let logData = JSON.parse(localStorage.getItem('dailyLogTeknisi')) || [];  // Line 30
  // ... later in eksekusiSimpanGPS() ...
  logData.push(dataBaru);  // Push ke global variable
  localStorage.setItem('dailyLogTeknisi', JSON.stringify(logData));  // Push ke storage
  tampilkanLog();  // Display dari logData
  ```
- **Celah:** Ada dua source of truth (logData dan localStorage). Jika service worker refresh cache, logData tidak sync dengan persisted state.
- **Risiko:** 
  - User lihat tugas di UI (dari logData), tapi localStorage hilang (cache clear)
  - Saat refresh, tugas hilang karena localStorage kosong
  - Dashboard mengambil dari localStorage tapi UI show dari logData → mismatch

#### **Masalah 2.3: Multi-Tab Konflict pada tiketTugasAktif**
- **Lokasi:** [app.js](app.js#L2450), [app.js](app.js#L2453)
- **Deskripsi:** `tiketTugasAktif` disimpan di localStorage yang shared across browser tabs.
- **Celah:** 
  - Tab 1: User start journey → state = SAMPAI, push update_sampai ke antrean
  - Tab 2: User buka app (dari other device atau tab) → restore state = SAMPAI
  - Tab 2: User slide SELESAI, push update_selesai ke antrean
  - Now antrean punya duplicate updates untuk same taskId
- **Risiko:** Backend menerima update_selesai sebelum update_sampai selesai, atau update dijalankan ganda, atau state corrupted.

#### **Masalah 2.4: State Recovery Post-Refresh Tidak Idempotent**
- **Lokasi:** [app.js](app.js#L2453) - `pulihkanStateTiket()`
- **Deskripsi:** Saat app refresh, state di-restore dari localStorage. Jika sync belum complete sebelum refresh:
  - State sudah SAMPAI (persisted)
  - Tapi update_sampai payload masih di antrean (pending)
  - App restart: state restore ke SAMPAI, UI show active ticket
  - `jalankanSync()` process antrean → update_sampai terkirim
- **Celah:** Jika backend tidak find taskId (e.g., task sudah di-history), silent failure terjadi, antrean shift, tapi state masih SAMPAI.
- **Risiko:** Next app restart akan melihat state SAMPAI tapi task tidak ada di server. User bingung state inconsistent.

---

### **KATEGORI 3: DATA LOSS SCENARIOS**

#### **Masalah 3.1: GPS Fetch Interrupt → Complete Data Loss**
- **Lokasi:** [app.js](app.js#L2530) - `mintaGPSDanSimpan()`, [app.js](app.js#L2540) - `eksekusiSimpanGPS()`
- **Deskripsi:** 
  ```javascript
  function mintaGPSDanSimpan(payload) {
      navigator.geolocation.getCurrentPosition(
          (pos) => eksekusiSimpanGPS(pos.coords..., payload),
          (err) => eksekusiSimpanGPS("GPS Offline", payload),
          { timeout: 5000 }
      );
  }
  ```
- **Celah:** User complete kunjungan (state = SELESAI), geser slide, fungsi call GPS. Sebelum callback dipanggil:
  - Browser crash
  - User force refresh
  - Power off device
- **Risiko:** 
  - State sudah di-reset ke BERANGKAT
  - Form sudah di-clear
  - Tapi GPS callback belum execute → `eksekusiSimpanGPS()` tidak jalan
  - Payload TIDAK tersimpan ke antrean
  - Data tugas **hilang selamanya** (tidak di localStorage, tidak di server, tidak di antrean)

#### **Masalah 3.2: Fetch Response Parsing Error Silent Failure**
- **Lokasi:** Multiple fetch calls: [app.js](app.js#L1140), [app.js](app.js#L1255), [code.gs](code.gs#L2820)
- **Deskripsi:**
  ```javascript
  const respon = await fetch(scriptURL, {...});
  const resJson = await respon.json();  // <-- Bisa throw error jika response bukan JSON
  if (resJson.status === 'success') { ... }
  ```
- **Celah:** Jika server return error HTML page (500 error) atau malformed response, `.json()` throw exception. Exception di-catch di try-catch, tapi tidak log/alert user.
- **Risiko:** User tidak tahu fetch gagal. Antrean item stay di queue tetapi silently retried selamanya. Atau jika exception di outer catch, loop break tanpa clear state.

#### **Masalah 3.3: Antrean Item Orphaned saat Koneksi Flaky**
- **Lokasi:** [app.js](app.js#L2820-L2850)
- **Deskripsi:**
  ```javascript
  try {
      const respon = await fetch(...);
      const resJson = await respon.json();
      if (resJson.status === 'success') { antreanUpdate.shift(); }
      else if (resJson.status === 'error') { break; }
  } catch (error) {
      break;  // <-- BREAK TAPI TIDAK CLEAR ITEM
  }
  ```
- **Celah:** Jika fetch throw error (network timeout, DNS fail), catch block break loop tapi TIDAK handle antrean. Item masih di queue.
- **Risiko:** 
  - Next `jalankanSync()` call (10s later) retry sama item
  - Jika yang error adalah task yang sudah success di server (double-send), backend silent fail, antrean shift... but jika error adalah network issue, antrean tidak clear
  - Infinite retry loop yang tidak visible (no UI feedback)

#### **Masalah 3.4: Dashboard History Fetch Not Atomic**
- **Lokasi:** [app.js](app.js#L1120) - `muatHistoriSepekan()`, [app.js](app.js#L1180) - `muatLogHariIni()`, [app.js](app.js#L950) - `muatDashboardStats()`
- **Deskripsi:**
  ```javascript
  await muatHistoriSepekan();   // Fetch dari History_{name} sheet
  await muatLogHariIni();        // Fetch dari main {name} sheet
  await muatDashboardStats();    // Display stats dari dua sumber di atas
  ```
- **Celah:** Dua fetch independent. Jika `muatHistoriSepekan()` success tapi `muatLogHariIni()` fail (atau timeout), dashboard akan menampilkan incomplete data.
- **Risiko:** User lihat chart dengan missing hari-ini tasks. Confusion: "Kok tugas hari ini tidak tercount?"

---

### **KATEGORI 4: BACKEND TRANSACTION INTEGRITY**

#### **Masalah 4.1: Spreadsheet Lock Tidak Comprehensive**
- **Lokasi:** [code.gs](code.gs#L1-L5)
- **Deskripsi:**
  ```javascript
  let lock = LockService.getScriptLock();
  lock.waitLock(10000);  // <-- Lock hanya di awal doPost
  // ... multiple sheet operations ...
  finally { lock.releaseLock(); }
  ```
- **Celah:** Lock hanya cover `doPost()` entry point. Tapi jika:
  - Multiple requests concurrent ke same sheet
  - Scheduled triggers (pindahkanLogKeHistory, cleanupExpiredAnnouncements) running parallel dengan doPost
  - Lock timeout 10 detik mungkin tidak cukup untuk large data operations
- **Risiko:** Race condition antara concurrent writes. Misalnya:
  - Request A append data
  - Request B delete row
  - Hasil: row indices berubah, data keseleo atau hilang

#### **Masalah 4.2: History Sheet Creation Not Transactional**
- **Lokasi:** [code.gs](code.gs#L320-L360) - `pindahkanLogKeHistory()`
- **Deskripsi:**
  ```javascript
  sheets.forEach(sheet => {
      let historySheet = ss.getSheetByName("History_" + sheetName);
      if (!historySheet) {
          historySheet = ss.insertSheet(...);
          historySheet.appendRow(headers);
      }
      values.forEach(row => historySheet.appendRow(row));
      sheet.deleteRows(2, lastRow - 1);  // <-- DELETE setelah append
  });
  ```
- **Celah:** Sequence adalah: create sheet → append header → append data → delete rows. Jika crash di tengah:
  - Sheet dibuat tapi header belum
  - Data diappend sebagian
  - Rows sudah didelete dari main sheet
  - Result: data corruption & unrecoverable loss
- **Risiko:** Midnight trigger gagal sebagian, next day data tidak ada.

#### **Masalah 4.3: Sheet Header Existence Check Fragile**
- **Lokasi:** [code.gs](code.gs#L160) - `if (sheet.getRange(1, 11).getValue() !== "TaskID") sheet.getRange(1, 11).setValue("TaskID");`
- **Deskripsi:** Hanya check kolom K (11) apakah ada header TaskID. Tidak check kolom lain.
- **Celah:** Jika sheet dibuat manual atau corrupted, header mungkin incomplete. Append data kemudian mungkin overwrite existing row atau create mismatch.
- **Risiko:** Data format inconsistent, backend query logic fail.

---

### **KATEGORI 5: ERROR HANDLING GAPS & MISSING VALIDATION**

#### **Masalah 5.1: Backend Tidak Validasi taskId Format**
- **Lokasi:** [code.gs](code.gs#L90-L120)
- **Deskripsi:** Backend expect taskId di kolom 11, tapi tidak validate format atau existence sebelum loop.
- **Celah:** Jika:
  - Frontend send empty taskId
  - Frontend send malformed taskId
  - Backend akan loop tapi tidak find, return success anyway
- **Risiko:** Silent failure dengan zero error signal.

#### **Masalah 5.2: Frontend Tidak Validate Required Fields Before Push Antrean**
- **Lokasi:** [app.js](app.js#L2475), [app.js](app.js#L2540-L2580)
- **Deskripsi:**
  ```javascript
  function kirimDataParsial(aksi) {
      const payload = { action: aksi, taskId: aktifTaskId, ... };
      // Tidak ada check apakah taskId empty atau invalid
      let antrean = JSON.parse(...);
      antrean.push(payload);
      localStorage.setItem('antreanLog', JSON.stringify(antrean));
  }
  ```
- **Celah:** `aktifTaskId` mungkin empty string jika crash sebelum assignment.
- **Risiko:** Antrean punya invalid item yang backend reject dengan error, tapi frontend tidak handle, loop break, item orphaned.

#### **Masalah 5.3: Pengumuman System TTL Race Condition**
- **Lokasi:** [app.js](app.js#L1935-L2000)
- **Deskripsi:**
  ```javascript
  cekPengumuman();  // Called every 10 seconds
  if (selisihDetik > durasi) { clearAllPengumuman(); }
  ```
- **Celah:** Multi-tab → Tab A buka pengumuman, Tab B buka juga. Durasi TTL independent per tab (based on localStorage waktuMulai).
- **Risiko:** 
  - Tab A clear pengumuman tapi Tab B masih tampilin
  - User confused atau lihat inconsistent UI
  - Jika admin update pengumuman, semua tab mungkin tidak sync clear timing

---

### **KATEGORI 6: RACE CONDITIONS KHUSUS SAAT USER INTERRUPT**

#### **Masalah 6.1: Technician Name Change While Sync Pending**
- **Lokasi:** [app.js](app.js#L2565) - `simpanNamaDanSync()`
- **Deskripsi:**
  ```javascript
  function simpanNamaDanSync() {
      simpanNama();  // Update logSettingNama
      localStorage.removeItem('dailyLogTeknisi');
      logData = [];
      mulaiSyncManual();  // Call muatHistoriSepekan() etc.
  }
  ```
- **Celah:** Jika ada pending antrean item dengan old technician name:
  - Antrean item punya `nama: "John"` (old)
  - User change to "Jane" (new)
  - muatHistoriSepekan() request fetch dengan new name
  - Tapi antrean still punya old name
- **Risiko:** 
  - Next sync akan send items dengan old name ke new sheet "Jane"
  - Backend create new sheet or append to old sheet with confusing data

#### **Masalah 6.2: Service Worker Cache Drift**
- **Lokasi:** [app.js](app.js#L3080-L3110)
- **Deskripsi:** Service worker cache app.js. Jika update ada, old JS logic bisa run dengan new localStorage data.
- **Celah:** 
  - Service worker cache outdated app.js version
  - localStorage sudah updated dengan new schema
  - Old JS code logic not compatible
- **Risiko:** App crash atau silent logic error.

#### **Masalah 6.3: Dashboard Concurrent Refresh Calls**
- **Lokasi:** [app.js](app.js#L950) - `muatDashboardStats()` call multiple fetch
- **Deskripsi:**
  ```javascript
  await populateDailyChart();
  if (currentDashboardTab === 'hari') {
      generateDatePills();
  }
  ```
- **Celah:** Jika user switch date pill sambil chart still rendering, multiple `populateDailyChart()` atau `generateDatePills()` calls concurrent.
- **Risiko:** Canvas race condition, memory leak, or display glitch.

---

### **KATEGORI 7: SPECIFIC DEADLY DATA LOSS PATHWAYS**

#### **Masalah 7.1: Update_selesai Task Not Found in Sheet**
- **Scenario:**
  1. User complete kunjungan, geser SELESAI, push `update_selesai` ke antrean (offline)
  2. Midnight trigger `pindahkanLogKeHistory()` jalankan
  3. Task dipindah ke History_{name} sheet
  4. Internet balik, sync process: `jalankanSync()` fetch update_selesai
  5. Backend cari di main sheet, tidak ketemu (sudah di history)
  6. Backend return success anyway (silent failure per Masalah 3.1)
  7. Frontend shift antrean
- **Result:** Task permanently lost (tidak di main sheet, tidak di history sheet dengan update_selesai data)

#### **Masalah 7.2: Double-Shift on Retry**
- **Scenario:**
  1. Antrean: [item1, item2, item3]
  2. jalankanSync() process item1, fetch success, shift → [item2, item3]
  3. Concurrent jalankanSync() call (window online event) juga process
  4. Both call fetch for item1... tapi item1 sudah shift
  5. Now fetch untuk item2... tapi item1 di server might not have data
- **Result:** Antrean bisa skip items atau process wrong items

#### **Masalah 7.3: Incomplete Antrean Recovery After Offline Period**
- **Scenario:**
  1. Antrean punya 5 items, user offline for 2 hours
  2. Sync process 2 items successfully, then network fail mid-item-3
  3. Browser close
  4. User offline for 1 more hour
  5. User reopen app, saat online → muatHistoriSepekan() + muatLogHariIni() fetch fresh data
  6. Dashboard refresh might overwrite stale antrean item3 with data from server
- **Result:** Antrean inconsistent dengan server state

---

### **KATEGORI 8: VALIDATION & INPUT SANITIZATION GAPS**

#### **Masalah 8.1: taskId Format Not Validated at Frontend**
- **Lokasi:** [app.js](app.js#L2410) - `aktifTaskId = "T" + Date.now();`
- **Deskripsi:** taskId format adalah `"T" + timestamp`. Tidak ada check di backend apakah format valid.
- **Risiko:** Jika time sync off atau clock skew, duplicate taskIds bisa terjadi.

#### **Masalah 8.2: Nama Input Not Sanitized**
- **Lokasi:** [app.js](app.js#L2565) - `simpanNama()`
- **Deskripsi:** User input nama tidak di-sanitize sebelum kirim ke backend.
- **Celah:** User input nama dengan special character atau XSS payload
- **Risiko:** Backend might fail atau create malformed sheet name.

---

## 📊 **RINGKASAN RISIKO DATA LOSS**

| Scenario | Probability | Data Loss | Mitigasi Saat Ini |
|----------|-------------|-----------|-------------------|
| Complete GPS interrupt | **HIGH** | Full task data | None |
| Backend silent failure + offline | **HIGH** | Antrean item | None |
| Multi-tab conflict | **MEDIUM** | Duplicate sync | None |
| Network flaky during sync | **MEDIUM** | Orphaned antrean | Retry timeout only |
| Concurrent jalankanSync() | **MEDIUM** | Skipped items | Global flag (weak) |
| State/Antrean mismatch | **MEDIUM** | Inconsistent state | Offline-first cache |

---

## 🎯 **MOST CRITICAL ISSUES**

1. **Backend Silent Failure (Masalah 1.3, 1.4)** - Return success tanpa validate perubahan
2. **GPS Interrupt Data Loss (Masalah 3.1)** - Task hilang selamanya sebelum save
3. **Multi-Call Race Condition (Masalah 1.1)** - Concurrent sync bisa corrupt antrean
4. **Non-Atomic State Operations (Masalah 2.1)** - State dan antrean tidak synchronized

---

## 📝 **NOTES**

- Semua masalah di atas berpotensi menyebabkan **permanent data loss** jika terjadi interupsi atau edge case tertentu
- Mitigasi saat ini (offline-first + retry) tidak cukup karena tidak ada validation di backend
- User experience akan terdampak karena zero error visibility untuk silent failures

---

**Audit Selesai:** 28 April 2026, 22:00 WIB  
**Status:** Ready for Remediation Planning
