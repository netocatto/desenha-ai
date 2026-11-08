// =============================================================
//  TELEFONE SEM FIO (estilo Gartic Phone) — regras do jogo
//  Cada jogador começa uma "corrente": escreve uma frase, o próximo desenha,
//  o seguinte descreve o desenho, e assim por diante. No fim, a TV mostra
//  cada corrente como uma conversa narrada.
// =============================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.DesenhaJogos = root.DesenhaJogos || {}; root.DesenhaJogos.telefone = factory(); }
})(this, function () {
  'use strict';

  // ---------------- semelhança entre frases (pontuação) ----------------
  const STOP = new Set('a o as os um uma uns umas de do da dos das e em no na nos nas com por para pra pro que se ao aos ou mas muito muita bem esta este isso esse essa ele ela eles elas eu voce sua seu meu minha the'.split(' '));
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function tokens(s) { return norm(s).split(' ').filter(w => w.length > 1 && !STOP.has(w)).map(w => w.length > 4 ? w.replace(/(oes|aes|es|s)$/, '') : w); }
  function lev(a, b) {
    const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  function tokSim(a, b) { if (a === b) return 1; const d = lev(a, b); const L = Math.max(a.length, b.length); return L >= 4 && d <= Math.floor(L / 4) ? 1 - d / L : 0; }
  function trigrams(s) { const t = '  ' + norm(s) + ' '; const g = new Map(); for (let i = 0; i < t.length - 2; i++) { const k = t.substr(i, 3); g.set(k, (g.get(k) || 0) + 1); } return g; }
  /** 0..1 — quão parecidas são duas frases */
  function similarity(a, b) {
    const A = tokens(a), B = tokens(b);
    if (!A.length || !B.length) return 0;
    let hit = 0;
    for (const x of A) { let best = 0; for (const y of B) best = Math.max(best, tokSim(x, y)); hit += best; }
    let hit2 = 0;
    for (const y of B) { let best = 0; for (const x of A) best = Math.max(best, tokSim(x, y)); hit2 += best; }
    const p = hit / A.length, r = hit2 / B.length;
    const f1 = p + r ? 2 * p * r / (p + r) : 0;
    const ga = trigrams(a), gb = trigrams(b); let inter = 0, ta = 0, tb = 0;
    ga.forEach((v, k) => { ta += v; if (gb.has(k)) inter += Math.min(v, gb.get(k)); }); gb.forEach(v => { tb += v; });
    const dice = ta + tb ? 2 * inter / (ta + tb) : 0;
    return Math.max(0, Math.min(1, 0.7 * f1 + 0.3 * dice));
  }

  const GRACE_MS = 2500;       // folga depois do fim do tempo (para chegar o último traço)
  const MAX_TEXT = 120;

  function create(ctx) {
    const S = ctx.settings;
    let round = 0;
    let part = [];             // participantes (ordem sorteada)
    let chains = [];           // chains[c] = { owner, items: [ {type, pid, text|strokes, sim?} ] }
    let step = 0, steps = 0;
    let sub = 'play';          // play | album | summary
    let endsAt = null, timer = null;
    let done = new Set();
    let drafts = new Map();    // pid -> texto em andamento
    let drawing = new Map();   // pid -> traços em andamento
    let album = { chain: 0, item: -1, auto: true };
    let albumTimer = null;
    let lastPoints = {};

    const typeOf = (k) => k === 0 ? 'write' : (k % 2 === 1 ? 'draw' : 'guess');
    const chainOf = (j, k) => ((j - k) % part.length + part.length) % part.length;   // corrente que o jogador j trabalha na etapa k
    const timeOf = (t) => (t === 'write' ? S.tfWrite : t === 'draw' ? S.tfDraw : S.tfGuess) * 1000;
    const clear = () => { if (timer) clearTimeout(timer); timer = null; if (albumTimer) clearTimeout(albumTimer); albumTimer = null; };

    function startRound() {
      round += 1;
      part = ctx.shuffle(ctx.connected());
      if (!part.length) part = ctx.order();
      chains = part.map(pid => ({ owner: pid, items: [] }));
      const n = part.length;
      steps = Math.max(1, Math.min(n, S.tfSteps || n));
      sub = 'play'; album = { chain: 0, item: -1, auto: album.auto };
      startStep(0);
    }
    function startStep(k) {
      clear();
      step = k; done = new Set(); drafts = new Map(); drawing = new Map();
      const ms = timeOf(typeOf(k));
      endsAt = Date.now() + ms;
      timer = setTimeout(closeStep, ms + GRACE_MS);
      // o desenho a descrever vai direto para cada jogador (não pesa no estado de todos)
      if (typeOf(k) === 'guess') part.forEach(pid => ctx.toPlayer(pid, 'tfTask', taskData(pid)));
      ctx.broadcastState();
    }
    function inputFor(pid) {
      const j = part.indexOf(pid); if (j < 0 || step === 0) return null;
      const c = chains[chainOf(j, step)];
      return c.items[step - 1] || null;
    }
    function taskData(pid) {
      const inp = inputFor(pid);
      return { round, step, type: typeOf(step), text: inp && inp.text != null ? inp.text : null, strokes: inp && inp.strokes ? inp.strokes : null };
    }
    function collect(pid) {
      const j = part.indexOf(pid);
      const t = typeOf(step);
      const item = { type: t, pid };
      if (t === 'draw') item.strokes = drawing.get(pid) || [];
      else item.text = (drafts.get(pid) || '').trim().slice(0, MAX_TEXT) || '…';
      chains[chainOf(j, step)].items[step] = item;
    }
    function closeStep() {
      clear();
      part.forEach(pid => { const j = part.indexOf(pid); if (!chains[chainOf(j, step)].items[step]) collect(pid); });
      if (step + 1 < steps) return startStep(step + 1);
      score();
      sub = 'album'; endsAt = null;
      album.chain = 0; album.item = -1;
      ctx.broadcastTV('tfAlbum', { chain: 0, owner: chains[0].owner, items: [] });
      ctx.broadcastState();
      scheduleAuto(1500);
    }
    function score() {
      lastPoints = {};
      const add = (pid, n) => { ctx.addScore(pid, n); lastPoints[pid] = (lastPoints[pid] || 0) + n; };
      chains.forEach(c => {
        c.items.forEach((it, k) => {
          if (it.type !== 'guess' || k < 2) return;
          const target = c.items[k - 2];
          const sim = target && target.text ? similarity(it.text, target.text) : 0;
          it.sim = Math.round(sim * 100);
          add(it.pid, it.sim);                                  // quem descreveu
          if (c.items[k - 1]) add(c.items[k - 1].pid, it.sim);  // quem desenhou
        });
        // bônus da corrente: a última frase ainda lembra a primeira?
        const last = c.items[c.items.length - 1];
        if (last && last.type === 'guess' && c.items.length > 2) {
          const s = Math.round(similarity(last.text, c.items[0].text) * 50);
          c.bonus = s; add(c.owner, s);
        }
      });
    }

    // ---------- álbum (apresentação na TV) ----------
    // tempo de cada mensagem do álbum: dá para a voz da TV terminar de ler frases longas
    function itemDelay(it) { return it.type === 'draw' ? 7000 : Math.min(12000, Math.max(4500, 2800 + 80 * String(it.text || '').length)); }
    function scheduleAuto(ms) {
      if (albumTimer) clearTimeout(albumTimer);
      albumTimer = null;
      if (!album.auto || sub !== 'album') return;
      albumTimer = setTimeout(() => { albumNext(); ctx.broadcastState(); }, ms);
    }
    function albumNext() {
      if (sub !== 'album') return;
      const c = chains[album.chain];
      if (album.item + 1 < c.items.length) {
        album.item += 1;
        const it = c.items[album.item];
        ctx.broadcastTV('tfItem', publicItem(it, true, album.chain, album.item));
        scheduleAuto(itemDelay(it));
      } else if (album.chain + 1 < chains.length) {
        album.chain += 1; album.item = -1;
        ctx.broadcastTV('tfAlbum', { chain: album.chain, owner: chains[album.chain].owner, items: [] });
        scheduleAuto(2500);
      } else {
        sub = 'summary';
        if (albumTimer) clearTimeout(albumTimer); albumTimer = null;
      }
    }
    function publicItem(it, withStrokes, chain, index) {
      const o = { type: it.type, pid: it.pid, name: ctx.nameOf(it.pid), index, chain };
      if (it.text != null) o.text = it.text;
      if (it.sim != null) o.sim = it.sim;
      if (withStrokes && it.strokes) o.strokes = it.strokes;
      return o;
    }
    function albumSnapshot() {
      const c = chains[album.chain];
      return { chain: album.chain, owner: c ? c.owner : null, bonus: c ? c.bonus : null,
        items: c ? c.items.slice(0, album.item + 1).map((it, i) => publicItem(it, true, album.chain, i)) : [] };
    }

    return {
      start() { round = 0; startRound(); },
      stop() { clear(); },
      onPresence() {
        // se quem falta saiu do jogo, não precisa esperar o tempo acabar
        if (sub !== 'play' || !done.size) return;
        const active = part.filter(p => { const pl = ctx.players.get(p); return pl && pl.conns > 0; });
        if (active.every(p => done.has(p))) { clear(); timer = setTimeout(closeStep, 600); }
      },
      onConnect(client) {
        if (client.role === 'tv' && sub !== 'play') ctx.broadcastTV('tfAlbum', albumSnapshot());
        if (client.role === 'player' && sub === 'play' && typeOf(step) === 'guess' && part.indexOf(client.pid) >= 0) ctx.toPlayer(client.pid, 'tfTask', taskData(client.pid));
      },
      fetch(pid, what) { return what === 'task' && sub === 'play' && part.indexOf(pid) >= 0 ? taskData(pid) : null; },
      draw(pid, ops) {
        if (sub !== 'play' || typeOf(step) !== 'draw' || part.indexOf(pid) < 0 || done.has(pid)) return;
        let st = drawing.get(pid); if (!st) { st = []; drawing.set(pid, st); }
        for (const op of ops) {
          if (op.o === 'b' && st.length < 400) st.push({ id: op.id, c: op.c, s: op.s, p: [op.x, op.y] });
          else if (op.o === 'p') { const s = st.find(s => s.id === op.id); if (s && s.p.length < 4000) Array.prototype.push.apply(s.p, op.pts); }
          else if (op.o === 'u') st.pop();
          else if (op.o === 'x') st.length = 0;
        }
      },
      action(pid, a) {
        const isMaster = pid === ctx.masterId();
        switch (a.type) {
          case 'tfDraft':                       // texto sendo digitado (salvo caso o tempo acabe)
            if (sub !== 'play' || typeOf(step) === 'draw' || done.has(pid)) return false;
            drafts.set(pid, String(a.text || '').slice(0, MAX_TEXT));
            return false;
          case 'tfSubmit': {
            if (sub !== 'play' || part.indexOf(pid) < 0 || done.has(pid)) return false;
            if (typeOf(step) !== 'draw') drafts.set(pid, String(a.text || '').slice(0, MAX_TEXT));
            collect(pid); done.add(pid);
            const active = part.filter(p => { const pl = ctx.players.get(p); return pl && pl.conns > 0; });
            if (active.every(p => done.has(p))) { clear(); timer = setTimeout(closeStep, 600); }
            return true;
          }
          case 'tfNext':                        // mestre avança o álbum
            if (!isMaster || sub !== 'album') return false;
            albumNext(); return true;
          case 'tfAuto':
            if (!isMaster) return false;
            album.auto = !!a.on; if (album.auto) scheduleAuto(800); else if (albumTimer) { clearTimeout(albumTimer); albumTimer = null; }
            return true;
          case 'tfSkipChain':
            if (!isMaster || sub !== 'album') return false;
            album.item = chains[album.chain].items.length - 1; albumNext(); return true;
          case 'tfSkipStep':
            if (!isMaster || sub !== 'play') return false;
            clear(); closeStep(); return false;
          case 'tfFinish':                      // fim da rodada: nova rodada ou placar final
            if (!isMaster || sub === 'play') return false;
            clear();
            if (round < S.tfRounds) { startRound(); return false; }
            ctx.finish(); return false;
          default: return false;
        }
      },
      view() {
        const t = typeOf(step);
        return {
          kind: 'tf', sub, round, rounds: S.tfRounds, step: step + 1, steps, type: t,
          remainingMs: endsAt ? Math.max(0, endsAt - Date.now()) : null,
          participants: part, done: Array.from(done),
          album: sub === 'play' ? null : { chain: album.chain + 1, chains: chains.length, item: album.item + 1,
            items: chains[album.chain] ? chains[album.chain].items.length : 0, auto: album.auto,
            owner: chains[album.chain] ? ctx.nameOf(chains[album.chain].owner) : null },
          points: sub === 'summary' ? lastPoints : null,
        };
      },
      playerView(pid) {
        const inp = sub === 'play' ? inputFor(pid) : null;
        return {
          playing: part.indexOf(pid) >= 0,
          done: done.has(pid),
          // o texto a desenhar é pequeno e vai no estado; o desenho a descrever chega pelo evento tfTask
          prompt: inp && inp.text != null ? inp.text : null,
          hasDrawing: !!(inp && inp.strokes),
        };
      },
    };
  }
  create.similarity = similarity;
  return create;
});
