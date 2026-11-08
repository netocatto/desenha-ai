// =============================================================
//  JOGO DAS BANDEIRAS — regras do jogo
//  A bandeira vai sendo revelada aos poucos na TV (formato sorteado).
//  O primeiro a acertar o país leva os pontos; dicas diminuem os pontos.
// =============================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./paises.js'));
  else { root.DesenhaJogos = root.DesenhaJogos || {}; root.DesenhaJogos.bandeiras = factory(root.PAISES); }
})(this, function (PAISES) {
  'use strict';
  const ESTILOS = ['circulo', 'cortina', 'diagonal', 'persiana', 'mosaico', 'relogio', 'losango', 'furos', 'zoom', 'estrela'];
  const RESULT_MS = 6000;      // tempo mostrando a resposta
  const EXTRA_MS = 10000;      // bandeira inteira na tela antes de acabar a vez
  const MAX_DICAS = 3;

  function create(ctx) {
    const S = ctx.settings;
    let fila = [], idx = -1;
    let atual = null;          // { code, estilo, seed, startAt, revealMs, endsAt }
    let sub = 'play';          // play | result
    let dicas = 0, tentativas = {}, timer = null, resultado = null;
    let saco = [];             // formatos de revelação: todos aparecem antes de repetir
    const proximoEstilo = () => { if (!saco.length) saco = ctx.shuffle(ESTILOS.slice()); return saco.pop(); };

    const clear = () => { if (timer) clearTimeout(timer); timer = null; };
    function dicaTexto(i, p) {
      if (i === 0) return '🌍 Continente: ' + p.continente;
      if (i === 1) return PAISES.norm(p.capital).indexOf(PAISES.norm(p.nome)) >= 0 ? '🏛️ A capital tem o mesmo nome do país' : '🏛️ Capital: ' + p.capital;
      return '⭐ ' + p.curiosidade;
    }
    function pontosAgora() {
      if (!atual) return 0;
      const prog = Math.max(0, Math.min(1, (Date.now() - atual.startAt) / atual.revealMs));
      return Math.max(10, Math.round(100 - 50 * prog - 15 * dicas));
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
      sub = 'play'; dicas = 0; tentativas = {}; resultado = null;
      ctx.broadcastTV('bdFlag', flagEvent());
      timer = setTimeout(() => fim(null), atual.endsAt - Date.now());
      ctx.broadcastState();
    }
    function fim(winner) {
      clear();
      const p = PAISES.porCodigo[atual.code];
      const pts = winner ? pontosAgora() : 0;
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
      onPresence() { if (sub === 'play' && atual && Date.now() > atual.startAt && !vivos().length) fim(null); },
      action(pid, a) {
        switch (a.type) {
          case 'bdAnswer': {
            if (sub !== 'play' || !atual || Date.now() < atual.startAt) return false;
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
            if (sub !== 'play' || !atual || dicas >= MAX_DICAS) return false;
            dicas += 1;
            ctx.broadcastTV('bdHint', { n: dicas, by: ctx.nameOf(pid) });
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
          kind: 'bd', sub, idx: idx + 1, total: fila.length,
          startInMs: atual ? Math.max(0, atual.startAt - Date.now()) : 0,
          elapsedMs: atual ? Math.max(0, Date.now() - atual.startAt) : 0,
          revealMs: atual ? atual.revealMs : 0,
          remainingMs: atual && sub === 'play' ? Math.max(0, atual.endsAt - Date.now()) : null,
          dicas: p ? Array.from({ length: dicas }, (_, i) => dicaTexto(i, p)) : [],
          maxDicas: MAX_DICAS,
          pontos: sub === 'play' ? pontosAgora() : null,
          resultado: sub === 'result' ? resultado : null,
          erros: tentativas,
        };
      },
      playerView(pid) {
        return { tentativas: tentativas[pid] || 0, max: S.bdAttempts };
      },
    };
  }
  return create;
});
