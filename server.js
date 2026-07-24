const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 4173);
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
const ADMIN_SECRET = process.env.ADMIN_SECRET || crypto.randomBytes(32).toString("hex");
const TEAM_CODES = parseTeamCodes(process.env.TEAM_CODES);
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "league.json");
const ASSETS_DIR = path.join(ROOT, "assets");
const TOKEN_MAX_AGE_MS = 12 * 60 * 60 * 1000;

const defaultState = {
  teams: [
    { team: "AC MÄ°LAN", points: 0, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, form: "-----", logo: "" },
    { team: "GALATASARAY", points: 0, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, form: "-----", logo: "" },
    { team: "ARSENAL", points: 0, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, form: "-----", logo: "" },
    { team: "FENERBAHÃ‡E", points: 0, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, form: "-----", logo: "" },
    { team: "Ä°NTER NAZÄ°ONALE MÄ°LAN", points: 0, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, form: "-----", logo: "" },
    { team: "TAKIM 6", points: 0, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, form: "-----", logo: "" },
    { team: "TAKIM 7", points: 0, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, form: "-----", logo: "" },
    { team: "TAKIM 8", points: 0, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, form: "-----", logo: "" },
    { team: "TAKIM 9", points: 0, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, form: "-----", logo: "" },
    { team: "TAKIM 10", points: 0, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, form: "-----", logo: "" }
  ],
  matches: [
    { home: "AC MÄ°LAN", away: "GALATASARAY", score: "VS", stadium: "League Arena", time: "20:00" },
    { home: "ARSENAL", away: "FENERBAHÃ‡E", score: "VS", stadium: "Champions Stadium", time: "18:30" }
  ],
  liveMatchIndex: 0,
  news: [],
  stats: {
    goals: [
      { player: "Mauro Icardi", team: "GALATASARAY", value: 0 },
      { player: "Bukayo Saka", team: "ARSENAL", value: 0 }
    ],
    assists: [
      { player: "Dusan Tadic", team: "FENERBAHÃ‡E", value: 0 },
      { player: "Martin Odegaard", team: "ARSENAL", value: 0 }
    ],
    redCards: [
      { player: "Oyuncu 1", team: "AC MÄ°LAN", value: 0 },
      { player: "Oyuncu 2", team: "Ä°NTER NAZÄ°ONALE MÄ°LAN", value: 0 }
    ],
    yellowCards: [
      { player: "Oyuncu 3", team: "FENERBAHÃ‡E", value: 0 },
      { player: "Oyuncu 4", team: "GALATASARAY", value: 0 }
    ]
  },
  transfers: [],
  season: {
    startDate: "2026-05-17",
    endDate: "2026-06-30"
  },
  leagueSettings: {
    leagueName: "LOS PESÄ°COS",
    leagueLogo: "",
    leagueTrophy: "",
    championsName: "ÅAMPUANLAR LÄ°GÄ°",
    championsLogo: "",
    championsTrophy: "",
    championsWinner: "",
    championsGroups: {
      A: ["AC MÃ„Â°LAN", "GALATASARAY"],
      B: ["ARSENAL", "FENERBAHÃƒâ€¡E"]
    }
  },
  fixturePoster: {
    matchIndex: 0,
    home: "AC MÄ°LAN",
    away: "GALATASARAY",
    homeLogo: "",
    awayLogo: "",
    date: "",
    time: "",
    stadium: "",
    note: "FikstÃ¼r",
    layout: "template"
  }
};

function parseTeamCodes(raw) {
  const fallback = {
    "AC MÄ°LAN": "ACMILAN2026",
    GALATASARAY: "GS2026",
    ARSENAL: "ARS2026",
    "TAKIM 6": "TAKIM62026",
    "TAKIM 7": "TAKIM72026",
    "TAKIM 8": "TAKIM82026",
    "TAKIM 9": "TAKIM92026",
    "TAKIM 10": "TAKIM102026",
    "FENERBAHÃ‡E": "FB2026",
    "Ä°NTER NAZÄ°ONALE MÄ°LAN": "INTER2026"
  };
  if (!raw) return fallback;
  try {
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

function json(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function normalizeState(input = {}) {
  return migrateLegacyTeamNames({
    teams: Array.isArray(input.teams) ? input.teams : defaultState.teams,
    matches: Array.isArray(input.matches) ? input.matches : defaultState.matches,
    liveMatchIndex: Number.isInteger(input.liveMatchIndex) ? input.liveMatchIndex : defaultState.liveMatchIndex,
    news: Array.isArray(input.news) ? input.news : defaultState.news,
    stats: {
      ...defaultState.stats,
      ...(input.stats && typeof input.stats === "object" ? input.stats : {})
    },
    transfers: Array.isArray(input.transfers) ? input.transfers : defaultState.transfers,
    season: {
      ...defaultState.season,
      ...(input.season && typeof input.season === "object" ? input.season : {})
    },
    leagueSettings: {
      ...defaultState.leagueSettings,
      ...(input.leagueSettings && typeof input.leagueSettings === "object" ? input.leagueSettings : {})
    },
    fixturePoster: {
      ...defaultState.fixturePoster,
      ...(input.fixturePoster && typeof input.fixturePoster === "object" ? input.fixturePoster : {})
    }
  });
}

function migrateLegacyTeamNames(state) {
  const renameMap = {
    AJAX: "AC MÄ°LAN",
    GALATASARAT: "GALATASARAY"
  };
  const rename = (name) => renameMap[name] || name;
  return {
    ...state,
    teams: state.teams.map((team) => ({ ...team, team: rename(team.team) })),
    matches: state.matches.map((match) => ({
      ...match,
      home: rename(match.home),
      away: rename(match.away)
    })),
    transfers: state.transfers.map((transfer) => ({
      ...transfer,
      from: rename(transfer.from),
      to: rename(transfer.to)
    })),
    stats: Object.fromEntries(
      Object.entries(state.stats).map(([key, rows]) => [
        key,
        Array.isArray(rows) ? rows.map((row) => ({ ...row, team: rename(row.team) })) : rows
      ])
    ),
    leagueSettings: {
      ...state.leagueSettings,
      championsGroups: Object.fromEntries(
        Object.entries(state.leagueSettings.championsGroups || {}).map(([group, teams]) => [
          group,
          Array.isArray(teams) ? teams.map(rename) : teams
        ])
      )
    }
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

async function serveAsset(assetPath, response) {
  const safeName = path.basename(assetPath);
  const filePath = path.join(ASSETS_DIR, safeName);
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp"
  };
  const file = await fs.readFile(filePath);
  response.writeHead(200, {
    "content-type": contentTypes[ext] || "application/octet-stream",
    "cache-control": "public, max-age=3600"
  });
  response.end(file);
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/api/state") {
      return json(response, 200, await readState());
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      let dataFileExists = false;
      try {
        await fs.access(DATA_FILE);
        dataFileExists = true;
      } catch {
        dataFileExists = false;
      }
      return json(response, 200, {
        ok: true,
        dataDir: DATA_DIR,
        dataFileExists,
        hasAdminUser: Boolean(ADMIN_USER),
        hasAdminPass: Boolean(ADMIN_PASS)
      });
    }

    if (request.method === "POST" && url.pathname === "/api/login") {
      if (!ADMIN_USER || !ADMIN_PASS) {
        return json(response, 500, { message: "Admin bilgileri sunucuda ayarlanmamÄ±ÅŸ." });
      }
      const body = await readBody(request);
      if (body.username === ADMIN_USER && body.password === ADMIN_PASS) {
        return json(response, 200, { token: createToken(body.username) });
      }
      return json(response, 401, { message: "HatalÄ± giriÅŸ bilgisi." });
    }

    if (request.method === "POST" && url.pathname === "/api/team-login") {
      const body = await readBody(request);
      const team = String(body.team || "").trim();
      const code = String(body.code || "").trim();
      if (TEAM_CODES[team] && TEAM_CODES[team] === code) {
        return json(response, 200, { team });
      }
      return json(response, 401, { message: "TakÄ±m kodu hatalÄ±." });
    }

    if (request.method === "POST" && url.pathname === "/api/state") {
      if (!verifyToken(request)) return json(response, 401, { message: "Admin giriÅŸi gerekli." });
      const body = await readBody(request);
      await writeState(body);
      return json(response, 200, await readState());
    }

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      return serveIndex(response);
    }

    if (request.method === "GET" && url.pathname.startsWith("/assets/")) {
      return serveAsset(url.pathname, response);
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("BulunamadÄ±");
  } catch (error) {
    json(response, 500, { message: "Sunucu hatasÄ±.", detail: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Åampuanlar Ligi hazÄ±r: http://localhost:${PORT}`);
});

