// =============================================================
//  DESENHA AÍ! — avatar 32 bits a partir de uma selfie
//  Tudo acontece no celular: a foto nunca sai do aparelho,
//  só o personagem pronto (32x32 pixels) é enviado ao jogo.
// =============================================================
window.Avatar = (function () {
  'use strict';
  const S = 32;                                   // tamanho do sprite
  const hex = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  // Paleta clássica de pixel-art (DawnBringer 32) — é o que dá a "cara de videogame"
  const DB32 = ['000000', '222034', '45283c', '663931', '8f563b', 'df7126', 'd9a066', 'eec39a', 'fbf236', '99e550', '6abe30',
    '37946e', '4b692f', '524b24', '323c39', '3f3f74', '306082', '5b6ee1', '639bff', '5fcde4', 'cbdbfc', 'ffffff', '9badb7',
    '847e87', '696a6a', '595652', '76428a', 'ac3232', 'd95763', 'd77bba', '8f974a', '8a6f30'].map(hex);
  const INK = hex('222034');                      // contorno
  const WHITE = hex('ffffff');
  // roupas e cards: pares [claro, escuro] dentro da paleta
  const OUTFITS = [['d95763', 'ac3232'], ['639bff', '5b6ee1'], ['99e550', '6abe30'], ['fbf236', 'df7126'], ['d77bba', '76428a'], ['5fcde4', '306082'], ['df7126', '8a6f30']].map(p => p.map(hex));
  const CARDS = [['3f3f74', '222034'], ['306082', '3f3f74'], ['76428a', '45283c'], ['37946e', '323c39'], ['ac3232', '45283c']].map(p => p.map(hex));

  const lumOf = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  function nearest(p, pal) {
    // distância com peso perceptivo (o olho é mais sensível ao verde)
    let bi = 0, bd = 1e12;
    for (let c = 0; c < pal.length; c++) {
      const dr = p[0] - pal[c][0], dg = p[1] - pal[c][1], db = p[2] - pal[c][2];
      const rm = (p[0] + pal[c][0]) / 2;
      const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
      if (d < bd) { bd = d; bi = c; }
    }
    return pal[bi];
  }
  // tom mais escuro da paleta com a mesma "família" de cor (para sombras em blocos)
  const shadeCache = new Map();
  function hue(c) {
    const [r, g, b] = c.map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (d < 0.08) return null;                                   // cinza: sem matiz
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  }
  function darker(c) {
    const k = c.join(',');
    if (!shadeCache.has(k)) {
      const target = c.map(v => v * 0.68), h = hue(c);
      let cands = DB32.filter(q => lumOf(q) < lumOf(c) - 12);
      if (h !== null) {                                          // mesma família de cor (pele não vira verde)
        const same = cands.filter(q => { const hq = hue(q); return hq !== null && Math.min(Math.abs(hq - h), 360 - Math.abs(hq - h)) < 35; });
        if (same.length) cands = same;
      }
      shadeCache.set(k, cands.length ? nearest(target, cands) : INK);
    }
    return shadeCache.get(k);
  }
  function sat(r, g, b, k) { const gray = lumOf([r, g, b]); return [r, g, b].map(v => gray + (v - gray) * k); }

  /**
   * Gera o personagem.
   * src: imagem/vídeo/canvas ; sw, sh: tamanho da fonte ; gender: 'm' | 'f' ; mirror: espelhar (selfie)
   */
  function make(src, sw, sh, gender, mirror) {
    const fem = gender === 'f';
    const FW = fem ? 22 : 20, FH = fem ? 23 : 22;            // área do rosto no sprite
    const FX = Math.round((S - FW) / 2), FY = 2;
    // recorte justo no contorno do guia
    const cw = Math.min(sw, sh * 0.75) * (fem ? 0.66 : 0.6), ch = cw * FH / FW;
    const cx = (sw - cw) / 2, cy = Math.max(0, Math.min(sh - ch, sh * 0.43 - ch / 2));

    const fc = document.createElement('canvas'); fc.width = FW; fc.height = FH;
    const fx = fc.getContext('2d');
    fx.imageSmoothingEnabled = true; fx.imageSmoothingQuality = 'high';
    if (mirror) { fx.translate(FW, 0); fx.scale(-1, 1); }
    fx.drawImage(src, cx, cy, cw, ch, 0, 0, FW, FH);
    const fd = fx.getImageData(0, 0, FW, FH).data;
    const N = FW * FH;

    // 1) nivela a luz (foto escura/clara vira foto equilibrada)
    const L = new Float32Array(N);
    for (let i = 0; i < N; i++) L[i] = lumOf([fd[i * 4], fd[i * 4 + 1], fd[i * 4 + 2]]);
    const sorted = Array.from(L).sort((a, b) => a - b);
    const lo = sorted[Math.floor(N * 0.04)], hi = sorted[Math.floor(N * 0.96)];
    const scale = 215 / Math.max(40, hi - lo);
    // 2) traços do rosto (olhos, sobrancelhas, boca) ficam mais marcados
    const feat = new Float32Array(N);
    for (let y = 1; y < FH - 1; y++) for (let x = 1; x < FW - 1; x++) {
      let sum = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += L[(y + dy) * FW + x + dx];
      feat[y * FW + x] = sum / 9 - L[y * FW + x];
    }
    const col = new Array(N);
    for (let i = 0; i < N; i++) {
      let c = [fd[i * 4], fd[i * 4 + 1], fd[i * 4 + 2]].map(v => (v - lo) * scale * 0.88 + 48);   // escuros não viram preto
      c = sat(c[0], c[1], c[2], 1.45);
      if (feat[i] > 9) { const k = Math.max(0.3, 1 - feat[i] / 40); c = c.map(v => v * k); }
      col[i] = c.map(v => Math.max(0, Math.min(255, v)));
    }

    // máscara: oval (masculino) ou oval com cabelo nas laterais (feminino)
    const inside = (x, y) => {
      const nx = (x + 0.5 - FW / 2) / (FW / 2), ny = (y + 0.5 - FH * 0.47) / (FH * 0.5);
      if (nx * nx + ny * ny <= 1) return true;
      if (fem && ny > 0 && Math.abs(nx) <= 0.98 && y < FH - 1) return true;
      return false;
    };

    // 3) cores da paleta clássica
    const face = [];
    for (let y = 0; y < FH; y++) { face.push([]); for (let x = 0; x < FW; x++) face[y].push(inside(x, y) ? nearest(col[y * FW + x], DB32) : null); }
    // 4) limpeza: pixel solto vira a cor dos vizinhos (visual de sprite desenhado à mão)
    for (let pass = 0; pass < 2; pass++) for (let y = 1; y < FH - 1; y++) for (let x = 1; x < FW - 1; x++) {
      const c = face[y][x]; if (!c) continue;
      const nb = [face[y - 1][x], face[y + 1][x], face[y][x - 1], face[y][x + 1]].filter(Boolean);
      if (nb.length < 3 || nb.some(q => q === c)) continue;
      const cnt = new Map(); nb.forEach(q => cnt.set(q, (cnt.get(q) || 0) + 1));
      const best = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0];
      if (best[1] >= 2 && Math.abs(lumOf(best[0]) - lumOf(c)) < 60) face[y][x] = best[0];
    }
    // 5) sombra em blocos: lado direito e queixo um tom abaixo (luz vindo da esquerda)
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      const c = face[y][x]; if (!c) continue;
      const edgeR = !(face[y][x + 1]) || !(face[y][x + 2]);
      const chin = y > FH * 0.75 && !(face[y + 1] && face[y + 1][x]);
      if ((edgeR || chin) && lumOf(c) > 70) face[y][x] = darker(c);
    }
    // 6) brilho nos olhos: ponto mais escuro em cada lado, na altura dos olhos
    const eyeY0 = Math.round(FH * 0.36), eyeY1 = Math.round(FH * 0.55);
    for (const [x0, x1] of [[Math.round(FW * 0.18), Math.round(FW * 0.46)], [Math.round(FW * 0.54), Math.round(FW * 0.82)]]) {
      let best = null, bl = 1e9, sum = 0, n = 0;
      for (let y = eyeY0; y <= eyeY1; y++) for (let x = x0; x <= x1; x++) {
        const c = face[y] && face[y][x]; if (!c) continue;
        const l = lumOf(c); sum += l; n++;
        if (l < bl) { bl = l; best = [x, y]; }
      }
      if (best && n && bl < sum / n - 35) {
        const [ex, ey] = best;
        face[ey][ex] = INK;                                            // pupila
        if (face[ey - 1] && face[ey - 1][ex]) face[ey - 1][ex] = WHITE;  // brilho em cima (estilo personagem de jogo)
      }
    }

    // tom de pele do centro do rosto (para o pescoço)
    let sk = null; { const cnt = new Map();
      for (let y = Math.round(FH * 0.5); y < Math.round(FH * 0.75); y++) for (let x = Math.round(FW * 0.35); x < Math.round(FW * 0.65); x++) { const c = face[y][x]; if (c && lumOf(c) > 90) cnt.set(c, (cnt.get(c) || 0) + 1); }
      sk = cnt.size ? [...cnt.entries()].sort((a, b) => b[1] - a[1])[0][0] : hex('eec39a'); }
    const skD = darker(sk);

    // ---------- monta o sprite ----------
    const grid = []; for (let y = 0; y < S; y++) grid.push(new Array(S).fill(null));
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const [cardL, cardD] = pick(CARDS);
    const [shirt, shirtD] = pick(OUTFITS);
    // card de fundo com cantos arredondados e degradê em blocos
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const cx2 = Math.min(x, S - 1 - x), cy2 = Math.min(y, S - 1 - y);
      if (cx2 + cy2 < 3) continue;                                     // cantos
      grid[y][x] = (y < S * 0.55) ? cardL : cardD;
    }
    const body = []; for (let y = 0; y < S; y++) body.push(new Array(S).fill(null));
    // ombros com luz (esquerda) e sombra (direita)
    for (let y = 25; y < S; y++) {
      const half = Math.min(14, 8 + (y - 25) * 2);
      for (let x = 16 - half; x < 16 + half; x++) if (x >= 1 && x < S - 1) body[y][x] = x > 18 ? shirtD : shirt;
    }
    // pescoço com sombra embaixo do queixo
    for (let y = 22; y < 27; y++) for (let x = 13; x < 19; x++) body[y][x] = (y < 24 || x > 17) ? skD : sk;
    if (fem) {
      for (let x = 12; x < 20; x++) { const d = Math.abs(x - 15.5); for (let y = 25; y < 27 + (d < 2.5 ? 1 : 0); y++) body[y][x] = x > 17 ? skD : sk; }
      body[28][14] = body[28][17] = WHITE; body[29][15] = body[29][16] = hex('fbf236');   // colar
    } else {
      for (let k = 0; k < 4; k++) { body[25 + k][14 + Math.floor(k / 2)] = sk; body[25 + k][17 - Math.floor(k / 2)] = skD; body[25 + k][15] = body[25 + k][16] = sk; }
      for (let k = 0; k < 3; k++) { body[25 + k][12 + k] = shirtD; body[25 + k][19 - k] = shirtD; }
    }
    // emblema no peito (estrela de 3x3)
    [[24, 29], [23, 30], [24, 30], [25, 30], [24, 31]].forEach(([x, y]) => { if (y < S && body[y][x]) body[y][x] = hex('fbf236'); });
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) if (face[y][x]) body[FY + y][FX + x] = face[y][x];
    // contorno grosso só em volta do personagem
    const char = body.map(r => r.slice());
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (body[y][x]) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => body[y + dy] && body[y + dy][x + dx])) char[y][x] = INK;
    }
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (char[y][x] && grid[y][x]) grid[y][x] = char[y][x];

    const c = document.createElement('canvas'); c.width = S; c.height = S;
    const g2 = c.getContext('2d'); const img = g2.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const p = grid[y][x]; if (!p) continue;
      const i = (y * S + x) * 4; img.data[i] = p[0]; img.data[i + 1] = p[1]; img.data[i + 2] = p[2]; img.data[i + 3] = 255;
    }
    g2.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }

  // ---------------- interface de captura ----------------
  const CSS = `
  .avcam { position: fixed; inset: 0; z-index: 50; background: #1b1440; color: #fff; display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 14px; padding: 16px; font-family: 'Baloo 2', system-ui, sans-serif; }
  .avcam h2 { margin: 0; font-size: 24px; text-align: center; }
  .avcam p { margin: 0; color: #b9b0e6; text-align: center; }
  .avstage { position: relative; width: min(78vw, 46vh); aspect-ratio: 3/4; border-radius: 22px; overflow: hidden; background: #000; }
  .avstage video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
  .avstage svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .avres { width: min(60vw, 240px); height: min(60vw, 240px); image-rendering: pixelated; image-rendering: crisp-edges; }
  .avrow { display: flex; gap: 10px; width: min(90vw, 380px); }
  .avbtn { flex: 1; font: inherit; font-weight: 800; font-size: 19px; border: 0; border-radius: 16px; padding: 13px 10px; background: #ffd23f; color: #1b1440; box-shadow: 0 5px 0 rgba(0,0,0,.35); }
  .avbtn.ghost { background: transparent; color: #b9b0e6; border: 2px solid #2f2470; box-shadow: none; }
  .avbtn.green { background: #3ee08f; }`;

  function open(gender) {
    return new Promise((resolve) => {
      if (!document.getElementById('avcss')) { const st = document.createElement('style'); st.id = 'avcss'; st.textContent = CSS; document.head.appendChild(st); }
      const box = document.createElement('div'); box.className = 'avcam'; document.body.appendChild(box);
      let stream = null, lastSrc = null;
      const stop = () => { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; };
      const finish = (v) => { stop(); box.remove(); resolve(v); };

      function showResult(url, retry) {
        box.innerHTML = `<h2>Seu personagem</h2><img class="avres" alt="avatar"><p>Gostou? Ele vai aparecer na TV.</p>
          <div class="avrow"><button class="avbtn ghost" data-a="retry">↺ Tirar outra</button><button class="avbtn green" data-a="ok">✔ Usar este</button></div>
          <div class="avrow"><button class="avbtn ghost" data-a="cancel">Cancelar</button></div>`;
        box.querySelector('img').src = url;
        box.querySelector('[data-a=ok]').onclick = () => finish(url);
        box.querySelector('[data-a=retry]').onclick = retry;
        box.querySelector('[data-a=cancel]').onclick = () => finish(null);
      }

      // Plano A: câmera dentro da página (precisa de https)
      function live() {
        box.innerHTML = `<h2>Encaixe o rosto no contorno</h2>
          <div class="avstage"><video playsinline autoplay muted></video>
          <svg viewBox="0 0 300 400"><defs><mask id="m"><rect width="300" height="400" fill="#fff"/><ellipse cx="150" cy="168" rx="105" ry="135" fill="#000"/></mask></defs>
          <rect width="300" height="400" fill="rgba(27,20,64,.55)" mask="url(#m)"/><ellipse cx="150" cy="168" rx="105" ry="135" fill="none" stroke="#ffd23f" stroke-width="4" stroke-dasharray="12 8"/></svg></div>
          <p>Fique num lugar iluminado 💡</p>
          <div class="avrow"><button class="avbtn ghost" data-a="cancel">Cancelar</button><button class="avbtn" data-a="snap">📸 Tirar foto</button></div>`;
        const video = box.querySelector('video');
        box.querySelector('[data-a=cancel]').onclick = () => finish(null);
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 1280 } }, audio: false })
          .then((s) => { stream = s; video.srcObject = s; })
          .catch(() => { stop(); filePicker(); });
        box.querySelector('[data-a=snap]').onclick = () => {
          if (!video.videoWidth) return;
          // o vídeo aparece cortado em 3:4 (object-fit: cover): recorta igual
          const vw = video.videoWidth, vh = video.videoHeight, target = 3 / 4;
          let w = vw, h = vh; if (vw / vh > target) w = vh * target; else h = vw / target;
          const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h);
          c.getContext('2d').drawImage(video, (vw - w) / 2, (vh - h) / 2, w, h, 0, 0, c.width, c.height);
          lastSrc = c; stop();
          showResult(make(c, c.width, c.height, gender, true), live);
        };
      }

      // Plano B: abre o app de câmera do celular (funciona em http na rede local)
      function filePicker() {
        box.innerHTML = `<h2>Tire uma selfie</h2><p>Segure o celular de pé, com o rosto no centro da foto.</p>
          <input type="file" accept="image/*" capture="user" hidden>
          <div class="avrow"><button class="avbtn" data-a="cam">📷 Abrir câmera</button></div>
          <div class="avrow"><button class="avbtn ghost" data-a="cancel">Cancelar</button></div>`;
        const inp = box.querySelector('input');
        box.querySelector('[data-a=cam]').onclick = () => inp.click();
        box.querySelector('[data-a=cancel]').onclick = () => finish(null);
        inp.onchange = () => {
          const f = inp.files && inp.files[0]; if (!f) return;
          const img = new Image();
          img.onload = () => { URL.revokeObjectURL(img.src); showResult(make(img, img.naturalWidth, img.naturalHeight, gender, false), filePicker); };
          img.onerror = () => { box.querySelector('p').textContent = 'Não consegui ler a foto. Tente de novo.'; };
          img.src = URL.createObjectURL(f);
        };
      }

      if (window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) live(); else filePicker();
    });
  }

  return { open, make };
})();
