const statusEl = document.getElementById("status");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const settingsMenu = document.getElementById("settingsMenu");
const accountInfoEl = document.getElementById("accountInfo");
const installBtn = document.getElementById("installBtn");
const authOverlay = document.getElementById("authOverlay");
const taskFormOverlay = document.getElementById("taskFormOverlay");
const taskFormEl = document.getElementById("taskForm");
const taskFormTitleEl = document.getElementById("taskFormTitle");
const submitTaskFormBtn = document.getElementById("submitTaskFormBtn");
const taskTitleInput = document.getElementById("taskTitleInput");
const taskDescriptionInput = document.getElementById("taskDescriptionInput");
const createTypeOverlay = document.getElementById("createTypeOverlay");
const createSingleTaskBtn = document.getElementById("createSingleTaskBtn");
const createJourneyBtn = document.getElementById("createJourneyBtn");
const cancelCreateTypeBtn = document.getElementById("cancelCreateTypeBtn");
const journeyFormOverlay = document.getElementById("journeyFormOverlay");
const journeyFormEl = document.getElementById("journeyForm");
const journeyNameInput = document.getElementById("journeyNameInput");
const addTaskToJourneyBtn = document.getElementById("addTaskToJourneyBtn");
const cancelJourneyFormBtn = document.getElementById("cancelJourneyFormBtn");
const journeyDraftListEl = document.getElementById("journeyDraftList");
const journeyDraftEmptyEl = document.getElementById("journeyDraftEmpty");
const taskDateCard = document.getElementById("taskDateCard");
const taskTimeCard = document.getElementById("taskTimeCard");
const taskDueFields = document.getElementById("taskDueFields");
const taskDueDateBtn = document.getElementById("taskDueDateBtn");
const taskDueInput = document.getElementById("taskDueInput");
const taskDueTimeInput = document.getElementById("taskDueTimeInput");
const taskDueTimeWheelBtn = document.getElementById("taskDueTimeWheelBtn");
const toggleDueInputBtn = document.getElementById("toggleDueInputBtn");
const dueTimeOverlay = document.getElementById("dueTimeOverlay");
const dueTimeTextInput = document.getElementById("dueTimeTextInput");
const dueTimeErrorEl = document.getElementById("dueTimeError");
const cancelDueTimeBtn = document.getElementById("cancelDueTimeBtn");
const confirmDueTimeBtn = document.getElementById("confirmDueTimeBtn");
const taskRecurrenceInput = document.getElementById("taskRecurrenceInput");
const toggleRecurrenceInputBtn = document.getElementById("toggleRecurrenceInputBtn");
const recurrenceCustomEl = document.getElementById("recurrenceCustom");
const customCountInput = document.getElementById("customCountInput");
const customUnitSelect = document.getElementById("customUnitSelect");
const recurrenceDaysEl = document.getElementById("recurrenceDays");
const cancelTaskFormBtn = document.getElementById("cancelTaskFormBtn");
const addTaskBtn = document.getElementById("addTaskBtn");
const openTemplatesBtn = document.getElementById("openTemplatesBtn");
const saveTemplateBtn = document.getElementById("saveTemplateBtn");
const addSavedTaskToJourneyBtn = document.getElementById("addSavedTaskToJourneyBtn");
const togglePendingBtn = document.getElementById("togglePendingBtn");
const toggleHistoryBtn = document.getElementById("toggleHistoryBtn");
const taskListEl = document.getElementById("taskList");
const templatesOverlay = document.getElementById("templatesOverlay");
const templatesListEl = document.getElementById("templatesList");
const templatesEmptyEl = document.getElementById("templatesEmpty");
const closeTemplatesBtn = document.getElementById("closeTemplatesBtn");
const journeyTaskPickerOverlay = document.getElementById("journeyTaskPickerOverlay");
const journeyTaskPickerListEl = document.getElementById("journeyTaskPickerList");
const journeyTaskPickerEmptyEl = document.getElementById("journeyTaskPickerEmpty");
const closeJourneyTaskPickerBtn = document.getElementById("closeJourneyTaskPickerBtn");

let supabaseClient;
let currentUser = null;
let deferredInstallPrompt = null;
let showPending = false;
let showHistory = false;
let allTasks = [];
let savedTemplates = [];
let journeyDraftSteps = [];
let taskFormMode = "single";
let reopenJourneyAfterTaskForm = false;
let supportsDueDate = true;
let supportsRecurrence = true;
let supportsDescription = true;
let supportsJourneyColumns = true;
let focusCurrentTaskMode = true;
const WEEKDAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const RECURRENCE_CUSTOM_UNITS = [
  { value: "day", singular: "jour", plural: "jours" },
  { value: "week", singular: "semaine", plural: "semaines" },
  { value: "month", singular: "mois", plural: "mois" },
];
const JOURNEY_TITLE_PATTERN = /^\[\[p:([A-Za-z0-9_-]+):(\d+):(\d+)(?::([^\]]*))?\]\]\s*(.+)$/;
const TEMPLATE_STORAGE_PREFIX = "taskflow_templates_v1";

const SUPABASE_URL = "https://pikgsutwilxhblphynax.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpa2dzdXR3aWx4aGJscGh5bmF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NjY1NDcsImV4cCI6MjA4NzI0MjU0N30.gCPo21F6gpAGokux0CfgR_JDNHBr8vGOtiFdF6mQ4qY";

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#fca5a5" : "#86efac";
}

function setAddTaskEnabled(enabled) {
  if (!addTaskBtn) {
    if (openTemplatesBtn) {
      openTemplatesBtn.disabled = !enabled;
    }
    return;
  }
  addTaskBtn.disabled = !enabled;
  if (openTemplatesBtn) {
    openTemplatesBtn.disabled = !enabled;
  }
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

function formatCompletedDuration(value) {
  const completedMs = new Date(value).getTime();
  if (Number.isNaN(completedMs)) {
    return "";
  }

  const diffMs = Date.now() - completedMs;
  const absMinutes = Math.max(1, Math.round(Math.abs(diffMs) / 60000));

  const days = Math.floor(absMinutes / 1440);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes;

  if (days > 0) {
    return `${days}j`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${minutes}m`;
}

function parseDueDateInput(dateInput, timeInput = "09:00") {
  const datePart = dateInput.trim();
  if (!datePart) {
    return { value: null, error: "" };
  }

  const timePart = (timeInput || "09:00").trim();
  const dateMatch = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = timePart.match(/^(\d{2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) {
    return { value: null, error: "Format d'échéance invalide." };
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);

  const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const isValid =
    localDate.getFullYear() === year &&
    localDate.getMonth() === month - 1 &&
    localDate.getDate() === day &&
    localDate.getHours() === hours &&
    localDate.getMinutes() === minutes;

  if (!isValid) {
    return { value: null, error: "Date d'échéance invalide." };
  }

  return { value: localDate.toISOString(), error: "" };
}

function getDueDatePartsFromIso(isoValue) {
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return {
    date: `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`,
    time: `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`,
  };
}

function setDueInputExpanded(expanded) {
  if (!taskDueFields) {
    return;
  }
  taskDueFields.dataset.expanded = expanded ? "true" : "false";
}

function isDueInputExpanded() {
  if (!taskDueFields) {
    return false;
  }
  return taskDueFields.dataset.expanded === "true";
}

function updateDueInputVisibility() {
  if (!taskDueFields || !taskDueInput) {
    return;
  }

  if (!toggleDueInputBtn) {
    taskDueFields.hidden = false;
    return;
  }

  const hasDue = taskDueInput.value.trim().length > 0;
  const shouldShowInput = hasDue || isDueInputExpanded();
  taskDueFields.hidden = !shouldShowInput;

  if (!shouldShowInput) {
    taskDueInput.blur();
    taskDueTimeInput?.blur();
  }

  const buttonLabel = hasDue
    ? "Échéance définie"
    : shouldShowInput
      ? "Masquer l'échéance"
      : "Ajouter une échéance";
  toggleDueInputBtn.setAttribute("aria-label", buttonLabel);
  toggleDueInputBtn.title = buttonLabel;
}

function openDueDatePicker() {
  if (!taskDueInput) {
    return;
  }

  if (typeof taskDueInput.showPicker === "function") {
    taskDueInput.showPicker();
    return;
  }

  taskDueInput.focus();
  taskDueInput.click();
}

function openDueTimePicker() {
  if (!dueTimeOverlay || !taskDueTimeInput) {
    return;
  }
  const [hours = "09", minutes = "00"] = (taskDueTimeInput.value || "09:00").split(":");
  if (dueTimeTextInput) {
    dueTimeTextInput.value = `${pad2(Number(hours))}:${pad2(Number(minutes))}`;
  }
  dueTimeOverlay.hidden = false;
  if (dueTimeErrorEl) {
    dueTimeErrorEl.textContent = "";
  }
  if (dueTimeTextInput) {
    dueTimeTextInput.focus();
    dueTimeTextInput.select();
  }
}

function closeDueTimePicker() {
  if (!dueTimeOverlay) {
    return false;
  }
  dueTimeOverlay.hidden = true;
  if (dueTimeErrorEl) {
    dueTimeErrorEl.textContent = "";
  }
  return true;
}

function getDueTimeValue() {
  return taskDueTimeInput?.value || "09:00";
}

function setDueTimeValue(value) {
  if (!taskDueTimeInput || !taskDueTimeWheelBtn) {
    return;
  }
  taskDueTimeInput.value = value;
  taskDueTimeWheelBtn.textContent = value;
}

function formatDueDateLabel(value) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return "";
  }
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function updateDueDateButtonLabel() {
  if (!taskDueDateBtn || !taskDueInput) {
    return;
  }

  const formatted = formatDueDateLabel(taskDueInput.value);
  if (!formatted) {
    taskDueDateBtn.innerHTML = `<i class="bi bi-calendar3" aria-hidden="true"></i>`;
    taskDueDateBtn.title = "Choisir une date";
    return;
  }

  taskDueDateBtn.textContent = formatted;
  taskDueDateBtn.title = `Date sélectionnée: ${formatted}`;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function parseTimeNumberInput(value, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  if (parsed < 0) {
    return 0;
  }
  if (parsed > max) {
    return max;
  }
  return Math.floor(parsed);
}

function parseDueTimeTextInput(value) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2})\s*:\s*(\d{1,2})$/);
  if (!match) {
    return null;
  }
  const hour = parseTimeNumberInput(match[1], 23);
  const minute = parseTimeNumberInput(match[2], 59);
  if (Number(match[1]) > 23 || Number(match[2]) > 59) {
    return null;
  }
  return `${pad2(hour)}:${pad2(minute)}`;
}

function formatDueTimeTyping(value) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function getCustomUnitIndex(value) {
  return RECURRENCE_CUSTOM_UNITS.findIndex((unit) => unit.value === value);
}

function getCustomCountValue() {
  const parsed = Number(customCountInput?.value || "1");
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.max(1, Math.min(30, Math.floor(parsed)));
}

function getCustomUnitValue() {
  const current = customUnitSelect?.value || "day";
  return getCustomUnitIndex(current) >= 0 ? current : "day";
}

function setCustomCountValue(value) {
  if (!customCountInput) {
    return;
  }
  const safeValue = Math.max(1, Math.min(30, Math.floor(value)));
  customCountInput.value = String(safeValue);
}

function setCustomUnitValue(value) {
  if (!customUnitSelect) {
    return;
  }
  const index = getCustomUnitIndex(value);
  const safeUnit = index >= 0 ? RECURRENCE_CUSTOM_UNITS[index] : RECURRENCE_CUSTOM_UNITS[0];
  customUnitSelect.value = safeUnit.value;
}

function parseRecurrenceRule(rule) {
  if (!rule) {
    return { type: "", days: [], intervalCount: 1, intervalUnit: "day" };
  }

  if (rule === "daily" || rule === "monthly" || rule === "weekly") {
    return { type: rule, days: [], intervalCount: 1, intervalUnit: "day" };
  }

  const intervalMatch = rule.match(/^interval:(\d+):(day|week|month)$/);
  if (intervalMatch) {
    const intervalCount = Math.max(1, Number(intervalMatch[1]));
    return { type: "interval", days: [], intervalCount, intervalUnit: intervalMatch[2] };
  }

  if (!rule.startsWith("weekly:")) {
    return { type: "", days: [], intervalCount: 1, intervalUnit: "day" };
  }

  const dayList = rule
    .slice("weekly:".length)
    .split(",")
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v >= 0 && v <= 6);
  const uniqueSorted = Array.from(new Set(dayList)).sort((a, b) => a - b);
  return { type: "weekly", days: uniqueSorted, intervalCount: 1, intervalUnit: "day" };
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
  if (parsed.type === "interval") {
    const unit = RECURRENCE_CUSTOM_UNITS.find((entry) => entry.value === parsed.intervalUnit) || RECURRENCE_CUSTOM_UNITS[0];
    const label = parsed.intervalCount > 1 ? unit.plural : unit.singular;
    return `Tous les ${parsed.intervalCount} ${label}`;
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
  if (selected === "custom") {
    const count = getCustomCountValue();
    const unit = getCustomUnitValue();
    return `interval:${count}:${unit}`;
  }
  if (selected !== "weekly_days") {
    return selected;
  }
  const days = getWeeklyDaySelection();
  if (!days.length) {
    return "weekly";
  }
  return `weekly:${days.join(",")}`;
}

function updateRecurrenceDaysVisibility() {
  if (!recurrenceDaysEl || !recurrenceCustomEl) {
    return;
  }
  const recurrenceType = taskRecurrenceInput?.value || "";
  const isWeeklyDays = recurrenceType === "weekly_days";
  const isCustom = recurrenceType === "custom";
  recurrenceDaysEl.hidden = !isWeeklyDays;
  recurrenceCustomEl.hidden = !isCustom;
}

function setRecurrenceInputExpanded(expanded) {
  if (!taskRecurrenceInput) {
    return;
  }
  taskRecurrenceInput.dataset.expanded = expanded ? "true" : "false";
}

function isRecurrenceInputExpanded() {
  if (!taskRecurrenceInput) {
    return false;
  }
  return taskRecurrenceInput.dataset.expanded === "true";
}

function updateRecurrenceInputVisibility() {
  if (!taskRecurrenceInput) {
    return;
  }

  if (!toggleRecurrenceInputBtn) {
    taskRecurrenceInput.hidden = false;
    return;
  }

  const hasRecurrence = taskRecurrenceInput.value.trim().length > 0;
  const shouldShowInput = hasRecurrence || isRecurrenceInputExpanded();
  taskRecurrenceInput.hidden = !shouldShowInput;

  if (!shouldShowInput) {
    taskRecurrenceInput.blur();
  }

  const buttonLabel = hasRecurrence
    ? "Récurrence définie"
    : shouldShowInput
      ? "Masquer la récurrence"
      : "Ajouter une récurrence";
  toggleRecurrenceInputBtn.setAttribute("aria-label", buttonLabel);
  toggleRecurrenceInputBtn.title = buttonLabel;
}

function openRecurrencePicker() {
  if (!taskRecurrenceInput) {
    return;
  }

  if (typeof taskRecurrenceInput.showPicker === "function") {
    taskRecurrenceInput.showPicker();
    return;
  }

  taskRecurrenceInput.focus();
  taskRecurrenceInput.click();
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

  if (parsed.type === "interval") {
    const interval = Math.max(1, parsed.intervalCount || 1);
    if (parsed.intervalUnit === "day") {
      baseDate.setDate(baseDate.getDate() + interval);
      return baseDate.toISOString();
    }
    if (parsed.intervalUnit === "week") {
      baseDate.setDate(baseDate.getDate() + interval * 7);
      return baseDate.toISOString();
    }
    if (parsed.intervalUnit === "month") {
      baseDate.setMonth(baseDate.getMonth() + interval);
      return baseDate.toISOString();
    }
    return null;
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

function normalizeTaskTitle(value) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeTaskDescription(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hasJourneyColumnsError(message) {
  const lower = (message || "").toLowerCase();
  return (
    lower.includes("journey_id") ||
    lower.includes("journey_name") ||
    lower.includes("journey_step") ||
    lower.includes("journey_total")
  );
}

function decodeJourneyName(value) {
  if (!value) {
    return "";
  }
  try {
    return normalizeTaskTitle(decodeURIComponent(value));
  } catch {
    return normalizeTaskTitle(value);
  }
}

function parseJourneyStepDueToken(rawDue, lineNumber = null) {
  const dueRaw = String(rawDue || "").trim();
  if (!dueRaw) {
    return { value: null, dueDate: "", dueTime: "09:00", error: "" };
  }

  const dueMatch = dueRaw.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?$/);
  if (!dueMatch) {
    const linePrefix = Number.isInteger(lineNumber) ? `Étape ${lineNumber}: ` : "";
    return {
      value: null,
      dueDate: "",
      dueTime: "09:00",
      error: `${linePrefix}Format d'échéance invalide. Utilisez AAAA-MM-JJ ou AAAA-MM-JJ HH:MM.`,
    };
  }

  const dueDate = dueMatch[1];
  const dueTime = dueMatch[2] || "09:00";
  const parsedDue = parseDueDateInput(dueDate, dueTime);
  if (parsedDue.error) {
    const linePrefix = Number.isInteger(lineNumber) ? `Étape ${lineNumber}: ` : "";
    return { value: null, dueDate: "", dueTime: "09:00", error: `${linePrefix}${parsedDue.error}` };
  }

  return {
    value: parsedDue.value,
    dueDate,
    dueTime,
    error: "",
  };
}

function splitJourneyStepLine(rawLine) {
  const line = String(rawLine || "");
  const firstSeparator = line.indexOf("|");
  if (firstSeparator < 0) {
    return [line, "", ""];
  }

  const secondSeparator = line.indexOf("|", firstSeparator + 1);
  if (secondSeparator < 0) {
    return [line.slice(0, firstSeparator), line.slice(firstSeparator + 1), ""];
  }

  return [
    line.slice(0, firstSeparator),
    line.slice(firstSeparator + 1, secondSeparator),
    line.slice(secondSeparator + 1),
  ];
}

function normalizeJourneyStepRecord(stepRecord) {
  if (typeof stepRecord === "string") {
    const title = normalizeTaskTitle(stepRecord);
    if (!title) {
      return null;
    }
    return {
      title,
      description: "",
      dueDate: "",
      dueTime: "09:00",
      dueAtIso: null,
      recurrenceRule: "",
    };
  }

  if (!stepRecord || typeof stepRecord !== "object") {
    return null;
  }

  const title = normalizeTaskTitle(String(stepRecord.title || ""));
  if (!title) {
    return null;
  }

  const description = normalizeTaskDescription(stepRecord.description || "");
  const recurrenceRule = String(stepRecord.recurrenceRule || stepRecord.recurrence_rule || "").trim();
  let dueDate = "";
  let dueTime = "09:00";
  let dueAtIso = null;

  const dueDateRaw = typeof stepRecord.dueDate === "string" ? stepRecord.dueDate.trim() : "";
  const dueTimeRaw = parseDueTimeTextInput(String(stepRecord.dueTime || "")) || "09:00";
  if (dueDateRaw) {
    const parsedDue = parseDueDateInput(dueDateRaw, dueTimeRaw);
    if (!parsedDue.error) {
      dueDate = dueDateRaw;
      dueTime = dueTimeRaw;
      dueAtIso = parsedDue.value;
    }
  } else if (typeof stepRecord.dueAtIso === "string" && stepRecord.dueAtIso.trim()) {
    const localDue = getDueDatePartsFromIso(stepRecord.dueAtIso.trim());
    if (localDue) {
      const parsedDue = parseDueDateInput(localDue.date, localDue.time);
      if (!parsedDue.error) {
        dueDate = localDue.date;
        dueTime = localDue.time;
        dueAtIso = parsedDue.value;
      }
    }
  }

  return {
    title,
    description,
    dueDate,
    dueTime,
    dueAtIso,
    recurrenceRule,
  };
}

function parseJourneySteps(rawValue) {
  const lines = String(rawValue || "").split(/\r?\n/);
  const steps = [];

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    if (!rawLine || !rawLine.trim()) {
      continue;
    }

    const [rawTitle, rawDescription, rawDue] = splitJourneyStepLine(rawLine);
    const title = normalizeTaskTitle(rawTitle || "");
    if (!title) {
      return { steps: [], error: `Étape ${index + 1}: le titre est requis.` };
    }

    const description = normalizeTaskDescription(rawDescription || "");
    const parsedDue = parseJourneyStepDueToken(rawDue, index + 1);
    if (parsedDue.error) {
      return { steps: [], error: parsedDue.error };
    }

    steps.push({
      title,
      description,
      dueDate: parsedDue.dueDate,
      dueTime: parsedDue.dueTime,
      dueAtIso: parsedDue.value,
      recurrenceRule: "",
    });
  }

  return { steps, error: "" };
}

function formatJourneyStepLine(stepRecord) {
  const step = normalizeJourneyStepRecord(stepRecord);
  if (!step) {
    return "";
  }

  const safeTitle = step.title.replace(/\|/g, "/");
  const safeDescription = step.description.replace(/\r?\n+/g, " / ").replace(/\|/g, "/").trim();
  const dueSegment = step.dueDate ? `${step.dueDate} ${step.dueTime || "09:00"}` : "";

  if (!safeDescription && !dueSegment) {
    return safeTitle;
  }
  if (safeDescription && !dueSegment) {
    return `${safeTitle} | ${safeDescription}`;
  }
  if (!safeDescription && dueSegment) {
    return `${safeTitle} | | ${dueSegment}`;
  }
  return `${safeTitle} | ${safeDescription} | ${dueSegment}`;
}

function getCurrentTaskStepDraft() {
  const title = normalizeTaskTitle(taskTitleInput?.value || "");
  if (!title) {
    return { step: null, error: "Le titre de la tâche est requis." };
  }

  const description = normalizeTaskDescription(taskDescriptionInput?.value || "");
  const dueDateRaw = taskDueInput?.value ?? "";
  const dueTimeRaw = getDueTimeValue();
  const parsedDue = parseDueDateInput(dueDateRaw, dueTimeRaw);
  if (parsedDue.error) {
    return { step: null, error: parsedDue.error };
  }
  const recurrenceRule = getRecurrenceRuleFromForm();

  return {
    step: {
      title,
      description,
      dueDate: dueDateRaw.trim(),
      dueTime: dueTimeRaw,
      dueAtIso: parsedDue.value,
      recurrenceRule,
    },
    error: "",
  };
}

function clearCurrentTaskDraftFields() {
  if (taskTitleInput) {
    taskTitleInput.value = "";
  }
  if (taskDescriptionInput) {
    taskDescriptionInput.value = "";
  }
  if (taskDueInput) {
    taskDueInput.value = "";
  }
  setDueTimeValue("09:00");
  updateDueDateButtonLabel();
  setDueInputExpanded(false);
  updateDueInputVisibility();
  applyRecurrenceRuleToForm("");
}

function resetJourneyDraft() {
  journeyDraftSteps = [];
  if (journeyNameInput) {
    journeyNameInput.value = "";
  }
  renderJourneyDraftList();
}

function renderJourneyDraftList() {
  if (!journeyDraftListEl || !journeyDraftEmptyEl) {
    return;
  }

  journeyDraftListEl.replaceChildren();
  if (!journeyDraftSteps.length) {
    journeyDraftEmptyEl.hidden = false;
    journeyDraftListEl.hidden = true;
    return;
  }

  journeyDraftEmptyEl.hidden = true;
  journeyDraftListEl.hidden = false;

  journeyDraftSteps.forEach((step, index) => {
    const item = document.createElement("li");
    item.className = "template-item journey-draft-item";

    const head = document.createElement("div");
    head.className = "template-item-head journey-draft-head";

    const title = document.createElement("p");
    title.className = "template-item-title";
    title.textContent = `${index + 1}. ${step.title}`;
    head.appendChild(title);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "secondary icon-btn journey-draft-remove-btn";
    removeBtn.setAttribute("aria-label", "Retirer la tâche du parcours");
    removeBtn.title = "Retirer la tâche du parcours";
    removeBtn.innerHTML = `<i class="bi bi-trash" aria-hidden="true"></i>`;
    removeBtn.addEventListener("click", () => {
      journeyDraftSteps.splice(index, 1);
      renderJourneyDraftList();
      setStatus("Tâche retirée du parcours.");
    });
    head.appendChild(removeBtn);

    item.appendChild(head);

    const details = [];
    if (step.description) {
      details.push(step.description.replace(/\n/g, " / "));
    }
    if (step.dueAtIso) {
      details.push(`Échéance ${formatDate(step.dueAtIso)}`);
    }
    const recurrenceLabel = getRecurrenceLabel(step.recurrenceRule || "");
    if (recurrenceLabel) {
      details.push(`Récurrence ${recurrenceLabel}`);
    }

    const meta = document.createElement("p");
    meta.className = "template-item-meta";
    meta.textContent = details.length ? details.join(" - ") : "Sans description ni échéance";
    item.appendChild(meta);
    journeyDraftListEl.appendChild(item);
  });
}

function appendStepToJourneyDraft(stepRecord) {
  const normalizedStep = normalizeJourneyStepRecord(stepRecord);
  if (!normalizedStep) {
    return false;
  }
  journeyDraftSteps.push(normalizedStep);
  renderJourneyDraftList();
  return true;
}

function createTemplateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tpl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function getTemplatesStorageKey(userId) {
  return `${TEMPLATE_STORAGE_PREFIX}:${userId}`;
}

function normalizeTemplateRecord(record) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const type = record.type === "journey" ? "journey" : "single";
  const title = normalizeTaskTitle(String(record.title || ""));
  if (!title) {
    return null;
  }

  const stepsSource = Array.isArray(record.steps) ? record.steps : [];
  const steps = type === "journey"
    ? stepsSource.map((step) => normalizeJourneyStepRecord(step)).filter((step) => Boolean(step))
    : [];
  const description = normalizeTaskDescription(record.description || "");
  const recurrenceRule = type === "single" ? String(record.recurrenceRule || "") : "";
  const dueDate = typeof record.dueDate === "string" ? record.dueDate.trim() : "";
  const dueTime = parseDueTimeTextInput(String(record.dueTime || "")) || "09:00";
  const id = typeof record.id === "string" && record.id.trim().length > 0 ? record.id.trim() : createTemplateId();
  const createdAt = typeof record.createdAt === "string" && record.createdAt ? record.createdAt : new Date().toISOString();

  return {
    id,
    type,
    title,
    steps,
    description,
    recurrenceRule,
    dueDate,
    dueTime,
    createdAt,
  };
}

function loadTemplatesForCurrentUser() {
  if (!currentUser) {
    savedTemplates = [];
    renderJourneyTaskPickerList();
    return;
  }

  const key = getTemplatesStorageKey(currentUser.id);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      savedTemplates = [];
      renderJourneyTaskPickerList();
      return;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      savedTemplates = [];
      renderJourneyTaskPickerList();
      return;
    }
    savedTemplates = parsed
      .map((record) => normalizeTemplateRecord(record))
      .filter((record) => Boolean(record))
      .sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
    renderJourneyTaskPickerList();
  } catch {
    savedTemplates = [];
    renderJourneyTaskPickerList();
    setStatus("Impossible de lire les modèles locaux.", true);
  }
}

function persistTemplatesForCurrentUser() {
  if (!currentUser) {
    return false;
  }

  const key = getTemplatesStorageKey(currentUser.id);
  try {
    window.localStorage.setItem(key, JSON.stringify(savedTemplates));
    return true;
  } catch {
    setStatus("Impossible d'enregistrer les modèles localement.", true);
    return false;
  }
}

function getTaskFormDraft() {
  const title = normalizeTaskTitle(taskTitleInput?.value || "");
  const description = normalizeTaskDescription(taskDescriptionInput?.value || "");
  const dueDateRaw = taskDueInput?.value ?? "";
  const dueTimeRaw = getDueTimeValue();
  const parsedDue = parseDueDateInput(dueDateRaw, dueTimeRaw);
  if (parsedDue.error) {
    return { error: parsedDue.error };
  }

  const recurrence = getRecurrenceRuleFromForm();
  if (!title) {
    return { error: "Le titre de la tâche est requis." };
  }

  return {
    error: "",
    type: "single",
    title,
    description,
    journeySteps: [],
    dueDate: dueDateRaw.trim(),
    dueTime: dueTimeRaw,
    dueAtIso: parsedDue.value,
    recurrenceRule: recurrence,
  };
}

function buildTemplateFromDraft(draft) {
  if (!draft || draft.error) {
    return { template: null, error: draft?.error || "Modèle invalide." };
  }
  if (draft.type === "journey" && draft.journeySteps.length < 2) {
    return { template: null, error: "Un modèle de parcours doit contenir au moins deux étapes." };
  }
  if (draft.type === "journey" && !draft.title) {
    return { template: null, error: "Donnez un nom au parcours pour enregistrer un modèle." };
  }

  const template = {
    id: createTemplateId(),
    type: draft.type,
    title: draft.title,
    steps: draft.type === "journey"
      ? draft.journeySteps
        .map((step) => normalizeJourneyStepRecord(step))
        .filter((step) => Boolean(step))
        .map((step) => ({
          title: step.title,
          description: step.description || "",
          dueDate: step.dueDate || "",
          dueTime: step.dueTime || "09:00",
          recurrenceRule: step.recurrenceRule || "",
        }))
      : [],
    description: draft.type === "single" ? (draft.description || "") : "",
    recurrenceRule: draft.type === "single" ? (draft.recurrenceRule || "") : "",
    dueDate: draft.type === "single" ? (draft.dueDate || "") : "",
    dueTime: draft.type === "single" ? (draft.dueTime || "09:00") : "09:00",
    createdAt: new Date().toISOString(),
  };
  return { template, error: "" };
}

function getTemplateMetaLabel(template) {
  const typeLabel = template.type === "journey"
    ? `Parcours (${template.steps.length} étapes)`
    : "Tâche seule";
  const dueLabel = template.dueDate
    ? ` - Échéance ${formatDueDateLabel(template.dueDate)} ${template.dueTime || ""}`.trimEnd()
    : "";
  const recurrenceLabel = template.type === "single"
    ? getRecurrenceLabel(template.recurrenceRule || "")
    : "";
  const recurrencePart = recurrenceLabel ? ` - ${recurrenceLabel}` : "";
  return `${typeLabel}${dueLabel}${recurrencePart}`;
}

function closeTemplatesOverlay() {
  if (!templatesOverlay || templatesOverlay.hidden) {
    return;
  }
  templatesOverlay.hidden = true;
}

function getSingleTaskTemplates() {
  return savedTemplates.filter((template) => template.type === "single");
}

function closeJourneyTaskPickerOverlay() {
  if (!journeyTaskPickerOverlay || journeyTaskPickerOverlay.hidden) {
    return;
  }
  journeyTaskPickerOverlay.hidden = true;
}

function appendSavedTaskTemplateToJourney(template) {
  if (!template) {
    return;
  }

  const stepTitle = normalizeTaskTitle(String(template.title || ""));
  if (!stepTitle) {
    setStatus("Modèle invalide: titre vide.", true);
    return;
  }

  const stepRecord = normalizeJourneyStepRecord({
    title: stepTitle,
    description: template.description || "",
    dueDate: template.dueDate || "",
    dueTime: template.dueTime || "09:00",
    recurrenceRule: template.recurrenceRule || "",
  });
  if (!stepRecord) {
    setStatus("Modèle invalide: étape non exploitable.", true);
    return;
  }

  appendStepToJourneyDraft(stepRecord);
  journeyNameInput?.focus();
  setStatus(`Étape ajoutée: ${stepTitle}`);
}

function renderJourneyTaskPickerList() {
  if (!journeyTaskPickerListEl || !journeyTaskPickerEmptyEl) {
    return;
  }

  journeyTaskPickerListEl.replaceChildren();
  const taskTemplates = getSingleTaskTemplates();
  if (!taskTemplates.length) {
    journeyTaskPickerEmptyEl.hidden = false;
    return;
  }
  journeyTaskPickerEmptyEl.hidden = true;

  taskTemplates.forEach((template) => {
    const item = document.createElement("li");
    item.className = "template-item";

    const head = document.createElement("div");
    head.className = "template-item-head";

    const title = document.createElement("p");
    title.className = "template-item-title";
    title.textContent = template.title;
    head.appendChild(title);
    item.appendChild(head);

    const meta = document.createElement("p");
    meta.className = "template-item-meta";
    meta.textContent = getTemplateMetaLabel(template);
    item.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "template-item-actions";

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "secondary";
    addBtn.textContent = "Ajouter au parcours";
    addBtn.addEventListener("click", () => {
      appendSavedTaskTemplateToJourney(template);
      closeJourneyTaskPickerOverlay();
    });
    actions.appendChild(addBtn);

    item.appendChild(actions);
    journeyTaskPickerListEl.appendChild(item);
  });
}

function openJourneyTaskPickerOverlay() {
  if (!journeyTaskPickerOverlay) {
    return;
  }
  renderJourneyTaskPickerList();
  journeyTaskPickerOverlay.hidden = false;
}

function applyRecurrenceRuleToForm(rule) {
  if (!taskRecurrenceInput) {
    return;
  }

  if (recurrenceDaysEl) {
    recurrenceDaysEl.querySelectorAll(".recurrence-day-btn").forEach((btn) => {
      btn.setAttribute("aria-pressed", "false");
    });
  }
  setCustomCountValue(1);
  setCustomUnitValue("day");

  const parsed = parseRecurrenceRule(rule || "");
  if (parsed.type === "daily" || parsed.type === "monthly") {
    taskRecurrenceInput.value = parsed.type;
  } else if (parsed.type === "weekly") {
    taskRecurrenceInput.value = parsed.days.length ? "weekly_days" : "weekly";
    if (parsed.days.length && recurrenceDaysEl) {
      parsed.days.forEach((day) => {
        const button = recurrenceDaysEl.querySelector(`.recurrence-day-btn[data-day='${day}']`);
        if (button instanceof HTMLButtonElement) {
          button.setAttribute("aria-pressed", "true");
        }
      });
    }
  } else if (parsed.type === "interval") {
    taskRecurrenceInput.value = "custom";
    setCustomCountValue(parsed.intervalCount || 1);
    setCustomUnitValue(parsed.intervalUnit || "day");
  } else {
    taskRecurrenceInput.value = "";
  }

  setRecurrenceInputExpanded(taskRecurrenceInput.value.trim().length > 0);
  updateRecurrenceInputVisibility();
  updateRecurrenceDaysVisibility();
}

function applyTemplateToTaskForm(template) {
  if (!template || !taskTitleInput) {
    return;
  }

  resetTaskForm();
  if (template.type === "journey") {
    journeyDraftSteps = (Array.isArray(template.steps) ? template.steps : [])
      .map((step) => normalizeJourneyStepRecord(step))
      .filter((step) => Boolean(step));
    if (journeyNameInput) {
      journeyNameInput.value = template.title;
    }
    reopenJourneyAfterTaskForm = false;
    closeTaskForm();
    openJourneyForm(false);
    setStatus(`Modèle chargé: ${template.title}`);
    return;
  }

  openTaskFormForSingleTask();
  taskTitleInput.value = template.title;
  if (taskDescriptionInput) {
    taskDescriptionInput.value = template.description || "";
  }
  if (taskDueInput) {
    taskDueInput.value = template.dueDate || "";
  }
  setDueTimeValue(template.dueTime || "09:00");
  updateDueDateButtonLabel();
  setDueInputExpanded(Boolean(taskDueInput?.value?.trim()));
  updateDueInputVisibility();
  applyRecurrenceRuleToForm(template.recurrenceRule || "");
  setStatus(`Modèle chargé: ${template.title}`);
}

async function createTaskFromTemplate(template) {
  if (!template) {
    return false;
  }
  if (!currentUser) {
    setStatus("Connectez-vous avant de réutiliser un modèle.", true);
    return false;
  }

  let dueAtIso = null;
  if (template.dueDate) {
    const parsedDue = parseDueDateInput(template.dueDate, template.dueTime || "09:00");
    if (parsedDue.error) {
      setStatus(`Modèle invalide: ${parsedDue.error}`, true);
      return false;
    }
    dueAtIso = parsedDue.value;
  }

  if (template.type === "journey") {
    if (!Array.isArray(template.steps) || template.steps.length < 2) {
      setStatus("Ce modèle de parcours doit contenir au moins deux étapes.", true);
      return false;
    }
    return addJourneyTasks(template.steps, dueAtIso, template.title, template.description || "");
  }

  if (template.recurrenceRule && !supportsRecurrence) {
    setStatus("La récurrence n'est pas disponible: ajoutez la colonne recurrence_rule.", true);
    return false;
  }
  return addTask(template.title, dueAtIso, template.recurrenceRule || "", template.description || "");
}

async function useTemplateNow(template) {
  const created = await createTaskFromTemplate(template);
  if (created) {
    setStatus(`Modèle ajouté: ${template.title}`);
  }
}

function deleteTemplate(templateId) {
  savedTemplates = savedTemplates.filter((template) => template.id !== templateId);
  persistTemplatesForCurrentUser();
  renderTemplatesList();
  renderJourneyTaskPickerList();
  setStatus("Modèle supprimé.");
}

function renderTemplatesList() {
  if (!templatesListEl || !templatesEmptyEl) {
    return;
  }

  templatesListEl.replaceChildren();
  if (!savedTemplates.length) {
    templatesEmptyEl.hidden = false;
    return;
  }
  templatesEmptyEl.hidden = true;

  savedTemplates.forEach((template) => {
    const item = document.createElement("li");
    item.className = "template-item";

    const head = document.createElement("div");
    head.className = "template-item-head";

    const title = document.createElement("p");
    title.className = "template-item-title";
    title.textContent = template.title;
    head.appendChild(title);

    item.appendChild(head);

    const meta = document.createElement("p");
    meta.className = "template-item-meta";
    meta.textContent = getTemplateMetaLabel(template);
    item.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "template-item-actions";

    const applyBtn = document.createElement("button");
    applyBtn.type = "button";
    applyBtn.className = "secondary";
    applyBtn.textContent = "Charger";
    applyBtn.addEventListener("click", () => {
      closeTemplatesOverlay();
      applyTemplateToTaskForm(template);
    });
    actions.appendChild(applyBtn);

    const createBtn = document.createElement("button");
    createBtn.type = "button";
    createBtn.className = "secondary";
    createBtn.textContent = "Ajouter";
    createBtn.addEventListener("click", () => {
      void useTemplateNow(template);
    });
    actions.appendChild(createBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "secondary";
    deleteBtn.textContent = "Supprimer";
    deleteBtn.addEventListener("click", () => {
      deleteTemplate(template.id);
    });
    actions.appendChild(deleteBtn);

    item.appendChild(actions);
    templatesListEl.appendChild(item);
  });
}

function openTemplatesOverlay() {
  if (!templatesOverlay) {
    return;
  }
  renderTemplatesList();
  templatesOverlay.hidden = false;
}

function saveTemplateFromCurrentForm() {
  if (!currentUser) {
    setStatus("Connectez-vous avant d'enregistrer un modèle.", true);
    return;
  }

  const draft = getTaskFormDraft();
  if (draft.error) {
    setStatus(draft.error, true);
    return;
  }

  const built = buildTemplateFromDraft(draft);
  if (built.error || !built.template) {
    setStatus(built.error || "Modèle invalide.", true);
    return;
  }

  const duplicateIndex = savedTemplates.findIndex(
    (template) => template.type === built.template.type && template.title.toLowerCase() === built.template.title.toLowerCase()
  );
  if (duplicateIndex >= 0) {
    savedTemplates.splice(duplicateIndex, 1);
  }
  savedTemplates.unshift(built.template);
  if (savedTemplates.length > 80) {
    savedTemplates = savedTemplates.slice(0, 80);
  }
  persistTemplatesForCurrentUser();
  renderTemplatesList();
  renderJourneyTaskPickerList();
  setStatus(`Modèle enregistré: ${built.template.title}`);
}

function generateJourneyId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function encodeJourneyTaskTitle(title, journeyId, step, total, journeyName = "") {
  const normalizedJourneyName = normalizeTaskTitle(journeyName);
  const encodedJourneyName = normalizedJourneyName ? `:${encodeURIComponent(normalizedJourneyName)}` : "";
  return `[[p:${journeyId}:${step}:${total}${encodedJourneyName}]] ${title}`;
}

function parseJourneyTaskTitle(value) {
  if (!value) {
    return null;
  }
  const match = value.match(JOURNEY_TITLE_PATTERN);
  if (!match) {
    return null;
  }

  const step = Number(match[2]);
  const total = Number(match[3]);
  const journeyName = decodeJourneyName(match[4] || "");
  if (!Number.isInteger(step) || !Number.isInteger(total) || step < 1 || total < 1 || step > total) {
    return null;
  }

  return {
    journeyId: match[1],
    step,
    total,
    journeyName,
    title: normalizeTaskTitle(match[5]),
  };
}

function getTaskJourneyMeta(task) {
  if (!task) {
    return null;
  }

  const rawJourneyId = typeof task.journey_id === "string" ? task.journey_id.trim() : String(task.journey_id || "").trim();
  const step = Number(task.journey_step);
  const total = Number(task.journey_total);
  if (rawJourneyId && Number.isInteger(step) && Number.isInteger(total) && step > 0 && total > 0 && step <= total) {
    return {
      journeyId: rawJourneyId,
      step,
      total,
      journeyName: decodeJourneyName(task.journey_name || ""),
      title: normalizeTaskTitle(task.title || ""),
    };
  }

  return parseJourneyTaskTitle(task.title || "");
}

function getTaskDisplayTitle(task) {
  const meta = getTaskJourneyMeta(task);
  if (!meta) {
    return task.title;
  }
  return meta.title || task.title;
}

function getJourneyPendingStepMap(tasks) {
  const pendingStepMap = new Map();
  tasks.forEach((task) => {
    if (task.status !== "pending") {
      return;
    }
    const meta = getTaskJourneyMeta(task);
    if (!meta) {
      return;
    }
    const previousStep = pendingStepMap.get(meta.journeyId);
    if (!Number.isInteger(previousStep) || meta.step < previousStep) {
      pendingStepMap.set(meta.journeyId, meta.step);
    }
  });
  return pendingStepMap;
}

function isTaskBlockedByJourney(task, pendingStepMap = getJourneyPendingStepMap(allTasks)) {
  if (!task || task.status !== "pending") {
    return false;
  }
  const meta = getTaskJourneyMeta(task);
  if (!meta) {
    return false;
  }
  const activeStep = pendingStepMap.get(meta.journeyId);
  if (!Number.isInteger(activeStep)) {
    return false;
  }
  return meta.step > activeStep;
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
  const label = open ? "Masquer les détails" : "Afficher les détails";
  button.setAttribute("aria-expanded", String(open));
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = getDetailsToggleIcon(open);
}

function setupSwipeActions(item, taskId, canAcknowledge, onTap) {
  const minSwipeDistance = 45;
  const maxSwipeDistance = 120;
  const tapThreshold = 8;
  let isDragging = false;
  let startX = 0;
  let offsetX = 0;
  let activePointerId = null;

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
    activePointerId = null;
  };

  const updateOffset = (clientX) => {
    const deltaX = clientX - startX;
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
  };

  const finishSwipe = async () => {
    const shouldAcknowledge = canAcknowledge && offsetX >= minSwipeDistance;
    const shouldDelete = offsetX <= -minSwipeDistance;

    if (shouldAcknowledge) {
      item.classList.remove("swipe-active");
      item.classList.remove("swipe-ready-ack");
      item.classList.remove("swipe-ready-delete");
      setOffset(maxSwipeDistance);
      isDragging = false;
      activePointerId = null;
      await acknowledgeTask(taskId);
      return;
    }

    if (shouldDelete) {
      item.classList.remove("swipe-active");
      item.classList.remove("swipe-ready-ack");
      item.classList.remove("swipe-ready-delete");
      setOffset(-maxSwipeDistance);
      isDragging = false;
      activePointerId = null;
      await deleteTask(taskId);
      return;
    }

    if (Math.abs(offsetX) <= tapThreshold) {
      onTap();
    }
    resetSwipeState();
  };

  const stopTracking = () => {
    item.removeEventListener("pointermove", handlePointerMove);
    item.removeEventListener("pointerup", handlePointerUp);
    item.removeEventListener("pointercancel", handlePointerCancel);
  };

  const handlePointerMove = (event) => {
    if (!isDragging || event.pointerId !== activePointerId) {
      return;
    }
    updateOffset(event.clientX);
    if (Math.abs(offsetX) > 6) {
      event.preventDefault();
    }
  };

  const handlePointerUp = async (event) => {
    if (!isDragging || event.pointerId !== activePointerId) {
      return;
    }
    item.releasePointerCapture(event.pointerId);
    stopTracking();
    await finishSwipe();
  };

  const handlePointerCancel = (event) => {
    if (!isDragging || event.pointerId !== activePointerId) {
      return;
    }
    item.releasePointerCapture(event.pointerId);
    stopTracking();
    resetSwipeState();
  };

  const beginDrag = (event) => {
    isDragging = true;
    activePointerId = event.pointerId;
    startX = event.clientX;
    offsetX = 0;
    item.classList.add("swipe-active");
    item.setPointerCapture(event.pointerId);
    item.addEventListener("pointermove", handlePointerMove);
    item.addEventListener("pointerup", handlePointerUp);
    item.addEventListener("pointercancel", handlePointerCancel);
  };

  item.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.pointerType !== "touch") {
      return;
    }
    if (event.target instanceof Element && event.target.closest("button")) {
      return;
    }
    if (isDragging) {
      return;
    }
    beginDrag(event);
  });

  item.addEventListener("dragstart", (event) => {
    event.preventDefault();
  });
}

function renderTask(task, options = {}) {
  const item = document.createElement("li");
  item.className = "task-item";
  item.classList.add("task-item-swipable");
  const isDone = task.status === "done";
  const journeyMeta = getTaskJourneyMeta(task);
  const displayTitle = getTaskDisplayTitle(task);
  const pendingStepMap = options.pendingStepMap || new Map();
  const isBlocked = !isDone && isTaskBlockedByJourney(task, pendingStepMap);
  const detailsId = `task-details-${task.id}`;

  const mainRow = document.createElement("div");
  mainRow.className = "task-item-main";

  const title = document.createElement("span");
  title.className = "task-title";
  if (isDone) {
    title.classList.add("task-title-done");
  } else if (isBlocked) {
    title.classList.add("task-title-blocked");
  }
  title.textContent = displayTitle;
  mainRow.appendChild(title);

  const rightMeta = document.createElement("div");
  rightMeta.className = "task-right-meta";

  if (isDone) {
    const doneInline = document.createElement("span");
    doneInline.className = "task-done-inline";
    const completedDuration = task.completed_at ? formatCompletedDuration(task.completed_at) : "";
    doneInline.title = task.completed_at ? `Terminée depuis: ${formatDate(task.completed_at)}` : "Tâche terminée";
    doneInline.innerHTML = `
      <svg
        class="task-done-icon"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="14"
        height="14"
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          d="M9.55 18.2a1 1 0 0 1-.7-.29l-4.56-4.56a1 1 0 0 1 1.42-1.42l3.84 3.85 8.74-8.74a1 1 0 1 1 1.42 1.41l-9.45 9.45a1 1 0 0 1-.71.3z"
        />
      </svg>
      <span>${completedDuration}</span>
    `;
    rightMeta.appendChild(doneInline);
  } else if (task.due_at) {
    const dueInline = document.createElement("span");
    dueInline.className = "task-due-inline";
    const dueMs = new Date(task.due_at).getTime();
    if (!Number.isNaN(dueMs) && dueMs < Date.now()) {
      dueInline.classList.add("task-due-overdue");
    }
    dueInline.title = `Échéance: ${formatDate(task.due_at)}`;
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

  if (isBlocked) {
    const blockedInline = document.createElement("span");
    blockedInline.className = "task-locked-inline";
    blockedInline.innerHTML = `<i class="bi bi-lock-fill" aria-hidden="true"></i>`;
    blockedInline.title = "Terminez l'étape précédente pour débloquer cette tâche.";
    rightMeta.appendChild(blockedInline);
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
  const descriptionText = normalizeTaskDescription(task.description || "");
  const descriptionLine = descriptionText
    ? `<div><strong>Description:</strong> ${escapeHtml(descriptionText).replace(/\n/g, "<br />")}</div>`
    : "";
  const dueLine = task.due_at ? `<div><strong>Échéance:</strong> ${formatDate(task.due_at)}</div>` : "";
  const recurrenceLabel = getRecurrenceLabel(task.recurrence_rule || "");
  const recurrenceLine = recurrenceLabel ? `<div><strong>Récurrence:</strong> ${recurrenceLabel}</div>` : "";
  const journeyNamePart = journeyMeta?.journeyName ? `${escapeHtml(journeyMeta.journeyName)} - ` : "";
  const journeyLine = journeyMeta
    ? `<div><strong>Parcours:</strong> ${journeyNamePart}Étape ${journeyMeta.step}/${journeyMeta.total}</div>`
    : "";
  const blockedLine = isBlocked ? "<div><strong>Statut:</strong> Étape verrouillée</div>" : "";
  const completedLine = isDone && task.completed_at ? `<div><strong>Fait le:</strong> ${formatDate(task.completed_at)}</div>` : "";
  detailsPanel.innerHTML = `<div class="task-details-content"><div><strong>Créée le:</strong> ${createdAt}</div>${descriptionLine}${journeyLine}${blockedLine}${dueLine}${recurrenceLine}${completedLine}</div>`;
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
    setupSwipeActions(item, task.id, !isBlocked, toggleDetails);
  } else {
    item.classList.add("task-item-done");
    setupSwipeActions(item, task.id, false, toggleDetails);
  }

  return item;
}

function rankTaskStatus(status) {
  if (status === "pending") {
    return 0;
  }
  if (status === "done") {
    return 1;
  }
  return 2;
}

function compareTasks(a, b, pendingStepMap) {
  const statusDelta = rankTaskStatus(a.status) - rankTaskStatus(b.status);
  if (statusDelta !== 0) {
    return statusDelta;
  }

  if (a.status === "pending" && b.status === "pending") {
    const metaA = getTaskJourneyMeta(a);
    const metaB = getTaskJourneyMeta(b);
    if (metaA && metaB && metaA.journeyId === metaB.journeyId && metaA.step !== metaB.step) {
      return metaA.step - metaB.step;
    }

    const blockedA = isTaskBlockedByJourney(a, pendingStepMap);
    const blockedB = isTaskBlockedByJourney(b, pendingStepMap);
    if (blockedA !== blockedB) {
      return blockedA ? 1 : -1;
    }
  }

  if (a.status === "done" && b.status === "done") {
    const completedA = a.completed_at ? new Date(a.completed_at).getTime() : 0;
    const completedB = b.completed_at ? new Date(b.completed_at).getTime() : 0;
    if (completedA !== completedB) {
      return completedB - completedA;
    }
  }

  const dueA = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
  const dueB = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
  if (dueA !== dueB) {
    return dueA - dueB;
  }
  const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
  const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
  return createdB - createdA;
}

function renderFilteredTasks() {
  taskListEl.replaceChildren();
  const pendingStepMap = getJourneyPendingStepMap(allTasks);

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
    .sort((a, b) => compareTasks(a, b, pendingStepMap));

  let visibleTasks = filtered;
  if (focusCurrentTaskMode && !showPending && !showHistory) {
    const currentTask = allTasks
      .filter((task) => task.status === "pending")
      .sort((a, b) => compareTasks(a, b, pendingStepMap))
      .find(
      (task) => task.status === "pending" && !isTaskBlockedByJourney(task, pendingStepMap)
      );
    visibleTasks = currentTask ? [currentTask] : [];
  }

  visibleTasks.forEach((task) => taskListEl.appendChild(renderTask(task, { pendingStepMap })));

  if (!allTasks.length) {
    resetTaskList("Aucune tâche.");
    return;
  }

  if (!visibleTasks.length) {
    if (focusCurrentTaskMode && !showPending && !showHistory) {
      resetTaskList("Aucune tâche en cours.");
      return;
    }
    resetTaskList("Aucune tâche pour ce filtre.");
  }
}

function authDbHint(operation) {
  return `${operation}: vérifiez que la table tasks contient user_id (uuid) et que les policies RLS sont configurées pour auth.uid().`;
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

function openCreateTypeOverlay() {
  if (!createTypeOverlay) {
    return;
  }
  createTypeOverlay.hidden = false;
}

function closeCreateTypeOverlay() {
  if (!createTypeOverlay || createTypeOverlay.hidden) {
    return;
  }
  createTypeOverlay.hidden = true;
}

function openJourneyForm(resetDraft = true) {
  if (!journeyFormOverlay) {
    return;
  }
  closeCreateTypeOverlay();
  if (resetDraft) {
    resetJourneyDraft();
  } else {
    renderJourneyDraftList();
  }
  journeyFormOverlay.hidden = false;
  journeyNameInput?.focus();
}

function closeJourneyForm(resetDraft = true) {
  closeJourneyTaskPickerOverlay();
  if (journeyFormOverlay) {
    journeyFormOverlay.hidden = true;
  }
  if (resetDraft) {
    resetJourneyDraft();
  }
}

function updateTaskFormModeUi() {
  const isJourneyStep = taskFormMode === "journey_step";
  if (taskFormTitleEl) {
    taskFormTitleEl.textContent = isJourneyStep ? "Ajouter une tâche au parcours" : "Nouvelle tâche";
  }
  if (submitTaskFormBtn) {
    submitTaskFormBtn.textContent = isJourneyStep ? "Ajouter au parcours" : "Ajouter";
  }
}

function resetTaskForm() {
  if (!taskFormEl) {
    return;
  }
  taskFormEl.reset();
  updateDueDateButtonLabel();
  setDueTimeValue("09:00");
  setCustomCountValue(1);
  setCustomUnitValue("day");
  closeDueTimePicker();
  setDueInputExpanded(false);
  updateDueInputVisibility();
  setRecurrenceInputExpanded(false);
  updateRecurrenceInputVisibility();
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
  updateDueDateButtonLabel();
  setDueTimeValue(getDueTimeValue());
  setDueInputExpanded(false);
  updateDueInputVisibility();
  setRecurrenceInputExpanded(false);
  updateRecurrenceInputVisibility();
  updateRecurrenceDaysVisibility();
  updateTaskFormModeUi();
  taskFormOverlay.hidden = false;
  taskTitleInput.focus();
}

function openTaskFormForSingleTask() {
  taskFormMode = "single";
  reopenJourneyAfterTaskForm = false;
  closeCreateTypeOverlay();
  resetTaskForm();
  openTaskForm();
}

function openTaskFormForJourneyStep() {
  if (!journeyFormOverlay) {
    return;
  }
  taskFormMode = "journey_step";
  reopenJourneyAfterTaskForm = true;
  journeyFormOverlay.hidden = true;
  resetTaskForm();
  openTaskForm();
}

function closeTaskForm() {
  closeJourneyTaskPickerOverlay();
  if (!taskFormOverlay) {
    return;
  }
  const shouldReopenJourney = reopenJourneyAfterTaskForm;
  taskFormOverlay.hidden = true;
  resetTaskForm();
  taskFormMode = "single";
  reopenJourneyAfterTaskForm = false;
  updateTaskFormModeUi();
  if (shouldReopenJourney && currentUser) {
    openJourneyForm(false);
  }
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
    resetTaskList("Connectez-vous pour voir vos tâches.");
    return;
  }

  const selectedColumns = ["id", "title", "status", "created_at", "completed_at", "user_id"];
  if (supportsDueDate) {
    selectedColumns.push("due_at");
  }
  if (supportsRecurrence) {
    selectedColumns.push("recurrence_rule");
  }
  if (supportsDescription) {
    selectedColumns.push("description");
  }
  if (supportsJourneyColumns) {
    selectedColumns.push("journey_id", "journey_name", "journey_step", "journey_total");
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
      (supportsRecurrence && error.message.toLowerCase().includes("recurrence_rule")) ||
      (supportsDescription && error.message.toLowerCase().includes("description")) ||
      (supportsJourneyColumns && hasJourneyColumnsError(error.message)))
  ) {
    if (error.message.toLowerCase().includes("due_at")) {
      supportsDueDate = false;
    }
    if (error.message.toLowerCase().includes("recurrence_rule")) {
      supportsRecurrence = false;
    }
    if (error.message.toLowerCase().includes("description")) {
      supportsDescription = false;
    }
    if (hasJourneyColumnsError(error.message)) {
      supportsJourneyColumns = false;
    }

    const fallbackColumns = ["id", "title", "status", "created_at", "completed_at", "user_id"];
    if (supportsDueDate) {
      fallbackColumns.push("due_at");
    }
    if (supportsRecurrence) {
      fallbackColumns.push("recurrence_rule");
    }
    if (supportsDescription) {
      fallbackColumns.push("description");
    }
    if (supportsJourneyColumns) {
      fallbackColumns.push("journey_id", "journey_name", "journey_step", "journey_total");
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
        setStatus("La colonne due_at est absente. Ajoutez-la pour activer les échéances.");
      } else if (!supportsRecurrence) {
        setStatus("La colonne recurrence_rule est absente. Ajoutez-la pour activer la récurrence.");
      } else if (!supportsDescription) {
        setStatus("La colonne description est absente. Ajoutez-la pour activer les descriptions.");
      } else if (!supportsJourneyColumns) {
        setStatus("Les colonnes de parcours sont absentes. Ajoutez journey_id, journey_name, journey_step, journey_total.");
      }
    }
  }

  if (error) {
    const needsUserColumn = error.message && error.message.toLowerCase().includes("user_id");
    const needsDueColumn = error.message && error.message.toLowerCase().includes("due_at");
    const needsRecurrenceColumn = error.message && error.message.toLowerCase().includes("recurrence_rule");
    const needsDescriptionColumn = error.message && error.message.toLowerCase().includes("description");
    const needsJourneyColumn = hasJourneyColumnsError(error.message || "");
    setStatus(
      needsUserColumn
        ? authDbHint("Erreur de lecture")
        : needsDueColumn
          ? "Erreur de lecture: la colonne due_at est requise pour les échéances."
          : needsRecurrenceColumn
            ? "Erreur de lecture: la colonne recurrence_rule est requise pour la récurrence."
            : needsDescriptionColumn
              ? "Erreur de lecture: la colonne description est requise pour les descriptions."
              : needsJourneyColumn
                ? "Erreur de lecture: colonnes parcours requises (journey_id, journey_name, journey_step, journey_total)."
          : `Erreur de lecture: ${error.message}`,
      true
    );
    return;
  }

  allTasks = data;
  renderFilteredTasks();
}

async function addTask(title, dueAtIso = null, recurrence = "", description = "") {
  if (!currentUser) {
    setStatus("Connectez-vous avant d'ajouter une tâche.", true);
    return false;
  }

  const normalizedTitle = normalizeTaskTitle(title);
  const normalizedDescription = normalizeTaskDescription(description);
  if (!normalizedTitle) {
    setStatus("Le titre de la tâche est requis.", true);
    return false;
  }

  const payload = {
    title: normalizedTitle,
    status: "pending",
    user_id: currentUser.id,
  };
  if (supportsDueDate && dueAtIso) {
    payload.due_at = dueAtIso;
  }
  if (supportsRecurrence && recurrence) {
    payload.recurrence_rule = recurrence;
  }
  if (supportsDescription && normalizedDescription) {
    payload.description = normalizedDescription;
  }

  const { error } = await supabaseClient.from("tasks").insert(payload);

  if (error) {
    const needsUserColumn = error.message && error.message.toLowerCase().includes("user_id");
    const needsDueColumn = error.message && error.message.toLowerCase().includes("due_at");
    const needsRecurrenceColumn = error.message && error.message.toLowerCase().includes("recurrence_rule");
    const needsDescriptionColumn = error.message && error.message.toLowerCase().includes("description");
    if (needsDueColumn) {
      supportsDueDate = false;
      setStatus("Erreur d'ajout: la colonne due_at est absente. Ajoutez-la pour stocker les échéances.", true);
      return false;
    }
    if (needsRecurrenceColumn) {
      supportsRecurrence = false;
      setStatus("Erreur d'ajout: la colonne recurrence_rule est absente. Ajoutez-la pour stocker la récurrence.", true);
      return false;
    }
    if (needsDescriptionColumn) {
      supportsDescription = false;
      setStatus("Erreur d'ajout: la colonne description est absente. Ajoutez-la pour stocker les descriptions.", true);
      return false;
    }
    setStatus(needsUserColumn ? authDbHint("Erreur d'ajout") : `Erreur d'ajout: ${error.message}`, true);
    return false;
  }

  await fetchTasks();
  return true;
}

async function addJourneyTasks(stepDefinitions, dueAtIso = null, journeyName = "", description = "") {
  if (!currentUser) {
    setStatus("Connectez-vous avant d'ajouter une tâche.", true);
    return false;
  }

  const normalizedSteps = (Array.isArray(stepDefinitions) ? stepDefinitions : [])
    .map((step) => normalizeJourneyStepRecord(step))
    .filter((step) => Boolean(step));
  const normalizedJourneyName = normalizeTaskTitle(journeyName);
  const normalizedDescription = normalizeTaskDescription(description);
  if (!normalizedJourneyName) {
    setStatus("Le nom du parcours est requis.", true);
    return false;
  }
  if (normalizedSteps.length < 2) {
    setStatus("Le parcours doit contenir au moins deux tâches.", true);
    return false;
  }

  const journeyId = generateJourneyId();
  const totalSteps = normalizedSteps.length;
  const buildPayload = (useJourneyColumns) => (
    normalizedSteps.map((step, index) => {
      const row = {
        title: useJourneyColumns
          ? step.title
          : encodeJourneyTaskTitle(step.title, journeyId, index + 1, totalSteps, normalizedJourneyName),
        status: "pending",
        user_id: currentUser.id,
      };

      if (useJourneyColumns) {
        row.journey_id = journeyId;
        row.journey_name = normalizedJourneyName;
        row.journey_step = index + 1;
        row.journey_total = totalSteps;
      }

      const resolvedDueAt = step.dueAtIso || dueAtIso;
      if (supportsDueDate && resolvedDueAt) {
        row.due_at = resolvedDueAt;
      }
      const resolvedDescription = step.description || normalizedDescription;
      if (supportsDescription && resolvedDescription) {
        row.description = resolvedDescription;
      }
      const resolvedRecurrence = String(step.recurrenceRule || "").trim();
      if (supportsRecurrence && resolvedRecurrence) {
        row.recurrence_rule = resolvedRecurrence;
      }
      return row;
    })
  );

  let payload = buildPayload(supportsJourneyColumns);
  let { error } = await supabaseClient.from("tasks").insert(payload);
  if (error && supportsJourneyColumns && hasJourneyColumnsError(error.message)) {
    supportsJourneyColumns = false;
    payload = buildPayload(false);
    const fallbackInsert = await supabaseClient.from("tasks").insert(payload);
    error = fallbackInsert.error;
    if (!error) {
      setStatus("Colonnes parcours absentes: mode compatibilité active (encodage dans le titre).");
    }
  }

  if (error) {
    const needsUserColumn = error.message && error.message.toLowerCase().includes("user_id");
    const needsDueColumn = error.message && error.message.toLowerCase().includes("due_at");
    const needsRecurrenceColumn = error.message && error.message.toLowerCase().includes("recurrence_rule");
    const needsDescriptionColumn = error.message && error.message.toLowerCase().includes("description");
    const needsJourneyColumn = hasJourneyColumnsError(error.message || "");
    if (needsDueColumn) {
      supportsDueDate = false;
      setStatus("Erreur d'ajout: la colonne due_at est absente. Ajoutez-la pour stocker les échéances.", true);
      return false;
    }
    if (needsDescriptionColumn) {
      supportsDescription = false;
      setStatus("Erreur d'ajout: la colonne description est absente. Ajoutez-la pour stocker les descriptions.", true);
      return false;
    }
    if (needsRecurrenceColumn) {
      supportsRecurrence = false;
      setStatus("Erreur d'ajout: la colonne recurrence_rule est absente. Ajoutez-la pour stocker la récurrence.", true);
      return false;
    }
    if (needsJourneyColumn) {
      supportsJourneyColumns = false;
      setStatus(
        "Erreur d'ajout: colonnes parcours absentes (journey_id, journey_name, journey_step, journey_total).",
        true
      );
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
  if (sourceTask && isTaskBlockedByJourney(sourceTask)) {
    setStatus("Terminez d'abord l'étape précédente du parcours.", true);
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

  const recurrence = sourceTask?.recurrence_rule || "";
  if (recurrence && sourceTask) {
    const nextPayload = {
      title: sourceTask.title,
      status: "pending",
      user_id: currentUser.id,
    };

    if (supportsDescription && sourceTask.description) {
      nextPayload.description = sourceTask.description;
    }

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
      if (recurrenceError.message && recurrenceError.message.toLowerCase().includes("description")) {
        supportsDescription = false;
      }
      setStatus(`Erreur de récurrence: ${recurrenceError.message}`, true);
    }
  }

  await fetchTasks();
}

async function deleteTask(id) {
  if (!currentUser) {
    setStatus("Session invalide. Reconnectez-vous.", true);
    return;
  }

  const previousTasks = allTasks;
  allTasks = allTasks.filter((task) => task.id !== id);
  renderFilteredTasks();

  const { error } = await supabaseClient.from("tasks").delete().eq("id", id).eq("user_id", currentUser.id);

  if (error) {
    allTasks = previousTasks;
    renderFilteredTasks();
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
    setStatus(`Erreur de déconnexion: ${error.message}`, true);
    return;
  }

  setStatus("Session fermée.");
}

async function handleSession(session) {
  currentUser = session?.user ?? null;

  if (!currentUser) {
    allTasks = [];
    savedTemplates = [];
    closeCreateTypeOverlay();
    closeTaskForm();
    closeJourneyForm(true);
    closeTemplatesOverlay();
    closeJourneyTaskPickerOverlay();
    if (settingsMenu) {
      settingsMenu.hidden = true;
      settingsMenu.open = false;
    }
    setAccountInfo(null);
    logoutBtn.hidden = true;
    setAddTaskEnabled(false);
    resetTaskList("Connectez-vous pour voir vos tâches.");
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
  loadTemplatesForCurrentUser();

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
      setStatus("Connectez-vous avant d'ajouter une tâche.", true);
      return;
    }
    openCreateTypeOverlay();
  });
}

if (createSingleTaskBtn) {
  createSingleTaskBtn.addEventListener("click", () => {
    openTaskFormForSingleTask();
  });
}

if (createJourneyBtn) {
  createJourneyBtn.addEventListener("click", () => {
    closeCreateTypeOverlay();
    openJourneyForm(true);
  });
}

if (cancelCreateTypeBtn) {
  cancelCreateTypeBtn.addEventListener("click", () => {
    closeCreateTypeOverlay();
  });
}

if (createTypeOverlay) {
  createTypeOverlay.addEventListener("click", (event) => {
    if (event.target === createTypeOverlay) {
      closeCreateTypeOverlay();
    }
  });
}

if (openTemplatesBtn) {
  openTemplatesBtn.addEventListener("click", () => {
    if (!supabaseClient || !currentUser) {
      setStatus("Connectez-vous avant d'utiliser les modèles.", true);
      return;
    }
    openTemplatesOverlay();
  });
}

if (saveTemplateBtn) {
  saveTemplateBtn.addEventListener("click", () => {
    saveTemplateFromCurrentForm();
  });
}

if (addSavedTaskToJourneyBtn) {
  addSavedTaskToJourneyBtn.addEventListener("click", () => {
    if (!supabaseClient || !currentUser) {
      setStatus("Connectez-vous avant d'ajouter une tâche enregistrée.", true);
      return;
    }
    openJourneyTaskPickerOverlay();
  });
}

if (addTaskToJourneyBtn) {
  addTaskToJourneyBtn.addEventListener("click", () => {
    if (!supabaseClient || !currentUser) {
      setStatus("Connectez-vous avant d'ajouter une tâche au parcours.", true);
      return;
    }
    openTaskFormForJourneyStep();
  });
}

if (journeyFormEl) {
  journeyFormEl.addEventListener("submit", async (event) => {
    event.preventDefault();

    const normalizedSteps = journeyDraftSteps
      .map((step) => normalizeJourneyStepRecord(step))
      .filter((step) => Boolean(step));
    if (normalizedSteps.length < 2) {
      setStatus("Le parcours doit contenir au moins deux tâches.", true);
      return;
    }

    const journeyName = normalizeTaskTitle(journeyNameInput?.value || "");
    const added = await addJourneyTasks(normalizedSteps, null, journeyName, "");
    if (added) {
      closeJourneyForm(true);
      setStatus(journeyName ? `Parcours ajouté: ${journeyName}` : "Parcours ajouté.");
    }
  });
}

if (cancelJourneyFormBtn) {
  cancelJourneyFormBtn.addEventListener("click", () => {
    closeJourneyForm(true);
  });
}

if (journeyFormOverlay) {
  journeyFormOverlay.addEventListener("click", (event) => {
    if (event.target === journeyFormOverlay) {
      closeJourneyForm(true);
    }
  });
}

if (taskFormEl) {
  taskFormEl.addEventListener("submit", async (event) => {
    event.preventDefault();

    const draft = getTaskFormDraft();
    if (draft.error) {
      setStatus(draft.error, true);
      return;
    }

    if (draft.recurrenceRule && !supportsRecurrence) {
      setStatus("La récurrence n'est pas disponible: ajoutez la colonne recurrence_rule.", true);
      return;
    }

    if (taskFormMode === "journey_step") {
      const addedStep = appendStepToJourneyDraft({
        title: draft.title,
        description: draft.description,
        dueDate: draft.dueDate,
        dueTime: draft.dueTime,
        dueAtIso: draft.dueAtIso,
        recurrenceRule: draft.recurrenceRule,
      });
      if (!addedStep) {
        setStatus("Tâche invalide.", true);
        return;
      }
      closeTaskForm();
      setStatus(`Tâche ajoutée au parcours (${journeyDraftSteps.length}).`);
      return;
    }

    const added = await addTask(draft.title, draft.dueAtIso, draft.recurrenceRule, draft.description);
    if (added) {
      closeTaskForm();
    }
  });
}

if (toggleDueInputBtn && taskDueInput) {
  toggleDueInputBtn.addEventListener("click", () => {
    setDueInputExpanded(true);
    updateDueInputVisibility();
    openDueDatePicker();
  });
}

if (taskDueInput) {
  const handleDueDateValueChange = () => {
    setDueInputExpanded(taskDueInput.value.trim().length > 0);
    updateDueInputVisibility();
    updateDueDateButtonLabel();
  };
  taskDueInput.addEventListener("input", handleDueDateValueChange);
  taskDueInput.addEventListener("change", handleDueDateValueChange);
}

if (taskDueDateBtn) {
  taskDueDateBtn.addEventListener("click", () => {
    openDueDatePicker();
  });
}

if (taskDateCard) {
  taskDateCard.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest("#taskDueDateBtn")) {
      return;
    }
    openDueDatePicker();
  });
  taskDateCard.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDueDatePicker();
    }
  });
}

if (taskTimeCard) {
  taskTimeCard.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest("#taskDueTimeWheelBtn")) {
      return;
    }
    openDueTimePicker();
  });
  taskTimeCard.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDueTimePicker();
    }
  });
}

if (taskDueTimeWheelBtn) {
  taskDueTimeWheelBtn.addEventListener("click", () => {
    setDueInputExpanded(true);
    updateDueInputVisibility();
    openDueTimePicker();
  });
}

if (cancelDueTimeBtn) {
  cancelDueTimeBtn.addEventListener("click", () => {
    closeDueTimePicker();
  });
}

if (confirmDueTimeBtn) {
  confirmDueTimeBtn.addEventListener("click", () => {
    const parsedTime = parseDueTimeTextInput(dueTimeTextInput?.value ?? "");
    if (!parsedTime) {
      if (dueTimeErrorEl) {
        dueTimeErrorEl.textContent = "Heure invalide. Utilisez HH:MM (ex: 09:00).";
      }
      dueTimeTextInput?.focus();
      return;
    }
    if (dueTimeErrorEl) {
      dueTimeErrorEl.textContent = "";
    }
    setDueTimeValue(parsedTime);
    closeDueTimePicker();
  });
}

if (dueTimeTextInput) {
  dueTimeTextInput.addEventListener("input", () => {
    dueTimeTextInput.value = formatDueTimeTyping(dueTimeTextInput.value);
    if (dueTimeErrorEl) {
      dueTimeErrorEl.textContent = "";
    }
  });
}

if (dueTimeOverlay) {
  dueTimeOverlay.addEventListener("click", (event) => {
    if (event.target === dueTimeOverlay) {
      closeDueTimePicker();
    }
  });
}

if (taskRecurrenceInput) {
  taskRecurrenceInput.addEventListener("change", () => {
    setRecurrenceInputExpanded(taskRecurrenceInput.value.trim().length > 0);
    updateRecurrenceInputVisibility();
    updateRecurrenceDaysVisibility();
  });
}

if (customCountInput) {
  customCountInput.addEventListener("focus", () => {
    if (customCountInput.value === "1") {
      customCountInput.value = "";
    }
  });

  customCountInput.addEventListener("input", () => {
    if (!customCountInput.value.trim()) {
      return;
    }
    setCustomCountValue(getCustomCountValue());
  });

  customCountInput.addEventListener("blur", () => {
    if (!customCountInput.value.trim()) {
      setCustomCountValue(1);
    }
  });
}

if (toggleRecurrenceInputBtn && taskRecurrenceInput) {
  toggleRecurrenceInputBtn.addEventListener("click", () => {
    setRecurrenceInputExpanded(true);
    updateRecurrenceInputVisibility();
    openRecurrencePicker();
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

if (closeTemplatesBtn) {
  closeTemplatesBtn.addEventListener("click", () => {
    closeTemplatesOverlay();
  });
}

if (templatesOverlay) {
  templatesOverlay.addEventListener("click", (event) => {
    if (event.target === templatesOverlay) {
      closeTemplatesOverlay();
    }
  });
}

if (closeJourneyTaskPickerBtn) {
  closeJourneyTaskPickerBtn.addEventListener("click", () => {
    closeJourneyTaskPickerOverlay();
  });
}

if (journeyTaskPickerOverlay) {
  journeyTaskPickerOverlay.addEventListener("click", (event) => {
    if (event.target === journeyTaskPickerOverlay) {
      closeJourneyTaskPickerOverlay();
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
updateDueDateButtonLabel();
setDueTimeValue(getDueTimeValue());
setCustomCountValue(1);
setCustomUnitValue("day");
setDueInputExpanded(false);
updateDueInputVisibility();
setRecurrenceInputExpanded(false);
updateRecurrenceInputVisibility();
updateRecurrenceDaysVisibility();
taskFormMode = "single";
reopenJourneyAfterTaskForm = false;
updateTaskFormModeUi();
savedTemplates = [];
renderTemplatesList();
renderJourneyTaskPickerList();
renderJourneyDraftList();
resetTaskList("Connectez-vous pour voir vos tâches.");
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
