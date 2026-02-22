// js/settings.js - 旅遊設定 Modal
import { state } from './state.js';
import { loadData } from './data.js';
import { requireToken, githubGetFile, githubPutFile, handleGithubError, notesMd_setSettings } from './github.js';

export function openSettings() {
    document.getElementById('inputGhToken').value = state.githubToken;
    document.getElementById('inputStartDate').value = state.tripStartDate;
    document.getElementById('inputTotalDays').value = state.totalDays;
    document.getElementById('settingsModal').classList.add('show');
    document.getElementById('fabContainer').classList.remove('open');
}

export function closeSettings() {
    document.getElementById('settingsModal').classList.remove('show');
}

export async function saveSettings() {
    const token = document.getElementById('inputGhToken').value.trim();
    const newDate = document.getElementById('inputStartDate').value;
    const newDays = document.getElementById('inputTotalDays').value;

    // 先儲存 token（只存 localStorage，不需要 API）
    state.githubToken = token;
    localStorage.setItem('gh_token', token);

    // 若有日期/天數變動，透過 GitHub API 寫入 notes.md
    if (newDate !== state.tripStartDate || parseInt(newDays) !== state.totalDays) {
        if (!requireToken()) return;
        try {
            const { text, sha } = await githubGetFile();
            const newText = notesMd_setSettings(text, newDate, newDays);
            await githubPutFile(newText, sha, 'update: trip settings');
            closeSettings();
            await loadData();
        } catch(e) { handleGithubError(e); }
    } else {
        closeSettings();
    }
}
