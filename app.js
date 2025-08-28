// ---------- Storage ----------
const STORAGE_KEY = "gt_data_v1";

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seed = { version: 1, unit: "kg", exercises: { "Bench Press": [] } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
  try { return JSON.parse(raw); }
  catch { return { version: 1, unit: "kg", exercises: {} }; }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---------- State ----------
let state = loadData();
let currentExercise = Object.keys(state.exercises)[0] || "Bench Press";
if (!state.exercises[currentExercise]) state.exercises[currentExercise] = [];

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

const baseline1rmEl = document.getElementById("baseline1rm");
const best1rmEl = document.getElementById("best1rm");
const percentChangeEl = document.getElementById("percentChange");

const historyTableBody = document.querySelector("#historyTable tbody");
const exportBtn = document.getElementById("exportBtn");
const importFile = document.getElementById("importFile");

let chart;

// ---------- Utils ----------
function todayISO() { return new Date().toISOString().slice(0,10); }
function toNumber(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function round1(n) { return Math.round(n * 10) / 10; }
function kgToLb(kg) { return kg * 2.2046226218; }
function lbToKg(lb) { return lb / 2.2046226218; }

// Epley 1RM: weight × (1 + reps/30)
function oneRepMax(weight, reps) { return weight * (1 + reps / 30); }

// Convert display weight to kg for internal calculations
function displayToKg(w) { return state.unit === "kg" ? w : lbToKg(w); }
function kgToDisplay(wkg) { return state.unit === "kg" ? wkg : kgToLb(wkg); }
function formatWeight(wkg) { return `${round1(kgToDisplay(wkg))} ${state.unit}`; }

// ---------- Rendering ----------
function renderExerciseOptions() {
  exerciseSelect.innerHTML = "";
  Object.keys(state.exercises).forEach(name => {
    const opt = document.createElement("option");
    opt.value = name; opt.textContent = name;
    if (name === currentExercise) opt.selected = true;
    exerciseSelect.appendChild(opt);
  });
}

function renderHistory() {
  historyTableBody.innerHTML = "";
  const rows = state.exercises[currentExercise] || [];
  // newest first
  const sorted = [...rows].sort((a,b) => b.date.localeCompare(a.date));
  for (const [idx, set] of sorted.entries()) {
    const tr = document.createElement("tr");
    const wkg = displayToKg(set.weightDisplay); // stored in display units
    const orm = oneRepMax(wkg, set.reps);

    tr.innerHTML = `
      <td>${set.date}</td>
      <td>${round1(set.weightDisplay)} ${state.unit}</td>
      <td>${set.reps}</td>
      <td>${round1(kgToDisplay(orm))} ${state.unit}</td>
      <td><button class="danger" data-del="${set.id}">Delete</button></td>
    `;
    historyTableBody.appendChild(tr);
  }
}

function renderStats() {
  const rows = state.exercises[currentExercise] || [];
  if (rows.length === 0) {
    baseline1rmEl.textContent = "–";
    best1rmEl.textContent = "–";
    percentChangeEl.textContent = "–";
    return;
  }
  // Compute baseline as the first logged best 1RM (by date ascending)
  const asc = [...rows].sort((a,b) => a.date.localeCompare(b.date));
  const baselineSet = asc[0];
  const baseline1rm = oneRepMax(displayToKg(baselineSet.weightDisplay), baselineSet.reps);

  // Best 1RM overall
  let best = 0;
  for (const s of rows) {
    const val = oneRepMax(displayToKg(s.weightDisplay), s.reps);
    if (val > best) best = val;
  }
  const pct = baseline1rm > 0 ? ((best - baseline1rm) / baseline1rm) * 100 : 0;

  baseline1rmEl.textContent = formatWeight(baseline1rm);
  best1rmEl.textContent = formatWeight(best);
  percentChangeEl.textContent = `${round1(pct)}%`;
}

function renderChart() {
  const rows = state.exercises[currentExercise] || [];
  const byDate = {};
  for (const s of rows) {
    const orm = oneRepMax(displayToKg(s.weightDisplay), s.reps);
    byDate[s.date] = Math.max(byDate[s.date] || 0, orm);
  }
  const labels = Object.keys(byDate).sort();
  const data = labels.map(d => round1(kgToDisplay(byDate[d])));

  const ctx = document.getElementById("progressChart");
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{ label: `${currentExercise} — best 1RM`, data, tension: 0.25 }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: {
        x: { ticks: { maxRotation: 0 } },
        y: { title: { display: true, text: state.unit } }
      }
    }
  });
}

function renderAll() {
  renderExerciseOptions();
  renderHistory();
  renderStats();
  renderChart();
}

// ---------- Actions ----------
function addExercise() {
  const name = newExercise.value.trim();
  if (!name) return;
  if (state.exercises[name]) { currentExercise = name; renderAll(); newExercise.value = ""; return; }
  state.exercises[name] = [];
  currentExercise = name;
  saveData();
  renderAll();
  newExercise.value = "";
}

function deleteExercise() {
  const name = currentExercise;
  if (!confirm(`Delete exercise "${name}" and all its data?`)) return;
  delete state.exercises[name];
  const first = Object.keys(state.exercises)[0] || "Bench Press";
  if (!state.exercises[first]) state.exercises[first] = [];
  currentExercise = first;
  saveData();
  renderAll();
}

function addSet() {
  const w = toNumber(weightInput.value);
  const r = toNumber(repsInput.value);
  const d = dateInput.value || todayISO();
  if (w === null || r === null || r <= 0) { alert("Enter valid weight and reps."); return; }

  const set = {
    id: crypto.randomUUID(),
    date: d,
    weightDisplay: w, // store in chosen unit so UI stays consistent
    reps: r
  };
  state.exercises[currentExercise].push(set);
  saveData();
  weightInput.value = "";
  repsInput.value = "";
  dateInput.value = todayISO();
  renderAll();
}

function deleteSet(id) {
  const arr = state.exercises[currentExercise];
  const idx = arr.findIndex(s => s.id === id);
  if (idx !== -1) {
    arr.splice(idx, 1);
    saveData();
    renderAll();
  }
}

function setUnit(u) {
  if (u === state.unit) return;
  // When switching units, convert all stored display weights so numbers remain the same visually
  for (const exName of Object.keys(state.exercises)) {
    for (const s of state.exercises[exName]) {
      const kg = state.unit === "kg" ? s.weightDisplay : lbToKg(s.weightDisplay);
      s.weightDisplay = u === "kg" ? kg : kgToLb(kg);
    }
  }
  state.unit = u;
  saveData();
  renderAll();
}

// ---------- Backup ----------
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "gym-tracker-backup.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const incoming = JSON.parse(reader.result);
      if (!incoming || !incoming.exercises) throw new Error("Invalid file");
      state = incoming;
      saveData();
      // ensure selection is valid
      currentExercise = Object.keys(state.exercises)[0] || "Bench Press";
      if (!state.exercises[currentExercise]) state.exercises[currentExercise] = [];
      renderAll();
    } catch (e) { alert("Import failed: " + e.message); }
  };
  reader.readAsText(file);
}

// ---------- Events ----------
document.addEventListener("DOMContentLoaded", () => {
  // Defaults
  unitToggle.value = state.unit;
  dateInput.value = todayISO();

  renderAll();

  addExerciseBtn.addEventListener("click", addExercise);
  deleteExerciseBtn.addEventListener("click", deleteExercise);
  exerciseSelect.addEventListener("change", (e) => {
    currentExercise = e.target.value; renderAll();
  });
  unitToggle.addEventListener("change", (e) => setUnit(e.target.value));
  addSetBtn.addEventListener("click", addSet);

  historyTableBody.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-del]");
    if (btn) deleteSet(btn.getAttribute("data-del"));
  });

  exportBtn.addEventListener("click", exportData);
  importFile.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) importData(e.target.files[0]);
    e.target.value = "";
  });
});
