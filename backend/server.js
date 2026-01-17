const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));

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

const UPLOADS_DIR = "uploads";
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^\w.-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({ storage });

// HEALTH
app.get("/api/health", (req, res) => {
  console.log("✅ Health check");
  res.json({ ok: true });
});

// VEHICLES PUBLIC
app.get("/api/vehicles", (req, res) => {
  console.log("📋 GET /api/vehicles");
  const { type = "all", search = "", sort = "price-asc", page = "1", limit = "6" } = req.query;
  let vehicles = readVehicles();
  
  if (type !== "all") vehicles = vehicles.filter(v => v.type === type);
  
  const q = String(search).trim().toLowerCase();
  if (q) {
    vehicles = vehicles.filter(v =>
      String(v.title || "").toLowerCase().includes(q) ||
      String(v.fuel || "").toLowerCase().includes(q) ||
      String(v.transmission || "").toLowerCase().includes(q)
    );
  }
  
  const sorted = [...vehicles];
  switch (sort) {
    case "price-desc": sorted.sort((a, b) => (b.price || 0) - (a.price || 0)); break;
    case "year-desc": sorted.sort((a, b) => (b.year || 0) - (a.year || 0)); break;
    case "km-asc": sorted.sort((a, b) => (a.km || 0) - (b.km || 0)); break;
    default: sorted.sort((a, b) => (a.price || 0) - (b.price || 0)); break;
  }
  
  const p = Math.max(1, Number(page));
  const l = Math.max(1, Number(limit));
  const total = sorted.length;
  const start = (p - 1) * l;
  const data = sorted.slice(start, start + l);
  
  res.json({ data, page: p, limit: l, total });
});

// ADMIN - GET ALL VEHICLES
app.get("/api/admin/vehicles", (req, res) => {
  console.log("📋 GET /api/admin/vehicles");
  const vehicles = readVehicles();
  console.log(`✅ Ritornati ${vehicles.length} veicoli`);
  res.json({ data: vehicles });
});

// ADMIN - CREATE VEHICLE
app.post("/api/admin/vehicles", upload.array("images", 10), (req, res) => {
  console.log("➕ POST /api/admin/vehicles");
  console.log("Body:", req.body);
  console.log("Files:", req.files?.length || 0);
  
  try {
    // Verifica minimo 5 foto
    if (!req.files || req.files.length < 5) {
      console.log("❌ Numero foto insufficiente:", req.files?.length || 0);
      return res.status(400).json({ error: "Devi caricare almeno 5 foto del veicolo" });
    }
    
    const vehicles = readVehicles();
    const newId = vehicles.length > 0 ? Math.max(...vehicles.map(v => v.id || 0)) + 1 : 1;
    
    const imagePaths = (req.files || []).map(f => `/uploads/${f.filename}`);
    
    const newVehicle = {
      id: newId,
      type: req.body.type || "auto",
      title: req.body.title || "",
      price: Number(req.body.price) || 0,
      year: Number(req.body.year) || 0,
      km: Number(req.body.km) || 0,
      fuel: req.body.fuel || "",
      transmission: req.body.transmission || "",
      power: req.body.power || "",
      status: req.body.status || "available",
      images: imagePaths
    };
    
    vehicles.push(newVehicle);
    writeVehicles(vehicles);
    
    console.log(`✅ Veicolo creato con ID ${newId} e ${imagePaths.length} foto`);
    res.json({ success: true, data: newVehicle });
  } catch (error) {
    console.error("❌ Errore POST:", error);
    res.status(500).json({ error: error.message });
  }
});

// ADMIN - DELETE VEHICLE
app.delete("/api/admin/vehicles/:id", (req, res) => {
  console.log("🗑️ DELETE /api/admin/vehicles/" + req.params.id);
  
  try {
    const id = parseInt(req.params.id);
    console.log("ID da eliminare:", id);
    
    let vehicles = readVehicles();
    console.log("Veicoli prima dell'eliminazione:", vehicles.length);
    
    const index = vehicles.findIndex(v => v.id === id);
    console.log("Index trovato:", index);
    
    if (index === -1) {
      console.log("❌ Veicolo non trovato");
      return res.status(404).json({ error: "Veicolo non trovato" });
    }
    
    const vehicle = vehicles[index];
    
    // Elimina immagini dal disco
    if (vehicle.images && vehicle.images.length > 0) {
      vehicle.images.forEach(imgPath => {
        const fullPath = path.join(__dirname, imgPath.replace(/^\//, ""));
        if (fs.existsSync(fullPath)) {
          try {
            fs.unlinkSync(fullPath);
            console.log(`  ✅ Immagine eliminata: ${fullPath}`);
          } catch (err) {
            console.error(`  ⚠️ Errore eliminazione immagine:`, err.message);
          }
        }
      });
    }
    
    // Rimuovi veicolo dall'array
    vehicles.splice(index, 1);
    writeVehicles(vehicles);
    
    console.log(`✅ Veicolo ${id} eliminato! Rimasti: ${vehicles.length}`);
    res.json({ success: true, message: "Veicolo eliminato" });
  } catch (error) {
    console.error("❌ Errore DELETE:", error);
    res.status(500).json({ error: error.message });
  }
});

// START SERVER
const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚗 ==========================================`);
  console.log(`✅ Server DP Cars avviato su porta ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`==========================================\n`);
});
