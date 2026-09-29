/**
 * LFdC - Historial de lecturas de agua en Google Sheets
 * ------------------------------------------------------
 * Recibe las lecturas que se guardan en el panel (fabrica.la/admin)
 * y las agrega como filas nuevas en la pestaña "HISTORIAL PANEL"
 * del libro LFdC_OPERACION. Solo AGREGA filas: nunca borra ni edita.
 *
 * Seguridad: cada envío trae el token de sesión de Firebase del
 * usuario. El script lo usa para leer el perfil del usuario en
 * Firestore; si el token no es válido o el usuario no está dado de
 * alta (o está desactivado), se rechaza. Así nadie fuera del panel
 * puede escribir en el Sheet aunque conozca esta URL.
 *
 * Despliegue: Deploy -> New deployment -> Web app
 *   Execute as: Me    |    Who has access: Anyone
 */

var SPREADSHEET_ID = '1bg5HKZEL-nzVqpgPeypkXbLGrvTb4EuJ0NEVX8y4rEs'; // LFdC_OPERACION 2027
var TAB_NAME = 'HISTORIAL PANEL';
var FIREBASE_PROJECT = 'fabrica-399f2';

var HEADERS = [
  'Registrado', 'Acción', 'Fecha lectura', 'Tubo', 'Empresa',
  'Lectura anterior', 'Fecha anterior', 'Lectura (m3)', 'Consumo (m3)',
  'Costo x m3', 'Importe', 'Capturó', 'ID'
];

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var usuario = verificarUsuario(body.idToken);
    if (!usuario) return respuesta({ ok: false, error: 'No autorizado' });

    var filas = (body.lecturas || []).map(function (l) {
      return [
        new Date(),
        String(l.accion || 'guardada'),
        String(l.fecha || ''),
        String(l.tubo || ''),
        String(l.empresa || ''),
        numero(l.lecturaAnterior),
        String(l.fechaAnterior || ''),
        numero(l.lectura),
        numero(l.consumo),
        numero(l.costoM3),
        numero(l.importe),
        usuario.email,
        String(l.id || '')
      ];
    });
    if (!filas.length) return respuesta({ ok: true, filas: 0 });

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var hoja = obtenerHoja();
      hoja.getRange(hoja.getLastRow() + 1, 1, filas.length, HEADERS.length).setValues(filas);
    } finally {
      lock.releaseLock();
    }
    return respuesta({ ok: true, filas: filas.length });
  } catch (err) {
    return respuesta({ ok: false, error: String(err.message || err) });
  }
}

// Lee /users/{uid} en Firestore con el token del usuario.
// Si Firestore responde el perfil, el token es válido y el usuario está dado de alta.
function verificarUsuario(idToken) {
  if (!idToken) return null;
  var parte = idToken.split('.')[1] || '';
  parte += '==='.slice((parte.length + 3) % 4);
  var payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parte)).getDataAsString());
  var uid = payload.user_id || payload.sub;
  if (!uid) return null;

  var url = 'https://firestore.googleapis.com/v1/projects/' + FIREBASE_PROJECT +
            '/databases/(default)/documents/users/' + encodeURIComponent(uid);
  var res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + idToken },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) return null;

  var campos = JSON.parse(res.getContentText()).fields || {};
  if (campos.activo && campos.activo.booleanValue === false) return null;
  return { uid: uid, email: campos.email ? campos.email.stringValue : (payload.email || uid) };
}

function obtenerHoja() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var hoja = ss.getSheetByName(TAB_NAME);
  if (!hoja) {
    hoja = ss.insertSheet(TAB_NAME);
    hoja.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    hoja.setFrozenRows(1);
  }
  return hoja;
}

function numero(v) {
  return (v === null || v === undefined || v === '') ? '' : Number(v);
}

function respuesta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Para autorizar permisos desde el editor: selecciona esta función y pulsa Run.
function autorizar() {
  obtenerHoja();
  UrlFetchApp.fetch('https://www.google.com', { muteHttpExceptions: true });
}
