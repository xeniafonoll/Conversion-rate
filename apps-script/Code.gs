// Registro de atenciones · API en Google Apps Script (la página se aloja aparte)
// Datos: una pestaña por mes ("2026-11", "2026-12"...) en la hoja vinculada, más una pestaña "vendedores".
// La clave de las estadísticas se guarda en Propiedades del script, con el nombre CLAVE.

const MOTIVOS = { B: "", P: "Precio", S: "Sin stock, talla o color", M: "Solo mira", T: "Lo pensará, volverá",
                  C: "Compara con otra tienda", N: "No encuentra lo que busca", O: "Otro motivo" };
const CABECERA = ["Fecha", "Hora", "Vendedor", "Resultado", "Motivo", "Detalle", "id", "cod"];

const slug_ = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";

// Evita que un texto que empiece por = + - @ se interprete como fórmula.
function safe_(s) {
  s = String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, 120);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

// La página vive fuera de Google (hosting estático). Este script solo actúa como API.
function doGet() {
  return ContentService.createTextOutput("Registro de atenciones: servicio activo.");
}

// Pestaña de un mes (la crea si hace falta).
function mes_(nombre, crear) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nombre);
  if (!sh && crear) {
    sh = ss.insertSheet(nombre);
    sh.appendRow(CABECERA);
    sh.getRange("A:A").setNumberFormat("yyyy-mm-dd");
    sh.getRange("B:B").setNumberFormat("hh:mm");
    sh.getRange(1, 1, 1, 8).setFontWeight("bold");
    sh.setFrozenRows(1);
    sh.setColumnWidths(1, 6, 140);
    sh.hideColumns(7, 2); // id y código: columnas técnicas
    ["Hoja 1", "Sheet1"].forEach(n => {
      const d = ss.getSheetByName(n);
      if (d && d.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(d);
    });
  }
  return sh;
}

function nombre_(s) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName("vendedores");
  if (!sh) { sh = ss.insertSheet("vendedores"); sh.appendRow(["Vendedores"]); }
  const n = sh.getLastRow(), k = slug_(s);
  const cur = n > 1 ? sh.getRange(2, 1, n - 1, 1).getValues().map(r => slug_(r[0])) : [];
  if (cur.indexOf(k) < 0) sh.appendRow([safe_(s)]);
}

function getNames() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("vendedores");
  const n = sh ? sh.getLastRow() : 0;
  return n > 1 ? sh.getRange(2, 1, n - 1, 1).getDisplayValues().map(r => r[0]) : [];
}

// Apunta una atención. Devuelve su id (sirve para deshacerla).
function addEvent(seller, date, m, code, txt) {
  seller = String(seller || "").trim().slice(0, 60);
  if (!seller || !/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || !(m >= 0 && m < 1440) || !(code in MOTIVOS)) throw new Error("datos");
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = mes_(date.slice(0, 7), true);
    const id = "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const hora = ("0" + Math.floor(m / 60)).slice(-2) + ":" + ("0" + (m % 60)).slice(-2);
    sh.appendRow([date, hora, safe_(seller), code === "B" ? "Compra" : "No compra", MOTIVOS[code],
                  code === "O" ? safe_(txt) : "", id, code]);
    nombre_(seller);
    return id;
  } finally { lock.releaseLock(); }
}

// Atenciones de hoy de un vendedor (para su contador). Solo mira las últimas filas de la pestaña del mes.
function getToday(seller, date) {
  const sh = mes_(String(date).slice(0, 7), false);
  if (!sh) return [];
  const n = sh.getLastRow();
  if (n < 2) return [];
  const start = Math.max(2, n - 1499), k = slug_(seller);
  return sh.getRange(start, 1, n - start + 1, 8).getDisplayValues()
    .filter(r => r[0] === date && slug_(r[2]) === k).map(r => [r[6], r[7]]);
}

function undoEvent(id, date) {
  const sh = mes_(String(date).slice(0, 7), false);
  if (!sh) return false;
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const f = sh.getRange(2, 7, Math.max(sh.getLastRow() - 1, 1), 1).createTextFinder(String(id)).matchEntireCell(true).findNext();
    if (f) { sh.deleteRow(f.getRow()); return true; }
    return false;
  } finally { lock.releaseLock(); }
}

// Estadísticas: solo con la clave correcta. 5 fallos bloquean el acceso 10 minutos.
function getStats(clave) {
  const real = PropertiesService.getScriptProperties().getProperty("CLAVE");
  if (!real) return { error: "sin_clave" };
  const c = CacheService.getScriptCache(), fallos = Number(c.get("fallos")) || 0;
  if (fallos >= 5) return { error: "bloqueado" };
  if (String(clave) !== real) { c.put("fallos", String(fallos + 1), 600); return { error: "clave" }; }
  c.remove("fallos");
  const rows = [];
  SpreadsheetApp.getActiveSpreadsheet().getSheets().forEach(sh => {
    if (!/^\d{4}-\d{2}$/.test(sh.getName()) || sh.getLastRow() < 2) return;
    sh.getRange(2, 1, sh.getLastRow() - 1, 8).getDisplayValues().forEach(r => {
      const p = r[1].split(":").map(Number);
      rows.push([r[0], p[0] * 60 + p[1], r[2], r[7], r[5]]);
    });
  });
  return { rows: rows };
}

// Punto de entrada de la API: recibe {fn, a} y devuelve {v} o {err}.
const FUNCIONES = { getNames: getNames, addEvent: addEvent, getToday: getToday, undoEvent: undoEvent, getStats: getStats };

function doPost(e) {
  let out;
  try {
    const q = JSON.parse(e.postData.contents);
    if (!FUNCIONES[q.fn]) throw new Error("fn");
    out = { v: FUNCIONES[q.fn].apply(null, q.a || []) };
  } catch (err) {
    out = { err: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
