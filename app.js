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
    if (place.price === undefined || place.price === null) {
      place.price = getDeterministicPrice(place.name, place.category, trip.budget);
    }
  });
}

// --- Initialize App ---
document.addEventListener("DOMContentLoaded", () => {
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
  setupPlaceActionDelegation();
  setupTitleRename();
  updateAiNotice();

  // Render initial explorer state
  renderExploreTab();

  // Setup drag-to-scroll functionality for Day tabs
  setupDayTabsDragScroll();

  // 공유 링크(#trip=...)로 열었으면 해당 일정 표시
  handleSharedLink();

  // PWA: 오프라인 캐시
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(err => console.warn("SW 등록 실패", err));
  }

  // Window resize handler to invalidate map sizes during responsive transition
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (leafletMap) {
        leafletMap.invalidateSize();
      }
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

function switchTab(tabName) {
  state.activeTab = tabName;

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
    if (btn.getAttribute("data-tab") === tabName) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Toggle desktop navigation active states
  document.querySelectorAll("#desktop-header .desktop-nav-item").forEach(btn => {
    if (btn.getAttribute("data-tab") === tabName) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Render specific tab contents on transition
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
    const text = theme === "dark" ? "☀️" : "🌙";
    if (mobileToggle) mobileToggle.textContent = text;
    if (desktopToggle) desktopToggle.textContent = text;
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
  };

  if (mobileToggle) mobileToggle.addEventListener("click", handleToggle);
  if (desktopToggle) desktopToggle.addEventListener("click", handleToggle);
}

// --- Toast Notifications ---
let toastTimer = null;
function showToast(message, duration = 2500) {
  const toast = document.getElementById("toast-notification");
  toast.textContent = message;
  toast.classList.add("active");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("active");
  }, duration);
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
  } catch (e) {
    console.error("LocalStorage write error: ", e);
    showToast("저장 공간이 부족해 저장하지 못했습니다. 오래된 일정을 백업 후 삭제해 주세요.", 5000);
  }
}

// --- 공통 헬퍼 ---
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
  }
  updateSaveButton();
}

function updateSaveButton() {
  const btn = document.getElementById("btn-save-itinerary");
  if (!btn) return;
  const saved = isActiveTripSaved();
  btn.textContent = saved ? "저장됨 ✓" : "저장";
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

function getPlaceLinks(place) {
  const trip = state.activeTrip || {};
  const domestic = isInKorea(place.lat, place.lng);
  const q = place.coordMissing ? `${place.name} ${trip.destination || ""}`.trim() : place.name;
  const mapUrl = domestic
    ? `https://map.naver.com/p/search/${encodeURIComponent(q)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
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
  return { mapUrl, searchUrl };
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

  document.getElementById("btn-clear-data").addEventListener("click", () => {
    if (!state.savedTrips.length) {
      showToast("삭제할 일정이 없습니다.");
      return;
    }
    if (!confirm(`저장된 일정 ${state.savedTrips.length}개를 모두 삭제할까요? 되돌릴 수 없습니다.`)) return;
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
      <div class="no-results-icon">🔍</div>
      <p>"<strong>${esc(query)}</strong>"에 맞는 추천 템플릿이 없습니다.</p>
      <span>AI 플래너에서 바로 일정을 만들어 보세요!</span>
      <button class="btn btn-sm btn-primary" style="margin-top:12px" id="btn-explore-to-planner">⚡ "${esc(query)}" 일정 만들기</button>
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

function setupPlannerForm() {
  const form = document.getElementById("planner-form");
  const loadingOverlay = document.getElementById("planner-loading-overlay");
  const statusText = document.getElementById("loading-status-text");
  const elapsedEl = document.getElementById("loading-elapsed");
  const cancelBtn = document.getElementById("btn-cancel-generate");

  if (!form) return;
  setupStyleTags();

  cancelBtn.addEventListener("click", () => {
    if (generateController) {
      generateCancelledByUser = true;
      generateController.abort();
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const dest = document.getElementById("input-destination").value.trim();
    const days = parseInt(document.getElementById("input-duration").value, 10);
    const budget = document.getElementById("input-budget").value;
    const party = document.getElementById("input-party").value;
    const startDate = document.getElementById("input-start-date").value;
    const request = document.getElementById("input-request").value.trim();
    const styles = Array.from(document.querySelectorAll(".style-tags-container .style-tag.active"))
      .map(t => t.getAttribute("data-style"));
    if (styles.length === 0) styles.push("relaxing");

    if (!dest) {
      showToast("여행 목적지를 입력해 주세요.");
      return;
    }

    const useAI = window.RoutyAI.hasApiKey();
    loadingOverlay.classList.add("active");
    cancelBtn.style.display = useAI ? "" : "none";

    const messages = useAI
      ? ["여행지 정보를 모으는 중...", "실제 장소와 동선을 고르는 중...", "시간표와 예상 비용을 계산하는 중...", "거의 다 됐어요. 일정을 다듬는 중..."]
      : ["샘플 일정을 만드는 중..."];
    let msgIdx = 0;
    statusText.textContent = messages[0];
    elapsedEl.textContent = "";
    const t0 = Date.now();
    const ticker = setInterval(() => {
      const sec = Math.floor((Date.now() - t0) / 1000);
      elapsedEl.textContent = `${sec}초 경과`;
      if (sec > 0 && sec % 6 === 0 && msgIdx < messages.length - 1) {
        msgIdx++;
        statusText.textContent = messages[msgIdx];
      }
    }, 1000);

    const base = {
      id: `trip-${Date.now()}`,
      destination: dest,
      days,
      budget,
      style: styles[0],
      styles,
      party,
      startDate,
      request,
      createdAt: Date.now()
    };

    try {
      let trip;
      if (useAI) {
        generateController = new AbortController();
        generateCancelledByUser = false;
        const timeout = setTimeout(() => generateController && generateController.abort(), 150000);
        try {
          const plan = await window.RoutyAI.generateTrip(
            { destination: dest, days, budget, styles, party, startDate, request },
            { signal: generateController.signal }
          );
          trip = Object.assign(base, {
            title: plan.title || `${dest} ${days}일 여행`,
            summary: plan.summary,
            places: plan.places,
            checklistSeed: plan.tips,
            source: "ai"
          });
        } finally {
          clearTimeout(timeout);
        }
      } else {
        await sleep(900);
        trip = Object.assign(base, {
          title: `[샘플] ${dest} ${days}일 여행`,
          summary: "API 키 없이 만든 샘플 일정입니다. 설정에서 Gemini 키를 등록하면 실제 장소로 일정을 짜 줍니다.",
          places: window.generateItinerary(dest, days, budget, styles[0]),
          source: "sample"
        });
      }

      ensureTripShape(trip);
      ensurePlacePrices(trip);
      state.activeTrip = trip;
      state.activeTripDay = 1;

      // AI 일정은 바로 내 일정에 자동 저장
      state.savedTrips.unshift(cloneTrip(trip));
      saveToLocalStorage();

      document.getElementById("input-destination").value = "";
      document.getElementById("input-request").value = "";

      showItineraryView();
      showToast(useAI ? "AI 일정이 만들어졌어요! 내 일정에 자동 저장됩니다." : "샘플 일정을 만들었습니다.", 3000);
    } catch (err) {
      if (generateCancelledByUser) {
        showToast("일정 생성을 취소했습니다.");
      } else {
        console.error(err);
        showToast(err.message || "일정 생성 중 오류가 발생했습니다.", 5000);
      }
    } finally {
      clearInterval(ticker);
      generateController = null;
      loadingOverlay.classList.remove("active");
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
      ? `📍 위치 지정됨: ${esc(picked.address || picked.name)} <button type="button" class="link-btn" data-clear>해제</button>`
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
    if (isActiveTripSaved()) switchTab("trips");
    else if (state.activeTrip && state.activeTrip.source === "template") switchTab("explore");
    else switchTab("planner");
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
      updateSaveButton();
    }
    const confirmTitleEl = document.getElementById("confirm-trip-title");
    if (confirmTitleEl) confirmTitleEl.textContent = state.activeTrip.title;
    switchTab("confirmation");
    if (!wasSaved) triggerConfetti();
  });

  // 빠른 도구
  document.getElementById("btn-tool-share").addEventListener("click", () => shareItinerary());
  document.getElementById("btn-tool-calendar").addEventListener("click", () => downloadCalendarIcs());
  document.getElementById("btn-tool-checklist").addEventListener("click", () => openChecklistModal());
  document.getElementById("btn-tool-print").addEventListener("click", () => openPdfPreview());

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
    try {
      const plan = await window.RoutyAI.refineTrip(state.activeTrip, instruction);
      refineUndoTrip = cloneTrip(state.activeTrip);
      state.activeTrip.places = plan.places;
      if (plan.summary) state.activeTrip.summary = plan.summary;
      if (plan.tips && plan.tips.length) state.activeTrip.checklistSeed = plan.tips;
      ensureTripShape(state.activeTrip);
      ensurePlacePrices(state.activeTrip);
      refineInput.value = "";
      renderItineraryAll();
      persistActiveTrip();
      setRefineMode("undo");
      showToast("요청대로 일정을 수정했어요. 마음에 안 들면 '되돌리기'를 누르세요.", 3500);
    } catch (err) {
      showToast(err.message || "수정 중 오류가 발생했습니다.", 5000);
    } finally {
      refineBtn.disabled = false;
      refineInput.disabled = false;
      refineForm.classList.remove("loading");
      if (refineBtn.dataset.mode !== "undo") setRefineMode("normal");
    }
  });

  refineBtn.addEventListener("click", (ev) => {
    if (refineBtn.dataset.mode !== "undo") return;
    ev.preventDefault();
    if (refineUndoTrip) {
      state.activeTrip = refineUndoTrip;
      refineUndoTrip = null;
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
    const time = document.getElementById("add-place-time").value.trim() || "시간 미정";
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
    const oldTime = place.time;
    const oldDay = place.day;
    place.name = name;
    place.time = document.getElementById("edit-place-time").value.trim() || "시간 미정";
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
    if (place.day !== oldDay || place.time !== oldTime) {
      // 다른 날로 옮기면 그날 맨 끝으로
      if (place.day !== oldDay) {
        state.activeTrip.places.splice(state.activeTrip.places.indexOf(place), 1);
        state.activeTrip.places.push(place);
      }
      sortTripPlaces(state.activeTrip, place.day);
    }
    close();
    renderTimeline();
    updateMapMarkers();
    persistActiveTrip();
    showToast("장소 정보를 수정했습니다.");
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
  const idx = state.activeTrip.places.findIndex(p => p.id === placeId);
  if (idx < 0) return;
  const [removed] = state.activeTrip.places.splice(idx, 1);
  if (window.closeSeniorDetailModal) window.closeSeniorDetailModal();
  renderTimeline();
  updateMapMarkers();
  persistActiveTrip();
  showToast(`"${removed.name}"을(를) 삭제했습니다.`);
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
    else if (action === "search") window.open(getPlaceLinks(place).searchUrl, "_blank", "noopener");
    else if (action === "edit") openPlaceEdit(id);
    else if (action === "up") movePlace(id, -1);
    else if (action === "down") movePlace(id, 1);
    else if (action === "delete") {
      if (confirm(`"${place.name}"을(를) 일정에서 삭제할까요?`)) deletePlaceById(id);
    }
  });
}

// --- Itinerary: Screen Activation ---
function renderTripMeta() {
  const el = document.getElementById("trip-meta-row");
  if (!el || !state.activeTrip) return;
  const t = state.activeTrip;
  const bits = [];
  const start = getTripDate(t, 1);
  if (start && t.days > 1) bits.push(`~ ${formatShortDate(getTripDate(t, t.days))}`);
  bits.push(`${t.days}일`);
  if (t.party) bits.push(`👥 ${esc(t.party.split(",")[0])}`);
  const badge = t.source === "ai" ? `<span class="trip-source-badge ai">AI 생성</span>`
    : t.source === "sample" ? `<span class="trip-source-badge sample">샘플</span>`
    : t.source === "shared" ? `<span class="trip-source-badge shared">공유받음</span>` : "";
  el.innerHTML = `
    <div class="trip-meta-line">
      ${badge}
      <label class="trip-date-picker" title="출발일 지정">📆 <input type="date" id="trip-start-date-input" value="${esc(t.startDate || "")}"></label>
      <span>${bits.join(" · ")}</span>
    </div>
    ${t.summary ? `<p class="trip-summary">${esc(t.summary)}</p>` : ""}
  `;
  document.getElementById("trip-start-date-input").addEventListener("change", (e) => {
    state.activeTrip.startDate = e.target.value;
    renderTripMeta();
    renderDayTabs();
    renderTimeline();
    persistActiveTrip();
  });
}

function setupTitleRename() {
  const titleEl = document.getElementById("itinerary-title");
  titleEl.title = "눌러서 제목 바꾸기";
  titleEl.style.cursor = "pointer";
  titleEl.addEventListener("click", () => {
    if (!state.activeTrip) return;
    const next = prompt("일정 제목", state.activeTrip.title);
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

  state.editMode = false;
  const toggleEditBtn = document.getElementById("btn-toggle-edit-mode");
  if (toggleEditBtn) {
    toggleEditBtn.classList.remove("active");
    toggleEditBtn.textContent = "편집";
  }
  // 이전 일정의 되돌리기 상태 초기화
  refineUndoTrip = null;
  setRefineMode("normal");
  if (state.activeTripDay > state.activeTrip.days) state.activeTripDay = 1;

  switchTab("itinerary");
  document.getElementById("itinerary-title").textContent = state.activeTrip.title;

  const btnToggleMap = document.getElementById("btn-toggle-map");
  const mapWrapper = document.getElementById("map-wrapper");
  if (btnToggleMap && mapWrapper) {
    mapWrapper.classList.remove("show-senior-map");
    btnToggleMap.classList.remove("active");
    btnToggleMap.textContent = "🗺️ 지도 순서도 보기";
  }

  setTimeout(() => {
    initLeafletMap();
    renderItineraryAll();
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
    tab.className = `day-tab ${d === state.activeTripDay ? 'active' : ''}`;
    const tabDate = getTripDate(state.activeTrip, d);
    tab.innerHTML = tabDate ? `Day ${d}<small class="day-tab-date">${formatShortDate(tabDate)}</small>` : `Day ${d}`;
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

  // Update dynamic fade masks after elements are populated
  setTimeout(() => {
    if (container.updateFadeMasks) container.updateFadeMasks();
  }, 100);
}

// --- Timeline Render (Schedules Lists) ---
function getTransitTips(placeName) {
  const name = placeName || '';
  if (name.includes("택시")) return "🚕 호출 앱(우버, 카카오T 등) 사용 권장";
  if (name.includes("지하철") || name.includes("메트로")) return "🚇 현지 교통카드 태그 또는 1회권 발권기 구매";
  if (name.includes("버스")) return "🚌 승차 시 교통카드를 태그하거나 잔돈을 준비하세요";
  if (name.includes("렌터카") || name.includes("차량")) return "🚗 국제운전면허증 지참 | 주차 사전 확인 권장";
  if (name.includes("도보")) return "🚶 가까운 도보 코스 | 편안한 신발 추천";
  return "";
}

function getTripTotal(trip) {
  return trip.places.reduce((sum, p) => sum + (p.price || 0), 0);
}

function renderTimeline() {
  const container = document.getElementById("timeline-places-container");
  if (!container || !state.activeTrip) return;

  container.innerHTML = "";

  const editBtn = document.getElementById("btn-toggle-edit-mode");
  if (editBtn) {
    editBtn.style.display = state.seniorMode ? "none" : "block";
    if (state.seniorMode) {
      state.editMode = false;
      editBtn.classList.remove("active");
      editBtn.textContent = "편집";
    }
  }
  container.classList.toggle("edit-mode-active", !!state.editMode);

  const totalBudgetEl = document.getElementById("itinerary-total-budget");
  if (totalBudgetEl) totalBudgetEl.textContent = `₩${getTripTotal(state.activeTrip).toLocaleString()}`;

  const dayPlaces = state.activeTrip.places.filter(p => p.day === state.activeTripDay);
  const dayTotal = dayPlaces.reduce((s, p) => s + (p.price || 0), 0);

  if (dayPlaces.length === 0) {
    container.innerHTML = `<p class="empty-timeline-msg">이 날은 아직 일정이 없습니다. 위 버튼으로 장소를 추가해 보세요.</p>`;
    return;
  }

  const dayHeader = document.createElement("div");
  dayHeader.className = "day-summary-line";
  const date = getTripDate(state.activeTrip, state.activeTripDay);
  dayHeader.textContent = `${date ? formatShortDate(date) + " · " : ""}${dayPlaces.length}곳 · 1인 약 ₩${dayTotal.toLocaleString()}`;
  container.appendChild(dayHeader);

  dayPlaces.forEach((place, index) => {
    const card = document.createElement("div");
    card.className = "timeline-item";
    card.setAttribute("data-cat", place.category);

    const catKorean = CATEGORY_LABELS[place.category] || "관광";
    const id = esc(place.id);
    const isTransit = place.category === "transit";
    const tips = isTransit ? getTransitTips(place.name) : "";

    const priceHtml = !place.price
      ? `<span class="place-price-tag free">무료</span>`
      : `<span class="place-price-tag">약 ₩${place.price.toLocaleString()}</span>`;

    const searchLabel = place.category === "hotel" ? "🏨 숙소 검색" : place.category === "restaurant" || place.category === "cafe" ? "🔎 리뷰 검색" : "🔎 정보 검색";
    const coordWarn = place.coordMissing ? `<span class="coord-warn" title="정확한 위치가 지정되지 않았어요. 편집에서 위치를 찾아주세요.">📍?</span>` : "";

    const linkButtons = `
      <button class="btn-ota" data-action="map" data-id="${id}">🗺️ 지도</button>
      ${isTransit ? "" : `<button class="btn-ota" data-action="search" data-id="${id}">${searchLabel}</button>`}
    `;

    if (state.seniorMode) {
      const controlsHtml = `
        <button class="btn-ctrl btn-senior-link" data-action="map" data-id="${id}">🗺️ 지도에서 보기</button>
        ${isTransit ? "" : `<button class="btn-ctrl btn-senior-link" data-action="search" data-id="${id}">${searchLabel}</button>`}
        <button class="btn-ctrl btn-senior-edit" data-action="edit" data-id="${id}">✏️ 편집하기</button>
        <button class="btn-ctrl btn-delete" data-action="delete" data-id="${id}">🗑️ 장소 삭제하기</button>
      `;
      card.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-header-row">
          <span class="time-badge">🕒 ${esc(place.time)}</span>
          <span class="place-cat-badge cat-${esc(place.category)}">${catKorean}</span>
          ${priceHtml}
        </div>
        <div class="place-name">${index + 1}. ${esc(place.name)}</div>
        <div class="click-guide">🔍 상세내용 보기 (누르세요)</div>
      `;
      const tipsHtml = tips ? `<div class="transit-guide-box"><div class="guide-tips">${tips}</div></div>` : "";
      card.onclick = () => openSeniorDetailModal(place, index, catKorean, tipsHtml, controlsHtml);
    } else {
      card.onclick = null;
      card.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-item-header">
          <span class="timeline-time">${esc(place.time)}</span>
          <span class="timeline-title-sep">—</span>
          <span class="timeline-place-name">${esc(place.name)}</span>
          ${coordWarn}
          ${priceHtml}
        </div>
        ${place.description ? `<p class="timeline-desc">${esc(place.description)}</p>` : ""}
        ${tips ? `<p class="timeline-desc transit-tip">${tips}</p>` : ""}
        <div class="timeline-actions">
          ${linkButtons}
          <button class="btn-timeline-comments" data-action="edit" data-id="${id}">✏️ 편집</button>
          <span class="edit-only-actions">
            <button class="btn-move" data-action="up" data-id="${id}" ${index === 0 ? "disabled" : ""} title="위로">▲</button>
            <button class="btn-move" data-action="down" data-id="${id}" ${index === dayPlaces.length - 1 ? "disabled" : ""} title="아래로">▼</button>
            <button class="timeline-delete-action" data-action="delete" data-id="${id}">삭제</button>
          </span>
        </div>
      `;
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

function updateMapMarkers() {
  if (!leafletMap || !mapMarkersGroup || !state.activeTrip) return;

  // Clear previous layers
  mapMarkersGroup.clearLayers();
  if (mapRouteLine) {
    leafletMap.removeLayer(mapRouteLine);
    mapRouteLine = null;
  }

  const dayPlaces = state.activeTrip.places.filter(p => p.day === state.activeTripDay);
  
  // Set day header
  document.getElementById("map-day-indicator").textContent = `Day ${state.activeTripDay} 동선`;

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
      <div class="map-popup-time">🕒 ${esc(place.time)}</div>
    `, {
      closeButton: false,
      className: "custom-map-popup"
    });

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

  if (timeEl) timeEl.textContent = `🕒 ${place.time}`;
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
        <span style="font-size:32px; display:block; margin-bottom:12px;">📅</span>
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
        <p>📍 ${esc(trip.destination)} | 📅 ${when}</p>
        <p class="saved-trip-sub">${(trip.places || []).length}곳 · 1인 약 ₩${getTripTotal(trip).toLocaleString()}</p>
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
  state.activeTripDay = 1;
  showItineraryView();
};

window.deleteSavedTrip = function(tripId) {
  const index = state.savedTrips.findIndex(t => t.id === tripId);
  if (index < 0) return;
  const title = state.savedTrips[index].title;
  if (!confirm(`"${title}" 일정을 삭제할까요?`)) return;
  state.savedTrips.splice(index, 1);
  saveToLocalStorage();
  renderSavedTrips();
  showToast(`"${title}" 일정이 삭제되었습니다.`);
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
        btnToggleMap.textContent = "🗺️ 지도 순서도 보기";
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
        btnToggleMap.textContent = "❌ 지도 숨기기";
        setTimeout(() => {
          if (leafletMap) {
            leafletMap.invalidateSize();
          }
        }, 150);
      } else {
        btnToggleMap.textContent = "🗺️ 지도 순서도 보기";
      }
    });
  }
}

function applyFontSizeStep(toggleBtn, desktopToggleBtn, deviceWrapper, isInitial = false) {
  // Reset all class variations
  deviceWrapper.classList.remove("senior-mode", "senior-mode-xl", "senior-mode-xxl", "senior-mode-xxxl");
  if (toggleBtn) toggleBtn.classList.remove("active");
  if (desktopToggleBtn) desktopToggleBtn.classList.remove("active");

  let buttonText = "👵👴 큰글씨";
  let toastMsg = "";

  if (state.fontSizeStep === 0) {
    buttonText = "👵👴 큰글씨";
    if (!isInitial) toastMsg = "일반 글자 크기로 전환되었습니다.";
  } else if (state.fontSizeStep === 1) {
    deviceWrapper.classList.add("senior-mode");
    if (toggleBtn) toggleBtn.classList.add("active");
    if (desktopToggleBtn) desktopToggleBtn.classList.add("active");
    buttonText = "👵👴 크게";
    if (!isInitial) toastMsg = "큰 글자 크기로 전환되었습니다.";
  } else if (state.fontSizeStep === 2) {
    deviceWrapper.classList.add("senior-mode", "senior-mode-xl");
    if (toggleBtn) toggleBtn.classList.add("active");
    if (desktopToggleBtn) desktopToggleBtn.classList.add("active");
    buttonText = "👵👴 아주크게";
    if (!isInitial) toastMsg = "아주 큰 글자 크기로 전환되었습니다.";
  } else if (state.fontSizeStep === 3) {
    deviceWrapper.classList.add("senior-mode", "senior-mode-xl", "senior-mode-xxl");
    if (toggleBtn) toggleBtn.classList.add("active");
    if (desktopToggleBtn) desktopToggleBtn.classList.add("active");
    buttonText = "👵👴 더크게";
    if (!isInitial) toastMsg = "더 큰 글자 크기로 전환되었습니다.";
  } else if (state.fontSizeStep === 4) {
    deviceWrapper.classList.add("senior-mode", "senior-mode-xl", "senior-mode-xxl", "senior-mode-xxxl");
    if (toggleBtn) toggleBtn.classList.add("active");
    if (desktopToggleBtn) desktopToggleBtn.classList.add("active");
    buttonText = "👵👴 가장크게";
    if (!isInitial) toastMsg = "가장 큰 글자 크기로 전환되었습니다.";
  }

  if (toggleBtn) toggleBtn.innerHTML = buttonText;
  if (desktopToggleBtn) desktopToggleBtn.innerHTML = buttonText;
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
        <p style="margin: 4px 0;"><strong>1인 예상 경비:</strong> ₩${getTripTotal(state.activeTrip).toLocaleString()}</p>
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
            ${place.price ? `<span style="font-size: 13px; color: #b45309; font-weight: bold; margin-left: 8px;">₩${place.price.toLocaleString()}</span>` : ''}
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
    prompt("아래 링크를 복사해 공유하세요.", url);
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
    ? "출발일이 없어 내일부터로 캘린더 파일을 만들었어요. 일정 화면 위쪽 📆에서 출발일을 지정할 수 있어요."
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
  txt += `총 예상 경비: ₩${state.activeTrip.places.reduce((sum, p) => sum + (p.price || 0), 0).toLocaleString()}\r\n\r\n`;
  
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
