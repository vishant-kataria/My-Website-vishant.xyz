import { neon } from 'https://esm.sh/@neondatabase/serverless@0.10.4';

const sql = neon('postgresql://neondb_owner:npg_cIa6wvDeZfA2@ep-lingering-fog-aoadhkns-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function loadProject(id) {
  try {
    const rows = await sql`SELECT * FROM projects WHERE id = ${id}`;
    return rows[0];
  } catch (err) {
    console.error('Failed to load project:', err);
    return null;
  }
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    document.getElementById('loading').textContent = 'Error: No project ID provided.';
    return;
  }

  const project = await loadProject(Number(id));
  
  if (!project) {
    document.getElementById('loading').textContent = 'Error: Project not found.';
    return;
  }

  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').style.display = 'block';

  document.getElementById('proj-name').textContent = project.name;

  const rawDriveLink = project.drive_link || "";
  const folderName = project.project_path || "my-project";

  // Extract file ID from any Google Drive URL format
  function getDriveFileId(url) {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  const fileId = getDriveFileId(rawDriveLink);
  const directLink = fileId
    ? `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`
    : rawDriveLink;

  const cmd1 = `$dir='C:\\vishants_projects\\${folderName}'; $tmp="$dir\\_tmp"; New-Item -ItemType Directory -Force -Path $tmp | Out-Null; curl.exe -L -o "$tmp\\project.zip" "${directLink}"; Expand-Archive "$tmp\\project.zip" -DestinationPath $tmp -Force; $inner=Get-ChildItem $tmp -Directory | Select-Object -First 1; if($inner){ Move-Item "$($inner.FullName)\\*" $dir -Force }; Remove-Item $tmp -Recurse -Force; cd $dir`;
  const cmd2 = `cd C:\\vishants_projects\\${folderName}; Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force; if(-not(Get-Command npm -ErrorAction SilentlyContinue)){ Write-Host 'npm not found, installing Node.js...' -ForegroundColor Yellow; winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements; $env:PATH=[System.Environment]::GetEnvironmentVariable('PATH','Machine')+';'+[System.Environment]::GetEnvironmentVariable('PATH','User') }; npm install`;
  const cmd3 = `cd C:\\vishants_projects\\${folderName}; ${project.start_cmd || "npm start"}`;

  // Pill click → copy
  function setupPill(pillId, command, originalText) {
    const pill = document.getElementById(pillId);
    pill.addEventListener('click', () => {
      navigator.clipboard.writeText(command).then(() => {
        pill.innerHTML = '✅ Copied!';
        pill.classList.add('copied');
        setTimeout(() => {
          pill.innerHTML = originalText;
          pill.classList.remove('copied');
        }, 1500);
      });
    });
  }

  setupPill('pill-1', cmd1, '📥 Command 1<span class="pill-label">one-time download</span>');
  setupPill('pill-2', cmd2, '📦 Command 2<span class="pill-label">install stuff</span>');
  setupPill('pill-3', cmd3, '🚀 Command 3<span class="pill-label">launch it</span>');

  // Open website in same tab
  document.getElementById('open-website-btn').addEventListener('click', () => {
    if (project.local_url) {
      window.location.href = project.local_url;
    } else {
      alert('No local link is set for this project.');
    }
  });
}

// Theme toggle
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
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

themeToggle.addEventListener("click", () => {
  const current = document.body.classList.contains("dark") ? "dark" : "light";
  applyTheme(current === "dark" ? "light" : "dark");
});

applyTheme(getPreferredTheme());
init();
