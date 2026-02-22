// js/map.js - 地圖初始化與操作
import { state } from './state.js';

export function initMap() {
    const savedLat = parseFloat(localStorage.getItem('map_lat'));
    const savedLng = parseFloat(localStorage.getItem('map_lng'));
    const savedZoom = parseInt(localStorage.getItem('map_zoom'));
    const hasPos = savedLat && savedLng && savedZoom;
    if (hasPos) state.hasSavedMapPosition = true;
    state.map = L.map('map', { zoomControl: false })
        .setView(hasPos ? [savedLat, savedLng] : [33.1, 130.8], hasPos ? savedZoom : 8);
    L.control.zoom({ position: 'topright' }).addTo(state.map);

    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=zh-TW', {
        attribution: '© Google Maps', maxZoom: 19
    }).addTo(state.map);

    state.map.on('moveend', () => {
        const c = state.map.getCenter();
        localStorage.setItem('map_lat', c.lat);
        localStorage.setItem('map_lng', c.lng);
        localStorage.setItem('map_zoom', state.map.getZoom());
    });
    state.map.on('zoomend', checkMapLabels);
    state.map.on('locationfound', (e) => {
        if (state.userMarker) state.map.removeLayer(state.userMarker);
        if (state.userCircle) state.map.removeLayer(state.userCircle);
        state.userMarker = L.circleMarker(e.latlng, {
            radius: 8, fillColor: "var(--primary)", color: "#fff",
            weight: 3, opacity: 1, fillOpacity: 1
        }).addTo(state.map).bindPopup("你目前在這裡").openPopup();
        state.userCircle = L.circle(e.latlng, e.accuracy / 2, {
            color: "var(--primary)", fillColor: "var(--primary)", fillOpacity: 0.1, weight: 1
        }).addTo(state.map);
    });
    state.map.on('locationerror', () => { alert("無法取得您的位置"); });

    window.map = state.map;
}

export function checkMapLabels() {
    const mapEl = document.getElementById('map');
    if (state.isLabelsEnabled) {
        mapEl.classList.add('show-map-labels');
    } else {
        mapEl.classList.remove('show-map-labels');
    }
    // 叢集感知：叢集內的 marker tooltip 加上 label-clustered class
    if (state.markerClusterGroup) {
        state.markers.forEach(marker => {
            const el = marker.getTooltip()?.getElement();
            if (!el) return;
            const isClustered = state.markerClusterGroup.getVisibleParent(marker) !== marker;
            el.classList.toggle('label-clustered', isClustered);
        });
    }
}

export function getLocation() {
    state.map.locate({ setView: true, maxZoom: 16, enableHighAccuracy: true });
    document.getElementById('fabContainer').classList.remove('open');
}

export function highlightMarker(locId, retryCount = 0) {
    document.querySelectorAll('.marker-highlight').forEach(el => el.classList.remove('marker-highlight'));
    if (locId) {
        const target = document.querySelector(`.marker-inner[data-id="${locId}"]`);
        if (target) { target.classList.add('marker-highlight'); }
        // ★ 修正 3：增加重試次數到 20 次 (總計 1 秒)，確保能在動畫結束後找到
        else if (retryCount < 20) { setTimeout(() => highlightMarker(locId, retryCount + 1), 50); }
    }
}