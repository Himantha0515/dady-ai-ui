import { corsHeadersFor } from "./cors.ts";

export function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeadersFor(req), "Content-Type": "application/json" },
  });
}

export function err(req: Request, code: string, message: string, status = 400) {
  return json(req, { error: { code, message } }, status);
}

export async function requireUser(req: Request, supabaseUrl: string, anonKey: string) {
  const auth = req.headers.get("Authorization");
  if (!auth) return null;
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.8");
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: auth } },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { user: data.user, client };
}
