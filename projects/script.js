import { neon } from 'https://esm.sh/@neondatabase/serverless@0.10.4';

// ── Database ─────────────────────────────────────────

const sql = neon('postgresql://neondb_owner:npg_cIa6wvDeZfA2@ep-lingering-fog-aoadhkns-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function loadProjects() {
  try {
    const rows = await sql`SELECT * FROM projects ORDER BY id ASC`;
    return rows;
  } catch (err) {
    console.error('Failed to load projects:', err);
    return [];
  }
}

async function addProject(data) {
  try {
    await sql`
      INSERT INTO projects (type, name, local_url, deployed_url, project_path, start_cmd, drive_link)
      VALUES (${data.type}, ${data.name}, ${data.localUrl}, ${data.deployedUrl}, ${data.projectPath}, ${data.startCmd}, ${data.driveLink})
    `;
  } catch (err) {
    console.error('Failed to add project:', err);
  }
}

async function updateProject(id, data) {
  try {
    await sql`
      UPDATE projects
      SET type = ${data.type}, name = ${data.name}, local_url = ${data.localUrl},
          deployed_url = ${data.deployedUrl}, project_path = ${data.projectPath}, start_cmd = ${data.startCmd}, drive_link = ${data.driveLink}
      WHERE id = ${id}
    `;
  } catch (err) {
    console.error('Failed to update project:', err);
  }
}

async function deleteProject(id) {
  try {
    await sql`DELETE FROM projects WHERE id = ${id}`;
  } catch (err) {
    console.error('Failed to delete project:', err);
  }
}

// ── DOM refs ─────────────────────────────────────────

const list = document.getElementById("project-list");
const emptyState = document.getElementById("empty-state");
const loadingState = document.getElementById("loading-state");
const modalOverlay = document.getElementById("modal-overlay");
const modalTitle = document.getElementById("modal-title");
const form = document.getElementById("project-form");
const addBtn = document.getElementById("add-btn");
const cancelBtn = document.getElementById("cancel-btn");
const modalCloseBtn = document.getElementById("modal-close");

const inputType = document.getElementById("input-type");
const inputName = document.getElementById("input-name");
const inputLocal = document.getElementById("input-local");
const inputDeployed = document.getElementById("input-deployed");
const inputPath = document.getElementById("input-path");
const inputCmd = document.getElementById("input-cmd");
const inputDrive = document.getElementById("input-drive");

const typeToggle = document.getElementById("type-toggle");
const localFields = document.getElementById("local-fields");
const deployedFields = document.getElementById("deployed-fields");

let editingId = null;

// ── Type toggle ──────────────────────────────────────

function setFormType(type) {
  inputType.value = type;
  typeToggle.querySelectorAll(".type-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.type === type);
  });
  if (type === "local") {
    localFields.style.display = "";
    deployedFields.style.display = "none";
  } else {
    localFields.style.display = "none";
    deployedFields.style.display = "";
  }
}

typeToggle.addEventListener("click", (e) => {
  const btn = e.target.closest(".type-btn");
  if (btn) setFormType(btn.dataset.type);
});

// ── Render ───────────────────────────────────────────

async function render() {
  const projects = await loadProjects();
  list.innerHTML = "";
  loadingState.style.display = "none";

  if (projects.length === 0) {
    list.style.display = "none";
    emptyState.style.display = "block";
    return;
  }

  list.style.display = "";
  emptyState.style.display = "none";

  projects.forEach((p, index) => {
    const row = document.createElement("div");
    row.className = "project-row";

    const isLocal = p.type === "local";
    const link = isLocal ? `local_instructions.html?id=${p.id}` : (p.deployed_url || "");

    if (link) {
      row.style.cursor = "pointer";
      row.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        window.open(link, "_blank", "noopener");
      });
    }

    row.innerHTML = `
      <span class="row-number">${index + 1}.</span>
      <span class="row-name">${esc(p.name)}</span>
      <div class="row-right">
        <button class="edit-btn" data-id="${p.id}" title="Edit">✎</button>
        <button class="delete-btn" data-id="${p.id}" title="Delete">✕</button>
      </div>
    `;

    list.appendChild(row);
  });
}

function esc(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

// ── Copy helper ──────────────────────────────────────

function copyToClipboard(text, btnEl) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    const original = btnEl.innerHTML;
    btnEl.textContent = "✓ Copied!";
    btnEl.classList.add("copied");
    setTimeout(() => {
      btnEl.innerHTML = original;
      btnEl.classList.remove("copied");
    }, 1200);
  });
}

// ── Modal helpers ────────────────────────────────────

function openModal(project) {
  if (project) {
    editingId = project.id;
    modalTitle.textContent = "Edit Project";
    setFormType(project.type || "local");
    inputName.value = project.name;
    inputLocal.value = project.local_url || "";
    inputDeployed.value = project.deployed_url || "";
    inputPath.value = project.project_path || "";
    inputCmd.value = project.start_cmd || "";
    inputDrive.value = project.drive_link || "";
  } else {
    editingId = null;
    modalTitle.textContent = "Add Project";
    form.reset();
    setFormType("local");
  }
  modalOverlay.style.display = "flex";
  inputName.focus();
}

function closeModal() {
  modalOverlay.style.display = "none";
  form.reset();
  editingId = null;
}

// ── Event listeners ──────────────────────────────────

addBtn.addEventListener("click", () => openModal(null));
cancelBtn.addEventListener("click", closeModal);
modalCloseBtn.addEventListener("click", closeModal);

modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalOverlay.style.display === "flex") closeModal();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const type = inputType.value;

  const data = {
    type,
    name: inputName.value.trim(),
    localUrl: "",
    deployedUrl: "",
    projectPath: "",
    startCmd: "",
    driveLink: "",
  };

  if (type === "local") {
    data.localUrl = inputLocal.value.trim();
    data.projectPath = inputPath.value.trim();
    data.startCmd = inputCmd.value.trim();
    data.driveLink = inputDrive.value.trim();
  } else {
    data.deployedUrl = inputDeployed.value.trim();
  }

  if (editingId) {
    await updateProject(editingId, data);
  } else {
    await addProject(data);
  }

  closeModal();
  await render();
});

list.addEventListener("click", async (e) => {
  const cmdBtn = e.target.closest(".cmd-btn");
  if (cmdBtn) {
    e.stopPropagation();
    copyToClipboard(cmdBtn.dataset.copy, cmdBtn);
    return;
  }

  const id = e.target.dataset.id;
  if (!id) return;

  if (e.target.classList.contains("edit-btn")) {
    e.stopPropagation();
    const projects = await loadProjects();
    const project = projects.find((p) => String(p.id) === id);
    if (project) openModal(project);
  }

  if (e.target.classList.contains("delete-btn")) {
    e.stopPropagation();
    if (!confirm("Delete this project?")) return;
    await deleteProject(Number(id));
    await render();
  }
});

// ── Theme toggle ─────────────────────────────────────

const THEME_KEY = "theme_preference";
const themeToggle = document.getElementById("theme-toggle");

function applyTheme(theme) {
  if (theme === "dark") {
    document.body.classList.add("dark");
    themeToggle.textContent = "☀️ Light";
  } else {
    document.body.classList.remove("dark");
    themeToggle.textContent = "🌙 Dark";
  }
  localStorage.setItem(THEME_KEY, theme);
}

function getPreferredTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

themeToggle.addEventListener("click", () => {
  const current = document.body.classList.contains("dark") ? "dark" : "light";
  applyTheme(current === "dark" ? "light" : "dark");
});

// ── Init ─────────────────────────────────────────────

applyTheme(getPreferredTheme());
render();
