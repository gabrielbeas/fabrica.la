/**
 * LFdC - Proxy de datos en vivo para el panel de administración
 * ---------------------------------------------------------------
 * Este script NO modifica nada en las hojas: solo LEE y devuelve JSON.
 * Se despliega como "Web App" (Aplicación web) y el panel de
 * fabrica.la lo consume por fetch() desde el navegador.
 *
 * Protección: requiere un token compartido (?token=...) que se
 * configura en "Propiedades del script" (Project Settings > Script
 * Properties), NO aquí en el código, para que no quede expuesto si
 * este archivo se comparte o se sube a GitHub.
 *
 * FASE 1 (actual): modo "descubrimiento". Devuelve, para cada
 * spreadsheet, la lista de pestañas y su contenido crudo (todas las
 * celdas). Esto es temporal: nos sirve para confirmar los nombres
 * reales de las pestañas y su estructura antes de escribir el parser
 * final del lado del cliente. Una vez confirmado, se puede acotar
 * con los parámetros ?book= y ?tab= para reducir el payload.
 */

// IDs de los dos Google Sheets (no son secretos: un ID de Drive por
// sí solo no da acceso a nadie que no tenga permiso sobre el archivo).
var SHEET_IDS = {
  admin: '1HUPvZ1U7UckwyT74B1tOf0wDdMgV9cW463rrWJtHZQE',       // LFdC_CONTROL ADMIN 202608
  operacion: '1C5EIpvMrTuXqq2ftBJxINm-LDs-As2zPzKztIR_F0_U'    // LFdC_OPERACION 202608
};

// Cuánto tiempo se cachea la respuesta (segundos). Reduce lecturas
// repetidas a Sheets si varias personas cargan el panel casi al
// mismo tiempo. 120s = 2 minutos.
var CACHE_SECONDS = 120;

function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};

    var expectedToken = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN');
    if (!expectedToken) {
      return jsonOutput({
        error: 'CONFIG: No se ha configurado ACCESS_TOKEN en Propiedades del script.'
      }, 500);
    }
    if (params.token !== expectedToken) {
      return jsonOutput({ error: 'No autorizado. Falta o es incorrecto el parámetro ?token=' }, 403);
    }

    var book = params.book; // 'admin' | 'operacion' | undefined (=ambos)
    var tab = params.tab;   // nombre exacto de una pestaña | undefined (=todas)

    var cacheKey = 'lfdc_' + (book || 'all') + '_' + (tab || 'all');
    var cache = CacheService.getScriptCache();
    var cached = cache.get(cacheKey);
    if (cached) {
      return jsonOutput(JSON.parse(cached), 200, true);
    }

    var result = {};

    Object.keys(SHEET_IDS).forEach(function (key) {
      if (book && book !== key) return;
      result[key] = readSpreadsheet(SHEET_IDS[key], tab);
    });

    var payload = {
      generatedAt: new Date().toISOString(),
      data: result
    };

    var serialized = JSON.stringify(payload);
    // El caché de Apps Script tiene un límite de 100KB por valor.
    if (serialized.length < 95000) {
      cache.put(cacheKey, serialized, CACHE_SECONDS);
    }

    return jsonOutput(payload, 200);
  } catch (err) {
    return jsonOutput({ error: 'EXCEPTION: ' + err.message }, 500);
  }
}

function readSpreadsheet(spreadsheetId, onlyTabName) {
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sheets = ss.getSheets();
  var out = { spreadsheetName: ss.getName(), tabs: [] };

  sheets.forEach(function (sheet) {
    var name = sheet.getName();
    if (onlyTabName && name !== onlyTabName) return;

    var range = sheet.getDataRange();
    var values = range.getValues();
    var displayValues = range.getDisplayValues(); // strings con formato (fechas, moneda) tal como se ven

    out.tabs.push({
      name: name,
      numRows: values.length,
      numCols: values.length ? values[0].length : 0,
      values: values,
      displayValues: displayValues
    });
  });

  return out;
}

function jsonOutput(obj, statusCode, fromCache) {
  // ContentService no permite fijar el status HTTP directamente en
  // Apps Script Web Apps; lo incluimos en el propio JSON para que el
  // cliente lo pueda revisar (obj.error existe si algo falló).
  if (fromCache) obj._cache = true;
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
