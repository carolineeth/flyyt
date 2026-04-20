import { toast } from "sonner";

/**
 * Wrapper for Supabase write operations with consistent Norwegian error handling.
 *
 * @param operation  A function that returns a Supabase promise resolving to { data, error }
 * @param options
 *   successMessage  Toast shown on success (omit for silent success)
 *   errorMessage    Toast shown on failure (default: "Kunne ikke lagre. Prøv igjen.")
 *   silent          If true, no success toast is shown (use for auto-save / toggles)
 */
export async function saveToSupabase<T>(
  operation: () => Promise<{ data: T | null; error: any }>,
  options?: {
    successMessage?: string;
    errorMessage?: string;
    silent?: boolean;
  }
): Promise<{ ok: true; data: T | null } | { ok: false }> {
  try {
    const { data, error } = await operation();
    if (error) throw error;
    if (!options?.silent && options?.successMessage) {
      toast.success(options.successMessage, { duration: 2000 });
    }
    return { ok: true, data };
  } catch (err: any) {
    toast.error(options?.errorMessage ?? "Kunne ikke lagre. Prøv igjen.", { duration: 5000 });
    console.error("saveToSupabase failed:", err);
    return { ok: false };
  }
}
