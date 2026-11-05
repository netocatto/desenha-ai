// ===== Desenha Aí! — tela da TV =====
const $ = (id) => document.getElementById(id);
let S = null, localEnd = null, strokes = [], qrFor = null;

// ---------- som (WebAudio, liberado no primeiro clique) ----------
let actx = null;
try {   // nos apps (PC/Android) o som já começa ligado
  actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === 'running') setTimeout(() => { $('soundHint').textContent = '🔊 Som ativado · duplo clique = tela cheia'; }, 0);
} catch { }
document.addEventListener('click', () => {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { } }
  if (actx && actx.state === 'suspended') actx.resume();
  updateMusic();
  $('soundHint').textContent = '🔊 Som ativado · duplo clique = tela cheia';
});
document.addEventListener('dblclick', () => {
  if (!document.fullscreenElement) { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); }
  else if (document.exitFullscreen) document.exitFullscreen();
});
function tone(freq, dur, type = 'square', when = 0, vol = 0.08) {
  if (!actx) return;
  const t = actx.currentTime + when, o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur);
}
const SFX = {
  buzz() { tone(660, .12); tone(880, .2, 'square', .1); },
  wrong() { tone(180, .45, 'sawtooth', 0, .1); },
  right() { [523, 659, 784, 1047].forEach((f, i) => tone(f, .22, 'triangle', i * .11, .12)); },
  timeup() { tone(440, .3, 'sawtooth'); tone(330, .5, 'sawtooth', .3); },
  tick() { tone(1200, .05, 'sine', 0, .05); },
  join() { tone(880, .08, 'triangle', 0, .06); tone(1320, .1, 'triangle', .07, .06); },
};
// ---------- música de fundo (sintetizada na hora: sem arquivos, sem direitos autorais) ----------
const Music = (() => {
  let out = null, noise = null, timerId = null, step = 0, nextTime = 0, mode = null, urgencyFn = () => 0;
  const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // progressão Dó – Lá menor – Fá – Sol  [nota do baixo, acorde]
  const PROG = [[48, [60, 64, 67]], [45, [57, 60, 64]], [41, [57, 60, 65]], [43, [55, 59, 62]]];
  function ensure() {
    if (!actx) return false;
    if (!out) {
      out = actx.createGain(); out.gain.value = 0; out.connect(actx.destination);
      const len = Math.floor(actx.sampleRate * 0.3);
      noise = actx.createBuffer(1, len, actx.sampleRate);
      const d = noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return true;
  }
  function note(type, freq, t, dur, vol) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
  }
  function kick(t) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.16);
  }
  function hiss(t, dur, vol, hp) {
    const s = actx.createBufferSource(); s.buffer = noise;
    const f = actx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = actx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + dur + 0.01);
  }
  function play(t, i, u) {
    const s = i % 16, bar = Math.floor(i / 16) % 4;
    const root = PROG[bar][0], chord = PROG[bar][1];
    const up = u > 0.85 ? 2 : 0;                            // finalzinho: sobe um tom
    if (mode === 'lobby') {
      if (s % 4 === 0) note('triangle', N(root), t, 0.4, 0.32);
      if (s % 2 === 0) note('square', N(chord[(s / 2) % 3] + 12), t, 0.14, 0.035);
      if (s === 14) note('sine', N(chord[2] + 24), t, 0.3, 0.05);
    } else if (mode === 'word') {                           // suspense: só pulso
      if (s % 4 === 0) note('triangle', N(root), t, 0.22, 0.3);
      if (s % 8 === 6) hiss(t, 0.05, 0.12, 7000);
      if (s === 0) note('sine', N(chord[0] + 12), t, 0.8, 0.06);
    } else if (mode === 'draw') {                           // animada, acelera com o tempo
      if (s % 4 === 0) kick(t);
      if (s % 8 === 4) hiss(t, 0.12, 0.3, 1500);                                   // caixa
      if (s % 2 === 0 || u > 0.6) hiss(t, 0.03, 0.09 + u * 0.05, 8000);            // chimbal (dobra no fim)
      if (s % 2 === 0) note('triangle', N(root + up + (s % 4 === 2 ? 12 : 0)), t, 0.18, 0.32);
      note('square', N(chord[s % 3] + 12 + up + (u > 0.85 ? 12 : 0)), t, 0.07, 0.03 + u * 0.025);
    } else if (mode === 'pause') {                          // alguém respondendo: segura a respiração
      if (s % 8 === 0) note('sine', N(root + 12), t, 0.7, 0.12);
      if (s % 4 === 2) note('sine', N(chord[2] + 24), t, 0.12, 0.035);
    }
  }
  function bpm(u) {
    if (mode === 'draw') return 112 + u * 70;               // 112 → 182 bpm
    if (mode === 'lobby') return 96;
    if (mode === 'pause') return 84;
    return 100;
  }
  function tick() {
    if (!actx || !mode) return;
    if (nextTime < actx.currentTime) nextTime = actx.currentTime + 0.02;
    while (nextTime < actx.currentTime + 0.12) {
      const u = Math.max(0, Math.min(1, urgencyFn()));
      play(nextTime, step, u);
      nextTime += 60 / bpm(u) / 4; step++;
    }
  }
  function set(newMode, urg) {
    if (urg) urgencyFn = urg;
    if (newMode === mode) return;
    if (!ensure()) return;
    mode = newMode;
    const t = actx.currentTime;
    out.gain.cancelScheduledValues(t);
    out.gain.setTargetAtTime(mode ? 0.2 : 0, t, mode ? 0.08 : 0.25);
    if (mode && !timerId) { nextTime = t + 0.05; step = 0; timerId = setInterval(tick, 25); }
    if (!mode && timerId) { clearInterval(timerId); timerId = null; }
  }
  return { set, get mode() { return mode; }, get bpm() { return mode ? Math.round(bpm(Math.max(0, Math.min(1, urgencyFn())))) : 0; } };
})();

function musicMode(s) {
  if (!s || s.settings.music === false) return null;
  if (s.phase === 'lobby') return 'lobby';
  if (s.phase === 'word') return 'word';
  if (s.phase === 'drawing') return s.buzz ? 'pause' : 'draw';
  return null;                                             // resultado e fim: silêncio (efeitos sonoros)
}
function urgency() {
  if (!S || S.phase !== 'drawing') return 0;
  if (!S.settings.time) return 0.3;                        // sem limite: ritmo médio constante
  const ms = S.timerRunning && localEnd != null ? localEnd - performance.now() : (S.remainingMs || 0);
  return 1 - ms / (S.settings.time * 1000);
}
function updateMusic() { Music.set(musicMode(S), urgency); }


// ---------- conexão ----------
const es = new EventSource('/events?role=tv');
es.addEventListener('state', (e) => onState(JSON.parse(e.data)));
es.addEventListener('strokes', (e) => { strokes = JSON.parse(e.data); redraw(); });
es.addEventListener('draw', (e) => applyOps(JSON.parse(e.data)));
es.addEventListener('buzz', () => SFX.buzz());
es.addEventListener('wrong', () => { SFX.wrong(); const f = $('flash'); f.className = 'flash'; void f.offsetWidth; f.className = 'flash red'; });

function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id)); if (id === 's-game') resize(); }

function onState(s) {
  const prev = S; S = s;
  localEnd = s.remainingMs != null ? performance.now() + s.remainingMs : null;
  if (s.phase === 'lobby') renderLobby(s, prev);
  else if (s.phase === 'end') renderEnd(s);
  else renderGame(s, prev);
  updateMusic();
}

// ---------- sala ----------
function renderLobby(s, prev) {
  show('s-lobby');
  $('url').textContent = s.joinURL.replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (s.sala) $('url').innerHTML = esc(s.joinURL.replace(/^https?:\/\//, '').split('?')[0].replace(/\/$/, '')) + ' &nbsp;·&nbsp; sala <b style="color:var(--yellow);letter-spacing:.4vh">' + esc(s.sala) + '</b>';
  const nb = $('netBtn');
  nb.style.display = s.canTunnel ? 'block' : 'none';
  nb.classList.toggle('on', !!s.tunnel && s.tunnel !== 'error');
  const nm = $('netMsg');
  nm.style.display = s.canTunnel && s.tunnel === 'error' && s.tunnelError ? 'block' : 'none';
  nm.textContent = s.tunnelError ? '⚠️ ' + s.tunnelError : '';
  nb.textContent = s.tunnel === 'starting' ? '⏳ Conectando à Cloudflare…' : s.tunnel === 'on' ? '📶 Voltar para só Wi-Fi' : s.tunnel === 'error' ? '⚠️ Falhou — tentar de novo' : '🌐 Jogar pela internet';
  nb.onclick = (e) => { e.stopPropagation(); fetch('/api/tunnel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on: !(s.tunnel === 'on' || s.tunnel === 'starting') }) }); };
  const key = s.joinURL + '|' + s.tunnel;
  if (s.tunnel === 'starting') {
    if (qrFor !== key) { qrFor = key; $('qr').innerHTML = '<div class="noqr">🌐 Criando uma nova sala…</div>'; }
    $('url').textContent = 'gerando link…';
    $('netStep').innerHTML = '1. Celular com <b>internet</b> (Wi-Fi ou 4G)';
  } else if (qrFor !== key) {
    qrFor = key;
    $('netStep').innerHTML = (s.tunnel === 'on' || s.sala) ? '1. Celular com <b>internet</b> (Wi-Fi ou 4G)' : '1. Conecte o celular no <b>mesmo Wi-Fi</b>';
    if (window.qrcode) {
      const q = qrcode(0, 'M'); q.addData(s.joinURL); q.make();
      $('qr').innerHTML = q.createSvgTag({ cellSize: 8, margin: 0, scalable: true });
    } else $('qr').innerHTML = `<div class="noqr">Sem internet para gerar o QR.<br>Digite no navegador do celular:<br><br>${s.joinURL}</div>`;
  }
  const pl = $('lobbyPlayers'); pl.innerHTML = '';
  for (const p of s.players) {
    const d = document.createElement('div'); d.className = 'p' + (p.connected ? '' : ' off');
    d.textContent = (p.isMaster ? '👑 ' : '') + p.name; pl.appendChild(d);
  }
  if (prev && s.players.length > prev.players.length) SFX.join();
  const st = s.settings;
  const cats = s.allCategories.filter(c => st.categories.includes(c.key)).map(c => c.name).join(', ');
  $('lobbySettings').textContent = `${st.rounds} rodada(s) · ${st.attempts ? st.attempts + ' tentativa(s) por pessoa' : 'tentativas sem limite'} · ${st.time ? st.time + 's por desenho' : 'sem limite de tempo'} · ${st.music === false ? '🔇 sem música' : '🎵 com música'} · ${cats}` + (s.palavras ? ` · 📦 ${s.palavras.total} palavras` + (s.palavras.versao ? ` (lista v${s.palavras.versao}${s.palavras.origem === 'online' ? ', atualizada' : ''})` : '') : '');
  const m = s.players.find(p => p.isMaster);
  $('lobbyHint').textContent = m ? `👑 ${m.name} é o mestre: ele configura e inicia a partida pelo celular.` : 'O primeiro a entrar vira o 👑 mestre e inicia a partida.';
}

// ---------- jogo ----------
function renderGame(s, prev) {
  show('s-game');
  $('roundLbl').textContent = `Rodada ${s.round}/${s.totalRounds} · vez ${s.turn}/${s.turnsInRound}`;
  $('drawerName').textContent = s.drawerName || '';
  $('nextName').textContent = s.nextName ? 'depois: ' + s.nextName : '';
  $('catLbl').textContent = s.category ? `Categoria: ${s.category}` : 'Categoria';
  $('mask').textContent = s.mask ? s.mask.split(' ').map(w => w.split('').join(' ')).join('     ') : '';

  const sc = $('scores'); sc.innerHTML = '';
  sc.classList.toggle('many', s.players.length > 8);
  [...s.players].sort((a, b) => b.score - a.score).forEach(p => {
    const d = document.createElement('div'); if (p.pid === s.drawerId) d.className = 'dr';
    const tries = (p.pid !== s.drawerId && s.phase === 'drawing' && p.attemptsUsed) ? `<span class="tries">${'✖'.repeat(p.attemptsUsed)}</span>` : '';
    d.innerHTML = `<span>${p.pid === s.drawerId ? '✏️ ' : ''}${esc(p.name)}${tries}</span><span>${p.score}</span>`;
    sc.appendChild(d);
  });

  $('ovWord').classList.toggle('on', s.phase === 'word');
  $('ovWordText').textContent = `✏️ ${s.drawerName} está vendo a palavra…`;

  const bb = $('buzzBanner');
  if (s.buzz && s.phase === 'drawing') { bb.textContent = `🙋 ${s.buzz.name} vai responder!`; bb.classList.add('on'); }
  else bb.classList.remove('on');

  const rv = $('ovReveal');
  if (s.phase === 'reveal' && s.lastResult) {
    const r = s.lastResult;
    $('rvCat').textContent = r.category; $('rvWord').textContent = r.word;
    const reasons = { tempo: '⏰ Tempo esgotado!', tentativas: '😬 Acabaram as tentativas', desistiu: '🏳️ Desenho encerrado', pulado: '⏭ Vez pulada' };
    $('rvText').textContent = r.winnerId ? `🎉 ${r.winnerName} acertou! +10 · ${r.drawerName} +5` : (reasons[r.reason] || 'Ninguém acertou');
    if (!prev || prev.phase !== 'reveal') r.winnerId ? SFX.right() : SFX.timeup();
    rv.classList.add('on');
  } else rv.classList.remove('on');
}

// ---------- canvas ----------
const cv = $('tvc'), ctx = cv.getContext('2d');
let W = 640, H = 480;
function resize() {
  const side = document.querySelector('.side').getBoundingClientRect().width || window.innerWidth * 0.2;
  const maxW = window.innerWidth - side - window.innerWidth * 0.045;
  const maxH = window.innerHeight * 0.95;
  W = Math.floor(Math.min(maxW, maxH * 4 / 3)); H = Math.round(W * 3 / 4);
  const dpr = window.devicePixelRatio || 1;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  redraw();
}
window.addEventListener('resize', resize);

function redraw() {
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  for (const s of strokes) drawStroke(s);
}
function drawStroke(s) {
  const p = s.p;
  ctx.strokeStyle = s.c; ctx.fillStyle = s.c; ctx.lineWidth = s.s * W; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (p.length <= 2) { ctx.beginPath(); ctx.arc(p[0] * W, p[1] * H, s.s * W / 2, 0, Math.PI * 2); ctx.fill(); return; }
  ctx.beginPath(); ctx.moveTo(p[0] * W, p[1] * H);
  for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i] * W, p[i + 1] * H);
  ctx.stroke();
}
function applyOps(ops) {
  for (const op of ops) {
    if (op.o === 'b') { const s = { id: op.id, c: op.c, s: op.s, p: [op.x, op.y] }; strokes.push(s); drawStroke(s); }
    else if (op.o === 'p') {
      const s = strokes.find(x => x.id === op.id); if (!s) continue;
      ctx.strokeStyle = s.c; ctx.lineWidth = s.s * W; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(s.p[s.p.length - 2] * W, s.p[s.p.length - 1] * H);
      for (let i = 0; i < op.pts.length; i += 2) ctx.lineTo(op.pts[i] * W, op.pts[i + 1] * H);
      ctx.stroke();
      s.p.push(...op.pts);
    }
    else if (op.o === 'u') { strokes.pop(); redraw(); }
    else if (op.o === 'x') { strokes = []; redraw(); }
  }
}

// ---------- fim ----------
function renderEnd(s) {
  show('s-end');
  const sorted = [...s.players].sort((a, b) => b.score - a.score);
  const top = [sorted[1], sorted[0], sorted[2]];
  const H = [22, 32, 15], C = ['#c9c9e8', '#ffd23f', '#e0a36b'], N = [2, 1, 3];
  $('podium').innerHTML = top.map((p, i) => p ? `<div class="col"><div class="nm">${i === 1 ? '🏆 ' : ''}${esc(p.name)}</div><div class="pt">${p.score} pts</div><div class="bar" style="height:${H[i]}vh;background:${C[i]}">${N[i]}º</div></div>` : '').join('');
  $('rest').textContent = sorted.slice(3).map((p, i) => `${i + 4}º ${p.name} (${p.score})`).join(' · ');
}

// ---------- cronômetro ----------
let lastSec = null;
setInterval(() => {
  if (!S || S.phase !== 'drawing') { $('timer').textContent = S && S.phase === 'word' ? '…' : '--'; $('timer').className = 'timer'; return; }
  const t = $('timer');
  if (S.settings.time === 0) { t.textContent = '∞'; t.className = 'timer'; return; }
  if (localEnd == null) return;
  const ms = S.timerRunning ? localEnd - performance.now() : S.remainingMs;
  const sec = Math.max(0, Math.ceil(ms / 1000));
  t.textContent = (S.timerRunning ? '' : '⏸') + sec;
  t.className = 'timer' + (!S.timerRunning ? ' paused' : sec <= 10 ? ' low' : '');
  if (S.timerRunning && sec <= 5 && sec > 0 && sec !== lastSec) SFX.tick();
  lastSec = sec;
}, 200);

function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
