// Correos de un locatario, los mismos que muestra el Directorio: los de notificación del contrato y los de facturación,
// sin repetir y sin anotaciones entre paréntesis (ej. "x@y.com (obligado solidario)").
export const limpiarCorreo = s => String(s || '').replace(/\(.*?\)/g, '').trim();

export function correosDeContrato(c) {
  const lista = [];
  (c.correosNotificacion || []).forEach(x => lista.push({ correo: limpiarCorreo(x), tipo: 'Contrato' }));
  (c.facturacion?.correos || []).forEach(x => lista.push({ correo: limpiarCorreo(x), tipo: 'Facturación' }));
  const vistos = new Map();
  lista.filter(x => /@/.test(x.correo)).forEach(x => {
    const k = x.correo.toLowerCase();
    if (vistos.has(k)) { if (!vistos.get(k).tipo.includes(x.tipo)) vistos.get(k).tipo += ' · ' + x.tipo; }
    else vistos.set(k, { ...x });
  });
  return [...vistos.values()];
}

// Todos los correos que sale del panel se escriben desde esta cuenta: se abre la redacción de Gmail de admin@fabrica.la
// (un enlace mailto: no puede elegir el remitente). Hay que tener esa cuenta abierta en este navegador.
export const CORREO_REMITENTE = 'admin@fabrica.la';

export function urlGmail({ para = [], cco = [], asunto = '', cuerpo = '' }) {
  const q = new URLSearchParams({ view: 'cm', fs: '1', authuser: CORREO_REMITENTE });
  if (para.length) q.set('to', para.join(','));
  if (cco.length) q.set('bcc', cco.join(','));
  if (asunto) q.set('su', asunto);
  if (cuerpo) q.set('body', cuerpo);
  return 'https://mail.google.com/mail/?' + q.toString();
}

/** Abre la redacción de Gmail (admin@fabrica.la) en otra pestaña. Devuelve el largo del enlace. */
export function abrirCorreo(opciones) {
  const url = urlGmail(opciones);
  window.open(url, '_blank', 'noopener');
  return url.length;
}
