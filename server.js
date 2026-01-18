require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve file statici
app.use("/uploads", express.static("uploads"));
app.use("/contents", express.static("contents"));
app.use("/components", express.static("components"));
app.use(express.static(__dirname)); // Serve tutti i file della root (index.html, logo.jpg, video.mp4, ecc.)

// Database configuration
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

// Upload configuration
const UPLOADS_DIR = "uploads";
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^\w.-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max per file
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Solo immagini sono permesse (jpeg, jpg, png, webp)'));
  }
});

// ==================== ROUTES ====================

// HEALTH CHECK
app.get("/api/health", (req, res) => {
  console.log("✅ Health check");
  res.json({ 
    ok: true, 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// PUBLIC - GET VEHICLES (con filtri, ricerca, ordinamento e paginazione)
app.get("/api/vehicles", (req, res) => {
  console.log("📋 GET /api/vehicles");
  
  try {
    const { 
      type = "all", 
      search = "", 
      sort = "price-asc", 
      page = "1", 
      limit = "6" 
    } = req.query;
    
    let vehicles = readVehicles();
    
    // Filtro per tipo
    if (type !== "all") {
      vehicles = vehicles.filter(v => v.type === type);
    }
    
    // Filtro ricerca
    const q = String(search).trim().toLowerCase();
    if (q) {
      vehicles = vehicles.filter(v =>
        String(v.title || "").toLowerCase().includes(q) ||
        String(v.fuel || "").toLowerCase().includes(q) ||
        String(v.transmission || "").toLowerCase().includes(q)
      );
    }
    
    // Ordinamento
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
      case "km-desc": 
        sorted.sort((a, b) => (b.km || 0) - (a.km || 0)); 
        break;
      default: 
        sorted.sort((a, b) => (a.price || 0) - (b.price || 0)); 
        break;
    }
    
    // Paginazione
    const p = Math.max(1, Number(page));
    const l = Math.max(1, Number(limit));
    const total = sorted.length;
    const totalPages = Math.ceil(total / l);
    const start = (p - 1) * l;
    const data = sorted.slice(start, start + l);
    
    console.log(`✅ Ritornati ${data.length} veicoli (${total} totali)`);
    
    res.json({ 
      success: true,
      data, 
      page: p, 
      limit: l, 
      total,
      totalPages
    });
  } catch (error) {
    console.error("❌ Errore GET /api/vehicles:", error);
    res.status(500).json({ 
      success: false,
      error: "Errore nel recupero dei veicoli" 
    });
  }
});

// PUBLIC - GET SINGLE VEHICLE
app.get("/api/vehicles/:id", (req, res) => {
  console.log("📋 GET /api/vehicles/" + req.params.id);
  
  try {
    const id = parseInt(req.params.id);
    const vehicles = readVehicles();
    const vehicle = vehicles.find(v => v.id === id);
    
    if (!vehicle) {
      console.log("❌ Veicolo non trovato");
      return res.status(404).json({ 
        success: false,
        error: "Veicolo non trovato" 
      });
    }
    
    console.log(`✅ Veicolo ${id} trovato`);
    res.json({ 
      success: true,
      data: vehicle 
    });
  } catch (error) {
    console.error("❌ Errore GET /api/vehicles/:id:", error);
    res.status(500).json({ 
      success: false,
      error: "Errore nel recupero del veicolo" 
    });
  }
});

// ADMIN - GET ALL VEHICLES
app.get("/api/admin/vehicles", (req, res) => {
  console.log("📋 GET /api/admin/vehicles");
  
  try {
    const vehicles = readVehicles();
    console.log(`✅ Ritornati ${vehicles.length} veicoli`);
    
    res.json({ 
      success: true,
      data: vehicles,
      count: vehicles.length
    });
  } catch (error) {
    console.error("❌ Errore GET /api/admin/vehicles:", error);
    res.status(500).json({ 
      success: false,
      error: "Errore nel recupero dei veicoli" 
    });
  }
});

// ADMIN - CREATE VEHICLE
app.post("/api/admin/vehicles", upload.array("images", 10), (req, res) => {
  console.log("➕ POST /api/admin/vehicles");
  console.log("Body:", req.body);
  console.log("Files:", req.files?.length || 0);
  
  try {
    // Validazione numero minimo foto
    if (!req.files || req.files.length < 5) {
      console.log("❌ Numero foto insufficiente:", req.files?.length || 0);
      return res.status(400).json({ 
        success: false,
        error: "Devi caricare almeno 5 foto del veicolo" 
      });
    }
    
    // Validazione campi obbligatori
    if (!req.body.title || req.body.title.trim().length < 3) {
      return res.status(400).json({ 
        success: false,
        error: "Il titolo deve essere almeno 3 caratteri" 
      });
    }
    
    if (!req.body.price || Number(req.body.price) <= 0) {
      return res.status(400).json({ 
        success: false,
        error: "Il prezzo deve essere maggiore di 0" 
      });
    }
    
    const vehicles = readVehicles();
    const newId = vehicles.length > 0 ? Math.max(...vehicles.map(v => v.id || 0)) + 1 : 1;
    
    const imagePaths = (req.files || []).map(f => `/uploads/${f.filename}`);
    
    const newVehicle = {
      id: newId,
      type: req.body.type || "auto",
      title: req.body.title.trim(),
      price: Number(req.body.price) || 0,
      year: Number(req.body.year) || 0,
      km: Number(req.body.km) || 0,
      fuel: req.body.fuel || "",
      transmission: req.body.transmission || "",
      power: req.body.power || "",
      status: req.body.status || "available",
      images: imagePaths,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    vehicles.push(newVehicle);
    writeVehicles(vehicles);
    
    console.log(`✅ Veicolo creato con ID ${newId} e ${imagePaths.length} foto`);
    res.status(201).json({ 
      success: true, 
      data: newVehicle,
      message: "Veicolo creato con successo"
    });
  } catch (error) {
    console.error("❌ Errore POST:", error);
    res.status(500).json({ 
      success: false,
      error: error.message || "Errore nella creazione del veicolo"
    });
  }
});

// ADMIN - UPDATE VEHICLE
app.put("/api/admin/vehicles/:id", upload.array("images", 10), (req, res) => {
  console.log("✏️ PUT /api/admin/vehicles/" + req.params.id);
  
  try {
    const id = parseInt(req.params.id);
    const vehicles = readVehicles();
    const index = vehicles.findIndex(v => v.id === id);
    
    if (index === -1) {
      console.log("❌ Veicolo non trovato");
      return res.status(404).json({ 
        success: false,
        error: "Veicolo non trovato" 
      });
    }
    
    const existingVehicle = vehicles[index];
    
    // Se ci sono nuove immagini, aggiungi ai path esistenti
    let imagePaths = existingVehicle.images || [];
    if (req.files && req.files.length > 0) {
      const newPaths = req.files.map(f => `/uploads/${f.filename}`);
      imagePaths = [...imagePaths, ...newPaths];
    }
    
    const updatedVehicle = {
      ...existingVehicle,
      type: req.body.type || existingVehicle.type,
      title: req.body.title ? req.body.title.trim() : existingVehicle.title,
      price: req.body.price ? Number(req.body.price) : existingVehicle.price,
      year: req.body.year ? Number(req.body.year) : existingVehicle.year,
      km: req.body.km ? Number(req.body.km) : existingVehicle.km,
      fuel: req.body.fuel || existingVehicle.fuel,
      transmission: req.body.transmission || existingVehicle.transmission,
      power: req.body.power || existingVehicle.power,
      status: req.body.status || existingVehicle.status,
      images: imagePaths,
      updatedAt: new Date().toISOString()
    };
    
    vehicles[index] = updatedVehicle;
    writeVehicles(vehicles);
    
    console.log(`✅ Veicolo ${id} aggiornato`);
    res.json({ 
      success: true, 
      data: updatedVehicle,
      message: "Veicolo aggiornato con successo"
    });
  } catch (error) {
    console.error("❌ Errore PUT:", error);
    res.status(500).json({ 
      success: false,
      error: error.message || "Errore nell'aggiornamento del veicolo"
    });
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
      return res.status(404).json({ 
        success: false,
        error: "Veicolo non trovato" 
      });
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
    res.json({ 
      success: true, 
      message: "Veicolo eliminato con successo",
      deletedId: id
    });
  } catch (error) {
    console.error("❌ Errore DELETE:", error);
    res.status(500).json({ 
      success: false,
      error: error.message || "Errore nell'eliminazione del veicolo"
    });
  }
});

// ADMIN - DELETE SINGLE IMAGE
app.delete("/api/admin/vehicles/:id/images", (req, res) => {
  console.log("🗑️ DELETE /api/admin/vehicles/" + req.params.id + "/images");
  
  try {
    const id = parseInt(req.params.id);
    const { imagePath } = req.body;
    
    if (!imagePath) {
      return res.status(400).json({ 
        success: false,
        error: "imagePath è obbligatorio" 
      });
    }
    
    const vehicles = readVehicles();
    const index = vehicles.findIndex(v => v.id === id);
    
    if (index === -1) {
      return res.status(404).json({ 
        success: false,
        error: "Veicolo non trovato" 
      });
    }
    
    const vehicle = vehicles[index];
    
    // Rimuovi l'immagine dall'array
    vehicle.images = vehicle.images.filter(img => img !== imagePath);
    
    // Elimina il file fisico
    const fullPath = path.join(__dirname, imagePath.replace(/^\//, ""));
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`✅ Immagine eliminata: ${fullPath}`);
    }
    
    vehicle.updatedAt = new Date().toISOString();
    vehicles[index] = vehicle;
    writeVehicles(vehicles);
    
    res.json({ 
      success: true, 
      message: "Immagine eliminata",
      data: vehicle
    });
  } catch (error) {
    console.error("❌ Errore DELETE image:", error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: "Endpoint non trovato" 
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error("❌ Errore generale:", err);
  res.status(err.status || 500).json({ 
    success: false,
    error: err.message || "Errore interno del server" 
  });
});

// START SERVER
const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚗 ==========================================`);
  console.log(`✅ Server DP Cars avviato su porta ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`📍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`==========================================\n`);
});

module.exports = app;
