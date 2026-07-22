# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-file Home Assistant Lovelace custom card distributed via HACS. It renders an indoor air-quality dashboard with gradient SVG graphs and WHO/EPA-based recommendations.

There is no build step and no `node_modules`. The shipped artifact is `air-quality-card.js` itself.

## Commands

```bash
node test.js          # run the full unit test suite (only available command)
```

Tests pass/fail via a tiny inline `assert` helper; the script `process.exit(1)`s on any failure. There is no test runner, no linter, no formatter, no bundler. Don't add one unless asked.

To test in Home Assistant: copy `air-quality-card.js` to `/config/www/air-quality-card/` and reload the dashboard. Manual UI testing is the only way to verify rendering — the test suite covers thresholds and logic, not the DOM.

## Architecture

### Two custom elements in one file

`air-quality-card.js` registers two web components at the bottom:

1. **`air-quality-card`** — `class AirQualityCard extends HTMLElement` (vanilla, shadow DOM, no framework).
2. **`air-quality-card-editor`** — `class AirQualityCardEditor extends LitElement`. LitElement is *not imported*; it's grabbed at runtime by walking up the prototype of an HA built-in:

   ```js
   const LitElement = Object.getPrototypeOf(
     customElements.get("hui-masonry-view") || customElements.get("hui-view")
   );
   ```

   This is intentional — the card has no dependencies and must run as a single file dropped into `/config/www/`. Don't try to `import` lit; it would break the distribution model.

### Card lifecycle (`AirQualityCard`)

- `setConfig(config)` — validates that at least one sensor entity is configured, merges defaults, resets `_rendered` and `_historyLoaded` so the next `hass` setter rebuilds the card.
- `set hass(hass)` — runs `_initialRender()` + `_loadHistory()` exactly once, then `_updateStates()` on every state change.
- `_initialRender()` writes the entire `shadowRoot.innerHTML` (HTML + `<style>`) based on which entities are configured. Sections are conditionally included via `${showCO2 ? '...' : ''}` template literals.
- `_updateStates()` does **targeted DOM updates by `id`** — it does *not* re-render. When adding a new field, both `_initialRender` (to add the element) and `_updateStates` (to update it) need changes.
- `_renderGraphs()` calls `_renderGraph()` per sensor, building SVG paths into pre-existing `<svg>` elements.

### The recommendation waterfall

`_getRecommendation()` is a priority cascade — order matters and is load-bearing:

1. **CO life-safety first** (`> 100` → Danger, `> 35` → Warning), then **Propane** (`>= 0.42%` → Danger, `>= 0.21%` → Warning) and **low O2** (`< 16%` → Danger, `< 19.5%` → Warning). All three are life-safety checks and are *never* suppressed by the outdoor-air override.
2. CO2 / PM2.5 / PM10 / HCHO / NO2 / O3 / tVOC / humidity rules in priority order.
3. **Outdoor override**: if an outdoor PM2.5 or CO2 entity reads worse than indoor, ventilation recs are swapped for "Run Air Purifier" or "Keep Windows Closed". The `ventilationRecs` allowlist intentionally excludes CO/propane/O2 recommendations — don't add them to it.

`_getOverallStatus()` is a separate cascade for the header badge color (CO, propane, and low O2 take priority over radon, which takes priority over CO2/PM2.5).

`_getRadonAdvisory()` is its own banner, completely separate from the main recommendation. Radon changes over days/weeks and needs professional mitigation, not "open a window," so it has its own info/warning/danger tiers based on the EPA action level (4.0 pCi/L = 148 Bq/m³). It uses `max(short-term, long-term)` in Bq/m³.

### Units and conversions

- **Radon**: stored/compared internally in Bq/m³. `_getRadonBqm3(value)` converts based on `_isRadonPciL()` (1 pCi/L = 37 Bq/m³). User can force units via `radon_unit` config; otherwise auto-detect from the sensor's `unit_of_measurement`.
- **Temperature**: `_isCelsius()` checks `temperature_unit` config first, falls back to `hass.config.unit_system.temperature`. Color thresholds are duplicated for °C and °F branches.
- **tVOC**: `_isVOCIndex()` distinguishes Sensirion VOC Index (unitless 0–500) from absolute ppb. Auto-detect treats missing/empty `unit_of_measurement` or `"voc index"` as VOC Index. Different threshold tables apply to each.
- **NOx**: `_isNOxIndex()` mirrors the tVOC split — Sensirion NOx Index (unitless, clean-air baseline ~1, unlike the VOC Index's 100) vs absolute ppb. Same auto-detect rule (missing/empty `unit_of_measurement` or `"nox index"` → index), forceable via `nox_unit` config. METRIC_DEFS has `nox_ppb`/`nox_index` — there is no plain `nox` key, so always go through `_noxMetric()`; both tables share the single `nox_thresholds` override.
- **O2**: no fixed-unit-detection split like tVOC/NOx — always %vol. Thresholds are a bell around the 20.9% ambient baseline (like humidity), but colored as a *safety* bell (red tails, not amber) since there's no WHO/EPA ambient-O2 guideline to anchor to — defaults borrow OSHA's confined-space O2 safety bands instead. Below 16% is life-safety (see recommendation waterfall above). **Correctness trap**: O2's "unconfigured" fallback must be `null`, not `0` — 0% O2 is the worst possible reading, so the usual `this._config.x_entity ? this._getNumericState(...) : 0` pattern would make an unconfigured sensor look like a life-threatening emergency. `_getOverallStatus`/`_getRecommendationKey` both guard with `o2 !== null &&`.
- **Propane (C3H8)**: %vol (not ppb/µg/m³ like the other gases, and not pre-scaled to %LEL). It's a combustible-gas leak hazard, not a WHO chronic-exposure pollutant, so it's treated as life-safety like CO rather than folded into the ventilation waterfall — thresholds anchor to 10%/20%/50% of propane's 2.1%vol LEL. `_renderGraph`'s optional min/max marker is passed the unit token `'%vol'` (not `'%'`) so `_formatGraphValue` doesn't round sub-1% readings down to display "0" — see that function's unit-based rounding table if you add another sub-1-precision metric.
- **NO2/O3**: plain µg/m³ gases (WHO 2021 AQG + EU Ambient Air Quality Directive anchors), no unit-detection split. If a sensor reports ppb, override `no2_thresholds`/`o3_thresholds` (1 ppb NO2 ≈ 1.88 µg/m³, 1 ppb O3 ≈ 2.00 µg/m³) rather than adding auto-detection — not worth the complexity for two metrics.

### Adding a new sensor

A new sensor type touches **many places**. Use this checklist:

1. `constructor` — add key to `this._history = { ... }`.
2. `setConfig` — add to `hasEntity` validation OR-chain.
3. `getCardSize` — add `+= 1`.
4. `_loadHistory` — push promise + key.
5. `_getXColor()` helper.
6. `_initialRender` — add `showX` flag and the conditional HTML block (status row + graph card).
7. `_updateStates` — read state, update DOM by id.
8. `_renderGraphs` — call `_renderGraph` with min/max/unit.
9. `_getRecommendation` and/or `_getOverallStatus` if it should drive recs.
10. Editor `_schema()` and `_computeLabel()`.
11. `test.js` — the `expectedKeys` list and color/recommendation tests.

The "outdoor mirror" pattern: most pollutants have an `outdoor_<x>_entity` counterpart that's plumbed through the same machinery (history key `outdoor_<x>`, dashed line in `_renderGraph`, optional input to outdoor-override logic).

## Versioning and distribution

- `CARD_VERSION` is a const at the top of `air-quality-card.js` (line 9). Bump it when shipping changes — it's logged to the browser console on load and is the canonical version for HACS.
- `hacs.json` declares the filename and min HA version (`2024.1.0`). Don't rename `air-quality-card.js` without updating `hacs.json`.
- `.github/workflows/validate.yml` runs HACS validation on every push/PR — there's no CI for `node test.js`, so run it locally before committing.

## Test harness notes

`test.js` mocks `HTMLElement`, `customElements`, `window`, and `document` *before* `require('./air-quality-card.js')` so the file can register itself in a Node environment. It then pulls the registered class out of `registeredElements` and instantiates it with a fake `_hass`. The editor (`air-quality-card-editor`) only registers when `customElements.get("hui-masonry-view")` returns a class — the mock provides `MockHuiView` for that. If you change the LitElement-grabbing code, update the mock accordingly.
