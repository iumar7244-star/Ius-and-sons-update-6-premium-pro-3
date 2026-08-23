const $ = id => document.getElementById(id);
const sb = () => window.schoolSupabase;

function showView(id) {
  ["view-register", "view-success", "view-login"].forEach(v => $(v).style.display = v === id ? "block" : "none");
}

function setMessage(id, message, ok = false) {
  const el = $(id);
  el.textContent = message || "";
  el.className = "msg" + (ok ? " success" : "");
}

function resetButton(id, text) {
  $(id).disabled = false;
  $(id).textContent = text;
}

function friendlyError(error) {
  const message = error?.message || String(error || "Unknown error");
  if (/Invalid login credentials/i.test(message)) return "Incorrect School ID or password.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email address first, then sign in again.";
  if (/User already registered/i.test(message)) return "An account with this email already exists. Use Sign In instead.";
  if (/duplicate key|already exists/i.test(message)) return "This school account already exists. Please sign in or use another email.";
  return message;
}

function requireSupabase(messageId) {
  if (sb()) return true;
  setMessage(messageId, window.schoolSupabaseError || "Supabase is not available. Check config.js and the Supabase script.");
  return false;
}

async function ensureSchoolProfile(session) {
  if (!session?.user || !sb()) return { ok: false, pending: true };

  const user = session.user;
  const { data: existingProfile, error: profileLookupError } = await sb()
    .from("profiles")
    .select("id, school_id, full_name, role, schools(id, name, school_code)")
    .eq("id", user.id)
    .maybeSingle();

  if (profileLookupError) throw profileLookupError;
  if (existingProfile?.school_id) return { ok: true, profile: existingProfile, school: existingProfile.schools };

  const meta = user.user_metadata || {};
  const schoolName = String(meta.school_name || "").trim();
  const phone1 = String(meta.phone1 || "").trim();
  const phone2 = String(meta.phone2 || "").trim();
  const fullName = String(meta.full_name || "").trim();

  // Older accounts may not have registration metadata. They can still log in,
  // but they must finish their school profile before using the dashboard.
  if (!schoolName || !phone1 || !fullName) {
    return { ok: false, incomplete: true };
  }

  const { data: schoolRow, error: schoolError } = await sb()
    .from("schools")
    .insert({ name: schoolName, phone1, phone2: phone2 || null, owner_id: user.id })
    .select("id, name, school_code")
    .single();

  if (schoolError) throw schoolError;

  const { data: profileRow, error: profileError } = await sb()
    .from("profiles")
    .insert({ id: user.id, school_id: schoolRow.id, full_name: fullName, role: "admin" })
    .select("id, school_id, full_name, role")
    .single();

  if (profileError) throw profileError;
  return { ok: true, profile: profileRow, school: schoolRow };
}

async function handleExistingSession() {
  if (!sb()) return;
  const { data, error } = await sb().auth.getSession();
  if (error || !data.session) return;

  try {
    const result = await ensureSchoolProfile(data.session);
    if (result.ok) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("confirmed") === "1" && result.school?.school_code) {
        $("schoolIdDisplay").textContent = result.school.school_code;
        showView("view-success");
        return;
      }
      window.location.href = "dashboard.html";
    }
  } catch (error) {
    console.error(error);
  }
}

const requestedView = new URLSearchParams(window.location.search).get("view");
showView(requestedView === "register" ? "view-register" : "view-login");

$("toLogin").onclick = e => { e.preventDefault(); showView("view-login"); };
$("toRegister").onclick = e => { e.preventDefault(); showView("view-register"); };

if (!requireSupabase("loginMsg")) {
  showView(requestedView === "register" ? "view-register" : "view-login");
  requireSupabase(requestedView === "register" ? "registerMsg" : "loginMsg");
} else {
  handleExistingSession();
}


$("registerBtn").onclick = async () => {
  if (!requireSupabase("registerMsg")) return;

  const school = $("regSchool").value.trim();
  const email = $("regEmail").value.trim().toLowerCase();
  const phone1 = $("regPhone1").value.trim();
  const phone2 = $("regPhone2").value.trim();
  const fullName = $("regName").value.trim();
  const password = $("regPassword").value;
  const password2 = $("regPassword2").value;
  setMessage("registerMsg", "");

  if (!school || !email || !phone1 || !fullName || !password) {
    setMessage("registerMsg", "Please fill every required field.");
    return;
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    setMessage("registerMsg", "Please enter a valid email address.");
    return;
  }
  if (password.length < 8) {
    setMessage("registerMsg", "Password needs at least 8 characters.");
    return;
  }
  if (password !== password2) {
    setMessage("registerMsg", "Passwords do not match.");
    return;
  }

  $("registerBtn").disabled = true;
  $("registerBtn").textContent = "Creating account...";

  try {
    const redirectUrl = `${window.location.origin}${window.location.pathname}?view=register&confirmed=1`;
    const { data, error } = await sb().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { school_name: school, phone1, phone2, full_name: fullName }
      }
    });

    if (error) throw error;
    if (!data.user) throw new Error("Supabase did not return a user. Please try again.");

    if (!data.session) {
      setMessage("registerMsg", "Account created. Check your email, confirm your address, then return to this page. Your school information has been saved with your account.", true);
      resetButton("registerBtn", "Create Your Account");
      return;
    }

    const result = await ensureSchoolProfile(data.session);
    if (!result.ok || !result.school?.school_code) {
      throw new Error("Your account was created, but the school profile could not be completed. Please sign in again.");
    }

    $("schoolIdDisplay").textContent = result.school.school_code;
    showView("view-success");
  } catch (error) {
    console.error(error);
    setMessage("registerMsg", friendlyError(error));
    resetButton("registerBtn", "Create Your Account");
  }
};

$("continueDashboard").onclick = () => window.location.href = "dashboard.html";

$("loginBtn").onclick = async () => {
  if (!requireSupabase("loginMsg")) return;

  const code = $("loginCode").value.trim().replace(/\s+/g, "");
  const password = $("loginPassword").value;
  setMessage("loginMsg", "");

  if (!code || !password) {
    setMessage("loginMsg", "Enter your School ID and password.");
    return;
  }

  $("loginBtn").disabled = true;
  $("loginBtn").textContent = "Signing in...";

  try {
    const { data: email, error: lookupErr } = await sb().rpc("get_login_email", { p_school_code: code });
    if (lookupErr || !email) throw new Error("School ID not found.");

    const { data, error } = await sb().auth.signInWithPassword({ email, password });
    if (error) throw error;

    const result = await ensureSchoolProfile(data.session);
    if (!result.ok) throw new Error("Your school profile is incomplete. Please contact the administrator.");
    window.location.href = "dashboard.html";
  } catch (error) {
    console.error(error);
    setMessage("loginMsg", friendlyError(error));
    resetButton("loginBtn", "Sign In");
  }
};
