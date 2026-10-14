/* =====================================================================
   distancias.js — Distancia y tiempo de viaje ESTIMADOS
   ---------------------------------------------------------------------
   La página no puede consultar Google Maps por sí sola, así que estima:
     km reales ≈ km en línea recta × factor de carretera
     minutos   ≈ km reales ÷ velocidad promedio × 60
   El factor y la velocidad se ajustan en Parámetros. Cada fila del
   resultado trae un enlace a Google Maps para ver la ruta exacta.
   ===================================================================== */

/** Distancia en línea recta entre dos puntos (fórmula de haversine), en km. */
export function kmLineaRecta(a, b) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Viaje estimado por carretera: { km, min }. */
export function viaje(a, b, param) {
  // Sin ubicación en alguno de los dos puntos: no se puede calcular (km = null)
  if (!a || !b || a.lat == null || b.lat == null) return { km: null, min: 0 };
  const km = kmLineaRecta(a, b) * param.factor;
  return { km, min: km / param.velocidad * 60 };
}

/** Enlace de Google Maps con la ruta en carro entre dos puntos (con parada opcional). */
export function enlaceRuta(a, b, parada) {
  let u = 'https://www.google.com/maps/dir/?api=1&origin=' + a.lat + ',' + a.lng +
          '&destination=' + b.lat + ',' + b.lng + '&travelmode=driving';
  if (parada) u += '&waypoints=' + parada.lat + ',' + parada.lng;
  return u;
}
