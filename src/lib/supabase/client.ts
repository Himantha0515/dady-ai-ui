import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anon && !url.includes("your-"));

export const mockBackend =
  import.meta.env.VITE_MOCK_BACKEND === "true" || !isSupabaseConfigured;

export const supabase = isSupabaseConfigured
  ? createClient(url!, anon!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : (null as unknown as ReturnType<typeof createClient>);

export async function invokeFunction<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured");
  }
  const { data, error } = await supabase.functions.invoke(name, { body });

  const payload = data as { error?: { code?: string; message?: string } | string } | null;
  if (payload?.error) {
    const msg =
      typeof payload.error === "string"
        ? payload.error
        : payload.error.message || payload.error.code || "Request failed";
    throw new Error(msg);
  }

  if (error) {
    let detail = error.message || "Request failed";
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const bodyJson = (await ctx.json()) as {
          error?: { message?: string } | string;
          message?: string;
        };
        if (typeof bodyJson?.error === "string") detail = bodyJson.error;
        else if (bodyJson?.error && typeof bodyJson.error === "object" && bodyJson.error.message) {
          detail = bodyJson.error.message;
        } else if (bodyJson?.message) detail = bodyJson.message;
      }
    } catch {
      /* keep original */
    }
    throw new Error(detail);
  }

  return data as T;
}
