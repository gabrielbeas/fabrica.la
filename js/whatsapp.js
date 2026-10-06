// Teléfonos del panel como enlaces a WhatsApp (wa.me). Se importa con ?v= como los demás archivos compartidos.

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Número en formato internacional sin signos. Los de 10 dígitos se toman como de México (+52);
// el antiguo prefijo de celular 521 se quita porque WhatsApp ya no lo usa.
export function numeroWhatsApp(tel) {
    let d = String(tel ?? '').replace(/\D/g, '');
    if (d.length === 10) d = '52' + d;
    if (d.length === 13 && d.startsWith('521')) d = '52' + d.slice(3);
    return d.length >= 11 && d.length <= 15 ? d : '';
}

// HTML del teléfono: cada número (un campo puede traer varios separados por / , ; o «y») abre WhatsApp en otra pestaña.
// Lo que no parece número se deja como texto.
export function telefonoWhatsApp(texto) {
    const t = String(texto ?? '').trim();
    if (!t) return '';
    return t.split(/(\s*[\/,;]\s*|\s+y\s+)/).map(parte => {
        const n = numeroWhatsApp(parte);
        return n ? `<a href="https://wa.me/${n}" target="_blank" rel="noopener" title="Enviar WhatsApp">${esc(parte)}</a>` : esc(parte);
    }).join('');
}
