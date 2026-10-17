<div align="center">

# 📦 ass.man
### *Asset Manager Engine*

**A schema-driven, file-based asset manager with mobile barcode scanning and declarative views.**

[![CI](https://github.com/cooked/ass.man/actions/workflows/ci.yml/badge.svg)](https://github.com/cooked/ass.man/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-brightgreen.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](Dockerfile)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](tsconfig.json)

<p align="center">
  <a href="#-overview">Overview</a> •
  <a href="#-comparison-with-alternatives">Comparison with Alternatives</a> •
  <a href="#-quickstart">Quickstart</a> •
  <a href="#-how-it-works">How It Works</a> •
  <a href="#-sample-domain">Sample Domain</a> •
  <a href="#-mobile-companion-scanner">Mobile Scanner</a>
</p>

</div>

---

## 📖 Overview

`ass.man` is a lightweight asset management tool for tracking physical equipment, modular kits, and locations without requiring a relational database.

Entity types are defined using standard **JSON Schemas** (`draft-07`), while screens are configured via **declarative view templates**. All records are saved directly to disk as human-readable JSON files that can be inspected, edited, or committed to Git.

```
 schemas/*.schema.json   ──►  Metamodel & Relations
 views/*.view.json       ──►  UI Layout (Grids, Maps, Kit Composer)
 data/*/*.json           ──►  Plain JSON File Storage (Git-friendly)
 Mobile Viewfinder       ──►  In-browser Barcode & DataMatrix Scanner
```

---

## ⚖️ Comparison with Alternatives

The following table summarizes architectural characteristics of `ass.man` compared to other tools commonly used for asset tracking, structured data, or content:

| Feature / Property | **Snipe-IT** | **Directus / NocoDB** | **TinaCMS / Flat-file CMS** | **ass.man** |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Domain** | Corporate IT Asset Management | Database-backed Applications | Websites & Editorial Content | Physical Equipment & Modular Kits |
| **Storage Backend** | MySQL / MariaDB | PostgreSQL / MySQL / SQLite | Git repository (Markdown/JSON) | Local Filesystem (Plain JSON files) |
| **Schema Definition** | Fixed tables + custom field GUI | Visual DB table builder | Config YAML / TypeScript | Standard JSON Schema (`draft-07`) |
| **UI Views** | Pre-built ITAM views | Dynamic tables & dashboards | Visual component blocks | Declarative templates (`*.view.json`) |
| **Barcode / Scanning** | Barcode label generation | Manual input / plugins | None | In-browser camera scanner (ZXing) |
| **Kit / Pack Assembly** | Asset grouping | Relational joins | None | Slot-based composer with validation |
| **Concurrency Model** | Database row locks | Optimistic DB concurrency | Git branch / merge conflicts | Real-time TTL collaborative file locks |
| **Infrastructure** | PHP + Web server + MySQL | Node.js / Docker + SQL database | Static build or Node service | Single Node process / Docker container |

### Key Considerations

* **Enterprise IT Asset Management (e.g., Snipe-IT)**: Designed for corporate IT environments requiring financial depreciation accounting, purchase order workflows, software license compliance, digital signatures, and LDAP/SAML integration. `ass.man` does not provide accounting, purchasing, or license management features.
* **Database GUIs & Headless CMS (e.g., Directus, NocoDB)**: Designed for applications requiring full relational database capabilities, complex SQL joins, stored procedures, strict ACID transactions, or datasets with hundreds of thousands of records. `ass.man` uses flat files instead of a database, prioritizing zero-setup execution, file inspectability, and Git version control over SQL query capabilities.
* **Flat-file & Git CMS (e.g., TinaCMS, Decap CMS)**: Designed for editorial websites, blogs, and documentation where the primary content is Markdown text. `ass.man` shares a similar file-based and Git-friendly approach, but is built specifically for structured physical asset tracking, slot-based kit composition, and camera-based barcode scanning rather than prose publishing.

---

## 🚀 Quickstart

### Option 1: CLI (Zero Install)
```bash
# Initialize a new workspace with starter schemas
npx assman init my-inventory

# Start the server and view templates
cd my-inventory
npx assman serve
```
Open [http://localhost:3100](http://localhost:3100) in your browser.

### Option 2: Docker
Mount your local directories into the pre-built container:
```bash
docker run -d \
  -p 3100:3100 \
  -p 3101:3101 \
  -v $(pwd)/schemas:/app/schemas \
  -v $(pwd)/views:/app/views \
  -v $(pwd)/data:/app/data \
  --name assman \
  ghcr.io/cooked/ass.man:latest
```

### Option 3: Local Clone
```bash
git clone https://github.com/cooked/ass.man.git
cd ass.man
npm install
npm run dev
```

---

## 🧩 How It Works

### 1. Define Entities (`schemas/*.schema.json`)
Entities are standard JSON Schema (`draft-07`) files with relation definitions:
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

### 2. Declare Views (`views/*.view.json`)
Views define how data is presented in the web UI. Supported renderers include:
* **`spreadsheet-grid`**: Virtualized table with column filtering, multi-sort, search, and drawer editor.
* **`kit-manager`**: Slot-based pack builder with specification checklists.
* **`customers-map`**: Interactive Leaflet map plotting latitude and longitude coordinates.
* **`users-manager`**: Team and contact directory.

Example View:
```json
{
  "id": "gear-inventory",
  "title": "Gear Inventory",
  "targetAsset": "gear",
  "renderer": "spreadsheet-grid",
  "config": {
    "searchable": true,
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
Each asset record is saved as an individual JSON file:
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

---

## ⛺ Sample Domain: Friends, Places & Gear

To help you explore the features right away, the repository includes a sample domain:

1. **Crew Directory (`people/`)**: Members with roles, availability, and contact info.
2. **Places & Hangouts (`places/`)**: Destinations with real GPS coordinates plotted on the interactive Leaflet map.
3. **Shared Gear (`gear/`)**: Outdoor and electronic items tagged with barcodes and DataMatrix codes.
4. **Adventure Packs (`adventures/`)**: Packs with required equipment slots validated in real time.

---

## 📱 Mobile Companion Scanner

Any smartphone can act as a field scanner:

1. Click **Pair Phone** in the top navigation bar.
2. Scan the on-screen QR code with your phone.
3. The mobile browser opens the camera scanner:
   * **Real-time Recognition**: Decodes DataMatrix and 1D/2D barcodes using ZXing.
   * **Visual Tracking Markers**: Overlays green tracking brackets directly onto detected codes in the video feed.
   * **Slot Assignment**: In pack mode, scanning an item automatically fills the active slot in the kit.

---

## 🔒 Collaborative File Locks

To avoid conflicting edits when multiple people access the same data:
* Opening an item for editing creates a temporary lock file in `data/.locks`.
* Other users see a lock indicator displaying who is currently editing the item and how long the lock will remain active.
* Locks automatically expire after the configured TTL (default: 10 minutes) or can be released manually by an administrator.

---

## ⚙️ Configuration

Environment variables:
```bash
ASSMAN_PORT=3100                  # HTTP port (default: 3100)
ASSMAN_HTTPS_PORT=3101            # HTTPS port for mobile camera access (default: 3101)
ASSMAN_SCHEMAS_PATH=./schemas     # Directory for *.schema.json files
ASSMAN_VIEWS_PATH=./views         # Directory for *.view.json files
ASSMAN_DATA_PATH=./data           # Storage directory
```

---

## 📄 License

Distributed under the [MIT License](LICENSE).
