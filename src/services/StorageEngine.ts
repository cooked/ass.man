import fs from "fs";
import path from "path";
import { AssetSchema, ViewDefinition } from "../types/schema";

export class StorageEngine {
  public baseDir: string;
  public schemasDir: string;
  public viewsDir: string;
  public dataDir: string;

  constructor(
    baseDir: string = process.cwd(),
    options?: { schemasDir?: string; viewsDir?: string; dataDir?: string }
  ) {
    this.baseDir = baseDir;
    this.schemasDir = options?.schemasDir || process.env.ASSMAN_SCHEMAS_PATH || path.join(baseDir, "schemas");
    this.viewsDir = options?.viewsDir || process.env.ASSMAN_VIEWS_PATH || path.join(baseDir, "views");
    this.dataDir = options?.dataDir || process.env.ASSMAN_DATA_PATH || path.join(baseDir, "data");

    this.ensureDirectories();
  }

  private ensureDirectories() {
    [this.schemasDir, this.viewsDir, this.dataDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        try { fs.mkdirSync(dir, { recursive: true }); } catch {}
      }
    });
  }

  // --- Schemas & Metamodel ---
  public getSchemas(): AssetSchema[] {
    if (!fs.existsSync(this.schemasDir)) return [];
    const files = fs.readdirSync(this.schemasDir);
    return files
      .filter(f => f.endsWith(".schema.json") || (f.endsWith(".json") && !f.includes(".view.")))
      .map(f => {
        try {
          const content = fs.readFileSync(path.join(this.schemasDir, f), "utf-8");
          const schema = JSON.parse(content);
          if (!schema.entity && (schema.id || schema.title)) {
            schema.entity = (schema.id || schema.title).toLowerCase();
          }
          if (!schema.primaryKey && schema.identityField) {
            schema.primaryKey = schema.identityField;
          }
          return schema;
        } catch {
          return null;
        }
      })
      .filter((s): s is AssetSchema => s !== null);
  }

  public getSchema(entityOrId: string): AssetSchema | undefined {
    const schemas = this.getSchemas();
    return schemas.find(
      s => s.entity?.toLowerCase() === entityOrId.toLowerCase() ||
           s.id?.toLowerCase() === entityOrId.toLowerCase()
    );
  }

  // --- Views ---
  public getViews(): ViewDefinition[] {
    if (!fs.existsSync(this.viewsDir)) return [];
    const files = fs.readdirSync(this.viewsDir);
    const views = files
      .filter(f => f.endsWith(".view.json") || f.endsWith(".json"))
      .map(f => {
        try {
          const content = fs.readFileSync(path.join(this.viewsDir, f), "utf-8");
          return JSON.parse(content) as ViewDefinition;
        } catch {
          return null;
        }
      })
      .filter((v): v is ViewDefinition => v !== null && !!v.id);

    // Read viewsOrder if configured in app-config.json
    let viewsOrder: string[] = [];
    const configPath = path.join(this.baseDir, "app-config.json");
    if (fs.existsSync(configPath)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        if (Array.isArray(cfg.viewsOrder)) viewsOrder = cfg.viewsOrder;
      } catch {}
    }

    const defaultOrder = [
      "sensors_grid", "sensor", "sensors", "gear",
      "kits_management", "kit", "kits", "adventure",
      "firmware_management", "firmware",
      "customers_map", "customer", "customers", "map", "places_map", "place"
    ];

    const orderToUse = viewsOrder.length > 0 ? viewsOrder : defaultOrder;

    return views.sort((a, b) => {
      const getIndex = (v: ViewDefinition) => {
        const idx = orderToUse.findIndex(
          o => o.toLowerCase() === v.id.toLowerCase() ||
               o.toLowerCase() === v.targetAsset?.toLowerCase() ||
               v.id.toLowerCase().includes(o.toLowerCase())
        );
        return idx !== -1 ? idx : 999;
      };
      return getIndex(a) - getIndex(b);
    });
  }

  // --- Asset Directory Resolution ---
  public getAssetFolder(entityType: string): string {
    const cleanType = entityType.toLowerCase().trim();
    // Check possible directory candidates: exact match, standard plural, irregular
    const candidates = [
      cleanType,
      `${cleanType}s`,
      cleanType === "person" ? "people" : "",
      cleanType.endsWith("y") ? `${cleanType.slice(0, -1)}ies` : ""
    ].filter(Boolean);

    for (const cand of candidates) {
      const candidatePath = path.join(this.dataDir, cand);
      if (fs.existsSync(candidatePath)) {
        return candidatePath;
      }
    }

    // Default to plural or exact
    const defaultFolder = candidates[1] || candidates[0];
    const targetPath = path.join(this.dataDir, defaultFolder);
    if (!fs.existsSync(targetPath)) {
      try { fs.mkdirSync(targetPath, { recursive: true }); } catch {}
    }
    return targetPath;
  }

  // --- Raw Asset CRUD ---
  public getAssets(entityType: string): any[] {
    const folder = this.getAssetFolder(entityType);
    if (!fs.existsSync(folder)) return [];
    const files = fs.readdirSync(folder);
    return files
      .filter(f => f.endsWith(".json") && !f.endsWith(".lock.json"))
      .map(f => {
        try {
          return JSON.parse(fs.readFileSync(path.join(folder, f), "utf-8"));
        } catch {
          return null;
        }
      })
      .filter(item => item !== null);
  }

  // --- Dynamic Schema-Driven Relational Resolution ---
  public getResolvedAssets(entityType: string): any[] {
    const rawAssets = this.getAssets(entityType);
    const schema = this.getSchema(entityType);
    if (!schema || !schema.relations) {
      return rawAssets;
    }

    const relations = schema.relations;
    const targetCaches = new Map<string, { assets: any[]; pk: string; map: Map<string, any> }>();

    // Preload target datasets
    for (const [_, rel] of Object.entries(relations)) {
      if (!targetCaches.has(rel.targetAsset)) {
        const targetSchema = this.getSchema(rel.targetAsset);
        const pk = targetSchema?.primaryKey || targetSchema?.identityField || "id";
        const assets = this.getAssets(rel.targetAsset);
        const map = new Map<string, any>(assets.map(a => [String(a[pk]), a]));
        targetCaches.set(rel.targetAsset, { assets, pk, map });
      }
    }

    const primaryKey = schema.primaryKey || schema.identityField || "id";

    return rawAssets.map(item => {
      const resolvedFields: Record<string, any> = {};

      for (const [relKey, rel] of Object.entries(relations)) {
        const cache = targetCaches.get(rel.targetAsset);
        if (!cache) continue;

        if (rel.type === "belongsTo") {
          const fkVal = item[rel.foreignKey];
          if (fkVal !== undefined && fkVal !== null && fkVal !== "") {
            resolvedFields[relKey] = cache.map.get(String(fkVal)) || null;
          } else {
            resolvedFields[relKey] = null;
          }
        } else if (rel.type === "hasMany") {
          const myId = item[primaryKey];
          resolvedFields[relKey] = cache.assets.filter(
            target => String(target[rel.foreignKey]) === String(myId)
          );
        } else if (rel.type === "hasOne") {
          const myId = item[primaryKey];
          resolvedFields[relKey] = cache.assets.find(
            target => String(target[rel.foreignKey]) === String(myId)
          ) || null;
        }
      }

      return {
        ...item,
        ...resolvedFields,
        _resolved: resolvedFields
      };
    });
  }

  public saveAsset(entityType: string, id: string, data: any): { success: boolean; data: any } {
    const folder = this.getAssetFolder(entityType);
    const sanitizedId = id.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const filePath = path.join(folder, `${sanitizedId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    return { success: true, data };
  }

  public deleteAsset(entityType: string, id: string): boolean {
    const folder = this.getAssetFolder(entityType);
    const sanitizedId = id.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const filePath = path.join(folder, `${sanitizedId}.json`);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        return true;
      } catch {}
    }
    return false;
  }

  // --- Universal Scanner Ingestion Helper ---
  public parseScannerFileContent(rawText: string): string[] {
    const lines = rawText.split(/\r?\n/);
    const codes: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || line.toLowerCase().startsWith("timestamp")) continue;

      if (line.includes(",")) {
        const parts = line.split(",").map(p => p.trim());
        const candidate = parts[parts.length - 1] || parts[0];
        if (candidate) codes.push(candidate);
      } else {
        codes.push(line);
      }
    }

    return Array.from(new Set(codes));
  }

  public ingestScannedBatch(params: {
    serials: string[];
    sensorType?: string;
    hwVersion?: string;
    fwVersion?: string;
    targetMode?: "in_stock" | "in_kit";
    targetKitId?: string;
    entityType?: string;
  }): { importedCount: number; updatedCount: number; results: any[] } {
    const { serials, sensorType, hwVersion, fwVersion, targetMode, targetKitId } = params;
    const entityType = params.entityType || (this.getSchema("sensor") ? "sensor" : "gear");
    const existingItems = this.getAssets(entityType);
    const pk = entityType === "gear" ? "code" : "serial_number";
    const existingMap = new Map<string, any>(existingItems.map(s => [s[pk], s]));

    let importedCount = 0;
    let updatedCount = 0;
    const results: any[] = [];
    const today = new Date().toISOString().split("T")[0];

    for (const sn of serials) {
      const trimmedSn = sn.trim();
      if (!trimmedSn) continue;

      const existing = existingMap.get(trimmedSn);
      let record: any;

      if (existing) {
        record = {
          ...existing,
          hw_version: hwVersion || existing.hw_version,
          fw_version: fwVersion || existing.fw_version,
          scan_date: today,
          status: targetMode === "in_kit" && targetKitId ? "in_kit" : (targetMode === "in_stock" ? "in_stock" : existing.status),
          kit_id: targetMode === "in_kit" && targetKitId ? targetKitId : (targetMode === "in_stock" ? "" : existing.kit_id)
        };
        updatedCount++;
      } else {
        if (entityType === "gear") {
          record = {
            code: trimmedSn,
            name: `Scanned Item ${trimmedSn}`,
            category: "Camping",
            condition: "Good",
            weight_kg: 1.0,
            status: targetMode === "in_kit" && targetKitId ? "packed" : "ready"
          };
        } else {
          let inferredType = sensorType || "TP";
          const upper = trimmedSn.toUpperCase();
          if (upper.includes("-Z-") || upper.startsWith("Z-")) inferredType = "Z";
          else if (upper.includes("-TP-") || upper.startsWith("TP-")) inferredType = "TP";
          else if (upper.includes("-SIGMA-") || upper.startsWith("SIGMA-")) inferredType = "Sigma";
          else if (upper.includes("-OMEGA-") || upper.startsWith("OMEGA-")) inferredType = "Omega";

          record = {
            serial_number: trimmedSn,
            sensor_type: inferredType,
            hw_version: hwVersion || "v1.2",
            fw_version: fwVersion || "1.4.0",
            status: targetMode === "in_kit" && targetKitId ? "in_kit" : "in_stock",
            kit_id: targetMode === "in_kit" && targetKitId ? targetKitId : "",
            customer_id: "",
            scan_date: today,
            notes: `Ingested via scanner on ${today}`
          };
        }
        importedCount++;
      }

      this.saveAsset(entityType, trimmedSn, record);
      results.push(record);
    }

    return { importedCount, updatedCount, results };
  }

}
