# 🌙 Moonlight

Tonight's moon, from where you stand.

**Live app: [danielluzhu.github.io/moonlight](https://danielluzhu.github.io/moonlight/)**

Moonlight is a static web app that shows details about tonight's moon for your
location — no backend, no API keys, all astronomy computed in the browser.

## Features

- **The map** — the entire page: a photoreal night Earth in black and light
  (NASA Blue Marble imagery drained to monochrome), floating in a twinkling
  starfield, showing the portion of the world that can see the moon at this
  moment. City lights (NASA Black Marble) glow gold — but only in the cities
  that can see her right now; the rest of the world dims into the dark without
  ever disappearing. The moon herself — her real cratered face, sphere-mapped
  from a lunar surface photo and shaded to tonight's exact phase — marks the
  spot where she hangs directly overhead. Everything else floats above the
  chart as a glass HUD, with the numbers behind a "Moon details" toggle
- **Phase** — the correct illuminated shape, phase name, illumination
  percentage, and days into the lunar cycle
- **Moonrise & moonset** — the next upcoming times, with the compass direction
  where the moon crosses the horizon
- **Position now** — altitude above the horizon and which way to look
- **Distance & angular size** — how far the moon is right now
- **Next phases** — dates of the next full and new moon

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

## Imagery

Earth textures are NASA's [Blue Marble](https://visibleearth.nasa.gov/collection/1484/blue-marble)
and [Black Marble (Earth at Night)](https://earthobservatory.nasa.gov/features/NightLights)
imagery, loaded from the CDN-hosted copies in the
[three-globe](https://github.com/vasturiano/three-globe) package. If they can't
load, the map falls back to drawn coastlines.

## Running locally

Any static file server works:

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>.
