const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function env(name) {
  return (Netlify.env.get(name) || "").trim();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

function cleanError(data) {
  if (!data || typeof data !== "object") return "Retro Diffusion request failed.";
  const detail = data.detail;
  if (Array.isArray(detail)) return detail.map(item => item?.msg || item?.message || "Invalid request").join("; ");
  if (detail && typeof detail === "object") return detail.message || detail.msg || "Retro Diffusion request failed.";
  return data.message || data.error || "Retro Diffusion request failed.";
}

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const adminSecret = env("RETRODIFFUSION_ADMIN_SECRET");
  const suppliedSecret = req.headers.get("x-retro-admin-secret") || "";
  if (!adminSecret || suppliedSecret !== adminSecret) return json({ error: "Unauthorized" }, 401);

  const token = env("RETRODIFFUSION_API_KEY");
  if (!token) return json({ error: "Retro Diffusion API key is not configured" }, 503);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (prompt.length < 3 || prompt.length > 2000) return json({ error: "prompt must be 3-2000 characters" }, 400);

  const width = Number.isInteger(body.width) ? body.width : 128;
  const height = Number.isInteger(body.height) ? body.height : 128;
  const numImages = Number.isInteger(body.num_images) ? body.num_images : 1;
  if (width < 16 || width > 384 || height < 16 || height > 384) return json({ error: "width and height must be 16-384" }, 400);
  if (numImages < 1 || numImages > 4) return json({ error: "num_images must be 1-4" }, 400);

  const payload = {
    prompt,
    prompt_style: typeof body.prompt_style === "string" && body.prompt_style.trim()
      ? body.prompt_style.trim()
      : "rd_plus__topdown_asset",
    width,
    height,
    num_images: numImages,
    ...(Number.isInteger(body.seed) ? { seed: body.seed } : {}),
    ...(typeof body.remove_bg === "boolean" ? { remove_bg: body.remove_bg } : { remove_bg: true }),
    ...(body.check_cost === true ? { check_cost: true } : {}),
  };

  let upstream;
  try {
    upstream = await fetch("https://api.retrodiffusion.ai/v1/inferences", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-RD-Token": token },
      body: JSON.stringify(payload),
    });
  } catch {
    return json({ error: "Unable to reach Retro Diffusion" }, 502);
  }

  const raw = await upstream.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = null; }
  if (!upstream.ok) return json({ error: cleanError(data), upstreamStatus: upstream.status }, upstream.status >= 500 ? 502 : upstream.status);

  return json({
    model: data?.model || null,
    balance_cost: data?.balance_cost ?? null,
    remaining_balance: data?.remaining_balance ?? null,
    base64_images: Array.isArray(data?.base64_images) ? data.base64_images : [],
    output_urls: Array.isArray(data?.output_urls) ? data.output_urls : [],
  });
};

export const config = {
  path: "/api/retro-generate",
  method: ["POST"],
};
