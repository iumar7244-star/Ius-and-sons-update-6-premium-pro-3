/* IUS AND SONS - Supabase configuration
 * Put ONLY your Supabase Project URL and anon/public key here.
 * Never put a service-role/secret key in this file.
 */
(() => {
  const SUPABASE_URL = "https://your-project-id.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_oydM74hWIIIBNJJDp3JU8g_buNDK4lt";

  const validUrl = /^https:\/\/[^\s]+\.supabase\.co$/i.test(SUPABASE_URL);
  const configured = validUrl &&
    !SUPABASE_URL.includes("PASTE_YOUR_") &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_ANON_KEY.includes("PASTE_YOUR_");

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    window.schoolSupabaseError = "The Supabase library did not load. Check your internet connection and the Supabase script tag.";
    return;
  }

  if (!configured) {
    window.schoolSupabaseError = "Supabase is not configured. Open config.js and add your Project URL and anon/public key.";
    return;
  }

  try {
    window.schoolSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (error) {
    console.error(error);
    window.schoolSupabaseError = "Supabase could not be initialized. Check the Project URL and anon/public key in config.js.";
  }
})();
