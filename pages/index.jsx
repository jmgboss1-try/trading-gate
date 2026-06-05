import { useState, useEffect, useRef } from "react";

// ── 상수 ──────────────────────────────────────────────────
const SYMBOLS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "XRP/USDT", "BNB/USDT", "DOGE/USDT", "기타"];
const TIMEFRAMES = ["1m", "3m", "5m", "15m", "30m", "1h", "4h", "1D", "1W"];
const THRESHOLD = 12; // 진입 허가 최소 점수
const MAX_SCORE = 22;  // 최대 가능 점수

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
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  body { background: #060810; color: #e2e8f0; font-family: 'Space Grotesk', sans-serif; min-height: 100vh; }
  input, select, textarea { font-family: 'Space Grotesk', sans-serif; font-size: 14px; outline: none; }
  ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: #2a2d3e; border-radius: 2px; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes glow { 0%, 100% { box-shadow: 0 0 20px rgba(99,255,180,0.3); } 50% { box-shadow: 0 0 40px rgba(99,255,180,0.6); } }
  .fade-up { animation: fadeUp 0.4s ease forwards; }
  .tab-active { border-bottom: 2px solid #63ffb4 !important; color: #63ffb4 !important; }
`;

const C = {
  bg: "#060810", surface: "#0e1120", surface2: "#161929",
  border: "#1e2235", accent: "#63ffb4", accentDim: "rgba(99,255,180,0.12)",
  red: "#ff4d6d", redDim: "rgba(255,77,109,0.12)",
  yellow: "#ffd166", yellowDim: "rgba(255,209,102,0.1)",
  blue: "#4da6ff", text: "#e2e8f0", muted: "#5a6080",
  long: "#63ffb4", short: "#ff4d6d",
};

const fmt = (v, cur = "₩") => {
  const sign = v >= 0 ? "+" : "";
  if (cur === "₩") return sign + Math.round(v).toLocaleString("ko-KR") + "₩";
  return sign + Number(v).toFixed(2) + " " + cur;
};
const fmtPct = v => (v >= 0 ? "+" : "") + Number(v).toFixed(2) + "%";
const todayStr = () => new Date().toISOString().split("T")[0];

async function saveData(key, value) {
  await fetch("/api/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value }) });
}
async function loadData(key) {
  const r = await fetch(`/api/data?key=${key}`);
  const j = await r.json();
  return j.data;
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
  const pct = Math.min(100, (score / max) * 100);
  const thresholdPct = (threshold / max) * 100;
  const passed = score >= threshold;
  const color = passed ? C.accent : score >= threshold * 0.7 ? C.yellow : C.red;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "flex-end" }}>
        <span style={{ fontSize: 13, color: C.muted }}>분석 점수</span>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 24, fontWeight: 700, color }}>
          {score}<span style={{ fontSize: 14, color: C.muted }}>/{max}</span>
        </span>
      </div>
      <div style={{ height: 10, background: C.surface2, borderRadius: 5, overflow: "visible", position: "relative" }}>
        <div style={{ height: "100%", width: pct + "%", background: "linear-gradient(90deg," + color + "," + color + "99)", borderRadius: 5, transition: "width 0.5s ease" }} />
        {/* 임계값 마커 */}
        <div style={{ position: "absolute", top: -4, left: thresholdPct + "%", width: 2, height: 18, background: C.yellow, borderRadius: 1 }} />
        <div style={{ position: "absolute", top: -20, left: thresholdPct + "%", transform: "translateX(-50%)", fontSize: 9, color: C.yellow, whiteSpace: "nowrap" }}>최소 {threshold}점</div>
      </div>
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: passed ? C.accent : C.red, boxShadow: passed ? "0 0 10px " + C.accent : "0 0 10px " + C.red, animation: "pulse 2s infinite" }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: passed ? C.accent : C.red }}>
          {passed ? "✓ 진입 가능" : "✗ 근거 부족 — 더 확인하세요"}
        </span>
      </div>
    </div>
  );
}

// ── 분석 마법사 ────────────────────────────────────────────
function AnalysisWizard({ onComplete, onCancel, initialData, checklist }) {
  const allItems = checklist.flatMap(g => g.items);
  const maxScore = allItems.reduce((a, i) => a + i.score, 0);
  const [step, setStep] = useState(1);
  const [images, setImages] = useState([]); // [{ base64, mime, preview }]
  const [imgIdx, setImgIdx] = useState(0);
  const [symbol, setSymbol] = useState(initialData?.symbol || "BTC/USDT");
  const [customSymbol, setCustomSymbol] = useState("");
  const [dir, setDir] = useState(initialData?.dir || "롱");
  const [checked, setChecked] = useState(initialData?.checked || {});
  const [entry, setEntry] = useState(initialData?.entry || "");
  const [sl, setSl] = useState(initialData?.sl || "");
  const [tp, setTp] = useState(initialData?.tp || "");
  const [lev, setLev] = useState(initialData?.lev || "10");
  const [balance, setBalance] = useState(initialData?.balance || "");
  const [riskPct, setRiskPct] = useState(initialData?.riskPct || "1");
  const [memo, setMemo] = useState(initialData?.memo || "");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState("");
  const fileRef = useRef();

  const addImages = (files) => {
    Array.from(files).forEach(file => {
      const mime = file.type || "image/jpeg";
      const reader = new FileReader();
      reader.onload = (ev) => {
        const preview = ev.target.result;
        const base64 = preview.split(",")[1];
        setImages(imgs => [...imgs, { base64, mime, preview }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (i) => {
    setImages(imgs => imgs.filter((_, idx) => idx !== i));
    setImgIdx(idx => Math.max(0, idx - 1));
  };

  const toggle = id => setChecked(c => ({ ...c, [id]: !c[id] }));
  const score = allItems.filter(i => checked[i.id]).reduce((a, i) => a + i.score, 0);
  const passed = score >= THRESHOLD;

  // 리스크 계산
  const entryN = parseFloat(entry) || 0;
  const slN = parseFloat(sl) || 0;
  const tpN = parseFloat(tp) || 0;
  const levN = parseFloat(lev) || 1;
  const balN = parseFloat(balance) || 0;
  const riskN = parseFloat(riskPct) || 1;
  const maxLoss = balN * (riskN / 100);
  const slDist = entryN > 0 && slN > 0 ? Math.abs(entryN - slN) / entryN : 0;
  const posSizeUsdt = slDist > 0 ? (maxLoss / (slDist * levN)) : 0;
  const rrRatio = entryN > 0 && slN > 0 && tpN > 0
    ? Math.abs(tpN - entryN) / Math.abs(entryN - slN) : 0;

  const getAiAdvice = async () => {
    setAiLoading(true); setAiAdvice("");
    const checkedItems = allItems.filter(i => checked[i.id]).map(i => i.label).join(", ");
    const unchecked = allItems.filter(i => !checked[i.id]).map(i => i.label).join(", ");
    const prompt = `코인 선물 트레이딩 전문가로서 다음 진입 분석을 검토하고 한국어로 간결하게 피드백해주세요 (3-5문장):
종목: ${symbol} / 방향: ${dir} / 타임프레임: ${tf} / 레버리지: ${lev}x
충족된 조건: ${checkedItems || "없음"}
미충족 조건: ${unchecked || "없음"}
진입가: ${entry} / 손절가: ${sl} / 목표가: ${tp} / 손익비: ${rrRatio.toFixed(2)}
점수: ${score}/${MAX_SCORE} (기준: ${THRESHOLD}점)
메모: ${memo || "없음"}

핵심만 짚어주세요: 이 진입이 타당한지, 가장 큰 리스크는 무엇인지.`;
    try {
      const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 500, messages: [{ role: "user", content: prompt }] }) });
      const data = await res.json();
      setAiAdvice(data.content?.map(c => c.text || "").join("") || "응답 없음");
    } catch (e) { setAiAdvice("AI 오류: " + e.message); }
    setAiLoading(false);
  };

  const handleComplete = () => {
    const finalSymbol = symbol === "기타" ? customSymbol : symbol;
    onComplete({ symbol: finalSymbol, dir, checked, entry, sl, tp, lev, balance, riskPct, memo, score, passed, rrRatio: Math.round(rrRatio * 100) / 100, posSizeUsdt: Math.round(posSizeUsdt * 100) / 100, maxLoss: Math.round(maxLoss * 100) / 100, aiAdvice, date: todayStr(), id: Date.now(), status: "active", images });
  };

  // 이미지 상단 고정 컴포넌트
  const ImageViewer = () => images.length > 0 ? (
    <div style={{ position: "relative", marginBottom: 16, borderRadius: 12, overflow: "hidden", background: "#000" }}>
      <img src={images[imgIdx]?.preview} alt="차트" style={{ width: "100%", maxHeight: 220, objectFit: "contain", display: "block" }} />
      {images.length > 1 && (
        <>
          <button onClick={() => setImgIdx(i => (i - 1 + images.length) % images.length)} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontSize: 16 }}>‹</button>
          <button onClick={() => setImgIdx(i => (i + 1) % images.length)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontSize: 16 }}>›</button>
          <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 4 }}>
            {images.map((_, i) => <div key={i} onClick={() => setImgIdx(i)} style={{ width: i === imgIdx ? 16 : 6, height: 6, borderRadius: 3, background: i === imgIdx ? C.accent : "rgba(255,255,255,0.4)", cursor: "pointer", transition: "all 0.2s" }} />)}
          </div>
        </>
      )}
      <button onClick={() => removeImage(imgIdx)} style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.7)", border: "none", color: "#fff", width: 26, height: 26, borderRadius: "50%", cursor: "pointer", fontSize: 13 }}>✕</button>
      <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.6)", padding: "2px 8px", borderRadius: 10, fontSize: 11, color: "#fff" }}>{imgIdx + 1}/{images.length}</div>
    </div>
  ) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, animation: "fadeUp 0.3s ease" }}>
      {/* 상단 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>← 취소</button>
        <div style={{ display: "flex", gap: 6 }}>
          {[1,2,3,4,5].map(n => (
            <div key={n} onClick={() => setStep(n)} style={{ width: n <= step ? 24 : 16, height: 6, borderRadius: 3, background: n === step ? C.accent : n < step ? C.accent + "60" : C.surface2, transition: "all 0.3s", cursor: "pointer" }} />
          ))}
        </div>
        <span style={{ fontSize: 12, color: C.muted }}>Step {step}/5</span>
      </div>

      {/* Step 1: 차트 이미지 업로드 */}
      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeUp 0.3s ease" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>차트 업로드</div>
            <div style={{ fontSize: 13, color: C.muted }}>트레이딩뷰 분석 캡처를 올려주세요</div>
          </div>

          {/* 이미지 뷰어 */}
          <ImageViewer />

          {/* 업로드 버튼 */}
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={e => addImages(e.target.files)} style={{ display: "none" }} />
          <button onClick={() => fileRef.current.click()} style={{ width: "100%", padding: 24, border: "2px dashed " + (images.length > 0 ? C.accent + "60" : C.border), borderRadius: 14, background: images.length > 0 ? C.accentDim : "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: images.length > 0 ? C.accent : C.muted }}>
            <div style={{ fontSize: 32 }}>📊</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{images.length > 0 ? "+ 차트 추가 업로드" : "차트 이미지 업로드"}</div>
            <div style={{ fontSize: 11 }}>여러 장 선택 가능 · 가로 스와이프로 확인</div>
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
          {/* 이미지 상단 고정 */}
          <ImageViewer />
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
          {/* 이미지 상단 고정 */}
          <ImageViewer />
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
          <ScoreMeter score={score} max={maxScore} threshold={THRESHOLD} />
          {checklist.map(group => (
            <Card key={group.group} accent={C.blue}>
              <div style={{ fontSize: 12, color: C.blue, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}><span>{group.icon}</span>{group.group}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {group.items.map(item => {
                  const isChecked = !!checked[item.id];
                  return (
                    <div key={item.id} onClick={() => toggle(item.id)} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderRadius: 10, background: isChecked ? C.accentDim : C.surface2, border: "1px solid " + (isChecked ? C.accent + "60" : C.border), cursor: "pointer", transition: "all 0.2s" }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, border: "2px solid " + (isChecked ? C.accent : C.muted), background: isChecked ? C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, transition: "all 0.2s" }}>
                        {isChecked && <span style={{ color: "#000", fontSize: 13, fontWeight: 700 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: isChecked ? C.accent : C.text }}>{item.label}</span>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: isChecked ? C.accent : C.muted, background: isChecked ? C.accentDim : C.surface, padding: "1px 8px", borderRadius: 10, border: "1px solid " + (isChecked ? C.accent + "40" : C.border) }}>+{item.score}점</span>
                        </div>
                        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>{item.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setStep(2)} style={{ flex: 1, padding: "13px 0", borderRadius: 12, border: "1px solid " + C.border, background: "transparent", color: C.muted, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>← 이전</button>
            <button onClick={() => setStep(4)} style={{ flex: 2, padding: "13px 0", borderRadius: 12, border: "none", background: passed ? C.accent : C.surface2, color: passed ? "#000" : C.muted, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>
              {passed ? "다음 → 리스크 계산 ✓" : `점수 부족 (${score}/${THRESHOLD}점) — 계속 진행`}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: 리스크 계산기 */}
      {step === 4 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeUp 0.3s ease" }}>
          <ImageViewer />
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>리스크 계산기</div>
            <div style={{ fontSize: 13, color: C.muted }}>손절가를 먼저 정하고 포지션 크기를 계산하세요</div>
          </div>
          <Card accent={C.yellow}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[["진입가 (USDT)", entry, setEntry], ["손절가 (USDT)", sl, setSl], ["목표가 (USDT)", tp, setTp], ["레버리지 (x)", lev, setLev]].map(([label, val, setter]) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 5, fontWeight: 600, letterSpacing: 0.5 }}>{label}</div>
                    <input type="number" value={val} onChange={e => setter(e.target.value)} placeholder="0" style={{ width: "100%", background: C.surface2, border: "1px solid " + C.border, color: C.text, borderRadius: 8, padding: "10px 12px", fontFamily: "'JetBrains Mono',monospace", fontSize: 14 }} />
                  </div>
                ))}
              </div>
              <div style={{ height: 1, background: C.border }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 5, fontWeight: 600, letterSpacing: 0.5 }}>계좌 잔고 (USDT)</div>
                  <input type="number" value={balance} onChange={e => setBalance(e.target.value)} placeholder="예: 1000" style={{ width: "100%", background: C.surface2, border: "1px solid " + C.border, color: C.text, borderRadius: 8, padding: "10px 12px", fontFamily: "'JetBrains Mono',monospace", fontSize: 14 }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 5, fontWeight: 600, letterSpacing: 0.5 }}>리스크 % (계좌 대비)</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {["0.5", "1", "1.5", "2", "3"].map(v => (
                      <button key={v} onClick={() => setRiskPct(v)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid " + (riskPct === v ? C.yellow : C.border), background: riskPct === v ? C.yellowDim : "transparent", color: riskPct === v ? C.yellow : C.muted, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace" }}>{v}%</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 계산 결과 */}
              {entryN > 0 && slN > 0 && (
                <div style={{ background: C.surface, borderRadius: 10, padding: 14, border: "1px solid " + C.border }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, fontWeight: 600 }}>📐 계산 결과</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[
                      ["손익비", rrRatio > 0 ? "1 : " + rrRatio.toFixed(2) : "-", rrRatio >= 2 ? C.accent : rrRatio >= 1 ? C.yellow : C.red],
                      ["최대 손실", balN > 0 ? "-" + maxLoss.toFixed(2) + " USDT" : "-", C.red],
                      ["권장 포지션", posSizeUsdt > 0 ? posSizeUsdt.toFixed(2) + " USDT" : "-", C.accent],
                      ["손절 거리", slDist > 0 ? (slDist * 100).toFixed(2) + "%" : "-", C.muted],
                    ].map(([label, val, color]) => (
                      <div key={label} style={{ background: C.surface2, borderRadius: 8, padding: "10px 12px" }}>
                        <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>{label}</div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700, color }}>{val}</div>
                      </div>
                    ))}
                  </div>
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
          <ImageViewer />
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>최종 확인</div>
            <div style={{ fontSize: 13, color: C.muted }}>분석을 검토하고 진입 여부를 결정하세요</div>
          </div>

          {/* 판정 배너 */}
          <div style={{ padding: 20, borderRadius: 14, border: "2px solid " + (passed ? C.accent : C.red), background: passed ? "rgba(99,255,180,0.05)" : "rgba(255,77,109,0.05)", textAlign: "center", animation: passed ? "glow 3s infinite" : "none" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{passed ? "🟢" : "🔴"}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: passed ? C.accent : C.red }}>{passed ? "진입 허가" : "진입 불가"}</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>분석 점수 {score}/{MAX_SCORE}점 (기준 {THRESHOLD}점)</div>
          </div>

          {/* 요약 */}
          <Card>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
              {[
                ["종목", symbol === "기타" ? customSymbol : symbol],
                ["방향", dir, dir === "롱" ? C.long : C.short],
                ["타임프레임", tf],
                ["레버리지", lev + "x"],
                ["진입가", entry ? entry + " USDT" : "-"],
                ["손절가", sl ? sl + " USDT" : "-"],
                ["목표가", tp ? tp + " USDT" : "-"],
                ["손익비", rrRatio > 0 ? "1:" + rrRatio.toFixed(2) : "-", rrRatio >= 2 ? C.accent : C.yellow],
                ["권장 포지션", posSizeUsdt > 0 ? posSizeUsdt.toFixed(2) + " USDT" : "-"],
                ["최대 손실", maxLoss > 0 ? maxLoss.toFixed(2) + " USDT" : "-", C.red],
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

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setStep(4)} style={{ flex: 1, padding: "13px 0", borderRadius: 12, border: "1px solid " + C.border, background: "transparent", color: C.muted, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>← 이전</button>
            <button onClick={handleComplete} style={{ flex: 2, padding: "13px 0", borderRadius: 12, border: "none", background: passed ? C.accent : C.surface2, color: passed ? "#000" : C.muted, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>
              {passed ? "✓ 분석 저장 & 포지션 오픈" : "⚠️ 비허가 상태로 저장"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 포지션 카드 ──────────────────────────────────────────
function PositionCard({ pos, onClose, onView }) {
  const [expanded, setExpanded] = useState(false);
  const pnlColor = pos.status === "win" ? C.accent : pos.status === "loss" ? C.red : C.muted;
  const dirColor = pos.dir === "롱" ? C.long : C.short;
  const borderColor = pos.passed ? (pos.status === "active" ? C.blue : pnlColor) : C.border;

  return (
    <div style={{ background: C.surface, border: "1px solid " + borderColor + (pos.status === "active" ? "80" : "40"), borderRadius: 14, overflow: "hidden", transition: "all 0.2s" }}>
      <div onClick={() => setExpanded(e => !e)} style={{ padding: "14px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: pos.status === "active" ? C.accent : pos.status === "win" ? C.accent : C.red, animation: pos.status === "active" ? "pulse 2s infinite" : "none" }} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 16, fontFamily: "'JetBrains Mono',monospace" }}>{pos.symbol}</span>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: dirColor + "20", color: dirColor, fontWeight: 700, border: "1px solid " + dirColor + "40" }}>{pos.dir}</span>
              <span style={{ fontSize: 10, color: C.muted }}>{pos.lev}x</span>
              {!pos.passed && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 8, background: C.redDim, color: C.red, border: "1px solid " + C.red + "40" }}>비허가</span>}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{pos.date} · {pos.tf} · 점수 {pos.score}점</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          {pos.status !== "active" && pos.realPnl !== undefined
            ? <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 700, color: pnlColor }}>{pos.realPnl >= 0 ? "+" : ""}{pos.realPnl.toFixed(2)} USDT</div>
            : pos.entry && <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: C.muted }}>@ {pos.entry}</div>
          }
          <div style={{ fontSize: 10, color: C.muted }}>{expanded ? "▲" : "▼"}</div>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "0 16px 14px", borderTop: "1px solid " + C.border }}>
          {/* 차트 이미지 썸네일 */}
          {pos.images && pos.images.length > 0 && (
            <div style={{ marginTop: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 6, fontWeight: 600 }}>차트 이미지 {pos.images.length}장</div>
              <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
                {pos.images.map((img, i) => (
                  <img key={i} src={img.preview} alt={`차트 ${i+1}`} onClick={() => window.open(img.preview)} style={{ height: 70, width: 110, objectFit: "cover", borderRadius: 8, border: "1px solid " + C.border, cursor: "pointer", flexShrink: 0 }} />
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12, marginBottom: 12 }}>
            {[["진입가", pos.entry ? pos.entry + " USDT" : "-"], ["손절가", pos.sl ? pos.sl + " USDT" : "-"], ["목표가", pos.tp ? pos.tp + " USDT" : "-"], ["손익비", pos.rrRatio ? "1:" + pos.rrRatio : "-"], ["포지션", pos.posSizeUsdt ? pos.posSizeUsdt + " USDT" : "-"], ["최대손실", pos.maxLoss ? pos.maxLoss + " USDT" : "-"]].map(([label, val]) => (
              <div key={label} style={{ background: C.surface2, borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ fontSize: 9, color: C.muted, marginBottom: 2 }}>{label}</div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 600 }}>{val}</div>
              </div>
            ))}
          </div>
          {pos.memo && <div style={{ padding: "8px 12px", background: C.surface2, borderRadius: 8, fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>{pos.memo}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => onView(pos)} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "1px solid " + C.border, background: "transparent", color: C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>상세 보기</button>
            {pos.status === "active" && <button onClick={() => onClose(pos)} style={{ flex: 2, padding: "9px 0", borderRadius: 9, border: "none", background: C.accent, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>청산 기록하기</button>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 청산 모달 ─────────────────────────────────────────────
function CloseModal({ pos, onSave, onCancel }) {
  const [exitPrice, setExitPrice] = useState("");
  const [exitMemo, setExitMemo] = useState("");
  const [exitImages, setExitImages] = useState([]);
  const [exitImgIdx, setExitImgIdx] = useState(0);
  const fileRef = useRef();

  const addExitImages = (files) => {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const preview = ev.target.result;
        setExitImages(imgs => [...imgs, { base64: preview.split(",")[1], mime: file.type, preview }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const entryN = parseFloat(pos.entry) || 0;
  const exitN = parseFloat(exitPrice) || 0;
  const posSize = parseFloat(pos.posSizeUsdt) || 0;
  const levN = parseFloat(pos.lev) || 1;
  const pnl = entryN > 0 && exitN > 0 && posSize > 0
    ? (pos.dir === "숏" ? (entryN - exitN) / entryN : (exitN - entryN) / entryN) * posSize * levN : 0;
  const pct = entryN > 0 && exitN > 0 ? (pos.dir === "숏" ? (entryN - exitN) / entryN : (exitN - entryN) / entryN) * 100 * levN : 0;

  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{pos.symbol} 청산 기록</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600 }}>청산가 (USDT)</div>
            <input type="number" value={exitPrice} onChange={e => setExitPrice(e.target.value)} placeholder="청산한 가격" style={{ width: "100%", background: C.surface2, border: "1px solid " + C.border, color: C.text, borderRadius: 10, padding: "12px 14px", fontFamily: "'JetBrains Mono',monospace", fontSize: 15 }} />
          </div>
          {exitN > 0 && entryN > 0 && (
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
                <img src={exitImages[exitImgIdx]?.preview} style={{ width: "100%", maxHeight: 160, objectFit: "contain", display: "block" }} />
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
          <button onClick={() => onSave({ exitPrice: exitN, exitMemo, exitImages, realPnl: Math.round(pnl * 100) / 100, realPct: Math.round(pct * 100) / 100, exitDate: todayStr(), status: pnl >= 0 ? "win" : "loss" })} disabled={!exitN} style={{ flex: 2, padding: "12px 0", borderRadius: 10, border: "none", background: C.accent, color: "#000", fontWeight: 700, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif", opacity: !exitN ? 0.5 : 1 }}>저장</button>
        </div>
      </div>
    </div>
  );
}

// ── 통계 탭 ──────────────────────────────────────────────
function StatsView({ positions }) {
  const closed = positions.filter(p => p.status !== "active");
  const wins = closed.filter(p => p.status === "win");
  const losses = closed.filter(p => p.status === "loss");
  const wr = closed.length ? Math.round(wins.length / closed.length * 100) : 0;
  const totalPnl = closed.reduce((a, p) => a + (p.realPnl || 0), 0);
  const avgPnl = closed.length ? totalPnl / closed.length : 0;

  // 허가/비허가 비교
  const permitted = closed.filter(p => p.passed);
  const notPermitted = closed.filter(p => !p.passed);
  const permWr = permitted.length ? Math.round(permitted.filter(p => p.status === "win").length / permitted.length * 100) : 0;
  const notPermWr = notPermitted.length ? Math.round(notPermitted.filter(p => p.status === "win").length / notPermitted.length * 100) : 0;

  // 누적 손익
  const cumData = [];
  let running = 0;
  [...closed].sort((a, b) => new Date(a.exitDate || a.date) - new Date(b.exitDate || b.date)).forEach((p, i) => {
    running += p.realPnl || 0;
    cumData.push({ x: i + 1, y: running });
  });

  if (!closed.length) return (
    <Card style={{ textAlign: "center", padding: 40 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
      <div style={{ color: C.muted, fontSize: 14 }}>청산된 포지션이 없습니다</div>
    </Card>
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

      {/* 허가 vs 비허가 비교 */}
      {(permitted.length > 0 || notPermitted.length > 0) && (
        <Card accent={C.accent}>
          <div style={{ fontSize: 12, color: C.accent, fontWeight: 700, marginBottom: 14 }}>⚡ 체크리스트 효과 분석</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ padding: 14, background: "rgba(99,255,180,0.06)", borderRadius: 10, border: "1px solid " + C.accent + "30" }}>
              <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, marginBottom: 8 }}>🟢 허가 진입 ({permitted.length}건)</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 24, fontWeight: 700, color: permWr >= 50 ? C.accent : C.red }}>{permWr}%</div>
              <div style={{ fontSize: 11, color: C.muted }}>승률</div>
            </div>
            <div style={{ padding: 14, background: C.redDim, borderRadius: 10, border: "1px solid " + C.red + "30" }}>
              <div style={{ fontSize: 11, color: C.red, fontWeight: 700, marginBottom: 8 }}>🔴 비허가 진입 ({notPermitted.length}건)</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 24, fontWeight: 700, color: notPermWr >= 50 ? C.accent : C.red }}>{notPermWr}%</div>
              <div style={{ fontSize: 11, color: C.muted }}>승률</div>
            </div>
          </div>
          {permitted.length > 0 && notPermitted.length > 0 && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: C.surface2, borderRadius: 10, fontSize: 13, color: permWr > notPermWr ? C.accent : C.muted }}>
              {permWr > notPermWr ? `✓ 허가 진입 승률이 ${permWr - notPermWr}% 더 높습니다. 체크리스트가 효과적이에요!` : permWr === notPermWr ? "허가/비허가 승률이 같습니다. 데이터가 더 필요해요." : `⚠️ 아직 데이터가 부족합니다. 계속 기록해보세요.`}
            </div>
          )}
        </Card>
      )}

      {/* 누적 손익 SVG 차트 */}
      {cumData.length > 1 && (
        <Card>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, fontWeight: 600 }}>📈 누적 손익 추이</div>
          <svg width="100%" height="120" viewBox={`0 0 300 120`} preserveAspectRatio="none">
            {(() => {
              const maxY = Math.max(...cumData.map(d => Math.abs(d.y)));
              const minY = Math.min(...cumData.map(d => d.y));
              const scaleY = maxY > 0 ? (maxY + Math.abs(minY) > 0 ? 80 / (maxY - Math.min(...cumData.map(d => d.y))) : 1) : 1;
              const points = cumData.map((d, i) => `${i / (cumData.length - 1) * 280 + 10},${100 - (d.y - Math.min(...cumData.map(d => d.y))) * scaleY}`).join(" ");
              const lastPnl = cumData[cumData.length - 1]?.y || 0;
              return <polyline points={points} fill="none" stroke={lastPnl >= 0 ? C.accent : C.red} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />;
            })()}
          </svg>
        </Card>
      )}
    </div>
  );
}

// ── 체크리스트 설정 ───────────────────────────────────────
function ChecklistSettings({ checklist, onSave }) {
  const [groups, setGroups] = useState(JSON.parse(JSON.stringify(checklist)));
  const [newGroupName, setNewGroupName] = useState("");
  const [newItems, setNewItems] = useState({});
  const [editingItem, setEditingItem] = useState(null); // { gi, ii }
  const [editDraft, setEditDraft] = useState({});
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave(groups);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const addGroup = () => {
    if (!newGroupName.trim()) return;
    setGroups(g => [...g, { group: newGroupName.trim(), icon: "📌", items: [] }]);
    setNewGroupName("");
  };

  const removeGroup = (gi) => {
    if (!confirm("그룹을 삭제할까요?")) return;
    setGroups(g => g.filter((_, i) => i !== gi));
  };

  const addItem = (gi) => {
    const ni = newItems[gi] || {};
    if (!ni.label) return;
    setGroups(g => g.map((group, i) => i === gi ? { ...group, items: [...group.items, { id: "custom_" + Date.now(), label: ni.label, desc: ni.desc || "", score: parseInt(ni.score) || 1 }] } : group));
    setNewItems(n => ({ ...n, [gi]: {} }));
  };

  const removeItem = (gi, ii) => {
    setGroups(g => g.map((group, i) => i === gi ? { ...group, items: group.items.filter((_, j) => j !== ii) } : group));
    setEditingItem(null);
  };

  const startEdit = (gi, ii, item) => {
    setEditingItem({ gi, ii });
    setEditDraft({ label: item.label, desc: item.desc || "", score: String(item.score) });
  };

  const saveEdit = (gi, ii) => {
    setGroups(g => g.map((group, i) => i === gi ? {
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
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>총 {totalMax}점 만점 · 허가 기준 {THRESHOLD}점</div>
        </div>
        <button onClick={handleSave} style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: saved ? C.accent + "80" : C.accent, color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>{saved ? "저장됨 ✓" : "저장"}</button>
      </div>

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
  const todayS = new Date().toISOString().split("T")[0];

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
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
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
            <input type="number" value={initialInput} onChange={e => setInitialInput(e.target.value)} placeholder="예: 1000" style={{ flex: 1, background: C.surface2, border: "1px solid " + C.border, color: C.text, borderRadius: 10, padding: "12px 14px", fontFamily: "'JetBrains Mono',monospace", fontSize: 15 }} />
            <button onClick={handleSaveInitial} style={{ padding: "12px 18px", borderRadius: 10, border: "none", background: C.accent, color: "#000", fontWeight: 700, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif", whiteSpace: "nowrap" }}>저장</button>
          </div>
        </div>

        {/* 출금 기록 */}
        <div>
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 8, letterSpacing: 1 }}>출금 기록 (USDT)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
            <input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="출금 금액 (USDT)" style={{ background: C.surface2, border: "1px solid " + C.border, color: C.text, borderRadius: 10, padding: "10px 14px", fontFamily: "'JetBrains Mono',monospace", fontSize: 14 }} />
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

export default function App() {
  const [tab, setTab] = useState("positions");
  const [positions, setPositions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [closeTarget, setCloseTarget] = useState(null);
  const [detailPos, setDetailPos] = useState(null);
  const [seed, setSeed] = useState({ initial: 0, withdrawals: [] });
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [checklist, setChecklist] = useState(ANALYSIS_ITEMS);

  useEffect(() => {
    const load = async () => {
      try {
        const d = await loadData("positions");
        if (d) setPositions(typeof d === "string" ? JSON.parse(d) : d);
        const s = await loadData("seed");
        if (s) setSeed(typeof s === "string" ? JSON.parse(s) : s);
        const cl = await loadData("checklist");
        if (cl) setChecklist(typeof cl === "string" ? JSON.parse(cl) : cl);
      } catch (e) {}
      setLoaded(true);
    };
    load();
  }, []);

  const saveSeed = async (newSeed) => {
    setSeed(newSeed);
    try { await saveData("seed", JSON.stringify(newSeed)); } catch (e) {}
  };

  const saveChecklist = async (newCl) => {
    setChecklist(newCl);
    try { await saveData("checklist", JSON.stringify(newCl)); } catch (e) {}
  };

  const save = async (newPositions) => {
    setPositions(newPositions);
    try { await saveData("positions", JSON.stringify(newPositions)); } catch (e) {}
  };

  const handleComplete = (data) => {
    save([data, ...positions]);
    setShowWizard(false);
  };

  const handleClose = async (result) => {
    const updated = positions.map(p => p.id === closeTarget.id ? { ...p, ...result } : p);
    await save(updated);
    setCloseTarget(null);
  };

  const deletePos = async (id) => {
    await save(positions.filter(p => p.id !== id));
  };

  const active = positions.filter(p => p.status === "active");
  const closed = positions.filter(p => p.status !== "active");

  // 시드 계산
  const totalPnl = closed.reduce((a, p) => a + (p.realPnl || 0), 0);
  const totalWithdrawals = (seed.withdrawals || []).reduce((a, w) => a + w.amount, 0);
  const currentSeed = seed.initial + totalPnl - totalWithdrawals;
  const seedReturn = seed.initial > 0 ? ((currentSeed - seed.initial) / seed.initial * 100) : 0;

  if (!loaded) return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
      <style>{CSS}</style>
      <div style={{ width: 32, height: 32, border: "3px solid " + C.surface2, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <div style={{ color: C.muted, fontSize: 13 }}>TradeGate 로딩 중...</div>
    </div>
  );

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'Space Grotesk',sans-serif", maxWidth: 600, margin: "0 auto" }}>
      <style>{CSS}</style>

      {/* 헤더 */}
      <div style={{ padding: "16px 16px 0", borderBottom: "1px solid " + C.border, background: C.surface, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5 }}>TradeGate <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>코인 선물</span></div>
          {!showWizard && (
            <button onClick={() => setShowWizard(true)} style={{ padding: "9px 16px", borderRadius: 10, border: "none", background: C.accent, color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>+ 새 분석</button>
          )}
        </div>

        {/* 시드 트래킹 바 */}
        {!showWizard && (
          <div onClick={() => setShowSeedModal(true)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", marginBottom: 12, background: C.surface2, borderRadius: 10, border: "1px solid " + C.border, cursor: "pointer" }}>
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 9, color: C.muted, fontWeight: 600, letterSpacing: 1, marginBottom: 2 }}>현재 시드</div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 16, fontWeight: 700, color: seed.initial === 0 ? C.muted : currentSeed >= seed.initial ? C.accent : C.red }}>
                  {seed.initial === 0 ? "미설정" : currentSeed.toFixed(2) + " USDT"}
                </div>
              </div>
              {seed.initial > 0 && (
                <>
                  <div style={{ width: 1, height: 28, background: C.border }} />
                  <div>
                    <div style={{ fontSize: 9, color: C.muted, fontWeight: 600, letterSpacing: 1, marginBottom: 2 }}>초기 시드</div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: C.muted }}>{seed.initial.toFixed(2)} USDT</div>
                  </div>
                  <div style={{ width: 1, height: 28, background: C.border }} />
                  <div>
                    <div style={{ fontSize: 9, color: C.muted, fontWeight: 600, letterSpacing: 1, marginBottom: 2 }}>수익률</div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: seedReturn >= 0 ? C.accent : C.red }}>
                      {seedReturn >= 0 ? "+" : ""}{seedReturn.toFixed(2)}%
                    </div>
                  </div>
                </>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
              {seed.initial > 0 && totalPnl !== 0 && (
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: totalPnl >= 0 ? C.accent : C.red, fontWeight: 600 }}>
                  {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)} USDT
                </div>
              )}
              <div style={{ fontSize: 10, color: C.muted }}>탭하여 수정 →</div>
            </div>
          </div>
        )}

        {!showWizard && (
          <div style={{ display: "flex", gap: 0 }}>
            {[["positions", "포지션"], ["history", "기록"], ["stats", "통계"], ["settings", "설정"]].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: "10px 0", background: "none", border: "none", borderBottom: "2px solid " + (tab === id ? C.accent : "transparent"), color: tab === id ? C.accent : C.muted, fontWeight: tab === id ? 700 : 400, fontSize: 13, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>{label}</button>
            ))}
          </div>
        )}
      </div>

      {/* 컨텐츠 */}
      <div style={{ padding: "20px 16px", paddingBottom: 40 }}>
        {showWizard ? (
          <AnalysisWizard onComplete={handleComplete} onCancel={() => setShowWizard(false)} checklist={checklist} />
        ) : tab === "positions" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {active.length === 0 ? (
              <Card style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🚪</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>열린 포지션 없음</div>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>분석을 통과해야 진입할 수 있습니다</div>
                <button onClick={() => setShowWizard(true)} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: C.accent, color: "#000", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>새 분석 시작하기</button>
              </Card>
            ) : (
              active.map(p => <PositionCard key={p.id} pos={p} onClose={setCloseTarget} onView={setDetailPos} />)
            )}
          </div>
        ) : tab === "history" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {closed.length === 0
              ? <Card style={{ textAlign: "center", padding: 40 }}><div style={{ color: C.muted, fontSize: 14 }}>청산된 포지션이 없습니다</div></Card>
              : closed.map(p => <PositionCard key={p.id} pos={p} onClose={setCloseTarget} onView={setDetailPos} />)
            }
          </div>
        ) : tab === "stats" ? (
          <StatsView positions={positions} />
        ) : (
          <ChecklistSettings checklist={checklist} onSave={saveChecklist} />
        )}
      </div>

      {/* 청산 모달 */}
      {closeTarget && <CloseModal pos={closeTarget} onSave={handleClose} onCancel={() => setCloseTarget(null)} />}

      {/* 시드 설정 모달 */}
      {showSeedModal && <SeedModal seed={seed} onSave={saveSeed} onCancel={() => setShowSeedModal(false)} totalPnl={totalPnl} currentSeed={currentSeed} seedReturn={seedReturn} />}

      {/* 상세 모달 */}
      {detailPos && (
        <div onClick={() => setDetailPos(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 0 0 0" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: "16px 16px 0 0", padding: 24, width: "100%", maxWidth: 600, maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{detailPos.symbol} 분석 상세</div>
              <button onClick={() => setDetailPos(null)} style={{ background: C.surface2, border: "1px solid " + C.border, color: C.text, width: 30, height: 30, borderRadius: "50%", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* 체크된 항목 */}
              <div style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>충족된 조건</div>
              {ALL_ITEMS.filter(i => detailPos.checked?.[i.id]).map(item => (
                <div key={item.id} style={{ padding: "8px 12px", background: C.accentDim, borderRadius: 8, fontSize: 13, color: C.accent, display: "flex", justifyContent: "space-between" }}>
                  <span>✓ {item.label}</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>+{item.score}점</span>
                </div>
              ))}
              {detailPos.memo && <div style={{ padding: "10px 12px", background: C.surface2, borderRadius: 8, fontSize: 13, color: C.muted }}>{detailPos.memo}</div>}
              {detailPos.aiAdvice && (
                <div style={{ padding: "12px 14px", background: "rgba(123,47,255,0.08)", border: "1px solid rgba(123,47,255,0.2)", borderRadius: 10, fontSize: 13, lineHeight: 1.7 }}>
                  <div style={{ fontSize: 11, color: "#b47aff", fontWeight: 700, marginBottom: 6 }}>🤖 AI 분석</div>
                  {detailPos.aiAdvice}
                </div>
              )}
              {detailPos.exitMemo && (
                <div style={{ padding: "12px 14px", background: C.surface2, borderRadius: 10, fontSize: 13 }}>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 4 }}>복기 메모</div>
                  {detailPos.exitMemo}
                </div>
              )}
              {/* 청산 차트 */}
              {detailPos.exitImages && detailPos.exitImages.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 6 }}>청산 차트</div>
                  <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
                    {detailPos.exitImages.map((img, i) => (
                      <img key={i} src={img.preview} onClick={() => window.open(img.preview)} style={{ height: 80, width: 130, objectFit: "cover", borderRadius: 8, border: "1px solid " + C.border, cursor: "pointer", flexShrink: 0 }} />
                    ))}
                  </div>
                </div>
              )}
              <button onClick={() => { if (confirm("이 포지션을 삭제할까요?")) { deletePos(detailPos.id); setDetailPos(null); } }} style={{ padding: "10px 0", borderRadius: 10, border: "1px solid " + C.red + "40", background: C.redDim, color: C.red, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif" }}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
