/**
 * PremiumShare SPA — hash router UI for GitHub Pages (no payment).
 */
(function () {
  'use strict';

  var S = window.PSStore;
  var appEl = null;
  var toastTimer = null;

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatPrice(n) {
    return new Intl.NumberFormat('ko-KR').format(n || 0) + '원';
  }

  function formatDate(iso) {
    if (!iso) return '-';
    try {
      return new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) {
      return iso;
    }
  }

  function toast(msg) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('show');
    }, 2800);
  }

  function navigate(hash) {
    if (hash.charAt(0) !== '#') hash = '#' + hash;
    location.hash = hash;
  }

  function parseRoute() {
    var h = (location.hash || '#/').replace(/^#/, '') || '/';
    if (h.charAt(0) !== '/') h = '/' + h;
    var parts = h.split('?');
    var path = parts[0];
    var query = {};
    if (parts[1]) {
      parts[1].split('&').forEach(function (pair) {
        var kv = pair.split('=');
        query[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
      });
    }
    var segs = path.split('/').filter(Boolean);
    return { path: path, segs: segs, query: query };
  }

  function requireAuth(redirect) {
    var u = S.currentUser();
    if (!u) {
      navigate('/login?redirect=' + encodeURIComponent(redirect || '/dashboard'));
      return null;
    }
    return u;
  }

  function requireAdmin() {
    var u = requireAuth('/admin');
    if (!u) return null;
    if (!S.isAdmin(u)) {
      toast('관리자 권한이 필요합니다.');
      navigate('/dashboard');
      return null;
    }
    return u;
  }

  var ROLE_LABEL = {
    SUPER_ADMIN: '슈퍼관리자',
    OPERATOR: '운영자',
    SUPPORT: '고객지원',
    MEMBER: '회원',
  };

  var STATUS_LABEL = {
    AWAITING_PAYMENT: '결제대기(데모)',
    CONFIRMED: '확정',
    CANCELLED: '취소',
    ACTIVE: '활성',
    WAITING: '배정대기',
    EXPIRING: '만료임박',
    EXPIRED: '만료',
    OPEN: '접수',
    ANSWERED: '답변완료',
    CLOSED: '종료',
    PENDING: '대기',
    DONE: '완료',
    SENT: '발송됨',
    ACTIVATED: '활성화',
    APPROVED: '승인',
    PENDING_REVIEW: '검토중',
  };

  function badge(status) {
    var cls = 'badge';
    if (status === 'ACTIVE' || status === 'CONFIRMED' || status === 'ACTIVATED' || status === 'DONE') cls += ' badge-ok';
    else if (status === 'WAITING' || status === 'AWAITING_PAYMENT' || status === 'PENDING' || status === 'SENT' || status === 'EXPIRING') cls += ' badge-warn';
    else if (status === 'CANCELLED' || status === 'EXPIRED' || status === 'FAILED') cls += ' badge-bad';
    return '<span class="' + cls + '">' + esc(STATUS_LABEL[status] || status) + '</span>';
  }

  /* ── Layout shells ─────────────────────────────────────────── */

  function headerHtml(user) {
    var unread = 0;
    if (user) {
      unread = S.db().notifications.filter(function (n) {
        return n.userId === user.id && !n.read;
      }).length;
    }
    var authBtns = user
      ? '<a class="btn btn-ghost" href="#/notifications">알림' +
        (unread ? ' <span class="dot">' + unread + '</span>' : '') +
        '</a>' +
        '<a class="btn btn-ghost" href="#/dashboard">' +
        esc(user.name || user.email) +
        '</a>' +
        (S.isAdmin(user) ? '<a class="btn btn-outline" href="#/admin">관리자</a>' : '') +
        '<button type="button" class="btn btn-ghost" data-act="logout">로그아웃</button>'
      : '<a class="btn btn-ghost" href="#/login">로그인</a><a class="btn btn-primary" href="#/register">회원가입</a>';

    return (
      '<div class="demo-banner" role="status">🧪 정적 데모 · localStorage 저장 · 결제 비활성 · 관리자: admin@premiumshare.demo / Admin1234!</div>' +
      '<header class="site-header"><div class="container header-inner">' +
      '<a href="#/" class="brand">PremiumShare</a>' +
      '<nav class="nav-desktop" aria-label="주요 메뉴">' +
      '<a href="#/products">상품</a><a href="#/faq">FAQ</a>' +
      (user ? '<a href="#/dashboard">마이페이지</a><a href="#/tickets">문의</a>' : '') +
      '</nav>' +
      '<div class="header-actions">' +
      authBtns +
      '<button type="button" class="menu-toggle" id="menuToggle" aria-label="메뉴">☰</button>' +
      '</div></div>' +
      '<div class="container nav-mobile" id="mobileNav">' +
      '<a href="#/products">상품</a><a href="#/faq">FAQ</a>' +
      (user
        ? '<a href="#/dashboard">마이페이지</a><a href="#/orders">주문</a><a href="#/subscriptions">구독</a><a href="#/tickets">문의</a><a href="#/profile">프로필</a>' +
          (S.isAdmin(user) ? '<a href="#/admin">관리자</a>' : '')
        : '<a href="#/login">로그인</a><a href="#/register">회원가입</a>') +
      '</div></header>'
    );
  }

  function footerHtml() {
    return (
      '<footer><div class="container">' +
      '<div class="footer-links">' +
      '<a href="#/faq">FAQ</a><a href="#/terms">이용약관</a><a href="#/privacy">개인정보</a>' +
      '<a href="https://github.com/dyk080102-sudo/premium-share" target="_blank" rel="noopener">GitHub</a>' +
      '</div><p>© 2026 PremiumShare · GitHub Pages 정적 데모</p></div></footer>' +
      '<div class="toast" id="toast" role="status" aria-live="polite"></div>'
    );
  }

  function pageShell(user, content) {
    return '<div class="page-bg" aria-hidden="true"></div>' + headerHtml(user) + '<main class="main-wrap">' + content + '</main>' + footerHtml();
  }

  function adminShell(user, title, content, active) {
    var items = [
      ['/admin', '대시보드', '📊'],
      ['/admin/orders', '주문 관리', '📋'],
      ['/admin/subscriptions', '구독 관리', '🔄'],
      ['/admin/invitations', '초대 관리', '📧'],
      ['/admin/members', '회원 관리', '👥'],
      ['/admin/products', '상품 관리', '📦'],
      ['/admin/groups', '그룹 관리', '🏠'],
      ['/admin/tickets', '문의 관리', '🎫'],
      ['/admin/faq', 'FAQ 관리', '❓'],
      ['/admin/family', '가족 자동화', '👨‍👩‍👧‍👦'],
      ['/admin/audit', '감사 로그', '📝'],
      ['/admin/settings', '설정', '🔧'],
      ['/admin/payments', '결제 (비활성)', '💳'],
    ];
    var nav = items
      .map(function (it) {
        var cls = active === it[0] ? 'admin-nav-item active' : 'admin-nav-item';
        var disabled = it[0] === '/admin/payments' ? ' disabled-link' : '';
        return (
          '<a class="' +
          cls +
          disabled +
          '" href="#' +
          it[0] +
          '"><span>' +
          it[2] +
          '</span><span>' +
          it[1] +
          '</span></a>'
        );
      })
      .join('');

    return (
      '<div class="admin-layout">' +
      '<aside class="admin-aside">' +
      '<div class="admin-brand"><a href="#/">PremiumShare</a><div class="muted tiny">관리자 콘솔 · DEMO</div></div>' +
      '<nav class="admin-nav">' +
      nav +
      '</nav>' +
      '<div class="admin-user muted tiny">' +
      esc(user.email) +
      '<br>' +
      esc(ROLE_LABEL[user.role] || user.role) +
      '</div></aside>' +
      '<div class="admin-main">' +
      '<header class="admin-top"><span class="pill">🧪 DEMO</span>' +
      '<div><a class="btn btn-ghost" href="#/">사이트로</a>' +
      '<button type="button" class="btn btn-ghost" data-act="logout">로그아웃</button></div></header>' +
      '<div class="admin-content"><h1 class="page-title">' +
      esc(title) +
      '</h1>' +
      content +
      '</div></div></div>' +
      '<div class="toast" id="toast" role="status" aria-live="polite"></div>'
    );
  }

  /* ── Pages ─────────────────────────────────────────────────── */

  function viewHome(user) {
    var products = S.activeProducts().slice(0, 3);
    var cards = products
      .map(function (p) {
        var plans = (p.plans || [])
          .map(function (pl) {
            return '<div class="plan-row"><span>' + esc(pl.name) + '</span><strong>' + formatPrice(pl.priceKrw) + '</strong></div>';
          })
          .join('');
        return (
          '<article class="product-card">' +
          '<div class="product-top"><div><h3>' +
          esc(p.name) +
          '</h3><p class="product-type">' +
          esc(p.serviceType) +
          '</p></div><span class="badge">' +
          esc(p.shareMethod) +
          '</span></div>' +
          '<p class="product-desc">' +
          esc(p.description) +
          '</p><div class="plans">' +
          plans +
          '</div>' +
          '<a class="btn btn-primary" href="#/products/' +
          p.id +
          '">자세히 보기</a></article>'
        );
      })
      .join('');

    var content =
      '<section class="hero"><div class="container hero-grid">' +
      '<div class="hero-copy"><p class="hero-brand">PremiumShare</p>' +
      '<h1 class="hero-title">프리미엄 구독, <em>함께 절약하세요</em></h1>' +
      '<p class="hero-desc">검증된 공유 슬롯을 통해 프리미엄 서비스를 저렴하게 이용하는 안전한 플랫폼입니다.</p>' +
      '<div class="hero-cta"><a href="#/products" class="btn btn-primary btn-lg">상품 보기</a>' +
      (user
        ? '<a href="#/dashboard" class="btn btn-outline btn-lg">마이페이지</a>'
        : '<a href="#/register" class="btn btn-outline btn-lg">무료 가입</a>') +
      '</div></div>' +
      '<div class="hero-visual"><div class="hero-visual-inner">' +
      '<div class="slot-chips"><span class="slot-chip">슬롯 1 · 이용 중</span><span class="slot-chip">슬롯 2 · 배정됨</span><span class="slot-chip">슬롯 3 · 대기</span></div>' +
      '<h3>한 자리를 안전하게 나눠 쓰세요</h3><p>주문부터 초대까지 추적하는 투명한 구독 공유 경험.</p>' +
      '</div></div></div></section>' +
      '<section><div class="container"><h2 class="section-title">왜 PremiumShare인가요?</h2>' +
      '<p class="section-sub">운영자 검증, 비용 절감, 투명한 진행 상황.</p>' +
      '<div class="features">' +
      '<article class="feature"><div class="feature-icon">🔒</div><h3>안전한 관리</h3><p>운영자가 슬롯과 초대 과정을 검증합니다.</p></article>' +
      '<article class="feature"><div class="feature-icon">💰</div><h3>최대 75% 절약</h3><p>혼자 구독하는 것보다 저렴하게 이용하세요.</p></article>' +
      '<article class="feature"><div class="feature-icon">📱</div><h3>투명한 프로세스</h3><p>주문·배정·초대 상태를 실시간으로 확인하세요.</p></article>' +
      '</div></div></section>' +
      '<section id="products"><div class="container"><h2 class="section-title">인기 상품</h2>' +
      '<p class="section-sub">시드 데모 데이터입니다.</p><div class="products-grid">' +
      cards +
      '</div><div class="center mt"><a class="btn btn-outline" href="#/products">전체 상품 보기</a></div></div></section>' +
      '<section class="process"><div class="container"><h2 class="section-title">이용 절차</h2>' +
      '<div class="steps">' +
      '<div class="step"><div class="step-num">1</div><div><h3>상품 선택</h3><p>서비스와 플랜 선택</p></div></div>' +
      '<div class="step"><div class="step-num">2</div><div><h3>신청</h3><p>주문 접수 (결제 준비중)</p></div></div>' +
      '<div class="step"><div class="step-num">3</div><div><h3>슬롯 배정</h3><p>관리자 확인 후 배정</p></div></div>' +
      '<div class="step"><div class="step-num">4</div><div><h3>초대 발송</h3><p>초대장으로 합류</p></div></div>' +
      '<div class="step"><div class="step-num">5</div><div><h3>이용 시작</h3><p>서비스 이용</p></div></div>' +
      '</div></div></section>' +
      '<section><div class="container"><div class="cta-band"><h2>지금 바로 시작하세요</h2>' +
      '<p>데모 계정으로 회원·관리자 기능을 모두 체험할 수 있습니다.</p>' +
      '<a class="btn btn-primary btn-lg" href="#/register">회원가입</a></div></div></section>';

    return pageShell(user, content);
  }

  function viewAuth(mode, query) {
    var isLogin = mode === 'login';
    var isReset = mode === 'reset';
    var title = isReset ? '비밀번호 재설정' : isLogin ? '로그인' : '회원가입';
    var demoBox =
      '<div class="demo-accounts"><strong>데모 계정</strong><ul>' +
      S.DEMO_ACCOUNTS.map(function (a) {
        return (
          '<li><button type="button" class="linkish" data-act="fill-demo" data-email="' +
          esc(a.email) +
          '" data-pw="' +
          esc(a.password) +
          '">' +
          esc(a.email) +
          '</button> / ' +
          esc(a.password) +
          ' <span class="muted">(' +
          esc(ROLE_LABEL[a.role]) +
          ')</span></li>'
        );
      }).join('') +
      '</ul></div>';

    var form;
    if (isReset) {
      form =
        '<form id="authForm" class="auth-form" data-mode="reset">' +
        '<label>이메일<input name="email" type="email" required placeholder="example@email.com"></label>' +
        '<label>데모 토큰<input name="token" type="text" placeholder="요청 후 표시되는 토큰"></label>' +
        '<label>새 비밀번호<input name="password" type="password" minlength="8" placeholder="8자 이상"></label>' +
        '<button class="btn btn-primary btn-block" type="submit">재설정</button>' +
        '<button class="btn btn-outline btn-block" type="button" data-act="request-reset">토큰 요청 (데모)</button>' +
        '</form>';
    } else if (isLogin) {
      form =
        '<form id="authForm" class="auth-form" data-mode="login" data-redirect="' +
        esc(query.redirect || '') +
        '">' +
        '<label>이메일<input name="email" type="email" required autocomplete="username"></label>' +
        '<label>비밀번호<input name="password" type="password" required autocomplete="current-password"></label>' +
        '<label class="check"><input name="remember" type="checkbox"> 로그인 유지</label>' +
        '<button class="btn btn-primary btn-block" type="submit">로그인</button></form>' +
        demoBox;
    } else {
      form =
        '<form id="authForm" class="auth-form" data-mode="register">' +
        '<label>이름<input name="name" type="text" required></label>' +
        '<label>이메일<input name="email" type="email" required></label>' +
        '<label>비밀번호<input name="password" type="password" required minlength="8" placeholder="8자 이상"></label>' +
        '<button class="btn btn-primary btn-block" type="submit">가입하기</button></form>';
    }

    var content =
      '<div class="auth-page"><div class="auth-card">' +
      '<a href="#/" class="brand center-block">PremiumShare</a>' +
      '<h1>' +
      title +
      '</h1><div id="authError" class="error-box hidden"></div>' +
      form +
      '<div class="auth-links muted">' +
      (isLogin
        ? '<a href="#/reset-password">비밀번호 찾기</a> · <a href="#/register">회원가입</a>'
        : isReset
          ? '<a href="#/login">로그인으로</a>'
          : '<a href="#/login">이미 계정이 있나요? 로그인</a>') +
      '</div></div></div>';

    return pageShell(S.currentUser(), content);
  }

  function viewProducts(user) {
    var products = S.activeProducts();
    var favs = user ? S.getFavorites(user.id) : [];
    var cards = products
      .map(function (p) {
        var plans = (p.plans || [])
          .slice(0, 3)
          .map(function (pl) {
            return '<div class="plan-row"><span>' + esc(pl.name) + '</span><strong>' + formatPrice(pl.priceKrw) + '</strong></div>';
          })
          .join('');
        var fav = favs.indexOf(p.id) >= 0;
        return (
          '<article class="product-card">' +
          '<div class="product-top"><div><h3>' +
          esc(p.name) +
          '</h3><p class="product-type">' +
          esc(p.serviceType) +
          '</p></div><span class="badge">' +
          esc(p.shareMethod) +
          '</span></div>' +
          '<p class="product-desc">' +
          esc(p.description) +
          '</p><div class="plans">' +
          plans +
          '</div><div class="row-gap">' +
          '<a class="btn btn-primary flex1" href="#/products/' +
          p.id +
          '">상세</a>' +
          (user
            ? '<button type="button" class="btn btn-outline" data-act="fav" data-id="' +
              p.id +
              '">' +
              (fav ? '♥' : '♡') +
              '</button>'
            : '') +
          '</div></article>'
        );
      })
      .join('');

    return pageShell(
      user,
      '<div class="container page-pad"><h1 class="page-title">상품 목록</h1><p class="muted mb">승인된 활성 상품만 표시됩니다.</p><div class="products-grid">' +
        cards +
        '</div></div>'
    );
  }

  function viewProductDetail(user, id) {
    var p = S.getProduct(id);
    if (!p || (!p.isActive && !(user && S.isAdmin(user)))) {
      return pageShell(user, '<div class="container page-pad"><p>상품을 찾을 수 없습니다.</p><a href="#/products">목록으로</a></div>');
    }
    var plans = (p.plans || [])
      .filter(function (pl) {
        return pl.isActive;
      })
      .map(function (pl) {
        return (
          '<label class="plan-option"><input type="radio" name="planId" value="' +
          esc(pl.id) +
          '"> <span><strong>' +
          esc(pl.name) +
          '</strong> · ' +
          pl.durationDays +
          '일</span> <strong>' +
          formatPrice(pl.priceKrw) +
          '</strong></label>'
        );
      })
      .join('');

    var content =
      '<div class="container page-pad narrow">' +
      '<a class="muted" href="#/products">← 상품 목록</a>' +
      '<h1 class="page-title mt">' +
      esc(p.name) +
      '</h1>' +
      '<p class="muted">' +
      esc(p.serviceType) +
      ' · ' +
      esc(p.shareMethod) +
      '</p>' +
      '<p class="mt">' +
      esc(p.description) +
      '</p>' +
      (p.eligibilityInfo ? '<div class="info-box mt"><strong>이용 자격</strong><p>' + esc(p.eligibilityInfo) + '</p></div>' : '') +
      (p.onboardingGuide
        ? '<div class="info-box mt"><strong>시작 가이드</strong><pre class="pre">' + esc(p.onboardingGuide) + '</pre></div>'
        : '') +
      '<h2 class="h2 mt">플랜 선택</h2>' +
      '<form id="orderForm" data-product="' +
      esc(p.id) +
      '"><div class="plan-options">' +
      plans +
      '</div>' +
      '<p class="muted tiny mt">※ 결제는 데모에서 비활성화되어 있습니다. 신청 후 주문이 접수됩니다.</p>' +
      '<button type="submit" class="btn btn-primary btn-lg mt" ' +
      (user ? '' : 'disabled') +
      '>' +
      (user ? '신청하기 (결제 제외)' : '로그인 후 신청') +
      '</button>' +
      (!user ? ' <a href="#/login?redirect=' + encodeURIComponent('/products/' + id) + '">로그인</a>' : '') +
      '</form></div>';

    return pageShell(user, content);
  }

  function viewDashboard(user) {
    var db = S.db();
    var subs = db.subscriptions.filter(function (s) {
      return s.userId === user.id;
    });
    var orders = db.orders.filter(function (o) {
      return o.userId === user.id;
    });
    var unread = db.notifications.filter(function (n) {
      return n.userId === user.id && !n.read;
    }).length;

    var content =
      '<div class="container page-pad">' +
      '<h1 class="page-title">마이페이지</h1>' +
      '<p class="muted mb">안녕하세요, ' +
      esc(user.name) +
      '님</p>' +
      '<div class="stat-grid">' +
      '<div class="stat"><div class="stat-n">' +
      subs.length +
      '</div><div class="stat-l">구독</div></div>' +
      '<div class="stat"><div class="stat-n">' +
      orders.length +
      '</div><div class="stat-l">주문</div></div>' +
      '<div class="stat"><div class="stat-n">' +
      unread +
      '</div><div class="stat-l">미읽은 알림</div></div>' +
      '</div>' +
      '<div class="quick-links mt">' +
      '<a class="ql" href="#/subscriptions">구독 관리</a>' +
      '<a class="ql" href="#/orders">주문 내역</a>' +
      '<a class="ql" href="#/favorites">관심 상품</a>' +
      '<a class="ql" href="#/notifications">알림</a>' +
      '<a class="ql" href="#/tickets">문의</a>' +
      '<a class="ql" href="#/profile">프로필</a>' +
      (S.isAdmin(user) ? '<a class="ql" href="#/admin">관리자 콘솔</a>' : '') +
      '</div>' +
      '<h2 class="h2 mt">최근 구독</h2>' +
      tableSubs(subs.slice(0, 5), false) +
      '<h2 class="h2 mt">최근 주문</h2>' +
      tableOrders(orders.slice(0, 5), false) +
      '</div>';

    return pageShell(user, content);
  }

  function tableOrders(orders, admin) {
    if (!orders.length) return '<div class="empty">주문이 없습니다.</div>';
    return (
      '<div class="table-wrap"><table class="table"><thead><tr>' +
      (admin ? '<th>회원</th>' : '') +
      '<th>상품</th><th>플랜</th><th>금액</th><th>상태</th><th>일시</th><th></th></tr></thead><tbody>' +
      orders
        .map(function (o) {
          var u = admin ? S.db().users.find(function (x) { return x.id === o.userId; }) : null;
          return (
            '<tr>' +
            (admin ? '<td>' + esc(u ? u.email : o.userId) + '</td>' : '') +
            '<td>' +
            esc(o.productName) +
            '</td><td>' +
            esc(o.planName) +
            '</td><td>' +
            formatPrice(o.priceKrw) +
            '</td><td>' +
            badge(o.status) +
            '</td><td>' +
            formatDate(o.createdAt) +
            '</td><td><a href="#/orders/' +
            o.id +
            '">상세</a></td></tr>'
          );
        })
        .join('') +
      '</tbody></table></div>'
    );
  }

  function tableSubs(subs, admin) {
    if (!subs.length) return '<div class="empty">구독이 없습니다.</div>';
    return (
      '<div class="table-wrap"><table class="table"><thead><tr>' +
      (admin ? '<th>회원</th>' : '') +
      '<th>상품</th><th>상태</th><th>초대</th><th>만료</th><th></th></tr></thead><tbody>' +
      subs
        .map(function (s) {
          var u = admin ? S.db().users.find(function (x) { return x.id === s.userId; }) : null;
          return (
            '<tr>' +
            (admin ? '<td>' + esc(u ? u.email : s.userId) + '</td>' : '') +
            '<td>' +
            esc(s.productName) +
            '</td><td>' +
            badge(s.status) +
            '</td><td>' +
            badge(s.inviteStatus || 'PENDING') +
            '</td><td>' +
            formatDate(s.expiresAt) +
            '</td><td><a href="#/subscriptions/' +
            s.id +
            '">상세</a></td></tr>'
          );
        })
        .join('') +
      '</tbody></table></div>'
    );
  }

  function viewOrders(user) {
    var orders = S.db().orders.filter(function (o) {
      return o.userId === user.id;
    });
    return pageShell(user, '<div class="container page-pad"><h1 class="page-title">주문 내역</h1>' + tableOrders(orders, false) + '</div>');
  }

  function viewOrderDetail(user, id) {
    var o = S.db().orders.find(function (x) {
      return x.id === id;
    });
    if (!o) return pageShell(user, '<div class="container page-pad">주문을 찾을 수 없습니다.</div>');
    if (o.userId !== user.id && !S.isAdmin(user)) {
      toast('권한이 없습니다.');
      navigate('/orders');
      return pageShell(user, '');
    }
    var content =
      '<div class="container page-pad narrow"><a href="#/orders">← 목록</a>' +
      '<h1 class="page-title mt">주문 상세</h1>' +
      '<div class="detail-grid">' +
      '<div><span class="muted">상품</span><div>' +
      esc(o.productName) +
      '</div></div>' +
      '<div><span class="muted">플랜</span><div>' +
      esc(o.planName) +
      '</div></div>' +
      '<div><span class="muted">금액</span><div>' +
      formatPrice(o.priceKrw) +
      '</div></div>' +
      '<div><span class="muted">상태</span><div>' +
      badge(o.status) +
      '</div></div>' +
      '<div><span class="muted">일시</span><div>' +
      formatDate(o.createdAt) +
      '</div></div></div>' +
      '<div class="info-box mt"><strong>결제</strong><p>결제 기능은 데모에서 비활성화되어 있습니다. ' +
      esc(o.paymentNote || '관리자 확인 후 구독이 생성됩니다.') +
      '</p>' +
      '<button class="btn btn-outline" disabled>결제하기 (준비중)</button></div>' +
      (o.status === 'AWAITING_PAYMENT' && o.userId === user.id
        ? '<button class="btn btn-outline mt" data-act="cancel-order" data-id="' + o.id + '">주문 취소</button>'
        : '') +
      '</div>';
    return pageShell(user, content);
  }

  function viewSubscriptions(user) {
    var subs = S.db().subscriptions.filter(function (s) {
      return s.userId === user.id;
    });
    return pageShell(user, '<div class="container page-pad"><h1 class="page-title">내 구독</h1>' + tableSubs(subs, false) + '</div>');
  }

  function viewSubDetail(user, id) {
    var s = S.db().subscriptions.find(function (x) {
      return x.id === id;
    });
    if (!s) return pageShell(user, '<div class="container page-pad">구독을 찾을 수 없습니다.</div>');
    if (s.userId !== user.id && !S.isAdmin(user)) {
      navigate('/subscriptions');
      return '';
    }
    var content =
      '<div class="container page-pad narrow"><a href="#/subscriptions">← 목록</a>' +
      '<h1 class="page-title mt">' +
      esc(s.productName) +
      '</h1>' +
      '<div class="detail-grid">' +
      '<div><span class="muted">상태</span><div>' +
      badge(s.status) +
      '</div></div>' +
      '<div><span class="muted">초대</span><div>' +
      badge(s.inviteStatus || 'PENDING') +
      '</div></div>' +
      '<div><span class="muted">시작</span><div>' +
      formatDate(s.startedAt) +
      '</div></div>' +
      '<div><span class="muted">만료</span><div>' +
      formatDate(s.expiresAt) +
      '</div></div>' +
      '<div><span class="muted">초대 이메일</span><div>' +
      esc(s.inviteEmail) +
      '</div></div></div>' +
      '<div class="info-box mt"><strong>갱신 / 환불</strong><p>결제·환불은 데모에서 준비중입니다.</p>' +
      '<button class="btn btn-outline" disabled>갱신 (준비중)</button> ' +
      '<button class="btn btn-outline" disabled>환불 신청 (준비중)</button></div></div>';
    return pageShell(user, content);
  }

  function viewFavorites(user) {
    var ids = S.getFavorites(user.id);
    var products = ids.map(function (id) {
      return S.getProduct(id);
    }).filter(Boolean);
    var html = products.length
      ? '<div class="products-grid">' +
        products
          .map(function (p) {
            return (
              '<article class="product-card"><h3>' +
              esc(p.name) +
              '</h3><p class="product-desc">' +
              esc(p.description) +
              '</p><a class="btn btn-primary" href="#/products/' +
              p.id +
              '">보기</a> ' +
              '<button class="btn btn-outline" data-act="fav" data-id="' +
              p.id +
              '">관심 해제</button></article>'
            );
          })
          .join('') +
        '</div>'
      : '<div class="empty">관심 상품이 없습니다.</div>';
    return pageShell(user, '<div class="container page-pad"><h1 class="page-title">관심 상품</h1>' + html + '</div>');
  }

  function viewNotifications(user) {
    var list = S.db().notifications.filter(function (n) {
      return n.userId === user.id;
    });
    var html = list.length
      ? '<div class="list">' +
        list
          .map(function (n) {
            return (
              '<div class="list-item ' +
              (n.read ? '' : 'unread') +
              '"><div><strong>' +
              esc(n.title) +
              '</strong><p class="muted">' +
              esc(n.body) +
              '</p><span class="tiny muted">' +
              formatDate(n.createdAt) +
              '</span></div>' +
              (n.read
                ? ''
                : '<button class="btn btn-ghost" data-act="read-n" data-id="' + n.id + '">읽음</button>') +
              '</div>'
            );
          })
          .join('') +
        '</div>'
      : '<div class="empty">알림이 없습니다.</div>';
    return pageShell(
      user,
      '<div class="container page-pad"><div class="row-between"><h1 class="page-title">알림</h1>' +
        '<button class="btn btn-outline" data-act="read-all-n">모두 읽음</button></div>' +
        html +
        '</div>'
    );
  }

  function viewProfile(user) {
    var content =
      '<div class="container page-pad narrow"><h1 class="page-title">프로필</h1>' +
      '<form id="profileForm" class="auth-form">' +
      '<label>이름<input name="name" value="' +
      esc(user.name) +
      '" required></label>' +
      '<label>이메일<input value="' +
      esc(user.email) +
      '" disabled></label>' +
      '<label>전화번호<input name="phone" value="' +
      esc(user.phone || '') +
      '" placeholder="선택"></label>' +
      '<hr class="sep"><h2 class="h2">비밀번호 변경</h2>' +
      '<label>현재 비밀번호<input name="currentPassword" type="password"></label>' +
      '<label>새 비밀번호<input name="password" type="password" minlength="8" placeholder="변경 시에만 입력"></label>' +
      '<button class="btn btn-primary" type="submit">저장</button></form></div>';
    return pageShell(user, content);
  }

  function viewTickets(user) {
    var list = S.db().tickets.filter(function (t) {
      return t.userId === user.id;
    });
    var rows = list.length
      ? '<div class="table-wrap"><table class="table"><thead><tr><th>제목</th><th>상태</th><th>일시</th></tr></thead><tbody>' +
        list
          .map(function (t) {
            return (
              '<tr><td><a href="#/tickets/' +
              t.id +
              '">' +
              esc(t.subject) +
              '</a></td><td>' +
              badge(t.status) +
              '</td><td>' +
              formatDate(t.createdAt) +
              '</td></tr>'
            );
          })
          .join('') +
        '</tbody></table></div>'
      : '<div class="empty">문의가 없습니다.</div>';
    return pageShell(
      user,
      '<div class="container page-pad"><div class="row-between"><h1 class="page-title">문의</h1><a class="btn btn-primary" href="#/tickets/new">문의 작성</a></div>' +
        rows +
        '</div>'
    );
  }

  function viewTicketNew(user) {
    return pageShell(
      user,
      '<div class="container page-pad narrow"><h1 class="page-title">문의 작성</h1>' +
        '<form id="ticketForm" class="auth-form">' +
        '<label>카테고리<select name="category"><option>일반</option><option>이용문의</option><option>기술</option><option>기타</option></select></label>' +
        '<label>제목<input name="subject" required></label>' +
        '<label>내용<textarea name="body" rows="6" required></textarea></label>' +
        '<button class="btn btn-primary" type="submit">등록</button></form></div>'
    );
  }

  function viewTicketDetail(user, id) {
    var t = S.db().tickets.find(function (x) {
      return x.id === id;
    });
    if (!t) return pageShell(user, '<div class="container page-pad">문의 없음</div>');
    if (t.userId !== user.id && !S.isAdmin(user)) {
      navigate('/tickets');
      return '';
    }
    var msgs = t.messages
      .map(function (m) {
        return (
          '<div class="msg"><div class="muted tiny">' +
          esc(ROLE_LABEL[m.authorRole] || m.authorRole) +
          ' · ' +
          formatDate(m.createdAt) +
          '</div><p>' +
          esc(m.body) +
          '</p></div>'
        );
      })
      .join('');
    return pageShell(
      user,
      '<div class="container page-pad narrow"><a href="#/tickets">← 목록</a>' +
        '<h1 class="page-title mt">' +
        esc(t.subject) +
        '</h1>' +
        badge(t.status) +
        '<div class="thread mt">' +
        msgs +
        '</div>' +
        '<form id="ticketReply" class="auth-form mt" data-id="' +
        t.id +
        '"><label>답글<textarea name="body" rows="3" required></textarea></label>' +
        '<button class="btn btn-primary" type="submit">보내기</button></form></div>'
    );
  }

  function viewFaq(user) {
    var faqs = S.db().faqs.filter(function (f) {
      return f.isPublished !== false;
    });
    var list = faqs
      .map(function (f) {
        return (
          '<details class="faq-item"><summary><span><span class="faq-cat">' +
          esc(f.category) +
          '</span><br>' +
          esc(f.question) +
          '</span></summary><div class="faq-body">' +
          esc(f.answer) +
          '</div></details>'
        );
      })
      .join('');
    return pageShell(
      user,
      '<div class="container page-pad"><h1 class="page-title">자주 묻는 질문</h1><div class="faq-list">' + list + '</div></div>'
    );
  }

  function viewLegal(user, type) {
    var title = type === 'privacy' ? '개인정보처리방침' : '이용약관';
    var body =
      type === 'privacy'
        ? 'PremiumShare는 개인정보보호법에 따라 이용자의 개인정보를 보호합니다. 이 페이지는 GitHub Pages 정적 데모용 요약본입니다.'
        : '본 이용약관은 PremiumShare 서비스 이용에 관한 사항을 규정합니다. 이 페이지는 GitHub Pages 정적 데모용 요약본입니다.';
    return pageShell(user, '<div class="container page-pad narrow"><h1 class="page-title">' + title + '</h1><p>' + body + '</p></div>');
  }

  /* ── Admin views ───────────────────────────────────────────── */

  function viewAdminDash(user) {
    var st = S.stats();
    var tasks = S.db().tasks.filter(function (t) {
      return t.status === 'PENDING';
    });
    var statsHtml =
      '<div class="stat-grid">' +
      [
        ['전체 회원', st.members],
        ['활성 구독', st.activeSubs],
        ['결제대기 주문', st.pendingOrders],
        ['처리 대기', st.pendingTasks],
        ['배정 대기', st.waitingSubs],
        ['열린 문의', st.openTickets],
        ['상품 수', st.products],
        ['그룹 수', st.groups],
      ]
        .map(function (x) {
          return '<div class="stat"><div class="stat-n">' + x[1] + '</div><div class="stat-l">' + x[0] + '</div></div>';
        })
        .join('') +
      '</div>';

    var taskType = {
      INVITE_SEND: '초대 발송',
      INVITE_ACTIVATE: '이용 시작 확인',
      RENEWAL_REMIND: '갱신 알림',
      MANUAL_PAYMENT_CONFIRM: '주문 확인(데모)',
    };

    var taskRows = tasks.length
      ? '<div class="table-wrap"><table class="table"><thead><tr><th>유형</th><th>우선순위</th><th>상태</th><th></th></tr></thead><tbody>' +
        tasks
          .map(function (t) {
            return (
              '<tr><td>' +
              esc(taskType[t.type] || t.type) +
              '</td><td>' +
              t.priority +
              '</td><td>' +
              badge(t.status) +
              '</td><td><button class="btn btn-ghost" data-act="done-task" data-id="' +
              t.id +
              '">완료</button></td></tr>'
            );
          })
          .join('') +
        '</tbody></table></div>'
      : '<div class="empty">대기 작업이 없습니다.</div>';

    return adminShell(
      user,
      '대시보드',
      statsHtml + '<h2 class="h2 mt">대기 중인 작업</h2>' + taskRows +
        '<p class="muted mt">결제·환불 UI는 비활성입니다. 주문은 「주문 관리」에서 데모 확인으로 구독을 생성하세요.</p>',
      '/admin'
    );
  }

  function viewAdminMembers(user) {
    var q = '';
    var users = S.db().users.slice().sort(function (a, b) {
      return a.createdAt < b.createdAt ? 1 : -1;
    });
    var rows =
      '<div class="table-wrap"><table class="table"><thead><tr><th>이메일</th><th>이름</th><th>역할</th><th>활성</th><th>가입</th><th></th></tr></thead><tbody>' +
      users
        .map(function (u) {
          return (
            '<tr><td>' +
            esc(u.email) +
            '</td><td>' +
            esc(u.name) +
            '</td><td><select data-act="set-role" data-id="' +
            u.id +
            '">' +
            ['MEMBER', 'SUPPORT', 'OPERATOR', 'SUPER_ADMIN']
              .map(function (r) {
                return '<option value="' + r + '"' + (u.role === r ? ' selected' : '') + '>' + (ROLE_LABEL[r] || r) + '</option>';
              })
              .join('') +
            '</select></td><td>' +
            (u.isActive
              ? '<button class="btn btn-ghost" data-act="deactivate" data-id="' + u.id + '">비활성</button>'
              : '<button class="btn btn-ghost" data-act="activate" data-id="' + u.id + '">활성</button>') +
            '</td><td>' +
            formatDate(u.createdAt) +
            '</td><td></td></tr>'
          );
        })
        .join('') +
      '</tbody></table></div>';
    return adminShell(user, '회원 관리', rows, '/admin/members');
  }

  function viewAdminProducts(user) {
    var products = S.db().products;
    var rows =
      '<div class="row-between mb"><button class="btn btn-primary" data-act="new-product">상품 등록</button></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>이름</th><th>유형</th><th>상태</th><th>활성</th><th>플랜</th><th></th></tr></thead><tbody>' +
      products
        .map(function (p) {
          return (
            '<tr><td>' +
            esc(p.name) +
            '</td><td>' +
            esc(p.serviceType) +
            '</td><td>' +
            esc(p.reviewStatus) +
            '</td><td>' +
            (p.isActive ? 'Y' : 'N') +
            '</td><td>' +
            (p.plans || []).length +
            '</td><td>' +
            '<button class="btn btn-ghost" data-act="edit-product" data-id="' +
            p.id +
            '">수정</button> ' +
            '<button class="btn btn-ghost" data-act="del-product" data-id="' +
            p.id +
            '">삭제</button></td></tr>'
          );
        })
        .join('') +
      '</tbody></table></div>' +
      '<div id="productModal" class="modal-backdrop"></div>';
    return adminShell(user, '상품 관리', rows, '/admin/products');
  }

  function viewAdminOrders(user) {
    var orders = S.db().orders.slice();
    var rows =
      '<div class="table-wrap"><table class="table"><thead><tr><th>회원</th><th>상품</th><th>금액</th><th>상태</th><th>일시</th><th></th></tr></thead><tbody>' +
      orders
        .map(function (o) {
          var u = S.db().users.find(function (x) {
            return x.id === o.userId;
          });
          return (
            '<tr><td>' +
            esc(u ? u.email : '') +
            '</td><td>' +
            esc(o.productName) +
            '</td><td>' +
            formatPrice(o.priceKrw) +
            '</td><td>' +
            badge(o.status) +
            '</td><td>' +
            formatDate(o.createdAt) +
            '</td><td>' +
            (o.status === 'AWAITING_PAYMENT'
              ? '<button class="btn btn-primary" data-act="confirm-order" data-id="' + o.id + '">데모 확인</button>'
              : '<a href="#/orders/' + o.id + '">보기</a>') +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table></div>' +
      '<p class="muted mt">「데모 확인」은 실제 결제 없이 주문을 확정하고 WAITING 구독을 생성합니다.</p>';
    return adminShell(user, '주문 관리', rows, '/admin/orders');
  }

  function viewAdminSubs(user) {
    return adminShell(user, '구독 관리', tableSubs(S.db().subscriptions, true), '/admin/subscriptions');
  }

  function viewAdminInvites(user) {
    var waiting = S.db().subscriptions.filter(function (s) {
      return s.status === 'WAITING' || s.inviteStatus === 'PENDING' || s.inviteStatus === 'SENT';
    });
    var invs = S.db().invitations;
    var html =
      '<h2 class="h2">배정/초대 대기 구독</h2>' +
      (waiting.length
        ? '<div class="table-wrap"><table class="table"><thead><tr><th>상품</th><th>이메일</th><th>초대상태</th><th></th></tr></thead><tbody>' +
          waiting
            .map(function (s) {
              return (
                '<tr><td>' +
                esc(s.productName) +
                '</td><td>' +
                esc(s.inviteEmail) +
                '</td><td>' +
                badge(s.inviteStatus || 'PENDING') +
                '</td><td>' +
                (s.inviteStatus === 'SENT'
                  ? ''
                  : '<button class="btn btn-primary" data-act="send-invite" data-id="' + s.id + '">초대 발송</button>') +
                '</td></tr>'
              );
            })
            .join('') +
          '</tbody></table></div>'
        : '<div class="empty">대기 구독 없음</div>') +
      '<h2 class="h2 mt">초대 목록</h2>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>이메일</th><th>상태</th><th>발송</th><th></th></tr></thead><tbody>' +
      invs
        .map(function (i) {
          return (
            '<tr><td>' +
            esc(i.inviteEmail) +
            '</td><td>' +
            badge(i.status) +
            '</td><td>' +
            formatDate(i.sentAt) +
            '</td><td>' +
            (i.status === 'SENT'
              ? '<button class="btn btn-primary" data-act="activate-invite" data-id="' + i.id + '">활성화 확인</button>'
              : '-') +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table></div>';
    return adminShell(user, '초대 관리', html, '/admin/invitations');
  }

  function viewAdminGroups(user) {
    var groups = S.db().groups;
    var html =
      '<div class="row-between mb"><button class="btn btn-primary" data-act="new-group">그룹 추가</button></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>이름</th><th>상품</th><th>용량</th><th>사용</th><th>상태</th></tr></thead><tbody>' +
      groups
        .map(function (g) {
          var p = S.getProduct(g.productId);
          return (
            '<tr><td>' +
            esc(g.name) +
            '</td><td>' +
            esc(p ? p.name : g.productId) +
            '</td><td>' +
            g.totalCapacity +
            '</td><td>' +
            g.usedSlots +
            '</td><td>' +
            esc(g.status) +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table></div>';
    return adminShell(user, '그룹 관리', html, '/admin/groups');
  }

  function viewAdminTickets(user) {
    var list = S.db().tickets;
    var rows =
      '<div class="table-wrap"><table class="table"><thead><tr><th>제목</th><th>회원</th><th>상태</th><th>일시</th><th></th></tr></thead><tbody>' +
      list
        .map(function (t) {
          var u = S.db().users.find(function (x) {
            return x.id === t.userId;
          });
          return (
            '<tr><td>' +
            esc(t.subject) +
            '</td><td>' +
            esc(u ? u.email : '') +
            '</td><td>' +
            badge(t.status) +
            '</td><td>' +
            formatDate(t.createdAt) +
            '</td><td><a href="#/tickets/' +
            t.id +
            '">열기</a> ' +
            '<button class="btn btn-ghost" data-act="close-ticket" data-id="' +
            t.id +
            '">종료</button></td></tr>'
          );
        })
        .join('') +
      '</tbody></table></div>';
    return adminShell(user, '문의 관리', rows, '/admin/tickets');
  }

  function viewAdminFaq(user) {
    var faqs = S.db().faqs;
    var html =
      '<div class="row-between mb"><button class="btn btn-primary" data-act="new-faq">FAQ 추가</button></div>' +
      faqs
        .map(function (f) {
          return (
            '<div class="list-item"><div><span class="faq-cat">' +
            esc(f.category) +
            '</span><strong>' +
            esc(f.question) +
            '</strong><p class="muted">' +
            esc(f.answer) +
            '</p></div>' +
            '<button class="btn btn-ghost" data-act="del-faq" data-id="' +
            f.id +
            '">삭제</button></div>'
          );
        })
        .join('');
    return adminShell(user, 'FAQ 관리', html, '/admin/faq');
  }

  function viewAdminFamily(user) {
    var jobs = S.db().familyJobs || [];
    var html =
      '<div class="info-box"><strong>가족 자동화 (데모)</strong><p>실 Google/YouTube 연동은 잠겨 있습니다. 아래는 시드 잡 목록입니다.</p></div>' +
      '<div class="table-wrap mt"><table class="table"><thead><tr><th>ID</th><th>유형</th><th>상태</th><th>그룹</th><th>일시</th></tr></thead><tbody>' +
      jobs
        .map(function (j) {
          return (
            '<tr><td>' +
            esc(j.id) +
            '</td><td>' +
            esc(j.type) +
            '</td><td>' +
            badge(j.status) +
            '</td><td>' +
            esc(j.groupId) +
            '</td><td>' +
            formatDate(j.createdAt) +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table></div>';
    return adminShell(user, '가족 자동화', html, '/admin/family');
  }

  function viewAdminAudit(user) {
    var logs = S.db().auditLogs.slice(0, 100);
    var html =
      '<div class="table-wrap"><table class="table"><thead><tr><th>일시</th><th>액션</th><th>대상</th><th>상세</th><th>Actor</th></tr></thead><tbody>' +
      logs
        .map(function (l) {
          return (
            '<tr><td>' +
            formatDate(l.createdAt) +
            '</td><td>' +
            esc(l.action) +
            '</td><td>' +
            esc(l.target) +
            '</td><td>' +
            esc(l.detail) +
            '</td><td>' +
            esc(l.actorId) +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table></div>';
    return adminShell(user, '감사 로그', html, '/admin/audit');
  }

  function viewAdminSettings(user) {
    var s = S.db().settings;
    var html =
      '<form id="settingsForm" class="auth-form narrow-form">' +
      '<label>사이트명<input name="siteName" value="' +
      esc(s.siteName) +
      '"></label>' +
      '<label>지원 이메일<input name="supportEmail" value="' +
      esc(s.supportEmail) +
      '"></label>' +
      '<label>공지<textarea name="announce" rows="3">' +
      esc(s.announce) +
      '</textarea></label>' +
      '<label>최대 로그인 실패<input name="maxLoginAttempts" type="number" value="' +
      esc(s.maxLoginAttempts) +
      '"></label>' +
      '<button class="btn btn-primary" type="submit">저장</button></form>' +
      '<hr class="sep"><button class="btn btn-outline" data-act="reset-demo">데모 데이터 초기화</button>';
    return adminShell(user, '설정', html, '/admin/settings');
  }

  function viewAdminPayments(user) {
    return adminShell(
      user,
      '결제 관리',
      '<div class="info-box"><strong>결제 기능 비활성</strong><p>요청에 따라 결제·입금확인·환불 지급 UI는 비활성화되어 있습니다. 주문은 「주문 관리」의 데모 확인으로 처리하세요.</p></div>',
      '/admin/payments'
    );
  }

  /* ── Product modal helper ──────────────────────────────────── */

  function openProductEditor(existing) {
    var p = existing || {
      name: '',
      description: '',
      serviceType: '',
      shareMethod: '가족 초대',
      isActive: true,
      reviewStatus: 'APPROVED',
      maxSlotsPerGroup: 4,
      plans: [{ name: '1개월', durationDays: 30, priceKrw: 3000, isActive: true }],
    };
    var backdrop = $('#productModal');
    if (!backdrop) return;
    backdrop.className = 'modal-backdrop open';
    backdrop.innerHTML =
      '<div class="modal modal-lg"><h3>' +
      (existing ? '상품 수정' : '상품 등록') +
      '</h3>' +
      '<form id="productForm" data-id="' +
      esc(existing ? existing.id : '') +
      '">' +
      '<label>이름<input name="name" required value="' +
      esc(p.name) +
      '"></label>' +
      '<label>설명<textarea name="description" rows="3">' +
      esc(p.description) +
      '</textarea></label>' +
      '<label>서비스 유형<input name="serviceType" value="' +
      esc(p.serviceType) +
      '"></label>' +
      '<label>공유 방식<input name="shareMethod" value="' +
      esc(p.shareMethod) +
      '"></label>' +
      '<label class="check"><input name="isActive" type="checkbox"' +
      (p.isActive ? ' checked' : '') +
      '> 활성</label>' +
      '<label>플랜 (이름|일수|가격, 줄바꿈)<textarea name="plansText" rows="4">' +
      (p.plans || [])
        .map(function (pl) {
          return pl.name + '|' + pl.durationDays + '|' + pl.priceKrw;
        })
        .join('\n') +
      '</textarea></label>' +
      '<div class="modal-actions"><button type="button" class="btn btn-outline" data-act="close-modal">취소</button>' +
      '<button type="submit" class="btn btn-primary">저장</button></div></form></div>';
  }

  /* ── Router ────────────────────────────────────────────────── */

  async function render() {
    await S.ready();
    var route = parseRoute();
    var segs = route.segs;
    var user = S.currentUser();
    var html = '';

    try {
      if (segs.length === 0) {
        html = viewHome(user);
      } else if (segs[0] === 'login') {
        html = viewAuth('login', route.query);
      } else if (segs[0] === 'register') {
        html = viewAuth('register', route.query);
      } else if (segs[0] === 'reset-password') {
        html = viewAuth('reset', route.query);
      } else if (segs[0] === 'products' && segs[1]) {
        html = viewProductDetail(user, segs[1]);
      } else if (segs[0] === 'products') {
        html = viewProducts(user);
      } else if (segs[0] === 'faq') {
        html = viewFaq(user);
      } else if (segs[0] === 'terms' || segs[0] === 'privacy') {
        html = viewLegal(user, segs[0]);
      } else if (segs[0] === 'dashboard') {
        user = requireAuth('/dashboard');
        if (!user) return;
        html = viewDashboard(user);
      } else if (segs[0] === 'orders' && segs[1]) {
        user = requireAuth('/orders/' + segs[1]);
        if (!user) return;
        html = viewOrderDetail(user, segs[1]);
      } else if (segs[0] === 'orders') {
        user = requireAuth('/orders');
        if (!user) return;
        html = viewOrders(user);
      } else if (segs[0] === 'subscriptions' && segs[1]) {
        user = requireAuth('/subscriptions/' + segs[1]);
        if (!user) return;
        html = viewSubDetail(user, segs[1]);
      } else if (segs[0] === 'subscriptions') {
        user = requireAuth('/subscriptions');
        if (!user) return;
        html = viewSubscriptions(user);
      } else if (segs[0] === 'favorites') {
        user = requireAuth('/favorites');
        if (!user) return;
        html = viewFavorites(user);
      } else if (segs[0] === 'notifications') {
        user = requireAuth('/notifications');
        if (!user) return;
        html = viewNotifications(user);
      } else if (segs[0] === 'profile') {
        user = requireAuth('/profile');
        if (!user) return;
        html = viewProfile(user);
      } else if (segs[0] === 'tickets' && segs[1] === 'new') {
        user = requireAuth('/tickets/new');
        if (!user) return;
        html = viewTicketNew(user);
      } else if (segs[0] === 'tickets' && segs[1]) {
        user = requireAuth('/tickets/' + segs[1]);
        if (!user) return;
        html = viewTicketDetail(user, segs[1]);
      } else if (segs[0] === 'tickets') {
        user = requireAuth('/tickets');
        if (!user) return;
        html = viewTickets(user);
      } else if (segs[0] === 'admin') {
        user = requireAdmin();
        if (!user) return;
        var sub = segs[1] || '';
        if (sub === 'members') html = viewAdminMembers(user);
        else if (sub === 'products') html = viewAdminProducts(user);
        else if (sub === 'orders') html = viewAdminOrders(user);
        else if (sub === 'subscriptions') html = viewAdminSubs(user);
        else if (sub === 'invitations') html = viewAdminInvites(user);
        else if (sub === 'groups') html = viewAdminGroups(user);
        else if (sub === 'tickets') html = viewAdminTickets(user);
        else if (sub === 'faq') html = viewAdminFaq(user);
        else if (sub === 'family') html = viewAdminFamily(user);
        else if (sub === 'audit') html = viewAdminAudit(user);
        else if (sub === 'settings') html = viewAdminSettings(user);
        else if (sub === 'payments') html = viewAdminPayments(user);
        else html = viewAdminDash(user);
      } else {
        html = pageShell(user, '<div class="container page-pad"><h1>404</h1><p>페이지를 찾을 수 없습니다.</p><a href="#/">홈으로</a></div>');
      }
    } catch (err) {
      console.error(err);
      html = pageShell(user, '<div class="container page-pad"><p>렌더링 오류: ' + esc(err.message) + '</p></div>');
    }

    appEl.innerHTML = html;
    bindGlobal();
    window.scrollTo(0, 0);
  }

  function bindGlobal() {
    var toggle = $('#menuToggle');
    var mobileNav = $('#mobileNav');
    if (toggle && mobileNav) {
      toggle.addEventListener('click', function () {
        mobileNav.classList.toggle('open');
      });
    }

    var authForm = $('#authForm');
    if (authForm) {
      authForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        var mode = authForm.getAttribute('data-mode');
        var fd = new FormData(authForm);
        var errEl = $('#authError');
        function showErr(msg) {
          if (errEl) {
            errEl.textContent = msg;
            errEl.classList.remove('hidden');
          }
        }
        if (mode === 'login') {
          var res = await S.login(fd.get('email'), fd.get('password'), !!fd.get('remember'));
          if (!res.ok) return showErr(res.error);
          toast('로그인되었습니다.');
          var redirect = authForm.getAttribute('data-redirect');
          if (redirect && redirect.charAt(0) === '/') navigate(redirect);
          else if (S.isAdmin(res.user)) navigate('/admin');
          else navigate('/dashboard');
        } else if (mode === 'register') {
          var r = await S.register({ name: fd.get('name'), email: fd.get('email'), password: fd.get('password') });
          if (!r.ok) return showErr(r.error);
          await S.login(fd.get('email'), fd.get('password'), false);
          toast('가입 완료!');
          navigate('/dashboard');
        } else if (mode === 'reset') {
          var rr = await S.confirmPasswordReset(fd.get('email'), fd.get('token'), fd.get('password'));
          if (!rr.ok) return showErr(rr.error);
          toast('비밀번호가 변경되었습니다.');
          navigate('/login');
        }
      });
    }

    var orderForm = $('#orderForm');
    if (orderForm) {
      orderForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var u = S.currentUser();
        if (!u) return navigate('/login');
        var planId = (orderForm.querySelector('input[name=planId]:checked') || {}).value;
        if (!planId) return toast('플랜을 선택해 주세요.');
        var res = S.createOrder(u.id, orderForm.getAttribute('data-product'), planId);
        if (!res.ok) return toast(res.error);
        toast('주문이 접수되었습니다. (결제 제외)');
        navigate('/orders/' + res.order.id);
      });
    }

    var profileForm = $('#profileForm');
    if (profileForm) {
      profileForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        var u = S.currentUser();
        var fd = new FormData(profileForm);
        var patch = { name: fd.get('name'), phone: fd.get('phone') };
        if (fd.get('password')) {
          patch.password = fd.get('password');
          patch.currentPassword = fd.get('currentPassword');
        }
        var res = await S.updateProfile(u.id, patch);
        if (!res.ok) return toast(res.error);
        toast('저장되었습니다.');
        render();
      });
    }

    var ticketForm = $('#ticketForm');
    if (ticketForm) {
      ticketForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var u = S.currentUser();
        var fd = new FormData(ticketForm);
        var res = S.createTicket(u.id, fd.get('subject'), fd.get('body'), fd.get('category'));
        if (!res.ok) return toast(res.error);
        toast('문의가 등록되었습니다.');
        navigate('/tickets/' + res.ticket.id);
      });
    }

    var ticketReply = $('#ticketReply');
    if (ticketReply) {
      ticketReply.addEventListener('submit', function (e) {
        e.preventDefault();
        var u = S.currentUser();
        var fd = new FormData(ticketReply);
        S.replyTicket(u.id, u.role, ticketReply.getAttribute('data-id'), fd.get('body'));
        toast('답글이 등록되었습니다.');
        render();
      });
    }

    var settingsForm = $('#settingsForm');
    if (settingsForm) {
      settingsForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var u = S.currentUser();
        var fd = new FormData(settingsForm);
        S.saveSettings(u.id, {
          siteName: fd.get('siteName'),
          supportEmail: fd.get('supportEmail'),
          announce: fd.get('announce'),
          maxLoginAttempts: Number(fd.get('maxLoginAttempts')) || 5,
        });
        toast('설정 저장됨');
      });
    }

    var productForm = $('#productForm');
    if (productForm) {
      productForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var u = S.currentUser();
        var fd = new FormData(productForm);
        var id = productForm.getAttribute('data-id');
        var plans = String(fd.get('plansText') || '')
          .split('\n')
          .map(function (line) {
            return line.trim();
          })
          .filter(Boolean)
          .map(function (line, i) {
            var parts = line.split('|');
            return {
              id: 'plan-' + Date.now() + '-' + i,
              name: parts[0],
              durationDays: Number(parts[1]) || 30,
              priceKrw: Number(parts[2]) || 0,
              isActive: true,
            };
          });
        var product = {
          id: id || undefined,
          name: fd.get('name'),
          description: fd.get('description'),
          serviceType: fd.get('serviceType'),
          shareMethod: fd.get('shareMethod'),
          isActive: !!fd.get('isActive'),
          reviewStatus: 'APPROVED',
          plans: plans,
          maxSlotsPerGroup: 4,
        };
        if (id) {
          var old = S.getProduct(id);
          if (old) {
            product.plans = plans.map(function (pl, i) {
              var prev = (old.plans || [])[i];
              if (prev) pl.id = prev.id;
              return pl;
            });
          }
        }
        S.saveProduct(u.id, product);
        toast('상품 저장됨');
        navigate('/admin/products');
        render();
      });
    }

    document.querySelectorAll('[data-act="set-role"]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var u = S.currentUser();
        S.setUserRole(u.id, sel.getAttribute('data-id'), sel.value);
        toast('역할이 변경되었습니다.');
      });
    });
  }

  document.addEventListener('click', async function (e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var act = t.getAttribute('data-act');
    var id = t.getAttribute('data-id');
    var u = S.currentUser();

    if (act === 'logout') {
      S.logout();
      toast('로그아웃되었습니다.');
      navigate('/');
      return;
    }
    if (act === 'fill-demo') {
      var form = $('#authForm');
      if (form) {
        form.email.value = t.getAttribute('data-email');
        form.password.value = t.getAttribute('data-pw');
      }
      return;
    }
    if (act === 'request-reset') {
      var f = $('#authForm');
      var email = f && f.email ? f.email.value : '';
      var res = S.requestPasswordReset(email);
      if (res.demoToken && f && f.token) f.token.value = res.demoToken;
      toast(res.message + (res.demoToken ? ' 토큰: ' + res.demoToken : ''));
      return;
    }
    if (act === 'fav' && u) {
      S.toggleFavorite(u.id, id);
      render();
      return;
    }
    if (act === 'cancel-order' && u) {
      S.cancelOrder(u.id, id);
      toast('주문이 취소되었습니다.');
      render();
      return;
    }
    if (act === 'read-n' && u) {
      S.markNotificationRead(u.id, id);
      render();
      return;
    }
    if (act === 'read-all-n' && u) {
      S.markAllNotificationsRead(u.id);
      render();
      return;
    }
    if (act === 'confirm-order' && u) {
      var r = S.confirmOrderDemo(u.id, id);
      toast(r.ok ? '주문이 확인되었습니다.' : r.error);
      render();
      return;
    }
    if (act === 'send-invite' && u) {
      S.sendInvite(u.id, id);
      toast('초대가 발송되었습니다.');
      render();
      return;
    }
    if (act === 'activate-invite' && u) {
      S.activateInvite(u.id, id);
      toast('구독이 활성화되었습니다.');
      render();
      return;
    }
    if (act === 'done-task' && u) {
      S.completeTask(u.id, id);
      render();
      return;
    }
    if (act === 'deactivate' && u) {
      S.setUserActive(u.id, id, false);
      render();
      return;
    }
    if (act === 'activate' && u) {
      S.setUserActive(u.id, id, true);
      render();
      return;
    }
    if (act === 'del-product' && u) {
      if (confirm('삭제할까요?')) {
        S.deleteProduct(u.id, id);
        render();
      }
      return;
    }
    if (act === 'new-product') {
      openProductEditor(null);
      return;
    }
    if (act === 'edit-product') {
      openProductEditor(S.getProduct(id));
      return;
    }
    if (act === 'close-modal') {
      var m = $('#productModal');
      if (m) {
        m.classList.remove('open');
        m.innerHTML = '';
      }
      return;
    }
    if (act === 'new-faq' && u) {
      var q = prompt('질문');
      var a = q && prompt('답변');
      var c = q && prompt('카테고리', '일반');
      if (q && a) {
        S.saveFaq(u.id, { question: q, answer: a, category: c || '일반' });
        render();
      }
      return;
    }
    if (act === 'del-faq' && u) {
      S.deleteFaq(u.id, id);
      render();
      return;
    }
    if (act === 'new-group' && u) {
      var name = prompt('그룹 이름');
      var products = S.db().products.filter(function (p) {
        return p.isActive;
      });
      if (!name || !products.length) return;
      var pid = prompt('상품 ID (기본: 첫 상품)\n' + products.map(function (p) { return p.id + ' = ' + p.name; }).join('\n'), products[0].id);
      var cap = Number(prompt('총 슬롯', '5')) || 5;
      S.saveGroup(u.id, { name: name, productId: pid, totalCapacity: cap, usedSlots: 0, status: 'ACTIVE', country: 'KR' });
      render();
      return;
    }
    if (act === 'close-ticket' && u) {
      S.setTicketStatus(u.id, id, 'CLOSED');
      render();
      return;
    }
    if (act === 'reset-demo') {
      if (confirm('모든 로컬 데모 데이터를 초기화할까요?')) {
        await S.reset();
        toast('초기화되었습니다.');
        navigate('/');
        render();
      }
    }
  });

  window.addEventListener('hashchange', render);

  document.addEventListener('DOMContentLoaded', async function () {
    appEl = document.getElementById('app');
    if (!location.hash || location.hash === '#') location.hash = '#/';
    await render();
  });
})();
