// Vercel Serverless Function — POST /api/login (vercel.json 으로 /login 도 매핑)
const BASE = process.env.ERP_API_BASE || 'https://selfservice.icams.co.kr';
const KEY  = process.env.CAMS_API_KEY;
const ALLOWED = (process.env.ALLOW_ORIGINS ||
  'https://ghksrl10-cpu.github.io,http://localhost,http://127.0.0.1')
  .split(',').map(s => s.trim()).filter(Boolean);

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  if (ALLOWED.some(o => origin.startsWith(o))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, service: 'cams-erp-proxy', keyConfigured: !!KEY, upstream: BASE });
  }
  if (req.method !== 'POST') return res.status(404).json({ message: 'Not found' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { employeeId, password } = body;
  if (!employeeId || !password) {
    return res.status(400).json({ authenticated: false, message: '사번과 비밀번호를 입력하세요.' });
  }
  if (!KEY) {
    console.error('[erp] CAMS_API_KEY 미설정');
    return res.status(200).json({ authenticated: false, message: '서버 설정 오류: API Key 미등록 (전산팀 문의)' });
  }

  try {
    const r = await fetch(`${BASE}/api/erp/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': KEY },
      body: JSON.stringify({ employeeId, password }),
      signal: AbortSignal.timeout(8000),
    });
    if (r.status === 401) {
      const d = await r.json().catch(() => ({}));
      const invalidKey = /api key/i.test(d.message || '');
      return res.status(200).json({ authenticated: false,
        message: invalidKey ? '서버 인증키 오류 (전산팀 문의)' : (d.message || '사번 또는 비밀번호를 확인하세요.') });
    }
    if (!r.ok) return res.status(200).json({ authenticated: false, message: `인증 서버 오류(${r.status}).` });

    const d = await r.json();
    if (d.authenticated !== true) {
      return res.status(200).json({ authenticated: false, message: d.message || '사번 또는 비밀번호를 확인하세요.' });
    }
    const e = d.employee || {};
    return res.status(200).json({ authenticated: true,
      employee: { employeeId: e.employeeId, name: e.name, department: e.department } });
  } catch (err) {
    console.error('[erp] proxy error:', err.name);
    return res.status(200).json({ authenticated: false, message: '인증 서버에 연결할 수 없습니다.' });
  }
};
