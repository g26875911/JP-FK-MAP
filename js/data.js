// js/data.js - 資料載入與儲存
import { state, categoryMap } from './state.js';
import { updateTripInfoBar } from './utils.js';
import { updateView, initDayDropdown } from './ui.js';

export function parseMarkdown(text) {
    const results = [];
    const items = text.split(/(?=^#\s\[)/gm);
    state.globalIdCounter = 0;
    state.tripStartDate = '';
    state.totalDays = 8;
    state.dayOrders = {};

    items.forEach((item) => {
        if (!item.trim()) return;
        let lines = item.trim().split('\n');
        let headerLine = lines[0].trim();
        let category = 'other';
        let name = headerLine;
        const catMatch = headerLine.match(/^#\s\[(.*?)\]\s*(.*)/);
        if (catMatch) {
            let rawCat = catMatch[1];
            name = catMatch[2];
            if (rawCat === '設定') {
                lines.slice(1).forEach(line => {
                    if (line.includes('開始日期')) state.tripStartDate = line.split(/[:：]/)[1].trim();
                    if (line.includes('總天數')) state.totalDays = parseInt(line.split(/[:：]/)[1].trim()) || 8;
                    if (line.includes('_Order')) {
                        let match = line.match(/> (day\d+)_Order:\s*(.*)/i);
                        if (match) state.dayOrders[match[1].toLowerCase()] = match[2].split(',').map(s => s.trim());
                    }
                });
                return;
            }
            category = categoryMap[rawCat] || 'other';
        } else return;

        let lat = null, lng = null, address = '', link = '';
        let todo = '', notes = '', other = '', day = null, currentSection = 'meta';

        lines.slice(1).forEach(line => {
            let trimmedLine = line.trim();
            if (trimmedLine.startsWith('>')) {
                let content = trimmedLine.substring(1).trim();
                if (content.match(/座標|Coord/i)) {
                    let coords = content.match(/([0-9.]+)\s*[,，]\s*([0-9.]+)/);
                    if (coords) { lat = parseFloat(coords[1]); lng = parseFloat(coords[2]); }
                } else if (content.match(/地址|Addr/i)) {
                    address = content.split(/[:：]/)[1]?.trim() || '';
                } else if (content.match(/連結|Link/i)) {
                    const urlMatch = content.match(/(http[^\s]+)/);
                    if (urlMatch) link = urlMatch[1];
                } else if (content.match(/Day|行程/i)) {
                    day = content.split(/[:：]/)[1]?.trim();
                }
            } else if (trimmedLine.startsWith('###') || trimmedLine.startsWith('####')) {
                if (trimmedLine.includes('想做什麼')) currentSection = 'todo';
                else if (trimmedLine.includes('備註')) currentSection = 'notes';
                else { currentSection = 'other'; other += '\n' + line + '\n'; }
            } else if (!trimmedLine.startsWith('---') && !trimmedLine.startsWith('#')) {
                if (currentSection === 'todo') todo += line + '\n';
                else if (currentSection === 'notes') notes += line + '\n';
                else if (currentSection === 'other') other += line + '\n';
            }
        });

        const searchText = (name + todo + notes + other + address).toLowerCase();
        results.push({
            id: 'loc_' + (++state.globalIdCounter),
            name, category, lat, lng, address, link,
            todo: todo.trim(), notes: notes.trim(), other: other.trim(), day, searchText
        });
    });
    return results;
}

export async function loadData() {
    try {
        const response = await fetch('notes.md?t=' + new Date().getTime());
        const text = await response.text();
        state.allLocations = parseMarkdown(text);
        initDayDropdown();
        updateTripInfoBar();
        updateView(true);
    } catch (error) {
        console.error(error);
    }
}

export async function updateDay(name, newDay) {
    try {
        const res = await fetch('/api/update-day', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, day: newDay })
        });
        if (res.ok) {
            const target = state.allLocations.find(l => l.name === name);
            if (target) target.day = newDay === '0' ? null : newDay;
            updateView(false);
        } else if (res.status === 403) { location.reload(); }
    } catch(e) {}
}

export async function saveContent(id) {
    const loc = state.allLocations.find(l => l.id === id);
    if (!loc) return;
    const newTodo = document.getElementById(`edit-todo-${id}`).value;
    const newNotes = document.getElementById(`edit-notes-${id}`).value;
    try {
        const res = await fetch('/api/update-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: loc.name, todo: newTodo, notes: newNotes })
        });
        if (res.ok) { loc.todo = newTodo; loc.notes = newNotes; updateView(false); }
        else if (res.status === 403) { location.reload(); }
    } catch(e) {}
}

// ★ 新增：無縫重新讀取並觸發按鈕動畫
export async function refreshData(btnElement) {
    if (btnElement) {
        btnElement.classList.add('spin-anim');
        setTimeout(() => btnElement.classList.remove('spin-anim'), 800);
    }
    
    await loadData();
    
    const fab = document.getElementById('fabContainer');
    if (fab) fab.classList.remove('open');
}