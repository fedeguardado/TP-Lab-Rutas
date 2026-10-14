/* =====================================================================
   main.js — Arranque de la app
   ---------------------------------------------------------------------
   1. Conecta con los datos (compartidos o de este navegador).
   2. Maneja el día de trabajo y las pestañas.
   3. Cada vez que cambian los datos, vuelve a dibujar las secciones.
   ===================================================================== */

import { crearAlmacen } from './datos.js';
import { $, hoyISO, sumarDias } from './util.js';
import * as Proyectos from './ui-proyectos.js';
import * as Propuesta from './ui-propuesta.js';
import * as Recolecciones from './ui-recolecciones.js';
import * as Parametros from './ui-parametros.js';
import * as Bases from './ui-bases.js';
import * as Respaldo from './ui-respaldo.js';
import { activarBarrasHorizontales } from './barra-horizontal.js';

const SECCIONES = [Proyectos, Propuesta, Recolecciones, Parametros, Bases, Respaldo];
const PESTANAS = ['proyectos', 'propuesta', 'recolecciones', 'parametros', 'bases'];

/* Recordar pestaña y día en este navegador (comodidad personal) */
const leer = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };

/* ---------- Contexto compartido por todas las secciones ---------- */
const ctx = {
  store: null,                 // almacén de datos (datos.js)
  fecha: leer('tplab-fecha') || hoyISO(),
  descargas: null,             // función de descargas de Claude (si está disponible)
  dibujar,                     // vuelve a dibujar todo
};

/* ---------- Pestañas ---------- */
function abrirPestana(id) {
  PESTANAS.forEach(p => {
    $('sec-' + p).hidden = p !== id;
    $('tab-' + p).setAttribute('aria-selected', String(p === id));
  });
  guardar('tplab-pestana', id);
}
document.querySelectorAll('.pestanas button').forEach(b => b.addEventListener('click', () => abrirPestana(b.dataset.tab)));
const inicial = (location.hash || '').slice(1);
abrirPestana(PESTANAS.includes(inicial) ? inicial : (PESTANAS.includes(leer('tplab-pestana')) ? leer('tplab-pestana') : 'proyectos'));

/* ---------- Día de trabajo ---------- */
function cambiarFecha(f) {
  if (!f) return;
  ctx.fecha = f;
  $('fecha').value = f;
  guardar('tplab-fecha', f);
  SECCIONES.forEach(s => s.alCambiarFecha && s.alCambiarFecha(ctx));
  if (ctx.store) ctx.store.verFecha(f);
  dibujar();
}
$('fecha').addEventListener('change', e => cambiarFecha(e.target.value));
$('diaAnterior').addEventListener('click', () => cambiarFecha(sumarDias(ctx.fecha, -1)));
$('diaSiguiente').addEventListener('click', () => cambiarFecha(sumarDias(ctx.fecha, 1)));
$('diaHoy').addEventListener('click', () => cambiarFecha(hoyISO()));
$('fecha').value = ctx.fecha;

/* ---------- Dibujar ---------- */
let pendiente = false;
function dibujar() {
  if (pendiente) return;                   // agrupa varios cambios seguidos en un solo dibujo
  pendiente = true;
  requestAnimationFrame(() => {
    pendiente = false;
    if (!ctx.store) return;
    const e = ctx.store.estado;
    $('estadoDatos').textContent = { compartido: 'Datos compartidos', local: 'Guardado en este navegador', 'sin-conexion': 'Sin conexión', cargando: 'Conectando…' }[e.modo] || e.modo;
    SECCIONES.forEach(s => s.dibujar(ctx));
  });
}

/* ---------- Arranque ---------- */
SECCIONES.forEach(s => s.iniciar(ctx));
activarBarrasHorizontales();   // barra horizontal fija abajo en todas las tablas
crearAlmacen(dibujar).then(store => {
  ctx.store = store;
  store.verFecha(ctx.fecha);
  dibujar();
});
if (window.claude && typeof window.claude.use === 'function') {
  window.claude.use('downloads').then(d => { ctx.descargas = d; }).catch(() => {});
}
