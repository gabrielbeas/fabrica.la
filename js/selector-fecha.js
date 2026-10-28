// Selector de fecha en español (28/10/2026): reemplaza un <input type="date"> por tres listas (día, mes con su nombre
// completo y año), porque el calendario del navegador sale en el idioma del sistema. El input original queda oculto,
// conserva su valor (AAAA-MM-DD) y sigue emitiendo 'input' y 'change'. Importar con ?v=AAAAMMDD-n.
export const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const fechaLarga = f => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f || ''); return m ? `${+m[3]} de ${MESES_LARGO[+m[2] - 1]} de ${m[1]}` : ''; };

const propiedad = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
const diasDelMes = (a, m) => new Date(a, m, 0).getDate();

export function selectorFecha(input, { atras = 3, adelante = 12 } = {}) {
    if (!input || input.dataset.selectorFecha) return;
    input.dataset.selectorFecha = '1';
    const caja = document.createElement('div');
    caja.className = 'selector-fecha';
    caja.style.cssText = 'display:flex;gap:8px;align-items:center';
    const sel = (cls, ancho) => { const s = document.createElement('select'); s.className = cls; s.style.cssText = `flex:${ancho};min-width:0`; return s; };
    const sDia = sel('sf-dia', '0 0 76px'), sMes = sel('sf-mes', '1 1 auto'), sAnio = sel('sf-anio', '0 0 96px');
    const op = (v, t) => { const o = document.createElement('option'); o.value = v; o.textContent = t; return o; };
    sDia.append(op('', 'Día')); for (let d = 1; d <= 31; d++) sDia.append(op(d, d));
    sMes.append(op('', 'Mes')); MESES_LARGO.forEach((n, i) => sMes.append(op(i + 1, n)));
    sAnio.append(op('', 'Año'));
    const anioHoy = new Date().getFullYear();
    const llenarAnios = extra => { const base = [...sAnio.options].map(o => +o.value).filter(Boolean); const lista = new Set(base); for (let a = anioHoy - atras; a <= anioHoy + adelante; a++) lista.add(a); if (extra) lista.add(extra); sAnio.length = 1; [...lista].sort((x, y) => x - y).forEach(a => sAnio.append(op(a, a))); };
    llenarAnios();
    caja.append(sDia, sMes, sAnio);
    input.insertAdjacentElement('afterend', caja);
    input.style.display = 'none';

    const pintar = () => {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(propiedad.get.call(input) || '');
        if (m) { llenarAnios(+m[1]); sAnio.value = m[1]; sMes.value = String(+m[2]); sDia.value = String(+m[3]); }
        else { sAnio.value = ''; sMes.value = ''; sDia.value = ''; }
    };
    const emitir = () => {
        const a = +sAnio.value, mes = +sMes.value;
        let d = +sDia.value;
        if (a && mes && d) {
            d = Math.min(d, diasDelMes(a, mes)); sDia.value = String(d);
            propiedad.set.call(input, `${a}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
        } else if (!a && !mes && !d) propiedad.set.call(input, '');
        else return;   // fecha incompleta: espera a que se elijan las tres partes
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    [sDia, sMes, sAnio].forEach(s => s.addEventListener('change', emitir));
    // Si el código de la página asigna input.value, las listas se actualizan
    Object.defineProperty(input, 'value', { configurable: true, get() { return propiedad.get.call(input); }, set(v) { propiedad.set.call(input, v); pintar(); } });
    pintar();
}

export function activarSelectoresFecha(raiz = document, opciones) { raiz.querySelectorAll('input[type="date"]').forEach(i => selectorFecha(i, opciones)); }
