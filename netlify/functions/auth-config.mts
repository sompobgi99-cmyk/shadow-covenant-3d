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

export default async (req: Request) => {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const url = env("SUPABASE_URL").replace(/\/+$/, "");
  const anonKey = env("SUPABASE_ANON_KEY");
  return json({
    enabled: !!(url && anonKey),
    url,
    anonKey,
  });
};

export const config = {
  path: "/api/auth-config",
  method: ["GET"],
};
