// pages/api/session.js — 로그인 상태 확인
import { isAuthed, isConfigured } from "../../lib/auth";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.json({ configured: isConfigured(), authed: isConfigured() && isAuthed(req) });
}
