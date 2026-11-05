// ===== Desenha Aí! — controle no celular =====
const $ = (id) => document.getElementById(id);
const LS = { get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { } }, del(k) { try { localStorage.removeItem(k); } catch { } } };

let pid = LS.get('da_pid');
let S = null;               // último estado recebido
let es = null;
let localEnd = null;        // fim do cronômetro em relógio local
let localRevealEnd = null;
let sseAlive = 0;           // último sinal do canal ao vivo

// mostra qualquer erro na tela (ajuda a diagnosticar no celular)
window.addEventListener('error', (e) => { const b = document.getElementById('status'); if (b) { b.style.color = '#ff5a5a'; b.textContent = 'Erro: ' + e.message; } });

// ---------- conexão ----------
function connect() {
  if (es) es.close();
  es = new EventSource('/events?role=player&pid=' + encodeURIComponent(pid));
  es.addEventListener('state', (e) => { sseAlive = Date.now(); setStatus(''); onState(JSON.parse(e.data)); });
  es.addEventListener('ping', () => { sseAlive = Date.now(); });
  es.addEventListener('unknown', forget);
  es.addEventListener('kicked', () => { es.close(); pid = null; LS.del('da_pid'); show('s-join'); $('joinErr').textContent = 'Você foi removido da sala.'; });
  es.onerror = () => setStatus('reconectando…');
}
function forget() { if (es) es.close(); pid = null; S = null; LS.del('da_pid'); show('s-join'); }

// plano B: se o canal ao vivo ficar mudo (proxy/túnel segurando), consulta o servidor
async function poll() {
  if (!pid) return;
  try {
    const r = await fetch('/api/state?pid=' + encodeURIComponent(pid), { cache: 'no-store' });
    const j = await r.json().catch(() => null);
    if (r.status === 404 && j && j.error === 'jogador desconhecido') return forget();
    if (r.ok && j) { setStatus(''); onState(j); }
    else if (r.status !== 204) setStatus('reconectando…');
  } catch (e) { setStatus('reconectando…'); }
}
setInterval(() => { if (pid && Date.now() - sseAlive > 6000) poll(); }, 900);
function setStatus(t) { $('status').textContent = t; }

async function api(type, extra = {}) {
  try {
    const r = await fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid, type, ...extra }) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 404 && j.error === 'jogador desconhecido') return forget();
    if (j.state) onState(j.state);
  } catch (e) { setStatus('sem conexão'); }
}

// ---------- entrar ----------
$('name').value = LS.get('da_name') || '';
async function join() {
  const name = $('name').value.trim();
  if (!name) { $('joinErr').textContent = 'Digite seu nome'; return; }
  $('joinBtn').disabled = true;
  try {
    const r = await fetch('/api/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, pid }) });
    const j = await r.json();
    if (!r.ok) { $('joinErr').textContent = j.error || 'Erro'; return; }
    pid = j.pid; LS.set('da_pid', pid); LS.set('da_name', name);
    $('joinErr').textContent = '';
    connect();
    if (j.state) onState(j.state);
    else $('joinErr').textContent = 'Servidor desatualizado: feche a janela preta e abra o .bat de novo.';
  } catch (e) { $('joinErr').textContent = 'Não consegui falar com o servidor'; }
  finally { $('joinBtn').disabled = false; }
}
$('joinBtn').onclick = join;
$('name').addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });

// ---------- telas ----------
let current = null;
function show(id) {
  if (current === id) return;
  current = id;
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  if (id === 's-draw') requestAnimationFrame(resizePad);
}

function onState(s) {
  if (S && s.v < S.v) return;
  if (S && s.v === S.v && current) { return; }
  const prev = S; S = s;
  if (!s.me) return;
  if (s.remainingMs != null) localEnd = performance.now() + s.remainingMs; else localEnd = null;
  localRevealEnd = s.revealMs != null ? performance.now() + s.revealMs : null;

  // novo turno: limpa o desenho local
  if (!prev || prev.drawerId !== s.drawerId || prev.turn !== s.turn || prev.round !== s.round || s.phase === 'word') {
    if (s.phase === 'word' || s.phase === 'lobby') { strokes = []; queue = []; }
  }

  if (s.phase === 'lobby') return renderLobby(s);
  if (s.phase === 'word') return s.me.isDrawer ? renderWord(s) : renderGuess(s);
  if (s.phase === 'drawing') return s.me.isDrawer ? renderDraw(s, prev) : renderGuess(s, prev);
  if (s.phase === 'reveal') return renderReveal(s);
  if (s.phase === 'end') return renderEnd(s);
}

// ---------- sala ----------
const ROUNDS = [1, 2, 3, 4, 5], ATTEMPTS = [1, 2, 3, 4, 5, [0, 'Sem limite']], TIMES = [[45, '45s'], [60, '60s'], [90, '90s'], [120, '2min'], [180, '3min'], [0, 'Sem limite']];

function optGroup(el, items, value, onPick) {
  el.innerHTML = '';
  for (const it of items) {
    const [v, label] = Array.isArray(it) ? it : [it, String(it)];
    const b = document.createElement('button');
    b.textContent = label;
    if (Array.isArray(value) ? value.includes(v) : value === v) b.className = 'sel';
    b.onclick = () => onPick(v);
    el.appendChild(b);
  }
}

function renderLobby(s) {
  show('s-lobby');
  $('pCount').textContent = s.players.length;
  const lp = $('lobbyPlayers'); lp.innerHTML = '';
  for (const p of s.players) {
    const d = document.createElement('div');
    d.className = 'chipP' + (p.connected ? '' : ' off');
    d.textContent = (p.isMaster ? '👑 ' : '') + p.name + (p.pid === s.me.pid ? ' (você)' : '');
    if (s.me.isMaster && !p.isMaster) {
      const x = document.createElement('button'); x.className = 'x'; x.textContent = '×';
      x.onclick = () => api('kick', { pid: p.pid }); d.appendChild(x);
    }
    lp.appendChild(d);
  }
  const st = s.settings;
  $('masterPanel').style.display = s.me.isMaster ? '' : 'none';
  $('waitPanel').style.display = s.me.isMaster ? 'none' : '';
  $('startBtn').style.display = s.me.isMaster ? '' : 'none';
  const timeLbl = st.time ? st.time + 's' : 'sem limite';
  $('waitSettings').textContent = `${st.rounds} rodada(s) · ${st.attempts ? st.attempts + ' tentativa(s)' : 'tentativas sem limite'} · ${timeLbl}`;
  if (s.me.isMaster) {
    const set = (patch) => api('settings', { settings: { ...st, ...patch } });
    optGroup($('optRounds'), ROUNDS, st.rounds, v => set({ rounds: v }));
    optGroup($('optAttempts'), ATTEMPTS, st.attempts, v => set({ attempts: v }));
    optGroup($('optTime'), TIMES, st.time, v => set({ time: v }));
    optGroup($('optMusic'), [[true, '🎵 Ligada'], [false, '🔇 Desligada']], st.music !== false, v => set({ music: v }));
    optGroup($('optCats'), s.allCategories.map(c => [c.key, c.name]), st.categories, v => {
      const has = st.categories.includes(v);
      const next = has ? st.categories.filter(c => c !== v) : [...st.categories, v];
      if (next.length) set({ categories: next });
    });
    const n = s.players.length;
    $('startBtn').textContent = n === 1 ? '▶ Iniciar teste solo' : `▶ Iniciar partida (${n} jogadores)`;
  }
}
$('startBtn').onclick = () => api('start');

// ---------- palavra ----------
// palavra começa oculta: o desenhista só mostra quando estiver "seguro"
let wordVisible = false, wordTurnKey = null;
function syncWordVisibility(s) {
  const key = s.round + '|' + s.turn + '|' + s.drawerId;
  if (key !== wordTurnKey) { wordTurnKey = key; wordVisible = false; }
}
function hiddenWord(w) { return '•'.repeat(Math.min(Math.max(String(w || '').length, 4), 10)); }
function paintWord() {
  if (!S || !S.word) return;
  const w = $('wWord');
  w.textContent = wordVisible ? S.word : hiddenWord(S.word);
  w.classList.toggle('hid', !wordVisible);
  $('eyeBtn').textContent = wordVisible ? '🙈 Ocultar palavra' : '👁 Mostrar palavra';
  $('miniWord').innerHTML = `${wordVisible ? esc(S.word) : '<span style="letter-spacing:3px;color:var(--muted)">' + hiddenWord(S.word) + '</span>'}<small>${esc(S.category)} · rodada ${S.round}/${S.totalRounds}</small>`;
  $('miniEye').classList.toggle('on', wordVisible);
  $('miniEye').textContent = wordVisible ? '🙈' : '👁';
}
function toggleWord() { wordVisible = !wordVisible; paintWord(); }
$('eyeBtn').onclick = toggleWord;
$('miniEye').onclick = toggleWord;

function renderWord(s) {
  show('s-word');
  syncWordVisibility(s);
  $('wCat').textContent = s.category;
  paintWord();
  $('swapBtn').style.display = s.canSwap ? '' : 'none';
}
$('beginBtn').onclick = () => api('beginDraw');
$('swapBtn').onclick = () => api('swap');

// ---------- desenho ----------
const COLORS = ['#111111', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#8d6e63', '#ec407a'];
let color = COLORS[0], size = 0.016, erasing = false;
let strokes = [];
let cur = null;           // traço atual
let activePointer = null;
const pad = $('pad'), ctx = pad.getContext('2d');
let W = 300, H = 225;     // tamanho do canvas em px CSS (proporção 4:3)
const RATIO = 3 / 4;

(function buildPalette() {
  const row = $('colors');
  COLORS.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'sw' + (i === 0 ? ' sel' : ''); b.style.background = c;
    b.onclick = () => { color = c; erasing = false; $('eraser').classList.remove('sel');
      row.querySelectorAll('.sw').forEach(x => x.classList.toggle('sel', x === b)); };
    row.appendChild(b);
  });
})();
document.querySelectorAll('[data-size]').forEach(b => b.onclick = () => {
  size = Number(b.dataset.size);
  document.querySelectorAll('[data-size]').forEach(x => x.classList.toggle('sel', x === b));
});
$('eraser').onclick = () => { erasing = !erasing; $('eraser').classList.toggle('sel', erasing); };
$('undo').onclick = () => { strokes.pop(); redraw(); pushOp({ o: 'u' }); };
let clearArmed = 0;
$('clear').onclick = () => {
  if (Date.now() - clearArmed > 1500) { clearArmed = Date.now(); $('clear').textContent = '❓'; setTimeout(() => $('clear').textContent = '🗑️', 1500); return; }
  clearArmed = 0; $('clear').textContent = '🗑️';
  strokes = []; redraw(); pushOp({ o: 'x' });
};
let giveArmed = 0;
$('giveUp').onclick = () => {
  if (Date.now() - giveArmed > 1500) { giveArmed = Date.now(); $('giveUp').textContent = '❓'; setTimeout(() => $('giveUp').textContent = '🏳️', 1500); return; }
  giveArmed = 0; api('giveUp');
};

function resizePad() {
  const wrap = $('canvasWrap');
  const r = wrap.getBoundingClientRect();
  W = Math.floor(Math.max(120, Math.min(r.width, r.height / RATIO)));
  H = Math.round(W * RATIO);
  const dpr = window.devicePixelRatio || 1;
  pad.style.width = W + 'px'; pad.style.height = H + 'px';
  pad.width = Math.round(W * dpr); pad.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  redraw();
}
window.addEventListener('resize', () => { if (current === 's-draw') resizePad(); });
window.addEventListener('orientationchange', () => setTimeout(() => { if (current === 's-draw') resizePad(); }, 300));

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
function seg(s, x0, y0, x1, y1) {
  ctx.strokeStyle = s.c; ctx.lineWidth = s.s * W; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0 * W, y0 * H); ctx.lineTo(x1 * W, y1 * H); ctx.stroke();
}
const r4 = (v) => Math.round(Math.min(1, Math.max(0, v)) * 10000) / 10000;
function norm(e) {
  const r = pad.getBoundingClientRect();
  return [r4((e.clientX - r.left) / r.width), r4((e.clientY - r.top) / r.height)];
}
function canDraw() { return S && S.phase === 'drawing' && S.me && S.me.isDrawer; }

pad.addEventListener('pointerdown', (e) => {
  if (!canDraw() || activePointer !== null) return;
  e.preventDefault();
  activePointer = e.pointerId; pad.setPointerCapture(e.pointerId);
  const [x, y] = norm(e);
  cur = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), c: erasing ? '#ffffff' : color, s: erasing ? Math.max(size, 0.035) : size, p: [x, y] };
  strokes.push(cur);
  drawStroke(cur);
  pushOp({ o: 'b', id: cur.id, c: cur.c, s: cur.s, x, y });
});
pad.addEventListener('pointermove', (e) => {
  if (e.pointerId !== activePointer || !cur) return;
  e.preventDefault();
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of (evs.length ? evs : [e])) {
    const [x, y] = norm(ev);
    const lx = cur.p[cur.p.length - 2], ly = cur.p[cur.p.length - 1];
    if (Math.abs(x - lx) + Math.abs(y - ly) < 0.002) continue;
    seg(cur, lx, ly, x, y);
    cur.p.push(x, y);
    pushOp({ o: 'p', id: cur.id, pts: [x, y] });
  }
});
function endStroke(e) { if (e.pointerId !== activePointer) return; activePointer = null; cur = null; }
pad.addEventListener('pointerup', endStroke);
pad.addEventListener('pointercancel', endStroke);

// envio em lotes (a cada 40 ms), mantendo a ordem
let queue = [], sending = false;
function pushOp(op) {
  const last = queue[queue.length - 1];
  if (op.o === 'p' && last && last.o === 'p' && last.id === op.id) last.pts.push(...op.pts);
  else queue.push(op);
}
async function flush() {
  if (sending || !queue.length || !pid) return;
  sending = true;
  const ops = queue; queue = [];
  try {
    await fetch('/api/draw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pid, ops }) });
  } catch (e) { setStatus('falha ao enviar desenho'); }
  sending = false;
}
setInterval(flush, 40);

function renderDraw(s, prev) {
  show('s-draw');
  syncWordVisibility(s);
  paintWord();
  const j = $('judge');
  if (s.buzz) {
    $('judgeWho').textContent = `🙋 ${s.buzz.name} vai responder!`;
    if (!j.classList.contains('on')) navigator.vibrate && navigator.vibrate([80, 60, 80]);
    j.classList.add('on');
  } else j.classList.remove('on');
}
$('rightBtn').onclick = () => api('judge', { correct: true });
$('wrongBtn').onclick = () => api('judge', { correct: false });

// ---------- adivinhar ----------
function renderGuess(s, prev) {
  show('s-guess');
  $('gRound').textContent = `Rodada ${s.round}/${s.totalRounds} · Vez ${s.turn}/${s.turnsInRound}`;
  $('mbGuess').classList.toggle('on', s.me.isMaster);
  $('musicBtn').textContent = s.settings.music === false ? '🔇' : '🎵';
  $('musicBtn').onclick = () => api('music', { on: s.settings.music === false });
  const body = $('guessBody');
  const left = s.me.attemptsLeft;
  if (s.phase === 'word') {
    body.innerHTML = `<div class="big">✏️ ${esc(s.drawerName)}<br>está vendo a palavra…</div><p class="muted">Olhe para a TV e prepare o dedo!</p>`;
    return;
  }
  if (s.buzz && s.buzz.pid === s.me.pid) {
    if (!(prev && prev.buzz && prev.buzz.pid === s.me.pid)) navigator.vibrate && navigator.vibrate(300);
    body.innerHTML = `<div class="meanswer"><div class="big">🎤 É SUA VEZ!</div><div style="font-size:20px;font-weight:700">Fale sua resposta em voz alta</div></div><p class="muted">${esc(s.drawerName)} vai dizer se você acertou</p>`;
    return;
  }
  if (s.buzz) {
    body.innerHTML = `<div class="big">🙋 ${esc(s.buzz.name)}<br>está respondendo…</div><p class="muted">Aguarde o veredito</p>`;
    return;
  }
  if (left !== null && left <= 0) {
    body.innerHTML = `<div class="big">😅 Suas tentativas<br>acabaram</div><p class="muted">Torça pelos outros!</p>`;
    return;
  }
  body.innerHTML = `<button class="buzzer" id="buzzBtn">EU SEI!<small>${left === null ? 'tentativas sem limite' : left + ' tentativa' + (left > 1 ? 's' : '')}</small></button><p class="muted">O primeiro a apertar responde</p>`;
  $('buzzBtn').onclick = () => { $('buzzBtn').disabled = true; api('buzz'); };
}
document.querySelectorAll('[data-m]').forEach(b => {
  let armed = 0; const orig = b.textContent;
  b.onclick = () => {
    if (Date.now() - armed > 2000) { armed = Date.now(); b.textContent = 'Toque de novo p/ confirmar'; setTimeout(() => b.textContent = orig, 2000); return; }
    armed = 0; b.textContent = orig; api(b.dataset.m);
  };
});

// ---------- resultado ----------
function rankHTML(s) {
  return [...s.players].sort((a, b) => b.score - a.score)
    .map((p, i) => `<div class="${p.pid === s.me.pid ? 'me' : ''}"><span>${i + 1}. ${esc(p.name)}</span><span>${p.score}</span></div>`).join('');
}
function renderReveal(s) {
  show('s-reveal');
  const r = s.lastResult || {};
  $('rCat').textContent = r.category || '';
  $('rWord').textContent = r.word || '';
  const reasons = { tempo: '⏰ Tempo esgotado!', tentativas: '😬 Acabaram as tentativas', desistiu: '🏳️ Desenho encerrado', pulado: '⏭ Vez pulada' };
  $('rText').textContent = r.winnerId ? `🎉 ${r.winnerName} acertou!` : (reasons[r.reason] || 'Ninguém acertou');
  $('rRank').innerHTML = rankHTML(s);
  $('nextBtn').style.display = (s.me.isDrawer || s.me.isMaster) ? '' : 'none';
}
$('nextBtn').onclick = () => api('next');

// ---------- fim ----------
function renderEnd(s) {
  show('s-end');
  const sorted = [...s.players].sort((a, b) => b.score - a.score);
  $('eWinner').textContent = sorted[0] ? `🏆 ${sorted[0].name}` : '';
  $('eRank').innerHTML = rankHTML(s);
  $('lobbyBtn').style.display = s.me.isMaster ? '' : 'none';
  $('eWait').style.display = s.me.isMaster ? 'none' : '';
}
$('lobbyBtn').onclick = () => api('lobby');

// ---------- cronômetros ----------
setInterval(() => {
  if (!S) return;
  const t = $('drawTimer');
  if (S.phase === 'drawing') {
    if (S.settings.time === 0) { t.textContent = '∞'; t.className = 'timer'; }
    else if (localEnd != null) {
      const ms = S.timerRunning ? localEnd - performance.now() : S.remainingMs;
      const sec = Math.max(0, Math.ceil(ms / 1000));
      t.textContent = (S.timerRunning ? '' : '⏸ ') + sec + 's';
      t.className = 'timer' + (S.timerRunning ? (sec <= 10 ? ' low' : '') : ' paused');
    }
  }
  if (S.phase === 'reveal' && localRevealEnd != null) {
    $('nextCount').textContent = '(' + Math.max(0, Math.ceil((localRevealEnd - performance.now()) / 1000)) + ')';
  }
}, 200);

function esc(t) { return String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// início
if (pid) { connect(); poll(); } else show('s-join');
