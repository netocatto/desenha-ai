// =============================================================
//  TV — telas do Telefone sem fio e do Jogo das Bandeiras
//  (usa $, es, S, SFX, avatarHTML, esc, show, playerById do tv.js)
// =============================================================
window.TVJogos = (function () {
  'use strict';
  const fmt = (ms) => Math.max(0, Math.ceil(ms / 1000));
  let tfLocalEnd = null, bdLocalStart = null, bdReveal = 20000, bdFlag = null, bdImg = null, bdResult = null;

  // ------------------------------------------------------------ narração (voz do navegador)
  let voz = null;
  function pickVoice() {
    if (!window.speechSynthesis) return;
    const vs = speechSynthesis.getVoices();
    voz = vs.find(v => /pt[-_]BR/i.test(v.lang)) || vs.find(v => /^pt/i.test(v.lang)) || null;
  }
  if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function narrar(texto) {
    if (!window.speechSynthesis) return;
    try {
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'pt-BR'; if (voz) u.voice = voz; u.rate = 1.02; u.pitch = 1.05;
      speechSynthesis.speak(u);
    } catch (e) { /* sem voz neste aparelho */ }
  }

  // ------------------------------------------------------------ TELEFONE
  const TITLES = { write: '✍️ Todo mundo escrevendo uma frase…', draw: '🎨 Hora de desenhar!', guess: '🔎 O que será esse desenho?' };
  function renderTF(s, prev) {
    show('s-tf');
    const g = s.g;
    $('tfPlay').classList.toggle('on', g.sub === 'play');
    $('tfAlbum').classList.toggle('on', g.sub === 'album');
    $('tfSum').classList.toggle('on', g.sub === 'summary');
    if (g.sub === 'play') {
      tfLocalEnd = g.remainingMs != null ? performance.now() + g.remainingMs : null;
      $('tfStep').textContent = `Rodada ${g.round}/${g.rounds} · etapa ${g.step} de ${g.steps}`;
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
      if (!prev || !prev.g || prev.g.sub !== 'summary') SFX.right();
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
    const who = it.type === 'write' ? 'escreveu' : it.type === 'draw' ? 'desenhou' : 'achou que era';
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
    m.innerHTML = avatarHTML(it.pid, p.name);
    m.appendChild(b);
    chat.appendChild(m);
    // mantém só as últimas mensagens visíveis (estilo chat)
    while (chat.children.length > 4) chat.removeChild(chat.firstChild);
    if (animar) {
      if (it.type === 'write') narrar(`${p.name} escreveu: ${it.text}`);
      else if (it.type === 'draw') narrar(`${p.name} desenhou isso.`);
      else narrar(`${p.name} achou que era: ${it.text}`);
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
    if (!(d.items || []).length) { SFX.join(); const p = playerById(d.owner); if (p) narrar(`Corrente de ${p.name}`); }
  });
  es.addEventListener('tfItem', (e) => { const it = JSON.parse(e.data); if (it.chain !== chatChain) { $('chat').innerHTML = ''; chatChain = it.chain; } addBubble(it, true); });

  // ------------------------------------------------------------ BANDEIRAS
  const cvb = $('bdc'), gb = cvb.getContext('2d');
  let BW = 640, BH = 480;
  function bdResize() {
    const side = document.querySelector('.bdSide').getBoundingClientRect().width || window.innerWidth * 0.2;
    const maxW = window.innerWidth - side - window.innerWidth * 0.045, maxH = window.innerHeight * 0.95;
    BW = Math.floor(Math.min(maxW, maxH * 4 / 3)); BH = Math.round(BW * 3 / 4);
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
  function quadro(now) {
    if (!$('s-bd').classList.contains('on')) return requestAnimationFrame(quadro);
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
        const pts = Math.max(10, Math.round(100 - 50 * p - 15 * (S.g.dicas || []).length));
        $('bdPts').textContent = pts;
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
    bdFlag = f; bdResult = null; bdReveal = f.revealMs;
    bdLocalStart = performance.now() - f.elapsedMs;
    plano = montarPlano(f);
    bdImg = new Image();
    bdImg.src = window.FLAG_SVG && FLAG_SVG[f.code] ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(FLAG_SVG[f.code]) : 'flags/' + f.code + '.svg';
    window.__bd = f;   // (depuração)
    $('bdOverlay').classList.remove('on');
  });
  es.addEventListener('bdResult', (e) => {
    const r = JSON.parse(e.data); bdResult = r;
    $('bdOverlay').innerHTML = `<div class="nm">${esc(r.nome)}</div><div class="cap">Capital: ${esc(r.capital)}</div>` +
      (r.winner ? `<div class="win">${avatarHTML(r.winner, r.winnerName)} ${esc(r.winnerName)} acertou! <span style="color:var(--green)">+${r.points}</span></div>` : '<div class="win">😶 Ninguém acertou</div>');
    $('bdOverlay').classList.add('on');
    r.winner ? SFX.right() : SFX.timeup();
    narrar(r.winner ? `${r.nome}! ${r.winnerName} acertou.` : `Era ${r.nome}.`);
  });
  let toastT = null;
  function toast(t, cls) {
    const el = $('bdToast'); el.textContent = t; el.className = 'bdToast on' + (cls ? ' ' + cls : '');
    clearTimeout(toastT); toastT = setTimeout(() => { el.className = 'bdToast'; }, 2200);
  }
  es.addEventListener('bdWrong', (e) => { const d = JSON.parse(e.data); toast(`❌ ${d.name} chutou ${d.nome}`); SFX.wrong(); });
  es.addEventListener('bdHint', (e) => { const d = JSON.parse(e.data); toast(`💡 ${d.by} pediu uma dica`, 'hint'); SFX.hint(); });

  function renderBD(s, prev) {
    const first = !$('s-bd').classList.contains('on');
    show('s-bd'); if (first) bdResize();
    const g = s.g;
    $('bdIdx').textContent = `Bandeira ${g.idx} de ${g.total}`;
    const hs = $('bdHints');
    const n = (g.dicas || []).length;
    if (!n) hs.innerHTML = '<div class="none">Nenhuma ainda — cada dica vale −15 pontos</div>';
    else if (hs.children.length !== n || hs.querySelector('.none')) hs.innerHTML = g.dicas.map(d => `<div class="h">${esc(d)}</div>`).join('');
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
      if (s.gameId === 'bandeiras') return `${st.bdFlags} bandeiras · revelação em ${st.bdSpeed}s · ${st.bdAttempts ? st.bdAttempts + ' chute(s) por bandeira' : 'chutes sem limite'} · ${mus} · 🚩 ${window.PAISES ? PAISES.lista.length : 200} países`;
      return '';
    },
  };
})();
