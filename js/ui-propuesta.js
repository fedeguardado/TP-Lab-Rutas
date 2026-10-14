/* =====================================================================
   ui-propuesta.js — Pestaña "Propuesta"
   Genera la asignación del día, la muestra, permite escribir
   observaciones por fila y descarga el Excel del informe de salida.
   ===================================================================== */

import { ZONA, ENSAYO } from './bases.js';
import { proponer } from './asignacion.js';
import { enlaceRuta } from './distancias.js';
import { libroRutas, guardarArchivo, nombreArchivo } from './excel.js';
import { textoError } from './datos.js';
import { $, esc, mensaje, fechaLarga, fechaCorta, nombrePropio } from './util.js';

/** Firma de los datos usados: si cambia, la propuesta quedó desactualizada. */
function firma(proyectos, restricciones, param) {
  const txt = JSON.stringify([[...proyectos].sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .map(p => [p.id, p.zona, p.horaLlegada, p.lat ?? null, p.lng ?? null, p.ensayos || [], p.transporte]),
    restricciones || {}, param]);
  let h = 0; for (let i = 0; i < txt.length; i++) h = (h * 31 + txt.charCodeAt(i)) | 0;
  return String(h);
}

/**
 * Genera y guarda la propuesta de un día. Se usa desde el botón y
 * automáticamente después de cargar proyectos desde Excel.
 * Conserva las observaciones que ya se habían escrito en ese día.
 * @param {object[]} [lista]  proyectos del día (si no se pasa, se toman del almacén)
 * @returns {Promise<number>} número de filas generadas
 */
export async function generarPropuesta(ctx, fecha = ctx.fecha, lista = null) {
  const e = ctx.store.estado;
  const proyectos = lista || ctx.store.proyectosDe(fecha);
  if (!proyectos.length) throw new Error('No hay proyectos este día. Cárgalos en "Proyectos del día".');
  const esVisible = fecha === ctx.fecha;
  const restricciones = esVisible ? e.restricciones : {};       // las de otros días se aplican al regenerar ese día
  const r = proponer({ fecha, proyectos, restricciones, param: e.param });
  const previas = {};
  if (esVisible) ((e.asignacion && e.asignacion.filas) || []).forEach(f => { if (f.observaciones) previas[f.proyectoId + '|' + f.persona] = f.observaciones; });
  const porId = Object.fromEntries(proyectos.map(p => [p.id, p]));
  r.filas.forEach(f => {
    f.observaciones = previas[f.proyectoId + '|' + f.persona] ?? (porId[f.proyectoId] || {}).observaciones ?? '';
  });
  await ctx.store.guardarAsignacion(fecha, {
    filas: r.filas, alertas: r.alertas, generado: new Date().toISOString(), firma: firma(proyectos, restricciones, e.param),
  });
  return r.filas.length;
}

/* ---------------------------- Iniciar ---------------------------- */
export function iniciar(ctx) {
  // Botón "Generar propuesta"
  $('btnGenerar').addEventListener('click', async () => {
    const msg = $('msgPropuesta');
    try { await generarPropuesta(ctx); mensaje(msg, 'Propuesta generada.', 'ok'); }
    catch (err) { mensaje(msg, err.code ? textoError(err) : err.message, 'error'); }
  });

  // Observaciones por fila: se guardan al salir de la casilla
  $('tablaPropuesta').addEventListener('change', async ev => {
    const inp = ev.target.closest('input.obs'); if (!inp) return;
    const a = ctx.store.estado.asignacion; if (!a) return;
    const filas = a.filas.map((f, i) => i === +inp.dataset.i ? { ...f, observaciones: inp.value } : f);
    try { await ctx.store.guardarAsignacion(ctx.fecha, { ...a, filas }); }
    catch (err) { mensaje($('msgPropuesta'), textoError(err), 'error'); }
  });

  // Excel del informe de salida
  $('btnExcelRutas').addEventListener('click', async () => {
    const msg = $('msgPropuesta'), a = ctx.store.estado.asignacion;
    if (!a) { mensaje(msg, 'Primero genera la propuesta.', 'error'); return; }
    const porId = Object.fromEntries(ctx.store.proyectosDe(ctx.fecha).map(p => [p.id, p]));
    try {
      await guardarArchivo(libroRutas(ctx.fecha, a.filas, porId), nombreArchivo('informe_de_salida_de_rutas', ctx.fecha), ctx.descargas);
      mensaje(msg, 'Excel listo.', 'ok');
    } catch (err) { if (!err || err.code !== 'declined') mensaje(msg, 'No se pudo descargar el Excel.', 'error'); }
  });

}

export function alCambiarFecha() { mensaje($('msgPropuesta'), ''); }

/* ---------------------------- Dibujar ---------------------------- */
export function dibujar(ctx) {
  $('tituloPropuesta').textContent = 'Propuesta del ' + fechaLarga(ctx.fecha);
  const a = ctx.store.estado.asignacion;
  const proyectos = ctx.store.proyectosDe(ctx.fecha);
  const porId = Object.fromEntries(proyectos.map(p => [p.id, p]));

  // No redibujar la tabla mientras alguien escribe una observación
  if ($('tablaPropuesta').contains(document.activeElement) && document.activeElement.matches('input.obs')) return;

  if (!a) {
    $('avisosPropuesta').innerHTML = '';
    $('cifrasPropuesta').innerHTML = '';
    $('tablaPropuesta').innerHTML = `<div class="vacio">${proyectos.length
      ? 'Hay ' + proyectos.length + ' proyecto(s) cargados. Presiona <b>Generar propuesta</b> para ver quién va a cada uno.'
      : 'Agrega los proyectos del día y luego genera la propuesta.'}</div>`;
    return;
  }

  /* Avisos */
  const avisos = [];
  if (a.firma && a.firma !== firma(proyectos, ctx.store.estado.restricciones, ctx.store.estado.param) && !a.restaurado) avisos.push(['alerta', 'Hubo cambios en proyectos, restricciones o parámetros después de generar. Vuelve a presionar <b>Generar propuesta</b>.']);
  if (a.restaurado) avisos.push(['info', 'Esta propuesta viene de un log cargado.']);
  (a.alertas || []).forEach(t => avisos.push(['error', esc(t)]));
  const porConfirmar = proyectos.filter(p => p.ensayosRevisar).length;
  if (porConfirmar) avisos.push(['alerta', porConfirmar + ' proyecto(s) tienen ensayos sugeridos sin confirmar. Revísalos en "Proyectos del día" antes de usar la propuesta.']);
  $('avisosPropuesta').innerHTML = avisos.map(([t, h]) => `<div class="aviso aviso--${t}">${h}</div>`).join('');

  /* Cifras */
  const filas = a.filas || [];
  const personas = new Set(filas.filter(f => f.persona).map(f => f.persona)).size;
  const vehiculos = new Set(filas.map(f => f.vehiculo).filter(v => v && !/Propio|NO APLICA|SIN TRANSPORTE/.test(v)).map(v => v.split(')')[0])).size;
  const sin = filas.filter(f => !f.persona).length;
  $('cifrasPropuesta').innerHTML = `
    <div class="cifra"><b>${proyectos.length}</b><span>proyectos</span></div>
    <div class="cifra"><b>${personas}</b><span>personas asignadas</span></div>
    <div class="cifra"><b>${vehiculos}</b><span>vehículos de empresa</span></div>
    <div class="cifra${sin ? ' cifra--error' : ''}"><b>${sin}</b><span>sin asignar</span></div>`;

  /* Tabla (mismo orden y contenido del Excel) */
  const rol = { principal: '', ayudante: '<span class="etiqueta etiqueta--gris">Ayudante</span>', combinacion: '<span class="etiqueta etiqueta--alerta">2º proyecto</span>', sin: '' };
  $('tablaPropuesta').innerHTML = `<div class="tabla-caja"><table>
    <thead><tr><th>Proyecto</th><th>Llegada</th><th>Persona</th><th>Vehículo</th><th>Salida</th><th>Salida recom.</th><th>Km</th><th></th><th>Sugerencia</th><th>Observaciones</th></tr></thead>
    <tbody>${filas.map((f, i) => {
      const p = porId[f.proyectoId] || { nombre: '(proyecto eliminado)' };
      const ruta = f.inicio && p.lat != null ? `<a href="${enlaceRuta(f.inicio, p)}" target="_blank" rel="noopener">ruta</a>` : '';
      const veh = f.vehiculo === 'SIN TRANSPORTE' ? '<span class="etiqueta etiqueta--error">Sin transporte</span>' : esc(f.vehiculo || '—');
      return `<tr${f.persona ? '' : ' class="fila--sin"'}>
        <td><span class="etiqueta etiqueta--zona etiqueta--${esc(p.zona)}">${esc((ZONA[p.zona] || {}).nombre || '')}</span>
            <b>${esc(p.nombre)}</b><span class="sub">${(p.ensayos || []).map(e => esc((ENSAYO[e] || {}).nombre || e)).join(' · ')}</span></td>
        <td class="dato">${esc(p.horaLlegada || '')}</td>
        <td>${f.persona ? '<b>' + esc(nombrePropio(f.persona)) + '</b> ' + rol[f.rol] : '<span class="etiqueta etiqueta--error">Sin asignar</span>'}</td>
        <td>${veh}${f.inicio ? `<span class="sub">desde ${esc(f.inicio.nombre)}</span>` : ''}</td>
        <td class="dato">${esc(p.horaSalida || '—')}</td>
        <td class="dato">${esc(f.salidaRecomendada || '—')}</td>
        <td class="dato">${f.km != null ? Number(f.km).toFixed(1) : '—'}</td>
        <td>${ruta}</td>
        <td>${(f.sugerencias || []).map(s => `<span class="sub">${esc(s)}</span>`).join('')}</td>
        <td><input class="obs" data-i="${i}" value="${esc(f.observaciones || '')}" aria-label="Observaciones"></td>
      </tr>`;
    }).join('')}</tbody></table></div>
    <p class="ayuda">Generada: ${a.generado ? esc(fechaCorta(a.generado.slice(0, 10))) + ' ' + esc(new Date(a.generado).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })) : '—'}. Las observaciones se guardan al salir de la casilla.</p>`;
}
