// =============================================================
//  DESENHA AÍ! — regras do jogo (núcleo compartilhado)
//  Usado pelo servidor do PC (Node/Electron) e pelo app Android.
//  Não sabe nada de rede: quem usa fornece send() e joinURL().
// =============================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory({ telefone: require('./telefone.js'), bandeiras: require('./bandeiras.js') });
  } else root.DesenhaCore = factory(root.DesenhaJogos || {});
})(this, function (JOGOS) {
  'use strict';

  const REVEAL_MS = 7000;
  const MAX_JOGADORES = 30;
  const PTS_ACERTO = 10;        // pontos de quem adivinha
  const PTS_DESENHISTA = 5;     // pontos de quem desenhou

  /**
   * opts.categorias  — objeto de palavras (palavras.js)
   * opts.send(client, event, data) — envia um evento a um cliente conectado
   * opts.joinURL()   — endereço que os celulares devem abrir
   * opts.extraView() — campos extras para a tela (ex.: estado do túnel)
   * opts.log(msg)    — opcional
   */
  // Valida e limpa uma lista de categorias vinda de fora (internet/cache).
  function limparCategorias(obj) {
    if (!obj || typeof obj !== 'object') return null;
    const out = {};
    Object.keys(obj).slice(0, 60).forEach(function (k) {
      const c = obj[k];
      const key = String(k).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
      if (!key || !c || typeof c.nome !== 'string' || !Array.isArray(c.palavras)) return;
      const vistos = {}, pal = [];
      c.palavras.forEach(function (w) {
        if (typeof w !== 'string') return;
        const t = w.trim().replace(/\s+/g, ' ').slice(0, 40);
        const id = t.toLowerCase();
        if (t && !vistos[id]) { vistos[id] = 1; pal.push(t); }
      });
      if (pal.length >= 1 && c.ativa !== false) out[key] = { nome: c.nome.trim().slice(0, 30) || key, palavras: pal };
    });
    return Object.keys(out).length ? out : null;
  }
  function contar(cats) { let n = 0; Object.keys(cats).forEach(function (k) { n += cats[k].palavras.length; }); return n; }

  return function createGame(opts) {
    let CATEGORIAS = limparCategorias(opts.categorias) || {};
    let palavrasInfo = { versao: 0, origem: 'jogo', total: contar(CATEGORIAS) };
    let pendente = null;                 // lista nova esperando a partida acabar
    const send = opts.send;
    const log = opts.log || function () { };
    const extraView = opts.extraView || function () { return {}; };

    const players = new Map();   // pid -> { pid, name, score, conns }
    let order = [];
    let masterId = null;
    const clients = new Set();   // objetos do transporte: { role: 'tv'|'player', pid, ... }
    let timer = null;
    let version = 0;
    let modulo = null;            // jogo ativo que não é o Desenha Aí (telefone, bandeiras)

    const game = {
      phase: 'lobby',            // lobby | word | drawing | reveal | end
      settings: {
        gameId: 'desenha', music: true,
        // Desenha Aí
        rounds: 2, attempts: 3, time: 90, hints: true, showLetters: true, categories: Object.keys(CATEGORIAS),
        // Telefone sem fio
        tfWrite: 60, tfDraw: 90, tfGuess: 45, tfSteps: 0, tfRounds: 1,
        // Jogo das Bandeiras
        bdFlags: 10, bdSpeed: 15, bdAttempts: 3, bdMode: 'texto',
      },
      round: 0, drawOrder: [], matchOrder: [], turnIndex: 0,
      drawerId: null, word: null, category: null, swapped: false,
      endsAt: null, pausedRemaining: null,
      buzz: null, attemptsUsed: {}, strokes: [],
      hintVotes: [], revealed: [], hintUsed: false,
      lastResult: null, revealUntil: null, used: new Set(),
    };

    // ---------------- utilidades ----------------
    function newId() {
      let s = '';
      for (let i = 0; i < 16; i++) s += Math.floor(Math.random() * 16).toString(16);
      return s;
    }
    function pickWord() {
      const pool = [];
      for (const c of game.settings.categories) if (CATEGORIAS[c]) for (const w of CATEGORIAS[c].palavras) pool.push({ c, w });
      let free = pool.filter(p => !game.used.has(p.w));
      if (!free.length) { game.used.clear(); free = pool; }
      const p = free[Math.floor(Math.random() * free.length)];
      game.used.add(p.w);
      return p;
    }
    function guessers() { return order.filter(pid => pid !== game.drawerId); }
    function remainingMs() {
      if (game.phase !== 'drawing') return null;
      if (game.pausedRemaining != null) return game.pausedRemaining;
      if (game.endsAt == null) return null;
      return Math.max(0, game.endsAt - Date.now());
    }
    // máscara da palavra: letras escondidas como '_', exceto as reveladas pela dica
    function mask(word) { return word.split('').map((ch, i) => (ch === ' ' || ch === '-') ? ch : (game.revealed.indexOf(i) >= 0 ? ch.toUpperCase() : '_')).join(''); }
    function letterCount(word) { return word.replace(/[\s-]/g, '').length; }
    function wordCount(word) { return word.trim().split(/\s+/).length; }

    // ---------------- dica por votação ----------------
    function hintVoters() {   // quem pode votar: quem adivinha e está conectado
      return guessers().filter(pid => { const p = players.get(pid); return p && p.conns > 0; });
    }
    function checkHint() {
      if (game.phase !== 'drawing' || game.hintUsed || !game.word) return false;
      const voters = hintVoters();
      if (!voters.length || !voters.every(pid => game.hintVotes.indexOf(pid) >= 0)) return false;
      // todos pediram: revela 1 letra (palavra curta) ou 2 (palavra longa)
      const idx = [];
      game.word.split('').forEach((ch, i) => { if (ch !== ' ' && ch !== '-') idx.push(i); });
      const n = Math.min(idx.length - 1, letterCount(game.word) <= 6 ? 1 : 2);
      for (let k = 0; k < n; k++) { const j = Math.floor(Math.random() * idx.length); game.revealed.push(idx.splice(j, 1)[0]); }
      game.hintUsed = true;
      broadcastTV('hint', { letters: n });
      return true;
    }
    // avatar: imagem PNG pequena (32x32) em data URL; vai só para a TV
    function validAvatar(a) { return typeof a === 'string' && a.indexOf('data:image/png;base64,') === 0 && a.length < 9000 ? a : null; }
    function avatarsMap() { const m = {}; players.forEach(p => { if (p.avatar) m[p.pid] = p.avatar; }); return m; }
    function sendAvatars() { const m = avatarsMap(); clients.forEach(c => { if (c.role === 'tv') send(c, 'avatars', m); }); }
    function nameOf(pid) { const p = players.get(pid); return p ? p.name : null; }

    // ---------------- o que cada um pode ver ----------------
    function publicView() {
      const v = {
        phase: game.phase,
        players: order.map(pid => {
          const p = players.get(pid);
          return { pid, name: p.name, score: p.score, connected: p.conns > 0, isMaster: pid === masterId, av: !!p.avatar,
            attemptsUsed: game.attemptsUsed[pid] || 0 };
        }),
        masterId,
        settings: game.settings,
        allCategories: Object.keys(CATEGORIAS).map(key => ({ key, name: CATEGORIAS[key].nome, count: CATEGORIAS[key].palavras.length })),
        round: game.round, totalRounds: game.settings.rounds,
        turn: game.turnIndex + 1, turnsInRound: game.drawOrder.length,
        drawerId: game.drawerId, drawerName: nameOf(game.drawerId), nextName: nextDrawerName(),
        maxPlayers: MAX_JOGADORES,
        category: game.category ? CATEGORIAS[game.category].nome : null,
        mask: game.word ? mask(game.word) : null,
        letters: game.word ? letterCount(game.word) : null,
        words: game.word ? wordCount(game.word) : null,
        hint: game.phase === 'drawing' && game.settings.hints ? { votes: game.hintVotes.length, needed: hintVoters().length, used: game.hintUsed } : null,
        hintLetters: game.phase === 'drawing' && !game.settings.showLetters && game.hintUsed ? game.revealed.map(i => game.word[i].toUpperCase()) : null,
        remainingMs: remainingMs(),
        timerRunning: game.phase === 'drawing' && game.pausedRemaining == null && game.endsAt != null,
        buzz: game.buzz ? { pid: game.buzz.pid, name: nameOf(game.buzz.pid) } : null,
        lastResult: game.lastResult ? Object.assign({}, game.lastResult, {
          winnerName: game.lastResult.winnerId ? nameOf(game.lastResult.winnerId) : null,
          drawerName: nameOf(game.lastResult.drawerId),
        }) : null,
        revealMs: game.revealUntil ? Math.max(0, game.revealUntil - Date.now()) : null,
        joinURL: opts.joinURL(),
        gameId: game.settings.gameId,
        palavras: palavrasInfo,
        v: version,
      };
      if (!game.settings.showLetters) { v.mask = null; v.letters = null; v.words = null; }
      if (modulo && game.phase === 'play') v.g = modulo.view();
      return Object.assign(v, extraView());
    }
    function viewFor(client) {
      const v = publicView();
      if (client.role === 'player') {
        const me = players.get(client.pid);
        v.me = me ? { pid: me.pid, name: me.name, score: me.score, isMaster: me.pid === masterId,
          isDrawer: me.pid === game.drawerId,
          attemptsLeft: game.settings.attempts === 0 ? null : game.settings.attempts - (game.attemptsUsed[me.pid] || 0),
          hintVoted: game.hintVotes.indexOf(me.pid) >= 0 } : null;
        if (me && me.pid === game.drawerId && game.word) { v.word = game.word; v.canSwap = !game.swapped; }
        if (me && modulo && game.phase === 'play') v.gp = modulo.playerView(me.pid);
      }
      return v;
    }

    // ---------------- envio ----------------
    function broadcastState() {
      version += 1;
      clients.forEach(c => send(c, 'state', viewFor(c)));
    }
    function broadcastTV(event, data) {
      clients.forEach(c => { if (c.role === 'tv') send(c, event, data); });
    }

    // ---------------- fluxo ----------------
    function clearTimer() { if (timer) { clearTimeout(timer); timer = null; } }
    function shuffle(a) {
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
      return a;
    }
    function startGame() {
      players.forEach(p => { p.score = 0; });
      game.round = 0; game.used.clear();
      game.matchOrder = shuffle(order.slice());          // ordem sorteada, vale para todas as rodadas
      startRound();
    }
    function startRound() {
      game.round += 1;
      // quem entrou no meio da partida desenha no fim da fila, a partir desta rodada
      order.forEach(p => { if (game.matchOrder.indexOf(p) < 0) game.matchOrder.push(p); });
      game.matchOrder = game.matchOrder.filter(p => players.has(p));
      game.drawOrder = game.matchOrder.slice(); game.turnIndex = 0;
      startTurn();
    }
    function nextDrawerName() {
      if (game.phase === 'lobby' || game.phase === 'end') return null;
      for (let i = game.turnIndex + 1; i < game.drawOrder.length; i++) if (players.has(game.drawOrder[i])) return nameOf(game.drawOrder[i]);
      if (game.round < game.settings.rounds) { const f = game.matchOrder.find(p => players.has(p)); return f ? nameOf(f) : null; }
      return null;
    }
    function startTurn() {
      clearTimer();
      game.drawerId = game.drawOrder[game.turnIndex];
      if (!players.has(game.drawerId)) return nextTurn();
      const p = pickWord();
      game.word = p.w; game.category = p.c; game.swapped = false;
      game.buzz = null; game.attemptsUsed = {}; game.strokes = [];
      game.hintVotes = []; game.revealed = []; game.hintUsed = false;
      game.endsAt = null; game.pausedRemaining = null;
      game.lastResult = null; game.revealUntil = null;
      game.phase = 'word';
      broadcastTV('strokes', []);
      broadcastState();
    }
    function beginDrawing() {
      game.phase = 'drawing';
      if (game.settings.time > 0) {
        game.endsAt = Date.now() + game.settings.time * 1000;
        scheduleTimeout(game.settings.time * 1000);
      }
      broadcastState();
    }
    function scheduleTimeout(ms) { clearTimer(); timer = setTimeout(() => endTurn(null, 'tempo'), ms); }
    function endTurn(winnerId, reason) {
      clearTimer();
      if (winnerId) {
        const w = players.get(winnerId), d = players.get(game.drawerId);
        if (w) w.score += PTS_ACERTO;
        if (d) d.score += PTS_DESENHISTA;
      }
      game.lastResult = { word: game.word, category: CATEGORIAS[game.category].nome, winnerId, drawerId: game.drawerId, reason };
      game.buzz = null; game.endsAt = null; game.pausedRemaining = null;
      game.phase = 'reveal';
      game.revealUntil = Date.now() + REVEAL_MS;
      timer = setTimeout(nextTurn, REVEAL_MS);
      broadcastState();
    }
    function nextTurn() {
      clearTimer();
      game.turnIndex += 1;
      if (game.turnIndex < game.drawOrder.length) return startTurn();
      if (game.round < game.settings.rounds) return startRound();
      game.phase = 'end'; game.drawerId = null; game.word = null; game.revealUntil = null;
      broadcastState();
    }
    function stopModulo() { if (modulo) { try { modulo.stop(); } catch (e) { log('erro ao parar jogo: ' + e.message); } } modulo = null; }
    function toPlayer(pid, event, data) { clients.forEach(c => { if (c.role === 'player' && c.pid === pid) send(c, event, data); }); }
    function startModulo(id) {
      const factory = JOGOS[id];
      if (!factory) return;
      players.forEach(p => { p.score = 0; });
      stopModulo();
      game.phase = 'play';
      const ctx = {
        players, settings: game.settings, log,
        order: () => order.slice(),
        connected: () => order.filter(pid => { const p = players.get(pid); return p && p.conns > 0; }),
        masterId: () => masterId,
        nameOf, shuffle,
        broadcastState, broadcastTV, toPlayer,
        addScore(pid, n) { const p = players.get(pid); if (p) p.score += n; },
        finish() { stopModulo(); game.phase = 'end'; broadcastState(); },
      };
      modulo = factory(ctx);
      modulo.start();
      broadcastState();
    }
    function backToLobby() {
      clearTimer();
      stopModulo();
      if (pendente) { aplicarPalavras(pendente.cats, pendente.info); pendente = null; }
      Object.assign(game, { phase: 'lobby', round: 0, drawerId: null, word: null, category: null, buzz: null,
        endsAt: null, pausedRemaining: null, strokes: [], lastResult: null, revealUntil: null, attemptsUsed: {} });
      players.forEach(p => { p.score = 0; });
      broadcastTV('strokes', []);
      broadcastState();
    }

    function handleAction(pid, a) {
      const isMaster = pid === masterId;
      const isDrawer = pid === game.drawerId;
      switch (a.type) {
        case 'settings': {
          if (!isMaster || game.phase !== 'lobby') return;
          const s = game.settings, n = a.settings || {};
          if (Number.isInteger(n.rounds) && n.rounds >= 1 && n.rounds <= 10) s.rounds = n.rounds;
          if (Number.isInteger(n.attempts) && n.attempts >= 0 && n.attempts <= 10) s.attempts = n.attempts;
          if (Number.isInteger(n.time) && n.time >= 0 && n.time <= 600) s.time = n.time;
          if (typeof n.music === 'boolean') s.music = n.music;
          if (['desenha', 'telefone', 'bandeiras'].indexOf(n.gameId) >= 0) s.gameId = n.gameId;
          if (typeof n.hints === 'boolean') s.hints = n.hints;
          if (typeof n.showLetters === 'boolean') s.showLetters = n.showLetters;
          const num = (k, lo, hi) => { if (Number.isInteger(n[k]) && n[k] >= lo && n[k] <= hi) s[k] = n[k]; };
          num('tfWrite', 10, 600); num('tfDraw', 10, 600); num('tfGuess', 10, 600); num('tfSteps', 0, 30); num('tfRounds', 1, 5);
          num('bdFlags', 1, 200); num('bdSpeed', 3, 300); num('bdAttempts', 0, 10);
          if (n.bdMode === 'texto' || n.bdMode === 'mapa') s.bdMode = n.bdMode;
          if (Array.isArray(n.categories)) { const c = n.categories.filter(k => CATEGORIAS[k]); if (c.length) s.categories = c; }
          break;
        }
        case 'music':                       // o mestre liga/desliga a música a qualquer momento
          if (!isMaster) return;
          game.settings.music = !!a.on; break;
        case 'avatar': {
          const p = players.get(pid); if (!p) return;
          p.avatar = validAvatar(a.avatar); sendAvatars(); break;
        }
        case 'start':
          if (!isMaster || game.phase !== 'lobby' || order.length < 1) return;
          if (game.settings.gameId !== 'desenha') return startModulo(game.settings.gameId);
          return startGame();
        case 'kick':
          if (!isMaster || game.phase !== 'lobby' || a.pid === masterId) return;
          players.delete(a.pid); order = order.filter(x => x !== a.pid);
          clients.forEach(c => { if (c.pid === a.pid) send(c, 'kicked', {}); });
          break;
        case 'swap':
          if (!isDrawer || game.phase !== 'word' || game.swapped) return;
          { const p = pickWord(); game.word = p.w; game.category = p.c; game.swapped = true; }
          break;
        case 'beginDraw':
          if (!isDrawer || game.phase !== 'word') return;
          return beginDrawing();
        case 'hint':
          if (game.phase !== 'drawing' || isDrawer || game.hintUsed || !game.settings.hints) return;
          if (game.hintVotes.indexOf(pid) < 0) game.hintVotes.push(pid);
          checkHint();
          break;
        case 'buzz': {
          if (game.phase !== 'drawing' || isDrawer || game.buzz) return;
          if (game.settings.attempts > 0 && (game.attemptsUsed[pid] || 0) >= game.settings.attempts) return;
          game.buzz = { pid };
          const rem = remainingMs();
          if (rem != null) { game.pausedRemaining = rem; game.endsAt = null; clearTimer(); }
          broadcastTV('buzz', { name: nameOf(pid) });
          break;
        }
        case 'judge': {
          if (!isDrawer || game.phase !== 'drawing' || !game.buzz) return;
          const g = game.buzz.pid;
          if (a.correct) return endTurn(g, 'acerto');
          game.attemptsUsed[g] = (game.attemptsUsed[g] || 0) + 1;
          game.buzz = null;
          broadcastTV('wrong', {});
          const alive = guessers().filter(x => game.settings.attempts === 0 || (game.attemptsUsed[x] || 0) < game.settings.attempts);
          if (!alive.length) return endTurn(null, 'tentativas');
          if (game.pausedRemaining != null) {
            game.endsAt = Date.now() + game.pausedRemaining;
            scheduleTimeout(game.pausedRemaining);
            game.pausedRemaining = null;
          }
          break;
        }
        case 'giveUp':
          if (!(isDrawer || isMaster) || game.phase !== 'drawing') return;
          return endTurn(null, 'desistiu');
        case 'next':
          if (!(isDrawer || isMaster) || game.phase !== 'reveal') return;
          return nextTurn();
        case 'skipTurn':
          if (!isMaster || ['word', 'drawing'].indexOf(game.phase) < 0) return;
          return endTurn(null, 'pulado');
        case 'endGame':
          if (!isMaster || game.phase === 'lobby') return;
          clearTimer(); stopModulo(); game.phase = 'end'; game.drawerId = null; game.word = null; break;
        case 'lobby':
          if (!isMaster || game.phase !== 'end') return;
          return backToLobby();
        default:
          // ações do jogo ativo (telefone, bandeiras)
          if (modulo && game.phase === 'play') { if (modulo.action(pid, a) !== false) broadcastState(); }
          return;
      }
      broadcastState();
    }

    function aplicarPalavras(cats, info) {
      const antes = game.settings.categories;
      const todasAntes = Object.keys(CATEGORIAS);
      CATEGORIAS = cats;
      const novas = Object.keys(cats);
      // mantém a escolha do mestre; categorias novas entram marcadas; se estava tudo marcado, continua tudo
      const todasMarcadas = todasAntes.every(k => antes.indexOf(k) >= 0);
      let sel = todasMarcadas ? novas.slice() : antes.filter(k => cats[k]).concat(novas.filter(k => todasAntes.indexOf(k) < 0));
      if (!sel.length) sel = novas.slice();
      game.settings.categories = sel;
      game.used.clear();
      palavrasInfo = info;
    }

    // ---------------- API usada pelo transporte ----------------
    // Todas devolvem [statusHTTP, corpo].
    return {
      broadcastState,

      /**
       * Troca a lista de palavras (ex.: baixada da internet).
       * dados = { versao, categorias } ; origem = 'online' | 'cache'
       * Só troca se a versão for nova; no meio de uma partida, espera voltar à sala.
       */
      setPalavras(dados, origem) {
        if (!dados || typeof dados !== 'object') return false;
        const versao = Number(dados.versao) || 0;
        const cats = limparCategorias(dados.categorias);
        if (!cats) return false;
        if (versao < palavrasInfo.versao) return false;
        if (versao === palavrasInfo.versao && palavrasInfo.origem !== 'jogo') {
          if (palavrasInfo.origem === 'cache' && origem === 'online') { palavrasInfo = Object.assign({}, palavrasInfo, { origem }); broadcastState(); }
          return false;
        }
        const info = { versao, origem, total: contar(cats), atualizado: dados.atualizado || null };
        if (game.phase === 'lobby') { aplicarPalavras(cats, info); log('Palavras v' + versao + ' (' + origem + '): ' + info.total + ' palavras'); broadcastState(); }
        else pendente = { cats, info };
        return true;
      },
      palavrasInfo() { return palavrasInfo; },

      /** Novo cliente de eventos ao vivo. Retorna false se o jogador não existe. */
      connect(client) {
        if (client.role === 'player') {
          const pl = players.get(client.pid);
          if (!pl) { send(client, 'unknown', {}); return false; }
          pl.conns += 1;
        }
        clients.add(client);
        if (client.role === 'tv') { send(client, 'strokes', game.strokes); send(client, 'avatars', avatarsMap()); }
        if (modulo && game.phase === 'play' && modulo.onConnect) modulo.onConnect(client);
        broadcastState();
        return true;
      },
      disconnect(client) {
        if (!clients.has(client)) return;
        clients.delete(client);
        const pl = players.get(client.pid);
        if (client.role === 'player' && pl) pl.conns = Math.max(0, pl.conns - 1);
        checkHint();                                  // quem saiu não trava a dica dos outros
        if (modulo && game.phase === 'play' && modulo.onPresence) modulo.onPresence();
        broadcastState();
      },
      state(pid) {
        if (!players.has(pid)) return [404, { error: 'jogador desconhecido' }];
        return [200, viewFor({ role: 'player', pid })];
      },
      join(b) {
        b = b || {};
        const name = String(b.name || '').trim().slice(0, 16);
        if (!name) return [400, { error: 'Digite um nome' }];
        let pl = b.pid && players.get(b.pid);
        if (pl) pl.name = name;
        else {
          let taken = false;
          players.forEach(x => { if (x.name.toLowerCase() === name.toLowerCase()) taken = true; });
          if (taken) return [409, { error: 'Esse nome já está em uso' }];
          if (players.size >= MAX_JOGADORES) return [403, { error: 'Sala cheia: o máximo é ' + MAX_JOGADORES + ' jogadores' }];
          // versão online: o transporte fixa o id do jogador (= conta anônima do Firebase)
          const pid = (b.pidFixo && !players.has(String(b.pidFixo))) ? String(b.pidFixo) : newId();
          pl = { pid, name, score: 0, conns: 0 };
          players.set(pid, pl); order.push(pid);
          if (!masterId || !players.has(masterId)) masterId = pid;
        }
        if (b.avatar !== undefined) { pl.avatar = validAvatar(b.avatar); sendAvatars(); }
        log('→ ' + pl.name + ' entrou na sala');
        broadcastState();
        return [200, { pid: pl.pid, state: viewFor({ role: 'player', pid: pl.pid }) }];
      },
      action(b) {
        b = b || {};
        if (!players.has(b.pid)) return [404, { error: 'jogador desconhecido' }];
        // pedido de dados do jogo ativo (ex.: o desenho a descrever no Telefone sem fio)
        if (b.type === 'fetch' && modulo && modulo.fetch) return [200, { ok: true, data: modulo.fetch(b.pid, b.what) }];
        handleAction(b.pid, b);
        return [200, { ok: true, state: players.has(b.pid) ? viewFor({ role: 'player', pid: b.pid }) : null }];
      },
      draw(b) {
        b = b || {};
        const ops = b.ops;
        if (modulo && game.phase === 'play') { if (modulo.draw && Array.isArray(ops)) modulo.draw(b.pid, ops); return [204, null]; }
        if (b.pid !== game.drawerId || game.phase !== 'drawing' || !Array.isArray(ops)) return [204, null];
        for (const op of ops) {
          if (op.o === 'b') game.strokes.push({ id: op.id, c: op.c, s: op.s, p: [op.x, op.y] });
          else if (op.o === 'p') { const s = game.strokes.find(s => s.id === op.id); if (s) Array.prototype.push.apply(s.p, op.pts); }
          else if (op.o === 'u') game.strokes.pop();
          else if (op.o === 'x') game.strokes = [];
        }
        broadcastTV('draw', ops);
        return [204, null];
      },
    };
  };
});
