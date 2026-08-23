const SUBJECTS={
  senior12:["English Language","Mathematics","Biology","Chemistry","Physics","Geography","History & Political Education","Entrepreneurship Education","Physical Education (PE)","General Science","Kiswahili"],
  senior34:["English Language","Mathematics","Biology","Chemistry","Physics","Geography","History & Political Education"],
  primary:["English","Mathematics","Integrated Science","Social Studies"],
  tp:["القرآن","التربية الإسلامية","الفقه","اللغة العربية"],
  tj:["الحفظ والتفسير","التلاوة والتجويد","الإملاء والخط","الأدب والنصوص","إنشاء والمطالعة","النحو والصرف","فقه العبادات","الحديث","العقيدة","التاريخ"],
  ts:["الحفظ والتفسير","التلاوة والتجويد","الإملاء والخط","الأدب والنصوص","إنشاء والمطالعة","النحو والصرف","فقه العبادات","الحديث","العقيدة","التاريخ","مصطلح الحديث","أصول الفقه","أصول التفسير","فقه المعاملات","الأديان والفرق"]
};
// Elective option pools + how many a student may pick, per category
const ELECTIVES={
  senior12:{options:["Arabic Language","Luganda","Art","Religious Education","Other / Custom Subject"],max:1},
  senior34:{options:["Arabic Language","Luganda","Kiswahili","Art","Entrepreneurship Education","Religious Education","Other / Custom Subject"],max:2}
};
const ENF=["Inter","Roboto","Segoe UI","Lato","Open Sans","Poppins","Nunito","Calibri","Times New Roman","Georgia","Montserrat","Arial"],ARF=["Noto Sans Arabic","Cairo","Tajawal","Almarai","Readex Pro","Amiri","Traditional Arabic","Sakkal Majalla","Changa","Kufam","Scheherazade New","Harmattan"];
const CATEGORY_NAMES={senior12:"Senior 1 & 2 (O-Level)",senior34:"Senior 3 & 4 (O-Level)",primary:"Primary School",tp:"التعليم الديني الابتدائي",tj:"أول إعدادي - ثالث إعدادي",ts:"أول ثانوي - ثالث ثانوي"};
const $=id=>document.getElementById(id);ENF.forEach(x=>$("fontEn").add(new Option(x,x)));ARF.forEach(x=>$("fontAr").add(new Option(x,x)));$("fontEn").value="Arial";$("fontAr").value="Noto Sans Arabic";
let students=[],badge="";
const uid=()=>Math.random().toString(36).slice(2);
const theology=()=>["tp","tj","ts"].includes($("category").value);
const isPrimary=()=>["primary","tp"].includes($("category").value);
const isSecondary=()=>["senior12","senior34"].includes($("category").value);
const isOLevel=()=>isSecondary(); // kept for compatibility with existing calls

function pg(m){if(m>=80)return["D1","1"];if(m>=70)return["D2","2"];if(m>=60)return["C3","3"];if(m>=50)return["C4","4"];if(m>=40)return["C5","5"];if(m>=30)return["C6","6"];if(m>=20)return["P7","7"];if(m>=10)return["P8","8"];return["F9","9"]}
function tg(m){if(m>=80)return["ممتاز",""];if(m>=70)return["جيد جدا",""];if(m>=60)return["جيد",""];if(m>=50)return["حسن",""];if(m>=40)return["مقبول",""];return["راسب",""]}
function toArabicDigits(v){return String(v??"").replace(/[0-9]/g,d=>"٠١٢٣٤٥٦٧٨٩"[d])}
function grade(m){return m===""?["—",""]:theology()?tg(+m):(isSecondary()?olGrade(+m):pg(+m))}
function olGrade(m){if(m>=80)return["A","Pass with Distinction"];if(m>=70)return["B","Pass with Credit"];if(m>=60)return["C","Pass with Credit"];if(m>=50)return["D","Pass"];return["E","Pass with lower competency"]}
function total(s){return s.marks.reduce((a,b)=>a+(+b||0),0)}
function esc(x){return String(x??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;")}

// how many fixed/compulsory subjects the current category has
function compulsoryLen(cat){return SUBJECTS[cat]?SUBJECTS[cat].length:0}
function electiveCountOf(s){let cat=$("category").value;return s.marks.length-compulsoryLen(cat)}
function electiveOptionsFor(s){
  let cat=$("category").value,pool=ELECTIVES[cat];if(!pool)return[];
  let cLen=compulsoryLen(cat);
  let used=s.marks.slice(cLen).map((_,i)=>s.customNames[cLen+i]).filter(Boolean);
  return pool.options.filter(o=>!used.includes(o));
}

function addStudent(){students.push({id:uid(),name:"",marks:SUBJECTS[$("category").value].map(()=>""),customNames:{}});render()}

function render(){
  let cat=$("category").value,sub=SUBJECTS[cat]||[],secondary=isSecondary(),cLen=compulsoryLen(cat);
  $("students").innerHTML=students.map((s,n)=>{
    let subjectRows=s.marks.map((m,i)=>{
      let g=grade(m);
      let isCompulsory=secondary&&i<cLen;
      return `<div class="subject" data-i="${i}"><input class="subname" ${isCompulsory?"readonly":""} value="${esc(s.customNames[i]??sub[i]??"Subject")}"><input class="mark" type="number" min="0" max="100" step="1" inputmode="numeric" value="${m}" placeholder="0–100"><div class="grade" dir="auto">${g[0]}</div>${isCompulsory?"":'<button class="danger del">Remove</button>'}</div>`;
    }).join("");
    let electivePicker="";
    if(secondary){
      let pool=ELECTIVES[cat],remaining=pool.max-electiveCountOf(s),opts=electiveOptionsFor(s);
      if(remaining>0&&opts.length){
        electivePicker=`<div class="electiveRow"><select class="electivePick">${opts.map(o=>`<option>${esc(o)}</option>`).join("")}</select><button class="green addElective">+ Add Elective (${remaining} left)</button></div>`;
      }
    }
    return `<div class="student" data-id="${s.id}"><div class="student-head"><b>${n+1}.</b><input class="name" value="${esc(s.name)}" placeholder="Student full name">${secondary?"":'<button class="green addsub">+ Add Subject</button>'}<button class="gray restore">Restore Defaults</button><button class="gray clear">Clear Table</button><button class="danger remove">Remove Student</button></div>${subjectRows}${electivePicker}<b class="totalLine">Total: ${total(s)} / ${s.marks.length*100} | Percentage: ${s.marks.length?(total(s)/s.marks.length).toFixed(2):0}%</b></div>`;
  }).join("");

  document.querySelectorAll(".student").forEach(c=>{
    let s=students.find(x=>x.id===c.dataset.id);
    c.querySelector(".name").oninput=e=>{s.name=e.target.value;build()};
    c.querySelector(".remove").onclick=()=>{students=students.filter(x=>x!==s);render()};
    let addsub=c.querySelector(".addsub");if(addsub)addsub.onclick=()=>{s.marks.push("");s.customNames[s.marks.length-1]="New Subject";render()};
    c.querySelector(".clear").onclick=()=>{s.marks=s.marks.map(()=>"" );render()};
    c.querySelector(".restore").onclick=()=>{s.marks=SUBJECTS[$("category").value].map((_,i)=>s.marks[i]||"");s.customNames={};render()};
    c.querySelectorAll(".subname").forEach((e,i)=>e.oninput=()=>{s.customNames[i]=e.value;build()});
    // marks: update value + this row's grade + the total line only — never re-render the whole card while typing
    c.querySelectorAll(".mark").forEach((e,i)=>{
      e.oninput=()=>{
        let v=e.value.replace(/\D/g,"");
        s.marks[i]=v===""?"":Math.min(100,parseInt(v,10));
        if(s.marks[i]!==""&&+e.value>100)e.value=100;
        let g=grade(s.marks[i]);
        c.querySelectorAll(".subject")[i].querySelector(".grade").textContent=g[0];
        c.querySelector(".totalLine").textContent=`Total: ${total(s)} / ${s.marks.length*100} | Percentage: ${s.marks.length?(total(s)/s.marks.length).toFixed(2):0}%`;
        build();
      };
    });
    c.querySelectorAll(".del").forEach(btn=>btn.onclick=()=>{
      let i=+btn.closest(".subject").dataset.i;
      s.marks.splice(i,1);
      // re-index customNames after removal
      let nc={};Object.keys(s.customNames).forEach(k=>{let ik=+k;if(ik<i)nc[ik]=s.customNames[k];else if(ik>i)nc[ik-1]=s.customNames[k]});
      s.customNames=nc;render();
    });
    let addElective=c.querySelector(".addElective");
    if(addElective)addElective.onclick=()=>{
      let choice=c.querySelector(".electivePick").value;
      s.marks.push("");
      s.customNames[s.marks.length-1]=choice;
      render();
    };
  });
  renderPreview();build();
}

function renderPreview(){let old=$("preview").value;$("preview").innerHTML=students.map((s,i)=>`<option value="${s.id}">${i+1}. ${esc(s.name||"Unnamed")}</option>`).join("");if(students.some(s=>s.id===old))$("preview").value=old}
function rank(s){let a=students.map(x=>total(x)).sort((a,b)=>b-a);return a.indexOf(total(s))+1}
function overall(a){return a>=80?"ممتاز":a>=70?"جيد جدا":a>=60?"جيد":a>=50?"حسن":a>=40?"مقبول":"راسب"}

function card(s,two,keyOverride){
  let key=keyOverride||$("category").value,isO=key==="senior12"||key==="senior34",isAr=["tp","tj","ts"].includes(key),t=total(s),avg=s.marks.length?t/s.marks.length:0;
  let rows=s.marks.map((m,i)=>{let g=isO?olGrade(+m||0):(key==="primary"?pg(+m||0):tg(+m||0));return `<tr><td>${esc(s.customNames[i]??SUBJECTS[key][i]??"Subject")}</td><td>${isAr?toArabicDigits(+m||0):(+m||0)}</td><td dir="auto">${g[0]}</td><td>${isAr?"":g[1]}</td></tr>`}).join("");
  return `<div class="report-sheet ${$("color").value}${two?" two":""} ${isAr?"rtl":""} ${$("border").value==="none"?"":"border-"+$("border").value}" style="font-family:'${isAr?$("fontAr").value:$("fontEn").value}';color:${$("fontColor").value}"><div class="report-head">${badge?`<img class="report-badge" src="${badge}">`:""}<div><div class="school-title">${esc($("school").value||"SCHOOL NAME")}</div><div class="location">${esc($("location").value||"")}</div></div></div><div class="meta"><b>${isAr?"اسم الطالب":"Student"}:</b> ${esc(s.name||"—")}<br><b>${isAr?"الصف":"Class"}:</b> ${esc($("className").value||"—")}<br><b>${isAr?"المركز / الترتيب":"Position / Rank"}:</b> ${rank(s)} / ${students.length}</div><table class="table" style="font-family:'${isAr?$("fontAr").value:$("fontEn").value}';color:${$("fontColor").value}"><tr><th>${isAr?"المادة":"Subject"}</th><th>${isAr?"العلامة / ١٠٠":"Mark /100"}</th><th>${isAr?"التقدير":"Grade"}</th><th>${isAr?"":"Code / Level"}</th></tr>${rows}</table><div class="summary">${isAr?"المجموع":"Total"}: ${isAr?toArabicDigits(t):t} / ${isAr?toArabicDigits(s.marks.length*100):s.marks.length*100}<br>${isAr?"النسبة المئوية":"Percentage"}: ${isAr?toArabicDigits(avg.toFixed(2)):avg.toFixed(2)}%${isO?`<br>Overall Grade: ${olGrade(avg)[0]} — ${olGrade(avg)[1]}`:(key==="ts"?`<br>Overall Grade: ${overall(avg)}`:"")}</div><div class="footer"><span>Teacher: __________</span><span>Head Teacher: __________</span></div></div>`;
}
function build(){if(!students.length){$("report").innerHTML="";return}let out="";if($("perPage").value==="combined"&&students.length){out+=card(students[0],true,"primary");out+=card(students[0],true,"tp")}else{students.forEach(s=>out+=card(s,false))}$("report").innerHTML=out}

function help(){
  let k=$("category").value;
  if(k==="senior12")$("gradingHelp").innerHTML=`O-Level grading: A 80–100 · B 70–79 · C 60–69 · D 50–59 · E 0–49. Senior 1 & 2: 11 compulsory subjects (English, Mathematics, Biology, Chemistry, Physics, Geography, History & Political Education, Entrepreneurship Education, PE, General Science, Kiswahili) + exactly 1 elective (Arabic, Luganda, Art, Religious Education, or custom).`;
  else if(k==="senior34")$("gradingHelp").innerHTML=`O-Level grading: A 80–100 · B 70–79 · C 60–69 · D 50–59 · E 0–49. Senior 3 & 4: 7 core subjects (English, Mathematics, Biology, Chemistry, Physics, Geography, History & Political Education) + up to 2 electives (Arabic, Luganda, Kiswahili, Art, Entrepreneurship, Religious Education, or custom).`;
  else if(theology())$("gradingHelp").innerHTML=`Each paper: <b>80–100 ممتاز</b> · <b>70–79 جيد جدا</b> · <b>60–69 جيد</b> · <b>50–59 حسن</b> · <b>40–49 مقبول</b> · <b>below 40 راسب</b>. Maximum ${SUBJECTS[k].length*100}.`;
  else $("gradingHelp").innerHTML="Primary: D1 80–100 · D2 70–79 · C3 60–69 · C4 50–59 · C5 40–49 · C6 30–39 · P7 20–29 · P8 10–19 · F9 below 10";
  $("perPage").disabled=!isPrimary();if(!isPrimary())$("perPage").value="1";
}

$("add").onclick=addStudent;
$("category").onchange=()=>{students=students.map(s=>({...s,marks:SUBJECTS[$("category").value].map((_,i)=>s.marks[i]||""),customNames:{}}));help();render()};
$("preview").onchange=build;
["school","location","className","color","fontEn","fontAr","fontColor","perPage","border"].forEach(x=>$(x).oninput=build);
$("badge").onchange=e=>{let r=new FileReader;r.onload=()=>{badge=r.result;$("badgePreview").src=badge;$("badgePreview").style.display="block";build()};r.readAsDataURL(e.target.files[0])};
$("print").onclick=()=>print();
$("word").onclick=()=>{let b=new Blob([`<html><body>${$("report").innerHTML}</body></html>`],{type:"application/msword"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="IUS-and-SONS-Reports.doc";a.click()};
$("className").value="Senior 1";help();addStudent();
