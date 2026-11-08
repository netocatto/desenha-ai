// =============================================================
//  CELULAR — escolha do jogo, Telefone sem fio e Jogo das Bandeiras
//  (usa $, S, pid, api, show, optGroup, esc, strokes, queue, redraw, resizePad, flush do celular.js)
// =============================================================
window.CelJogos = (function () {
  'use strict';
  const GAMES = [
    ['desenha', '🎨', 'Desenha Aí!', 'Um desenha, os outros adivinham'],
    ['telefone', '📞', 'Telefone sem fio', 'Escreve → desenha → descreve… e ri no final'],
    ['bandeiras', '🚩', 'Jogo das Bandeiras', 'Adivinhe o país pela bandeira'],
  ];
  const sec = (ms) => Math.max(0, Math.ceil(ms / 1000));

  // ------------------------------------------------------------ sala (mestre)
  let built = false;
  function buildOpts() {
    if (built) return; built = true;
    $('tfOpts').innerHTML = `
      <div class="lbl">Tempo para escrever</div><div class="opt" id="oTfW"></div>
      <div class="lbl">Tempo para desenhar</div><div class="opt" id="oTfD"></div>
      <div class="lbl">Tempo para descrever o desenho</div><div class="opt" id="oTfG"></div>
      <div class="lbl">Etapas por corrente</div><div class="opt" id="oTfS"></div>
      <div class="lbl">Rodadas</div><div class="opt" id="oTfR"></div>`;
    $('bdOpts').innerHTML = `
      <div class="lbl">Como responder</div><div class="opt" id="oBdM"></div>
      <div class="lbl">Bandeiras por partida</div><div class="opt" id="oBdN"></div>
      <div class="lbl">Velocidade da revelação</div><div class="opt" id="oBdV"></div>
      <div id="oBdAwrap"><div class="lbl">Chutes por pessoa em cada bandeira</div><div class="opt" id="oBdA"></div></div>`;
  }
  function lobby(s, set) {
    buildOpts();
    const st = s.settings;
    const gp = $('optGame'); gp.innerHTML = '';
    GAMES.forEach(([id, ico, nome, desc]) => {
      const b = document.createElement('button');
      if (s.gameId === id) b.className = 'sel';
      b.innerHTML = `<span class="ico">${ico}</span><span>${nome}<small>${desc}</small></span>`;
      b.onclick = () => set({ gameId: id });
      gp.appendChild(b);
    });
    $('dsOpts').hidden = s.gameId !== 'desenha';
    $('tfOpts').hidden = s.gameId !== 'telefone';
    $('bdOpts').hidden = s.gameId !== 'bandeiras';
    optGroup($('oTfW'), [[20, '20s'], [30, '30s'], [45, '45s'], [60, '1 min'], [90, '1,5 min']], st.tfWrite, v => set({ tfWrite: v }));
    optGroup($('oTfD'), [[45, '45s'], [60, '1 min'], [90, '1,5 min'], [120, '2 min'], [180, '3 min']], st.tfDraw, v => set({ tfDraw: v }));
    optGroup($('oTfG'), [[20, '20s'], [30, '30s'], [45, '45s'], [60, '1 min']], st.tfGuess, v => set({ tfGuess: v }));
    optGroup($('oTfS'), [[0, 'Todas'], [3, '3'], [5, '5'], [7, '7'], [9, '9']], st.tfSteps, v => set({ tfSteps: v }));
    optGroup($('oTfR'), [1, 2, 3], st.tfRounds, v => set({ tfRounds: v }));
    optGroup($('oBdM'), [['texto', '✍️ Digitar o nome'], ['mapa', '🗺️ Marcar no mapa (difícil)']], st.bdMode || 'texto', v => set({ bdMode: v }));
    $('oBdAwrap').hidden = st.bdMode === 'mapa';                      // no mapa é sempre 1 palpite
    optGroup($('oBdN'), [5, 10, 15, 20, 30], st.bdFlags, v => set({ bdFlags: v }));
    optGroup($('oBdV'), [[8, '⚡ Rápida'], [15, 'Média'], [25, 'Lenta'], [40, '🐢 Bem lenta']], st.bdSpeed, v => set({ bdSpeed: v }));
    optGroup($('oBdA'), [[1, '1'], [2, '2'], [3, '3'], [0, 'Sem limite']], st.bdAttempts, v => set({ bdAttempts: v }));
    const n = s.players.length, g = GAMES.find(x => x[0] === s.gameId);
    $('startBtn').textContent = (n === 1 ? '▶ Iniciar teste solo · ' : `▶ Iniciar (${n}) · `) + g[2];
  }

  // ------------------------------------------------------------ helpers
  async function apiData(type, extra) {
    try {
      const r = await fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ pid, type }, extra || {})) });
      const j = await r.json(); return j && j.data;
    } catch (e) { return null; }
  }
  function drawStrokes(c, strokes) {
    const w = c.clientWidth, h = c.clientHeight, dpr = window.devicePixelRatio || 1;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    for (const s of strokes || []) {
      const p = s.p; g.strokeStyle = s.c; g.fillStyle = s.c; g.lineWidth = s.s * w; g.lineCap = 'round'; g.lineJoin = 'round';
      if (p.length <= 2) { g.beginPath(); g.arc(p[0] * w, p[1] * h, s.s * w / 2, 0, Math.PI * 2); g.fill(); continue; }
      g.beginPath(); g.moveTo(p[0] * w, p[1] * h); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i] * w, p[i + 1] * h); g.stroke();
    }
  }

  // ------------------------------------------------------------ TELEFONE
  let tfKey = null, tfTask = null, tfLocalEnd = null, tfSent = false, draftT = null, tfTaskWait = null;
  const LABEL = { write: '✍️ Escreva uma frase', draw: '🎨 Desenhe!', guess: '🔎 O que é este desenho?' };
  function submitText() {
    if (tfSent) return; tfSent = true;
    const ta = $('tfText'); const text = ta ? ta.value.trim() : '';
    api('tfSubmit', { text });
  }
  async function submitDraw() {
    if (tfSent) return; tfSent = true;
    // espera os últimos traços chegarem ao servidor antes de dizer "pronto"
    for (let i = 0; i < 25 && (queue.length || sending); i++) { try { await flush(); } catch (e) { } await new Promise(r => setTimeout(r, 100)); }
    api('tfSubmit', {});
  }
  $('tfDoneBtn').onclick = () => { if (S && S.phase === 'play') submitDraw(); };

  function renderTF(s, prev) {
    const g = s.g, gp = s.gp || {};
    if (g.sub === 'play') {
      tfLocalEnd = g.remainingMs != null ? performance.now() + g.remainingMs : null;
      const key = g.round + '|' + g.step;
      if (key !== tfKey) { tfKey = key; tfSent = false; if (g.type === 'draw') { strokes = []; queue = []; } }
      if (!gp.playing) return wait('⏳ Você entra na próxima rodada', 'Enquanto isso, olhe a TV 📺');
      if (gp.done || tfSent && g.type !== 'draw') return wait('✔ Enviado!', `Aguardando os outros: ${g.done.length}/${g.participants.length}`, true);
      if (g.type === 'draw') {
        if (tfSent) return wait('✔ Desenho enviado!', `Aguardando os outros: ${g.done.length}/${g.participants.length}`, true);
        const fresh = current !== 's-draw';
        show('s-draw');
        $('miniWord').innerHTML = `🎨 ${esc(gp.prompt || '…')}<small>Desenhe isso · etapa ${g.step}/${g.steps}</small>`;
        if (fresh) requestAnimationFrame(resizePad);
        return;
      }
      show('s-tf');
      $('tfLabel').innerHTML = `${LABEL[g.type]}<small>Rodada ${g.round}/${g.rounds} · etapa ${g.step}/${g.steps}</small>`;
      const bodyKey = 'in|' + key;
      if ($('tfBody').dataset.key !== bodyKey) {
        $('tfBody').dataset.key = bodyKey;
        const pergunta = g.type === 'write'
          ? '<div class="tfBig">Invente uma frase divertida para alguém desenhar</div><p class="muted center" style="margin:0">Ex.: "Um gato pilotando um foguete"</p>'
          : '<canvas class="tfView" id="tfCv"></canvas><div class="tfBig" style="font-size:20px">Descreva o desenho numa frase</div>';
        $('tfBody').innerHTML = `${pergunta}<textarea class="tfIn" id="tfText" maxlength="120" placeholder="Digite aqui…"></textarea>
          <button class="btn green" id="tfOk">✔ Pronto</button>`;
        $('tfText').addEventListener('input', () => { clearTimeout(draftT); draftT = setTimeout(() => { const t = $('tfText'); if (t) api('tfDraft', { text: t.value }); }, 800); });
        $('tfOk').onclick = submitText;
        if (g.type === 'guess') {
          const cv = $('tfCv'); const w = Math.min(window.innerWidth - 32, 420);
          cv.style.width = w + 'px'; cv.style.height = Math.round(w * 3 / 4) + 'px';
          const ok = tfTask && tfTask.round === g.round && tfTask.step === g.step - 1;
          if (ok) drawStrokes(cv, tfTask.strokes);
          else { clearTimeout(tfTaskWait); tfTaskWait = setTimeout(async () => { if (!(tfTask && tfTask.round === g.round && tfTask.step === g.step - 1)) { const d = await apiData('fetch', { what: 'task' }); if (d) onEvent('tfTask', d); } }, 1500); }
        }
      }
      return;
    }
    if (g.sub === 'album') {
      show('s-tf');
      $('tfLabel').innerHTML = `📒 Álbum<small>corrente ${g.album.chain}/${g.album.chains}</small>`;
      $('tfTimer').textContent = '📺';
      const k = 'album|' + s.me.isMaster + '|' + g.album.auto;
      if ($('tfBody').dataset.key !== k) {
        $('tfBody').dataset.key = k;
        $('tfBody').innerHTML = `<div class="grow center"><div class="big">📺 Olhe para a TV!</div><p class="muted">As correntes estão sendo mostradas como uma conversa</p></div>` +
          (s.me.isMaster ? `<div class="card" style="display:flex;flex-direction:column;gap:8px"><b>👑 Controles</b>
            <button class="btn" id="tfNext">▶ Próxima mensagem</button>
            <div class="row" style="gap:8px"><button class="btn ghost" id="tfAuto">${g.album.auto ? '⏸ Pausar automático' : '⏯ Automático'}</button><button class="btn ghost" id="tfSkipC">⏭ Pular corrente</button></div></div>` : '');
        if (s.me.isMaster) {
          $('tfNext').onclick = () => api('tfNext');
          $('tfAuto').onclick = () => api('tfAuto', { on: !g.album.auto });
          $('tfSkipC').onclick = () => api('tfSkipChain');
        }
      }
      return;
    }
    if (g.sub === 'summary') {
      show('s-tf');
      $('tfLabel').innerHTML = '🏁 Fim da rodada'; $('tfTimer').textContent = '🏁';
      const meus = g.points && g.points[s.me.pid] || 0;
      const last = g.round >= g.rounds;
      const k = 'sum|' + g.round + '|' + s.me.isMaster;
      if ($('tfBody').dataset.key !== k) {
        $('tfBody').dataset.key = k;
        $('tfBody').innerHTML = `<div class="grow center"><div class="big">Você fez +${meus} pontos</div><p class="muted">quanto mais as descrições batem com os desenhos, mais pontos</p></div>` +
          (s.me.isMaster ? `<button class="btn green" id="tfFin">${last ? '🏆 Ver placar final' : '▶ Próxima rodada'}</button>` : '<p class="muted center">Aguardando o mestre…</p>');
        if (s.me.isMaster) $('tfFin').onclick = () => api('tfFinish');
      }
    }
  }
  function wait(title, sub, masterSkip) {
    show('s-tf');
    const k = 'wait|' + title + '|' + sub;
    if ($('tfBody').dataset.key === k) return;
    $('tfBody').dataset.key = k;
    $('tfBody').innerHTML = `<div class="grow center"><div class="big">${title}</div><p class="muted">${sub}</p></div>` +
      (masterSkip && S.me.isMaster ? '<button class="btn ghost" id="tfSkipS">⏭ Não esperar mais (encerrar etapa)</button>' : '');
    if ($('tfSkipS')) { let armed = 0; $('tfSkipS').onclick = () => { if (Date.now() - armed > 2000) { armed = Date.now(); $('tfSkipS').textContent = 'Toque de novo para confirmar'; return; } api('tfSkipStep'); }; }
  }
  function onEvent(ev, d) {
    if (ev !== 'tfTask' || !d) return;
    tfTask = d;    // pode chegar um instante antes da mudança de etapa: guarda e usa quando a etapa certa abrir
    if (!S || !S.g || S.g.kind !== 'tf' || d.round !== S.g.round || d.step !== S.g.step - 1) return;
    const cv = $('tfCv'); if (cv && d.strokes) drawStrokes(cv, d.strokes);
  }

  // ------------------------------------------------------------ BANDEIRAS
  let bdKey = null, bdSel = null, bdLocalStart = null, bdReveal = 15000, bdLastTent = 0, bdLastName = '';
  function sugestoes(q) {
    const n = PAISES.norm(q); if (!n) return [];
    const starts = [], has = [];
    for (const p of PAISES.lista) { const nn = PAISES.norm(p.nome); if (nn.startsWith(n)) starts.push(p); else if (nn.includes(n)) has.push(p); }
    return starts.sort((a, b) => a.nome.localeCompare(b.nome)).concat(has).slice(0, 7);
  }
  // ------------------------------------------------------------ mapa interativo (modo difícil)
  function criarMapa(cv, onPick) {
    const st = { v: null, pin: null, destaque: null, certo: null, travado: false, pts: new Map(), moveu: false, pinch: null };
    function tam() { const r = cv.getBoundingClientRect(); return [r.width, r.height]; }
    function desenhar() {
      const [w, h] = tam(); const dpr = window.devicePixelRatio || 1;
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      if (!st.v) st.v = MAPA.mundo(w, h);
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      MAPA.desenhar(g, w, h, st.v, { destaque: st.destaque, certo: st.certo, pinos: st.pin ? [Object.assign({ cor: '#ff5d8f' }, st.pin)] : [] });
    }
    function limitar() {
      const [w, h] = tam(), m = MAPA.mundo(w, h);
      st.v.s = Math.max(m.s, Math.min(m.s * 120, st.v.s));
      st.v.cy = Math.max(-MAPA.TOP, Math.min(-MAPA.BOTTOM, st.v.cy));
      if (st.v.cx > 200) st.v.cx -= 360; if (st.v.cx < -200) st.v.cx += 360;
    }
    function zoom(f, x, y) {
      const [w, h] = tam(); if (x == null) { x = w / 2; y = h / 2; }
      const [lon, lat] = MAPA.telaParaGeo(st.v, w, h, x, y);
      st.v.s *= f; limitar();
      const [nx, ny] = MAPA.geoParaTela(st.v, w, h, lon, lat);
      st.v.cx += (nx - x) / st.v.s; st.v.cy += (ny - y) / st.v.s; limitar(); desenhar();
    }
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); st.pts.set(e.pointerId, [e.clientX, e.clientY]); st.moveu = st.pts.size > 1; st.ini = [e.clientX, e.clientY]; });
    cv.addEventListener('pointermove', (e) => {
      if (!st.pts.has(e.pointerId)) return;
      const ant = st.pts.get(e.pointerId); st.pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (st.pts.size === 2) {                           // pinça: zoom
        const [a, b] = [...st.pts.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (st.pinch) { const r = cv.getBoundingClientRect(); zoom(d / st.pinch, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top); }
        st.pinch = d; st.moveu = true; return;
      }
      if (Math.hypot(e.clientX - st.ini[0], e.clientY - st.ini[1]) > 8) st.moveu = true;
      if (st.moveu) { st.v.cx -= (e.clientX - ant[0]) / st.v.s; st.v.cy -= (e.clientY - ant[1]) / st.v.s; limitar(); desenhar(); }
    });
    const fimToque = (e) => {
      if (!st.pts.has(e.pointerId)) return;
      st.pts.delete(e.pointerId); if (st.pts.size < 2) st.pinch = null;
      if (!st.moveu && !st.pts.size && !st.travado) {     // toque: marca o ponto
        const r = cv.getBoundingClientRect(), [w, h] = tam();
        let [lon, lat] = MAPA.telaParaGeo(st.v, w, h, e.clientX - r.left, e.clientY - r.top);
        lon = ((lon + 540) % 360) - 180;
        st.pin = { lon, lat };
        st.destaque = MAPA.paisNoPonto(lon, lat, 14 / st.v.s * 111);
        desenhar(); onPick && onPick(lon, lat, st.destaque);
      }
    };
    cv.addEventListener('pointerup', fimToque); cv.addEventListener('pointercancel', fimToque);
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1.25 : 0.8, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    return {
      st, desenhar, zoom,
      reset() { st.v = null; desenhar(); },
      focar(box) { const [w, h] = tam(); st.v = MAPA.encaixar(w, h, box, 0.25); limitar(); desenhar(); },
    };
  }
  let bdMapa = null;

  function renderBDMapa(s, prev) {
    const g = s.g, gp = s.gp || {};
    const key = 'mapa|' + g.idx + '|' + g.sub;
    const body = $('bdBody');
    if (key !== bdKey) {
      bdKey = key;
      if (g.sub === 'result') {
        const r = g.resultado || {}; const meu = (r.palpites || []).find(x => x.pid === s.me.pid);
        body.innerHTML = `<div class="center"><div class="muted">Era…</div><div class="big" style="font-size:34px;color:var(--yellow)">${esc(r.nome || '')}</div>
          <div class="big" style="font-size:20px">${meu ? (meu.dist === 0 ? '🎯 Você marcou dentro do país!' : `📍 Você ficou a ${meu.dist.toLocaleString('pt-BR')} km`) + ` · +${meu.points}` + (meu.rank === 1 && meu.points ? ' 🥇' : '') : '😶 Você não palpitou'}</div></div>
          <div class="mapBox"><canvas class="mapCv" id="bdMapCv"></canvas></div><p class="muted center" style="margin:0">Próxima bandeira já já…</p>`;
        bdMapa = criarMapa($('bdMapCv'), null); bdMapa.st.travado = true; bdMapa.st.certo = r.code;
        if (meu) bdMapa.st.pin = { lon: meu.lon, lat: meu.lat };
        const pc = MAPA.porCodigo[r.code];
        requestAnimationFrame(() => {
          if (pc) { const b = pc.bbox.slice(); if (meu) { b[0] = Math.min(b[0], meu.lon); b[2] = Math.max(b[2], meu.lon); b[1] = Math.min(b[1], meu.lat); b[3] = Math.max(b[3], meu.lat); } bdMapa.focar(b); }
          else bdMapa.desenhar();
        });
        return;
      }
      body.innerHTML = `<div class="bdMsg" id="bdMsg">📍 Toque no mapa onde fica o país da bandeira</div>
        <div class="mapBox"><canvas class="mapCv" id="bdMapCv"></canvas>
          <div class="mapZoom"><button id="mzIn">＋</button><button id="mzOut">－</button><button id="mzAll">🌍</button></div></div>
        <button class="btn green" id="bdPinGo" disabled>Marque um ponto no mapa</button>
        <div class="row" style="gap:8px"><button class="btn ghost" id="bdHint" style="font-size:15px"></button>${s.me.isMaster ? '<button class="btn ghost" id="bdSkip" style="font-size:15px;flex:0 0 38%">⏭ Pular</button>' : ''}</div>
        <p class="muted center" style="margin:0;font-size:13px">Arraste para mover · dois dedos para zoom · 1 palpite por bandeira</p>`;
      bdMapa = criarMapa($('bdMapCv'), (lon, lat, code) => {
        $('bdPinGo').disabled = false; $('bdPinGo').textContent = '📍 Enviar palpite';
        $('bdMsg').textContent = code ? 'País marcado (destacado em amarelo). Pode ajustar antes de enviar.' : 'Você marcou no mar. Pode ajustar antes de enviar.';
      });
      $('mzIn').onclick = () => bdMapa.zoom(1.6); $('mzOut').onclick = () => bdMapa.zoom(1 / 1.6); $('mzAll').onclick = () => bdMapa.reset();
      $('bdPinGo').onclick = () => {
        const p = bdMapa.st.pin; if (!p) return;
        api('bdPin', { lon: p.lon, lat: p.lat });
        bdMapa.st.travado = true; $('bdPinGo').disabled = true; $('bdPinGo').textContent = '✔ Palpite enviado';
        $('bdMsg').textContent = 'Palpite enviado! Aguardando os outros…'; $('bdMsg').className = 'bdMsg ok';
      };
      $('bdHint').onclick = () => { $('bdHint').disabled = true; api('bdHint'); };
      if ($('bdSkip')) { let armed = 0; $('bdSkip').onclick = () => { if (Date.now() - armed > 2000) { armed = Date.now(); $('bdSkip').textContent = 'Confirmar?'; return; } api('bdSkip'); }; }
      requestAnimationFrame(() => bdMapa.desenhar());
    }
    if (g.sub === 'play') {
      if (gp.palpite && !bdMapa.st.travado) {          // já palpitou (ex.: voltou para a página)
        bdMapa.st.pin = gp.palpite; bdMapa.st.travado = true; bdMapa.desenhar();
        $('bdPinGo').disabled = true; $('bdPinGo').textContent = '✔ Palpite enviado';
      }
      const h = $('bdHint');
      if (h) { h.disabled = g.dicas.length >= g.maxDicas; h.textContent = g.dicas.length >= g.maxDicas ? '💡 Sem mais dicas' : `💡 Dica (−15 pts) · ${g.dicas.length}/${g.maxDicas}`; }
      if (gp.palpite) { const m = $('bdMsg'); if (m) { m.textContent = `Palpite enviado! ${g.palpitaram}/${g.jogadores} já palpitaram`; m.className = 'bdMsg ok'; } }
    }
  }

  function renderBD(s, prev) {
    show('s-bd');
    const g = s.g, gp = s.gp || {};
    if (g.mode === 'mapa') {
      bdReveal = g.revealMs || bdReveal;
      if (g.sub === 'play') bdLocalStart = performance.now() + g.startInMs - g.elapsedMs;
      $('bdLabel').innerHTML = `🗺️ Bandeira ${g.idx} de ${g.total}<small>${g.dicas.length ? '💡 ' + g.dicas.length + ' dica(s) na TV' : 'marque o país no mapa'}</small>`;
      return renderBDMapa(s, prev);
    }
    bdReveal = g.revealMs || bdReveal;
    if (g.sub === 'play') bdLocalStart = performance.now() + g.startInMs - g.elapsedMs;
    $('bdLabel').innerHTML = `🚩 Bandeira ${g.idx} de ${g.total}<small>${g.dicas.length ? '💡 ' + g.dicas.length + ' dica(s) na TV' : 'quem acertar primeiro leva'}</small>`;
    const locked = gp.max > 0 && gp.tentativas >= gp.max;
    const key = g.idx + '|' + g.sub + '|' + locked;
    if (key !== bdKey) {
      bdKey = key; bdSel = null; bdLastTent = gp.tentativas || 0;
      const body = $('bdBody');
      if (g.sub === 'result') {
        const r = g.resultado || {};
        const eu = r.winner === s.me.pid;
        body.innerHTML = `<div class="grow center"><div class="muted">Era…</div><div class="big" style="font-size:38px;color:var(--yellow)">${esc(r.nome || '')}</div>
          <div class="big" style="font-size:22px">${r.winner ? (eu ? `🎉 Você acertou! +${r.points}` : `🏅 ${esc(r.winnerName)} acertou (+${r.points})`) : '😶 Ninguém acertou'}</div>
          <p class="muted">Próxima bandeira já já…</p></div>`;
      } else if (locked) {
        body.innerHTML = `<div class="grow center"><div class="big">😅 Seus chutes acabaram</div><p class="muted">Torça pelos outros e olhe a TV 📺</p></div>`;
      } else {
        body.innerHTML = `<div class="bdMsg" id="bdMsg">Digite o nome do país</div>
          <input class="bdIn" id="bdIn" type="text" placeholder="Ex.: Bra…" autocomplete="off" autocorrect="off" spellcheck="false">
          <div class="sugs" id="bdSugs"></div>
          <button class="btn green" id="bdGo" disabled>Escolha um país da lista</button>
          <div class="row" style="gap:8px"><button class="btn ghost" id="bdHint" style="font-size:15px"></button>${s.me.isMaster ? '<button class="btn ghost" id="bdSkip" style="font-size:15px;flex:0 0 38%">⏭ Pular</button>' : ''}</div>
          <p class="muted center" id="bdTries" style="margin:0"></p>`;
        const inp = $('bdIn');
        inp.addEventListener('input', () => {
          bdSel = null; $('bdGo').disabled = true; $('bdGo').textContent = 'Escolha um país da lista';
          const list = $('bdSugs'); list.innerHTML = '';
          sugestoes(inp.value).forEach(p => {
            const b = document.createElement('button'); b.textContent = p.nome;
            b.onclick = () => {
              bdSel = p; list.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b));
              $('bdGo').disabled = false; $('bdGo').textContent = `Responder: ${p.nome} ▶`;
            };
            list.appendChild(b);
          });
        });
        $('bdGo').onclick = () => {
          if (!bdSel) return;
          bdLastName = bdSel.nome; api('bdAnswer', { code: bdSel.code });
          $('bdGo').disabled = true; $('bdGo').textContent = 'Enviando…';
        };
        $('bdHint').onclick = () => { $('bdHint').disabled = true; api('bdHint'); };
        if ($('bdSkip')) { let armed = 0; $('bdSkip').onclick = () => { if (Date.now() - armed > 2000) { armed = Date.now(); $('bdSkip').textContent = 'Confirmar?'; return; } api('bdSkip'); }; }
      }
    }
    if (g.sub === 'play' && !locked) {
      const h = $('bdHint');
      if (h) { h.disabled = g.dicas.length >= g.maxDicas; h.textContent = g.dicas.length >= g.maxDicas ? '💡 Sem mais dicas' : `💡 Pedir dica (−15 pts) · ${g.dicas.length}/${g.maxDicas}`; }
      const t = $('bdTries'); if (t) t.textContent = gp.max ? `Chutes: ${gp.tentativas}/${gp.max}` : `Chutes: ${gp.tentativas} (sem limite)`;
      if ((gp.tentativas || 0) > bdLastTent) {          // errou
        bdLastTent = gp.tentativas;
        const m = $('bdMsg'); if (m) { m.textContent = `❌ Não é ${bdLastName}!`; m.className = 'bdMsg bad'; }
        const inp = $('bdIn'); if (inp) { inp.value = ''; inp.classList.remove('shake'); void inp.offsetWidth; inp.classList.add('shake'); inp.focus(); }
        $('bdSugs').innerHTML = ''; $('bdGo').disabled = true; $('bdGo').textContent = 'Escolha um país da lista';
        navigator.vibrate && navigator.vibrate(120);
      }
    }
  }

  // ------------------------------------------------------------ relógios
  setInterval(() => {
    if (!S || S.phase !== 'play' || !S.g) return;
    const g = S.g;
    if (g.kind === 'tf' && g.sub === 'play' && tfLocalEnd != null) {
      const left = tfLocalEnd - performance.now(), t = sec(left) + 's';
      $('tfTimer').textContent = t; $('drawTimer').textContent = t;
      $('tfTimer').className = $('drawTimer').className = 'timer' + (left < 10000 ? ' low' : '');
      // tempo acabando: envia o que tiver
      if (left < 900 && !tfSent && S.gp && S.gp.playing && !S.gp.done) { if (g.type === 'draw') submitDraw(); else submitText(); }
    }
    if (g.kind === 'bd') {
      const box = $('bdPtsBox');
      if (g.mode === 'mapa') { box.textContent = g.sub === 'play' ? `📍 ${g.palpitaram}/${g.jogadores}` : '🏁'; box.className = 'timer'; }
      else if (g.sub === 'play' && bdLocalStart != null) {
        const p = Math.max(0, Math.min(1, (performance.now() - bdLocalStart) / bdReveal));
        box.textContent = Math.max(10, Math.round(100 - 50 * p - 15 * g.dicas.length)) + ' pts';
        box.className = 'timer';
      } else box.textContent = '🏁';
    }
  }, 250);

  return {
    lobby, onEvent,
    render(s, prev) { if (s.g && s.g.kind === 'tf') renderTF(s, prev); else if (s.g && s.g.kind === 'bd') renderBD(s, prev); },
  };
})();
