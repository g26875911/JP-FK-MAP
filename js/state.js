// js/state.js - 共享狀態物件（無任何 import）

export const state = {
    allLocations: [],
    markers: [],
    map: null,
    markerClusterGroup: null,
    mapPolylineLayer: null,
    mapArrowLayer: null,
    currentFilter: 'all',
    currentDetailLocId: null,
    globalIdCounter: 0,
    tripStartDate: '',
    totalDays: 8,
    dayOrders: {},
    isDarkMode: localStorage.getItem('theme') === 'dark',
    isLabelsEnabled: localStorage.getItem('mapLabels') === 'true',
    userMarker: null,
    userCircle: null,
};

export const categoryMap = {
    '美食': 'food', '餐廳': 'food', '景點': 'spot',
    '住宿': 'hotel', '飯店': 'hotel', '購物': 'shop', '整理': 'other'
};

export const iconMap = {
    'food': 'fa-utensils', 'spot': 'fa-camera',
    'hotel': 'fa-bed', 'shop': 'fa-bag-shopping', 'other': 'fa-book-open'
};
