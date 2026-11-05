const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!ADMIN_PASSWORD || !SESSION_SECRET) {
  console.error('Set ADMIN_PASSWORD and SESSION_SECRET environment variables before starting.');
  process.exit(1);
}

const DATA = path.join(__dirname, 'data');
const UPLOADS = path.join(__dirname, 'uploads');
const DB = path.join(DATA, 'projects.json');
const SETTINGS = path.join(DATA, 'settings.json');
fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });
if (!fs.existsSync(DB)) fs.writeFileSync(DB, '[]');
if (!fs.existsSync(SETTINGS)) fs.writeFileSync(SETTINGS, JSON.stringify({ instagram: '' }, null, 2));

const readProjects = () => JSON.parse(fs.readFileSync(DB, 'utf8'));
const writeProjects = projects => fs.writeFileSync(DB, JSON.stringify(projects, null, 2));
const ownerOnly = (req, res, next) => req.session.owner ? next() : res.status(401).json({ error: 'Owner sign-in required.' });
const maxUploadMb = Math.max(1, Number(process.env.MAX_UPLOAD_MB) || 500);

app.disable('x-powered-by');
app.use(express.json({ limit: '30kb' }));
app.use(session({
  name: 'df_owner',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 4 * 60 * 60 * 1000 }
}));

// Never expose private JSON data or server configuration as public files.
app.use('/data', (req, res) => res.sendStatus(404));
app.use(express.static(__dirname, {
  dotfiles: 'deny', index: 'index.html',
  setHeaders: (res, file) => {
    if (['server.js', 'package.json'].includes(path.basename(file))) res.status(404);
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));
app.use('/uploads', express.static(UPLOADS, {
  fallthrough: false,
  setHeaders: (res, file) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'attachment; filename="' + path.basename(file).replace(/["\\\r\n]/g, '_') + '"');
  }
}));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS),
  filename: (req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase())
});
// Accept creative, office, media, archive, font and 3D project formats, while blocking executable/web-code files.
const blockedExtensions = new Set([
  'exe','dll','com','msi','scr','bat','cmd','ps1','sh','bash','zsh','app','dmg','pkg',
  'jar','class','js','mjs','cjs','html','htm','xhtml','php','phtml','asp','aspx','jsp',
  'py','pyc','rb','pl','cgi','vbs','vbe','wsf','hta','reg','lnk','url','desktop'
]);
const upload = multer({
  storage,
  limits: { fileSize: maxUploadMb * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).slice(1).toLowerCase();
    if (!ext || blockedExtensions.has(ext)) return cb(new Error('This file type is blocked for website safety. Upload a project or document file instead.'));
    cb(null, true);
  }
});

app.post('/api/login', (req, res) => {
  const supplied = String(req.body.password || '');
  const a = Buffer.from(supplied);
  const b = Buffer.from(ADMIN_PASSWORD);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: 'Incorrect password.' });
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: 'Could not start owner session.' });
    req.session.owner = true;
    res.json({ ok: true });
  });
});
app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get('/api/me', (req, res) => res.json({ owner: !!req.session.owner }));
app.get('/api/settings', (req, res) => {
  const settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  res.json({ instagram: String(settings.instagram || '') });
});
app.put('/api/settings', ownerOnly, (req, res) => {
  const instagram = String(req.body.instagram || '').trim().replace(/^@/, '').slice(0, 30);
  if (instagram && !/^[A-Za-z0-9._]+$/.test(instagram)) return res.status(400).json({ error: 'Enter a valid Instagram username.' });
  fs.writeFileSync(SETTINGS, JSON.stringify({ instagram }, null, 2));
  res.json({ ok: true, instagram });
});
app.get('/api/projects', (req, res) => res.json(readProjects().map(p => ({
  ...p,
  downloadUrl: '/uploads/' + encodeURIComponent(p.storedName),
  previewUrl: p.preview ? '/uploads/' + encodeURIComponent(p.storedName) : null
}))));
app.post('/api/projects', ownerOnly, upload.single('project'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a project file.' });
  const title = String(req.body.title || '').trim().slice(0, 90);
  if (!title) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Project title is required.' });
  }
  const item = {
    id: crypto.randomUUID(), title,
    category: String(req.body.category || 'Other').trim().slice(0, 40) || 'Other',
    fileName: path.basename(req.file.originalname).slice(0, 180),
    storedName: req.file.filename,
    preview: /\.(jpg|jpeg|png|webp|gif)$/i.test(req.file.originalname),
    createdAt: new Date().toISOString()
  };
  const all = readProjects();
  all.unshift(item);
  writeProjects(all);
  res.status(201).json({ ok: true, project: item });
});
app.delete('/api/projects/:id', ownerOnly, (req, res) => {
  const all = readProjects();
  const item = all.find(project => project.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Project not found.' });
  writeProjects(all.filter(project => project.id !== item.id));
  const file = path.join(UPLOADS, path.basename(item.storedName));
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ ok: true });
});
app.use((err, req, res, next) => {
  console.error(err.message);
  const tooLarge = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE';
  res.status(tooLarge ? 413 : 400).json({ error: tooLarge ? `File is too large. The current limit is ${maxUploadMb} MB.` : (err.message || 'Request failed.') });
});
app.listen(PORT, () => console.log(`Design Fusion running at http://localhost:${PORT}`));
