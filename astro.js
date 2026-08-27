/*
 * Lunar astronomy calculations, based on the simplified formulae from
 * Astronomical Algorithms (Jean Meeus), in the style of the SunCalc library.
 * All angles in radians internally; distances in kilometres.
 */
(function (global) {
  'use strict';

  const rad = Math.PI / 180;
  const dayMs = 86400000;
  const J1970 = 2440588;
  const J2000 = 2451545;
  const e = rad * 23.4397; // obliquity of the ecliptic

  const SYNODIC_MONTH = 29.530588853; // days
  const MOON_RADIUS_KM = 1737.4;

  function toDays(date) {
    return date.valueOf() / dayMs - 0.5 + J1970 - J2000;
  }

  function rightAscension(l, b) {
    return Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  }
  function declination(l, b) {
    return Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  }
  function siderealTime(d, lw) {
    return rad * (280.16 + 360.9856235 * d) - lw;
  }
  function azimuth(H, phi, dec) {
    return Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  }
  function altitude(H, phi, dec) {
    return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  }

  // Refraction near the horizon (Sæmundsson), input/output in radians
  function astroRefraction(h) {
    if (h < 0) h = 0;
    return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179));
  }

  function sunCoords(d) {
    const M = rad * (357.5291 + 0.98560028 * d);
    const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    const P = rad * 102.9372; // perihelion of the Earth
    const L = M + C + P + Math.PI; // ecliptic longitude
    return { ra: rightAscension(L, 0), dec: declination(L, 0) };
  }

  function moonCoords(d) {
    const L = rad * (218.316 + 13.176396 * d); // ecliptic longitude
    const M = rad * (134.963 + 13.064993 * d); // mean anomaly
    const F = rad * (93.272 + 13.229350 * d);  // mean distance

    const l = L + rad * 6.289 * Math.sin(M);
    const b = rad * 5.128 * Math.sin(F);
    const dt = 385001 - 20905 * Math.cos(M); // distance to the moon, km

    return { ra: rightAscension(l, b), dec: declination(l, b), dist: dt };
  }

  function getMoonPosition(date, lat, lng) {
    const lw = rad * -lng;
    const phi = rad * lat;
    const d = toDays(date);

    const c = moonCoords(d);
    const H = siderealTime(d, lw) - c.ra;
    let h = altitude(H, phi, c.dec);
    const pa = Math.atan2(
      Math.sin(H),
      Math.tan(phi) * Math.cos(c.dec) - Math.sin(c.dec) * Math.cos(H)
    );

    h += astroRefraction(h);

    return {
      azimuth: azimuth(H, phi, c.dec), // measured from south, westward positive
      altitude: h,
      distance: c.dist,
      parallacticAngle: pa,
    };
  }

  // fraction: illuminated fraction 0..1
  // phase: 0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter
  function getMoonIllumination(date) {
    const d = toDays(date);
    const s = sunCoords(d);
    const m = moonCoords(d);

    const sdist = 149598000; // distance from Earth to Sun, km
    const phi = Math.acos(
      Math.sin(s.dec) * Math.sin(m.dec) +
        Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra)
    );
    const inc = Math.atan2(sdist * Math.sin(phi), m.dist - sdist * Math.cos(phi));
    const angle = Math.atan2(
      Math.cos(s.dec) * Math.sin(s.ra - m.ra),
      Math.sin(s.dec) * Math.cos(m.dec) -
        Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra)
    );

    return {
      fraction: (1 + Math.cos(inc)) / 2,
      phase: 0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / Math.PI,
      angle,
    };
  }

  function hoursLater(date, h) {
    return new Date(date.valueOf() + (h * dayMs) / 24);
  }

  // Rise and set times for the calendar day containing `date` (local time)
  function getMoonTimes(date, lat, lng) {
    const t = new Date(date);
    t.setHours(0, 0, 0, 0);

    const hc = 0.133 * rad;
    let h0 = getMoonPosition(t, lat, lng).altitude - hc;
    let rise, set, ye;

    // scan the day in 2-hour steps, fitting a parabola through three points
    for (let i = 1; i <= 24; i += 2) {
      const h1 = getMoonPosition(hoursLater(t, i), lat, lng).altitude - hc;
      const h2 = getMoonPosition(hoursLater(t, i + 1), lat, lng).altitude - hc;

      const a = (h0 + h2) / 2 - h1;
      const b = (h2 - h0) / 2;
      const xe = -b / (2 * a);
      ye = (a * xe + b) * xe + h1;
      const disc = b * b - 4 * a * h1;
      let roots = 0;
      let x1 = 0;
      let x2 = 0;

      if (disc >= 0) {
        const dx = Math.sqrt(disc) / (Math.abs(a) * 2);
        x1 = xe - dx;
        x2 = xe + dx;
        if (Math.abs(x1) <= 1) roots++;
        if (Math.abs(x2) <= 1) roots++;
        if (x1 < -1) x1 = x2;
      }

      if (roots === 1) {
        if (h0 < 0) rise = i + x1;
        else set = i + x1;
      } else if (roots === 2) {
        rise = i + (ye < 0 ? x2 : x1);
        set = i + (ye < 0 ? x1 : x2);
      }

      if (rise !== undefined && set !== undefined) break;
      h0 = h2;
    }

    const result = {};
    if (rise !== undefined) result.rise = hoursLater(t, rise);
    if (set !== undefined) result.set = hoursLater(t, set);
    if (rise === undefined && set === undefined) {
      result[ye > 0 ? 'alwaysUp' : 'alwaysDown'] = true;
    }
    return result;
  }

  // Point on Earth where the moon is at the zenith right now
  function getSubLunarPoint(date) {
    const d = toDays(date);
    const c = moonCoords(d);
    const theta = rad * (280.16 + 360.9856235 * d); // Greenwich sidereal angle
    let lon = (c.ra - theta) / rad;
    lon = ((lon % 360) + 540) % 360 - 180;
    return { lat: c.dec / rad, lon };
  }

  global.Astro = {
    getSubLunarPoint,
    rad,
    SYNODIC_MONTH,
    MOON_RADIUS_KM,
    getMoonPosition,
    getMoonIllumination,
    getMoonTimes,
  };
})(window);
