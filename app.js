// Routy Travel App MVP - Core Controller & SPA Engine

// --- Global Application State ---
const state = {
  activeTab: 'explore',
  seniorMode: false,
  fontSizeStep: 0, // 0: Normal, 1: Large, 2: Extra Large, 3: Double Extra Large, 4: Triple Extra Large
  user: {
    loggedIn: false,
    name: '',
    email: '',
    avatar: '👤'
  },
  mockUsers: [], // Mock database for email-based auth
  savedTrips: [],
  activeTrip: null, // Current viewed/edited itinerary { title, destination, days, budget, style, places: [] }
  activeTripDay: 1, // Filter day for itinerary timeline & map
  editMode: false, // Edit mode toggle state
  kpi: {
    generations: 0,
    saves: 0,
    clicks: 0,
    clickLogs: []
  },
  friends: [
    { name: '김민수', email: 'minsu@routy.com', online: true },
    { name: '이지원', email: 'jiwon@routy.com', online: true },
    { name: '박태양', email: 'taeyang@routy.com', online: false },
    { name: '최수아', email: 'sua@routy.com', online: true }
  ]
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

  // Setup booking confirmation modal
  setupBookingModal();

  // Setup senior detail view modal
  setupSeniorDetailModal();

  // Setup final confirmation screen actions
  setupConfirmationScreen();

  // Setup collaborator & comment UI
  setupCollaborationUI();

  // Setup profile email authentication
  setupProfileAuth();

  // Render initial explorer state
  renderExploreTab();

  // Setup drag-to-scroll functionality for Day tabs
  setupDayTabsDragScroll();
  
  // Track default metric on first load
  updateKpiStats();

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
  } else if (tabName === 'kpi') {
    renderKpiDashboard();
  } else if (tabName === 'explore') {
    const searchInput = document.getElementById("explore-search-input");
    if (searchInput) {
      searchInput.value = "";
    }
    renderExploreTab();
    renderTemplates();
  } else if (tabName === 'profile') {
    renderProfileTab();
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
function showToast(message) {
  const toast = document.getElementById("toast-notification");
  toast.textContent = message;
  toast.classList.add("active");
  setTimeout(() => {
    toast.classList.remove("active");
  }, 2500);
}

// --- Local Storage Management ---
function loadLocalStorage() {
  try {
    const savedTrips = localStorage.getItem("routy_saved_trips");
    if (savedTrips) {
      state.savedTrips = JSON.parse(savedTrips);
      state.savedTrips.forEach(trip => {
        ensurePlacePrices(trip);
        ensureTripCollaboratorsAndComments(trip);
      });
    }
    
    const savedUser = localStorage.getItem("routy_user");
    if (savedUser) {
      state.user = JSON.parse(savedUser);
    }

    const savedKpi = localStorage.getItem("routy_kpi");
    if (savedKpi) {
      state.kpi = JSON.parse(savedKpi);
    }

    const savedSenior = localStorage.getItem("routy_senior_mode");
    if (savedSenior !== null) {
      state.seniorMode = JSON.parse(savedSenior);
    }

    const savedStep = localStorage.getItem("routy_font_size_step");
    if (savedStep !== null) {
      state.fontSizeStep = parseInt(savedStep);
      state.seniorMode = state.fontSizeStep > 0;
    }

    const savedFriends = localStorage.getItem("routy_friends");
    if (savedFriends) {
      state.friends = JSON.parse(savedFriends);
    } else {
      state.friends = [
        { name: '김민수', email: 'minsu@routy.com', online: true },
        { name: '이지원', email: 'jiwon@routy.com', online: true },
        { name: '박태양', email: 'taeyang@routy.com', online: false },
        { name: '최수아', email: 'sua@routy.com', online: true }
      ];
      localStorage.setItem("routy_friends", JSON.stringify(state.friends));
    }

    // Load mock users
    const savedMockUsers = localStorage.getItem("routy_mock_users");
    if (savedMockUsers) {
      state.mockUsers = JSON.parse(savedMockUsers);
    } else {
      // Seed default user
      state.mockUsers = [
        { name: "홍길동", email: "gildong@routy.com", password: "1234" }
      ];
      localStorage.setItem("routy_mock_users", JSON.stringify(state.mockUsers));
    }

    // Load theme
    const savedTheme = localStorage.getItem("routy_theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);

  } catch (e) {
    console.error("LocalStorage load error: ", e);
  }
}

function saveToLocalStorage() {
  try {
    localStorage.setItem("routy_saved_trips", JSON.stringify(state.savedTrips));
    localStorage.setItem("routy_user", JSON.stringify(state.user));
    localStorage.setItem("routy_kpi", JSON.stringify(state.kpi));
    localStorage.setItem("routy_senior_mode", JSON.stringify(state.seniorMode));
    localStorage.setItem("routy_font_size_step", state.fontSizeStep.toString());
    localStorage.setItem("routy_mock_users", JSON.stringify(state.mockUsers || []));
    localStorage.setItem("routy_friends", JSON.stringify(state.friends));
  } catch (e) {
    console.error("LocalStorage write error: ", e);
  }
}

// --- Mock User Authentication ---
window.mockLogin = function(provider) {
  let name = "길동이";
  let email = "gildong@routy.com";
  let avatar = "✈️";

  if (provider === 'kakao') {
    name = "카카오 탐험가";
    email = "kakao_traveler@kakao.com";
    avatar = "💛";
  } else if (provider === 'naver') {
    name = "네이버 백패커";
    email = "naver_backpacker@naver.com";
    avatar = "💚";
  } else if (provider === 'google') {
    name = "구글 세계여행가";
    email = "google_globetrotter@gmail.com";
    avatar = "🌎";
  }

  state.user = {
    loggedIn: true,
    name: name,
    email: email,
    avatar: avatar
  };
  
  saveToLocalStorage();
  renderProfileTab();
  showToast(`${name}님, 환영합니다!`);
};

window.mockLogout = function() {
  const name = state.user.name;
  state.user = {
    loggedIn: false,
    name: '',
    email: '',
    avatar: '👤'
  };
  saveToLocalStorage();
  renderProfileTab();
  showToast("로그아웃 되었습니다.");
};

function setupProfileAuth() {
  const tabLogin = document.getElementById("tab-auth-login");
  const tabSignup = document.getElementById("tab-auth-signup");
  const groupName = document.getElementById("group-auth-name");
  const nameInput = document.getElementById("auth-input-name");
  const emailInput = document.getElementById("auth-input-email");
  const passwordInput = document.getElementById("auth-input-password");
  const submitBtn = document.getElementById("btn-email-auth-submit");
  const authForm = document.getElementById("email-auth-form");
  const emailAuthTrigger = document.getElementById("email-auth-trigger");
  const emailAuthContainer = document.getElementById("email-auth-container");

  if (emailAuthTrigger && emailAuthContainer) {
    emailAuthTrigger.addEventListener("click", () => {
      emailAuthContainer.classList.remove("hidden");
      emailAuthTrigger.style.display = "none";
    });
  }

  if (!tabLogin || !tabSignup || !groupName || !submitBtn || !authForm) return;

  // Toggle to Login Mode
  tabLogin.addEventListener("click", () => {
    tabLogin.classList.add("active");
    tabSignup.classList.remove("active");
    groupName.style.display = "none";
    submitBtn.textContent = "로그인";
    if (nameInput) {
      nameInput.removeAttribute("required");
      nameInput.value = "";
    }
    if (emailInput) emailInput.value = "";
    if (passwordInput) passwordInput.value = "";
  });

  // Toggle to Signup Mode
  tabSignup.addEventListener("click", () => {
    tabSignup.classList.add("active");
    tabLogin.classList.remove("active");
    groupName.style.display = "block";
    submitBtn.textContent = "회원가입";
    if (nameInput) {
      nameInput.setAttribute("required", "required");
      nameInput.value = "";
    }
    if (emailInput) emailInput.value = "";
    if (passwordInput) passwordInput.value = "";
  });

  // Form Submit Handler
  authForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const isSignup = tabSignup.classList.contains("active");

    if (isSignup) {
      const name = nameInput.value.trim();
      if (!name) {
        showToast("이름을 입력해주세요.");
        return;
      }
      if (!email) {
        showToast("이메일을 입력해주세요.");
        return;
      }
      if (!password) {
        showToast("비밀번호를 입력해주세요.");
        return;
      }

      // Check duplicates
      const exists = state.mockUsers.some(u => u.email.toLowerCase() === email.toLowerCase());
      if (exists) {
        showToast("이미 등록된 이메일 주소입니다.");
        return;
      }

      // Register user
      const newUser = { name, email, password };
      state.mockUsers.push(newUser);
      saveToLocalStorage();

      // Auto Login
      state.user = {
        loggedIn: true,
        name: name,
        email: email,
        avatar: "📧"
      };
      saveToLocalStorage();
      renderProfileTab();
      showToast(`${name}님, 회원가입을 축하합니다!`);

      // Clear fields
      nameInput.value = "";
      emailInput.value = "";
      passwordInput.value = "";
    } else {
      if (!email) {
        showToast("이메일을 입력해주세요.");
        return;
      }
      if (!password) {
        showToast("비밀번호를 입력해주세요.");
        return;
      }

      // Search match
      const matched = state.mockUsers.find(
        u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
      );

      if (matched) {
        state.user = {
          loggedIn: true,
          name: matched.name,
          email: matched.email,
          avatar: "📧"
        };
        saveToLocalStorage();
        renderProfileTab();
        showToast(`${matched.name}님, 환영합니다!`);

        // Clear fields
        emailInput.value = "";
        passwordInput.value = "";
      } else {
        showToast("이메일 또는 비밀번호가 잘못되었습니다.");
      }
    }
  });
}

function renderProfileTab() {
  const unauthCard = document.getElementById("profile-unauthenticated");
  const authCard = document.getElementById("profile-authenticated");
  
  if (state.user.loggedIn) {
    unauthCard.classList.add("hidden");
    authCard.classList.remove("hidden");
    
    document.getElementById("user-name").textContent = state.user.name;
    document.getElementById("user-email").textContent = state.user.email;
    document.getElementById("user-avatar").textContent = state.user.avatar;
    
    document.getElementById("stat-count-trips").textContent = state.savedTrips.length;
    document.getElementById("stat-count-clicks").textContent = state.kpi.clicks;
    renderProfileFriends();
  } else {
    unauthCard.classList.remove("hidden");
    authCard.classList.add("hidden");

    // Reset login form fields and active tab when rendering unauthenticated state
    const tabLogin = document.getElementById("tab-auth-login");
    const tabSignup = document.getElementById("tab-auth-signup");
    const groupName = document.getElementById("group-auth-name");
    const nameInput = document.getElementById("auth-input-name");
    const emailInput = document.getElementById("auth-input-email");
    const passwordInput = document.getElementById("auth-input-password");
    const submitBtn = document.getElementById("btn-email-auth-submit");

    if (tabLogin && tabSignup && groupName && submitBtn) {
      tabLogin.classList.add("active");
      tabSignup.classList.remove("active");
      groupName.style.display = "none";
      submitBtn.textContent = "로그인";
      if (nameInput) {
        nameInput.removeAttribute("required");
        nameInput.value = "";
      }
      if (emailInput) emailInput.value = "";
      if (passwordInput) passwordInput.value = "";
    }

    const emailAuthTrigger = document.getElementById("email-auth-trigger");
    const emailAuthContainer = document.getElementById("email-auth-container");
    if (emailAuthTrigger && emailAuthContainer) {
      emailAuthContainer.classList.add("hidden");
      emailAuthTrigger.style.display = "block";
    }
  }
}

// --- Explore Tab: Templates Render ---
function renderExploreTab() {
  updateKpiStats();
}

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
      <h3>${template.title.split(' (')[0]}</h3>
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
      <p>"<strong>${query}</strong>"에 매칭되는 추천 템플릿이 없습니다.</p>
      <span>다른 목적지(제주도, 도쿄, 오사카, 부산 등)를 입력해 보세요!</span>
    `;
    container.appendChild(noResult);
  }
}

function loadItineraryTemplate(template) {
  // Setup current active trip deep-cloning places
  state.activeTrip = {
    id: `template-${template.id}-${Date.now()}`,
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

// --- Planner: Style tags ---
const styleTags = document.querySelectorAll(".style-tags-container .style-tag");
styleTags.forEach(tag => {
  tag.addEventListener("click", () => {
    styleTags.forEach(t => t.classList.remove("active"));
    tag.classList.add("active");
  });
});

// --- Planner: AI Itinerary Generator form ---
function setupPlannerForm() {
  const form = document.getElementById("planner-form");
  const loadingOverlay = document.getElementById("planner-loading-overlay");
  const statusText = document.getElementById("loading-status-text");

  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    
    const dest = document.getElementById("input-destination").value.trim();
    const days = parseInt(document.getElementById("input-duration").value);
    const budget = document.getElementById("input-budget").value;
    
    let style = "relaxing";
    const activeStyleTag = document.querySelector(".style-tags-container .style-tag.active");
    if (activeStyleTag) {
      style = activeStyleTag.getAttribute("data-style");
    }

    if (!dest) {
      showToast("여행 목적지를 입력해 주세요.");
      return;
    }

    // Trigger loading spinner
    loadingOverlay.classList.add("active");
    
    // Status text update simulation
    const stages = [
      { text: "현지 실시간 여행 트렌드 파악 중...", delay: 500 },
      { text: "최적화된 일자별 동선 계산 중...", delay: 1100 },
      { text: "Agoda 및 Klook 실시간 최저가 예약 링크 연동 중...", delay: 1700 }
    ];

    stages.forEach(stage => {
      setTimeout(() => {
        statusText.textContent = stage.text;
      }, stage.delay);
    });

    // Mock compilation & load
    setTimeout(() => {
      // Run the mock AI generator from templates.js
      const places = window.generateItinerary(dest, days, budget, style);
      
      state.activeTrip = {
        id: `ai-gen-${Date.now()}`,
        title: `AI 추천 ${dest} ${days}일 여행`,
        destination: dest,
        days: days,
        budget: budget,
        style: style,
        places: places
      };
      ensurePlacePrices(state.activeTrip);
      state.activeTripDay = 1;
      
      // Update KPI Generations
      state.kpi.generations += 1;
      saveToLocalStorage();

      // Hide loading and show Itinerary view
      loadingOverlay.classList.remove("active");
      
      // Reset form
      document.getElementById("input-destination").value = "";
      
      showItineraryView();
      showToast("AI 추천 여행 일정이 생성되었습니다!");
    }, 2400);
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

// --- Itinerary View: Back, Save & Tab actions ---
function setupItineraryControls() {
  // Back Button
  document.getElementById("btn-itinerary-back").addEventListener("click", () => {
    if (state.activeTrip.id.startsWith("template-")) {
      switchTab("explore");
    } else {
      switchTab("planner");
    }
  });

  // Edit Mode Toggle Button
  const toggleEditBtn = document.getElementById("btn-toggle-edit-mode");
  if (toggleEditBtn) {
    toggleEditBtn.addEventListener("click", () => {
      state.editMode = !state.editMode;
      const timelineContainer = document.getElementById("timeline-places-container");
      if (timelineContainer) {
        timelineContainer.classList.toggle("edit-mode-active", state.editMode);
      }
      toggleEditBtn.classList.toggle("active", state.editMode);
      toggleEditBtn.textContent = state.editMode ? "완료" : "편집";
    });
  }

  // Save Button
  document.getElementById("btn-save-itinerary").addEventListener("click", () => {
    if (!state.activeTrip) return;
    
    // Check if trip already saved to update, otherwise insert new
    const index = state.savedTrips.findIndex(t => t.id === state.activeTrip.id);
    
    if (index > -1) {
      state.savedTrips[index] = JSON.parse(JSON.stringify(state.activeTrip));
      showToast("일정 수정사항이 반영되었습니다.");
    } else {
      // Clone activeTrip & add
      const tripToSave = JSON.parse(JSON.stringify(state.activeTrip));
      state.savedTrips.push(tripToSave);
      
      state.kpi.saves += 1;
    }
    
    saveToLocalStorage();

    // Transition to confirmation screen
    const confirmTitleEl = document.getElementById("confirm-trip-title");
    if (confirmTitleEl) {
      confirmTitleEl.textContent = state.activeTrip.title;
    }
    switchTab("confirmation");
    triggerConfetti();
  });

  // Place Add Drawer triggers
  const toggleBtn = document.getElementById("btn-toggle-add-place");
  const drawer = document.getElementById("add-place-drawer");
  const cancelBtn = document.getElementById("btn-cancel-add-place");
  const confirmBtn = document.getElementById("btn-confirm-add-place");

  toggleBtn.addEventListener("click", () => {
    drawer.classList.add("active");
    toggleBtn.classList.add("hidden");
  });

  cancelBtn.addEventListener("click", () => {
    closeAddPlaceDrawer();
  });

  confirmBtn.addEventListener("click", () => {
    const name = document.getElementById("add-place-name").value.trim();
    const time = document.getElementById("add-place-time").value.trim() || "시간 지정 없음";
    const category = document.getElementById("add-place-cat").value;
    const desc = document.getElementById("add-place-desc").value.trim();
    const priceInput = document.getElementById("add-place-price").value.trim();

    if (!name) {
      showToast("장소 이름을 입력해주세요.");
      return;
    }

    let price = priceInput ? parseInt(priceInput, 10) : NaN;
    if (isNaN(price) || price < 0) {
      price = getDeterministicPrice(name, category, state.activeTrip.budget);
    }

    // Generate simulated coordinates slightly offset from first place or base center
    let baseLat = 37.5665;
    let baseLng = 126.9780;
    
    const dayPlaces = state.activeTrip.places.filter(p => p.day === state.activeTripDay);
    if (dayPlaces.length > 0) {
      baseLat = dayPlaces[0].lat;
      baseLng = dayPlaces[0].lng;
    }

    const offsetLat = (Math.random() - 0.5) * 0.02;
    const offsetLng = (Math.random() - 0.5) * 0.02;

    const newPlace = {
      day: state.activeTripDay,
      id: `custom-${Date.now()}`,
      name: name,
      time: time,
      lat: baseLat + offsetLat,
      lng: baseLng + offsetLng,
      category: category,
      price: price,
      description: desc,
      bookingUrl: category === "hotel" 
        ? `https://www.agoda.com/search?q=${encodeURIComponent(name)}` 
        : `https://search.naver.com/search.naver?query=${encodeURIComponent(name)}`
    };

    // Smart insertion based on time order
    const activeDayPlaces = state.activeTrip.places.filter(p => p.day === state.activeTripDay);
    const newTimeVal = parseTimeToMinutes(newPlace.time);

    let insertIndex = -1;
    let targetRelativeIndex = -1;

    // Find the first place that is later than the new place, or is a hotel
    for (let i = 0; i < activeDayPlaces.length; i++) {
      const p = activeDayPlaces[i];
      
      // Hotels should always be at the end of the day, so insert before it
      if (p.category === "hotel") {
        targetRelativeIndex = i;
        break;
      }
      
      const pTimeVal = parseTimeToMinutes(p.time);
      if (newTimeVal !== 9999 && pTimeVal !== 9999 && newTimeVal < pTimeVal) {
        targetRelativeIndex = i;
        break;
      }
    }

    if (targetRelativeIndex > -1) {
      // Find the actual index of the target place in the global places array
      const targetPlace = activeDayPlaces[targetRelativeIndex];
      insertIndex = state.activeTrip.places.findIndex(p => p.id === targetPlace.id);
    } else {
      // If it should go to the end, find the index of the last place of this day
      let lastIndex = -1;
      for (let i = state.activeTrip.places.length - 1; i >= 0; i--) {
        if (state.activeTrip.places[i].day === state.activeTripDay) {
          lastIndex = i;
          break;
        }
      }
      if (lastIndex > -1) {
        insertIndex = lastIndex + 1;
      }
    }

    if (insertIndex > -1) {
      state.activeTrip.places.splice(insertIndex, 0, newPlace);
    } else {
      state.activeTrip.places.push(newPlace);
    }

    closeAddPlaceDrawer();
    renderTimeline();
    updateMapMarkers();
    showToast("장소가 일정에 추가되었습니다.");
  });
}

function closeAddPlaceDrawer() {
  const toggleBtn = document.getElementById("btn-toggle-add-place");
  const drawer = document.getElementById("add-place-drawer");
  
  drawer.classList.remove("active");
  toggleBtn.classList.remove("hidden");
  
  // Clear inputs
  document.getElementById("add-place-name").value = "";
  document.getElementById("add-place-time").value = "";
  document.getElementById("add-place-price").value = "";
  document.getElementById("add-place-desc").value = "";
}

// --- Itinerary: Screen Activation ---
function showItineraryView() {
  if (!state.activeTrip) return;

  // Ensure trip collaborators and comments are initialized
  ensureTripCollaboratorsAndComments(state.activeTrip);

  // Reset Edit Mode
  state.editMode = false;
  const toggleEditBtn = document.getElementById("btn-toggle-edit-mode");
  if (toggleEditBtn) {
    toggleEditBtn.classList.remove("active");
    toggleEditBtn.textContent = "편집";
  }

  // Direct active view transition
  switchTab("itinerary");

  // Setup Title
  document.getElementById("itinerary-title").textContent = state.activeTrip.title;

  // Reset Map collapse button state in senior mode
  const btnToggleMap = document.getElementById("btn-toggle-map");
  const mapWrapper = document.getElementById("map-wrapper");
  if (btnToggleMap && mapWrapper) {
    mapWrapper.classList.remove("show-senior-map");
    btnToggleMap.classList.remove("active");
    btnToggleMap.textContent = "🗺️ 지도 순서도 보기";
  }

  // Initialize Map wrapper
  setTimeout(() => {
    initLeafletMap();
    renderDayTabs();
    renderTimeline();
    updateMapMarkers();
    renderCollaboratorsBar();
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
    tab.textContent = `Day ${d}`;
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
  if (name.includes("택시")) {
    return "🚕 호출 앱(우버, 카카오T 등) 사용 권장 | 기본요금 수준 적용";
  } else if (name.includes("지하철") || name.includes("메트로")) {
    return "🚇 현지 교통카드(수이카, 이코카 등) 태그 또는 1회권 발권기 구매";
  } else if (name.includes("시내버스") || name.includes("버스")) {
    return "🚌 승차 시 교통카드를 태그하거나 현금을 잔돈 없이 준비하세요";
  } else if (name.includes("렌터카") || name.includes("차량")) {
    return "🚗 국제운전면허증 지참 필수 | 주차 사전 확인 권장";
  } else if (name.includes("도보")) {
    return "🚶 가까운 도보 코스 | 편안한 신발 착용 추천";
  }
  return "🚌 현지 대중교통 또는 도보로 편리하게 이동 가능";
}

function renderTimeline() {
  const container = document.getElementById("timeline-places-container");
  if (!container) return;

  container.innerHTML = "";

  // Show/Hide edit mode button based on senior mode
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

  // Update dynamic total budget
  if (state.activeTrip) {
    const totalBudget = state.activeTrip.places.reduce((sum, p) => sum + (p.price || 0), 0);
    const totalBudgetEl = document.getElementById("itinerary-total-budget");
    if (totalBudgetEl) {
      totalBudgetEl.textContent = `₩${totalBudget.toLocaleString()}`;
    }
  }
  
  const dayPlaces = state.activeTrip.places.filter(p => p.day === state.activeTripDay);
  
  if (dayPlaces.length === 0) {
    container.innerHTML = `<p class="empty-timeline-msg">일정에 등록된 장소가 없습니다. 아래 버튼으로 장소를 추가해보세요.</p>`;
    return;
  }

  dayPlaces.forEach((place, index) => {
    const card = document.createElement("div");
    card.className = "timeline-item";
    card.setAttribute("data-cat", place.category);
    
    // Convert category code to Korean name
    let catKorean = "관광";
    if (place.category === "restaurant") catKorean = "맛집";
    else if (place.category === "cafe") catKorean = "카페";
    else if (place.category === "hotel") catKorean = "숙소";
    else if (place.category === "transit") catKorean = "이동";
    else if (place.category === "shopping") catKorean = "쇼핑";

    // Setup edit index
    const isFirst = index === 0;
    const isLast = index === dayPlaces.length - 1;

    let isReservable = true;
    if (place.category === 'transit') {
      const name = place.name || '';
      const desc = place.description || '';
      // 일반 택시, 시내버스, 지하철, 도보 등 예약이 불가능한 교통수단은 예외 처리
      const nonReservableKeywords = ["택시", "지하철", "시내버스", "시내 버스", "메트로", "도보", "걷기", "렌터카", "렌트카", "정류장", "버스정류소", "버스정류장"];
      const hasNonReservable = nonReservableKeywords.some(kw => name.includes(kw) || desc.includes(kw));
      
      if (hasNonReservable) {
        isReservable = false;
      } else {
        const reservableKeywords = ["기차", "KTX", "SRT", "열차", "하루카", "스카이라이너", "항공", "비행기", "고속버스", "시외버스", "철도", "신칸센", "유로스타", "익스프레스", "리무진"];
        isReservable = reservableKeywords.some(kw => name.includes(kw) || desc.includes(kw));
      }
    }

    let controlsHtml = "";
    let otaButtonHtml = "";
    let transitGuideHtml = "";
    
    if (place.category === 'transit' && !isReservable) {
      // 일반 택시, 시내버스, 지하철은 예약 버튼 대신 경로 안내 표시
      transitGuideHtml = `
        <div class="transit-guide-box">
          <div class="guide-header">
            <span class="guide-icon">🗺️</span>
            <strong>타는 법 & 경로 안내</strong>
          </div>
          <div class="guide-body">
            <p class="guide-text">${place.description || '대중교통을 이용하여 다음 목적지로 이동합니다.'}</p>
            <div class="guide-tips">${getTransitTips(place.name)}</div>
          </div>
        </div>
      `;
    } else {
      // 예약 가능한 일반 장소/예약 가능 교통편
      otaButtonHtml = `
        <button class="btn-ota" onclick="handleOtaBookingClick('${place.name}', '${place.bookingUrl}', '${place.category}')">
          ${place.category === 'hotel' ? (state.seniorMode ? '🏨 최저가 예약하기' : '🏨 최저가 예약') : (state.seniorMode ? '🎟️ 예약하기' : '🎟️ 티켓 예매')} →
        </button>
      `;
    }

    if (state.seniorMode) {
      controlsHtml = `
        <button class="btn-ctrl btn-delete" onclick="deletePlace(${index})">🗑️ 장소 삭제하기</button>
        <button class="btn-ctrl btn-comments" style="background-color: var(--primary-light); color: var(--primary-solid); border: none;" onclick="openPlaceComments('${place.id}')">💬 한줄평 (${(place.comments || []).length}개)</button>
        ${otaButtonHtml}
      `;
    } else {
      controlsHtml = `
        <div class="edit-btn-group">
          <button class="btn-ctrl btn-delete" onclick="deletePlace(${index})">🗑️ 삭제</button>
        </div>
        ${otaButtonHtml}
      `;
    }

    const priceHtml = place.price === 0
      ? `<span class="place-price-tag free">무료</span>`
      : `<span class="place-price-tag">최저가 ₩${place.price.toLocaleString()}</span>`;

    if (state.seniorMode) {
      card.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-header-row">
          <span class="time-badge">🕒 ${place.time}</span>
          <span class="place-cat-badge cat-${place.category}">${catKorean}</span>
          ${priceHtml}
        </div>
        <div class="place-name">${index + 1}. ${place.name}</div>
        <div class="click-guide" style="font-size: 14px; color: var(--primary-solid); font-weight: bold; margin-top: 4px; display: flex; align-items: center; gap: 4px; user-select: none;">🔍 상세내용 보기 (누르세요)</div>
      `;
      card.onclick = () => {
        openSeniorDetailModal(place, index, catKorean, transitGuideHtml, controlsHtml);
      };
    } else {
      card.onclick = null;
      card.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-item-header">
          <span class="timeline-time">${place.time}</span>
          <span class="timeline-title-sep">—</span>
          <span class="timeline-place-name">${place.name}</span>
          ${priceHtml}
        </div>
        ${place.description && (place.category !== 'transit' || isReservable) ? `<p class="timeline-desc">${place.description}</p>` : ''}
        ${transitGuideHtml}
        <div class="timeline-actions">
          <button class="btn-timeline-comments" onclick="openPlaceComments('${place.id}')">💬 한줄평 (${(place.comments || []).length})</button>
          ${otaButtonHtml}
          <button class="timeline-delete-action" onclick="deletePlace(${index})">삭제</button>
        </div>
      `;
    }

    container.appendChild(card);
  });
}

// --- Timeline interactions: Reordering & Deleting ---
window.deletePlace = function(dayIndex) {
  if (!state.activeTrip) return;

  const dayPlaces = state.activeTrip.places.filter(p => p.day === state.activeTripDay);
  const targetPlace = dayPlaces[dayIndex];
  
  if (!targetPlace) return;

  const fullIdx = state.activeTrip.places.findIndex(p => p.id === targetPlace.id);
  
  if (fullIdx > -1) {
    state.activeTrip.places.splice(fullIdx, 1);
    
    // Close senior detail modal if open
    if (window.closeSeniorDetailModal) {
      window.closeSeniorDetailModal();
    }
    
    renderTimeline();
    updateMapMarkers();
    showToast("장소가 일정에서 삭제되었습니다.");
  }
};

// --- Leaflet Map Engine ---
function initLeafletMap() {
  const mapContainer = document.getElementById("map");
  if (!mapContainer) return;

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
  if (!leafletMap || !mapMarkersGroup) return;

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
        ${index + 1}. ${place.name}
      </div>
      <div class="map-popup-time">🕒 ${place.time}</div>
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

// --- OTA Booking Click Event Tracker ---
let pendingBooking = null; // Storing active booking redirection details

window.handleOtaBookingClick = function(placeName, url, category) {
  pendingBooking = { placeName, url, category };
  
  // Trigger overlay confirm modal
  const modal = document.getElementById("booking-modal-overlay");
  document.getElementById("modal-place-name").textContent = placeName;
  modal.classList.add("active");
};

function setupBookingModal() {
  const modal = document.getElementById("booking-modal-overlay");
  const cancelBtn = document.getElementById("btn-booking-cancel");
  const confirmBtn = document.getElementById("btn-booking-confirm");

  cancelBtn.addEventListener("click", () => {
    modal.classList.remove("active");
    pendingBooking = null;
  });

  confirmBtn.addEventListener("click", () => {
    if (pendingBooking) {
      // Record KPI click event
      state.kpi.clicks += 1;
      
      const log = {
        id: `click-${Date.now()}`,
        placeName: pendingBooking.placeName,
        category: pendingBooking.category,
        timestamp: new Date().toLocaleTimeString('ko-KR')
      };
      state.kpi.clickLogs.unshift(log); // Add at front
      
      saveToLocalStorage();
      updateKpiStats();

      // Launch actual redirect in new tab
      window.open(pendingBooking.url, '_blank');
      
      // Close modal
      modal.classList.remove("active");
      pendingBooking = null;
    }
  });
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

  if (timeEl) timeEl.innerHTML = `🕒 ${place.time}`;
  if (catEl) {
    catEl.className = `senior-modal-cat cat-${place.category}`;
    catEl.innerText = catKorean;
  }
  if (priceEl) {
    const isFree = place.price === 0;
    priceEl.className = `senior-modal-price-badge ${isFree ? 'free' : ''}`;
    priceEl.innerText = isFree ? '비용: 무료' : `최저가 ₩${place.price.toLocaleString()}`;
  }
  if (titleEl) titleEl.innerText = `${index + 1}. ${place.name}`;
  
  if (descEl) {
    const nonReservableKeywords = ["택시", "지하철", "시내버스", "시내 버스", "메트로", "도보", "걷기", "렌터카", "렌트카", "정류장", "버스정류소", "버스정류장"];
    const isReservable = !nonReservableKeywords.some(kw => (place.name || '').includes(kw) || (place.description || '').includes(kw));
    const showDesc = place.description && (place.category !== 'transit' || isReservable);
    if (showDesc) {
      descEl.style.display = "block";
      descEl.innerHTML = `<p class="place-description">${place.description}</p>`;
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
        <p style="font-size:11px; margin-top:4px;">AI 플래너를 이용해 나만의 여행 계획을 세워보세요.</p>
      </div>
    `;
    return;
  }

  state.savedTrips.forEach((trip, index) => {
    const card = document.createElement("div");
    card.className = "saved-trip-item";
    
    card.innerHTML = `
      <div class="saved-trip-info" onclick="loadSavedTrip('${trip.id}')">
        <h3>${trip.title}</h3>
        <p>📍 ${trip.destination} | 📅 ${trip.days}일 코스</p>
      </div>
      <button class="btn-ctrl btn-delete" style="padding:8px 12px; font-size:12px;" onclick="deleteSavedTrip('${trip.id}')">삭제</button>
    `;

    container.appendChild(card);
  });
}

window.loadSavedTrip = function(tripId) {
  const trip = state.savedTrips.find(t => t.id === tripId);
  if (!trip) return;

  state.activeTrip = JSON.parse(JSON.stringify(trip)); // Clone
  state.activeTripDay = 1;

  showItineraryView();
  showToast("저장된 일정을 로드했습니다.");
};

window.deleteSavedTrip = function(tripId) {
  const index = state.savedTrips.findIndex(t => t.id === tripId);
  if (index > -1) {
    const title = state.savedTrips[index].title;
    state.savedTrips.splice(index, 1);
    saveToLocalStorage();
    renderSavedTrips();
    showToast(`"${title}" 일정이 삭제되었습니다.`);
  }
};

// --- Admin KPI Dashboard Render ---
function updateKpiStats() {
  // Update CTR badge on Explore Tab
  const ctrEl = document.getElementById("micro-ctr");
  if (ctrEl) {
    const ctr = state.kpi.generations > 0 
      ? Math.round((state.kpi.clicks / state.kpi.generations) * 100) 
      : 0;
    ctrEl.textContent = `${ctr}%`;
  }
}

function renderKpiDashboard() {
  const genEl = document.getElementById("kpi-val-generations");
  const saveEl = document.getElementById("kpi-val-saves");
  const clickEl = document.getElementById("kpi-val-clicks");
  const ctrEl = document.getElementById("kpi-val-ctr");
  if (!genEl || !saveEl || !clickEl || !ctrEl) return;

  // Update numbers
  genEl.textContent = state.kpi.generations;
  saveEl.textContent = state.kpi.saves;
  clickEl.textContent = state.kpi.clicks;

  const ctr = state.kpi.generations > 0 
    ? Math.round((state.kpi.clicks / state.kpi.generations) * 100) 
    : 0;
  
  ctrEl.textContent = `${ctr}%`;

  // Draw SVG/CSS Chart
  renderKpiChart();

  // Render logs list
  renderKpiLogs();
}

function renderKpiChart() {
  const wrapper = document.getElementById("kpi-chart");
  if (!wrapper) return;

  wrapper.innerHTML = "";

  // Simulate days
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"];
  
  // Calculate relative simulation values base on real clicks
  const maxGenHeight = 80; // px limit
  
  // Generate mock generation heights slightly random but ending on real value
  const baseGens = [4, 7, 3, 9, 12, 10, state.kpi.generations];
  const baseClicks = [1, 2, 0, 3, 4, 3, state.kpi.clicks];

  // Find max for scaling
  const maxVal = Math.max(...baseGens, 10); // scale divisor

  days.forEach((day, idx) => {
    const gens = baseGens[idx];
    const clicks = baseClicks[idx];

    const genHeight = Math.round((gens / maxVal) * maxGenHeight) + 4;
    const clickHeight = Math.round((clicks / maxVal) * maxGenHeight) + 4;

    const col = document.createElement("div");
    col.className = "chart-bar-col";
    
    col.innerHTML = `
      <div class="chart-tooltip">생성: ${gens}회 | 클릭: ${clicks}회</div>
      <div style="display:flex; gap:3px; align-items:flex-end;">
        <div class="chart-bar" style="height:${genHeight}px;" title="일정 생성 수: ${gens}"></div>
        <div class="chart-bar click-bar" style="height:${clickHeight}px;" title="예약 클릭 수: ${clicks}"></div>
      </div>
      <span class="chart-label">${day}</span>
    `;

    wrapper.appendChild(col);
  });
}

function renderKpiLogs() {
  const container = document.getElementById("kpi-logs-list");
  if (!container) return;

  container.innerHTML = "";

  if (state.kpi.clickLogs.length === 0) {
    container.innerHTML = `<p class="empty-logs">아직 예약 링크 클릭이 발생하지 않았습니다.</p>`;
    return;
  }

  state.kpi.clickLogs.slice(0, 10).forEach(log => {
    const item = document.createElement("div");
    item.className = "log-item";
    
    let icon = "🎟️";
    if (log.category === "hotel") icon = "🏨";
    
    item.innerHTML = `
      <span class="time">${log.timestamp}</span>
      ${icon} <strong>${log.placeName}</strong> 예약 이동 완료 (KPI 전환 연동)
    `;
    
    container.appendChild(item);
  });
}

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

  // Update Form elements dynamic state
  updatePlannerFormForSeniorMode();
}

function updatePlannerFormForSeniorMode() {
  const budgetSelect = document.getElementById("input-budget");
  const styleTagsContainer = document.querySelector(".style-tags-container");
  if (!budgetSelect || !styleTagsContainer) return;
  
  if (state.seniorMode) {
    // Simplify budget selection
    if (!budgetSelect.dataset.originalOptions) {
      budgetSelect.dataset.originalOptions = budgetSelect.innerHTML;
    }
    budgetSelect.innerHTML = `
      <option value="medium" selected>적당하게 (일반 예산)</option>
    `;
    
    // Simplify style tags: keep relaxing & active, rename them, hide the others
    if (!styleTagsContainer.dataset.originalHtml) {
      styleTagsContainer.dataset.originalHtml = styleTagsContainer.innerHTML;
    }
    
    styleTagsContainer.innerHTML = `
      <span class="style-tag active" data-style="relaxing">🧘‍♀️ 편안한 휴양 여행</span>
      <span class="style-tag" data-style="active">🎒 즐거운 관광 여행</span>
    `;
    
    // Rebind click listeners to the new style tags
    const newTags = styleTagsContainer.querySelectorAll(".style-tag");
    newTags.forEach(tag => {
      tag.addEventListener("click", () => {
        newTags.forEach(t => t.classList.remove("active"));
        tag.classList.add("active");
      });
    });
  } else {
    // Restore original budget options
    if (budgetSelect.dataset.originalOptions) {
      budgetSelect.innerHTML = budgetSelect.dataset.originalOptions;
    }
    // Restore original style tags
    if (styleTagsContainer.dataset.originalHtml) {
      styleTagsContainer.innerHTML = styleTagsContainer.dataset.originalHtml;
      
      // Rebind click listeners to restored style tags
      const restoredTags = styleTagsContainer.querySelectorAll(".style-tag");
      restoredTags.forEach(tag => {
        tag.addEventListener("click", () => {
          restoredTags.forEach(t => t.classList.remove("active"));
          tag.classList.add("active");
        });
      });
    }
  }
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
        saveToLocalStorage();
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
        saveToLocalStorage();
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
      <h2 style="margin-top: 0; color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">${state.activeTrip.title} 여행 일정</h2>
      <div style="margin-bottom: 20px; background: #f8fafc; padding: 12px; border-radius: 8px; font-size: 14px;">
        <p style="margin: 4px 0;"><strong>목적지:</strong> ${state.activeTrip.destination || '미정'}</p>
        <p style="margin: 4px 0;"><strong>여행 기간:</strong> ${state.activeTrip.days}일</p>
        <p style="margin: 4px 0;"><strong>여행 스타일:</strong> ${state.activeTrip.style === 'relaxing' ? '힐링/휴양' : '관광/활동'}</p>
      </div>
  `;

  for (let d = 1; d <= state.activeTrip.days; d++) {
    const dayPlaces = state.activeTrip.places.filter(p => p.day === d);
    html += `<h3 style="color: #0f172a; margin-top: 24px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">Day ${d}</h3>`;
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
            <strong style="font-size: 16px;">[${place.time}] ${place.name}</strong> 
            <span style="font-size: 12px; background: #e0e7ff; color: #4f46e5; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">${catText}</span>
            ${place.price ? `<span style="font-size: 13px; color: #b45309; font-weight: bold; margin-left: 8px;">₩${place.price.toLocaleString()}</span>` : ''}
            ${place.description ? `<p style="margin: 4px 0 0 0; font-size: 13px; color: #475569;">${place.description}</p>` : ''}
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

function shareItinerary() {
  if (!state.activeTrip) return;
  const dummyLink = `${window.location.origin}${window.location.pathname}?trip=${state.activeTrip.id}`;
  
  navigator.clipboard.writeText(dummyLink).then(() => {
    showToast("공유 링크가 클립보드에 복사되었습니다!");
  }).catch(err => {
    console.error("클립보드 복사 실패: ", err);
    showToast("공유 링크 복사에 실패했습니다. 직접 복사해주세요: " + dummyLink);
  });
}

function downloadCalendarIcs() {
  if (!state.activeTrip) return;
  
  let icsContent = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Routy//NONSGML Itinerary//EN\r\n";
  
  const today = new Date();
  const formatIcsDate = (date) => {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };
  
  state.activeTrip.places.forEach((place, index) => {
    const eventDate = new Date();
    eventDate.setDate(today.getDate() + 1 + (place.day - 1));
    
    const [hours, minutes] = (place.time || "09:00").split(":").map(Number);
    eventDate.setHours(hours, minutes, 0, 0);
    
    const endDate = new Date(eventDate);
    endDate.setHours(eventDate.getHours() + 1);
    
    icsContent += "BEGIN:VEVENT\r\n";
    icsContent += `UID:event_${place.id || index}@routy.com\r\n`;
    icsContent += `DTSTAMP:${formatIcsDate(new Date())}\r\n`;
    icsContent += `DTSTART:${formatIcsDate(eventDate)}\r\n`;
    icsContent += `DTEND:${formatIcsDate(endDate)}\r\n`;
    icsContent += `SUMMARY:[Routy] ${place.name}\r\n`;
    icsContent += `DESCRIPTION:${(place.description || '').replace(/\n/g, '\\n')}\r\n`;
    icsContent += "END:VEVENT\r\n";
  });
  
  icsContent += "END:VCALENDAR";
  
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.activeTrip.title || 'trip'}_itinerary.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  showToast("캘린더 .ics 파일이 다운로드되었습니다.");
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

  destInfo.textContent = `${state.activeTrip.destination || '선택한'} 여행을 위한 추천 준비물입니다.`;
  
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
      saveToLocalStorage();
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
      saveToLocalStorage();
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

function ensureTripCollaboratorsAndComments(trip) {
  if (!trip) return;
  if (!trip.collaborators) {
    trip.collaborators = ['jiwon@routy.com', 'minsu@routy.com'];
  }
  if (!trip.places) trip.places = [];
  trip.places.forEach(place => {
    if (!place.id) {
      place.id = 'p_' + Math.random().toString(36).substr(2, 9);
    }
    if (!place.comments) {
      place.comments = [];
      const hash = hashCode(place.name || '');
      if (place.category === 'hotel') {
        place.comments.push({
          author: '이지원',
          email: 'jiwon@routy.com',
          text: '여기 평점이 진짜 좋더라구요! 근처 편의점도 가깝대요.',
          time: '어제'
        });
      } else if (place.category === 'restaurant') {
        if (hash % 2 === 0) {
          place.comments.push({
            author: '김민수',
            email: 'minsu@routy.com',
            text: '여기 웨이팅이 좀 길대요. 오픈런 해야할듯!',
            time: '2일 전'
          });
        }
      }
    }
  });
}

function renderCollaboratorsBar() {
  const container = document.getElementById("itinerary-collab-avatars");
  if (!container || !state.activeTrip) return;

  container.innerHTML = "";

  const youDiv = document.createElement("div");
  youDiv.className = "collab-avatar me";
  youDiv.textContent = state.user.loggedIn ? state.user.avatar || '👤' : '👤';
  youDiv.title = `나 (${state.user.loggedIn ? state.user.name : '여행자'}) - 온라인`;
  
  const onlineBadgeMe = document.createElement("span");
  onlineBadgeMe.className = "online-dot";
  youDiv.appendChild(onlineBadgeMe);
  container.appendChild(youDiv);

  const collaborators = state.activeTrip.collaborators || [];
  collaborators.forEach(email => {
    const friend = state.friends.find(f => f.email === email);
    if (!friend) return;

    const friendDiv = document.createElement("div");
    friendDiv.className = "collab-avatar";
    
    let avatar = '👤';
    if (friend.name.includes("민수")) avatar = '👦';
    else if (friend.name.includes("지원")) avatar = '👩';
    else if (friend.name.includes("태양")) avatar = '👨';
    else if (friend.name.includes("수아")) avatar = '👧';
    else if (friend.name.includes("영희")) avatar = '👩';
    else if (friend.name.includes("철수")) avatar = '👦';
    
    friendDiv.textContent = avatar;
    friendDiv.title = `${friend.name} (${friend.email}) - ${friend.online ? '온라인' : '오프라인'}`;
    
    const onlineBadge = document.createElement("span");
    onlineBadge.className = friend.online ? "online-dot" : "online-dot offline";
    friendDiv.appendChild(onlineBadge);
    
    container.appendChild(friendDiv);
  });
}

function setupCollaborationUI() {
  const btnCollabInvite = document.getElementById("btn-collab-invite");
  const overlayCollab = document.getElementById("collab-invite-modal-overlay");
  const btnCloseCollab = document.getElementById("btn-close-collab-modal");
  
  const selectInvite = document.getElementById("collab-invite-select");
  const btnSendCollab = document.getElementById("btn-send-collab-invite");
  const btnTriggerSim = document.getElementById("btn-trigger-simulation");

  if (btnCollabInvite) {
    btnCollabInvite.addEventListener("click", () => {
      openCollabModal();
    });
  }

  if (btnCloseCollab) {
    btnCloseCollab.addEventListener("click", () => {
      if (overlayCollab) overlayCollab.classList.remove("active");
    });
  }

  if (btnSendCollab) {
    btnSendCollab.addEventListener("click", () => {
      const email = selectInvite.value;
      if (!email) {
        showToast("초대할 친구를 선택해주세요.");
        return;
      }
      
      if (!state.activeTrip) return;
      if (!state.activeTrip.collaborators) state.activeTrip.collaborators = [];
      
      if (state.activeTrip.collaborators.includes(email)) {
        showToast("이미 이 일정에 참여 중인 친구입니다.");
        return;
      }
      
      state.activeTrip.collaborators.push(email);
      saveToLocalStorage();
      renderCollaboratorsBar();
      openCollabModal();
      showToast("친구를 일정에 초대했습니다.");
      
      const friendObj = state.friends.find(f => f.email === email);
      if (friendObj) {
        addCollabLog(`${friendObj.name}님이 일정에 참여했습니다.`);
      }
    });
  }

  if (btnTriggerSim) {
    btnTriggerSim.addEventListener("click", () => {
      simulateFriendActivity();
    });
  }

  const commentForm = document.getElementById("comment-submit-form");
  if (commentForm) {
    commentForm.addEventListener("submit", (e) => {
      e.preventDefault();
      addPlaceComment();
    });
  }
  
  const btnCloseComments = document.getElementById("btn-close-comments-drawer");
  if (btnCloseComments) {
    btnCloseComments.addEventListener("click", () => {
      closeCommentsDrawer();
    });
  }

  const btnAddFriend = document.getElementById("btn-add-friend-action");
  const inputAddFriendEmail = document.getElementById("friend-add-email");
  
  if (btnAddFriend && inputAddFriendEmail) {
    btnAddFriend.addEventListener("click", () => {
      const email = inputAddFriendEmail.value.trim();
      if (!email) {
        showToast("친구 이메일을 입력해주세요.");
        return;
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showToast("올바른 이메일 형식이 아닙니다.");
        return;
      }

      if (state.friends.some(f => f.email === email)) {
        showToast("이미 친구 목록에 등록되어 있습니다.");
        return;
      }

      const name = email.split('@')[0];
      const newFriend = {
        name: name,
        email: email,
        online: Math.random() > 0.3
      };

      state.friends.push(newFriend);
      saveToLocalStorage();
      renderProfileFriends();
      inputAddFriendEmail.value = "";
      showToast(`${name}님이 친구 목록에 추가되었습니다.`);
    });
    
    inputAddFriendEmail.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        btnAddFriend.click();
      }
    });
  }
}

function openCollabModal() {
  const overlay = document.getElementById("collab-invite-modal-overlay");
  const membersList = document.getElementById("collab-members-list");
  const inviteSelect = document.getElementById("collab-invite-select");
  
  if (!overlay || !membersList || !inviteSelect || !state.activeTrip) return;

  membersList.innerHTML = "";
  
  const meDiv = document.createElement("div");
  meDiv.className = "collab-member-item";
  meDiv.style.display = "flex";
  meDiv.style.alignItems = "center";
  meDiv.style.justifyContent = "space-between";
  meDiv.style.padding = "8px 0";
  meDiv.style.borderBottom = "1px solid #e2e8f0";
  meDiv.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span>${state.user.loggedIn ? state.user.avatar || '👤' : '👤'}</span>
      <strong>${state.user.loggedIn ? state.user.name : '나 (여행자)'}</strong>
      <span style="font-size: 11px; background: #e2e8f0; padding: 2px 6px; border-radius: 99px;">방장</span>
    </div>
  `;
  membersList.appendChild(meDiv);

  const collaborators = state.activeTrip.collaborators || [];
  collaborators.forEach(email => {
    const friend = state.friends.find(f => f.email === email);
    if (!friend) return;
    
    let avatar = '👤';
    if (friend.name.includes("민수")) avatar = '👦';
    else if (friend.name.includes("지원")) avatar = '👩';
    else if (friend.name.includes("태양")) avatar = '👨';
    else if (friend.name.includes("수아")) avatar = '👧';
    else if (friend.name.includes("영희")) avatar = '👩';
    else if (friend.name.includes("철수")) avatar = '👦';

    const div = document.createElement("div");
    div.className = "collab-member-item";
    div.style.display = "flex";
    div.style.alignItems = "center";
    div.style.justifyContent = "space-between";
    div.style.padding = "8px 0";
    div.style.borderBottom = "1px solid #e2e8f0";
    div.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span>${avatar}</span>
        <span>${friend.name} (${friend.email})</span>
        <span style="width: 8px; height: 8px; border-radius: 50%; background: ${friend.online ? '#10b981' : '#94a3b8'};"></span>
      </div>
      <button class="btn btn-sm" style="background: none; border: none; color: #ef4444; cursor: pointer;" onclick="removeCollaborator('${email}')">제거</button>
    `;
    membersList.appendChild(div);
  });

  inviteSelect.innerHTML = `<option value="">초대할 친구 선택...</option>`;
  state.friends.forEach(friend => {
    if (!collaborators.includes(friend.email)) {
      const option = document.createElement("option");
      option.value = friend.email;
      option.textContent = `${friend.name} (${friend.email})`;
      inviteSelect.appendChild(option);
    }
  });

  renderCollabLogs();
  overlay.classList.add("active");
}

window.removeCollaborator = function(email) {
  if (!state.activeTrip) return;
  if (!state.activeTrip.collaborators) return;
  
  const index = state.activeTrip.collaborators.indexOf(email);
  if (index > -1) {
    state.activeTrip.collaborators.splice(index, 1);
    saveToLocalStorage();
    renderCollaboratorsBar();
    openCollabModal();
    showToast("참여자가 일정에서 제외되었습니다.");
    
    const friend = state.friends.find(f => f.email === email);
    if (friend) {
      addCollabLog(`${friend.name}님이 일정에서 제외되었습니다.`);
    }
  }
};

function renderCollabLogs() {
  const logBox = document.getElementById("collab-log-box");
  if (!logBox || !state.activeTrip) return;

  if (!state.activeTrip.collabLogs) {
    state.activeTrip.collabLogs = [
      { text: "일정 공동 편집 세션이 시작되었습니다.", time: "방금 전" }
    ];
    
    if (state.activeTrip.collaborators && state.activeTrip.collaborators.length > 0) {
      const firstCollab = state.friends.find(f => f.email === state.activeTrip.collaborators[0]);
      if (firstCollab) {
        state.activeTrip.collabLogs.push({
          text: `${firstCollab.name}님이 일정에 접속했습니다.`,
          time: "1분 전"
        });
      }
    }
  }

  logBox.innerHTML = "";
  state.activeTrip.collabLogs.forEach(log => {
    const p = document.createElement("p");
    p.style.margin = "4px 0";
    p.style.fontSize = "13px";
    p.style.color = "var(--slate-600)";
    p.innerHTML = `<span style="color: var(--slate-400); margin-right: 6px;">[${log.time}]</span>${log.text}`;
    logBox.appendChild(p);
  });
  logBox.scrollTop = logBox.scrollHeight;
}

function addCollabLog(text) {
  if (!state.activeTrip) return;
  if (!state.activeTrip.collabLogs) state.activeTrip.collabLogs = [];
  
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  
  state.activeTrip.collabLogs.push({
    text: text,
    time: timeStr
  });
  
  saveToLocalStorage();
  renderCollabLogs();
}

function simulateFriendActivity() {
  if (!state.activeTrip) return;

  if (!state.activeTrip.collaborators) state.activeTrip.collaborators = [];
  if (!state.activeTrip.collaborators.includes("minsu@routy.com")) {
    state.activeTrip.collaborators.push("minsu@routy.com");
    saveToLocalStorage();
    renderCollaboratorsBar();
  }

  showToast("김민수님의 가상 협업 시뮬레이션이 시작되었습니다. (3초 뒤 자동 삽입)");
  
  const overlayCollab = document.getElementById("collab-invite-modal-overlay");
  if (overlayCollab) overlayCollab.classList.remove("active");

  addCollabLog("김민수님이 맛집 '하나 식당'을 14:00 슬롯에 추가 조율 중입니다...");

  setTimeout(() => {
    if (!state.activeTrip) return;

    const currentDay = state.activeTripDay;
    const newPlace = {
      id: 'p_sim_' + Date.now(),
      day: currentDay,
      time: "14:00",
      name: "하나 식당",
      category: "restaurant",
      description: "김민수 추천: 현지인들이 줄 서는 라멘 맛집! 꼭 가봐야 한대요.",
      lat: 35.0062,
      lng: 135.7709,
      price: 15000,
      comments: [
        {
          author: "김민수",
          email: "minsu@routy.com",
          text: "여기 간장 라멘이랑 가라아게 세트가 엄청 유명해요!!",
          time: "방금 전"
        }
      ]
    };

    const existingPlaces = state.activeTrip.places.filter(p => p.day === currentDay);
    if (existingPlaces.length > 0) {
      newPlace.lat = existingPlaces[0].lat + (Math.random() - 0.5) * 0.01;
      newPlace.lng = existingPlaces[0].lng + (Math.random() - 0.5) * 0.01;
    } else {
      newPlace.lat = 35.6895;
      newPlace.lng = 139.6917;
    }

    const timeInMins = parseTimeToMinutes(newPlace.time);
    let insertIndex = -1;
    for (let i = 0; i < state.activeTrip.places.length; i++) {
      const p = state.activeTrip.places[i];
      if (parseTimeToMinutes(p.time) > timeInMins) {
        insertIndex = i;
        break;
      }
    }

    if (insertIndex > -1) {
      state.activeTrip.places.splice(insertIndex, 0, newPlace);
    } else {
      state.activeTrip.places.push(newPlace);
    }

    saveToLocalStorage();
    renderTimeline();
    updateMapMarkers();
    
    showToast("김민수님이 '하나 식당'을 일정에 추가했습니다!");
    addCollabLog("김민수님이 '하나 식당'을 일정에 추가했습니다.");
  }, 3000);
}

let activeCommentPlaceId = null;

function openPlaceComments(placeId) {
  if (!state.activeTrip) return;
  
  const place = state.activeTrip.places.find(p => p.id === placeId);
  if (!place) return;

  activeCommentPlaceId = placeId;
  
  const titleEl = document.getElementById("comments-drawer-title");
  if (titleEl) {
    titleEl.textContent = `📍 ${place.name} 한줄평`;
  }

  renderPlaceCommentsList();

  const overlay = document.getElementById("place-comments-drawer-overlay");
  if (overlay) {
    overlay.classList.add("active");
  }
}

function closeCommentsDrawer() {
  const overlay = document.getElementById("place-comments-drawer-overlay");
  if (overlay) {
    overlay.classList.remove("active");
  }
  activeCommentPlaceId = null;
}

function renderPlaceCommentsList() {
  const container = document.getElementById("comments-list-container");
  if (!container || !state.activeTrip || !activeCommentPlaceId) return;

  const place = state.activeTrip.places.find(p => p.id === activeCommentPlaceId);
  if (!place) return;

  container.innerHTML = "";

  const comments = place.comments || [];
  if (comments.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--slate-400); margin-top: 40px; font-size: 14px;">아직 댓글이 없습니다.<br>의견을 남겨 첫 소통을 시작해보세요!</p>`;
    return;
  }

  comments.forEach(comment => {
    const bubble = document.createElement("div");
    const isMe = state.user.loggedIn 
      ? comment.email === state.user.email 
      : comment.email === "me@routy.com" || comment.author === "나";
    
    bubble.className = isMe ? "comment-bubble me" : "comment-bubble other";
    
    bubble.style.display = "flex";
    bubble.style.flexDirection = "column";
    bubble.style.margin = "12px 0";
    bubble.style.alignItems = isMe ? "flex-end" : "flex-start";

    const authorSpan = document.createElement("span");
    authorSpan.textContent = comment.author;
    authorSpan.style.fontSize = "11px";
    authorSpan.style.color = "var(--slate-500)";
    authorSpan.style.marginBottom = "3px";
    authorSpan.style.padding = "0 4px";

    const contentDiv = document.createElement("div");
    contentDiv.textContent = comment.text;
    contentDiv.style.padding = "10px 14px";
    contentDiv.style.borderRadius = "14px";
    contentDiv.style.fontSize = "14px";
    contentDiv.style.lineHeight = "1.4";
    contentDiv.style.maxWidth = "75%";
    
    if (isMe) {
      contentDiv.style.background = "var(--primary-gradient)";
      contentDiv.style.color = "#ffffff";
      contentDiv.style.borderTopRightRadius = "2px";
    } else {
      contentDiv.style.background = "var(--slate-100)";
      contentDiv.style.color = "var(--slate-800)";
      contentDiv.style.borderTopLeftRadius = "2px";
    }

    const timeSpan = document.createElement("span");
    timeSpan.textContent = comment.time;
    timeSpan.style.fontSize = "9px";
    timeSpan.style.color = "var(--slate-400)";
    timeSpan.style.marginTop = "2px";
    timeSpan.style.padding = "0 4px";

    bubble.appendChild(authorSpan);
    bubble.appendChild(contentDiv);
    bubble.appendChild(timeSpan);
    container.appendChild(bubble);
  });

  container.scrollTop = container.scrollHeight;
}

function addPlaceComment() {
  if (!state.activeTrip || !activeCommentPlaceId) return;

  const place = state.activeTrip.places.find(p => p.id === activeCommentPlaceId);
  if (!place) return;

  const input = document.getElementById("comment-input");
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  if (!place.comments) place.comments = [];

  const author = state.user.loggedIn ? state.user.name : "나";
  const email = state.user.loggedIn ? state.user.email : "me@routy.com";
  
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  place.comments.push({
    author: author,
    email: email,
    text: text,
    time: timeStr
  });

  input.value = "";
  saveToLocalStorage();
  renderPlaceCommentsList();
  renderTimeline();
}

function renderProfileFriends() {
  const container = document.getElementById("profile-friends-list");
  const countBadge = document.getElementById("friends-count-badge");
  if (!container) return;

  container.innerHTML = "";
  const friends = state.friends || [];
  
  if (countBadge) {
    countBadge.textContent = `${friends.length}명`;
  }

  if (friends.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--slate-400); padding: 20px; font-size: 14px;">아직 추가된 친구가 없습니다.</p>`;
    return;
  }

  friends.forEach(friend => {
    const item = document.createElement("div");
    item.className = "friend-item";
    item.style.display = "flex";
    item.style.alignItems = "center";
    item.style.justifyContent = "space-between";
    item.style.padding = "10px 12px";
    item.style.background = "var(--glass-bg)";
    item.style.border = "1px solid var(--border-color)";
    item.style.borderRadius = "8px";
    item.style.marginBottom = "8px";

    let avatar = '👤';
    if (friend.name.includes("민수")) avatar = '👦';
    else if (friend.name.includes("지원")) avatar = '👩';
    else if (friend.name.includes("태양")) avatar = '👨';
    else if (friend.name.includes("수아")) avatar = '👧';
    else if (friend.name.includes("영희")) avatar = '👩';
    else if (friend.name.includes("철수")) avatar = '👦';

    item.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 20px;">${avatar}</span>
        <div style="display: flex; flex-direction: column;">
          <strong style="font-size: 14px;">${friend.name}</strong>
          <span style="font-size: 11px; color: var(--slate-500);">${friend.email}</span>
        </div>
        <span style="width: 8px; height: 8px; border-radius: 50%; background: ${friend.online ? '#10b981' : '#94a3b8'}; margin-left: 4px;" title="${friend.online ? '온라인' : '오프라인'}"></span>
      </div>
      <button class="btn btn-sm" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 13px;" onclick="removeFriend('${friend.email}')">삭제</button>
    `;
    container.appendChild(item);
  });
}

window.removeFriend = function(email) {
  const index = state.friends.findIndex(f => f.email === email);
  if (index > -1) {
    const friendName = state.friends[index].name;
    state.friends.splice(index, 1);
    saveToLocalStorage();
    renderProfileFriends();
    showToast(`${friendName}님이 친구 목록에서 삭제되었습니다.`);
    
    if (state.activeTrip && state.activeTrip.collaborators) {
      const collabIndex = state.activeTrip.collaborators.indexOf(email);
      if (collabIndex > -1) {
        state.activeTrip.collaborators.splice(collabIndex, 1);
        saveToLocalStorage();
        renderCollaboratorsBar();
      }
    }
  }
};
