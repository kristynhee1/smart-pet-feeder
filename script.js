// ----- Settings -----
const FOOD_MAX = 500, WATER_MAX = 2000;      // container size (g / ml)
const FOOD_PORTION = 100, WATER_PORTION = 250;
const FOOD_EVERY = 5, WATER_EVERY = 2;       // hours between scheduled dispenses
const REGULAR_FROM_HOUR = 9;                 // before this hour: half food portion

// ----- State variables -----
// state is one of: Ready, DispensingFood, DispensingWater, NeedsAttention, Paused
let state = "Ready";
let clock = 6;                // hours since midnight of day 1 (keeps counting past 24)
let foodLevel = FOOD_MAX;
let waterLevel = WATER_MAX;
let lastFed = clock;          // clock value at last food dispense
let lastWatered = clock;      // clock value at last water dispense
let attentionReason = "";
let autoTimer = null;

const $ = id => document.getElementById(id);

// ----- Helpers -----
function hourOfDay() { return clock % 24; }
function pad(n) { return String(n).padStart(2, "0"); }
function timeText(c) { return pad(c % 24) + ":00" + (c >= 24 ? " (day " + (Math.floor(c / 24) + 1) + ")" : ""); }

function foodPortionNow() {
  if (hourOfDay() < REGULAR_FROM_HOUR) { return FOOD_PORTION / 2; }
  else { return FOOD_PORTION; }
}

function log(text) {
  const li = document.createElement("li");
  li.textContent = timeText(clock) + "  " + text;
  $("log").prepend(li);
}

function setState(newState, why) {
  log(state + " → " + newState + (why ? " (" + why + ")" : ""));
  state = newState;
  render();
}

// ----- Core behavior -----
function dispense(kind, source) {
  const isFood = kind === "food";
  const portion = isFood ? foodPortionNow() : WATER_PORTION;
  const level = isFood ? foodLevel : waterLevel;

  // Guard: problems send us to NeedsAttention instead of dispensing
  if ($("blockedBox").checked) {
    attentionReason = (isFood ? "Food" : "Water") + " dispenser blocked. Phone alert sent.";
    setState("NeedsAttention", "dispenser blocked");
    return;
  }
  if (level < portion) {
    attentionReason = (isFood ? "Food" : "Water") + " container empty. Phone alert sent.";
    setState("NeedsAttention", "container empty");
    return;
  }

  if (isFood) { foodLevel -= portion; } else { waterLevel -= portion; }
  $("message").textContent = (source === "Schedule" ? "Scheduled " : "Manual ") + kind + ": " + portion + (isFood ? " g" : " ml") + ".";
  setState(isFood ? "DispensingFood" : "DispensingWater", source);

  // After a short pause, the portion is done and we return to Ready
  setTimeout(function () {
    if (isFood) { lastFed = clock; } else { lastWatered = clock; }
    setState("Ready", "portion dispensed");
    checkSchedule();   // catches up if the other schedule is also due
  }, 900);
}

function checkSchedule() {
  if (state !== "Ready") { return; }   // schedule only runs from Ready
  if (clock - lastFed >= FOOD_EVERY) { dispense("food", "Schedule"); }
  else if (clock - lastWatered >= WATER_EVERY) { dispense("water", "Schedule"); }
}

function advanceHour() {
  clock += 1;
  render();
  checkSchedule();
}

// ----- Events: each button changes state through a function -----
$("feedBtn").addEventListener("click", function () { if (state === "Ready") { dispense("food", "User"); } });
$("waterBtn").addEventListener("click", function () { if (state === "Ready") { dispense("water", "User"); } });

$("pauseBtn").addEventListener("click", function () {
  if (state === "Ready") { $("message").textContent = "Automatic schedule paused."; setState("Paused", "user pauses"); }
});
$("resumeBtn").addEventListener("click", function () {
  if (state === "Paused") {
    $("message").textContent = "Schedule resumed.";
    setState("Ready", "user resumes");
    checkSchedule();   // anything missed while paused is dispensed now
  }
});

$("refillBtn").addEventListener("click", function () {
  if (state === "NeedsAttention") {
    foodLevel = FOOD_MAX; waterLevel = WATER_MAX;
    $("blockedBox").checked = false;
    $("message").textContent = "Refilled and cleared.";
    setState("Ready", "refilled or problem cleared");
    checkSchedule();
  }
});

$("hourBtn").addEventListener("click", advanceHour);
$("autoBtn").addEventListener("click", function () {
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null; $("autoBtn").textContent = "Auto-run time: off"; }
  else { autoTimer = setInterval(advanceHour, 2500); $("autoBtn").textContent = "Auto-run time: on"; }
});

// ----- Visual feedback -----
function render() {
  $("badge").textContent = state;
  $("badge").dataset.state = state;
  if (state === "NeedsAttention") { $("message").textContent = attentionReason; }
  else if (state === "Ready" && $("message").textContent === "") { $("message").textContent = "Waiting for a schedule or a command."; }

  $("clock").textContent = timeText(clock);
  $("foodFill").style.width = (foodLevel / FOOD_MAX * 100) + "%";
  $("waterFill").style.width = (waterLevel / WATER_MAX * 100) + "%";
  $("foodText").textContent = foodLevel + " g left · next portion " + foodPortionNow() + " g";
  $("waterText").textContent = waterLevel + " ml left · next portion " + WATER_PORTION + " ml";
  $("lastFedText").textContent = "Last fed: " + timeText(lastFed);
  $("lastWaterText").textContent = "Last watered: " + timeText(lastWatered);

  // Only offer actions that are legal in the current state
  $("feedBtn").disabled = state !== "Ready";
  $("waterBtn").disabled = state !== "Ready";
  $("pauseBtn").disabled = state !== "Ready";
  $("resumeBtn").disabled = state !== "Paused";
  $("refillBtn").disabled = state !== "NeedsAttention";
}

render();
log("Feeder started in Ready");
