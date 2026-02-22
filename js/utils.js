// js/utils.js - 純工具函式
import { state } from './state.js';

export function getDayString(dayNum) {
    if (!state.tripStartDate) return `Day ${dayNum}`;
    const [y, m, d] = state.tripStartDate.split('-');
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + (dayNum - 1));
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const daysOfWeek = ['日', '一', '二', '三', '四', '五', '六'];
    return `Day ${dayNum} (${month}/${day} 週${daysOfWeek[date.getDay()]})`;
}

export function getCatName(cat) {
    const names = { food: '美食', spot: '景點', hotel: '住宿', shop: '購物', other: '整理' };
    return names[cat] || '其他';
}

export function processMarkdownForDisplay(text) {
    if (!text) return { htmlText: '', images: [] };
    let images = [];
    const imgRegex = /!\[(.*?)\]\((.*?)\)/g;
    let match;
    while ((match = imgRegex.exec(text)) !== null) {
        images.push({ alt: match[1], url: match[2] });
    }
    let cleanText = text.replace(imgRegex, '');
    cleanText = cleanText.replace(/^[ \t]*[-*+][ \t]*$/gm, '');
    cleanText = cleanText.replace(/\n\s*\n/g, '\n\n').trim();
    const htmlText = cleanText.replace(/\n/g, '<br>');
    return { htmlText, images };
}

export function updateTripInfoBar() {
    const bar = document.getElementById('tripInfoBar');
    if (!state.tripStartDate) {
        bar.innerHTML = `<i class="fa-solid fa-circle-info"></i> 未設定日期 (共 ${state.totalDays} 天)`;
        return;
    }
    const [y, m, d] = state.tripStartDate.split('-');
    const startDateObj = new Date(y, m - 1, d);
    const endObj = new Date(y, m - 1, d);
    endObj.setDate(endObj.getDate() + state.totalDays - 1);
    const format = (dObj) => `${dObj.getFullYear()}/${String(dObj.getMonth()+1).padStart(2,'0')}/${String(dObj.getDate()).padStart(2,'0')}`;
    bar.innerHTML = `<i class="fa-regular fa-calendar-check"></i> ${format(startDateObj)} ~ ${format(endObj)} (共 ${state.totalDays} 天)`;
}
