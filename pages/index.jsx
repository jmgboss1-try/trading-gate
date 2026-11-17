import { useState, useEffect, useRef } from "react";
import Head from "next/head";

// ── 상수 ──────────────────────────────────────────────────
const SYMBOLS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "XRP/USDT", "BNB/USDT", "DOGE/USDT", "기타"];
const TIMEFRAMES = ["1m", "3m", "5m", "15m", "30m", "1h", "4h", "1D", "1W"];
// threshold: 게이트 통과 최소 점수 / feePct: 편도 수수료(%) — 설정 탭에서 변경
const DEFAULT_SETTINGS = { threshold: 12, feePct: 0.05 };

// ── 분석 항목 정의 (가중치 점수) ──────────────────────────
const ANALYSIS_ITEMS = [
  {
    group: "시장 구조",
    icon: "📊",
    items: [
      { id: "htf_trend", label: "상위 타임프레임 추세", desc: "4H/1D 기준 추세 방향이 진입 방향과 일치하는가", score: 3 },
      { id: "price_level", label: "주요 레벨 근접", desc: "지지/저항, 피보나치 0.618/0.786/0.886 근처인가", score: 3 },
      { id: "structure_break", label: "구조 돌파/유지", desc: "BOS(구조 돌파) 또는 CHOCH(추세 전환) 확인", score: 2 },
    ]
  },
  {
    group: "기술적 근거",
    icon: "📈",
    items: [
      { id: "chart_pattern", label: "차트 패턴", desc: "쐐기, 삼각수렴, 플래그, 헤드앤숄더 등 완성된 패턴", score: 2 },
      { id: "candle_pattern", label: "캔들 패턴", desc: "핀바, 도지, 엔걸핑 등 반전 캔들 시그널", score: 1 },
      { id: "volume", label: "거래량 확인", desc: "돌파/반등 시 거래량 증가 또는 수렴 후 폭발", score: 2 },
      { id: "rsi", label: "RSI 시그널", desc: "과매도(< 30) 또는 과매수(> 70) 구간, 다이버전스", score: 1 },
      { id: "macd", label: "MACD 시그널", desc: "골든크로스/데드크로스, 히스토그램 방향", score: 1 },
      { id: "ema", label: "이평선 지지/저항", desc: "EMA 20/50/200 근처 지지 또는 저항 반응", score: 1 },
    ]
  },
  {
    group: "리스크 & 심리",
    icon: "🧠",
    items: [
      { id: "rr_ratio", label: "손익비 1:2 이상", desc: "목표가 대비 손절폭이 절반 이하인가", score: 3 },
      { id: "clear_sl", label: "명확한 손절라인", desc: "논리적인 손절 위치가 차트상 명확히 보이는가", score: 2 },
      { id: "no_revenge", label: "감정 중립 상태", desc: "복수매매, FOMO, 과욕 없이 냉정한 상태인가", score: 1 },
    ]
  }
];

const ALL_ITEMS = ANALYSIS_ITEMS.flatMap(g => g.items);

// ── 스타일 ─────────────────────────────────────────────────
const DARK = {
  bg: "#060810", surface: "#0e1120", surface2: "#161929",
  border: "#1e2235", accent: "#63ffb4", accentDim: "rgba(99,255,180,0.12)",
  red: "#ff4d6d", redDim: "rgba(255,77,109,0.12)",
  yellow: "#ffd166", yellowDim: "rgba(255,209,102,0.1)",
  blue: "#4da6ff", text: "#e2e8f0", muted: "#5a6080",
  long: "#63ffb4", short: "#ff4d6d",
};
const LIGHT = {
  bg: "#f0f4f8", surface: "#ffffff", surface2: "#f7f9fc",
  border: "#dde3ed", accent: "#00875a", accentDim: "rgba(0,135,90,0.1)",
  red: "#d62f4b", redDim: "rgba(214,47,75,0.08)",
  yellow: "#b45309", yellowDim: "rgba(180,83,9,0.08)",
  blue: "#1d6fbe", text: "#1a202c", muted: "#718096",
  long: "#00875a", short: "#d62f4b",
};

let C = { ...DARK };

const getCSS = (isDark) => `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  html { -webkit-text-size-adjust: 100%; }
  body { background: ${isDark ? "#060810" : "#f0f4f8"}; color: ${isDark ? "#e2e8f0" : "#1a202c"}; font-family: 'Space Grotesk', sans-serif; min-height: 100vh; min-height: 100dvh; transition: background 0.2s, color 0.2s; overscroll-behavior-y: none; }
  /* iOS는 16px 미만 입력창에 포커스하면 화면을 확대하므로 16px 고정 */
  input, select, textarea { font-family: 'Space Grotesk', sans-serif; font-size: 16px !important; outline: none; background: ${isDark ? "#161929" : "#fff"}; color: ${isDark ? "#e2e8f0" : "#1a202c"}; border: 1px solid ${isDark ? "#1e2235" : "#dde3ed"}; border-radius: 8px; padding: 8px 12px; width: 100%; }
  button { touch-action: manipulation; }
  ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-thumb { background: ${isDark ? "#2a2d3e" : "#c4cdd6"}; border-radius: 3px; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes glow { 0%, 100% { box-shadow: 0 0 20px rgba(99,255,180,0.3); } 50% { box-shadow: 0 0 40px rgba(99,255,180,0.6); } }
  .fade-up { animation: fadeUp 0.4s ease forwards; }

  /* ── 레이아웃: 폰(기본) ── */
  .tg-shell { min-height: 100dvh; }
  .tg-side { display: none; }
  .tg-main { display: flex; flex-direction: column; min-height: 100dvh; }
  .tg-content { padding: 16px 14px calc(88px + env(safe-area-inset-bottom)); flex: 1; }
  .tg-header { padding: calc(10px + env(safe-area-inset-top)) 14px 10px; }
  .tg-bottomnav { display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 60; padding: 6px 6px calc(6px + env(safe-area-inset-bottom)); }
  .tg-split { display: flex; flex-direction: column; gap: 16px; }
  .tg-split-media { }
  .tg-sheet { align-items: flex-end !important; padding: 0 !important; }
  .tg-sheet > div { border-radius: 16px 16px 0 0 !important; max-height: 90dvh !important; padding-bottom: calc(24px + env(safe-area-inset-bottom)) !important; }

  /* ── 펼친 화면 / 듀얼 화면 / 태블릿 ── */
  @media (min-width: 720px) {
    .tg-shell { display: grid; grid-template-columns: 220px 1fr; max-width: 1400px; margin: 0 auto; }
    .tg-side { display: flex; }
    .tg-bottomnav { display: none; }
    .tg-content { padding: 20px 24px 32px; }
    .tg-header { padding: 14px 24px; }
    .tg-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; align-items: start; }
    .tg-split-media { position: sticky; top: 76px; }
    .tg-sheet { align-items: center !important; padding: 24px !important; }
    .tg-sheet > div { border-radius: 16px !important; max-height: 85vh !important; }
  }
  .tg-chart-img { max-height: 240px; }
  .tg-wide-only { display: none; }
  @media (min-width: 720px) {
    .tg-chart-img { max-height: calc(100dvh - 140px); }
    .tg-wide-only { display: block; }
  }
  /* 경첩으로 나뉜 듀얼 스크린: 평소엔 왼쪽=메뉴/시드, 오른쪽=내용 · 분석 중엔 왼쪽=차트, 오른쪽=입력 */
  @media (horizontal-viewport-segments: 2) {
    .tg-shell, .tg-shell.wiz .tg-split { display: grid; max-width: none; grid-template-columns: env(viewport-segment-width 0 0, 50%) 1fr; column-gap: calc(env(viewport-segment-left 1 0, 50%) - env(viewport-segment-right 0 0, 50%)); }
    .tg-side { display: flex; }
    .tg-bottomnav { display: none; }
    .tg-shell.wiz { display: block; }
    .tg-shell.wiz .tg-side { display: none; }
    .tg-shell.wiz .tg-content { padding: 16px 0 32px; }
    .tg-shell.wiz .tg-split > * { padding: 0 14px; }
    .tg-chart-img { max-height: calc(100dvh - 140px); }
    .tg-wide-only { display: block; }
  }
`;

const fmtUsdt = (v, digits = 2) => (v >= 0 ? "+" : "") + Number(v).toFixed(digits) + " USDT";
const todayStr = () => {
  // 로컬(한국) 날짜 기준 — toISOString은 UTC라 오전 9시 전엔 전날로 찍힘
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
// 이미지 표시: 업로드된 id → /api/images, 작성 중 dataURL → 그대로, 구버전 객체 → preview
const imgSrc = img => {
  if (typeof img !== "string") return img?.preview;
  return img.startsWith("data:") ? img : `/api/images?id=${encodeURIComponent(img)}`;
};

// ── 손익 계산 (증거금 기준, 한 곳에서만 계산) ─────────────
// margin: 투입 증거금(USDT) · lev: 레버리지 · fillRatio: 체결 비율(0~1) · feePct: 편도 수수료(%)
function calcTrade({ dir, entry, exit, margin, lev, fillRatio = 1, feePct = 0 }) {
  const e = parseFloat(entry) || 0, x = parseFloat(exit) || 0;
  const m = (parseFloat(margin) || 0) * fillRatio, l = parseFloat(lev) || 1;
  if (!(e > 0 && x > 0 && m > 0)) return { pnl: 0, pct: 0, fees: 0 };
  const move = dir === "숏" ? (e - x) / e : (x - e) / e;
  const notional = m * l;
  const fees = notional * (feePct / 100) * 2; // 진입 + 청산
  const pnl = notional * move - fees;
  return { pnl, pct: pnl / m * 100, fees };
}

function fillRatioOf(p) {
  if (p.fillType === "partial") {
    const t = parseFloat(p.targetQty) || 0, f = parseFloat(p.filledQty) || 0;
    return t > 0 && f > 0 ? Math.min(1, f / t) : 1;
  }
  return 1;
}

// 진입 계획 지표 — 마법사·진입 기록 창 공용
function tradeMetrics({ dir, entry, sl, tp, lev, margin, fillRatio = 1, feePct = 0 }) {
  const entryN = parseFloat(entry) || 0, slN = parseFloat(sl) || 0, tpN = parseFloat(tp) || 0;
  const levN = parseFloat(lev) || 1, marginN = parseFloat(margin) || 0;
  const slSideOk = entryN > 0 && slN > 0 && (dir === "롱" ? slN < entryN : slN > entryN);
  const tpSideOk = !tpN || (entryN > 0 && (dir === "롱" ? tpN > entryN : tpN < entryN));
  const lossAtSl = calcTrade({ dir, entry, exit: sl, margin, lev, fillRatio, feePct });
  const profitAtTp = calcTrade({ dir, entry, exit: tp, margin, lev, fillRatio, feePct });
  const liqPrice = entryN > 0 && levN > 1 ? (dir === "롱" ? entryN * (1 - 1 / levN) : entryN * (1 + 1 / levN)) : 0;
  return {
    entryN, slN, tpN, levN, marginN, slSideOk, tpSideOk, lossAtSl, liqPrice,
    slDist: entryN > 0 && slN > 0 ? Math.abs(entryN - slN) / entryN : 0,
    maxLoss: slSideOk ? Math.abs(lossAtSl.pnl) : 0,
    expectedProfit: tpN && tpSideOk ? profitAtTp.pnl : 0,
    rrRatio: slSideOk && tpN && tpSideOk ? Math.abs(tpN - entryN) / Math.abs(entryN - slN) : 0,
    slBeyondLiq: liqPrice > 0 && slSideOk && (dir === "롱" ? slN <= liqPrice : slN >= liqPrice),
  };
}

// 진입 게이트 — 모두 통과해야 "규칙대로 진입". 실패해도 기록은 가능(규칙 위반으로 표시)
function gateChecksFor({ score, threshold, dir, m }) {
  return [
    { ok: score >= threshold, label: `근거 점수 ${threshold}점 이상 (현재 ${score}점)`, step: 3 },
    { ok: m.entryN > 0, label: "진입가 입력", step: 4, data: true },
    { ok: m.slSideOk, label: m.slN > 0 && m.entryN > 0 ? `손절가가 ${dir === "롱" ? "진입가보다 아래" : "진입가보다 위"}에 있어야 함` : "손절가 입력", step: 4 },
    { ok: m.tpSideOk, label: `목표가가 ${dir === "롱" ? "진입가보다 위" : "진입가보다 아래"}에 있어야 함`, step: 4 },
    { ok: !m.slBeyondLiq, label: "손절가가 예상 청산가보다 안쪽", step: 4 },
    { ok: m.marginN > 0, label: "투입 증거금 입력", step: 4, data: true },
  ];
}

// 상태: analysis(분석만) · pending(지정가 대기) · active(진행 중) · win/loss(청산) · canceled(미체결·취소)
const normalizePos = p => (p.status === "unfilled" ? { ...p, status: "pending" } : p);
const nowIso = () => new Date().toISOString();
const toLocalInput = iso => { const d = iso ? new Date(iso) : new Date(); const z = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; };
const fmtDT = iso => { if (!iso) return ""; const d = new Date(iso); const z = n => String(n).padStart(2, "0"); return `${d.getMonth() + 1}/${d.getDate()} ${z(d.getHours())}:${z(d.getMinutes())}`; };
// 분석 방향이 맞았는지: 실제 청산(win/loss) 또는 진입 안 한 분석의 사후 결과(tp/sl)
const outcomeOf = p => (p.status === "win" ? "tp" : p.status === "loss" ? "sl" : p.virtualOutcome || null);

const isClosed = p => p.status === "win" || p.status === "loss";
const round2 = v => Math.round(v * 100) / 100;

// 차트 캡처를 축소/JPEG 압축 — 저장 용량을 1/5~1/10로 줄임
function compressImage(file, maxDim = 1400, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("이미지를 읽을 수 없습니다")); };
    img.src = url;
  });
}
const compressAll = files => Promise.all(Array.from(files).map(f => compressImage(f)));

// ── 서버 통신 ──────────────────────────────────────────
// 401/503(로그인 필요·비밀번호 미설정)이면 onAuthLost로 로그인 화면 전환
let onAuthLost = () => {};
class AuthError extends Error {}

async function api(path, { method = "GET", body } = {}) {
  const r = await fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 || (r.status === 503 && j.code === "NO_PASSWORD")) { onAuthLost(j); throw new AuthError(j.error || "로그인이 필요합니다"); }
  if (r.status === 413) throw new Error("용량 초과 — 이미지 수를 줄여주세요");
  if (!r.ok) throw new Error(j.error || `요청 실패 (${r.status})`);
  return j;
}

const saveData = (key, value) => api("/api/data", { method: "POST", body: { key, value } });
const loadData = async key => {
  const j = await api(`/api/data?key=${key}`);
  return typeof j.data === "string" ? JSON.parse(j.data) : j.data;
};
const loadPositions = async () => (await api("/api/positions")).positions || [];
const putPosition = position => api("/api/positions", { method: "PUT", body: { position } });
const deletePosition = id => api(`/api/positions?id=${encodeURIComponent(id)}`, { method: "DELETE" });

// 작성 중인 dataURL 이미지만 업로드해서 id로 교체 (이미 id면 그대로)
async function uploadImages(list = []) {
  const out = [];
  for (const img of list) {
    if (typeof img === "string" && img.startsWith("data:")) out.push((await api("/api/images", { method: "POST", body: { dataUrl: img } })).id);
    else if (typeof img === "string") out.push(img);
  }
  return out;
}

// ── 컴포넌트 ───────────────────────────────────────────────
function Card({ children, style, accent }) {
  return (
    <div style={{ background: C.surface, border: "1px solid " + (accent ? accent + "40" : C.border), borderRadius: 14, padding: 20, position: "relative", overflow: "hidden", ...style }}>
      {accent && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg," + accent + ",transparent)" }} />}
      {children}
    </div>
  );
}

function ScoreMeter({ score, max, threshold }) {
  const pct = max > 0 ? Math.min(100, (score / max) * 100) : 0;
  const thPct = max > 0 ? Math.min(100, (threshold / max) * 100) : 0;
  const pass = score >= threshold;
  const color = pass ? C.accent : score >= threshold * 0.6 ? C.yellow : C.red;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "flex-end" }}>
        <span style={{ fontSize: 13, color: C.muted }}>근거 점수 · 게이트 {threshold}점</span>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 24, fontWeight: 700, color }}>
          {score}<span style={{ fontSize: 14, color: C.muted }}>/{max}</span>
        </span>
      </div>
      <div style={{ position: "relative", height: 10, background: C.surface2, borderRadius: 5 }}>
        <div style={{ height: "100%", width: pct + "%", background: "linear-gradient(90deg," + color + "," + color + "99)", borderRadius: 5, transition: "width 0.5s ease" }} />
        <div style={{ position: "absolute", top: -3, bottom: -3, left: thPct + "%", width: 2, background: C.text, opacity: 0.6, borderRadius: 1 }} />
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: pass ? C.accent : C.muted }}>{pass ? "✓ 점수 기준 통과" : `게이트까지 ${threshold - score}점 부족`}</div>
    </div>
  );
}

// ── 분석 마법사 ────────────────────────────────────────────
function AnalysisWizard({ onComplete, onCancel, checklist, settings }) {
  const allItems = checklist.flatMap(g => g.items);
  const maxScore = allItems.reduce((a, i) => a + i.score, 0);
  const threshold = Math.min(settings.threshold, maxScore);
  const feePct = settings.feePct;
  const [step, setStep] = useState(1);
  const [images, setImages] = useState([]); // [dataURL]
  const [imgIdx, setImgIdx] = useState(0);
  const [imgBusy, setImgBusy] = useState(false);
  const [symbol, setSymbol] = useState("BTC/USDT");
  const [customSymbol, setCustomSymbol] = useState("");
  const [dir, setDir] = useState("롱");
  const [checked, setChecked] = useState({});
  const [entry, setEntry] = useState("");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [lev, setLev] = useState("10");
  const [balance, setBalance] = useState(""); // 투입 증거금(USDT)
  const [memo, setMemo] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();
  const touchX = useRef(null);

  const addImages = async (files) => {
    if (!files?.length) return;
    setImgBusy(true);
    try {
      const urls = await compressAll(files);
      setImgIdx(images.length);
      setImages(imgs => [...imgs, ...urls]);
    } catch (e) { alert(e.message); }
    setImgBusy(false);
  };

  const removeImage = (i) => {
    setImages(imgs => imgs.filter((_, idx) => idx !== i));
    setImgIdx(idx => Math.max(0, idx - 1));
  };

  const toggle = id => setChecked(c => ({ ...c, [id]: { on: !c[id]?.on, comment: c[id]?.comment || "" } }));
  const setComment = (id, comment) => setChecked(c => ({ ...c, [id]: { ...c[id], comment } }));
  const isChecked = id => !!checked[id]?.on;
  const score = allItems.filter(i => isChecked(i.id)).reduce((a, i) => a + i.score, 0);
  const finalSymbol = symbol === "기타" ? customSymbol.trim() : symbol;

  // 리스크 계산 (증거금 기준)
  const m = tradeMetrics({ dir, entry, sl, tp, lev, margin: balance, feePct });
  const { entryN, slN, tpN, marginN, slDist, slSideOk, tpSideOk, lossAtSl, maxLoss, expectedProfit, rrRatio, liqPrice, slBeyondLiq } = m;

  // ── 진입 게이트 ── (분석만 저장할 땐 필요 없음)
  const gateChecks = gateChecksFor({ score, threshold, dir, m });
  const passed = gateChecks.every(c => c.ok);
  const dataOk = gateChecks.filter(c => c.data).every(c => c.ok); // 진입 기록에 최소한 필요한 값

  const getAiAdvice = async () => {
    setAiLoading(true); setAiAdvice("");
    const checkedItems = allItems.filter(i => isChecked(i.id)).map(i => i.label + (checked[i.id]?.comment ? ` (${checked[i.id].comment})` : "")).join(", ");
    const unchecked = allItems.filter(i => !isChecked(i.id)).map(i => i.label).join(", ");
    const prompt = `코인 선물 트레이딩 전문가로서 다음 진입 분석을 검토하고 한국어로 간결하게 피드백해주세요 (3-5문장).${images.length ? " 첨부한 차트 이미지도 함께 보고 판단해주세요." : ""}
종목: ${finalSymbol || "-"} / 방향: ${dir} / 레버리지: ${lev}x
충족된 조건: ${checkedItems || "없음"}
미충족 조건: ${unchecked || "없음"}
진입가: ${entry || "-"} / 손절가: ${sl || "-"} / 목표가: ${tp || "-"} / 손익비: ${rrRatio ? "1:" + rrRatio.toFixed(2) : "-"}
증거금: ${balance || "-"} USDT / 손절 시 손실: ${maxLoss ? maxLoss.toFixed(2) : "-"} USDT / 예상 청산가: ${liqPrice ? liqPrice.toFixed(4) : "-"}
점수: ${score}/${maxScore} (게이트 기준: ${threshold}점, ${passed ? "통과" : "미통과"})
메모: ${memo || "없음"}

핵심만 짚어주세요: 이 진입이 타당한지, 가장 큰 리스크는 무엇인지.`;
    try {
      const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, images }) });
      const data = await res.json().catch(() => ({}));
      setAiAdvice(res.ok ? data.text : "AI 오류: " + (data.error || res.status));
    } catch (e) { setAiAdvice("AI 오류: " + e.message); }
    setAiLoading(false);
  };

  // mode: "analysis"(분석만) | "pending"(지정가 걸어둠) | "active"(지금 진입)
  const handleComplete = async (mode) => {
    if (saving || !finalSymbol) return;
    const entering = mode !== "analysis";
    if (entering && !dataOk) return;
    if (entering && !passed && !confirm("게이트를 통과하지 못했습니다.\n규칙 위반으로 기록할까요?")) return;
    setSaving(true);
    const now = nowIso();
    await onComplete({
      id: Date.now(), date: todayStr(), createdAt: now,
      symbol: finalSymbol, dir, entry, sl, tp, lev, memo,
      plan: { entry, sl, tp, lev, margin: balance }, // 분석 당시 계획 (실제 진입값과 비교용)
      // 체크된 항목만 스냅샷 — 이후 체크리스트를 수정해도 기록 유지
      checkedItems: allItems.filter(i => isChecked(i.id)).map(i => ({ id: i.id, label: i.label, score: i.score, comment: checked[i.id]?.comment || "" })),
      score, maxScore, threshold, passed,
      ruleBreak: entering && !passed,
      rrRatio: round2(rrRatio),
      posSizeUsdt: round2(marginN),
      maxLoss: round2(maxLoss),
      liqPrice: liqPrice ? Number(liqPrice.toFixed(6)) : null,
      aiAdvice,
      fillType: "full",
      ...(mode === "pending" ? { orderAt: now } : {}),
      ...(mode === "active" ? { entryAt: now } : {}),
      status: mode,
      images,
    });
    setSaving(false); // 성공 시엔 마법사가 닫힘, 실패 시 입력 내용 유지
  };

  const nav = d => setImgIdx(i => (i + d + images.length) % images.length);
  const onTouchStart = e => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = e => {
    if (touchX.current == null || images.length < 2) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) nav(dx < 0 ? 1 : -1);
    touchX.current = null;
  };
  const roundBtn = { position: "absolute", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", width: 36, height: 36, borderRadius: "50%", cursor: "pointer", fontSize: 18 };

  // 차트 뷰어 — 폰: 상단 고정 / 펼친 화면·듀얼: 왼쪽 화면 전체
  const imageViewer = images.length > 0 ? (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#000" }}>
      <img className="tg-chart-img" src={images[imgIdx]} alt="차트" onClick={() => window.open(images[imgIdx])} style={{ width: "100%", objectFit: "contain", display: "block" }} />
      {images.length > 1 && (
        <>
          <button onClick={() => nav(-1)} style={{ ...roundBtn, left: 8, top: "50%", transform: "translateY(-50%)" }}>‹</button>
          <button onClick={() => nav(1)} style={{ ...roundBtn, right: 8, top: "50%", transform: "translateY(-50%)" }}>›</button>
          <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 4 }}>
            {images.map((_, i) => <div key={i} onClick={() => setImgIdx(i)} style={{ width: i === imgIdx ? 16 : 6, height: 6, borderRadius: 3, background: i === imgIdx ? C.accent : "rgba(255,255,255,0.4)", cursor: "pointer", transition: "all 0.2s" }} />)}
          </div>
        </>
      )}
      <button onClick={() => removeImage(imgIdx)} style={{ ...roundBtn, top: 8, right: 8, width: 30, height: 30, fontSize: 14 }}>✕</button>
      <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.6)", padding: "2px 8px", borderRadius: 10, fontSize: 11, color: "#fff" }}>{imgIdx + 1}/{images.length}</div>
    </div>
  ) : (
    <div className="tg-wide-only">
      <button onClick={() => fileRef.current.click()} style={{ width: "100%", minHeight: 240, border: "2px dashed " + C.border, borderRadius: 14, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 14 }}>📊 차트를 올리면 이 화면에 고정됩니다</button>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, animation: "fadeUp 0.3s ease" }}>
      <input ref={fileRef} type="file" accept="image/*" multiple onChange={e => { addImages(e.target.files); e.target.value = ""; }} style={{ display: "none" }} />
      {/* 상단 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 14, padding: "8px 4px", display: "flex", alignItems: "center", gap: 6 }}>← 취소</button>
        <div style={{ display: "flex", gap: 6 }}>
          {[1,2,3,4,5].map(n => (
            <div key={n} onClick={() => setStep(n)} style={{ width: n <= step ? 24 : 16, height: 8, borderRadius: 4, background: n === step ? C.accent : n < step ? C.accent + "60" : C.surface2, transition: "all 0.3s", cursor: "pointer" }} />
          ))}
        </div>
        <span style={{ fontSize: 12, color: C.muted }}>Step {step}/5</span>
      </div>

      <div className="tg-split">
      <div className="tg-split-media">{imageViewer}</div>
      <div>
      {/* Step 1: 차트 이미지 업로드 */}
      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeUp 0.3s ease" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>차트 업로드</div>
            <div style={{ fontSize: 13, color: C.muted }}>트레이딩뷰 분석 캡처를 올려주세요</div>
          </div>

          {/* 업로드 버튼 */}
          <button onClick={() => fileRef.current.click()} style={{ width: "100%", padding: 24, border: "2px dashed " + (images.length > 0 ? C.accent + "60" : C.border), borderRadius: 14, background: images.length > 0 ? C.accentDim : "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: images.length > 0 ? C.accent : C.muted }}>
            <div style={{ fontSize: 32 }}>📊</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{imgBusy ? "압축 중..." : images.length > 0 ? "+ 차트 추가 업로드" : "차트 이미지 업로드"}</div>
            <div style={{ fontSize: 11 }}>여러 장 선택 가능 · 좌우로 밀어서 넘기기</div>
          </button>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setStep(2)} style={{ flex: 2, padding: "14px 0", borderRadius: 12, border: "none", background: C.accent, color: "#000", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>
              {images.length > 0 ? "다음 → 종목/방향 설정" : "이미지 없이 계속하기 →"}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: 기본 설정 */}
      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeUp 0.3s ease" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>기본 설정</div>
            <div style={{ fontSize: 13, color: C.muted }}>어떤 종목을 어느 방향으로 분석하나요?</div>
          </div>
          <Card accent={dir === "롱" ? C.long : C.short}>
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              {["롱", "숏"].map(d => (
                <button key={d} onClick={() => setDir(d)} style={{ flex: 1, padding: "14px 0", borderRadius: 10, border: "2px solid " + (dir === d ? (d === "롱" ? C.long : C.short) : C.border), background: dir === d ? (d === "롱" ? "rgba(99,255,180,0.1)" : "rgba(255,77,109,0.1)") : "transparent", color: dir === d ? (d === "롱" ? C.long : C.short) : C.muted, fontWeight: 700, fontSize: 16, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>
                  {d === "롱" ? "▲ 롱" : "▼ 숏"}
                </button>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600, letterSpacing: 1 }}>종목</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {SYMBOLS.map(sym => (
                  <button key={sym} onClick={() => setSymbol(sym)} style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid " + (symbol === sym ? C.accent : C.border), background: symbol === sym ? C.accentDim : "transparent", color: symbol === sym ? C.accent : C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace" }}>{sym}</button>
                ))}
              </div>
              {symbol === "기타" && <input value={customSymbol} onChange={e => setCustomSymbol(e.target.value)} placeholder="예: AVAX/USDT" style={{ marginTop: 8, width: "100%", background: C.surface2, border: "1px solid " + C.border, color: C.text, borderRadius: 8, padding: "8px 12px" }} />}
            </div>
          </Card>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setStep(1)} style={{ flex: 1, padding: "13px 0", borderRadius: 12, border: "1px solid " + C.border, background: "transparent", color: C.muted, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>← 이전</button>
            <button onClick={() => setStep(3)} style={{ flex: 2, padding: "14px 0", borderRadius: 12, border: "none", background: C.accent, color: "#000", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>다음 → 근거 분석</button>
          </div>
        </div>
      )}

      {/* Step 3: 기술적 분석 체크리스트 */}
      {step === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeUp 0.3s ease" }}>
          {/* 방향 배지 상단 고정 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>근거 체크리스트</div>
              <div style={{ fontSize: 13, color: C.muted }}>충족되는 조건만 체크하세요. 솔직하게!</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <div style={{ padding: "6px 16px", borderRadius: 20, background: dir === "롱" ? "rgba(99,255,180,0.15)" : "rgba(255,77,109,0.15)", color: dir === "롱" ? C.long : C.short, fontWeight: 700, fontSize: 15, border: "1px solid " + (dir === "롱" ? C.long : C.short) + "50" }}>
                {dir === "롱" ? "▲ 롱" : "▼ 숏"}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: C.muted }}>{symbol === "기타" ? customSymbol : symbol}</div>
            </div>
          </div>
          <ScoreMeter score={score} max={maxScore} threshold={threshold} />
          {checklist.map(group => (
            <Card key={group.group} accent={C.blue}>
              <div style={{ fontSize: 12, color: C.blue, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}><span>{group.icon}</span>{group.group}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {group.items.map(item => {
                  const on = isChecked(item.id);
                  const comment = checked[item.id]?.comment || "";
                  return (
                    <div key={item.id} style={{ borderRadius: 10, background: on ? C.accentDim : C.surface2, border: "1px solid " + (on ? C.accent + "60" : C.border), overflow: "hidden", transition: "all 0.2s" }}>
                      <div onClick={() => toggle(item.id)} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", cursor: "pointer" }}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, border: "2px solid " + (on ? C.accent : C.muted), background: on ? C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, transition: "all 0.2s" }}>
                          {on && <span style={{ color: "#000", fontSize: 13, fontWeight: 700 }}>✓</span>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                            <span style={{ fontWeight: 600, fontSize: 14, color: on ? C.accent : C.text }}>{item.label}</span>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: on ? C.accent : C.muted, background: on ? C.accentDim : C.surface, padding: "1px 8px", borderRadius: 10, border: "1px solid " + (on ? C.accent + "40" : C.border) }}>+{item.score}점</span>
                          </div>
                          <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>{item.desc}</div>
                        </div>
                      </div>
                      {/* 코멘트 입력창 - 체크 시 펼쳐짐 */}
                      {on && (
                        <div style={{ padding: "0 14px 12px 48px" }}>
                          <input
                            value={comment}
                            onChange={e => { e.stopPropagation(); setComment(item.id, e.target.value); }}
                            onClick={e => e.stopPropagation()}
                            placeholder="근거 코멘트 (선택) — 예: 0.786 + 1.13 겹치는 구간"
                            style={{ width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid " + C.accent + "30", color: C.text, borderRadius: 7, padding: "6px 10px", fontSize: 12, fontFamily: "'Space Grotesk',sans-serif" }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setStep(2)} style={{ flex: 1, padding: "13px 0", borderRadius: 12, border: "1px solid " + C.border, background: "transparent", color: C.muted, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>← 이전</button>
            <button onClick={() => setStep(4)} style={{ flex: 2, padding: "13px 0", borderRadius: 12, border: "none", background: C.accent, color: "#000", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>
              다음 → 리스크 계산 ({score}점 모음)
            </button>
          </div>
        </div>
      )}

      {/* Step 4: 리스크 계산기 */}
      {step === 4 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeUp 0.3s ease" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>진입 계획</div>
            <div style={{ fontSize: 13, color: C.muted }}>진입할 생각이면 입력하세요. 분석만 기록할 땐 비워둬도 됩니다.</div>
          </div>
          <Card accent={C.yellow}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[["진입가 (USDT)", entry, setEntry], ["손절가 (USDT)", sl, setSl], ["목표가 (USDT)", tp, setTp], ["레버리지 (x)", lev, setLev]].map(([label, val, setter]) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 5, fontWeight: 600, letterSpacing: 0.5 }}>{label}</div>
                    <input type="number" inputMode="decimal" value={val} onChange={e => setter(e.target.value)} placeholder="0" style={{ width: "100%", background: C.surface2, border: "1px solid " + C.border, color: C.text, borderRadius: 8, padding: "10px 12px", fontFamily: "'JetBrains Mono',monospace", fontSize: 14 }} />
                  </div>
                ))}
              </div>
              <div style={{ height: 1, background: C.border }} />
              {/* 실제 매매 금액 */}
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 5, fontWeight: 600, letterSpacing: 0.5 }}>투입 증거금 (USDT)</div>
                <input type="number" inputMode="decimal" value={balance} onChange={e => setBalance(e.target.value)} placeholder="예: 100" style={{ width: "100%", background: C.surface2, border: "1px solid " + C.border, color: C.text, borderRadius: 8, padding: "12px 14px", fontFamily: "'JetBrains Mono',monospace", fontSize: 16, fontWeight: 600 }} />
                <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>실제로 투입하는 증거금 금액 (레버리지 적용 전)</div>
              </div>

              {/* 계산 결과 */}
              {entryN > 0 && slN > 0 && (
                <div style={{ background: C.surface, borderRadius: 10, padding: 14, border: "1px solid " + C.border }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, fontWeight: 600 }}>📐 계산 결과</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[
                      ["손익비", rrRatio > 0 ? "1 : " + rrRatio.toFixed(2) : "-", rrRatio >= 2 ? C.accent : rrRatio >= 1 ? C.yellow : C.red],
                      ["손절 시 손실", marginN > 0 && slSideOk ? "-" + maxLoss.toFixed(2) + " USDT" : "-", C.red],
                      ["목표 시 수익", marginN > 0 && expectedProfit > 0 ? "+" + expectedProfit.toFixed(2) + " USDT" : "-", C.accent],
                      ["손절 거리", slDist > 0 ? (slDist * 100).toFixed(2) + "%" : "-", C.muted],
                      ["예상 청산가", liqPrice ? liqPrice.toFixed(4) : "-", slBeyondLiq ? C.red : C.muted],
                    ].map(([label, val, color]) => (
                      <div key={label} style={{ background: C.surface2, borderRadius: 8, padding: "10px 12px" }}>
                        <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>{label}</div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700, color }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  {!slSideOk && <div style={{ marginTop: 10, padding: "8px 12px", background: C.redDim, borderRadius: 8, fontSize: 12, color: C.red }}>⚠️ {dir} 포지션의 손절가는 진입가보다 {dir === "롱" ? "낮아야" : "높아야"} 합니다.</div>}
                  {slBeyondLiq && <div style={{ marginTop: 10, padding: "8px 12px", background: C.redDim, borderRadius: 8, fontSize: 12, color: C.red }}>⚠️ 손절가 전에 청산됩니다. 레버리지를 낮추세요.</div>}
                  <div style={{ marginTop: 10, fontSize: 11, color: C.muted }}>수수료 편도 {feePct}% 반영 · 청산가는 격리 기준 근사치</div>
                  {rrRatio > 0 && rrRatio < 2 && <div style={{ marginTop: 10, padding: "8px 12px", background: C.redDim, borderRadius: 8, fontSize: 12, color: C.red }}>⚠️ 손익비가 1:2 미만입니다. 목표가를 재검토하거나 진입을 재고하세요.</div>}
                </div>
              )}
            </div>
          </Card>


          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setStep(3)} style={{ flex: 1, padding: "13px 0", borderRadius: 12, border: "1px solid " + C.border, background: "transparent", color: C.muted, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>← 이전</button>
            <button onClick={() => setStep(5)} style={{ flex: 2, padding: "13px 0", borderRadius: 12, border: "none", background: C.accent, color: "#000", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>다음 → 최종 확인</button>
          </div>
        </div>
      )}

      {/* Step 5: 최종 확인 & AI */}
      {step === 5 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeUp 0.3s ease" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>최종 확인</div>
            <div style={{ fontSize: 13, color: C.muted }}>분석은 언제나 저장할 수 있어요. 진입은 게이트를 통과해야 규칙대로입니다.</div>
          </div>

          {/* 게이트 */}
          <div style={{ padding: 18, borderRadius: 14, border: "2px solid " + (passed ? C.accent : C.red), background: passed ? C.accentDim : C.redDim }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: passed ? C.accent : C.red }}>{passed ? "🟢 진입 게이트 OPEN" : "🔒 진입 게이트 CLOSED"}</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 20, fontWeight: 700, color: score >= threshold ? C.accent : C.red }}>{score}<span style={{ fontSize: 12, color: C.muted }}>/{maxScore}</span></div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {gateChecks.map(c => (
                <div key={c.label} onClick={() => !c.ok && setStep(c.step)} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: c.ok ? C.muted : C.red, cursor: c.ok ? "default" : "pointer" }}>
                  <span>{c.ok ? "✓" : "✕"}</span><span style={{ flex: 1 }}>{c.label}</span>{!c.ok && <span style={{ fontSize: 11 }}>수정 →</span>}
                </div>
              ))}
            </div>
            {!passed && <div style={{ marginTop: 10, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>조건을 채우지 못하면 진입하지 않는 것이 규칙입니다. 분석만 저장해두고 결과를 나중에 기록하세요.</div>}
          </div>

          {/* 요약 */}
          <Card>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
              {[
                ["종목", symbol === "기타" ? customSymbol : symbol],
                ["방향", dir, dir === "롱" ? C.long : C.short],
                ["레버리지", lev + "x"],
                ["진입가", entry ? entry + " USDT" : "-"],
                ["손절가", sl ? sl + " USDT" : "-"],
                ["목표가", tp ? tp + " USDT" : "-"],
                ["손익비", rrRatio > 0 ? "1:" + rrRatio.toFixed(2) : "-", rrRatio >= 2 ? C.accent : C.yellow],
                ["증거금", balance ? balance + " USDT" : "-"],
                ["손절 시 손실", maxLoss > 0 ? "-" + maxLoss.toFixed(2) + " USDT" : "-", C.red],
                ["예상 청산가", liqPrice ? liqPrice.toFixed(4) : "-", slBeyondLiq ? C.red : C.muted],
                ["수수료(왕복)", lossAtSl.fees ? lossAtSl.fees.toFixed(2) + " USDT" : "-", C.muted],
              ].map(([label, val, color]) => (
                <div key={label} style={{ background: C.surface2, borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 600, color: color || C.text }}>{val || "-"}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* 메모 */}
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600, letterSpacing: 1 }}>진입 근거 메모 (선택)</div>
            <textarea value={memo} onChange={e => setMemo(e.target.value)} placeholder="시나리오, 주의할 점, 추가 근거..." style={{ width: "100%", background: C.surface, border: "1px solid " + C.border, color: C.text, borderRadius: 10, padding: "12px 14px", minHeight: 80, resize: "vertical", fontSize: 13 }} />
          </div>

          {/* AI 분석 */}
          <Card accent="#7b2fff">
            <div style={{ fontSize: 12, color: "#b47aff", fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>🤖 AI 진입 검토</div>
            <button onClick={getAiAdvice} disabled={aiLoading} style={{ width: "100%", padding: "11px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#7b2fff,#4da6ff)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif", opacity: aiLoading ? 0.7 : 1 }}>
              {aiLoading ? "분석 중..." : "AI에게 이 진입 검토 요청하기"}
            </button>
            {aiAdvice && <div style={{ marginTop: 12, padding: "12px 14px", background: "rgba(123,47,255,0.08)", borderRadius: 10, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", color: C.text }}>{aiAdvice}</div>}
          </Card>

          {/* 저장 방식 선택 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button onClick={() => handleComplete("analysis")} disabled={saving || !finalSymbol} style={{ padding: "15px 0", borderRadius: 12, border: "1px solid " + C.blue, background: C.blue + "18", color: C.blue, fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif", opacity: saving ? 0.6 : 1 }}>
              {saving ? "저장 중..." : "📝 분석만 저장 (진입 안 함)"}
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[["pending", "⏳ 지정가 걸어둠"], ["active", "✓ 지금 진입함"]].map(([mode, label]) => (
                <button key={mode} onClick={() => handleComplete(mode)} disabled={saving || !dataOk} style={{ padding: "15px 0", borderRadius: 12, border: passed ? "none" : "1px solid " + C.red, background: !dataOk ? C.surface2 : passed ? C.accent : C.redDim, color: !dataOk ? C.muted : passed ? "#000" : C.red, fontWeight: 700, fontSize: 14, cursor: dataOk ? "pointer" : "not-allowed", fontFamily: "'Space Grotesk',sans-serif", opacity: saving ? 0.6 : 1 }}>
                  {label}{dataOk && !passed ? " ⚠️" : ""}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
              {!dataOk ? "진입·주문 기록은 진입가와 증거금이 있어야 해요 (4단계)." : !passed ? "⚠️ 게이트 미통과 상태로 진입하면 '규칙 위반'으로 기록되어 통계에서 따로 집계됩니다." : "실제 체결가·시간은 나중에 '진입 기록'에서 고칠 수 있어요."}
            </div>
            <button onClick={() => setStep(4)} style={{ padding: "12px 0", borderRadius: 12, border: "1px solid " + C.border, background: "transparent", color: C.muted, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>← 이전</button>
          </div>
        </div>
      )}
      </div>
      </div>
    </div>
  );
}

// ── 포지션 카드 ──────────────────────────────────────────
const STATUS_BADGE = {
  analysis: ["분석", "blue"], pending: ["지정가 대기", "muted"], canceled: ["미체결·취소", "muted"],
};
const OUTCOME_LABEL = { tp: ["✓ TP 먼저", "accent"], sl: ["✕ SL 먼저", "red"], none: ["– 둘 다 아님", "muted"] };

function Badge({ text, color }) {
  return <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 8, background: color + "18", color, border: "1px solid " + color + "40", whiteSpace: "nowrap" }}>{text}</span>;
}

function PositionCard({ pos, feePct = 0, onClose, onView, onUpdateQty, onEnter, onCancelOrder, onOutcome }) {
  const [expanded, setExpanded] = useState(false);
  const [addQtyInput, setAddQtyInput] = useState("");
  const st = pos.status;
  const pnlColor = st === "win" ? C.accent : st === "loss" ? C.red : C.muted;
  const dirColor = pos.dir === "롱" ? C.long : C.short;
  const isPartial = pos.fillType === "partial" && st === "active";
  const notEntered = st === "analysis" || st === "pending" || st === "canceled";
  const borderColor = st === "analysis" ? C.blue : st === "pending" || st === "canceled" ? C.muted : isPartial ? C.yellow : st === "active" ? C.blue : pnlColor;
  const outcome = pos.virtualOutcome && OUTCOME_LABEL[pos.virtualOutcome];
  const timeLine = [
    pos.createdAt ? "분석 " + fmtDT(pos.createdAt) : pos.date,
    pos.orderAt && "주문 " + fmtDT(pos.orderAt),
    pos.entryAt && "진입 " + fmtDT(pos.entryAt),
  ].filter(Boolean).join(" · ");

  // 진입 안 한 분석: 체결됐다면? (계획값 기준)
  const sim = notEntered && parseFloat(pos.entry) > 0 && parseFloat(pos.posSizeUsdt) > 0 ? {
    win: parseFloat(pos.tp) > 0 ? calcTrade({ dir: pos.dir, entry: pos.entry, exit: pos.tp, margin: pos.posSizeUsdt, lev: pos.lev, feePct }).pnl : null,
    loss: parseFloat(pos.sl) > 0 ? calcTrade({ dir: pos.dir, entry: pos.entry, exit: pos.sl, margin: pos.posSizeUsdt, lev: pos.lev, feePct }).pnl : null,
  } : null;

  const btn = (label, onClick, kind = "ghost", flex = 1) => (
    <button onClick={onClick} style={{ flex, padding: "11px 0", borderRadius: 9, border: kind === "ghost" ? "1px solid " + C.border : "none", background: kind === "primary" ? C.accent : kind === "blue" ? C.blue : "transparent", color: kind === "ghost" ? C.muted : "#000", fontSize: 12, fontWeight: kind === "ghost" ? 600 : 700, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>{label}</button>
  );

  return (
    <div style={{ background: C.surface, border: "1px solid " + borderColor + (st === "active" ? "80" : "40"), borderRadius: 14, overflow: "hidden", transition: "all 0.2s" }}>
      <div onClick={() => setExpanded(e => !e)} style={{ padding: "14px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{ width: 8, height: 8, flexShrink: 0, borderRadius: "50%", background: borderColor, animation: st === "active" ? "pulse 2s infinite" : "none" }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, fontSize: 16, fontFamily: "'JetBrains Mono',monospace" }}>{pos.symbol}</span>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: dirColor + "20", color: dirColor, fontWeight: 700, border: "1px solid " + dirColor + "40" }}>{pos.dir}</span>
              {pos.lev && <span style={{ fontSize: 10, color: C.muted }}>{pos.lev}x</span>}
              {STATUS_BADGE[st] && <Badge text={STATUS_BADGE[st][0]} color={C[STATUS_BADGE[st][1]]} />}
              {isPartial && <Badge text="부분체결" color={C.yellow} />}
              {pos.ruleBreak && <Badge text="규칙위반" color={C.red} />}
              {outcome && <Badge text={outcome[0]} color={C[outcome[1]]} />}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{timeLine} · {pos.score}점{isPartial && pos.filledQty && pos.targetQty ? <span style={{ color: C.yellow }}> · {pos.filledQty}/{pos.targetQty} 체결</span> : null}</div>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {(st === "win" || st === "loss") && pos.realPnl !== undefined
            ? <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 700, color: pnlColor }}>{fmtUsdt(pos.realPnl)}</div>
            : pos.entry && <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: C.muted }}>@ {pos.entry}</div>
          }
          <div style={{ fontSize: 10, color: C.muted }}>{expanded ? "▲" : "▼"}</div>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "0 16px 14px", borderTop: "1px solid " + C.border }}>
          {pos.images && pos.images.length > 0 && (
            <div style={{ marginTop: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 6, fontWeight: 600 }}>차트 이미지 {pos.images.length}장</div>
              <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
                {pos.images.map((img, i) => (
                  <img key={i} src={imgSrc(img)} alt={`차트 ${i+1}`} onClick={() => window.open(imgSrc(img))} style={{ height: 70, width: 110, objectFit: "cover", borderRadius: 8, border: "1px solid " + C.border, cursor: "pointer", flexShrink: 0 }} />
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12, marginBottom: 12 }}>
            {[[notEntered ? "계획 진입가" : "진입가", pos.entry || "-"], ["손절가", pos.sl || "-"], ["목표가", pos.tp || "-"], ["손익비", pos.rrRatio ? "1:" + pos.rrRatio : "-"], ["증거금", pos.posSizeUsdt ? pos.posSizeUsdt + " USDT" : "-"], ["손절 시", pos.maxLoss ? "-" + pos.maxLoss + " USDT" : "-"]].map(([label, val]) => (
              <div key={label} style={{ background: C.surface2, borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ fontSize: 9, color: C.muted, marginBottom: 2 }}>{label}</div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 600 }}>{val}</div>
              </div>
            ))}
          </div>
          {pos.memo && <div style={{ padding: "8px 12px", background: C.surface2, borderRadius: 8, fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{pos.memo}</div>}

          {/* 진입 안 한 분석: 체결됐다면? */}
          {sim && (
            <div style={{ padding: "12px 14px", background: C.blue + "0d", borderRadius: 10, border: "1px solid " + C.blue + "30", marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.blue, fontWeight: 600, marginBottom: 8 }}>📊 계획대로 체결됐다면?</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ padding: "8px 10px", background: C.accentDim, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>목표가 도달 시</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700, color: C.accent }}>{sim.win == null ? "-" : fmtUsdt(sim.win)}</div>
                </div>
                <div style={{ padding: "8px 10px", background: C.redDim, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>손절 시</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700, color: C.red }}>{sim.loss == null ? "-" : fmtUsdt(sim.loss)}</div>
                </div>
              </div>
            </div>
          )}

          {/* 진입 안 한 분석: 사후 결과 기록 */}
          {(st === "analysis" || st === "canceled") && onOutcome && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 6 }}>분석 결과는? (가격이 어디에 먼저 닿았나)</div>
              <div style={{ display: "flex", gap: 6 }}>
                {Object.entries(OUTCOME_LABEL).map(([key, [label, color]]) => {
                  const on = pos.virtualOutcome === key;
                  return <button key={key} onClick={() => onOutcome(pos.id, on ? null : key)} style={{ flex: 1, padding: "10px 0", borderRadius: 9, border: "1px solid " + (on ? C[color] : C.border), background: on ? C[color] + "20" : "transparent", color: on ? C[color] : C.muted, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>{label}</button>;
                })}
              </div>
            </div>
          )}

          {/* 부분 체결 — 추가 체결 수량 입력 */}
          {isPartial && onUpdateQty && (
            <div style={{ padding: "12px 14px", background: C.yellowDim, borderRadius: 10, border: "1px solid " + C.yellow + "40", marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.yellow, fontWeight: 600, marginBottom: 8 }}>+ 추가 체결 수량 합산</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="number" inputMode="decimal" value={addQtyInput} onChange={e => setAddQtyInput(e.target.value)} placeholder="추가 체결된 수량" style={{ flex: 1, background: C.surface, border: "1px solid " + C.yellow + "50", color: C.text, borderRadius: 8, padding: "8px 10px", fontFamily: "'JetBrains Mono',monospace" }} />
                <button onClick={() => { if (parseFloat(addQtyInput) > 0) { onUpdateQty(pos.id, parseFloat(addQtyInput)); setAddQtyInput(""); } }} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: C.yellow, color: "#000", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>합산</button>
              </div>
              <div style={{ fontSize: 11, color: C.yellow, marginTop: 6 }}>현재 {pos.filledQty} / 목표 {pos.targetQty} 계약</div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {btn("상세", () => onView(pos))}
            {st === "analysis" && onEnter && <>{btn("⏳ 주문 걸어둠", () => onEnter(pos, "pending"))}{btn("✓ 진입 기록", () => onEnter(pos, "fill"), "primary", 1.3)}</>}
            {st === "pending" && onEnter && <>{btn("미체결·취소", () => onCancelOrder(pos.id))}{btn("✓ 체결됨", () => onEnter(pos, "fill"), "primary", 1.3)}</>}
            {st === "canceled" && onEnter && btn("나중에 진입함", () => onEnter(pos, "fill"))}
            {st === "active" && onEnter && btn("진입 수정", () => onEnter(pos, "fill"))}
            {st === "active" && onClose && btn("청산 기록하기", () => onClose(pos), "primary", 2)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 진입 기록 창 (분석 → 지정가 대기 / 체결) ────────────────
// mode "pending": 주문만 걸어둠 · "fill": 실제 체결(진입가·시간·배율·증거금·체결량)
function EntryModal({ pos, mode, feePct, onSave, onCancel }) {
  const isFill = mode === "fill";
  const [entry, setEntry] = useState(String(pos.entry || ""));
  const [sl, setSl] = useState(String(pos.sl || ""));
  const [tp, setTp] = useState(String(pos.tp || ""));
  const [lev, setLev] = useState(String(pos.lev || "10"));
  const [margin, setMargin] = useState(String(pos.posSizeUsdt || ""));
  const [at, setAt] = useState(toLocalInput(isFill ? pos.entryAt : pos.orderAt));
  const [fillType, setFillType] = useState(pos.fillType === "partial" ? "partial" : "full");
  const [targetQty, setTargetQty] = useState(pos.targetQty ? String(pos.targetQty) : "");
  const [filledQty, setFilledQty] = useState(pos.filledQty ? String(pos.filledQty) : "");
  const [saving, setSaving] = useState(false);

  const fillRatio = isFill ? fillRatioOf({ fillType, targetQty, filledQty }) : 1;
  const m = tradeMetrics({ dir: pos.dir, entry, sl, tp, lev, margin, fillRatio, feePct });
  const threshold = pos.threshold ?? 0;
  const checks = gateChecksFor({ score: pos.score || 0, threshold, dir: pos.dir, m });
  const passed = checks.every(c => c.ok);
  const dataOk = checks.filter(c => c.data).every(c => c.ok);

  const save = async () => {
    if (!dataOk || saving) return;
    if (!passed && !confirm("게이트 조건을 통과하지 못했습니다.\n규칙 위반으로 기록할까요?")) return;
    setSaving(true);
    const d = new Date(at);
    const when = (isNaN(d) ? new Date() : d).toISOString();
    await onSave({
      entry, sl, tp, lev,
      posSizeUsdt: round2(m.marginN),
      rrRatio: round2(m.rrRatio), maxLoss: round2(m.maxLoss),
      liqPrice: m.liqPrice ? Number(m.liqPrice.toFixed(6)) : null,
      ruleBreak: !passed,
      ...(isFill ? {
        status: "active", entryAt: when, date: when.slice(0, 10),
        fillType, targetQty: parseFloat(targetQty) || null,
        filledQty: fillType === "partial" ? (parseFloat(filledQty) || 0) : (parseFloat(targetQty) || null),
      } : { status: "pending", orderAt: when }),
    });
    setSaving(false);
  };

  const field = (label, val, set, extra = {}) => (
    <div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 5, fontWeight: 600 }}>{label}</div>
      <input type="number" inputMode="decimal" value={val} onChange={e => set(e.target.value)} placeholder="0" style={{ fontFamily: "'JetBrains Mono',monospace", ...extra }} />
    </div>
  );

  return (
    <div className="tg-sheet" onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 16, padding: 24, width: "100%", maxWidth: 460, overflowY: "auto" }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{pos.symbol} {pos.dir} · {isFill ? "진입 기록" : "지정가 주문"}</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>{isFill ? "실제로 체결된 값으로 입력하세요. 분석 때 계획값이 미리 채워져 있어요." : "걸어둔 주문 조건을 확인하세요. 체결되면 '체결됨'을 누르면 됩니다."}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {field(isFill ? "체결가 (USDT)" : "주문가 (USDT)", entry, setEntry)}
            {field("레버리지 (x)", lev, setLev)}
            {field("손절가 (SL)", sl, setSl)}
            {field("목표가 (TP)", tp, setTp)}
          </div>
          {field("투입 증거금 (USDT)", margin, setMargin)}
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 5, fontWeight: 600 }}>{isFill ? "진입 시간" : "주문 시간"}</div>
            <input type="datetime-local" value={at} onChange={e => setAt(e.target.value)} />
          </div>
          {isFill && (
            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600 }}>체결</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                {[["full", "전량 체결", C.accent], ["partial", "부분 체결", C.yellow]].map(([key, label, color]) => (
                  <button key={key} onClick={() => setFillType(key)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "2px solid " + (fillType === key ? color : C.border), background: fillType === key ? color + "18" : "transparent", color: fillType === key ? color : C.muted, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>{label}</button>
                ))}
              </div>
              {fillType === "partial" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {field("목표 수량", targetQty, setTargetQty)}
                  {field("체결 수량", filledQty, setFilledQty, { borderColor: C.yellow + "80" })}
                </div>
              )}
            </div>
          )}

          {m.entryN > 0 && m.marginN > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[["손절 시", m.slSideOk ? "-" + m.maxLoss.toFixed(2) : "-", C.red], ["목표 시", m.expectedProfit > 0 ? "+" + m.expectedProfit.toFixed(2) : "-", C.accent], ["청산가", m.liqPrice ? m.liqPrice.toFixed(2) : "-", m.slBeyondLiq ? C.red : C.muted]].map(([l, v, c]) => (
                <div key={l} style={{ background: C.surface2, borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ fontSize: 10, color: C.muted }}>{l}</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: c }}>{v}</div>
                </div>
              ))}
            </div>
          )}

          {!passed && (
            <div style={{ padding: "10px 12px", borderRadius: 10, background: C.redDim, border: "1px solid " + C.red + "40", fontSize: 12, color: C.red, lineHeight: 1.6 }}>
              🔒 게이트 미통과 — 저장하면 <b>규칙 위반</b>으로 기록됩니다
              {checks.filter(c => !c.ok).map(c => <div key={c.label}>✕ {c.label}</div>)}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "13px 0", borderRadius: 10, border: "1px solid " + C.border, background: "transparent", color: C.muted, fontWeight: 600, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>취소</button>
          <button onClick={save} disabled={!dataOk || saving} style={{ flex: 2, padding: "13px 0", borderRadius: 10, border: passed ? "none" : "1px solid " + C.red, background: !dataOk ? C.surface2 : passed ? C.accent : C.redDim, color: !dataOk ? C.muted : passed ? "#000" : C.red, fontWeight: 700, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif", opacity: saving ? 0.6 : 1 }}>
            {saving ? "저장 중..." : !dataOk ? "진입가·증거금 입력 필요" : isFill ? "✓ 진입 기록 저장" : "⏳ 주문 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 청산 모달 ─────────────────────────────────────────────
function CloseModal({ pos, onSave, onCancel, feePct }) {
  const [saving, setSaving] = useState(false);
  const [manualPnl, setManualPnl] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [exitMemo, setExitMemo] = useState("");
  const [exitImages, setExitImages] = useState([]);
  const [exitImgIdx, setExitImgIdx] = useState(0);
  const fileRef = useRef();

  const addExitImages = async (files) => {
    if (!files?.length) return;
    try {
      const urls = await compressAll(files);
      setExitImages(imgs => [...imgs, ...urls]);
    } catch (e) { alert(e.message); }
  };

  const exitN = parseFloat(exitPrice) || 0;
  const fillRatio = fillRatioOf(pos);
  const calc = calcTrade({ dir: pos.dir, entry: pos.entry, exit: exitPrice, margin: pos.posSizeUsdt, lev: pos.lev, fillRatio, feePct });
  const manualN = manualPnl.trim() === "" ? null : parseFloat(manualPnl);
  const useManual = manualN !== null && !isNaN(manualN);
  const pnl = useManual ? manualN : calc.pnl;
  const marginUsed = (parseFloat(pos.posSizeUsdt) || 0) * fillRatio;
  const pct = useManual ? (marginUsed > 0 ? manualN / marginUsed * 100 : 0) : calc.pct;
  const entryN = parseFloat(pos.entry) || 0;

  return (
    <div className="tg-sheet" onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 16, padding: 24, width: "100%", maxWidth: 440, overflowY: "auto" }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{pos.symbol} 청산 기록</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600 }}>청산가 (USDT)</div>
            <input type="number" inputMode="decimal" value={exitPrice} onChange={e => setExitPrice(e.target.value)} placeholder="청산한 가격" style={{ width: "100%", background: C.surface2, border: "1px solid " + C.border, color: C.text, borderRadius: 10, padding: "12px 14px", fontFamily: "'JetBrains Mono',monospace", fontSize: 15 }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600 }}>실제 손익 직접 입력 (선택, USDT)</div>
            <input type="number" inputMode="decimal" value={manualPnl} onChange={e => setManualPnl(e.target.value)} placeholder={exitN > 0 ? "비우면 자동 계산: " + calc.pnl.toFixed(2) : "거래소 실현손익 (손실은 -)"} style={{ width: "100%", background: C.surface2, border: "1px solid " + C.border, color: C.text, borderRadius: 10, padding: "12px 14px", fontFamily: "'JetBrains Mono',monospace" }} />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>자동 계산은 증거금 × 레버리지{fillRatio < 1 ? ` × 체결 ${Math.round(fillRatio * 100)}%` : ""} − 수수료(편도 {feePct}%)</div>
          </div>
          {((exitN > 0 && entryN > 0) || useManual) && (
            <div style={{ padding: 14, background: pnl >= 0 ? "rgba(99,255,180,0.06)" : "rgba(255,77,109,0.06)", border: "1px solid " + (pnl >= 0 ? C.accent + "40" : C.red + "40"), borderRadius: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><div style={{ fontSize: 10, color: C.muted }}>실현 손익</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 18, fontWeight: 700, color: pnl >= 0 ? C.accent : C.red }}>{pnl >= 0 ? "+" : ""}{pnl.toFixed(2)} USDT</div></div>
              <div><div style={{ fontSize: 10, color: C.muted }}>수익률</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 18, fontWeight: 700, color: pct >= 0 ? C.accent : C.red }}>{pct >= 0 ? "+" : ""}{pct.toFixed(2)}%</div></div>
            </div>
          )}
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600 }}>복기 메모 (선택)</div>
            <textarea value={exitMemo} onChange={e => setExitMemo(e.target.value)} placeholder="왜 청산했나요? 잘한 점, 개선할 점..." style={{ width: "100%", background: C.surface2, border: "1px solid " + C.border, color: C.text, borderRadius: 10, padding: "10px 14px", minHeight: 70, resize: "vertical", fontSize: 13 }} />
          </div>
          {/* 청산 차트 업로드 */}
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600 }}>청산 차트 (선택)</div>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={e => addExitImages(e.target.files)} style={{ display: "none" }} />
            {exitImages.length > 0 && (
              <div style={{ position: "relative", marginBottom: 8, borderRadius: 10, overflow: "hidden", background: "#000" }}>
                <img src={exitImages[exitImgIdx]} style={{ width: "100%", maxHeight: 160, objectFit: "contain", display: "block" }} />
                {exitImages.length > 1 && (
                  <div style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 4 }}>
                    {exitImages.map((_, i) => <div key={i} onClick={() => setExitImgIdx(i)} style={{ width: i === exitImgIdx ? 14 : 5, height: 5, borderRadius: 3, background: i === exitImgIdx ? C.accent : "rgba(255,255,255,0.4)", cursor: "pointer" }} />)}
                  </div>
                )}
              </div>
            )}
            <button onClick={() => fileRef.current.click()} style={{ width: "100%", padding: "10px 0", borderRadius: 9, border: "1px dashed " + C.border, background: "transparent", color: C.muted, fontSize: 12, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>
              {exitImages.length > 0 ? `📊 ${exitImages.length}장 업로드됨 · 추가하기` : "📊 청산 차트 업로드"}
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid " + C.border, background: "transparent", color: C.muted, fontWeight: 600, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>취소</button>
          <button onClick={async () => { setSaving(true); await onSave({ exitPrice: exitN, exitMemo, exitImages, realPnl: round2(pnl), realPct: round2(pct), exitDate: todayStr(), status: pnl >= 0 ? "win" : "loss" }); setSaving(false); }} disabled={!exitN || saving} style={{ flex: 2, padding: "13px 0", borderRadius: 10, border: "none", background: C.accent, color: "#000", fontWeight: 700, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif", opacity: !exitN || saving ? 0.5 : 1 }}>{saving ? "저장 중..." : "저장"}</button>
        </div>
      </div>
    </div>
  );
}

// ── 통계 탭 ──────────────────────────────────────────────
function StatsView({ positions }) {
  const closed = positions.filter(isClosed);
  const wins = closed.filter(p => p.status === "win");
  const losses = closed.filter(p => p.status === "loss");
  const wr = closed.length ? Math.round(wins.length / closed.length * 100) : 0;
  const totalPnl = closed.reduce((a, p) => a + (p.realPnl || 0), 0);
  const avgPnl = closed.length ? totalPnl / closed.length : 0;

  // 점수대별 승률 분석 — 각 거래 당시의 만점 대비 비율로 구분
  const fallbackMax = closed.reduce((a, p) => Math.max(a, p.score || 0), 0) || 1;
  const ratioOf = p => (p.score || 0) / (p.maxScore || fallbackMax);

  // 누적 손익
  const cumData = [];
  let running = 0;
  [...closed].sort((a, b) => new Date(a.exitDate || a.date) - new Date(b.exitDate || b.date)).forEach((p, i) => {
    running += p.realPnl || 0;
    cumData.push({ x: i + 1, y: running });
  });

  // 분석 적중률 — 진입 여부와 무관하게 "가격이 TP/SL 중 어디에 먼저 닿았나"
  const judged = positions.filter(p => outcomeOf(p) === "tp" || outcomeOf(p) === "sl");
  const hits = judged.filter(p => outcomeOf(p) === "tp").length;
  const notEnteredJudged = positions.filter(p => (p.status === "analysis" || p.status === "canceled") && p.virtualOutcome);
  const missed = notEnteredJudged.filter(p => p.virtualOutcome === "tp");
  const avoided = notEnteredJudged.filter(p => p.virtualOutcome === "sl");
  const unjudged = positions.filter(p => (p.status === "analysis" || p.status === "canceled") && !p.virtualOutcome).length;
  // 규칙 준수 vs 위반
  const ruleGroups = [["규칙대로 진입", closed.filter(p => !p.ruleBreak), C.accent], ["규칙 위반 진입", closed.filter(p => p.ruleBreak), C.red]];

  const analysisCard = (
    <Card accent={C.blue}>
      <div style={{ fontSize: 12, color: C.blue, fontWeight: 700, marginBottom: 12 }}>🎯 분석 적중률 (진입 여부 무관)</div>
      {judged.length === 0 ? (
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>분석 일지에서 결과(TP 먼저 / SL 먼저)를 기록하면 여기에 집계됩니다.{unjudged ? ` 결과 미기록 ${unjudged}건.` : ""}</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 28, fontWeight: 700, color: hits / judged.length >= 0.5 ? C.accent : C.red }}>{Math.round(hits / judged.length * 100)}%</span>
            <span style={{ fontSize: 12, color: C.muted }}>{hits}/{judged.length}건 방향 적중{unjudged ? ` · 결과 미기록 ${unjudged}건` : ""}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ padding: "10px 12px", background: C.surface2, borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: C.muted }}>놓친 기회 (안 들어갔는데 TP)</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 16, fontWeight: 700, color: C.yellow }}>{missed.length}건</div>
            </div>
            <div style={{ padding: "10px 12px", background: C.surface2, borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: C.muted }}>잘 피함 (안 들어갔는데 SL)</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 16, fontWeight: 700, color: C.accent }}>{avoided.length}건</div>
            </div>
          </div>
        </>
      )}
    </Card>
  );

  if (!closed.length) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {analysisCard}
      <Card style={{ textAlign: "center", padding: 32 }}>
        <div style={{ color: C.muted, fontSize: 14 }}>청산된 거래가 아직 없습니다</div>
      </Card>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          ["승률", wr + "%", wr >= 50 ? C.accent : C.red],
          ["총 손익", (totalPnl >= 0 ? "+" : "") + totalPnl.toFixed(2) + " USDT", totalPnl >= 0 ? C.accent : C.red],
          ["청산 거래", closed.length + "건", C.text],
          ["평균 손익", (avgPnl >= 0 ? "+" : "") + avgPnl.toFixed(2) + " USDT", avgPnl >= 0 ? C.accent : C.red],
        ].map(([label, val, color]) => (
          <Card key={label}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{label}</div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 700, color }}>{val}</div>
          </Card>
        ))}
      </div>

      {analysisCard}

      {/* 규칙 준수 vs 위반 */}
      {closed.some(p => p.ruleBreak) && (
        <Card accent={C.red}>
          <div style={{ fontSize: 12, color: C.red, fontWeight: 700, marginBottom: 12 }}>🚦 게이트 규칙 준수 vs 위반</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ruleGroups.filter(([, arr]) => arr.length).map(([label, arr, color]) => {
              const w = Math.round(arr.filter(p => p.status === "win").length / arr.length * 100);
              const pnl = arr.reduce((a, p) => a + (p.realPnl || 0), 0);
              return (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: C.surface2, borderRadius: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                  <span style={{ fontSize: 13, color: C.muted, flex: 1 }}>{label} ({arr.length}건)</span>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 700, color: w >= 50 ? C.accent : C.red }}>{w}%</div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: pnl >= 0 ? C.accent : C.red }}>{fmtUsdt(pnl)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 점수대별 승률 */}
      {closed.length >= 3 && (
        <Card accent={C.accent}>
          <div style={{ fontSize: 12, color: C.accent, fontWeight: 700, marginBottom: 14 }}>⚡ 점수대별 승률</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(() => {
              const high = closed.filter(p => ratioOf(p) >= 0.6);
              const mid = closed.filter(p => ratioOf(p) >= 0.3 && ratioOf(p) < 0.6);
              const low = closed.filter(p => ratioOf(p) < 0.3);
              return [
                ["근거 많음 (60%+)", high, C.accent],
                ["근거 중간 (30~60%)", mid, C.yellow],
                ["근거 적음 (30% 미만)", low, C.muted],
              ].filter(([, arr]) => arr.length > 0).map(([label, arr, color]) => {
                const wr2 = Math.round(arr.filter(p => p.status === "win").length / arr.length * 100);
                return (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: C.surface2, borderRadius: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: C.muted, flex: 1 }}>{label} ({arr.length}건)</span>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 16, fontWeight: 700, color: wr2 >= 50 ? C.accent : C.red }}>{wr2}%</div>
                      <div style={{ fontSize: 10, color: C.muted }}>승률</div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: C.muted, lineHeight: 1.6 }}>근거를 많이 모을수록 승률이 높아지는지 확인해보세요</div>
        </Card>
      )}

      {/* 누적 손익 SVG 차트 */}
      {cumData.length > 1 && (
        <Card>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, fontWeight: 600 }}>📈 누적 손익 추이</div>
          <svg width="100%" height="120" viewBox={`0 0 300 120`} preserveAspectRatio="none">
            {(() => {
              const ys = cumData.map(d => d.y);
              const minY = Math.min(0, ...ys), maxY = Math.max(0, ...ys);
              const range = maxY - minY || 1;
              const toY = y => 110 - (y - minY) / range * 100;
              const points = cumData.map((d, i) => `${i / (cumData.length - 1) * 280 + 10},${toY(d.y)}`).join(" ");
              const lastPnl = ys[ys.length - 1] || 0;
              return <>
                <line x1="10" x2="290" y1={toY(0)} y2={toY(0)} stroke={C.border} strokeDasharray="4 4" />
                <polyline points={points} fill="none" stroke={lastPnl >= 0 ? C.accent : C.red} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              </>;
            })()}
          </svg>
        </Card>
      )}
    </div>
  );
}

// ── 체크리스트 설정 ───────────────────────────────────────
function ChecklistSettings({ groups, onGroupsChange, onSave, settings, onSettingsSave }) {
  const [thInput, setThInput] = useState(String(settings.threshold));
  const [feeInput, setFeeInput] = useState(String(settings.feePct));
  const [newGroupName, setNewGroupName] = useState("");
  const [newItems, setNewItems] = useState({});
  const [editingItem, setEditingItem] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [saved, setSaved] = useState(false);

  const update = (newGroups) => onGroupsChange(newGroups);

  const handleSave = async () => {
    const th = Math.max(0, parseInt(thInput) || 0);
    const fee = Math.max(0, parseFloat(feeInput) || 0);
    const ok1 = await onSave(groups);
    const ok2 = await onSettingsSave({ ...settings, threshold: th, feePct: fee });
    if (!ok1 || !ok2) return;
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const addGroup = () => {
    if (!newGroupName.trim()) return;
    update([...groups, { group: newGroupName.trim(), icon: "📌", items: [] }]);
    setNewGroupName("");
  };

  const removeGroup = (gi) => {
    if (!confirm("그룹을 삭제할까요?")) return;
    update(groups.filter((_, i) => i !== gi));
  };

  const addItem = (gi) => {
    const ni = newItems[gi] || {};
    if (!ni.label) return;
    update(groups.map((group, i) => i === gi ? { ...group, items: [...group.items, { id: "custom_" + Date.now(), label: ni.label, desc: ni.desc || "", score: parseInt(ni.score) || 1 }] } : group));
    setNewItems(n => ({ ...n, [gi]: {} }));
  };

  const removeItem = (gi, ii) => {
    update(groups.map((group, i) => i === gi ? { ...group, items: group.items.filter((_, j) => j !== ii) } : group));
    setEditingItem(null);
  };

  const startEdit = (gi, ii, item) => {
    setEditingItem({ gi, ii });
    setEditDraft({ label: item.label, desc: item.desc || "", score: String(item.score) });
  };

  const saveEdit = (gi, ii) => {
    update(groups.map((group, i) => i === gi ? {
      ...group,
      items: group.items.map((item, j) => j === ii ? { ...item, label: editDraft.label, desc: editDraft.desc, score: parseInt(editDraft.score) || 1 } : item)
    } : group));
    setEditingItem(null);
  };

  const totalMax = groups.flatMap(g => g.items).reduce((a, i) => a + i.score, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "fadeUp 0.3s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>체크리스트 설정</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>총 {totalMax}점 만점 · 게이트 {Math.min(parseInt(thInput) || 0, totalMax)}점</div>
        </div>
        <button onClick={handleSave} style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: saved ? C.accent + "80" : C.accent, color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>{saved ? "저장됨 ✓" : "저장"}</button>
      </div>

      {/* 게이트 / 수수료 */}
      <Card accent={C.accent}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 12 }}>🚦 게이트 & 수수료</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 5, fontWeight: 600 }}>진입 허가 최소 점수</div>
            <input type="number" inputMode="numeric" value={thInput} onChange={e => setThInput(e.target.value)} style={{ fontFamily: "'JetBrains Mono',monospace" }} />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>만점 {totalMax}점 중 {totalMax ? Math.round((parseInt(thInput) || 0) / totalMax * 100) : 0}%</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 5, fontWeight: 600 }}>수수료 (편도 %)</div>
            <input type="number" inputMode="decimal" value={feeInput} onChange={e => setFeeInput(e.target.value)} style={{ fontFamily: "'JetBrains Mono',monospace" }} />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>시장가 보통 0.04~0.05%</div>
          </div>
        </div>
      </Card>

      {groups.map((group, gi) => (
        <Card key={gi} accent={C.blue}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.blue }}>{group.icon} {group.group}</div>
            <button onClick={() => removeGroup(gi)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 12, padding: "2px 6px" }}>✕ 그룹삭제</button>
          </div>

          {/* 항목 목록 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {group.items.map((item, ii) => {
              const isEditing = editingItem?.gi === gi && editingItem?.ii === ii;
              return isEditing ? (
                /* 수정 모드 */
                <div key={ii} style={{ padding: "10px 12px", background: C.accentDim, borderRadius: 8, border: "1px solid " + C.accent + "50", display: "flex", flexDirection: "column", gap: 8 }}>
                  <input value={editDraft.label} onChange={e => setEditDraft(d => ({ ...d, label: e.target.value }))} placeholder="항목 이름" style={{ background: C.surface, border: "1px solid " + C.accent + "60", color: C.text, borderRadius: 7, padding: "7px 10px", fontSize: 13, fontWeight: 600 }} />
                  <input value={editDraft.desc} onChange={e => setEditDraft(d => ({ ...d, desc: e.target.value }))} placeholder="설명 (선택)" style={{ background: C.surface, border: "1px solid " + C.border, color: C.text, borderRadius: 7, padding: "7px 10px", fontSize: 12 }} />
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select value={editDraft.score} onChange={e => setEditDraft(d => ({ ...d, score: e.target.value }))} style={{ background: C.surface, border: "1px solid " + C.border, color: C.accent, borderRadius: 7, padding: "7px 10px", fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>
                      {[1,2,3,4,5].map(n => <option key={n} value={n}>+{n}점</option>)}
                    </select>
                    <button onClick={() => saveEdit(gi, ii)} style={{ flex: 1, padding: "8px 0", borderRadius: 7, border: "none", background: C.accent, color: "#000", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>저장</button>
                    <button onClick={() => setEditingItem(null)} style={{ padding: "8px 12px", borderRadius: 7, border: "1px solid " + C.border, background: "transparent", color: C.muted, fontSize: 12, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>취소</button>
                    <button onClick={() => removeItem(gi, ii)} style={{ padding: "8px 12px", borderRadius: 7, border: "1px solid " + C.red + "40", background: C.redDim, color: C.red, fontSize: 12, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>삭제</button>
                  </div>
                </div>
              ) : (
                /* 일반 모드 */
                <div key={ii} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: C.surface2, borderRadius: 8, cursor: "pointer" }} onClick={() => startEdit(gi, ii, item)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{item.label}</div>
                    {item.desc && <div style={{ fontSize: 11, color: C.muted }}>{item.desc}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: C.accent, background: C.accentDim, padding: "2px 8px", borderRadius: 10 }}>+{item.score}점</span>
                    <span style={{ fontSize: 11, color: C.muted }}>수정 →</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 항목 추가 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 10, background: C.surface2, borderRadius: 8, border: "1px dashed " + C.border }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>+ 항목 추가</div>
            <input placeholder="항목 이름 (예: 전저점 이탈 여부)" value={(newItems[gi] || {}).label || ""} onChange={e => setNewItems(n => ({ ...n, [gi]: { ...(n[gi] || {}), label: e.target.value } }))} style={{ background: C.surface, border: "1px solid " + C.border, color: C.text, borderRadius: 7, padding: "7px 10px", fontSize: 13 }} />
            <input placeholder="설명 (선택)" value={(newItems[gi] || {}).desc || ""} onChange={e => setNewItems(n => ({ ...n, [gi]: { ...(n[gi] || {}), desc: e.target.value } }))} style={{ background: C.surface, border: "1px solid " + C.border, color: C.text, borderRadius: 7, padding: "7px 10px", fontSize: 12 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <select value={(newItems[gi] || {}).score || "1"} onChange={e => setNewItems(n => ({ ...n, [gi]: { ...(n[gi] || {}), score: e.target.value } }))} style={{ background: C.surface, border: "1px solid " + C.border, color: C.text, borderRadius: 7, padding: "7px 10px", fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>+{n}점</option>)}
              </select>
              <button onClick={() => addItem(gi)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: C.blue, color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>추가</button>
            </div>
          </div>
        </Card>
      ))}

      {/* 그룹 추가 */}
      <Card>
        <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 8 }}>새 그룹 추가</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="그룹 이름 (예: 온체인 지표)" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} onKeyDown={e => e.key === "Enter" && addGroup()} style={{ flex: 1, background: C.surface2, border: "1px solid " + C.border, color: C.text, borderRadius: 8, padding: "10px 12px", fontSize: 13 }} />
          <button onClick={addGroup} style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: C.accent, color: "#000", fontWeight: 700, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>추가</button>
        </div>
      </Card>

      <button onClick={handleSave} style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", background: saved ? C.accent + "80" : C.accent, color: "#000", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>{saved ? "저장됨 ✓" : "변경사항 저장"}</button>
    </div>
  );
}

// ── 메인 앱 ──────────────────────────────────────────────
// ── 시드 설정 모달 ────────────────────────────────────────
function SeedModal({ seed, onSave, onCancel, totalPnl, currentSeed, seedReturn }) {
  const [initialInput, setInitialInput] = useState(seed.initial > 0 ? String(seed.initial) : "");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMemo, setWithdrawMemo] = useState("");
  const todayS = todayStr();

  const handleSaveInitial = () => {
    const val = parseFloat(initialInput) || 0;
    if (val <= 0) return;
    onSave({ ...seed, initial: val });
  };

  const handleWithdraw = () => {
    const amt = parseFloat(withdrawAmount) || 0;
    if (amt <= 0) return;
    const newW = { id: Date.now(), amount: amt, memo: withdrawMemo, date: todayS };
    onSave({ ...seed, withdrawals: [...(seed.withdrawals || []), newW] });
    setWithdrawAmount(""); setWithdrawMemo("");
  };

  const handleDeleteWithdrawal = (id) => {
    onSave({ ...seed, withdrawals: (seed.withdrawals || []).filter(w => w.id !== id) });
  };

  return (
    <div className="tg-sheet" onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: "16px 16px 0 0", padding: 24, width: "100%", maxWidth: 600, maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>시드 관리</div>
          <button onClick={onCancel} style={{ background: C.surface2, border: "1px solid " + C.border, color: C.text, width: 30, height: 30, borderRadius: "50%", cursor: "pointer", fontSize: 14 }}>✕</button>
        </div>

        {/* 현재 시드 현황 */}
        {seed.initial > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
            {[
              ["초기 시드", seed.initial.toFixed(2) + " USDT", C.muted],
              ["누적 손익", (totalPnl >= 0 ? "+" : "") + totalPnl.toFixed(2) + " USDT", totalPnl >= 0 ? C.accent : C.red],
              ["현재 시드", currentSeed.toFixed(2) + " USDT", currentSeed >= seed.initial ? C.accent : C.red],
            ].map(([label, val, color]) => (
              <div key={label} style={{ padding: "12px", background: C.surface2, borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 9, color: C.muted, marginBottom: 4, fontWeight: 600 }}>{label}</div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color }}>{val}</div>
              </div>
            ))}
          </div>
        )}

        {/* 초기 시드 설정 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 8, letterSpacing: 1 }}>초기 시드 (USDT)</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="number" inputMode="decimal" value={initialInput} onChange={e => setInitialInput(e.target.value)} placeholder="예: 1000" style={{ flex: 1, background: C.surface2, border: "1px solid " + C.border, color: C.text, borderRadius: 10, padding: "12px 14px", fontFamily: "'JetBrains Mono',monospace", fontSize: 15 }} />
            <button onClick={handleSaveInitial} style={{ padding: "12px 18px", borderRadius: 10, border: "none", background: C.accent, color: "#000", fontWeight: 700, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif", whiteSpace: "nowrap" }}>저장</button>
          </div>
        </div>

        {/* 출금 기록 */}
        <div>
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 8, letterSpacing: 1 }}>출금 기록 (USDT)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
            <input type="number" inputMode="decimal" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="출금 금액 (USDT)" style={{ background: C.surface2, border: "1px solid " + C.border, color: C.text, borderRadius: 10, padding: "10px 14px", fontFamily: "'JetBrains Mono',monospace", fontSize: 14 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <input value={withdrawMemo} onChange={e => setWithdrawMemo(e.target.value)} placeholder="메모 (선택)" style={{ flex: 1, background: C.surface2, border: "1px solid " + C.border, color: C.text, borderRadius: 10, padding: "10px 14px", fontSize: 13 }} />
              <button onClick={handleWithdraw} disabled={!withdrawAmount} style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: parseFloat(withdrawAmount) > 0 ? C.red : C.surface2, color: parseFloat(withdrawAmount) > 0 ? "#fff" : C.muted, fontWeight: 700, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif", whiteSpace: "nowrap" }}>출금 추가</button>
            </div>
          </div>

          {/* 출금 내역 */}
          {(seed.withdrawals || []).length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>출금 내역</div>
              {[...(seed.withdrawals || [])].reverse().map(w => (
                <div key={w.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: C.surface2, borderRadius: 8, border: "1px solid " + C.border }}>
                  <div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700, color: C.red }}>-{w.amount.toFixed(2)} USDT</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{w.date}{w.memo ? " · " + w.memo : ""}</div>
                  </div>
                  <button onClick={() => handleDeleteWithdrawal(w.id)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16, padding: "4px 8px" }}>✕</button>
                </div>
              ))}
              <div style={{ padding: "8px 12px", background: "rgba(255,77,109,0.06)", borderRadius: 8, border: "1px solid " + C.red + "30", textAlign: "center" }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: C.red }}>총 출금: -{(seed.withdrawals || []).reduce((a, w) => a + w.amount, 0).toFixed(2)} USDT</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 로그인 화면 ──────────────────────────────────────────
function LoginScreen({ mode, onLogin }) {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!pw || busy) return;
    setBusy(true); setErr("");
    try { await onLogin(pw); } catch (e2) { setErr(e2.message); }
    setBusy(false);
  };
  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 20px" }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 44 }}>🚪</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>TradeGate</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{mode === "unconfigured" ? "서버 설정이 필요합니다" : "비밀번호를 입력하세요"}</div>
        </div>
        {mode === "unconfigured" ? (
          <Card>
            <div style={{ fontSize: 13, lineHeight: 1.7, color: C.text }}>
              Vercel 프로젝트 → Settings → Environment Variables에 <b style={{ fontFamily: "'JetBrains Mono',monospace" }}>APP_PASSWORD</b>를 추가하고 다시 배포하세요.
            </div>
          </Card>
        ) : (
          <>
            <div style={{ position: "relative" }}>
              <input type={show ? "text" : "password"} autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus value={pw} onChange={e => setPw(e.target.value)} placeholder="비밀번호" style={{ padding: "14px 52px 14px 16px", borderRadius: 12, background: C.surface, border: "1px solid " + (err ? C.red : C.border), color: C.text, fontFamily: show ? "'JetBrains Mono',monospace" : undefined }} />
              <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? "비밀번호 숨기기" : "비밀번호 보기"} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 40, height: 40, border: "none", background: "transparent", cursor: "pointer", fontSize: 18 }}>{show ? "🙈" : "👁"}</button>
            </div>
            {err && <div style={{ fontSize: 13, color: C.red }}>{err}</div>}
            <button type="submit" disabled={!pw || busy} style={{ padding: "14px 0", borderRadius: 12, border: "none", background: C.accent, color: "#000", fontWeight: 700, fontSize: 15, cursor: "pointer", opacity: !pw || busy ? 0.6 : 1, fontFamily: "'Space Grotesk',sans-serif" }}>{busy ? "확인 중..." : "로그인"}</button>
          </>
        )}
      </form>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("positions");
  const [positions, setPositions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [showWizard, setShowWizard] = useState(false);
  const [closeTarget, setCloseTarget] = useState(null);
  const [entryTarget, setEntryTarget] = useState(null); // { pos, mode: "pending" | "fill" }
  const [detailPos, setDetailPos] = useState(null);
  const [seed, setSeed] = useState({ initial: 0, withdrawals: [] });
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [checklist, setChecklist] = useState(ANALYSIS_ITEMS);
  const [editableChecklist, setEditableChecklist] = useState(ANALYSIS_ITEMS);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isDark, setIsDark] = useState(true);
  const [toast, setToast] = useState(null); // { msg, error }
  const [auth, setAuth] = useState("checking"); // checking | ok | login | unconfigured
  const toastTimer = useRef();

  useEffect(() => {
    const saved = localStorage.getItem("tg_theme");
    if (saved === "light") setIsDark(false);
  }, []);

  // 테마 변경 시 C 업데이트
  C = isDark ? { ...DARK } : { ...LIGHT };

  const toggleTheme = () => {
    setIsDark(d => {
      const next = !d;
      localStorage.setItem("tg_theme", next ? "dark" : "light");
      return next;
    });
  };

  const showToast = (msg, error = false) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, error });
    toastTimer.current = setTimeout(() => setToast(null), error ? 6000 : 2000);
  };

  // ── 로그인 → 데이터 로드 ──
  const loadAll = async () => {
    setLoaded(false); setLoadError("");
    try {
      const [ps, sd, cl, st] = await Promise.all([loadPositions(), loadData("seed"), loadData("checklist"), loadData("settings")]);
      setPositions(ps.map(normalizePos));
      if (sd) setSeed(sd);
      if (cl) { setChecklist(cl); setEditableChecklist(JSON.parse(JSON.stringify(cl))); }
      if (st) setSettings({ ...DEFAULT_SETTINGS, ...st });
    } catch (e) {
      if (e instanceof AuthError) return;
      setLoadError(e.message);
    }
    setLoaded(true);
  };

  useEffect(() => {
    onAuthLost = (j) => setAuth(j?.code === "NO_PASSWORD" ? "unconfigured" : "login");
    fetch("/api/session").then(r => r.json()).then(j => {
      if (!j.configured) setAuth("unconfigured");
      else if (!j.authed) setAuth("login");
      else { setAuth("ok"); loadAll(); }
    }).catch(() => { setAuth("ok"); loadAll(); });
  }, []);

  const handleLogin = async (password) => {
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "로그인 실패");
    setAuth("ok");
    loadAll();
  };

  const handleLogout = async () => {
    if (!confirm("로그아웃할까요?")) return;
    await fetch("/api/login", { method: "DELETE" }).catch(() => {});
    setPositions([]); setSeed({ initial: 0, withdrawals: [] });
    setAuth("login");
  };

  // 실패하면 토스트로 알리고 false 반환
  const attempt = async (fn, okMsg) => {
    try { await fn(); if (okMsg) showToast(okMsg); return true; }
    catch (e) { if (!(e instanceof AuthError)) showToast("⚠️ " + e.message, true); return false; }
  };
  const persist = (key, value) => attempt(() => saveData(key, JSON.stringify(value)));

  const saveSeed = async (newSeed) => { setSeed(newSeed); return persist("seed", newSeed); };
  const saveSettings = async (newSt) => { setSettings(newSt); return persist("settings", newSt); };
  const saveChecklist = async (newCl) => {
    setChecklist(newCl);
    setEditableChecklist(JSON.parse(JSON.stringify(newCl)));
    return persist("checklist", newCl);
  };

  // 포지션 1건 저장 (이미지 먼저 업로드 → id로 교체). 성공 시 화면 반영
  const upsertPos = async (pos, okMsg) => attempt(async () => {
    const stored = { ...pos };
    if (pos.images) stored.images = await uploadImages(pos.images);
    if (pos.exitImages) stored.exitImages = await uploadImages(pos.exitImages);
    await putPosition(stored);
    setPositions(ps => ps.some(p => p.id === stored.id) ? ps.map(p => p.id === stored.id ? stored : p) : [stored, ...ps]);
  }, okMsg);
  const patchPos = (id, patch, okMsg) => {
    const cur = positions.find(p => p.id === id);
    return cur ? upsertPos({ ...cur, ...(typeof patch === "function" ? patch(cur) : patch) }, okMsg) : false;
  };

  const handleComplete = async (data) => {
    const msg = { analysis: "📝 분석 저장됨", pending: "⏳ 지정가 주문 저장됨", active: "✓ 진입 저장됨" }[data.status];
    if (await upsertPos(data, msg)) { setShowWizard(false); setTab(data.status === "analysis" ? "journal" : "positions"); }
  };

  // 분석 → 지정가 대기 / 체결 (진입가·시간·배율·증거금)
  const handleEntrySave = async (patch) => {
    const msg = patch.status === "active" ? "✓ 진입 기록됨" : "⏳ 주문 저장됨";
    if (await patchPos(entryTarget.pos.id, patch, msg)) { setEntryTarget(null); setTab("positions"); }
  };

  // 진입 안 한 분석의 사후 결과 (tp | sl | none | null)
  const handleOutcome = (id, outcome) => patchPos(id, { virtualOutcome: outcome, outcomeAt: outcome ? nowIso() : null });

  const handleClose = async (result) => {
    if (await patchPos(closeTarget.id, result, "✓ 청산 기록됨")) setCloseTarget(null);
  };

  const handleUpdateQty = (id, addedQty) => patchPos(id, p => {
    const newFilled = (parseFloat(p.filledQty) || 0) + addedQty;
    const isFull = p.targetQty && newFilled >= parseFloat(p.targetQty);
    return { filledQty: Math.round(newFilled * 10000) / 10000, fillType: isFull ? "full" : "partial" };
  });

  // 지정가 대기 → 미체결·취소 (분석 일지로 이동, 결과는 나중에 기록 가능)
  const handleCancelOrder = id => {
    if (!confirm("미체결·취소로 옮길까요?\n분석 일지에 남고, 나중에 결과(TP/SL)를 기록할 수 있어요.")) return;
    return patchPos(id, { status: "canceled", canceledAt: nowIso() }, "분석 일지로 이동");
  };

  const deletePos = id => attempt(async () => {
    await deletePosition(id);
    setPositions(ps => ps.filter(p => p.id !== id));
  }, "삭제됨");

  const closed = positions.filter(isClosed);
  const history = positions.filter(isClosed);
  const journal = positions.filter(p => p.status === "analysis" || p.status === "canceled");
  const journalUnjudged = journal.filter(p => !p.virtualOutcome).length;

  // 시드 계산
  const totalPnl = closed.reduce((a, p) => a + (p.realPnl || 0), 0);
  const totalWithdrawals = (seed.withdrawals || []).reduce((a, w) => a + w.amount, 0);
  const currentSeed = seed.initial + totalPnl - totalWithdrawals;
  const seedReturn = seed.initial > 0 ? ((currentSeed - seed.initial) / seed.initial * 100) : 0;

  const TABS = [["positions", "📍", "포지션"], ["journal", "📝", "분석"], ["history", "📋", "기록"], ["stats", "📊", "통계"]];
  const TITLES = { positions: "포지션", journal: "분석 일지", history: "청산 기록", stats: "통계", settings: "설정" };
  const openWizard = () => { setShowWizard(true); window.scrollTo(0, 0); };
  const cardProps = { feePct: settings.feePct, onClose: setCloseTarget, onView: setDetailPos, onUpdateQty: handleUpdateQty, onEnter: (pos, mode) => setEntryTarget({ pos, mode }), onCancelOrder: handleCancelOrder, onOutcome: handleOutcome };

  const head = (
    <Head>
      <title>TradeGate</title>
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="TradeGate" />
      <meta name="theme-color" content={isDark ? "#0e1120" : "#ffffff"} />
    </Head>
  );

  if (auth === "login" || auth === "unconfigured") return (
    <div style={{ background: C.bg, minHeight: "100dvh", color: C.text, fontFamily: "'Space Grotesk',sans-serif" }}>
      {head}
      <style dangerouslySetInnerHTML={{ __html: getCSS(isDark) }} />
      <LoginScreen mode={auth} onLogin={handleLogin} />
    </div>
  );

  if (auth === "checking" || !loaded) return (
    <div style={{ background: C.bg, minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
      {head}
      <style dangerouslySetInnerHTML={{ __html: getCSS(isDark) }} />
      <div style={{ width: 32, height: 32, border: "3px solid " + C.surface2, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <div style={{ color: C.muted, fontSize: 13 }}>TradeGate 로딩 중...</div>
    </div>
  );

  const seedChip = seed.initial > 0 ? (
    <div onClick={() => setShowSeedModal(true)} style={{ cursor: "pointer", textAlign: "right" }}>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700, color: currentSeed >= seed.initial ? C.accent : C.red }}>{currentSeed.toFixed(2)}</div>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: seedReturn >= 0 ? C.accent : C.red }}>{seedReturn >= 0 ? "+" : ""}{seedReturn.toFixed(2)}%</div>
    </div>
  ) : (
    <button onClick={() => setShowSeedModal(true)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px dashed " + C.border, background: "transparent", color: C.muted, fontSize: 12, cursor: "pointer" }}>+ 시드</button>
  );

  const section = (color, label, list, glow) => list.length > 0 && (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: glow ? "0 0 6px " + color : "none", animation: glow ? "pulse 2s infinite" : "none" }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: color === C.accent ? C.text : color }}>{label}</span>
        <span style={{ fontSize: 12, color }}>{list.length}건</span>
      </div>
      {list.map(p => <PositionCard key={p.id} pos={p} {...cardProps} />)}
    </div>
  );

  const fullActive = positions.filter(p => p.status === "active" && p.fillType !== "partial");
  const partials = positions.filter(p => p.status === "active" && p.fillType === "partial");
  const pendingOrders = positions.filter(p => p.status === "pending");

  // 상세 보기용 근거 목록 (신규: checkedItems / 구버전: checked + checklist)
  const detailItems = detailPos ? (detailPos.checkedItems || Object.entries(detailPos.checked || {})
    .filter(([, v]) => v?.on || v === true)
    .map(([id, v]) => {
      const item = (detailPos.checklist || ANALYSIS_ITEMS).flatMap(g => g.items).find(i => i.id === id);
      return item ? { id, label: item.label, score: item.score, comment: v?.comment || "" } : null;
    }).filter(Boolean)) : [];

  return (
    <div style={{ background: C.bg, minHeight: "100dvh", color: C.text, fontFamily: "'Space Grotesk',sans-serif" }}>
      {head}
      <style dangerouslySetInnerHTML={{ __html: getCSS(isDark) }} />
      <div className={"tg-shell" + (showWizard ? " wiz" : "")}>

        {/* ── 사이드바 (펼친 화면 / 듀얼 왼쪽 화면) ── */}
        <div className="tg-side" style={{ background: C.surface, borderRight: "1px solid " + C.border, padding: "calc(20px + env(safe-area-inset-top)) 16px 20px", flexDirection: "column", gap: 8, position: "sticky", top: 0, height: "100dvh", overflowY: "auto" }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5, marginBottom: 4 }}>TradeGate</div>
            <div style={{ fontSize: 11, color: C.muted }}>코인 선물 · 게이트 {settings.threshold}점</div>
          </div>

          {/* 시드 요약 */}
          {seed.initial > 0 ? (
            <div onClick={() => setShowSeedModal(true)} style={{ padding: "12px 14px", background: C.surface2, borderRadius: 10, border: "1px solid " + C.border, cursor: "pointer", marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, fontWeight: 600 }}>현재 시드</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 700, color: currentSeed >= seed.initial ? C.accent : C.red }}>{currentSeed.toFixed(2)} USDT</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: seedReturn >= 0 ? C.accent : C.red, marginTop: 2 }}>{seedReturn >= 0 ? "+" : ""}{seedReturn.toFixed(2)}%</div>
            </div>
          ) : (
            <div onClick={() => setShowSeedModal(true)} style={{ padding: "10px 14px", background: C.surface2, borderRadius: 10, border: "1px dashed " + C.border, cursor: "pointer", marginBottom: 8, textAlign: "center" }}>
              <div style={{ fontSize: 12, color: C.muted }}>+ 시드 설정</div>
            </div>
          )}

          <button onClick={openWizard} style={{ padding: "12px 14px", borderRadius: 10, border: "none", background: C.accent, color: "#000", fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 8, fontFamily: "'Space Grotesk',sans-serif" }}>+ 새 분석</button>

          {TABS.map(([id, icon, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ padding: "12px 14px", borderRadius: 10, border: "none", background: tab === id ? C.accent + "18" : "transparent", color: tab === id ? C.accent : C.muted, fontWeight: tab === id ? 700 : 400, fontSize: 14, cursor: "pointer", textAlign: "left", fontFamily: "'Space Grotesk',sans-serif", borderLeft: "3px solid " + (tab === id ? C.accent : "transparent") }}>
              {icon} {label}{id === "journal" && journalUnjudged > 0 ? <span style={{ marginLeft: 6, fontSize: 11, color: C.yellow }}>{journalUnjudged}</span> : null}
            </button>
          ))}
          <button onClick={() => setTab("settings")} style={{ padding: "12px 14px", borderRadius: 10, border: "none", background: tab === "settings" ? C.accent + "18" : "transparent", color: tab === "settings" ? C.accent : C.muted, fontWeight: tab === "settings" ? 700 : 400, fontSize: 14, cursor: "pointer", textAlign: "left", fontFamily: "'Space Grotesk',sans-serif", borderLeft: "3px solid " + (tab === "settings" ? C.accent : "transparent") }}>⚙️ 설정</button>

          <div style={{ flex: 1 }} />

          <button onClick={toggleTheme} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid " + C.border, background: "transparent", color: C.muted, fontSize: 13, cursor: "pointer", textAlign: "left", fontFamily: "'Space Grotesk',sans-serif", display: "flex", alignItems: "center", gap: 8 }}>
            <span>{isDark ? "☀️" : "🌙"}</span>
            <span>{isDark ? "라이트 모드" : "다크 모드"}</span>
          </button>
          <button onClick={handleLogout} style={{ padding: "10px 14px", borderRadius: 10, border: "none", background: "transparent", color: C.muted, fontSize: 13, cursor: "pointer", textAlign: "left", fontFamily: "'Space Grotesk',sans-serif" }}>🔓 로그아웃</button>
        </div>

        {/* ── 메인 콘텐츠 ── */}
        <div className="tg-main">

          {/* 상단 헤더 */}
          <div className="tg-header" style={{ borderBottom: "1px solid " + C.border, background: C.surface, position: "sticky", top: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>
              {showWizard ? "새 분석" : TITLES[tab]}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {seedChip}
              <button onClick={() => { setShowWizard(false); setTab("settings"); }} aria-label="설정" style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid " + (tab === "settings" ? C.accent : C.border), background: "transparent", cursor: "pointer", fontSize: 16 }}>⚙️</button>
              <button onClick={toggleTheme} aria-label="테마" style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid " + C.border, background: "transparent", cursor: "pointer", fontSize: 16 }}>{isDark ? "☀️" : "🌙"}</button>
            </div>
          </div>

          {loadError && <div style={{ margin: "12px 14px 0", padding: "10px 14px", borderRadius: 10, background: C.redDim, color: C.red, fontSize: 13 }}>⚠️ 데이터를 불러오지 못했습니다: {loadError}. 지금 저장하면 기존 데이터를 덮어쓸 수 있으니 새로고침하세요.</div>}

          {/* 컨텐츠 영역 */}
          <div className="tg-content">
            {showWizard ? (
              <AnalysisWizard onComplete={handleComplete} onCancel={() => setShowWizard(false)} checklist={checklist} settings={settings} />
            ) : tab === "positions" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
                {fullActive.length + partials.length + pendingOrders.length === 0 && (
                  <Card style={{ textAlign: "center", padding: 40 }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🚪</div>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>열린 포지션 없음</div>
                    <div style={{ fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 1.6 }}>분석은 언제든 기록하고, 진입은 게이트({settings.threshold}점)를 통과했을 때만</div>
                    <button onClick={openWizard} style={{ padding: "13px 24px", borderRadius: 10, border: "none", background: C.accent, color: "#000", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>새 분석 시작하기</button>
                  </Card>
                )}
                {section(C.accent, "진행 중", fullActive, true)}
                {section(C.yellow, "부분 체결", partials, true)}
                {section(C.muted, "지정가 대기", pendingOrders, false)}
              </div>
            ) : tab === "journal" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 720 }}>
                {journal.length === 0
                  ? <Card style={{ textAlign: "center", padding: 40 }}>
                      <div style={{ fontSize: 32, marginBottom: 10 }}>📝</div>
                      <div style={{ color: C.muted, fontSize: 14, lineHeight: 1.6 }}>진입하지 않은 분석이 여기에 쌓여요.<br />나중에 TP/SL 중 어디에 먼저 닿았는지 기록하면<br />통계에서 분석 적중률을 볼 수 있어요.</div>
                    </Card>
                  : <>
                      {journalUnjudged > 0 && <div style={{ fontSize: 12, color: C.yellow }}>결과 미기록 {journalUnjudged}건 — 카드를 눌러 TP/SL 결과를 남겨주세요</div>}
                      {journal.map(p => <PositionCard key={p.id} pos={p} {...cardProps} />)}
                    </>
                }
              </div>
            ) : tab === "history" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 720 }}>
                {history.length === 0
                  ? <Card style={{ textAlign: "center", padding: 40 }}><div style={{ color: C.muted, fontSize: 14 }}>청산된 포지션이 없습니다</div></Card>
                  : history.map(p => <PositionCard key={p.id} pos={p} feePct={settings.feePct} onView={setDetailPos} />)
                }
              </div>
            ) : tab === "stats" ? (
              <div style={{ maxWidth: 720 }}><StatsView positions={positions} /></div>
            ) : (
              <div style={{ maxWidth: 720 }}>
                <ChecklistSettings groups={editableChecklist} onGroupsChange={setEditableChecklist} onSave={saveChecklist} settings={settings} onSettingsSave={saveSettings} />
                <button onClick={handleLogout} style={{ width: "100%", marginTop: 14, padding: "13px 0", borderRadius: 12, border: "1px solid " + C.border, background: "transparent", color: C.muted, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>🔓 로그아웃</button>
              </div>
            )}
          </div>

          {/* ── 하단 탭바 (폰) ── */}
          {!showWizard && (
            <div className="tg-bottomnav" style={{ background: C.surface, borderTop: "1px solid " + C.border, alignItems: "center", justifyContent: "space-around" }}>
              {TABS.slice(0, 2).map(([id, icon, label]) => (
                <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: "6px 0", border: "none", background: "transparent", color: tab === id ? C.accent : C.muted, fontSize: 11, fontWeight: tab === id ? 700 : 500, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}><span style={{ fontSize: 20 }}>{icon}</span>{label}</button>
              ))}
              <button onClick={openWizard} aria-label="새 분석" style={{ width: 56, height: 56, borderRadius: 18, border: "none", background: C.accent, color: "#000", fontSize: 28, fontWeight: 700, cursor: "pointer", marginTop: -20, boxShadow: "0 6px 20px " + C.accent + "50" }}>+</button>
              {TABS.slice(2).map(([id, icon, label]) => (
                <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: "6px 0", border: "none", background: "transparent", color: tab === id ? C.accent : C.muted, fontSize: 11, fontWeight: tab === id ? 700 : 500, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}><span style={{ fontSize: 20 }}>{icon}</span>{label}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 토스트 */}
      {toast && (
        <div onClick={() => setToast(null)} style={{ position: "fixed", left: 16, right: 16, bottom: "calc(90px + env(safe-area-inset-bottom))", zIndex: 2000, display: "flex", justifyContent: "center" }}>
          <div style={{ maxWidth: 480, padding: "12px 16px", borderRadius: 12, background: toast.error ? C.red : C.surface2, color: toast.error ? "#fff" : C.text, border: "1px solid " + (toast.error ? C.red : C.border), fontSize: 13, lineHeight: 1.5, boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>{toast.msg}</div>
        </div>
      )}

      {/* 진입 기록 모달 */}
      {entryTarget && <EntryModal key={entryTarget.pos.id + entryTarget.mode} pos={entryTarget.pos} mode={entryTarget.mode} feePct={settings.feePct} onSave={handleEntrySave} onCancel={() => setEntryTarget(null)} />}

      {/* 청산 모달 */}
      {closeTarget && <CloseModal pos={closeTarget} onSave={handleClose} onCancel={() => setCloseTarget(null)} feePct={settings.feePct} />}

      {/* 시드 설정 모달 */}
      {showSeedModal && <SeedModal seed={seed} onSave={saveSeed} onCancel={() => setShowSeedModal(false)} totalPnl={totalPnl} currentSeed={currentSeed} seedReturn={seedReturn} />}

      {/* 상세 모달 */}
      {detailPos && (
        <div className="tg-sheet" onClick={() => setDetailPos(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 16, padding: 24, width: "100%", maxWidth: 600, maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{detailPos.symbol} 분석 상세</div>
              <button onClick={() => setDetailPos(null)} style={{ background: C.surface2, border: "1px solid " + C.border, color: C.text, width: 34, height: 34, borderRadius: "50%", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>
                수집된 근거 ({detailItems.length}개) · {detailPos.score}{detailPos.maxScore ? "/" + detailPos.maxScore : ""}점{detailPos.threshold != null ? ` · 게이트 ${detailPos.threshold}점` : ""}
              </div>
              {detailItems.map(item => (
                <div key={item.id} style={{ padding: "10px 12px", background: C.accentDim, borderRadius: 8, border: "1px solid " + C.accent + "30" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: C.accent, fontWeight: 600 }}>✓ {item.label}</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: C.accent }}>+{item.score}점</span>
                  </div>
                  {item.comment && <div style={{ fontSize: 12, color: C.muted, marginTop: 5, paddingTop: 5, borderTop: "1px solid " + C.accent + "20" }}>💬 {item.comment}</div>}
                </div>
              ))}
              {/* 타임라인 · 계획 vs 실제 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  ["분석", fmtDT(detailPos.createdAt) || detailPos.date],
                  ["주문", fmtDT(detailPos.orderAt)],
                  ["진입", fmtDT(detailPos.entryAt)],
                  ["청산", detailPos.exitDate || ""],
                  ["계획 진입가", detailPos.plan?.entry],
                  ["실제 진입가", detailPos.entryAt ? detailPos.entry : ""],
                  ["레버리지 · 증거금", detailPos.lev ? `${detailPos.lev}x · ${detailPos.posSizeUsdt || "-"} USDT` : ""],
                  ["예상 청산가", detailPos.liqPrice],
                ].filter(([, v]) => v).map(([l, v]) => (
                  <div key={l} style={{ background: C.surface2, borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10, color: C.muted }}>{l}</div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 600 }}>{v}</div>
                  </div>
                ))}
              </div>
              {detailPos.ruleBreak && <div style={{ fontSize: 12, color: C.red }}>⚠️ 게이트 미통과 상태에서 진입 (규칙 위반)</div>}
              {detailPos.memo && <div style={{ padding: "10px 12px", background: C.surface2, borderRadius: 8, fontSize: 13, color: C.muted, whiteSpace: "pre-wrap" }}>{detailPos.memo}</div>}
              {detailPos.aiAdvice && (
                <div style={{ padding: "12px 14px", background: "rgba(123,47,255,0.08)", border: "1px solid rgba(123,47,255,0.2)", borderRadius: 10, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  <div style={{ fontSize: 11, color: "#b47aff", fontWeight: 700, marginBottom: 6 }}>🤖 AI 분석</div>
                  {detailPos.aiAdvice}
                </div>
              )}
              {detailPos.exitMemo && (
                <div style={{ padding: "12px 14px", background: C.surface2, borderRadius: 10, fontSize: 13, whiteSpace: "pre-wrap" }}>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 4 }}>복기 메모</div>
                  {detailPos.exitMemo}
                </div>
              )}
              {detailPos.exitImages && detailPos.exitImages.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 6 }}>청산 차트</div>
                  <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
                    {detailPos.exitImages.map((img, i) => (
                      <img key={i} src={imgSrc(img)} alt={`청산 차트 ${i + 1}`} onClick={() => window.open(imgSrc(img))} style={{ height: 80, width: 130, objectFit: "cover", borderRadius: 8, border: "1px solid " + C.border, cursor: "pointer", flexShrink: 0 }} />
                    ))}
                  </div>
                </div>
              )}
              <button onClick={() => { if (confirm("이 포지션을 삭제할까요?")) { deletePos(detailPos.id); setDetailPos(null); } }} style={{ padding: "12px 0", borderRadius: 10, border: "1px solid " + C.red + "40", background: C.redDim, color: C.red, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
