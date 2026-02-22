// js/theme.js - 主題切換、FAB、搜尋、匯出
import { state } from './state.js';
import { checkMapLabels } from './map.js';
import { getDayString, getCatName } from './utils.js';

export function toggleTheme() {
    state.isDarkMode = !state.isDarkMode;
    if (state.isDarkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        const di = document.getElementById('desktopThemeIconBtn');
        if (di) di.className = 'fa-solid fa-sun';
        const mi = document.getElementById('mobileThemeIconBtn');
        if (mi) mi.innerHTML = '<i class="fa-solid fa-sun"></i>';
    } else {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        const di = document.getElementById('desktopThemeIconBtn');
        if (di) di.className = 'fa-solid fa-moon';
        const mi = document.getElementById('mobileThemeIconBtn');
        if (mi) mi.innerHTML = '<i class="fa-solid fa-moon"></i>';
    }
    document.getElementById('fabContainer').classList.remove('open');
}

export function updateLabelBtnVisual() {
    const dBtn = document.getElementById('desktopLabelToggleBtn');
    const mBtn = document.getElementById('mobileLabelToggleBtn');
    if (state.isLabelsEnabled) {
        if (dBtn) dBtn.classList.add('active-label');
        if (mBtn) mBtn.classList.add('active-tool');
    } else {
        if (dBtn) dBtn.classList.remove('active-label');
        if (mBtn) mBtn.classList.remove('active-tool');
    }
}

export function toggleMapLabels() {
    state.isLabelsEnabled = !state.isLabelsEnabled;
    localStorage.setItem('mapLabels', state.isLabelsEnabled);
    checkMapLabels();
    updateLabelBtnVisual();
    document.getElementById('fabContainer').classList.remove('open');
}

export function toggleFab() {
    document.getElementById('fabContainer').classList.toggle('open');
}

export function toggleSearch() {
    const sb = document.getElementById('floatingSearch');
    sb.classList.toggle('show');
    if (sb.classList.contains('show')) {
        const input = document.getElementById('mobileSearchInput');
        if (input) input.focus();
        
        // ★ 修正 2：如果是在手機版，開啟搜尋時強制回到列表，並將 Bottom Sheet 拉到最高
        if (window.innerWidth < 768) {
            // 如果原本在看景點詳細資訊，強制關閉回到列表
            if (window.closeDetailView && state.currentDetailLocId) {
                window.closeDetailView();
            }
            // 呼叫全域的 setSidebarHeight 將面板推到最上面 (Max)
            if (window.setSidebarHeight && window.getSnapHeights) {
                window.setSidebarHeight(window.getSnapHeights().max, true);
            }
        }
    }
    document.getElementById('fabContainer').classList.remove('open');
}

export function exportItinerary() {
    let text = "✈️ 九州自由行行程表\n";
    if (state.tripStartDate) text += `📅 日期：${state.tripStartDate}\n`;
    text += "-------------------\n\n";
    for (let i = 1; i <= state.totalDays; i++) {
        text += `【${getDayString(i)}】\n`;
        const dayKey = `day${i}`;
        let dayLocs = state.allLocations.filter(l => l.day == i);
        if (state.dayOrders[dayKey]) {
            dayLocs.sort((a, b) => {
                const idxA = state.dayOrders[dayKey].indexOf(a.name);
                const idxB = state.dayOrders[dayKey].indexOf(b.name);
                return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
            });
        }
        if (dayLocs.length === 0) text += "  (尚未安排行程)\n";
        else dayLocs.forEach((loc, idx) => { text += `  ${idx+1}. ${loc.name} [${getCatName(loc.category)}]\n`; });
        text += "\n";
    }
    navigator.clipboard.writeText(text).then(() => { alert('已複製文字行程表！'); });
    document.getElementById('fabContainer').classList.remove('open');
}