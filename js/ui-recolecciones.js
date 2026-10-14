/* =====================================================================
   ui-recolecciones.js — Pestaña "Recolecciones"
   Lista de muestras por recoger, con día sugerido y fecha límite.
   Se puede marcar como recogida y descargar en Excel.
   ===================================================================== */

import { ZONA } from './bases.js';
import { calcularRecolecciones } from './recolecciones.js';
import { libroRecolecciones, guardarArchivo, nombreArchivo } from './excel.js';
import { enlacePunto } from './ubicaciones.js';
import { textoError } from './datos.js';
import { $, esc, mensaje, fechaCorta, fechaLarga, hoyISO } from './util.js';

const ESTADO = {
  'vencido':   ['error',  'Vencido'],
  'vence-hoy': ['error',  'Vence hoy'],
  'en-plazo':  ['ok',     'En plazo'],
  'aun-no':    ['gris',   'Aún no'],
  'recogido':  ['gris',   'Recogido'],
};

/** Filas visibles según el filtro "Mostrar recogidas". */
function filasVisibles(ctx) {
  const todas = calcularRecolecciones(ctx.store.todosLosProyectos(), hoyISO());
  return $('verRecogidas').checked ? todas : todas.filter(f => !f.recogido);
}

export function iniciar(ctx) {
  $('verRecogidas').addEventListener('change', () => dibujar(ctx));

  // Marcar / desmarcar como recogida (se guarda en el proyecto)
  $('tablaRecolecciones').addEventListener('change', async ev => {
    const c = ev.target.closest('input[data-proyecto]'); if (!c) return;
    const p = ctx.store.estado.proyectos[c.dataset.proyecto]; if (!p) return;
    const recogido = { ...(p.recogido || {}), [c.dataset.ensayo]: c.checked };
    try { await ctx.store.guardarProyecto(c.dataset.proyecto, { ...p, recogido }); }
    catch (err) { mensaje($('msgRecolecciones'), textoError(err), 'error'); c.checked = !c.checked; }
  });

  $('btnExcelRecolecciones').addEventListener('click', async () => {
    const msg = $('msgRecolecciones'), filas = filasVisibles(ctx);
    if (!filas.length) { mensaje(msg, 'No hay recolecciones para descargar.', 'error'); return; }
    try { await guardarArchivo(libroRecolecciones(filas), nombreArchivo('informe_de_recolecciones', hoyISO()), ctx.descargas); mensaje(msg, 'Excel listo.', 'ok'); }
    catch (err) { if (!err || err.code !== 'declined') mensaje(msg, 'No se pudo descargar el Excel.', 'error'); }
  });
}

export function dibujar(ctx) {
  const filas = filasVisibles(ctx);
  $('cuentaRecolecciones').textContent = filas.filter(f => !f.recogido && f.estado !== 'aun-no').length;

  if (!filas.length) {
    $('tablaRecolecciones').innerHTML = '<div class="vacio">No hay recolecciones pendientes. Aparecen solas cuando un proyecto lleva control de colado de concreto o de lodocreto, cubos de mortero o prismas de grout.</div>';
    return;
  }

  // Agrupadas por día sugerido
  let html = '', dia = null;
  filas.forEach(f => {
    if (f.sugerido !== dia) { dia = f.sugerido; html += `<tr class="fila--grupo"><td colspan="8">Recoger el ${esc(fechaLarga(dia))}</td></tr>`; }
    const [tipo, texto] = ESTADO[f.estado] || ['gris', f.estado];
    html += `<tr>
      <td><span class="etiqueta etiqueta--${tipo}">${texto}</span></td>
      <td><span class="etiqueta etiqueta--zona etiqueta--${esc(f.zona)}">${esc((ZONA[f.zona] || {}).nombre || '')}</span> <b>${esc(f.proyecto)}</b>
          ${f.agrupada ? `<span class="sub">Mismo día que "${esc(f.agrupada)}" (cercano)</span>` : ''}</td>
      <td>${esc(f.ensayo)}<span class="sub">${esc(f.plazo)}</span></td>
      <td class="dato">${esc(fechaCorta(f.fechaEnsayo))}</td>
      <td class="dato">${esc(fechaCorta(f.desde))}</td>
      <td class="dato"><b>${esc(fechaCorta(f.hasta))}</b></td>
      <td>${f.lat != null ? `<a href="${enlacePunto(f)}" target="_blank" rel="noopener">ver</a>` : ''}</td>
      <td class="centro"><label class="casilla"><input type="checkbox" data-proyecto="${esc(f.proyectoId)}" data-ensayo="${esc(f.ensayoId)}" ${f.recogido ? 'checked' : ''}> Recogido</label></td>
    </tr>`;
  });
  $('tablaRecolecciones').innerHTML = `<div class="tabla-caja"><table>
    <thead><tr><th>Estado</th><th>Proyecto</th><th>Ensayo</th><th>Ensayo hecho</th><th>Desde</th><th>Límite</th><th>Ubicación</th><th></th></tr></thead>
    <tbody>${html}</tbody></table></div>`;
}
