const statusEl = document.getElementById("status");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const settingsMenu = document.getElementById("settingsMenu");
const accountInfoEl = document.getElementById("accountInfo");
const installBtn = document.getElementById("installBtn");
const authOverlay = document.getElementById("authOverlay");
const addTaskBtn = document.getElementById("addTaskBtn");
const togglePendingBtn = document.getElementById("togglePendingBtn");
const toggleHistoryBtn = document.getElementById("toggleHistoryBtn");
const taskTableBodyEl = document.getElementById("taskTableBody");

let supabaseClient;
let currentUser = null;
let deferredInstallPrompt = null;
let showPending = true;
let showHistory = true;
let allTasks = [];

const SUPABASE_URL = "https://pikgsutwilxhblphynax.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpa2dzdXR3aWx4aGJscGh5bmF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NjY1NDcsImV4cCI6MjA4NzI0MjU0N30.gCPo21F6gpAGokux0CfgR_JDNHBr8vGOtiFdF6mQ4qY";

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#fca5a5" : "#86efac";
}

function setAddTaskEnabled(enabled) {
  if (!addTaskBtn) {
    return;
  }
  addTaskBtn.disabled = !enabled;
}

function resetTaskTable(message) {
  taskTableBodyEl.innerHTML = `<tr><td class="task-empty" colspan="3">${message}</td></tr>`;
}

function applyFilterButtonState() {
  if (togglePendingBtn) {
    togglePendingBtn.setAttribute("aria-pressed", String(showPending));
  }
  if (toggleHistoryBtn) {
    toggleHistoryBtn.setAttribute("aria-pressed", String(showHistory));
  }
}

function formatDate(value) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getDetailsToggleIcon(open) {
  const path = open
    ? "M5 11a1 1 0 0 0 0 2h14a1 1 0 1 0 0-2H5z"
    : "M11 5a1 1 0 1 1 2 0v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6z";
  return `
    <svg
      class="action-icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
    >
      <path fill="currentColor" d="${path}" />
    </svg>
  `;
}

function setDetailsToggleState(button, open) {
  const label = open ? "Masquer les details" : "Afficher les details";
  button.setAttribute("aria-expanded", String(open));
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = getDetailsToggleIcon(open);
}

function renderTask(task) {
  const fragment = document.createDocumentFragment();
  const row = document.createElement("tr");
  const isDone = task.status === "done";
  const detailsId = `task-details-${task.id}`;

  const titleCell = document.createElement("td");
  titleCell.className = "task-title-cell";
  titleCell.textContent = task.title;
  row.appendChild(titleCell);

  const detailsToggleCell = document.createElement("td");
  detailsToggleCell.className = "task-details-toggle-cell";
  const detailsToggleBtn = document.createElement("button");
  detailsToggleBtn.type = "button";
  detailsToggleBtn.className = "secondary icon-btn task-details-btn";
  detailsToggleBtn.setAttribute("aria-controls", detailsId);
  setDetailsToggleState(detailsToggleBtn, false);
  detailsToggleCell.appendChild(detailsToggleBtn);
  row.appendChild(detailsToggleCell);

  const actionCell = document.createElement("td");
  actionCell.className = "task-action-cell";

  if (!isDone) {
    const button = document.createElement("button");
    button.className = "icon-btn";
    button.setAttribute("aria-label", "Acquitter la tache");
    button.title = "Acquitter";
    button.innerHTML = `
      <svg
        class="action-icon"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="18"
        height="18"
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          d="M9.55 18.2 4.8 13.45a1 1 0 1 1 1.4-1.42l3.35 3.35 8.25-8.25a1 1 0 1 1 1.4 1.41l-8.95 8.96a1 1 0 0 1-1.4 0z"
        />
      </svg>
    `;
    button.addEventListener("click", () => acknowledgeTask(task.id));
    actionCell.appendChild(button);
  } else {
    actionCell.textContent = "-";
  }

  row.appendChild(actionCell);

  const detailsRow = document.createElement("tr");
  detailsRow.id = detailsId;
  detailsRow.className = "task-details-row";
  detailsRow.hidden = true;

  const detailsCell = document.createElement("td");
  detailsCell.className = "task-details-cell";
  detailsCell.colSpan = 3;
  const createdAt = formatDate(task.created_at);
  const completedAt = isDone && task.completed_at ? formatDate(task.completed_at) : "Non acquittee";
  detailsCell.innerHTML = `<div class="task-details-content"><div><strong>Creee le:</strong> ${createdAt}</div><div><strong>Acquittee le:</strong> ${completedAt}</div></div>`;
  detailsRow.appendChild(detailsCell);

  detailsToggleBtn.addEventListener("click", () => {
    const open = detailsRow.hidden;
    detailsRow.hidden = !open;
    setDetailsToggleState(detailsToggleBtn, open);
  });

  fragment.appendChild(row);
  fragment.appendChild(detailsRow);
  return fragment;
}

function renderFilteredTasks() {
  taskTableBodyEl.replaceChildren();

  const filtered = allTasks.filter((task) => {
    if (task.status === "pending") {
      return showPending;
    }
    if (task.status === "done") {
      return showHistory;
    }
    return true;
  });

  filtered.forEach((task) => taskTableBodyEl.appendChild(renderTask(task)));

  if (!allTasks.length) {
    resetTaskTable("Aucune tache.");
    return;
  }

  if (!filtered.length) {
    resetTaskTable("Aucune tache pour ce filtre.");
  }
}

function authDbHint(operation) {
  return `${operation}: verifiez que la table tasks contient user_id (uuid) et que les policies RLS sont configurees pour auth.uid().`;
}

function readOAuthErrorFromUrl() {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  const searchPart = window.location.search.startsWith("?") ? window.location.search.slice(1) : "";
  const params = new URLSearchParams(hash || searchPart);
  const errorDescription = params.get("error_description");
  const error = params.get("error");

  if (errorDescription || error) {
    return decodeURIComponent(errorDescription || error);
  }
  return "";
}

function showAuthOverlay() {
  if (!authOverlay || !authOverlay.hidden) {
    return;
  }
  authOverlay.hidden = false;
}

function closeAuthOverlay() {
  if (!authOverlay || authOverlay.hidden) {
    return;
  }
  authOverlay.hidden = true;
}

function getUserIdentity(user) {
  if (!user) {
    return "";
  }
  return user.email || user.user_metadata?.email || user.user_metadata?.full_name || user.id;
}

function setAccountInfo(user) {
  if (!accountInfoEl) {
    return;
  }

  const identity = getUserIdentity(user);
  if (!identity) {
    accountInfoEl.textContent = "";
    accountInfoEl.hidden = true;
    return;
  }

  accountInfoEl.textContent = `Compte: ${identity}`;
  accountInfoEl.hidden = false;
}

async function fetchTasks() {
  if (!supabaseClient || !currentUser) {
    resetTaskTable("Connectez-vous pour voir vos taches.");
    return;
  }

  const { data, error } = await supabaseClient
    .from("tasks")
    .select("id,title,status,created_at,completed_at,user_id")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    const needsUserColumn = error.message && error.message.toLowerCase().includes("user_id");
    setStatus(needsUserColumn ? authDbHint("Erreur de lecture") : `Erreur de lecture: ${error.message}`, true);
    return;
  }

  allTasks = data;
  renderFilteredTasks();
}

async function addTask(title) {
  if (!currentUser) {
    setStatus("Connectez-vous avant d'ajouter une tache.", true);
    return;
  }

  const { error } = await supabaseClient.from("tasks").insert({
    title,
    status: "pending",
    user_id: currentUser.id,
  });

  if (error) {
    const needsUserColumn = error.message && error.message.toLowerCase().includes("user_id");
    setStatus(needsUserColumn ? authDbHint("Erreur d'ajout") : `Erreur d'ajout: ${error.message}`, true);
    return;
  }

  await fetchTasks();
}

async function acknowledgeTask(id) {
  if (!currentUser) {
    setStatus("Session invalide. Reconnectez-vous.", true);
    return;
  }

  const { error } = await supabaseClient
    .from("tasks")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", currentUser.id);

  if (error) {
    setStatus(`Erreur d'acquittement: ${error.message}`, true);
    return;
  }

  await fetchTasks();
}

async function signInWithGoogle() {
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });

  if (error) {
    setStatus(`Erreur de connexion Google: ${error.message}`, true);
  }
}

async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    setStatus(`Erreur de deconnexion: ${error.message}`, true);
    return;
  }

  setStatus("Session fermee.");
}

async function handleSession(session) {
  currentUser = session?.user ?? null;

  if (!currentUser) {
    allTasks = [];
    if (settingsMenu) {
      settingsMenu.hidden = true;
      settingsMenu.open = false;
    }
    setAccountInfo(null);
    logoutBtn.hidden = true;
    setAddTaskEnabled(false);
    resetTaskTable("Connectez-vous pour voir vos taches.");
    showAuthOverlay();
    return;
  }

  if (settingsMenu) {
    settingsMenu.hidden = false;
  }
  setAccountInfo(currentUser);
  logoutBtn.hidden = false;
  setAddTaskEnabled(true);
  closeAuthOverlay();

  await fetchTasks();
}

async function refreshSessionFromStorage(force = false) {
  if (!supabaseClient) {
    return;
  }

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    setStatus(`Erreur de session: ${error.message}`, true);
    return;
  }

  const nextUserId = data.session?.user?.id || null;
  const currentUserId = currentUser?.id || null;
  if (force || nextUserId !== currentUserId) {
    await handleSession(data.session);
  } else if (nextUserId && authOverlay && !authOverlay.hidden) {
    closeAuthOverlay();
  }
}

async function initSupabase() {
  if (
    !SUPABASE_URL ||
    SUPABASE_URL.includes("xxxx.supabase.co") ||
    !SUPABASE_ANON_KEY ||
    SUPABASE_ANON_KEY === "your-anon-public-key"
  ) {
    setStatus(
      "Renseignez SUPABASE_URL et SUPABASE_ANON_KEY dans app.js pour connecter la base.",
      true
    );
    return;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const oauthError = readOAuthErrorFromUrl();
  if (oauthError) {
    setStatus(`Erreur OAuth: ${oauthError}`, true);
  }

  await refreshSessionFromStorage(true);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    void handleSession(session);
  });
}

loginBtn.addEventListener("click", () => {
  if (!supabaseClient) {
    setStatus("Client Supabase indisponible.", true);
    return;
  }

  void signInWithGoogle();
});

logoutBtn.addEventListener("click", () => {
  if (!supabaseClient) {
    return;
  }

  if (settingsMenu) {
    settingsMenu.open = false;
  }
  void signOut();
});

if (settingsMenu) {
  settingsMenu.addEventListener("toggle", async () => {
    if (!settingsMenu.open || !supabaseClient) {
      return;
    }

    const { data } = await supabaseClient.auth.getUser();
    if (data?.user) {
      currentUser = data.user;
      setAccountInfo(currentUser);
    } else {
      setAccountInfo(currentUser);
    }
  });
}

if (installBtn) {
  installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      setStatus("Installation non disponible sur ce navigateur.");
      return;
    }

    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installBtn.hidden = true;
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  if (installBtn) {
    installBtn.hidden = false;
  }
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  if (installBtn) {
    installBtn.hidden = true;
  }
});

if (addTaskBtn) {
  addTaskBtn.addEventListener("click", async () => {
    if (!supabaseClient || !currentUser) {
      setStatus("Connectez-vous avant d'ajouter une tache.", true);
      return;
    }

    const input = window.prompt("Titre de la tache ?", "");
    if (input === null) {
      return;
    }

    const title = input.trim();
    if (!title) {
      setStatus("Le titre de la tache est requis.", true);
      return;
    }

    await addTask(title);
  });
}

if (togglePendingBtn) {
  togglePendingBtn.addEventListener("click", () => {
    showPending = !showPending;
    applyFilterButtonState();
    renderFilteredTasks();
  });
}

if (toggleHistoryBtn) {
  toggleHistoryBtn.addEventListener("click", () => {
    showHistory = !showHistory;
    applyFilterButtonState();
    renderFilteredTasks();
  });
}

setAddTaskEnabled(false);
applyFilterButtonState();
resetTaskTable("Connectez-vous pour voir vos taches.");
void initSupabase();

window.addEventListener("focus", () => {
  void refreshSessionFromStorage();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    void refreshSessionFromStorage();
  }
});

function isLocalDevelopmentHost() {
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "[::1]"
  );
}

async function disableServiceWorkerForDevelopment() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    if (isLocalDevelopmentHost()) {
      await disableServiceWorkerForDevelopment();
      return;
    }

    let didRefreshForUpdate = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (didRefreshForUpdate) {
        return;
      }
      didRefreshForUpdate = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register("./sw.js", { updateViaCache: "none" })
      .then(async (registration) => {
        await registration.update();

        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        registration.addEventListener("updatefound", () => {
          const nextWorker = registration.installing;
          if (!nextWorker) {
            return;
          }

          nextWorker.addEventListener("statechange", () => {
            if (nextWorker.state === "installed" && navigator.serviceWorker.controller) {
              nextWorker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch(() => {
        setStatus("Service worker non disponible.", true);
      });
  });
}
