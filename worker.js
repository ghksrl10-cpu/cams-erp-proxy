// Cloudflare Workers — 대시보드에 그대로 붙여넣고 Secret 에 CAMS_API_KEY 등록
const ALLOWED = ['https://ghksrl10-cpu.github.io', 'http://localhost', 'http://127.0.0.1'];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const h = {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Private-Network': 'true',
    };
    if (ALLOWED.some(o => origin.startsWith(o))) {
      h['Access-Control-Allow-Origin'] = origin;
      h['Vary'] = 'Origin';
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });

    const BASE = env.ERP_API_BASE || 'https://selfservice.icams.co.kr';
    const KEY  = env.CAMS_API_KEY;
    const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: h });

    if (request.method === 'GET') {
      return J({ ok: true, service: 'cams-erp-proxy', keyConfigured: !!KEY, upstream: BASE });
    }
    if (request.method !== 'POST') return J({ message: 'Not found' }, 404);

    let employeeId, password;
    try { ({ employeeId, password } = await request.json()); }
    catch { return J({ authenticated: false, message: '잘못된 요청입니다.' }, 400); }

    if (!employeeId || !password) return J({ authenticated: false, message: '사번과 비밀번호를 입력하세요.' }, 400);
    if (!KEY) return J({ authenticated: false, message: '서버 설정 오류: API Key 미등록 (전산팀 문의)' });

    try {
      const r = await fetch(`${BASE}/api/erp/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': KEY },
        body: JSON.stringify({ employeeId, password }),
      });
      if (r.status === 401) {
        const d = await r.json().catch(() => ({}));
        const badKey = /api key/i.test(d.message || '');
        return J({ authenticated: false,
          message: badKey ? '서버 인증키 오류 (전산팀 문의)' : (d.message || '사번 또는 비밀번호를 확인하세요.') });
      }
      if (!r.ok) return J({ authenticated: false, message: `인증 서버 오류(${r.status}).` });

      const d = await r.json();
      if (d.authenticated !== true) return J({ authenticated: false, message: d.message || '사번 또는 비밀번호를 확인하세요.' });
      const e = d.employee || {};
      return J({ authenticated: true, employee: { employeeId: e.employeeId, name: e.name, department: e.department } });
    } catch (err) {
      return J({ authenticated: false, message: '인증 서버에 연결할 수 없습니다.' });
    }
  },
};
