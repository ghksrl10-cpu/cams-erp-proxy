/**
 * CAMS ERP 인증 프록시
 * 포털(cams-portal)의 사번 로그인을 중계한다. API Key 는 서버에만 둔다.
 * 환경변수: CAMS_API_KEY (필수), ERP_API_BASE(선택), ALLOW_ORIGINS(선택)
 * 의존성 없음 — Node 18+ 내장 http/fetch 사용
 */
const http = require('http');

const KEY  = process.env.CAMS_API_KEY;
const BASE = process.env.ERP_API_BASE || 'https://selfservice.icams.co.kr';
const PORT = process.env.PORT || 3000;
const ALLOWED = (process.env.ALLOW_ORIGINS ||
  'https://ghksrl10-cpu.github.io,http://localhost,http://127.0.0.1')
  .split(',').map(s => s.trim()).filter(Boolean);

function setCors(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED.some(o => origin.startsWith(o))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
}
function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  // 상태 점검 — 키 설정 여부를 값 노출 없이 확인
  if (req.method === 'GET' && (req.url === '/health' || req.url === '/')) {
    return send(res, 200, {
      ok: true,
      service: 'cams-erp-proxy',
      keyConfigured: !!KEY,
      upstream: BASE,
      time: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST' || !['/login', '/api/erp/login'].includes(req.url)) {
    return send(res, 404, { message: 'Not found' });
  }

  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 10000) req.destroy(); });
  req.on('end', async () => {
    let employeeId, password;
    try { ({ employeeId, password } = JSON.parse(raw || '{}')); }
    catch { return send(res, 400, { authenticated: false, message: '잘못된 요청입니다.' }); }

    if (!employeeId || !password) {
      return send(res, 400, { authenticated: false, message: '사번과 비밀번호를 입력하세요.' });
    }
    if (!KEY) {
      console.error('[erp] CAMS_API_KEY 미설정');
      return send(res, 200, { authenticated: false, message: '서버 설정 오류: API Key 미등록 (전산팀 문의)' });
    }

    try {
      const r = await fetch(`${BASE}/api/erp/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': KEY },
        body: JSON.stringify({ employeeId, password }),   // 비밀번호는 로깅하지 않음
        signal: AbortSignal.timeout(8000),
      });

      if (r.status === 401) {
        const d = await r.json().catch(() => ({}));
        const invalidKey = /api key/i.test(d.message || '');
        console.error('[erp] 401', invalidKey ? 'invalid api key' : 'invalid credentials');
        return send(res, 200, {
          authenticated: false,
          message: invalidKey ? '서버 인증키 오류 (전산팀 문의)' : (d.message || '사번 또는 비밀번호를 확인하세요.'),
        });
      }
      if (!r.ok) {
        console.error('[erp] upstream status', r.status);
        return send(res, 200, { authenticated: false, message: `인증 서버 오류(${r.status}). 잠시 후 재시도하세요.` });
      }

      const d = await r.json();
      if (d.authenticated !== true) {
        return send(res, 200, { authenticated: false, message: d.message || '사번 또는 비밀번호를 확인하세요.' });
      }
      const e = d.employee || {};
      return send(res, 200, {
        authenticated: true,
        employee: { employeeId: e.employeeId, name: e.name, department: e.department },
      });
    } catch (err) {
      console.error('[erp] proxy error:', err.name);
      return send(res, 200, { authenticated: false, message: '인증 서버에 연결할 수 없습니다.' });
    }
  });
});

server.listen(PORT, () => console.log(`cams-erp-proxy listening on ${PORT}`));
