const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 4173);
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
const ADMIN_SECRET = process.env.ADMIN_SECRET || crypto.randomBytes(32).toString("hex");
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "league.json");
const TOKEN_MAX_AGE_MS = 12 * 60 * 60 * 1000;

const defaultState = {
  teams: [
    { team: "AJAX", points: 0, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, form: "-----", logo: "" },
    { team: "GALATASARAT", points: 0, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, form: "-----", logo: "" },
    { team: "ARSENAL", points: 0, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, form: "-----", logo: "" },
    { team: "FENERBAHÇE", points: 0, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, form: "-----", logo: "" },
    { team: "İNTER NAZİONALE MİLAN", points: 0, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, form: "-----", logo: "" }
  ],
  matches: [
    { home: "AJAX", away: "GALATASARAT", score: "VS", stadium: "League Arena", time: "20:00" },
    { home: "ARSENAL", away: "FENERBAHÇE", score: "VS", stadium: "Champions Stadium", time: "18:30" }
  ],
  stats: {
    goals: [
      { player: "Mauro Icardi", team: "GALATASARAT", value: 0 },
      { player: "Bukayo Saka", team: "ARSENAL", value: 0 }
    ],
    assists: [
      { player: "Dusan Tadic", team: "FENERBAHÇE", value: 0 },
      { player: "Martin Odegaard", team: "ARSENAL", value: 0 }
    ],
    redCards: [
      { player: "Oyuncu 1", team: "AJAX", value: 0 },
      { player: "Oyuncu 2", team: "İNTER NAZİONALE MİLAN", value: 0 }
    ],
    yellowCards: [
      { player: "Oyuncu 3", team: "FENERBAHÇE", value: 0 },
      { player: "Oyuncu 4", team: "GALATASARAT", value: 0 }
    ]
  },
  transfers: []
};

function json(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function normalizeState(input = {}) {
  return {
    teams: Array.isArray(input.teams) ? input.teams : defaultState.teams,
    matches: Array.isArray(input.matches) ? input.matches : defaultState.matches,
    stats: {
      ...defaultState.stats,
      ...(input.stats && typeof input.stats === "object" ? input.stats : {})
    },
    transfers: Array.isArray(input.transfers) ? input.transfers : defaultState.transfers
  };
}

async function readState() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return normalizeState(JSON.parse(raw));
  } catch {
    await writeState(defaultState);
    return structuredClone(defaultState);
  }
}

async function writeState(state) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(normalizeState(state), null, 2), "utf8");
}

async function readBody(request) {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

function sign(payload) {
  return crypto.createHmac("sha256", ADMIN_SECRET).update(payload).digest("hex");
}

function createToken(username) {
  const payload = Buffer.from(JSON.stringify({ username, issuedAt: Date.now() })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function verifyToken(request) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const [payload, signature] = token.split(".");
  if (!payload || !signature || sign(payload) !== signature) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.username === ADMIN_USER && Date.now() - data.issuedAt < TOKEN_MAX_AGE_MS;
  } catch {
    return false;
  }
}

async function serveIndex(response) {
  const html = await fs.readFile(path.join(ROOT, "index.html"), "utf8");
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(html);
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/api/state") {
      return json(response, 200, await readState());
    }

    if (request.method === "POST" && url.pathname === "/api/login") {
      if (!ADMIN_USER || !ADMIN_PASS) {
        return json(response, 500, { message: "Admin bilgileri sunucuda ayarlanmamış." });
      }
      const body = await readBody(request);
      if (body.username === ADMIN_USER && body.password === ADMIN_PASS) {
        return json(response, 200, { token: createToken(body.username) });
      }
      return json(response, 401, { message: "Hatalı giriş bilgisi." });
    }

    if (request.method === "POST" && url.pathname === "/api/state") {
      if (!verifyToken(request)) return json(response, 401, { message: "Admin girişi gerekli." });
      const body = await readBody(request);
      await writeState(body);
      return json(response, 200, await readState());
    }

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      return serveIndex(response);
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Bulunamadı");
  } catch (error) {
    json(response, 500, { message: "Sunucu hatası.", detail: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Şampuanlar Ligi hazır: http://localhost:${PORT}`);
});
