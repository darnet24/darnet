const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const session = require('express-session');
const crypto = require('crypto');
const morgan = require('morgan');

dotenv.config();

const app = express();
const PORT = process.env.ADMIN_PORT || 3010;
const DATA_PATH = path.join(__dirname, 'data', 'submissions.json');
const REMOTE_PATH = path.join(__dirname, 'data', 'remote-orders.json');
const CMS_PATH = path.join(__dirname, 'src', 'data', 'cms-content.json');
const LOG_PATH = path.join(__dirname, 'data', 'access.log');

const accessLogStream = fs.createWriteStream(LOG_PATH, { flags: 'a' });
app.use(morgan('combined', { stream: accessLogStream }));

app.use(cors({
  origin: ['http://localhost:4321', 'http://10.0.10.227:4321'],
  credentials: true
}));

app.use(bodyParser.json());
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: false },
}));

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (
    username === process.env.ADMIN_USER &&
    password === process.env.ADMIN_PASS
  ) {
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Nieprawidłowe dane logowania.' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

const requireAuth = (req, res, next) => {
  if (req.session.authenticated) return next();
  res.status(401).json({ success: false, message: 'Brak autoryzacji.' });
};

app.use('/admin', requireAuth, express.static(path.join(__dirname, 'admin-public')));
app.use('/', express.static(path.join(__dirname, 'admin-public')));

app.post('/api/contact', (req, res) => {
  const { name, email, message, zgodaMarketingowa, zgodaRODO, hp_token } = req.body;

  if (hp_token && hp_token.trim() !== '') {
    return res.status(400).json({ success: false, message: 'Zablokowane przez filtr antyspamowy.' });
  }

  if (!name || !email || !message || zgodaRODO !== "true") {
    return res.status(400).json({ success: false, message: 'Zgoda RODO jest wymagana.' });
  }

  const submission = {
    name,
    email,
    message,
    zgodaMarketingowa: zgodaMarketingowa === true || zgodaMarketingowa === 'true',
    zgodaRODO: true,
    timestamp: new Date().toISOString(),
  };

  const data = fs.existsSync(DATA_PATH) ? JSON.parse(fs.readFileSync(DATA_PATH)) : [];
  data.push(submission);
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));

  res.status(200).json({ success: true });
});

app.post('/api/remote-support', (req, res) => {
  const {
    name, email, packageName, amount,
    zgodaRODO, zgodaMarketingowa, hp_token,
    chceFakture, nazwaFaktura, nip, adresFaktura
  } = req.body;

  if (hp_token && hp_token.trim() !== '') {
    return res.status(400).json({ success: false, message: 'Zablokowane przez filtr antyspamowy.' });
  }

  if (!name || !email || !packageName || !amount || zgodaRODO !== "true") {
    return res.status(400).json({ success: false, message: 'Nieprawidłowe dane lub brak zgody RODO.' });
  }

  const order = {
    name,
    email,
    packageName,
    amount,
    zgodaMarketingowa: zgodaMarketingowa === true || zgodaMarketingowa === 'true',
    timestamp: new Date().toISOString(),
    paid: false,
    chceFakture: !!chceFakture,
    faktura: chceFakture ? {
      nazwa: nazwaFaktura || '',
      nip: nip || '',
      adres: adresFaktura || ''
    } : null
  };

  const orders = fs.existsSync(REMOTE_PATH) ? JSON.parse(fs.readFileSync(REMOTE_PATH)) : [];
  orders.push(order);
  fs.writeFileSync(REMOTE_PATH, JSON.stringify(orders, null, 2));

  res.status(200).json({ success: true });
});

app.get('/admin/submissions', requireAuth, (req, res) => {
  const data = fs.existsSync(DATA_PATH) ? JSON.parse(fs.readFileSync(DATA_PATH)) : [];
  res.json(data);
});

app.get('/admin/cms', requireAuth, (req, res) => {
  const data = fs.existsSync(CMS_PATH) ? JSON.parse(fs.readFileSync(CMS_PATH)) : {};
  res.json(data);
});

app.post('/admin/cms', requireAuth, (req, res) => {
  fs.writeFileSync(CMS_PATH, JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});

app.get('/admin/export.csv', requireAuth, (req, res) => {
  const data = fs.existsSync(DATA_PATH) ? JSON.parse(fs.readFileSync(DATA_PATH)) : [];
  const csv = [
    '\uFEFFImię i nazwisko,E-mail,Wiadomość,Zgoda marketingowa,Data',
    ...data.map(d => `${d.name},${d.email},"${d.message.replace(/"/g, '""')}",${d.zgodaMarketingowa ? 'TAK' : 'NIE'},${d.timestamp}`)
  ].join('\n');

  res.header('Content-Type', 'text/csv; charset=utf-8');
  res.attachment('zgłoszenia.csv');
  res.send(csv);
});

app.listen(PORT, () => {
  console.log(`✅ Panel administracyjny działa na http://localhost:${PORT}/`);
});


//Pobieranie zamówień zdalnych do panel
app.get('/admin/remote-orders', requireAuth, (req, res) => {
  const data = fs.existsSync(REMOTE_PATH) ? JSON.parse(fs.readFileSync(REMOTE_PATH)) : [];
  res.json(data);
});
// ✅ Aktualizacja statusu opłacenia zamówienia zdalnego
app.post('/admin/remote-orders/update', requireAuth, (req, res) => {
  const { email, timestamp, paid } = req.body;
  if (!email || !timestamp) {
    return res.status(400).json({ success: false, message: 'Brak danych identyfikujących zamówienie.' });
  }

  const orders = fs.existsSync(REMOTE_PATH) ? JSON.parse(fs.readFileSync(REMOTE_PATH)) : [];
  const index = orders.findIndex(o => o.email === email && o.timestamp === timestamp);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Zamówienie nie znalezione.' });
  }

  orders[index].paid = paid === true || paid === 'true';
  fs.writeFileSync(REMOTE_PATH, JSON.stringify(orders, null, 2));

  res.json({ success: true });
});