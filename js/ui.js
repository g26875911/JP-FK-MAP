// js/ui.js - UI 渲染與互動
import { state, iconMap } from './state.js';
import { getDayString, getCatName, processMarkdownForDisplay, updateTripInfoBar } from './utils.js';
import { showWeatherForDay } from './weather.js';
import { highlightMarker } from './map.js';
import { requireToken, githubGetFile, githubPutFile, handleGithubError, notesMd_setContent, notesMd_setDay, notesMd_setOrder } from './github.js';

export function getSnapHeights() {
    const h = window.innerHeight;
    return { min: 140, mid: h * 0.45, max: h - 100 };
}

export function setSidebarHeight(height, animate = false) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    if (animate) sidebar.classList.add('sidebar-animating');
    else sidebar.classList.remove('sidebar-animating');
    sidebar.style.height = `${height}px`;
    
    window.currentSidebarHeight = height;

    if (window.innerWidth < 768) {
        const fab = document.getElementById('fabContainer');
        const routeBtn = document.querySelector('.day-route-btn');
        const isExpanded = height > (window.innerHeight * 0.6);
        
        if (fab) {
            fab.style.opacity = isExpanded ? '0' : '1';
            fab.style.pointerEvents = isExpanded ? 'none' : 'auto';
            if (!isExpanded) fab.style.bottom = `${height + 20}px`;
        }
        if (routeBtn) {
            routeBtn.style.opacity = isExpanded ? '0' : '1';
            routeBtn.style.pointerEvents = isExpanded ? 'none' : 'auto';
            if (!isExpanded) routeBtn.style.bottom = `${height + 80}px`;
        }
    }
}

export function setupBottomSheet() {
    const sidebar = document.getElementById('sidebar');
    const dragHandle = document.getElementById('dragHandle');
    if (!dragHandle || !sidebar) return;

    let startY, startHeight, isDragging = false, hasMoved = false;

    dragHandle.addEventListener('touchstart', (e) => {
        isDragging = true; hasMoved = false;
        startY = e.touches[0].clientY;
        startHeight = sidebar.offsetHeight;
        sidebar.classList.remove('sidebar-animating');
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        hasMoved = true;
        const deltaY = startY - e.touches[0].clientY;
        let newHeight = startHeight + deltaY;
        const snaps = getSnapHeights();
        if (newHeight > snaps.max) newHeight = snaps.max + (newHeight - snaps.max) * 0.1;
        if (newHeight < snaps.min) newHeight = snaps.min;
        setSidebarHeight(newHeight);
        e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;
        const snaps = getSnapHeights();
        const current = sidebar.offsetHeight;
        
        if (!hasMoved) {
            let target;
            if (current < snaps.mid - 20) target = snaps.mid;
            else if (current < snaps.max - 20) target = snaps.max;
            else target = snaps.min;
            setSidebarHeight(target, true);
            return;
        }
        
        let finalHeight = current;
        if (finalHeight > snaps.max) finalHeight = snaps.max;
        if (finalHeight < snaps.min) finalHeight = snaps.min;
        setSidebarHeight(finalHeight, false); 
    });
}

export function setupSortable() {
    const listContainer = document.getElementById('list-container');
    if (!listContainer) return;
    new Sortable(listContainer, {
        animation: 150, handle: '.drag-handle', ghostClass: 'sortable-ghost', dragClass: 'sortable-drag', forceFallback: true,
        onEnd: async function () {
            if (state.currentFilter.startsWith('day')) {
                const newOrder = Array.from(listContainer.children).map(el => el.getAttribute('data-name'));
                state.dayOrders[state.currentFilter] = newOrder;
                updateView(false);
                if (requireToken()) {
                    try {
                        const { text, sha } = await githubGetFile();
                        const newText = notesMd_setOrder(text, state.currentFilter, newOrder);
                        await githubPutFile(newText, sha, `update: order for ${state.currentFilter}`);
                    } catch(e) { handleGithubError(e); }
                }
            }
        }
    });
}

export function setupSearch() {
    const s1 = document.getElementById('searchInput');
    const s2 = document.getElementById('mobileSearchInput');
    if (s1) s1.addEventListener('input', () => updateView(true));
    if (s2) s2.addEventListener('input', () => updateView(true));
}

export function initDayDropdown() {
    const dropdown = document.getElementById('dayFilterDropdown');
    if (!dropdown) return;
    dropdown.innerHTML = '<option value="" disabled selected>行程天數</option>';
    for (let i = 1; i <= state.totalDays; i++) {
        const option = document.createElement('option');
        option.value = `day${i}`; option.innerText = getDayString(i); dropdown.appendChild(option);
    }
    if (state.currentFilter.startsWith('day')) { dropdown.value = state.currentFilter; dropdown.classList.add('active'); }
}

export function openDetailView(loc) {
    state.currentDetailLocId = loc.id;
    const controls = document.querySelector('.controls');
    const listContainer = document.getElementById('list-container');
    const detailContainer = document.getElementById('detail-container');
    
    if (controls) controls.style.display = 'none';
    if (listContainer) listContainer.style.display = 'none';
    if (detailContainer) detailContainer.style.display = 'flex';

    document.getElementById('detail-title').innerText = loc.name;
    const badge = document.getElementById('detail-cat-badge');
    if (badge) { badge.className = `badge cat-${loc.category}`; badge.innerText = getCatName(loc.category); }
    
    const dayBadge = document.getElementById('detail-day-badge');
    if (dayBadge) {
        if (loc.day) { dayBadge.innerText = `D${loc.day}`; dayBadge.style.display = 'inline-flex'; }
        else { dayBadge.style.display = 'none'; }
    }

    const daySelect = document.getElementById('detail-day-select');
    if (daySelect) {
        let optionsHtml = `<option value="0" ${!loc.day ? 'selected' : ''}>未安排</option>`;
        for (let i = 1; i <= state.totalDays; i++) { optionsHtml += `<option value="${i}" ${loc.day == i ? 'selected' : ''}>${getDayString(i)}</option>`; }
        daySelect.innerHTML = optionsHtml;
    }

    const navBtn = document.getElementById('detail-nav-btn');
    if (navBtn) navBtn.href = loc.link ? loc.link : `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`;

    const todoData = processMarkdownForDisplay(loc.todo);
    const notesData = processMarkdownForDisplay(loc.notes);
    const otherData = processMarkdownForDisplay(loc.other);
    const combinedImages = [...todoData.images, ...notesData.images, ...otherData.images];

    const galleryContainer = document.getElementById('detail-gallery-container');
    const gallery = document.getElementById('detail-gallery');
    if (galleryContainer && gallery) {
        if (combinedImages.length > 0) {
            let imgs = combinedImages.map(img => `<div class="skeleton-wrapper"><img src="${img.url}" alt="${img.alt}" class="gallery-img" onload="this.classList.add('loaded'); this.parentNode.classList.add('loaded');"></div>`).join('');
            gallery.innerHTML = imgs;
            galleryContainer.style.display = 'block';
        } else { galleryContainer.style.display = 'none'; }
    }

    const todoContainer = document.getElementById('detail-todo-container');
    const todoEl = document.getElementById('detail-todo');
    if (todoContainer && todoEl) {
        if (todoData.htmlText) { todoEl.innerHTML = `<div class="detail-section-title">想做什麼</div>${todoData.htmlText}`; todoContainer.style.display = 'block'; } 
        else { todoContainer.style.display = 'none'; }
    }

    const notesContainer = document.getElementById('detail-notes-container');
    const notesEl = document.getElementById('detail-notes');
    if (notesContainer && notesEl) {
        if (notesData.htmlText) { notesEl.innerHTML = `<div class="detail-section-title">備註</div>${notesData.htmlText}`; notesContainer.style.display = 'block'; } 
        else { notesContainer.style.display = 'none'; }
    }

    const otherContainer = document.getElementById('detail-other-container');
    const otherEl = document.getElementById('detail-other');
    if (otherContainer && otherEl) {
        if (otherData.htmlText) {
            let formattedOther = otherData.htmlText.replace(/(?:^|<br>)###\s+(.*?)(?=<br>|$)/g, '<div class="detail-section-title">$1</div>');
            formattedOther = formattedOther.replace(/(?:^|<br>)####\s+(.*?)(?=<br>|$)/g, '<div class="detail-section-title" style="font-size:14px;">$1</div>');
            otherEl.innerHTML = formattedOther;
            otherContainer.style.display = 'block';
        } else { otherContainer.style.display = 'none'; }
    }

    toggleDetailEditMode(false);
    setTimeout(() => { highlightMarker(loc.id); }, 100);
}

export function closeDetailView() {
    state.currentDetailLocId = null; highlightMarker(null);
    const detailContainer = document.getElementById('detail-container');
    const controls = document.querySelector('.controls');
    const listContainer = document.getElementById('list-container');
    
    if(detailContainer) detailContainer.style.display = 'none';
    if(controls) controls.style.display = 'block';
    if(listContainer) listContainer.style.display = 'block';
    
    setSidebarHeight(getSnapHeights().mid, true);
}

export function toggleDetailEditMode(show) {
    const viewMode = document.getElementById('detail-view-mode');
    const editMode = document.getElementById('detail-edit-mode-container');
    const editBtn = document.getElementById('detail-edit-btn');
    
    if (viewMode) viewMode.style.display = show ? 'none' : 'block';
    if (editMode) editMode.style.display = show ? 'block' : 'none';
    if (editBtn) editBtn.style.display = show ? 'none' : 'flex';
    
    if (show && state.currentDetailLocId) {
        const loc = state.allLocations.find(l => l.id === state.currentDetailLocId);
        const td = document.getElementById('detail-edit-todo');
        const nd = document.getElementById('detail-edit-notes');
        if (td) td.value = loc.todo;
        if (nd) nd.value = loc.notes;
    }
}

export async function saveDetailContent() {
    if (!requireToken()) return;
    const loc = state.allLocations.find(l => l.id === state.currentDetailLocId); if (!loc) return;
    const newTodo = document.getElementById('detail-edit-todo').value;
    const newNotes = document.getElementById('detail-edit-notes').value;
    try {
        const { text, sha } = await githubGetFile();
        const newText = notesMd_setContent(text, loc.name, newTodo, newNotes);
        await githubPutFile(newText, sha, `update: content for ${loc.name}`);
        loc.todo = newTodo; loc.notes = newNotes;
        updateView(false); openDetailView(loc);
    } catch(e) { handleGithubError(e); }
}

export async function updateDayFromDetail(newDay) {
    if (!requireToken()) return;
    const loc = state.allLocations.find(l => l.id === state.currentDetailLocId); if (!loc) return;
    try {
        const { text, sha } = await githubGetFile();
        const newText = notesMd_setDay(text, loc.name, newDay);
        await githubPutFile(newText, sha, `update: day assignment for ${loc.name}`);
        loc.day = (newDay === '0' || !newDay) ? null : newDay;
        updateView(false); openDetailView(loc);
    } catch(e) { handleGithubError(e); }
}

export function openReadingModal(loc) {
    const badge = document.getElementById('readingBadge'); if (badge) { badge.className = `badge cat-${loc.category}`; badge.innerText = getCatName(loc.category); }
    const title = document.getElementById('readingTitle'); if (title) title.innerText = loc.name;
    const todoData = processMarkdownForDisplay(loc.todo); const notesData = processMarkdownForDisplay(loc.notes); const otherData = processMarkdownForDisplay(loc.other);
    const combinedImages = [...todoData.images, ...notesData.images, ...otherData.images];
    let html = '';
    if (todoData.htmlText) html += `<p class="popup-text"><strong>想做什麼</strong><br>${todoData.htmlText}</p>`;
    if (notesData.htmlText) html += `<hr class="popup-divider"><p class="popup-text"><strong>備註</strong><br>${notesData.htmlText}</p>`;
    if (otherData.htmlText) {
        let formattedOther = otherData.htmlText.replace(/(?:^|<br>)###\s+(.*?)(?=<br>|$)/g, '<div style="font-weight:bold; font-size:16px; margin-top:12px; margin-bottom:4px; color:var(--primary);">$1</div>');
        formattedOther = formattedOther.replace(/(?:^|<br>)####\s+(.*?)(?=<br>|$)/g, '<div style="font-weight:bold; font-size:14px; margin-top:10px; margin-bottom:4px; color:var(--primary);">$1</div>');
        html += `<hr class="popup-divider"><div class="popup-text" style="color:var(--text-main);">${formattedOther}</div>`;
    }
    if (combinedImages.length > 0) {
        let imgs = combinedImages.map(img => `<div class="skeleton-wrapper" style="margin-top:10px;"><img src="${img.url}" alt="${img.alt}" class="gallery-img" onload="this.classList.add('loaded'); this.parentNode.classList.add('loaded');"></div>`).join('');
        html += `<div style="margin-top:20px; border-top:1px dashed var(--border); padding-top:15px;">${imgs}</div>`;
    }
    if (!html) html = '<p style="text-align:center; color:var(--text-sub); margin-top:20px;">無詳細內容</p>';
    const body = document.getElementById('readingBody');
    if (body) { body.innerHTML = html; }
    const modal = document.getElementById('readingModal');
    if (modal) modal.classList.add('show');
}
export function closeReadingModal() { document.getElementById('readingModal').classList.remove('show'); }

export function toggleCardNotes(e, id) {
    e.stopPropagation();
    const card = document.getElementById(`card-el-${id}`);
    const btn = document.getElementById(`expand-btn-${id}`);
    if(card) card.classList.toggle('expanded'); 
    if(btn) btn.classList.toggle('open');
}

export function toggleEditMode(id, show) {
    const vm = document.getElementById(`view-mode-${id}`);
    const em = document.getElementById(`edit-mode-${id}`);
    if (vm) vm.style.display = show ? 'none' : 'block';
    if (em) em.style.display = show ? 'block' : 'none';
}

export function openDayRoute() {
    if (!state.currentFilter.startsWith('day')) return; const cards = document.querySelectorAll('.card'); const routeCoords = [];
    cards.forEach(card => { const lat = card.getAttribute('data-lat'); const lng = card.getAttribute('data-lng'); if (lat && lng && lat !== 'null' && lng !== 'null') { routeCoords.push(`${lat},${lng}`); } });
    if (routeCoords.length > 0) { window.open(`https://www.google.com/maps/dir/${routeCoords.join('/')}`, '_blank'); } else { alert("這一天沒有可導航的景點"); }
}

export function updateRouteButton() {
    const dayRouteBtn = document.getElementById('dayRouteBtn'); if (!state.currentFilter.startsWith('day')) { if(dayRouteBtn) dayRouteBtn.style.display = 'none'; return; }
    const cards = document.querySelectorAll('.card'); const hasCoords = Array.from(cards).some(c => c.getAttribute('data-lat') !== 'null');
    if (hasCoords && dayRouteBtn) { dayRouteBtn.style.display = 'flex'; const dayNum = state.currentFilter.replace('day', ''); dayRouteBtn.innerHTML = `<i class="fa-solid fa-location-arrow"></i> 開啟 Day ${dayNum} 導航`; } else if(dayRouteBtn) { dayRouteBtn.style.display = 'none'; }
}

export function updateView(fitMap = true) {
    const listContainer = document.getElementById('list-container');
    if (!listContainer) return;
    
    const dSearch = document.getElementById('searchInput');
    const mSearch = document.getElementById('mobileSearchInput');
    const searchValDesktop = dSearch ? dSearch.value.toLowerCase() : '';
    const searchValMobile = mSearch ? mSearch.value.toLowerCase() : '';
    const searchVal = window.innerWidth < 768 ? searchValMobile : searchValDesktop;

    listContainer.innerHTML = '';
    if (state.markerClusterGroup) state.map.removeLayer(state.markerClusterGroup);
    if (state.mapPolylineLayer) state.map.removeLayer(state.mapPolylineLayer);
    if (state.mapArrowLayer) state.map.removeLayer(state.mapArrowLayer);
    state.markers.forEach(m => state.map.removeLayer(m));
    state.markers = [];

    const isDayFilter = state.currentFilter.startsWith('day');
    if (isDayFilter) {
        state.markerClusterGroup = null;
    } else {
        state.markerClusterGroup = L.markerClusterGroup({ maxClusterRadius: 30, disableClusteringAtZoom: 14, spiderfyOnMaxZoom: false });
    }

    let filteredData = state.allLocations.filter(loc => {
        let catMatch = true;
        if (state.currentFilter.startsWith('day')) { catMatch = loc.day == state.currentFilter.replace('day', ''); } 
        else { catMatch = state.currentFilter === 'all' || loc.category === state.currentFilter; }
        return catMatch && loc.searchText.includes(searchVal);
    });

    if (state.currentFilter.startsWith('day')) {
        const savedOrder = state.dayOrders[state.currentFilter];
        if (savedOrder && Array.isArray(savedOrder)) {
            filteredData.sort((a, b) => {
                const indexA = savedOrder.indexOf(a.name); const indexB = savedOrder.indexOf(b.name);
                return (indexA === -1 ? 9999 : indexA) - (indexB === -1 ? 9999 : indexB);
            });
        }
    }

    filteredData.forEach(loc => {
        const colorMap = { food: '#e74c3c', spot: '#3498db', hotel: '#27ae60', shop: '#f39c12', other: '#95a5a6' };
        const color = colorMap[loc.category];
        const iconClass = iconMap[loc.category] || 'fa-location-dot';

        if (loc.lat && loc.lng) {
            const customIcon = L.divIcon({
                className: 'custom-icon',
                html: `<div class="marker-inner" data-id="${loc.id}" style="background-color:${color}; width:28px; height:28px; border-radius:50%; border:3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);">
                        <i class="fa-solid ${iconClass}" style="color:white; font-size:13px;"></i>
                       ${loc.day ? `<div style="position:absolute;top:-6px;right:-6px;background:var(--primary);color:white;font-size:10px;font-weight:bold;width:16px;height:16px;border-radius:50%;text-align:center;line-height:16px;border:2px solid white;">${loc.day}</div>` : ''}
                       </div>`,
                iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -17]
            });

            const marker = L.marker([loc.lat, loc.lng], { icon: customIcon });
            marker.bindTooltip(loc.name, { permanent: true, direction: 'bottom', className: 'map-tooltip', offset: [0, 8] });

            if (window.innerWidth >= 768) {
                let optionsHtml = `<option value="0" ${!loc.day ? 'selected' : ''}>📍 未安排</option>`;
                for (let i = 1; i <= state.totalDays; i++) { optionsHtml += `<option value="${i}" ${loc.day == i ? 'selected' : ''}>${getDayString(i)}</option>`; }
                let navLink = loc.link ? loc.link : `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`;
                const todoData = processMarkdownForDisplay(loc.todo); const notesData = processMarkdownForDisplay(loc.notes); const otherData = processMarkdownForDisplay(loc.other);
                const combinedImages = [...todoData.images, ...notesData.images, ...otherData.images];
                let galleryHtml = `<div class="image-gallery" id="view-gallery-${loc.id}" style="display:none;"></div>`;
                if (combinedImages.length > 0) {
                    let imgs = combinedImages.map(img => `<div class="skeleton-wrapper"><img src="${img.url}" alt="${img.alt}" class="gallery-img" onload="this.classList.add('loaded'); this.parentNode.classList.add('loaded');"></div>`).join('');
                    galleryHtml = `<div class="image-gallery" id="view-gallery-${loc.id}">${imgs}</div>`;
                }
                let formattedOtherDesktop = '';
                if (otherData.htmlText) {
                    formattedOtherDesktop = otherData.htmlText.replace(/(?:^|<br>)###\s+(.*?)(?=<br>|$)/g, '<br><strong>$1</strong>');
                    formattedOtherDesktop = formattedOtherDesktop.replace(/(?:^|<br>)####\s+(.*?)(?=<br>|$)/g, '<br><strong>$1</strong>');
                    formattedOtherDesktop = `<hr class="popup-divider"><div class="scrollable-content"><p class="popup-text" style="color:var(--text-main);">${formattedOtherDesktop}</p></div>`;
                }
                const popupHtml = `
                    <div class="popup-header">
                        <div class="popup-top-row"><span class="badge cat-${loc.category}">${getCatName(loc.category)}</span><div class="popup-actions"><button class="popup-icon-btn edit-btn" onclick="toggleEditMode('${loc.id}', true)"><i class="fa-solid fa-pen"></i></button><button class="popup-icon-btn close-btn" onclick="map.closePopup()"><i class="fa-solid fa-xmark"></i></button></div></div>
                        <div class="popup-title">${loc.name}</div>
                    </div>
                    <div class="popup-body">
                        <div id="view-mode-${loc.id}">
                            <div id="view-todo-${loc.id}">${todoData.htmlText ? `<div class="scrollable-content"><p class="popup-text"><strong>想做什麼</strong><br>${todoData.htmlText}</p></div>` : ''}</div>
                            <hr class="popup-divider" id="divider-${loc.id}" style="display: ${notesData.htmlText ? 'block' : 'none'};">
                            <div id="view-notes-${loc.id}">${notesData.htmlText ? `<div class="scrollable-content"><p class="popup-text" style="color:var(--text-sub); font-size: 12px;"><strong>備註</strong><br>${notesData.htmlText}</p></div>` : ''}</div>
                            ${formattedOtherDesktop} ${galleryHtml}
                            <div class="day-selector"><select class="day-select" onchange="updateDay('${loc.name}', this.value)">${optionsHtml}</select></div>
                            <a href="${navLink}" target="_blank" class="nav-btn"><i class="fa-solid fa-location-arrow"></i> 導航去這裡</a>
                        </div>
                        <div id="edit-mode-${loc.id}" style="display:none;">
                            <div class="edit-actions"><button class="cancel-btn" onclick="toggleEditMode('${loc.id}', false)">取消</button><button class="save-btn" onclick="saveContent('${loc.id}')">儲存</button></div>
                            <label class="edit-label">想做什麼</label><textarea class="edit-textarea" id="edit-todo-${loc.id}">${loc.todo}</textarea>
                            <label class="edit-label">備註 (支援 ![圖片](網址) )</label><textarea class="edit-textarea" id="edit-notes-${loc.id}">${loc.notes}</textarea>
                        </div>
                    </div>
                `;
                marker.bindPopup(popupHtml, { autoPan: true, autoPanPaddingTopLeft: [10, 20], autoPanPaddingBottomRight: [10, 10] });
            }

            marker.on('click', () => {
                // ★ 安全地隱藏手機版搜尋框，但不清空內容也不摧毀卡片
                if (window.innerWidth < 768) {
                    const fs = document.getElementById('floatingSearch');
                    if (fs) fs.classList.remove('show');
                }

                const m = state.markers.find(mk => mk.getLatLng().lat === loc.lat && mk.getLatLng().lng === loc.lng);
                if (!m) return;

                if (window.innerWidth < 768) {
                    const zoom = 15;
                    const sidebarEl = document.getElementById('sidebar');
                    const panelHeight = sidebarEl ? sidebarEl.offsetHeight : (window.innerHeight * 0.45);
                    const offsetPixels = panelHeight / 2;
                    const targetPoint = state.map.project([loc.lat, loc.lng], zoom);
                    targetPoint.y += offsetPixels;
                    const targetLatLng = state.map.unproject(targetPoint, zoom);
                    state.map.flyTo(targetLatLng, zoom, { duration: 0.5 });
                    openDetailView(loc);
                    setSidebarHeight(getSnapHeights().mid, true);
                } else {
                    state.map.flyTo([loc.lat, loc.lng], 15, { duration: 0.5 });
                    // ★ 確保動畫結束後才執行高亮特效，100% 不失誤
                    setTimeout(() => {
                        if (!state.map.hasLayer(m) && state.markerClusterGroup) {
                            state.markerClusterGroup.zoomToShowLayer(m, () => {
                                m.openPopup();
                                highlightMarker(loc.id);
                            });
                        }
                        else {
                            m.openPopup();
                            highlightMarker(loc.id);
                        }
                    }, 650);
                }
            });

            if (isDayFilter) { marker.addTo(state.map); }
            else { state.markerClusterGroup.addLayer(marker); }
            state.markers.push(marker);
        }

        const card = document.createElement('div');
        card.className = `card ${(!loc.lat || !loc.lng) ? 'missing-coords' : ''}`;
        card.id = `card-el-${loc.id}`; card.setAttribute('data-lat', loc.lat); card.setAttribute('data-lng', loc.lng); card.setAttribute('data-name', loc.name);

        const dragHandleHtml = state.currentFilter.startsWith('day') ? `<i class="fa-solid fa-bars drag-handle"></i>` : '';
        const expandBtnHtml = (loc.notes || loc.other) ? `<button id="expand-btn-${loc.id}" class="expand-btn" onclick="toggleCardNotes(event, '${loc.id}')"><i class="fa-solid fa-chevron-down"></i></button>` : '';
        const cleanCardTodo = processMarkdownForDisplay(loc.todo).htmlText.replace(/<br>/g, ' ');
        const notesDataForCard = processMarkdownForDisplay(loc.notes);

        card.innerHTML = `
            ${dragHandleHtml} ${expandBtnHtml}
            <div class="card-header"><h3 class="card-title">${loc.day ? `<span class="day-badge">D${loc.day}</span>` : ''}${loc.name}</h3><span class="badge cat-${loc.category}">${getCatName(loc.category)}</span></div>
            <div class="card-todo" id="card-todo-${loc.id}">${cleanCardTodo}</div>
            <div class="card-notes" id="card-notes-content-${loc.id}">${notesDataForCard.htmlText}</div>
        `;

        card.onclick = (e) => {
            if (e.target.closest('.drag-handle') || e.target.closest('.expand-btn')) return;
            
            // ★ 安全地隱藏手機版搜尋框，不觸發 updateView(false)
            if (window.innerWidth < 768) {
                const fs = document.getElementById('floatingSearch');
                if (fs) fs.classList.remove('show');
            }

            if (loc.lat && loc.lng) {
                const m = state.markers.find(mk => mk.getLatLng().lat === loc.lat && mk.getLatLng().lng === loc.lng);
                if (!m) return;
                if (window.innerWidth < 768) {
                    const zoom = 15;
                    const sidebarEl = document.getElementById('sidebar');
                    const panelHeight = sidebarEl ? sidebarEl.offsetHeight : (window.innerHeight * 0.45);
                    const offsetPixels = panelHeight / 2;
                    const targetPoint = state.map.project([loc.lat, loc.lng], zoom);
                    targetPoint.y += offsetPixels;
                    const targetLatLng = state.map.unproject(targetPoint, zoom);
                    state.map.flyTo(targetLatLng, zoom, { duration: 0.5 });
                    openDetailView(loc);
                    setSidebarHeight(getSnapHeights().mid, true);
                } else {
                    state.map.flyTo([loc.lat, loc.lng], 15, { duration: 0.5 });
                    setTimeout(() => {
                        if (!state.map.hasLayer(m) && state.markerClusterGroup) {
                            state.markerClusterGroup.zoomToShowLayer(m, () => {
                                m.openPopup();
                                highlightMarker(loc.id);
                            });
                        }
                        else {
                            m.openPopup();
                            highlightMarker(loc.id);
                        }
                    }, 650);
                }
            } else { openReadingModal(loc); }
        };

        listContainer.appendChild(card);
    });

    if (!isDayFilter && state.markerClusterGroup) state.map.addLayer(state.markerClusterGroup);
    state.map.fire('zoomend');

    if (fitMap && state.markers.length > 0) { state.map.fitBounds(L.featureGroup(state.markers).getBounds().pad(0.1)); }

    if (state.currentFilter.startsWith('day') && state.markers.length > 1) {
        const routeCoords = filteredData.filter(loc => loc.lat && loc.lng).map(loc => [loc.lat, loc.lng]);
        if (routeCoords.length > 1) {
            state.mapPolylineLayer = L.polyline(routeCoords, { color: 'var(--accent)', weight: 4, dashArray: '10, 10', opacity: 0.8 }).addTo(state.map);
            if (typeof L.polylineDecorator !== 'undefined') {
                state.mapArrowLayer = L.polylineDecorator(state.mapPolylineLayer, {
                    patterns: [{ offset: '10%', repeat: '80px', symbol: L.Symbol.arrowHead({ pixelSize: 14, polygon: false, pathOptions: { stroke: true, weight: 3, color: 'var(--primary)', opacity: 0.9 }}) }]
                }).addTo(state.map);
            }
        }
    }

    updateRouteButton();
    if (state.currentDetailLocId) highlightMarker(state.currentDetailLocId);
}

export function filterData(cat) {
    state.currentFilter = cat;
    const btns = document.querySelectorAll('.filter-btn');
    btns.forEach(b => {
        if (['all', 'food', 'spot', 'hotel', 'shop'].includes(cat)) {
            const dropdown = document.getElementById('dayFilterDropdown');
            if(dropdown) { dropdown.value = ""; dropdown.classList.remove('active'); }
            if ((cat === 'all' && b.innerText === '全部') || (cat === 'food' && b.innerText === '美食') || (cat === 'spot' && b.innerText === '景點') || (cat === 'hotel' && b.innerText === '住宿') || (cat === 'shop' && b.innerText === '購物')) {
                b.classList.add('active');
            } else { b.classList.remove('active'); }
        } else { b.classList.remove('active'); }
    });
    const dropdown = document.getElementById('dayFilterDropdown');
    if (cat.startsWith('day')) {
        if(dropdown) { dropdown.value = cat; dropdown.classList.add('active'); }
        showWeatherForDay(parseInt(cat.replace('day', '')));
    } else { 
        const wBar = document.getElementById('weatherInfoBar');
        if(wBar) wBar.style.display = 'none'; 
    }
    if (window.innerWidth < 768) { setSidebarHeight(getSnapHeights().min, true); }
    updateView(true);
}