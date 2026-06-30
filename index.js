const express = require('express');
const app = express();
app.use(express.json());

const ALLOWED_ORIGINS = [
  'https://ghksrl10-cpu.github.io',
  'http://localhost',
  'http://127.0.0.1'
];

app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.post('/login', async (req, res) => {
  try {
    const response = await fetch('https://selfservice.icams.co.kr/api/erp/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CAMS_API_KEY
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e) {
    res.status(500).json({ message: '서버 오류' });
  }
});

app.listen(process.env.PORT || 3000);
