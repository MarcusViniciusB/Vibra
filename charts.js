/* Vibra 0.6 — gráficos em canvas, sem dependências.
   Linha temporal (deslocamento), barras (espectro) e mensagens de vazio.
   Cores lidas das variáveis CSS para manter um único design system. */
(function (root) {
  'use strict';

  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const palette = () => ({
    grid: '#eef0f3', axis: css('--line-2'), text: css('--muted'), label: css('--muted'),
    data: css('--accent'), band: 'rgba(43,75,163,.07)', peak: css('--ok'), head: css('--marker')
  });
  const fmt = (v, d = 2) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: d, minimumFractionDigits: 0 }).format(v);

  /** Ajusta o buffer ao tamanho exibido × devicePixelRatio e devolve o contexto em px CSS. */
  function setup(canvas) {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = Math.max(200, Math.round(canvas.clientWidth || canvas.width));
    const h = Math.max(80, Math.round(canvas.clientHeight || canvas.height));
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    const x = canvas.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, w, h);
    return { x, w, h };
  }

  function empty(canvas, message) {
    const { x, w, h } = setup(canvas), c = palette();
    x.fillStyle = c.text; x.font = '400 12.5px "IBM Plex Sans", system-ui, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(message, w / 2, h / 2);
  }

  function niceStep(range, ticks) {
    const raw = range / ticks, mag = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / mag;
    return (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag;
  }

  function frame(x, w, h, pad, xMin, xMax, yMin, yMax, xUnit, yUnit) {
    const c = palette(), X = v => pad.l + (v - xMin) / (xMax - xMin) * (w - pad.l - pad.r),
      Y = v => h - pad.b - (v - yMin) / (yMax - yMin) * (h - pad.t - pad.b);
    x.font = '400 10.5px "IBM Plex Mono", ui-monospace, monospace'; x.lineWidth = 1;
    const ys = niceStep(yMax - yMin, 4);
    x.textAlign = 'right'; x.textBaseline = 'middle';
    for (let v = Math.ceil(yMin / ys) * ys; v <= yMax + 1e-9; v += ys) {
      x.strokeStyle = Math.abs(v) < 1e-9 ? c.axis : c.grid;
      x.beginPath(); x.moveTo(pad.l, Y(v)); x.lineTo(w - pad.r, Y(v)); x.stroke();
      x.fillStyle = c.text; x.fillText(fmt(v, 3), pad.l - 6, Y(v));
    }
    const xs = niceStep(xMax - xMin, Math.max(3, Math.floor((w - pad.l - pad.r) / 80)));
    x.textAlign = 'center'; x.textBaseline = 'top';
    for (let v = Math.ceil(xMin / xs) * xs; v <= xMax + 1e-9; v += xs) {
      x.strokeStyle = c.grid; x.beginPath(); x.moveTo(X(v), pad.t); x.lineTo(X(v), h - pad.b); x.stroke();
      x.fillStyle = c.text; x.fillText(fmt(v, 2), X(v), h - pad.b + 6);
    }
    x.fillStyle = c.label; x.textAlign = 'right'; x.fillText(xUnit, w - pad.r, h - 14);
    x.textAlign = 'left'; x.textBaseline = 'top'; x.fillText(yUnit, pad.l + 4, 4);
    return { X, Y };
  }

  /** Série temporal com cursor no quadro atual. */
  function line(canvas, { t, y, head = -1, yUnit = 'px', xUnit = 's' }) {
    const { x, w, h } = setup(canvas), c = palette(), pad = { l: 52, r: 12, t: 22, b: 28 };
    let m = 0; for (const v of y) m = Math.max(m, Math.abs(v));
    m = m > 0 ? m * 1.15 : 1;
    const { X, Y } = frame(x, w, h, pad, t[0], t[t.length - 1], -m, m, xUnit, yUnit);
    x.save(); x.beginPath(); x.rect(pad.l, pad.t, w - pad.l - pad.r, h - pad.t - pad.b); x.clip();
    const g = x.createLinearGradient(0, pad.t, 0, h - pad.b);
    g.addColorStop(0, 'rgba(43,75,163,.10)'); g.addColorStop(.5, 'rgba(43,75,163,0)'); g.addColorStop(1, 'rgba(43,75,163,.10)');
    x.beginPath(); x.moveTo(X(t[0]), Y(0));
    y.forEach((v, i) => x.lineTo(X(t[i]), Y(v)));
    x.lineTo(X(t[t.length - 1]), Y(0)); x.closePath(); x.fillStyle = g; x.fill();
    x.beginPath(); y.forEach((v, i) => i ? x.lineTo(X(t[i]), Y(v)) : x.moveTo(X(t[i]), Y(v)));
    x.strokeStyle = c.data; x.lineWidth = 1.5; x.lineJoin = 'round'; x.stroke();
    if (head >= 0 && head < y.length) {
      x.strokeStyle = c.head; x.lineWidth = 1; x.setLineDash([3, 3]);
      x.beginPath(); x.moveTo(X(t[head]), pad.t); x.lineTo(X(t[head]), h - pad.b); x.stroke(); x.setLineDash([]);
      x.fillStyle = c.head; x.beginPath(); x.arc(X(t[head]), Y(y[head]), 3.5, 0, Math.PI * 2); x.fill();
    }
    x.restore();
  }

  /** Espectro de amplitude com faixa de passagem destacada e pico marcado. */
  function bars(canvas, { f, a, lo, hi, peak = -1, yUnit = 'px' }) {
    const { x, w, h } = setup(canvas), c = palette(), pad = { l: 52, r: 12, t: 22, b: 28 };
    let m = 0; for (const v of a) m = Math.max(m, v); m = m > 0 ? m * 1.18 : 1;
    const fMax = f[f.length - 1];
    const { X, Y } = frame(x, w, h, pad, 0, fMax, 0, m, 'Hz', yUnit);
    x.fillStyle = c.band; x.fillRect(X(Math.max(0, lo)), pad.t, X(Math.min(fMax, hi)) - X(Math.max(0, lo)), h - pad.t - pad.b);
    const bw = Math.max(1.5, (w - pad.l - pad.r) / f.length * .62);
    f.forEach((fr, i) => {
      x.fillStyle = i === peak ? c.peak : (fr >= lo && fr <= hi ? c.data : c.axis);
      const top = Y(a[i]); x.fillRect(X(fr) - bw / 2, top, bw, Y(0) - top);
    });
    if (peak >= 0) {
      x.fillStyle = c.peak; x.font = '500 11px "IBM Plex Mono", monospace'; x.textBaseline = 'bottom';
      const px = X(f[peak]); x.textAlign = px > w - 90 ? 'right' : 'left';
      x.fillText(fmt(f[peak], 2) + ' Hz', px + (x.textAlign === 'left' ? 6 : -6), Y(a[peak]) - 2);
    }
  }

  root.VibraCharts = { setup, empty, line, bars, fmt };
})(window);
