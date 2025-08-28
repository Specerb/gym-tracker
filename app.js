// ---------- Storage ----------
const STORAGE_KEY = "gt_data_v2";

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seed = { version: 2, unit: "kg", exercises: { "Bench Press": [] } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
  try { return JSON.parse(raw); }
  catch { return { version: 2, unit: "kg", exercises: {} }; }
}

function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

// ---------- State ----------
let state = loadData();
let currentExercise = Object.keys(state.exercises)[0] || "Bench Press";
if (!state.exercises[currentExercise]) state.exercises[currentExercise] = [];

let chart;

// ---------- DOM ----------
const exerciseSelect = document.getElementById("exerciseSelect");
const newExercise = document.getElementById("newExercise");
const addExerciseBtn = document.getElementById("addExerciseBtn");
const deleteExerciseBtn = document.getElementById("deleteExerciseBtn");
const unitToggle = document.getElementById("unitToggle");

const weightInput = document.getElementById("weightInput");
const repsInput = document.getElementById("repsInput");
const dateInput = document.getElementById("dateInput");
const addSetBtn = document.getElementById("addSetBtn");

const statsList = document.getElementById("statsList");
const historyTableBody = document.querySelector("#historyTable tbody");
const exportBtn = document.getElementById("exportBtn");
const importFile = document.getElementById("importFile");

// ---------- Utils ----------
function todayISO() { return new Date().toISOString().slice(0,10); }
function toNumber(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function round1(n) { return Math.round(n * 10)/10; }
function kgToLb(kg) { return kg*2.2046226218; }
function lbToKg(lb) { return lb/2.2046226218; }

function displayToKg(w) { return state.unit==="kg"?w:lbToKg(w); }
function kgToDisplay(w) { return state.unit==="kg"?w:kgToLb(w); }
function formatWeight(w) { return `${round1(kgToDisplay(w))} ${state.unit}`; }

// ---------- Rendering ----------
function renderExerciseOptions() {
  exerciseSelect.innerHTML = "";
  Object.keys(state.exercises).forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    if (name === currentExercise) opt.selected = true;
    exerciseSelect.appendChild(opt);
  });
}

function renderStats() {
  statsList.innerHTML = "";
  for (const exercise of Object.keys(state.exercises)) {
    const sets = state.exercises[exercise];
    if (!sets.length) continue;

    const sorted = [...sets].sort((a,b)=>a.date.localeCompare(b.date));
    const first = sorted[0].weightDisplay;
    const best = Math.max(...sets.map(s=>s.weightDisplay));
    const pct = first>0?round1(((best-first)/first)*100):0;

    const div = document.createElement("div");
    div.innerHTML = `<strong>${exercise}</strong>: ${best} ${state.unit} 
      <span class="muted">(+${pct}% from first ${first} ${state.unit})</span>`;
    statsList.appendChild(div);
  }
}

function renderHistory() {
  historyTableBody.innerHTML = "";
  const rows = state.exercises[currentExercise] || [];
  const sorted = [...rows].sort((a,b)=>b.date.localeCompare(a.date));
  for (const s of sorted) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.date}</td>
      <td>${s.weightDisplay} ${state.unit}</td>
      <td>${s.reps}</td>
      <td><button class="danger" data-id="${s.id}">Delete</button></td>
    `;
    historyTableBody.appendChild(tr);
  }
}

function renderChart() {
  const sets = state.exercises[currentExercise] || [];
  if (!sets.length) return;

  const sorted = [...sets].sort((a,b)=>a.date.localeCompare(b.date));
  const labels = sorted.map(s=>s.date);
  const data = sorted.map(s=>s.weightDisplay);

  const ctx = document.getElementById("progressChart");
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: `${currentExercise} weight`,
        data,
        tension: 0.25,
        borderColor: '#4ea8de',
        backgroundColor: 'rgba(78,168,222,0.2)',
        fill: true
      }]
    },
    options: {
      responsive:true,
      plugins:{legend:{display:true}},
      scales:{y:{title:{display:true,text:state.unit}}}
    }
  });
}

function renderAll() {
  renderExerciseOptions();
  renderStats();
  renderHistory();
  renderChart();
}

// ---------- Actions ----------
function addExercise() {
  const name = newExercise.value.trim();
  if (!name) return;
  if (!state.exercises[name]) state.exercises[name] = [];
  currentExercise = name;
  newExercise.value = "";
  saveData();
  renderAll();
}

function deleteExercise() {
  if (!confirm(`Delete exercise "${currentExercise}" and all its sets?`)) return;
  delete state.exercises[currentExercise];
  currentExercise = Object.keys(state.exercises)[0] || "Bench Press";
  if (!state.exercises[currentExercise]) state.exercises[currentExercise]=[];
  saveData();
  renderAll();
}

function addSet() {
  const weight = toNumber(weightInput.value);
  const reps = toNumber(repsInput.value);
  const date = dateInput.value || todayISO();
  if (weight===null || reps===null || reps<=0) { alert("Enter valid weight and reps"); return; }

  const set = { id: crypto.randomUUID(), weightDisplay: weight, reps, date };
  state.exercises[currentExercise].push(set);
  weightInput.value=""; repsInput.value=""; dateInput.value=todayISO();
  saveData();
  renderAll();
}

function deleteSet(id) {
  const arr = state.exercises[currentExercise];
  const idx = arr.findIndex(s=>s.id===id);
  if(idx!==-1){ arr.splice(idx,1); saveData(); renderAll(); }
}

function setUnit(u) {
  if(u===state.unit) return;
  for(const ex of Object.keys(state.exercises)){
    for(const s of state.exercises[ex]){
      const kg = state.unit==="kg"?s.weightDisplay:lbToKg(s.weightDisplay);
      s.weightDisplay = u==="kg"?kg:kgToLb(kg);
    }
  }
  state.unit=u;
  saveData();
  renderAll();
}

// ---------- Backup ----------
function exportData() {
  const blob = new Blob([JSON.stringify(state,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download="gym-tracker-backup.json"; a.click();
  URL.revokeObjectURL(url);
}

function importData(file){
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const incoming = JSON.parse(reader.result);
      if(!incoming || !incoming.exercises) throw new Error("Invalid file");
      state = incoming;
      currentExercise = Object.keys(state.exercises)[0]||"Bench Press";
      if(!state.exercises[currentExercise]) state.exercises[currentExercise]=[];
      saveData(); renderAll();
    } catch(e){ alert("Import failed: "+e.message); }
  };
  reader.readAsText(file);
}

// ---------- Events ----------
document.addEventListener("DOMContentLoaded",()=>{
  dateInput.value=todayISO();
  unitToggle.value=state.unit;

  renderAll();

  addExerciseBtn.addEventListener("click",addExercise);
  deleteExerciseBtn.addEventListener("click",deleteExercise);
  exerciseSelect.addEventListener("change",(e)=>{currentExercise=e.target.value; renderAll();});
  unitToggle.addEventListener("change",(e)=>setUnit(e.target.value));
  addSetBtn.addEventListener("click",addSet);
  historyTableBody.addEventListener("click",(e)=>{
    const btn=e.target.closest("button[data-id]");
    if(btn) deleteSet(btn.getAttribute("data-id"));
  });
  exportBtn.addEventListener("click",exportData);
  importFile.addEventListener("change",(e)=>{
    if(e.target.files && e.target.files[0]) importData(e.target.files[0]);
    e.target.value="";
  });
});
