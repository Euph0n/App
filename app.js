const taskForm = document.getElementById("task-form");
const taskInput = document.getElementById("task-input");
const taskList = document.getElementById("task-list");
const summaryText = document.getElementById("summary-text");
const clearDoneBtn = document.getElementById("clear-done");
const statusText = document.getElementById("status-text");
const filterButtons = [...document.querySelectorAll(".filter-btn")];

let tasks = [];
let activeFilter = "all";
let busy = false;

void boot();

taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const title = taskInput.value.trim();
  if (!title) return;

  await withBusy(async () => {
    await api("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    taskInput.value = "";
    await loadTasks();
  });
});

clearDoneBtn.addEventListener("click", async () => {
  await withBusy(async () => {
    await api("/api/tasks?done=true", { method: "DELETE" });
    await loadTasks();
  });
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((b) => b.classList.toggle("active", b === button));
    render();
  });
});

async function boot() {
  try {
    await loadTasks();
    setStatus("Connecte au serveur.", true);
  } catch (error) {
    setStatus(`Erreur serveur: ${error.message}`, false);
  }
}

async function loadTasks() {
  tasks = await api("/api/tasks");
  render();
}

function render() {
  const filteredTasks = tasks.filter((task) => {
    if (activeFilter === "active") return !task.done;
    if (activeFilter === "done") return task.done;
    return true;
  });

  taskList.innerHTML = "";

  if (filteredTasks.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "Aucune tache dans ce filtre.";
    taskList.appendChild(empty);
  } else {
    filteredTasks.forEach((task) => taskList.appendChild(buildTaskItem(task)));
  }

  const doneCount = tasks.filter((task) => task.done).length;
  summaryText.textContent = `${tasks.length} tache(s) au total, ${doneCount} acquittee(s).`;
}

function buildTaskItem(task) {
  const item = document.createElement("li");
  item.className = "task-item";

  const main = document.createElement("div");
  main.className = "task-main";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = task.done;
  checkbox.setAttribute("aria-label", `Acquitter ${task.title}`);
  checkbox.addEventListener("change", async () => {
    await withBusy(async () => {
      await api(`/api/tasks/${task.id}/toggle`, {
        method: "PATCH",
        body: JSON.stringify({ done: checkbox.checked }),
      });
      await loadTasks();
    });
  });

  const textWrap = document.createElement("div");

  const text = document.createElement("div");
  text.className = `task-text${task.done ? " done" : ""}`;
  text.textContent = task.title;

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = task.done
    ? `Acquittee le ${formatDate(task.doneAt)}`
    : `Creee le ${formatDate(task.createdAt)}`;

  textWrap.append(text, meta);
  main.append(checkbox, textWrap);

  const removeBtn = document.createElement("button");
  removeBtn.className = "delete-btn";
  removeBtn.type = "button";
  removeBtn.textContent = "Supprimer";
  removeBtn.addEventListener("click", async () => {
    await withBusy(async () => {
      await api(`/api/tasks/${task.id}`, { method: "DELETE" });
      await loadTasks();
    });
  });

  item.append(main, removeBtn);
  return item;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Erreur API");
  }

  return data;
}

async function withBusy(action) {
  setBusy(true);
  try {
    await action();
    setStatus("Synchronise.", true);
  } catch (error) {
    setStatus(`Erreur serveur: ${error.message}`, false);
  } finally {
    setBusy(false);
  }
}

function setBusy(value) {
  busy = value;
  taskInput.disabled = busy;
  clearDoneBtn.disabled = busy;
  taskForm.querySelector("button[type='submit']").disabled = busy;
}

function setStatus(message, ok) {
  statusText.textContent = message;
  statusText.classList.toggle("ok", ok);
  statusText.classList.toggle("error", !ok);
}

function formatDate(iso) {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
