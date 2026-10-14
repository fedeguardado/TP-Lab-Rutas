/* =====================================================================
   ui-respaldo.js — Botones "Guardar log del día" y "Cargar log del día"
   ---------------------------------------------------------------------
   El log (respaldo) es un Excel con SOLO lo cargado en el día visible:
   proyectos, restricciones y propuesta. Al cargarlo se reemplaza ese
   día completo, después de pedir confirmación. Los botones están en la
   cabecera, así se ven desde cualquier pestaña.
   ===================================================================== */

import { libroRespaldo, leerRespaldo, guardarArchivo, nombreArchivo } from './excel.js';
import { textoError } from './datos.js';
import { $, esc, fechaLarga } from './util.js';

let pendiente = null;        // log leído que espera confirmación

/** Muestra un mensaje en la barra de respaldo. tipo: 'info' | 'alerta' | 'error' | 'ok' */
function barra(html, tipo = 'info') {
  $('barraRespaldo').innerHTML = html ? `<div class="aviso aviso--${tipo === 'ok' ? 'info' : tipo}">${html}</div>` : '';
}

export function iniciar(ctx) {
  /* ---------- Guardar log ---------- */
  $('btnRespaldoBajar').addEventListener('click', async () => {
    if (!ctx.store) return;
    const e = ctx.store.estado, proyectos = ctx.store.proyectosDe(ctx.fecha);
    if (!proyectos.length && !e.asignacion) { barra('No hay nada cargado el ' + esc(fechaLarga(ctx.fecha)) + ' para guardar.', 'alerta'); return; }
    try {
      await guardarArchivo(libroRespaldo(ctx.fecha, proyectos, e.restricciones, e.asignacion),
        nombreArchivo('log_tplab_rutas', ctx.fecha), ctx.descargas);
      barra('Log del ' + esc(fechaLarga(ctx.fecha)) + ' guardado (' + proyectos.length + ' proyectos).', 'ok');
    } catch (err) {
      if (!err || err.code !== 'declined') barra('No se pudo descargar el log.', 'error');
    }
  });

  /* ---------- Cargar log: leer y pedir confirmación ---------- */
  $('archivoRespaldo').addEventListener('change', ev => {
    const archivo = ev.target.files[0]; ev.target.value = ''; if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => {
      try {
        pendiente = leerRespaldo(lector.result);
        barra(`¿Reemplazar todo lo del <b>${esc(fechaLarga(pendiente.fecha))}</b> con este log (${pendiente.proyectos.length} proyectos)?
          Lo que hay ahora en ese día se pierde.
          <span class="botones" style="margin-top:8px">
            <button class="boton boton--chico boton--peligro confirmar" type="button" id="btnConfirmarRespaldo">Sí, reemplazar</button>
            <button class="boton boton--chico" type="button" id="btnCancelarRespaldo">Cancelar</button>
          </span>`, 'alerta');
      } catch (err) { pendiente = null; barra(esc(err.message || 'No pude leer el archivo.'), 'error'); }
    };
    lector.readAsArrayBuffer(archivo);
  });

  /* ---------- Confirmar o cancelar ---------- */
  $('barraRespaldo').addEventListener('click', async ev => {
    if (ev.target.id === 'btnCancelarRespaldo') { pendiente = null; barra(''); return; }
    if (ev.target.id !== 'btnConfirmarRespaldo' || !pendiente || !ctx.store) return;
    const r = pendiente; pendiente = null;
    try {
      await ctx.store.reemplazarDia(r.fecha, r, (n, t) => barra(`Restaurando ${n} de ${t}…`));
      barra('Log cargado: ' + esc(fechaLarga(r.fecha)) + ' quedó como en el archivo.', 'ok');
      if (r.fecha !== ctx.fecha) { $('fecha').value = r.fecha; $('fecha').dispatchEvent(new Event('change')); }
    } catch (err) { barra(esc(textoError(err)), 'error'); }
  });
}

export function alCambiarFecha() { if (!pendiente) barra(''); }
export function dibujar() { /* sin contenido propio que redibujar */ }
