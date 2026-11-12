// Routy - 개인용 AI 여행 플래너 (Core Controller & SPA Engine)

// --- Global Application State ---
const state = {
  activeTab: 'explore',
  seniorMode: false,
  fontSizeStep: 0, // 0: Normal, 1: Large, 2: Extra Large, 3: Double Extra Large, 4: Triple Extra Large
  savedTrips: [],
  activeTrip: null, // 현재 보고 있는 일정 { id, title, destination, days, startDate, budget, places: [] }
  activeTripDay: 1,
  editMode: false
};

// Map instance storage
let leafletMap = null;
let mapTileLayer = null;
let mapMarkersGroup = null;
let mapRouteLine = null;

// --- Pricing & Budget Utilities ---
function hashCode(str) {
  let hash = 0;
  if (!str) return hash;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function getDeterministicPrice(placeName, category, budgetTier) {
  const hash = hashCode(placeName || "");
  const tier = budgetTier || "medium";
  
  if (category === "hotel") {
    if (tier === "low") {
      return 60000 + (hash % 50) * 1000;
    } else if (tier === "high") {
      return 250000 + (hash % 300) * 1000;
    } else { // medium
      return 120000 + (hash % 100) * 1000;
    }
  }
  
  if (category === "restaurant") {
    if (tier === "low") {
      return 8000 + (hash % 10) * 1000;
    } else if (tier === "high") {
      return 35000 + (hash % 60) * 1000;
    } else {
      return 15000 + (hash % 20) * 1000;
    }
  }
  
  if (category === "cafe") {
    if (tier === "low") {
      return 4000 + (hash % 4) * 500;
    } else if (tier === "high") {
      return 8000 + (hash % 12) * 500;
    } else {
      return 5500 + (hash % 6) * 500;
    }
  }
  
  if (category === "sightseeing") {
    if (hash % 4 === 0) return 0; // 25% chance free
    if (tier === "low") {
      return 5000 + (hash % 10) * 1000;
    } else if (tier === "high") {
      return 25000 + (hash % 30) * 1000;
    } else {
      return 12000 + (hash % 15) * 1000;
    }
  }
  
  if (category === "shopping") {
    if (tier === "low") {
      return 10000 + (hash % 20) * 1000;
    } else if (tier === "high") {
      return 80000 + (hash % 150) * 1000;
    } else {
      return 30000 + (hash % 50) * 1000;
    }
  }
  
  if (category === "transit") {
    const nameLower = (placeName || "").toLowerCase();
    if (nameLower.includes("택시")) {
      if (tier === "low") {
        return 5000 + (hash % 5) * 1000;
      } else if (tier === "high") {
        return 18000 + (hash % 20) * 1000;
      } else {
        return 9000 + (hash % 10) * 1000;
      }
    }
    if (nameLower.includes("지하철") || nameLower.includes("메트로") || nameLower.includes("버스")) {
      return 1400;
    }
    if (nameLower.includes("ktx") || nameLower.includes("srt") || nameLower.includes("기차") || nameLower.includes("열차") || nameLower.includes("항공") || nameLower.includes("비행기") || nameLower.includes("스카이라이너") || nameLower.includes("하루카")) {
      return 20000 + (hash % 60) * 1000;
    }
    if (nameLower.includes("도보") || nameLower.includes("걷기")) {
      return 0;
    }
    return 1500 + (hash % 5) * 500;
  }
  
  return 10000 + (hash % 15) * 1000;
}

function ensurePlacePrices(trip) {
  if (!trip || !trip.places) return;
  trip.places.forEach(place => {
    if (place.priceUnit !== "group" && place.priceUnit !== "person") {
      place.priceUnit = place.category === "hotel" ? "group" : "person";
    }
    if (place.price === undefined || place.price === null) {
      place.price = getDeterministicPrice(place.name, place.category, trip.budget);
    }
  });
}

// --- Initialize App ---
document.addEventListener("DOMContentLoaded", () => {
  // 아이콘 렌더
  window.hydrateIcons();

  // Load LocalStorage state
  loadLocalStorage();
  
  // Render time in status bar
  updateStatusBarTime();
  setInterval(updateStatusBarTime, 60000);

  // Setup tab event listeners
  setupNavigation();
  
  // Setup theme toggle
  setupThemeToggle();

  // Setup Senior Mode toggles & overrides
  setupSeniorMode();

  // Setup template selection cards
  renderTemplates();

  // Setup home/explore screen search input listener
  setupExploreSearch();

  // Setup input autocomplete / suggestions
  setupSuggestions();

  // Setup planner form submission
  setupPlannerForm();

  // Setup itinerary controls (save, back, place drawers)
  setupItineraryControls();

  // Setup senior detail view modal
  setupSeniorDetailModal();

  // Setup final confirmation screen actions
  setupConfirmationScreen();

  // Settings, place editing, delegated place buttons
  setupSettings();
  setupPlaceEditModal();
  setupBudgetModal();
  setupPlaceActionDelegation();
  setupTitleRename();
  renderSidebarTrips();
  window.addEventListener("orientationchange", () => setTimeout(refreshMapSize, 300));
  updateAiNotice();

  // Render initial explorer state
  renderExploreTab();

  // Setup drag-to-scroll functionality for Day tabs
  setupDayTabsDragScroll();

  // 공유 링크(#trip=...)로 열었으면 해당 일정 표시, 아니면 주소/첫 화면 결정
  handleSharedLink();
  routeInitial();
  window.addEventListener("popstate", () => {
    if (navDepth > 0) navDepth--;
    if (!applyRoute()) routeInitial();
  });

  // 입력 포커스로 고정 틀이 스크롤되면 즉시 원위치 (구형 Safari 대비)
  ["app-viewport", "device-wrapper"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("scroll", () => { if (el.scrollTop) el.scrollTop = 0; });
  });

  // iOS가 브라우저 저장소를 비우지 않도록 요청
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persisted().then(p => { if (!p) navigator.storage.persist(); }).catch(() => {});
  }

  // PWA: 오프라인 캐시
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(err => console.warn("SW 등록 실패", err));
  }

  // Window resize handler to invalidate map sizes during responsive transition
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      refreshMapSize();
    }, 200);
  });
});

// --- Status Bar Time ---
function updateStatusBarTime() {
  const timeEl = document.querySelector(".status-time");
  if (timeEl) {
    const now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    hours = hours < 10 ? '0' + hours : hours;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    timeEl.textContent = `${hours}:${minutes}`;
  }
}

// --- Navigation & Router ---
function setupNavigation() {
  const navButtons = document.querySelectorAll("#bottom-nav .nav-item, #desktop-header .desktop-nav-item");
  navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      switchTab(tab);
    });
  });
}

// --- 주소(해시) 연동: 뒤로 가기·새로고침 시 화면 유지 ---
let routerSilent = false;
let navDepth = 0;
const TAB_ROUTES = { explore: "explore", planner: "planner", trips: "trips", profile: "settings" };

function currentRouteFor(tabName) {
  if (tabName === "itinerary" && state.activeTrip) {
    return isActiveTripSaved() ? `#/trip/${encodeURIComponent(state.activeTrip.id)}` : "#/draft";
  }
  return `#/${TAB_ROUTES[tabName] || tabName}`;
}

function syncRoute(tabName) {
  if (routerSilent) return;
  const target = currentRouteFor(tabName);
  if (location.hash === target) return;
  history.pushState({ routy: true }, "", target);
  navDepth++;
}

function applyRoute() {
  const h = decodeURIComponent(location.hash || "");
  routerSilent = true;
  try {
    let m;
    if ((m = h.match(/^#\/trip\/(.+)$/))) {
      const trip = state.savedTrips.find(t => t.id === m[1]);
      if (trip) loadSavedTrip(trip.id);
      else switchTab("trips");
    } else if (h === "#/draft") {
      if (state.activeTrip && !isActiveTripSaved()) showItineraryView();
      else if (loadDraft()) showItineraryView();
      else switchTab("trips");
    } else if ((m = h.match(/^#\/(explore|planner|trips|settings)$/))) {
      switchTab(m[1] === "settings" ? "profile" : m[1]);
    } else {
      return false;
    }
    return true;
  } finally {
    routerSilent = false;
  }
}

// 첫 화면: 여행 중인 일정 → 내 일정 → 탐색
function routeInitial() {
  if (location.hash.startsWith("#trip=")) return; // 공유 링크는 handleSharedLink가 처리
  if (applyRoute()) return;
  routerSilent = true;
  try {
    const ongoing = state.savedTrips.find(t => getTodayDay(t));
    if (ongoing) loadSavedTrip(ongoing.id);
    else if (state.savedTrips.length) switchTab("trips");
    else switchTab("explore");
  } finally {
    routerSilent = false;
  }
  history.replaceState({ routy: true }, "", currentRouteFor(state.activeTab));
}

function goBack(fallbackTab) {
  if (navDepth > 0) {
    navDepth--;
    history.back();
  } else {
    switchTab(fallbackTab);
  }
}

// --- 저장 전 일정 임시 보관 (새로고침·앱 종료 대비) ---
function saveDraft() {
  try {
    if (state.activeTrip && !isActiveTripSaved()) {
      localStorage.setItem("routy_draft", JSON.stringify(state.activeTrip));
    }
  } catch (e) { /* 용량 부족 등은 무시 */ }
}
function clearDraft() {
  localStorage.removeItem("routy_draft");
}
function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem("routy_draft") || "null");
    if (d && Array.isArray(d.places)) {
      ensureTripShape(d);
      ensurePlacePrices(d);
      state.activeTrip = d;
      state.activeTripDay = 1;
      return true;
    }
  } catch (e) { /* ignore */ }
  return false;
}

function switchTab(tabName) {
  state.activeTab = tabName;
  syncRoute(tabName);
  const toastEl = document.getElementById("toast-notification");
  if (toastEl && tabName !== "itinerary") toastEl.classList.remove("active");
  const menu = document.getElementById("trip-menu");
  if (menu) menu.classList.remove("open");
  const navTab = tabName === "itinerary" ? (isActiveTripSaved() ? "trips" : (state.activeTrip && state.activeTrip.source === "template" ? "explore" : "planner")) : tabName;

  // Toggle active screen visibility
  document.querySelectorAll(".app-screen").forEach(screen => {
    screen.classList.remove("active");
  });
  
  const targetScreen = document.getElementById(`screen-${tabName}`);
  if (targetScreen) {
    targetScreen.classList.add("active");
  }

  // Toggle bottom navigation icons active states
  document.querySelectorAll("#bottom-nav .nav-item").forEach(btn => {
    if (btn.getAttribute("data-tab") === navTab) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Toggle desktop navigation active states
  document.querySelectorAll("#desktop-header .desktop-nav-item").forEach(btn => {
    if (btn.getAttribute("data-tab") === navTab) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Render specific tab contents on transition
  renderSidebarTrips();
  if (tabName === 'trips') {
    renderSavedTrips();
  } else if (tabName === 'planner') {
    updateAiNotice();
  } else if (tabName === 'explore') {
    const searchInput = document.getElementById("explore-search-input");
    if (searchInput) {
      searchInput.value = "";
    }
    renderExploreTab();
    renderTemplates();
  } else if (tabName === 'profile') {
    renderSettingsTab();
  }
}

// --- Theme Toggle ---
function setupThemeToggle() {
  const mobileToggle = document.getElementById("btn-quick-theme");
  const desktopToggle = document.getElementById("btn-desktop-theme");
  
  const updateButtons = (theme) => {
    const html = window.icon(theme === "dark" ? "sun" : "moon", 20);
    if (mobileToggle) mobileToggle.innerHTML = html;
    if (desktopToggle) desktopToggle.innerHTML = html;
  };

  const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
  updateButtons(currentTheme);
  
  const handleToggle = () => {
    const activeTheme = document.documentElement.getAttribute("data-theme") || "light";
    const newTheme = activeTheme === "dark" ? "light" : "dark";
    
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("routy_theme", newTheme);
    updateButtons(newTheme);
    showToast(newTheme === "dark" ? "다크 모드로 전환되었습니다." : "라이트 모드로 전환되었습니다.");
    
    // Update map tiles dynamically if map is initialized
    if (leafletMap && mapTileLayer) {
      const tileUrl = newTheme === "dark" 
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
      mapTileLayer.setUrl(tileUrl);
    }
    setOfmTheme();
  };

  if (mobileToggle) mobileToggle.addEventListener("click", handleToggle);
  if (desktopToggle) desktopToggle.addEventListener("click", handleToggle);
}

// --- Toast Notifications ---
let toastTimer = null;
function showToast(message, duration = 2500, action = null) {
  const toast = document.getElementById("toast-notification");
  toast.innerHTML = "";
  const text = document.createElement("span");
  text.textContent = message;
  toast.appendChild(text);
  toast.classList.toggle("has-action", !!action);
  if (action) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toast-action";
    btn.textContent = action.label;
    btn.addEventListener("click", () => {
      toast.classList.remove("active");
      action.onClick();
    });
    toast.appendChild(btn);
  }
  toast.classList.add("active");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("active");
  }, action ? Math.max(duration, 6000) : duration);
}

// 변경 전 상태를 저장해 두고 "되돌리기" 토스트를 띄움
function withUndo(message, mutate) {
  if (!state.activeTrip) return;
  const before = cloneTrip(state.activeTrip);
  mutate();
  renderItineraryAll();
  persistActiveTrip();
  showToast(message, 6000, {
    label: "되돌리기",
    onClick: () => {
      state.activeTrip = before;
      if (state.activeTripDay > before.days) state.activeTripDay = before.days;
      renderItineraryAll();
      persistActiveTrip();
      showToast("되돌렸습니다.");
    }
  });
}

// --- Local Storage Management ---
function loadLocalStorage() {
  try {
    const savedTrips = localStorage.getItem("routy_saved_trips");
    if (savedTrips) {
      state.savedTrips = JSON.parse(savedTrips);
      state.savedTrips.forEach(trip => {
        ensureTripShape(trip);
        ensurePlacePrices(trip);
      });
    }

    const savedStep = localStorage.getItem("routy_font_size_step");
    if (savedStep !== null) {
      state.fontSizeStep = parseInt(savedStep, 10) || 0;
    }
    state.seniorMode = state.fontSizeStep > 0;

    // 예전 버전의 가짜 기능 데이터 정리
    ["routy_user", "routy_kpi", "routy_friends", "routy_mock_users", "routy_senior_mode"].forEach(k => localStorage.removeItem(k));

    const savedTheme = localStorage.getItem("routy_theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
  } catch (e) {
    console.error("LocalStorage load error: ", e);
  }
}

function saveToLocalStorage() {
  try {
    localStorage.setItem("routy_saved_trips", JSON.stringify(state.savedTrips));
    localStorage.setItem("routy_font_size_step", state.fontSizeStep.toString());
    if (typeof renderSidebarTrips === "function") renderSidebarTrips();
  } catch (e) {
    console.error("LocalStorage write error: ", e);
    showToast("저장 공간이 부족해 저장하지 못했습니다. 오래된 일정을 백업 후 삭제해 주세요.", 5000);
  }
}

// --- 공통 헬퍼 ---
const TRANSPORT_LABELS = { auto: "알아서", transit: "대중교통", car: "자가용·렌터카", taxi: "택시", walk: "도보 위주" };
const MOVE_LABELS = { walk: "도보", bus: "버스", subway: "지하철", train: "기차", car: "자가용", taxi: "택시", bike: "자전거", ferry: "배", flight: "비행기" };
const MOVE_ICONS = { walk: "walk", bus: "bus", subway: "train", train: "train", car: "car", taxi: "taxi", bike: "bike", ferry: "ferry", flight: "flight" };
const CATEGORY_LABELS = { sightseeing: "관광", restaurant: "맛집", cafe: "카페", shopping: "쇼핑", hotel: "숙소", transit: "이동" };
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function esc(str) {
  return String(str === undefined || str === null ? "" : str).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function cloneTrip(trip) {
  return JSON.parse(JSON.stringify(trip));
}

function isActiveTripSaved() {
  return !!state.activeTrip && state.savedTrips.some(t => t.id === state.activeTrip.id);
}

// 저장된 일정이면 변경 즉시 자동 저장
function persistActiveTrip() {
  if (!state.activeTrip) return;
  const i = state.savedTrips.findIndex(t => t.id === state.activeTrip.id);
  if (i > -1) {
    state.activeTrip.updatedAt = Date.now();
    state.savedTrips[i] = cloneTrip(state.activeTrip);
    saveToLocalStorage();
  } else {
    saveDraft();
  }
  updateSaveButton();
}

function updateSaveButton() {
  const btn = document.getElementById("btn-save-itinerary");
  if (!btn) return;
  const saved = isActiveTripSaved();
  btn.textContent = saved ? "✓ 자동 저장" : "저장";
  btn.title = saved ? "수정하면 자동으로 저장됩니다" : "내 일정에 저장";
  btn.classList.toggle("is-saved", saved);
}

// 출발일 + day → Date
function getTripDate(trip, day) {
  if (!trip || !trip.startDate) return null;
  const [y, m, d] = trip.startDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d + (day - 1));
}

function formatShortDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()}(${WEEKDAYS[date.getDay()]})`;
}

function isInKorea(lat, lng) {
  return lat > 33 && lat < 38.7 && lng > 124.5 && lng < 131;
}

// 구글 지도 길찾기 이동 수단 (장소별 이동 방법 → 여행 이동 수단 순)
function googleTravelMode(place, trip) {
  const m = (place.move && place.move.mode) || trip.transport || "auto";
  const map = { car: "driving", taxi: "driving", walk: "walking", bike: "bicycling", bus: "transit", subway: "transit", train: "transit", transit: "transit" };
  return map[m] ? `&travelmode=${map[m]}` : "";
}

function getPlaceLinks(place) {
  const trip = state.activeTrip || {};
  const domestic = isInKorea(place.lat, place.lng);
  const q = place.coordMissing ? `${place.name} ${trip.destination || ""}`.trim() : place.name;
  const hasCoord = !place.coordMissing && isFinite(place.lat) && isFinite(place.lng);
  // 국내: 카카오맵 바로가기(좌표 기준), 해외: 구글 지도
  const kakaoName = encodeURIComponent(String(place.name).replace(/,/g, " "));
  const mapUrl = domestic
    ? (hasCoord ? `https://map.kakao.com/link/map/${kakaoName},${place.lat},${place.lng}` : `https://map.kakao.com/link/search/${encodeURIComponent(q)}`)
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  const routeUrl = domestic
    ? (hasCoord ? `https://map.kakao.com/link/to/${kakaoName},${place.lat},${place.lng}` : `https://map.kakao.com/link/search/${encodeURIComponent(q)}`)
    : (hasCoord ? `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}` : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`) + googleTravelMode(place, trip);
  let searchUrl;
  if (place.category === "hotel") {
    searchUrl = place.bookingUrl || `https://www.agoda.com/search?q=${encodeURIComponent(place.name)}`;
  } else if (place.bookingUrl) {
    searchUrl = place.bookingUrl;
  } else {
    searchUrl = domestic
      ? `https://search.naver.com/search.naver?query=${encodeURIComponent(q)}`
      : `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  }
  return { mapUrl, routeUrl, searchUrl };
}

// --- 설정 화면 ---
function setupSettings() {
  const keyInput = document.getElementById("setting-api-key");
  const modelInput = document.getElementById("setting-model");
  const statusEl = document.getElementById("settings-status");

  document.getElementById("btn-toggle-key-visibility").addEventListener("click", (e) => {
    const show = keyInput.type === "password";
    keyInput.type = show ? "text" : "password";
    e.target.textContent = show ? "숨기기" : "보기";
  });

  const save = () => {
    window.RoutyAI.saveSettings({
      apiKey: keyInput.value.trim(),
      model: modelInput.value.trim() || window.RoutyAI.DEFAULT_MODEL
    });
    updateAiNotice();
  };

  const kakaoInput = document.getElementById("setting-kakao-key");
  const kakaoStatus = document.getElementById("kakao-status");
  const naverInput = document.getElementById("setting-naver-key");
  document.getElementById("btn-save-kakao").addEventListener("click", () => {
    const naverKey = naverInput.value.trim();
    const kakaoKey = kakaoInput.value.trim();
    window.RoutyAI.saveSettings({ naverKey, kakaoKey });
    failedEngines.delete("naver");
    failedEngines.delete("kakao");
    kakaoStatus.className = "settings-status ok";
    kakaoStatus.textContent = naverKey ? "저장했습니다. 국내 일정은 네이버 지도로 표시돼요."
      : kakaoKey ? "저장했습니다. 국내 일정은 카카오맵으로 표시돼요."
      : "저장했습니다. 모든 일정이 OpenFreeMap으로 표시돼요.";
  });

  document.getElementById("btn-save-settings").addEventListener("click", () => {
    save();
    statusEl.textContent = keyInput.value.trim() ? "✅ 저장했습니다." : "API 키를 지웠습니다. 샘플 일정만 생성됩니다.";
    statusEl.className = "settings-status ok";
  });

  document.getElementById("btn-test-settings").addEventListener("click", async () => {
    save();
    statusEl.textContent = "⏳ 연결 확인 중...";
    statusEl.className = "settings-status";
    try {
      await window.RoutyAI.testApiKey();
      statusEl.textContent = "✅ 연결 성공! 이제 AI 플래너를 사용할 수 있어요.";
      statusEl.className = "settings-status ok";
    } catch (e) {
      statusEl.textContent = `❌ ${e.message}`;
      statusEl.className = "settings-status error";
    }
  });

  // 백업 / 복원
  document.getElementById("btn-export-data").addEventListener("click", () => {
    const payload = {
      app: "routy",
      version: 2,
      exportedAt: new Date().toISOString(),
      trips: state.savedTrips
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `routy-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    showToast(`일정 ${state.savedTrips.length}개를 백업했습니다.`);
  });

  const fileInput = document.getElementById("input-import-file");
  document.getElementById("btn-import-data").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const trips = Array.isArray(data) ? data : data.trips;
      if (!Array.isArray(trips)) throw new Error("형식 오류");
      let added = 0, updated = 0;
      trips.forEach(t => {
        if (!t || !t.id || !Array.isArray(t.places)) return;
        ensureTripShape(t);
        const i = state.savedTrips.findIndex(s => s.id === t.id);
        if (i > -1) { state.savedTrips[i] = t; updated++; }
        else { state.savedTrips.push(t); added++; }
      });
      saveToLocalStorage();
      renderSettingsTab();
      showToast(`불러오기 완료: 새 일정 ${added}개, 갱신 ${updated}개`);
    } catch (e) {
      showToast("백업 파일을 읽지 못했습니다. Routy 백업 파일인지 확인해 주세요.", 4000);
    }
  });

  document.getElementById("btn-clear-data").addEventListener("click", async () => {
    if (!state.savedTrips.length) {
      showToast("삭제할 일정이 없습니다.");
      return;
    }
    if (!(await uiConfirm(`저장된 일정 ${state.savedTrips.length}개를 모두 삭제할까요? 되돌릴 수 없습니다.`, { okText: "모두 삭제", danger: true }))) return;
    state.savedTrips = [];
    saveToLocalStorage();
    renderSettingsTab();
    showToast("모든 일정을 삭제했습니다.");
  });
}

function renderSettingsTab() {
  const s = window.RoutyAI.getSettings();
  document.getElementById("setting-api-key").value = s.apiKey;
  document.getElementById("setting-model").value = s.model;
  document.getElementById("setting-kakao-key").value = s.kakaoKey || "";
  document.getElementById("setting-naver-key").value = s.naverKey || "";
  const statusEl = document.getElementById("settings-status");
  if (statusEl && !statusEl.textContent) {
    statusEl.textContent = s.apiKey ? "API 키가 등록되어 있습니다." : "";
  }
  const stats = document.getElementById("settings-stats");
  if (stats) {
    const placeCount = state.savedTrips.reduce((n, t) => n + (t.places || []).length, 0);
    stats.innerHTML = `<span>저장된 일정 <strong>${state.savedTrips.length}</strong>개</span><span>장소 <strong>${placeCount}</strong>곳</span>`;
  }
}

function updateAiNotice() {
  const hasKey = window.RoutyAI.hasApiKey();
  const notice = document.getElementById("ai-key-notice");
  const label = document.getElementById("btn-generate-label");
  if (notice) notice.style.display = hasKey ? "none" : "flex";
  if (label) label.textContent = hasKey ? "AI 일정 생성하기" : "샘플 일정 만들기";
}

// --- Explore Tab: Templates Render ---
function renderExploreTab() {}

function setupExploreSearch() {
  const searchInput = document.getElementById("explore-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      renderTemplates();
    });
  }
}

function renderTemplates() {
  const container = document.getElementById("templates-container");
  if (!container) return;
  
  container.innerHTML = "";
  
  const searchInput = document.getElementById("explore-search-input");
  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
  
  let matchCount = 0;
  
  Object.keys(window.PREDEFINED_TEMPLATES).forEach(key => {
    const template = window.PREDEFINED_TEMPLATES[key];
    
    // Filter templates if search query exists
    if (query) {
      const destination = template.destination.toLowerCase();
      const title = template.title.toLowerCase();
      const description = template.description.toLowerCase();
      
      const matches = destination.includes(query) || 
                      title.includes(query) || 
                      description.includes(query);
      if (!matches) return;
    }
    
    matchCount++;
    const card = document.createElement("div");
    card.className = "template-card";
    
    const styleText = template.style === "active" ? "액티비티" : "힐링";
    const budgetLabel = template.budget === "high" ? "럭셔리" : template.budget === "low" ? "가성비" : "일반";

    card.innerHTML = `
      <h3>${esc(template.title.split(' (')[0])}</h3>
      <div class="template-meta-geo">${template.destination.replaceAll('/', ' · ')} · ${template.duration}일</div>
      ${state.seniorMode ? '' : `<p class="template-desc-single">${template.description}</p>`}
      <div class="template-meta-style">${styleText} · ${budgetLabel}</div>
    `;
    
    card.addEventListener("click", () => {
      // Direct load pre-configured template as active itinerary
      loadItineraryTemplate(template);
    });
    
    container.appendChild(card);
  });
  
  if (matchCount === 0) {
    const noResult = document.createElement("div");
    noResult.className = "no-search-results";
    noResult.innerHTML = `
      <div class="no-results-icon">${window.icon("search", 32)}</div>
      <p>"<strong>${esc(query)}</strong>"에 맞는 추천 템플릿이 없습니다.</p>
      <span>AI 플래너에서 바로 일정을 만들어 보세요!</span>
      <button class="btn btn-sm btn-primary" style="margin-top:12px" id="btn-explore-to-planner">"${esc(query)}" AI로 일정 만들기</button>
    `;
    container.appendChild(noResult);
    const go = document.getElementById("btn-explore-to-planner");
    if (go) go.addEventListener("click", () => {
      document.getElementById("input-destination").value = searchInput.value.trim();
      switchTab("planner");
    });
  }
}

function loadItineraryTemplate(template) {
  // Setup current active trip deep-cloning places
  state.activeTrip = {
    id: `template-${template.id}-${Date.now()}`,
    source: "template",
    summary: template.description,
    title: template.title,
    destination: template.destination,
    days: template.duration,
    budget: template.budget,
    style: template.style,
    places: JSON.parse(JSON.stringify(template.places))
  };
  ensurePlacePrices(state.activeTrip);
  state.activeTripDay = 1;

  // Jump to itinerary view
  showItineraryView();
  showToast(`${template.destination} 추천 템플릿 일정을 로드했습니다.`);
}

// --- Planner: Destinations Autocomplete Suggestions ---
const POPULAR_DESTINATIONS = ["제주도", "경주", "부산", "서울", "도쿄", "교토", "오사카", "파리", "뉴욕", "다낭", "방콕", "싱가포르", "로마", "바르셀로나"];

function setupSuggestions() {
  const input = document.getElementById("input-destination");
  const suggestionsBox = document.getElementById("destination-suggestions");
  
  if (!input || !suggestionsBox) return;

  input.addEventListener("input", () => {
    const val = input.value.trim().toLowerCase();
    suggestionsBox.innerHTML = "";
    
    if (!val) {
      suggestionsBox.style.display = "none";
      return;
    }

    const matches = POPULAR_DESTINATIONS.filter(dest => dest.toLowerCase().includes(val));
    
    if (matches.length > 0) {
      matches.forEach(match => {
        const item = document.createElement("div");
        item.className = "suggestion-item";
        item.textContent = match;
        item.addEventListener("click", () => {
          input.value = match;
          suggestionsBox.style.display = "none";
        });
        suggestionsBox.appendChild(item);
      });
      suggestionsBox.style.display = "block";
    } else {
      suggestionsBox.style.display = "none";
    }
  });

  // Close suggestions box on outside click
  document.addEventListener("click", (e) => {
    if (e.target !== input) {
      suggestionsBox.style.display = "none";
    }
  });
}

// --- Planner: Style tags (다중 선택) ---
function setupStyleTags() {
  document.querySelectorAll(".style-tags-container .style-tag").forEach(tag => {
    tag.addEventListener("click", () => {
      tag.classList.toggle("active");
      if (!document.querySelector(".style-tags-container .style-tag.active")) {
        tag.classList.add("active");
      }
    });
  });
}

// --- Planner: AI Itinerary Generator form ---
let generateController = null;
let generateCancelledByUser = false;

const PARTY_PEOPLE = { "혼자": 1, "연인/배우자와 둘이서": 2, "친구들과": 3, "어린 자녀가 있는 가족": 4, "부모님(어르신) 모시고, 걷는 양을 줄여서": 3 };

function setupPlannerForm() {
  const form = document.getElementById("planner-form");
  const cancelBtn = document.getElementById("btn-cancel-generate");
  if (!form) return;
  setupStyleTags();

  setupSpendPicker("spend-picker");
  setupBudgetInputs("input-budget", () => parseInt(document.getElementById("input-people").value, 10) || 1);

  document.querySelectorAll("#transport-picker .transport-opt").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#transport-picker .transport-opt").forEach(b => {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-checked", b === btn ? "true" : "false");
      });
    });
  });

  const partySel = document.getElementById("input-party");
  const peopleSel = document.getElementById("input-people");
  partySel.addEventListener("change", () => {
    peopleSel.value = String(PARTY_PEOPLE[partySel.value] || 2);
    updateBudgetSum("input-budget");
  });
  peopleSel.addEventListener("change", () => updateBudgetSum("input-budget"));

  cancelBtn.addEventListener("click", () => {
    if (generateController) {
      generateCancelledByUser = true;
      generateController.abort();
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = {
      destination: document.getElementById("input-destination").value.trim(),
      days: parseInt(document.getElementById("input-duration").value, 10),
      budget: getSpendValue("spend-picker"),
      budgetPlan: readBudgetInputs("input-budget"),
      party: partySel.value,
      people: parseInt(peopleSel.value, 10) || 1,
      transport: (document.querySelector("#transport-picker .transport-opt.active") || {}).dataset?.transport || "auto",
      startDate: document.getElementById("input-start-date").value,
      request: document.getElementById("input-request").value.trim(),
      styles: Array.from(document.querySelectorAll(".style-tags-container .style-tag.active")).map(t => t.getAttribute("data-style"))
    };
    if (input.styles.length === 0) input.styles.push("relaxing");
    if (!input.destination) {
      showToast("여행 목적지를 입력해 주세요.");
      return;
    }
    const trip = await runGeneration(input);
    if (trip) {
      document.getElementById("input-destination").value = "";
      document.getElementById("input-request").value = "";
      state.activeTrip = trip;
      state.activeTripDay = 1;
      saveDraft();
      showItineraryView();
      if (trip.source === "ai") verifyCoordinates(trip.id, trip.places.map(p => p.id));
      showToast(trip.source === "ai" ? "초안이 나왔어요. 마음에 들면 '저장', 아니면 '다시 만들기'를 누르세요." : "샘플 일정을 만들었습니다.", 4000);
    }
  });
}

// 입력값으로 일정 생성 (성공 시 trip, 실패/취소 시 null)
async function runGeneration(input) {
  const loadingOverlay = document.getElementById("planner-loading-overlay");
  const statusText = document.getElementById("loading-status-text");
  const elapsedEl = document.getElementById("loading-elapsed");
  const cancelBtn = document.getElementById("btn-cancel-generate");
  const useAI = window.RoutyAI.hasApiKey();

  // 로딩 화면이 어느 탭에서든 보이도록 body로 옮김
  document.body.appendChild(loadingOverlay);
  loadingOverlay.classList.add("active", "floating");
  cancelBtn.style.display = useAI ? "" : "none";

  const messages = useAI
    ? ["여행지 정보를 모으는 중...", "실제 장소와 동선을 고르는 중...", "시간표와 예상 비용을 계산하는 중...", "거의 다 됐어요. 일정을 다듬는 중..."]
    : ["샘플 일정을 만드는 중..."];
  let msgIdx = 0;
  let progressShown = false;
  statusText.textContent = messages[0];
  elapsedEl.textContent = "";
  const t0 = Date.now();
  const ticker = setInterval(() => {
    const sec = Math.floor((Date.now() - t0) / 1000);
    elapsedEl.textContent = `${sec}초 경과`;
    if (!progressShown && sec > 0 && sec % 6 === 0 && msgIdx < messages.length - 1) {
      msgIdx++;
      statusText.textContent = messages[msgIdx];
    }
  }, 1000);
  const onProgress = (p) => {
    if (p.phase === "thinking" && !progressShown) {
      statusText.textContent = "AI가 동선을 구상하는 중...";
    } else if (p.phase === "writing") {
      progressShown = true;
      statusText.textContent = p.places ? `일정 작성 중 · 장소 ${p.places}곳` : "일정 작성 시작...";
    }
  };

  const base = {
    id: `trip-${Date.now()}`,
    destination: input.destination,
    days: input.days,
    budget: input.budget,
    budgetPlan: input.budgetPlan,
    style: input.styles[0],
    styles: input.styles,
    party: input.party,
    people: input.people,
    transport: input.transport || "auto",
    startDate: input.startDate,
    request: input.request,
    genInput: input,
    createdAt: Date.now()
  };

  try {
    let trip;
    if (useAI) {
      generateController = new AbortController();
      generateCancelledByUser = false;
      try {
        const plan = await window.RoutyAI.generateTrip(input, { signal: generateController.signal, onProgress });
        trip = Object.assign(base, {
          title: plan.title || `${input.destination} ${input.days}일 여행`,
          summary: plan.summary,
          places: plan.places,
          checklistSeed: plan.tips,
          source: "ai"
        });
      } finally {
        /* 타임아웃은 ai.js가 응답 끊김 기준으로 처리 */
      }
    } else {
      await sleep(900);
      trip = Object.assign(base, {
        title: `[샘플] ${input.destination} ${input.days}일 여행`,
        summary: "API 키 없이 만든 샘플 일정입니다. 설정에서 Gemini 키를 등록하면 실제 장소로 일정을 짜 줍니다.",
        places: window.generateItinerary(input.destination, input.days, input.budget, input.styles[0]),
        source: "sample"
      });
    }
    ensureTripShape(trip);
    ensurePlacePrices(trip);
    return trip;
  } catch (err) {
    if (generateCancelledByUser) showToast("일정 생성을 취소했습니다.");
    else {
      console.error(err);
      showToast(err.message || "일정 생성 중 오류가 발생했습니다.", 5000);
    }
    return null;
  } finally {
    clearInterval(ticker);
    generateController = null;
    loadingOverlay.classList.remove("active", "floating");
  }
}

// 같은 조건으로 다시 생성 (초안 상태에서)
async function regenerateActiveTrip() {
  const t = state.activeTrip;
  if (!t || !t.genInput) return;
  const ok = await uiConfirm("같은 조건으로 일정을 새로 만들까요? 지금 초안은 바뀝니다. (되돌리기 가능)", { okText: "다시 만들기" });
  if (!ok) return;
  const before = cloneTrip(t);
  const input = Object.assign({}, t.genInput, { startDate: t.startDate, people: t.people, transport: t.transport || "auto", budget: t.budget, budgetPlan: t.budgetPlan });
  const fresh = await runGeneration(input);
  if (!fresh) return;
  fresh.id = t.id;
  state.activeTrip = fresh;
  state.activeTripDay = 1;
  renderItineraryAll();
  persistActiveTrip();
  if (fresh.source === "ai") verifyCoordinates(fresh.id, fresh.places.map(p => p.id));
  showToast("새 일정을 만들었어요.", 6000, {
    label: "이전 초안으로",
    onClick: () => {
      state.activeTrip = before;
      renderItineraryAll();
      persistActiveTrip();
    }
  });
}

// Helper: Parse time string (e.g. "14:00 - 15:00", "오전 9:30", "오후 2시") into absolute minutes for sorting
function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 9999;
  
  let str = timeStr.trim();
  
  // Extract start time only if duration range exists
  if (str.includes('-')) {
    str = str.split('-')[0].trim();
  }
  if (str.includes('~')) {
    str = str.split('~')[0].trim();
  }
  
  let isPM = false;
  if (str.includes("오후") || str.toUpperCase().includes("PM")) {
    isPM = true;
  }
  
  // Extract digits
  const numbers = str.match(/\d+/g);
  if (!numbers) return 9999; // Default to end of day if no numbers found
  
  let hours = parseInt(numbers[0], 10);
  let minutes = numbers[1] ? parseInt(numbers[1], 10) : 0;
  
  // Convert 12-hour format to 24-hour minutes
  if (isPM && hours < 12) {
    hours += 12;
  } else if (!isPM && hours === 12 && (str.includes("오전") || str.toUpperCase().includes("AM"))) {
    hours = 0;
  }
  
  return hours * 60 + minutes;
}

// --- 장소 검색 UI (OpenStreetMap) ---
function setupPlaceSearch({ inputId, buttonId, resultsId, pickedId }) {
  const input = document.getElementById(inputId);
  const btn = document.getElementById(buttonId);
  const results = document.getElementById(resultsId);
  const pickedEl = document.getElementById(pickedId);
  let picked = null;

  const renderPicked = () => {
    pickedEl.innerHTML = picked
      ? `위치 지정됨: ${esc(picked.address || picked.name)} <button type="button" class="link-btn" data-clear>해제</button>`
      : "";
  };

  pickedEl.addEventListener("click", (e) => {
    if (e.target.hasAttribute("data-clear")) {
      picked = null;
      renderPicked();
    }
  });

  const run = async () => {
    const q = input.value.trim();
    if (!q) {
      showToast("검색할 장소 이름을 입력해 주세요.");
      return;
    }
    results.innerHTML = `<div class="place-search-msg">검색 중...</div>`;
    const near = state.activeTrip && state.activeTrip.places.length
      ? { lat: state.activeTrip.places[0].lat, lng: state.activeTrip.places[0].lng }
      : null;
    try {
      let list = await window.RoutyAI.searchPlaces(q, near);
      if (!list.length && state.activeTrip && state.activeTrip.destination) {
        list = await window.RoutyAI.searchPlaces(`${q} ${state.activeTrip.destination}`, near);
      }
      if (!list.length) {
        results.innerHTML = `<div class="place-search-msg">검색 결과가 없어요. 영어/현지어 이름으로도 시도해 보세요.</div>`;
        return;
      }
      results.innerHTML = "";
      list.forEach(r => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "place-search-item";
        item.innerHTML = `<strong>${esc(r.name)}</strong><span>${esc(r.address)}</span>`;
        item.addEventListener("click", () => {
          picked = r;
          results.innerHTML = "";
          renderPicked();
        });
        results.appendChild(item);
      });
    } catch (e) {
      results.innerHTML = `<div class="place-search-msg">${esc(e.message)}</div>`;
    }
  };

  btn.addEventListener("click", run);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      run();
    }
  });

  return {
    getPicked: () => picked,
    reset: () => {
      picked = null;
      results.innerHTML = "";
      renderPicked();
    }
  };
}

let addPlaceSearch = null;
let editPlaceSearch = null;
let refineUndoTrip = null;

function setRefineMode(mode) {
  const btn = document.getElementById("btn-ai-refine");
  if (!btn) return;
  btn.dataset.mode = mode === "undo" ? "undo" : "";
  btn.textContent = mode === "undo" ? "되돌리기" : "수정";
  btn.classList.toggle("btn-undo", mode === "undo");
}

// --- Itinerary View: Back, Save & Tab actions ---
function setupItineraryControls() {
  document.getElementById("btn-itinerary-back").addEventListener("click", () => {
    const fallback = isActiveTripSaved() ? "trips" : (state.activeTrip && state.activeTrip.source === "template" ? "explore" : "planner");
    goBack(fallback);
  });

  const toggleEditBtn = document.getElementById("btn-toggle-edit-mode");
  if (toggleEditBtn) {
    toggleEditBtn.addEventListener("click", () => {
      state.editMode = !state.editMode;
      const timelineContainer = document.getElementById("timeline-places-container");
      if (timelineContainer) timelineContainer.classList.toggle("edit-mode-active", state.editMode);
      toggleEditBtn.classList.toggle("active", state.editMode);
      toggleEditBtn.textContent = state.editMode ? "완료" : "편집";
    });
  }

  document.getElementById("btn-save-itinerary").addEventListener("click", () => {
    if (!state.activeTrip) return;
    const wasSaved = isActiveTripSaved();
    if (wasSaved) {
      persistActiveTrip();
    } else {
      if (state.activeTrip.source === "template" || state.activeTrip.source === "shared") {
        // 템플릿/공유 일정은 새 id로 내 일정에 복사
        state.activeTrip.id = `trip-${Date.now()}`;
        state.activeTrip.source = state.activeTrip.source === "shared" ? "shared-saved" : "template-saved";
      }
      state.activeTrip.createdAt = state.activeTrip.createdAt || Date.now();
      state.savedTrips.unshift(cloneTrip(state.activeTrip));
      saveToLocalStorage();
      clearDraft();
      history.replaceState({ routy: true }, "", currentRouteFor("itinerary"));
      renderItineraryAll();
    }
    renderSidebarTrips();
    showToast(wasSaved ? "변경 사항은 자동으로 저장되고 있어요." : "내 일정에 저장했어요. 이제부터 수정하면 자동 저장됩니다.", 3000);
  });

  // 빠른 도구
  setupTripMenu();

  // AI 수정 요청
  const refineForm = document.getElementById("ai-refine-form");
  const refineInput = document.getElementById("ai-refine-input");
  const refineBtn = document.getElementById("btn-ai-refine");
  refineForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (refineBtn.dataset.mode === "undo") return;
    const instruction = refineInput.value.trim();
    if (!instruction || !state.activeTrip) return;
    if (!window.RoutyAI.hasApiKey()) {
      showToast("AI 수정은 설정에서 Gemini API 키를 등록해야 사용할 수 있어요.", 3500);
      return;
    }
    refineBtn.disabled = true;
    refineInput.disabled = true;
    refineBtn.textContent = "수정 중...";
    refineForm.classList.add("loading");
    const scopeDay = refineScope === "day" ? state.activeTripDay : null;
    try {
      const plan = await window.RoutyAI.refineTrip(state.activeTrip, instruction, {
        day: scopeDay,
        onProgress: (p) => {
          if (p.phase === "writing" && p.places) refineBtn.textContent = `${p.places}곳…`;
          else if (p.phase === "thinking") refineBtn.textContent = "구상 중…";
        }
      });
      const t = state.activeTrip;
      refineUndoTrip = cloneTrip(t);
      const oldPlaces = scopeDay ? t.places.filter(p => p.day === scopeDay) : t.places;
      const oldKeys = new Set(oldPlaces.map(p => `${p.day}|${p.name}|${p.time}`));
      let incoming = plan.places;
      if (scopeDay) {
        // AI가 다른 날까지 돌려주면 그 날 것만 사용
        const sameDay = incoming.filter(p => p.day === scopeDay);
        if (sameDay.length) incoming = sameDay;
        incoming.forEach(p => { p.day = scopeDay; });
        // 그 날만 교체하고 나머지 날은 그대로
        const merged = [];
        let inserted = false;
        t.places.forEach(p => {
          if (p.day === scopeDay) {
            if (!inserted) { merged.push(...incoming); inserted = true; }
          } else merged.push(p);
        });
        if (!inserted) merged.push(...incoming);
        t.places = merged;
        sortTripPlaces(t, scopeDay);
      } else {
        // 전체 수정: 이름이 같은 장소는 기존 id·메모를 유지
        const byName = new Map(t.places.map(p => [p.name, p]));
        incoming.forEach(p => {
          const prev = byName.get(p.name);
          if (prev) {
            p.id = prev.id;
            if (prev.coordFixed && !p.coordMissing) { p.lat = prev.lat; p.lng = prev.lng; p.coordFixed = true; }
          }
        });
        t.places = incoming;
        // AI가 일수를 늘렸으면 반영
        const maxDay = Math.max(...incoming.map(p => p.day));
        if (maxDay > t.days) t.days = maxDay;
      }
      if (plan.summary && !scopeDay) t.summary = plan.summary;
      if (plan.tips && plan.tips.length) t.checklistSeed = plan.tips;
      ensureTripShape(t);
      ensurePlacePrices(t);
      recentlyChanged = new Set(incoming.filter(p => !oldKeys.has(`${p.day}|${p.name}|${p.time}`)).map(p => p.id));
      const changedCount = recentlyChanged.size;
      refineInput.value = "";
      renderItineraryAll();
      persistActiveTrip();
      setRefineMode("undo");
      verifyCoordinates(t.id, Array.from(recentlyChanged));
      showToast(changedCount ? `${changedCount}곳이 바뀌었어요 ('AI 변경' 표시). 마음에 안 들면 '되돌리기'를 누르세요.` : "바뀐 장소가 없어요. 요청을 조금 더 구체적으로 적어 보세요.", 4000);
    } catch (err) {
      showToast(err.message || "수정 중 오류가 발생했습니다.", 5000);
    } finally {
      refineBtn.disabled = false;
      refineInput.disabled = false;
      refineForm.classList.remove("loading");
      if (refineBtn.dataset.mode !== "undo") setRefineMode("normal");
    }
  });

  const scopeBtn = document.getElementById("btn-refine-scope");
  scopeBtn.addEventListener("click", () => {
    refineScope = refineScope === "day" ? "all" : "day";
    updateRefineScopeLabel();
  });

  refineBtn.addEventListener("click", (ev) => {
    if (refineBtn.dataset.mode !== "undo") return;
    ev.preventDefault();
    if (refineUndoTrip) {
      state.activeTrip = refineUndoTrip;
      refineUndoTrip = null;
      recentlyChanged = new Set();
      renderItineraryAll();
      persistActiveTrip();
      showToast("수정 전 일정으로 되돌렸습니다.");
    }
    setRefineMode("normal");
  });
  refineInput.addEventListener("input", () => {
    if (refineBtn.dataset.mode === "undo") setRefineMode("normal");
  });

  // 장소 추가 Drawer
  const toggleBtn = document.getElementById("btn-toggle-add-place");
  const drawer = document.getElementById("add-place-drawer");
  addPlaceSearch = setupPlaceSearch({
    inputId: "add-place-name",
    buttonId: "btn-add-place-search",
    resultsId: "add-place-results",
    pickedId: "add-place-picked"
  });

  toggleBtn.addEventListener("click", () => {
    drawer.classList.add("active");
    toggleBtn.classList.add("hidden");
    document.getElementById("add-place-name").focus();
  });
  document.getElementById("btn-cancel-add-place").addEventListener("click", closeAddPlaceDrawer);

  document.getElementById("btn-confirm-add-place").addEventListener("click", () => {
    const name = document.getElementById("add-place-name").value.trim();
    const time = window.RoutyAI.normalizeTime(document.getElementById("add-place-time").value.trim()) || "시간 미정";
    const category = document.getElementById("add-place-cat").value;
    const desc = document.getElementById("add-place-desc").value.trim();
    const priceInput = document.getElementById("add-place-price").value.trim();

    if (!name) {
      showToast("장소 이름을 입력해주세요.");
      return;
    }

    let price = priceInput ? parseInt(priceInput, 10) : NaN;
    if (isNaN(price) || price < 0) price = getDeterministicPrice(name, category, state.activeTrip.budget);

    const picked = addPlaceSearch.getPicked();
    let lat, lng, coordMissing = false;
    if (picked) {
      lat = picked.lat;
      lng = picked.lng;
    } else {
      const ref = state.activeTrip.places.find(p => p.day === state.activeTripDay) || state.activeTrip.places[0];
      lat = ref ? ref.lat : 37.5665;
      lng = ref ? ref.lng : 126.978;
      coordMissing = true;
    }

    const newPlace = {
      day: state.activeTripDay,
      id: `custom-${Date.now()}`,
      name, time, lat, lng, coordMissing, category, price,
      priceUnit: category === "hotel" ? "group" : "person",
      description: desc
    };

    // 시간 순서에 맞게 삽입 (숙소는 항상 마지막)
    const activeDayPlaces = state.activeTrip.places.filter(p => p.day === state.activeTripDay);
    const newTimeVal = parseTimeToMinutes(newPlace.time);
    let target = null;
    for (const p of activeDayPlaces) {
      if (category !== "hotel" && p.category === "hotel") { target = p; break; }
      const pt = parseTimeToMinutes(p.time);
      if (newTimeVal !== 9999 && pt !== 9999 && newTimeVal < pt) { target = p; break; }
    }
    if (target) {
      state.activeTrip.places.splice(state.activeTrip.places.indexOf(target), 0, newPlace);
    } else {
      const last = activeDayPlaces[activeDayPlaces.length - 1];
      const idx = last ? state.activeTrip.places.indexOf(last) + 1 : state.activeTrip.places.length;
      state.activeTrip.places.splice(idx, 0, newPlace);
    }

    closeAddPlaceDrawer();
    renderTimeline();
    updateMapMarkers();
    persistActiveTrip();
    showToast(picked ? "장소를 추가했습니다." : "장소를 추가했습니다. (위치 미지정 — 지도에는 대략적으로 표시)", 3000);
  });
}

function closeAddPlaceDrawer() {
  const toggleBtn = document.getElementById("btn-toggle-add-place");
  const drawer = document.getElementById("add-place-drawer");
  drawer.classList.remove("active");
  toggleBtn.classList.remove("hidden");
  ["add-place-name", "add-place-time", "add-place-price", "add-place-desc"].forEach(id => {
    document.getElementById(id).value = "";
  });
  if (addPlaceSearch) addPlaceSearch.reset();
}

// --- 장소 편집 모달 ---
let editingPlaceId = null;

function setupPlaceEditModal() {
  const overlay = document.getElementById("place-edit-modal-overlay");
  editPlaceSearch = setupPlaceSearch({
    inputId: "edit-place-name",
    buttonId: "btn-edit-place-search",
    resultsId: "edit-place-results",
    pickedId: "edit-place-picked"
  });
  const close = () => {
    overlay.classList.remove("active");
    editingPlaceId = null;
  };
  document.getElementById("btn-close-place-edit").addEventListener("click", close);
  document.getElementById("btn-cancel-place-edit").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  document.getElementById("btn-confirm-place-edit").addEventListener("click", () => {
    const place = state.activeTrip && state.activeTrip.places.find(p => p.id === editingPlaceId);
    if (!place) return close();
    const name = document.getElementById("edit-place-name").value.trim();
    if (!name) {
      showToast("장소 이름을 입력해 주세요.");
      return;
    }
    const before = cloneTrip(state.activeTrip);
    const oldTime = place.time;
    const oldDay = place.day;
    place.name = name;
    place.time = window.RoutyAI.normalizeTime(document.getElementById("edit-place-time").value.trim()) || "시간 미정";
    place.priceUnit = document.getElementById("edit-place-price-unit").value;
    const moveMode = document.getElementById("edit-move-mode").value;
    const moveMin = parseInt(document.getElementById("edit-move-min").value, 10);
    if (moveMode) {
      const moveCost = parseInt(document.getElementById("edit-move-cost").value, 10);
      place.move = {
        mode: moveMode,
        minutes: isFinite(moveMin) && moveMin > 0 ? moveMin : undefined,
        cost: isFinite(moveCost) && moveCost >= 0 ? moveCost : undefined,
        note: place.move && place.move.mode === moveMode ? place.move.note : ""
      };
    } else {
      delete place.move;
    }
    place.day = parseInt(document.getElementById("edit-place-day").value, 10) || place.day;
    place.category = document.getElementById("edit-place-cat").value;
    const price = parseInt(document.getElementById("edit-place-price").value, 10);
    place.price = isNaN(price) || price < 0 ? 0 : price;
    place.description = document.getElementById("edit-place-desc").value.trim();
    const picked = editPlaceSearch.getPicked();
    if (picked) {
      place.lat = picked.lat;
      place.lng = picked.lng;
      place.coordMissing = false;
    }
    // 시간 변경분만큼 이후 일정 이동
    const shiftFollowing = document.getElementById("edit-shift-following").checked;
    const oldR = parseTimeRange(oldTime), newR = parseTimeRange(place.time);
    if (shiftFollowing && place.day === oldDay && oldR && newR && oldR[0] !== newR[0]) {
      const delta = newR[0] - oldR[0];
      const dayPlaces = state.activeTrip.places.filter(p => p.day === place.day);
      dayPlaces.slice(dayPlaces.indexOf(place) + 1).forEach(p => { p.time = shiftTimeString(p.time, delta); });
    }
    if (place.day !== oldDay || place.time !== oldTime) {
      // 다른 날로 옮기면 그날 맨 끝으로
      if (place.day !== oldDay) {
        state.activeTrip.places.splice(state.activeTrip.places.indexOf(place), 1);
        state.activeTrip.places.push(place);
      }
      sortTripPlaces(state.activeTrip, place.day);
    }
    close();
    renderItineraryAll();
    persistActiveTrip();
    showToast("장소 정보를 수정했습니다.", 6000, {
      label: "되돌리기",
      onClick: () => {
        state.activeTrip = before;
        renderItineraryAll();
        persistActiveTrip();
      }
    });
  });
}

function openPlaceEdit(placeId) {
  const place = state.activeTrip && state.activeTrip.places.find(p => p.id === placeId);
  if (!place) return;
  editingPlaceId = placeId;
  if (window.closeSeniorDetailModal) window.closeSeniorDetailModal();
  document.getElementById("edit-place-name").value = place.name || "";
  document.getElementById("edit-place-time").value = place.time || "";
  document.getElementById("edit-place-cat").value = place.category || "sightseeing";
  document.getElementById("edit-place-price").value = place.price || 0;
  document.getElementById("edit-place-price-unit").value = place.priceUnit === "group" ? "group" : "person";
  document.getElementById("edit-move-mode").value = place.move && place.move.mode ? place.move.mode : "";
  document.getElementById("edit-move-min").value = place.move && place.move.minutes ? place.move.minutes : "";
  document.getElementById("edit-move-cost").value = place.move && place.move.cost !== undefined ? place.move.cost : "";
  document.getElementById("edit-place-desc").value = place.description || "";
  const daySel = document.getElementById("edit-place-day");
  daySel.innerHTML = "";
  for (let d = 1; d <= state.activeTrip.days; d++) {
    const date = getTripDate(state.activeTrip, d);
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = `Day ${d}${date ? ` · ${formatShortDate(date)}` : ""}`;
    if (d === place.day) opt.selected = true;
    daySel.appendChild(opt);
  }
  editPlaceSearch.reset();
  document.getElementById("place-edit-modal-overlay").classList.add("active");
}

// 하루 일정을 시간순 정렬 (시간 미정은 상대 순서 유지, 숙소는 맨 끝)
function sortTripPlaces(trip, day) {
  const dayPlaces = trip.places.filter(p => p.day === day);
  const order = dayPlaces.map((p, i) => ({ p, i }));
  order.sort((a, b) => {
    const ah = a.p.category === "hotel" ? 1 : 0;
    const bh = b.p.category === "hotel" ? 1 : 0;
    if (ah !== bh) return ah - bh;
    const at = parseTimeToMinutes(a.p.time);
    const bt = parseTimeToMinutes(b.p.time);
    if (at !== 9999 && bt !== 9999 && at !== bt) return at - bt;
    return a.i - b.i;
  });
  const others = trip.places.filter(p => p.day !== day);
  const sorted = order.map(o => o.p);
  // 날짜 순서대로 재구성
  const result = [];
  for (let d = 1; d <= trip.days; d++) {
    if (d === day) result.push(...sorted);
    else result.push(...others.filter(p => p.day === d));
  }
  result.push(...others.filter(p => p.day < 1 || p.day > trip.days));
  trip.places = result;
}

function movePlace(placeId, dir) {
  const places = state.activeTrip.places;
  const place = places.find(p => p.id === placeId);
  if (!place) return;
  const dayPlaces = places.filter(p => p.day === place.day);
  const i = dayPlaces.indexOf(place);
  const j = i + dir;
  if (j < 0 || j >= dayPlaces.length) return;
  const a = places.indexOf(place);
  const b = places.indexOf(dayPlaces[j]);
  places[a] = dayPlaces[j];
  places[b] = place;
  renderTimeline();
  updateMapMarkers();
  persistActiveTrip();
}

function deletePlaceById(placeId) {
  const place = state.activeTrip.places.find(p => p.id === placeId);
  if (!place) return;
  if (window.closeSeniorDetailModal) window.closeSeniorDetailModal();
  withUndo(`"${place.name}"을(를) 삭제했습니다.`, () => {
    state.activeTrip.places.splice(state.activeTrip.places.indexOf(place), 1);
  });
}

// 타임라인 / 상세 모달 버튼 공통 처리
function setupPlaceActionDelegation() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action][data-id]");
    if (!btn || !state.activeTrip) return;
    e.stopPropagation();
    const id = btn.getAttribute("data-id");
    const place = state.activeTrip.places.find(p => p.id === id);
    if (!place) return;
    const action = btn.getAttribute("data-action");
    if (action === "map") window.open(getPlaceLinks(place).mapUrl, "_blank", "noopener");
    else if (action === "route") window.open(getPlaceLinks(place).routeUrl, "_blank", "noopener");
    else if (action === "search") window.open(getPlaceLinks(place).searchUrl, "_blank", "noopener");
    else if (action === "edit") openPlaceEdit(id);
    else if (action === "up") movePlace(id, -1);
    else if (action === "down") movePlace(id, 1);
    else if (action === "delete") {
      deletePlaceById(id);
    }
    else if (action === "delay") askDelay(id);
  });
}

// --- Itinerary: Screen Activation ---
function renderTripMeta() {
  const el = document.getElementById("trip-meta-row");
  if (!el || !state.activeTrip) return;
  const t = state.activeTrip;
  const start = getTripDate(t, 1);
  const range = start && t.days > 1 ? `~ ${formatShortDate(getTripDate(t, t.days))} · ` : "";
  const badge = t.source === "ai" ? `<span class="trip-source-badge ai">AI 생성</span>`
    : t.source === "sample" ? `<span class="trip-source-badge sample">샘플</span>`
    : t.source === "shared" ? `<span class="trip-source-badge shared">공유받음</span>`
    : t.source === "template" ? `<span class="trip-source-badge sample">템플릿</span>` : "";
  el.innerHTML = `
    <div class="trip-meta-line">
      ${badge}
      <label class="trip-date-picker meta-item" title="출발일 지정">${window.icon("calendar", 16)}<input type="date" id="trip-start-date-input" value="${esc(t.startDate || "")}" aria-label="출발일"></label>
      <span class="meta-item">${range}${t.days}일</span>
      ${t.party ? `<span class="meta-item">${window.icon("users", 16)}${esc(t.party.split(",")[0])}</span>` : ""}
      <label class="meta-item meta-transport" title="이동 수단">${window.icon(t.transport === "car" ? "car" : t.transport === "taxi" ? "taxi" : t.transport === "walk" ? "walk" : "bus", 16)}<select id="trip-transport-select" aria-label="이동 수단">
        ${Object.entries(TRANSPORT_LABELS).map(([k, v]) => `<option value="${k}" ${(t.transport || "auto") === k ? "selected" : ""}>${v}</option>`).join("")}
      </select></label>
    </div>
    ${t.summary ? `<p class="trip-summary">${esc(t.summary)}</p>` : ""}
    ${!isActiveTripSaved() ? `
      <div class="draft-banner">
        <span>${t.source === "shared" ? "공유받은 일정이에요." : t.source === "template" ? "추천 템플릿이에요." : "아직 저장 전인 초안이에요."} 저장하면 내 일정에 추가되고 이후 수정은 자동 저장돼요.</span>
        <div class="draft-actions">
          ${t.genInput && window.RoutyAI.hasApiKey() ? `<button type="button" class="chip-btn" id="btn-regenerate">${window.icon("undo", 16)}다시 만들기</button>` : ""}
          <button type="button" class="chip-btn chip-primary" id="btn-draft-save">${window.icon("check", 16)}내 일정에 저장</button>
        </div>
      </div>` : ""}
    <details class="budget-card" id="budget-card" ${budgetCardOpen ? "open" : ""}>${budgetCardHtml(t)}</details>
    <div class="verify-status" id="verify-status"></div>
  `;
  document.getElementById("btn-edit-budget").addEventListener("click", (e) => { e.preventDefault(); openBudgetModal(); });
  document.getElementById("budget-card").addEventListener("toggle", (e) => { budgetCardOpen = e.target.open; });
  document.getElementById("trip-transport-select").addEventListener("change", (e) => changeTripTransport(e.target.value));
  const regen = document.getElementById("btn-regenerate");
  if (regen) regen.addEventListener("click", regenerateActiveTrip);
  const dsave = document.getElementById("btn-draft-save");
  if (dsave) dsave.addEventListener("click", () => document.getElementById("btn-save-itinerary").click());
  renderVerifyStatus();
  document.getElementById("trip-start-date-input").addEventListener("change", (e) => {
    state.activeTrip.startDate = e.target.value;
    renderItineraryAll();
    persistActiveTrip();
  });
}

// 오늘이 여행 기간이면 해당 Day 번호
function getTodayDay(trip) {
  const start = getTripDate(trip, 1);
  if (!start) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - start) / 86400000);
  return diff >= 0 && diff < trip.days ? diff + 1 : 0;
}

// 오늘 일정 중 지금 이후(또는 진행 중) 첫 장소
function getNextPlace(trip, day) {
  if (getTodayDay(trip) !== day) return null;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const list = trip.places.filter(p => p.day === day);
  for (const p of list) {
    const r = parseTimeRange(p.time);
    if (r && r[1] > nowMin) return p;
  }
  return null;
}

function renderNextUp() {
  const box = document.getElementById("next-up-card");
  if (!box || !state.activeTrip) return;
  const next = getNextPlace(state.activeTrip, state.activeTripDay);
  if (!next) {
    box.innerHTML = "";
    return;
  }
  const r = parseTimeRange(next.time);
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const label = r && r[0] <= nowMin ? "지금 일정" : "다음 일정";
  box.innerHTML = `
    <div class="nu-body">
      <div class="nu-label">${label}</div>
      <div class="nu-name">${esc(next.name)}</div>
      <div class="nu-time">${esc(next.time)}</div>
    </div>
    <div class="nu-buttons">
      <button class="nu-go" data-action="route" data-id="${esc(next.id)}">${window.icon("navigate", 18)}길찾기</button>
      <button class="nu-delay" data-action="delay" data-id="${esc(next.id)}">늦어짐</button>
    </div>
  `;
}

function renderSidebarTrips() {
  const box = document.getElementById("sidebar-trips");
  if (!box) return;
  if (!state.savedTrips.length) {
    box.innerHTML = "";
    return;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = state.savedTrips
    .filter(t => {
      const end = getTripDate(t, t.days);
      return !end || end >= today;
    })
    .sort((a, b) => (a.startDate || "9999").localeCompare(b.startDate || "9999"))
    .slice(0, 8);
  if (!upcoming.length) {
    box.innerHTML = "";
    return;
  }
  const activeId = state.activeTab === "itinerary" && state.activeTrip ? state.activeTrip.id : "";
  box.innerHTML = `<h4>다가오는 여행</h4>` + upcoming.map(t => {
    const start = getTripDate(t, 1);
    const when = start ? formatShortDate(start) : "날짜 미정";
    return `<button class="sidebar-trip ${t.id === activeId ? "active" : ""}" data-trip-id="${esc(t.id)}"><strong>${esc(t.title)}</strong><span>${when} · ${t.days}일</span></button>`;
  }).join("");
  box.querySelectorAll("[data-trip-id]").forEach(b => {
    b.addEventListener("click", () => loadSavedTrip(b.getAttribute("data-trip-id")));
  });
}

// 더보기 메뉴
function setupTripMenu() {
  const btn = document.getElementById("btn-trip-menu");
  const menu = document.getElementById("trip-menu");
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    document.getElementById("menu-edit-mode").classList.toggle("on", !!state.editMode);
    menu.classList.toggle("open");
  });
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target)) menu.classList.remove("open");
  });
  menu.addEventListener("click", (e) => {
    const item = e.target.closest("[data-menu]");
    if (!item) return;
    menu.classList.remove("open");
    const act = item.getAttribute("data-menu");
    if (act === "share") shareItinerary();
    else if (act === "calendar") downloadCalendarIcs();
    else if (act === "checklist") openChecklistModal();
    else if (act === "print") openPdfPreview();
    else if (act === "delete-day") deleteActiveDay();
    else if (act === "edit") {
      state.editMode = !state.editMode;
      renderTimeline();
      showToast(state.editMode ? "순서 편집 모드: ▲▼로 순서를 바꾸고 삭제할 수 있어요." : "순서 편집을 마쳤어요.");
    }
  });
}

// --- 예산 ---
let budgetCardOpen = false;
const SPEND_LABELS = { low: "가성비", medium: "적당히", high: "고급" };
const BUDGET_ITEMS = [["food", "식비"], ["transport", "교통비"], ["lodging", "숙박비"]];

function setupSpendPicker(id) {
  document.querySelectorAll(`#${id} .spend-opt`).forEach(btn => {
    btn.addEventListener("click", () => setSpendValue(id, btn.dataset.budget));
  });
}
function setSpendValue(id, value) {
  document.querySelectorAll(`#${id} .spend-opt`).forEach(b => {
    const on = b.dataset.budget === value;
    b.classList.toggle("active", on);
    b.setAttribute("aria-checked", on ? "true" : "false");
  });
}
function getSpendValue(id) {
  const b = document.querySelector(`#${id} .spend-opt.active`);
  return b ? b.dataset.budget : "medium";
}

// 만원 단위 입력 → 원 단위 { food, transport, lodging } (빈 칸은 제외)
function readBudgetInputs(prefix) {
  const plan = {};
  BUDGET_ITEMS.forEach(([k]) => {
    const v = parseFloat(document.getElementById(`${prefix}-${k}`).value);
    if (isFinite(v) && v > 0) plan[k] = Math.round(v * 10000);
  });
  return Object.keys(plan).length ? plan : undefined;
}
function fillBudgetInputs(prefix, plan) {
  BUDGET_ITEMS.forEach(([k]) => {
    const v = plan && plan[k] ? plan[k] / 10000 : "";
    document.getElementById(`${prefix}-${k}`).value = v === "" ? "" : Math.round(v * 10) / 10;
  });
  updateBudgetSum(prefix);
}
let budgetPeopleGetters = {};
function updateBudgetSum(prefix) {
  const plan = readBudgetInputs(prefix);
  const el = document.getElementById(`${prefix}-sum`);
  if (!el) return;
  if (!plan) {
    el.textContent = "";
    return;
  }
  const total = Object.values(plan).reduce((a, b) => a + b, 0);
  const people = budgetPeopleGetters[prefix] ? budgetPeopleGetters[prefix]() : 1;
  el.innerHTML = `합계 <strong>${formatManwon(total)}</strong>${people > 1 ? ` · 1인 ${formatManwon(total / people)}` : ""}`;
}
function setupBudgetInputs(prefix, getPeopleFn) {
  budgetPeopleGetters[prefix] = getPeopleFn;
  BUDGET_ITEMS.forEach(([k]) => {
    document.getElementById(`${prefix}-${k}`).addEventListener("input", () => updateBudgetSum(prefix));
  });
}
function formatManwon(won) {
  const m = won / 10000;
  return m >= 1 ? `${(Math.round(m * 10) / 10).toLocaleString()}만원` : formatWon(won);
}

function budgetCardHtml(t) {
  const c = getCategoryCosts(t);
  const plan = t.budgetPlan || {};
  const hasPlan = BUDGET_ITEMS.some(([k]) => plan[k] > 0);
  const row = (key, label, est, budget, note) => {
    const over = budget > 0 && est > budget;
    const pct = budget > 0 ? Math.min(100, Math.round((est / budget) * 100)) : 0;
    return `
      <div class="budget-row ${over ? "over" : ""}">
        <span class="b-label">${label}</span>
        <span class="b-values"><strong>${formatWon(est)}</strong>${budget > 0 ? `<span class="b-budget"> / ${formatWon(budget)}</span>` : ""}${note ? `<span class="b-note">${note}</span>` : ""}</span>
        ${budget > 0 ? `<span class="b-bar"><span style="width:${pct}%"></span></span>` : ""}
      </div>`;
  };
  const planTotal = BUDGET_ITEMS.reduce((s, [k]) => s + (plan[k] || 0), 0);
  // 예산을 정한 항목끼리만 합계 비교
  const estForPlanned = BUDGET_ITEMS.reduce((s, [k]) => s + (plan[k] > 0 ? c[k] : 0), 0);
  const overAll = hasPlan && estForPlanned > planTotal;
  const overItems = BUDGET_ITEMS.filter(([k]) => plan[k] > 0 && c[k] > plan[k]).map(([, label]) => label);
  const status = !hasPlan ? ""
    : overAll ? `<span class="b-status over">예산 ${formatWon(estForPlanned - planTotal)} 초과</span>`
    : overItems.length ? `<span class="b-status warn">${overItems.join("·")} 초과</span>`
    : `<span class="b-status ok">예산 안</span>`;
  return `
    <summary class="budget-head">
      <span class="b-sum">${window.icon("wallet", 16)}<strong>${formatWon(c.total)}</strong>${c.people > 1 ? `<small>${c.people}명 · 1인 ${formatWon(c.total / c.people)}</small>` : ""}</span>
      ${status}
      <span class="b-chevron">${window.icon("down", 16)}</span>
    </summary>
    <div class="budget-sub">
      <span>${SPEND_LABELS[t.budget] || "적당히"} · 일행 전체 예상</span>
      <button type="button" class="link-btn budget-edit" id="btn-edit-budget">${hasPlan ? "예산 수정" : "예산 정하기"}</button>
    </div>
    ${row("food", "식비", c.food, plan.food)}
    ${row("transport", "교통비", c.transport, plan.transport, c.transportIncomplete ? "이동 요금 정보 부족" : "")}
    ${row("lodging", "숙박비", c.lodging, plan.lodging)}
    ${c.other ? row("other", "기타 (입장료·쇼핑)", c.other, 0) : ""}

    ${hasPlan ? `<div class="budget-foot">정한 예산 ${formatWon(planTotal)} 중 ${formatWon(estForPlanned)} 예상${estForPlanned > planTotal ? ` · <b>${formatWon(estForPlanned - planTotal)} 초과</b>` : ` · ${formatWon(planTotal - estForPlanned)} 여유`}${overItems.length && !overAll ? ` (${overItems.join("·")}는 항목 예산 초과)` : ""}</div>` : ""}
  `;
}

function openBudgetModal() {
  const t = state.activeTrip;
  if (!t) return;
  setSpendValue("edit-spend-picker", t.budget || "medium");
  fillBudgetInputs("edit-budget", t.budgetPlan);
  document.getElementById("budget-modal-overlay").classList.add("active");
}

function setupBudgetModal() {
  const overlay = document.getElementById("budget-modal-overlay");
  setupSpendPicker("edit-spend-picker");
  setupBudgetInputs("edit-budget", () => getPeople(state.activeTrip));
  const close = () => overlay.classList.remove("active");
  document.getElementById("btn-close-budget").addEventListener("click", close);
  document.getElementById("btn-cancel-budget").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.getElementById("btn-confirm-budget").addEventListener("click", () => {
    const t = state.activeTrip;
    if (!t) return close();
    withUndo("예산을 저장했어요.", () => {
      t.budget = getSpendValue("edit-spend-picker");
      const plan = readBudgetInputs("edit-budget");
      if (plan) t.budgetPlan = plan;
      else delete t.budgetPlan;
    });
    close();
  });
}

// 여행 이동 수단 변경 → (AI 키가 있으면) 이동 방법·동선 다시 짜기
async function changeTripTransport(value) {
  const t = state.activeTrip;
  if (!t) return;
  const prev = t.transport || "auto";
  t.transport = value;
  persistActiveTrip();
  renderTripMeta();
  if (!window.RoutyAI.hasApiKey() || !t.places.length) {
    showToast(`이동 수단을 '${TRANSPORT_LABELS[value]}'(으)로 바꿨어요. 길찾기 링크에 반영돼요.`);
    return;
  }
  const ok = await uiConfirm(`이동 수단을 '${TRANSPORT_LABELS[value]}'(으)로 바꿨어요.\nAI가 이 기준으로 이동 방법과 동선을 다시 짜 드릴까요?`, { okText: "다시 짜기", cancelText: "설정만 바꾸기" });
  if (!ok) return;
  refineScope = "all";
  updateRefineScopeLabel();
  const input = document.getElementById("ai-refine-input");
  input.value = `이동 수단을 '${TRANSPORT_LABELS[value]}' 기준으로 바꿔 줘 (이전: ${TRANSPORT_LABELS[prev]}). 각 장소의 move(이동 방법·소요 시간)를 새로 정하고, 필요하면 동선과 시간도 조정해 줘.`;
  document.getElementById("ai-refine-form").requestSubmit();
}

function moveConnectorHtml(move) {
  if (!move || !move.mode) return "";
  const label = MOVE_LABELS[move.mode] || "이동";
  const mins = (move.minutes ? ` ${move.minutes}분` : "") + (move.cost ? ` · ${formatWon(move.cost)}${GROUP_MOVE_MODES.includes(move.mode) ? "" : "/인"}` : "");
  return `<div class="move-connector">${window.icon(MOVE_ICONS[move.mode] || "walk", 15)}<span class="move-main">${label}${mins}</span>${move.note ? `<span class="move-note">${esc(move.note)}</span>` : ""}</div>`;
}

async function deleteActiveDay() {
  const t = state.activeTrip;
  if (!t) return;
  if (t.days <= 1) {
    showToast("하루짜리 일정은 날짜를 삭제할 수 없어요.");
    return;
  }
  const d = state.activeTripDay;
  const count = t.places.filter(p => p.day === d).length;
  const ok = await uiConfirm(`Day ${d}${count ? `과 장소 ${count}곳` : ""}을(를) 삭제할까요? 이후 날짜는 하루씩 앞당겨져요.`, { okText: "삭제", danger: true });
  if (!ok) return;
  withUndo(`Day ${d}을(를) 삭제했습니다.`, () => {
    t.places = t.places.filter(p => p.day !== d);
    t.places.forEach(p => { if (p.day > d) p.day -= 1; });
    t.days -= 1;
    state.activeTripDay = Math.min(d, t.days);
  });
}

async function askDelay(placeId) {
  const place = state.activeTrip.places.find(p => p.id === placeId);
  if (!place) return;
  const v = await uiPrompt("얼마나 늦어졌나요? (분)", "30", { okText: "이후 일정 미루기", placeholder: "예: 30" });
  const min = parseInt(v, 10);
  if (!min) return;
  withUndo(`"${place.name}"부터 오늘 일정을 ${min}분 미뤘어요.`, () => shiftDayFrom(placeId, min));
}

// AI가 바꾼 장소 표시용
let recentlyChanged = new Set();
let refineScope = "day";

function updateRefineScopeLabel() {
  const btn = document.getElementById("btn-refine-scope");
  if (!btn || !state.activeTrip) return;
  btn.textContent = refineScope === "day" ? `Day ${state.activeTripDay}만` : "전체";
  btn.classList.toggle("is-all", refineScope === "all");
  const input = document.getElementById("ai-refine-input");
  input.placeholder = refineScope === "day"
    ? `Day ${state.activeTripDay} 수정 요청 (예: 오후는 실내 위주로)`
    : "전체 일정 수정 요청 (예: 하루 더 여유롭게)";
}

// --- AI 좌표 검증: OpenStreetMap에서 실제 위치를 찾아 크게 다르면 보정 ---
const verifyState = { tripId: null, done: 0, total: 0, fixed: 0, running: false };
const verifyQueue = [];

function distanceKm(a, b) {
  const R = 6371, toRad = (x) => x * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function medianCenter(places) {
  const pts = places.filter(p => !p.coordMissing);
  if (!pts.length) return null;
  const med = (arr) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
  return { lat: med(pts.map(p => p.lat)), lng: med(pts.map(p => p.lng)) };
}

function verifyCoordinates(tripId, placeIds) {
  if (!placeIds || !placeIds.length) return;
  placeIds.forEach(id => verifyQueue.push({ tripId, id }));
  if (verifyState.tripId !== tripId) Object.assign(verifyState, { tripId, done: 0, total: 0, fixed: 0 });
  verifyState.total += placeIds.length;
  renderVerifyStatus();
  if (!verifyState.running) runVerifyQueue();
}

function findTripById(tripId) {
  if (state.activeTrip && state.activeTrip.id === tripId) return state.activeTrip;
  return state.savedTrips.find(t => t.id === tripId) || null;
}

async function runVerifyQueue() {
  verifyState.running = true;
  while (verifyQueue.length) {
    const job = verifyQueue.shift();
    const trip = findTripById(job.tripId);
    const place = trip && trip.places.find(p => p.id === job.id);
    if (place && place.category !== "transit") {
      try {
        const center = medianCenter(trip.places) || { lat: place.lat, lng: place.lng };
        const query = place.searchName || place.name;
        const list = await window.RoutyAI.searchPlaces(query, center, { bounded: true, limit: 1 });
        const hit = list[0];
        if (hit) {
          const d = distanceKm({ lat: place.lat, lng: place.lng }, hit);
          if (place.coordMissing || (d > 0.7 && d < 40)) {
            place.lat = hit.lat;
            place.lng = hit.lng;
            place.coordMissing = false;
            place.coordFixed = true;
            verifyState.fixed++;
            if (state.activeTrip && state.activeTrip.id === trip.id) {
              updateMapMarkers();
              persistActiveTrip();
            } else {
              saveToLocalStorage();
            }
          }
        }
        place.coordChecked = true;
        if (state.activeTrip && state.activeTrip.id === trip.id) persistActiveTrip(); else saveToLocalStorage();
      } catch (e) { /* 검색 실패는 무시 (다음에 다시 시도) */ }
      await sleep(1100); // Nominatim 이용 정책: 초당 1회
    }
    verifyState.done++;
    renderVerifyStatus();
  }
  verifyState.running = false;
  renderVerifyStatus();
  if (state.activeTrip && state.activeTrip.id === verifyState.tripId) renderTimeline();
}

function renderVerifyStatus() {
  const el = document.getElementById("verify-status");
  if (!el) return;
  if (!state.activeTrip || verifyState.tripId !== state.activeTrip.id || !verifyState.total) {
    el.textContent = "";
    return;
  }
  el.textContent = verifyState.running
    ? `지도 위치 확인 중 ${verifyState.done}/${verifyState.total}`
    : verifyState.fixed ? `위치 확인 완료 · ${verifyState.fixed}곳 보정` : "";
}

// 지도 ↔ 목록 연동
let mapMarkersById = {};

function focusPlaceOnMap(placeId) {
  if (activeMapEngine === "naver") {
    const it = naverMarkers[placeId];
    if (it && naverMap) { naverMap.panTo(it.pos); showNaverInfo(placeId); }
    return;
  }
  if (activeMapEngine === "kakao") {
    const it = kakaoItems[placeId];
    if (it && kakaoMap) { kakaoMap.panTo(it.pos); showKakaoInfo(placeId); }
    return;
  }
  if (activeMapEngine === "ofm") {
    const it = ofmMarkers[placeId];
    if (it && ofmMap) {
      ofmMap.easeTo({ center: [it.place.lng, it.place.lat], duration: 400 });
      Object.values(ofmMarkers).forEach(m => { if (m !== it && m.marker.getPopup().isOpen()) m.marker.togglePopup(); });
      if (!it.marker.getPopup().isOpen()) it.marker.togglePopup();
    }
    return;
  }
  const m = mapMarkersById[placeId];
  if (!m || !leafletMap) return;
  leafletMap.panTo(m.getLatLng(), { animate: true });
  m.openPopup();
}

function focusPlaceCard(placeId) {
  const card = document.querySelector(`.timeline-item[data-place-id="${CSS.escape(placeId)}"]`);
  if (!card) return;
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.classList.add("is-focused");
  setTimeout(() => card.classList.remove("is-focused"), 1600);
}

function setupTitleRename() {
  const titleEl = document.getElementById("itinerary-title");
  titleEl.title = "눌러서 제목 바꾸기";
  titleEl.style.cursor = "pointer";
  titleEl.addEventListener("click", async () => {
    if (!state.activeTrip) return;
    const next = await uiPrompt("일정 제목", state.activeTrip.title, { okText: "변경" });
    if (next && next.trim()) {
      state.activeTrip.title = next.trim();
      titleEl.textContent = state.activeTrip.title;
      persistActiveTrip();
    }
  });
}

function renderItineraryAll() {
  document.getElementById("itinerary-title").textContent = state.activeTrip.title;
  renderTripMeta();
  renderDayTabs();
  renderTimeline();
  updateMapMarkers();
  updateSaveButton();
}

function showItineraryView() {
  if (!state.activeTrip) return;
  ensureTripShape(state.activeTrip);
  ensurePlacePrices(state.activeTrip);
  if (!isActiveTripSaved()) saveDraft();

  state.editMode = false;
  const toggleEditBtn = document.getElementById("btn-toggle-edit-mode");
  if (toggleEditBtn) {
    toggleEditBtn.classList.remove("active");
    toggleEditBtn.textContent = "편집";
  }
  // 이전 일정의 되돌리기 상태 초기화
  refineUndoTrip = null;
  recentlyChanged = new Set();
  setRefineMode("normal");
  if (state.activeTripDay > state.activeTrip.days) state.activeTripDay = 1;

  switchTab("itinerary");
  document.getElementById("itinerary-title").textContent = state.activeTrip.title;

  const btnToggleMap = document.getElementById("btn-toggle-map");
  const mapWrapper = document.getElementById("map-wrapper");
  if (btnToggleMap && mapWrapper) {
    mapWrapper.classList.remove("show-senior-map");
    btnToggleMap.classList.remove("active");
    btnToggleMap.textContent = "지도 보기";
  }

  setTimeout(() => {
    renderItineraryAll();
    // AI 일정 중 아직 위치 확인 안 된 장소가 있으면 이어서 확인
    const t = state.activeTrip;
    if (t && t.source === "ai") {
      const queued = new Set(verifyQueue.filter(j => j.tripId === t.id).map(j => j.id));
      const pending = t.places.filter(p => !p.coordChecked && p.category !== "transit" && !queued.has(p.id)).map(p => p.id);
      if (pending.length) verifyCoordinates(t.id, pending);
    }
  }, 100);
}

// --- Day Tabs Drag Scroll & Fade Masks ---
function setupDayTabsDragScroll() {
  const container = document.getElementById("day-tabs-container");
  if (!container) return;

  let isDown = false;
  let startX;
  let startY;
  let scrollLeft;
  let isDragging = false;

  // Update fade mask based on scroll position
  function updateFadeMasks() {
    const sLeft = container.scrollLeft;
    const maxScroll = container.scrollWidth - container.clientWidth;

    container.classList.remove("fade-left", "fade-right", "fade-both");

    if (maxScroll <= 5) {
      return; // 스크롤할 잔여 공간이 없으면 마스크 제외
    }

    if (sLeft > 8 && sLeft < maxScroll - 8) {
      container.classList.add("fade-both");
    } else if (sLeft > 8) {
      container.classList.add("fade-left");
    } else if (sLeft < maxScroll - 8) {
      container.classList.add("fade-right");
    }
  }

  container.addEventListener("mousedown", (e) => {
    isDown = true;
    startX = e.pageX - container.offsetLeft;
    startY = e.pageY - container.offsetTop;
    scrollLeft = container.scrollLeft;
  });

  container.addEventListener("mouseleave", () => {
    isDown = false;
  });

  container.addEventListener("mouseup", () => {
    isDown = false;
    // 클릭 이벤트 차단을 유지하기 위해 약간의 딜레이 후 플래그 리셋
    setTimeout(() => {
      isDragging = false;
    }, 20);
  });

  container.addEventListener("mousemove", (e) => {
    if (!isDown) return;
    const x = e.pageX - container.offsetLeft;
    const y = e.pageY - container.offsetTop;
    
    // 5px 이상 드래그 이동 시 드래그 동작으로 판정
    if (Math.abs(x - startX) > 5 || Math.abs(y - startY) > 5) {
      isDragging = true;
    }

    if (isDragging) {
      e.preventDefault();
      const walk = (x - startX) * 1.5;
      container.scrollLeft = scrollLeft - walk;
      updateFadeMasks();
    }
  });

  // Track standard wheel or swipe scrolling
  container.addEventListener("scroll", () => {
    updateFadeMasks();
  });

  // Handle click capture to prevent selecting tabs while dragging
  container.addEventListener("click", (e) => {
    if (isDragging) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true); // Capturing phase!

  // Expose masking functions for external renderer usage
  container.updateFadeMasks = updateFadeMasks;
}

// --- Day Tabs Render ---
function renderDayTabs() {
  const container = document.getElementById("day-tabs-container");
  if (!container) return;
  
  container.innerHTML = "";

  for (let d = 1; d <= state.activeTrip.days; d++) {
    const tab = document.createElement("div");
    const todayDay = getTodayDay(state.activeTrip);
    tab.className = `day-tab ${d === state.activeTripDay ? 'active' : ''} ${d === todayDay ? 'is-today' : ''}`;
    const tabDate = getTripDate(state.activeTrip, d);
    tab.innerHTML = tabDate ? `${d === todayDay ? "오늘" : `Day ${d}`}<small class="day-tab-date">${formatShortDate(tabDate)}</small>` : `Day ${d}`;
    tab.addEventListener("click", () => {
      state.activeTripDay = d;
      
      // Update Active state
      document.querySelectorAll(".day-tabs-slider .day-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      
      // Smoothly scroll active tab into view (centered horizontally) without moving other parent containers
      const targetScrollLeft = tab.offsetLeft - (container.clientWidth / 2) + (tab.clientWidth / 2);
      container.scrollTo({
        left: targetScrollLeft,
        behavior: 'smooth'
      });
      
      closeAddPlaceDrawer();
      renderTimeline();
      updateMapMarkers();
      const scroller = document.getElementById("itinerary-scroll");
      const sticky = document.querySelector(".day-tabs-sticky");
      if (scroller && sticky && scroller.scrollTop > sticky.offsetTop) scroller.scrollTop = sticky.offsetTop;
      
      // Update masks
      if (container.updateFadeMasks) {
        setTimeout(container.updateFadeMasks, 100);
      }
    });
    
    container.appendChild(tab);

    // Initial setup: focus on active day without animation delay
    if (d === state.activeTripDay) {
      setTimeout(() => {
        const targetScrollLeft = tab.offsetLeft - (container.clientWidth / 2) + (tab.clientWidth / 2);
        container.scrollTo({
          left: targetScrollLeft,
          behavior: 'auto'
        });
        if (container.updateFadeMasks) container.updateFadeMasks();
      }, 50);
    }
  }

  const addTab = document.createElement("div");
  addTab.className = "day-tab day-tab-add";
  addTab.setAttribute("aria-label", "하루 추가");
  addTab.innerHTML = `${window.icon("plus", 16)}<small class="day-tab-date">하루 추가</small>`;
  addTab.addEventListener("click", () => {
    withUndo(`Day ${state.activeTrip.days + 1}을(를) 추가했습니다.`, () => {
      state.activeTrip.days += 1;
      state.activeTripDay = state.activeTrip.days;
    });
  });
  container.appendChild(addTab);

  // Update dynamic fade masks after elements are populated
  setTimeout(() => {
    if (container.updateFadeMasks) container.updateFadeMasks();
  }, 100);
}

// --- Timeline Render (Schedules Lists) ---
function getTransitTips(placeName) {
  const name = placeName || '';
  if (name.includes("택시")) return "호출 앱(우버, 카카오T 등) 사용 권장";
  if (name.includes("지하철") || name.includes("메트로")) return "현지 교통카드 태그 또는 1회권 발권기 구매";
  if (name.includes("버스")) return "승차 시 교통카드를 태그하거나 잔돈을 준비하세요";
  if (name.includes("렌터카") || name.includes("차량")) return "국제운전면허증 지참 | 주차 사전 확인 권장";
  if (name.includes("도보")) return "가까운 도보 코스 | 편안한 신발 추천";
  return "";
}

// 비용: priceUnit "person"(1인당) / "group"(객실·택시 등 일행 전체)
function getPeople(trip) {
  return Math.max(1, parseInt(trip && trip.people, 10) || 1);
}

// 이동 요금: 택시·자가용·렌터카는 일행 전체, 그 외는 1인 요금
const GROUP_MOVE_MODES = ["car", "taxi"];

function placeGroupCost(p, people) {
  const v = p.price || 0;
  return p.priceUnit === "group" ? v : v * people;
}

function moveGroupCost(p, people) {
  if (!p.move || !p.move.cost) return 0;
  return GROUP_MOVE_MODES.includes(p.move.mode) ? p.move.cost : p.move.cost * people;
}

const COST_CATEGORY = { restaurant: "food", cafe: "food", hotel: "lodging", transit: "transport" };

// 항목별 예상 비용 (일행 전체 금액)
function getCategoryCosts(trip, day) {
  const people = getPeople(trip);
  const out = { food: 0, transport: 0, lodging: 0, other: 0 };
  let movesWithoutCost = 0, moves = 0;
  trip.places.filter(p => !day || p.day === day).forEach(p => {
    out[COST_CATEGORY[p.category] || "other"] += placeGroupCost(p, people);
    if (p.move) {
      moves++;
      if (p.move.cost === undefined && !["walk", "bike"].includes(p.move.mode)) movesWithoutCost++;
      out.transport += moveGroupCost(p, people);
    }
  });
  Object.keys(out).forEach(k => { out[k] = Math.round(out[k]); });
  out.total = out.food + out.transport + out.lodging + out.other;
  out.people = people;
  // 이동 정보가 없거나 요금이 빠진 이동이 많으면 교통비가 과소 추정됨
  out.transportIncomplete = moves === 0 || movesWithoutCost > moves / 2;
  return out;
}

function getTripCost(trip, day) {
  const c = getCategoryCosts(trip, day);
  return { total: c.total, perPerson: Math.round(c.total / c.people), people: c.people };
}

function getTripTotal(trip) {
  return getTripCost(trip).perPerson;
}

function formatWon(n) {
  return `₩${Math.round(n || 0).toLocaleString()}`;
}

function costLabel(trip, day) {
  const c = getTripCost(trip, day);
  return c.people > 1 ? `${c.people}명 총 ${formatWon(c.total)} · 1인 ${formatWon(c.perPerson)}` : `약 ${formatWon(c.total)}`;
}

function placePriceLabel(place, trip) {
  if (!place.price) return "무료";
  if (place.priceUnit === "group") return `${place.category === "hotel" ? "1박" : "일행"} ${formatWon(place.price)}`;
  return `${getPeople(trip) > 1 ? "1인 " : "약 "}${formatWon(place.price)}`;
}

// --- 시간 문자열 다루기 ---
function minutesToHHMM(min) {
  min = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function shiftTimeString(timeStr, delta) {
  const r = parseTimeRange(timeStr);
  if (!r) return timeStr;
  const hasEnd = ((timeStr || "").match(/\d{1,2}:\d{2}/g) || []).length > 1;
  return hasEnd ? `${minutesToHHMM(r[0] + delta)} - ${minutesToHHMM(r[1] + delta)}` : minutesToHHMM(r[0] + delta);
}

// 같은 날 이 장소부터 이후 일정 시간을 delta분 이동
function shiftDayFrom(placeId, delta) {
  const place = state.activeTrip.places.find(p => p.id === placeId);
  if (!place) return;
  const dayPlaces = state.activeTrip.places.filter(p => p.day === place.day);
  const startIdx = dayPlaces.indexOf(place);
  dayPlaces.slice(startIdx).forEach(p => {
    p.time = shiftTimeString(p.time, delta);
  });
}

function renderTimeline() {
  const container = document.getElementById("timeline-places-container");
  if (!container || !state.activeTrip) return;

  container.innerHTML = "";
  if (state.seniorMode) state.editMode = false;
  container.classList.toggle("edit-mode-active", !!state.editMode);
  updateRefineScopeLabel();
  renderTripMeta();
  renderNextUp();

  const dayPlaces = state.activeTrip.places.filter(p => p.day === state.activeTripDay);
  const next = getNextPlace(state.activeTrip, state.activeTripDay);

  if (dayPlaces.length === 0) {
    container.innerHTML = `<p class="empty-timeline-msg">이 날은 아직 일정이 없습니다. 아래에서 장소를 추가해 보세요.</p>`;
    return;
  }

  const dayHeader = document.createElement("div");
  dayHeader.className = "day-summary-line";
  const date = getTripDate(state.activeTrip, state.activeTripDay);
  dayHeader.textContent = `${date ? formatShortDate(date) + " · " : ""}${dayPlaces.length}곳 · ${costLabel(state.activeTrip, state.activeTripDay)}`;
  container.appendChild(dayHeader);

  dayPlaces.forEach((place, index) => {
    const card = document.createElement("div");
    card.className = "timeline-item";
    if (next && next.id === place.id) card.classList.add("is-next");
    const changed = recentlyChanged.has(place.id);
    if (changed) card.classList.add("is-changed");
    card.setAttribute("data-cat", place.category);
    card.setAttribute("data-place-id", place.id);

    const catKorean = CATEGORY_LABELS[place.category] || "관광";
    const id = esc(place.id);
    const isTransit = place.category === "transit";
    const tips = isTransit ? getTransitTips(place.name) : "";

    const priceHtml = `<span class="place-price-tag ${place.price ? "" : "free"}">${placePriceLabel(place, state.activeTrip)}</span>`;

    const searchLabel = place.category === "hotel" ? "숙소 검색" : place.category === "restaurant" || place.category === "cafe" ? "리뷰" : "정보";
    const coordWarn = place.coordMissing ? `<span class="coord-warn" title="정확한 위치가 지정되지 않았어요. 편집에서 위치를 찾아주세요.">위치 미지정</span>` : "";

    if (state.seniorMode) {
      const controlsHtml = `
        <button class="btn-ctrl btn-senior-link" data-action="map" data-id="${id}">지도에서 보기</button>
        ${isTransit ? "" : `<button class="btn-ctrl btn-senior-link" data-action="search" data-id="${id}">${searchLabel} 검색</button>`}
        <button class="btn-ctrl btn-senior-edit" data-action="edit" data-id="${id}">편집하기</button>
        <button class="btn-ctrl btn-delete" data-action="delete" data-id="${id}">장소 삭제하기</button>
      `;
      card.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-header-row">
          <span class="time-badge">${esc(place.time)}</span>
          <span class="place-cat-badge cat-${esc(place.category)}">${catKorean}</span>
          ${priceHtml}
        </div>
        <div class="place-name">${index + 1}. ${esc(place.name)}</div>
        <div class="click-guide">눌러서 자세히 보기</div>
      `;
      const tipsHtml = tips ? `<div class="transit-guide-box"><div class="guide-tips">${tips}</div></div>` : "";
      card.onclick = () => openSeniorDetailModal(place, index, catKorean, tipsHtml, controlsHtml);
    } else {
      card.onclick = (e) => {
        if (e.target.closest("button, a, input")) return;
        focusPlaceOnMap(place.id);
      };
      card.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-item-header">
          <span class="timeline-time">${index + 1} · ${esc(place.time)} · ${catKorean}${changed ? ` <em class="changed-badge">AI 변경</em>` : ""}${place.coordFixed ? ` <em class="fixed-badge" title="지도 데이터로 위치를 보정했어요">위치 보정</em>` : ""}</span>
          <span class="timeline-place-name">${esc(place.name)}</span>
          ${priceHtml}
        </div>
        ${place.description ? `<p class="timeline-desc">${esc(place.description)}</p>` : ""}
        ${tips ? `<p class="timeline-desc transit-tip">${tips}</p>` : ""}
        ${coordWarn ? `<div>${coordWarn}</div>` : ""}
        <div class="timeline-actions">
          <button class="chip-btn chip-primary" data-action="map" data-id="${id}">${window.icon("map", 16)}지도</button>
          ${isTransit ? "" : `<button class="chip-btn" data-action="search" data-id="${id}">${window.icon("search", 16)}${searchLabel}</button>`}
          <button class="chip-btn" data-action="edit" data-id="${id}">${window.icon("pencil", 16)}편집</button>
          <span class="edit-only-actions">
            <button class="chip-btn chip-icon" data-action="up" data-id="${id}" ${index === 0 ? "disabled" : ""} aria-label="위로">${window.icon("up", 18)}</button>
            <button class="chip-btn chip-icon" data-action="down" data-id="${id}" ${index === dayPlaces.length - 1 ? "disabled" : ""} aria-label="아래로">${window.icon("down", 18)}</button>
            <button class="chip-btn chip-icon chip-danger" data-action="delete" data-id="${id}" aria-label="삭제">${window.icon("trash", 18)}</button>
          </span>
        </div>
      `;
    }

    if (index > 0 && place.move) {
      const conn = document.createElement("div");
      conn.innerHTML = moveConnectorHtml(place.move);
      if (conn.firstElementChild) container.appendChild(conn.firstElementChild);
    }
    container.appendChild(card);
  });
}

// --- Leaflet Map Engine ---
function initLeafletMap() {
  const mapContainer = document.getElementById("map");
  if (!mapContainer || typeof L === "undefined") return;

  // If map already initialized, just return
  if (leafletMap !== null) {
    // Force leaflet map resize calculation
    leafletMap.invalidateSize();
    return;
  }

  // Setup leaflet map
  leafletMap = L.map("map", {
    zoomControl: false,
    attributionControl: false
  }).setView([37.5665, 126.9780], 13); // Default view Seoul

  // Add customized Map tiles based on current theme
  const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
  const tileUrl = currentTheme === "dark"
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  mapTileLayer = L.tileLayer(tileUrl, {
    maxZoom: 19
  }).addTo(leafletMap);

  // Setup layer groups
  mapMarkersGroup = L.layerGroup().addTo(leafletMap);
}

// --- 지도 엔진 ---
// 국내 일정: 네이버(키 있음) → 카카오(키 있음) → OpenFreeMap → 기본(Leaflet)
// 해외 일정: OpenFreeMap → 기본(Leaflet)
// 불러오기에 실패한 엔진은 이번 실행 동안 건너뛰고 다음 엔진으로 자동 대체
const MAPLIBRE_JS = "https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js";
const MAPLIBRE_CSS = "https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css";
const OFM_STYLE = { light: "https://tiles.openfreemap.org/styles/positron", dark: "https://tiles.openfreemap.org/styles/dark" };
const ENGINE_LABEL = { naver: "네이버 지도", kakao: "카카오맵", ofm: "OpenFreeMap", leaflet: "기본 지도" };

let activeMapEngine = null;
const failedEngines = new Set();
const scriptPromises = {};
let mapRenderSeq = 0;

function isDomesticTrip(trip) {
  const pts = (trip.places || []).filter(p => !p.coordMissing);
  if (!pts.length) return false;
  const inKorea = pts.filter(p => isInKorea(p.lat, p.lng)).length;
  return inKorea / pts.length >= 0.6;
}

function engineCandidates() {
  const s = window.RoutyAI.getSettings();
  const list = [];
  if (state.activeTrip && isDomesticTrip(state.activeTrip)) {
    if (s.naverKey) list.push("naver");
    if (s.kakaoKey) list.push("kakao");
  }
  list.push("ofm", "leaflet");
  return list.filter(e => !failedEngines.has(e));
}

function loadScriptOnce(id, url, isReady, timeoutMs = 12000) {
  if (isReady()) return Promise.resolve();
  if (scriptPromises[id]) return scriptPromises[id];
  scriptPromises[id] = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = url;
    s.async = true;
    const timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
    s.onload = () => { clearTimeout(timer); isReady() ? resolve() : reject(new Error("not ready")); };
    s.onerror = () => { clearTimeout(timer); reject(new Error("load")); };
    document.head.appendChild(s);
  }).catch(err => {
    delete scriptPromises[id];
    throw err;
  });
  return scriptPromises[id];
}

function markEngineFailed(engine, notify) {
  if (failedEngines.has(engine)) return;
  failedEngines.add(engine);
  if (notify) {
    const fb = engineCandidates()[0];
    const OBJ = { naver: "네이버 지도를", kakao: "카카오맵을", ofm: "OpenFreeMap을", leaflet: "기본 지도를" };
    const TO = { naver: "네이버 지도로", kakao: "카카오맵으로", ofm: "OpenFreeMap으로", leaflet: "기본 지도로" };
    showToast(`${OBJ[engine]} 불러오지 못해 ${TO[fb]} 표시합니다.${engine === "naver" || engine === "kakao" ? " 설정의 키와 등록 주소를 확인해 주세요." : ""}`, 5000);
  }
  if (state.activeTab === "itinerary") updateMapMarkers();
}

function showMapEngine(engine) {
  activeMapEngine = engine;
  const ids = { naver: "naver-map", kakao: "kakao-map", ofm: "ofm-map", leaflet: "map" };
  Object.entries(ids).forEach(([e, id]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = e === engine ? "" : "none";
  });
  const credit = document.getElementById("map-engine-credit");
  if (credit) credit.textContent = engine === "kakao" ? "카카오맵" : "";
}

function refreshMapSize() {
  if (activeMapEngine === "naver" && naverMap) {
    const el = document.getElementById("naver-map");
    naverMap.setSize(new window.naver.maps.Size(el.clientWidth, el.clientHeight));
  } else if (activeMapEngine === "kakao" && kakaoMap) kakaoMap.relayout();
  else if (activeMapEngine === "ofm" && ofmMap) ofmMap.resize();
  else if (leafletMap) leafletMap.invalidateSize();
}

function dayPlacesForMap() {
  const dayPlaces = state.activeTrip.places.filter(p => p.day === state.activeTripDay);
  const ind = document.getElementById("map-day-indicator");
  if (ind) ind.textContent = `Day ${state.activeTripDay} · ${dayPlaces.length}곳`;
  return dayPlaces;
}

function markerElement(place, index) {
  let cls = "map-number-marker";
  if (place.category === "hotel") cls += " hotel";
  else if (place.category === "transit") cls += " transit";
  const el = document.createElement("div");
  el.className = `${cls} js-map-marker`;
  el.textContent = String(index + 1);
  return el;
}

function popupHtml(place, index) {
  return `<div class="map-info"><strong>${index + 1}. ${esc(place.name)}</strong><span>${esc(place.time)}</span></div>`;
}

function updateMapMarkers() {
  if (!state.activeTrip) return;
  const seq = ++mapRenderSeq;
  const engine = engineCandidates()[0];
  const renderers = { naver: renderNaver, kakao: renderKakao, ofm: renderOfm, leaflet: renderLeaflet };
  Promise.resolve()
    .then(() => renderers[engine](seq))
    .catch(err => {
      console.warn(`[map] ${engine} 실패`, err);
      if (engine === "leaflet") return;
      markEngineFailed(engine, true);
    });
}

// ---------- 네이버 ----------
let naverMap = null;
let naverMarkers = {};
let naverLine = null;
let naverInfo = null;

async function renderNaver(seq) {
  const key = window.RoutyAI.getSettings().naverKey;
  window.navermap_authFailure = () => markEngineFailed("naver", true);
  await loadScriptOnce("naver", `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(key)}`,
    () => !!(window.naver && window.naver.maps && window.naver.maps.Map));
  if (seq !== mapRenderSeq) return;
  const nm = window.naver.maps;
  showMapEngine("naver");
  const el = document.getElementById("naver-map");
  if (!naverMap) {
    naverMap = new nm.Map(el, {
      center: new nm.LatLng(37.5665, 126.978),
      zoom: 12,
      zoomControl: false,
      mapDataControl: false,
      scaleControl: false
    });
  } else {
    refreshMapSize();
  }
  Object.values(naverMarkers).forEach(m => m.marker.setMap(null));
  naverMarkers = {};
  if (naverLine) { naverLine.setMap(null); naverLine = null; }
  if (naverInfo) { naverInfo.close(); naverInfo = null; }

  const dayPlaces = dayPlacesForMap();
  if (!dayPlaces.length) return;
  const path = [];
  dayPlaces.forEach((place, index) => {
    const pos = new nm.LatLng(place.lat, place.lng);
    path.push(pos);
    const marker = new nm.Marker({
      position: pos,
      map: naverMap,
      icon: { content: markerElement(place, index).outerHTML, anchor: new nm.Point(13, 13) }
    });
    nm.Event.addListener(marker, "click", () => {
      showNaverInfo(place.id);
      focusPlaceCard(place.id);
    });
    naverMarkers[place.id] = { marker, place, index, pos };
  });
  if (path.length > 1) {
    naverLine = new nm.Polyline({ map: naverMap, path, strokeColor: "#6366f1", strokeWeight: 3, strokeOpacity: 0.8, strokeStyle: "shortdash" });
    const bounds = new nm.LatLngBounds(path[0], path[0]);
    path.forEach(p => bounds.extend(p));
    naverMap.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
  } else {
    naverMap.setCenter(path[0]);
    naverMap.setZoom(15);
  }
}

function showNaverInfo(placeId) {
  const item = naverMarkers[placeId];
  if (!item) return;
  const nm = window.naver.maps;
  if (naverInfo) naverInfo.close();
  naverInfo = new nm.InfoWindow({
    content: popupHtml(item.place, item.index),
    borderWidth: 0,
    backgroundColor: "transparent",
    disableAnchor: true,
    pixelOffset: new nm.Point(0, -16)
  });
  naverInfo.open(naverMap, item.marker);
}

// ---------- 카카오 ----------
let kakaoMap = null;
let kakaoItems = {};
let kakaoRouteLine = null;
let kakaoInfoOverlay = null;

async function renderKakao(seq) {
  const key = window.RoutyAI.getSettings().kakaoKey;
  await loadScriptOnce("kakao", `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`,
    () => !!(window.kakao && window.kakao.maps && window.kakao.maps.load));
  await new Promise(r => window.kakao.maps.load(r));
  if (seq !== mapRenderSeq) return;
  const km = window.kakao.maps;
  showMapEngine("kakao");
  const el = document.getElementById("kakao-map");
  if (!kakaoMap) kakaoMap = new km.Map(el, { center: new km.LatLng(37.5665, 126.978), level: 6 });
  else kakaoMap.relayout();
  Object.values(kakaoItems).forEach(i => i.overlay.setMap(null));
  kakaoItems = {};
  if (kakaoRouteLine) { kakaoRouteLine.setMap(null); kakaoRouteLine = null; }
  if (kakaoInfoOverlay) { kakaoInfoOverlay.setMap(null); kakaoInfoOverlay = null; }

  const dayPlaces = dayPlacesForMap();
  if (!dayPlaces.length) return;
  const bounds = new km.LatLngBounds();
  const path = [];
  dayPlaces.forEach((place, index) => {
    const pos = new km.LatLng(place.lat, place.lng);
    path.push(pos);
    bounds.extend(pos);
    const el2 = markerElement(place, index);
    el2.addEventListener("click", () => {
      showKakaoInfo(place.id);
      focusPlaceCard(place.id);
    });
    const overlay = new km.CustomOverlay({ position: pos, content: el2, xAnchor: 0.5, yAnchor: 0.5, clickable: true, zIndex: 3 });
    overlay.setMap(kakaoMap);
    kakaoItems[place.id] = { overlay, place, index, pos };
  });
  if (path.length > 1) {
    kakaoRouteLine = new km.Polyline({ path, strokeWeight: 3, strokeColor: "#6366f1", strokeOpacity: 0.8, strokeStyle: "shortdash" });
    kakaoRouteLine.setMap(kakaoMap);
    kakaoMap.setBounds(bounds, 40, 40, 40, 40);
  } else {
    kakaoMap.setCenter(path[0]);
    kakaoMap.setLevel(4);
  }
}

function showKakaoInfo(placeId) {
  const item = kakaoItems[placeId];
  if (!item) return;
  const km = window.kakao.maps;
  if (kakaoInfoOverlay) kakaoInfoOverlay.setMap(null);
  const box = document.createElement("div");
  box.innerHTML = popupHtml(item.place, item.index);
  kakaoInfoOverlay = new km.CustomOverlay({ position: item.pos, content: box.firstElementChild, xAnchor: 0.5, yAnchor: 1.7, zIndex: 5 });
  kakaoInfoOverlay.setMap(kakaoMap);
}

// ---------- OpenFreeMap (MapLibre) ----------
let ofmMap = null;
let ofmMarkers = {};
let ofmStyleReady = null;
let ofmRouteCoords = [];

function loadMaplibre() {
  if (!document.getElementById("maplibre-css")) {
    const link = document.createElement("link");
    link.id = "maplibre-css";
    link.rel = "stylesheet";
    link.href = MAPLIBRE_CSS;
    document.head.appendChild(link);
  }
  return loadScriptOnce("maplibre", MAPLIBRE_JS, () => !!window.maplibregl, 15000);
}

function currentOfmStyle() {
  return (document.documentElement.getAttribute("data-theme") === "dark") ? OFM_STYLE.dark : OFM_STYLE.light;
}

// 지명을 한국어로 (한국어 이름이 없으면 현지 이름)
function applyKoreanLabels(map) {
  const style = map.getStyle();
  (style.layers || []).forEach(layer => {
    if (layer.type !== "symbol" || !layer.layout || !layer.layout["text-field"]) return;
    const tf = JSON.stringify(layer.layout["text-field"]);
    if (!/name/.test(tf) || /housenumber|"ref"|\{ref\}/.test(tf)) return;
    try {
      map.setLayoutProperty(layer.id, "text-field", ["coalesce", ["get", "name:ko"], ["get", "name"]]);
    } catch (e) { /* 일부 레이어는 무시 */ }
  });
}

function addOfmRouteLayer(map) {
  if (map.getSource("routy-route")) return;
  map.addSource("routy-route", { type: "geojson", data: { type: "Feature", geometry: { type: "LineString", coordinates: ofmRouteCoords } } });
  map.addLayer({
    id: "routy-route",
    type: "line",
    source: "routy-route",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": "#6366f1", "line-width": 3, "line-opacity": 0.85, "line-dasharray": [1.5, 2] }
  });
}

async function renderOfm(seq) {
  await loadMaplibre();
  if (seq !== mapRenderSeq) return;
  const ml = window.maplibregl;
  showMapEngine("ofm");
  if (!ofmMap) {
    ofmMap = new ml.Map({
      container: "ofm-map",
      style: currentOfmStyle(),
      center: [126.978, 37.5665],
      zoom: 11,
      attributionControl: { compact: true }
    });
    ofmMap.on("style.load", () => {
      applyKoreanLabels(ofmMap);
      addOfmRouteLayer(ofmMap);
    });
    ofmStyleReady = new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("style timeout")), 12000);
      ofmMap.once("load", () => { clearTimeout(t); resolve(); });
    });
  } else {
    ofmMap.resize();
  }
  await ofmStyleReady;
  if (seq !== mapRenderSeq) return;

  Object.values(ofmMarkers).forEach(m => m.marker.remove());
  ofmMarkers = {};
  const dayPlaces = dayPlacesForMap();
  ofmRouteCoords = dayPlaces.map(p => [p.lng, p.lat]);
  const src = ofmMap.getSource("routy-route");
  if (src) src.setData({ type: "Feature", geometry: { type: "LineString", coordinates: dayPlaces.length > 1 ? ofmRouteCoords : [] } });
  if (!dayPlaces.length) return;

  const bounds = new ml.LngLatBounds();
  dayPlaces.forEach((place, index) => {
    const el = markerElement(place, index);
    const popup = new ml.Popup({ closeButton: false, offset: 16, className: "ofm-popup" }).setHTML(popupHtml(place, index));
    const marker = new ml.Marker({ element: el }).setLngLat([place.lng, place.lat]).setPopup(popup).addTo(ofmMap);
    el.addEventListener("click", () => focusPlaceCard(place.id));
    ofmMarkers[place.id] = { marker, place };
    bounds.extend([place.lng, place.lat]);
  });
  if (dayPlaces.length > 1) ofmMap.fitBounds(bounds, { padding: 50, maxZoom: 15, duration: 0 });
  else ofmMap.jumpTo({ center: [dayPlaces[0].lng, dayPlaces[0].lat], zoom: 15 });
}

function setOfmTheme() {
  if (ofmMap) ofmMap.setStyle(currentOfmStyle());
}

// ---------- 기본 지도 (Leaflet) ----------
async function renderLeaflet() {
  showMapEngine("leaflet");
  if (!leafletMap) initLeafletMap();
  else leafletMap.invalidateSize();
  updateLeafletMarkers();
}

function updateLeafletMarkers() {
  if (!leafletMap || !mapMarkersGroup || !state.activeTrip) return;

  // Clear previous layers
  mapMarkersGroup.clearLayers();
  mapMarkersById = {};
  if (mapRouteLine) {
    leafletMap.removeLayer(mapRouteLine);
    mapRouteLine = null;
  }

  const dayPlaces = state.activeTrip.places.filter(p => p.day === state.activeTripDay);
  
  // Set day header
  document.getElementById("map-day-indicator").textContent = `Day ${state.activeTripDay} · ${dayPlaces.length}곳`;

  if (dayPlaces.length === 0) return;

  const coordinates = [];

  // Draw markers
  dayPlaces.forEach((place, index) => {
    coordinates.push([place.lat, place.lng]);

    // Create custom numbered HTML marker icon
    let markerClass = "map-number-marker";
    if (place.category === "hotel") markerClass += " hotel";
    else if (place.category === "transit") markerClass += " transit";

    const customIcon = L.divIcon({
      html: `<div class="${markerClass}">${index + 1}</div>`,
      className: "custom-leaflet-icon",
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });

    // Create leaflet marker
    const marker = L.marker([place.lat, place.lng], { icon: customIcon });
    
    // Add custom styled popup
    marker.bindPopup(`
      <div class="map-popup-title">
        ${index + 1}. ${esc(place.name)}
      </div>
      <div class="map-popup-time">${esc(place.time)}</div>
    `, {
      closeButton: false,
      className: "custom-map-popup"
    });

    marker.on("click", () => focusPlaceCard(place.id));
    mapMarkersById[place.id] = marker;
    mapMarkersGroup.addLayer(marker);
  });

  // Fit boundaries containing markers
  if (coordinates.length > 0) {
    const bounds = L.latLngBounds(coordinates);
    leafletMap.fitBounds(bounds, { padding: [40, 40] });

    // Draw connecting route line
    if (coordinates.length > 1) {
      mapRouteLine = L.polyline(coordinates, {
        color: '#6366f1',
        weight: 3,
        opacity: 0.8,
        dashArray: '5, 8',
        lineJoin: 'round'
      }).addTo(leafletMap);
    }
  }
}

function setupSeniorDetailModal() {
  const overlay = document.getElementById("senior-detail-modal-overlay");
  const closeBtn = document.getElementById("btn-senior-modal-close");
  
  if (!overlay || !closeBtn) return;

  closeBtn.addEventListener("click", () => {
    closeSeniorDetailModal();
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeSeniorDetailModal();
    }
  });
}

window.openSeniorDetailModal = function(place, index, catKorean, transitGuideHtml, controlsHtml) {
  const overlay = document.getElementById("senior-detail-modal-overlay");
  const timeEl = document.getElementById("senior-modal-time");
  const catEl = document.getElementById("senior-modal-cat");
  const priceEl = document.getElementById("senior-modal-price");
  const titleEl = document.getElementById("senior-modal-title");
  const descEl = document.getElementById("senior-modal-description");
  const transitEl = document.getElementById("senior-modal-transit-box");
  const controlsEl = document.getElementById("senior-modal-controls");

  if (!overlay) return;

  if (timeEl) timeEl.textContent = place.time;
  if (catEl) {
    catEl.className = `senior-modal-cat cat-${place.category}`;
    catEl.innerText = catKorean;
  }
  if (priceEl) {
    const isFree = !place.price;
    priceEl.className = `senior-modal-price-badge ${isFree ? 'free' : ''}`;
    priceEl.innerText = isFree ? '비용: 무료' : `1인 약 ₩${(place.price || 0).toLocaleString()}`;
  }
  if (titleEl) titleEl.innerText = `${index + 1}. ${place.name}`;
  
  if (descEl) {
    if (place.description) {
      descEl.style.display = "block";
      descEl.innerHTML = `<p class="place-description">${esc(place.description)}</p>`;
    } else {
      descEl.style.display = "none";
    }
  }

  if (transitEl) {
    if (transitGuideHtml) {
      transitEl.style.display = "block";
      transitEl.innerHTML = transitGuideHtml;
    } else {
      transitEl.style.display = "none";
    }
  }

  if (controlsEl) {
    controlsEl.innerHTML = controlsHtml;
  }

  overlay.classList.add("active");
};

window.closeSeniorDetailModal = function() {
  const overlay = document.getElementById("senior-detail-modal-overlay");
  if (overlay) {
    overlay.classList.remove("active");
  }
};


// --- Saved Trips tab render ---
function renderSavedTrips() {
  const container = document.getElementById("saved-trips-list");
  if (!container) return;
  container.innerHTML = "";

  if (state.savedTrips.length === 0) {
    container.innerHTML = `
      <div class="empty-logs" style="padding: 40px 10px;">
        <span style="display:block; margin-bottom:12px; color: var(--text-muted);">${window.icon("calendar", 36)}</span>
        <p>저장된 여행 일정이 없습니다.</p>
        <p style="font-size:11px; margin-top:4px;">AI 플래너로 첫 여행 계획을 세워보세요.</p>
      </div>
    `;
    return;
  }

  // 다가오는 여행 → 날짜 미정 → 지난 여행 순
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rank = (t) => {
    const end = getTripDate(t, t.days);
    if (!end) return 1;
    return end >= today ? 0 : 2;
  };
  const sorted = state.savedTrips.slice().sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra === 0) return (a.startDate || "").localeCompare(b.startDate || "");
    if (ra === 2) return (b.startDate || "").localeCompare(a.startDate || "");
    return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
  });

  sorted.forEach(trip => {
    const card = document.createElement("div");
    card.className = "saved-trip-item";
    if (rank(trip) === 2) card.classList.add("is-past");

    const start = getTripDate(trip, 1);
    let when = `${trip.days}일 코스`;
    if (start) {
      const diff = Math.round((start - today) / 86400000);
      const dday = diff > 0 ? `D-${diff}` : diff === 0 ? "D-DAY" : rank(trip) === 0 ? "여행 중" : "다녀옴";
      when = `${formatShortDate(start)} 출발 · ${trip.days}일 · <strong class="dday">${dday}</strong>`;
    }

    card.innerHTML = `
      <div class="saved-trip-info">
        <h3>${esc(trip.title)}</h3>
        <p>${esc(trip.destination)} · ${when}</p>
        <p class="saved-trip-sub">${(trip.places || []).length}곳 · ${costLabel(trip)}</p>
      </div>
      <button class="btn-ctrl btn-delete" style="padding:8px 12px; font-size:12px;">삭제</button>
    `;
    card.querySelector(".saved-trip-info").addEventListener("click", () => loadSavedTrip(trip.id));
    card.querySelector(".btn-delete").addEventListener("click", () => deleteSavedTrip(trip.id));
    container.appendChild(card);
  });
}

window.loadSavedTrip = function(tripId) {
  const trip = state.savedTrips.find(t => t.id === tripId);
  if (!trip) return;
  state.activeTrip = cloneTrip(trip);
  state.activeTripDay = getTodayDay(state.activeTrip) || 1;
  showItineraryView();
};

window.deleteSavedTrip = async function(tripId) {
  const index = state.savedTrips.findIndex(t => t.id === tripId);
  if (index < 0) return;
  const trip = state.savedTrips[index];
  if (!(await uiConfirm(`"${trip.title}" 일정을 삭제할까요?`, { okText: "삭제", danger: true }))) return;
  state.savedTrips.splice(index, 1);
  saveToLocalStorage();
  renderSavedTrips();
  showToast(`"${trip.title}" 일정을 삭제했습니다.`, 6000, {
    label: "되돌리기",
    onClick: () => {
      state.savedTrips.splice(Math.min(index, state.savedTrips.length), 0, trip);
      saveToLocalStorage();
      renderSavedTrips();
    }
  });
};

// --- Senior Mode Setup & Management ---
function setupSeniorMode() {
  const toggleBtn = document.getElementById("btn-header-senior");
  const desktopToggleBtn = document.getElementById("btn-desktop-senior");
  const deviceWrapper = document.getElementById("device-wrapper");
  const btnToggleMap = document.getElementById("btn-toggle-map");
  const mapWrapper = document.getElementById("map-wrapper");

  if (!deviceWrapper) return;

  // Apply step classes on load (isInitial = true)
  applyFontSizeStep(toggleBtn, desktopToggleBtn, deviceWrapper, true);

  const handleSeniorToggle = () => {
    state.fontSizeStep = (state.fontSizeStep + 1) % 5;
    state.seniorMode = state.fontSizeStep > 0;
    
    saveToLocalStorage();
    applyFontSizeStep(toggleBtn, desktopToggleBtn, deviceWrapper, false);

    // Re-render templates list to apply description toggling
    renderTemplates();

    // Re-render timeline if on itinerary tab
    if (state.activeTab === "itinerary" && state.activeTrip) {
      renderTimeline();
      updateMapMarkers();
      
      // Reset map toggles on switching modes
      if (btnToggleMap && mapWrapper) {
        mapWrapper.classList.remove("show-senior-map");
        btnToggleMap.classList.remove("active");
        btnToggleMap.textContent = "지도 보기";
      }
    }
  };

  if (toggleBtn) toggleBtn.addEventListener("click", handleSeniorToggle);
  if (desktopToggleBtn) desktopToggleBtn.addEventListener("click", handleSeniorToggle);

  // Map toggle button listener (Senior Mode only)
  if (btnToggleMap && mapWrapper) {
    btnToggleMap.addEventListener("click", () => {
      const isShowing = mapWrapper.classList.toggle("show-senior-map");
      btnToggleMap.classList.toggle("active", isShowing);
      
      if (isShowing) {
        btnToggleMap.textContent = "지도 숨기기";
        setTimeout(refreshMapSize, 150);
      } else {
        btnToggleMap.textContent = "지도 보기";
      }
    });
  }
}

function applyFontSizeStep(toggleBtn, desktopToggleBtn, deviceWrapper, isInitial = false) {
  // Reset all class variations
  deviceWrapper.classList.remove("senior-mode", "senior-mode-xl", "senior-mode-xxl", "senior-mode-xxxl");
  if (toggleBtn) toggleBtn.classList.remove("active");
  if (desktopToggleBtn) desktopToggleBtn.classList.remove("active");

  let buttonText = "글자";
  let toastMsg = "";

  if (state.fontSizeStep === 0) {
    buttonText = "글자";
    if (!isInitial) toastMsg = "일반 글자 크기로 전환되었습니다.";
  } else if (state.fontSizeStep === 1) {
    deviceWrapper.classList.add("senior-mode");
    if (toggleBtn) toggleBtn.classList.add("active");
    if (desktopToggleBtn) desktopToggleBtn.classList.add("active");
    buttonText = "크게";
    if (!isInitial) toastMsg = "큰 글자 크기로 전환되었습니다.";
  } else if (state.fontSizeStep === 2) {
    deviceWrapper.classList.add("senior-mode", "senior-mode-xl");
    if (toggleBtn) toggleBtn.classList.add("active");
    if (desktopToggleBtn) desktopToggleBtn.classList.add("active");
    buttonText = "아주 크게";
    if (!isInitial) toastMsg = "아주 큰 글자 크기로 전환되었습니다.";
  } else if (state.fontSizeStep === 3) {
    deviceWrapper.classList.add("senior-mode", "senior-mode-xl", "senior-mode-xxl");
    if (toggleBtn) toggleBtn.classList.add("active");
    if (desktopToggleBtn) desktopToggleBtn.classList.add("active");
    buttonText = "더 크게";
    if (!isInitial) toastMsg = "더 큰 글자 크기로 전환되었습니다.";
  } else if (state.fontSizeStep === 4) {
    deviceWrapper.classList.add("senior-mode", "senior-mode-xl", "senior-mode-xxl", "senior-mode-xxxl");
    if (toggleBtn) toggleBtn.classList.add("active");
    if (desktopToggleBtn) desktopToggleBtn.classList.add("active");
    buttonText = "가장 크게";
    if (!isInitial) toastMsg = "가장 큰 글자 크기로 전환되었습니다.";
  }

  const sizeHtml = `${window.icon("textsize", 18)}<span>${buttonText}</span>`;
  if (toggleBtn) toggleBtn.innerHTML = sizeHtml;
  if (desktopToggleBtn) desktopToggleBtn.innerHTML = sizeHtml;
  if (!isInitial && toastMsg) showToast(toastMsg);

}

// ==========================================
// --- Confirmation Screen & Collaborations Functions ---
// ==========================================

function triggerConfetti() {
  const container = document.getElementById("confetti-container");
  if (!container) return;
  container.innerHTML = "";
  
  const colors = [
    "var(--primary-solid)",
    "#10B981", // green
    "#F59E0B", // amber
    "#EF4444", // red
    "#3B82F6", // blue
    "#EC4899", // pink
    "#8B5CF6"  // purple
  ];
  
  for (let i = 0; i < 45; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "%";
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = Math.random() * 1.5 + "s";
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    container.appendChild(piece);
  }
}

function setupConfirmationScreen() {
  const btnPdf = document.getElementById("btn-action-pdf");
  const btnShare = document.getElementById("btn-action-share");
  const btnCalendar = document.getElementById("btn-action-calendar");
  const btnChecklist = document.getElementById("btn-action-checklist");
  const btnOffline = document.getElementById("btn-action-offline");
  const btnViewTrips = document.getElementById("btn-action-viewtrips");
  const btnOk = document.getElementById("btn-confirmation-ok");

  if (btnPdf) btnPdf.addEventListener("click", () => openPdfPreview());
  if (btnShare) btnShare.addEventListener("click", () => shareItinerary());
  if (btnCalendar) btnCalendar.addEventListener("click", () => downloadCalendarIcs());
  if (btnChecklist) btnChecklist.addEventListener("click", () => openChecklistModal());
  if (btnOffline) btnOffline.addEventListener("click", () => downloadOfflineTxt());
  if (btnViewTrips) btnViewTrips.addEventListener("click", () => {
    switchTab("trips");
    renderSavedTrips();
  });
  if (btnOk) btnOk.addEventListener("click", () => {
    if (state.activeTrip) {
      showItineraryView();
    } else {
      switchTab("explore");
    }
  });

  const btnClosePdf = document.getElementById("btn-close-pdf-modal");
  const overlayPdf = document.getElementById("pdf-modal-overlay");
  const btnPrintPdf = document.getElementById("btn-print-pdf");

  if (btnClosePdf && overlayPdf) {
    btnClosePdf.addEventListener("click", () => {
      overlayPdf.classList.remove("active");
    });
  }
  if (btnPrintPdf) {
    btnPrintPdf.addEventListener("click", () => {
      window.print();
    });
  }

  const btnCloseChecklist = document.getElementById("btn-close-checklist-modal");
  const overlayChecklist = document.getElementById("checklist-modal-overlay");
  const btnAddCustom = document.getElementById("btn-add-custom-checklist");
  const inputCustom = document.getElementById("checklist-custom-input");
  const btnResetChecklist = document.getElementById("btn-reset-checklist");

  if (btnCloseChecklist && overlayChecklist) {
    btnCloseChecklist.addEventListener("click", () => {
      overlayChecklist.classList.remove("active");
    });
  }

  if (btnAddCustom && inputCustom) {
    btnAddCustom.addEventListener("click", () => {
      const text = inputCustom.value.trim();
      if (!text) return;
      if (state.activeTrip && state.activeTrip.checklist) {
        state.activeTrip.checklist.push({
          id: 'custom_' + Date.now(),
          text: text,
          checked: false,
          category: 'custom'
        });
        inputCustom.value = "";
        persistActiveTrip();
        renderChecklist();
      }
    });
    inputCustom.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        btnAddCustom.click();
      }
    });
  }

  if (btnResetChecklist) {
    btnResetChecklist.addEventListener("click", () => {
      if (state.activeTrip) {
        state.activeTrip.checklist = null;
        openChecklistModal();
        persistActiveTrip();
      }
    });
  }
}

function openPdfPreview() {
  const overlay = document.getElementById("pdf-modal-overlay");
  const content = document.getElementById("pdf-preview-content");
  if (!overlay || !content) return;

  if (!state.activeTrip) {
    showToast("활성화된 일정이 없습니다.");
    return;
  }

  let html = `
    <div style="font-family: sans-serif; padding: 20px; line-height: 1.6; color: #1e293b;">
      <h2 style="margin-top: 0; color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">${esc(state.activeTrip.title)}</h2>
      <div style="margin-bottom: 20px; background: #f8fafc; padding: 12px; border-radius: 8px; font-size: 14px;">
        <p style="margin: 4px 0;"><strong>목적지:</strong> ${esc(state.activeTrip.destination || '미정')}</p>
        <p style="margin: 4px 0;"><strong>여행 기간:</strong> ${state.activeTrip.days}일</p>
        ${state.activeTrip.startDate ? `<p style="margin: 4px 0;"><strong>출발일:</strong> ${esc(state.activeTrip.startDate)}</p>` : ''}
        <p style="margin: 4px 0;"><strong>예상 경비:</strong> ${costLabel(state.activeTrip)}</p>
      </div>
  `;

  for (let d = 1; d <= state.activeTrip.days; d++) {
    const dayPlaces = state.activeTrip.places.filter(p => p.day === d);
    html += `<h3 style="color: #0f172a; margin-top: 24px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">Day ${d}${getTripDate(state.activeTrip, d) ? ' · ' + formatShortDate(getTripDate(state.activeTrip, d)) : ''}</h3>`;
    if (dayPlaces.length === 0) {
      html += `<p style="color: #64748b; font-style: italic;">일정이 비어 있습니다.</p>`;
    } else {
      html += `<ol style="padding-left: 20px; margin: 8px 0;">`;
      dayPlaces.forEach(place => {
        let catText = "관광";
        if (place.category === "restaurant") catText = "맛집";
        else if (place.category === "cafe") catText = "카페";
        else if (place.category === "hotel") catText = "숙소";
        else if (place.category === "transit") catText = "이동";
        else if (place.category === "shopping") catText = "쇼핑";

        html += `
          <li style="margin-bottom: 12px;">
            <strong style="font-size: 16px;">[${esc(place.time)}] ${esc(place.name)}</strong> 
            <span style="font-size: 12px; background: #e0e7ff; color: #4f46e5; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">${catText}</span>
            ${place.price ? `<span style="font-size: 13px; color: #b45309; font-weight: bold; margin-left: 8px;">${placePriceLabel(place, state.activeTrip)}</span>` : ''}
            ${place.description ? `<p style="margin: 4px 0 0 0; font-size: 13px; color: #475569;">${esc(place.description)}</p>` : ''}
          </li>
        `;
      });
      html += `</ol>`;
    }
  }

  html += `</div>`;
  content.innerHTML = html;
  overlay.classList.add("active");
}

async function shareItinerary() {
  if (!state.activeTrip) return;
  let url;
  try {
    const code = await window.RoutyAI.encodeTrip(state.activeTrip);
    url = `${window.location.origin}${window.location.pathname}#trip=${code}`;
  } catch (e) {
    console.error(e);
    showToast("공유 링크를 만들지 못했습니다.");
    return;
  }
  const title = state.activeTrip.title;
  if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ title: `[Routy] ${title}`, text: `${title} 여행 일정`, url });
      return;
    } catch (e) {
      if (e.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast("공유 링크를 복사했어요! 받은 사람은 링크만 열면 일정을 볼 수 있어요.", 3500);
  } catch (err) {
    await uiPrompt("아래 링크를 복사해 공유하세요.", url, { okText: "닫기", cancelText: "" });
  }
}

async function handleSharedLink() {
  const m = window.location.hash.match(/^#trip=(.+)$/);
  if (!m) return;
  try {
    const trip = await window.RoutyAI.decodeTrip(m[1]);
    trip.source = "shared";
    ensureTripShape(trip);
    state.activeTrip = trip;
    state.activeTripDay = 1;
    history.replaceState(null, "", window.location.pathname + window.location.search);
    showItineraryView();
    showToast("공유받은 일정입니다. '저장'을 누르면 내 일정에 추가돼요.", 4000);
  } catch (e) {
    console.error(e);
    showToast("공유 링크가 손상되어 일정을 열 수 없습니다.", 4000);
  }
}

// 시간 문자열 "09:00 - 10:30" → [시작분, 종료분]
function parseTimeRange(timeStr) {
  const nums = (timeStr || "").match(/(\d{1,2}):(\d{2})/g);
  if (!nums || !nums.length) return null;
  const toMin = (s) => {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + m;
  };
  const start = toMin(nums[0]);
  let end = nums[1] ? toMin(nums[1]) : start + 60;
  if (end <= start) end = start + 60;
  return [start, end];
}

function downloadCalendarIcs() {
  if (!state.activeTrip) return;
  const trip = state.activeTrip;
  let base = getTripDate(trip, 1);
  let noDate = false;
  if (!base) {
    base = new Date();
    base.setDate(base.getDate() + 1);
    base.setHours(0, 0, 0, 0);
    noDate = true;
  }

  const pad = (n) => String(n).padStart(2, "0");
  const fmtLocal = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const fmtDate = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const icsText = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Routy//Itinerary//KO", "CALSCALE:GREGORIAN"];
  trip.places.forEach((place, index) => {
    const day = new Date(base);
    day.setDate(base.getDate() + (place.day - 1));
    const range = parseTimeRange(place.time);
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${trip.id}-${place.id || index}@routy`);
    lines.push(`DTSTAMP:${stamp}`);
    if (range) {
      const s = new Date(day); s.setMinutes(range[0]);
      const e = new Date(day); e.setMinutes(range[1]);
      lines.push(`DTSTART:${fmtLocal(s)}`);
      lines.push(`DTEND:${fmtLocal(e)}`);
    } else {
      const next = new Date(day); next.setDate(day.getDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${fmtDate(day)}`);
      lines.push(`DTEND;VALUE=DATE:${fmtDate(next)}`);
    }
    lines.push(`SUMMARY:${icsText(`${place.name}`)}`);
    lines.push(`LOCATION:${icsText(place.name)}`);
    if (!place.coordMissing) lines.push(`GEO:${(+place.lat).toFixed(6)};${(+place.lng).toFixed(6)}`);
    lines.push(`DESCRIPTION:${icsText(`[${trip.title}] ${place.description || ""}`)}`);
    lines.push("END:VEVENT");
  });
  lines.push("END:VCALENDAR");

  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${trip.title || "trip"}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  showToast(noDate
    ? "출발일이 없어 내일부터로 캘린더 파일을 만들었어요. 일정 화면 위쪽 날짜 칸에서 출발일을 지정할 수 있어요."
    : "캘린더 파일(.ics)을 받았어요. 열면 캘린더에 추가됩니다.", 4000);
}

const DEFAULT_CHECKLIST_ITEMS = [
  { id: 'c1', text: '여권 및 신분증', checked: false, category: 'essential' },
  { id: 'c2', text: '보조배터리 및 충전기', checked: false, category: 'essential' },
  { id: 'c3', text: '기초 화장품 및 세면도구', checked: false, category: 'essential' },
  { id: 'c4', text: '환전 및 신용카드', checked: false, category: 'essential' },
  { id: 'c5', text: '편안한 여분의 옷과 신발', checked: false, category: 'essential' }
];

function openChecklistModal() {
  const overlay = document.getElementById("checklist-modal-overlay");
  const destInfo = document.getElementById("checklist-dest-info");
  if (!overlay) return;

  if (!state.activeTrip) {
    showToast("활성화된 일정이 없습니다.");
    return;
  }

  destInfo.textContent = `${state.activeTrip.destination || '선택한'} 여행 준비물입니다. 체크 상태는 일정과 함께 저장돼요.`;
  
  if (!state.activeTrip.checklist) {
    state.activeTrip.checklist = JSON.parse(JSON.stringify(DEFAULT_CHECKLIST_ITEMS));
    
    const destination = (state.activeTrip.destination || "").toLowerCase();
    const hasHotel = state.activeTrip.places.some(p => p.category === 'hotel');
    
    if (hasHotel) {
      state.activeTrip.checklist.push({ id: 'chotel', text: '호텔 바우처 및 예약 확인서', checked: false, category: 'booking' });
    }
    const domesticKeywords = ["서울", "부산", "제주", "강릉", "속초", "경주", "여수"];
    const isDomestic = domesticKeywords.some(kw => destination.includes(kw));
    
    if (!isDomestic && destination !== "") {
      state.activeTrip.checklist.push({ id: 'cos1', text: '포켓 와이파이 / 유심(USIM)', checked: false, category: 'overseas' });
      state.activeTrip.checklist.push({ id: 'cos2', text: '110v 변환 플러그 (돼지코)', checked: false, category: 'overseas' });
      state.activeTrip.checklist.push({ id: 'cos3', text: '여행자 보험 가입', checked: false, category: 'overseas' });
    } else {
      state.activeTrip.checklist.push({ id: 'cdom1', text: '모바일 신분증', checked: false, category: 'domestic' });
    }
    (state.activeTrip.checklistSeed || []).forEach((tip, i) => {
      state.activeTrip.checklist.push({ id: 'cai' + i, text: `✨ ${tip}`, checked: false, category: 'ai' });
    });
  }

  renderChecklist();
  overlay.classList.add("active");
}

function renderChecklist() {
  const container = document.getElementById("checklist-items-container");
  if (!container || !state.activeTrip || !state.activeTrip.checklist) return;

  container.innerHTML = "";

  state.activeTrip.checklist.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "checklist-item";
    div.style.display = "flex";
    div.style.alignItems = "center";
    div.style.justifyContent = "space-between";
    div.style.padding = "10px 0";
    div.style.borderBottom = "1px solid #f1f5f9";

    const label = document.createElement("label");
    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.gap = "10px";
    label.style.cursor = "pointer";
    label.style.flex = "1";
    if (item.checked) {
      label.style.textDecoration = "line-through";
      label.style.color = "var(--slate-400)";
    }

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = item.checked;
    checkbox.style.width = "18px";
    checkbox.style.height = "18px";
    checkbox.style.cursor = "pointer";
    checkbox.addEventListener("change", () => {
      item.checked = checkbox.checked;
      if (item.checked) {
        label.style.textDecoration = "line-through";
        label.style.color = "var(--slate-400)";
      } else {
        label.style.textDecoration = "none";
        label.style.color = "inherit";
      }
      persistActiveTrip();
    });

    const spanText = document.createElement("span");
    spanText.textContent = item.text;
    spanText.style.fontSize = "15px";

    label.appendChild(checkbox);
    label.appendChild(spanText);

    const btnDelete = document.createElement("button");
    btnDelete.textContent = "✕";
    btnDelete.style.background = "none";
    btnDelete.style.border = "none";
    btnDelete.style.color = "#ef4444";
    btnDelete.style.cursor = "pointer";
    btnDelete.style.padding = "4px 8px";
    btnDelete.style.fontSize = "14px";
    btnDelete.addEventListener("click", () => {
      state.activeTrip.checklist.splice(index, 1);
      persistActiveTrip();
      renderChecklist();
    });

    div.appendChild(label);
    div.appendChild(btnDelete);
    container.appendChild(div);
  });
}

function downloadOfflineTxt() {
  if (!state.activeTrip) return;
  
  let txt = `=========================================\r\n`;
  txt += `       [Routy] ${state.activeTrip.title} 여행 일정 요약\r\n`;
  txt += `=========================================\r\n\r\n`;
  txt += `목적지: ${state.activeTrip.destination || '미정'}\r\n`;
  txt += `여행 기간: ${state.activeTrip.days}일\r\n`;
  txt += `예상 경비: ${costLabel(state.activeTrip)}\r\n\r\n`;
  
  for (let d = 1; d <= state.activeTrip.days; d++) {
    const dayPlaces = state.activeTrip.places.filter(p => p.day === d);
    txt += `-------------------\r\n`;
    txt += ` Day ${d}\r\n`;
    txt += `-------------------\r\n`;
    if (dayPlaces.length === 0) {
      txt += `(일정이 비어 있습니다)\r\n`;
    } else {
      dayPlaces.forEach((place, index) => {
        let catText = "관광";
        if (place.category === "restaurant") catText = "맛집";
        else if (place.category === "cafe") catText = "카페";
        else if (place.category === "hotel") catText = "숙소";
        else if (place.category === "transit") catText = "이동";
        else if (place.category === "shopping") catText = "쇼핑";
        
        txt += `${index + 1}. [${place.time}] ${place.name} (${catText})\r\n`;
        if (place.price) txt += `   - 예상 금액: ₩${place.price.toLocaleString()}\r\n`;
        if (place.description) txt += `   - 상세: ${place.description}\r\n`;
        txt += `\r\n`;
      });
    }
    txt += `\r\n`;
  }
  
  txt += `=========================================\r\n`;
  txt += `다운로드 시간: ${new Date().toLocaleString()}\r\n`;
  txt += `Routy와 함께 안전하고 즐거운 여행 되세요!\r\n`;
  
  const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.activeTrip.title || 'trip'}_itinerary.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  showToast("오프라인 일정 텍스트 파일이 다운로드되었습니다.");
}

// 예전 데이터(공동편집/댓글 필드 등)를 정리하고 필수 필드를 보장
function ensureTripShape(trip) {
  if (!trip) return;
  delete trip.collaborators;
  if (!Array.isArray(trip.places)) trip.places = [];
  if (!trip.days || trip.days < 1) trip.days = Math.max(1, ...trip.places.map(p => p.day || 1));
  trip.places.forEach(place => {
    if (!place.id) place.id = 'p_' + Math.random().toString(36).slice(2, 11);
    delete place.comments;
    place.lat = parseFloat(place.lat);
    place.lng = parseFloat(place.lng);
    if (!isFinite(place.lat) || !isFinite(place.lng)) {
      place.lat = 37.5665;
      place.lng = 126.978;
      place.coordMissing = true;
    }
  });
}
