// Public by design — this ships in the GitHub Pages source and anyone can
// read it. The anon/publishable key's lack of power (see supabase/schema.sql)
// is what makes that safe: it can only INSERT into `responses` directly, and
// everything else goes through SECURITY DEFINER RPCs gated by a session
// code and, for the facilitator, a separate key that is never in this file.

export const SUPABASE_URL = "https://wuzkhoxeawqciwenwlqz.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_vtTvkURVELBh9lL6onei8w_P2F9blSz";
