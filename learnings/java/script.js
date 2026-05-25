// script.js

// --- Neon Database Configuration ---
const NEON_URL = "https://ep-twilight-silence-aoldtn59-pooler.c-2.ap-southeast-1.aws.neon.tech/sql";
const NEON_CONN = "postgresql://neondb_owner:npg_Efu38ChnpPbm@ep-twilight-silence-aoldtn59-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

// --- Chart.js Loader ---
function ensureChartJsLoaded(callback) {
  if (window.Chart) {
    callback();
    return;
  }
  // Check if script is already loading
  if (window._chartJsLoading) {
    window._chartJsLoading.push(callback);
    return;
  }
  window._chartJsLoading = [callback];
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/chart.js";
  script.onload = function () {
    window._chartJsLoading.forEach((cb) => cb());
    window._chartJsLoading = null;
  };
  script.onerror = function () {
    alert("Failed to load Chart.js. Graphs will not display.");
    window._chartJsLoading = null;
  };
  document.head.appendChild(script);
}

// Helper to get date from day number
function getDateFromDay(dayNum) {
  const base = new Date("2025-06-19");
  base.setDate(base.getDate() + (parseInt(dayNum, 10) - 1));
  return base;
}

// Helper to format date as "22 June 2025"
function formatDate(date) {
  const options = { day: "numeric", month: "long", year: "numeric" };
  return date.toLocaleDateString("en-GB", options);
}

// Generate day suggestions up to today
function getDaySuggestions() {
  const today = new Date();
  const base = new Date("2025-06-19");
  const days = Math.floor((today - base) / (1000 * 60 * 60 * 24)) + 1;
  return Array.from({ length: days }, (_, i) => (i + 1).toString());
}

// Update datalist for day suggestions (numbers only)
function updateDaySuggestions() {
  const datalist = document.getElementById("day-suggestions");
  datalist.innerHTML = "";
  getDaySuggestions().forEach((day) => {
    const option = document.createElement("option");
    option.value = day;
    datalist.appendChild(option);
  });
}

// Call once on load
updateDaySuggestions();

// Load list from Firestore or generate fresh
let entries = [];

// Build a map for quick lookup and merging
const entryMap = {};
function buildEntryMapAndFill() {
  entries.forEach((entry) => {
    const key = entry.date.trim().toLowerCase();
    if (!entryMap[key]) {
      entryMap[key] = { date: entry.date, drinks: [], weights: [] };
    }
    entryMap[key].drinks = entryMap[key].drinks.concat(entry.drinks || []);
    entryMap[key].weights = entryMap[key].weights.concat(entry.weights || []);
  });

  // Always start from 19 June 2025
  let startDate = new Date("2025-06-19");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Ensure one entry per date from startDate to today
  let tempDate = new Date(startDate);
  while (tempDate <= today) {
    const dateStr = formatDate(tempDate);
    const key = dateStr.toLowerCase();
    if (!entryMap[key]) {
      entryMap[key] = { date: dateStr, drinks: [] };
    }
    tempDate.setDate(tempDate.getDate() + 1);
  }
  entries = Object.values(entryMap);

  // Remove any entries with a date after today
  entries = entries.filter((entry) => {
    // Parse the entry date
    const entryDate = new Date(entry.date);
    // Only keep entries up to today
    return entryDate <= today;
  });
}

// --- Initialize Neon DB ---
async function initNeonDb() {
  try {
    await fetch(NEON_URL, {
      method: "POST",
      headers: {
        "Neon-Connection-String": NEON_CONN
      },
      body: JSON.stringify({
        query: "CREATE TABLE IF NOT EXISTS app_state (id VARCHAR(255) PRIMARY KEY, data JSONB NOT NULL)"
      })
    });
  } catch (e) {
    console.error("Error initializing DB:", e);
  }
}

// --- Load entries from Neon ---
async function loadEntries() {
  try {
    const res = await fetch(NEON_URL, {
      method: "POST",
      headers: {
        "Neon-Connection-String": NEON_CONN
      },
      body: JSON.stringify({
        query: "SELECT data FROM app_state WHERE id = 'default'"
      })
    });
    const result = await res.json();
    if (result && result.rows && result.rows.length > 0) {
      const rowData = result.rows[0].data;
      const parsedData = typeof rowData === "string" ? JSON.parse(rowData) : rowData;
      entries = parsedData.waterList || [];
    } else {
      entries = [];
    }
    buildEntryMapAndFill();
    renderList();
  } catch (err) {
    console.error("Error loading from Neon:", err);
    entries = [];
    buildEntryMapAndFill();
    renderList();
  }
}

// --- Save entries to Neon ---
async function saveEntries() {
  try {
    const dataObj = { waterList: entries };
    const jsonStr = JSON.stringify(dataObj).replace(/'/g, "''");
    
    await fetch(NEON_URL, {
      method: "POST",
      headers: {
        "Neon-Connection-String": NEON_CONN
      },
      body: JSON.stringify({
        query: `INSERT INTO app_state (id, data) VALUES ('default', '${jsonStr}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`
      })
    });
  } catch (err) {
    console.error("Error saving to Neon:", err);
  }
}

// Initialize and Load entries on page load
initNeonDb().then(() => loadEntries());

const olList = document.querySelector("ol");
function renderList() {
  olList.innerHTML = "";
  entries
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach((entry) => {
      let text = `completed`;
      if (entry.drinks && entry.drinks.length > 0) {
        text +=
          ", " + entry.drinks.map((d) => `${d} liter of water`).join(", ");
      }
      if (entry.weights && entry.weights.length > 0) {
        text +=
          ", " +
          entry.weights
            .map(
              (w) => `${w.toUpperCase().endsWith("KG") ? w : w + "KG"} weight`
            )
            .join(", ");
      }
      text += ` (${entry.date})`;
      const li = document.createElement("li");
      li.textContent = text;
      olList.appendChild(li);
    });
}
renderList();

// Ensure addContainer exists and is after the <ol>
let addContainer = document.getElementById("add-container");
if (!addContainer) {
  addContainer = document.createElement("div");
  addContainer.id = "add-container";
  addContainer.style.textAlign = "right";
  addContainer.style.marginTop = "1em";
  // Place addContainer after the <ol>
  if (olList && olList.parentNode) {
    olList.parentNode.insertBefore(addContainer, olList.nextSibling);
  } else {
    document.body.appendChild(addContainer);
  }
}

// --- Add Button and Form ---
let addBtn = document.getElementById("add-btn");
if (!addBtn) {
  addBtn = document.createElement("button");
  addBtn.id = "add-btn";
  addBtn.type = "button";
  addContainer.appendChild(addBtn);
}
addBtn.textContent = "Add"; // Always set to 'Add'

let addForm = document.getElementById("add-form");
if (!addForm) {
  addForm = document.createElement("form");
  addForm.id = "add-form";
  addForm.style.display = "none";
  addForm.style.marginTop = "1em";
  addForm.innerHTML = `
    <input type="text" id="day-input" placeholder="Type day number e.g. 22" list="day-suggestions" required />
    <input type="text" id="water-input" placeholder="Add water drink" />
    <button type="submit">Submit</button>
  `;
  addContainer.appendChild(addForm);
}

// --- Add Weight Button and Form ---
let addWeightBtn = document.getElementById("add-weight-btn");
let addWeightForm = document.getElementById("add-weight-form");
if (!addWeightBtn) {
  addWeightBtn = document.createElement("button");
  addWeightBtn.id = "add-weight-btn";
  addWeightBtn.type = "button";
  addContainer.appendChild(addWeightBtn);
}
addWeightBtn.textContent = "Add"; // Always set to 'Add'
if (!addWeightForm) {
  addWeightForm = document.createElement("form");
  addWeightForm.id = "add-weight-form";
  addWeightForm.style.display = "none";
  addWeightForm.style.marginTop = "1em";
  addWeightForm.innerHTML = `
    <input type="text" id="add-weight-day-input" placeholder="Type day number e.g. 22" list="day-suggestions" required />
    <input type="text" id="add-weight-input" placeholder="Add weight (e.g. 70kg)" required />
    <button type="submit">Submit</button>
  `;
  addContainer.appendChild(addWeightForm);
}

// --- Add Clear Button and Form ---
let clearBtn = document.getElementById("clear-btn");
let clearForm = document.getElementById("clear-form");
if (!clearBtn) {
  clearBtn = document.createElement("button");
  clearBtn.id = "clear-btn";
  clearBtn.type = "button";
  clearBtn.textContent = "Clear";
  addContainer.appendChild(clearBtn);
}
if (!clearForm) {
  clearForm = document.createElement("form");
  clearForm.id = "clear-form";
  clearForm.style.display = "none";
  clearForm.style.marginTop = "1em";
  clearForm.innerHTML = `
    <input type="text" id="clear-day-input" placeholder="Type day number e.g. 22" list="day-suggestions" required />
    <button type="submit">Submit</button>
  `;
  addContainer.appendChild(clearForm);
}

// --- Add Clear Weight Button and Form ---
let clearWeightBtn = document.getElementById("clear-weight-btn");
let clearWeightForm = document.getElementById("clear-weight-form");
if (!clearWeightBtn) {
  clearWeightBtn = document.createElement("button");
  clearWeightBtn.id = "clear-weight-btn";
  clearWeightBtn.type = "button";
  addContainer.appendChild(clearWeightBtn);
}
clearWeightBtn.textContent = "Clear"; // Always set to 'Clear'
if (!clearWeightForm) {
  clearWeightForm = document.createElement("form");
  clearWeightForm.id = "clear-weight-form";
  clearWeightForm.style.display = "none";
  clearWeightForm.style.marginTop = "1em";
  clearWeightForm.innerHTML = `
    <input type="text" id="clear-weight-day-input" placeholder="Type day number e.g. 22" list="day-suggestions" required />
    <button type="submit">Submit</button>
  `;
  addContainer.appendChild(clearWeightForm);
}

// --- Add Graph Canvas (after addContainer) ---
let graphContainer = document.getElementById("graph-container");
if (!graphContainer) {
  graphContainer = document.createElement("div");
  graphContainer.id = "graph-container";
  graphContainer.style.marginTop = "2em";
  graphContainer.style.width = "100vw";
  graphContainer.style.height = "100vh";
  graphContainer.style.position = "fixed";
  graphContainer.style.top = "0";
  graphContainer.style.left = "0";
  graphContainer.style.background = "#000"; // Set to black
  graphContainer.style.zIndex = "9999";
  graphContainer.style.display = "none"; // Hidden by default
  graphContainer.style.paddingRight = "0"; // Remove right padding
  graphContainer.innerHTML = `<button id="close-graph-btn" style="position:absolute;top:10px;right:10px;z-index:10000;font-size:2.5em;padding:0.5em 0.8em;line-height:1;">×</button><canvas id="weight-graph" style="display:block;position:absolute;top:0;left:0;width:100vw;height:100vh;box-sizing:border-box;"></canvas>`;
  document.body.appendChild(graphContainer);
  // Attach close button event listener
  const closeBtn = document.getElementById("close-graph-btn");
  if (closeBtn) {
    closeBtn.onclick = function () {
      // Exit fullscreen if active
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else if (document.webkitFullscreenElement) {
        document.webkitExitFullscreen();
      } else if (document.msFullscreenElement) {
        document.msExitFullscreen();
      }
      // Restore scrollbars (in case not handled by event)
      document.body.style.overflow = "";
      // Hide graph (in case not handled by event)
      graphContainer.style.display = "none";
    };
  }
}

// --- Add Graph Preview Canvas (below addContainer, above Show Full Graph button) ---
let previewContainer = document.getElementById("preview-graph-container");
if (!previewContainer) {
  previewContainer = document.createElement("div");
  previewContainer.id = "preview-graph-container";
  previewContainer.style.width = "100%";
  previewContainer.style.maxWidth = "400px";
  previewContainer.style.margin = "1em auto";
  previewContainer.innerHTML = `<canvas id="preview-weight-graph" width="400" height="120" style="display:block;"></canvas>`;
  // Insert previewContainer after addContainer
  addContainer.parentNode.insertBefore(
    previewContainer,
    addContainer.nextSibling
  );
}
// Always render preview graph after preview container is created
setTimeout(renderPreviewGraph, 0);

// --- Show/Hide Graph Button (below preview) ---
let showGraphBtn = document.getElementById("show-graph-btn");
if (!showGraphBtn) {
  showGraphBtn = document.createElement("button");
  showGraphBtn.id = "show-graph-btn";
  showGraphBtn.textContent = "Show Full Graph";
  showGraphBtn.style.margin = "1em 0";
  previewContainer.appendChild(showGraphBtn);
  showGraphBtn.onclick = function () {
    graphContainer.style.display = "block";
    renderWeightGraph();
    // Hide scrollbars
    document.body.style.overflow = "hidden";
    // Request fullscreen for the graph container
    if (graphContainer.requestFullscreen) {
      graphContainer.requestFullscreen();
    } else if (graphContainer.webkitRequestFullscreen) {
      graphContainer.webkitRequestFullscreen();
    } else if (graphContainer.msRequestFullscreen) {
      graphContainer.msRequestFullscreen();
    }
  };
}

// --- Fullscreen change event to restore scrollbars and hide graph ---
document.addEventListener("fullscreenchange", function () {
  if (!document.fullscreenElement) {
    // Exited fullscreen: restore scrollbars and hide graph
    document.body.style.overflow = "";
    graphContainer.style.display = "none";
  }
});

// --- Render Preview Graph ---
let previewChartInstance = null;
function renderPreviewGraph() {
  ensureChartJsLoaded(() => {
    try {
      const canvas = document.getElementById("preview-weight-graph");
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (previewChartInstance) previewChartInstance.destroy();
      // Prepare data (same as full graph)
      const sorted = entries
        .slice()
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      const labels = sorted.map((e) => e.date);
      const weightData = sorted.map((e) => {
        if (e.weights && e.weights.length > 0) {
          for (let i = e.weights.length - 1; i >= 0; i--) {
            const w = e.weights[i].toUpperCase().replace("KG", "").trim();
            const num = parseFloat(w);
            if (!isNaN(num)) return num;
          }
        }
        return null;
      });
      previewChartInstance = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Weight (kg)",
              data: weightData,
              borderColor: "rgba(255, 99, 132, 1)",
              backgroundColor: "rgba(255, 99, 132, 0.1)",
              spanGaps: true, // Connect all points for a linear graph
              tension: 0.2,
              pointRadius: 0, // No dots
              pointHoverRadius: 0, // No hover dots
              hitRadius: 12, // Easier to hover/click
              hoverRadius: 10,
            },
          ],
        },
        options: {
          responsive: false,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: { display: false },
          },
          scales: {
            x: {
              display: true,
              title: { display: true, text: "Date", font: { size: 10 } },
              grid: {
                display: true,
                drawBorder: true,
                color: "#bbb",
                lineWidth: 1,
              },
              ticks: {
                display: true,
                font: { size: 8 },
                maxTicksLimit: 6,
                autoSkip: true,
                callback: function (value, index, values) {
                  // Show only a few dates for readability
                  const label = this.getLabelForValue(value);
                  return label.split(" ")[0]; // Show only day number
                },
              },
            },
            y: {
              display: true,
              title: { display: true, text: "Weight (kg)", font: { size: 10 } },
              grid: {
                display: true,
                drawBorder: true,
                color: "#bbb",
                lineWidth: 1,
              },
              beginAtZero: false,
              min: 100,
              ticks: {
                display: true,
                font: { size: 8 },
                maxTicksLimit: 4,
                autoSkip: true,
              },
            },
          },
          layout: {
            padding: 0,
          },
          animation: false,
        },
      });
    } catch (err) {
      console.error("Error in renderPreviewGraph:", err);
    }
  });
}

// --- Render Weight Graph (fullscreen) ---
let weightChartInstance = null;
function renderWeightGraph() {
  ensureChartJsLoaded(() => {
    try {
      const canvas = document.getElementById("weight-graph");
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (weightChartInstance) weightChartInstance.destroy();
      // Set canvas size to fill viewport (and style to match for correct hit detection)
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      // Prepare data: one point per day, use last weight for the day if available
      const sorted = entries
        .slice()
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      const labels = sorted.map((e) => e.date);
      const weightData = sorted.map((e) => {
        if (e.weights && e.weights.length > 0) {
          for (let i = e.weights.length - 1; i >= 0; i--) {
            const w = e.weights[i].toUpperCase().replace("KG", "").trim();
            const num = parseFloat(w);
            if (!isNaN(num)) return num;
          }
        }
        return null;
      });
      // Check if there is at least one valid data point
      if (!weightData.some((v) => typeof v === "number" && !isNaN(v))) {
        // Clear canvas and show message
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = "bold 2em sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          "No weight data to display",
          canvas.width / 2,
          canvas.height / 2
        );
        return;
      }
      weightChartInstance = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Weight (kg)",
              data: weightData,
              borderColor: "rgba(255, 99, 132, 1)",
              backgroundColor: "rgba(255, 99, 132, 0.2)",
              spanGaps: true, // Connect all points for a linear graph
              tension: 0.2,
              pointRadius: 8, // Larger dots
              pointHoverRadius: 14, // Larger on hover
              pointBackgroundColor: "rgba(255, 99, 132, 1)",
              pointBorderColor: "#fff",
              pointBorderWidth: 3,
              hitRadius: 16, // Easier to hover/click
              hoverRadius: 14,
              clip: false, // Do not clip dots at the edge
            },
          ],
        },
        options: {
          responsive: false,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top" },
            title: { display: true, text: "Weight Progress Over Time" },
            beforeDraw: function (chart) {
              const ctx = chart.ctx;
              ctx.save();
              ctx.globalCompositeOperation = "destination-over";
              ctx.fillStyle = "#000";
              ctx.fillRect(0, 0, chart.width, chart.height);
              ctx.restore();
            },
          },
          scales: {
            x: {
              title: { display: true, text: "Date" },
              grid: {
                display: true,
                drawBorder: true,
                color: "#888",
                lineWidth: 1,
              },
              ticks: { autoSkip: true, maxTicksLimit: 20 },
              alignToPixels: true,
              offset: false,
            },
            y: {
              title: { display: true, text: "Weight (kg)" },
              grid: {
                display: true,
                drawBorder: true,
                color: "#888",
                lineWidth: 1,
              },
              beginAtZero: false,
              min: 100,
              offset: false,
            },
          },
          layout: {
            padding: { top: 32, right: 32, bottom: 0, left: 32 },
          },
        },
        plugins: [
          {
            // Chart.js v3+ plugin for black background
            id: "custom-bg",
            beforeDraw: (chart) => {
              const ctx = chart.ctx;
              ctx.save();
              ctx.globalCompositeOperation = "destination-over";
              ctx.fillStyle = "#000";
              ctx.fillRect(0, 0, chart.width, chart.height);
              ctx.restore();
            },
          },
        ],
      });
    } catch (err) {
      console.error("Error in renderWeightGraph:", err);
    }
  });
}

// --- Call renderWeightGraph and renderPreviewGraph after every data change ---
const oldRenderList = renderList;
renderList = function () {
  oldRenderList();
  setTimeout(renderPreviewGraph, 0);
};
setTimeout(renderPreviewGraph, 0);

// --- Remove dynamic waterGroup/weightGroup creation and moving of controls ---
// --- Only keep the original add/clear/add weight/clear weight logic ---
// (No waterGroup/weightGroup, no moving of controls, no flex layout for addContainer)
// (Keep original logic for controls so your paragraph and content remain visible and nothing is hidden or moved)

// --- Style Buttons for Size and Spacing ---
const allBtns = [addBtn, clearBtn, addWeightBtn, clearWeightBtn];
allBtns.forEach((btn) => {
  if (btn) {
    btn.style.fontSize = "1.2em";
    btn.style.padding = "0.7em 2em";
    btn.style.margin = "0.5em 1em";
    btn.style.borderRadius = "0.5em";
    btn.style.background = "#1976d2";
    btn.style.color = "#fff";
    btn.style.border = "none";
    btn.style.cursor = "pointer";
    btn.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
    btn.onmouseover = function () {
      btn.style.background = "#125ea2";
    };
    btn.onmouseout = function () {
      btn.style.background = "#1976d2";
    };
  }
});
// --- Center forms and add spacing ---
[addForm, clearForm, addWeightForm, clearWeightForm].forEach((form) => {
  if (form) {
    form.style.display = form.style.display || "none";
    form.style.margin = "0.5em auto 1em auto";
    form.style.textAlign = "center";
    form.style.maxWidth = "350px";
  }
});
// --- Make addContainer full width and center groups ---
addContainer.style.width = "100%";
addContainer.style.display = "flex";
addContainer.style.flexDirection = "row";
addContainer.style.justifyContent = "center";
addContainer.style.alignItems = "flex-start";
addContainer.style.gap = "3em";

// Remove the controls heading if present
const controlsHeading = document.getElementById("controls-heading");
if (controlsHeading && controlsHeading.parentNode) {
  controlsHeading.parentNode.removeChild(controlsHeading);
}

// --- Group Water and Weight Controls Side by Side ---
addContainer.innerHTML = ""; // Clear previous content

// Create water group
const waterGroup = document.createElement("div");
waterGroup.className = "water-group";
waterGroup.style.display = "flex";
waterGroup.style.flexDirection = "column";
waterGroup.style.alignItems = "center";
waterGroup.style.flex = "1";
waterGroup.style.minWidth = "220px";

const waterHeading = document.createElement("h2");
waterHeading.id = "water-heading";
waterHeading.textContent = "Water Intake";
waterHeading.style.textAlign = "center";
waterHeading.style.margin = "0 0 16px 0";
waterHeading.style.background = "aquamarine";
waterHeading.style.border = "4px solid hsl(353, 95%, 48%)";
waterHeading.style.borderRadius = "20px";
waterHeading.style.width = "90%";
waterHeading.style.padding = "10px";
waterHeading.style.fontSize = "1.5em";
waterGroup.appendChild(waterHeading);

// Add bottle icon
const waterBottle = document.createElement("span");
waterBottle.className = "bottle-icon";
waterGroup.appendChild(waterBottle);

// Add button row for Add and Clear
const waterButtonRow = document.createElement("div");
waterButtonRow.className = "button-row";
waterButtonRow.appendChild(addBtn);
waterButtonRow.appendChild(clearBtn);
waterGroup.appendChild(waterButtonRow);

// Add forms below
waterGroup.appendChild(addForm);
waterGroup.appendChild(clearForm);

// Create weight group
const weightGroup = document.createElement("div");
weightGroup.className = "weight-group";
weightGroup.style.display = "flex";
weightGroup.style.flexDirection = "column";
weightGroup.style.alignItems = "center";
weightGroup.style.flex = "1";
weightGroup.style.minWidth = "220px";

const weightHeading = document.createElement("h2");
weightHeading.id = "weight-heading";
weightHeading.textContent = "Weight";
weightHeading.style.textAlign = "center";
weightHeading.style.margin = "0 0 16px 0";
weightHeading.style.background = "aquamarine";
weightHeading.style.border = "4px solid hsl(353, 95%, 48%)";
weightHeading.style.borderRadius = "20px";
weightHeading.style.width = "90%";
weightHeading.style.padding = "10px";
weightHeading.style.fontSize = "1.5em";
weightGroup.appendChild(weightHeading);

// Add bottle icon for weight
const weightBottle = document.createElement("span");
weightBottle.className = "bottle-icon";
weightGroup.appendChild(weightBottle);

// Add button row for Add and Clear
const weightButtonRow = document.createElement("div");
weightButtonRow.className = "button-row";
weightButtonRow.appendChild(addWeightBtn);
weightButtonRow.appendChild(clearWeightBtn);
weightGroup.appendChild(weightButtonRow);

// Add forms below
weightGroup.appendChild(addWeightForm);
weightGroup.appendChild(clearWeightForm);

// Add both groups to addContainer
addContainer.appendChild(waterGroup);
addContainer.appendChild(weightGroup);

// Style addContainer for side-by-side groups
addContainer.style.display = "flex";
addContainer.style.flexDirection = "row";
addContainer.style.justifyContent = "center";
addContainer.style.alignItems = "flex-start";
addContainer.style.gap = "3em";
addContainer.style.width = "100%";

// --- Re-attach event handlers after DOM re-structure ---
// Add Button
addBtn.onclick = function () {
  updateDaySuggestions();
  addForm.style.display =
    addForm.style.display === "none" ? "inline-block" : "none";
};
addForm.onsubmit = async function (e) {
  e.preventDefault();
  const dayNum = document.getElementById("day-input").value.trim();
  const drink = document.getElementById("water-input").value.trim();
  if (drink && dayNum) {
    const dateStr = formatDate(getDateFromDay(dayNum));
    let entry = entries.find((e) => e.date === dateStr);
    if (entry) {
      entry.drinks.push(drink);
    } else {
      entry = { date: dateStr, drinks: [drink], weights: [] };
      entries.push(entry);
      entries.sort((a, b) => new Date(a.date) - new Date(b.date));
    }
    await saveEntries();
    renderList();
    addForm.style.display = "none";
    document.getElementById("water-input").value = "";
    document.getElementById("day-input").value = "";
  }
};
// Add Weight Button
addWeightBtn.onclick = function () {
  updateDaySuggestions();
  addWeightForm.style.display =
    addWeightForm.style.display === "none" ? "inline-block" : "none";
};
addWeightForm.onsubmit = async function (e) {
  e.preventDefault();
  const dayNum = document.getElementById("add-weight-day-input").value.trim();
  const weight = document.getElementById("add-weight-input").value.trim();
  if (weight && dayNum) {
    const dateStr = formatDate(getDateFromDay(dayNum));
    let entry = entries.find((e) => e.date === dateStr);
    if (entry) {
      if (!entry.weights) entry.weights = [];
      entry.weights.push(weight);
    } else {
      entry = { date: dateStr, drinks: [], weights: [weight] };
      entries.push(entry);
      entries.sort((a, b) => new Date(a.date) - new Date(b.date));
    }
    await saveEntries();
    renderList();
    addWeightForm.style.display = "none";
    document.getElementById("add-weight-input").value = "";
    document.getElementById("add-weight-day-input").value = "";
  }
};
// Clear Button
clearBtn.onclick = function () {
  updateDaySuggestions();
  clearForm.style.display =
    clearForm.style.display === "none" ? "inline-block" : "none";
};
clearForm.onsubmit = async function (e) {
  e.preventDefault();
  const dayNum = document.getElementById("clear-day-input").value.trim();
  if (dayNum) {
    const dateStr = formatDate(getDateFromDay(dayNum));
    let entry = entries.find((e) => e.date === dateStr);
    if (entry) {
      entry.drinks = [];
      await saveEntries();
      renderList();
    }
    clearForm.style.display = "none";
    document.getElementById("clear-day-input").value = "";
  }
};
// Clear Weight Button
clearWeightBtn.onclick = function () {
  updateDaySuggestions();
  clearWeightForm.style.display =
    clearWeightForm.style.display === "none" ? "inline-block" : "none";
};
clearWeightForm.onsubmit = async function (e) {
  e.preventDefault();
  const dayNum = document.getElementById("clear-weight-day-input").value.trim();
  if (dayNum) {
    const dateStr = formatDate(getDateFromDay(dayNum));
    let entry = entries.find((e) => e.date === dateStr);
    if (entry && entry.weights) {
      entry.weights = [];
      await saveEntries();
      renderList();
    }
    clearWeightForm.style.display = "none";
    document.getElementById("clear-weight-day-input").value = "";
  }
};
