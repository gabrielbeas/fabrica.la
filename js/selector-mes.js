// Selector de mes en español para reemplazar <input type="month"> (el del navegador sale en el idioma del sistema).
// Uso: selectorMes(inputMonth). El input se oculta, conserva su valor (AAAA-MM) y sigue emitiendo "change".
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const CSS = `
.selmes2 { position: relative; display: block; min-width: 190px; }
.selmes2-btn { font: inherit; font-size: 15px; color: var(--tinta, #1b2430); background: var(--fondo, #fff); border: 1px solid var(--borde-control, #9aa5b1); border-radius: var(--radio-sm, 6px); min-height: var(--alto-control, 44px); width: 100%; padding: 0 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; cursor: pointer; text-align: left; box-sizing: border-box; }
.selmes2-btn svg { width: 18px; height: 18px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.selmes2-btn:focus-visible, .selmes2-pop button:focus-visible { outline: 2px solid var(--foco, #1f4e79); outline-offset: 2px; }
.selmes2-pop { position: absolute; top: calc(100% + 4px); left: 0; z-index: 60; width: 280px; max-width: 90vw; background: var(--fondo-elevado, #fff); border: 1px solid var(--linea, #d5dbe1); border-radius: var(--radio-md, 10px); box-shadow: 0 8px 28px rgba(27, 36, 48, .18); padding: 12px; box-sizing: border-box; }
.selmes2-pop[hidden] { display: none; }
.selmes2-cab { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.selmes2-cab strong { font-size: 15px; }
.selmes2-cab button { font: inherit; width: 32px; height: 32px; border: none; background: none; border-radius: 6px; cursor: pointer; color: var(--tinta, #1b2430); font-size: 18px; line-height: 1; }
.selmes2-cab button:hover { background: var(--fondo-hundido, #eef1f4); }
.selmes2-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
.selmes2-grid button { font: inherit; font-size: 14px; height: 40px; border: none; background: none; border-radius: 6px; cursor: pointer; color: var(--tinta, #1b2430); }
.selmes2-grid button:hover { background: var(--fondo-hundido, #eef1f4); }
.selmes2-grid button.sel { background: var(--accion, #1f4e79); color: var(--on-accion, #fff); font-weight: 600; }
.selmes2-grid button.hoy:not(.sel) { box-shadow: inset 0 0 0 1px var(--accion, #1f4e79); }
.selmes2-pie { display: flex; justify-content: flex-end; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--linea, #d5dbe1); }
.selmes2-pie button { font: inherit; font-size: 13px; border: none; background: none; padding: 4px 2px; color: var(--accion, #1f4e79); cursor: pointer; }
.selmes2-pie button:hover { text-decoration: underline; }`;

export function selectorMes(input) {
  if (!input || input.dataset.selmes) return;
  input.dataset.selmes = '1';
  if (!document.getElementById('selmes2-css')) {
    const st = document.createElement('style'); st.id = 'selmes2-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  const hoy = new Date(), mesHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  const etiqueta = input.getAttribute('aria-label') || '';
  input.type = 'hidden';
  const cont = document.createElement('div');
  cont.className = 'selmes2';
  cont.innerHTML = `<button type="button" class="selmes2-btn" aria-haspopup="dialog" aria-expanded="false"${etiqueta ? ` aria-label="${etiqueta}"` : ''}><span></span><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg></button>
    <div class="selmes2-pop" role="dialog" aria-label="Elegir mes" hidden>
      <div class="selmes2-cab"><button type="button" data-anio="-1" aria-label="Año anterior">‹</button><strong></strong><button type="button" data-anio="1" aria-label="Año siguiente">›</button></div>
      <div class="selmes2-grid"></div>
      <div class="selmes2-pie"><button type="button" data-este>Este mes</button></div>
    </div>`;
  input.after(cont);
  const btn = cont.querySelector('.selmes2-btn'), pop = cont.querySelector('.selmes2-pop'), grid = cont.querySelector('.selmes2-grid');
  let anio = +(input.value || mesHoy).slice(0, 4);
  const texto = () => { const v = input.value; btn.firstElementChild.textContent = /^\d{4}-\d{2}$/.test(v) ? `${MESES[+v.slice(5) - 1]} ${v.slice(0, 4)}` : 'Elegir mes'; };
  const pintar = () => {
    pop.querySelector('strong').textContent = anio;
    grid.innerHTML = MESES.map((m, i) => { const k = `${anio}-${String(i + 1).padStart(2, '0')}`; return `<button type="button" data-mes="${k}" class="${k === input.value ? 'sel' : ''} ${k === mesHoy ? 'hoy' : ''}">${m.slice(0, 3)}</button>`; }).join('');
  };
  const abrir = si => { pop.hidden = !si; btn.setAttribute('aria-expanded', String(si)); if (si) { anio = +(input.value || mesHoy).slice(0, 4); pintar(); } };
  const elegir = v => { input.value = v; texto(); abrir(false); input.dispatchEvent(new Event('change', { bubbles: true })); btn.focus(); };
  btn.addEventListener('click', () => abrir(pop.hidden));
  pop.querySelectorAll('[data-anio]').forEach(b => b.addEventListener('click', () => { anio += +b.dataset.anio; pintar(); }));
  grid.addEventListener('click', e => { const b = e.target.closest('[data-mes]'); if (b) elegir(b.dataset.mes); });
  pop.querySelector('[data-este]').addEventListener('click', () => elegir(mesHoy));
  pop.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); abrir(false); btn.focus(); } });
  const fuera = e => {
    if (!cont.isConnected) { document.removeEventListener('click', fuera); return; }
    if (!pop.hidden && !cont.contains(e.target)) abrir(false);
  };
  document.addEventListener('click', fuera);
  texto();
}
