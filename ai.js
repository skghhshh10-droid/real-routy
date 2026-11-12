// Routy - 외부 서비스 모듈
// 1) Gemini API로 실제 여행 일정 생성/수정
// 2) OpenStreetMap Nominatim 장소 검색(좌표)
// 3) 일정 공유 링크 인코딩/디코딩

(function () {
  const SETTINGS_KEY = "routy_settings";
  const DEFAULT_MODEL = "gemini-3.8-flash";
  // 네이버 지도 Client ID (등록한 github.io 주소에서만 동작하는 공개용 키)
  const DEFAULT_NAVER_KEY = "btolm1xold";
  const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
  const CATEGORIES = ["sightseeing", "restaurant", "cafe", "shopping", "hotel", "transit"];

  // ---------- 설정 ----------
  function getSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      return {
        apiKey: s.apiKey || "",
        model: s.model || DEFAULT_MODEL,
        kakaoKey: s.kakaoKey || "",
        naverKey: s.naverKey === undefined ? DEFAULT_NAVER_KEY : s.naverKey
      };
    } catch (e) {
      return { apiKey: "", model: DEFAULT_MODEL, kakaoKey: "", naverKey: DEFAULT_NAVER_KEY };
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
      "name": "장소 이름 (한국어 표기)",
      "searchName": "지도에서 검색할 현지어 또는 영어 공식 이름 (예: Ichiran Honten)",
      "category": "sightseeing | restaurant | cafe | shopping | hotel | transit 중 하나",
      "lat": 35.0,
      "lng": 135.0,
      "description": "무엇을 하는지·팁을 한 문장으로 짧게 (한국어)",
      "price": 15000,
      "priceUnit": "person 또는 group"
    }
  ],
  "tips": ["이 여행에 맞는 준비물/주의사항 3~6개 (짧게)"]
}
규칙:
- 실제로 존재하는 장소만 사용하고, lat/lng는 그 장소의 실제 좌표(소수점 4자리 이상)로 적으세요.
- price는 원화(KRW) 정수. 입장료·식사처럼 사람마다 내는 비용은 priceUnit "person"(1인 기준),
  숙소(1박 객실 요금)·택시·렌터카처럼 일행이 함께 내는 비용은 priceUnit "group"(일행 전체 금액). 무료면 0.
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
      input.party ? `- 동행: ${input.party}${input.people ? ` (총 ${input.people}명)` : ""}` : "",
      `- 예산: ${BUDGET_LABELS[input.budget] || "보통"}`,
      `- 선호 스타일: ${styles}`,
      input.request ? `- 추가 요청: ${input.request}` : "",
      OUTPUT_SPEC
    ];
    return lines.filter(Boolean).join("\n");
  }

  function buildRefinePrompt(trip, instruction, day) {
    const slim = {
      title: trip.title,
      destination: trip.destination,
      days: trip.days,
      people: trip.people || null,
      startDate: trip.startDate || null,
      places: trip.places.map(p => ({
        day: p.day, time: p.time, name: p.name, searchName: p.searchName, category: p.category,
        lat: p.lat, lng: p.lng, description: p.description, price: p.price, priceUnit: p.priceUnit
      }))
    };
    const scope = day
      ? [
          `이번 요청은 Day ${day}에만 적용합니다. places에는 Day ${day}의 장소만 넣어 출력하세요 (day 값은 모두 ${day}).`,
          "다른 날의 장소와 겹치지 않게 하고, 요청과 관계없는 Day 장소는 최대한 그대로 유지하세요."
        ]
      : [
          "요청을 반영해 수정된 전체 일정을 다시 출력하세요. 요청과 관계없는 부분은 최대한 그대로 유지하세요.",
          `현재 일수는 ${trip.days}일입니다. 요청이 일수 변경을 원하면 places의 day 값으로 반영하세요.`
        ];
    return [
      "당신은 한국인 여행자를 위한 전문 여행 플래너입니다. 아래는 현재 여행 일정(JSON)입니다.",
      JSON.stringify(slim),
      "",
      `사용자 요청: ${instruction}`,
      "",
      ...scope,
      OUTPUT_SPEC
    ].join("\n");
  }

  // "오후 2시~4시", "9:00-10:30" 등을 "HH:MM - HH:MM" 형식으로
  function normalizeTime(raw) {
    const s0 = String(raw || "").trim();
    if (!s0) return s0;
    const parts = s0.split(/\s*(?:-|~|–|—|부터|to)\s*/i).filter(Boolean).slice(0, 2);
    const out = [];
    let prevPM = false;
    for (const part of parts) {
      const nums = part.match(/\d{1,2}/g);
      if (!nums) return s0;
      let h = parseInt(nums[0], 10);
      const m = nums[1] ? parseInt(nums[1], 10) : 0;
      const pm = /오후|저녁|밤|pm/i.test(part);
      const am = /오전|새벽|아침|am/i.test(part);
      if (pm && h < 12) h += 12;
      else if (am && h === 12) h = 0;
      else if (!am && !pm && prevPM && h < 12) h += 12;
      if (h > 24 || m > 59) return s0;
      prevPM = pm || prevPM;
      out.push(`${String(h % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
    return out.join(" - ");
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

  // 스트리밍으로 받아 진행 상황을 알려 주고, 응답이 끊긴 시간 기준으로 타임아웃
  const T = window.__routyTimeouts || {};
  const IDLE_TIMEOUT_MS = T.idle || 60000;    // 60초 동안 아무것도 안 오면 중단
  const TOTAL_TIMEOUT_MS = T.total || 240000; // 최대 4분

  function geminiError(status, msg, model) {
    if (status === 400 && /api key/i.test(msg)) return new Error("API 키가 올바르지 않습니다. 설정에서 확인해 주세요.");
    if (status === 403) return new Error("API 키 권한이 없습니다. (키 제한 설정 확인)");
    if (status === 404) return new Error(`모델 "${model}"을 찾을 수 없습니다. 설정에서 모델명을 확인해 주세요.`);
    if (status === 429) return new Error("API 사용 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.");
    if (status === 503) return new Error("Gemini 서버가 혼잡합니다. 잠시 후 다시 시도해 주세요.");
    return new Error(`AI 오류 (${status}): ${msg}`);
  }

  // SSE("data: {...}") 또는 JSON(배열/객체) 응답에서 조각들을 꺼냄
  function parseChunks(raw) {
    const t = raw.trim();
    if (!t) return [];
    if (t.startsWith("data:") || t.includes("\ndata:")) {
      return t.split(/\r?\n/).filter(l => l.startsWith("data:")).map(l => {
        try { return JSON.parse(l.slice(5).trim()); } catch (e) { return null; }
      }).filter(Boolean);
    }
    try {
      const j = JSON.parse(t);
      return Array.isArray(j) ? j : [j];
    } catch (e) {
      return [];
    }
  }

  async function callGemini(prompt, { signal, onProgress } = {}) {
    const { apiKey, model } = getSettings();
    if (!apiKey) throw new Error("설정에서 Gemini API 키를 먼저 등록해 주세요.");

    const ctrl = new AbortController();
    let timedOut = false;
    const abortFromOuter = () => ctrl.abort();
    if (signal) {
      if (signal.aborted) ctrl.abort();
      else signal.addEventListener("abort", abortFromOuter);
    }
    let idleTimer = null;
    const bumpIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { timedOut = true; ctrl.abort(); }, IDLE_TIMEOUT_MS);
    };
    const totalTimer = setTimeout(() => { timedOut = true; ctrl.abort(); }, TOTAL_TIMEOUT_MS);

    const send = (withThinking) => fetch(`${API_BASE}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: Object.assign(
          { responseMimeType: "application/json" },
          withThinking ? { thinkingConfig: { thinkingLevel: "low" } } : {}
        )
      }),
      signal: ctrl.signal
    });

    try {
      bumpIdle();
      if (onProgress) onProgress({ phase: "waiting" });
      let res = await send(true);
      if (!res.ok) {
        let data = await res.json().catch(() => ({}));
        let msg = (data.error && data.error.message) || res.statusText;
        // 생각 수준 설정을 지원하지 않는 모델이면 설정 없이 다시 시도
        if (res.status === 400 && /thinking/i.test(msg)) {
          res = await send(false);
          if (!res.ok) {
            data = await res.json().catch(() => ({}));
            msg = (data.error && data.error.message) || res.statusText;
            throw geminiError(res.status, msg, model);
          }
        } else {
          throw geminiError(res.status, msg, model);
        }
      }

      let text = "";
      let finish = "";
      let block = "";
      let buffer = "";
      const handleChunk = (chunk) => {
        const cand = chunk.candidates && chunk.candidates[0];
        if (cand && cand.finishReason) finish = cand.finishReason;
        if (chunk.promptFeedback && chunk.promptFeedback.blockReason) block = chunk.promptFeedback.blockReason;
        const parts = (cand && cand.content && cand.content.parts) || [];
        parts.forEach(p => {
          if (typeof p.text !== "string") return;
          if (p.thought) {
            if (onProgress) onProgress({ phase: "thinking" });
          } else {
            text += p.text;
          }
        });
        if (onProgress && text) {
          const places = (text.match(/"name"\s*:/g) || []).length;
          onProgress({ phase: "writing", places, chars: text.length });
        }
      };

      if (res.body && res.body.getReader) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          bumpIdle();
          buffer += decoder.decode(value, { stream: true });
          // SSE는 빈 줄로 이벤트가 구분됨
          let idx;
          while ((idx = buffer.search(/\r?\n\r?\n/)) > -1) {
            const evt = buffer.slice(0, idx);
            buffer = buffer.slice(idx).replace(/^\r?\n\r?\n/, "");
            parseChunks(evt).forEach(handleChunk);
          }
        }
        parseChunks(buffer).forEach(handleChunk);
      } else {
        parseChunks(await res.text()).forEach(handleChunk);
      }

      if (!text) {
        throw new Error(`AI가 일정을 만들지 못했습니다 (${block || finish || "빈 응답"}).`);
      }
      if (finish === "MAX_TOKENS") {
        throw new Error("일정이 너무 길어 중간에 끊겼어요. 기간을 줄이거나 다시 시도해 주세요.");
      }
      return extractJson(text);
    } catch (e) {
      if (e.name === "AbortError") {
        if (signal && signal.aborted && !timedOut) throw e; // 사용자가 취소
        throw new Error("AI 응답이 너무 오래 걸려 중단했어요. 다시 시도하거나 설정에서 더 빠른 모델로 바꿔 보세요.");
      }
      if (e instanceof TypeError) throw new Error("네트워크 오류로 AI에 연결하지 못했습니다.");
      throw e;
    } finally {
      clearTimeout(idleTimer);
      clearTimeout(totalTimer);
      if (signal) signal.removeEventListener("abort", abortFromOuter);
    }
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
          time: normalizeTime(p.time) || "시간 미정",
          searchName: p.searchName ? String(p.searchName).trim() : "",
          lat: validCoord ? lat : center.lat,
          lng: validCoord ? lng : center.lng,
          coordMissing: !validCoord,
          category: CATEGORIES.includes(p.category) ? p.category : "sightseeing",
          description: String(p.description || "").trim(),
          price: isFinite(price) && price >= 0 ? price : undefined,
          priceUnit: p.priceUnit === "group" ? "group" : p.priceUnit === "person" ? "person" : (p.category === "hotel" ? "group" : "person")
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

  async function refineTrip(trip, instruction, opts = {}) {
    const raw = await callGemini(buildRefinePrompt(trip, instruction, opts.day), opts);
    const center = trip.places[0] ? { lat: trip.places[0].lat, lng: trip.places[0].lng } : null;
    // 전체 수정 시 AI가 일수를 늘릴 수 있도록 넉넉히 허용
    return normalizePlan(raw, opts.day ? trip.days : Math.max(trip.days, 14), center);
  }

  async function testApiKey() {
    const raw = await callGemini('{"ok": true} 라는 JSON만 그대로 출력하세요.');
    return !!raw;
  }

  // ---------- 장소 검색 (OpenStreetMap Nominatim) ----------
  async function searchPlaces(query, near, opts = {}) {
    const params = new URLSearchParams({
      format: "jsonv2",
      q: query,
      limit: String(opts.limit || 6),
      "accept-language": "ko,en"
    });
    if (near) {
      const d = 0.6;
      params.set("viewbox", `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
      if (opts.bounded) params.set("bounded", "1");
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
      t: trip.title, d: trip.destination, n: trip.days, b: trip.budget, s: trip.startDate || "", c: trip.people || 1,
      p: trip.places.map(p => [p.day, p.time, p.name, p.category, +(+p.lat).toFixed(5), +(+p.lng).toFixed(5), p.description || "", p.price || 0, p.priceUnit === "group" ? 1 : 0])
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
      title: o.t, destination: o.d, days: o.n, budget: o.b || "medium", startDate: o.s || "", people: o.c || 1,
      places: o.p.map((a, i) => ({
        day: a[0], time: a[1], name: a[2], category: CATEGORIES.includes(a[3]) ? a[3] : "sightseeing",
        lat: a[4], lng: a[5], description: a[6], price: a[7], priceUnit: a[8] ? "group" : (a[8] === 0 ? "person" : undefined), id: `sh-${stamp}-${i}`
      }))
    };
  }

  window.RoutyAI = {
    DEFAULT_MODEL,
    getSettings, saveSettings, hasApiKey,
    generateTrip, refineTrip, testApiKey,
    searchPlaces, encodeTrip, decodeTrip, normalizeTime
  };
})();
