import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://mxktgililpeusrpdmwfl.supabase.co";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_aRi395Dxd3ILplaGiwfcwA_RF2IFX23";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);