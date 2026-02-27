import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://acndwziowlifkkrdmcyx.supabase.co";
const supabaseAnonKey = "sb_publishable_GIb2_6JQ_xeBCCATX_rZ1g_AXRjcEcI";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});