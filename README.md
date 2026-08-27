# 🌙 Moonlight

Tonight's moon, from where you stand.

**Live app: [danielluzhu.github.io/moonlight](https://danielluzhu.github.io/moonlight/)**

Moonlight is a static web app that shows details about tonight's moon for your
location — no backend, no API keys, all astronomy computed in the browser.

## Features

- **Phase** — a rendered moon disc with the correct illuminated shape, phase
  name, illumination percentage, and days into the lunar cycle
- **Moonrise & moonset** — the next upcoming times, with the compass direction
  where the moon crosses the horizon
- **Position now** — altitude above the horizon and which way to look
- **Distance & angular size** — how far the moon is right now
- **Next phases** — dates of the next full and new moon
- **Global visibility map** — a world map showing the portion of Earth that can
  see the moon at this moment, with the sub-lunar point marked

## Location

Pick whichever is easiest:

- **Use my location** — browser geolocation
- **ZIP code** — a 5-digit US ZIP code (resolved via the free Zippopotam.us API)
- **Manual coordinates** — enter latitude and longitude directly
- **URL parameters** — `?lat=37.77&lon=-122.42`

Your choice is remembered in `localStorage` so the app only asks once.

## How it works

All lunar math lives in [`astro.js`](astro.js): simplified formulae from Jean
Meeus' *Astronomical Algorithms* (in the style of the SunCalc library) compute
the moon's ecliptic coordinates, illumination, altitude/azimuth, rise and set
times, and the sub-lunar point. The UI ([`app.js`](app.js)) renders the phase
disc and visibility map on `<canvas>`.

## Running locally

Any static file server works:

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>.
