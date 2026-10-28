// Campos de dinero (28/10/2026): todo <input data-dinero> se muestra siempre como $28,250.00 (símbolo de pesos, comas y
// centavos), también mientras se edita. Es transparente para el código de cada página:
//   - input.value devuelve el número limpio ("28250.5", "-120", o "" si está vacío), listo para Number()/parseFloat();
//   - input.value = 28250 (o "28250", o "$28,250.00") lo muestra formateado.
// Los campos que se agregan después (innerHTML) se activan solos. Importar con ?v=AAAAMMDD-n.
const propiedad = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

// Separa un texto cualquiera en signo, parte entera y decimales
function partes(texto) {
    const t = String(texto ?? '');
    const neg = t.includes('-') || t.includes('−');
    let s = t.replace(/[^0-9.]/g, '');
    const i = s.indexOf('.');
    if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '');
    const [ent, dec] = s.split('.');
    return { neg, ent: ent || '', dec: i >= 0 ? (dec || '') : undefined };
}
const conComas = e => e.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// Mientras se escribe: respeta lo tecleado (si aún no hay punto o centavos, no los inventa)
function formatoVivo(texto) {
    const p = partes(texto);
    if (!p.ent && p.dec === undefined) return p.neg ? '-' : '';
    const ent = conComas(p.ent.replace(/^0+(?=\d)/, '') || '0');
    return (p.neg ? '-' : '') + '$' + ent + (p.dec !== undefined ? '.' + p.dec.slice(0, 2) : '');
}
// Reposo: siempre con dos decimales
function formatoCompleto(texto) {
    const p = partes(texto);
    if (!p.ent && !p.dec) return '';
    const ent = conComas(p.ent.replace(/^0+(?=\d)/, '') || '0');
    return (p.neg ? '-' : '') + '$' + ent + '.' + (p.dec || '').padEnd(2, '0').slice(0, 2);
}
function numeroLimpio(texto) {
    const p = partes(texto);
    if (!p.ent && !p.dec) return '';
    return (p.neg ? '-' : '') + (p.ent.replace(/^0+(?=\d)/, '') || '0') + (p.dec ? '.' + p.dec : '');
}

export const formatoDinero = n => formatoCompleto(n);

export function activarDinero(el) {
    if (!el || el.dataset.dineroListo) return;
    el.dataset.dineroListo = '1';
    try { el.type = 'text'; } catch (e) { /* ya es texto */ }
    el.inputMode = 'decimal';
    el.autocomplete = 'off';
    ['min', 'max', 'step'].forEach(a => el.removeAttribute(a));
    el.classList.add('dinero');
    el.style.textAlign = 'right';
    Object.defineProperty(el, 'value', {
        configurable: true,
        get() { return numeroLimpio(propiedad.get.call(el)); },
        set(v) { propiedad.set.call(el, formatoCompleto(v)); }
    });
    propiedad.set.call(el, formatoCompleto(el.getAttribute('value') ?? propiedad.get.call(el)));
    el.addEventListener('input', () => {
        const texto = propiedad.get.call(el), caret = el.selectionStart ?? texto.length;
        const antes = texto.slice(0, caret).replace(/[^0-9.]/g, '').length;
        const nuevo = formatoVivo(texto);
        if (nuevo === texto) return;
        propiedad.set.call(el, nuevo);
        // Devuelve el cursor al mismo dígito
        let pos = 0, cuenta = 0;
        while (pos < nuevo.length && cuenta < antes) { if (/[0-9.]/.test(nuevo[pos])) cuenta++; pos++; }
        if (antes === 0) pos = Math.min(nuevo.length, nuevo.startsWith('-') ? 2 : 1);
        try { el.setSelectionRange(pos, pos); } catch (e) { /* campo oculto */ }
    });
    el.addEventListener('blur', () => { propiedad.set.call(el, formatoCompleto(propiedad.get.call(el))); });
    el.addEventListener('focus', () => { setTimeout(() => { try { el.select(); } catch (e) { /* campo oculto */ } }, 0); });
}

function activarEn(raiz) {
    if (raiz.nodeType !== 1) return;
    if (raiz.matches?.('input[data-dinero]')) activarDinero(raiz);
    raiz.querySelectorAll?.('input[data-dinero]').forEach(activarDinero);
}
activarEn(document.documentElement);
new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(activarEn))).observe(document.documentElement, { childList: true, subtree: true });
