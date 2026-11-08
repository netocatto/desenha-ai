// =============================================================
//  MAPA-MÚNDI do Jogo das Bandeiras (modo "marcar no mapa")
//  - decodifica as fronteiras (mapa-dados.js)
//  - descobre em que país caiu um ponto e mede distâncias
//  - desenha o mapa num canvas (celular e TV)
// =============================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./mapa-dados.js'));
  else root.MAPA = factory(root.MAPA_RAW);
})(this, function (RAW) {
  'use strict';
  const TOP = 84, BOTTOM = -58;          // corta a Antártida
  const paises = [];
  const porCodigo = {};
  for (const [code, lx, ly, rings] of RAW || []) {
    if (code === 'aq') continue;
    const rs = rings.map(flat => {
      const pts = []; let x = 0, y = 0;
      for (let i = 0; i < flat.length; i += 2) { x += flat[i]; y += flat[i + 1]; pts.push([x / 100, y / 100]); }
      return pts;
    });
    let minX = 180, minY = 90, maxX = -180, maxY = -90;
    rs.forEach(r => r.forEach(([a, b]) => { if (a < minX) minX = a; if (a > maxX) maxX = a; if (b < minY) minY = b; if (b > maxY) maxY = b; }));
    const p = { code, lx: lx / 100, ly: ly / 100, rings: rs, bbox: [minX, minY, maxX, maxY], path: null };
    paises.push(p);
    if (code && !porCodigo[code]) porCodigo[code] = p; else if (code) porCodigo[code].rings = porCodigo[code].rings.concat(rs);
  }

  function inRing(x, y, r) {
    let c = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c;
    }
    return c;
  }
  const RAD = Math.PI / 180;
  // microestados (Vaticano, Mônaco, San Marino…): somem ao simplificar; viram um círculo em volta do centro
  paises.forEach(p => { const b = p.bbox; p.area = (b[2] - b[0]) * (b[3] - b[1]); p.tiny = p.area < 0.06; });
  const porTamanho = paises.slice().sort((a, b) => a.area - b.area);    // pequenos primeiro
  function contem(p, lon, lat) {
    if (p.tiny) return km(lon, lat, p.lx, p.ly) <= 12;
    const b = p.bbox; if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) return false;
    return p.rings.some(r => inRing(lon, lat, r));
  }
  function km(lon1, lat1, lon2, lat2) {
    const dLat = (lat2 - lat1) * RAD, dLon = (lon2 - lon1) * RAD;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  /** distância (km) de um ponto até a borda de um país; 0 se estiver dentro */
  function distancia(lon, lat, code) {
    const p = porCodigo[code]; if (!p) return 20000;
    if (contem(p, lon, lat)) return 0;
    if (p.tiny) return Math.max(0, km(lon, lat, p.lx, p.ly) - 12);
    let best = 1e9;
    for (const r of p.rings) for (let i = 0; i < r.length; i++) { const d = km(lon, lat, r[i][0], r[i][1]); if (d < best) best = d; }
    return best;
  }
  /** país onde caiu o ponto ('' = território sem código; null = mar). Perto de ilhas pequenas, pega o mais próximo. */
  function paisNoPonto(lon, lat, toleranciaKm) {
    for (const p of porTamanho) if (contem(p, lon, lat)) return p.code;
    if (!toleranciaKm) return null;
    let best = null, bd = toleranciaKm;
    for (const p of paises) {
      const b = p.bbox; if (lon < b[0] - 3 || lon > b[2] + 3 || lat < b[1] - 3 || lat > b[3] + 3) continue;
      for (const r of p.rings) for (const [a, c] of r) { const d = km(lon, lat, a, c); if (d < bd) { bd = d; best = p.code; } }
    }
    return best;
  }

  // ---------------- desenho ----------------
  // projeção equiretangular: x = lon, y = -lat (em graus); a "vista" escala e desloca
  function caminho(p) {
    if (p.path) return p.path;
    const path = new Path2D();
    for (const r of p.rings) { path.moveTo(r[0][0], -r[0][1]); for (let i = 1; i < r.length; i++) path.lineTo(r[i][0], -r[i][1]); path.closePath(); }
    p.path = path; return path;
  }
  /** vista que encaixa um retângulo [lon0, lat0, lon1, lat1] no canvas w x h */
  function encaixar(w, h, box, margem) {
    const m = margem == null ? 0.08 : margem;
    const bw = Math.max(2, box[2] - box[0]), bh = Math.max(2, box[3] - box[1]);
    const s = Math.min(w / (bw * (1 + 2 * m)), h / (bh * (1 + 2 * m)));
    return { s, cx: (box[0] + box[2]) / 2, cy: -(box[1] + box[3]) / 2 };
  }
  function mundo(w, h) { return encaixar(w, h, [-170, BOTTOM, 190, TOP], 0.01); }
  function telaParaGeo(v, w, h, x, y) { return [(x - w / 2) / v.s + v.cx, -((y - h / 2) / v.s + v.cy)]; }
  function geoParaTela(v, w, h, lon, lat) { return [(lon - v.cx) * v.s + w / 2, (-lat - v.cy) * v.s + h / 2]; }
  /**
   * desenha o mapa. opts: { destaque: código, corDestaque, certo: código, pinos: [{lon,lat,cor,rotulo}] }
   */
  function desenhar(g, w, h, v, opts) {
    opts = opts || {};
    g.save();
    g.fillStyle = '#1d4e89'; g.fillRect(0, 0, w, h);                 // mar
    g.translate(w / 2, h / 2); g.scale(v.s, v.s); g.translate(-v.cx, -v.cy);
    // repete o mundo para os lados (arrastar além de 180°)
    for (const off of [-360, 0, 360]) {
      const x0 = (-w / 2) / v.s + v.cx - off, x1 = (w / 2) / v.s + v.cx - off;
      if (x1 < -180 || x0 > 180) continue;
      g.save(); g.translate(off, 0);
      for (const p of paises) {
        const path = caminho(p);
        g.fillStyle = p.code && p.code === opts.certo ? '#3ee08f' : (p.code && p.code === opts.destaque ? (opts.corDestaque || '#ffd23f') : '#efe6cf');
        g.fill(path);
      }
      g.lineWidth = 0.8 / v.s;                                           // fronteira com ~1 pixel
      g.strokeStyle = '#6b5b45'; g.lineJoin = 'round';
      for (const p of paises) g.stroke(caminho(p));
      // países muito pequenos: um círculo para conseguir ver e tocar
      for (const p of paises) {
        const b = p.bbox;
        if ((b[2] - b[0]) * v.s < 5 && (b[3] - b[1]) * v.s < 5 && p.code) {
          g.beginPath(); g.arc(p.lx, -p.ly, 3.5 / v.s, 0, Math.PI * 2);
          g.fillStyle = p.code === opts.certo ? '#3ee08f' : (p.code === opts.destaque ? (opts.corDestaque || '#ffd23f') : 'rgba(239,230,207,.9)');
          g.fill(); g.lineWidth = 1 / v.s; g.stroke();
        }
      }
      g.restore();
    }
    g.restore();
    for (const pin of opts.pinos || []) {
      const [x, y] = geoParaTela(v, w, h, pin.lon, pin.lat);
      const r = pin.raio || 9;
      g.beginPath(); g.moveTo(x, y); g.arc(x, y - r * 1.8, r, Math.PI * 0.75, Math.PI * 2.25); g.closePath();
      g.fillStyle = pin.cor || '#ff5d8f'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#1b1440'; g.stroke();
      g.beginPath(); g.arc(x, y - r * 1.8, r * 0.38, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
      if (pin.rotulo) {
        g.font = `800 ${Math.round(r * 1.5)}px 'Baloo 2', system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'bottom';
        g.lineWidth = 4; g.strokeStyle = '#1b1440'; g.strokeText(pin.rotulo, x, y - r * 3);
        g.fillStyle = '#fff'; g.fillText(pin.rotulo, x, y - r * 3);
      }
    }
  }

  return { paises, porCodigo, contem, distancia, paisNoPonto, km, desenhar, encaixar, mundo, telaParaGeo, geoParaTela, TOP, BOTTOM };
});
