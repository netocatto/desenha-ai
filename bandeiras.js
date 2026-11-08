// =============================================================
//  JOGO DAS BANDEIRAS — regras do jogo
//  A bandeira vai sendo revelada aos poucos na TV (formato sorteado).
//  O primeiro a acertar o país leva os pontos; dicas diminuem os pontos.
// =============================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./paises.js'), require('./mapa.js'));
  else { root.DesenhaJogos = root.DesenhaJogos || {}; root.DesenhaJogos.bandeiras = factory(root.PAISES, root.MAPA); }
})(this, function (PAISES, MAPA) {
  'use strict';
  const ESTILOS = ['circulo', 'cortina', 'diagonal', 'persiana', 'mosaico', 'relogio', 'losango', 'furos', 'zoom', 'estrela'];
  const RESULT_MS = 6000;      // tempo mostrando a resposta
  const EXTRA_MS = 10000;      // bandeira inteira na tela antes de acabar a vez
  const MAX_DICAS = 3;
  const RESULT_MAPA_MS = 11000;  // no modo mapa, o resultado (mapa com os palpites) fica mais tempo
  const BONUS_PRIMEIRO = 30;

  function create(ctx) {
    const S = ctx.settings;
    let fila = [], idx = -1;
    let atual = null;          // { code, estilo, seed, startAt, revealMs, endsAt }
    let sub = 'play';          // play | result
    let dicasDe = {}, tentativas = {}, timer = null, resultado = null;
    let palpites = {};         // modo mapa: pid -> { lon, lat, t, code, dist }
    const modoMapa = () => S.bdMode === 'mapa';
    let saco = [];             // formatos de revelação: todos aparecem antes de repetir
    const proximoEstilo = () => { if (!saco.length) saco = ctx.shuffle(ESTILOS.slice()); return saco.pop(); };

    const clear = () => { if (timer) clearTimeout(timer); timer = null; };
    function dicaTexto(i, p) {
      if (i === 0) return '🌍 Continente: ' + p.continente;
      if (i === 1) return PAISES.norm(p.capital).indexOf(PAISES.norm(p.nome)) >= 0 ? '🏛️ A capital tem o mesmo nome do país' : '🏛️ Capital: ' + p.capital;
      return '⭐ ' + p.curiosidade;
    }
    // dicas são individuais: só quem pediu vê, e só ele perde pontos
    function pontosAgora(pid) {
      if (!atual) return 0;
      const prog = Math.max(0, Math.min(1, (Date.now() - atual.startAt) / atual.revealMs));
      return Math.max(10, Math.round(100 - 50 * prog - 15 * (pid ? dicasDe[pid] || 0 : 0)));
    }
    function flagEvent() {
      return atual ? { code: atual.code, estilo: atual.estilo, seed: atual.seed, elapsedMs: Date.now() - atual.startAt, revealMs: atual.revealMs, idx } : null;
    }
    function proxima() {
      clear();
      idx += 1;
      if (idx >= fila.length) return ctx.finish();
      const p = fila[idx];
      const revealMs = S.bdSpeed * 1000;
      atual = { code: p.code, estilo: proximoEstilo(), seed: Math.floor(Math.random() * 1e9),
        startAt: Date.now() + 1500, revealMs };
      atual.endsAt = atual.startAt + revealMs + EXTRA_MS;
      sub = 'play'; dicasDe = {}; tentativas = {}; resultado = null; palpites = {};
      ctx.broadcastTV('bdFlag', flagEvent());
      timer = setTimeout(() => fim(null), atual.endsAt - Date.now());
      ctx.broadcastState();
    }
    function fimMapa() {
      clear();
      const p = PAISES.porCodigo[atual.code];
      // mais perto primeiro; empate (mesma distância, ex.: todos dentro do país) → quem enviou antes
      const lista = Object.entries(palpites).map(([pid, g]) => Object.assign({ pid, name: ctx.nameOf(pid) }, g))
        .sort((a, b) => (a.dist - b.dist) || (a.t - b.t));
      lista.forEach((g, i) => {
        let pts = Math.max(0, Math.round(100 - g.dist / 40));        // 0 km = 100; 4.000 km ou mais = 0
        if (i === 0 && pts > 0) pts += BONUS_PRIMEIRO;               // quem chegou mais perto ganha bônus
        pts = Math.max(0, pts - 15 * (dicasDe[g.pid] || 0)); g.dicas = dicasDe[g.pid] || 0;
        g.points = pts; g.rank = i + 1; g.dist = Math.round(g.dist);
        if (pts) ctx.addScore(g.pid, pts);
      });
      resultado = { code: p.code, nome: p.nome, capital: p.capital, modo: 'mapa', palpites: lista,
        winner: lista.length && lista[0].points ? lista[0].pid : null, winnerName: lista.length && lista[0].points ? lista[0].name : null,
        points: lista.length ? lista[0].points : 0 };
      sub = 'result';
      ctx.broadcastTV('bdResult', resultado);
      timer = setTimeout(proxima, RESULT_MAPA_MS);
      ctx.broadcastState();
    }
    function fim(winner) {
      if (modoMapa()) return fimMapa();
      clear();
      const p = PAISES.porCodigo[atual.code];
      const pts = winner ? pontosAgora(winner) : 0;
      if (winner) ctx.addScore(winner, pts);
      resultado = { code: p.code, nome: p.nome, capital: p.capital, winner, winnerName: winner ? ctx.nameOf(winner) : null, points: pts };
      sub = 'result';
      ctx.broadcastTV('bdResult', resultado);
      timer = setTimeout(proxima, RESULT_MS);
      ctx.broadcastState();
    }
    function vivos() {
      return ctx.connected().filter(pid => S.bdAttempts === 0 || (tentativas[pid] || 0) < S.bdAttempts);
    }

    return {
      start() {
        // sorteia bandeiras sem repetir na partida
        const todas = ctx.shuffle(PAISES.lista.slice());
        fila = todas.slice(0, Math.min(S.bdFlags, todas.length));
        idx = -1; proxima();
      },
      stop() { clear(); },
      onConnect(client) {
        if (client.role === 'tv' && atual) { ctx.broadcastTV('bdFlag', flagEvent()); if (sub === 'result') ctx.broadcastTV('bdResult', resultado); }
      },
      onPresence() {
        if (sub !== 'play' || !atual || Date.now() < atual.startAt) return;
        if (modoMapa()) { const on = ctx.connected(); if (on.length && on.every(pid => palpites[pid])) fim(null); }
        else if (!vivos().length) fim(null);
      },
      action(pid, a) {
        switch (a.type) {
          case 'bdPin': {             // modo mapa: um palpite por pessoa
            if (!modoMapa() || sub !== 'play' || !atual || Date.now() < atual.startAt || palpites[pid]) return false;
            const lon = Number(a.lon), lat = Number(a.lat);
            if (!isFinite(lon) || !isFinite(lat) || Math.abs(lat) > 90) return false;
            const L = ((lon + 540) % 360) - 180;
            palpites[pid] = { lon: L, lat, t: Date.now(), code: MAPA.paisNoPonto(L, lat, 40), dist: MAPA.distancia(L, lat, atual.code) };
            ctx.broadcastTV('bdPinned', { name: ctx.nameOf(pid) });
            const on = ctx.connected();
            if (on.every(p => palpites[p])) { setTimeout(() => { if (sub === 'play') fim(null); }, 400); }
            return true;
          }
          case 'bdAnswer': {
            if (modoMapa() || sub !== 'play' || !atual || Date.now() < atual.startAt) return false;
            if (S.bdAttempts > 0 && (tentativas[pid] || 0) >= S.bdAttempts) return false;
            const code = String(a.code || '').toLowerCase();
            if (!PAISES.porCodigo[code]) return false;
            if (code === atual.code) { fim(pid); return false; }
            tentativas[pid] = (tentativas[pid] || 0) + 1;
            ctx.broadcastTV('bdWrong', { name: ctx.nameOf(pid), nome: PAISES.porCodigo[code].nome });
            if (!vivos().length) { fim(null); return false; }
            return true;
          }
          case 'bdHint':
            if (sub !== 'play' || !atual || (dicasDe[pid] || 0) >= MAX_DICAS) return false;
            dicasDe[pid] = (dicasDe[pid] || 0) + 1;
            ctx.broadcastTV('bdHint', { by: ctx.nameOf(pid) });       // a TV só avisa; o texto vai só para o celular dele
            return true;
          case 'bdSkip':
            if (pid !== ctx.masterId() || sub !== 'play') return false;
            fim(null); return false;
          default: return false;
        }
      },
      view() {
        const p = atual ? PAISES.porCodigo[atual.code] : null;
        return {
          kind: 'bd', sub, idx: idx + 1, total: fila.length, mode: S.bdMode,
          palpitaram: Object.keys(palpites).length, jogadores: ctx.connected().length,
          startInMs: atual ? Math.max(0, atual.startAt - Date.now()) : 0,
          elapsedMs: atual ? Math.max(0, Date.now() - atual.startAt) : 0,
          revealMs: atual ? atual.revealMs : 0,
          remainingMs: atual && sub === 'play' ? Math.max(0, atual.endsAt - Date.now()) : null,
          maxDicas: MAX_DICAS,
          pontos: sub === 'play' ? pontosAgora(null) : null,
          resultado: sub === 'result' ? resultado : null,
          erros: tentativas,
        };
      },
      playerView(pid) {
        const p = atual ? PAISES.porCodigo[atual.code] : null, n = dicasDe[pid] || 0;
        return { tentativas: tentativas[pid] || 0, max: S.bdAttempts,
          dicas: p && sub === 'play' ? Array.from({ length: n }, (_, i) => dicaTexto(i, p)) : [],
          continente: p && sub === 'play' && n >= 1 ? p.continente : null,     // modo mapa: o celular aproxima nesse continente
          palpite: palpites[pid] ? { lon: palpites[pid].lon, lat: palpites[pid].lat } : null };
      },
    };
  }
  return create;
});
