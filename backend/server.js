require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const PORT = process.env.PORT || 4000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const ROOT_DIR = path.join(__dirname, '..');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ---------- DB ----------
const db = new Database(path.join(__dirname, 'data.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT,
    apellido TEXT,
    whatsapp TEXT,
    fecha TEXT
  );
`);

const DEFAULT_DATA = {
  basePrice: 350000,
  dailyDropPercent: 2,
  totalDays: 30,
  launchDate: new Date().toISOString(),
  description:
    'Una propiedad única. El valor comienza en un precio publicado y baja cada día hasta que alguien la reserve primero.',
  features: [
    'Una sola propiedad',
    'Precio visible cada día',
    '30 días para decidir',
    'Reserva directa'
  ],
  photos: [
    '/v2-house.jpg',
    '/header.jpg',
    '/WhatsApp Image 2026-06-10 at 18.31.32.jpeg',
    '/WhatsApp Image 2026-06-10 at 18.31.33.jpeg'
  ],
  videoUrl: '',
  likes: 354
};

const existing = db.prepare('SELECT data FROM settings WHERE id = 1').get();
if (!existing) {
  db.prepare('INSERT INTO settings (id, data) VALUES (1, ?)').run(
    JSON.stringify(DEFAULT_DATA)
  );
}

function getSettings() {
  const row = db.prepare('SELECT data FROM settings WHERE id = 1').get();
  return JSON.parse(row.data);
}

function saveSettings(data) {
  db.prepare('UPDATE settings SET data = ? WHERE id = 1').run(
    JSON.stringify(data)
  );
}

// ---------- APP ----------
const app = express();
app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 } // 8 horas
  })
);

// Static: sitio público (raíz del proyecto), uploads y panel admin
app.use(express.static(ROOT_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));

// ---------- Auth helpers ----------
const ADMIN_HASH = bcrypt.hashSync(ADMIN_PASSWORD, 10);

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: 'No autorizado' });
}

// ---------- Auth routes ----------
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (password && bcrypt.compareSync(password, ADMIN_HASH)) {
    req.session.isAdmin = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Contraseña incorrecta' });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/admin/check', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// ---------- Public property data ----------
app.get('/api/property', (req, res) => {
  res.json(getSettings());
});

// ---------- "Me interesa" likes ----------
app.post('/api/likes', (req, res) => {
  const current = getSettings();
  current.likes = (current.likes || 0) + 1;
  saveSettings(current);
  res.json({ likes: current.likes });
});

// ---------- Admin: update property data ----------
app.put('/api/admin/property', requireAuth, (req, res) => {
  const current = getSettings();
  const body = req.body || {};

  const updated = {
    ...current,
    basePrice: Number(body.basePrice) || current.basePrice,
    dailyDropPercent:
      body.dailyDropPercent !== undefined
        ? Number(body.dailyDropPercent)
        : current.dailyDropPercent,
    totalDays: Number(body.totalDays) || current.totalDays,
    description:
      typeof body.description === 'string'
        ? body.description
        : current.description,
    features: Array.isArray(body.features)
      ? body.features.slice(0, 4)
      : current.features,
    photos: Array.isArray(body.photos) ? body.photos : current.photos,
    videoUrl:
      typeof body.videoUrl === 'string' ? body.videoUrl : current.videoUrl
  };

  saveSettings(updated);
  res.json(updated);
});

// Reinicia el ciclo de 30 días (nueva publicación)
app.post('/api/admin/restart-cycle', requireAuth, (req, res) => {
  const current = getSettings();
  current.launchDate = new Date().toISOString();
  saveSettings(current);
  res.json(current);
});

// ---------- Uploads (fotos / video) ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, name);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB (para videos)
});

app.post(
  '/api/admin/upload',
  requireAuth,
  upload.single('file'),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Falta archivo' });
    res.json({ url: `/uploads/${req.file.filename}` });
  }
);

// ---------- Leads (interesados) ----------
app.post('/api/leads', (req, res) => {
  const { nombre, apellido, whatsapp } = req.body || {};
  if (!nombre || !apellido || !whatsapp) {
    return res.status(400).json({ error: 'Faltan datos' });
  }
  db.prepare(
    'INSERT INTO leads (nombre, apellido, whatsapp, fecha) VALUES (?, ?, ?, ?)'
  ).run(nombre, apellido, whatsapp, new Date().toISOString());
  res.json({ ok: true });
});

app.get('/api/admin/leads', requireAuth, (req, res) => {
  const leads = db.prepare('SELECT * FROM leads ORDER BY id DESC').all();
  res.json(leads);
});

app.listen(PORT, () => {
  console.log(`One House backend corriendo en http://localhost:${PORT}`);
});
