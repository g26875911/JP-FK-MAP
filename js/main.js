// js/main.js - 入口點：初始化所有模組並暴露全域函式
import { state } from './state.js';
import { initAuth, checkPassword } from './auth.js';
import { updateLabelBtnVisual, toggleTheme, toggleMapLabels, toggleFab, toggleSearch, exportItinerary } from './theme.js';
import { initMap } from './map.js';
import { loadData, updateDay, saveContent, updateOrder, refreshData } from './data.js';
import { openSettings, closeSettings, saveSettings } from './settings.js';
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