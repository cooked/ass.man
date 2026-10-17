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
  serve                 Launch the asset management engine & Web AR terminal
  dev                   Start development server with live Vite HMR
  init [directory]      Scaffold a fresh ass.man asset workspace
  version               Display version info
  help                  Show this help reference

Options for 'serve':
  --port <number>       HTTP port (default: 3100)
  --https-port <number> HTTPS port for mobile camera stream (default: 3101)
  --schemas <dir>       Path to JSON schemas directory (default: ./schemas)
  --views <dir>         Path to JSON view templates directory (default: ./views)
  --data <dir>          Path to JSON asset storage directory (default: ./data)

Examples:
  npx assman init my-adventure-pack
  npx assman serve --schemas ./custom-schemas --data ./custom-data
  npx assman
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

if (command === "init") {
  printBanner();
  const targetDir = args[1] || "./assman-project";
  const absTarget = path.resolve(process.cwd(), targetDir);

  console.log(`\x1b[32m✔\x1b[0m Initializing new ass.man workspace in: \x1b[1m${absTarget}\x1b[0m`);

  fs.mkdirSync(path.join(absTarget, "schemas"), { recursive: true });
  fs.mkdirSync(path.join(absTarget, "views"), { recursive: true });
  fs.mkdirSync(path.join(absTarget, "data"), { recursive: true });

  // Copy sample schemas & views
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
  npx assman serve
`);
  process.exit(0);
}

// Parse serve options
let httpPort = 3100;
let httpsPort = 3101;
let schemasPath = "./schemas";
let viewsPath = "./views";
let dataPath = "./data";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port" && args[i + 1]) httpPort = parseInt(args[i + 1], 10);
  if (args[i] === "--https-port" && args[i + 1]) httpsPort = parseInt(args[i + 1], 10);
  if (args[i] === "--schemas" && args[i + 1]) schemasPath = args[i + 1];
  if (args[i] === "--views" && args[i + 1]) viewsPath = args[i + 1];
  if (args[i] === "--data" && args[i + 1]) dataPath = args[i + 1];
}

process.env.ASSMAN_HTTP_PORT = String(httpPort);
process.env.ASSMAN_HTTPS_PORT = String(httpsPort);
process.env.ASSMAN_SCHEMAS_PATH = schemasPath;
process.env.ASSMAN_VIEWS_PATH = viewsPath;
process.env.ASSMAN_DATA_PATH = dataPath;

printBanner();
console.log(`\x1b[34mℹ\x1b[0m Binding Schemas: \x1b[1m${path.resolve(process.cwd(), schemasPath)}\x1b[0m`);
console.log(`\x1b[34mℹ\x1b[0m Binding Storage: \x1b[1m${path.resolve(process.cwd(), dataPath)}\x1b[0m`);

const rootDir = path.resolve(__dirname, "..");
const script = command === "dev" ? "npm run dev" : "npm start";

const child = spawn("npm", ["run", command === "dev" ? "dev" : "start"], {
  cwd: rootDir,
  stdio: "inherit",
  env: process.env
});

child.on("exit", (code) => {
  process.exit(code || 0);
});
