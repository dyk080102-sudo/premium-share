# GitHub Pages 배포 가이드 (초보자용)

PremiumShare 정적 랜딩(`index.html`)을 **GitHub Pages**에 올리는 방법을 단계별로 안내합니다.  
코딩 지식 없이도 웹 브라우저만으로 배포할 수 있습니다.

> **최종 URL 형식**  
> `https://<username>.github.io/<repo-name>`  
> 예: 사용자명이 `dyk080102-sudo` 이고 저장소 이름이 `premium-share` 이면  
> → `https://dyk080102-sudo.github.io/premium-share`

---

## 준비물

- GitHub 계정 ([https://github.com](https://github.com) 에서 무료 가입)
- 이 폴더의 `index.html` 파일 (필수)
- (선택) `og-image.svg` — 카카오톡/SNS 미리보기 이미지

---

## 1단계: GitHub Repository 만들기 (Public 필수)

1. 브라우저에서 [https://github.com](https://github.com) 에 로그인합니다.
2. 오른쪽 위 **+** 버튼 → **New repository** 를 클릭합니다.
3. 아래처럼 설정합니다.
   - **Repository name**: 예) `premium-share` (영문, 하이픈 권장)
   - **Description**: 예) `PremiumShare 정적 랜딩`
   - **Public** 을 반드시 선택합니다.  
     *(Private 저장소는 무료 계정에서 GitHub Pages가 제한될 수 있습니다.)*
   - **Add a README file** 은 체크하지 **않아도** 됩니다. (나중에 `index.html`만 올려도 됩니다.)
4. **Create repository** 를 클릭합니다.

---

## 2단계: index.html 드래그 앤 드롭 업로드 + Commit

저장소가 비어 있으면 “uploading an existing file” 안내가 보입니다.

1. **uploading an existing file** 링크를 클릭하거나,  
   파일 목록 화면에서 **Add file** → **Upload files** 를 클릭합니다.
2. 탐색기에서 `index.html` 을 찾아 **드래그 앤 드롭**으로 업로드 영역에 놓습니다.
3. (권장) SNS 공유 미리보기를 위해 `og-image.svg` 도 함께 올립니다.
4. 페이지 아래 **Commit changes** 영역에서
   - Commit message 예: `Add PremiumShare landing page`
5. **Commit changes** 버튼을 클릭합니다.

> 팁: 파일을 통째로 올리려면 `index.html` 과 `og-image.svg` 를 한 번에 선택해 업로드하면 됩니다.

---

## 3단계: Settings → Pages에서 배포 브랜치 설정

1. 저장소 상단 메뉴에서 **Settings** 를 클릭합니다.
2. 왼쪽 사이드바에서 **Pages** 를 클릭합니다.  
   *(Settings 메뉴가 안 보이면 저장소 **본인 소유**인지, 로그인한 계정이 맞는지 확인하세요.)*
3. **Build and deployment** → **Source** 에서 **Deploy from a branch** 를 선택합니다.
4. **Branch** 에서
   - 브랜치: `main` (또는 `master` — 화면에 보이는 기본 브랜치)
   - 폴더: `/ (root)`
5. **Save** 를 클릭합니다.

잠시 후 같은 Pages 설정 화면 상단에  
`Your site is live at https://….github.io/….`  
같은 초록/파란 안내가 나타납니다.

---

## 4단계: 최종 URL 확인

배포가 끝나면 아래 주소로 접속합니다.

```text
https://<username>.github.io/<repo-name>
```

예:

```text
https://dyk080102-sudo.github.io/premium-share
```

또는

```text
https://dyk080102-sudo.github.io/premium-share/
```

둘 다 같은 `index.html` 을 엽니다.

### Open Graph(카카오톡) URL 맞추기

`index.html` 안의 `og:url`, `og:image` 값이 **실제 배포 URL**과 다르면 미리보기가 깨질 수 있습니다.

1. `index.html` 을 메모장/VS Code로 엽니다.
2. 아래 두 줄을 본인 URL에 맞게 수정합니다.

```html
<meta property="og:url" content="https://본인아이디.github.io/저장소이름/" />
<meta property="og:image" content="https://본인아이디.github.io/저장소이름/og-image.svg" />
```

3. 수정한 파일을 다시 GitHub에 업로드(덮어쓰기)하고 Commit 합니다.

---

## 5단계: 안 열릴 때 (404) &amp; 반영 지연

### 반영까지 1~3분 (정상)

Pages를 켠 직후·파일을 올린 직후에는 **바로 안 보일 수 있습니다.**  
보통 **1~3분**, 드물게 더 걸릴 수 있습니다.  
새로고침(Ctrl+F5) 후 다시 확인해 보세요.

### 404 Not Found 가 나올 때 체크리스트

| 확인 항목 | 해결 방법 |
|-----------|-----------|
| 저장소가 **Private** | **Settings → General** 에서 **Public** 으로 변경 |
| Pages Source 미설정 | **Settings → Pages** 에서 브랜치/`root` 저장 |
| 파일 이름 | 반드시 루트에 `index.html` (대소문자 주의: `Index.html` ❌) |
| URL 오타 | `<username>`, `<repo-name>` 철자 확인 |
| 하위 폴더에만 파일 | `docs/` 등에만 올렸다면 Pages 폴더를 `/docs`로 바꾸거나, 루트로 다시 업로드 |
| 캐시 | 시크릿 창으로 접속하거나 강력 새로고침 |

### 카카오톡 미리보기가 안 바뀔 때

카카오는 미리보기를 캐시합니다.  
[카카오 디버거](https://developers.kakao.com/tool/debugger/sharing)에서 배포 URL을 넣어 **캐시 초기화**를 시도하세요.  
(OG 태그는 **절대 URL**이어야 합니다. `file://` 이나 상대경로만으로는 SNS 미리보기가 안 됩니다.)

---

## 이 정적 페이지로 되는 것 / 안 되는 것

| 되는 것 | 안 되는 것 |
|---------|------------|
| 랜딩·상품·FAQ 소개 | 실제 로그인/회원가입 API |
| 모바일 반응형 화면 | DB·결제·관리자 패널 |
| SNS 공유용 OG 태그 | Next.js 전체 앱 기능 |

전체 플랫폼(Next.js + DB)은 저장소의 `DEPLOY.md`(Vercel 등)를 참고하세요.  
GitHub Pages는 **정적 파일**만 호스팅하므로, 이번 `index.html`은 **소개/데모용 랜딩**입니다.

---

## 빠른 체크리스트

- [ ] GitHub 계정 생성
- [ ] **Public** 저장소 생성
- [ ] `index.html` 업로드 + Commit
- [ ] (선택) `og-image.svg` 업로드
- [ ] Settings → Pages → `main` + `/ (root)` 저장
- [ ] 1~3분 대기 후 `https://<username>.github.io/<repo-name>` 접속
- [ ] 404면 위 체크리스트 재확인
- [ ] OG URL을 실제 주소에 맞게 수정

완료되면 친구에게 URL만 공유해도 브라우저에서 바로 사이트를 볼 수 있습니다.
