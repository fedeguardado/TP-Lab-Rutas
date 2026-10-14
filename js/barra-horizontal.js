/* =====================================================================
   barra-horizontal.js — Barra de desplazamiento horizontal siempre visible
   ---------------------------------------------------------------------
   Las tablas anchas (.tabla-caja) se mueven a lo ancho, pero su barra
   normal queda al final de la tabla, lejos de la vista. Aquí se agrega
   debajo de cada tabla una barra (.barra-h) que el CSS deja pegada al
   borde inferior de la pantalla, y se sincroniza con la tabla:
     · mover la barra  → mueve la tabla
     · mover la tabla (Shift + rueda, teclado) → mueve la barra
   Funciona sola: vigila la página y atiende cada tabla nueva que aparece.
   ===================================================================== */

/** Prepara una caja de tabla (solo una vez). */
function preparar(caja) {
  if (caja.dataset.barra) return;
  caja.dataset.barra = '1';

  const barra = document.createElement('div');
  barra.className = 'barra-h';
  const relleno = document.createElement('div');   // da a la barra el mismo ancho que la tabla
  barra.appendChild(relleno);
  caja.after(barra);

  // Sincronizar en ambos sentidos (solo si la posición es distinta, para no entrar en ciclo)
  barra.addEventListener('scroll', () => { if (caja.scrollLeft !== barra.scrollLeft) caja.scrollLeft = barra.scrollLeft; });
  caja.addEventListener('scroll', () => { if (barra.scrollLeft !== caja.scrollLeft) barra.scrollLeft = caja.scrollLeft; });

  // Ajustar el ancho cuando cambia la tabla o la ventana; ocultar si no hace falta
  const ajustar = () => {
    relleno.style.width = caja.scrollWidth + 'px';
    barra.hidden = caja.scrollWidth <= caja.clientWidth + 1;
  };
  new ResizeObserver(ajustar).observe(caja);
  const tabla = caja.querySelector('table');
  if (tabla) new ResizeObserver(ajustar).observe(tabla);
  ajustar();
}

/** Atiende las tablas que ya existen y las que se dibujen después. */
export function activarBarrasHorizontales() {
  document.querySelectorAll('.tabla-caja').forEach(preparar);
  new MutationObserver(() => document.querySelectorAll('.tabla-caja:not([data-barra])').forEach(preparar))
    .observe(document.body, { childList: true, subtree: true });
}
