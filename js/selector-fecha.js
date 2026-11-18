// Selector de fecha en español (reescrito el 18/11/2026): reemplaza un <input type="date"> por un botón con la fecha en letra
// («11 de noviembre de 2026») que abre un calendario gráfico en español, con botones «Hoy» y «Borrar», porque el calendario del
// navegador sale en el idioma del sistema. El input original queda oculto, conserva su valor (AAAA-MM-DD) y sigue emitiendo
// 'input' y 'change'. Importar con ?v=AAAAMMDD-n. Las opciones `atras`/`adelante` de la versión anterior se ignoran.
export const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const fechaLarga = f => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f || ''); return m ? `${+m[3]} de ${MESES_LARGO[+m[2] - 1]} de ${m[1]}` : ''; };

const propiedad = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
const DIAS_CORTO = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'];
const iso = (a, m, d) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const hoyISO = () => { const h = new Date(); return iso(h.getFullYear(), h.getMonth() + 1, h.getDate()); };

const CSS = `
.selector-fecha { position: relative; }
.sf-boton { width: 100%; box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; gap: 8px; text-align: left; font: inherit; color: inherit; background: #fff; border: 1px solid var(--borde-control, #8a95a3); border-radius: 8px; padding: 8px 10px; min-height: 0; line-height: 1.3; cursor: pointer; }
.sf-boton:hover, .sf-boton:focus-visible { border-color: var(--accion, #1f4e79); outline: none; }
.sf-boton .sf-vacio { color: #8a95a3; }
.sf-cal { position: fixed; z-index: 100000; width: 296px; box-sizing: border-box; background: #fff; border: 1px solid #c9d0d9; border-radius: 12px; box-shadow: 0 8px 28px rgba(27,36,48,.18); padding: 12px; font-family: Roboto, Arial, sans-serif; color: #1b2430; }
.sf-cab { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.sf-cab strong { font-size: 15px; text-transform: capitalize; }
.sf-nav { display: flex; gap: 2px; }
.sf-nav button { width: 30px; height: 30px; border: 0; background: transparent; border-radius: 8px; font-size: 16px; cursor: pointer; color: var(--accion, #1f4e79); }
.sf-nav button:hover { background: #eaf0f6; }
.sf-rejilla { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; text-align: center; }
.sf-rejilla .sf-dsem { font-size: 11px; color: #5f6670; padding: 4px 0; text-transform: uppercase; }
.sf-rejilla button { height: 34px; border: 0; background: transparent; border-radius: 8px; font: inherit; font-size: 14px; cursor: pointer; color: inherit; }
.sf-rejilla button:hover { background: #eaf0f6; }
.sf-rejilla button.sf-fuera { color: #aab2bd; }
.sf-rejilla button.sf-hoy { box-shadow: inset 0 0 0 1px var(--accion, #1f4e79); }
.sf-rejilla button.sf-sel { background: var(--accion, #1f4e79); color: #fff; }
.sf-pie { display: flex; justify-content: space-between; margin-top: 8px; border-top: 1px solid #e3e7ec; padding-top: 8px; }
.sf-pie button { border: 0; background: transparent; font: inherit; font-size: 14px; font-weight: 500; color: var(--accion, #1f4e79); cursor: pointer; padding: 6px 10px; border-radius: 8px; }
.sf-pie button:hover { background: #eaf0f6; }`;

let abierto = null;   // cierre del calendario abierto (solo hay uno a la vez)

export function selectorFecha(input) {
    if (!input || input.dataset.selectorFecha) return;
    input.dataset.selectorFecha = '1';
    if (!document.getElementById('sf-estilos')) { const st = document.createElement('style'); st.id = 'sf-estilos'; st.textContent = CSS; document.head.appendChild(st); }

    const caja = document.createElement('div');
    caja.className = 'selector-fecha';
    const boton = document.createElement('button');
    boton.type = 'button'; boton.className = 'sf-boton';
    const texto = document.createElement('span');
    const flecha = document.createElement('span'); flecha.textContent = '▾'; flecha.setAttribute('aria-hidden', 'true');
    boton.append(texto, flecha);
    caja.append(boton);
    input.insertAdjacentElement('afterend', caja);
    input.style.display = 'none';

    const valor = () => propiedad.get.call(input) || '';
    const pintar = () => { const f = fechaLarga(valor()); texto.textContent = f || 'Elegir fecha'; texto.className = f ? '' : 'sf-vacio'; };
    const poner = v => {
        if (valor() === v) return;
        propiedad.set.call(input, v); pintar();
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    function abrir() {
        if (abierto) abierto();
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor());
        const ref = m ? new Date(+m[1], +m[2] - 1, 1) : new Date();
        let anio = ref.getFullYear(), mes = ref.getMonth();   // mes 0-11 que se muestra
        const cal = document.createElement('div');
        cal.className = 'sf-cal';
        document.body.appendChild(cal);

        const cerrar = () => { cal.remove(); document.removeEventListener('mousedown', fuera, true); document.removeEventListener('keydown', tecla, true); window.removeEventListener('resize', cerrar); window.removeEventListener('scroll', alDesplazar, true); if (abierto === cerrar) abierto = null; };
        const alDesplazar = e => { if (!cal.contains(e.target)) cerrar(); };
        const fuera = e => { if (!cal.contains(e.target) && !boton.contains(e.target)) cerrar(); };
        const tecla = e => { if (e.key === 'Escape') { e.stopPropagation(); cerrar(); boton.focus(); } };
        abierto = cerrar;

        const dibujar = () => {
            const sel = valor(), hoy = hoyISO();
            const primero = new Date(anio, mes, 1);
            const hueco = (primero.getDay() + 6) % 7;   // la semana empieza en lunes
            let celdas = '';
            for (let i = 0; i < 42; i++) {
                const f = new Date(anio, mes, 1 - hueco + i), s = iso(f.getFullYear(), f.getMonth() + 1, f.getDate());
                celdas += `<button type="button" data-f="${s}" class="${f.getMonth() !== mes ? 'sf-fuera ' : ''}${s === hoy ? 'sf-hoy ' : ''}${s === sel ? 'sf-sel' : ''}">${f.getDate()}</button>`;
            }
            cal.innerHTML = `<div class="sf-cab"><strong>${MESES_LARGO[mes]} ${anio}</strong><div class="sf-nav">
                <button type="button" data-n="-12" title="Año anterior">«</button><button type="button" data-n="-1" title="Mes anterior">‹</button>
                <button type="button" data-n="1" title="Mes siguiente">›</button><button type="button" data-n="12" title="Año siguiente">»</button></div></div>
                <div class="sf-rejilla">${DIAS_CORTO.map(d => `<span class="sf-dsem">${d}</span>`).join('')}${celdas}</div>
                <div class="sf-pie"><button type="button" data-hoy>Hoy</button><button type="button" data-borrar>Borrar</button></div>`;
        };
        cal.addEventListener('click', e => {
            const b = e.target.closest('button'); if (!b) return;
            if (b.dataset.n) { const t = new Date(anio, mes + +b.dataset.n, 1); anio = t.getFullYear(); mes = t.getMonth(); dibujar(); return; }
            if (b.dataset.f) { poner(b.dataset.f); cerrar(); return; }
            if (b.hasAttribute('data-hoy')) { poner(hoyISO()); cerrar(); return; }
            if (b.hasAttribute('data-borrar')) { poner(''); cerrar(); }
        });
        dibujar();

        // Posición: debajo del botón, o arriba si no cabe
        const r = boton.getBoundingClientRect(), alto = cal.offsetHeight, ancho = cal.offsetWidth;
        let top = r.bottom + 6; if (top + alto > window.innerHeight - 8) top = Math.max(8, r.top - alto - 6);
        cal.style.top = top + 'px'; cal.style.left = Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8)) + 'px';
        document.addEventListener('mousedown', fuera, true); document.addEventListener('keydown', tecla, true);
        window.addEventListener('resize', cerrar); window.addEventListener('scroll', alDesplazar, true);
    }
    boton.addEventListener('click', () => { if (abierto) abierto(); else abrir(); });

    // Si el código de la página asigna input.value, el botón se actualiza
    Object.defineProperty(input, 'value', { configurable: true, get() { return propiedad.get.call(input); }, set(v) { propiedad.set.call(input, v); pintar(); } });
    pintar();
}

export function activarSelectoresFecha(raiz = document, opciones) { raiz.querySelectorAll('input[type="date"]').forEach(i => selectorFecha(i, opciones)); }
