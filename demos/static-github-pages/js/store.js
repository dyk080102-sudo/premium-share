/**
 * PremiumShare client store — localStorage persistence for GitHub Pages demo.
 * Payment flows are excluded / marked as "준비중".
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'premiumshare.v1';
  var SESSION_KEY = 'premiumshare.session';

  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function daysFromNow(days) {
    return new Date(Date.now() + days * 86400000).toISOString();
  }

  function daysAgo(days) {
    return new Date(Date.now() - days * 86400000).toISOString();
  }

  /** Simple SHA-256 hex for demo passwords (not production-grade). */
  async function hashPassword(pw) {
    var enc = new TextEncoder().encode(pw);
    var buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf))
      .map(function (b) { return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  function defaultSeed() {
    var adminId = 'user-admin';
    var opId = 'user-operator';
    var supportId = 'user-support';
    var m1 = 'user-member1';
    var m2 = 'user-member2';

    // Precomputed SHA-256 for seed passwords (so first paint sync works)
    // Admin1234!, Oper1234!, Supp1234!, Member1234!
    var hashes = {
      admin: 'PLACEHOLDER',
      oper: 'PLACEHOLDER',
      supp: 'PLACEHOLDER',
      member: 'PLACEHOLDER',
    };

    var products = [
      {
        id: 'seed-cloud-storage',
        key: 'cloud-storage',
        name: '클라우드 스토리지 Pro',
        description: '고용량 클라우드 저장 공간을 저렴하게 이용하세요. 가족 플랜 슬롯을 공유합니다.',
        serviceType: '클라우드 스토리지',
        shareMethod: '가족 초대',
        reviewStatus: 'APPROVED',
        isActive: true,
        maxSlotsPerGroup: 5,
        eligibilityInfo: '만 19세 이상 내국인 또는 외국인등록증 소지자',
        onboardingGuide: '1. 초대 이메일 수락\n2. 계정 설정 완료\n3. 공유 폴더 접근',
        sortOrder: 0,
        plans: [
          { id: 'seed-plan-cloud-storage-30', name: '1개월', durationDays: 30, priceKrw: 3900, isActive: true },
          { id: 'seed-plan-cloud-storage-90', name: '3개월', durationDays: 90, priceKrw: 10500, isActive: true },
          { id: 'seed-plan-cloud-storage-365', name: '1년', durationDays: 365, priceKrw: 39000, isActive: true },
        ],
      },
      {
        id: 'seed-streaming-plus',
        key: 'streaming-plus',
        name: '스트리밍 콘텐츠 플러스',
        description: '국내외 최신 영화, 드라마, 다큐멘터리를 4K 화질로 즐기세요.',
        serviceType: '스트리밍 서비스',
        shareMethod: '프로필 공유',
        reviewStatus: 'APPROVED',
        isActive: true,
        maxSlotsPerGroup: 4,
        eligibilityInfo: '국내 서비스 이용 가능 지역 거주자',
        onboardingGuide: '1. 공유 프로필 설정\n2. PIN 번호 설정\n3. 다운로드 품질 설정',
        sortOrder: 1,
        plans: [
          { id: 'seed-plan-streaming-plus-30', name: '1개월', durationDays: 30, priceKrw: 4500, isActive: true },
          { id: 'seed-plan-streaming-plus-90', name: '3개월', durationDays: 90, priceKrw: 12000, isActive: true },
        ],
      },
      {
        id: 'seed-music-pass',
        key: 'music-pass',
        name: '프리미엄 뮤직 패스',
        description: '광고 없는 음악 스트리밍과 오프라인 저장 기능을 이용하세요.',
        serviceType: '음악 스트리밍',
        shareMethod: '가족 계정',
        reviewStatus: 'APPROVED',
        isActive: true,
        maxSlotsPerGroup: 6,
        eligibilityInfo: '만 13세 이상 이용 가능',
        onboardingGuide: '1. 가족 초대 수락\n2. 개인 플레이리스트 설정',
        sortOrder: 2,
        plans: [
          { id: 'seed-plan-music-pass-30', name: '1개월', durationDays: 30, priceKrw: 2900, isActive: true },
          { id: 'seed-plan-music-pass-90', name: '3개월', durationDays: 90, priceKrw: 7800, isActive: true },
          { id: 'seed-plan-music-pass-365', name: '1년', durationDays: 365, priceKrw: 29000, isActive: true },
        ],
      },
      {
        id: 'seed-pending-product',
        key: 'pending-product',
        name: '실제브랜드 예시 (검토중)',
        description: '현재 서비스 검토 중입니다.',
        serviceType: '기타',
        shareMethod: '미정',
        reviewStatus: 'PENDING',
        isActive: false,
        maxSlotsPerGroup: 4,
        eligibilityInfo: '',
        onboardingGuide: '',
        sortOrder: 3,
        plans: [],
      },
    ];

    var groups = [
      {
        id: 'seed-group-available',
        productId: 'seed-cloud-storage',
        name: '클라우드 Pro 그룹 A',
        totalCapacity: 5,
        usedSlots: 2,
        status: 'ACTIVE',
        country: 'KR',
      },
      {
        id: 'seed-group-full',
        productId: 'seed-streaming-plus',
        name: '스트리밍 플러스 그룹 B',
        totalCapacity: 4,
        usedSlots: 4,
        status: 'ACTIVE',
        country: 'KR',
      },
      {
        id: 'seed-group-music',
        productId: 'seed-music-pass',
        name: '뮤직 패스 그룹 C',
        totalCapacity: 6,
        usedSlots: 1,
        status: 'ACTIVE',
        country: 'KR',
      },
    ];

    var faqs = [
      {
        id: 'faq-1',
        category: '서비스 이용',
        question: '구독 슬롯 공유란 무엇인가요?',
        answer: '구독 슬롯 공유는 하나의 프리미엄 계정에서 제공하는 여러 개의 이용 자리(슬롯) 중 하나를 이용하는 서비스입니다. 정식 공유 기능을 활용하므로 이용약관에 위배되지 않습니다.',
        isPublished: true,
        sortOrder: 0,
      },
      {
        id: 'faq-2',
        category: '결제',
        question: '결제 후 얼마나 걸리나요?',
        answer: '이 데모에서는 결제가 비활성화되어 있습니다. 실제 서비스에서는 입금 확인 후 1-2 영업일 내에 슬롯이 배정됩니다.',
        isPublished: true,
        sortOrder: 1,
      },
      {
        id: 'faq-3',
        category: '구독 관리',
        question: '만료 전에 갱신하면 기간이 연장되나요?',
        answer: '네, 현재 구독 만료일 이후부터 새로운 기간이 시작됩니다. 만료 전에 갱신하시면 이용 공백 없이 서비스를 계속 이용하실 수 있습니다.',
        isPublished: true,
        sortOrder: 2,
      },
      {
        id: 'faq-4',
        category: '환불',
        question: '환불은 어떻게 신청하나요?',
        answer: '결제 기능이 비활성화된 데모에서는 환불 신청만 기록됩니다. 실제 서비스에서는 이용 일수에 비례하여 환불 금액이 계산됩니다.',
        isPublished: true,
        sortOrder: 3,
      },
      {
        id: 'faq-5',
        category: '보안',
        question: '비밀번호는 안전하게 관리되나요?',
        answer: '네, 운영자 계정의 비밀번호는 저장하지 않으며, 초대 방식으로만 서비스를 제공합니다. 이 정적 데모에서는 브라우저 localStorage에 SHA-256 해시로 저장됩니다.',
        isPublished: true,
        sortOrder: 4,
      },
    ];

    var orders = [
      {
        id: 'seed-order-active-1',
        userId: m1,
        productId: 'seed-cloud-storage',
        planId: 'seed-plan-cloud-storage-30',
        productName: '클라우드 스토리지 Pro',
        planName: '1개월',
        durationDays: 30,
        priceKrw: 3900,
        status: 'CONFIRMED',
        source: 'DEMO',
        createdAt: daysAgo(20),
      },
      {
        id: 'seed-order-waiting-1',
        userId: m2,
        productId: 'seed-cloud-storage',
        planId: 'seed-plan-cloud-storage-30',
        productName: '클라우드 스토리지 Pro',
        planName: '1개월',
        durationDays: 30,
        priceKrw: 3900,
        status: 'CONFIRMED',
        source: 'DEMO',
        createdAt: daysAgo(2),
      },
      {
        id: 'seed-order-expiring-1',
        userId: m1,
        productId: 'seed-music-pass',
        planId: 'seed-plan-music-pass-30',
        productName: '프리미엄 뮤직 패스',
        planName: '1개월',
        durationDays: 30,
        priceKrw: 2900,
        status: 'CONFIRMED',
        source: 'DEMO',
        createdAt: daysAgo(27),
      },
    ];

    var subscriptions = [
      {
        id: 'seed-sub-active-1',
        userId: m1,
        orderId: 'seed-order-active-1',
        productId: 'seed-cloud-storage',
        planId: 'seed-plan-cloud-storage-30',
        productName: '클라우드 스토리지 Pro',
        planName: '1개월',
        status: 'ACTIVE',
        groupId: 'seed-group-available',
        startedAt: daysAgo(20),
        expiresAt: daysFromNow(10),
        inviteEmail: 'member1@premiumshare.demo',
        inviteStatus: 'ACTIVATED',
      },
      {
        id: 'seed-sub-waiting-1',
        userId: m2,
        orderId: 'seed-order-waiting-1',
        productId: 'seed-cloud-storage',
        planId: 'seed-plan-cloud-storage-30',
        productName: '클라우드 스토리지 Pro',
        planName: '1개월',
        status: 'WAITING',
        groupId: 'seed-group-available',
        startedAt: daysAgo(2),
        expiresAt: daysFromNow(28),
        inviteEmail: 'member2@premiumshare.demo',
        inviteStatus: 'SENT',
      },
      {
        id: 'seed-sub-expiring-1',
        userId: m1,
        orderId: 'seed-order-expiring-1',
        productId: 'seed-music-pass',
        planId: 'seed-plan-music-pass-30',
        productName: '프리미엄 뮤직 패스',
        planName: '1개월',
        status: 'EXPIRING',
        groupId: 'seed-group-music',
        startedAt: daysAgo(27),
        expiresAt: daysFromNow(3),
        inviteEmail: 'member1@premiumshare.demo',
        inviteStatus: 'ACTIVATED',
      },
    ];

    var invitations = [
      {
        id: 'seed-invite-1',
        subscriptionId: 'seed-sub-active-1',
        inviteEmail: 'member1@premiumshare.demo',
        status: 'ACTIVATED',
        sentAt: daysAgo(19),
        activatedAt: daysAgo(18),
      },
      {
        id: 'seed-invite-waiting-1',
        subscriptionId: 'seed-sub-waiting-1',
        inviteEmail: 'member2@premiumshare.demo',
        status: 'SENT',
        sentAt: daysAgo(1),
        activatedAt: null,
      },
    ];

    var tasks = [
      {
        id: 'seed-task-activate-1',
        type: 'INVITE_ACTIVATE',
        subscriptionId: 'seed-sub-waiting-1',
        invitationId: 'seed-invite-waiting-1',
        priority: 6,
        status: 'PENDING',
        createdAt: daysAgo(1),
      },
      {
        id: 'seed-task-renewal-1',
        type: 'RENEWAL_REMIND',
        subscriptionId: 'seed-sub-expiring-1',
        invitationId: null,
        priority: 4,
        status: 'PENDING',
        createdAt: nowIso(),
      },
    ];

    var tickets = [
      {
        id: 'seed-ticket-1',
        userId: m2,
        subject: '초대 메일을 받지 못했습니다',
        status: 'OPEN',
        category: '이용문의',
        createdAt: daysAgo(1),
        messages: [
          {
            id: 'tm-1',
            authorId: m2,
            authorRole: 'MEMBER',
            body: '초대 메일이 오지 않아 서비스를 시작할 수 없습니다.',
            createdAt: daysAgo(1),
          },
        ],
      },
    ];

    var notifications = [
      {
        id: 'n-1',
        userId: m1,
        title: '구독이 활성화되었습니다',
        body: '클라우드 스토리지 Pro 이용을 시작하세요.',
        read: true,
        createdAt: daysAgo(18),
      },
      {
        id: 'n-2',
        userId: m1,
        title: '구독 만료 임박',
        body: '프리미엄 뮤직 패스가 3일 후 만료됩니다.',
        read: false,
        createdAt: nowIso(),
      },
      {
        id: 'n-3',
        userId: m2,
        title: '초대가 발송되었습니다',
        body: '이메일을 확인하고 초대를 수락해 주세요.',
        read: false,
        createdAt: daysAgo(1),
      },
    ];

    var auditLogs = [
      {
        id: 'audit-1',
        actorId: adminId,
        action: 'SEED_INIT',
        target: 'system',
        detail: '데모 데이터 초기화',
        createdAt: daysAgo(30),
      },
    ];

    var settings = {
      siteName: 'PremiumShare',
      businessMode: 'DEMO',
      supportEmail: 'support@premiumshare.demo',
      maxLoginAttempts: 5,
      lockMinutes: 15,
      announce: 'GitHub Pages 정적 데모입니다. 결제는 비활성화되어 있습니다.',
    };

    var familyJobs = [
      { id: 'fj-1', type: 'INSPECT', status: 'QUEUED', groupId: 'seed-group-available', createdAt: nowIso() },
      { id: 'fj-2', type: 'INVITE', status: 'FAILED', groupId: 'seed-group-full', createdAt: daysAgo(0.5), error: 'DEMO: mock failure' },
    ];

    return {
      version: 1,
      seededAt: nowIso(),
      users: [
        {
          id: adminId,
          email: 'admin@premiumshare.demo',
          name: '슈퍼 관리자',
          role: 'SUPER_ADMIN',
          isActive: true,
          passwordHash: hashes.admin,
          plainHint: 'Admin1234!',
          createdAt: daysAgo(60),
          failedLogins: 0,
          lockedUntil: null,
        },
        {
          id: opId,
          email: 'operator@premiumshare.demo',
          name: '운영자',
          role: 'OPERATOR',
          isActive: true,
          passwordHash: hashes.oper,
          plainHint: 'Oper1234!',
          createdAt: daysAgo(55),
          failedLogins: 0,
          lockedUntil: null,
        },
        {
          id: supportId,
          email: 'support@premiumshare.demo',
          name: '고객지원',
          role: 'SUPPORT',
          isActive: true,
          passwordHash: hashes.supp,
          plainHint: 'Supp1234!',
          createdAt: daysAgo(50),
          failedLogins: 0,
          lockedUntil: null,
        },
        {
          id: m1,
          email: 'member1@premiumshare.demo',
          name: '김회원',
          role: 'MEMBER',
          isActive: true,
          passwordHash: hashes.member,
          plainHint: 'Member1234!',
          createdAt: daysAgo(40),
          failedLogins: 0,
          lockedUntil: null,
        },
        {
          id: m2,
          email: 'member2@premiumshare.demo',
          name: '이회원',
          role: 'MEMBER',
          isActive: true,
          passwordHash: hashes.member,
          plainHint: 'Member1234!',
          createdAt: daysAgo(35),
          failedLogins: 0,
          lockedUntil: null,
          phone: '',
        },
      ],
      products: products,
      groups: groups,
      faqs: faqs,
      orders: orders,
      subscriptions: subscriptions,
      invitations: invitations,
      tasks: tasks,
      tickets: tickets,
      notifications: notifications,
      auditLogs: auditLogs,
      settings: settings,
      familyJobs: familyJobs,
      favorites: {},
    };
  }

  var SEED_PASSWORDS = {
    'admin@premiumshare.demo': 'Admin1234!',
    'operator@premiumshare.demo': 'Oper1234!',
    'support@premiumshare.demo': 'Supp1234!',
    'member1@premiumshare.demo': 'Member1234!',
    'member2@premiumshare.demo': 'Member1234!',
  };

  var Store = {
    _db: null,
    _ready: null,

    ready: function () {
      if (this._ready) return this._ready;
      var self = this;
      this._ready = this._init();
      return this._ready;
    },

    _init: async function () {
      var raw = localStorage.getItem(STORAGE_KEY);
      var db;
      if (raw) {
        try {
          db = JSON.parse(raw);
        } catch (e) {
          db = null;
        }
      }
      if (!db || db.version !== 1) {
        db = defaultSeed();
        await this._applySeedHashes(db);
        this._db = db;
        this.save();
      } else {
        this._db = db;
        // Ensure seed hashes are real (migrate placeholder)
        var needsHash = this._db.users.some(function (u) {
          return !u.passwordHash || u.passwordHash === 'PLACEHOLDER';
        });
        if (needsHash) {
          await this._applySeedHashes(this._db);
          this.save();
        }
      }
      return this._db;
    },

    _applySeedHashes: async function (db) {
      for (var i = 0; i < db.users.length; i++) {
        var u = db.users[i];
        var pw = SEED_PASSWORDS[u.email] || u.plainHint;
        if (pw) {
          u.passwordHash = await hashPassword(pw);
        }
      }
    },

    save: function () {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._db));
    },

    reset: async function () {
      var db = defaultSeed();
      await this._applySeedHashes(db);
      this._db = db;
      this.save();
      localStorage.removeItem(SESSION_KEY);
      return db;
    },

    db: function () {
      return this._db;
    },

    audit: function (actorId, action, target, detail) {
      this._db.auditLogs.unshift({
        id: uid('audit'),
        actorId: actorId,
        action: action,
        target: target || '',
        detail: detail || '',
        createdAt: nowIso(),
      });
      if (this._db.auditLogs.length > 200) this._db.auditLogs.length = 200;
      this.save();
    },

    getSession: function () {
      try {
        var s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || 'null');
        if (!s || !s.userId) return null;
        var user = this._db.users.find(function (u) { return u.id === s.userId; });
        if (!user || !user.isActive) return null;
        return { userId: user.id, remember: !!s.remember };
      } catch (e) {
        return null;
      }
    },

    currentUser: function () {
      var s = this.getSession();
      if (!s) return null;
      var u = this._db.users.find(function (x) { return x.id === s.userId; });
      if (!u) return null;
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt,
        phone: u.phone || '',
      };
    },

    isAdmin: function (user) {
      user = user || this.currentUser();
      return user && ['SUPER_ADMIN', 'OPERATOR', 'SUPPORT'].indexOf(user.role) >= 0;
    },

    register: async function (payload) {
      var email = (payload.email || '').trim().toLowerCase();
      var name = (payload.name || '').trim();
      var password = payload.password || '';
      if (!email || !name || password.length < 8) {
        return { ok: false, error: '이름, 이메일, 8자 이상 비밀번호가 필요합니다.' };
      }
      if (this._db.users.some(function (u) { return u.email === email; })) {
        return { ok: false, error: '이미 등록된 이메일입니다.' };
      }
      var user = {
        id: uid('user'),
        email: email,
        name: name,
        role: 'MEMBER',
        isActive: true,
        passwordHash: await hashPassword(password),
        createdAt: nowIso(),
        failedLogins: 0,
        lockedUntil: null,
        phone: '',
      };
      this._db.users.push(user);
      this.audit(user.id, 'REGISTER', user.id, email);
      this.save();
      return { ok: true, user: this._publicUser(user) };
    },

    login: async function (email, password, remember) {
      email = (email || '').trim().toLowerCase();
      var user = this._db.users.find(function (u) { return u.email === email; });
      if (!user) return { ok: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' };
      if (!user.isActive) return { ok: false, error: '비활성화된 계정입니다.' };
      if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
        return { ok: false, error: '로그인 시도 초과로 잠긴 계정입니다. 잠시 후 다시 시도하세요.' };
      }
      var hash = await hashPassword(password);
      if (hash !== user.passwordHash) {
        user.failedLogins = (user.failedLogins || 0) + 1;
        if (user.failedLogins >= (this._db.settings.maxLoginAttempts || 5)) {
          user.lockedUntil = daysFromNow((this._db.settings.lockMinutes || 15) / (24 * 60));
          // lockMinutes is minutes — fix:
          user.lockedUntil = new Date(Date.now() + (this._db.settings.lockMinutes || 15) * 60000).toISOString();
          user.failedLogins = 0;
        }
        this.save();
        return { ok: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' };
      }
      user.failedLogins = 0;
      user.lockedUntil = null;
      var session = { userId: user.id, remember: !!remember };
      var store = remember ? localStorage : sessionStorage;
      (remember ? sessionStorage : localStorage).removeItem(SESSION_KEY);
      store.setItem(SESSION_KEY, JSON.stringify(session));
      this.audit(user.id, 'LOGIN', user.id, email);
      this.save();
      return { ok: true, user: this._publicUser(user) };
    },

    logout: function () {
      var u = this.currentUser();
      if (u) this.audit(u.id, 'LOGOUT', u.id, u.email);
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    },

    _publicUser: function (u) {
      return { id: u.id, email: u.email, name: u.name, role: u.role, isActive: u.isActive, createdAt: u.createdAt, phone: u.phone || '' };
    },

    updateProfile: async function (userId, patch) {
      var u = this._db.users.find(function (x) { return x.id === userId; });
      if (!u) return { ok: false, error: '사용자를 찾을 수 없습니다.' };
      if (patch.name) u.name = patch.name.trim();
      if (patch.phone !== undefined) u.phone = String(patch.phone || '');
      if (patch.password) {
        if (patch.password.length < 8) return { ok: false, error: '비밀번호는 8자 이상이어야 합니다.' };
        if (patch.currentPassword) {
          var cur = await hashPassword(patch.currentPassword);
          if (cur !== u.passwordHash) return { ok: false, error: '현재 비밀번호가 일치하지 않습니다.' };
        }
        u.passwordHash = await hashPassword(patch.password);
      }
      this.audit(userId, 'UPDATE_PROFILE', userId, '');
      this.save();
      return { ok: true, user: this._publicUser(u) };
    },

    requestPasswordReset: function (email) {
      email = (email || '').trim().toLowerCase();
      var u = this._db.users.find(function (x) { return x.email === email; });
      // Always succeed for privacy; demo stores token in localStorage
      if (u) {
        var token = uid('reset');
        localStorage.setItem('premiumshare.reset.' + email, JSON.stringify({ token: token, exp: Date.now() + 3600000 }));
        return { ok: true, demoToken: token, message: '데모: 재설정 토큰이 발급되었습니다. (실제 이메일은 발송되지 않습니다)' };
      }
      return { ok: true, message: '해당 이메일이 등록되어 있다면 안내가 발송됩니다. (데모)' };
    },

    confirmPasswordReset: async function (email, token, newPassword) {
      email = (email || '').trim().toLowerCase();
      var raw = localStorage.getItem('premiumshare.reset.' + email);
      if (!raw) return { ok: false, error: '유효하지 않거나 만료된 토큰입니다.' };
      var data = JSON.parse(raw);
      if (data.token !== token || data.exp < Date.now()) {
        return { ok: false, error: '유효하지 않거나 만료된 토큰입니다.' };
      }
      if (!newPassword || newPassword.length < 8) return { ok: false, error: '비밀번호는 8자 이상이어야 합니다.' };
      var u = this._db.users.find(function (x) { return x.email === email; });
      if (!u) return { ok: false, error: '사용자를 찾을 수 없습니다.' };
      u.passwordHash = await hashPassword(newPassword);
      localStorage.removeItem('premiumshare.reset.' + email);
      this.audit(u.id, 'RESET_PASSWORD', u.id, '');
      this.save();
      return { ok: true };
    },

    activeProducts: function () {
      return this._db.products
        .filter(function (p) { return p.isActive && p.reviewStatus === 'APPROVED'; })
        .sort(function (a, b) { return a.sortOrder - b.sortOrder; });
    },

    getProduct: function (id) {
      return this._db.products.find(function (p) { return p.id === id; });
    },

    createOrder: function (userId, productId, planId) {
      var product = this.getProduct(productId);
      if (!product || !product.isActive) return { ok: false, error: '상품을 찾을 수 없습니다.' };
      var plan = (product.plans || []).find(function (p) { return p.id === planId && p.isActive; });
      if (!plan) return { ok: false, error: '플랜을 선택해 주세요.' };
      var order = {
        id: uid('order'),
        userId: userId,
        productId: product.id,
        planId: plan.id,
        productName: product.name,
        planName: plan.name,
        durationDays: plan.durationDays,
        priceKrw: plan.priceKrw,
        status: 'AWAITING_PAYMENT',
        source: 'DEMO',
        createdAt: nowIso(),
        paymentNote: '결제 기능은 데모에서 비활성화되어 있습니다. 관리자가 주문을 확인할 수 있습니다.',
      };
      this._db.orders.unshift(order);
      this._db.notifications.unshift({
        id: uid('n'),
        userId: userId,
        title: '주문이 접수되었습니다',
        body: product.name + ' / ' + plan.name + ' — 결제는 준비 중입니다.',
        read: false,
        createdAt: nowIso(),
      });
      this._db.tasks.unshift({
        id: uid('task'),
        type: 'MANUAL_PAYMENT_CONFIRM',
        subscriptionId: null,
        orderId: order.id,
        invitationId: null,
        priority: 5,
        status: 'PENDING',
        createdAt: nowIso(),
      });
      this.audit(userId, 'CREATE_ORDER', order.id, product.name);
      this.save();
      return { ok: true, order: order };
    },

    /** Demo: admin confirms order without real payment → creates WAITING subscription */
    confirmOrderDemo: function (adminId, orderId) {
      var order = this._db.orders.find(function (o) { return o.id === orderId; });
      if (!order) return { ok: false, error: '주문 없음' };
      if (order.status === 'CONFIRMED') return { ok: false, error: '이미 확인된 주문입니다.' };
      order.status = 'CONFIRMED';
      order.confirmedAt = nowIso();
      order.confirmedBy = adminId;
      var sub = {
        id: uid('sub'),
        userId: order.userId,
        orderId: order.id,
        productId: order.productId,
        planId: order.planId,
        productName: order.productName,
        planName: order.planName,
        status: 'WAITING',
        groupId: null,
        startedAt: nowIso(),
        expiresAt: daysFromNow(order.durationDays),
        inviteEmail: (this._db.users.find(function (u) { return u.id === order.userId; }) || {}).email,
        inviteStatus: 'PENDING',
      };
      this._db.subscriptions.unshift(sub);
      this._db.tasks = this._db.tasks.filter(function (t) { return t.orderId !== orderId; });
      this._db.tasks.unshift({
        id: uid('task'),
        type: 'INVITE_SEND',
        subscriptionId: sub.id,
        invitationId: null,
        priority: 7,
        status: 'PENDING',
        createdAt: nowIso(),
      });
      this._db.notifications.unshift({
        id: uid('n'),
        userId: order.userId,
        title: '주문이 확인되었습니다',
        body: '슬롯 배정 및 초대 준비를 진행합니다. (데모)',
        read: false,
        createdAt: nowIso(),
      });
      this.audit(adminId, 'CONFIRM_ORDER_DEMO', orderId, 'no real payment');
      this.save();
      return { ok: true, subscription: sub };
    },

    cancelOrder: function (userId, orderId) {
      var order = this._db.orders.find(function (o) { return o.id === orderId; });
      if (!order || order.userId !== userId) return { ok: false, error: '주문을 찾을 수 없습니다.' };
      if (order.status === 'CONFIRMED') return { ok: false, error: '이미 확정된 주문은 취소할 수 없습니다.' };
      order.status = 'CANCELLED';
      this.audit(userId, 'CANCEL_ORDER', orderId, '');
      this.save();
      return { ok: true };
    },

    toggleFavorite: function (userId, productId) {
      if (!this._db.favorites[userId]) this._db.favorites[userId] = [];
      var list = this._db.favorites[userId];
      var idx = list.indexOf(productId);
      if (idx >= 0) list.splice(idx, 1);
      else list.push(productId);
      this.save();
      return list;
    },

    getFavorites: function (userId) {
      return this._db.favorites[userId] || [];
    },

    // Admin: members
    setUserRole: function (adminId, userId, role) {
      var allowed = ['MEMBER', 'SUPPORT', 'OPERATOR', 'SUPER_ADMIN'];
      if (allowed.indexOf(role) < 0) return { ok: false, error: '잘못된 역할' };
      var u = this._db.users.find(function (x) { return x.id === userId; });
      if (!u) return { ok: false, error: '없음' };
      u.role = role;
      this.audit(adminId, 'SET_ROLE', userId, role);
      this.save();
      return { ok: true };
    },

    setUserActive: function (adminId, userId, isActive) {
      var u = this._db.users.find(function (x) { return x.id === userId; });
      if (!u) return { ok: false, error: '없음' };
      u.isActive = !!isActive;
      this.audit(adminId, 'SET_ACTIVE', userId, String(isActive));
      this.save();
      return { ok: true };
    },

    // Admin: products
    saveProduct: function (adminId, product) {
      if (product.id) {
        var idx = this._db.products.findIndex(function (p) { return p.id === product.id; });
        if (idx < 0) return { ok: false, error: '없음' };
        this._db.products[idx] = Object.assign({}, this._db.products[idx], product);
        this.audit(adminId, 'UPDATE_PRODUCT', product.id, product.name);
      } else {
        product.id = uid('prod');
        product.key = product.key || product.id;
        product.plans = product.plans || [];
        product.sortOrder = this._db.products.length;
        product.reviewStatus = product.reviewStatus || 'APPROVED';
        this._db.products.push(product);
        this.audit(adminId, 'CREATE_PRODUCT', product.id, product.name);
      }
      this.save();
      return { ok: true, product: product };
    },

    deleteProduct: function (adminId, productId) {
      this._db.products = this._db.products.filter(function (p) { return p.id !== productId; });
      this.audit(adminId, 'DELETE_PRODUCT', productId, '');
      this.save();
      return { ok: true };
    },

    // Invitations
    sendInvite: function (adminId, subscriptionId) {
      var sub = this._db.subscriptions.find(function (s) { return s.id === subscriptionId; });
      if (!sub) return { ok: false, error: '구독 없음' };
      var inv = {
        id: uid('inv'),
        subscriptionId: sub.id,
        inviteEmail: sub.inviteEmail,
        status: 'SENT',
        sentAt: nowIso(),
        activatedAt: null,
      };
      this._db.invitations.unshift(inv);
      sub.inviteStatus = 'SENT';
      sub.status = 'WAITING';
      // assign group if free capacity
      var group = this._db.groups.find(function (g) {
        return g.productId === sub.productId && g.usedSlots < g.totalCapacity && g.status === 'ACTIVE';
      });
      if (group) {
        group.usedSlots += 1;
        sub.groupId = group.id;
      }
      this._db.tasks = this._db.tasks.filter(function (t) {
        return !(t.subscriptionId === subscriptionId && t.type === 'INVITE_SEND' && t.status === 'PENDING');
      });
      this._db.tasks.unshift({
        id: uid('task'),
        type: 'INVITE_ACTIVATE',
        subscriptionId: sub.id,
        invitationId: inv.id,
        priority: 6,
        status: 'PENDING',
        createdAt: nowIso(),
      });
      this._db.notifications.unshift({
        id: uid('n'),
        userId: sub.userId,
        title: '초대가 발송되었습니다',
        body: '이메일을 확인하고 초대를 수락해 주세요. (데모)',
        read: false,
        createdAt: nowIso(),
      });
      this.audit(adminId, 'SEND_INVITE', inv.id, sub.inviteEmail);
      this.save();
      return { ok: true, invitation: inv };
    },

    activateInvite: function (adminId, invitationId) {
      var inv = this._db.invitations.find(function (i) { return i.id === invitationId; });
      if (!inv) return { ok: false, error: '없음' };
      inv.status = 'ACTIVATED';
      inv.activatedAt = nowIso();
      var sub = this._db.subscriptions.find(function (s) { return s.id === inv.subscriptionId; });
      if (sub) {
        sub.status = 'ACTIVE';
        sub.inviteStatus = 'ACTIVATED';
        this._db.notifications.unshift({
          id: uid('n'),
          userId: sub.userId,
          title: '구독이 활성화되었습니다',
          body: sub.productName + ' 이용을 시작하세요.',
          read: false,
          createdAt: nowIso(),
        });
      }
      this._db.tasks = this._db.tasks.filter(function (t) {
        return t.invitationId !== invitationId || t.status !== 'PENDING';
      });
      this.audit(adminId, 'ACTIVATE_INVITE', invitationId, '');
      this.save();
      return { ok: true };
    },

    // FAQ
    saveFaq: function (adminId, faq) {
      if (faq.id) {
        var i = this._db.faqs.findIndex(function (f) { return f.id === faq.id; });
        if (i >= 0) this._db.faqs[i] = Object.assign({}, this._db.faqs[i], faq);
      } else {
        faq.id = uid('faq');
        faq.isPublished = faq.isPublished !== false;
        faq.sortOrder = this._db.faqs.length;
        this._db.faqs.push(faq);
      }
      this.audit(adminId, 'SAVE_FAQ', faq.id, faq.question);
      this.save();
      return { ok: true, faq: faq };
    },

    deleteFaq: function (adminId, faqId) {
      this._db.faqs = this._db.faqs.filter(function (f) { return f.id !== faqId; });
      this.audit(adminId, 'DELETE_FAQ', faqId, '');
      this.save();
      return { ok: true };
    },

    // Tickets
    createTicket: function (userId, subject, body, category) {
      var t = {
        id: uid('ticket'),
        userId: userId,
        subject: subject,
        status: 'OPEN',
        category: category || '일반',
        createdAt: nowIso(),
        messages: [
          {
            id: uid('tm'),
            authorId: userId,
            authorRole: 'MEMBER',
            body: body,
            createdAt: nowIso(),
          },
        ],
      };
      this._db.tickets.unshift(t);
      this.audit(userId, 'CREATE_TICKET', t.id, subject);
      this.save();
      return { ok: true, ticket: t };
    },

    replyTicket: function (authorId, role, ticketId, body) {
      var t = this._db.tickets.find(function (x) { return x.id === ticketId; });
      if (!t) return { ok: false, error: '없음' };
      t.messages.push({
        id: uid('tm'),
        authorId: authorId,
        authorRole: role,
        body: body,
        createdAt: nowIso(),
      });
      if (role !== 'MEMBER') t.status = 'ANSWERED';
      else t.status = 'OPEN';
      this.save();
      return { ok: true };
    },

    setTicketStatus: function (adminId, ticketId, status) {
      var t = this._db.tickets.find(function (x) { return x.id === ticketId; });
      if (!t) return { ok: false, error: '없음' };
      t.status = status;
      this.audit(adminId, 'TICKET_STATUS', ticketId, status);
      this.save();
      return { ok: true };
    },

    markNotificationRead: function (userId, id) {
      var n = this._db.notifications.find(function (x) { return x.id === id && x.userId === userId; });
      if (n) n.read = true;
      this.save();
    },

    markAllNotificationsRead: function (userId) {
      this._db.notifications.forEach(function (n) {
        if (n.userId === userId) n.read = true;
      });
      this.save();
    },

    saveSettings: function (adminId, patch) {
      Object.assign(this._db.settings, patch);
      this.audit(adminId, 'SAVE_SETTINGS', 'settings', '');
      this.save();
      return { ok: true };
    },

    saveGroup: function (adminId, group) {
      if (group.id) {
        var i = this._db.groups.findIndex(function (g) { return g.id === group.id; });
        if (i >= 0) this._db.groups[i] = Object.assign({}, this._db.groups[i], group);
      } else {
        group.id = uid('group');
        group.usedSlots = group.usedSlots || 0;
        group.status = group.status || 'ACTIVE';
        this._db.groups.push(group);
      }
      this.audit(adminId, 'SAVE_GROUP', group.id, group.name);
      this.save();
      return { ok: true, group: group };
    },

    completeTask: function (adminId, taskId) {
      var t = this._db.tasks.find(function (x) { return x.id === taskId; });
      if (!t) return { ok: false, error: '없음' };
      t.status = 'DONE';
      t.completedAt = nowIso();
      this.audit(adminId, 'COMPLETE_TASK', taskId, t.type);
      this.save();
      return { ok: true };
    },

    stats: function () {
      var db = this._db;
      var members = db.users.filter(function (u) { return u.role === 'MEMBER' && u.isActive; }).length;
      var products = db.products.filter(function (p) { return p.isActive; }).length;
      var activeSubs = db.subscriptions.filter(function (s) { return s.status === 'ACTIVE' || s.status === 'EXPIRING'; }).length;
      var pendingOrders = db.orders.filter(function (o) { return o.status === 'AWAITING_PAYMENT'; }).length;
      var openTickets = db.tickets.filter(function (t) { return t.status === 'OPEN'; }).length;
      var pendingTasks = db.tasks.filter(function (t) { return t.status === 'PENDING'; }).length;
      var waitingSubs = db.subscriptions.filter(function (s) { return s.status === 'WAITING'; }).length;
      return {
        members: members,
        products: products,
        activeSubs: activeSubs,
        pendingOrders: pendingOrders,
        openTickets: openTickets,
        pendingTasks: pendingTasks,
        waitingSubs: waitingSubs,
        totalUsers: db.users.length,
        groups: db.groups.length,
        faqs: db.faqs.length,
      };
    },

    DEMO_ACCOUNTS: [
      { email: 'admin@premiumshare.demo', password: 'Admin1234!', role: 'SUPER_ADMIN' },
      { email: 'operator@premiumshare.demo', password: 'Oper1234!', role: 'OPERATOR' },
      { email: 'support@premiumshare.demo', password: 'Supp1234!', role: 'SUPPORT' },
      { email: 'member1@premiumshare.demo', password: 'Member1234!', role: 'MEMBER' },
      { email: 'member2@premiumshare.demo', password: 'Member1234!', role: 'MEMBER' },
    ],
  };

  global.PSStore = Store;
})(window);
