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

let state = loadData();
let currentExercise = Object.keys(state.exercises)[0] || "Bench Press";
if (!state.exercises[currentExercise]) state.exercises[currentExercise] = [];

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
const chartCanvas = document.getElementById("progressChart");

let chart;

function todayISO() { return new Date().toISOString().slice(0,10); }
function toNumber(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function round1(n) { return Math.round(n * 10)/10; }
function kgToLb(kg) { return kg*2.2046226218; }
function lbToKg(lb) { return lb/2.2046226218; }

function displayToKg(w) { return state.unit==="kg"?w:lbToKg(w); }
function kgToDisplay(w) { return state.unit==="kg"?w:kgToLb(w); }
function formatWeight(w) { return `${round1(kgToDisplay(w))} ${state.unit}`; }

function renderExercise
