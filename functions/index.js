'use strict';

const { createHash, randomUUID } = require('node:crypto');
const { initializeApp } = require('firebase-admin/app');
const { FieldValue, Timestamp, getFirestore } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const { onSchedule } = require('firebase-functions/v2/scheduler');

const GMAIL_CLIENT_ID = '189983223128-26iqrpq2d9h6toi12o0rvj4gp6d56d0m.apps.googleusercontent.com';
const GMAIL_SENDER = 'admin@fabrica.la';
const TIME_ZONE = 'America/Mexico_City';
const MAX_RECIPIENTS_PER_MESSAGE = 250;
const OAUTH_CLIENT_SECRET = defineSecret('GMAIL_OAUTH_CLIENT_SECRET');
const OAUTH_REFRESH_TOKEN = defineSecret('GMAIL_OAUTH_REFRESH_TOKEN');

initializeApp();
const db = getFirestore();

function localParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  const value = key => parts.find(part => part.type === key)?.value || '';
  return { date: `${value('year')}-${value('month')}-${value('day')}`, time: `${value('hour')}:${value('minute')}` };
}

function shouldSendNow(message, now) {
  if (message.activo === false || message.completado || message.envioAutomatico !== true) return false;
  if (message.frecuencia === 'eventual') return false;
  if (message.canal !== 'Correo' || !message.fechaSiguiente || !/^\d{4}-\d{2}-\d{2}$/.test(message.fechaSiguiente)) return false;
  const hour = /^\d{2}:\d{2}$/.test(message.horaEnvio || '') ? message.horaEnvio : '09:00';
  return message.fechaSiguiente < now.date || (message.fechaSiguiente === now.date && hour <= now.time);
}

function nextDate(date, frequency) {
  if (!date || frequency === 'unaVez' || frequency === 'eventual') return '';
  const value = new Date(`${date}T12:00:00.000Z`);
  if (frequency === 'diarioHabil') {
    do { value.setUTCDate(value.getUTCDate() + 1); } while ([0, 6].includes(value.getUTCDay()));
    return value.toISOString().slice(0, 10);
  }
  const days = { semanal: 7, quincenal: 15 };
  if (days[frequency]) value.setUTCDate(value.getUTCDate() + days[frequency]);
  else {
    const months = { mensual: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 }[frequency];
    if (!months) return '';
    const day = value.getUTCDate();
    value.setUTCDate(1);
    value.setUTCMonth(value.getUTCMonth() + months);
    const lastDay = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate();
    value.setUTCDate(Math.min(day, lastDay));
  }
  return value.toISOString().slice(0, 10);
}

function valueDate(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value.toDate === 'function') return value.toDate().toISOString().slice(0, 10);
  return '';
}

function isCurrentContract(contract, today) {
  const start = valueDate(contract.inicio);
  const end = valueDate(contract.fin);
  return (!start || start <= today) && (!end || end >= today);
}

function emailsIn(values) {
  const strings = Array.isArray(values) ? values : values ? [values] : [];
  return strings.flatMap(value => String(value || '').replace(/\([^)]*\)/g, ' ').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])
    .map(email => email.trim().toLowerCase())
    .filter(email => email.length <= 254);
}

function validEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : '';
}

async function resolveRecipients(message, today) {
  if (message.audiencia === 'prueba') {
    const email = validEmail(message.correoPrueba);
    if (!email) throw new Error('Falta un correo de prueba válido.');
    return [{ email, nombre: 'Prueba', locales: [] }];
  }
  if (message.audiencia !== 'locatariosActivos') throw new Error('La audiencia del mensaje no está configurada.');

  const contracts = await db.collection('contratos').get();
  const recipients = new Map();
  for (const snapshot of contracts.docs) {
    const contract = snapshot.data();
    if (!isCurrentContract(contract, today)) continue;
    const nombre = contract.nombreComercial || contract.razonSocial || 'Locatario';
    const locales = Array.isArray(contract.locales) ? contract.locales.map(String) : [];
    const addresses = new Set([
      ...emailsIn(contract.correosNotificacion),
      ...emailsIn(contract.facturacion?.correos)
    ]);
    for (const email of addresses) {
      const current = recipients.get(email) || { email, nombres: new Set(), locales: new Set() };
      current.nombres.add(nombre);
      locales.forEach(local => current.locales.add(local));
      recipients.set(email, current);
    }
  }
  return [...recipients.values()].map(item => ({
    email: item.email,
    nombre: [...item.nombres].join(' / '),
    locales: [...item.locales].join(', ')
  }));
}

async function gmailAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      client_secret: OAUTH_CLIENT_SECRET.value(),
      refresh_token: OAUTH_REFRESH_TOKEN.value(),
      grant_type: 'refresh_token'
    }),
    signal: AbortSignal.timeout(20000)
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(`No se pudo renovar el acceso a Gmail (HTTP ${response.status}).`);
  return data.access_token;
}

function renderMessage(value, recipient, message) {
  return String(value || '')
    .replace(/\[nombre\]/gi, recipient.nombre || 'locatario')
    .replace(/\[locales?\]/gi, recipient.locales || 'sus locales')
    .replace(/\[periodo\]/gi, message.periodo || '[periodo]');
}

function base64Lines(value) {
  return Buffer.from(value, 'utf8').toString('base64').match(/.{1,76}/g)?.join('\r\n') || '';
}

function encodeSubject(value) {
  const clean = String(value || '').replace(/[\r\n]+/g, ' ').trim();
  return `=?UTF-8?B?${Buffer.from(clean, 'utf8').toString('base64')}?=`;
}

async function sendMail(accessToken, message, recipient) {
  const to = validEmail(recipient.email);
  if (!to) throw new Error('Dirección de destino inválida.');
  const subject = encodeSubject(renderMessage(message.asunto || message.titulo, recipient, message));
  const body = renderMessage(message.contenido, recipient, message);
  const mime = [
    `From: La Fábrica de Chocolate <${GMAIL_SENDER}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(body)
  ].join('\r\n');
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: Buffer.from(mime, 'utf8').toString('base64url') }),
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`Gmail rechazó un mensaje (HTTP ${response.status}).`);
  return response.json();
}

async function claimRun(runRef) {
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(runRef);
    const data = snapshot.data() || {};
    const lockedUntil = data.leaseUntil?.toDate?.().getTime() || 0;
    if (data.estado === 'enviado' || (data.estado === 'procesando' && lockedUntil > Date.now())) return false;
    transaction.set(runRef, {
      estado: 'procesando',
      leaseUntil: Timestamp.fromMillis(Date.now() + 20 * 60 * 1000),
      iniciadoEn: FieldValue.serverTimestamp(),
      actualizadoEn: FieldValue.serverTimestamp()
    }, { merge: true });
    return true;
  });
}

async function sendRecipient(runRef, accessToken, message, recipient) {
  const recipientId = createHash('sha256').update(recipient.email).digest('hex');
  const recipientRef = runRef.collection('destinatarios').doc(recipientId);
  const claim = await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(recipientRef);
    const data = snapshot.data() || {};
    const lockedUntil = data.leaseUntil?.toDate?.().getTime() || 0;
    if (data.estado === 'enviado') return 'enviado';
    if (data.estado === 'enviando' && lockedUntil > Date.now()) return 'ocupado';
    transaction.set(recipientRef, {
      correo: recipient.email,
      estado: 'enviando',
      leaseUntil: Timestamp.fromMillis(Date.now() + 10 * 60 * 1000),
      intentadoEn: FieldValue.serverTimestamp()
    }, { merge: true });
    return 'reclamado';
  });
  if (claim === 'enviado') return { estado: 'enviado', omitido: true };
  if (claim === 'ocupado') return { estado: 'error', omitido: true };

  try {
    const result = await sendMail(accessToken, message, recipient);
    await recipientRef.set({
      correo: recipient.email,
      estado: 'enviado',
      gmailMessageId: result.id || '',
      enviadoEn: FieldValue.serverTimestamp(),
      leaseUntil: FieldValue.delete()
    }, { merge: true });
    return { estado: 'enviado' };
  } catch (error) {
    await recipientRef.set({
      correo: recipient.email,
      estado: 'error',
      codigoError: error.message.includes('HTTP ') ? error.message.match(/HTTP \d+/)?.[0] || 'gmail_error' : 'gmail_error',
      errorEn: FieldValue.serverTimestamp(),
      leaseUntil: FieldValue.delete()
    }, { merge: true });
    return { estado: 'error' };
  }
}

async function processMessage(snapshot, now) {
  const message = snapshot.data();
  const dueDate = message.fechaSiguiente;
  const runId = createHash('sha256').update(`${snapshot.id}:${dueDate}`).digest('hex');
  const runRef = db.collection('mensajes_locatarios').doc(snapshot.id).collection('envios').doc(runId);
  if (!(await claimRun(runRef))) return;

  const runSummary = {
    fecha: dueDate,
    fechaProgramada: dueDate,
    canal: 'Correo',
    destinatarios: message.audiencia === 'prueba' ? 'Correo de prueba' : 'Locatarios con contrato vigente',
    registradoPor: 'Sistema automático',
    modoAutomatico: true,
    actualizadoEn: FieldValue.serverTimestamp()
  };
  await runRef.set(runSummary, { merge: true });
  try {
    const recipients = await resolveRecipients(message, now.date);
    if (!recipients.length) throw new Error('No se encontraron correos de locatarios vigentes.');
    if (recipients.length > MAX_RECIPIENTS_PER_MESSAGE) throw new Error(`El envío excede el límite de ${MAX_RECIPIENTS_PER_MESSAGE} destinatarios.`);

    const accessToken = await gmailAccessToken();
    let enviados = 0, errores = 0;
    for (const recipient of recipients) {
      const result = await sendRecipient(runRef, accessToken, message, recipient);
      if (result.estado === 'enviado') enviados++;
      if (result.estado === 'error') errores++;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    if (errores || !enviados) {
      await runRef.set({ ...runSummary, estado: 'parcial', cantidadDestinatarios: recipients.length, cantidadEnviada: enviados, cantidadError: errores, error: 'Algunos mensajes quedaron pendientes; se reintentará sin repetir los ya confirmados.', leaseUntil: FieldValue.delete(), actualizadoEn: FieldValue.serverTimestamp() }, { merge: true });
      await snapshot.ref.update({ ultimoIntentoEnvio: FieldValue.serverTimestamp(), ultimoEstadoEnvio: 'parcial', ultimoErrorEnvio: 'Hay destinatarios pendientes; se reintentará automáticamente.', actualizadoEn: FieldValue.serverTimestamp() });
      logger.warn('Envío automático parcial', { mensajeId: snapshot.id, enviados, errores });
      return;
    }

    const siguiente = nextDate(now.date, message.frecuencia);
    await runRef.set({ ...runSummary, estado: 'enviado', cantidadDestinatarios: recipients.length, cantidadEnviada: enviados, cantidadError: 0, enviadoEn: FieldValue.serverTimestamp(), leaseUntil: FieldValue.delete() }, { merge: true });
    await snapshot.ref.update({
      ultimoEnvio: now.date,
      fechaSiguiente: siguiente,
      completado: message.frecuencia === 'unaVez',
      ultimoIntentoEnvio: FieldValue.serverTimestamp(),
      ultimoEstadoEnvio: 'enviado',
      ultimoErrorEnvio: FieldValue.delete(),
      actualizadoPor: 'Sistema automático',
      actualizadoEn: FieldValue.serverTimestamp()
    });
    logger.info('Envío automático completado', { mensajeId: snapshot.id, cantidad: enviados });
  } catch (error) {
    await runRef.set({ ...runSummary, estado: 'error', error: String(error.message || 'Error de envío').slice(0, 300), actualizadoEn: FieldValue.serverTimestamp(), leaseUntil: FieldValue.delete() }, { merge: true });
    await snapshot.ref.update({ ultimoIntentoEnvio: FieldValue.serverTimestamp(), ultimoEstadoEnvio: 'error', ultimoErrorEnvio: String(error.message || 'Error de envío').slice(0, 300), actualizadoEn: FieldValue.serverTimestamp() });
    logger.error('Falló el envío automático', { mensajeId: snapshot.id, error: error.message });
  }
}

exports.enviarMensajesProgramados = onSchedule({
  schedule: 'every 15 minutes',
  timeZone: TIME_ZONE,
  region: 'us-central1',
  maxInstances: 1,
  timeoutSeconds: 540,
  memory: '512MiB',
  secrets: [OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN]
}, async () => {
  const now = localParts();
  const snapshot = await db.collection('mensajes_locatarios').get();
  const due = snapshot.docs.filter(document => shouldSendNow(document.data(), now));
  for (const message of due) await processMessage(message, now);
});
