// =============================================================
//  TV — telas do Telefone sem fio e do Jogo das Bandeiras
//  (usa $, es, S, SFX, avatarHTML, esc, show, playerById do tv.js)
// =============================================================
window.TVJogos = (function () {
  'use strict';
  const fmt = (ms) => Math.max(0, Math.ceil(ms / 1000));
  let tfLocalEnd = null, bdLocalStart = null, bdReveal = 20000, bdFlag = null, bdImg = null, bdResult = null;

  // ------------------------------------------------------------ narração (voz na TV)
  // Voz própria do jogo (eSpeak em português, num Web Worker) tocada pelo mesmo som da música:
  // funciona sozinha no PC, no app Android e no site — sem botão. Ela lê "do jeito dela" (é parte da graça).
  // Cada jogador ganha uma voz diferente (homem, mulher, rouca, robô, sussurro…).
  const VARIANTES = ['m1', 'f2', 'm3', 'f4', 'croak', 'm7', 'f1', 'klatt', 'm5', 'f5', 'm2', 'whisperf', 'm6', 'f3', 'klatt2', 'm4'];
  const NARRADOR = { variant: 'm3', pitch: 45, speed: 160, amplitude: 120 };
  let vozWorker = null, vozSeq = 0, vozGeracao = 0, vozFim = 0, vozFila = Promise.resolve(), vozFontes = [];
  const vozPend = {};
  function vozIniciar() {
    if (vozWorker || !window.Worker) return;
    try {
      vozWorker = new Worker('voz-worker.js?v=1');
      vozWorker.onmessage = (e) => { const f = vozPend[e.data.id]; delete vozPend[e.data.id]; if (f) f(e.data.wav); };
      vozWorker.onerror = () => { Object.keys(vozPend).forEach(k => { vozPend[k](null); delete vozPend[k]; }); };
    } catch (e) { vozWorker = null; }
  }
  function jeito(pid) {
    if (!pid) return NARRADOR;
    let h = 7; for (const ch of String(pid)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return { variant: VARIANTES[h % VARIANTES.length], pitch: 30 + ((h >> 5) % 50), speed: 150 + ((h >> 9) % 40), amplitude: 120 };
  }
  function gerar(texto, opts) {
    return new Promise((ok) => {
      vozIniciar(); if (!vozWorker) return ok(null);
      const id = ++vozSeq; vozPend[id] = ok;
      vozWorker.postMessage({ id, texto, opts: Object.assign({}, opts) });
      setTimeout(() => { if (vozPend[id]) { delete vozPend[id]; ok(null); } }, 15000);
    });
  }
  function narrar(texto, pid) {
    texto = String(texto || '').trim(); if (!texto) return;
    const ger = vozGeracao, opts = jeito(pid);
    const pronto = gerar(texto, opts);                       // gera já (em paralelo) e toca na ordem
    vozFila = vozFila.then(() => pronto).then((wav) => {
      if (!wav || ger !== vozGeracao || typeof actx === 'undefined' || !actx) return;
      if (actx.state === 'suspended') actx.resume();
      return new Promise((ok) => actx.decodeAudioData(wav, ok, () => ok(null))).then((buf) => {
        if (!buf || ger !== vozGeracao) return;
        const src = actx.createBufferSource(), g = actx.createGain();
        src.buffer = buf; g.gain.value = 1.6; src.connect(g).connect(actx.destination);
        const t = Math.max(actx.currentTime + 0.05, vozFim);
        src.start(t); vozFim = t + buf.duration + 0.18;
        vozFontes.push(src); src.onended = () => { vozFontes = vozFontes.filter(x => x !== src); if (!vozFontes.length && typeof Music !== 'undefined' && Music.duck) Music.duck(false); };
        if (typeof Music !== 'undefined' && Music.duck) Music.duck(true);
      });
    }).catch(() => {});
  }
  function calar() {
    vozGeracao++; vozFim = 0;
    vozFontes.forEach(s => { try { s.stop(); } catch (e) {} }); vozFontes = [];
    if (typeof Music !== 'undefined' && Music.duck) Music.duck(false);
  }

  // ------------------------------------------------------------ TELEFONE
  const TITLES = { write: '✍️ Todo mundo escrevendo uma frase…', draw: '🎨 Hora de desenhar!', guess: '🔎 O que será esse desenho?' };
  function renderTF(s, prev) {
    show('s-tf'); vozIniciar();
    const g = s.g;
    $('tfPlay').classList.toggle('on', g.sub === 'play');
    $('tfAlbum').classList.toggle('on', g.sub === 'album');
    $('tfSum').classList.toggle('on', g.sub === 'summary');
    if (g.sub === 'play') {
      tfLocalEnd = g.remainingMs != null ? performance.now() + g.remainingMs : null;
      $('tfStep').textContent = `Rodada ${g.round}/${g.rounds} · etapa ${g.etapa || g.step} de ${g.etapas || g.steps}`;
      $('tfTitle').textContent = TITLES[g.type];
      const grid = $('tfGrid'); grid.innerHTML = '';
      g.participants.forEach(pid => {
        const p = playerById(pid); if (!p) return;
        const d = document.createElement('div');
        d.className = 'p' + (g.done.indexOf(pid) >= 0 ? ' ok' : '') + (p.connected ? '' : ' off');
        d.innerHTML = avatarHTML(pid, p.name) + '<span class="ck">✔</span><span>' + esc(p.name) + '</span>';
        grid.appendChild(d);
      });
      if (prev && prev.g && prev.g.done && g.done.length > prev.g.done.length) SFX.join();
    }
    if (g.sub === 'summary') {
      const rows = Object.entries(g.points || {}).sort((a, b) => b[1] - a[1]).map(([pid, pts]) => {
        const p = playerById(pid); return p ? `<div class="row">${avatarHTML(pid, p.name)} ${esc(p.name)} <b>+${pts}</b></div>` : '';
      }).join('');
      const last = g.round >= g.rounds;
      $('tfSum').innerHTML = `<h2>📞 Fim da rodada ${g.round}!</h2><div class="muted" style="font-size:3vh;font-weight:700">Pontos por descrições parecidas com o que foi desenhado</div>
        <div class="rows">${rows || '<div class="muted">Ninguém pontuou nesta rodada</div>'}</div>
        <div class="muted" style="font-size:2.6vh;font-weight:700">👑 O mestre ${last ? 'mostra o placar final' : 'começa a próxima rodada'} pelo celular</div>`;
      if (!prev || !prev.g || prev.g.sub !== 'summary') {
        SFX.right();
        const top = Object.entries(g.points || {}).sort((a, b) => b[1] - a[1])[0], tp = top && top[1] > 0 && playerById(top[0]);
        narrar(`Fim da rodada ${g.round}!` + (tp ? ` Quem mais pontuou foi ${tp.name}, com ${top[1]} pontos.` : ''));
      }
    }
    if (g.sub === 'album') {
      $('tfHead').innerHTML = `📒 Corrente de ${esc(g.album.owner || '')}<small>${g.album.chain}/${g.album.chains}</small>`;
    }
  }
  // álbum: a TV recebe os itens um a um
  let chatChain = -1;
  function addBubble(it, animar) {
    const chat = $('chat');
    const p = playerById(it.pid) || { name: it.name };
    const m = document.createElement('div');
    m.className = 'msg' + (it.index % 2 ? ' r' : '');
    const who = it.sistema ? 'sorteou' : it.type === 'write' ? 'escreveu' : it.type === 'draw' ? 'desenhou' : 'achou que era';
    const b = document.createElement('div'); b.className = 'bubble ' + it.type;
    b.innerHTML = `<div class="who">${esc(p.name || it.name)} ${who}</div>`;
    if (it.type === 'draw') {
      const c = document.createElement('canvas');
      const w = Math.round(window.innerHeight * 0.42), h = Math.round(w * 3 / 4), dpr = window.devicePixelRatio || 1;
      c.style.width = w + 'px'; c.style.height = h + 'px'; c.width = w * dpr; c.height = h * dpr;
      b.appendChild(c);
      desenhar(c, it.strokes || [], w, h, dpr, animar ? 3200 : 0);
    } else {
      const t = document.createElement('div'); t.className = 'txt'; t.textContent = it.text || '…'; b.appendChild(t);
      if (it.type === 'guess' && it.sim != null) { const sm = document.createElement('div'); sm.className = 'sim'; sm.textContent = `🎯 ${it.sim}% parecido`; b.appendChild(sm); }
    }
    m.innerHTML = it.sistema ? '<div class="av" style="background:#ffd23f;display:grid;place-items:center">🎲</div>' : avatarHTML(it.pid, p.name);
    m.appendChild(b);
    chat.appendChild(m);
    // mantém só as últimas mensagens visíveis (estilo chat)
    while (chat.children.length > 4) chat.removeChild(chat.firstChild);
    if (animar) {
      const nome = p.name || it.name;
      if (it.sistema) { narrar('O jogo sorteou:'); narrar(it.text); }
      else if (it.type === 'write') { narrar(`${nome} escreveu:`); narrar(it.text, it.pid); }
      else if (it.type === 'draw') narrar(`E ${nome} desenhou isso!`);
      else { narrar(`${nome} achou que era:`); narrar(it.text, it.pid); }
    }
  }
  function desenhar(c, strokes, w, h, dpr, dur) {
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const total = strokes.reduce((a, s) => a + Math.max(1, s.p.length / 2), 0) || 1;
    const t0 = performance.now();
    function frame(now) {
      const lim = dur ? Math.min(total, total * (now - t0) / dur) : total;
      g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
      let used = 0;
      for (const s of strokes) {
        const n = Math.max(1, s.p.length / 2);
        if (used >= lim) break;
        const k = Math.min(n, Math.ceil(lim - used));
        g.strokeStyle = s.c; g.fillStyle = s.c; g.lineWidth = s.s * w; g.lineCap = 'round'; g.lineJoin = 'round';
        if (n === 1) { g.beginPath(); g.arc(s.p[0] * w, s.p[1] * h, s.s * w / 2, 0, Math.PI * 2); g.fill(); }
        else { g.beginPath(); g.moveTo(s.p[0] * w, s.p[1] * h); for (let i = 1; i < k; i++) g.lineTo(s.p[i * 2] * w, s.p[i * 2 + 1] * h); g.stroke(); }
        used += n;
      }
      if (lim < total) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  es.addEventListener('tfAlbum', (e) => {
    const d = JSON.parse(e.data);
    $('chat').innerHTML = ''; chatChain = d.chain;
    (d.items || []).forEach(it => addBubble(it, false));
    if (!(d.items || []).length) { SFX.join(); calar(); const p = playerById(d.owner); if (p) narrar(`Agora, a corrente de ${p.name}!`); }
  });
  es.addEventListener('tfItem', (e) => { const it = JSON.parse(e.data); if (it.chain !== chatChain) { $('chat').innerHTML = ''; chatChain = it.chain; } addBubble(it, true); });

  // ------------------------------------------------------------ BANDEIRAS
  const cvb = $('bdc'), gb = cvb.getContext('2d');
  let BW = 640, BH = 480;
  let bdLargo = false;   // resultado do modo mapa usa toda a área (não só 4:3)
  function bdResize() {
    const side = document.querySelector('.bdSide').getBoundingClientRect().width || window.innerWidth * 0.16;
    const maxW = window.innerWidth - side - window.innerWidth * 0.03, maxH = window.innerHeight * 0.965;
    if (bdLargo) { BW = Math.floor(maxW); BH = Math.floor(maxH); }
    else { BW = Math.floor(Math.min(maxW, maxH * 4 / 3)); BH = Math.round(BW * 3 / 4); }
    const dpr = window.devicePixelRatio || 1;
    cvb.style.width = BW + 'px'; cvb.style.height = BH + 'px'; cvb.width = Math.round(BW * dpr); cvb.height = Math.round(BH * dpr);
    gb.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', () => { if ($('s-bd').classList.contains('on')) bdResize(); });

  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  let plano = null;     // parâmetros sorteados da revelação desta bandeira
  function montarPlano(f) {
    const r = rng(f.seed);
    const pontos = [[0, 0], [1, 0], [0, 1], [1, 1], [.5, 0], [0, .5], [1, .5], [.5, 1], [.5, .5]];
    const o = pontos[Math.floor(r() * pontos.length)];
    const pl = { estilo: f.estilo, o, dir: Math.floor(r() * 4), canto: Math.floor(r() * 4), horiz: r() < 0.5,
      cx: 0.2 + r() * 0.6, cy: 0.2 + r() * 0.6, ang: r() * Math.PI * 2, furos: [], ordem: [] };
    for (let i = 0; i < 7; i++) pl.furos.push([0.08 + r() * 0.84, 0.08 + r() * 0.84]);
    const n = 12 * 9; pl.ordem = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pl.ordem[i], pl.ordem[j]] = [pl.ordem[j], pl.ordem[i]]; }
    return pl;
  }
  function clipPara(p) {
    const W = BW, H = BH, pl = plano, g = gb;
    const maxD = (x, y) => Math.max(Math.hypot(x, y), Math.hypot(W - x, y), Math.hypot(x, H - y), Math.hypot(W - x, H - y));
    g.beginPath();
    switch (pl.estilo) {
      case 'circulo': { const x = pl.o[0] * W, y = pl.o[1] * H; g.arc(x, y, Math.max(1, p * maxD(x, y)), 0, Math.PI * 2); break; }
      case 'cortina': {
        if (pl.dir === 0) g.rect(0, 0, W * p, H); else if (pl.dir === 1) g.rect(W * (1 - p), 0, W * p, H);
        else if (pl.dir === 2) g.rect(0, 0, W, H * p); else g.rect(0, H * (1 - p), W, H * p); break;
      }
      case 'diagonal': {
        const d = 2 * p; const c = pl.canto;      // triângulo crescendo a partir de um canto
        const pts = [[0, 0], [d * W, 0], [0, d * H]].map(([x, y]) => [c & 1 ? W - x : x, c & 2 ? H - y : y]);
        g.moveTo(pts[0][0], pts[0][1]); g.lineTo(pts[1][0], pts[1][1]); g.lineTo(pts[2][0], pts[2][1]); g.closePath(); break;
      }
      case 'persiana': {
        const n = 8;
        for (let i = 0; i < n; i++) { if (pl.horiz) g.rect(0, i * H / n, W, H / n * p); else g.rect(i * W / n, 0, W / n * p, H); }
        break;
      }
      case 'mosaico': {
        const cols = 12, rows = 9, k = Math.floor(p * cols * rows);
        for (let i = 0; i < k; i++) { const c = pl.ordem[i]; g.rect((c % cols) * W / cols, Math.floor(c / cols) * H / rows, W / cols + 0.5, H / rows + 0.5); }
        break;
      }
      case 'relogio': { const x = pl.cx * W, y = pl.cy * H; g.moveTo(x, y); g.arc(x, y, maxD(x, y), pl.ang, pl.ang + p * Math.PI * 2); g.closePath(); break; }
      case 'losango': {
        const x = pl.cx * W, y = pl.cy * H, r = p * maxD(x, y) * 1.45;
        g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); break;
      }
      case 'furos': { const r = p * W * 0.42; pl.furos.forEach(([a, b]) => { g.moveTo(a * W + r, b * H); g.arc(a * W, b * H, Math.max(1, r), 0, Math.PI * 2); }); break; }
      case 'estrela': {
        const x = pl.cx * W, y = pl.cy * H, R = p * maxD(x, y) * 1.9, r2 = R * 0.45;
        for (let i = 0; i < 10; i++) { const a = pl.ang + i * Math.PI / 5, rr = i % 2 ? r2 : R; const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i ? g.lineTo(px, py) : g.moveTo(px, py); }
        g.closePath(); break;
      }
      default: g.rect(0, 0, W, H);
    }
    g.clip();
  }
  function fundo() {
    gb.fillStyle = '#2f2470'; gb.fillRect(0, 0, BW, BH);
    gb.fillStyle = 'rgba(255,255,255,.05)';
    for (let x = 0; x < BW; x += BW / 16) for (let y = 0; y < BH; y += BH / 12) if (((x / (BW / 16)) + (y / (BH / 12))) % 2 < 1) gb.fillRect(x, y, BW / 16, BH / 12);
    gb.fillStyle = 'rgba(255,255,255,.18)'; gb.font = `800 ${BH * 0.4}px 'Baloo 2', sans-serif`; gb.textAlign = 'center'; gb.textBaseline = 'middle';
    gb.fillText('?', BW / 2, BH / 2);
  }
  let bdMapRes = null, bdMapAnim = null;   // modo mapa: resultado desenhado no lugar da bandeira
  function prepararMapaResultado(r) {
    const pc = MAPA.porCodigo[r.code];
    // foco no país certo: enquadra o país (com folga) e só os palpites que estão por perto
    let box = pc ? pc.bbox.slice() : [-170, -58, 190, 84];
    const cxp = (box[0] + box[2]) / 2;
    const ps = (r.palpites || []).map(p => {
      const lon = p.lon + 360 * Math.round((cxp - p.lon) / 360);             // lado do mundo mais perto do país
      const alvo = MAPA.maisProximo(p.lon, p.lat, r.code) || [cxp, p.lat];
      const alon = alvo[0] + 360 * Math.round((lon - alvo[0]) / 360);
      return Object.assign({}, p, { lonW: lon, alvo: [alon, alvo[1]] });
    });
    ps.forEach(p => { if (p.dist <= 2500) { box[0] = Math.min(box[0], p.lonW); box[2] = Math.max(box[2], p.lonW); box[1] = Math.min(box[1], p.lat); box[3] = Math.max(box[3], p.lat); } });
    const mw = Math.max(0, 22 - (box[2] - box[0])) / 2, mh = Math.max(0, 14 - (box[3] - box[1])) / 2;
    box = [box[0] - mw, box[1] - mh, box[2] + mw, box[3] + mh];
    const fim = MAPA.encaixar(BW, BH * 0.74, box, 0.1);       // deixa a parte de baixo livre para o placar
    fim.cy += BH * 0.13 / fim.s;
    const m = MAPA.mundo(BW, BH); if (fim.s < m.s) { fim.s = m.s; fim.cx = m.cx; fim.cy = m.cy; }
    bdMapAnim = { t0: performance.now() + 700, ini: m, fim, ps };
  }
  const corPino = (pid) => { const c = avColor(pid); return /^#(3ee08f|2ec27e|4ade80|22c55e|3ddc84)$/i.test(c) ? '#e879f9' : c; };   // verde é a cor do país certo
  function desenharMapaResultado(now) {
    const A = bdMapAnim, r = bdMapRes; if (!A) return true;
    const t = Math.max(0, Math.min(1, (now - A.t0) / 1800)), e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const v = { s: A.ini.s * Math.pow(A.fim.s / A.ini.s, e), cx: A.ini.cx + (A.fim.cx - A.ini.cx) * e, cy: A.ini.cy + (A.fim.cy - A.ini.cy) * e };
    const raio = Math.max(10, BH / 40);
    const pinos = t < 1 ? [] : A.ps.map(p => ({ lon: p.lonW, lat: p.lat, cor: corPino(p.pid), rotulo: p.name, raio }));
    const linhas = t < 1 ? [] : A.ps.filter(p => p.dist > 0).map(p => ({ lon: p.lonW, lat: p.lat, lon2: p.alvo[0], lat2: p.alvo[1], cor: corPino(p.pid) }));
    gb.save(); MAPA.desenhar(gb, BW, BH, v, { certo: r.code, foco: true, pinos, linhas }); gb.restore();
    if (t >= 1) {
      // palpites fora da tela: etiqueta na borda, na direção do palpite
      const M = 14, x0 = M, y0 = M, x1 = BW - M, y1 = BH * 0.74;       // acima do placar de baixo
      A.ps.forEach(p => {
        const [px, py] = MAPA.geoParaTela(v, BW, BH, p.lonW, p.lat), [ax, ay] = MAPA.geoParaTela(v, BW, BH, p.alvo[0], p.alvo[1]);
        if (px >= x0 && px <= x1 && py >= y0 && py <= y1) return;
        let k = 1; const dx = px - ax, dy = py - ay;
        if (dx) k = Math.min(k, dx > 0 ? (x1 - ax) / dx : (x0 - ax) / dx);
        if (dy) k = Math.min(k, dy > 0 ? (y1 - ay) / dy : (y0 - ay) / dy);
        const ex = ax + dx * k, ey = ay + dy * k;
        const txt = `${p.name} · ${p.dist.toLocaleString('pt-BR')} km`;
        gb.save(); gb.font = `800 ${Math.round(BH / 34)}px 'Baloo 2', system-ui, sans-serif`;
        const tw = gb.measureText(txt).width + 18, th = BH / 22;
        const bx = Math.max(4, Math.min(BW - tw - 4, ex - tw / 2)), by = Math.max(4, Math.min(y1 - th, ey - th / 2));
        gb.fillStyle = corPino(p.pid); gb.strokeStyle = '#1b1440'; gb.lineWidth = 3;
        gb.beginPath(); gb.roundRect ? gb.roundRect(bx, by, tw, th, th / 2) : gb.rect(bx, by, tw, th); gb.fill(); gb.stroke();
        gb.fillStyle = '#1b1440'; gb.textAlign = 'center'; gb.textBaseline = 'middle'; gb.fillText(txt, bx + tw / 2, by + th / 2 + 1);
        gb.restore();
      });
    }
    return t >= 1;
  }
  function quadro(now) {
    if (!$('s-bd').classList.contains('on')) return requestAnimationFrame(quadro);
    if (bdMapRes) { if (bdMapAnim && !bdMapAnim.feito) bdMapAnim.feito = desenharMapaResultado(now); return requestAnimationFrame(quadro); }
    fundo();
    if (bdImg && bdImg.complete && bdImg.naturalWidth && plano && bdLocalStart != null) {
      const p = bdResult ? 1 : Math.max(0, Math.min(1, (now - bdLocalStart) / bdReveal));
      gb.save();
      if (plano.estilo === 'zoom' && p < 1) {
        // começa muito ampliado num ponto da bandeira e vai se afastando
        const z = Math.pow(9, 1 - p), x = plano.cx * BW, y = plano.cy * BH;
        if (p > 0) { gb.translate(x, y); gb.scale(z, z); gb.translate(-x, -y); gb.drawImage(bdImg, 0, 0, BW, BH); }
      } else if (p > 0) { if (p < 1) clipPara(p); gb.drawImage(bdImg, 0, 0, BW, BH); }
      gb.restore();
      // pontos e barra caindo junto com a revelação
      if (S && S.g && S.g.kind === 'bd' && !bdResult) {
        if (S.g.mode !== 'mapa') { const pts = Math.max(10, Math.round(100 - 50 * p)); $('bdPts').textContent = pts; }
        $('bdBarFill').style.width = (p * 100).toFixed(1) + '%';
      }
      $('bdWait').classList.toggle('on', now < bdLocalStart);
      if (now < bdLocalStart) $('bdWait').innerHTML = `🚩<br>Bandeira ${bdFlag ? bdFlag.idx + 1 : ''}<br><span style="font-size:4vh">${Math.ceil((bdLocalStart - now) / 1000)}…</span>`;
    }
    requestAnimationFrame(quadro);
  }
  requestAnimationFrame(quadro);

  es.addEventListener('bdFlag', (e) => {
    const f = JSON.parse(e.data); if (!f) return;
    bdFlag = f; bdResult = null; bdMapRes = null; bdMapAnim = null; bdReveal = f.revealMs;
    if (bdLargo) { bdLargo = false; bdResize(); }
    bdLocalStart = performance.now() - f.elapsedMs;
    plano = montarPlano(f);
    bdImg = new Image();
    bdImg.src = window.FLAG_SVG && FLAG_SVG[f.code] ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(FLAG_SVG[f.code]) : 'flags/' + f.code + '.svg';
    window.__bd = f;   // (depuração)
    $('bdOverlay').classList.remove('on');
  });
  es.addEventListener('bdResult', (e) => {
    const r = JSON.parse(e.data); bdResult = r;
    if (r.modo === 'mapa' && window.MAPA) {
      bdMapRes = r; bdLargo = true; bdResize(); prepararMapaResultado(r);
      const med = ['🥇', '🥈', '🥉'];
      const linhas = (r.palpites || []).slice(0, 4).map((p, i) => `<div class="win" >${med[i] || (i + 1) + 'º'} ${avatarHTML(p.pid, p.name)} ${esc(p.name)} — ${p.dist === 0 ? 'no país!' : p.dist.toLocaleString('pt-BR') + ' km'} <span style="color:var(--green)">+${p.points}</span></div>`).join('');
      $('bdOverlay').innerHTML = `<div class="nm" style="font-size:6vh">${esc(r.nome)}</div>` + (linhas || '<div class="win">😶 Ninguém palpitou</div>');
      $('bdOverlay').classList.add('on', 'mapa');
      (r.palpites || []).length && r.palpites[0].points ? SFX.right() : SFX.timeup();
      return;
    }
    $('bdOverlay').classList.remove('mapa');
    $('bdOverlay').innerHTML = `<div class="nm">${esc(r.nome)}</div><div class="cap">Capital: ${esc(r.capital)}</div>` +
      (r.winner ? `<div class="win">${avatarHTML(r.winner, r.winnerName)} ${esc(r.winnerName)} acertou! <span style="color:var(--green)">+${r.points}</span></div>` : '<div class="win">😶 Ninguém acertou</div>');
    $('bdOverlay').classList.add('on');
    r.winner ? SFX.right() : SFX.timeup();
  });
  let toastT = null;
  function toast(t, cls) {
    const el = $('bdToast'); el.textContent = t; el.className = 'bdToast on' + (cls ? ' ' + cls : '');
    clearTimeout(toastT); toastT = setTimeout(() => { el.className = 'bdToast'; }, 2200);
  }
  es.addEventListener('bdWrong', (e) => { const d = JSON.parse(e.data); toast(`❌ ${d.name} chutou ${d.nome}`); SFX.wrong(); });
  es.addEventListener('bdPinned', (e) => { const d = JSON.parse(e.data); toast(`📍 ${d.name} palpitou`, 'hint'); SFX.join(); });
  es.addEventListener('bdHint', (e) => { const d = JSON.parse(e.data); toast(`💡 ${d.by} pediu uma dica (−15 só para quem pediu)`, 'hint'); SFX.hint(); });

  function renderBD(s, prev) {
    const first = !$('s-bd').classList.contains('on');
    show('s-bd'); if (first) bdResize();
    const g = s.g;
    $('bdIdx').textContent = `Bandeira ${g.idx} de ${g.total}`;
    const sc = $('bdScores'); sc.innerHTML = '';
    sc.classList.toggle('many', s.players.length > 8);
    const ord = [...s.players].sort((a, b) => b.score - a.score);
    ord.slice(0, 12).forEach(p => {
      const d = document.createElement('div');
      const err = g.erros && g.erros[p.pid] ? `<span class="tries">${'✖'.repeat(g.erros[p.pid])}</span>` : '';
      d.innerHTML = `<span>${avatarHTML(p.pid, p.name)} ${esc(p.name)}${err}</span><span>${p.score}</span>`; sc.appendChild(d);
    });
    if (ord.length > 12) { const d = document.createElement('div'); d.innerHTML = `<span class="muted">+ ${ord.length - 12} jogadores</span><span></span>`; sc.appendChild(d); }
    if (g.sub === 'result') { $('bdPts').textContent = g.resultado && g.resultado.points ? '+' + g.resultado.points : '0'; }
    if (g.mode === 'mapa' && g.sub === 'play') { $('bdPts').textContent = `📍 ${g.palpitaram}/${g.jogadores}`; }
  }

  // ------------------------------------------------------------ cronômetro do telefone
  setInterval(() => {
    if (!S || S.phase !== 'play' || !S.g || S.g.kind !== 'tf' || S.g.sub !== 'play' || tfLocalEnd == null) return;
    const sec = fmt(tfLocalEnd - performance.now());
    const t = $('tfTimer'); t.textContent = sec; t.classList.toggle('low', sec <= 10);
  }, 250);

  return {
    render(s, prev) { if (s.g && s.g.kind === 'tf') renderTF(s, prev); else if (s.g && s.g.kind === 'bd') renderBD(s, prev); },
    musicMode(s) {
      if (!s.g) return null;
      if (s.g.kind === 'tf') return s.g.sub === 'play' ? 'draw' : s.g.sub === 'album' ? 'lobby' : null;
      if (s.g.kind === 'bd') return s.g.sub === 'play' ? 'draw' : null;
      return null;
    },
    urgency(s) {
      if (!s.g) return 0;
      if (s.g.kind === 'tf') {
        if (s.g.sub !== 'play' || tfLocalEnd == null) return 0.2;
        const tot = (s.g.type === 'write' ? s.settings.tfWrite : s.g.type === 'draw' ? s.settings.tfDraw : s.settings.tfGuess) * 1000;
        return 1 - Math.max(0, tfLocalEnd - performance.now()) / tot;
      }
      if (s.g.kind === 'bd' && bdLocalStart != null) return Math.max(0, Math.min(1, (performance.now() - bdLocalStart) / bdReveal));
      return 0;
    },
    lobbyText(s) {
      const st = s.settings;
      const mus = st.music === false ? '🔇 sem música' : '🎵 com música';
      if (s.gameId === 'telefone') return `Escrever ${st.tfWrite}s · desenhar ${st.tfDraw}s · descrever ${st.tfGuess}s · ${st.tfSteps ? st.tfSteps + ' etapas' : 'todos passam por todas as correntes'} · ${st.tfRounds} rodada(s) · ${mus}`;
      if (s.gameId === 'bandeiras') return `${st.bdMode === 'mapa' ? '🗺️ marcar no mapa (difícil) · 1 palpite' : '✍️ digitar o nome · ' + (st.bdAttempts ? st.bdAttempts + ' chute(s) por bandeira' : 'chutes sem limite')} · ${st.bdFlags} bandeiras · revelação em ${st.bdSpeed}s · ${mus} · 🚩 ${window.PAISES ? PAISES.lista.length : 200} países`;
      return '';
    },
  };
})();
