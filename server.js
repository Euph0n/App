const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = __dirname;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT_DIR, "data"));
const DATA_FILE = path.join(DATA_DIR, "tasks.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    await handleStatic(res, url.pathname);
  } catch (error) {
    sendJson(res, 500, { error: "Erreur interne du serveur." });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Serveur demarre sur http://${HOST}:${PORT}`);
});

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/tasks") {
    const tasks = await readTasks();
    sendJson(res, 200, tasks);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/tasks") {
    const body = await readBody(req);
    const title = (body.title || "").trim();

    if (!title) {
      sendJson(res, 400, { error: "Le titre est obligatoire." });
      return;
    }

    const tasks = await readTasks();
    tasks.unshift({
      id: randomUUID(),
      title,
      done: false,
      createdAt: new Date().toISOString(),
      doneAt: null,
    });

    await writeTasks(tasks);
    sendJson(res, 201, { ok: true });
    return;
  }

  const toggleMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/toggle$/);
  if (req.method === "PATCH" && toggleMatch) {
    const taskId = toggleMatch[1];
    const body = await readBody(req);
    const done = Boolean(body.done);

    const tasks = await readTasks();
    const task = tasks.find((item) => item.id === taskId);
    if (!task) {
      sendJson(res, 404, { error: "Tache introuvable." });
      return;
    }

    task.done = done;
    task.doneAt = done ? new Date().toISOString() : null;
    await writeTasks(tasks);
    sendJson(res, 200, { ok: true });
    return;
  }

  const deleteMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (req.method === "DELETE" && deleteMatch) {
    const taskId = deleteMatch[1];
    const tasks = await readTasks();
    const nextTasks = tasks.filter((item) => item.id !== taskId);

    await writeTasks(nextTasks);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "DELETE" && url.pathname === "/api/tasks" && url.searchParams.get("done") === "true") {
    const tasks = await readTasks();
    const nextTasks = tasks.filter((item) => !item.done);

    await writeTasks(nextTasks);
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: "Route API introuvable." });
}

async function handleStatic(res, pathname) {
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(ROOT_DIR, cleanPath);

  if (!filePath.startsWith(ROOT_DIR)) {
    sendPlain(res, 403, "Forbidden");
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch {
    sendPlain(res, 404, "Not Found");
  }
}

async function readTasks() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeTasks(tasks) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(tasks, null, 2), "utf-8");
}

async function readBody(req) {
  let raw = "";

  for await (const chunk of req) {
    raw += chunk;
  }

  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function sendPlain(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}
