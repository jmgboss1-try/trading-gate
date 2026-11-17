// pages/api/session.js — 로그인 상태 + 저장소 연결 상태 확인
import { isAuthed, isConfigured } from "../../lib/auth";
import { storageStatus } from "../../lib/redis";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.json({ configured: isConfigured(), authed: isConfigured() && isAuthed(req), storage: await storageStatus() });
}
