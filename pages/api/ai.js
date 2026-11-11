// pages/api/ai.js
// 클라이언트는 { prompt, images: [dataURL...] } 만 보낸다.
// 모델/토큰 한도는 서버에서 고정 — 임의 모델·대량 토큰 호출 방지.
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "../../lib/auth";

const MODEL = process.env.AI_MODEL || "claude-haiku-5-5";
const MAX_IMAGES = 4;
const MAX_PROMPT_CHARS = 6000;

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

const client = new Anthropic(); // ANTHROPIC_API_KEY 환경변수 사용

function toImageBlock(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/.exec(dataUrl || "");
  if (!m) return null;
  return { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!requireAuth(req, res)) return;
  const { prompt, images } = req.body || {};
  if (typeof prompt !== "string" || !prompt.trim()) return res.status(400).json({ error: "prompt 필요" });

  const imageBlocks = (Array.isArray(images) ? images : []).slice(0, MAX_IMAGES).map(toImageBlock).filter(Boolean);

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low" },
      messages: [{ role: "user", content: [...imageBlocks, { type: "text", text: prompt.slice(0, MAX_PROMPT_CHARS) }] }],
    });
    if (response.stop_reason === "refusal") return res.json({ text: "AI가 이 요청에 응답하지 않았습니다." });
    const text = response.content.filter(b => b.type === "text").map(b => b.text).join("").trim();
    res.json({ text: text || "응답 없음" });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return res.status(429).json({ error: "요청이 많습니다. 잠시 후 다시 시도하세요." });
    if (e instanceof Anthropic.AuthenticationError) return res.status(500).json({ error: "ANTHROPIC_API_KEY 설정을 확인하세요." });
    if (e instanceof Anthropic.APIError) return res.status(502).json({ error: `AI API 오류 (${e.status})` });
    res.status(500).json({ error: e.message });
  }
}
