const statusEl = document.getElementById("status");
const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const pendingTasksEl = document.getElementById("pendingTasks");
const historyTasksEl = document.getElementById("historyTasks");
const configDialog = document.getElementById("configDialog");
const configForm = document.getElementById("configForm");
const configureBtn = document.getElementById("configureBtn");

let supabaseClient;

function getConfig() {
  return {
    url: localStorage.getItem("supabase_url") || "",
    key: localStorage.getItem("supabase_key") || "",
  };
}

function saveConfig(url, key) {
  localStorage.setItem("supabase_url", url);
  localStorage.setItem("supabase_key", key);
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#fca5a5" : "#86efac";
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
  content.innerHTML = `<strong>${task.title}</strong><div class="task-meta">Créée le ${formatDate(
    task.created_at
  )}${history ? ` • Acquittée le ${formatDate(task.completed_at)}` : ""}</div>`;

  item.appendChild(content);

  if (!history) {
    const button = document.createElement("button");
    button.textContent = "Acquitter";
    button.addEventListener("click", () => acknowledgeTask(task.id));
    item.appendChild(button);
  }

  return item;
}

async function fetchTasks() {
  if (!supabaseClient) {
    setStatus("Configurez Supabase pour commencer.", true);
    return;
  }

  const { data, error } = await supabaseClient
    .from("tasks")
    .select("id,title,status,created_at,completed_at")
    .order("created_at", { ascending: false });

  if (error) {
    setStatus(`Erreur de lecture: ${error.message}`, true);
    return;
  }

  pendingTasksEl.replaceChildren();
  historyTasksEl.replaceChildren();

  const pending = data.filter((task) => task.status === "pending");
  const history = data.filter((task) => task.status === "done");

  pending.forEach((task) => pendingTasksEl.appendChild(renderTask(task)));
  history.forEach((task) => historyTasksEl.appendChild(renderTask(task, true)));

  if (!pending.length) {
    pendingTasksEl.innerHTML = "<li>Aucune tâche en cours.</li>";
  }

  if (!history.length) {
    historyTasksEl.innerHTML = "<li>Historique vide.</li>";
  }
}

async function addTask(title) {
  const { error } = await supabaseClient.from("tasks").insert({
    title,
    status: "pending",
  });

  if (error) {
    setStatus(`Erreur d'ajout: ${error.message}`, true);
    return;
  }

  setStatus("Tâche ajoutée.");
  await fetchTasks();
}

async function acknowledgeTask(id) {
  const { error } = await supabaseClient
    .from("tasks")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    setStatus(`Erreur d'acquittement: ${error.message}`, true);
    return;
  }

  setStatus("Tâche acquittée.");
  await fetchTasks();
}

function initSupabase() {
  const { url, key } = getConfig();
  if (!url || !key) {
    setStatus("Cliquez sur 'Configurer Supabase' pour connecter la base.", true);
    return;
  }

  supabaseClient = window.supabase.createClient(url, key);
  setStatus("Connexion Supabase prête.");
  fetchTasks();
}

configureBtn.addEventListener("click", () => {
  const { url, key } = getConfig();
  document.getElementById("urlInput").value = url;
  document.getElementById("keyInput").value = key;
  configDialog.showModal();
});

configForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const url = document.getElementById("urlInput").value.trim();
  const key = document.getElementById("keyInput").value.trim();
  saveConfig(url, key);
  configDialog.close();
  initSupabase();
});

taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = taskInput.value.trim();
  if (!title || !supabaseClient) {
    return;
  }

  await addTask(title);
  taskInput.value = "";
});

initSupabase();
