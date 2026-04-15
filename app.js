// ==============================================
// KONFIGURASI UTAMA
// ==============================================
const scriptURL = 'https://script.google.com/macros/s/AKfycbz26Ut7tFVm-22vNbAGnzSLMe9sak8_usjrwHT5AUoUL6NpnpghfdAEg1D7q0ECvGQg0Q/exec';

const today = new Date();
const formatTanggalUI = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
const formatTanggalCek = today.toLocaleDateString('id-ID');


const tanggalTerakhirBuka = localStorage.getItem('tanggalLogTerakhir');
if (tanggalTerakhirBuka !== formatTanggalCek) {
    localStorage.removeItem('dailyLogTeknisi');
    localStorage.setItem('tanggalLogTerakhir', formatTanggalCek);
}

let logData = JSON.parse(localStorage.getItem('dailyLogTeknisi')) || [];
let currentState = 'BERANGKAT', aktifTaskId = '', aktifWaktuBerangkat = '', aktifWaktuSampai = '', aktifNamaKlien = '', aktifAlamatKlien = '';
let isSyncing = false;

window.onload = function() {
    document.getElementById('tanggal').value = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    tampilkanLog();
    const savedName = localStorage.getItem('logSettingNama');
    const savedTipe = localStorage.getItem('logSettingTipe') || 'Kunjungan'; 
    if (savedName) document.getElementById('nama').value = savedName;
    document.getElementById(savedTipe === 'Kunjungan' ? 'modeLapangan' : 'modeCS').checked = true;
    
    terapkanModePenugasan();
    cekModalNamaHarian();
    pulihkanStateTiket(); 
    jalankanSync();
    
    setInterval(() => { jalankanSync(); }, 10000);
}

// ==============================================
// FUNGSI TABS & PANTAU TIM
// ==============================================
function switchTab(tabId) {
    document.querySelectorAll('.content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.getElementById(`btn-${tabId}`).classList.add('active');
    if (tabId === 'tim') {
        const select = document.getElementById('pilihTeknisiTim');
        if (select.options.length <= 1) muatDaftarTeknisi();
    }
}

async function muatDaftarTeknisi() {
    if (!navigator.onLine) { alert('Harus online untuk mengecek daftar tim!'); return; }
    const btn = document.getElementById('btnRefreshTeknisi');
    const select = document.getElementById('pilihTeknisiTim');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    select.innerHTML = '<option value="">Memuat data dari server...</option>';

    try {
        const respon = await fetch(scriptURL, { method: 'POST', body: JSON.stringify({ action: "get_teknisi" }), headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
        const resJson = await respon.json();
        if(resJson.status === 'success') {
            select.innerHTML = '<option value="">-- Pilih Teknisi --</option>';
            resJson.data.forEach(nama => select.innerHTML += `<option value="${nama}">${nama}</option>`);
        } else { select.innerHTML = '<option value="">Gagal memuat nama</option>'; }
    } catch (err) { select.innerHTML = '<option value="">Error koneksi / server mati</option>'; }
    btn.innerHTML = '<i class="fa-solid fa-rotate"></i>';
}

async function lihatLogTim() {
    if (!navigator.onLine) { alert('Harus online untuk melihat rincian pekerjaan tim!'); return; }
    const namaReq = document.getElementById('pilihTeknisiTim').value;
    if (!namaReq) { alert('Pilih nama teknisi dari kotak terlebih dahulu!'); return; }

    const btn = document.getElementById('btnLihatLogTim');
    const list = document.getElementById('listLogTim');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengambil Data...'; btn.disabled = true; list.innerHTML = '';

    try {
        const respon = await fetch(scriptURL, { method: 'POST', body: JSON.stringify({ action: "get_log", reqNama: namaReq }), headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
        const resJson = await respon.json();
        if(resJson.status === 'success') {
            if(resJson.data.length === 0) {
                list.innerHTML = `<div class="empty-state"><b>${namaReq}</b> belum mencatat pekerjaan apapun hari ini.</div>`;
            } else {
                [...resJson.data].reverse().forEach(log => {
                    const li = document.createElement('li');
                    let kendalaHTML = log.kendala ? `<div class="timeline-desc" style="color: var(--primary); font-weight: 600; margin-top: 4px;"><i class="fa-solid fa-triangle-exclamation"></i> Kendala: ${log.kendala}</div>` : '';
                    let titleTampilan = log.namaKlien ? `${log.namaKlien} <span style="font-weight: normal; font-size: 12px; color: var(--text-muted);">| ${log.alamatKlien}</span>` : "-";
                    let teksJam = log.tipe === 'Kunjungan' || log.jamBerangkat !== '-' ? `Brgkt: ${log.jamBerangkat} &nbsp;|&nbsp; Tiba: ${log.jamSampai} &nbsp;|&nbsp; Selesai: ${log.jamSelesai}` : `Mulai: ${log.jamSampai} &nbsp;|&nbsp; Selesai: ${log.jamSelesai}`;
                    li.innerHTML = `<div class="timeline-time"><i class="fa-regular fa-clock"></i> ${teksJam}</div><div class="timeline-title">${titleTampilan}</div><div class="timeline-desc">${log.detail}</div>${kendalaHTML}<div class="timeline-gps"><i class="fa-solid fa-location-dot"></i> ${log.gps}</div>`;
                    list.appendChild(li);
                });
            }
        } else { list.innerHTML = `<div class="empty-state">Gagal mengambil log: ${resJson.message}</div>`; }
    } catch (err) { list.innerHTML = `<div class="empty-state">Gagal terhubung ke server. Coba lagi.</div>`; }
    btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Lihat Pekerjaan'; btn.disabled = false;
}

// ==============================================
// FUNGSI MODAL IDENTITAS
// ==============================================
function cekModalNamaHarian() {
    const nama = localStorage.getItem('logSettingNama'), tglKonfirmasi = localStorage.getItem('logTanggalKonfirmasiNama'), tglHariIni = new Date().toLocaleDateString('id-ID');
    if (!nama || nama.trim() === "") {
        document.getElementById('kontenBelumAdaNama').style.display = 'block'; document.getElementById('kontenKonfirmasiNama').style.display = 'none'; document.getElementById('modalNamaHarian').style.display = 'flex';
    } else if (tglKonfirmasi !== tglHariIni) {
        document.getElementById('teksNamaTeknisi').innerText = nama; document.getElementById('kontenBelumAdaNama').style.display = 'none'; document.getElementById('kontenKonfirmasiNama').style.display = 'block'; document.getElementById('modalNamaHarian').style.display = 'flex';
    } else { cekModalBulanan(); }
}
function tutorBukaIdentitas() { document.getElementById('modalNamaHarian').style.display = 'none'; switchTab('identitas'); setTimeout(() => document.getElementById('nama').focus(), 100); }
function konfirmasiNamaSiap() { localStorage.setItem('logTanggalKonfirmasiNama', new Date().toLocaleDateString('id-ID')); document.getElementById('modalNamaHarian').style.display = 'none'; cekModalBulanan(); }
function cekModalBulanan() { const d = new Date(); if (d.getDate() === 1 && localStorage.getItem('logBulanModalMuncul') !== (d.getMonth() + "-" + d.getFullYear())) { document.getElementById('modalBulanan').style.display = 'flex'; } }
function konfirmasiModalBulanan() {
    const tipeDipilih = document.querySelector('input[name="modalTipe"]:checked').value; localStorage.setItem('logSettingTipe', tipeDipilih);
    document.getElementById(tipeDipilih === 'Kunjungan' ? 'modeLapangan' : 'modeCS').checked = true; terapkanModePenugasan();
    localStorage.setItem('logBulanModalMuncul', new Date().getMonth() + "-" + new Date().getFullYear()); document.getElementById('modalBulanan').style.display = 'none';
}

// ==============================================
// PENGATURAN MODE
// ==============================================
function simpanNama() { localStorage.setItem('logSettingNama', document.getElementById('nama').value); }
function gantiMode(elemen) {
    const tipeLama = localStorage.getItem('logSettingTipe') || 'Kunjungan', tipeBaru = elemen.value;
    if (tipeLama !== tipeBaru) {
        if(currentState !== 'BERANGKAT' && tipeLama === 'Kunjungan') { alert('Selesaikan tugas kunjungan aktif terlebih dahulu!'); document.getElementById('modeLapangan').checked = true; return; }
        if(confirm('Yakin ubah mode ke ' + tipeBaru + '?')) { localStorage.setItem('logSettingTipe', tipeBaru); terapkanModePenugasan(); } 
        else { document.getElementById(tipeLama === 'Kunjungan' ? 'modeLapangan' : 'modeCS').checked = true; }
    }
}
function terapkanModePenugasan() {
    const isKunjungan = (localStorage.getItem('logSettingTipe') || 'Kunjungan') === 'Kunjungan';
    document.getElementById('areaKunjungan').style.display = isKunjungan ? 'block' : 'none'; document.getElementById('areaInternalKlasik').style.display = isKunjungan ? 'none' : 'block';
}
function getWaktuSekarang() { const now = new Date(); return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`; }
function setWaktuSekarang(idInput) { document.getElementById(idInput).value = getWaktuSekarang(); }

// ==============================================
// LOGIKA SLIDER KUNJUNGAN & LIVE TRACKING
// ==============================================
const sliderContainer = document.getElementById('actionSlider'), sliderThumb = document.getElementById('sliderThumb'), sliderBg = document.getElementById('sliderBg'), sliderText = document.getElementById('sliderText');
let isDragging = false, startX = 0, maxSlide = 0;
sliderThumb.addEventListener('touchstart', startDrag, {passive: true}); sliderThumb.addEventListener('mousedown', startDrag);
document.addEventListener('touchmove', doDrag, {passive: false}); document.addEventListener('mousemove', doDrag);
document.addEventListener('touchend', endDrag); document.addEventListener('mouseup', endDrag);

function startDrag(e) { if(sliderContainer.classList.contains('disabled')) return; isDragging = true; startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX; maxSlide = sliderContainer.offsetWidth - sliderThumb.offsetWidth - 6; }
function doDrag(e) { if (!isDragging) return; let currentX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX; let diffX = Math.max(0, Math.min(currentX - startX, maxSlide)); sliderThumb.style.left = diffX + 3 + 'px'; sliderBg.style.width = diffX + (sliderThumb.offsetWidth / 2) + 'px'; }
function endDrag(e) { if (!isDragging) return; isDragging = false; (parseInt(sliderThumb.style.left) || 0) >= maxSlide * 0.95 ? eksekusiFase() : resetSliderVisual(); }
function resetSliderVisual() { sliderThumb.style.transition = 'left 0.3s'; sliderBg.style.transition = 'width 0.3s, background-color 0.3s'; sliderThumb.style.left = '3px'; sliderBg.style.width = '0'; setTimeout(() => { sliderThumb.style.transition = 'none'; sliderBg.style.transition = 'none'; }, 300); }

function eksekusiFase() {
    if (currentState === 'BERANGKAT') {
        aktifNamaKlien = document.getElementById('namaCustomer').value; aktifAlamatKlien = document.getElementById('alamatCustomer').value;
        if (!aktifNamaKlien || !aktifAlamatKlien) { alert('Isi Nama Customer & Alamatnya!'); resetSliderVisual(); return; }
        
        aktifWaktuBerangkat = getWaktuSekarang(); 
        aktifTaskId = "T" + Date.now(); // Buat Nomor Resi/Task ID Unik
        currentState = 'SAMPAI'; 
        simpanStateTiket(); 
        
        // PUSH DATA KE SERVER
        kirimDataParsial('simpan_berangkat');

    } else if (currentState === 'SAMPAI') {
        aktifWaktuSampai = getWaktuSekarang(); 
        currentState = 'SELESAI'; 
        simpanStateTiket(); 
        
        // UPDATE DATA DI SERVER
        kirimDataParsial('update_sampai');

    } else if (currentState === 'SELESAI') {
        if(!document.getElementById('detailKunjungan').value) { alert('Isi detail pekerjaan!'); resetSliderVisual(); return; }
        sliderContainer.classList.add('disabled'); sliderText.innerText = 'MENCARI GPS...'; 
        simpanDataFinalKunjungan();
    }
}

function kirimDataParsial(aksi) {
    const payload = {
        action: aksi,
        taskId: aktifTaskId,
        nama: localStorage.getItem('logSettingNama'),
        tanggal: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        tipe: 'Kunjungan',
        namaKlien: aktifNamaKlien,
        alamatKlien: aktifAlamatKlien
    };
    
    if (aksi === 'simpan_berangkat') payload.jamBerangkat = aktifWaktuBerangkat;
    if (aksi === 'update_sampai') payload.jamSampai = aktifWaktuSampai;

    let antrean = JSON.parse(localStorage.getItem('antreanLog')) || [];
    antrean.push(payload);
    localStorage.setItem('antreanLog', JSON.stringify(antrean));
    jalankanSync();
}

function simpanStateTiket() { localStorage.setItem('tiketTugasAktif', JSON.stringify({ state: currentState, taskId: aktifTaskId, waktuBerangkat: aktifWaktuBerangkat, waktuSampai: aktifWaktuSampai, namaKlien: aktifNamaKlien, alamatKlien: aktifAlamatKlien })); renderUIBerdasarkanState(); }
function pulihkanStateTiket() { const t = JSON.parse(localStorage.getItem('tiketTugasAktif')); if (t) { currentState = t.state; aktifTaskId = t.taskId || ''; aktifWaktuBerangkat = t.waktuBerangkat; aktifWaktuSampai = t.waktuSampai; aktifNamaKlien = t.namaKlien; aktifAlamatKlien = t.alamatKlien; renderUIBerdasarkanState(); } }
function batalTiket() {
    if(confirm('Batalkan tugas ini? Data di server kantor mungkin sudah tercatat sebagian.')) {
        localStorage.removeItem('tiketTugasAktif'); currentState = 'BERANGKAT'; aktifTaskId = aktifWaktuBerangkat = aktifWaktuSampai = aktifNamaKlien = aktifAlamatKlien = '';
        document.getElementById('namaCustomer').value = document.getElementById('alamatCustomer').value = document.getElementById('detailKunjungan').value = document.getElementById('kendalaKunjungan').value = '';
        renderUIBerdasarkanState();
    }
}
function renderUIBerdasarkanState() {
    document.getElementById('formCustomerArea').style.display = currentState === 'BERANGKAT' ? 'block' : 'none';
    if (currentState !== 'BERANGKAT') {
        document.getElementById('tiketPerjalanan').style.display = 'block'; document.getElementById('tiketInfoArea').innerHTML = `Menuju: <strong>${aktifNamaKlien}</strong><br>Lokasi: ${aktifAlamatKlien}`; document.getElementById('tiketWaktuBerangkat').innerText = aktifWaktuBerangkat;
        const elS = document.getElementById('tiketWaktuSampai');
        if(currentState === 'SELESAI') { elS.innerText = aktifWaktuSampai; elS.style.color = 'var(--primary)'; } else { elS.innerText = '--:--'; elS.style.color = '#adb5bd'; }
    } else { document.getElementById('tiketPerjalanan').style.display = 'none'; }
    document.getElementById('formDetailArea').style.display = currentState === 'SELESAI' ? 'block' : 'none';
    sliderContainer.className = `slider-container state-${currentState.toLowerCase()}`;
    if (currentState === 'BERANGKAT') { sliderText.innerText = 'Geser Mulai Perjalanan >>'; sliderText.style.color = '#495057'; sliderThumb.innerHTML = '<i class="fa-solid fa-motorcycle"></i>'; } 
    else if (currentState === 'SAMPAI') { sliderText.innerText = 'Geser Sudah Sampai >>'; sliderText.style.color = 'white'; sliderThumb.innerHTML = '<i class="fa-solid fa-location-dot"></i>'; } 
    else if (currentState === 'SELESAI') { sliderText.innerText = 'Geser Selesai & Simpan >>'; sliderText.style.color = 'white'; sliderThumb.innerHTML = '<i class="fa-solid fa-check-double"></i>'; }
    resetSliderVisual();
}

// ==============================================
// FUNGSI PENGIRIMAN DATA FINAL
// ==============================================
function simpanDataFinalKunjungan() {
    const payloadTugas = { action: 'update_selesai', taskId: aktifTaskId, jamBerangkat: aktifWaktuBerangkat, jamSampai: aktifWaktuSampai, jamSelesai: getWaktuSekarang(), tipe: 'Kunjungan', namaKlien: aktifNamaKlien, alamatKlien: aktifAlamatKlien, detail: document.getElementById('detailKunjungan').value, kendala: document.getElementById('kendalaKunjungan').value };
    mintaGPSDanSimpan(payloadTugas);
}

function simpanDataInternal() {
    const jamMulai = document.getElementById('jamMulaiInternal').value, jamSelesai = document.getElementById('jamSelesaiInternal').value, detail = document.getElementById('detailInternal').value;
    if(!localStorage.getItem('logSettingNama')) { alert('Isi Identitas dulu!'); switchTab('identitas'); return; }
    if(!jamMulai || !jamSelesai || !detail) { alert('Isi Jam Mulai, Selesai, dan Detail!'); return; }
    if (jamMulai > jamSelesai) { alert(`⚠️ ERROR WAKTU!\n\nJam Mulai (${jamMulai}) lebih besar/malam daripada Jam Selesai (${jamSelesai}).\n\nAnda pasti tidak sengaja memilih PM (Malam). Silakan betulkan jamnya!`); return; }
    let cekJamMalam = parseInt(jamMulai.split(':')[0]);
    if (cekJamMalam >= 19) { if(!confirm(`⚠️ PERINGATAN JAM KERJA!\n\nJam mulai tercatat malam hari: ${jamMulai}.\nJika ini harusnya pagi hari, berarti salah AM/PM. Lanjut simpan?`)) return; }

    document.getElementById('btnSimpanInternal').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> MENCARI GPS...'; document.getElementById('btnSimpanInternal').disabled = true;
    const payloadTugas = { action: "simpan", jamBerangkat: "-", jamSampai: jamMulai, jamSelesai: jamSelesai, tipe: 'Tugas Internal / CS', namaKlien: document.getElementById('jenisTugasInternal').value, alamatKlien: "Internal / Kantor", detail: detail, kendala: document.getElementById('kendalaInternal').value };
    mintaGPSDanSimpan(payloadTugas);
}

function mintaGPSDanSimpan(payload) {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => eksekusiSimpanGPS(pos.coords.latitude + ", " + pos.coords.longitude, payload), (err) => eksekusiSimpanGPS("GPS Offline/Ditolak", payload), { timeout: 5000 });
    } else { eksekusiSimpanGPS("Tanpa GPS", payload); }
}

function eksekusiSimpanGPS(gps, payload) {
    const dataBaru = { action: payload.action || "simpan", nama: localStorage.getItem('logSettingNama'), tanggal: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }), gps: gps, ...payload };
    
    // Tampilkan di log lokal hp teknisi jika tugas selesai
    if (payload.tipe === 'Tugas Internal / CS' || payload.action === 'update_selesai') {
        logData.push(dataBaru); localStorage.setItem('dailyLogTeknisi', JSON.stringify(logData));
    }

    let antrean = JSON.parse(localStorage.getItem('antreanLog')) || []; antrean.push(dataBaru); localStorage.setItem('antreanLog', JSON.stringify(antrean));
    
    if (payload.tipe === 'Kunjungan') {
        localStorage.removeItem('tiketTugasAktif'); document.getElementById('namaCustomer').value = document.getElementById('alamatCustomer').value = document.getElementById('detailKunjungan').value = document.getElementById('kendalaKunjungan').value = ''; 
        currentState = 'BERANGKAT'; aktifTaskId = ''; sliderContainer.classList.remove('disabled'); renderUIBerdasarkanState();
    } else {
        document.getElementById('jamMulaiInternal').value = document.getElementById('jamSelesaiInternal').value = document.getElementById('detailInternal').value = document.getElementById('kendalaInternal').value = ''; 
        document.getElementById('btnSimpanInternal').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> SIMPAN TUGAS INTERNAL'; document.getElementById('btnSimpanInternal').disabled = false;
    }
    tampilkanLog(); jalankanSync();
}

function tampilkanLog() {
    const list = document.getElementById('listLog'), exportArea = document.getElementById('exportArea'); list.innerHTML = '';
    if (logData.length === 0) { list.innerHTML = '<div class="empty-state">Belum ada riwayat pekerjaan selesai hari ini.</div>'; exportArea.style.display = 'none'; return; }
    exportArea.style.display = 'block';
    [...logData].reverse().forEach((log) => {
        const li = document.createElement('li');
        let kHtml = log.kendala ? `<div class="timeline-desc" style="color: var(--primary); font-weight: 600; margin-top: 4px;"><i class="fa-solid fa-triangle-exclamation"></i> Kendala: ${log.kendala}</div>` : '';
        let teksJam = log.tipe === 'Kunjungan' ? `Brgkt: ${log.jamBerangkat} &nbsp;|&nbsp; Tiba: ${log.jamSampai} &nbsp;|&nbsp; Selesai: ${log.jamSelesai}` : `Mulai: ${log.jamSampai} &nbsp;|&nbsp; Selesai: ${log.jamSelesai}`;
        li.innerHTML = `<div class="timeline-time"><i class="fa-regular fa-clock"></i> ${teksJam}</div><div class="timeline-title">${log.namaKlien || "-"} <span style="font-weight: normal; font-size: 12px; color: var(--text-muted);">| ${log.alamatKlien || "-"}</span></div><div class="timeline-desc">${log.detail}</div>${kHtml}<div class="timeline-gps"><i class="fa-solid fa-location-dot"></i> ${log.gps}</div>`;
        list.appendChild(li);
    });
}
function hapusSemua() { if(confirm('Yakin mereset seluruh log?')) { localStorage.removeItem('dailyLogTeknisi'); logData = []; tampilkanLog(); } }

// ==============================================
// AUTO SYNC & SERVICE WORKER
// ==============================================
async function jalankanSync() {
    if (!navigator.onLine || isSyncing) return;
    
    let antreanCek = JSON.parse(localStorage.getItem('antreanLog')) || [];
    if (antreanCek.length === 0) return; 
    
    isSyncing = true;
    const btnTabHarian = document.getElementById('btn-harian');
    const modalSync = document.getElementById('modalSync'); // Popup jangan tutup aplikasi

    try {
        if (modalSync) modalSync.style.display = 'flex';

        while (true) {
            let antrean = JSON.parse(localStorage.getItem('antreanLog')) || [];
            if (antrean.length === 0) break;

            btnTabHarian.innerHTML = `<i class="fa-solid fa-rotate fa-spin"></i> Sync...`;
            let payload = antrean[0];
            if (!payload.action) payload.action = "simpan";

            try {
                const respon = await fetch(scriptURL, {
                    method: 'POST',
                    body: JSON.stringify(payload),
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
                });
                const resJson = await respon.json();
                
                if (resJson.status === 'success' || resJson.status === 'error') {
                    let antreanUpdate = JSON.parse(localStorage.getItem('antreanLog')) || [];
                    antreanUpdate.shift(); 
                    localStorage.setItem('antreanLog', JSON.stringify(antreanUpdate));
                }
            } catch (error) {
                break;
            }
        }
    } finally {
        btnTabHarian.innerHTML = `<i class="fa-solid fa-list-check"></i> Harian`;
        isSyncing = false;
        if (modalSync) modalSync.style.display = 'none';
    }
}

window.addEventListener('online', jalankanSync);

if ('serviceWorker' in navigator) { 
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => { reg.update(); })
            .catch(err => console.log('SW Error: ', err));
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
            window.location.reload();
            refreshing = true;
        }
    });
}
