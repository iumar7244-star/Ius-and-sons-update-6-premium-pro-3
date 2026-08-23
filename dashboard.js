const $ = id => document.getElementById(id);
const sb = () => window.schoolSupabase;
let SCHOOL = null; // { id, name, location, badge_url }

// ---------- auth guard ----------
(async function init() {
  if (!sb()) { window.location.href = "auth.html?view=login"; return; }
  const { data: { session } } = await sb().auth.getSession();
  if (!session) { window.location.href = "auth.html?view=login"; return; }

  const { data: profile, error } = await sb().from("profiles").select("*, schools(*)").eq("id", session.user.id).single();
  if (error || !profile) { window.location.href = "auth.html?view=login"; return; }

  SCHOOL = profile.schools;
  $("schoolBadgeMini").innerHTML = `${SCHOOL.badge_url ? `<img src="${SCHOOL.badge_url}">` : ""}<span>${esc(SCHOOL.name)}</span>`;
  loadOverview();
  loadYears();
  loadClasses();
  loadSubjects();
  loadTeachers();

  $("pf-name").value = SCHOOL.name || "";
  $("pf-location").value = SCHOOL.location || "";
  if (SCHOOL.badge_url) { $("pf-badge-preview").src = SCHOOL.badge_url; $("pf-badge-preview").style.display = "block"; }
})();

function esc(x) { return String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
async function logActivity(action, details) { await sb().from("activity_logs").insert({ school_id: SCHOOL.id, user_id: (await sb().auth.getUser()).data.user.id, action, details }); }

// ---------- navigation ----------
document.querySelectorAll(".navlink[data-view]").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".navlink").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".view").forEach(v => v.style.display = "none");
    $("view-" + btn.dataset.view).style.display = "block";
  };
});
$("logoutBtn").onclick = async () => { await sb().auth.signOut(); window.location.href = "auth.html?view=login"; };

// ---------- overview ----------
async function loadOverview() {
  const [{ count: students }, { count: years }, { count: classes }] = await Promise.all([
    sb().from("students").select("*", { count: "exact", head: true }),
    sb().from("academic_years").select("*", { count: "exact", head: true }),
    sb().from("classes").select("*", { count: "exact", head: true }),
  ]);
  $("overviewCards").innerHTML = `
    <div class="card"><b>${students ?? 0}</b><span>Students</span></div>
    <div class="card"><b>${years ?? 0}</b><span>Academic Years</span></div>
    <div class="card"><b>${classes ?? 0}</b><span>Classes</span></div>`;
}

// ---------- school profile ----------
$("pf-badge").onchange = async e => {
  const file = e.target.files[0]; if (!file) return;
  const path = `${SCHOOL.id}/badge-${Date.now()}-${file.name}`;
  const { error } = await sb().storage.from("badges").upload(path, file, { upsert: true });
  if (error) { $("pf-msg").textContent = error.message; return; }
  const { data } = sb().storage.from("badges").getPublicUrl(path);
  SCHOOL.badge_url = data.publicUrl;
  $("pf-badge-preview").src = SCHOOL.badge_url; $("pf-badge-preview").style.display = "block";
};
$("pf-save").onclick = async () => {
  const name = $("pf-name").value.trim(), location = $("pf-location").value.trim();
  const { error } = await sb().from("schools").update({ name, location, badge_url: SCHOOL.badge_url }).eq("id", SCHOOL.id);
  $("pf-msg").textContent = error ? error.message : "Saved.";
  if (!error) { SCHOOL.name = name; SCHOOL.location = location; $("schoolBadgeMini").innerHTML = `${SCHOOL.badge_url ? `<img src="${SCHOOL.badge_url}">` : ""}<span>${esc(name)}</span>`; }
};

// ---------- academic years ----------
async function loadYears() {
  const { data } = await sb().from("academic_years").select("*").eq("school_id", SCHOOL.id).order("year", { ascending: false });
  $("yr-body").innerHTML = (data || []).map(y => `<tr><td>${y.year}</td><td>${y.status}</td>
    <td><button data-id="${y.id}" class="gray yr-toggle">${y.status === "active" ? "Close" : "Reopen"}</button></td></tr>`).join("");
  document.querySelectorAll(".yr-toggle").forEach(b => b.onclick = async () => {
    const row = data.find(y => y.id === b.dataset.id);
    await sb().from("academic_years").update({ status: row.status === "active" ? "closed" : "active" }).eq("id", row.id);
    loadYears();
  });
  $("st-year").innerHTML = (data || []).map(y => `<option value="${y.id}">${y.year}</option>`).join("");
  $("cl-year").innerHTML = (data || []).map(y => `<option value="${y.id}">${y.year}</option>`).join("");
}
$("yr-add").onclick = async () => {
  const year = parseInt($("yr-input").value, 10); if (!year) return;
  const { error } = await sb().from("academic_years").insert({ school_id: SCHOOL.id, year, status: "active" });
  if (!error) { $("yr-input").value = ""; logActivity(`Added academic year ${year}`); loadYears(); loadOverview(); }
};

// ---------- classes & streams ----------
async function loadClasses() {
  const { data: classes } = await sb().from("classes").select("*, streams(*)").eq("school_id", SCHOOL.id).order("name");
  $("cl-list").innerHTML = (classes || []).map(c => `
    <div class="student" data-id="${c.id}">
      <div class="student-head"><b>${esc(c.name)}</b>
        <input class="stream-input" placeholder="Add stream e.g. East" style="max-width:160px">
        <button class="green stream-add">+ Stream</button>
        <button class="gray cl-showstudents">Show Students</button>
        <button class="danger cl-remove">Remove Class</button></div>
      <div class="streamTags">${(c.streams || []).map(s => `<span class="tag">${esc(s.name)}</span>`).join(" ") || "<span class='hint'>No streams — this class is not split.</span>"}</div>
      <div class="classStudentList" style="display:none"></div>
    </div>`).join("");
  document.querySelectorAll("#cl-list .student").forEach(card => {
    const cls = classes.find(c => c.id === card.dataset.id);
    card.querySelector(".stream-add").onclick = async () => {
      const name = card.querySelector(".stream-input").value.trim(); if (!name) return;
      await sb().from("streams").insert({ class_id: cls.id, name });
      loadClasses();
    };
    card.querySelector(".cl-remove").onclick = async () => {
      if (!confirm(`Remove ${cls.name}? This also removes its streams.`)) return;
      await sb().from("classes").delete().eq("id", cls.id);
      loadClasses(); loadOverview();
    };
    card.querySelector(".cl-showstudents").onclick = () => loadClassStudents(cls.id, card.querySelector(".classStudentList"));
  });
  $("cl-year").onchange = () => {
    document.querySelectorAll("#cl-list .classStudentList").forEach(el => { if (el.style.display !== "none") el.dataset.dirty = "1"; });
    document.querySelectorAll("#cl-list .student").forEach(card => {
      const list = card.querySelector(".classStudentList");
      if (list.style.display !== "none") loadClassStudents(card.dataset.id, list);
    });
  };
  $("st-class").innerHTML = (classes || []).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  if (classes && classes.length) updateStreamOptions(classes[0].id, classes);
  $("st-class").onchange = () => updateStreamOptions($("st-class").value, classes);
  window._classesCache = classes || [];
}
async function loadClassStudents(classId, listEl) {
  const yearId = $("cl-year").value;
  listEl.style.display = "block";
  if (!yearId) { listEl.innerHTML = "<span class='hint'>Add an academic year first.</span>"; return; }
  listEl.textContent = "Loading...";
  const { data } = await sb().from("student_placements")
    .select("students(student_code, full_name)")
    .eq("class_id", classId).eq("academic_year_id", yearId);
  listEl.innerHTML = (data && data.length)
    ? "<b>Students:</b> " + data.map(p => `${esc(p.students.full_name)} (${esc(p.students.student_code)})`).join(", ")
    : "<span class='hint'>No students placed in this class for the selected year.</span>";
}

function updateStreamOptions(classId, classes) {
  const cls = classes.find(c => c.id === classId);
  $("st-stream").innerHTML = `<option value="">— none —</option>` + (cls?.streams || []).map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("");
}
$("cl-add").onclick = async () => {
  const name = $("cl-input").value.trim(); if (!name) return;
  const { error } = await sb().from("classes").insert({ school_id: SCHOOL.id, name });
  if (!error) { $("cl-input").value = ""; logActivity(`Added class ${name}`); loadClasses(); loadOverview(); }
};

// ---------- subjects ----------
async function loadSubjects() {
  const { data } = await sb().from("subjects").select("*, class_subjects(class_id, classes(name))").eq("school_id", SCHOOL.id).order("name");
  $("sub-body").innerHTML = (data || []).map(s => `<tr><td>${esc(s.name)}</td>
    <td>${(s.class_subjects || []).map(cs => esc(cs.classes?.name || "")).join(", ") || "<span class='hint'>none yet</span>"}</td>
    <td><button class="danger sub-remove" data-id="${s.id}">Remove</button></td></tr>`).join("");
  document.querySelectorAll(".sub-remove").forEach(b => b.onclick = async () => {
    await sb().from("subjects").delete().eq("id", b.dataset.id);
    loadSubjects();
  });
}
$("sub-add").onclick = async () => {
  const name = $("sub-input").value.trim(); if (!name) return;
  const { error } = await sb().from("subjects").insert({ school_id: SCHOOL.id, name });
  if (!error) { $("sub-input").value = ""; logActivity(`Added subject ${name}`); loadSubjects(); }
};

// ---------- students ----------
async function loadStudents() {
  const { data } = await sb().from("students").select("*, student_placements(academic_year_id, class_id, classes(name))").eq("school_id", SCHOOL.id).order("student_code");
  $("st-body").innerHTML = (data || []).map(s => `<tr><td>${esc(s.student_code)}</td><td>${esc(s.full_name)}</td><td>${esc(s.gender || "")}</td>
    <td>${esc(s.student_placements?.[0]?.classes?.name || "")}</td></tr>`).join("");
}
document.querySelector('[data-view="students"]').addEventListener("click", loadStudents);

// ---------- teachers ----------
async function loadTeachers() {
  const [{ data: teachers }, { data: subjects }, { data: classes }] = await Promise.all([
    sb().from("teachers").select("*, teacher_subjects(id, subjects(name), classes(name))").eq("school_id", SCHOOL.id).order("full_name"),
    sb().from("subjects").select("*").eq("school_id", SCHOOL.id).order("name"),
    sb().from("classes").select("*").eq("school_id", SCHOOL.id).order("name"),
  ]);
  $("tc-list").innerHTML = (teachers || []).map(t => `
    <div class="student" data-id="${t.id}">
      <div class="student-head"><b>${esc(t.full_name)}</b><span class="hint">${esc(t.email || "")} ${esc(t.phone || "")}</span>
        <button class="danger tc-remove">Remove Teacher</button></div>
      <div class="row">
        <select class="tc-subject">${(subjects || []).map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>
        <select class="tc-class"><option value="">Any class</option>${(classes || []).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select>
        <button class="green tc-assign">+ Assign Subject</button>
      </div>
      <div class="streamTags">${(t.teacher_subjects || []).map(ts => `<span class="tag" data-tsid="${ts.id}">${esc(ts.subjects?.name)}${ts.classes ? " — " + esc(ts.classes.name) : ""} <a href="#" class="tc-unassign" data-tsid="${ts.id}">×</a></span>`).join(" ") || "<span class='hint'>No subjects assigned yet.</span>"}</div>
    </div>`).join("");

  document.querySelectorAll("#tc-list .student").forEach(card => {
    const teacherId = card.dataset.id;
    card.querySelector(".tc-remove").onclick = async () => {
      if (!confirm("Remove this teacher?")) return;
      await sb().from("teachers").delete().eq("id", teacherId);
      loadTeachers();
    };
    card.querySelector(".tc-assign").onclick = async () => {
      const subject_id = card.querySelector(".tc-subject").value;
      const class_id = card.querySelector(".tc-class").value || null;
      if (!subject_id) return;
      const { error } = await sb().from("teacher_subjects").insert({ teacher_id: teacherId, subject_id, class_id });
      if (!error) loadTeachers();
    };
    card.querySelectorAll(".tc-unassign").forEach(a => a.onclick = async e => {
      e.preventDefault();
      await sb().from("teacher_subjects").delete().eq("id", a.dataset.tsid);
      loadTeachers();
    });
  });
}
$("tc-add").onclick = async () => {
  const full_name = $("tc-name").value.trim(), email = $("tc-email").value.trim(), phone = $("tc-phone").value.trim();
  if (!full_name) { $("tc-msg").textContent = "Teacher name is required."; return; }
  const { error } = await sb().from("teachers").insert({ school_id: SCHOOL.id, full_name, email, phone });
  $("tc-msg").textContent = error ? error.message : "";
  if (!error) { $("tc-name").value = ""; $("tc-email").value = ""; $("tc-phone").value = ""; logActivity(`Added teacher ${full_name}`); loadTeachers(); }
};

$("st-add").onclick = async () => {
  const full_name = $("st-name").value.trim(), gender = $("st-gender").value;
  const academic_year_id = $("st-year").value, class_id = $("st-class").value, stream_id = $("st-stream").value || null;
  if (!full_name || !academic_year_id || !class_id) { $("st-msg").textContent = "Name, academic year and class are required."; return; }

  const { count } = await sb().from("students").select("*", { count: "exact", head: true }).eq("school_id", SCHOOL.id);
  const student_code = `STU-${String((count || 0) + 1).padStart(6, "0")}`;

  const { data: student, error } = await sb().from("students").insert({ school_id: SCHOOL.id, student_code, full_name, gender }).select().single();
  if (error) { $("st-msg").textContent = error.message; return; }

  const { error: placeErr } = await sb().from("student_placements").insert({ student_id: student.id, academic_year_id, class_id, stream_id });
  $("st-msg").textContent = placeErr ? placeErr.message : `Added ${full_name} as ${student_code}.`;
  if (!placeErr) { $("st-name").value = ""; logActivity(`Added student ${student_code} — ${full_name}`); loadStudents(); loadOverview(); }
};
