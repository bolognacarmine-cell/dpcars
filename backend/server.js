import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";

const app = express();
app.use(cors());
app.use(express.json()); // per leggere body JSON [web:22]

// 1) Serve le immagini caricate: http://localhost:3001/uploads/xxx.jpg
app.use("/uploads", express.static("uploads")); // express.static [web:139]

// 2) Mini “DB” su file JSON
const DB_DIR = "data";
const DB_PATH = path.join(DB_DIR, "vehicles.json");

function ensureDb() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, "[]");
}

function readVehicles() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function writeVehicles(vehicles) {
  ensureDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(vehicles, null, 2));
}

// 3) Multer: salva file su /uploads
const UPLOADS_DIR = "uploads";
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^\w.-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({ storage }); // Multer disk storage [web:20]

// --- HEALTH ---
app.get("/api/health", (req, res) => res.json({ ok: true }));

// --- PUBLIC: INVENTARIO ---
app.get("/api/vehicles", (req, res) => {
  const {
    type = "all",
    search = "",
    sort = "price-asc",
    page = "1",
    limit = "6"
  } = req.query;

  let vehicles = readVehicles();

  // filtro type (auto/moto/all)
  if (type !== "all") vehicles = vehicles.filter(v => v.type === type);

  // ricerca semplice su title/fuel/transmission
  const q = String(search).trim().toLowerCase();
  if (q) {
    vehicles = vehicles.filter(v =>
      String(v.title || "").toLowerCase().includes(q) ||
      String(v.fuel || "").toLowerCase().includes(q) ||
      String(v.transmission || "").toLowerCase().includes(q)
    );
  }

  // sort
  const sorted = [...vehicles];
  switch (sort) {
    case "price-desc":
      sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
      break;
    case "year-desc":
      sorted.sort((a, b) => (b.year || 0) - (a.year || 0));
      break;
    case "km-asc":
      sorted.sort((a, b) => (a.km || 0) - (b.km || 0));
      break;
    case "price-asc":
    default:
      sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
      break;
  }

  // paginazione (Carica altri)
  const p = Math.max(1, Number(page));
  const l = Math.max(1, Number(limit));
  const total = sorted.length;
  const start = (p - 1) * l;
  const data = sorted.slice(start, start + l);

  res.json({ data, page: p, limit: l, total });
});

// --- ADMIN: CREA VEICOLO + UPLOAD FOTO ---
app.post("/api/admin/vehicles", upload.array("images", 10), (req, res) => {
  const vehicles = readVehicles();

  const {
    type,
    title,
    price,
    year,
    km,
    fuel,
    transmission,
    power,
    status
  } = req.body;

  if (!type || !title) {
    return res.status(400).json({ error: "type e title sono obbligatori" });
  }

  const id = vehicles.length ? Math.max(...vehicles.map(v => v.id)) + 1 : 1;

  const imageUrls = (req.files || []).map(f => `/uploads/${f.filename}`);

  const vehicle = {
    id,
    type,
    title,
    price: Number(price),
    year: Number(year),
    km: Number(km),
    fuel,
    transmission,
    power,
    status: status || "available",
    images: imageUrls
  };

  vehicles.push(vehicle);
  writeVehicles(vehicles);

  res.status(201).json(vehicle);
});

// --- ADMIN: ELENCO COMPLETO (utile per pannello) ---
app.get("/api/admin/vehicles", (req, res) => {
  res.json({ data: readVehicles() });
});

// --- ADMIN: CANCELLA ---
app.delete("/api/admin/vehicles/:id", (req, res) => {
  const id = Number(req.params.id);
  const vehicles = readVehicles();
  const next = vehicles.filter(v => v.id !== id);

  if (next.length === vehicles.length) {
    return res.status(404).json({ error: "Veicolo non trovato" });
  }

  writeVehicles(next);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server DP Cars avviato su:`);
  console.log(`   📍 Locale: http://localhost:${PORT}`);
  console.log(`   🌐 Rete: http://192.168.1.188:${PORT}`);
  console.log(`   📊 API: http://192.168.1.188:${PORT}/api/vehicles`);
});
