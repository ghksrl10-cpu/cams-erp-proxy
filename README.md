# CAMS ERP 인증 프록시

캠스 포털(`cams-portal`)의 사번 로그인을 처리하는 서버 사이드 프록시.
ERP API Key 가 브라우저에 노출되지 않도록 중계만 한다.

## 환경변수 (Railway → Variables)

| 변수 | 값 | 필수 |
|------|-----|------|
| `CAMS_API_KEY` | 전산팀 발급 키 | ✅ |
| `ERP_API_BASE` | `https://selfservice.icams.co.kr` | 기본값 있음 |
| `ALLOW_ORIGINS` | `https://ghksrl10-cpu.github.io` | 기본값 있음 |

> ⚠️ 키는 **반드시 Railway Variables** 에만 넣는다. 코드/레포 커밋 금지.

## 배포 (Railway)

1. Railway → New Project → Deploy from GitHub repo → `cams-erp-proxy`
2. Variables 에 `CAMS_API_KEY` 등록
3. Settings → Networking → Generate Domain
4. 발급된 주소를 포털 `index.html` 의 `PROXY_URL` 에 반영

```bash
curl https://<도메인>/health
# {"ok":true,"service":"cams-erp-proxy","keyConfigured":true}
```

## 엔드포인트

- `GET  /health` — 상태 확인
- `POST /login` — `{employeeId, password}` → `{authenticated, employee:{employeeId,name,department}}`

인증 실패 시에도 HTTP 200 + `authenticated:false` 로 응답한다 (포털 처리 방식에 맞춤).
비밀번호는 어떤 경우에도 로그에 남기지 않는다.
