// ==============================================
// KONFIGURASI UTAMA
// DEBUG: Buka DevTools dengan F12 atau Ctrl+Shift+I untuk melihat console logs!
// ==============================================
console.log('%c🚀 app.js LOADED!', 'font-size: 16px; color: green; font-weight: bold;');
console.log('📍 Timestamp:', new Date().toISOString());
console.log('%c💡 TIP: Buka Console tab di DevTools (F12) untuk melihat debug logs', 'color: orange; font-style: italic;');

// Store startup log in localStorage for debugging if console doesn't work
try {
    const startupLog = new Date().toISOString() + ' - app.js loaded successfully';
    localStorage.setItem('debugStartupTime', startupLog);
    console.log('✅ Debug log stored in localStorage');
} catch (e) {
    console.error('Failed to store debug log:', e);
}

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
let isIstirahat = false, jamMulaiIstirahat = '';
let selectedDashboardDate = new Date(); // Track selected date for dashboard filtering
let currentDashboardTab = 'hari'; // Track current dashboard tab (hari or minggu)

console.log('✅ Global variables initialized');
console.log('📅 Today:', formatTanggalCek);
console.log('🔗 Script URL:', scriptURL);

// Helper: Normalize name to Title Case (case-insensitive matching)
function normalizeTechnicianName(name) {
    if (!name) return '';
    return name
        .trim()
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Helper: Update header with technician name
function updateHeaderTeknisiName() {
    const savedName = localStorage.getItem('logSettingNama');
    const headerElement = document.getElementById('headerTeknisiName');
    if (headerElement) {
        if (savedName) {
            const firstName = savedName.split(' ')[0]; // Get only first word
            headerElement.textContent = '- ' + firstName;
        } else {
            headerElement.textContent = '';
        }
    }
}

// Helper: Show update notification with refresh button
function showUpdateNotification() {
    // Remove any existing update notification
    const existingNotif = document.getElementById('updateNotificationBanner');
    if (existingNotif) existingNotif.remove();
    
    const banner = document.createElement('div');
    banner.id = 'updateNotificationBanner';
    banner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
        color: white;
        padding: 16px 20px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 600;
        animation: slideDown 0.3s ease-out;
    `;
    
    const message = document.createElement('span');
    message.style.cssText = 'flex: 1; margin-right: 20px; font-size: 14px;';
    message.innerHTML = '✅ <strong>Versi terbaru tersedia!</strong> Silakan refresh aplikasi untuk mendapatkan update terbaru.';
    
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'display: flex; gap: 10px; white-space: nowrap;';
    
    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = '🔄 Refresh Sekarang';
    refreshBtn.style.cssText = `
        background: white;
        color: #28a745;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
    `;
    refreshBtn.onmouseover = () => refreshBtn.style.transform = 'scale(1.05)';
    refreshBtn.onmouseout = () => refreshBtn.style.transform = 'scale(1)';
    refreshBtn.onclick = () => window.location.reload();
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = `
        background: rgba(255,255,255,0.2);
        color: white;
        border: none;
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
        transition: all 0.2s;
    `;
    closeBtn.onmouseover = () => closeBtn.style.background = 'rgba(255,255,255,0.3)';
    closeBtn.onmouseout = () => closeBtn.style.background = 'rgba(255,255,255,0.2)';
    closeBtn.onclick = () => banner.remove();
    
    btnContainer.appendChild(refreshBtn);
    btnContainer.appendChild(closeBtn);
    banner.appendChild(message);
    banner.appendChild(btnContainer);
    document.body.appendChild(banner);
    
    // Add animation styles
    if (!document.getElementById('updateNotificationStyles')) {
        const style = document.createElement('style');
        style.id = 'updateNotificationStyles';
        style.textContent = `
            @keyframes slideDown {
                from {
                    transform: translateY(-100%);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Helper: Get Monday of the current week
function getMondayOfCurrentWeek() {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust to get Monday
    return new Date(today.setDate(diff));
}

window.onload = function() {
    console.log('%c📄 window.onload TRIGGERED', 'font-size: 14px; color: blue; font-weight: bold;');
    console.log('🕐 Onload time:', new Date().toISOString());

    // Set default tanggal hari ini
    const tanggalHariIni = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('tanggal').value = tanggalHariIni;
    console.log('📅 Tanggal field set to:', tanggalHariIni);

    if (localStorage.getItem('logSettingTema') === 'dark') {
        document.body.classList.add('dark-mode');
        updateBtnTemaUI(true);
    }
    
    tampilkanLog();
    const savedName = localStorage.getItem('logSettingNama');
    const savedTipe = localStorage.getItem('logSettingTipe') || 'Kunjungan'; 
    if (savedName) document.getElementById('nama').value = savedName;
    document.getElementById(savedTipe === 'Kunjungan' ? 'modeLapangan' : 'modeCS').checked = true;
    updateHeaderTeknisiName(); // Update header with technician name
    
    // Auto-sync on app load if technician name exists
    if (savedName) {
        console.log('🔄 Auto-syncing on app load for:', savedName);
        setTimeout(() => {
            mulaiSyncManual();
        }, 500);
    }
    
    // Listen for Service Worker updates
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data.type === 'APP_UPDATED') {
                console.log('🔄 App update detected!');
                showUpdateNotification();
            }
        });
    }
    
    terapkanModePenugasan();
    cekModalNamaHarian();
    pulihkanStateTiket();
    pulihkanStatusIstirahat();
    jalankanSync();
    
    setInterval(() => { jalankanSync(); }, 10000);
}

// ==============================================
// FUNGSI TABS, SIDEBAR & PANTAU TIM
// ==============================================
async function switchTab(tabId) {
    console.log(`%c📑 switchTab CALLED with tabId="${tabId}"`, 'font-size: 12px; color: purple;');
    
    document.querySelectorAll('.content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.getElementById(`btn-${tabId}`).classList.add('active');
    
    if (tabId === 'tim') {
        const container = document.getElementById('daftarTeknisiAccordion');
        if (container.innerHTML === '') {
            muatDaftarTeknisiAccordion();
        }
    }
    
    if (tabId === 'dashboard') {
        // Reset to today's date and activate today's pill
        selectedDashboardDate = new Date();
        console.log('📅 Dashboard opened - activating today\'s pill');
        generateDatePills();
        muatHistoriSepekan(); // Load weekly history to local storage
        await muatDashboardStats();
        switchDashboardTab('hari'); // Default to daily view
    }
}

async function muatDashboardStats() {
    console.log('🔔 [muatDashboardStats] CALLED');
    
    const namaTeknisi = localStorage.getItem('logSettingNama');
    if (!namaTeknisi) {
        console.log('❌ [muatDashboardStats] No technician name in localStorage');
        return;
    }
    
    console.log('📊 [muatDashboardStats] Nama Teknisi:', namaTeknisi);
    
    // Count completed tasks from selected date, excluding ISTIRAHAT
    // Load from BOTH sources: dashboard's weekly history + today's daily log
    const storageKey = 'dashboardHistoriSepekan';
    const rawData = localStorage.getItem(storageKey);
    let logData = JSON.parse(rawData) || [];
    
    // TAMBAHAN: Juga include data dari dailyLogTeknisi untuk hari ini
    const dailyLogRaw = localStorage.getItem('dailyLogTeknisi');
    const dailyLogData = JSON.parse(dailyLogRaw) || [];
    console.log(`📊 [muatDashboardStats] dailyLogTeknisi count: ${dailyLogData.length}`);
    
    // Normalize date to DD/MM/YYYY format (with leading zeros)
    const day = String(selectedDashboardDate.getDate()).padStart(2, '0');
    const month = String(selectedDashboardDate.getMonth() + 1).padStart(2, '0');
    const year = selectedDashboardDate.getFullYear();
    const selectedDateStr = `${day}/${month}/${year}`;
    
    console.log(`📦 [muatDashboardStats] Storage key: "${storageKey}"`);
    console.log(`📦 [muatDashboardStats] Weekly history items count: ${logData.length}`);
    console.log(`📅 [muatDashboardStats] Counting for date: ${selectedDateStr}`);
    console.log(`📅 [muatDashboardStats] Selected dashboard date:`, selectedDashboardDate);
    
    if (logData.length === 0) {
        console.warn('⚠️ [muatDashboardStats] No data in weekly history! Calling muatHistoriSepekan()...');
    }
    
    const tugasSelesai = logData.filter(item => {
        const isIstirahat = item.tipe === 'ISTIRAHAT';
        const noDate = !item.tanggal;
        const dateMatches = item.tanggal === selectedDateStr;
        const hasValidJamSelesai = item.jamSelesai && item.jamSelesai !== '-' && item.jamSelesai.trim() !== '';
        
        if (!isIstirahat && !noDate && dateMatches && hasValidJamSelesai) {
            console.log(`  ✓ Item matched (history): ${item.namaKlien} | Date: ${item.tanggal} | Selesai: ${item.jamSelesai}`);
        }
        
        if (item.tipe === 'ISTIRAHAT') {
            if (dateMatches) console.log(`  ⏸️ Skipped ISTIRAHAT for date ${selectedDateStr}`);
            return false;
        }
        if (!item.tanggal) {
            console.log(`  ❌ No tanggal in item: ${item.namaKlien}`);
            return false;
        }
        if (!dateMatches) {
            return false;
        }
        if (!hasValidJamSelesai) {
            console.log(`  ⏭️ Invalid jamSelesai: ${item.jamSelesai}`);
            return false;
        }
        return true;
    }).length;
    
    // TAMBAHAN: Count dari daily log untuk hari ini juga
    const tugasSelesaiDaily = dailyLogData.filter(item => {
        const isIstirahat = item.tipe === 'ISTIRAHAT';
        const noDate = !item.tanggal;
        const dateMatches = item.tanggal === selectedDateStr;
        const hasValidJamSelesai = item.jamSelesai && item.jamSelesai !== '-' && item.jamSelesai.trim() !== '';
        
        if (!isIstirahat && !noDate && dateMatches && hasValidJamSelesai) {
            console.log(`  ✓ Item matched (daily): ${item.namaKlien} | Date: ${item.tanggal} | Selesai: ${item.jamSelesai}`);
        }
        
        if (item.tipe === 'ISTIRAHAT') return false;
        if (!item.tanggal) return false;
        if (!dateMatches) return false;
        if (!hasValidJamSelesai) {
            console.log(`  ⏭️ Invalid jamSelesai in daily: ${item.jamSelesai}`);
            return false;
        }
        return true;
    }).length;
    
    // Total dari kedua sumber
    const tugasSelesaiTotal = tugasSelesai + tugasSelesaiDaily;
    
    console.log(`🎯 [muatDashboardStats] Weekly history: ${tugasSelesai} | Daily log: ${tugasSelesaiDaily} | Total: ${tugasSelesaiTotal}`);
    const metricElement = document.getElementById('metricValueTugasSelesai');
    metricElement.innerText = tugasSelesaiTotal;
    
    // Ubah warna jadi hijau kalau sudah mencapai target (5 tugas)
    if (tugasSelesaiTotal >= 5) {
        metricElement.style.color = '#28a745'; // Hijau
    } else {
        metricElement.style.color = 'var(--primary)'; // Merah default
    }
    console.log(`📤 [muatDashboardStats] Updated metric display with: ${tugasSelesaiTotal} (Color: ${tugasSelesaiTotal >= 5 ? 'GREEN' : 'RED'})`);
    
    // Count kendala (items dengan kendala tidak kosong & bukan hanya "-", untuk hari ini dari dailyLogData)
    const kendalaCount = dailyLogData.filter(item => {
        const dateMatches = item.tanggal === selectedDateStr;
        const hasKendala = item.kendala && item.kendala.trim() !== '' && item.kendala.trim() !== '-';
        if (dateMatches && hasKendala) {
            console.log(`  ⚠️ Kendala found: ${item.namaKlien} | Kendala: ${item.kendala}`);
        }
        return dateMatches && hasKendala;
    }).length;
    
    const kendalaElement = document.getElementById('metricValueKendala');
    kendalaElement.innerText = kendalaCount;
    console.log(`⚠️ [muatDashboardStats] Total kendala hari ini: ${kendalaCount}`);
    
    // Populate daily chart (now shows weekly data with async fetch)
    console.log('📊 [muatDashboardStats] Calling populateDailyChart()...');
    await populateDailyChart();
    console.log('✅ [muatDashboardStats] populateDailyChart() completed');
    
    // Generate date pills sesuai tab yang aktif
    if (currentDashboardTab === 'hari') {
        generateDatePills();
    } else if (currentDashboardTab === 'minggu') {
        generateMonthPills();
    }
    console.log('✅ [muatDashboardStats] COMPLETED');
}

// ===============================================
// FUNGSI DASHBOARD - TAB SWITCH (Hari / Minggu)
// ===============================================
function switchDashboardTab(tab) {
    // Update tab buttons
    document.getElementById('tab-hari-btn').classList.remove('active');
    document.getElementById('tab-minggu-btn').classList.remove('active');
    
    // Track current tab
    currentDashboardTab = tab;
    
    if (tab === 'hari') {
        document.getElementById('tab-hari-btn').classList.add('active');
        document.getElementById('dashboard-hari-view').classList.add('active');
        document.getElementById('dashboard-minggu-view').classList.remove('active');
        // Generate date pills for daily view (7 days)
        generateDatePills();
    } else {
        document.getElementById('tab-minggu-btn').classList.add('active');
        document.getElementById('dashboard-minggu-view').classList.add('active');
        document.getElementById('dashboard-hari-view').classList.remove('active');
        // Generate month pills for weekly view (6 months)
        generateMonthPills();
        // Populate weekly chart with real data
        populateWeeklyChart();
        // Update weekly metrics
        updateWeeklyMetrics();
    }
}

// ===============================================
// FUNGSI POPULATE DAILY CHART - Canvas-based Rendering
// ===============================================
async function populateDailyChart() {
    console.log('═══════════════════════════════════════════════');
    console.log('🎬 populateDailyChart() STARTED');
    console.log('═══════════════════════════════════════════════');
    
    const canvas = document.getElementById('dailyBarChart');
    if (!canvas) {
        console.error('❌ FATAL: Canvas element not found!');
        return;
    }
    console.log('✅ Canvas element found:', canvas);
    
    const ctx = canvas.getContext('2d');
    console.log('✅ Canvas context 2d obtained');
    
    // Check localStorage
    const storageKey = 'dashboardHistoriSepekan';
    const rawData = localStorage.getItem(storageKey);
    console.log(`📦 Checking localStorage key: "${storageKey}"`);
    console.log(`📦 Raw storage value:`, rawData ? rawData.substring(0, 200) + '...' : 'NULL');
    
    let logData = JSON.parse(rawData) || [];
    console.log(`📊 Parsed data count: ${logData.length} items`);
    
    if (logData.length > 0) {
        console.log('✅ Data found in localStorage');
        console.log('📋 First 3 items:', logData.slice(0, 3));
    } else {
        console.log('⚠️ No data in localStorage, attempting to fetch from server...');
        try {
            await muatHistoriSepekan();
            logData = JSON.parse(localStorage.getItem(storageKey)) || [];
            console.log(`📦 After fetch - Data count: ${logData.length} items`);
            if (logData.length > 0) {
                console.log('📋 First 3 items after fetch:', logData.slice(0, 3));
            }
        } catch (err) {
            console.error('❌ Fetch failed:', err);
            return;
        }
    }
    
    // PENTING: Tambahkan data hari ini dari dailyLogTeknisi agar tugas hari ini muncul di chart
    const today = new Date();
    const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    const dailyLogRaw = localStorage.getItem('dailyLogTeknisi');
    const dailyLogData = JSON.parse(dailyLogRaw) || [];
    
    console.log(`📝 [PENTING] Including today's dailyLogTeknisi data: ${dailyLogData.length} items`);
    console.log(`📅 Today's date string: "${todayStr}"`);
    
    // Filter dailyLogTeknisi untuk hanya hari ini dan gabung dengan logData
    const todayDailyTasks = dailyLogData.filter(item => item.tanggal === todayStr && item.tipe !== 'ISTIRAHAT');
    console.log(`📝 Today's daily tasks (filtered): ${todayDailyTasks.length} items`);
    if (todayDailyTasks.length > 0) {
        console.log(`📋 Today's tasks sample:`, todayDailyTasks.slice(0, 3));
    }
    
    // Gabung: history + hari ini dari daily log
    logData = logData.concat(todayDailyTasks);
    console.log(`✅ Combined data (history + today): ${logData.length} items`);
    
    // Get data for Monday to Sunday of current week
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const monday = getMondayOfCurrentWeek();
    const tasksByDay = {};
    
    console.log(`📅 Today's date: ${today.toLocaleDateString('id-ID')}`);
    console.log(`📅 Monday of current week: ${monday.toLocaleDateString('id-ID')}`);
    
    // Initialize all days (Monday to Sunday = 7 days)
    for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(date.getDate() + i);
        // Format tanggal dengan konsisten: DD/MM/YYYY (dengan leading zeros)
        const dayKey = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
        tasksByDay[dayKey] = { count: 0, day: dayNames[date.getDay()], date: date };
    }
    
    console.log(`📅 Days to display (${Object.keys(tasksByDay).length} days - Senin to Minggu):`, Object.keys(tasksByDay).sort());
    console.log(`📝 Format tanggal yang digunakan: DD/MM/YYYY dengan leading zeros`);
    
    // Count all tasks (completed or in progress) for each day
    let itemsProcessed = 0;
    let itemsMatched = 0;
    let itemsSkipped = 0;
    
    console.log(`📝 Available keys in tasksByDay:`, Object.keys(tasksByDay).sort());
    
    logData.forEach((item, idx) => {
        itemsProcessed++;
        if (item.tipe === 'ISTIRAHAT') {
            console.log(`  ⏸️ [${idx}] Skipped ISTIRAHAT: ${item.tanggal}`);
            itemsSkipped++;
            return;
        }
        if (!item.tanggal) {
            console.log(`  ❌ [${idx}] No tanggal field`);
            itemsSkipped++;
            return;
        }
        if (tasksByDay[item.tanggal]) {
            tasksByDay[item.tanggal].count++;
            itemsMatched++;
            console.log(`  ✓ [${idx}] MATCHED: ${item.tanggal}: "${item.namaKlien}" | Selesai: ${item.jamSelesai}`);
        } else {
            console.log(`  ⚠️ [${idx}] NO MATCH: "${item.tanggal}" tidak ada di tasksByDay keys`);
            itemsSkipped++;
        }
    });
    
    console.log(`📊 Processing summary: ${itemsProcessed} total | ${itemsMatched} matched | ${itemsSkipped} skipped`);
    console.log(`📊 Tasks by day:`, tasksByDay);
    
    const dates = Object.keys(tasksByDay).sort();
    const tasksPerDay = dates.map(d => tasksByDay[d].count);
    const maxTasks = Math.max(...tasksPerDay, 5);
    const TARGET_PER_DAY = 5;
    
    console.log(`📊 Task counts per day: [${tasksPerDay.join(', ')}]`);
    console.log(`📊 Max tasks: ${maxTasks}, Target per day: ${TARGET_PER_DAY}`);
    
    // Get actual canvas dimensions
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = 200;
    
    console.log(`🎨 Canvas size: ${canvas.width}px × ${canvas.height}px`);
    console.log(`🎨 Canvas parent rect:`, rect);
    
    // Chart dimensions
    const padding = 40;
    const chartWidth = canvas.width - (padding * 2);
    const chartHeight = canvas.height - padding - 50;
    const barWidth = chartWidth / dates.length - 5;
    const targetLineY = padding + chartHeight - (TARGET_PER_DAY / maxTasks) * chartHeight;
    
    console.log(`🎨 Chart calculations: padding=${padding}, barWidth=${barWidth}, chartHeight=${chartHeight}`);
    
    // Clear canvas
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    console.log('🎨 Canvas cleared');
    
    // Draw target line
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding, targetLineY);
    ctx.lineTo(canvas.width - padding, targetLineY);
    ctx.stroke();
    ctx.setLineDash([]);
    console.log(`🎨 Target line drawn at Y=${targetLineY}`);
    
    // Draw bars and labels
    let barsDrawn = 0;
    dates.forEach((dateStr, index) => {
        const dayData = tasksByDay[dateStr];
        const x = padding + (index * (barWidth + 5));
        const barHeight = (dayData.count / maxTasks) * chartHeight;
        const y = padding + chartHeight - barHeight;
        
        // Draw bar
        if (dayData.count >= TARGET_PER_DAY) {
            ctx.fillStyle = '#28a745'; // Green - success
        } else if (dayData.count > 0) {
            ctx.fillStyle = '#d92534'; // Red - warning
        } else {
            ctx.fillStyle = '#e9ecef'; // Gray - empty
        }
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // Draw border
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, barWidth, barHeight);
        
        // Draw day label (e.g., "Sab")
        ctx.fillStyle = '#666';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(dayData.day, x + barWidth / 2, canvas.height - 3);
        
        // Draw date label (e.g., "18")
        const dateNum = dateStr.split('/')[0]; // Extract DD from DD/MM/YYYY
        ctx.fillStyle = '#999';
        ctx.font = '10px Arial';
        ctx.fillText(dateNum, x + barWidth / 2, canvas.height - 25);
        
        // Draw count label on top of bar
        ctx.fillStyle = '#333';
        ctx.font = 'bold 11px Arial';
        ctx.fillText(dayData.count, x + barWidth / 2, y - 5);
        
        console.log(`  🎨 Bar[${index}] ${dayData.day} ${dateNum} (${dateStr}): count=${dayData.count}, color=${dayData.count >= TARGET_PER_DAY ? 'GREEN' : dayData.count > 0 ? 'ORANGE' : 'GRAY'}`);
        barsDrawn++;
    });
    
    console.log(`✅ Chart complete! ${barsDrawn} bars drawn`);
    console.log('═══════════════════════════════════════════════');
}

// ===============================================
// FUNGSI POPULATE WEEKLY CHART - Canvas-based (8 weeks, newest on right)
// ===============================================
async function populateWeeklyChart() {
    console.log('═══════════════════════════════════════════════');
    console.log('🎬 populateWeeklyChart() STARTED');
    console.log('═══════════════════════════════════════════════');
    
    const canvas = document.getElementById('weeklyBarChart');
    if (!canvas) {
        console.error('❌ FATAL: Canvas element not found!');
        return;
    }
    console.log('✅ Canvas element found:', canvas);
    
    const ctx = canvas.getContext('2d');
    console.log('✅ Canvas context 2d obtained');
    
    // Check localStorage
    const storageKey = 'dashboardHistoriSepekan';
    const rawData = localStorage.getItem(storageKey);
    console.log(`📦 Checking localStorage key: "${storageKey}"`);
    
    let logData = JSON.parse(rawData) || [];
    console.log(`📊 Parsed data count: ${logData.length} items`);
    
    if (logData.length === 0) {
        console.log('⚠️ No data in localStorage, attempting to fetch from server...');
        try {
            await muatHistoriSepekan();
            logData = JSON.parse(localStorage.getItem(storageKey)) || [];
            console.log(`📦 After fetch - Data count: ${logData.length} items`);
        } catch (err) {
            console.error('❌ Fetch failed:', err);
            return;
        }
    }
    
    // PENTING: Tambahkan data hari ini dari dailyLogTeknisi agar tugas hari ini muncul di chart
    const today = new Date();
    const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    const dailyLogRaw = localStorage.getItem('dailyLogTeknisi');
    const dailyLogData = JSON.parse(dailyLogRaw) || [];
    
    console.log(`📝 [PENTING] Including today's dailyLogTeknisi data: ${dailyLogData.length} items`);
    console.log(`📅 Today's date string: "${todayStr}"`);
    
    // Filter dailyLogTeknisi untuk hanya hari ini dan gabung dengan logData
    const todayDailyTasks = dailyLogData.filter(item => item.tanggal === todayStr && item.tipe !== 'ISTIRAHAT');
    console.log(`📝 Today's daily tasks (filtered): ${todayDailyTasks.length} items`);
    if (todayDailyTasks.length > 0) {
        console.log(`📋 Today's tasks sample:`, todayDailyTasks.slice(0, 3));
    }
    
    // Gabung: history + hari ini dari daily log
    logData = logData.concat(todayDailyTasks);
    console.log(`✅ Combined data (history + today): ${logData.length} items`);
    
    // Helper function: Get Monday of the week for a given date
    function getMondayOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }
    
    // Get weeks for the selected month (not relative to today)
    const selectedMonth = selectedDashboardDate.getMonth();
    const selectedYear = selectedDashboardDate.getFullYear();
    const tasksByWeek = {};
    
    console.log(`📅 Selected month: ${selectedMonth + 1}/${selectedYear}`);
    
    // Get first and last day of selected month
    const firstDayOfMonth = new Date(selectedYear, selectedMonth, 1);
    const lastDayOfMonth = new Date(selectedYear, selectedMonth + 1, 0);
    
    console.log(`📅 First day of month: ${firstDayOfMonth.toLocaleDateString('id-ID')}`);
    console.log(`📅 Last day of month: ${lastDayOfMonth.toLocaleDateString('id-ID')}`);
    
    // Collect all weeks that fall within or overlap with the selected month
    const weeksInMonth = new Set();
    let currentDate = new Date(firstDayOfMonth);
    
    // Start from Monday of the first day's week
    currentDate = getMondayOfWeek(currentDate);
    
    // Go until we pass the last day of the month (include partial weeks)
    while (currentDate <= lastDayOfMonth) {
        const weekKey = `${String(currentDate.getDate()).padStart(2, '0')}/${String(currentDate.getMonth() + 1).padStart(2, '0')}/${currentDate.getFullYear()}`;
        const sunday = new Date(currentDate);
        sunday.setDate(sunday.getDate() + 6);
        const weekLabel = `${currentDate.getDate()}/${currentDate.getMonth() + 1} - ${sunday.getDate()}/${sunday.getMonth() + 1}`;
        
        tasksByWeek[weekKey] = { count: 0, week: weekLabel, mondayDate: new Date(currentDate) };
        weeksInMonth.add(weekKey);
        
        // Move to next Monday
        currentDate.setDate(currentDate.getDate() + 7);
    }
    
    console.log(`📅 Weeks in/overlapping month (${weeksInMonth.size} weeks):`, Array.from(weeksInMonth).sort());
    
    // Count all tasks for each week
    let itemsProcessed = 0;
    let itemsMatched = 0;
    let itemsSkipped = 0;
    
    logData.forEach((item, idx) => {
        itemsProcessed++;
        if (item.tipe === 'ISTIRAHAT') {
            console.log(`  ⏸️ [${idx}] Skipped ISTIRAHAT: ${item.tanggal}`);
            itemsSkipped++;
            return;
        }
        if (!item.tanggal) {
            console.log(`  ❌ [${idx}] No tanggal field`);
            itemsSkipped++;
            return;
        }
        
        // Parse item date in format DD/MM/YYYY
        const dateParts = item.tanggal.split('/');
        if (dateParts.length !== 3) {
            console.log(`  ❌ [${idx}] Invalid date format: "${item.tanggal}"`);
            itemsSkipped++;
            return;
        }
        
        const itemDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
        const weekMonday = getMondayOfWeek(itemDate);
        const weekKey = `${String(weekMonday.getDate()).padStart(2, '0')}/${String(weekMonday.getMonth() + 1).padStart(2, '0')}/${weekMonday.getFullYear()}`;
        
        if (tasksByWeek[weekKey]) {
            tasksByWeek[weekKey].count++;
            itemsMatched++;
            console.log(`  ✓ [${idx}] MATCHED: ${item.tanggal} → ${weekKey}: ${item.namaKlien}`);
        } else {
            console.log(`  ⚠️ [${idx}] NO MATCH: "${weekKey}" tidak ada di tasksByWeek keys`);
            itemsSkipped++;
        }
    });
    
    console.log(`📊 Processing summary: ${itemsProcessed} total | ${itemsMatched} matched | ${itemsSkipped} skipped`);
    console.log(`📊 Tasks by week:`, tasksByWeek);
    
    const weeks = Object.keys(tasksByWeek).sort();
    
    // If no weeks in selected month, show empty message
    if (weeks.length === 0) {
        console.log('⚠️ No weeks found for selected month');
        // Draw empty canvas with message
        ctx.fillStyle = '#e9ecef';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#868e96';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Tidak ada data untuk bulan ini', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    const tasksPerWeek = weeks.map(w => tasksByWeek[w].count);
    const maxTasks = Math.max(...tasksPerWeek, 35);
    const TARGET_PER_WEEK = 35;
    
    console.log(`📊 Task counts per week: [${tasksPerWeek.join(', ')}]`);
    console.log(`📊 Max tasks: ${maxTasks}, Target per week: ${TARGET_PER_WEEK}`);
    
    // Get actual canvas dimensions
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = 200;
    
    console.log(`🎨 Canvas size: ${canvas.width}px × ${canvas.height}px`);
    
    // Chart dimensions
    const padding = 40;
    const chartWidth = canvas.width - (padding * 2);
    const chartHeight = canvas.height - padding - 50;
    const barWidth = chartWidth / weeks.length - 5;
    const targetLineY = padding + chartHeight - (TARGET_PER_WEEK / maxTasks) * chartHeight;
    
    console.log(`🎨 Chart calculations: padding=${padding}, barWidth=${barWidth}, chartHeight=${chartHeight}`);
    
    // Clear canvas
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    console.log('🎨 Canvas cleared');
    
    // Draw target line
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding, targetLineY);
    ctx.lineTo(canvas.width - padding, targetLineY);
    ctx.stroke();
    ctx.setLineDash([]);
    console.log(`🎨 Target line drawn at Y=${targetLineY}`);
    
    // Draw bars and labels
    let barsDrawn = 0;
    weeks.forEach((weekKey, index) => {
        const weekData = tasksByWeek[weekKey];
        const x = padding + (index * (barWidth + 5));
        const barHeight = (weekData.count / maxTasks) * chartHeight;
        const y = padding + chartHeight - barHeight;
        
        // Draw bar
        if (weekData.count >= TARGET_PER_WEEK) {
            ctx.fillStyle = '#28a745'; // Green - success
        } else if (weekData.count > 0) {
            ctx.fillStyle = '#d92534'; // Red - warning
        } else {
            ctx.fillStyle = '#e9ecef'; // Gray - empty
        }
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // Draw border
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, barWidth, barHeight);
        
        // Draw week label (Mg1, Mg2, etc. or W01, W02, etc.)
        ctx.fillStyle = '#666';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        const weekNum = index + 1;
        ctx.fillText(`Mg${weekNum}`, x + barWidth / 2, canvas.height - 3);
        
        // Draw date label
        ctx.fillStyle = '#999';
        ctx.font = '10px Arial';
        ctx.fillText(weekKey.split('/')[0], x + barWidth / 2, canvas.height - 25);
        
        // Draw count label on top of bar
        ctx.fillStyle = '#333';
        ctx.font = 'bold 11px Arial';
        ctx.fillText(weekData.count, x + barWidth / 2, y - 5);
        
        console.log(`  🎨 Bar[${index}] Mg${weekNum} (${weekKey}): count=${weekData.count}, color=${weekData.count >= TARGET_PER_WEEK ? 'GREEN' : weekData.count > 0 ? 'RED' : 'GRAY'}`);
        barsDrawn++;
    });
    
    console.log(`✅ Chart complete! ${barsDrawn} bars drawn`);
    console.log('═══════════════════════════════════════════════');
}

// ===============================================
// FUNGSI LOAD HISTORY DATA - Weekly (7 days)
// ===============================================
async function muatHistoriSepekan() {
    console.log('═══════════════════════════════════════════════');
    console.log('🔄 [muatHistoriSepekan] STARTED');
    console.log('═══════════════════════════════════════════════');
    
    const namaTeknisiInput = document.getElementById('nama').value;
    const namaFromStorage = localStorage.getItem('logSettingNama');
    const namaRaw = namaTeknisiInput || namaFromStorage;
    const namaTeknski = normalizeTechnicianName(namaRaw);
    
    console.log(`📝 [muatHistoriSepekan] Nama input: "${namaTeknisiInput}"`);
    console.log(`📝 [muatHistoriSepekan] Nama storage: "${namaFromStorage}"`);
    console.log(`📝 [muatHistoriSepekan] Nama normalized: "${namaTeknski}"`);
    console.log(`🌐 [muatHistoriSepekan] Online status: ${navigator.onLine}`);
    
    if (!namaTeknski || !navigator.onLine) {
        console.log(`❌ [muatHistoriSepekan] Sync failed - Name empty: ${!namaTeknski} | Offline: ${!navigator.onLine}`);
        return;
    }

    try {
        // Use get_log action to fetch from History_{TechnicianName} sheet
        const sheetName = "History_" + namaTeknski;
        const requestBody = { 
            action: "get_log", 
            reqNama: sheetName
        };
        console.log(`📤 [muatHistoriSepekan] Fetching sheet: "${sheetName}"`);
        console.log(`📤 [muatHistoriSepekan] Request body:`, requestBody);
        
        const respon = await fetch(scriptURL, { 
            method: 'POST', 
            body: JSON.stringify(requestBody), 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' } 
        });
        
        console.log(`📥 [muatHistoriSepekan] Response received - Status: ${respon.status} ${respon.statusText}`);
        
        const resJson = await respon.json();
        
        console.log(`📥 [muatHistoriSepekan] JSON parsed:`, resJson);
        
        if (resJson.status === 'success' && resJson.data) {
            console.log(`✅ [muatHistoriSepekan] API success! Records from API: ${resJson.data.length}`);
            console.log(`📋 [muatHistoriSepekan] First 3 records:`, resJson.data.slice(0, 3));
            
            // Filter data: past 7 days + today, exclude ISTIRAHAT
            const today = new Date();
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            
            console.log(`📅 [muatHistoriSepekan] Today: ${today.toLocaleDateString('id-ID')} (${today})`);
            console.log(`📅 [muatHistoriSepekan] 7 days ago: ${sevenDaysAgo.toLocaleDateString('id-ID')} (${sevenDaysAgo})`);
            
            let filterStats = { istirahat: 0, invalidDate: 0, outOfRange: 0, included: 0 };
            
            const filteredData = resJson.data.filter(item => {
                if (item.tipe === 'ISTIRAHAT') {
                    filterStats.istirahat++;
                    return false;
                }
                
                // Parse date in id-ID format (DD/MM/YYYY)
                const dateParts = item.tanggal.split('/');
                if (dateParts.length !== 3) {
                    console.log(`❌ [muatHistoriSepekan] Invalid date format: "${item.tanggal}"`);
                    filterStats.invalidDate++;
                    return false;
                }
                const itemDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
                const isInRange = itemDate >= sevenDaysAgo && itemDate <= today;
                
                if (!isInRange) {
                    filterStats.outOfRange++;
                    return false;
                }
                
                filterStats.included++;
                return true;
            });
            
            console.log(`📊 [muatHistoriSepekan] Filter stats:`, filterStats);
            console.log(`✅ [muatHistoriSepekan] Filtered records: ${filteredData.length}`);
            
            if (filteredData.length > 0) {
                console.log(`📋 [muatHistoriSepekan] First filtered item:`, filteredData[0]);
                console.log(`📋 [muatHistoriSepekan] Last filtered item:`, filteredData[filteredData.length - 1]);
            }
            
            // Store in SEPARATE key to avoid overwriting daily log
            console.log('💾 [muatHistoriSepekan] Saving to localStorage...');
            localStorage.setItem('dashboardHistoriSepekan', JSON.stringify(filteredData));
            localStorage.setItem('lastHistorySync', new Date().toISOString());
            
            // Verify save
            const saved = localStorage.getItem('dashboardHistoriSepekan');
            const savedCount = JSON.parse(saved || '[]').length;
            console.log(`✅ [muatHistoriSepekan] Saved successfully! Key: "dashboardHistoriSepekan", Items: ${savedCount}`);
            console.log(`✅ [muatHistoriSepekan] Last sync timestamp:`, localStorage.getItem('lastHistorySync'));
            console.log('═══════════════════════════════════════════════');
            console.log('✅ [muatHistoriSepekan] COMPLETED SUCCESSFULLY');
            console.log('═══════════════════════════════════════════════');
        } else {
            console.log('⚠️ [muatHistoriSepekan] API returned no data or error:', resJson);
            console.log('═══════════════════════════════════════════════');
            console.log('❌ [muatHistoriSepekan] FAILED - No data from API');
            console.log('═══════════════════════════════════════════════');
        }
    } catch (err) {
        console.error("❌ [muatHistoriSepekan] Fetch failed:", err);
        console.error("   Error name:", err.name);
        console.error("   Error message:", err.message);
        console.error("   Error stack:", err.stack);
        console.log('═══════════════════════════════════════════════');
        console.log('❌ [muatHistoriSepekan] FAILED - Exception');
        console.log('═══════════════════════════════════════════════');
    }
}

// ===============================================
// FUNGSI FETCH TODAY'S LOG - Dari sheet teknisi utama
// ===============================================
async function muatLogHariIni() {
    const namaTeknisiInput = document.getElementById('nama').value;
    const namaFromStorage = localStorage.getItem('logSettingNama');
    const namaRaw = namaTeknisiInput || namaFromStorage;
    const namaTeknski = normalizeTechnicianName(namaRaw);
    
    console.log('📋 muatLogHariIni() started - Fetching from main sheet');
    console.log('📝 Nama Teknisi:', namaTeknski);
    
    if (!namaTeknski || !navigator.onLine) {
        console.log('❌ Failed - No name or offline');
        return;
    }

    try {
        // Fetch from main technician sheet (not History_{name})
        const requestBody = { 
            action: "get_log", 
            reqNama: namaTeknski
        };
        console.log('📤 Sending request:', requestBody);
        
        const respon = await fetch(scriptURL, { 
            method: 'POST', 
            body: JSON.stringify(requestBody), 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' } 
        });
        const resJson = await respon.json();
        
        console.log('📥 API Response:', resJson);
        
        if (resJson.status === 'success' && resJson.data) {
            console.log('📊 Total records from main sheet:', resJson.data.length);
            
            // Store today's data from main sheet
            localStorage.setItem('dailyLogTeknisi', JSON.stringify(resJson.data));
            logData = resJson.data;
            
            console.log('💾 Saved to localStorage - dailyLogTeknisi');
            console.log('🔄 Refreshing timeline display');
            tampilkanLog();
        } else {
            console.log('⚠️ API returned no data or error:', resJson);
        }
    } catch (err) {
        console.log("❌ Gagal memuat log hari ini:", err);
    }
}

// ===============================================
// FUNGSI DATE PICKER - Generate Pills (Senin - Minggu)
// ===============================================
function generateDatePills() {
    const container = document.getElementById('datePillsContainer');
    container.innerHTML = '';
    container.classList.remove('month-view');
    
    console.log('🔄 generateDatePills() called');
    
    // Normalize selectedDashboardDate to DD/MM/YYYY
    const day = String(selectedDashboardDate.getDate()).padStart(2, '0');
    const month = String(selectedDashboardDate.getMonth() + 1).padStart(2, '0');
    const year = selectedDashboardDate.getFullYear();
    const selectedStr = `${day}/${month}/${year}`;
    
    console.log('📅 selectedDashboardDate:', selectedStr);
    
    const today = new Date();
    const datesArray = [];
    
    // Cari tanggal untuk hari Senin di minggu ini
    const dayOfWeek = today.getDay(); // 0 = Minggu, 1 = Senin, dst
    // Jika hari ini Minggu (0), maka mundur 6 hari. Jika bukan, mundur (dayOfWeek - 1) hari.
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; 
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - diffToMonday);
    
    // Generate 7 hari dari Senin sampai Minggu
    for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        datesArray.push(date);
    }
    
    let currentMonth = null;
    
    // Generate pills grouped by month
    datesArray.forEach(date => {
        const dayNum = date.getDate();
        const dateMonth = date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
        
        // Create month header if month changed
        if (currentMonth !== dateMonth) {
            currentMonth = dateMonth;
            const monthHeader = document.createElement('div');
            monthHeader.style.cssText = `
                font-size: 11px;
                font-weight: 700;
                color: var(--text-muted);
                text-align: center;
                margin-top: 8px;
                margin-bottom: 6px;
                width: 100%;
            `;
            monthHeader.textContent = dateMonth;
            container.appendChild(monthHeader);
        }
        
        // Create pill with only date number
        const pill = document.createElement('div');
        pill.className = 'date-pill';
        pill.innerHTML = dayNum;
        pill.onclick = () => selectDatePill(pill, date);
        pill.dataset.dateStr = date.toLocaleDateString('id-ID');
        
        // Check if this date matches the selected date
        const dateDay = String(date.getDate()).padStart(2, '0');
        const dateMonth2 = String(date.getMonth() + 1).padStart(2, '0');
        const dateYear = date.getFullYear();
        const dateStr = `${dateDay}/${dateMonth2}/${dateYear}`;
        
        if (dateStr === selectedStr) {
            pill.classList.add('active');
            console.log('✅ Active pill:', dateStr);
        }
        
        container.appendChild(pill);
    });
    
    console.log('✅ Pills generated (Senin - Minggu)');
}

async function selectDatePill(pillElement, dateObj) {
    // Normalize to DD/MM/YYYY
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const selectedStr = `${day}/${month}/${year}`;
    
    console.log('📌 selectDatePill() - Selected:', selectedStr);
    
    document.querySelectorAll('.date-pill').forEach(p => p.classList.remove('active'));
    pillElement.classList.add('active');
    
    // Update selected date and refresh metrics
    selectedDashboardDate = new Date(dateObj);
    console.log('📅 Updated selectedDashboardDate:', selectedStr);
    await muatDashboardStats();
}

// ===============================================
// FUNGSI GENERATE MONTH PILLS (untuk tab mingguan)
// ===============================================
function generateMonthPills() {
    const container = document.getElementById('datePillsContainer');
    container.innerHTML = '';
    container.classList.add('month-view');
    
    console.log('🔄 generateMonthPills() called');
    
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    console.log(`📅 Current date: ${today.toLocaleDateString('id-ID')}`);
    
    // Create array of 6 months (current month + 5 previous months)
    const months = [];
    for (let i = 5; i >= 0; i--) {
        let month = currentMonth - i;
        let year = currentYear;
        
        // Handle year boundary
        if (month < 0) {
            month += 12;
            year -= 1;
        }
        
        months.push({ month: month, year: year });
    }
    
    console.log('📅 Months to display:', months);
    
    // Generate month pills
    months.forEach((monthData, idx) => {
        const pill = document.createElement('div');
        pill.className = 'date-pill';
        
        // Display month name and year
        const monthName = new Date(monthData.year, monthData.month).toLocaleDateString('id-ID', { month: 'short' });
        const yearStr = String(monthData.year).slice(-2); // Get last 2 digits of year
        
        pill.innerHTML = `<span style="font-size: 13px;">${monthName}</span><span style="font-size: 10px; margin-top: 2px;">'${yearStr}</span>`;
        
        // Check if this month is current month
        if (monthData.month === currentMonth && monthData.year === currentYear) {
            pill.classList.add('active');
            console.log(`✅ Active month: ${monthName}/${yearStr}`);
        }
        
        // Store month data
        pill.dataset.month = monthData.month;
        pill.dataset.year = monthData.year;
        
        // Click handler
        pill.onclick = () => selectMonthPill(pill, monthData);
        
        container.appendChild(pill);
    });
    
    console.log('✅ Month pills generated');
}

// ===============================================
// FUNGSI UPDATE WEEKLY METRICS
// ===============================================
async function updateWeeklyMetrics() {
    console.log('📊 updateWeeklyMetrics() called');
    
    const storageKey = 'dashboardHistoriSepekan';
    const rawData = localStorage.getItem(storageKey);
    let logData = JSON.parse(rawData) || [];
    
    const dailyLogRaw = localStorage.getItem('dailyLogTeknisi');
    const dailyLogData = JSON.parse(dailyLogRaw) || [];
    
    // Helper function: Get Monday of the week for a given date
    function getMondayOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }
    
    // Get weeks for the selected month
    const selectedMonth = selectedDashboardDate.getMonth();
    const selectedYear = selectedDashboardDate.getFullYear();
    const firstDayOfMonth = new Date(selectedYear, selectedMonth, 1);
    const lastDayOfMonth = new Date(selectedYear, selectedMonth + 1, 0);
    
    // Collect all weeks in the month
    const weeksInMonth = new Set();
    let currentDate = new Date(firstDayOfMonth);
    currentDate = getMondayOfWeek(currentDate);
    
    while (currentDate <= lastDayOfMonth) {
        const weekKey = `${String(currentDate.getDate()).padStart(2, '0')}/${String(currentDate.getMonth() + 1).padStart(2, '0')}/${currentDate.getFullYear()}`;
        weeksInMonth.add(weekKey);
        currentDate.setDate(currentDate.getDate() + 7);
    }
    
    console.log(`📊 Weeks in selected month:`, Array.from(weeksInMonth).sort());
    
    // Count total tugas across all weeks in the month
    let totalTugas = 0;
    let totalKendala = 0;
    
    // Count dari history data
    logData.forEach(item => {
        if (item.tipe === 'ISTIRAHAT' || !item.tanggal) return;
        
        // Parse date
        const dateParts = item.tanggal.split('/');
        if (dateParts.length !== 3) return;
        
        const itemDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
        const weekMonday = getMondayOfWeek(itemDate);
        const weekKey = `${String(weekMonday.getDate()).padStart(2, '0')}/${String(weekMonday.getMonth() + 1).padStart(2, '0')}/${weekMonday.getFullYear()}`;
        
        if (weeksInMonth.has(weekKey)) {
            const hasValidJamSelesai = item.jamSelesai && item.jamSelesai !== '-' && item.jamSelesai.trim() !== '';
            if (hasValidJamSelesai) {
                totalTugas++;
            }
        }
    });
    
    // Count dari daily log
    dailyLogData.forEach(item => {
        if (item.tipe === 'ISTIRAHAT' || !item.tanggal) return;
        
        const dateParts = item.tanggal.split('/');
        if (dateParts.length !== 3) return;
        
        const itemDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
        const weekMonday = getMondayOfWeek(itemDate);
        const weekKey = `${String(weekMonday.getDate()).padStart(2, '0')}/${String(weekMonday.getMonth() + 1).padStart(2, '0')}/${weekMonday.getFullYear()}`;
        
        if (weeksInMonth.has(weekKey)) {
            const hasValidJamSelesai = item.jamSelesai && item.jamSelesai !== '-' && item.jamSelesai.trim() !== '';
            if (hasValidJamSelesai) {
                totalTugas++;
            }
            
            const hasKendala = item.kendala && item.kendala.trim() !== '' && item.kendala.trim() !== '-';
            if (hasKendala) {
                totalKendala++;
            }
        }
    });
    
    console.log(`📊 Weekly metrics - Total tugas: ${totalTugas}, Total kendala: ${totalKendala}`);
    
    // Update UI
    document.getElementById('metricValueWeeklyTugas').innerText = totalTugas;
    document.getElementById('metricValueWeeklyKendala').innerText = totalKendala;
    
    // Change color based on target (35 for the month)
    const metricTugasElement = document.getElementById('metricValueWeeklyTugas');
    if (totalTugas >= 35) {
        metricTugasElement.style.color = '#28a745'; // Green
    } else {
        metricTugasElement.style.color = 'var(--primary)'; // Red
    }
    
    console.log('✅ Weekly metrics updated');
}

async function selectMonthPill(pillElement, monthData) {
    console.log(`📌 selectMonthPill() - Selected: ${monthData.month + 1}/${monthData.year}`);
    
    // Remove active class from all pills
    document.querySelectorAll('.date-pill').forEach(p => p.classList.remove('active'));
    pillElement.classList.add('active');
    
    // Set selectedDashboardDate to first day of selected month
    selectedDashboardDate = new Date(monthData.year, monthData.month, 1);
    console.log('📅 Updated selectedDashboardDate:', selectedDashboardDate.toLocaleDateString('id-ID'));
    
    // Only refresh weekly chart, keep pills as monthly
    console.log('📊 Refreshing weekly chart for selected month...');
    await populateWeeklyChart();
    
    // Update weekly metrics
    await updateWeeklyMetrics();
}

// ===============================================
// FUNGSI TASK HISTORY MODAL
// ===============================================
function openTaskHistoryModal() {
    console.log('🔓 openTaskHistoryModal() called');
    const modal = document.getElementById('modalTaskHistory');
    modal.style.display = 'flex';
    console.log('📋 Modal displayed');
    populateTaskHistory();
}

function closeTaskHistoryModal() {
    console.log('🔒 closeTaskHistoryModal() called');
    const modal = document.getElementById('modalTaskHistory');
    modal.style.display = 'none';
}

function populateTaskHistory() {
    const historyList = document.getElementById('taskHistoryList');
    
    console.log('📖 populateTaskHistory() called');
    
    // Ambil data log dari dashboardHistoriSepekan (7 hari + hari ini) ATAU dailyLogTeknisi (hari ini baru)
    let logData = JSON.parse(localStorage.getItem('dashboardHistoriSepekan')) || [];
    const dailyLogData = JSON.parse(localStorage.getItem('dailyLogTeknisi')) || [];
    
    // Combine kedua sumber: history + daily log hari ini (daily log punya data lebih fresh)
    logData = [...logData, ...dailyLogData];
    
    console.log('📦 dashboardHistoriSepekan data:', JSON.parse(localStorage.getItem('dashboardHistoriSepekan')) || []);
    console.log('📦 dailyLogTeknisi data:', dailyLogData);
    console.log('📊 Total items combined:', logData.length);
    
    // Normalize date to DD/MM/YYYY format (with leading zeros)
    const day = String(selectedDashboardDate.getDate()).padStart(2, '0');
    const month = String(selectedDashboardDate.getMonth() + 1).padStart(2, '0');
    const year = selectedDashboardDate.getFullYear();
    const selectedDateStr = `${day}/${month}/${year}`;
    
    console.log('📅 Selected date:', selectedDateStr);
    
    // Filter: match selected date, exclude ISTIRAHAT, only completed tasks (jamSelesai valid)
    const filteredData = logData.filter(item => {
        const isIstirahat = item.tipe === 'ISTIRAHAT';
        const hasNoDate = !item.tanggal;
        const dateMatch = item.tanggal === selectedDateStr;
        const hasValidJamSelesai = item.jamSelesai && item.jamSelesai !== '-' && item.jamSelesai.trim() !== '';
        
        console.log(`  Checking: ${item.namaKlien || 'Unknown'} | Tipe: ${item.tipe} | Date: ${item.tanggal} | JamSelesai: ${item.jamSelesai} | Match: ${dateMatch && hasValidJamSelesai}`);
        
        if (item.tipe === 'ISTIRAHAT') return false;
        if (!item.tanggal) return false;
        if (!dateMatch) return false;
        return hasValidJamSelesai;
    });
    
    console.log('✅ Filtered data:', filteredData);
    console.log('📊 Filtered count:', filteredData.length);
    
    if (filteredData.length === 0) {
        console.log('⚠️ No data for selected date');
        historyList.innerHTML = '<div style="text-align: center; padding: 40px 20px; color: var(--text-muted);"><p><i class="fa-solid fa-inbox" style="font-size: 32px; margin-bottom: 10px; display: block; opacity: 0.3;"></i>Belum ada riwayat tugas pada tanggal ini</p></div>';
        return;
    }
    
    historyList.innerHTML = '';
    
    filteredData.forEach((item, idx) => {
        console.log(`🎯 Creating item ${idx}:`, item);
        
        const itemDiv = document.createElement('div');
        itemDiv.className = 'task-history-item';
        
        itemDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 12px;">
                <div class="task-history-row" style="margin: 0;">
                    <i class="fa-solid fa-briefcase"></i>
                    <span style="font-weight: 600;">${item.namaKlien || 'Unknown'}</span>
                </div>
                <div class="task-history-row" style="margin: 0;">
                    <i class="fa-solid fa-location-dot"></i>
                    <span class="task-location">${item.alamatKlien || 'Unknown'}</span>
                </div>
            </div>
            <div class="task-history-row" style="margin: 0; padding-top: 12px; border-top: 1px solid var(--border);">
                <i class="fa-solid fa-list"></i>
                <span style="color: var(--text-muted);">${item.detail || 'Tidak ada detail'}</span>
            </div>
        `;
        
        historyList.appendChild(itemDiv);
        console.log(`✅ Item ${idx} added to DOM`);
    });
    
    console.log('✅ populateTaskHistory() completed');
}

// ===============================================
// FUNGSI MODAL KENDALA (TUGAS BERMASALAH)
// ===============================================
function openKendalaModal() {
    console.log('🔓 openKendalaModal() called');
    const modal = document.getElementById('modalKendalaList');
    modal.style.display = 'flex';
    console.log('📋 Kendala modal displayed');
    populateKendalaList();
}

function closeKendalaModal() {
    console.log('🔒 closeKendalaModal() called');
    const modal = document.getElementById('modalKendalaList');
    modal.style.display = 'none';
}

function populateKendalaList() {
    const kendalaList = document.getElementById('kendalaListContainer');
    
    console.log('📖 populateKendalaList() called');
    
    // Ambil data log dari dailyLogTeknisi (hanya hari ini dengan kendala)
    const logData = JSON.parse(localStorage.getItem('dailyLogTeknisi')) || [];
    console.log('📦 dailyLogTeknisi data:', logData);
    console.log('📊 Total items in dailyLogTeknisi:', logData.length);
    
    // Normalize date to DD/MM/YYYY format (with leading zeros)
    const day = String(selectedDashboardDate.getDate()).padStart(2, '0');
    const month = String(selectedDashboardDate.getMonth() + 1).padStart(2, '0');
    const year = selectedDashboardDate.getFullYear();
    const selectedDateStr = `${day}/${month}/${year}`;
    
    console.log('📅 Selected date:', selectedDateStr);
    
    // Filter: match selected date, exclude ISTIRAHAT, non-empty kendala
    const filteredData = logData.filter(item => {
        const isIstirahat = item.tipe === 'ISTIRAHAT';
        const hasNoDate = !item.tanggal;
        const dateMatch = item.tanggal === selectedDateStr;
        const hasKendala = item.kendala && item.kendala.trim() !== '' && item.kendala.trim() !== '-';
        
        console.log(`  Checking: ${item.namaKlien || 'Unknown'} | Tipe: ${item.tipe} | Date: ${item.tanggal} | Kendala: ${item.kendala} | Match: ${dateMatch && hasKendala}`);
        
        if (item.tipe === 'ISTIRAHAT') return false;
        if (!item.tanggal) return false;
        return item.tanggal === selectedDateStr && hasKendala;
    });
    
    console.log('✅ Filtered kendala data:', filteredData);
    console.log('📊 Filtered count:', filteredData.length);
    
    if (filteredData.length === 0) {
        console.log('⚠️ No kendala for selected date');
        kendalaList.innerHTML = '<div style="text-align: center; padding: 40px 20px; color: var(--text-muted);"><p><i class="fa-solid fa-check-circle" style="font-size: 32px; margin-bottom: 10px; display: block; opacity: 0.3;"></i>Tidak ada tugas bermasalah pada tanggal ini</p></div>';
        return;
    }
    
    kendalaList.innerHTML = '';
    
    filteredData.forEach((item, idx) => {
        console.log(`🎯 Creating kendala item ${idx}:`, item);
        
        const itemDiv = document.createElement('div');
        itemDiv.className = 'task-history-item';
        
        // Use jamSelesai for time display
        const waktuDisplay = item.jamSelesai || item.jamSampai || '--:--';
        
        itemDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 12px;">
                <div class="task-history-row" style="margin: 0;">
                    <i class="fa-solid fa-briefcase"></i>
                    <span style="font-weight: 600;">${item.namaKlien || 'Unknown'}</span>
                </div>
                <div class="task-history-row" style="margin: 0;">
                    <i class="fa-solid fa-location-dot"></i>
                    <span class="task-location">${item.alamatKlien || 'Unknown'}</span>
                </div>
            </div>
            <div class="task-history-row" style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border);">
                <i class="fa-solid fa-list"></i>
                <span style="color: var(--text-muted);">${item.detail || 'Tidak ada detail'}</span>
            </div>
            <div class="task-history-row" style="margin: 0;">
                <i class="fa-solid fa-exclamation" style="color: var(--primary);"></i>
                <span style="color: var(--primary); font-weight: 600;">${item.kendala}</span>
            </div>
        `;
        
        kendalaList.appendChild(itemDiv);
        console.log(`✅ Kendala item ${idx} added to DOM`);
    });
    
    console.log('✅ populateKendalaList() completed');
}

// ============= NOTIFICATION SCHEDULER MODULE =============
let notificationSchedulerActive = false;
let morningReminderSent = false;
let afternoonReminderInterval = null;

function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('⚠️ Browser tidak support Notification API');
        return false;
    }

    if (Notification.permission === 'granted') {
        console.log('✅ Notification permission sudah diberikan');
        return true;
    }

    if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                console.log('✅ Izin notifikasi diberikan oleh user');
                localStorage.setItem('notification_permission', 'granted');
                sendNotification('Teknisi Log', 'Notifikasi pengingat telah diaktifkan! 🔔');
            } else {
                console.log('❌ User menolak izin notifikasi');
                localStorage.setItem('notification_permission', 'denied');
            }
        });
    }
}

function sendNotification(title, message, options = {}) {
    if (Notification.permission !== 'granted') {
        console.log('⚠️ Notification permission not granted, skipping notification');
        return;
    }

    const defaultOptions = {
        icon: './icon.png',
        badge: './icon.png',
        tag: 'teknisilog-notification',
        requireInteraction: true,
        ...options
    };

    try {
        new Notification(title, {
            body: message,
            ...defaultOptions
        });
        console.log(`📢 Notifikasi terkirim: ${title} - ${message}`);
    } catch (err) {
        console.error('Error sending notification:', err);
    }
}

function checkActivityToday() {
    if (!logData || logData.length === 0) {
        console.log('📋 Tidak ada aktivitas hari ini');
        return false;
    }
    
    const today = new Date().toLocaleDateString('id-ID');
    const hasActivityToday = logData.some(log => {
        const logDate = new Date(log.tanggal || today).toLocaleDateString('id-ID');
        return logDate === today;
    });
    
    console.log(`📋 Activity today: ${hasActivityToday}`);
    return hasActivityToday;
}

function hasUserStartedJourney() {
    const started = currentState !== 'BERANGKAT';
    console.log(`🚗 Journey started: ${started} (currentState: ${currentState})`);
    return started;
}

function stopReminderLoop() {
    if (afternoonReminderInterval) {
        clearInterval(afternoonReminderInterval);
        afternoonReminderInterval = null;
        console.log('🛑 Reminder loop dihentikan');
        localStorage.setItem('notification_reminderStopped', 'true');
    }
}

function scheduleReminders() {
    if (notificationSchedulerActive) {
        console.log('⚙️ Scheduler sudah aktif');
        return;
    }

    const logSettingTipe = localStorage.getItem('logSettingTipe');
    if (logSettingTipe !== 'Kunjungan') {
        console.log('⚠️ Reminder hanya untuk mode Kunjungan. Current: ' + logSettingTipe);
        return;
    }

    if (Notification.permission !== 'granted') {
        console.log('⚠️ Notification not permitted, scheduler inactive');
        return;
    }

    notificationSchedulerActive = true;
    const today = new Date().toLocaleDateString('id-ID');
    localStorage.setItem('notification_schedulerDate', today);

    // Setup morning greeting (08:30)
    function checkMorningReminder() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

        if (hours === 8 && minutes >= 30 && minutes <= 31 && !morningReminderSent) {
            if (!checkActivityToday() && !hasUserStartedJourney()) {
                sendNotification(
                    'Selamat Pagi! 🌅',
                    'Selamat beraktifitas! Jangan lupa catat perjalananmu hari ini.'
                );
                morningReminderSent = true;
                localStorage.setItem('notification_morningReminder_sent', 'true');
                console.log('✅ Morning reminder sent at ' + timeString);
            }
        }
    }

    // Setup 09:30+ reminder loop (every 30 minutes)
    function checkAfternoonReminder() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

        // Stop reminders after 18:00 (6 PM)
        if (hours >= 18) {
            console.log('⏰ Passed 18:00, stopping reminder loop');
            stopReminderLoop();
            return;
        }

        // Check if user already started journey
        if (hasUserStartedJourney()) {
            console.log('🚗 User sudah mulai perjalanan, stop reminders');
            stopReminderLoop();
            return;
        }

        // Send reminder every 30 minutes starting from 09:30
        if (hours >= 9 && !checkActivityToday()) {
            const lastReminderTime = localStorage.getItem('notification_lastReminderTime');
            const lastReminderDate = localStorage.getItem('notification_lastReminderDate');
            const todayStr = new Date().toLocaleDateString('id-ID');

            // Send reminder on first check at 09:30 and then every 30 minutes
            if (!lastReminderDate || lastReminderDate !== todayStr) {
                // First reminder of the day at 09:30+
                if (minutes >= 30) {
                    sendNotification(
                        `Jam ${timeString} ⏰`,
                        'Belum berangkat atau lupa mulai catat perjalanan?'
                    );
                    localStorage.setItem('notification_lastReminderTime', timeString);
                    localStorage.setItem('notification_lastReminderDate', todayStr);
                    console.log('📢 First afternoon reminder sent at ' + timeString);
                }
            } else {
                // Check if 30 minutes passed since last reminder
                if (lastReminderTime) {
                    const [lastH, lastM] = lastReminderTime.split(':').map(Number);
                    const lastTotalMinutes = lastH * 60 + lastM;
                    const nowTotalMinutes = hours * 60 + minutes;
                    const minutesPassed = nowTotalMinutes - lastTotalMinutes;

                    if (minutesPassed >= 30) {
                        sendNotification(
                            `Jam ${timeString} ⏰`,
                            'Belum berangkat atau lupa mulai catat perjalanan?'
                        );
                        localStorage.setItem('notification_lastReminderTime', timeString);
                        console.log('📢 Repeat afternoon reminder sent at ' + timeString);
                    }
                }
            }
        }
    }

    // Check every minute
    const reminderCheckInterval = setInterval(() => {
        checkMorningReminder();
        checkAfternoonReminder();
    }, 60000); // Check every 60 seconds

    // Also store interval for stopping
    afternoonReminderInterval = reminderCheckInterval;

    // Initial check
    checkMorningReminder();
    checkAfternoonReminder();

    console.log('✅ Notification scheduler initialized');
}

function initNotificationScheduler() {
    console.log('🔔 Initializing notification scheduler...');
    
    // Request permission first
    requestNotificationPermission();

    // Then schedule reminders
    setTimeout(() => {
        scheduleReminders();
    }, 1000);
}

// ============= RUNNING TEXT ANNOUNCEMENT SYSTEM =============
function cekPengumuman() {
    const nama = localStorage.getItem('logSettingNama');
    const containerPengumuman = document.getElementById('containerPengumuman');
    const labelPengumuman = document.getElementById('labelPengumuman');
    const textPengumuman = document.getElementById('textPengumuman');
    
    if (!containerPengumuman || !textPengumuman || !labelPengumuman) {
        console.log('⚠️ Pengumuman container not found');
        return;
    }

    const payload = {
        action: 'get_pengumuman',
        nama: nama || 'Anonymous'
    };

    fetch(scriptURL, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    })
    .then(response => response.json())
    .then(data => {
        console.log('📢 Pengumuman response:', data);
        
        if (data.status === 'empty') {
            // Admin menghapus pengumuman - sembunyikan
            containerPengumuman.style.display = 'none';
            labelPengumuman.style.display = 'none';
            localStorage.removeItem('pengumumanAktif');
            localStorage.removeItem('pengumumanWaktuMulai');
            console.log('✅ Pengumuman dihapus - container disembunyikan');
            return;
        }

        if (data.status === 'success' && data.data) {
            const pesanBaru = data.data.pesan;
            const durasi = data.data.durasi || 60; // Default 60 detik
            const pesanAktif = localStorage.getItem('pengumumanAktif');
            const pesanDismissed = localStorage.getItem('pengumumanDismissed');
            const waktuMulai = localStorage.getItem('pengumumanWaktuMulai');
            
            // CEK: User sudah dismiss pengumuman ini?
            if (pesanBaru === pesanDismissed) {
                console.log('⏭️ Pengumuman sudah di-dismiss, skip...');
                return;
            }
            
            // CEK: Apakah ini pengumuman BARU?
            if (pesanBaru !== pesanAktif) {
                // Clear dismissed flag ketika announcement baru datang
                localStorage.removeItem('pengumumanDismissed');
                // Pengumuman BARU - simpan dan tampilkan
                localStorage.setItem('pengumumanAktif', pesanBaru);
                localStorage.setItem('pengumumanWaktuMulai', Date.now().toString());
                localStorage.setItem('pengumumanDurasi', durasi.toString());
                
                textPengumuman.textContent = pesanBaru;
                containerPengumuman.style.display = 'block';
                labelPengumuman.style.display = 'flex';
                
                // Sembunyikan tombol X dulu
                const btnClosePengumuman = labelPengumuman.querySelector('button');
                if (btnClosePengumuman) {
                    btnClosePengumuman.style.visibility = 'hidden';
                    btnClosePengumuman.style.opacity = '0';
                    btnClosePengumuman.style.transition = 'opacity 0.3s ease-in-out';
                    
                    // Tampilkan tombol X setelah 15 detik
                    setTimeout(() => {
                        btnClosePengumuman.style.visibility = 'visible';
                        btnClosePengumuman.style.opacity = '1';
                    }, 15000);
                }
                
                console.log('🆕 Pengumuman BARU ditampilkan:', pesanBaru);
                return;
            }

            // Pengumuman yang SAMA - cek durasi
            if (waktuMulai && pesanAktif === pesanBaru) {
                const sekarang = Date.now();
                const waktuMulaiMs = parseInt(waktuMulai);
                const selisihDetik = (sekarang - waktuMulaiMs) / 1000;
                
                console.log(`⏱️ Durasi check: ${selisihDetik.toFixed(1)}s / ${durasi}s`);
                
                if (selisihDetik > durasi) {
                    // Durasi habis - sembunyikan
                    containerPengumuman.style.display = 'none';
                    labelPengumuman.style.display = 'none';
                    localStorage.removeItem('pengumumanAktif');
                    localStorage.removeItem('pengumumanWaktuMulai');
                    console.log('⏳ Durasi pengumuman habis - disembunyikan');
                } else {
                    // Masih dalam durasi - tetap tampil
                    containerPengumuman.style.display = 'block';
                    labelPengumuman.style.display = 'flex';
                }
            }
        }
    })
    .catch(err => {
        console.error('❌ Error mengecek pengumuman:', err);
    });
}

// Panggil saat app load
window.addEventListener('DOMContentLoaded', () => {
    // Delay untuk pastikan localStorage sudah siap
    setTimeout(() => {
        cekPengumuman();
        console.log('✅ Initial pengumuman check done');
    }, 500);
});

// Tutup pengumuman secara manual
function tutupPengumuman() {
    const containerPengumuman = document.getElementById('containerPengumuman');
    const labelPengumuman = document.getElementById('labelPengumuman');
    const pesanAktif = localStorage.getItem('pengumumanAktif');
    
    if (containerPengumuman && labelPengumuman) {
        containerPengumuman.style.display = 'none';
        labelPengumuman.style.display = 'none';
        
        // Simpan pesan yang di-dismiss agar tidak muncul lagi
        if (pesanAktif) {
            localStorage.setItem('pengumumanDismissed', pesanAktif);
        }
        
        localStorage.removeItem('pengumumanAktif');
        localStorage.removeItem('pengumumanWaktuMulai');
        localStorage.removeItem('pengumumanDurasi');
        console.log('✕ Pengumuman ditutup secara manual:', pesanAktif);
    }
}

// Close modal when clicking outside
document.addEventListener('DOMContentLoaded', function() {
    const modalTaskHistory = document.getElementById('modalTaskHistory');
    if (modalTaskHistory) {
        modalTaskHistory.addEventListener('click', function(e) {
            if (e.target === modalTaskHistory) {
                closeTaskHistoryModal();
            }
        });
    }
    
    const modalKendala = document.getElementById('modalKendalaList');
    if (modalKendala) {
        modalKendala.addEventListener('click', function(e) {
            if (e.target === modalKendala) {
                closeKendalaModal();
            }
        });
    }
    
    // Initialize date pills on load
    generateDatePills();
});

// Fungsi Buka-Tutup Sidebar Pengaturan
function toggleSidebar() {
    const sidebar = document.getElementById('sidebarMenu');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        overlay.style.opacity = '0';
        setTimeout(() => overlay.style.display = 'none', 300);
    } else {
        overlay.style.display = 'block';
        setTimeout(() => {
            overlay.style.opacity = '1';
            sidebar.classList.add('active');
        }, 10);
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
    const namaReqRaw = document.getElementById('pilihTeknisiTim').value;
    const namaReq = normalizeTechnicianName(namaReqRaw);
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
                    let teksJam = log.tipe === 'Kunjungan' || log.jamBerangkat !== '-' ? `Berangkat: ${log.jamBerangkat} &nbsp;|&nbsp; Tiba: ${log.jamSampai} &nbsp;|&nbsp; Selesai: ${log.jamSelesai}` : `Mulai: ${log.jamSampai} &nbsp;|&nbsp; Selesai: ${log.jamSelesai}`;
                    li.innerHTML = `<div class="timeline-time"><i class="fa-regular fa-clock"></i> ${teksJam}</div><div class="timeline-title">${titleTampilan}</div><div class="timeline-desc">${log.detail}</div>${kendalaHTML}<div class="timeline-gps"><i class="fa-solid fa-location-dot"></i> ${log.gps}</div>`;
                    list.appendChild(li);
                });
            }
        } else { list.innerHTML = `<div class="empty-state">Gagal mengambil log: ${resJson.message}</div>`; }
    } catch (err) { list.innerHTML = `<div class="empty-state">Gagal terhubung ke server. Coba lagi.</div>`; }
    btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Lihat Pekerjaan'; btn.disabled = false;
}

// ===============================================
// ACCORDION TEAM ACTIVITY
// ===============================================
let teamDataCache = {}; // Cache untuk menyimpan data teknisi

async function muatDaftarTeknisiAccordion() {
    console.log('📋 muatDaftarTeknisiAccordion() called');
    
    if (!navigator.onLine) { 
        alert('Harus online untuk mengecek daftar tim!'); 
        return; 
    }
    
    const btn = document.getElementById('btnSyncTeknisi');
    const container = document.getElementById('daftarTeknisiAccordion');
    
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
    btn.disabled = true;
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">Memuat daftar teknisi...</div>';

    try {
        const respon = await fetch(scriptURL, { 
            method: 'POST', 
            body: JSON.stringify({ action: "get_teknisi" }), 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' } 
        });
        const resJson = await respon.json();
        
        if(resJson.status === 'success' && resJson.data.length > 0) {
            console.log('✅ Teknisi loaded:', resJson.data);
            container.innerHTML = '';
            teamDataCache = {}; // Reset cache
            
            // Create accordion for each teknisi
            resJson.data.forEach((nama, idx) => {
                const accordionItem = document.createElement('div');
                accordionItem.className = 'accordion-item';
                accordionItem.innerHTML = `
                    <div class="accordion-header" onclick="toggleAccordion(this, '${nama}')">
                        <span><i class="fa-solid fa-user-tie" style="margin-right: 10px;"></i>${nama}</span>
                        <i class="accordion-icon fa-solid fa-chevron-down"></i>
                    </div>
                    <div class="accordion-content">
                        <div class="accordion-loading">
                            <i class="fa-solid fa-spinner fa-spin"></i> Loading...
                        </div>
                    </div>
                `;
                container.appendChild(accordionItem);
            });
            
            console.log('✅ Accordion items created');
        } else {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">Tidak ada data teknisi ditemukan.</div>';
        }
    } catch (err) { 
        console.error('❌ Error loading teknisi:', err);
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">❌ Gagal terhubung ke server.</div>'; 
    }
    
    btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Sync';
    btn.disabled = false;
}

function toggleAccordion(headerEl, namaTeknisi) {
    console.log('🔄 toggleAccordion called for:', namaTeknisi);
    
    headerEl.classList.toggle('active');
    const contentEl = headerEl.nextElementSibling;
    contentEl.classList.toggle('active');
    
    // If opening and data not cached, load it
    if (contentEl.classList.contains('active') && !teamDataCache[namaTeknisi]) {
        loadTeknisiData(namaTeknisi, contentEl);
    }
}

async function loadTeknisiData(namaTeknisiRaw, contentEl) {
    console.log('📥 loadTeknisiData called for:', namaTeknisiRaw);
    
    const namaTeknisi = normalizeTechnicianName(namaTeknisiRaw);
    
    if (!navigator.onLine) {
        contentEl.innerHTML = '<div class="accordion-empty">Tidak online. Refresh untuk mencoba lagi.</div>';
        return;
    }

    try {
        const respon = await fetch(scriptURL, { 
            method: 'POST', 
            body: JSON.stringify({ action: "get_log", reqNama: namaTeknisi }), 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' } 
        });
        const resJson = await respon.json();
        
        if(resJson.status === 'success') {
            if(resJson.data.length === 0) {
                contentEl.innerHTML = `<div class="accordion-empty"><b>${namaTeknisi}</b> belum mencatat pekerjaan apapun hari ini.</div>`;
            } else {
                let itemsHTML = '';
                resJson.data.forEach(log => {
                    let kendalaHTML = log.kendala ? `<div style="color: var(--primary); font-weight: 600; margin-top: 4px;"><i class="fa-solid fa-triangle-exclamation"></i> Kendala: ${log.kendala}</div>` : '';
                    let titleTampilan = log.namaKlien ? `${log.namaKlien} <span style="font-weight: normal; font-size: 12px; color: var(--text-muted);">| ${log.alamatKlien}</span>` : "-";
                    let teksJam = log.tipe === 'Kunjungan' || log.jamBerangkat !== '-' ? `Berangkat: ${log.jamBerangkat} | Tiba: ${log.jamSampai} | Selesai: ${log.jamSelesai}` : `Mulai: ${log.jamSampai} | Selesai: ${log.jamSelesai}`;
                    
                    itemsHTML += `
                        <li>
                            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">
                                <i class="fa-regular fa-clock"></i> ${teksJam}
                            </div>
                            <div style="font-weight: 600; margin-bottom: 4px;">${titleTampilan}</div>
                            <div style="color: var(--text-muted); line-height: 1.4;">${log.detail}</div>
                            ${kendalaHTML}
                            <div style="font-size: 11px; color: #adb5bd; margin-top: 8px;"><i class="fa-solid fa-location-dot"></i> ${log.gps}</div>
                        </li>
                    `;
                });
                
                contentEl.innerHTML = `<ul>${itemsHTML}</ul>`;
                teamDataCache[namaTeknisi] = true; // Mark as loaded
            }
        } else { 
            contentEl.innerHTML = `<div class="accordion-empty">Gagal mengambil log: ${resJson.message}</div>`; 
        }
    } catch (err) { 
        console.error('❌ Error loading data:', err);
        contentEl.innerHTML = `<div class="accordion-empty">❌ Gagal terhubung ke server.</div>`; 
    }
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

function tutorBukaIdentitas() { 
    document.getElementById('modalNamaHarian').style.display = 'none'; 
    // Buka sidebar bukan pindah tab
    toggleSidebar();
    setTimeout(() => document.getElementById('nama').focus(), 100); 
}

function konfirmasiNamaSiap() { 
    localStorage.setItem('logTanggalKonfirmasiNama', new Date().toLocaleDateString('id-ID')); 
    document.getElementById('modalNamaHarian').style.display = 'none'; 
    updateHeaderTeknisiName(); // Update header with technician name
    cekModalBulanan(); 
}
function cekModalBulanan() { const d = new Date(); if (d.getDate() === 1 && localStorage.getItem('logBulanModalMuncul') !== (d.getMonth() + "-" + d.getFullYear())) { document.getElementById('modalBulanan').style.display = 'flex'; } }
function konfirmasiModalBulanan() {
    const tipeDipilih = document.querySelector('input[name="modalTipe"]:checked').value; localStorage.setItem('logSettingTipe', tipeDipilih);
    document.getElementById(tipeDipilih === 'Kunjungan' ? 'modeLapangan' : 'modeCS').checked = true; terapkanModePenugasan();
    localStorage.setItem('logBulanModalMuncul', new Date().getMonth() + "-" + new Date().getFullYear()); document.getElementById('modalBulanan').style.display = 'none';
}

// ==============================================
// FUNGSI ISTIRAHAT TEKNISI
// ==============================================
function bukaModalIstirahat() {
    if(!localStorage.getItem('logSettingNama')) { alert('Isi Identitas dulu!'); toggleSidebar(); return; }
    if(isIstirahat) { alert('Anda sedang istirahat! Tekan "Selesai Istirahat" dulu.'); return; }
    document.getElementById('modalIstirahat').style.display = 'flex';
}

function tutupModalIstirahat() {
    document.getElementById('modalIstirahat').style.display = 'none';
}

function mulaiIstirahat() {
    jamMulaiIstirahat = getWaktuSekarang();
    isIstirahat = true;
    localStorage.setItem('statusIstirahat', JSON.stringify({ isIstirahat: true, jamMulai: jamMulaiIstirahat }));
    
    // Tampilkan overlay lock layar
    document.getElementById('overlayIstirahat').style.display = 'flex';
    updateTeksJamIstirahat();
    
    // Tutup modal konfirmasi
    document.getElementById('modalIstirahat').style.display = 'none';
    
    // Nonaktifkan button istirahat
    document.getElementById('btnIstirahat').disabled = true;
    document.getElementById('btnIstirahat').style.opacity = '0.5';
}

function updateTeksJamIstirahat() {
    if(isIstirahat) {
        const jamSekarang = getWaktuSekarang();
        document.getElementById('teksJamIstirahat').innerText = jamMulaiIstirahat + ' - ' + jamSekarang;
        setTimeout(updateTeksJamIstirahat, 30000); // Update setiap 30 detik
    }
}

function selesaiIstirahat() {
    const jamSelesaiIstirahat = getWaktuSekarang();
    
    // Kirim data istirahat ke spreadsheet
    const payloadIstirahat = { 
        action: "simpan", 
        taskId: "T" + Date.now(), 
        jamBerangkat: "-", 
        jamSampai: jamMulaiIstirahat, 
        jamSelesai: jamSelesaiIstirahat, 
        tipe: 'ISTIRAHAT', 
        namaKlien: "ISTIRAHAT", 
        alamatKlien: "Istirahat / Break", 
        detail: "Istirahat Siang", 
        kendala: "" 
    };
    
    // Cari GPS dan simpan
    mintaGPSDanSimpan(payloadIstirahat);
    
    // Clear istirahat state
    isIstirahat = false;
    jamMulaiIstirahat = '';
    localStorage.removeItem('statusIstirahat');
    
    // Tutup overlay & aktifkan button istirahat kembali
    document.getElementById('overlayIstirahat').style.display = 'none';
    document.getElementById('btnIstirahat').disabled = false;
    document.getElementById('btnIstirahat').style.opacity = '1';
    
    // Tampilkan notifikasi
    alert('✓ Istirahat selesai. Data telah disimpan.');
}

// Pulihkan status istirahat saat page load
function pulihkanStatusIstirahat() {
    const statusIstirahat = localStorage.getItem('statusIstirahat');
    if(statusIstirahat) {
        const data = JSON.parse(statusIstirahat);
        if(data.isIstirahat) {
            jamMulaiIstirahat = data.jamMulai;
            isIstirahat = true;
            
            // Tampilkan overlay lock kembali
            document.getElementById('overlayIstirahat').style.display = 'flex';
            updateTeksJamIstirahat();
            document.getElementById('btnIstirahat').disabled = true;
            document.getElementById('btnIstirahat').style.opacity = '0.5';
        }
    }
}

// ==============================================
// PENGATURAN MODE
// ==============================================
function simpanNama() { 
    const namaInput = document.getElementById('nama').value;
    const namaTeknski = normalizeTechnicianName(namaInput);
    console.log('💾 Saving technician name:', namaInput, '→', namaTeknski);
    localStorage.setItem('logSettingNama', namaTeknski);
    updateHeaderTeknisiName(); // Update header with new technician name
}

async function simpanNamaDanSync() {
    // First save the name
    simpanNama();
    
    // Then clear old daily log data for this technician
    console.log('🗑️ Clearing old daily log data');
    localStorage.removeItem('dailyLogTeknisi');
    logData = [];
    tampilkanLog(); // Refresh timeline to show empty
    
    // Then sync
    const namaTeknski = localStorage.getItem('logSettingNama');
    if (!namaTeknski) {
        alert('Mohon isi nama teknisi terlebih dahulu!');
        return;
    }
    
    mulaiSyncManual();
}

function toggleTema() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('logSettingTema', isDark ? 'dark' : 'light');
    updateBtnTemaUI(isDark);
}

function updateBtnTemaUI(isDark) {
    const btn = document.getElementById('btnToggleTema');
    btn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i> Mode Terang' : '<i class="fa-solid fa-moon"></i> Mode Gelap';
}

// ===============================================
// FUNGSI MANUAL SYNC - Dengan Modal
// ===============================================
async function mulaiSyncManual() {
    console.log('═══════════════════════════════════════════════');
    console.log('🔄 [mulaiSyncManual] SYNC STARTED');
    console.log('═══════════════════════════════════════════════');
    
    const modal = document.getElementById('modalSyncData');
    const btn = document.getElementById('btnSaveAndSync');
    const sidebar = document.getElementById('sidebarMenu');
    const overlay = document.getElementById('sidebarOverlay');
    
    // Close sidebar when sync starts
    if (sidebar) {
        sidebar.classList.remove('active');
        console.log('📁 Sidebar closed');
    }
    if (overlay) {
        overlay.style.display = 'none';
        console.log('📁 Sidebar overlay closed');
    }
    
    modal.style.display = 'flex';
    btn.disabled = true;
    console.log('🔄 Sync modal opened');
    
    try {
        console.log('⏳ [Sync Step 1/3] Calling muatHistoriSepekan()...');
        await muatHistoriSepekan();
        console.log('✅ [Sync Step 1/3] muatHistoriSepekan() completed');
        
        console.log('⏳ [Sync Step 2/3] Calling muatLogHariIni()...');
        await muatLogHariIni();
        console.log('✅ [Sync Step 2/3] muatLogHariIni() completed');
        
        // Refresh metric count and history modal if open
        console.log('⏳ [Sync Step 3/3] Refreshing dashboard stats...');
        await muatDashboardStats();
        console.log('✅ [Sync Step 3/3] Dashboard stats refreshed');
        
        const historyModal = document.getElementById('modalTaskHistory');
        if (historyModal && historyModal.style.display === 'flex') {
            console.log('🔄 Task history modal is open, refreshing...');
            populateTaskHistory();
        } else {
            console.log('ℹ️ Task history modal is not open');
        }
        
        // Refresh weekly chart if minggu tab is active
        const mingguView = document.getElementById('dashboard-minggu-view');
        if (mingguView && mingguView.classList.contains('active')) {
            console.log('🔄 Weekly (minggu) view is active, refreshing chart...');
            populateWeeklyChart();
        } else {
            console.log('ℹ️ Weekly view is not active');
        }
        
        // Success - tutup modal setelah 1 detik
        console.log('═══════════════════════════════════════════════');
        console.log('✅ [mulaiSyncManual] SYNC COMPLETED SUCCESSFULLY');
        console.log('═══════════════════════════════════════════════');
        setTimeout(() => {
            modal.style.display = 'none';
            btn.disabled = false;
            console.log('🔄 Sync modal closed');
        }, 1000);
    } catch (err) {
        // Error - tutup modal dan enable button
        console.error('═══════════════════════════════════════════════');
        console.error('❌ [mulaiSyncManual] SYNC FAILED - Exception:');
        console.error('Error name:', err.name);
        console.error('Error message:', err.message);
        console.error('Error stack:', err.stack);
        console.error('═══════════════════════════════════════════════');
        modal.style.display = 'none';
        btn.disabled = false;
    }
}

// ===============================================
// FUNGSI UPDATE TEMA UI
// ===============================================
function updateBtnTemaUI(isDark) {
    const btn = document.getElementById('btnToggleTema');
    if (btn) {
        if (isDark) {
            btn.innerHTML = '<i class="fa-solid fa-sun"></i> Mode Terang';
            btn.style.borderColor = 'var(--text-muted)';
        } else {
            btn.innerHTML = '<i class="fa-solid fa-moon"></i> Mode Gelap';
            btn.style.borderColor = 'var(--border)';
        }
    }
}

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
        aktifTaskId = "T" + Date.now(); 
        currentState = 'SAMPAI'; 
        simpanStateTiket(); 
        kirimDataParsial('simpan_berangkat');
        stopReminderLoop(); // Stop notification reminders when journey started

    } else if (currentState === 'SAMPAI') {
        aktifWaktuSampai = getWaktuSekarang(); 
        currentState = 'SELESAI'; 
        simpanStateTiket(); 
        kirimDataParsial('update_sampai');

    } else if (currentState === 'SELESAI') {
        if(!document.getElementById('detailKunjungan').value) { alert('Isi detail pekerjaan!'); resetSliderVisual(); return; }
        sliderContainer.classList.add('disabled'); sliderText.innerText = 'MENCARI GPS...'; 
        simpanDataFinalKunjungan();
    }
}

function kirimDataParsial(aksi) {
    const payload = { action: aksi, taskId: aktifTaskId, nama: localStorage.getItem('logSettingNama'), tanggal: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }), tipe: 'Kunjungan', namaKlien: aktifNamaKlien, alamatKlien: aktifAlamatKlien };
    if (aksi === 'simpan_berangkat') payload.jamBerangkat = aktifWaktuBerangkat;
    if (aksi === 'update_sampai') payload.jamSampai = aktifWaktuSampai;
    let antrean = JSON.parse(localStorage.getItem('antreanLog')) || []; antrean.push(payload); localStorage.setItem('antreanLog', JSON.stringify(antrean));
    jalankanSync();
}

function simpanStateTiket() { localStorage.setItem('tiketTugasAktif', JSON.stringify({ state: currentState, taskId: aktifTaskId, waktuBerangkat: aktifWaktuBerangkat, waktuSampai: aktifWaktuSampai, namaKlien: aktifNamaKlien, alamatKlien: aktifAlamatKlien })); renderUIBerdasarkanState(); }
function pulihkanStateTiket() { const t = JSON.parse(localStorage.getItem('tiketTugasAktif')); if (t) { currentState = t.state; aktifTaskId = t.taskId || ''; aktifWaktuBerangkat = t.waktuBerangkat; aktifWaktuSampai = t.waktuSampai; aktifNamaKlien = t.namaKlien; aktifAlamatKlien = t.alamatKlien; renderUIBerdasarkanState(); } }
function batalTiket() {
    if(confirm('Batalkan tugas ini? Data di server akan ikut dihapus permanen.')) {
        
        // --- TAMBAHAN BARU: Perintah hapus baris di Spreadsheet ---
        if (aktifTaskId !== '') {
            let antrean = JSON.parse(localStorage.getItem('antreanLog')) || [];
            antrean.push({
                action: "delete_task",
                taskId: aktifTaskId,
                nama: localStorage.getItem('logSettingNama')
            });
            localStorage.setItem('antreanLog', JSON.stringify(antrean));
            jalankanSync(); // Eksekusi penghapusan di background
        }
        // -----------------------------------------------------------

        localStorage.removeItem('tiketTugasAktif'); 
        currentState = 'BERANGKAT'; 
        aktifTaskId = aktifWaktuBerangkat = aktifWaktuSampai = aktifNamaKlien = aktifAlamatKlien = '';
        document.getElementById('namaCustomer').value = document.getElementById('alamatCustomer').value = document.getElementById('detailKunjungan').value = document.getElementById('kendalaKunjungan').value = ''; document.getElementById('tipeKendala').value = '';
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
    if (currentState === 'BERANGKAT') { sliderText.innerText = 'Geser Mulai Perjalanan >>'; sliderThumb.innerHTML = '<i class="fa-solid fa-motorcycle"></i>'; } 
    else if (currentState === 'SAMPAI') { sliderText.innerText = 'Geser Sudah Sampai >>'; sliderThumb.innerHTML = '<i class="fa-solid fa-location-dot"></i>'; } 
    else if (currentState === 'SELESAI') { sliderText.innerText = 'Geser Selesai & Simpan >>'; sliderThumb.innerHTML = '<i class="fa-solid fa-check-double"></i>'; }
    resetSliderVisual();
}

// ==============================================
// FUNGSI PENGIRIMAN DATA FINAL
// ==============================================
function simpanDataFinalKunjungan() {
    // Combine kendala: tipeKendala + kendalaKunjungan
    const tipeKendala = document.getElementById('tipeKendala').value;
    const detailKendala = document.getElementById('kendalaKunjungan').value.trim();
    let kendalaGabung = '';
    
    if (tipeKendala && detailKendala) {
        kendalaGabung = `${tipeKendala} - ${detailKendala}`;
    } else if (tipeKendala) {
        kendalaGabung = tipeKendala;
    } else if (detailKendala) {
        kendalaGabung = detailKendala;
    }
    
    const payloadTugas = { action: 'update_selesai', taskId: aktifTaskId, jamBerangkat: aktifWaktuBerangkat, jamSampai: aktifWaktuSampai, jamSelesai: getWaktuSekarang(), tipe: 'Kunjungan', namaKlien: aktifNamaKlien, alamatKlien: aktifAlamatKlien, detail: document.getElementById('detailKunjungan').value, kendala: kendalaGabung };
    mintaGPSDanSimpan(payloadTugas);
}

function simpanDataInternal() {
    const jamMulai = document.getElementById('jamMulaiInternal').value, jamSelesai = document.getElementById('jamSelesaiInternal').value, detail = document.getElementById('detailInternal').value;
    if(!localStorage.getItem('logSettingNama')) { alert('Isi Identitas dulu!'); toggleSidebar(); return; }
    if(!jamMulai || !jamSelesai || !detail) { alert('Isi Jam Mulai, Selesai, dan Detail!'); return; }
    if (jamMulai > jamSelesai) { alert(`⚠️ ERROR WAKTU!\n\nJam Mulai (${jamMulai}) lebih besar/malam daripada Jam Selesai (${jamSelesai}).\n\nAnda pasti tidak sengaja memilih PM (Malam). Silakan betulkan jamnya!`); return; }
    let cekJamMalam = parseInt(jamMulai.split(':')[0]);
    if (cekJamMalam >= 19) { if(!confirm(`⚠️ PERINGATAN JAM KERJA!\n\nJam mulai tercatat malam hari: ${jamMulai}.\nJika ini harusnya pagi hari, berarti salah AM/PM. Lanjut simpan?`)) return; }

    document.getElementById('btnSimpanInternal').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> MENCARI GPS...'; document.getElementById('btnSimpanInternal').disabled = true;
    const payloadTugas = { action: "simpan", taskId: "T" + Date.now(), jamBerangkat: "-", jamSampai: jamMulai, jamSelesai: jamSelesai, tipe: 'Tugas Internal / CS', namaKlien: document.getElementById('jenisTugasInternal').value, alamatKlien: "Internal / Kantor", detail: detail, kendala: document.getElementById('kendalaInternal').value };
    mintaGPSDanSimpan(payloadTugas);
}

function mintaGPSDanSimpan(payload) {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => eksekusiSimpanGPS(pos.coords.latitude + ", " + pos.coords.longitude, payload), (err) => eksekusiSimpanGPS("GPS Offline/Ditolak", payload), { timeout: 5000 });
    } else { eksekusiSimpanGPS("Tanpa GPS", payload); }
}

function eksekusiSimpanGPS(gps, payload) {
    const dataBaru = { action: payload.action || "simpan", nama: localStorage.getItem('logSettingNama'), tanggal: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }), gps: gps, ...payload };
    
    if (payload.tipe === 'Tugas Internal / CS' || payload.action === 'update_selesai') {
        logData.push(dataBaru); localStorage.setItem('dailyLogTeknisi', JSON.stringify(logData));
    }

    let antrean = JSON.parse(localStorage.getItem('antreanLog')) || []; antrean.push(dataBaru); localStorage.setItem('antreanLog', JSON.stringify(antrean));
    
    if (payload.tipe === 'Kunjungan') {
        localStorage.removeItem('tiketTugasAktif'); document.getElementById('namaCustomer').value = document.getElementById('alamatCustomer').value = document.getElementById('detailKunjungan').value = document.getElementById('kendalaKunjungan').value = ''; document.getElementById('tipeKendala').value = '';
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
        let teksJam = log.tipe === 'Kunjungan' ? `Berangkat: ${log.jamBerangkat} &nbsp;|&nbsp; Tiba: ${log.jamSampai} &nbsp;|&nbsp; Selesai: ${log.jamSelesai}` : `Mulai: ${log.jamSampai} &nbsp;|&nbsp; Selesai: ${log.jamSelesai}`;
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
    const modalSync = document.getElementById('modalSync'); 

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

// Check pengumuman setiap 10 detik (integrated dengan existing sync)
setInterval(() => {
    cekPengumuman();
}, 10000);

if ('serviceWorker' in navigator) { 
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => { reg.update(); })
            .catch(err => console.log('SW Error: ', err));
        
        // Initialize notification scheduler on app load
        initNotificationScheduler();
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
            // Show update modal sebelum reload
            const modalUpdate = document.getElementById('modalUpdate');
            if (modalUpdate) {
                modalUpdate.style.display = 'flex';
                console.log('📢 Update modal shown');
            }
            
            // Delay 2 detik biar modal keliatan
            setTimeout(() => {
                window.location.reload();
                refreshing = true;
            }, 2000);
        }
    });
}