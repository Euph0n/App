const statusEl = document.getElementById("status");
const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const pendingTasksEl = document.getElementById("pendingTasks");
const historyTasksEl = document.getElementById("historyTasks");

let supabaseClient;

const SUPABASE_URL = "https://pikgsutwilxhblphynax.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpa2dzdXR3aWx4aGJscGh5bmF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NjY1NDcsImV4cCI6MjA4NzI0MjU0N30.gCPo21F6gpAGokux0CfgR_JDNHBr8vGOtiFdF6mQ4qY";

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

async function fetchTasks() {
  if (!supabaseClient) {
    setStatus("Connexion Supabase non initialisee.", true);
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
    pendingTasksEl.innerHTML = "<li>Aucune tache en cours.</li>";
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

  setStatus("Tache ajoutee.");
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

  setStatus("Tache acquittee.");
  await fetchTasks();
}

function initSupabase() {
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
  fetchTasks();
}

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
