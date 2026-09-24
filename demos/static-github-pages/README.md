# Archived: Static GitHub Pages Demo

이 폴더는 **localStorage 기반 시연용 SPA**입니다.  
상용(Production) 앱은 저장소 루트의 **Next.js + PostgreSQL** 스택(`apps/web`)을 사용하세요.

| 항목 | 값 |
|------|-----|
| 상용 앱 | `apps/web` (`npm run dev` / Docker) |
| 데이터 저장 | PostgreSQL (Prisma) |
| 결제 | 무통장(MANUAL) + 향후 PG 인터페이스 스텁 |

GitHub Pages로 이 데모를 다시 배포하려면 이 폴더의 `index.html`을 페이지 소스로 지정하면 됩니다.  
**상용 데이터와는 공유되지 않습니다.**
