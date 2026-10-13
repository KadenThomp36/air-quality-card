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

### One custom element, native HA APIs only

`air-quality-card.js` registers a single web component, **`air-quality-card`** (`class AirQualityCard extends HTMLElement` — vanilla, shadow DOM, no framework, no imports). Everything else comes from Home Assistant itself; prefer an HA-provided mechanism over reimplementing one:

- **Editor**: `static getConfigForm()` returns an `ha-form` schema (`configForm()` at the bottom of the file) and HA renders it. There is no editor element and no Lit — don't reintroduce `getConfigElement` (it takes precedence over the form) or the old `Object.getPrototypeOf(customElements.get('hui-masonry-view'))` trick. `computeLabel` only receives HA's `localize`, so labels come from `TRANSLATIONS[editorLanguage]`, a module variable every card instance updates in its `hass` setter. Fields HA already localizes (`NATIVE_EDITOR_LABELS`: name, hours_to_show, tap/hold/double_tap_action, interactions) return `undefined` so HA's own label is used.
- **History**: one `history/stream` websocket subscription (`hass.connection.subscribeMessage`) for every graphed entity, the same way HA's history-graph card does it. Rows arrive as `{s, lu}` (epoch seconds) into `_historyRaw[entity_id]`; `_buildHistory()` trims to the sliding window, converts units and carries the current state to "now". The subscription follows `connectedCallback`/`disconnectedCallback` (HA detaches hidden cards and rebuilds preview cards), resubscribes on the connection's `ready` event, and a 60 s timer slides the window. A token guards against a stale subscription writing into a re-configured card.
- **Actions**: `hass-action` events (tap/hold/double_tap, recommendation button) and `hass-more-info` (graph tap). `_bindActions()` implements HA's gesture timings (500 ms hold, 250 ms double-tap window, Enter/Space = tap) because HA's action-handler directive is internal.
- **Sizing / picker**: `getGridOptions()` for sections view, `getStubConfig(hass)` and `window.customCards[].getEntitySuggestion` build a config from a real device's sensors via `configForDevice()` + `DEVICE_CLASS_METRIC`.
- **Formatting**: `_formatNumber()` follows `hass.locale.number_format` like HA's `formatNumber`; times follow `locale.time_format` (`_timeHourCycle`) and `locale.time_zone` (`_timeZone`); an entity's `display_precision` (from `hass.entities`) beats the card's default decimals.
- **Theming**: `<ha-card>` provides background/border/radius; use HA CSS variables (`--primary-text-color`, `--secondary-background-color`, `--primary-color` …) with fallbacks. The tier palette colors are data, not theme.

### Data tables at the top of the file

- **`METRIC_DEFS`** — one entry per metric key: 4 ascending `defaultThresholds` → 5 tiers, a 5-color scale (`SCALE_*`), and 5 `labelKeys`, each with a comment citing its source. Colors and status labels go through `_getMetricColor(defKey, v)` / `_getMetricStatus(defKey, v)`. `_metricThresholds(defKey)` = `_thresholdOverride(defKey)` (the user's `<x>_thresholds` if it's exactly 4 numbers) or the default. Keys that split by mode (`tvoc_ppb`/`tvoc_index`, `nox_ppb`/`nox_index`, `temp_c`/`temp_f`) are picked by `_defKey(metric)`.
- **`UNIT_CONVERSIONS`** — CO/HCHO/NO₂/O₃ readings in other units (µg/m³, mg/m³, ppb, ppm) are converted into the threshold unit by `_unitFactor()`. **Unless the user overrode that metric's thresholds** — then the override is taken to be in the sensor's own unit and nothing is converted (issue #59's workaround config depends on this). `normalizeUnit()` canonicalizes spellings to HA's (`μg/m³` with Greek mu, as in `homeassistant/const.py`).
- **`TRANSLATIONS`** — `en`, `es`, `fr`, `de`, `pt`, `hu`, `pl`, each with groups `status`, `recommendation`, `subtitle`, `radon`, `metric`, `editor`, `label`. Every locale must have every key (a quick diff script against `en` is the easiest check). `_t` falls back to English, then the raw key. Subtitles interpolate `{value}` with the number **and its unit** (`_formatWithUnit`) — never hardcode a unit in a subtitle string. Other tables: `GRAPH_ORDER`/`GRAPH_LABELS` (graph cards), `REC_SEVERITY` (banner styling per recommendation), `OVERALL_SEVERITY` (tier color → header severity).

### Reading values

- `_getNumericState(id)` returns **`null`** for missing/unavailable/non-numeric states — never 0. A dead sensor must not read as clean air, "Too Dry", or (for O₂) a lethal 0%. Every consumer handles `null`; keep it that way.
- `_metricValue(metric, entityKey?)` = numeric state × unit factor; use it (not raw states) anywhere a reading is compared against thresholds. Outdoor mirrors: `_metricValue('pm25', 'outdoor_pm25_entity')`.
- `_metricReading(metric)` bundles value + tier color + status for one display metric (radon = max of short/long-term in Bq/m³); `_getAbnormalMetrics()` and the header fold use it.

### Card lifecycle

- `setConfig(config)` — validates that at least one entity in `indoorEntityKeys`/`outdoorEntityKeys` is set, merges defaults (raw config kept in `_rawConfig` for "did the user set this?" checks), drops the history subscription, resets `_rendered`/`_historyLoaded`. **Outdoor-only mode**: if only `outdoor_*` entities are set, `promotionMap` moves each into its indoor slot and sets `_outdoorOnly` (no recommendations).
- `set hass(hass)` — first call renders and subscribes to history (not in compact mode). After that it **returns early unless a watched entity's state object changed** (`_watchedEntityChanged`) — HA pushes a new hass for every state change in the whole system. A locale change re-renders.
- **Display modes** (`display: full | compact | expandable`): `_initialRender()` hands off to `_renderCompact()` when `_isCompact()`. Alert chips and `auto_expand` come from `_getAbnormalMetrics()` (severity + `PRIORITY_BOOST` so life-safety metrics are never truncated away).
- `_initialRender()` writes the whole `shadowRoot.innerHTML`; graph cards are generated by `_graphBlockHtml(metric)` for each configured metric in `GRAPH_ORDER` (ids `<metric>-graph-container`, `-value`, `-svg`, `-tooltip`, …), reflowed by `_applyMetricOrder()`, and wired once by `_setupGraphInteractions()`. Anything interpolated into markup that isn't a literal goes through `escapeHtml()` (units and names can come from integrations).
- `_updateStates()` does targeted DOM updates by id, table-driven: `_updateRecommendation(key)` and `_updateMetricValue(metric)` per metric (`_metricUnit`, `_metricDecimals`, `_outdoorSuffix`).
- `_renderGraphs()` rebuilds the series and calls `_renderGraph()` per metric with `_graphRange(metric)` — the default fixed range, or one derived from the user's threshold override (so inHg pressure or µg/m³ CO still graph sensibly). Gradients use `gradientUnits="userSpaceOnUse"`; with bounding-box units a perfectly flat line is not painted at all.

### The recommendation waterfall

`_getRecommendationKey()` returns a translation key; `_getRecommendation()` translates it and `_updateRecommendation()` builds the subtitle and styling. **Every cutoff is a tier boundary of `_metricThresholds()`** (`above(value, metric, tier)`), so badges, header and recommendation always agree and user overrides apply everywhere (#59). Order is load-bearing:

1. **Life-safety**: CO (`> t[3]` danger, `> t[2]` warning), propane (`>= t[2]`/`>= t[1]`), low O₂ (`< t[0]`/`< t[1]`), then elevated CO (`> t[1]`) — ahead of particulates, because a purifier does nothing for CO. None of these are ever touched by the outdoor override.
2. CO₂ / PM2.5 / PM10 / HCHO / NO₂ / O₃ / tVOC (`t[2]` of whichever tVOC table applies) / humidity / noise.
3. **Outdoor override** (`_outdoorComparison()`): if outdoor PM2.5 or CO₂ is worse, ventilation keys become "Run Air Purifier"/"Keep Windows Closed". With no usable indoor reading (unconfigured *or unavailable*), "worse" means the outdoor value reached `thresholds[2]` (#35). The `ventilationKeys` allowlist must never contain CO/propane/O₂ keys.

A new recommendation key needs `TRANSLATIONS.*.recommendation`, `*.subtitle` (plus a `_unknown` variant), an icon in `_getRecommendationIcon`, a `REC_SEVERITY` entry, and a case in `_updateRecommendation`.

`_getOverallStatus()` (header badge): life-safety first — **above** `air_quality_entity`, which otherwise short-circuits (or tiers a numeric index via `air_quality_thresholds`). Then radon (poor at `t[3]`, fair at `t[2]`), then the worst tier of every configured air-quality metric. With no air-quality reading at all it shows the worst comfort metric's own status (temperature/humidity/noise, #51), and "Unavailable" if nothing reads.

`_getRadonAdvisory()` is its own banner (info/warning/danger at radon `t[1]`/`t[2]`/`t[3]`), separate from the recommendation — radon needs professional mitigation, not "open a window".

### Units and conversions

- **Radon**: compared in Bq/m³; `_getRadonBqm3()` converts pCi/L (×37). Auto-detect reads `radon_entity || radon_longterm_entity` (a long-term-only setup must not be mistaken for Bq/m³). `radon_unit` accepts `Bq/m³`/`Bq/m3`/`pCi/L`.
- **Temperature**: `_isCelsius()` = `temperature_unit` config, else the entity's own unit, else `hass.config.unit_system`.
- **tVOC / NOx**: Sensirion index (no unit) vs absolute. Missing/empty `unit_of_measurement` (or "voc index"/"nox index") → index; forceable via `tvoc_unit`/`nox_unit`. Absolute mode displays the sensor's real unit; the default ppb thresholds don't convert mass units (no single factor for a VOC mixture), so µg/m³ users override thresholds. There's no plain `nox`/`tvoc` METRIC_DEFS key — go through `_defKey()`.
- **O₂**: %vol bell around 20.9%, safety-colored. Below `t[0]` (16%) is life-safety.
- **Propane (C3H8)**: %vol (not %LEL), life-safety like CO; readout uses 2 decimals so sub-1% readings never show as 0.
- **CO/HCHO/NO₂/O₃**: auto-converted via `UNIT_CONVERSIONS` (see above).

### Adding a new sensor

1. `METRIC_DEFS` entry (with a source citation) + `_thresholdOverride` map + a thin `_getXColor()` wrapper; `UNIT_CONVERSIONS` if HA allows several units for its device class; `DEVICE_CLASS_METRIC` if it has one.
2. `TRANSLATIONS` — new `status` labelKeys and `editor.<x>_entity` in **every** locale (`metric.<x>` if the label isn't a chemical formula).
3. `constructor` `_history` keys (`<x>` and `outdoor_<x>` if mirrored) — the history subscription derives its entities from these.
4. `setConfig` `indoorEntityKeys` (and `outdoorEntityKeys`/`promotionMap`).
5. `getCardSize` `+= 1`.
6. `GRAPH_ORDER`, `_getMetricOrder` `all`, `_metricLabel`/`GRAPH_LABELS`, `_metricUnit`, `_metricDecimals`, `_graphRange` defaults; `PRIORITY_BOOST` if life-safety.
7. `_getRecommendationKey` / `_getOverallStatus` (`AIR` list) if it should drive them.
8. `configForm()` — the entity picker and the `order` options.
9. `README.md` — features, Configuration Options table, Health Thresholds (with sources).
10. `test.js` — `expectedKeys` and color/recommendation tests.

## Previewing in a real browser

The suite can't see the DOM. For visual checks, render the card in headless Chromium with a mock `hass` (states, `locale`, `connection.subscribeMessage` answering `history/stream`) and stub `ha-card`/`ha-icon` elements — keep such harnesses outside the repo (e.g. `/tmp`). Playwright's Chromium is usually cached under `~/.cache/ms-playwright`.

## Versioning and distribution

- `CARD_VERSION` is a const at the top of `air-quality-card.js` (line 9). Bump it when shipping changes — it's logged to the browser console on load and is the canonical version for HACS. The header doc comment (line 2) repeats the version, so bump both.
- Release flow: work lands on a `feat/vX.Y.Z` branch (contributor PRs get merged into it, with credit to the `@author` in the merge message). That branch is merged into `main` as "Merge feat/vX.Y.Z → main for vX.Y.Z", then tagged `vX.Y.Z` and released with `gh release create`. Pre-releases use `-rcN` tags. Push or release only when Kaden asks.
- When a change adds a config option or sensor, update the README's Configuration Options table too. HACS renders the README (`render_readme: true`), so it's the user-facing docs.
- `hacs.json` declares the filename and min HA version (`2024.1.0`). Don't rename `air-quality-card.js` without updating `hacs.json`.
- `.github/workflows/validate.yml` runs HACS validation on every push/PR — there's no CI for `node test.js`, so run it locally before committing.

## Test harness notes

`test.js` mocks `HTMLElement`, `customElements`, `window`, and `document` *before* `require('./air-quality-card.js')` so the file can register itself in Node, then instantiates the registered class with a fake `_hass`. `mockConnection(subs)` fakes `hass.connection` for the history subscription (tests push stream messages through `subs[i].callback`); `makeCard(config, states)` builds a card with given entity states. `_loadHistory()` starts a 60 s interval — call `_unsubscribeHistory()` at the end of a test that subscribes. The editor is tested through `CardClass.getConfigForm()`.
