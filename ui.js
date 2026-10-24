/* Vibra 0.7 — componentes de interface (apresentação de estado, sem cálculo). */
(function (root) {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = (v, d = 2) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: d }).format(v);

  /* Etapas: vídeo → região → frequência → amplificação */
  const steps = [...document.querySelectorAll('#flow li')];
  function flow(done) {
    const active = steps.findIndex((_, i) => !done[i]);
    steps.forEach((li, i) => { li.dataset.state = done[i] ? 'done' : i === active ? 'active' : 'pending'; });
  }
  steps.forEach(li => li.addEventListener('click', () => {
    const sec = $(li.dataset.target); if (!sec) return;
    sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    sec.classList.add('is-focus'); setTimeout(() => sec.classList.remove('is-focus'), 1000);
  }));

  function state(text, tone = 'idle') { const s = $('state'); s.textContent = text; s.dataset.tone = tone; }

  /* Trilha preenchida dos sliders */
  function fill(input) {
    const min = +input.min || 0, max = +input.max || 100;
    input.style.setProperty('--p', (max > min ? (+input.value - min) / (max - min) * 100 : 0) + '%');
  }
  document.querySelectorAll('input[type=range]').forEach(r => { fill(r); r.addEventListener('input', () => fill(r)); });

  /* Faixa de passagem sobre 0…Nyquist */
  function band(lo, hi, fs, frames) {
    const nyq = fs / 2, ok = lo > 0 && lo < hi && hi < nyq, pass = $('bandPass');
    const L = Math.max(0, Math.min(1, lo / nyq)), H = Math.max(0, Math.min(1, hi / nyq));
    pass.style.left = L * 100 + '%'; pass.style.width = Math.max(1, (H - L) * 100) + '%';
    pass.classList.toggle('is-bad', !ok);
    $('bandNyq').textContent = fmt(nyq, 1) + ' Hz';
    $('bandHint').textContent = ok
      ? `Resolução de ${fmt(fs / frames)} Hz com ${frames} quadros. Prefira uma faixa estreita em torno da frequência de operação.`
      : 'Faixa inválida: o início deve ser menor que o fim, e o fim menor que metade da taxa de amostragem.';
  }

  /* Progresso do processamento sobre o quadro amplificado */
  const proc = (() => {
    const box = $('proc'), stage = $('procStage'), fillBar = $('procFill'), pct = $('procPct'), clock = $('procClock');
    let labels = {}, timer = 0, t0 = 0;
    const base = { read: 'Lendo quadros', track: 'Estimando o movimento', filter: 'Filtrando a faixa', render: 'Montando o resultado' };
    function show(custom = {}) {
      labels = { ...base, ...custom }; t0 = performance.now(); clearInterval(timer);
      timer = setInterval(() => { clock.textContent = fmt((performance.now() - t0) / 1000, 1) + ' s'; }, 100);
      box.hidden = false; update(0, 'read');
    }
    function update(p, key) {
      p = Math.max(0, Math.min(1, p));
      fillBar.style.width = p * 100 + '%'; pct.textContent = Math.round(p * 100);
      if (key && labels[key]) stage.textContent = labels[key];
    }
    function hide() { clearInterval(timer); box.hidden = true; }
    return { show, update, hide };
  })();

  function busy(btn, on) { btn.classList.toggle('is-busy', on); btn.setAttribute('aria-busy', String(on)); }

  root.VibraUI = { flow, state, fill, band, proc, busy, fmt };
})(window);
