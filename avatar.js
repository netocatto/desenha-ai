// =============================================================
//  DESENHA AÍ! — avatar 32 bits a partir de uma selfie
//  Tudo acontece no celular: a foto nunca sai do aparelho,
//  só o personagem pronto (32x32 pixels) é enviado ao jogo.
// =============================================================
window.Avatar = (function () {
  'use strict';
  const S = 32;                                   // tamanho do sprite
  const OUTLINE = [27, 20, 64];                   // contorno escuro (cor do jogo)
  const SHIRTS = [[255, 93, 143], [61, 219, 217], [255, 210, 63], [62, 224, 143], [167, 139, 250], [251, 146, 60], [96, 165, 250]];

  // ---------------- processamento de imagem ----------------
  function kmeans(px, k) {
    // px: array de [r,g,b]; devolve paleta k cores
    const sample = px.filter((_, i) => i % 2 === 0);
    let cent = [];
    for (let i = 0; i < k; i++) cent.push(sample[Math.floor((i + 0.5) * sample.length / k)].slice());
    for (let it = 0; it < 10; it++) {
      const sum = cent.map(() => [0, 0, 0, 0]);
      for (const p of sample) {
        let bi = 0, bd = 1e9;
        for (let c = 0; c < cent.length; c++) {
          const d = (p[0] - cent[c][0]) ** 2 + (p[1] - cent[c][1]) ** 2 + (p[2] - cent[c][2]) ** 2;
          if (d < bd) { bd = d; bi = c; }
        }
        const s = sum[bi]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
      }
      cent = cent.map((c, i) => sum[i][3] ? [sum[i][0] / sum[i][3], sum[i][1] / sum[i][3], sum[i][2] / sum[i][3]] : c);
    }
    return cent.map(c => c.map(Math.round));
  }
  function nearest(p, pal) {
    let bi = 0, bd = 1e9;
    for (let c = 0; c < pal.length; c++) {
      const d = (p[0] - pal[c][0]) ** 2 + (p[1] - pal[c][1]) ** 2 + (p[2] - pal[c][2]) ** 2;
      if (d < bd) { bd = d; bi = c; }
    }
    return pal[bi];
  }
  function boost(r, g, b) {
    // mais contraste e saturação: visual de jogo
    const gray = 0.3 * r + 0.59 * g + 0.11 * b;
    let o = [r, g, b].map(v => gray + (v - gray) * 1.35);
    o = o.map(v => (v - 128) * 1.15 + 128 + 6);
    return o.map(v => Math.max(0, Math.min(255, Math.round(v))));
  }

  /**
   * Gera o personagem.
   * src: imagem/vídeo/canvas ; sw, sh: tamanho da fonte ; gender: 'm' | 'f' ; mirror: espelhar (selfie)
   */
  function make(src, sw, sh, gender, mirror) {
    const fem = gender === 'f';
    // área do rosto dentro do sprite
    const FW = fem ? 24 : 22, FH = fem ? 25 : 24;
    const FX = Math.round((S - FW) / 2), FY = 1;
    // recorte justo no contorno do guia (rosto um pouco acima do meio)
    const cw = Math.min(sw, sh * 0.75) * (fem ? 0.66 : 0.6), ch = cw * FH / FW;
    const cx = (sw - cw) / 2, cy = Math.max(0, Math.min(sh - ch, sh * 0.43 - ch / 2));

    const fc = document.createElement('canvas'); fc.width = FW; fc.height = FH;
    const fx = fc.getContext('2d');
    fx.imageSmoothingEnabled = true; fx.imageSmoothingQuality = 'high';
    if (mirror) { fx.translate(FW, 0); fx.scale(-1, 1); }
    fx.drawImage(src, cx, cy, cw, ch, 0, 0, FW, FH);
    const fd = fx.getImageData(0, 0, FW, FH).data;
    // realça olhos, sobrancelhas e boca: pixel bem mais escuro que a vizinhança fica ainda mais escuro
    const lum = (i) => 0.3 * fd[i] + 0.59 * fd[i + 1] + 0.11 * fd[i + 2];
    const L = new Float32Array(FW * FH);
    for (let i = 0; i < FW * FH; i++) L[i] = lum(i * 4);
    for (let y = 1; y < FH - 1; y++) for (let x = 1; x < FW - 1; x++) {
      let sum = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += L[(y + dy) * FW + x + dx];
      const diff = sum / 9 - L[y * FW + x];
      if (diff > 10) { const k = Math.max(0.35, 1 - diff / 45); const i = (y * FW + x) * 4; fd[i] *= k; fd[i + 1] *= k; fd[i + 2] *= k; }
    }

    // máscara do rosto: oval (masculino) ou oval com cabelo caindo nas laterais (feminino)
    const inside = (x, y) => {
      const nx = (x + 0.5 - FW / 2) / (FW / 2), ny = (y + 0.5 - FH * 0.47) / (FH * 0.5);
      if (nx * nx + ny * ny <= 1) return true;
      if (fem && ny > 0 && Math.abs(nx) <= 0.98 && y < FH - 1) return true;    // cabelo nas laterais
      return false;
    };
    const px = [], cells = [];
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      if (!inside(x, y)) continue;
      const i = (y * FW + x) * 4;
      const p = boost(fd[i], fd[i + 1], fd[i + 2]);
      px.push(p); cells.push([x, y, p]);
    }
    const pal = kmeans(px, 11);

    // tom de pele ≈ média do centro do rosto (para o pescoço)
    let sk = [0, 0, 0], n = 0;
    for (const [x, y, p] of cells) if (Math.abs(x - FW / 2) < FW * 0.18 && y > FH * 0.45 && y < FH * 0.7) { sk[0] += p[0]; sk[1] += p[1]; sk[2] += p[2]; n++; }
    sk = n ? nearest(sk.map(v => v / n), pal) : [224, 172, 140];

    // monta o sprite 32x32
    const grid = [];
    for (let y = 0; y < S; y++) { grid.push(new Array(S).fill(null)); }
    const shirt = SHIRTS[Math.floor(Math.random() * SHIRTS.length)];
    const shirtDark = shirt.map(v => Math.round(v * 0.7));
    // ombros
    for (let y = 25; y < S; y++) {
      const half = Math.min(15, 8 + (y - 25) * 2);
      for (let x = 16 - half; x < 16 + half; x++) if (x >= 0 && x < S) grid[y][x] = shirt;
    }
    // pescoço
    for (let y = 22; y < 27; y++) for (let x = 13; x < 19; x++) grid[y][x] = sk;
    // gola: V (masculino) ou decote redondo (feminino)
    if (fem) {
      for (let x = 12; x < 20; x++) { const d = Math.abs(x - 15.5); for (let y = 25; y < 27 + (d < 2.5 ? 1 : 0); y++) grid[y][x] = sk; }
      grid[28][14] = grid[28][17] = [255, 255, 255];                 // colar
    } else {
      for (let k = 0; k < 4; k++) { grid[25 + k][14 + Math.floor(k / 2)] = sk; grid[25 + k][17 - Math.floor(k / 2)] = sk; grid[25 + k][15] = grid[25 + k][16] = sk; }
      for (let k = 0; k < 3; k++) { grid[25 + k][12 + k] = shirtDark; grid[25 + k][19 - k] = shirtDark; }
    }
    // rosto por cima
    for (const [x, y, p] of cells) grid[FY + y][FX + x] = nearest(p, pal);
    // contorno de 1 pixel
    const out = grid.map(r => r.slice());
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (grid[y][x]) continue;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => grid[y + dy] && grid[y + dy][x + dx]);
      if (nb) out[y][x] = OUTLINE;
    }
    const c = document.createElement('canvas'); c.width = S; c.height = S;
    const cx2 = c.getContext('2d'); const img = cx2.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const p = out[y][x]; if (!p) continue;
      const i = (y * S + x) * 4; img.data[i] = p[0]; img.data[i + 1] = p[1]; img.data[i + 2] = p[2]; img.data[i + 3] = 255;
    }
    cx2.putImageData(img, 0, 0);
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
  .avres { width: min(60vw, 240px); height: min(60vw, 240px); image-rendering: pixelated; image-rendering: crisp-edges; background: #2f2470; border-radius: 22px; }
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
