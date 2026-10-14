/* =====================================================================
   util.js — Funciones pequeñas que usan todos los módulos
   (texto seguro para HTML, fechas, horas y mensajes en pantalla)
   ===================================================================== */

/** Atajo para buscar un elemento por su id. */
export const $ = id => document.getElementById(id);

/** Convierte texto a HTML seguro (evita que un nombre con < o & rompa la tabla). */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ---------------------------- Fechas ---------------------------- */

/** Fecha de hoy en formato AAAA-MM-DD (hora local). */
export function hoyISO() { return aISO(new Date()); }

/** Date → 'AAAA-MM-DD'. */
export function aISO(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** 'AAAA-MM-DD' → Date local a medianoche. */
export function deISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Suma días a una fecha ISO y devuelve otra fecha ISO. */
export function sumarDias(iso, n) {
  const d = deISO(iso); d.setDate(d.getDate() + n); return aISO(d);
}

/** Diferencia en días entre dos fechas ISO (b − a). */
export function difDias(a, b) { return Math.round((deISO(b) - deISO(a)) / 864e5); }

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** 'AAAA-MM-DD' → 'martes 13-oct-2026'. */
export function fechaLarga(iso) {
  if (!iso) return '—';
  const d = deISO(iso);
  return DIAS[d.getDay()] + ' ' + d.getDate() + '-' + MESES[d.getMonth()] + '-' + d.getFullYear();
}

/** 'AAAA-MM-DD' → 'mar 13-oct'. */
export function fechaCorta(iso) {
  if (!iso) return '—';
  const d = deISO(iso);
  return DIAS[d.getDay()].slice(0, 3) + ' ' + d.getDate() + '-' + MESES[d.getMonth()];
}

/* ----------------------------- Horas ----------------------------- */

/** 'HH:MM' → minutos desde medianoche (o null si no es válida). */
export function aMin(hhmm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || '');
  return m ? (+m[1]) * 60 + (+m[2]) : null;
}

/** minutos → 'HH:MM' (redondea al múltiplo de 5 hacia abajo si se pide). */
export function aHHMM(min, redondear5 = false) {
  if (min == null || isNaN(min)) return '';
  let v = Math.round(min);
  if (redondear5) v = Math.floor(v / 5) * 5;
  v = ((v % 1440) + 1440) % 1440;
  return String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0');
}

/** minutos → '1 h 25 min'. */
export function duracion(min) {
  const v = Math.round(Math.abs(min));
  return v < 60 ? v + ' min' : Math.floor(v / 60) + ' h ' + String(v % 60).padStart(2, '0') + ' min';
}

/* ---------------------------- Mensajes ---------------------------- */

/** Muestra un mensaje corto debajo de un formulario. tipo: 'ok' | 'error' | '' */
export function mensaje(el, texto, tipo = '') {
  if (!el) return;
  el.textContent = texto;
  el.className = 'mensaje' + (tipo ? ' mensaje--' + tipo : '');
}

/** Genera un id corto y único para documentos nuevos. */
export function nuevoId(prefijo = 'p') {
  return prefijo + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Nombre propio legible: 'FRANCISCO MEJIA' → 'Francisco Mejia'. */
export function nombrePropio(s) {
  return String(s || '').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
}
