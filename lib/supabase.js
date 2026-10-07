import { createClient } from '@supabase/supabase-js';
export const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
let client;
export function getSupabase() {
  if (!configured) return null;
  client ||= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return client;
}
export function unwrap(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
