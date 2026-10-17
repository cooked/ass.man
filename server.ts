import https from "https";
import QRCode from "qrcode";
import { execFile } from "child_process";
import os from "os";
import express from "express";
import path from "path";
import fs from "fs";
import { StorageEngine } from "./src/services/StorageEngine";
import { initLockManager, acquireLock, releaseLock, getActiveLocks } from "./src/services/LockManager";

export const app = express();
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

const baseDir = process.cwd();
const schemasDir = process.env.ASSMAN_SCHEMAS_PATH || path.join(baseDir, "schemas");
const viewsDir = process.env.ASSMAN_VIEWS_PATH || path.join(baseDir, "views");
const dataDir = process.env.ASSMAN_DATA_PATH || path.join(baseDir, "data");

const appConfigPath = path.join(baseDir, "app-config.json");
const usersConfigPath = path.join(dataDir, "config", "users.json");
const rolesConfigPath = path.join(dataDir, "config", "roles.json");
const companionDevicesPath = path.join(dataDir, "config", "paired_devices.json");

const storage = new StorageEngine(baseDir, { schemasDir, viewsDir, dataDir });
initLockManager(dataDir, 10);

const PORT = Number(process.env.ASSMAN_PORT || process.env.PORT) || 3100;
const HTTPS_PORT = Number(process.env.HTTPS_PORT) || 3101;

// API: App Configuration
app.get("/api/config", (req, res) => {
  try {
    if (fs.existsSync(appConfigPath)) {
      const cfg = JSON.parse(fs.readFileSync(appConfigPath, "utf-8"));
      return res.json({
        ...cfg,
        schemasPath: schemasDir,
        viewsPath: viewsDir,
        dataPath: dataDir
      });
    }
  } catch {}
  res.json({
    dataPath: dataDir,
    schemasPath: schemasDir,
    viewsPath: viewsDir,
    lockTimeoutMinutes: 10,
    defaultUser: "Alex Rivers"
  });
});

// API: Native OS Folder Picker
app.post("/api/browse-folder", (req, res) => {
  const startPath = req.body?.startPath || os.homedir();
  if (process.platform === "darwin") {
    const script = `set defaultFolder to POSIX file ${JSON.stringify(startPath)}
try
  set chosenFolder to POSIX path of (choose folder with prompt "Select Data Storage Directory" default location defaultFolder)
  return chosenFolder
on error number -128
  return "__CANCELLED__"
end try`;
    execFile("osascript", ["-e", script], { timeout: 120000 }, (err, stdout, stderr) => {
      if (err) return res.status(500).json({ error: stderr || err.message });
      const result = (stdout || "").trim();
      if (!result || result === "__CANCELLED__") return res.json({ cancelled: true });
      const normalized = result.length > 1 ? result.replace(/[\/\\]+$/, "") : result;
      return res.json({ path: normalized });
    });
  } else {
    res.json({ cancelled: true, message: "Manual path input required on this OS" });
  }
});

app.post("/api/config", (req, res) => {
  try {
    let existing: any = {};
    if (fs.existsSync(appConfigPath)) {
      existing = JSON.parse(fs.readFileSync(appConfigPath, "utf-8"));
    }
    const updated = { ...existing, ...req.body };
    fs.writeFileSync(appConfigPath, JSON.stringify(updated, null, 2), "utf-8");
    res.json({ success: true, config: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Users Management
app.get("/api/users", (req, res) => {
  try {
    if (fs.existsSync(usersConfigPath)) {
      return res.json(JSON.parse(fs.readFileSync(usersConfigPath, "utf-8")));
    }
  } catch {}
  res.json([]);
});

app.post("/api/users", (req, res) => {
  try {
    const user = req.body;
    let users: any[] = [];
    if (fs.existsSync(usersConfigPath)) {
      users = JSON.parse(fs.readFileSync(usersConfigPath, "utf-8"));
    }
    const idx = users.findIndex(u => u.username.toLowerCase() === user.username.toLowerCase());
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...user };
    } else {
      users.push(user);
    }
    fs.writeFileSync(usersConfigPath, JSON.stringify(users, null, 2), "utf-8");
    res.json({ success: true, users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/users/:username", (req, res) => {
  try {
    const { username } = req.params;
    let users: any[] = [];
    if (fs.existsSync(usersConfigPath)) {
      users = JSON.parse(fs.readFileSync(usersConfigPath, "utf-8"));
    }
    users = users.filter(u => u.username.toLowerCase() !== username.toLowerCase());
    fs.writeFileSync(usersConfigPath, JSON.stringify(users, null, 2), "utf-8");
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Roles Management
app.get("/api/roles", (req, res) => {
  try {
    if (fs.existsSync(rolesConfigPath)) {
      return res.json(JSON.parse(fs.readFileSync(rolesConfigPath, "utf-8")));
    }
  } catch {}
  res.json({});
});

app.post("/api/roles", (req, res) => {
  try {
    fs.writeFileSync(rolesConfigPath, JSON.stringify(req.body, null, 2), "utf-8");
    res.json({ success: true, roles: req.body });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Metamodel Schemas & Views
app.get("/api/schemas", (req, res) => {
  res.json(storage.getSchemas());
});

app.get("/api/schemas/:id", (req, res) => {
  const schema = storage.getSchema(req.params.id);
  if (!schema) return res.status(404).json({ error: "Schema not found" });
  res.json(schema);
});

app.get("/api/views", (req, res) => {
  res.json(storage.getViews());
});

// API: Dynamic Asset CRUD & Relations
app.get("/api/assets/:type", (req, res) => {
  const assets = storage.getResolvedAssets(req.params.type);
  res.json(assets);
});

app.post("/api/assets/:type/:id", (req, res) => {
  const { type, id } = req.params;
  const result = storage.saveAsset(type, id, req.body);
  res.json(result);
});

app.delete("/api/assets/:type/:id", (req, res) => {
  const { type, id } = req.params;
  const ok = storage.deleteAsset(type, id);
  res.json({ success: ok });
});

// API: Collaborative Locks
app.get("/api/locks", (req, res) => {
  res.json(getActiveLocks());
});

app.post("/api/assets/:type/:id/lock", (req, res) => {
  const { type, id } = req.params;
  const { userId, userName } = req.body || {};
  const result = acquireLock(type, id, userId || "anonymous", userName || "Operator");
  res.json(result);
});

app.post("/api/assets/:type/:id/unlock", (req, res) => {
  const { type, id } = req.params;
  const { userId, force } = req.body || {};
  const result = releaseLock(type, id, userId || "anonymous", !!force);
  res.json(result);
});

app.post("/api/locks/force-unlock", (req, res) => {
  const { assetType, assetId } = req.body || {};
  const result = releaseLock(assetType, assetId, "admin", true);
  res.json(result);
});

// Companion Helper
function getLocalIpv4(): string {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal && !net.address.startsWith("198.19.")) {
        return net.address;
      }
    }
  }
  return "localhost";
}

// API: Companion Pairing QR Code
app.get("/api/companion/qr", async (req, res) => {
  try {
    const ip = getLocalIpv4();
    const isHttps = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https";
    const targetPort = isHttps ? HTTPS_PORT : PORT;
    const protocol = isHttps ? "https" : "http";
    const mobileUrl = `${protocol}://${ip}:${targetPort}/?mobile=1`;

    const qrDataUrl = await QRCode.toDataURL(mobileUrl, {
      margin: 2,
      width: 320,
      color: { dark: "#0f172a", light: "#ffffff" }
    });

    res.json({
      url: mobileUrl,
      qrDataUrl,
      localIp: ip,
      port: targetPort,
      isHttps
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Paired Companion Devices Management
app.get("/api/companion/devices", (req, res) => {
  try {
    if (fs.existsSync(companionDevicesPath)) {
      const devices = JSON.parse(fs.readFileSync(companionDevicesPath, "utf-8"));
      const now = Date.now();
      const enriched = devices.map((d: any) => {
        const diffMs = now - new Date(d.lastSeenAt || d.firstPairedAt).getTime();
        const isOnline = diffMs < 5 * 60 * 1000;
        return { ...d, status: isOnline ? "online" : "offline" };
      });
      return res.json(enriched);
    }
  } catch {}
  res.json([]);
});

app.post("/api/companion/register", (req, res) => {
  try {
    const { deviceId, deviceName, userAgent } = req.body;
    if (!deviceId) return res.status(400).json({ error: "deviceId is required" });

    let devices: any[] = [];
    if (fs.existsSync(companionDevicesPath)) {
      devices = JSON.parse(fs.readFileSync(companionDevicesPath, "utf-8"));
    }

    const now = new Date().toISOString();
    const existingIndex = devices.findIndex(d => d.deviceId === deviceId);

    if (existingIndex >= 0) {
      devices[existingIndex] = {
        ...devices[existingIndex],
        deviceName: deviceName || devices[existingIndex].deviceName,
        userAgent: userAgent || devices[existingIndex].userAgent,
        lastSeenAt: now,
        ipAddress: req.ip || req.socket.remoteAddress
      };
    } else {
      devices.push({
        deviceId,
        deviceName: deviceName || `Companion ${devices.length + 1}`,
        userAgent: userAgent || "Mobile Scanner",
        firstPairedAt: now,
        lastSeenAt: now,
        ipAddress: req.ip || req.socket.remoteAddress
      });
    }

    const configDir = path.dirname(companionDevicesPath);
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(companionDevicesPath, JSON.stringify(devices, null, 2), "utf-8");

    res.json({ success: true, devices });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/companion/heartbeat", (req, res) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId || !fs.existsSync(companionDevicesPath)) return res.json({ success: true });

    const devices = JSON.parse(fs.readFileSync(companionDevicesPath, "utf-8"));
    const dev = devices.find((d: any) => d.deviceId === deviceId);
    if (dev) {
      dev.lastSeenAt = new Date().toISOString();
      fs.writeFileSync(companionDevicesPath, JSON.stringify(devices, null, 2), "utf-8");
    }
    res.json({ success: true });
  } catch {
    res.json({ success: true });
  }
});

app.delete("/api/companion/devices/:deviceId", (req, res) => {
  try {
    const { deviceId } = req.params;
    if (!fs.existsSync(companionDevicesPath)) return res.json({ success: true });

    let devices = JSON.parse(fs.readFileSync(companionDevicesPath, "utf-8"));
    devices = devices.filter((d: any) => d.deviceId !== deviceId);
    fs.writeFileSync(companionDevicesPath, JSON.stringify(devices, null, 2), "utf-8");
    res.json({ success: true, devices });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Production Static Serving
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(baseDir, "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// Start HTTP Server

// API: 1-Click Starter Template Installer
app.post("/api/templates/install", (req, res) => {
  try {
    const { templateId } = req.body;
    console.log(`[ass.man] Installing starter template: ${templateId}`);

    if (templateId === "friends-gear") {
      // Already generated in schemas, views and data!
      return res.json({ success: true, message: "Friends, Places & Gear pack active" });
    }

    if (templateId === "industrial-iot") {
      const bomSchemas = "/Users/ale/bom/schemas";
      const bomViews = "/Users/ale/bom/views";
      const bomData = "/Users/ale/bom/data";

      if (fs.existsSync(bomSchemas)) {
        fs.cpSync(bomSchemas, schemasDir, { recursive: true });
      }
      if (fs.existsSync(bomViews)) {
        fs.cpSync(bomViews, viewsDir, { recursive: true });
      }
      if (fs.existsSync(bomData)) {
        fs.cpSync(bomData, dataDir, { recursive: true });
      }
      return res.json({ success: true, message: "Industrial IoT BOM pack active" });
    }

    res.json({ success: true, message: "Template installed" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export function startServer() {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 ass.man server running at http://localhost:${PORT}`);
    console.log(`📦 Schemas: ${schemasDir}`);
    console.log(`📊 Views:   ${viewsDir}`);
    console.log(`💾 Data:    ${dataDir}\n`);
  });
}

if (process.env.NODE_ENV === "production" && process.argv[1]?.endsWith("server.cjs")) {
  startServer();
}
