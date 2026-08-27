(function () {
  'use strict';

  const { rad, SYNODIC_MONTH, MOON_RADIUS_KM } = Astro;

  const $ = (id) => document.getElementById(id);

  const PHASES = [
    { name: 'New Moon', emoji: '🌑' },
    { name: 'Waxing Crescent', emoji: '🌒' },
    { name: 'First Quarter', emoji: '🌓' },
    { name: 'Waxing Gibbous', emoji: '🌔' },
    { name: 'Full Moon', emoji: '🌕' },
    { name: 'Waning Gibbous', emoji: '🌖' },
    { name: 'Last Quarter', emoji: '🌗' },
    { name: 'Waning Crescent', emoji: '🌘' },
  ];

  // phase: 0..1 (0 = new, 0.5 = full). Principal phases get a ~±0.6 day window.
  function phaseInfo(phase) {
    const tol = 0.02;
    if (phase < tol || phase > 1 - tol) return PHASES[0];
    if (Math.abs(phase - 0.25) < tol) return PHASES[2];
    if (Math.abs(phase - 0.5) < tol) return PHASES[4];
    if (Math.abs(phase - 0.75) < tol) return PHASES[6];
    if (phase < 0.25) return PHASES[1];
    if (phase < 0.5) return PHASES[3];
    if (phase < 0.75) return PHASES[5];
    return PHASES[7];
  }

  const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

  // SunCalc azimuth is measured from south, positive westward -> compass bearing
  function toBearing(az) {
    return ((az / rad) + 180 + 360) % 360;
  }
  function compassName(bearing) {
    return COMPASS[Math.round(bearing / 22.5) % 16];
  }

  const fmtTime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  const fmtDate = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  // ---------- moon rendering ----------

  function drawMoon(canvas, phase, southernHemisphere) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) / 2 - 24;

    ctx.clearRect(0, 0, w, h);

    // outer glow
    const glow = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r + 24);
    glow.addColorStop(0, 'rgba(226, 232, 255, 0.16)');
    glow.addColorStop(1, 'rgba(226, 232, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 24, 0, Math.PI * 2);
    ctx.fill();

    const LIT = '#e8e4d8';
    const DARK = '#1b2036';

    // full disc in shadow
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = DARK;
    ctx.fill();

    // In the northern hemisphere a waxing moon is lit on the right.
    let litRight = phase <= 0.5;
    if (southernHemisphere) litRight = !litRight;

    const cosA = Math.cos(2 * Math.PI * phase); // >0 crescent, <0 gibbous
    const rx = Math.abs(cosA) * r;

    // lit half-disc
    ctx.beginPath();
    if (litRight) ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2);
    else ctx.arc(cx, cy, r, Math.PI / 2, (3 * Math.PI) / 2);
    ctx.closePath();
    ctx.fillStyle = LIT;
    ctx.fill();

    // terminator ellipse: carves the crescent or extends the gibbous
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(rx, 0.001), r, 0, 0, Math.PI * 2);
    ctx.fillStyle = cosA > 0 ? DARK : LIT;
    ctx.fill();

    // maria / craters, clipped to the disc
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    const craters = [
      [-0.30, -0.28, 0.24], [0.18, -0.10, 0.17], [-0.05, 0.24, 0.20],
      [0.36, 0.30, 0.11], [-0.42, 0.18, 0.09], [0.05, -0.42, 0.10],
      [0.44, -0.30, 0.07], [-0.20, 0.46, 0.08],
    ];
    ctx.fillStyle = 'rgba(90, 96, 120, 0.16)';
    for (const [dx, dy, cr] of craters) {
      ctx.beginPath();
      ctx.arc(cx + dx * r, cy + dy * r, cr * r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // faint rim so the dark limb reads against the sky
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(226, 232, 255, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // ---------- starfield ----------

  function drawStars() {
    const canvas = $('stars');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const n = Math.floor((window.innerWidth * window.innerHeight) / 5000);
    for (let i = 0; i < n; i++) {
      const x = Math.random() * window.innerWidth;
      const y = Math.random() * window.innerHeight;
      const size = Math.random() * 1.4 + 0.3;
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.7 + 0.1})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---------- data -> UI ----------

  function nextRiseSet(kind, lat, lon) {
    // find the next upcoming rise or set, searching today then following days
    const now = new Date();
    for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
      const day = new Date(now);
      day.setDate(day.getDate() + dayOffset);
      const times = Astro.getMoonTimes(day, lat, lon);
      if (times.alwaysUp || times.alwaysDown) {
        return { special: times.alwaysUp ? 'Up all day' : 'Below horizon all day' };
      }
      const t = times[kind];
      if (t && t > now) return { time: t, dayOffset };
    }
    return { special: '—' };
  }

  function describeRiseSet(result, lat, lon) {
    if (result.special) return { main: result.special, sub: '' };
    const t = result.time;
    const pos = Astro.getMoonPosition(t, lat, lon);
    const bearing = toBearing(pos.azimuth);
    const dayLabel = result.dayOffset === 0 ? 'tonight' : 'tomorrow';
    return {
      main: fmtTime.format(t),
      sub: `${dayLabel} · ${compassName(bearing)} (${Math.round(bearing)}°)`,
    };
  }

  function render(lat, lon) {
    const now = new Date();
    const illum = Astro.getMoonIllumination(now);
    const pos = Astro.getMoonPosition(now, lat, lon);
    const info = phaseInfo(illum.phase);
    const age = illum.phase * SYNODIC_MONTH;

    drawMoon($('moonCanvas'), illum.phase, lat < 0);

    $('phaseName').textContent = `${info.emoji} ${info.name}`;
    $('phaseDetail').textContent =
      `${(illum.fraction * 100).toFixed(1)}% of the disc is illuminated`;

    $('illumination').textContent = `${(illum.fraction * 100).toFixed(1)}%`;
    $('moonAge').textContent = `${age.toFixed(1)} days into the lunar cycle`;

    const rise = describeRiseSet(nextRiseSet('rise', lat, lon), lat, lon);
    const set = describeRiseSet(nextRiseSet('set', lat, lon), lat, lon);
    $('moonrise').textContent = rise.main;
    $('moonriseDir').textContent = rise.sub;
    $('moonset').textContent = set.main;
    $('moonsetDir').textContent = set.sub;

    const altDeg = pos.altitude / rad;
    const bearing = toBearing(pos.azimuth);
    if (altDeg > 0) {
      $('position').textContent = `${altDeg.toFixed(0)}° above horizon`;
      $('positionDetail').textContent =
        `look ${compassName(bearing)} (azimuth ${Math.round(bearing)}°)`;
    } else {
      $('position').textContent = 'Below the horizon';
      $('positionDetail').textContent =
        `${Math.abs(altDeg).toFixed(0)}° below, toward ${compassName(bearing)}`;
    }

    $('distance').textContent = `${Math.round(pos.distance).toLocaleString()} km`;
    const angular = (2 * Math.asin(MOON_RADIUS_KM / pos.distance)) / rad;
    $('angularSize').textContent = `angular size ${angular.toFixed(2)}°`;

    const daysToFull = ((0.5 - illum.phase + 1) % 1) * SYNODIC_MONTH;
    const daysToNew = (1 - illum.phase) % 1 * SYNODIC_MONTH;
    const fullDate = new Date(now.valueOf() + daysToFull * 86400000);
    const newDate = new Date(now.valueOf() + daysToNew * 86400000);
    $('nextFull').textContent = `🌕 ${fmtDate.format(fullDate)}`;
    $('nextNew').textContent = `next new moon ${fmtDate.format(newDate)}`;

    $('updatedAt').textContent =
      `Computed for ${fmtDate.format(now)}, ${fmtTime.format(now)} at ` +
      `${lat.toFixed(3)}°, ${lon.toFixed(3)}°`;
  }

  async function lookupPlaceName(lat, lon) {
    try {
      const url = 'https://api.bigdatacloud.net/data/reverse-geocode-client' +
        `?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      const parts = [data.city || data.locality, data.principalSubdivision, data.countryName]
        .filter(Boolean);
      if (parts.length) return parts.join(', ');
    } catch (err) {
      /* offline or blocked — fall back to raw coordinates */
    }
    return `${lat.toFixed(3)}°, ${lon.toFixed(3)}°`;
  }

  // ---------- location flow ----------

  let refreshTimer = null;

  function start(lat, lon) {
    $('locationGate').classList.add('hidden');
    $('moonContent').classList.remove('hidden');
    render(lat, lon);
    lookupPlaceName(lat, lon).then((name) => {
      $('placeName').textContent = `📍 ${name}`;
    });
    try {
      localStorage.setItem('moonlight-location', JSON.stringify({ lat, lon }));
    } catch (err) { /* private mode */ }
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => render(lat, lon), 60000);
  }

  function requestGeolocation() {
    const msg = $('gateMessage');
    if (!('geolocation' in navigator)) {
      msg.textContent = 'Geolocation is not available in this browser — enter coordinates below.';
      return;
    }
    msg.textContent = 'Requesting your location…';
    navigator.geolocation.getCurrentPosition(
      (p) => start(p.coords.latitude, p.coords.longitude),
      (err) => {
        msg.textContent = err.code === err.PERMISSION_DENIED
          ? 'Location permission was denied — enter coordinates below instead.'
          : 'Could not determine your location — enter coordinates below instead.';
        document.querySelector('.manual').open = true;
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  }

  $('useLocationBtn').addEventListener('click', requestGeolocation);

  $('manualForm').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const lat = parseFloat($('latInput').value);
    const lon = parseFloat($('lonInput').value);
    if (Number.isFinite(lat) && Number.isFinite(lon)) start(lat, lon);
  });

  $('changeLocation').addEventListener('click', () => {
    if (refreshTimer) clearInterval(refreshTimer);
    try { localStorage.removeItem('moonlight-location'); } catch (err) { /* ignore */ }
    $('moonContent').classList.add('hidden');
    $('locationGate').classList.remove('hidden');
    $('gateMessage').textContent = 'To show tonight’s moon, Moonlight needs your location.';
  });

  window.addEventListener('resize', drawStars);
  drawStars();

  // startup: URL params > saved location > ask
  const params = new URLSearchParams(location.search);
  const qLat = parseFloat(params.get('lat'));
  const qLon = parseFloat(params.get('lon'));
  if (Number.isFinite(qLat) && Number.isFinite(qLon)) {
    start(qLat, qLon);
  } else {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('moonlight-location')); } catch (err) { /* ignore */ }
    if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lon)) {
      start(saved.lat, saved.lon);
    }
  }
})();
