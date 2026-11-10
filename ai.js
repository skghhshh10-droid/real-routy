// Routy - 외부 서비스 모듈
// 1) Gemini API로 실제 여행 일정 생성/수정
// 2) OpenStreetMap Nominatim 장소 검색(좌표)
// 3) 일정 공유 링크 인코딩/디코딩

(function () {
  const SETTINGS_KEY = "routy_settings";
  const DEFAULT_MODEL = "gemini-3.8-flash";
  const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
  const CATEGORIES = ["sightseeing", "restaurant", "cafe", "shopping", "hotel", "transit"];

  // ---------- 설정 ----------
  function getSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      return { apiKey: s.apiKey || "", model: s.model || DEFAULT_MODEL };
    } catch (e) {
      return { apiKey: "", model: DEFAULT_MODEL };
    }
  }

  function saveSettings(partial) {
    const next = Object.assign(getSettings(), partial);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    return next;
  }

  function hasApiKey() {
    return !!getSettings().apiKey;
  }

  // ---------- Gemini 호출 ----------
  const STYLE_LABELS = {
    relaxing: "힐링/휴양",
    active: "액티비티/관광",
    foodie: "맛집 투어",
    shopping: "쇼핑/감성카페",
    cultural: "역사/문화"
  };
  const BUDGET_LABELS = {
    low: "가성비 위주(저렴하게)",
    medium: "보통",
    high: "고급/럭셔리"
  };

  const OUTPUT_SPEC = `
반드시 아래 형식의 JSON 객체 하나만 출력하세요. 설명 문장이나 코드블록 표시는 쓰지 마세요.
{
  "title": "일정 제목 (예: 교토 단풍 2박3일)",
  "summary": "일정 전체 요약 1~2문장",
  "places": [
    {
      "day": 1,
      "time": "09:00 - 10:30",
      "name": "실제 장소의 정확한 이름 (현지에서 검색 가능한 이름)",
      "category": "sightseeing | restaurant | cafe | shopping | hotel | transit 중 하나",
      "lat": 35.0,
      "lng": 135.0,
      "description": "무엇을 하는지, 팁, 이동 방법 등 1~2문장 (한국어)",
      "price": 15000
    }
  ],
  "tips": ["이 여행에 맞는 준비물/주의사항 3~6개 (짧게)"]
}
규칙:
- 실제로 존재하는 장소만 사용하고, lat/lng는 그 장소의 실제 좌표(소수점 4자리 이상)로 적으세요.
- price는 1인 기준 예상 비용을 원화(KRW) 정수로. 무료면 0.
- time은 24시간제 "HH:MM - HH:MM" 형식. 하루 일정은 시간 순서대로.
- 하루에 4~7곳. 이동 동선이 짧도록 가까운 곳끼리 묶으세요.
- 숙박이 있는 날(마지막 날 제외)은 그날 마지막에 숙소(category "hotel")를 넣으세요.
- 장거리 이동(공항, 기차 등)은 category "transit"으로 넣으세요.`;

  function buildCreatePrompt(input) {
    const styles = (input.styles || []).map(s => STYLE_LABELS[s] || s).join(", ") || "자유";
    const lines = [
      "당신은 한국인 여행자를 위한 전문 여행 플래너입니다. 아래 조건으로 실제 여행 일정을 만들어 주세요.",
      `- 목적지: ${input.destination}`,
      `- 기간: ${input.days}일${input.days > 1 ? ` (${input.days - 1}박 ${input.days}일)` : " (당일치기)"}`,
      input.startDate ? `- 출발일: ${input.startDate} (계절/요일/휴무일을 고려하세요)` : "",
      input.party ? `- 동행: ${input.party}` : "",
      `- 예산: ${BUDGET_LABELS[input.budget] || "보통"}`,
      `- 선호 스타일: ${styles}`,
      input.request ? `- 추가 요청: ${input.request}` : "",
      OUTPUT_SPEC
    ];
    return lines.filter(Boolean).join("\n");
  }

  function buildRefinePrompt(trip, instruction) {
    const slim = {
      title: trip.title,
      destination: trip.destination,
      days: trip.days,
      startDate: trip.startDate || null,
      places: trip.places.map(p => ({
        day: p.day, time: p.time, name: p.name, category: p.category,
        lat: p.lat, lng: p.lng, description: p.description, price: p.price
      }))
    };
    return [
      "당신은 한국인 여행자를 위한 전문 여행 플래너입니다. 아래는 현재 여행 일정(JSON)입니다.",
      JSON.stringify(slim),
      "",
      `사용자 요청: ${instruction}`,
      "",
      "요청을 반영해 수정된 전체 일정을 다시 출력하세요. 요청과 관계없는 부분은 최대한 그대로 유지하세요.",
      `일수(days)는 ${trip.days}일입니다. 요청이 일수 변경을 원하면 places의 day 값으로 반영하세요.`,
      OUTPUT_SPEC
    ].join("\n");
  }

  function extractJson(text) {
    let t = (text || "").trim();
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    try {
      return JSON.parse(t);
    } catch (e) {
      const start = t.indexOf("{");
      const end = t.lastIndexOf("}");
      if (start > -1 && end > start) {
        return JSON.parse(t.slice(start, end + 1));
      }
      throw new Error("AI 응답을 해석하지 못했습니다. 다시 시도해 주세요.");
    }
  }

  async function callGemini(prompt, { signal } = {}) {
    const { apiKey, model } = getSettings();
    if (!apiKey) throw new Error("설정에서 Gemini API 키를 먼저 등록해 주세요.");

    let res;
    try {
      res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        }),
        signal
      });
    } catch (e) {
      if (e.name === "AbortError") throw new Error("요청 시간이 초과되었습니다. 다시 시도해 주세요.");
      throw new Error("네트워크 오류로 AI에 연결하지 못했습니다.");
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data.error && data.error.message) || res.statusText;
      if (res.status === 400 && /api key/i.test(msg)) throw new Error("API 키가 올바르지 않습니다. 설정에서 확인해 주세요.");
      if (res.status === 403) throw new Error("API 키 권한이 없습니다. (키 제한 설정 확인)");
      if (res.status === 404) throw new Error(`모델 "${model}"을 찾을 수 없습니다. 설정에서 모델명을 확인해 주세요.`);
      if (res.status === 429) throw new Error("API 사용 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.");
      throw new Error(`AI 오류 (${res.status}): ${msg}`);
    }

    const cand = data.candidates && data.candidates[0];
    const parts = (cand && cand.content && cand.content.parts) || [];
    const text = parts.filter(p => !p.thought && typeof p.text === "string").map(p => p.text).join("");
    if (!text) {
      const reason = (cand && cand.finishReason) || (data.promptFeedback && data.promptFeedback.blockReason) || "빈 응답";
      throw new Error(`AI가 일정을 만들지 못했습니다 (${reason}).`);
    }
    return extractJson(text);
  }

  function normalizePlan(raw, days, fallbackCenter) {
    const places = Array.isArray(raw.places) ? raw.places : [];
    const center = fallbackCenter || { lat: 37.5665, lng: 126.978 };
    const stamp = Date.now();
    const out = places
      .filter(p => p && p.name)
      .map((p, i) => {
        let day = parseInt(p.day, 10);
        if (!day || day < 1) day = 1;
        if (day > days) day = days;
        const lat = parseFloat(p.lat);
        const lng = parseFloat(p.lng);
        const validCoord = isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
        const price = parseInt(p.price, 10);
        return {
          day,
          id: `ai-${stamp}-${i}`,
          name: String(p.name).trim(),
          time: String(p.time || "").trim() || "시간 미정",
          lat: validCoord ? lat : center.lat,
          lng: validCoord ? lng : center.lng,
          coordMissing: !validCoord,
          category: CATEGORIES.includes(p.category) ? p.category : "sightseeing",
          description: String(p.description || "").trim(),
          price: isFinite(price) && price >= 0 ? price : undefined
        };
      });
    if (out.length === 0) throw new Error("AI가 장소를 하나도 만들지 못했습니다. 조건을 바꿔 다시 시도해 주세요.");
    return {
      title: raw.title ? String(raw.title).trim() : "",
      summary: raw.summary ? String(raw.summary).trim() : "",
      tips: Array.isArray(raw.tips) ? raw.tips.map(String).filter(Boolean).slice(0, 8) : [],
      places: out
    };
  }

  async function generateTrip(input, opts) {
    const raw = await callGemini(buildCreatePrompt(input), opts);
    return normalizePlan(raw, input.days);
  }

  async function refineTrip(trip, instruction, opts) {
    const raw = await callGemini(buildRefinePrompt(trip, instruction), opts);
    const center = trip.places[0] ? { lat: trip.places[0].lat, lng: trip.places[0].lng } : null;
    return normalizePlan(raw, trip.days, center);
  }

  async function testApiKey() {
    const raw = await callGemini('{"ok": true} 라는 JSON만 그대로 출력하세요.');
    return !!raw;
  }

  // ---------- 장소 검색 (OpenStreetMap Nominatim) ----------
  async function searchPlaces(query, near) {
    const params = new URLSearchParams({
      format: "jsonv2",
      q: query,
      limit: "6",
      "accept-language": "ko,en"
    });
    if (near) {
      const d = 0.6;
      params.set("viewbox", `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
    }
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "Accept": "application/json" }
    });
    if (!res.ok) throw new Error("장소 검색에 실패했습니다.");
    const list = await res.json();
    return list.map(r => ({
      name: r.name || (r.display_name || "").split(",")[0],
      address: r.display_name,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon)
    }));
  }

  // ---------- 공유 링크 ----------
  function bytesToB64url(bytes) {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64urlToBytes(str) {
    const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  async function streamBytes(bytes, stream) {
    const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await out.arrayBuffer());
  }

  async function encodeTrip(trip) {
    const slim = {
      t: trip.title, d: trip.destination, n: trip.days, b: trip.budget, s: trip.startDate || "",
      p: trip.places.map(p => [p.day, p.time, p.name, p.category, +(+p.lat).toFixed(5), +(+p.lng).toFixed(5), p.description || "", p.price || 0])
    };
    const bytes = new TextEncoder().encode(JSON.stringify(slim));
    if (typeof CompressionStream !== "undefined") {
      return "z" + bytesToB64url(await streamBytes(bytes, new CompressionStream("deflate-raw")));
    }
    return "j" + bytesToB64url(bytes);
  }

  async function decodeTrip(code) {
    const kind = code[0];
    let bytes = b64urlToBytes(code.slice(1));
    if (kind === "z") bytes = await streamBytes(bytes, new DecompressionStream("deflate-raw"));
    const o = JSON.parse(new TextDecoder().decode(bytes));
    const stamp = Date.now();
    return {
      id: `shared-${stamp}`,
      title: o.t, destination: o.d, days: o.n, budget: o.b || "medium", startDate: o.s || "",
      places: o.p.map((a, i) => ({
        day: a[0], time: a[1], name: a[2], category: CATEGORIES.includes(a[3]) ? a[3] : "sightseeing",
        lat: a[4], lng: a[5], description: a[6], price: a[7], id: `sh-${stamp}-${i}`
      }))
    };
  }

  window.RoutyAI = {
    DEFAULT_MODEL,
    getSettings, saveSettings, hasApiKey,
    generateTrip, refineTrip, testApiKey,
    searchPlaces, encodeTrip, decodeTrip
  };
})();
