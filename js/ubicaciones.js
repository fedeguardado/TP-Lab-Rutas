/* =====================================================================
   ubicaciones.js — Leer la ubicación que pegan los administradores
   ---------------------------------------------------------------------
   Acepta, sin que el usuario elija el formato:
     1. Enlace largo de Google Maps  → toma el PIN (!3d…!4d…), no el
        centro de pantalla (@lat,lng), que puede estar a cientos de metros.
     2. Grados, minutos y segundos   → 13°38'02.5"N 89°06'11.3"W
     3. Coordenadas decimales        → 13.6340333, -89.1031268
   Los enlaces cortos (maps.app.goo.gl) no traen coordenadas: se avisa.
   ===================================================================== */

/** Resultado: { lat, lng } | { error: 'texto para el usuario' } */
export function leerUbicacion(texto) {
  if (!texto || !String(texto).trim()) return { error: 'Escribe o pega la ubicación.' };
  let s = String(texto).trim();
  try { s = decodeURIComponent(s.replace(/\+/g, ' ')); } catch (e) { /* se usa tal cual */ }

  // Enlace corto: no hay forma de leerlo desde aquí
  if (/maps\.app\.goo\.gl|goo\.gl\/maps/i.test(s)) {
    return { error: 'Este enlace es corto y no trae coordenadas. Ábrelo y pega aquí el enlace de la barra del navegador o las coordenadas que muestra Google Maps.' };
  }

  // 1) Pin del enlace largo
  let m = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (m) return validar(+m[1], +m[2]);

  // 2) Grados, minutos y segundos (con o sin segundos)
  const gms = /(\d{1,3})\s*°\s*(\d{1,2})\s*['′]\s*(?:(\d{1,2}(?:[.,]\d+)?)\s*(?:"|″|''))?\s*([NSns])[\s,]+(\d{1,3})\s*°\s*(\d{1,2})\s*['′]\s*(?:(\d{1,2}(?:[.,]\d+)?)\s*(?:"|″|''))?\s*([EWOewo])/;
  m = s.match(gms);
  if (m) {
    const aDec = (g, mi, se) => +g + (+mi) / 60 + (+(se || '0').replace(',', '.')) / 3600;
    let lat = aDec(m[1], m[2], m[3]), lng = aDec(m[5], m[6], m[7]);
    if (/[Ss]/.test(m[4])) lat = -lat;
    if (/[WwOo]/.test(m[8])) lng = -lng;      // W = oeste (O en español)
    return validar(lat, lng);
  }

  // 3) Parámetros comunes de enlaces (?q=lat,lng · destination= · ll=)
  m = s.match(/[?&](?:q|query|destination|ll|center)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (m) return validar(+m[1], +m[2]);

  // 4) Decimales sueltos "13.63, -89.10"
  m = s.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (m) return validar(+m[1], +m[2]);

  // 5) Último recurso: centro de pantalla del enlace (@lat,lng)
  m = s.match(/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (m) return validar(+m[1], +m[2]);

  return { error: 'No encontré coordenadas. Pega el enlace largo de Google Maps, o coordenadas como 13.6340, -89.1031 o 13°38\'02.5"N 89°06\'11.3"W.' };
}

/** Revisa rangos y que el punto esté cerca de El Salvador (aviso, no bloqueo). */
function validar(lat, lng) {
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { error: 'Las coordenadas no son válidas.' };
  }
  const r = { lat, lng };
  if (lat < 12.8 || lat > 14.6 || lng < -90.3 || lng > -87.4) {
    r.aviso = 'Esta ubicación queda fuera de El Salvador. Revísala.';
  }
  return r;
}

/** Texto corto para mostrar una coordenada. */
export function coordTexto(p) { return p ? p.lat.toFixed(5) + ', ' + p.lng.toFixed(5) : '—'; }

/** Enlace para ver un punto en Google Maps. */
export function enlacePunto(p) { return 'https://www.google.com/maps/search/?api=1&query=' + p.lat + ',' + p.lng; }
