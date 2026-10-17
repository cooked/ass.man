<div align="center">

# 📦 ass.man
### *Asset Manager Engine*

**The schema-driven, zero-database asset orchestration engine & Web AR field terminal.**

[![CI](https://github.com/ale/ass.man/actions/workflows/ci.yml/badge.svg)](https://github.com/ale/ass.man/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-brightgreen.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](Dockerfile)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](tsconfig.json)

<p align="center">
  <a href="#-why-assman">Why ass.man</a> •
  <a href="#-steelman-comparative-analysis">Steelman Comparison</a> •
  <a href="#-quickstart">Quickstart</a> •
  <a href="#-how-it-works">How It Works</a> •
  <a href="#-starter-domain-friends-places--gear">Starter Domain</a> •
  <a href="#-web-ar-companion">Web AR Companion</a> •
  <a href="#-distribution--deployment">Distribution</a>
</p>

</div>

---

## ⚡ The Big Idea

Most asset management tools force a false choice:
1. **Heavy Enterprise Systems** (like Snipe-IT) requiring relational databases, complex migrations, rigid relational schemas, and heavyweight hosting.
2. **Generic Headless CMS / No-Code Spreadsheets** (like Directus or NocoDB) that lack hardware-native features like real-time DataMatrix computer vision, kit slot validation, and lock concurrency.
3. **Static GitCMS tools** (like TinaCMS) which are built for marketing websites and lack physical asset lifecycle workflows.

**`ass.man`** bridges this divide. It treats your filesystem as the source of truth, uses standard **JSON Schemas** to define entities, renders views through **declarative JSON templates**, and includes an instant **zero-install Web AR scanner** for any smartphone camera.

```
                    ┌──────────────────────────┐
                    │   JSON Schema Metamodel  │  schemas/*.schema.json
                    └────────────┬─────────────┘
                                 │
     ┌───────────────────────────┼───────────────────────────┐
     ▼                           ▼                           ▼
┌──────────────┐         ┌──────────────┐            ┌──────────────┐
│ Declarative  │         │ Zero-DB File │            │ Web AR Field │
│ UI Templates │         │ Storage      │            │ Companion    │
│ views/*.json │         │ data/*.json  │            │ Live ZXing   │
└──────────────┘         └──────────────┘            └──────────────┘
```

---

## ⚖️ Steelman Comparative Analysis

To evaluate `ass.man` honestly, we steelman existing industry solutions, highlighting where they excel and where `ass.man` takes a fundamentally different architectural path:

| Feature Dimension | **Snipe-IT** | **Directus / NocoDB** | **TinaCMS / Decap** | **ass.man (This Project)** |
| :--- | :--- | :--- | :--- | :--- |
| **Data Layer** | MySQL / MariaDB (Relational) | PostgreSQL / SQLite / MySQL | Git repository (Markdown/JSON) | **Zero-DB File System / Git-native JSON** |
| **Schema Definition** | Fixed DB migrations & custom fields table | Visual GUI UI / DB introspection | Config YAML / TS code schemas | **Standard JSON Schema (`draft-07`)** |
| **UI Customization** | Monolithic Blade templates | Pre-baked Dashboard widgets | React components in site code | **Declarative View Templates (`*.view.json`)** |
| **Physical Barcode / AR** | Basic 2D barcode generator | None (manual text inputs) | None | **Live Web AR viewfinder with DataMatrix tracking** |
| **Kit Slot Validation** | Simple asset bundling | Relational joins (manual queries) | None | **First-class slot composer with spec validation** |
| **Concurrency** | DB row locks | Optimistic concurrency / DB locks | Git merge conflicts | **Real-time TTL Collaborative File Locks** |
| **Deployment Footprint** | PHP + Composer + MySQL + Redis | Node.js / Docker + External DB | Static build or Node process | **Single binary / 1-line `npx` / Alpine Docker** |

### 1. Versus Snipe-IT (The IT Asset Heavyweight)
* **Steelman for Snipe-IT**: Snipe-IT is mature, battle-tested, handles depreciation, purchasing orders, warranty lifecycles, and has LDAP/SAML integrations.
* **Why ass.man is different**: Snipe-IT requires managing a MySQL database, PHP-FPM, migrations, and a rigid data model. `ass.man` starts instantly with `npx assman serve`, stores raw readable JSON files you can inspect with `git diff`, and adapts to *any* physical domain (from friends' camping packs to high-tech IoT hardware).

### 2. Versus Directus & NocoDB (The Modern Headless CMS / Smart Spreadsheets)
* **Steelman for Directus/NocoDB**: Directus provides an exceptional REST/GraphQL API layer over any SQL database with fine-grained role permissions.
* **Why ass.man is different**: Directus is general-purpose content management. `ass.man` is purposefully engineered for physical hardware operations: modular kit verification, field companion pairing via QR code, live camera DataMatrix bounding-box tracking, and collaborative multi-user editing with visual lock indicators.

### 3. Versus TinaCMS & Git-backed CMSs
* **Steelman for TinaCMS**: Outstanding inline visual editing experience for content-heavy Jamstack websites.
* **Why ass.man is different**: Tina is optimized for publishing web pages and blog posts. `ass.man` is optimized for asset registries, geographic mapping of facilities and destinations, hardware firmware deployment tracking, and warehouse shelf scanning.

---

## 🚀 Quickstart

You have four frictionless ways to run `ass.man`:

### Option A: The 1-Line Zero-Install CLI (Recommended)
```bash
# Initialize a new workspace in your current directory
npx assman init my-assets

# Launch the server & Web AR terminal
cd my-assets
npx assman serve
```
Open [http://localhost:3100](http://localhost:3100) in your browser.

### Option B: Docker Container
Mount your own local directories into the pre-built multi-arch container:
```bash
docker run -d \
  -p 3100:3100 \
  -p 3101:3101 \
  -v $(pwd)/schemas:/app/schemas \
  -v $(pwd)/views:/app/views \
  -v $(pwd)/data:/app/data \
  --name assman \
  ghcr.io/ale/ass.man:latest
```

### Option C: Standalone Single Executable
Download the pre-compiled binary for macOS (Apple Silicon / Intel) or Linux from [GitHub Releases](https://github.com/ale/ass.man/releases):
```bash
chmod +x assman-macos-arm64
./assman-macos-arm64 --schemas ./my-schemas --data ./my-data
```

### Option D: Git Clone & Local Development
```bash
git clone https://github.com/ale/ass.man.git
cd ass.man
npm install
npm run dev
```

---

## 🧩 How It Works

### 1. Define Your Entities (`schemas/*.schema.json`)
Every entity is a clean standard JSON Schema with custom metadata:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "entity": "gear",
  "label": "Gear & Equipment",
  "primaryKey": "code",
  "properties": {
    "code": { "type": "string", "label": "Item Code / Tag", "required": true },
    "name": { "type": "string", "label": "Item Name", "required": true },
    "category": { "type": "string", "enum": ["Camping", "Photography", "Audio"] },
    "weight_kg": { "type": "number", "label": "Weight (kg)" },
    "status": { "type": "string", "enum": ["ready", "packed", "in_use", "repair"] }
  },
  "relations": {
    "owner": {
      "type": "belongsTo",
      "target": "person",
      "foreignKey": "owner_id"
    }
  }
}
```

### 2. Configure Your Views (`views/*.view.json`)
No front-end code required. Simply declare which renderer to use:
* **`spreadsheet-grid`**: High-density virtualized table with search, sorting, column formatters, and drawer inspectors.
* **`kit-manager`**: Slot-based pack and modular kit composer with real-time specification validation.
* **`customers-map`**: Interactive Leaflet map plotting coordinates with pins, badges, and filters.
* **`users-manager`**: People and role directory.

Example View Template:
```json
{
  "id": "gear-inventory",
  "title": "Gear Inventory",
  "targetAsset": "gear",
  "icon": "Cpu",
  "renderer": "spreadsheet-grid",
  "config": {
    "searchable": true,
    "defaultSort": { "field": "code", "order": "asc" },
    "columns": [
      { "field": "code", "label": "Code", "width": 160, "renderer": "mono-badge", "pinned": true },
      { "field": "name", "label": "Item Name", "width": 240, "renderer": "text" },
      { "field": "category", "label": "Category", "width": 130, "renderer": "type-pill" },
      { "field": "owner.name", "label": "Owner", "width": 160, "renderer": "relation-link" }
    ]
  }
}
```

### 3. File System Storage (`data/`)
Assets are stored directly as plain JSON files:
```
data/
├── gear/
│   ├── GEAR-CAM-101.json
│   └── GEAR-TENT-201.json
├── people/
│   ├── alex-rivers.json
│   └── elena-vance.json
└── adventures/
    └── ADV-ALPINE-TREK.json
```
Edit them in VS Code, commit them with Git, backup with rsync, or query them with `jq`!

---

## ⛺ Starter Domain: Friends, Places & Gear

To demonstrate `ass.man` in an intuitive, relatable context, the repository ships with a complete ready-to-run domain:

1. **Friends & Crew (`people/`)**: Alex Rivers (*The Navigator*), Elena Vance (*The Photographer*), Marco Rossi (*The Chef*), Sofia Chen (*The DJ*).
2. **Places & Destinations (`places/`)**: Alpine Refuges, Lakeside Camps, Hidden Beach Coves, and Retro Lounges plotted on an interactive Leaflet map.
3. **Shared Gear (`gear/`)**: Cameras, Ultralight Tents, Jetboil Stoves, Synthesizers, and Harnesses tagged with DataMatrix codes.
4. **Adventures & Activity Packs (`adventures/`)**: Custom packs with required equipment slots (e.g. *1x Camping, 1x Photography, 1x Audio*) verified in real-time.

---

## 📱 Web AR Companion

Turn any smartphone into a warehouse scanner without installing an app:

1. Click **Pair Phone** in the top navigation bar.
2. Scan the on-screen QR code with your phone.
3. Your mobile browser immediately opens the **Field Companion Viewfinder**:
   * **Real-time DataMatrix & Barcode Recognition** via ZXing computer vision.
   * **Visual Tracking Markers**: High-contrast animated brackets overlaid directly on detected codes in the live feed.
   * **Auditory & Haptic Feedback**: Beeps and vibrations on successful detection.
   * **Pack Slot Assignment**: Point the camera at a gear item tag to automatically fill the active adventure slot.

---

## 🔒 Collaborative Editing & Concurrency

`ass.man` provides non-blocking, multi-user safety:
* **Active Locks**: When an operator edits an asset, a temporary TTL lock is registered in `data/.locks`.
* **Visual Lock Badges**: Other teammates see lock badges in real time, preventing concurrent overwrites.
* **Administrator Override**: Admins can force-release stale locks with one click in the Settings drawer.

---

## 📦 Distribution & Deployment

### Environment Configuration
The core engine honors standard environment variables:
```bash
ASSMAN_PORT=3100                  # HTTP web port
ASSMAN_HTTPS_PORT=3101            # HTTPS port for secure mobile camera streaming
ASSMAN_SCHEMAS_PATH=./schemas     # Directory containing *.schema.json
ASSMAN_VIEWS_PATH=./views         # Directory containing *.view.json
ASSMAN_DATA_PATH=./data           # Storage directory
```

### First-Boot Onboarding Wizard
If you start `ass.man` with an empty `schemas/` directory, the engine automatically presents a **First-Boot Wizard** offering 1-click starter template injection:
* ⛺ **Friends, Places & Gear** (Universal community starter)
* 🏭 **Industrial IoT & Hardware BOM** (Sensors, Modular Kits & Firmware)
* 🖥️ **IT & Datacenter Infrastructure** (Servers, Workstations & Racks)
* 📝 **Custom Blank Slate**

---

## 🤝 Contributing

`ass.man` is an open-source community effort. We welcome contributions for:
* New declarative view renderers (Kanban boards, Timeline / Gantt, Hierarchy trees).
* Storage drivers (S3 / Git Sync adapters).
* Community schema packs.

```bash
# Fork & clone
git clone https://github.com/ale/ass.man.git
cd ass.man
npm install
npm run dev
```

---

## 📄 License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for details.
