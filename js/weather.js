// js/weather.js - 天氣預報
import { state } from './state.js';

export async function showWeatherForDay(dayNum) {
    const weatherBar = document.getElementById('weatherInfoBar');
    if (!state.tripStartDate) { weatherBar.style.display = 'none'; return; }
    const [y, m, d] = state.tripStartDate.split('-');
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + (dayNum - 1));
    const dateString = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    const today = new Date();
    const diffDays = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
    if (diffDays > 14 || diffDays < 0) {
        weatherBar.innerHTML = `<i class="fa-solid fa-cloud"></i> ${dateString} (超過預報範圍)`;
        weatherBar.style.display = 'flex';
        return;
    }
    const dayLocs = state.allLocations.filter(l => l.day == dayNum && l.lat && l.lng);
    const lat = dayLocs.length > 0 ? dayLocs[0].lat : 33.59;
    const lng = dayLocs.length > 0 ? dayLocs[0].lng : 130.40;
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTokyo`);
        const data = await res.json();
        const idx = data.daily.time.indexOf(dateString);
        if (idx !== -1) {
            const maxT = Math.round(data.daily.temperature_2m_max[idx]);
            const minT = Math.round(data.daily.temperature_2m_min[idx]);
            const pop = data.daily.precipitation_probability_max[idx];
            const code = data.daily.weathercode[idx];
            let icon = '<i class="fa-solid fa-sun"></i>'; let wText = '晴天';
            if (code >= 1 && code <= 3) { icon = '<i class="fa-solid fa-cloud"></i>'; wText = '多雲'; }
            if (code >= 45 && code <= 48) { icon = '<i class="fa-solid fa-smog"></i>'; wText = '起霧'; }
            if (code >= 51 && code <= 67) { icon = '<i class="fa-solid fa-cloud-showers-heavy"></i>'; wText = '下雨'; }
            if (code >= 71 && code <= 77) { icon = '<i class="fa-solid fa-snowflake"></i>'; wText = '降雪'; }
            if (code >= 80 && code <= 82) { icon = '<i class="fa-solid fa-cloud-showers-heavy"></i>'; wText = '大雨'; }
            if (code >= 95 && code <= 99) { icon = '<i class="fa-solid fa-bolt"></i>'; wText = '雷雨'; }
            weatherBar.innerHTML = `${icon} ${wText}｜${minT}°C ~ ${maxT}°C｜降雨: ${pop}%`;
            weatherBar.style.display = 'flex';
        } else { weatherBar.style.display = 'none'; }
    } catch(e) { weatherBar.style.display = 'none'; }
}
