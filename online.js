// =============================================================
//  DESENHA AÍ! — versão online (GitHub Pages + Firebase Realtime Database)
//  A TV hospeda a sala (roda o core.js) e os celulares falam com ela pelo Firebase.
//  Este arquivo substitui o "servidor": tv.js e celular.js continuam iguais,
//  porque aqui são simulados o EventSource e o fetch('/api/...') que eles usam.
// =============================================================
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const ROLE = document.documentElement.getAttribute('data-role');   // 'tv' | 'player'
  const PALAVRAS_URL = 'https://raw.githubusercontent.com/netocatto/desenha-ai-palavras/main/palavras.json';
  const realFetch = window.fetch.bind(window);
  const LS = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { } } };

  // ------------------------------------------------------------ bancos de dados
  // Interface comum: uid, TS, set, update, push, remove, get, onValue, onChildAdded,
  // onChildRemoved, onDisconnectRemove, onDisconnectUpdate, cancelOnDisconnect, onConnected
  function firebaseDB(cfg) {
    return new Promise((resolve, reject) => {
      if (!window.firebase) return reject(new Error('Não consegui carregar o Firebase (sem internet?)'));
      if (!cfg || !cfg.apiKey || !cfg.databaseURL || /COLE_AQUI/.test(cfg.apiKey)) return reject(new Error('Firebase ainda não configurado (firebase-config.js).'));
      const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
      const auth = firebase.auth(app), db = firebase.database(app);
      auth.signInAnonymously().then((cred) => {
        const ref = (p) => db.ref(p);
        const warn = (p) => (e) => console.warn('[firebase]', p, e && e.message);
        resolve({
          uid: cred.user.uid,
          TS: firebase.database.ServerValue.TIMESTAMP,
          set: (p, v) => ref(p).set(v),
          update: (p, o) => ref(p).update(o),
          push: (p, v) => ref(p).push(v),
          remove: (p) => ref(p).remove(),
          get: (p) => ref(p).get().then((s) => s.val()),
          onValue(p, cb) { const r = ref(p); const h = r.on('value', (s) => cb(s.val()), warn(p)); return () => r.off('value', h); },
          onChildAdded(p, cb) { const r = ref(p); const h = r.on('child_added', (s) => cb(s.key, s.val()), warn(p)); return () => r.off('child_added', h); },
          onChildRemoved(p, cb) { const r = ref(p); const h = r.on('child_removed', (s) => cb(s.key), warn(p)); return () => r.off('child_removed', h); },
          onDisconnectRemove: (p) => ref(p).onDisconnect().remove(),
          onDisconnectUpdate: (p, o) => ref(p).onDisconnect().update(o),
          cancelOnDisconnect: (p) => ref(p).onDisconnect().cancel(),
          onConnected(cb) { ref('.info/connected').on('value', (s) => cb(s.val() === true)); },
        });
      }).catch((e) => reject(new Error('Login anônimo falhou: ' + (e && e.message) + ' (o login Anônimo está ativado no Firebase?)')));
    });
  }

  // Simulado (testes locais): só aceito em localhost
  function mockDB(base) {
    return realFetch(base + '/auth', { method: 'POST' }).then((r) => r.json()).then(({ uid }) => {
      const cid = uid + '-' + Math.random().toString(36).slice(2, 7);
      const subs = {}; let sidSeq = 0; const connCbs = [];
      const es = new window.__RealEventSource(base + '/sse?cid=' + cid);
      es.onmessage = (e) => { const m = JSON.parse(e.data); const s = subs[m.sid]; if (s) s(m); };
      const opened = new Promise((res) => { es.onopen = () => { res(); connCbs.forEach((c) => c(true)); }; });
      const op = (b) => opened.then(() => realFetch(base + '/op', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ cid }, b)) })).then((r) => r.json());
      function sub(path, type, handler) {
        const sid = 's' + (++sidSeq); subs[sid] = handler; op({ op: 'sub', sid, path, type });
        return () => { delete subs[sid]; op({ op: 'unsub', sid }); };
      }
      return {
        uid, TS: { '.sv': 'timestamp' },
        set: (p, v) => op({ op: 'set', path: p, val: v }),
        update: (p, o) => op({ op: 'update', path: p, val: o }),
        push: (p, v) => op({ op: 'push', path: p, val: v }),
        remove: (p) => op({ op: 'remove', path: p }),
        get: (p) => op({ op: 'get', path: p }).then((r) => r.val),
        onValue: (p, cb) => sub(p, 'value', (m) => cb(m.val)),
        onChildAdded: (p, cb) => sub(p, 'child_added', (m) => cb(m.key, m.val)),
        onChildRemoved: (p, cb) => sub(p, 'child_removed', (m) => cb(m.key)),
        onDisconnectRemove: (p) => op({ op: 'ondisc', kind: 'remove', path: p }),
        onDisconnectUpdate: (p, o) => op({ op: 'ondisc', kind: 'update', path: p, val: o }),
        cancelOnDisconnect: (p) => op({ op: 'ondisc', kind: 'cancel', path: p }),
        onConnected(cb) { connCbs.push(cb); },
      };
    });
  }

  window.__RealEventSource = window.EventSource;
  const mockBase = params.get('mock');
  const dbReady = (mockBase && /^(localhost|127\.0\.0\.1)$/.test(location.hostname))
    ? mockDB(mockBase) : firebaseDB(window.FIREBASE_CONFIG);

  // ------------------------------------------------------------ peças comuns
  function FakeES() { this.l = {}; this.onerror = null; this.closed = false; this.onclose = null; }
  FakeES.prototype.addEventListener = function (t, f) { (this.l[t] = this.l[t] || []).push(f); };
  FakeES.prototype.emit = function (t, data) {
    if (this.closed) return;
    const ev = { data: typeof data === 'string' ? data : JSON.stringify(data) };
    (this.l[t] || []).forEach((f) => { try { f(ev); } catch (e) { console.error(e); } });
  };
  FakeES.prototype.fail = function () { if (!this.closed && this.onerror) this.onerror(new Event('error')); };
  FakeES.prototype.close = function () { if (this.closed) return; this.closed = true; if (this.onclose) this.onclose(); };

  function resp(status, obj) { return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(obj) }; }
  function fatal(msg) {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:99;background:rgba(27,20,64,.96);color:#fff;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;font:700 20px/1.4 "Baloo 2",system-ui,sans-serif';
    d.innerHTML = '<div><div style="font-size:48px">⚠️</div>' + msg.replace(/[<>&]/g, '') + '<br><br><button onclick="location.reload()" style="font:inherit;padding:8px 20px;border:0;border-radius:12px;background:#ffd23f;color:#1b1440">Tentar de novo</button></div>';
    (document.body || document.documentElement).appendChild(d);
  }
  function randomCode() {
    const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let s = ''; for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)];
    return s;
  }

  if (ROLE === 'tv') initTV(); else initPlayer();

  // ============================================================ TV (hospeda a sala)
  function initTV() {
    let db = null, code = null, game = null;
    const tvConns = new Set();
    const players = new Map();          // uid -> objeto cliente do core
    const pending = {}; let flushing = false;

    window.EventSource = function () {
      const es = new FakeES();
      ready.then(() => {
        const c = { role: 'tv', es };
        tvConns.add(c);
        es.onclose = () => { tvConns.delete(c); game.disconnect(c); };
        game.connect(c);
      });
      return es;
    };
    window.fetch = function (url, opts) {
      if (typeof url === 'string' && url.indexOf('/api/') === 0) return Promise.resolve(resp(404, { error: 'indisponível na versão online' }));
      return realFetch(url, opts);
    };

    function queue(path, value) { pending[path] = value; if (!flushing) { flushing = true; Promise.resolve().then(flush); } }
    function flush() {
      flushing = false;
      const u = {}; Object.keys(pending).forEach((k) => { u[k] = pending[k]; delete pending[k]; });
      if (Object.keys(u).length) Promise.resolve(db.update('salas/' + code + '/views', u)).catch((e) => console.warn(e));
    }
    function send(client, event, data) {
      if (client.role === 'tv') return client.es.emit(event, data);
      if (event === 'state') queue(client.pid + '/s', JSON.stringify(data));
      else if (event === 'unknown' || event === 'kicked') queue(client.pid + '/x', event + ':' + Date.now());
      else queue(client.pid + '/ev/' + event, JSON.stringify({ d: data, n: Date.now() + Math.random() }));   // eventos do jogo (ex.: desenho a descrever)
    }

    const ready = dbReady.then(async (d) => {
      db = d;
      // cria uma sala com código livre (as regras recusam se já tiver dono)
      for (let i = 0; i < 25 && !code; i++) {
        const c = randomCode();
        try {
          const ex = await db.get('salas/' + c + '/host').catch(() => null);
          if (ex) continue;
          await db.set('salas/' + c + '/host', { uid: db.uid, criado: db.TS, online: true });
          code = c;
        } catch (e) { /* código ocupado: tenta outro */ }
      }
      if (!code) throw new Error('Não consegui criar a sala. Confira as regras do Realtime Database.');
      const base = new URL('./', location.href).href;
      game = DesenhaCore({
        categorias: window.PALAVRAS,
        send,
        joinURL: () => base + '?sala=' + code,
        extraView: () => ({ tunnel: null, canTunnel: false, sv: 'online', sala: code }),
        log: (m) => console.log('[jogo]', m),
      });
      window.__jogo = { game, code: () => code };

      // presença dos celulares
      db.onChildAdded('salas/' + code + '/presenca', (uid) => {
        if (players.has(uid)) return;
        const c = { role: 'player', pid: uid };
        players.set(uid, c);
        game.connect(c);
      });
      db.onChildRemoved('salas/' + code + '/presenca', (uid) => {
        const c = players.get(uid); if (!c) return;
        players.delete(uid); game.disconnect(c);
      });

      // mensagens dos celulares
      db.onChildAdded('salas/' + code + '/inbox', (key, m) => {
        db.remove('salas/' + code + '/inbox/' + key);
        if (!m || !m.uid) return;
        let b = {}; try { b = JSON.parse(m.corpo || '{}') || {}; } catch { }
        b.pid = m.uid;                                   // ninguém se passa por outro jogador
        let r = null;
        if (m.tipo === 'join') { b.pidFixo = m.uid; r = game.join(b); if (r[0] === 200) queue(m.uid + '/x', null); }
        else if (m.tipo === 'action') r = game.action(b);
        else if (m.tipo === 'draw') { game.draw(b); return; }
        else return;
        if (m.req) queue(m.uid + '/r', JSON.stringify({ req: m.req, status: r[0], body: r[1] }));
      });

      // TV conectada/desconectada (se a internet cair, os celulares ficam sabendo)
      db.onConnected((on) => {
        if (!on) { tvConns.forEach((c) => c.es.fail()); return; }
        db.onDisconnectUpdate('salas/' + code + '/host', { online: false });
        db.update('salas/' + code + '/host', { online: true });
        game.broadcastState();
      });
      window.addEventListener('pagehide', () => { try { db.remove('salas/' + code); } catch { } });

      // palavras publicadas pelo terminal
      try { const c = LS.get('desenhaai_palavras'); if (c) game.setPalavras(JSON.parse(c), 'cache'); } catch { }
      const atualizar = () => realFetch(PALAVRAS_URL + '?t=' + Date.now(), { cache: 'no-store' })
        .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then((d) => { if (game.setPalavras(d, 'online')) LS.set('desenhaai_palavras', JSON.stringify(d)); })
        .catch((e) => console.warn('palavras online:', e.message));
      atualizar(); setInterval(atualizar, 10 * 60 * 1000);
    });
    ready.catch((e) => fatal(e.message));
  }

  // ============================================================ CELULAR
  function initPlayer() {
    let db = null;
    let code = (params.get('sala') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    let es = null, lastS = null, lastView = null, lastX = null, host, hostKnown = false, unsubs = [];
    const waiters = {};
    let connected = false, pingTimer = null;

    const ready = dbReady.then((d) => {
      db = d;
      db.onConnected((on) => { connected = on; if (!on && es) es.fail(); if (on && es && !es.closed) presence(); });
      if (code) watch();
    });
    ready.catch((e) => fatal(e.message));

    function status(t) { const el = document.getElementById('status'); if (el) { el.style.color = ''; el.textContent = t; } }
    function watch() {
      unsubs.forEach((u) => u()); unsubs = [];
      host = undefined; hostKnown = false; lastS = null; lastView = null; lastX = null;
      unsubs.push(db.onValue('salas/' + code + '/host', (h) => {
        host = h; hostKnown = true;
        if (!h) status('Sala ' + code + ' não existe mais — leia o QR da TV de novo');
        else if (h.online === false) status('TV desconectada… aguardando');
        else status('');
      }));
      const evSeen = {};
      unsubs.push(db.onValue('salas/' + code + '/views/' + db.uid + '/ev', (v) => {
        if (!v) return;
        Object.keys(v).forEach((k) => { if (v[k] !== evSeen[k]) { evSeen[k] = v[k]; try { const o = JSON.parse(v[k]); if (es) es.emit(k, o.d); } catch { } } });
      }));
      // escutas separadas: estado (s), resposta de entrada (r) e avisos (x) — assim o desenho (ev) não é baixado de novo
      const base = 'salas/' + code + '/views/' + db.uid;
      unsubs.push(db.onValue(base + '/r', (rv) => { if (!rv) return; try { const r = JSON.parse(rv); if (waiters[r.req]) { waiters[r.req](r); delete waiters[r.req]; } } catch { } }));
      unsubs.push(db.onValue(base + '/s', (sv) => { if (sv && sv !== lastS) { lastS = sv; try { lastView = JSON.parse(sv); } catch { } if (es) es.emit('state', sv); } }));
      unsubs.push(db.onValue(base + '/x', (xv) => { if (xv && xv !== lastX) { lastX = xv; if (es) es.emit(xv.split(':')[0], {}); } }));
    }
    function presence() {
      const p = 'salas/' + code + '/presenca/' + db.uid;
      db.onDisconnectRemove(p);
      db.set(p, true);
    }

    window.EventSource = function () {
      const me = new FakeES();
      es = me;
      ready.then(() => {
        if (me.closed || !code) return;
        presence();
        if (lastView) me.emit('state', lastView);
        if (lastX && lastX.indexOf('unknown') === 0) me.emit('unknown', {});
        pingTimer = setInterval(() => { if (connected) me.emit('ping', Date.now()); }, 3000);
      });
      me.onclose = () => {
        clearInterval(pingTimer);
        if (es === me) es = null;
        if (db && code) { const p = 'salas/' + code + '/presenca/' + db.uid; db.cancelOnDisconnect(p); db.remove(p); }
      };
      return me;
    };

    window.fetch = async function (url, opts) {
      if (typeof url !== 'string' || url.indexOf('/api/') !== 0) return realFetch(url, opts);
      await ready;
      const path = url.split('?')[0];
      const corpo = (opts && opts.body) || '{}';
      if (path === '/api/join' && !code) {
        const el = document.getElementById('sala');
        code = ((el && el.value) || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
        if (!code) return resp(400, { error: 'Digite o código da sala (aparece na TV)' });
        try { history.replaceState(null, '', '?sala=' + code); } catch { }
        watch();
      }
      if (!code) {
        // sem código: um jogador guardado de outra partida não vale mais → volta para a tela de entrada
        if (path === '/api/state' || path === '/api/action') return resp(404, { error: 'jogador desconhecido' });
        return resp(400, { error: 'Digite o código da sala (aparece na TV)' });
      }
      const inbox = 'salas/' + code + '/inbox';
      if (path === '/api/state') {
        if (lastX && lastX.indexOf('unknown') === 0) return resp(404, { error: 'jogador desconhecido' });
        if (hostKnown && !host) return resp(404, { error: 'jogador desconhecido' });   // a sala acabou
        return lastView ? resp(200, lastView) : resp(204, null);
      }
      if (path === '/api/draw') { db.push(inbox, { uid: db.uid, tipo: 'draw', corpo }); return resp(204, null); }
      if (path === '/api/action') { db.push(inbox, { uid: db.uid, tipo: 'action', corpo }); return resp(200, { ok: true }); }
      if (path === '/api/join') {
        const h = hostKnown ? host : await db.get('salas/' + code + '/host').catch(() => null);
        if (!h) {
          const wrong = code; code = (params.get('sala') || '') ? code : '';
          return resp(404, { error: 'Sala ' + wrong + ' não encontrada. Confira o código na TV.' });
        }
        const req = Math.random().toString(36).slice(2, 10);
        const answer = new Promise((res) => { waiters[req] = res; setTimeout(() => { if (waiters[req]) { delete waiters[req]; res(null); } }, 12000); });
        db.push(inbox, { uid: db.uid, tipo: 'join', corpo, req });
        const r = await answer;
        if (!r) return resp(504, { error: 'A TV não respondeu. O jogo está aberto na TV?' });
        lastX = null;
        return resp(r.status, r.body);
      }
      return resp(404, { error: 'desconhecido' });
    };
  }
})();
