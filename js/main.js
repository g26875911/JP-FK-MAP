// js/main.js - 入口點：初始化所有模組並暴露全域函式
import { state } from './state.js';
import { initAuth, checkPassword } from './auth.js';
import { updateLabelBtnVisual, toggleTheme, toggleMapLabels, toggleFab, toggleSearch, exportItinerary } from './theme.js';
import { initMap } from './map.js';
import { loadData, updateDay, saveContent, updateOrder, refreshData } from './data.js';
import { openSettings, closeSettings, saveSettings } from './settings.js';
import { requireToken, githubGetFile, githubPutFile, handleGithubError, notesMd_appendLocation, notesMd_setCoords } from './github.js';
import {
    updateView, filterData,
    openDetailView, closeDetailView,
    toggleDetailEditMode, saveDetailContent, updateDayFromDetail,
    openReadingModal, closeReadingModal,
    toggleCardNotes, toggleEditMode,
    setSidebarHeight, getSnapHeights,
    setupBottomSheet, setupSortable, setupSearch, openDayRoute
} from './ui.js';

// =========================================
// 0. 密碼保護
// =========================================
window.checkPassword = checkPassword;
initAuth();

// =========================================
// 1. 主題初始化（flash 防閃爍由 <head> 內嵌 script 處理）
//    這裡只同步圖示狀態
// =========================================
if (state.isDarkMode) {
    const di = document.getElementById('desktopThemeIconBtn');
    if (di) di.className = 'fa-solid fa-sun';
    const mi = document.getElementById('mobileThemeIconBtn');
    if (mi) mi.innerHTML = '<i class="fa-solid fa-sun"></i>';
}
updateLabelBtnVisual();

// =========================================
// 2. 地圖初始化
// =========================================
initMap();

// 地圖點擊：手機版收起詳細頁 & 關閉 FAB
// 放在 main.js 以避免 ui.js ↔ map.js 循環依賴
state.map.on('click', () => {
    if (window.innerWidth < 768 && state.currentDetailLocId) closeDetailView();
    document.getElementById('fabContainer').classList.remove('open');
});

// =========================================
// 3. 暴露全域函式（供 HTML inline onclick 使用）
// =========================================
window.toggleTheme = toggleTheme;
window.toggleMapLabels = toggleMapLabels;
window.toggleFab = toggleFab;
window.toggleSearch = toggleSearch;
window.exportItinerary = exportItinerary;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.saveSettings = saveSettings;
window.closeReadingModal = closeReadingModal;
window.filterData = filterData;
window.getLocation = () => {
    state.map.locate({ setView: true, maxZoom: 16, enableHighAccuracy: true });
    document.getElementById('fabContainer').classList.remove('open');
};
window.openDayRoute = openDayRoute;
window.closeDetailView = closeDetailView;
window.toggleDetailEditMode = toggleDetailEditMode;
window.updateDayFromDetail = updateDayFromDetail;
window.saveDetailContent = saveDetailContent;
window.updateDay = updateDay;
window.saveContent = saveContent;
window.updateOrder = updateOrder;
window.toggleEditMode = toggleEditMode;
window.toggleCardNotes = toggleCardNotes;

// ★ 新增：供 HTML 呼叫的重新載入函式
window.refreshData = refreshData;

// 桌面 Popup 用：收集同一個住宿 popup 內所有 checked 值，呼叫 updateDay
window.updateDayFromCheckboxes = function(name, locId) {
    const container = document.getElementById(`day-checkboxes-${locId}`);
    if (!container) return;
    const checked = Array.from(container.querySelectorAll('input:checked')).map(cb => cb.value);
    updateDay(name, checked.length > 0 ? checked.join(', ') : '0');
};

// 手機詳細頁用：收集 #detail-day-checkboxes 內所有 checked 值，呼叫 updateDayFromDetail
window.updateDayCheckboxFromDetail = function() {
    const container = document.getElementById('detail-day-checkboxes');
    if (!container) return;
    const checked = Array.from(container.querySelectorAll('input:checked')).map(cb => cb.value);
    updateDayFromDetail(checked.length > 0 ? checked.join(', ') : '0');
};

// =========================================
// 3b. 新增全域函式
// =========================================

// F1: 已造訪標記
window.toggleVisited = (name, e) => {
    if (e) e.stopPropagation();
    if (!name) return;
    if (state.visitedNames.has(name)) {
        state.visitedNames.delete(name);
    } else {
        state.visitedNames.add(name);
    }
    localStorage.setItem('visited_names', JSON.stringify([...state.visitedNames]));
    updateView(false);
    // 同步更新 detail bar 的 visited 按鈕
    const dvBtn = document.getElementById('detail-visited-btn');
    if (dvBtn && state.currentDetailLoc?.name === name) {
        dvBtn.classList.toggle('done', state.visitedNames.has(name));
    }
};

// F4: 景點新增 UI
window.openAddLocationModal = () => {
    ['name','coords','day','time','todo','notes'].forEach(k => {
        const el = document.getElementById(`addLoc-${k}`);
        if (el) el.value = '';
    });
    document.getElementById('addLoc-cat').value = 'spot';
    document.getElementById('addLocationModal').classList.add('show');
    document.getElementById('fabContainer')?.classList.remove('open');
};

window.closeAddLocationModal = () => {
    document.getElementById('addLocationModal').classList.remove('show');
};

window.saveNewLocation = async () => {
    if (!requireToken()) return;
    const name = document.getElementById('addLoc-name').value.trim();
    if (!name) { alert('請輸入景點名稱'); return; }
    const category = document.getElementById('addLoc-cat').value;
    const coordsRaw = document.getElementById('addLoc-coords').value.trim();
    const day = document.getElementById('addLoc-day').value.trim();
    const time = document.getElementById('addLoc-time').value.trim();
    const todo = document.getElementById('addLoc-todo').value;
    const notes = document.getElementById('addLoc-notes').value;
    let lat = null, lng = null;
    if (coordsRaw) {
        const m = coordsRaw.match(/([0-9.]+)\s*[,，]\s*([0-9.]+)/);
        if (m) { lat = m[1]; lng = m[2]; } else { alert('座標格式錯誤，請輸入「緯度, 經度」'); return; }
    }
    const btn = document.getElementById('addLoc-saveBtn');
    if (btn) { btn.disabled = true; btn.innerText = '儲存中...'; }
    try {
        const { text, sha } = await githubGetFile();
        const newText = notesMd_appendLocation(text, { name, category, lat, lng, day, time, todo, notes });
        await githubPutFile(newText, sha, `add: ${name}`);
        window.closeAddLocationModal();
        await loadData();
    } catch(e) { handleGithubError(e); }
    finally { if (btn) { btn.disabled = false; btn.innerText = '儲存'; } }
};

// F5: 無座標快速定位
window.geocodeAndSave = async (name) => {
    if (!requireToken()) return;
    const resultEl = document.getElementById('geocode-result');
    if (resultEl) resultEl.innerText = '搜尋中...';
    try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1&countrycodes=jp&accept-language=zh-TW`;
        const res = await fetch(url);
        const data = await res.json();
        if (!data.length) { if (resultEl) resultEl.innerText = '找不到座標，請手動輸入'; return; }
        const { lat, lon, display_name } = data[0];
        if (resultEl) resultEl.innerHTML = `找到：${parseFloat(lat).toFixed(4)}, ${parseFloat(lon).toFixed(4)}<br><span style="color:var(--text-sub)">${display_name}</span>`;
        if (!confirm(`確認儲存座標？\n${parseFloat(lat).toFixed(6)}, ${parseFloat(lon).toFixed(6)}\n\n${display_name}`)) return;
        const { text, sha } = await githubGetFile();
        const newText = notesMd_setCoords(text, name, parseFloat(lat).toFixed(6), parseFloat(lon).toFixed(6));
        await githubPutFile(newText, sha, `update: coords for ${name}`);
        closeReadingModal();
        await loadData();
    } catch(e) { handleGithubError(e); if (resultEl) resultEl.innerText = '搜尋失敗'; }
};

// =========================================
// 4. 設定 UI 元件
// =========================================
setupBottomSheet();
setupSortable();
setupSearch();

// 手機版初始 sidebar 高度
if (window.innerWidth < 768) {
    setSidebarHeight(window.innerHeight * 0.45, false);
}

// =========================================
// 5. 載入資料
// =========================================
loadData();