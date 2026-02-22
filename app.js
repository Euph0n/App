const statusEl = document.getElementById("status");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const settingsMenu = document.getElementById("settingsMenu");
const accountInfoEl = document.getElementById("accountInfo");
const installBtn = document.getElementById("installBtn");
const authOverlay = document.getElementById("authOverlay");
const taskFormOverlay = document.getElementById("taskFormOverlay");
const taskFormEl = document.getElementById("taskForm");
const taskTitleInput = document.getElementById("taskTitleInput");
const taskDueInput = document.getElementById("taskDueInput");
const taskRecurrenceInput = document.getElementById("taskRecurrenceInput");
const recurrenceDaysEl = document.getElementById("recurrenceDays");
const cancelTaskFormBtn = document.getElementById("cancelTaskFormBtn");
const addTaskBtn = document.getElementById("addTaskBtn");
const togglePendingBtn = document.getElementById("togglePendingBtn");
const toggleHistoryBtn = document.getElementById("toggleHistoryBtn");
const taskListEl = document.getElementById("taskList");

let supabaseClient;
let currentUser = null;
let deferredInstallPrompt = null;
let showPending = true;
let showHistory = true;
let allTasks = [];
let supportsDueDate = true;
let supportsRecurrence = true;
const WEEKDAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

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

function resetTaskList(message) {
  taskListEl.innerHTML = `<li class="task-empty">${message}</li>`;
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
  const date = new Date(value);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function formatDueDuration(value) {
  const dueMs = new Date(value).getTime();
  if (Number.isNaN(dueMs)) {
    return "";
  }

  const diffMs = dueMs - Date.now();
  const isOverdue = diffMs < 0;
  const absMinutes = Math.max(1, Math.round(Math.abs(diffMs) / 60000));

  const days = Math.floor(absMinutes / 1440);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes;

  let duration = "";
  if (days > 0) {
    duration = `${days}j`;
  } else if (hours > 0) {
    duration = `${hours}h`;
  } else {
    duration = `${minutes}m`;
  }

  return duration;
}

function parseDueDateInput(input) {
  const trimmed = input.trim();
  if (!trimmed) {
    return { value: null, error: "" };
  }

  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);
  if (!match) {
    return { value: null, error: "Format d'echeance invalide. Utilisez AAAA-MM-JJ ou AAAA-MM-JJ HH:MM." };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hours = Number(match[4] ?? "00");
  const minutes = Number(match[5] ?? "00");

  const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const isValid =
    localDate.getFullYear() === year &&
    localDate.getMonth() === month - 1 &&
    localDate.getDate() === day &&
    localDate.getHours() === hours &&
    localDate.getMinutes() === minutes;

  if (!isValid) {
    return { value: null, error: "Date d'echeance invalide." };
  }

  return { value: localDate.toISOString(), error: "" };
}

function parseRecurrenceRule(rule) {
  if (!rule) {
    return { type: "", days: [] };
  }

  if (rule === "daily" || rule === "monthly" || rule === "weekly") {
    return { type: rule, days: [] };
  }

  if (!rule.startsWith("weekly:")) {
    return { type: "", days: [] };
  }

  const dayList = rule
    .slice("weekly:".length)
    .split(",")
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v >= 0 && v <= 6);
  const uniqueSorted = Array.from(new Set(dayList)).sort((a, b) => a - b);
  return { type: "weekly", days: uniqueSorted };
}

function getRecurrenceLabel(recurrenceRule) {
  const parsed = parseRecurrenceRule(recurrenceRule);
  if (parsed.type === "daily") {
    return "Quotidienne";
  }
  if (parsed.type === "monthly") {
    return "Mensuelle";
  }
  if (parsed.type === "weekly") {
    if (!parsed.days.length) {
      return "Hebdomadaire";
    }
    const labels = parsed.days.map((day) => WEEKDAY_LABELS[day]).join(", ");
    return `Hebdo: ${labels}`;
  }
  return "";
}

function getWeeklyDaySelection() {
  if (!recurrenceDaysEl) {
    return [];
  }
  return Array.from(recurrenceDaysEl.querySelectorAll(".recurrence-day-btn[aria-pressed='true']"))
    .map((el) => Number(el.getAttribute("data-day")))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((a, b) => a - b);
}

function getRecurrenceRuleFromForm() {
  const selected = taskRecurrenceInput?.value || "";
  if (selected !== "weekly") {
    return selected;
  }
  const days = getWeeklyDaySelection();
  if (!days.length) {
    return "weekly";
  }
  return `weekly:${days.join(",")}`;
}

function updateRecurrenceDaysVisibility() {
  if (!recurrenceDaysEl) {
    return;
  }
  const isWeekly = taskRecurrenceInput?.value === "weekly";
  recurrenceDaysEl.hidden = !isWeekly;
}

function getNextDueAtIso(currentDueAt, recurrenceRule) {
  const parsed = parseRecurrenceRule(recurrenceRule);
  if (!parsed.type) {
    return null;
  }

  const baseDate = currentDueAt ? new Date(currentDueAt) : new Date();
  if (Number.isNaN(baseDate.getTime())) {
    return null;
  }

  if (parsed.type === "daily") {
    baseDate.setDate(baseDate.getDate() + 1);
    return baseDate.toISOString();
  }

  if (parsed.type === "monthly") {
    baseDate.setMonth(baseDate.getMonth() + 1);
    return baseDate.toISOString();
  }

  if (parsed.type !== "weekly") {
    return null;
  }

  const days = parsed.days.length ? parsed.days : [baseDate.getDay()];
  const originalDay = baseDate.getDay();
  const originalMs = baseDate.getTime();
  for (let delta = 1; delta <= 14; delta += 1) {
    const candidate = new Date(originalMs);
    candidate.setDate(candidate.getDate() + delta);
    if (days.includes(candidate.getDay())) {
      return candidate.toISOString();
    }
  }

  const fallback = new Date(originalMs);
  const nextDelta = ((days[0] - originalDay + 7) % 7) || 7;
  fallback.setDate(fallback.getDate() + nextDelta);
  return fallback.toISOString();
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

function setupSwipeActions(item, taskId, canAcknowledge, onTap) {
  const minSwipeDistance = 90;
  const maxSwipeDistance = 140;
  const tapThreshold = 8;
  let isDragging = false;
  let pointerId = null;
  let startX = 0;
  let offsetX = 0;

  const setOffset = (value) => {
    item.style.setProperty("--swipe-offset", `${value}px`);
  };

  const resetSwipeState = () => {
    item.classList.remove("swipe-active");
    item.classList.remove("swipe-ready-ack");
    item.classList.remove("swipe-ready-delete");
    setOffset(0);
    offsetX = 0;
    isDragging = false;
    pointerId = null;
  };

  item.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }
    if (event.target instanceof Element && event.target.closest("button")) {
      return;
    }

    isDragging = true;
    pointerId = event.pointerId;
    startX = event.clientX;
    offsetX = 0;
    item.classList.add("swipe-active");
    item.setPointerCapture(event.pointerId);
  });

  item.addEventListener("pointermove", (event) => {
    if (!isDragging || event.pointerId !== pointerId) {
      return;
    }

    const deltaX = event.clientX - startX;
    offsetX = Math.max(Math.min(deltaX, maxSwipeDistance), -maxSwipeDistance);

    setOffset(offsetX);
    if (canAcknowledge && offsetX >= minSwipeDistance) {
      item.classList.add("swipe-ready-ack");
      item.classList.remove("swipe-ready-delete");
    } else if (offsetX <= -minSwipeDistance) {
      item.classList.add("swipe-ready-delete");
      item.classList.remove("swipe-ready-ack");
    } else {
      item.classList.remove("swipe-ready-ack");
      item.classList.remove("swipe-ready-delete");
    }
  });

  item.addEventListener("pointerup", async (event) => {
    if (!isDragging || event.pointerId !== pointerId) {
      return;
    }

    const shouldAcknowledge = canAcknowledge && offsetX >= minSwipeDistance;
    const shouldDelete = offsetX <= -minSwipeDistance;

    if (shouldAcknowledge) {
      item.classList.remove("swipe-active");
      item.classList.remove("swipe-ready-ack");
      item.classList.remove("swipe-ready-delete");
      setOffset(maxSwipeDistance);
      isDragging = false;
      pointerId = null;
      await acknowledgeTask(taskId);
      return;
    }

    if (shouldDelete) {
      item.classList.remove("swipe-active");
      item.classList.remove("swipe-ready-ack");
      item.classList.remove("swipe-ready-delete");
      setOffset(-maxSwipeDistance);
      isDragging = false;
      pointerId = null;
      await deleteTask(taskId);
      return;
    }

    if (Math.abs(offsetX) <= tapThreshold) {
      onTap();
    }
    resetSwipeState();
  });

  item.addEventListener("pointercancel", () => {
    if (!isDragging) {
      return;
    }
    resetSwipeState();
  });
}

function renderTask(task) {
  const item = document.createElement("li");
  item.className = "task-item";
  item.classList.add("task-item-swipable");
  const isDone = task.status === "done";
  const detailsId = `task-details-${task.id}`;

  const mainRow = document.createElement("div");
  mainRow.className = "task-item-main";

  const title = document.createElement("span");
  title.className = "task-title";
  if (isDone) {
    title.classList.add("task-title-done");
  }
  title.textContent = task.title;
  mainRow.appendChild(title);

  const rightMeta = document.createElement("div");
  rightMeta.className = "task-right-meta";

  if (task.due_at) {
    const dueInline = document.createElement("span");
    dueInline.className = "task-due-inline";
    const dueMs = new Date(task.due_at).getTime();
    if (!Number.isNaN(dueMs) && dueMs < Date.now()) {
      dueInline.classList.add("task-due-overdue");
    }
    dueInline.title = `Echeance: ${formatDate(task.due_at)}`;
    dueInline.innerHTML = `
      <svg
        class="task-due-icon"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="14"
        height="14"
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 10.59 3.3 3.3a1 1 0 0 1-1.42 1.41l-3.59-3.58A1 1 0 0 1 11 13V7a1 1 0 0 1 2 0z"
        />
      </svg>
      <span>${formatDueDuration(task.due_at)}</span>
    `;
    rightMeta.appendChild(dueInline);
  }

  const detailsToggleBtn = document.createElement("button");
  detailsToggleBtn.type = "button";
  detailsToggleBtn.className = "icon-btn task-details-btn";
  detailsToggleBtn.setAttribute("aria-controls", detailsId);
  setDetailsToggleState(detailsToggleBtn, false);
  rightMeta.appendChild(detailsToggleBtn);
  mainRow.appendChild(rightMeta);
  item.appendChild(mainRow);

  const detailsPanel = document.createElement("div");
  detailsPanel.id = detailsId;
  detailsPanel.className = "task-details-panel";
  detailsPanel.hidden = true;

  const createdAt = formatDate(task.created_at);
  const dueLine = task.due_at ? `<div><strong>Echeance:</strong> ${formatDate(task.due_at)}</div>` : "";
  const recurrenceLabel = getRecurrenceLabel(task.recurrence_rule || "");
  const recurrenceLine = recurrenceLabel ? `<div><strong>Recurrence:</strong> ${recurrenceLabel}</div>` : "";
  const completedLine = isDone && task.completed_at ? `<div><strong>Fait le:</strong> ${formatDate(task.completed_at)}</div>` : "";
  detailsPanel.innerHTML = `<div class="task-details-content"><div><strong>Creee le:</strong> ${createdAt}</div>${dueLine}${recurrenceLine}${completedLine}</div>`;
  item.appendChild(detailsPanel);

  const toggleDetails = () => {
    const open = detailsPanel.hidden;
    detailsPanel.hidden = !open;
    setDetailsToggleState(detailsToggleBtn, open);
  };

  detailsToggleBtn.addEventListener("click", () => {
    toggleDetails();
  });

  if (!isDone) {
    item.classList.add("task-item-pending");
    setupSwipeActions(item, task.id, true, toggleDetails);
  } else {
    item.classList.add("task-item-done");
    setupSwipeActions(item, task.id, false, toggleDetails);
  }

  return item;
}

function renderFilteredTasks() {
  taskListEl.replaceChildren();

  const filtered = allTasks
    .filter((task) => {
    if (task.status === "pending") {
      return showPending;
    }
    if (task.status === "done") {
      return showHistory;
    }
    return true;
    })
    .sort((a, b) => {
      const dueA = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
      const dueB = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
      if (dueA !== dueB) {
        return dueA - dueB;
      }
      const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return createdB - createdA;
    });

  filtered.forEach((task) => taskListEl.appendChild(renderTask(task)));

  if (!allTasks.length) {
    resetTaskList("Aucune tache.");
    return;
  }

  if (!filtered.length) {
    resetTaskList("Aucune tache pour ce filtre.");
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

function resetTaskForm() {
  if (!taskFormEl) {
    return;
  }
  taskFormEl.reset();
  if (recurrenceDaysEl) {
    recurrenceDaysEl.querySelectorAll(".recurrence-day-btn").forEach((btn) => {
      btn.setAttribute("aria-pressed", "false");
    });
  }
  updateRecurrenceDaysVisibility();
}

function openTaskForm() {
  if (!taskFormOverlay || !taskFormEl || !taskTitleInput) {
    return;
  }
  updateRecurrenceDaysVisibility();
  taskFormOverlay.hidden = false;
  taskTitleInput.focus();
}

function closeTaskForm() {
  if (!taskFormOverlay) {
    return;
  }
  taskFormOverlay.hidden = true;
  resetTaskForm();
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
    resetTaskList("Connectez-vous pour voir vos taches.");
    return;
  }

  const selectedColumns = ["id", "title", "status", "created_at", "completed_at", "user_id"];
  if (supportsDueDate) {
    selectedColumns.push("due_at");
  }
  if (supportsRecurrence) {
    selectedColumns.push("recurrence_rule");
  }

  let { data, error } = await supabaseClient
    .from("tasks")
    .select(selectedColumns.join(","))
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (
    error &&
    error.message &&
    ((supportsDueDate && error.message.toLowerCase().includes("due_at")) ||
      (supportsRecurrence && error.message.toLowerCase().includes("recurrence_rule")))
  ) {
    if (error.message.toLowerCase().includes("due_at")) {
      supportsDueDate = false;
    }
    if (error.message.toLowerCase().includes("recurrence_rule")) {
      supportsRecurrence = false;
    }

    const fallbackColumns = ["id", "title", "status", "created_at", "completed_at", "user_id"];
    if (supportsDueDate) {
      fallbackColumns.push("due_at");
    }
    if (supportsRecurrence) {
      fallbackColumns.push("recurrence_rule");
    }

    const fallback = await supabaseClient
      .from("tasks")
      .select(fallbackColumns.join(","))
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });
    data = fallback.data;
    error = fallback.error;
    if (!error) {
      if (!supportsDueDate) {
        setStatus("La colonne due_at est absente. Ajoutez-la pour activer les echeances.");
      } else if (!supportsRecurrence) {
        setStatus("La colonne recurrence_rule est absente. Ajoutez-la pour activer la recurrence.");
      }
    }
  }

  if (error) {
    const needsUserColumn = error.message && error.message.toLowerCase().includes("user_id");
    const needsDueColumn = error.message && error.message.toLowerCase().includes("due_at");
    const needsRecurrenceColumn = error.message && error.message.toLowerCase().includes("recurrence_rule");
    setStatus(
      needsUserColumn
        ? authDbHint("Erreur de lecture")
        : needsDueColumn
          ? "Erreur de lecture: la colonne due_at est requise pour les echeances."
          : needsRecurrenceColumn
            ? "Erreur de lecture: la colonne recurrence_rule est requise pour la recurrence."
          : `Erreur de lecture: ${error.message}`,
      true
    );
    return;
  }

  allTasks = data;
  renderFilteredTasks();
}

async function addTask(title, dueAtIso = null, recurrence = "") {
  if (!currentUser) {
    setStatus("Connectez-vous avant d'ajouter une tache.", true);
    return false;
  }

  const payload = {
    title,
    status: "pending",
    user_id: currentUser.id,
  };
  if (supportsDueDate && dueAtIso) {
    payload.due_at = dueAtIso;
  }
  if (supportsRecurrence && recurrence) {
    payload.recurrence_rule = recurrence;
  }

  const { error } = await supabaseClient.from("tasks").insert(payload);

  if (error) {
    const needsUserColumn = error.message && error.message.toLowerCase().includes("user_id");
    const needsDueColumn = error.message && error.message.toLowerCase().includes("due_at");
    const needsRecurrenceColumn = error.message && error.message.toLowerCase().includes("recurrence_rule");
    if (needsDueColumn) {
      supportsDueDate = false;
      setStatus("Erreur d'ajout: la colonne due_at est absente. Ajoutez-la pour stocker les echeances.", true);
      return false;
    }
    if (needsRecurrenceColumn) {
      supportsRecurrence = false;
      setStatus("Erreur d'ajout: la colonne recurrence_rule est absente. Ajoutez-la pour stocker la recurrence.", true);
      return false;
    }
    setStatus(needsUserColumn ? authDbHint("Erreur d'ajout") : `Erreur d'ajout: ${error.message}`, true);
    return false;
  }

  await fetchTasks();
  return true;
}

async function acknowledgeTask(id) {
  if (!currentUser) {
    setStatus("Session invalide. Reconnectez-vous.", true);
    return;
  }

  const sourceTask = allTasks.find((task) => task.id === id) || null;

  const { error } = await supabaseClient
    .from("tasks")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", currentUser.id);

  if (error) {
    setStatus(`Erreur d'acquittement: ${error.message}`, true);
    return;
  }

  const recurrence = sourceTask?.recurrence_rule || "";
  if (recurrence && sourceTask) {
    const nextPayload = {
      title: sourceTask.title,
      status: "pending",
      user_id: currentUser.id,
    };

    if (supportsRecurrence) {
      nextPayload.recurrence_rule = recurrence;
    }

    if (supportsDueDate && sourceTask.due_at) {
      const nextDueAt = getNextDueAtIso(sourceTask.due_at, recurrence);
      if (nextDueAt) {
        nextPayload.due_at = nextDueAt;
      }
    }

    const { error: recurrenceError } = await supabaseClient.from("tasks").insert(nextPayload);
    if (recurrenceError) {
      if (recurrenceError.message && recurrenceError.message.toLowerCase().includes("recurrence_rule")) {
        supportsRecurrence = false;
      }
      if (recurrenceError.message && recurrenceError.message.toLowerCase().includes("due_at")) {
        supportsDueDate = false;
      }
      setStatus(`Erreur de recurrence: ${recurrenceError.message}`, true);
    }
  }

  await fetchTasks();
}

async function deleteTask(id) {
  if (!currentUser) {
    setStatus("Session invalide. Reconnectez-vous.", true);
    return;
  }

  const { error } = await supabaseClient.from("tasks").delete().eq("id", id).eq("user_id", currentUser.id);

  if (error) {
    setStatus(`Erreur de suppression: ${error.message}`, true);
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
    closeTaskForm();
    if (settingsMenu) {
      settingsMenu.hidden = true;
      settingsMenu.open = false;
    }
    setAccountInfo(null);
    logoutBtn.hidden = true;
    setAddTaskEnabled(false);
    resetTaskList("Connectez-vous pour voir vos taches.");
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
  addTaskBtn.addEventListener("click", () => {
    if (!supabaseClient || !currentUser) {
      setStatus("Connectez-vous avant d'ajouter une tache.", true);
      return;
    }
    openTaskForm();
  });
}

if (taskFormEl) {
  taskFormEl.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!taskTitleInput) {
      return;
    }

    const title = taskTitleInput.value.trim();
    if (!title) {
      setStatus("Le titre de la tache est requis.", true);
      return;
    }

    const dueRaw = taskDueInput?.value ?? "";
    const parsedDue = parseDueDateInput(dueRaw);
    if (parsedDue.error) {
      setStatus(parsedDue.error, true);
      return;
    }

    const recurrence = getRecurrenceRuleFromForm();
    if (recurrence && !supportsRecurrence) {
      setStatus("La recurrence n'est pas disponible: ajoutez la colonne recurrence_rule.", true);
      return;
    }
    const added = await addTask(title, parsedDue.value, recurrence);
    if (added) {
      closeTaskForm();
    }
  });
}

if (taskRecurrenceInput) {
  taskRecurrenceInput.addEventListener("change", () => {
    updateRecurrenceDaysVisibility();
  });
}

if (recurrenceDaysEl) {
  recurrenceDaysEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const button = target.closest(".recurrence-day-btn");
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }
    const pressed = button.getAttribute("aria-pressed") === "true";
    button.setAttribute("aria-pressed", String(!pressed));
  });
}

if (cancelTaskFormBtn) {
  cancelTaskFormBtn.addEventListener("click", () => {
    closeTaskForm();
  });
}

if (taskFormOverlay) {
  taskFormOverlay.addEventListener("click", (event) => {
    if (event.target === taskFormOverlay) {
      closeTaskForm();
    }
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
resetTaskList("Connectez-vous pour voir vos taches.");
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
