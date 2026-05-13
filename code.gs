function doPost(e) {
  let lock = LockService.getScriptLock();
  try {
    // AUDIT FIX 4.1: Tingkatkan timeout lock dari 10 detik ke 15 detik untuk operasi lebih kompleks
    lock.waitLock(15000);
    
    let data = JSON.parse(e.postData.contents);
    let ss = SpreadsheetApp.getActiveSpreadsheet();
    let action = data.action || "simpan";

    // ==========================================
    // 1. AMBIL DAFTAR TEKNISI UNTUK TAB TIM
    // ==========================================
    if (action === "get_teknisi") {
      let listNama = [];
      ss.getSheets().forEach(sheet => {
        let sName = sheet.getName();
        if (!sName.startsWith("History_") && sName !== "Sheet1" && sName !== "Pengumuman") listNama.push(sName);
      });
      return ContentService.createTextOutput(JSON.stringify({ "status": "success", "data": listNama })).setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // 2. AMBIL LOG HARIAN UNTUK TAB TIM
    // ==========================================
    if (action === "get_log") {
      let sheet = ss.getSheetByName(data.reqNama);
      if (!sheet) return ContentService.createTextOutput(JSON.stringify({ "status": "success", "data": [] })).setMimeType(ContentService.MimeType.JSON);
      
      let lastRow = sheet.getLastRow();
      if (lastRow <= 1) return ContentService.createTextOutput(JSON.stringify({ "status": "success", "data": [] })).setMimeType(ContentService.MimeType.JSON);
      
      let rangeData = sheet.getRange(2, 1, lastRow - 1, 10).getDisplayValues();
      let logs = [];
      rangeData.forEach(row => {
        logs.push({
          tanggal: row[0], jamBerangkat: row[1], jamSampai: row[2], jamSelesai: row[3],
          tipe: row[4], namaKlien: row[5], alamatKlien: row[6], detail: row[7],
          kendala: row[8], gps: row[9]
        });
      });
      return ContentService.createTextOutput(JSON.stringify({ "status": "success", "data": logs })).setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // 3. HAPUS TUGAS (BATAL TIKET)
    // ==========================================
    if (action === "delete_task") {
      let sheet = ss.getSheetByName(data.nama);
      let rowDeleted = false;
      if (sheet) {
        let lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          let ids = sheet.getRange(2, 11, lastRow - 1, 1).getValues();
          for (let i = ids.length - 1; i >= 0; i--) {
            if (ids[i][0] === data.taskId) {
              sheet.deleteRow(i + 2);
              rowDeleted = true;
              Logger.log("✓ [delete_task] Baris dihapus untuk taskId: " + data.taskId);
              break;
            }
          }
        }
      }
      // AUDIT FIX 1.4: Return dengan status akurat (apakah berhasil dihapus atau tidak)
      return ContentService.createTextOutput(JSON.stringify({ "status": "success", "rowDeleted": rowDeleted, "note": rowDeleted ? "Row successfully deleted" : "TaskId not found (no deletion)" })).setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // 4. HITUNG STATISTIK DASHBOARD (MENGABAIKAN ISTIRAHAT)
    // ==========================================
    if (action === "get_dashboard_stats") {
      let targetName = data.nama;
      let sheet = ss.getSheetByName(targetName);
      let historySheet = ss.getSheetByName("History_" + targetName);
      let allData = [];

      // Gabung data hari ini dan history
      if (sheet && sheet.getLastRow() > 1) {
        allData = allData.concat(sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getDisplayValues());
      }
      if (historySheet && historySheet.getLastRow() > 1) {
        allData = allData.concat(historySheet.getRange(2, 1, historySheet.getLastRow() - 1, 10).getDisplayValues());
      }

      let tugasSelesai = 0, totalKendala = 0;
      let areaCount = {};

      // Hitung khusus 7 hari terakhir
      let batasMinggu = new Date();
      batasMinggu.setDate(batasMinggu.getDate() - 7);
      batasMinggu.setHours(0,0,0,0);

      allData.forEach(row => {
        let tglParts = row[0].split('/');
        let rowDate = tglParts.length === 3 ? new Date(tglParts[2], tglParts[1] - 1, tglParts[0]) : new Date(row[0]);

        if (rowDate >= batasMinggu) {
          let namaTugas = row[5] ? row[5].toUpperCase().trim() : "";
          
          // FILTER: Jangan hitung waktu istirahat sebagai tugas selesai
          if (namaTugas !== "ISTIRAHAT") { 
            if (row[3] && row[3] !== "-" && row[3] !== "") tugasSelesai++; 
            if (row[8] && row[8] !== "-" && row[8].trim() !== "") totalKendala++; 
  
            let area = row[6] ? row[6].trim() : "";
            if (area && area !== "-" && area !== "Internal / Kantor" && 
                area !== "Istirahat / Break" && row[4] !== 'Tugas Internal / CS') {
              areaCount[area] = (areaCount[area] || 0) + 1;
            }
          }
        }
      });

      let areaTerbanyak = "- Belum ada data -";
      let maxCount = 0;

      for (let area in areaCount) {
        if (areaCount[area] > maxCount) {
          maxCount = areaCount[area];
          areaTerbanyak = area + " (" + maxCount + " kunjungan)";
        }
      }

      return ContentService.createTextOutput(JSON.stringify({ 
        "status": "success", 
        "data": { "tugasSelesai": tugasSelesai, "totalKendala": totalKendala, "areaTerbanyak": areaTerbanyak }
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // 5. AMBIL PENGUMUMAN (RUNNING TEXT)
    // ==========================================
    if (action === "get_pengumuman") {
      let sheetPengumuman = ss.getSheetByName("Pengumuman");
      let teknisiName = data.nama ? data.nama.toLowerCase().trim() : "";

      // Jika sheet Pengumuman belum dibuat oleh admin
      if (!sheetPengumuman) {
        return ContentService.createTextOutput(JSON.stringify({ "status": "empty" })).setMimeType(ContentService.MimeType.JSON);
      }

      let lastRow = sheetPengumuman.getLastRow();
      // Jika sheet kosong (hanya header)
      if (lastRow <= 1) { 
        return ContentService.createTextOutput(JSON.stringify({ "status": "empty" })).setMimeType(ContentService.MimeType.JSON);
      }

      // Format Sheet: A=User Tujuan, B=Durasi (Detik), C=Pesan
      let dataPengumuman = sheetPengumuman.getRange(2, 1, lastRow - 1, 3).getValues();
      let pengumumanDitemukan = null;

      // Cari dari baris atas ke bawah. Berhenti di pengumuman pertama yang cocok
      for (let i = 0; i < dataPengumuman.length; i++) {
        let userTujuan = dataPengumuman[i][0] ? dataPengumuman[i][0].toString().toLowerCase().trim() : "";
        let durasi = parseInt(dataPengumuman[i][1]) || 60; // Default 60 detik kalau kosong
        let pesan = dataPengumuman[i][2] ? dataPengumuman[i][2].toString().trim() : "";

        if (pesan === "") continue;

        // Cek kecocokan target (Target "all" atau spesifik nama teknisi)
        if (userTujuan === "all" || userTujuan === teknisiName) {
          pengumumanDitemukan = {
            pesan: pesan,
            durasi: durasi
          };
          break; // Ketemu pengumuman aktif, langsung keluar dari loop
        }
      }

      if (pengumumanDitemukan) {
        return ContentService.createTextOutput(JSON.stringify({
          "status": "success",
          "data": pengumumanDitemukan
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        // Kalau nama tidak ada yang cocok, atau semua baris dihapus
        return ContentService.createTextOutput(JSON.stringify({ "status": "empty" })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // ==========================================
    // 5B. BUAT PENGUMUMAN BARU (DARI ADMIN)
    // ==========================================
    if (action === "create_pengumuman") {
      let sheetPengumuman = ss.getSheetByName("Pengumuman");
      if (!sheetPengumuman) {
        sheetPengumuman = ss.insertSheet("Pengumuman");
        sheetPengumuman.appendRow(["User Tujuan", "Durasi (Detik)", "Pesan", "Waktu Dibuat"]);
      }
      
      let now = new Date();
      sheetPengumuman.appendRow([
        data.userTujuan || "all",
        data.durasi || 60,
        data.pesan,
        now.toLocaleString("id-ID")
      ]);
      
      return ContentService.createTextOutput(JSON.stringify({ 
        "status": "success", 
        "message": "Pengumuman berhasil dibuat" 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // PERSIAPAN SHEET & HEADER
    // ==========================================
    let sheetName = data.nama ? data.nama.trim() : "Tanpa Nama";
    let sheet = ss.getSheetByName(sheetName);

    // Buat sheet baru jika teknisi ini baru pertama kali login
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(["Tanggal", "Jam Berangkat", "Jam Sampai / Mulai", "Jam Selesai", "Tipe", "Customer / Tugas", "Area / Alamat", "Detail", "Kendala", "GPS", "TaskID"]);
    } else {
      if (sheet.getRange(1, 11).getValue() !== "TaskID") sheet.getRange(1, 11).setValue("TaskID");
    }

    // ==========================================
    // 6. LIVE TRACKING: BERANGKAT
    // ==========================================
    if (action === "simpan_berangkat") {
      sheet.appendRow([data.tanggal, data.jamBerangkat, "OTW...", "-", data.tipe, data.namaKlien, data.alamatKlien, "Perjalanan menuju lokasi...", "-", "-", data.taskId]);
      return ContentService.createTextOutput(JSON.stringify({ "status": "success" })).setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // 7. LIVE TRACKING: SAMPAI DI LOKASI
    // ==========================================
    if (action === "update_sampai") {
      let lastRow = sheet.getLastRow();
      let taskIdFound = false;
      
      if (lastRow > 1) {
        let ids = sheet.getRange(2, 11, lastRow - 1, 1).getValues();
        for (let i = ids.length - 1; i >= 0; i--) { 
          if (ids[i][0] === data.taskId) {
            sheet.getRange(i + 2, 3).setValue(data.jamSampai);
            sheet.getRange(i + 2, 8).setValue("Sedang dikerjakan...");
            taskIdFound = true;
            break;
          }
        }
      }
      
      // AUDIT FIX 1.3: Jika taskId NOT FOUND, buat baris baru (fallback)
      if (!taskIdFound) {
        Logger.log("⚠️ [update_sampai] taskId tidak ditemukan: " + data.taskId + " - Membuat baris fallback");
        sheet.appendRow([data.tanggal, data.jamBerangkat || "-", data.jamSampai, "-", data.tipe || "Kunjungan", data.namaKlien, data.alamatKlien, "Sedang dikerjakan... (Recovery)", "-", "-", data.taskId]);
      }
      
      return ContentService.createTextOutput(JSON.stringify({ "status": "success", "taskIdFound": taskIdFound, "note": taskIdFound ? "Updated existing row" : "Created fallback row" })).setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // 8. LIVE TRACKING: SELESAI PEKERJAAN
    // ==========================================
    if (action === "update_selesai") {
      let lastRow = sheet.getLastRow();
      let taskIdFound = false;
      
      if (lastRow > 1) {
        let ids = sheet.getRange(2, 11, lastRow - 1, 1).getValues();
        for (let i = ids.length - 1; i >= 0; i--) {
          if (ids[i][0] === data.taskId) {
            sheet.getRange(i + 2, 4).setValue(data.jamSelesai);
            sheet.getRange(i + 2, 8).setValue(data.detail);
            sheet.getRange(i + 2, 9).setValue(data.kendala);
            sheet.getRange(i + 2, 10).setValue(data.gps);
            taskIdFound = true;
            break;
          }
        }
      }
      
      // AUDIT FIX 1.3: Jika taskId NOT FOUND, buat baris baru (fallback)
      if (!taskIdFound) {
        Logger.log("⚠️ [update_selesai] taskId tidak ditemukan: " + data.taskId + " - Membuat baris fallback");
        sheet.appendRow([data.tanggal, data.jamBerangkat || "-", data.jamSampai || "-", data.jamSelesai, data.tipe || "Kunjungan", data.namaKlien, data.alamatKlien, data.detail, data.kendala || "-", data.gps || "-", data.taskId]);
      }
      
      return ContentService.createTextOutput(JSON.stringify({ "status": "success", "taskIdFound": taskIdFound, "note": taskIdFound ? "Updated existing row" : "Created fallback row" })).setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // 9. TUGAS INTERNAL & ISTIRAHAT SIANG
    // ==========================================
    if (action === "simpan") {
      let waktuBerangkat = data.jamBerangkat !== undefined ? data.jamBerangkat : "-";
      let waktuSampai = data.jamSampai !== undefined ? data.jamSampai : (data.jamMulai || "-");
      let waktuSelesai = data.jamSelesai || "-";
      
      sheet.appendRow([data.tanggal, waktuBerangkat, waktuSampai, waktuSelesai, data.tipe, data.namaKlien, data.alamatKlien, data.detail, data.kendala, data.gps, data.taskId || "INTERNAL"]);
      return ContentService.createTextOutput(JSON.stringify({ "status": "success" })).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": err.toString() })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    // Selalu buka kunci saat script selesai jalan
    lock.releaseLock();
  }
}

// ==============================================
// TRIGGER TENGAH MALAM: PINDAHKAN LOG KE HISTORY (DENGAN ATOMICITY)
// ==============================================
function pindahkanLogKeHistory() {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  let lock = LockService.getScriptLock();
  
  try {
    // AUDIT FIX 4.2: Dapatkan lock untuk mencegah race condition dengan doPost
    lock.waitLock(30000); // 30 detik untuk operasi besar
    
    let sheets = ss.getSheets();
    
    sheets.forEach(sheet => {
      let sheetName = sheet.getName();
      
      // Abaikan jika sheet adalah sheet History atau sheet sistem lainnya
      if (sheetName.startsWith("History_") || sheetName === "Sheet1" || sheetName === "Pengumuman") return;
      
      let lastRow = sheet.getLastRow();
      
      // Jika sheet kosong (hanya ada header), lewati
      if (lastRow <= 1) return;
      
      let historySheetName = "History_" + sheetName;
      let historySheet = ss.getSheetByName(historySheetName);
      
      // AUDIT FIX 4.2: Buat history sheet dengan header yang sama TERLEBIH DAHULU
      if (!historySheet) {
        historySheet = ss.insertSheet(historySheetName);
        let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues();
        historySheet.appendRow(headers[0]);
        Logger.log("✓ Created history sheet: " + historySheetName);
      }
      
      // AUDIT FIX 4.2: Copy data ke history sheet
      let rangeData = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
      let values = rangeData.getValues();
      
      // BUG FIX 4: Filter data sebelum dipindahkan - hanya pindahkan baris dengan Jam Selesai valid
      // Kolom Jam Selesai adalah indeks ke-3 (kolom D, 0-indexed)
      let rowsToMove = [];
      let rowsIncomplete = [];
      
      values.forEach((row, idx) => {
        const jamSelesai = row[3]; // Indeks ke-3 = kolom D
        // Hanya pindahkan jika Jam Selesai bukan "-", tidak kosong, dan valid
        if (jamSelesai && jamSelesai !== "-" && jamSelesai.toString().trim() !== "") {
          rowsToMove.push(row);
          Logger.log("✓ Row " + (idx + 2) + " akan dipindahkan (Jam Selesai: " + jamSelesai + ")");
        } else {
          rowsIncomplete.push(row);
          Logger.log("⊘ Row " + (idx + 2) + " SKIP (Jam Selesai kosong/belum selesai)");
        }
      });
      
      // Append hanya baris yang selesai
      rowsToMove.forEach(row => {
        historySheet.appendRow(row);
      });
      Logger.log("✓ Moved " + rowsToMove.length + " completed rows to history for sheet: " + sheetName);
      
      // Hapus baris yang sudah dipindahkan (dari akhir agar index tidak berubah)
      if (rowsToMove.length > 0) {
        let rowIndicesToDelete = [];
        let movedCount = 0;
        values.forEach((row, idx) => {
          const jamSelesai = row[3];
          if (jamSelesai && jamSelesai !== "-" && jamSelesai.toString().trim() !== "") {
            rowIndicesToDelete.push(idx + 2); // Adjust untuk row index (row 1 = header)
            movedCount++;
          }
        });
        
        // Delete dari belakang agar index tetap valid
        for (let i = rowIndicesToDelete.length - 1; i >= 0; i--) {
          sheet.deleteRow(rowIndicesToDelete[i]);
        }
        Logger.log("✓ Deleted " + movedCount + " rows from main sheet: " + sheetName);
      }
    });
    
    Logger.log("✅ pindahkanLogKeHistory() COMPLETED SUCCESSFULLY");
  } catch (err) {
    // AUDIT FIX 4.2: Log error untuk visibility
    Logger.log("❌ pindahkanLogKeHistory() FAILED: " + err.toString());
    throw err; // Propagate error agar Sheets API trigger bisa retry
  } finally {
    // AUDIT FIX 4.2: SELALU release lock
    lock.releaseLock();
  }
}

// ==========================================
// CLEANUP: Hapus pengumuman yang expired
// ==========================================
function cleanupExpiredAnnouncements() {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheetPengumuman = ss.getSheetByName("Pengumuman");
  
  if (!sheetPengumuman) return;
  
  let lastRow = sheetPengumuman.getLastRow();
  if (lastRow <= 1) return; // Hanya header
  
  let now = new Date();
  let rowsToDelete = [];
  
  // Format: A=User, B=Durasi, C=Pesan, D=Waktu Dibuat
  let dataPengumuman = sheetPengumuman.getRange(2, 1, lastRow - 1, 4).getValues();
  
  for (let i = dataPengumuman.length - 1; i >= 0; i--) {
    let userTujuan = dataPengumuman[i][0];
    let durasi = parseInt(dataPengumuman[i][1]) || 60;
    let pesan = dataPengumuman[i][2];
    let waktuDibuat = dataPengumuman[i][3];
    
    // Skip jika baris kosong atau pesan kosong
    if (!pesan || pesan.toString().trim() === "") continue;
    
    // Parse waktu dibuat
    let waktuDibuatMs = new Date(waktuDibuat).getTime();
    let nowMs = now.getTime();
    let selisihDetik = (nowMs - waktuDibuatMs) / 1000;
    
    // Jika sudah melebihi durasi, tandai untuk dihapus
    if (selisihDetik > durasi) {
      rowsToDelete.push(i + 2); // +2 karena array 0-based dan header row 1
      console.log(`🗑️ Hapus pengumuman expired: "${pesan}" (${selisihDetik}s > ${durasi}s)`);
    }
  }
  
  // Hapus dari baris terbawah ke atas (agar index tidak berubah)
  for (let row of rowsToDelete) {
    sheetPengumuman.deleteRow(row);
  }
  
  if (rowsToDelete.length > 0) {
    console.log(`✅ ${rowsToDelete.length} pengumuman expired dihapus`);
  }
}

// ==========================================
// SCHEDULED TRIGGER: Cleanup setiap 1 menit
// ==========================================
function triggerCleanupEveryMinute() {
  // Panggil cleanup
  cleanupExpiredAnnouncements();
}