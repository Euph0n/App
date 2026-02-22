const statusEl = document.getElementById("status");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const settingsMenu = document.getElementById("settingsMenu");
const accountInfoEl = document.getElementById("accountInfo");
const installBtn = document.getElementById("installBtn");
const authOverlay = document.getElementById("authOverlay");
const addTaskBtn = document.getElementById("addTaskBtn");
const toggleHistoryBtn = document.getElementById("toggleHistoryBtn");
const pendingTasksEl = document.getElementById("pendingTasks");
const historySectionEl = document.getElementById("historySection");
const historyTasksEl = document.getElementById("historyTasks");

let supabaseClient;
let currentUser = null;
let deferredInstallPrompt = null;

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

function setHistoryVisible(visible) {
  if (!historySectionEl || !toggleHistoryBtn) {
    return;
  }

  historySectionEl.hidden = !visible;
  toggleHistoryBtn.setAttribute("aria-expanded", String(visible));
  const label = visible ? "Masquer historique" : "Afficher historique";
  toggleHistoryBtn.setAttribute("aria-label", label);
  toggleHistoryBtn.title = label;
}

function resetTaskLists(message) {
  pendingTasksEl.innerHTML = `<li>${message}</li>`;
  historyTasksEl.innerHTML = `<li>${message}</li>`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function renderTask(task, history = false) {
  const item = document.createElement("li");
  item.className = "task-item";

  const content = document.createElement("div");
  content.innerHTML = `<strong>${task.title}</strong><div class="task-meta">Creee le ${formatDate(
    task.created_at
  )}${history ? ` - Acquittee le ${formatDate(task.completed_at)}` : ""}</div>`;

  item.appendChild(content);

  if (!history) {
    const button = document.createElement("button");
    button.textContent = "Acquitter";
    button.addEventListener("click", () => acknowledgeTask(task.id));
    item.appendChild(button);
  }

  return item;
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
    resetTaskLists("Connectez-vous pour voir vos taches.");
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

  pendingTasksEl.replaceChildren();
  historyTasksEl.replaceChildren();

  const pending = data.filter((task) => task.status === "pending");
  const history = data.filter((task) => task.status === "done");

  pending.forEach((task) => pendingTasksEl.appendChild(renderTask(task)));
  history.forEach((task) => historyTasksEl.appendChild(renderTask(task, true)));

  if (!pending.length) {
    pendingTasksEl.innerHTML = "<li>Aucune tache en cours.</li>";
  }

  if (!history.length) {
    historyTasksEl.innerHTML = "<li>Historique vide.</li>";
  }
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

  setStatus("Tache ajoutee.");
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
    if (settingsMenu) {
      settingsMenu.hidden = true;
      settingsMenu.open = false;
    }
    setAccountInfo(null);
    logoutBtn.hidden = true;
    setAddTaskEnabled(false);
    resetTaskLists("Connectez-vous pour voir vos taches.");
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

if (toggleHistoryBtn) {
  toggleHistoryBtn.addEventListener("click", () => {
    const shouldShow = historySectionEl ? historySectionEl.hidden : true;
    setHistoryVisible(shouldShow);
  });
}

setAddTaskEnabled(false);
setHistoryVisible(false);
resetTaskLists("Connectez-vous pour voir vos taches.");
void initSupabase();

window.addEventListener("focus", () => {
  void refreshSessionFromStorage();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    void refreshSessionFromStorage();
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
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
