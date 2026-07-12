import { getStore } from "@netlify/blobs";

const STORE_NAME = "shadow-covenant-mailbox";
const STORE_KEY = "messages-v1";
const MAX_BODY_BYTES = 16_384;

type LocalizedText = { th: string; en: string };
type MailReward = { type: "coins"; amount: number };
type MailMessage = {
  id: string;
  type: "update" | "reward";
  date: string;
  title: LocalizedText;
  sender: LocalizedText;
  body: LocalizedText;
  reward?: MailReward;
  publishedAt?: string;
  expiresAt?: string;
  active: boolean;
};

const SEED_MESSAGES: MailMessage[] = [
  {
    id: "compensation_20260712",
    type: "reward",
    date: "2026-07-12",
    title: { th: "ของขวัญตลาดวิญญาณ 1,000 Soul Coins", en: "1,000 Soul Coin Market Gift" },
    sender: { th: "ผู้ดูแลพันธสัญญา", en: "Covenant Keeper" },
    body: {
      th: "ฉลองการเปิดตลาดวิญญาณและระบบวิญญาณเทพ รับของขวัญ 1,000 Soul Coins ได้หนึ่งครั้งจากจดหมายฉบับนี้",
      en: "Celebrate the Soul Market and Divine Spirit update. Claim this one-time gift of 1,000 Soul Coins.",
    },
    reward: { type: "coins", amount: 1000 },
    active: true,
  },
  {
    id: "compensation_20260710",
    type: "reward",
    date: "2026-07-10",
    title: { th: "ชดเชยรอบใหม่ 1,000 Soul Coins", en: "New 1,000 Soul Coin Compensation" },
    sender: { th: "ผู้ดูแลพันธสัญญา", en: "Covenant Keeper" },
    body: {
      th: "ขอบคุณที่ร่วมทดสอบและแจ้งปัญหาระบบจดหมายกับการบันทึกรางวัล รับ Soul Coins ชดเชยรอบวันที่ 10 กรกฎาคมได้จากจดหมายฉบับนี้",
      en: "Thank you for testing and reporting mailbox and reward-saving issues. Claim the July 10 compensation attached to this message.",
    },
    reward: { type: "coins", amount: 1000 },
    active: true,
  },
  {
    id: "update_20260710_release",
    type: "update",
    date: "2026-07-10",
    title: { th: "อัปเดต Shadow Covenant", en: "Shadow Covenant Update" },
    sender: { th: "ทีมพัฒนา", en: "Development Team" },
    body: {
      th: "ปรับหน้าแรกและหน้าหยุดเกมให้กระชับขึ้น ลดเวลาโหลดด้วย WebP และ Lazy Loading พร้อมแก้การ Sync Soul Coins ไม่ให้ข้อมูลเก่าทับรางวัลจากรันใหม่",
      en: "The title and pause screens are cleaner, WebP and lazy loading reduce startup time, and Soul Coin sync no longer lets stale cloud data overwrite new run rewards.",
    },
    active: true,
  },
  {
    id: "compensation_20260709",
    type: "reward",
    date: "2026-07-09",
    title: { th: "จดหมายชดเชย Soul Coins", en: "Soul Coin Compensation" },
    sender: { th: "ผู้ดูแลพันธสัญญา", en: "Covenant Keeper" },
    body: {
      th: "ขออภัยสำหรับปัญหาที่ทำให้รางวัล Soul Coins หลังจบรันไม่ถูกบันทึก กรุณารับ Soul Coins ชดเชยจากจดหมายฉบับนี้",
      en: "We apologize for an issue that prevented Soul Coin run rewards from being saved. Please claim the compensation attached to this message.",
    },
    reward: { type: "coins", amount: 1000 },
    active: true,
  },
];

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}

function adminSecret() {
  return (Netlify.env.get("MAILBOX_ADMIN_SECRET") || "").trim();
}

function isAdmin(req: Request) {
  const expected = adminSecret();
  const provided = (req.headers.get("x-mailbox-admin-key") || "").trim();
  return !!expected && provided === expected;
}

function cleanId(value: unknown) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9_.-]/g, "_").replace(/_+/g, "_").slice(0, 80);
}

function cleanText(value: unknown, limit: number): LocalizedText {
  const src = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const fallback = typeof value === "string" ? value : "";
  return {
    th: String(src.th || src.en || fallback).trim().slice(0, limit),
    en: String(src.en || src.th || fallback).trim().slice(0, limit),
  };
}

function cleanDate(value: unknown, dateOnly = false) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return "";
  return dateOnly ? new Date(parsed).toISOString().slice(0, 10) : new Date(parsed).toISOString();
}

function cleanMessage(input: unknown): MailMessage | null {
  const src = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const id = cleanId(src.id);
  const title = cleanText(src.title, 140);
  const body = cleanText(src.body, 1800);
  if (!id || !title.th || !body.th) return null;
  const rewardSrc = src.reward && typeof src.reward === "object" ? src.reward as Record<string, unknown> : {};
  const amount = Math.max(0, Math.min(1_000_000, Math.floor(Number(rewardSrc.amount) || 0)));
  const reward = rewardSrc.type === "coins" && amount ? { type: "coins" as const, amount } : undefined;
  return {
    id,
    type: reward ? "reward" : "update",
    date: cleanDate(src.date, true) || new Date().toISOString().slice(0, 10),
    title,
    sender: cleanText(src.sender || { th: "ทีมพัฒนา", en: "Development Team" }, 100),
    body,
    ...(reward ? { reward } : {}),
    ...(cleanDate(src.publishedAt) ? { publishedAt: cleanDate(src.publishedAt) } : {}),
    ...(cleanDate(src.expiresAt) ? { expiresAt: cleanDate(src.expiresAt) } : {}),
    active: src.active !== false,
  };
}

async function readCustomMessages(store: ReturnType<typeof getStore>) {
  const data = await store.get(STORE_KEY, { type: "json" });
  const list = data && typeof data === "object" && Array.isArray((data as { messages?: unknown }).messages)
    ? (data as { messages: unknown[] }).messages
    : [];
  return list.map(cleanMessage).filter((mail): mail is MailMessage => !!mail).slice(0, 200);
}

function mergeMessages(custom: MailMessage[]) {
  const byId = new Map<string, MailMessage>();
  for (const mail of SEED_MESSAGES) byId.set(mail.id, mail);
  for (const mail of custom) byId.set(mail.id, mail);
  return [...byId.values()].sort((a, b) => {
    const dateDiff = Date.parse(b.publishedAt || b.date) - Date.parse(a.publishedAt || a.date);
    return dateDiff || b.id.localeCompare(a.id);
  });
}

function publicMessages(messages: MailMessage[]) {
  const now = Date.now();
  return messages.filter(mail => {
    if (!mail.active) return false;
    if (mail.publishedAt && Date.parse(mail.publishedAt) > now) return false;
    if (mail.expiresAt && Date.parse(mail.expiresAt) <= now) return false;
    return true;
  });
}

export default async (req: Request) => {
  const store = getStore({ name: STORE_NAME, consistency: "strong" });

  if (req.method === "GET") {
    const messages = publicMessages(mergeMessages(await readCustomMessages(store)));
    return json({ ok: true, messages, updated_at: new Date().toISOString() });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!adminSecret()) return json({ error: "MAILBOX_ADMIN_SECRET is not configured" }, 503);
  if (!isAdmin(req)) return json({ error: "Unauthorized" }, 401);

  const contentLength = Number.parseInt(req.headers.get("content-length") || "0", 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const custom = await readCustomMessages(store);
  const action = String(body.action || "upsert");
  if (action === "list") return json({ ok: true, messages: mergeMessages(custom), admin: true });

  if (action === "delete") {
    const id = cleanId(body.id);
    if (!id) return json({ error: "Invalid message id" }, 400);
    const existing = mergeMessages(custom).find(mail => mail.id === id);
    if (!existing) return json({ error: "Message not found" }, 404);
    const disabled = { ...existing, active: false };
    const next = custom.filter(mail => mail.id !== id);
    next.push(disabled);
    await store.setJSON(STORE_KEY, { messages: next, updated_at: new Date().toISOString() });
    return json({ ok: true, message: disabled });
  }

  const mail = cleanMessage(body.message);
  if (!mail) return json({ error: "Invalid message" }, 400);
  const next = custom.filter(item => item.id !== mail.id);
  next.push(mail);
  await store.setJSON(STORE_KEY, { messages: next, updated_at: new Date().toISOString() });
  return json({ ok: true, message: mail });
};

export const config = {
  path: "/api/mailbox",
  method: ["GET", "POST"],
};
