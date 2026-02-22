// js/settings.js - 旅遊設定 Modal
import { state } from './state.js';
import { loadData } from './data.js';

export function openSettings() {
    document.getElementById('inputStartDate').value = state.tripStartDate;
    document.getElementById('inputTotalDays').value = state.totalDays;
    document.getElementById('settingsModal').classList.add('show');
    document.getElementById('fabContainer').classList.remove('open');
}

export function closeSettings() {
    document.getElementById('settingsModal').classList.remove('show');
}

export async function saveSettings() {
    const newDate = document.getElementById('inputStartDate').value;
    const newDays = document.getElementById('inputTotalDays').value;
    try {
        const res = await fetch('/api/update-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ start_date: newDate, total_days: newDays })
        });
        if (res.ok) { closeSettings(); await loadData(); }
        else if (res.status === 403) { location.reload(); }
    } catch(e) { alert('無法連接伺服器'); }
}
