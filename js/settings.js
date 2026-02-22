// js/settings.js - 旅遊設定 Modal
import { state } from './state.js';
import { loadData } from './data.js';
import { githubGetFile, githubPutFile, handleGithubError, notesMd_setSettings } from './github.js';

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

    if (newDate !== state.tripStartDate || parseInt(newDays) !== state.totalDays) {
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
