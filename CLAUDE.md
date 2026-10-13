# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-file Home Assistant Lovelace custom card distributed via HACS. It renders an indoor air-quality dashboard with gradient SVG graphs and WHO/EPA-based recommendations.

There is no build step and no `node_modules`. The shipped artifact is `air-quality-card.js` itself.

## Commands

```bash
node test.js          # run the full unit test suite (only available command)
```

Tests pass/fail via a tiny inline `assert` helper; the script `process.exit(1)`s on any failure. There is no test runner, no linter, no formatter, no bundler. Don't add one unless asked. You can't run a single test on its own. The whole suite runs in well under a second, so run all of it and use `node test.js 2>&1 | grep FAIL` to see only the failures. Tests are grouped by `section('...')` headers, so you can grep the output for a section name.

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

### Data tables at the top of the file

- **`METRIC_DEFS`** — one entry per metric key: 4 ascending `defaultThresholds` → 5 tiers, a 5-color scale (`SCALE_*`), and 5 `labelKeys`. Colors and per-metric status badges all go through `_tieredValue` via `_getMetricColor(metric, v)` / `_getMetricStatus(metric, v)`. `_metricThresholds(metric)` maps each key to its `<x>_thresholds` config override (only valid if it's exactly 4 numbers). The per-metric `_getXColor`/`_getXStatus` methods are thin wrappers kept for backward compatibility. Keys that split by mode (`tvoc_ppb`/`tvoc_index`, `nox_ppb`/`nox_index`, `temp_c`/`temp_f`) are chosen at call time through `_tvocMetric()`/`_noxMetric()`/`_tempMetric()`.
- **`TRANSLATIONS`** — `en`, `es`, `fr`, `de`, `pt`, `hu`, `pl`. Each has these groups: `status`, `recommendation`, `subtitle`, `radon`, `metric`, `editor`. `_t(group, key)` falls back to English, then to the raw key, so a missing translation shows English instead of breaking. Every `labelKeys` value must exist in each locale's `status` group. Subtitles use `{placeholder}` interpolation via `_ts()`. The editor has its own `_t`/`_resolveLanguage` copy, plus a `localFallbacks` map in `_computeLabel` for fields that have no `editor` translation yet.

### Card lifecycle (`AirQualityCard`)

- `setConfig(config)` — validates that at least one entity in `indoorEntityKeys`/`outdoorEntityKeys` is set, merges defaults, resets `_rendered` and `_historyLoaded` so the next `hass` setter rebuilds the card. **Outdoor-only mode**: if only `outdoor_*` entities are set, `promotionMap` moves each into its indoor slot and sets `_outdoorOnly`, which makes `_getRecommendationKey()` return `null` (no recommendations).
- `set hass(hass)` — runs `_initialRender()` + `_loadHistory()` exactly once (history is skipped in compact mode), then `_maybeAutoExpand()` + `_updateStates()` on every state change.
- **Display modes** (`display: full | compact | expandable`): `_initialRender()` hands off to `_renderCompact()` when `_isCompact()` is true. The compact view's alert chips and `auto_expand` both come from `_getAbnormalMetrics()`, which ranks out-of-range metrics by color severity plus `PRIORITY_BOOST` so life-safety metrics are never truncated away.
- `_initialRender()` writes the entire `shadowRoot.innerHTML` (HTML + `<style>`) based on which entities are configured. Sections are conditionally included via `${showCO2 ? '...' : ''}` template literals. DOM ids follow `<metric>-graph-container`, `<metric>-value`, `<metric>-svg`, etc. `_applyMetricOrder()` reorders cards with flexbox `order` according to `_getMetricOrder()`.
- `_updateStates()` does **targeted DOM updates by `id`** — it does *not* re-render. When adding a new field, both `_initialRender` (to add the element) and `_updateStates` (to update it) need changes.
- `_renderGraphs()` calls `_renderGraph()` per sensor, building SVG paths into pre-existing `<svg>` elements.

### The recommendation waterfall

`_getRecommendationKey()` is a priority cascade that returns a translation key. `_getRecommendation()` only translates that key, and `_getRecommendationIcon()` plus the subtitle logic in `_updateStates()` look up by the same key. Order matters and is load-bearing:

1. **CO life-safety first** (`> 100` → Danger, `> 35` → Warning), then **Propane** (`>= 0.42%` → Danger, `>= 0.21%` → Warning) and **low O2** (`< 16%` → Danger, `< 19.5%` → Warning). All three are life-safety checks and are *never* suppressed by the outdoor-air override.
2. CO2 / PM2.5 / PM10 / HCHO / NO2 / O3 / tVOC / humidity / noise rules in priority order.
3. **Outdoor override**: if an outdoor PM2.5 or CO2 entity reads worse than indoor, ventilation recs are swapped for "Run Air Purifier" or "Keep Windows Closed". If there's no indoor counterpart, "worse" means the outdoor value is at or above the metric's elevated tier (`thresholds[2]`). Don't compare against an implicit 0 (#35). The `ventilationKeys` allowlist intentionally excludes CO/propane/O2 recommendations — don't add them to it.

A new recommendation key needs entries in `TRANSLATIONS.*.recommendation`, `*.subtitle` (usually plus a `_unknown` variant), the icon map, and the subtitle branch in `_updateStates()`.

`_getOverallStatus()` is a separate cascade for the header badge color (CO, propane, and low O2 take priority over radon, which takes priority over CO2/PM2.5). **Exception:** if `air_quality_entity` is set, it short-circuits the whole cascade, including CO. The badge then shows that entity's state, or tiers a numeric index through `air_quality_thresholds`.

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

1. `METRIC_DEFS` entry (thresholds/colors/labelKeys, with a comment citing the guideline the tiers come from) + `_metricThresholds` override map + a thin `_getXColor()` wrapper.
2. `TRANSLATIONS` — any new `status` labelKeys, plus `editor.<x>_entity`, in **every** locale (and `metric.<x>` if the label isn't a chemical formula).
3. `constructor` — add key to `this._history = { ... }`.
4. `setConfig` — add to `indoorEntityKeys` (and `outdoorEntityKeys`/`promotionMap` if it has an outdoor mirror).
5. `getCardSize` — add `+= 1`.
6. `_loadHistory` — push promise + key (outdoor mirrors go in the `outdoorSensors` list).
7. `_getMetricOrder` `all` list, and `_getAbnormalMetrics` `labels` (plus `PRIORITY_BOOST` if it's life-safety).
8. `_initialRender` — add `showX` flag and the conditional HTML block (status row + graph card).
9. `_updateStates` — read state, update DOM by id.
10. `_renderGraphs` — call `_renderGraph` with min/max/unit. `_setupGraphInteractions` — add to `graphIds`.
11. `_getRecommendationKey` and/or `_getOverallStatus` if it should drive recs.
12. Editor `_schema()` — the entity picker, and the `order` selector options.
13. `README.md` — feature list and the Configuration Options table (`<x>_entity`, `<x>_thresholds`).
14. `test.js` — the `expectedKeys` list and color/recommendation tests.

The "outdoor mirror" pattern: most pollutants have an `outdoor_<x>_entity` counterpart that's plumbed through the same machinery (history key `outdoor_<x>`, dashed line in `_renderGraph`, optional input to outdoor-override logic).

Unavailable sensors: `_getNumericState` returns 0 for non-numeric states. That's fine for most pollutants but wrong for bell-curve metrics (humidity, O2, pressure, temperature). Note how `_getAbnormalMetrics` uses `parseFloat` + `isFinite` instead, and how humidity defaults to 45 in the waterfall.

## Versioning and distribution

- `CARD_VERSION` is a const at the top of `air-quality-card.js` (line 9). Bump it when shipping changes — it's logged to the browser console on load and is the canonical version for HACS. The header doc comment (line 2) repeats the version, so bump both.
- Release flow: work lands on a `feat/vX.Y.Z` branch (contributor PRs get merged into it, with credit to the `@author` in the merge message). That branch is merged into `main` as "Merge feat/vX.Y.Z → main for vX.Y.Z", then tagged `vX.Y.Z` and released with `gh release create`. Pre-releases use `-rcN` tags. Push or release only when Kaden asks.
- When a change adds a config option or sensor, update the README's Configuration Options table too. HACS renders the README (`render_readme: true`), so it's the user-facing docs.
- `hacs.json` declares the filename and min HA version (`2024.1.0`). Don't rename `air-quality-card.js` without updating `hacs.json`.
- `.github/workflows/validate.yml` runs HACS validation on every push/PR — there's no CI for `node test.js`, so run it locally before committing.

## Test harness notes

`test.js` mocks `HTMLElement`, `customElements`, `window`, and `document` *before* `require('./air-quality-card.js')` so the file can register itself in a Node environment. It then pulls the registered class out of `registeredElements` and instantiates it with a fake `_hass`. The editor (`air-quality-card-editor`) only registers when `customElements.get("hui-masonry-view")` returns a class — the mock provides `MockHuiView` for that. If you change the LitElement-grabbing code, update the mock accordingly.
