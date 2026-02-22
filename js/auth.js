// js/auth.js - 密碼保護（純靜態，密碼存在 sessionStorage，關分頁後需重新輸入）
const SITE_PASSWORD = '0424';

export function initAuth() {
    const overlay = document.getElementById('passwordOverlay');
    if (!overlay) return;
    if (sessionStorage.getItem('auth') !== '1') {
        overlay.style.display = 'flex';
        setTimeout(() => document.getElementById('passwordInput')?.focus(), 100);
    } else {
        overlay.style.display = 'none';
    }
}

export function checkPassword() {
    const input = document.getElementById('passwordInput');
    const err   = document.getElementById('passwordError');
    if (!input) return;
    if (input.value === SITE_PASSWORD) {
        sessionStorage.setItem('auth', '1');
        document.getElementById('passwordOverlay').style.display = 'none';
        if (err) err.style.display = 'none';
    } else {
        if (err) err.style.display = 'block';
        input.value = '';
        input.focus();
    }
}
