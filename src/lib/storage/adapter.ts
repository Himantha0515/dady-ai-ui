type StorageProvider = "r2" | "supabase";

export interface StorageAdapter {
  provider: StorageProvider;
  createSignedUploadUrl(path: string, contentType: string): Promise<{ url: string; token?: string }>;
  createSignedDownloadUrl(path: string, expiresIn?: number): Promise<string>;
}

/** Browser-facing helpers call Edge Functions; secrets never leave the server. */
export function getClientStorageHint(): StorageProvider {
  return import.meta.env.VITE_STORAGE_PROVIDER === "supabase" ? "supabase" : "r2";
}
