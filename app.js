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
    const r = Math.min(w, h) / 2 - 34;

    ctx.clearRect(0, 0, w, h);

    // atmospheric halo
    const halo = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r + 34);
    halo.addColorStop(0, 'rgba(245, 224, 176, 0.16)');
    halo.addColorStop(0.55, 'rgba(206, 218, 255, 0.06)');
    halo.addColorStop(1, 'rgba(206, 218, 255, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 34, 0, Math.PI * 2);
    ctx.fill();

    // In the northern hemisphere a waxing moon is lit on the right.
    let litRight = phase <= 0.5;
    if (southernHemisphere) litRight = !litRight;

    const cosA = Math.cos(2 * Math.PI * phase); // >0 crescent, <0 gibbous
    const rx = Math.max(Math.abs(cosA) * r, 0.001);

    // sharp mask of the lit region (half disc +/- terminator ellipse)
    const mask = document.createElement('canvas');
    mask.width = w;
    mask.height = h;
    const mctx = mask.getContext('2d');
    mctx.fillStyle = '#fff';
    mctx.beginPath();
    if (litRight) mctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2);
    else mctx.arc(cx, cy, r, Math.PI / 2, (3 * Math.PI) / 2);
    mctx.closePath();
    mctx.fill();
    mctx.beginPath();
    mctx.ellipse(cx, cy, rx, r, 0, 0, Math.PI * 2);
    if (cosA > 0) {
      mctx.globalCompositeOperation = 'destination-out'; // carve crescent
      mctx.fill();
      mctx.globalCompositeOperation = 'source-over';
    } else {
      mctx.fill(); // extend gibbous
    }

    // blur the mask so the terminator falls off softly
    const soft = document.createElement('canvas');
    soft.width = w;
    soft.height = h;
    const softCtx = soft.getContext('2d');
    softCtx.filter = `blur(${Math.max(w / 90, 3)}px)`;
    softCtx.drawImage(mask, 0, 0);

    // sun-lit surface texture
    const lit = document.createElement('canvas');
    lit.width = w;
    lit.height = h;
    const lctx = lit.getContext('2d');
    const sunX = cx + (litRight ? 1 : -1) * r * 0.4;
    const surface = lctx.createRadialGradient(sunX, cy - r * 0.3, r * 0.1, cx, cy, r * 1.12);
    surface.addColorStop(0, '#f9f5e8');
    surface.addColorStop(0.55, '#e4ddc9');
    surface.addColorStop(1, '#b8b1a0');
    lctx.fillStyle = surface;
    lctx.beginPath();
    lctx.arc(cx, cy, r, 0, Math.PI * 2);
    lctx.fill();

    // maria — the large dark plains, softly blurred
    const maria = [
      [-0.28, -0.30, 0.30, 0.24], [0.14, -0.16, 0.22, 0.18],
      [-0.06, 0.20, 0.26, 0.20], [0.33, 0.24, 0.14, 0.12],
      [0.10, -0.44, 0.14, 0.10],
    ];
    lctx.save();
    lctx.beginPath();
    lctx.arc(cx, cy, r, 0, Math.PI * 2);
    lctx.clip();
    lctx.filter = `blur(${Math.max(w / 60, 4)}px)`;
    lctx.fillStyle = 'rgba(122, 119, 112, 0.30)';
    for (const [dx, dy, mrx, mry] of maria) {
      lctx.beginPath();
      lctx.ellipse(cx + dx * r, cy + dy * r, mrx * r, mry * r, 0, 0, Math.PI * 2);
      lctx.fill();
    }
    lctx.filter = 'none';

    // craters — small, with a bright rim on the sunward side
    const craters = [
      [-0.44, 0.16, 0.075], [0.44, -0.30, 0.06], [-0.18, 0.48, 0.07],
      [0.30, 0.46, 0.05], [-0.52, -0.14, 0.05], [0.52, 0.06, 0.045],
      [0.02, 0.58, 0.055], [-0.34, -0.52, 0.05],
    ];
    for (const [dx, dy, cr] of craters) {
      const px = cx + dx * r;
      const py = cy + dy * r;
      const pr = cr * r;
      const pit = lctx.createRadialGradient(px, py, pr * 0.1, px, py, pr);
      pit.addColorStop(0, 'rgba(108, 105, 98, 0.30)');
      pit.addColorStop(0.75, 'rgba(108, 105, 98, 0.16)');
      pit.addColorStop(1, 'rgba(108, 105, 98, 0)');
      lctx.fillStyle = pit;
      lctx.beginPath();
      lctx.arc(px, py, pr, 0, Math.PI * 2);
      lctx.fill();
      lctx.strokeStyle = 'rgba(255, 252, 240, 0.20)';
      lctx.lineWidth = Math.max(pr * 0.14, 1);
      lctx.beginPath();
      lctx.arc(px, py, pr * 0.85, Math.PI * 0.7, Math.PI * 1.6);
      lctx.stroke();
    }
    lctx.restore();

    // keep only the lit region, with the soft terminator edge
    lctx.globalCompositeOperation = 'destination-in';
    lctx.drawImage(soft, 0, 0);

    // assemble: earthshine-lit dark side, then the lit surface, clipped to the disc
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    const dark = ctx.createRadialGradient(cx, cy - r * 0.3, r * 0.2, cx, cy, r * 1.1);
    dark.addColorStop(0, '#2b3151');
    dark.addColorStop(0.6, '#1e2340');
    dark.addColorStop(1, '#161a30');
    ctx.fillStyle = dark;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.drawImage(lit, 0, 0);
    ctx.restore();

    // faint rim so the dark limb reads against the sky
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(226, 233, 255, 0.14)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // ---------- starfield ----------

  let starField = [];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initStars() {
    const canvas = $('stars');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.floor((window.innerWidth * window.innerHeight) / 4200);
    starField = [];
    for (let i = 0; i < n; i++) {
      starField.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() < 0.06 ? Math.random() * 1.2 + 1.3 : Math.random() * 1.1 + 0.3,
        base: Math.random() * 0.55 + 0.15,
        warm: Math.random() < 0.18, // a few golden stars among the white
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.0012 + 0.0003,
      });
    }
    if (reducedMotion) paintStars(0);
  }

  function paintStars(t) {
    const canvas = $('stars');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const s of starField) {
      const twinkle = reducedMotion ? 1 : 0.65 + 0.35 * Math.sin(s.phase + t * s.speed);
      ctx.fillStyle = s.warm
        ? `rgba(245, 224, 176, ${s.base * twinkle})`
        : `rgba(235, 240, 255, ${s.base * twinkle})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function tickStars(t) {
    paintStars(t);
    requestAnimationFrame(tickStars);
  }

  // ---------- world map ----------

  let worldGeo = null;
  let worldGeoRequested = false;
  let lastLoc = null;

  function loadWorld() {
    if (worldGeoRequested) return;
    worldGeoRequested = true;
    fetch('https://cdn.jsdelivr.net/gh/johan/world.geo.json@master/countries.geo.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((geo) => {
        worldGeo = geo;
        if (lastLoc) drawMap(lastLoc.lat, lastLoc.lon);
      })
      .catch(() => { /* map falls back to graticule only */ });
  }

  // equirectangular projection
  function project(lat, lon, w, h) {
    return [((lon + 180) / 360) * w, ((90 - lat) / 180) * h];
  }

  function drawLand(ctx, w, h) {
    if (!worldGeo) return;
    ctx.fillStyle = '#414b78';
    ctx.beginPath();
    for (const feature of worldGeo.features) {
      const g = feature.geometry;
      if (!g) continue;
      const polys = g.type === 'Polygon' ? [g.coordinates]
        : g.type === 'MultiPolygon' ? g.coordinates : [];
      for (const poly of polys) {
        for (const ring of poly) {
          ring.forEach(([lon, lat], i) => {
            const [x, y] = project(lat, lon, w, h);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
        }
      }
    }
    ctx.fill();
  }

  function drawMap(lat, lon) {
    const canvas = $('mapCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const now = new Date();
    const sub = Astro.getSubLunarPoint(now);

    // ocean
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0d1330';
    ctx.fillRect(0, 0, w, h);

    // graticule
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let gl = -150; gl <= 150; gl += 30) {
      const [x] = project(0, gl, w, h);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let gl = -60; gl <= 60; gl += 30) {
      const [, y] = project(gl, 0, w, h);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    drawLand(ctx, w, h);

    // shade the hemisphere that cannot see the moon:
    // visible where the great-circle distance to the sub-lunar point < 90°
    const shade = document.createElement('canvas');
    const sw = 360;
    const sh = 180;
    shade.width = sw;
    shade.height = sh;
    const sctx = shade.getContext('2d');
    const img = sctx.createImageData(sw, sh);
    const sinLat1 = Math.sin(sub.lat * rad);
    const cosLat1 = Math.cos(sub.lat * rad);
    for (let py = 0; py < sh; py++) {
      const phi = (90 - ((py + 0.5) / sh) * 180) * rad;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      for (let px = 0; px < sw; px++) {
        const lam = (((px + 0.5) / sw) * 360 - 180) * rad;
        const cosc = sinLat1 * sinPhi +
          cosLat1 * cosPhi * Math.cos(lam - sub.lon * rad);
        if (cosc < 0) {
          const idx = (py * sw + px) * 4;
          img.data[idx] = 2;
          img.data[idx + 1] = 3;
          img.data[idx + 2] = 14;
          img.data[idx + 3] = 165; // translucent night shadow
        }
      }
    }
    sctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(shade, 0, 0, w, h);

    // soft glow + moon marker at the sub-lunar point
    const [mx, my] = project(sub.lat, sub.lon, w, h);
    const glow = ctx.createRadialGradient(mx, my, 0, mx, my, 60);
    glow.addColorStop(0, 'rgba(255, 233, 170, 0.35)');
    glow.addColorStop(1, 'rgba(255, 233, 170, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(mx, my, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🌙', mx, my);

    // user marker: gold dot with a halo ring
    const [ux, uy] = project(lat, lon, w, h);
    const ring = ctx.createRadialGradient(ux, uy, 2, ux, uy, 20);
    ring.addColorStop(0, 'rgba(245, 214, 152, 0.5)');
    ring.addColorStop(1, 'rgba(245, 214, 152, 0)');
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(ux, uy, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ux, uy, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = '#f5d698';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();
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

    $('phaseName').textContent = info.name;
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

    lastLoc = { lat, lon };
    loadWorld();
    drawMap(lat, lon);

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

  // ZIP code -> coordinates via the free Zippopotam.us API (US ZIP codes)
  async function lookupZip(zip) {
    const res = await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(zip)}`);
    if (!res.ok) throw new Error('ZIP not found');
    const data = await res.json();
    const p = data.places && data.places[0];
    if (!p) throw new Error('ZIP not found');
    return {
      lat: parseFloat(p.latitude),
      lon: parseFloat(p.longitude),
      name: `${p['place name']}, ${p['state abbreviation'] || p.state}`,
    };
  }

  // ---------- location flow ----------

  let refreshTimer = null;

  function start(lat, lon, placeName) {
    $('locationGate').classList.add('hidden');
    $('moonContent').classList.remove('hidden');
    render(lat, lon);
    if (placeName) {
      $('placeName').textContent = `📍 ${placeName}`;
    } else {
      lookupPlaceName(lat, lon).then((name) => {
        $('placeName').textContent = `📍 ${name}`;
      });
    }
    try {
      localStorage.setItem('moonlight-location',
        JSON.stringify({ lat, lon, name: placeName || null }));
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

  $('zipForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const zip = $('zipInput').value.trim();
    const errEl = $('zipError');
    errEl.classList.add('hidden');
    if (!/^\d{5}$/.test(zip)) {
      errEl.textContent = 'Please enter a 5-digit US ZIP code.';
      errEl.classList.remove('hidden');
      return;
    }
    const btn = ev.target.querySelector('button');
    btn.disabled = true;
    try {
      const loc = await lookupZip(zip);
      start(loc.lat, loc.lon, loc.name);
    } catch (err) {
      errEl.textContent = `Couldn't find ZIP code ${zip} — check it and try again.`;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
    }
  });

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

  window.addEventListener('resize', initStars);
  initStars();
  if (!reducedMotion) requestAnimationFrame(tickStars);

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
      start(saved.lat, saved.lon, saved.name || undefined);
    }
  }
})();
