#!/usr/bin/env node

const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const pkg = require("../package.json");
const args = process.argv.slice(2);
const command = args[0] || "serve";

function printBanner() {
  console.log(`
  \x1b[35m┌──────────────────────────────────────────────┐\x1b[0m
  \x1b[35m│\x1b[0m   \x1b[1m\x1b[36mass.man\x1b[0m — Asset Manager Engine (v${pkg.version})   \x1b[35m│\x1b[0m
  \x1b[35m│\x1b[0m   Schema-Driven, Zero-DB Asset Orchestration \x1b[35m│\x1b[0m
  \x1b[35m└──────────────────────────────────────────────┘\x1b[0m
`);
}

function printHelp() {
  printBanner();
  console.log(`Usage:
  assman [command] [options]

Commands:
  serve                 Launch production asset engine
  dev                   Start development server with live Vite HMR
  init [directory]      Scaffold a fresh ass.man asset workspace
  version               Display version info
  help                  Show this help reference

Options for 'serve' and 'dev':
  --port <number>       HTTP port (default: 3100)
  --https-port <number> HTTPS port for mobile camera stream (default: 3101)
  --schemas <dir>       Path to JSON schemas directory (default: ./schemas)
  --views <dir>         Path to JSON view templates directory (default: ./views)
  --data <dir>          Path to JSON asset storage directory (default: ./data)

Examples:
  assman dev
  assman serve --port 3100
  assman init my-adventure-pack
`);
}

if (args.includes("--help") || args.includes("-h") || command === "help") {
  printHelp();
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v") || command === "version") {
  console.log(`ass.man v${pkg.version}`);
  process.exit(0);
}

const callerDir = process.cwd();

if (command === "init") {
  printBanner();
  const targetDir = args[1] || "./assman-project";
  const absTarget = path.resolve(callerDir, targetDir);

  console.log(`\x1b[32m✔\x1b[0m Initializing new ass.man workspace in: \x1b[1m${absTarget}\x1b[0m`);

  fs.mkdirSync(path.join(absTarget, "schemas"), { recursive: true });
  fs.mkdirSync(path.join(absTarget, "views"), { recursive: true });
  fs.mkdirSync(path.join(absTarget, "data"), { recursive: true });

  const sampleSchemasDir = path.join(__dirname, "../schemas");
  const sampleViewsDir = path.join(__dirname, "../views");

  if (fs.existsSync(sampleSchemasDir)) {
    fs.cpSync(sampleSchemasDir, path.join(absTarget, "schemas"), { recursive: true });
    console.log(`  \x1b[36m•\x1b[0m Copied starter schemas (Friends, Places & Gear)`);
  }
  if (fs.existsSync(sampleViewsDir)) {
    fs.cpSync(sampleViewsDir, path.join(absTarget, "views"), { recursive: true });
    console.log(`  \x1b[36m•\x1b[0m Copied starter declarative view templates`);
  }

  const sampleConfig = {
    appName: "My Asset Workspace",
    storagePath: "./data",
    schemasPath: "./schemas",
    viewsPath: "./views",
    lockTimeoutMinutes: 10,
    httpPort: 3100,
    httpsPort: 3101
  };
  fs.writeFileSync(path.join(absTarget, "app-config.json"), JSON.stringify(sampleConfig, null, 2));

  console.log(`
\x1b[32m✔ Success!\x1b[0m Project initialized. To start managing assets:
  cd ${targetDir}
  npx assman dev
`);
  process.exit(0);
}

// Parse options
let httpPort = 3100;
let httpsPort = 3101;
let schemasPath = "./schemas";
let viewsPath = "./views";
let dataPath = "./data";

// Read app-config.json in callerDir if exists
const callerConfigPath = path.join(callerDir, "app-config.json");
if (fs.existsSync(callerConfigPath)) {
  try {
    const cfg = JSON.parse(fs.readFileSync(callerConfigPath, "utf-8"));
    if (cfg.port) httpPort = cfg.port;
    if (cfg.httpPort) httpPort = cfg.httpPort;
    if (cfg.httpsPort) httpsPort = cfg.httpsPort;
    if (cfg.schemasPath) schemasPath = cfg.schemasPath;
    if (cfg.viewsPath) viewsPath = cfg.viewsPath;
    if (cfg.dataPath) dataPath = cfg.dataPath;
    if (cfg.storagePath) dataPath = cfg.storagePath;
  } catch {}
}

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port" && args[i + 1]) httpPort = parseInt(args[i + 1], 10);
  if (args[i] === "--https-port" && args[i + 1]) httpsPort = parseInt(args[i + 1], 10);
  if (args[i] === "--schemas" && args[i + 1]) schemasPath = args[i + 1];
  if (args[i] === "--views" && args[i + 1]) viewsPath = args[i + 1];
  if (args[i] === "--data" && args[i + 1]) dataPath = args[i + 1];
}

const absSchemas = path.resolve(callerDir, schemasPath);
const absViews = path.resolve(callerDir, viewsPath);
const absData = path.resolve(callerDir, dataPath);

process.env.PORT = String(httpPort);
process.env.HTTPS_PORT = String(httpsPort);
process.env.ASSMAN_PORT = String(httpPort);
process.env.ASSMAN_HTTPS_PORT = String(httpsPort);
process.env.ASSMAN_WORKSPACE_PATH = callerDir;
process.env.ASSMAN_SCHEMAS_PATH = absSchemas;
process.env.ASSMAN_VIEWS_PATH = absViews;
process.env.ASSMAN_DATA_PATH = absData;
process.env.ASSMAN_CONFIG_PATH = callerConfigPath;

printBanner();
console.log(`\x1b[34mℹ\x1b[0m Workspace Directory: \x1b[1m${callerDir}\x1b[0m`);
console.log(`\x1b[34mℹ\x1b[0m Binding Schemas:     \x1b[1m${absSchemas}\x1b[0m`);
console.log(`\x1b[34mℹ\x1b[0m Binding Storage:     \x1b[1m${absData}\x1b[0m`);

const engineDir = path.resolve(__dirname, "..");
const script = command === "dev" ? "npm run dev" : "npm start";

const child = spawn("npm", ["run", command === "dev" ? "dev" : "start"], {
  cwd: engineDir,
  stdio: "inherit",
  env: process.env
});

child.on("exit", (code) => {
  process.exit(code || 0);
});
