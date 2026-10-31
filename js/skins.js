// Cube skin rendering shared by the menu previews and the live game.
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function makeGradient(ctx, x, y, w, h, a, b) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
}

function drawPattern(ctx, s, cube, t) {
  const c = cube.colors;
  const h = s / 2;
  ctx.save();
  roundRect(ctx, -h + s * 0.09, -h + s * 0.09, s * 0.82, s * 0.82, s * 0.1);
  ctx.clip();

  if (cube.pattern === 'stripes') {
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    ctx.rotate(-0.55);
    for (let x = -s * 1.4; x < s * 1.4; x += s * 0.28) ctx.fillRect(x, -s, s * 0.12, s * 2);
  } else if (cube.pattern === 'dots') {
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    const step = s * 0.2;
    for (let x = -h; x < h; x += step) {
      for (let y = -h; y < h; y += step) {
        ctx.beginPath();
        ctx.arc(x + step / 2, y + step / 2, s * 0.032, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (cube.pattern === 'flame') {
    const g = ctx.createLinearGradient(0, h, 0, h * 0.1);
    g.addColorStop(0, 'rgba(255,238,150,.95)');
    g.addColorStop(0.5, 'rgba(255,120,30,.75)');
    g.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-h, h);
    for (let x = -h; x <= h; x += s * 0.05) {
      const wave = Math.sin(x * 0.28 + t * 3) * s * 0.035;
      ctx.lineTo(x, h * 0.28 + wave + Math.cos(x * 0.15) * s * 0.05);
    }
    ctx.lineTo(h, h);
    ctx.closePath();
    ctx.fill();
  } else if (cube.pattern === 'circuit') {
    ctx.strokeStyle = 'rgba(255,255,255,.65)';
    ctx.lineWidth = Math.max(1.4, s * 0.02);
    ctx.beginPath();
    ctx.moveTo(-h, -s * 0.12);
    ctx.lineTo(-s * 0.1, -s * 0.12);
    ctx.lineTo(-s * 0.1, s * 0.14);
    ctx.lineTo(h, s * 0.14);
    ctx.moveTo(-h, s * 0.2);
    ctx.lineTo(-s * 0.02, s * 0.2);
    ctx.lineTo(-s * 0.02, -s * 0.22);
    ctx.lineTo(h, -s * 0.22);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (const [x, y] of [[-s * 0.1, -s * 0.12], [-s * 0.1, s * 0.14], [-s * 0.02, s * 0.2], [-s * 0.02, -s * 0.22]]) {
      ctx.beginPath();
      ctx.arc(x, y, s * 0.028, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (cube.pattern === 'sparkle') {
    ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.lineWidth = Math.max(1.2, s * 0.017);
    const flakes = [[-s * 0.22, -s * 0.18, 0.7], [s * 0.2, s * 0.05, 0.5], [s * 0.06, -s * 0.27, 0.4], [-s * 0.05, s * 0.25, 0.45]];
    for (const [fx, fy, fs] of flakes) {
      const r = s * 0.11 * fs * 2.2;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(fx - Math.cos(a) * r, fy - Math.sin(a) * r);
        ctx.lineTo(fx + Math.cos(a) * r, fy + Math.sin(a) * r);
        ctx.stroke();
      }
    }
  } else if (cube.pattern === 'rays') {
    ctx.fillStyle = 'rgba(255,255,255,.24)';
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + t * 0.2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
      ctx.lineTo(Math.cos(a + 0.24) * s, Math.sin(a + 0.24) * s);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = c.a;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.16, 0, Math.PI * 2);
    ctx.fill();
  } else if (cube.pattern === 'stars') {
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    for (let i = 0; i < 12; i++) {
      const x = ((i * 37) % 80) / 80 * s - h;
      const y = ((i * 61) % 90) / 90 * s - h;
      const r = i % 3 === 0 ? s * 0.03 : s * 0.015;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(180,150,255,.5)';
    ctx.lineWidth = s * 0.012;
    ctx.beginPath();
    ctx.arc(s * 0.12, -s * 0.12, s * 0.3, 0, Math.PI * 1.6);
    ctx.stroke();
  } else if (cube.pattern === 'prism') {
    const cols = ['rgba(255,110,180,.55)', 'rgba(110,255,230,.55)', 'rgba(160,120,255,.55)'];
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = cols[i % 3];
      ctx.beginPath();
      ctx.moveTo(-h + (i % 3) * s * 0.33, h);
      ctx.lineTo(-h + (i % 3) * s * 0.33 + s * 0.22, -h);
      ctx.lineTo(-h + (i % 3) * s * 0.33 + s * 0.5, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.beginPath();
    ctx.moveTo(-h, -h);
    ctx.lineTo(h, -h);
    ctx.lineTo(-h, h);
    ctx.closePath();
    ctx.fill();
  } else if (cube.pattern === 'rainbow') {
    const hue = (t * 60) % 360;
    const g = ctx.createLinearGradient(-h, -h, h, h);
    for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsl(${(hue + i * 55) % 360},100%,62%)`);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = g;
    ctx.fillRect(-h, -h, s, s);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = s * 0.015;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-h, i * s * 0.18);
      ctx.lineTo(h, i * s * 0.18 - s * 0.2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawFace(ctx, s, cube) {
  const ink = cube.colors.eye || '#10203a';
  const eyeW = s * 0.17;
  const eyeH = s * 0.22;
  const y = -s * 0.06;
  ctx.fillStyle = '#ffffff';
  if (cube.face === 'cool') {
    roundRect(ctx, -s * 0.31, -s * 0.16, s * 0.62, s * 0.15, s * 0.07);
    ctx.fill();
    ctx.fillStyle = ink;
    roundRect(ctx, -s * 0.31, -s * 0.16, s * 0.2, s * 0.15, s * 0.06);
    ctx.fill();
    roundRect(ctx, s * 0.11, -s * 0.16, s * 0.2, s * 0.15, s * 0.06);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = s * 0.02;
    ctx.beginPath();
    ctx.moveTo(-s * 0.31, -s * 0.17);
    ctx.lineTo(s * 0.31, -s * 0.17);
    ctx.stroke();
    ctx.strokeStyle = ink;
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, s * 0.17);
    ctx.lineTo(s * 0.11, s * 0.17);
    ctx.stroke();
    return;
  }
  roundRect(ctx, -s * 0.28, y - eyeH / 2, eyeW, eyeH, s * 0.045);
  ctx.fill();
  roundRect(ctx, s * 0.11, y - eyeH / 2, eyeW, eyeH, s * 0.045);
  ctx.fill();
  ctx.fillStyle = ink;
  const px = s * 0.035;
  if (cube.face === 'wink') {
    roundRect(ctx, -s * 0.245, y - eyeH * 0.34, px, eyeH * 0.62, px / 2);
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = s * 0.026;
    ctx.beginPath();
    ctx.moveTo(s * 0.15, y);
    ctx.quadraticCurveTo(s * 0.205, y - s * 0.07, s * 0.255, y);
    ctx.stroke();
  } else {
    roundRect(ctx, -s * 0.205, y - eyeH * 0.2, px, eyeH * 0.5, px / 2);
    ctx.fill();
    roundRect(ctx, s * 0.17, y - eyeH * 0.2, px, eyeH * 0.5, px / 2);
    ctx.fill();
  }
  if (cube.face === 'determined') {
    ctx.strokeStyle = ink;
    ctx.lineWidth = s * 0.028;
    ctx.beginPath();
    ctx.moveTo(-s * 0.31, y - s * 0.16);
    ctx.lineTo(-s * 0.11, y - s * 0.1);
    ctx.moveTo(s * 0.31, y - s * 0.16);
    ctx.lineTo(s * 0.11, y - s * 0.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, s * 0.19);
    ctx.lineTo(s * 0.12, s * 0.13);
    ctx.stroke();
  } else if (cube.face === 'happy') {
    ctx.strokeStyle = ink;
    ctx.lineWidth = s * 0.028;
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, s * 0.13);
    ctx.quadraticCurveTo(0, s * 0.23, s * 0.12, s * 0.13);
    ctx.stroke();
  } else if (cube.face === 'wink') {
    ctx.strokeStyle = ink;
    ctx.lineWidth = s * 0.026;
    ctx.beginPath();
    ctx.moveTo(-s * 0.09, s * 0.15);
    ctx.quadraticCurveTo(0, s * 0.23, s * 0.13, s * 0.12);
    ctx.stroke();
  }
}

export function drawCube(ctx, cx, cy, size, cube, time = 0, rot = 0, opts = {}) {
  const s = size;
  const h = s / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);

  if (opts.glow !== false) {
    ctx.shadowColor = cube.colors.glow;
    ctx.shadowBlur = s * (opts.glowScale ?? 0.42);
  }
  const body = makeGradient(ctx, -h, -h, s, s, cube.colors.a, cube.colors.b);
  roundRect(ctx, -h, -h, s, s, s * 0.17);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.save();
  roundRect(ctx, -h, -h, s, s, s * 0.17);
  ctx.clip();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(-h, -h);
  ctx.lineTo(h * 0.2, -h);
  ctx.lineTo(-h, h * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  drawPattern(ctx, s, cube, time);
  drawFace(ctx, s, cube);

  roundRect(ctx, -h + s * 0.03, -h + s * 0.03, s * 0.94, s * 0.94, s * 0.15);
  ctx.lineWidth = Math.max(1.6, s * 0.028);
  ctx.strokeStyle = cube.colors.edge;
  ctx.globalAlpha = 0.75;
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.restore();
}

export function drawCubePreview(canvas, cube, size = 96) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  drawCube(ctx, size / 2, size / 2, size * 0.66, cube, 0, -0.08, { glowScale: 0.5 });
}
