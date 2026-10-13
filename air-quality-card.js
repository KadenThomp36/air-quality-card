/**
 * Air Quality Card v2.13.0
 * A custom Home Assistant card for air quality visualization
 * Default thresholds anchor to WHO 2021 Air Quality Guidelines, US EPA/OSHA
 * limits and EU air-quality directives where such guidance exists; the
 * citations next to each metric in METRIC_DEFS say which.
 *
 * https://github.com/KadenThomp36/air-quality-card
 */

const CARD_VERSION = '2.13.0';

// Shared color palettes for the 5-tier color scale used across metrics.
const SCALE_AIRQUALITY = ['#4caf50', '#8bc34a', '#ffc107', '#ff9800', '#f44336']; // green → red
const SCALE_TEMPERATURE = ['#2196f3', '#03a9f4', '#4caf50', '#ff9800', '#f44336']; // blue → red
const SCALE_HUMIDITY = ['#ff9800', '#8bc34a', '#4caf50', '#8bc34a', '#ff9800'];   // bell
// O2 is a safety bell (like humidity) but with red tails, not amber — both
// oxygen-deficient and oxygen-enriched atmospheres are genuine hazards, not
// just discomfort.
const SCALE_O2 = ['#f44336', '#ff9800', '#4caf50', '#ff9800', '#f44336'];

// Per-metric thresholds, color scale, and status labels. Users may override
// the thresholds via config (e.g. `co2_thresholds: [500, 700, 900, 1200]`).
//
// Each `defaultThresholds` array has exactly 4 ascending values defining 5
// tiers. The corresponding `colors`/`labelKeys` arrays have exactly 5 entries.
// `labelKeys` are translation keys in TRANSLATIONS[<lang>].status — never raw
// display strings — so the per-metric badge ("Poor", "Elevated", …) localizes
// alongside the header status. Adding a new key here requires adding it to the
// `status` group of every locale in TRANSLATIONS below.
const METRIC_DEFS = {
  // CO (ppm): 9/35 are the US EPA 8-hour/1-hour NAAQS; 4 sits just above the
  // WHO 2021 24-hour guideline (4 mg/m³ ≈ 3.5 ppm); 100 is close to the WHO
  // 2010 indoor 15-minute guideline (100 mg/m³ ≈ 87 ppm).
  co:         { defaultThresholds: [4, 9, 35, 100],          colors: SCALE_AIRQUALITY, labelKeys: ['safe', 'low', 'moderate', 'high', 'dangerous'] },
  // CO2 (ppm) is a ventilation proxy, not a health limit — ASHRAE 62.1 sets
  // no CO2 limit and ASHRAE's 2025 position document says CO2 alone is not a
  // reliable overall IAQ indicator. These are common ventilation-proxy bands.
  co2:        { defaultThresholds: [600, 800, 1000, 1500],   colors: SCALE_AIRQUALITY, labelKeys: ['excellent', 'good', 'moderate', 'elevated', 'poor'] },
  // PM2.5/PM10 (µg/m³): WHO 2021 AQG annual/24-hour guidelines (5/15, 15/45)
  // and interim targets (PM2.5 IT-4 25; PM10 IT-3 75, IT-1 150); 35 is the
  // US EPA 24-hour PM2.5 NAAQS. PM1 has no guideline — it borrows the PM2.5
  // bands (lenient, since PM1 ⊂ PM2.5). PM4 likewise has none; 25/37.5/50 are
  // WHO's PM2.5 24-hour interim targets IT-4/3/2. PM0.3 counts are judgement.
  pm25:       { defaultThresholds: [5, 15, 25, 35],          colors: SCALE_AIRQUALITY, labelKeys: ['excellent', 'good', 'moderate', 'elevated', 'poor'] },
  pm10:       { defaultThresholds: [15, 45, 75, 150],        colors: SCALE_AIRQUALITY, labelKeys: ['excellent', 'good', 'moderate', 'elevated', 'poor'] },
  pm1:        { defaultThresholds: [5, 15, 25, 35],          colors: SCALE_AIRQUALITY, labelKeys: ['excellent', 'good', 'moderate', 'elevated', 'poor'] },
  pm03:       { defaultThresholds: [500, 1000, 3000, 5000],  colors: SCALE_AIRQUALITY, labelKeys: ['clean', 'good', 'moderate', 'elevated', 'poor'] },
  pm4:        { defaultThresholds: [10, 25, 37.5, 50],       colors: SCALE_AIRQUALITY, labelKeys: ['excellent', 'good', 'moderate', 'elevated', 'poor'] },
  // HCHO (ppb): 100 matches Health Canada's 1-hour limit (123 µg/m³); WHO's
  // 2010 30-minute guideline (0.1 mg/m³) is ≈81 ppb; 40–50 is around Health
  // Canada's 8-hour limit (50 µg/m³ ≈ 40 ppb).
  hcho:       { defaultThresholds: [20, 50, 100, 200],       colors: SCALE_AIRQUALITY, labelKeys: ['excellent', 'good', 'moderate', 'elevated', 'poor'] },
  // NO2/O3 are compared in µg/m³; ppb/ppm readings are converted (see
  // UNIT_CONVERSIONS). NO2 anchors to WHO 2021 AQG annual/24h guidelines
  // (10/25) plus the EU directive 2008/50 annual/hourly limits (40/200) —
  // the 2024/2881 recast lowers the annual limit to 20 from 2030. O3 anchors
  // to WHO 2021's peak-season/8h guidelines (60/100) plus the EU
  // information/alert thresholds (180/240).
  no2:        { defaultThresholds: [10, 25, 40, 200],        colors: SCALE_AIRQUALITY, labelKeys: ['excellent', 'good', 'moderate', 'elevated', 'poor'] },
  o3:         { defaultThresholds: [60, 100, 180, 240],       colors: SCALE_AIRQUALITY, labelKeys: ['excellent', 'good', 'moderate', 'elevated', 'poor'] },
  // Propane (%vol) is a combustible-gas leak hazard, not a chronic-exposure
  // pollutant — treated as life-safety (see _getOverallStatus/
  // _getRecommendationKey), same as CO. Bands are fractions of propane's
  // 2.1%vol LEL (lower explosive limit): 10% LEL (0.21) is OSHA 1910.146's
  // hazardous-atmosphere point and NIOSH's IDLH (2,100 ppm); 20%/50% LEL are
  // common industrial-detector high alarms (UL 1484 residential gas alarms
  // trip at ≤25% LEL). 0.05 is judgement.
  c3h8:       { defaultThresholds: [0.05, 0.21, 0.42, 1.05],  colors: SCALE_AIRQUALITY, labelKeys: ['safe', 'low', 'moderate', 'high', 'dangerous'] },
  // O2 (%vol) is a bell around the 20.9% ambient baseline, but safety-based
  // rather than comfort-based — there's no WHO/EPA ambient-O2 guideline, so
  // this borrows OSHA 1910.146's confined-space bands: below 19.5% is
  // oxygen-deficient, above 23.5% oxygen-enriched (fire risk). 16% is where
  // impaired thinking/coordination sets in (OSHA interpretation letters, CGA
  // symptom tables); 25% is judgement. Below 16% is treated as life-safety
  // (see _getOverallStatus/_getRecommendationKey).
  o2:         { defaultThresholds: [16, 19.5, 23.5, 25],      colors: SCALE_O2,         labelKeys: ['dangerous', 'low', 'normal', 'enriched', 'dangerous'] },
  // NOx, like tVOC, comes in two flavors: absolute ppb, or the Sensirion
  // SGP41 NOx Index (unitless, 1-500, baseline 1 in clean air — unlike the
  // VOC Index which centers at 100, so the tables must differ). AirGradient
  // devices report the index. ppb tiers anchor to NO₂ standards: ~WHO 2021
  // interim target 1 (20), EPA annual NAAQS (53), EPA 1-hour NAAQS (100),
  // and the EPA AQI USG/Unhealthy breakpoint (360). Index tiers: 20 is
  // Sensirion's example air-purifier trigger (NOx Index info note), 5 splits
  // Excellent from Good at the SGP41's ±5pt repeatability spec, and 150/300
  // are judgement for "clearly elevated"/"high".
  nox_ppb:    { defaultThresholds: [20, 53, 100, 360],       colors: SCALE_AIRQUALITY, labelKeys: ['excellent', 'good', 'moderate', 'elevated', 'poor'] },
  nox_index:  { defaultThresholds: [5, 20, 150, 300],        colors: SCALE_AIRQUALITY, labelKeys: ['excellent', 'good', 'moderate', 'elevated', 'poor'] },
  // Radon (Bq/m³): 48 ≈ the EPA US indoor average (1.3 pCi/L), 100 the WHO
  // reference level, 148 the EPA action level (4 pCi/L), 300 WHO's upper
  // reference level.
  radon:      { defaultThresholds: [48, 100, 148, 300],      colors: SCALE_AIRQUALITY, labelKeys: ['excellent', 'good', 'elevated', 'high', 'dangerous'] },
  // Humidity (%): EPA mold guidance — below 60%, ideally 30–50%.
  humidity:   { defaultThresholds: [30, 40, 50, 60],         colors: SCALE_HUMIDITY,   labelKeys: ['too_dry', 'dry', 'comfortable', 'humid', 'too_humid'] },
  // Atmospheric pressure is informational (not a health hazard), so it uses a
  // bell palette with a wide green band — typical weather stays calm/green.
  // Thresholds assume hPa/mbar (what Airthings and most HA sensors report);
  // override with `pressure_thresholds` for inHg/mmHg or a different band.
  pressure:   { defaultThresholds: [990, 1005, 1025, 1040], colors: SCALE_HUMIDITY,   labelKeys: ['low', 'slightly_low', 'normal', 'slightly_high', 'high'] },
  // Noise (dBA, #50) is a comfort/health metric, not an air pollutant, but it
  // rounds out the home-environment picture. Tiers anchor to WHO's 1999
  // Guidelines for Community Noise: 35 dB is the indoor living-area guideline,
  // 55 dB the *outdoor* serious-annoyance level, 70 dB (24 h average) the
  // hearing-impairment level; 45 dB is judgement. WHO's values are long-term
  // averages, so a single loud reading is a nudge, not a diagnosis.
  noise:      { defaultThresholds: [35, 45, 55, 70],        colors: SCALE_AIRQUALITY, labelKeys: ['quiet', 'moderate', 'elevated', 'loud', 'very_loud'] },
  // tVOC and temperature defaults depend on mode/unit and are computed at call time.
  tvoc_ppb:   { defaultThresholds: [100, 300, 500, 1000],    colors: SCALE_AIRQUALITY, labelKeys: ['excellent', 'good', 'moderate', 'elevated', 'poor'] },
  tvoc_index: { defaultThresholds: [100, 150, 250, 400],     colors: SCALE_AIRQUALITY, labelKeys: ['excellent', 'good', 'moderate', 'elevated', 'poor'] },
  temp_c:     { defaultThresholds: [18, 20, 22, 24],         colors: SCALE_TEMPERATURE, labelKeys: ['cold', 'cool', 'comfortable', 'warm', 'hot'] },
  temp_f:     { defaultThresholds: [65, 68, 72, 76],         colors: SCALE_TEMPERATURE, labelKeys: ['cold', 'cool', 'comfortable', 'warm', 'hot'] }
};

// Graph cards in their default top-to-bottom order (`order` reflows them).
const GRAPH_ORDER = ['co', 'radon', 'co2', 'pm25', 'pm10', 'pm1', 'pm03', 'hcho', 'tvoc', 'pm4', 'nox', 'c3h8', 'o2', 'no2', 'o3', 'noise', 'humidity', 'temperature', 'pressure'];
// Graph headings that differ from the short metric label.
const GRAPH_LABELS = { hcho: 'HCHO / CH₂O', c3h8: 'Propane / C₃H₈' };

// Banner styling per recommendation: life-safety keys must look like
// emergencies, not like "consider ventilating".
const REC_SEVERITY = {
  all_good: 'good',
  co_danger: 'critical', co_warning: 'critical', propane_danger: 'critical', propane_warning: 'critical',
  o2_danger: 'critical', o2_warning: 'critical',
  co_elevated: 'poor', ventilate_now: 'poor', run_air_purifier: 'poor', air_purifier_ventilate: 'poor',
  open_window: 'poor', keep_windows_closed: 'poor', ventilate_formaldehyde: 'poor', ventilate_vocs: 'poor',
  ventilate_no2: 'poor', ventilate_o3: 'poor', consider_air_purifier: 'poor',
  consider_ventilating: 'moderate', too_dry: 'moderate', too_humid: 'moderate', reduce_noise: 'moderate'
};

// Header severity of each tier color (the 5-step air-quality scale, with the
// temperature blues slotted in as mild/moderate).
const OVERALL_SEVERITY = {
  '#4caf50': 0, '#8bc34a': 1, '#03a9f4': 1, '#ffc107': 2, '#2196f3': 2, '#ff9800': 3, '#f44336': 4
};

// Gases Home Assistant lets sensors (and users, via entity settings) report in
// several units — e.g. OpenWeatherMap's CO is µg/m³ (#59). Readings are
// converted into the unit the metric's default thresholds are written in.
// Factors assume 25 °C / 1 atm (24.45 L/mol): 1 ppb = MW / 24.45 µg/m³.
// If the user overrides `<metric>_thresholds`, the override is taken to be in
// the sensor's own unit and no conversion happens (that's how the #59
// workaround was written, and silently reinterpreting it would hide alarms).
const UNIT_CONVERSIONS = {
  co:   { unit: 'ppm',   from: { ppm: 1, ppb: 0.001, 'mg/m³': 1 / 1.146, 'μg/m³': 1 / 1146 } },
  hcho: { unit: 'ppb',   from: { ppb: 1, ppm: 1000, 'μg/m³': 1 / 1.228, 'mg/m³': 1000 / 1.228 } },
  no2:  { unit: 'μg/m³', from: { 'μg/m³': 1, ppb: 1.882, ppm: 1882 } },
  o3:   { unit: 'μg/m³', from: { 'μg/m³': 1, ppb: 1.963, ppm: 1963 } }
};

// Canonicalize the spellings sensors use for the same unit: the micro sign
// (U+00B5) vs HA's Greek mu (U+03BC, as in homeassistant/const.py's
// "μg/m³"), "m3" vs "m³", and case for ppm/ppb.
function normalizeUnit(unit) {
  if (unit === undefined || unit === null) return '';
  let u = String(unit).trim().replace(/µ/g, 'μ').replace(/^ug\//i, 'μg/').replace(/m3$/i, 'm³');
  if (/^pp[mb]$/i.test(u)) u = u.toLowerCase();
  return u;
}

// Escape text bound for innerHTML. Units and names can come from integrations
// (e.g. an MQTT discovery payload), so they're never trusted as markup.
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Sensor device classes the card knows how to place, for the card picker's
// stub config and entity suggestions.
const DEVICE_CLASS_METRIC = {
  carbon_dioxide: 'co2', pm25: 'pm25', pm10: 'pm10', pm1: 'pm1', pm4: 'pm4',
  carbon_monoxide: 'co', volatile_organic_compounds: 'tvoc', volatile_organic_compounds_parts: 'tvoc',
  nitrogen_dioxide: 'no2', ozone: 'o3', radon: 'radon',
  humidity: 'humidity', temperature: 'temperature', atmospheric_pressure: 'pressure', sound_pressure: 'noise'
};
// Device classes that make an entity worth suggesting this card for — the
// comfort classes alone (temperature, humidity, …) are too broad.
const SUGGEST_FOR = ['co2', 'pm25', 'pm10', 'pm1', 'pm4', 'co', 'tvoc', 'no2', 'o3', 'radon'];

// Build a card config from the sensors on one device (or, without a device,
// from just the given entity). Shared by getStubConfig and getEntitySuggestion.
function configForDevice(hass, entityId) {
  const config = { type: 'custom:air-quality-card' };
  const deviceId = hass?.entities?.[entityId]?.device_id;
  const candidates = deviceId
    ? Object.keys(hass.entities).filter(id => hass.entities[id].device_id === deviceId && id.startsWith('sensor.'))
    : [entityId];
  for (const id of candidates.sort()) {
    const metric = DEVICE_CLASS_METRIC[hass.states?.[id]?.attributes?.device_class];
    if (metric && !config[`${metric}_entity`]) config[`${metric}_entity`] = id;
  }
  return config;
}

// Last language a card instance resolved. getConfigForm's label callback only
// receives HA's localize function (no hass/config), so the editor borrows it.
let editorLanguage = 'en';

// Embedded translations. Spanish/French/German contributed by @b0rv3g4r4 on
// GitHub PR #11 (with thanks). English is the baseline and the fallback for
// any key missing in a translated locale. To add a language: copy the `en`
// block, rename the key, translate the values, keep the structure identical.
const TRANSLATIONS = {
  en: {
    status: {
      excellent: 'Excellent', good: 'Good', moderate: 'Moderate', fair: 'Fair',
      poor: 'Poor', very_poor: 'Very Poor', extremely_poor: 'Extremely Poor', dangerous: 'Dangerous',
      safe: 'Safe', low: 'Low', high: 'High', elevated: 'Elevated', clean: 'Clean',
      too_dry: 'Too Dry', dry: 'Dry', comfortable: 'Comfortable', humid: 'Humid', too_humid: 'Too Humid',
      cold: 'Cold', cool: 'Cool', warm: 'Warm', hot: 'Hot',
      normal: 'Normal', enriched: 'Enriched', slightly_low: 'Slightly Low', slightly_high: 'Slightly High',
      quiet: 'Quiet', loud: 'Loud', very_loud: 'Very Loud',
      unavailable: 'Unavailable'
    },
    recommendation: {
      all_good: 'All Good', ventilate_now: 'Ventilate Now', run_air_purifier: 'Run Air Purifier',
      consider_air_purifier: 'Consider Air Purifier', open_window: 'Open Window',
      air_purifier_ventilate: 'Air Purifier + Ventilate', co_danger: 'CO Danger — Leave Area',
      co_warning: 'CO Warning — Ventilate Now', co_elevated: 'CO Elevated — Ventilate',
      consider_ventilating: 'Consider Ventilating', keep_windows_closed: 'Keep Windows Closed',
      too_dry: 'Too Dry', too_humid: 'Too Humid', ventilate_formaldehyde: 'Ventilate — Formaldehyde',
      ventilate_vocs: 'Ventilate — VOCs Elevated',
      propane_danger: 'Gas Leak Danger — Evacuate', propane_warning: 'Gas Leak Warning — Ventilate Now',
      o2_danger: 'Low Oxygen Danger — Leave Area', o2_warning: 'Low Oxygen Warning — Ventilate Now',
      ventilate_no2: 'Ventilate — NO₂ Elevated', ventilate_o3: 'Ventilate — O₃ Elevated',
      reduce_noise: 'Reduce Noise Level'
    },
    subtitle: {
      air_quality_healthy: 'Air quality is within healthy limits',
      co_danger: 'CO at {value} — dangerous levels detected', co_danger_unknown: 'Dangerous CO levels',
      co_warning: 'CO at {value} — open all windows immediately', co_warning_unknown: 'High CO levels',
      co_elevated: 'CO at {value} — improve ventilation', co_elevated_unknown: 'CO levels elevated',
      propane_danger: 'Propane at {value} — explosive levels, evacuate immediately', propane_danger_unknown: 'Dangerous propane levels',
      propane_warning: 'Propane at {value} — possible gas leak, ventilate now', propane_warning_unknown: 'Elevated propane levels',
      o2_danger: 'O₂ at {value} — dangerously low oxygen levels', o2_danger_unknown: 'Dangerously low oxygen levels',
      o2_warning: 'O₂ at {value} — improve ventilation', o2_warning_unknown: 'Low oxygen levels',
      ventilate_no2: 'NO₂ at {value} - ventilation needed', ventilate_no2_unknown: 'NO₂ levels elevated',
      ventilate_o3: 'O₃ at {value} - ventilation needed', ventilate_o3_unknown: 'O₃ levels elevated',
      purifier_pm25: 'PM2.5 at {value} - filter the air',
      purifier_pm10: 'PM10 at {value} - filter the air',
      purifier_generic: 'Particulate levels elevated',
      consider_purifier_pm10: 'PM10 at {value}',
      open_window_co2: 'CO₂ at {value} - fresh air needed',
      purifier_ventilate: 'CO₂: {co2}, PM2.5: {pm25}',
      ventilate_now_co2: 'CO₂ at {value} - may affect focus',
      ventilate_formaldehyde: 'HCHO at {value} - ventilation needed',
      ventilate_formaldehyde_unknown: 'Formaldehyde levels elevated',
      ventilate_vocs: 'tVOC at {value} - ventilation needed',
      ventilate_vocs_unknown: 'VOC levels elevated',
      too_dry: 'Humidity at {value} - consider humidifier',
      too_humid: 'Humidity at {value} - ventilate',
      consider_ventilating_co2: 'CO₂ at {value}',
      consider_ventilating_pm25: 'PM2.5 at {value}',
      consider_ventilating_generic: 'Slightly elevated levels',
      keep_closed_outdoor_pm25_poor: 'Outdoor PM2.5 at {value} - poor outdoor air',
      keep_closed_outdoor_pm25: 'Outdoor PM2.5 at {value} - worse than indoor',
      keep_closed_outdoor_co2: 'Outdoor CO₂ at {value} - worse than indoor',
      keep_closed_generic: 'Outdoor air quality is worse than indoor',
      reduce_noise: 'Noise at {value} - prolonged exposure may harm hearing', reduce_noise_unknown: 'Noise levels elevated'
    },
    radon: {
      advisory_danger: 'Radon High - Mitigation Needed',
      advisory_warning: 'Radon Above EPA Action Level',
      advisory_info: 'Radon - Monitor Closely',
      short_term: 'Short-term', long_term: 'Long-term',
      subtitle_single: 'Radon at {value}', action_danger: 'contact a certified radon mitigator', action_warning: 'EPA recommends mitigation above {threshold}', action_info: 'approaching action level'
    },
    metric: { humidity: 'Humidity', temperature: 'Temperature', pressure: 'Pressure', noise: 'Noise' },
    editor: {
      co2_entity: 'CO₂ Sensor', pm25_entity: 'PM2.5 Sensor',
      humidity_entity: 'Humidity Sensor', temperature_entity: 'Temperature Sensor',
      radon_entity: 'Radon Sensor', radon_longterm_entity: 'Radon Long-Term Sensor',
      co_entity: 'CO (Carbon Monoxide) Sensor', hcho_entity: 'Formaldehyde (HCHO) Sensor',
      tvoc_entity: 'tVOC Sensor', pm4_entity: 'PM4 Sensor', nox_entity: 'NOx Sensor',
      pm1_entity: 'PM1 Sensor', pm10_entity: 'PM10 Sensor', pm03_entity: 'PM0.3 Sensor',
      pressure_entity: 'Atmospheric Pressure Sensor', noise_entity: 'Noise Sensor (dB)',
      o2_entity: 'Oxygen (O₂) Sensor', no2_entity: 'Nitrogen Dioxide (NO₂) Sensor',
      o3_entity: 'Ozone (O₃) Sensor', c3h8_entity: 'Propane (C₃H₈) Sensor',
      outdoor_co2_entity: 'Outdoor CO₂', outdoor_pm25_entity: 'Outdoor PM2.5',
      outdoor_humidity_entity: 'Outdoor Humidity', outdoor_temperature_entity: 'Outdoor Temperature',
      outdoor_co_entity: 'Outdoor CO', outdoor_hcho_entity: 'Outdoor HCHO',
      outdoor_tvoc_entity: 'Outdoor tVOC', outdoor_pm1_entity: 'Outdoor PM1',
      outdoor_pm10_entity: 'Outdoor PM10', outdoor_pm03_entity: 'Outdoor PM0.3',
      outdoor_nox_entity: 'Outdoor NOx', outdoor_pressure_entity: 'Outdoor Pressure',
      outdoor_no2_entity: 'Outdoor NO₂', outdoor_o3_entity: 'Outdoor O₃',
      air_quality_entity: 'Air Quality Index (optional)',
      temperature_unit: 'Temperature Unit', temperature_decimals: 'Show temperature with one decimal', radon_unit: 'Radon Unit',
      tvoc_unit: 'tVOC Measurement Type', nox_unit: 'NOx Measurement Type', language: 'Language',
      recommendation_action: 'Recommendation Action (button)',
      compact_alerts: 'Alert chips while collapsed',
      auto_expand: 'Auto-expand when air quality degrades',
      section_additional: 'Additional Sensors', section_outdoor: 'Outdoor Sensors',
      section_advanced: 'Advanced',
      show_min_max: 'Show min/max for each metric', y_scale: 'Graph Y-axis scale', show_status_banner: 'Show status banner', order: 'Sensor order', display: 'Display mode'
    },
    label: { outdoor: 'Outdoor', out: 'out', lt: 'LT', loading: 'Loading…' }
  },
  es: {
    status: { excellent: 'Excelente', good: 'Bueno', moderate: 'Moderado', fair: 'Regular', poor: 'Malo', very_poor: 'Muy malo', extremely_poor: 'Extremadamente malo', dangerous: 'Peligroso', safe: 'Seguro', low: 'Bajo', high: 'Alto', elevated: 'Elevado', clean: 'Limpio', too_dry: 'Demasiado seco', dry: 'Seco', comfortable: 'Confortable', humid: 'Húmedo', too_humid: 'Demasiado húmedo', cold: 'Frío', cool: 'Fresco', warm: 'Cálido', hot: 'Caliente', normal: 'Normal', enriched: 'Enriquecido', slightly_low: 'Ligeramente baja', slightly_high: 'Ligeramente alta', quiet: 'Silencioso', loud: 'Ruidoso', very_loud: 'Muy ruidoso', unavailable: 'No disponible' },
    recommendation: { all_good: 'Todo bien', ventilate_now: 'Ventila ahora', run_air_purifier: 'Enciende el purificador', consider_air_purifier: 'Plantéate usar un purificador', open_window: 'Abre la ventana', air_purifier_ventilate: 'Purificador y ventilación', co_danger: 'Peligro por CO — evacúa la zona', co_warning: 'Alerta de CO — ventila ahora', co_elevated: 'CO elevado — ventila', consider_ventilating: 'Considera ventilar', keep_windows_closed: 'Mantén las ventanas cerradas', too_dry: 'Demasiado seco', too_humid: 'Demasiado húmedo', ventilate_formaldehyde: 'Ventila — formaldehído', ventilate_vocs: 'Ventila — COV elevados', propane_danger: 'Peligro de fuga de gas — evacúa', propane_warning: 'Alerta de fuga de gas — ventila ahora', o2_danger: 'Peligro de oxígeno bajo — abandona la zona', o2_warning: 'Alerta de oxígeno bajo — ventila ahora', ventilate_no2: 'Ventila — NO₂ elevado', ventilate_o3: 'Ventila — O₃ elevado', reduce_noise: 'Reduce el nivel de ruido' },
    subtitle: { air_quality_healthy: 'La calidad del aire está dentro de límites saludables', co_danger: 'CO en {value} — niveles peligrosos detectados', co_danger_unknown: 'Niveles de CO peligrosos', co_warning: 'CO en {value} — abre todas las ventanas de inmediato', co_warning_unknown: 'Niveles de CO altos', co_elevated: 'CO en {value} — mejora la ventilación', co_elevated_unknown: 'Niveles de CO elevados', propane_danger: 'Propano en {value} — niveles explosivos, evacúa de inmediato', propane_danger_unknown: 'Niveles de propano peligrosos', propane_warning: 'Propano en {value} — posible fuga de gas, ventila ahora', propane_warning_unknown: 'Niveles de propano elevados', o2_danger: 'O₂ en {value} — niveles de oxígeno peligrosamente bajos', o2_danger_unknown: 'Niveles de oxígeno peligrosamente bajos', o2_warning: 'O₂ en {value} — mejora la ventilación', o2_warning_unknown: 'Niveles de oxígeno bajos', ventilate_no2: 'NO₂ en {value} - ventilación necesaria', ventilate_no2_unknown: 'Niveles de NO₂ elevados', ventilate_o3: 'O₃ en {value} - ventilación necesaria', ventilate_o3_unknown: 'Niveles de O₃ elevados', purifier_pm25: 'PM2.5 en {value} - filtra el aire', purifier_pm10: 'PM10 en {value} - filtra el aire', purifier_generic: 'Niveles elevados de partículas', consider_purifier_pm10: 'PM10 en {value}', open_window_co2: 'CO₂ en {value} - hace falta aire fresco', purifier_ventilate: 'CO₂: {co2}, PM2.5: {pm25}', ventilate_now_co2: 'CO₂ en {value} - puede afectar a la concentración', ventilate_formaldehyde: 'HCHO en {value} - ventilación necesaria', ventilate_formaldehyde_unknown: 'Niveles de formaldehído elevados', ventilate_vocs: 'tVOC en {value} - ventilación necesaria', ventilate_vocs_unknown: 'Niveles de COV elevados', too_dry: 'Humedad en {value} - plantéate usar un humidificador', too_humid: 'Humedad en {value} - ventila', consider_ventilating_co2: 'CO₂ en {value}', consider_ventilating_pm25: 'PM2.5 en {value}', consider_ventilating_generic: 'Niveles ligeramente elevados', keep_closed_outdoor_pm25_poor: 'PM2.5 exterior en {value} - mala calidad del aire exterior', keep_closed_outdoor_pm25: 'PM2.5 exterior en {value} - peor que en interior', keep_closed_outdoor_co2: 'CO₂ exterior en {value} - peor que en interior', keep_closed_generic: 'La calidad del aire exterior es peor que en interior', reduce_noise: 'Ruido en {value} - la exposición prolongada puede dañar la audición', reduce_noise_unknown: 'Niveles de ruido elevados' },
    radon: { advisory_danger: 'Radón alto — se necesita mitigación', advisory_warning: 'Radón por encima del nivel de acción EPA', advisory_info: 'Radón — monitorear de cerca', short_term: 'Corto plazo', long_term: 'Largo plazo', subtitle_single: 'Radón en {value}', action_danger: 'contacta con un especialista certificado en mitigación de radón', action_warning: 'la EPA recomienda mitigar por encima de {threshold}', action_info: 'acercándose al nivel de acción' },
    metric: { humidity: 'Humedad', temperature: 'Temperatura', pressure: 'Presión', noise: 'Ruido' },
    editor: { co2_entity: 'Sensor de CO₂', pm25_entity: 'Sensor de PM2.5', humidity_entity: 'Sensor de humedad', temperature_entity: 'Sensor de temperatura', radon_entity: 'Sensor de radón', radon_longterm_entity: 'Sensor de radón (largo plazo)', co_entity: 'Sensor de CO (monóxido de carbono)', hcho_entity: 'Sensor de formaldehído (HCHO)', tvoc_entity: 'Sensor de tVOC', pm4_entity: 'Sensor de PM4', nox_entity: 'Sensor de NOx', pm1_entity: 'Sensor de PM1', pm10_entity: 'Sensor de PM10', pm03_entity: 'Sensor de PM0.3', pressure_entity: 'Sensor de presión atmosférica', noise_entity: 'Sensor de ruido (dB)', o2_entity: 'Sensor de oxígeno (O₂)', no2_entity: 'Sensor de dióxido de nitrógeno (NO₂)', o3_entity: 'Sensor de ozono (O₃)', c3h8_entity: 'Sensor de propano (C₃H₈)', outdoor_co2_entity: 'CO₂ exterior', outdoor_pm25_entity: 'PM2.5 exterior', outdoor_humidity_entity: 'Humedad exterior', outdoor_temperature_entity: 'Temperatura exterior', outdoor_co_entity: 'CO exterior', outdoor_hcho_entity: 'HCHO exterior', outdoor_tvoc_entity: 'tVOC exterior', outdoor_pm1_entity: 'PM1 exterior', outdoor_pm10_entity: 'PM10 exterior', outdoor_pm03_entity: 'PM0.3 exterior', outdoor_nox_entity: 'NOx exterior', outdoor_no2_entity: 'NO₂ exterior', outdoor_o3_entity: 'O₃ exterior', outdoor_pressure_entity: 'Presión exterior', air_quality_entity: 'Índice de calidad del aire (opcional)', temperature_unit: 'Unidad de temperatura', temperature_decimals: 'Mostrar temperatura con un decimal', radon_unit: 'Unidad de radón', tvoc_unit: 'Tipo de medición tVOC', nox_unit: 'Tipo de medición NOx', language: 'Idioma', recommendation_action: 'Acción de recomendación (botón)', compact_alerts: 'Indicadores de alerta al plegar', auto_expand: 'Expandir automáticamente si la calidad del aire empeora', section_additional: 'Sensores adicionales', section_outdoor: 'Sensores exteriores', section_advanced: 'Avanzado', show_min_max: 'Mostrar mín./máx. de cada métrica', y_scale: 'Escala del eje Y', show_status_banner: 'Mostrar banner de estado', order: 'Orden de sensores', display: 'Modo de visualización' },
    label: { outdoor: 'Exterior', out: 'ext', lt: 'LP', loading: 'Cargando…' }
  },
  fr: {
    status: { excellent: 'Excellent', good: 'Bon', moderate: 'Modéré', fair: 'Passable', poor: 'Mauvais', very_poor: 'Très mauvais', extremely_poor: 'Extrêmement mauvais', dangerous: 'Dangereux', safe: 'Sûr', low: 'Faible', high: 'Très élevé', elevated: 'Élevé', clean: 'Propre', too_dry: 'Trop sec', dry: 'Sec', comfortable: 'Confortable', humid: 'Humide', too_humid: 'Trop humide', cold: 'Froid', cool: 'Frais', warm: 'Chaud', hot: 'Très chaud', normal: 'Normale', enriched: 'Enrichi', slightly_low: 'Légèrement basse', slightly_high: 'Légèrement haute', quiet: 'Silencieux', loud: 'Bruyant', very_loud: 'Très bruyant', unavailable: 'Indisponible' },
    recommendation: { all_good: 'Tout va bien', ventilate_now: 'Ventiler maintenant', run_air_purifier: 'Utiliser le purificateur', consider_air_purifier: 'Envisager le purificateur', open_window: 'Ouvrir une fenêtre', air_purifier_ventilate: 'Purificateur + Ventiler', co_danger: 'Danger au CO — évacuer', co_warning: 'Alerte CO — ventiler maintenant', co_elevated: 'CO élevé — ventiler', consider_ventilating: 'Envisager de ventiler', keep_windows_closed: 'Garder les fenêtres fermées', too_dry: 'Trop sec', too_humid: 'Trop humide', ventilate_formaldehyde: 'Ventiler — Formaldéhyde', ventilate_vocs: 'Ventiler — COV élevés', propane_danger: 'Danger de fuite de gaz — évacuer', propane_warning: 'Alerte fuite de gaz — ventiler maintenant', o2_danger: "Danger d'oxygène bas — quitter la zone", o2_warning: 'Alerte oxygène bas — ventiler maintenant', ventilate_no2: 'Ventiler — NO₂ élevé', ventilate_o3: 'Ventiler — O₃ élevé', reduce_noise: 'Réduire le niveau sonore' },
    subtitle: { air_quality_healthy: "La qualité de l'air est dans les limites saines", co_danger: 'CO à {value} — niveaux dangereux détectés', co_danger_unknown: 'Niveaux de CO dangereux', co_warning: 'CO à {value} — ouvrir toutes les fenêtres immédiatement', co_warning_unknown: 'Niveaux de CO élevés', co_elevated: 'CO à {value} — améliorer la ventilation', co_elevated_unknown: 'Niveaux de CO élevés', propane_danger: 'Propane à {value} — niveaux explosifs, évacuer immédiatement', propane_danger_unknown: 'Niveaux de propane dangereux', propane_warning: 'Propane à {value} — fuite de gaz possible, ventiler maintenant', propane_warning_unknown: 'Niveaux de propane élevés', o2_danger: "O₂ à {value} — niveaux d'oxygène dangereusement bas", o2_danger_unknown: "Niveaux d'oxygène dangereusement bas", o2_warning: 'O₂ à {value} — améliorer la ventilation', o2_warning_unknown: "Niveaux d'oxygène bas", ventilate_no2: 'NO₂ à {value} - ventilation nécessaire', ventilate_no2_unknown: 'Niveaux de NO₂ élevés', ventilate_o3: 'O₃ à {value} - ventilation nécessaire', ventilate_o3_unknown: 'Niveaux de O₃ élevés', purifier_pm25: "PM2.5 à {value} - filtrer l'air", purifier_pm10: "PM10 à {value} - filtrer l'air", purifier_generic: 'Niveaux de particules élevés', consider_purifier_pm10: 'PM10 à {value}', open_window_co2: 'CO₂ à {value} - air frais nécessaire', purifier_ventilate: 'CO₂: {co2}, PM2.5: {pm25}', ventilate_now_co2: 'CO₂ à {value} - peut affecter la concentration', ventilate_formaldehyde: 'HCHO à {value} - ventilation nécessaire', ventilate_formaldehyde_unknown: 'Niveaux de formaldéhyde élevés', ventilate_vocs: 'tVOC à {value} - ventilation nécessaire', ventilate_vocs_unknown: 'Niveaux de COV élevés', too_dry: 'Humidité à {value} - utiliser un humidificateur', too_humid: 'Humidité à {value} - ventiler', consider_ventilating_co2: 'CO₂ à {value}', consider_ventilating_pm25: 'PM2.5 à {value}', consider_ventilating_generic: 'Niveaux légèrement élevés', keep_closed_outdoor_pm25_poor: 'PM2.5 extérieur à {value} - mauvaise qualité extérieure', keep_closed_outdoor_pm25: "PM2.5 extérieur à {value} - pire qu'à l'intérieur", keep_closed_outdoor_co2: "CO₂ extérieur à {value} - pire qu'à l'intérieur", keep_closed_generic: "La qualité de l'air extérieur est pire qu'à l'intérieur", reduce_noise: "Bruit à {value} - une exposition prolongée peut nuire à l'audition", reduce_noise_unknown: 'Niveaux de bruit élevés' },
    radon: { advisory_danger: 'Radon élevé — mitigation nécessaire', advisory_warning: "Radon au-dessus du niveau d'action EPA", advisory_info: 'Radon — surveiller de près', short_term: 'Court terme', long_term: 'Long terme', subtitle_single: 'Radon à {value}', action_danger: 'contactez un spécialiste certifié de la réduction du radon', action_warning: "l'EPA recommande d'agir au-delà de {threshold}", action_info: "proche du niveau d'action" },
    metric: { humidity: 'Humidité', temperature: 'Température', pressure: 'Pression', noise: 'Bruit' },
    editor: { co2_entity: 'Capteur CO₂', pm25_entity: 'Capteur PM2.5', humidity_entity: "Capteur d'humidité", temperature_entity: 'Capteur de température', radon_entity: 'Capteur de radon', radon_longterm_entity: 'Capteur de radon (long terme)', co_entity: 'Capteur CO (Monoxyde de carbone)', hcho_entity: 'Capteur Formaldéhyde (HCHO)', tvoc_entity: 'Capteur tVOC', pm4_entity: 'Capteur PM4', nox_entity: 'Capteur NOx', pm1_entity: 'Capteur PM1', pm10_entity: 'Capteur PM10', pm03_entity: 'Capteur PM0.3', pressure_entity: 'Capteur de pression atmosphérique', noise_entity: 'Capteur de bruit (dB)', o2_entity: 'Capteur oxygène (O₂)', no2_entity: "Capteur dioxyde d'azote (NO₂)", o3_entity: 'Capteur ozone (O₃)', c3h8_entity: 'Capteur propane (C₃H₈)', outdoor_co2_entity: 'CO₂ extérieur', outdoor_pm25_entity: 'PM2.5 extérieur', outdoor_humidity_entity: 'Humidité extérieure', outdoor_temperature_entity: 'Température extérieure', outdoor_co_entity: 'CO extérieur', outdoor_hcho_entity: 'HCHO extérieur', outdoor_tvoc_entity: 'tVOC extérieur', outdoor_pm1_entity: 'PM1 extérieur', outdoor_pm10_entity: 'PM10 extérieur', outdoor_pm03_entity: 'PM0.3 extérieur', outdoor_nox_entity: 'NOx extérieur', outdoor_no2_entity: 'NO₂ extérieur', outdoor_o3_entity: 'O₃ extérieur', outdoor_pressure_entity: 'Pression extérieure', air_quality_entity: "Indice de qualité de l'air (optionnel)", temperature_unit: 'Unité de température', temperature_decimals: 'Afficher la température avec une décimale', radon_unit: 'Unité de radon', tvoc_unit: 'Type de mesure tVOC', nox_unit: 'Type de mesure NOx', language: 'Langue', recommendation_action: 'Action de recommandation (bouton)', compact_alerts: 'Badges d\'alerte en mode replié', auto_expand: 'Déplier automatiquement si la qualité de l\'air se dégrade', section_additional: 'Capteurs supplémentaires', section_outdoor: 'Capteurs extérieurs', section_advanced: 'Avancé', show_min_max: 'Afficher min/max pour chaque mesure', y_scale: "Échelle de l'axe Y", show_status_banner: 'Afficher la bannière de statut', order: 'Ordre des capteurs', display: "Mode d'affichage" },
    label: { outdoor: 'Extérieur', out: 'ext', lt: 'LT', loading: 'Chargement…' }
  },
  de: {
    status: { excellent: 'Ausgezeichnet', good: 'Gut', moderate: 'Mäßig', fair: 'Akzeptabel', poor: 'Schlecht', very_poor: 'Sehr schlecht', extremely_poor: 'Extrem schlecht', dangerous: 'Gefährlich', safe: 'Sicher', low: 'Niedrig', high: 'Hoch', elevated: 'Erhöht', clean: 'Sauber', too_dry: 'Zu trocken', dry: 'Trocken', comfortable: 'Angenehm', humid: 'Feucht', too_humid: 'Zu feucht', cold: 'Kalt', cool: 'Kühl', warm: 'Warm', hot: 'Heiß', normal: 'Normal', enriched: 'Angereichert', slightly_low: 'Leicht niedrig', slightly_high: 'Leicht hoch', quiet: 'Leise', loud: 'Laut', very_loud: 'Sehr laut', unavailable: 'Nicht verfügbar' },
    recommendation: { all_good: 'Alles gut', ventilate_now: 'Jetzt lüften', run_air_purifier: 'Luftreiniger einschalten', consider_air_purifier: 'Luftreiniger erwägen', open_window: 'Fenster öffnen', air_purifier_ventilate: 'Luftreiniger + Lüften', co_danger: 'CO-Gefahr — Bereich verlassen', co_warning: 'CO-Warnung — Sofort lüften', co_elevated: 'CO erhöht — Lüften', consider_ventilating: 'Lüften erwägen', keep_windows_closed: 'Fenster geschlossen halten', too_dry: 'Zu trocken', too_humid: 'Zu feucht', ventilate_formaldehyde: 'Lüften — Formaldehyd', ventilate_vocs: 'Lüften — VOC erhöht', propane_danger: 'Gasleck-Gefahr — Evakuieren', propane_warning: 'Gasleck-Warnung — Sofort lüften', o2_danger: 'Sauerstoffmangel-Gefahr — Bereich verlassen', o2_warning: 'Sauerstoffmangel-Warnung — Sofort lüften', ventilate_no2: 'Lüften — NO₂ erhöht', ventilate_o3: 'Lüften — O₃ erhöht', reduce_noise: 'Lärmpegel senken' },
    subtitle: { air_quality_healthy: 'Luftqualität liegt innerhalb gesunder Grenzen', co_danger: 'CO bei {value} — gefährliche Werte erkannt', co_danger_unknown: 'Gefährliche CO-Werte', co_warning: 'CO bei {value} — alle Fenster sofort öffnen', co_warning_unknown: 'Hohe CO-Werte', co_elevated: 'CO bei {value} — Belüftung verbessern', co_elevated_unknown: 'CO-Werte erhöht', propane_danger: 'Propan bei {value} — explosive Werte, sofort evakuieren', propane_danger_unknown: 'Gefährliche Propanwerte', propane_warning: 'Propan bei {value} — mögliches Gasleck, sofort lüften', propane_warning_unknown: 'Erhöhte Propanwerte', o2_danger: 'O₂ bei {value} — gefährlich niedriger Sauerstoffgehalt', o2_danger_unknown: 'Gefährlich niedriger Sauerstoffgehalt', o2_warning: 'O₂ bei {value} — Belüftung verbessern', o2_warning_unknown: 'Niedriger Sauerstoffgehalt', ventilate_no2: 'NO₂ bei {value} - Lüftung erforderlich', ventilate_no2_unknown: 'NO₂-Werte erhöht', ventilate_o3: 'O₃ bei {value} - Lüftung erforderlich', ventilate_o3_unknown: 'O₃-Werte erhöht', purifier_pm25: 'PM2.5 bei {value} - Luft filtern', purifier_pm10: 'PM10 bei {value} - Luft filtern', purifier_generic: 'Partikelwerte erhöht', consider_purifier_pm10: 'PM10 bei {value}', open_window_co2: 'CO₂ bei {value} - Frischluft benötigt', purifier_ventilate: 'CO₂: {co2}, PM2.5: {pm25}', ventilate_now_co2: 'CO₂ bei {value} - kann Konzentration beeinträchtigen', ventilate_formaldehyde: 'HCHO bei {value} - Lüftung erforderlich', ventilate_formaldehyde_unknown: 'Formaldehydwerte erhöht', ventilate_vocs: 'tVOC bei {value} - Lüftung erforderlich', ventilate_vocs_unknown: 'VOC-Werte erhöht', too_dry: 'Luftfeuchtigkeit bei {value} - Luftbefeuchter empfohlen', too_humid: 'Luftfeuchtigkeit bei {value} - Lüften', consider_ventilating_co2: 'CO₂ bei {value}', consider_ventilating_pm25: 'PM2.5 bei {value}', consider_ventilating_generic: 'Leicht erhöhte Werte', keep_closed_outdoor_pm25_poor: 'Außen PM2.5 bei {value} - schlechte Außenluft', keep_closed_outdoor_pm25: 'Außen PM2.5 bei {value} - schlechter als innen', keep_closed_outdoor_co2: 'Außen CO₂ bei {value} - schlechter als innen', keep_closed_generic: 'Außenluft ist schlechter als Innenluft', reduce_noise: 'Lärm bei {value} - dauerhafte Belastung kann das Gehör schädigen', reduce_noise_unknown: 'Lärmpegel erhöht' },
    radon: { advisory_danger: 'Radon hoch — Minderung erforderlich', advisory_warning: 'Radon über EPA-Eingreifrichtwert', advisory_info: 'Radon — genau beobachten', short_term: 'Kurzfristig', long_term: 'Langfristig', subtitle_single: 'Radon bei {value}', action_danger: 'zertifizierte Radon-Fachkraft hinzuziehen', action_warning: 'EPA empfiehlt Minderung ab {threshold}', action_info: 'nähert sich dem Eingreifrichtwert' },
    metric: { humidity: 'Feuchtigkeit', temperature: 'Temperatur', pressure: 'Luftdruck', noise: 'Lärm' },
    editor: { co2_entity: 'CO₂-Sensor', pm25_entity: 'PM2.5-Sensor', humidity_entity: 'Feuchtigkeitssensor', temperature_entity: 'Temperatursensor', radon_entity: 'Radon-Sensor', radon_longterm_entity: 'Radon-Sensor (Langzeit)', co_entity: 'CO-Sensor (Kohlenmonoxid)', hcho_entity: 'Formaldehyd-Sensor (HCHO)', tvoc_entity: 'tVOC-Sensor', pm4_entity: 'PM4-Sensor', nox_entity: 'NOx-Sensor', pm1_entity: 'PM1-Sensor', pm10_entity: 'PM10-Sensor', pm03_entity: 'PM0.3-Sensor', pressure_entity: 'Luftdrucksensor', noise_entity: 'Lärmsensor (dB)', o2_entity: 'Sauerstoff-Sensor (O₂)', no2_entity: 'Stickstoffdioxid-Sensor (NO₂)', o3_entity: 'Ozon-Sensor (O₃)', c3h8_entity: 'Propan-Sensor (C₃H₈)', outdoor_co2_entity: 'Außen CO₂', outdoor_pm25_entity: 'Außen PM2.5', outdoor_humidity_entity: 'Außen Luftfeuchtigkeit', outdoor_temperature_entity: 'Außen Temperatur', outdoor_co_entity: 'Außen CO', outdoor_hcho_entity: 'Außen HCHO', outdoor_tvoc_entity: 'Außen tVOC', outdoor_pm1_entity: 'Außen PM1', outdoor_pm10_entity: 'Außen PM10', outdoor_pm03_entity: 'Außen PM0.3', outdoor_nox_entity: 'Außen NOx', outdoor_no2_entity: 'Außen NO₂', outdoor_o3_entity: 'Außen O₃', outdoor_pressure_entity: 'Außen Luftdruck', air_quality_entity: 'Luftqualitätsindex (optional)', temperature_unit: 'Temperatureinheit', temperature_decimals: 'Temperatur mit einer Dezimalstelle anzeigen', radon_unit: 'Radon-Einheit', tvoc_unit: 'tVOC-Messtyp', nox_unit: 'NOx-Messtyp', language: 'Sprache', recommendation_action: 'Empfehlungsaktion (Schaltfläche)', compact_alerts: 'Warnhinweise im eingeklappten Zustand', auto_expand: 'Automatisch ausklappen bei schlechter Luftqualität', section_additional: 'Weitere Sensoren', section_outdoor: 'Außensensoren', section_advanced: 'Erweitert', show_min_max: 'Min/Max je Messwert anzeigen', y_scale: 'Y-Achsen-Skalierung', show_status_banner: 'Statusbanner anzeigen', order: 'Sensor-Reihenfolge', display: 'Anzeigemodus' },
    label: { outdoor: 'Außen', out: 'außen', lt: 'LZ', loading: 'Wird geladen…' }
  },
  pt: {
    status: { excellent: 'Excelente', good: 'Bom', moderate: 'Moderado', fair: 'Regular', poor: 'Ruim', very_poor: 'Muito Ruim', extremely_poor: 'Extremamente Ruim', dangerous: 'Perigoso', safe: 'Seguro', low: 'Baixo', high: 'Alto', elevated: 'Elevado', clean: 'Limpo', too_dry: 'Muito Seco', dry: 'Seco', comfortable: 'Confortável', humid: 'Úmido', too_humid: 'Muito Úmido', cold: 'Frio', cool: 'Fresco', warm: 'Morno', hot: 'Quente', normal: 'Normal', enriched: 'Enriquecido', slightly_low: 'Levemente baixa', slightly_high: 'Levemente alta', quiet: 'Silencioso', loud: 'Barulhento', very_loud: 'Muito Barulhento', unavailable: 'Indisponível' },
    recommendation: { all_good: 'Tudo Bem', ventilate_now: 'Ventile Agora', run_air_purifier: 'Ligar o Purificador', consider_air_purifier: 'Considere um Purificador', open_window: 'Abra a Janela', air_purifier_ventilate: 'Purificador + Ventilação', co_danger: 'Perigo de CO — Saia do Ambiente', co_warning: 'Alerta de CO — Ventile Agora', co_elevated: 'CO Elevado — Ventile', consider_ventilating: 'Considere Ventilar', keep_windows_closed: 'Mantenha as Janelas Fechadas', too_dry: 'Muito Seco', too_humid: 'Muito Úmido', ventilate_formaldehyde: 'Ventile — Formaldeído', ventilate_vocs: 'Ventile — COVs Elevados', propane_danger: 'Perigo de Vazamento de Gás — Evacue', propane_warning: 'Alerta de Vazamento de Gás — Ventile Agora', o2_danger: 'Perigo de Oxigênio Baixo — Saia do Ambiente', o2_warning: 'Alerta de Oxigênio Baixo — Ventile Agora', ventilate_no2: 'Ventile — NO₂ Elevado', ventilate_o3: 'Ventile — O₃ Elevado', reduce_noise: 'Reduza o Nível de Ruído' },
    subtitle: { air_quality_healthy: 'A qualidade do ar está dentro dos limites saudáveis', co_danger: 'CO em {value} — níveis perigosos detectados', co_danger_unknown: 'Níveis perigosos de CO', co_warning: 'CO em {value} — abra todas as janelas imediatamente', co_warning_unknown: 'Níveis altos de CO', co_elevated: 'CO em {value} — melhore a ventilação', co_elevated_unknown: 'Níveis de CO elevados', propane_danger: 'Propano em {value} — níveis explosivos, evacue imediatamente', propane_danger_unknown: 'Níveis perigosos de propano', propane_warning: 'Propano em {value} — possível vazamento de gás, ventile agora', propane_warning_unknown: 'Níveis de propano elevados', o2_danger: 'O₂ em {value} — níveis de oxigênio perigosamente baixos', o2_danger_unknown: 'Níveis de oxigênio perigosamente baixos', o2_warning: 'O₂ em {value} — melhore a ventilação', o2_warning_unknown: 'Níveis de oxigênio baixos', ventilate_no2: 'NO₂ em {value} - ventilação necessária', ventilate_no2_unknown: 'Níveis de NO₂ elevados', ventilate_o3: 'O₃ em {value} - ventilação necessária', ventilate_o3_unknown: 'Níveis de O₃ elevados', purifier_pm25: 'PM2.5 em {value} - filtre o ar', purifier_pm10: 'PM10 em {value} - filtre o ar', purifier_generic: 'Níveis de partículas elevados', consider_purifier_pm10: 'PM10 em {value}', open_window_co2: 'CO₂ em {value} - ar fresco necessário', purifier_ventilate: 'CO₂: {co2}, PM2.5: {pm25}', ventilate_now_co2: 'CO₂ em {value} - pode afetar a concentração', ventilate_formaldehyde: 'HCHO em {value} - ventilação necessária', ventilate_formaldehyde_unknown: 'Níveis de formaldeído elevados', ventilate_vocs: 'tVOC em {value} - ventilação necessária', ventilate_vocs_unknown: 'Níveis de COVs elevados', too_dry: 'Umidade em {value} - considere um umidificador', too_humid: 'Umidade em {value} - ventile', consider_ventilating_co2: 'CO₂ em {value}', consider_ventilating_pm25: 'PM2.5 em {value}', consider_ventilating_generic: 'Níveis levemente elevados', keep_closed_outdoor_pm25_poor: 'PM2.5 externo em {value} - ar externo de má qualidade', keep_closed_outdoor_pm25: 'PM2.5 externo em {value} - pior que o ar interno', keep_closed_outdoor_co2: 'CO₂ externo em {value} - pior que o ar interno', keep_closed_generic: 'A qualidade do ar externo é pior que o interno', reduce_noise: 'Ruído em {value} - exposição prolongada pode prejudicar a audição', reduce_noise_unknown: 'Níveis de ruído elevados' },
    radon: { advisory_danger: 'Radônio Alto — Mitigação Necessária', advisory_warning: 'Radônio Acima do Nível de Ação da EPA', advisory_info: 'Radônio — Monitorar de Perto', short_term: 'Curto prazo', long_term: 'Longo prazo', subtitle_single: 'Radônio em {value}', action_danger: 'contate um especialista certificado em mitigação de radônio', action_warning: 'a EPA recomenda mitigação acima de {threshold}', action_info: 'aproximando-se do nível de ação' },
    metric: { humidity: 'Umidade', temperature: 'Temperatura', pressure: 'Pressão', noise: 'Ruído' },
    editor: { co2_entity: 'Sensor de CO₂', pm25_entity: 'Sensor de PM2.5', humidity_entity: 'Sensor de Umidade', temperature_entity: 'Sensor de Temperatura', radon_entity: 'Sensor de Radônio', radon_longterm_entity: 'Sensor de Radônio (Longo Prazo)', co_entity: 'Sensor de CO (Monóxido de Carbono)', hcho_entity: 'Sensor de Formaldeído (HCHO)', tvoc_entity: 'Sensor de tVOC', pm4_entity: 'Sensor de PM4', nox_entity: 'Sensor de NOx', pm1_entity: 'Sensor de PM1', pm10_entity: 'Sensor de PM10', pm03_entity: 'Sensor de PM0.3', pressure_entity: 'Sensor de Pressão Atmosférica', noise_entity: 'Sensor de Ruído (dB)', o2_entity: 'Sensor de Oxigênio (O₂)', no2_entity: 'Sensor de Dióxido de Nitrogênio (NO₂)', o3_entity: 'Sensor de Ozônio (O₃)', c3h8_entity: 'Sensor de Propano (C₃H₈)', outdoor_co2_entity: 'CO₂ Externo', outdoor_pm25_entity: 'PM2.5 Externo', outdoor_humidity_entity: 'Umidade Externa', outdoor_temperature_entity: 'Temperatura Externa', outdoor_co_entity: 'CO Externo', outdoor_hcho_entity: 'HCHO Externo', outdoor_tvoc_entity: 'tVOC Externo', outdoor_pm1_entity: 'PM1 Externo', outdoor_pm10_entity: 'PM10 Externo', outdoor_pm03_entity: 'PM0.3 Externo', outdoor_nox_entity: 'NOx Externo', outdoor_no2_entity: 'NO₂ Externo', outdoor_o3_entity: 'O₃ Externo', outdoor_pressure_entity: 'Pressão Externa', air_quality_entity: 'Índice de Qualidade do Ar (opcional)', temperature_unit: 'Unidade de Temperatura', temperature_decimals: 'Mostrar temperatura com uma casa decimal', radon_unit: 'Unidade de Radônio', tvoc_unit: 'Tipo de Medição de tVOC', nox_unit: 'Tipo de Medição de NOx', language: 'Idioma', recommendation_action: 'Ação da recomendação (botão)', compact_alerts: 'Indicadores de alerta quando recolhido', auto_expand: 'Expandir automaticamente se a qualidade do ar piorar', section_additional: 'Sensores Adicionais', section_outdoor: 'Sensores Externos', section_advanced: 'Avançado', show_min_max: 'Mostrar mín/máx de cada métrica', y_scale: 'Escala do eixo Y', show_status_banner: 'Mostrar banner de status', order: 'Ordem dos sensores', display: 'Modo de exibição' },
    label: { outdoor: 'Externo', out: 'ext', lt: 'LP', loading: 'Carregando…' }
  },
  hu: {
    status: {
      excellent: 'Kiváló', good: 'Jó', moderate: 'Mérsékelt', fair: 'Megfelelő',
      poor: 'Gyenge', very_poor: 'Nagyon gyenge', extremely_poor: 'Kritikus', dangerous: 'Veszélyes',
      safe: 'Biztonságos', low: 'Alacsony', high: 'Magas', elevated: 'Emelkedett', clean: 'Tiszta',
      too_dry: 'Túl száraz', dry: 'Száraz', comfortable: 'Komfortos', humid: 'Párás', too_humid: 'Túl párás',
      cold: 'Hideg', cool: 'Hűvös', warm: 'Meleg', hot: 'Forró',
      normal: 'Normál', enriched: 'Dúsított', slightly_low: 'Kissé alacsony', slightly_high: 'Kissé magas',
      quiet: 'Csendes', loud: 'Zajos', very_loud: 'Nagyon zajos',
      unavailable: 'Nem elérhető'
    },
    recommendation: {
      all_good: 'Minden rendben', ventilate_now: 'Szellőztessen most', run_air_purifier: 'Kapcsolja be a légtisztítót',
      consider_air_purifier: 'Fontolja meg a légtisztító használatát', open_window: 'Nyisson ablakot',
      air_purifier_ventilate: 'Légtisztítás + Szellőztetés', co_danger: 'CO Veszély – Hagyja el a helyiséget!',
      co_warning: 'CO Figyelmeztetés – Szellőztessen most', co_elevated: 'CO Emelkedett – Szellőztessen',
      consider_ventilating: 'Fontolja meg a szellőztetést', keep_windows_closed: 'Tartsa zárva az ablakokat',
      too_dry: 'Túl száraz levegő', too_humid: 'Túl párás levegő', ventilate_formaldehyde: 'Szellőztetés – Formaldehid',
      ventilate_vocs: 'Szellőztetés – Magas VOC szint', reduce_noise: 'Csökkentse a zajszintet',
      propane_danger: 'Gázszivárgás veszély – Hagyja el az épületet!', propane_warning: 'Gázszivárgás figyelmeztetés – Szellőztessen most',
      o2_danger: 'Oxigénhiány veszély – Hagyja el a helyiséget!', o2_warning: 'Alacsony oxigénszint – Szellőztessen most',
      ventilate_no2: 'Szellőztetés – Magas NO₂ szint', ventilate_o3: 'Szellőztetés – Magas O₃ szint'
    },
    subtitle: {
      air_quality_healthy: 'A levegőminőség az egészséges határértékeken belül van',
      co_danger: 'CO szint: {value} – veszélyes szint észlelve', co_danger_unknown: 'Veszélyes CO szint',
      co_warning: 'CO szint: {value} – azonnal nyisson ablakot', co_warning_unknown: 'Magas CO szint',
      co_elevated: 'CO szint: {value} – fokozza a szellőzést', co_elevated_unknown: 'Emelkedett CO szint',
      purifier_pm25: 'PM2.5 szint: {value} – tisztítsa a levegőt',
      purifier_pm10: 'PM10 szint: {value} – tisztítsa a levegőt',
      purifier_generic: 'A szálló por szintje emelkedett',
      consider_purifier_pm10: 'PM10 szint: {value}',
      open_window_co2: 'CO₂ szint: {value} – friss levegő szükséges',
      purifier_ventilate: 'CO₂: {co2}, PM2.5: {pm25}',
      ventilate_now_co2: 'CO₂ szint: {value} – befolyásolhatja a koncentrációt',
      ventilate_formaldehyde: 'HCHO szint: {value} – szellőztetés szükséges',
      ventilate_formaldehyde_unknown: 'Emelkedett formaldehid szint',
      ventilate_vocs: 'tVOC szint: {value} – szellőztetés szükséges',
      ventilate_vocs_unknown: 'Emelkedett VOC szint',
      too_dry: 'Páratartalom: {value} – fontolja meg párásító használatát',
      too_humid: 'Páratartalom: {value} – szellőztessen',
      consider_ventilating_co2: 'CO₂ szint: {value}',
      consider_ventilating_pm25: 'PM2.5 szint: {value}',
      consider_ventilating_generic: 'Enyhén emelkedett szintek',
      keep_closed_outdoor_pm25_poor: 'Kültéri PM2.5: {value} – rossz kinti levegő',
      keep_closed_outdoor_pm25: 'Kültéri PM2.5: {value} – rosszabb, mint bent',
      keep_closed_outdoor_co2: 'Kültéri CO₂: {value} – rosszabb, mint bent',
      keep_closed_generic: 'A kültéri levegőminőség rosszabb, mint a benti',
      reduce_noise: 'Zajszint: {value} – tartósan halláskárosodást okozhat', reduce_noise_unknown: 'Magas zajszint',
      propane_danger: 'Propán szint: {value} – robbanásveszélyes, azonnal hagyja el az épületet', propane_danger_unknown: 'Veszélyes propán szint',
      propane_warning: 'Propán szint: {value} – lehetséges gázszivárgás, szellőztessen most', propane_warning_unknown: 'Emelkedett propán szint',
      o2_danger: 'O₂ szint: {value} – veszélyesen alacsony oxigénszint', o2_danger_unknown: 'Veszélyesen alacsony oxigénszint',
      o2_warning: 'O₂ szint: {value} – fokozza a szellőzést', o2_warning_unknown: 'Alacsony oxigénszint',
      ventilate_no2: 'NO₂ szint: {value} – szellőztetés szükséges', ventilate_no2_unknown: 'Emelkedett NO₂ szint',
      ventilate_o3: 'O₃ szint: {value} – szellőztetés szükséges', ventilate_o3_unknown: 'Emelkedett O₃ szint'
    },
    radon: {
      advisory_danger: 'Magas Radon szint – Beavatkozás szükséges',
      advisory_warning: 'Radon az EPA intézkedési szint felett',
      advisory_info: 'Radon – Kísérje figyelemmel',
      short_term: 'Rövid távú', long_term: 'Hosszú távú',
      subtitle_single: 'Radon szint: {value}', action_danger: 'forduljon minősített radonmentesítő szakemberhez', action_warning: 'az EPA {threshold} felett beavatkozást javasol', action_info: 'közelít az intézkedési szinthez'
    },
    metric: { humidity: 'Páratartalom', temperature: 'Hőmérséklet', pressure: 'Légnyomás', noise: 'Zaj' },
    editor: {
      co2_entity: 'CO₂ szenzor', pm25_entity: 'PM2.5 szenzor',
      humidity_entity: 'Páratartalom szenzor', temperature_entity: 'Hőmérséklet szenzor',
      radon_entity: 'Radon szenzor', radon_longterm_entity: 'Radon (hosszú távú) szenzor',
      co_entity: 'CO (Szén-monoxid) szenzor', hcho_entity: 'Formaldehid (HCHO) szenzor',
      tvoc_entity: 'tVOC szenzor', pm4_entity: 'PM4 szenzor', nox_entity: 'NOx szenzor',
      pm1_entity: 'PM1 szenzor', pm10_entity: 'PM10 szenzor', pm03_entity: 'PM0.3 szenzor',
      pressure_entity: 'Légnyomás szenzor', noise_entity: 'Zajszenzor (dB)',
      outdoor_co2_entity: 'Kültéri CO₂', outdoor_pm25_entity: 'Kültéri PM2.5',
      outdoor_humidity_entity: 'Kültéri páratartalom', outdoor_temperature_entity: 'Kültéri hőmérséklet',
      outdoor_co_entity: 'Kültéri CO', outdoor_hcho_entity: 'Kültéri HCHO',
      outdoor_tvoc_entity: 'Kültéri tVOC', outdoor_pm1_entity: 'Kültéri PM1',
      outdoor_pm10_entity: 'Kültéri PM10', outdoor_pm03_entity: 'Kültéri PM0.3',
      outdoor_nox_entity: 'Kültéri NOx', outdoor_pressure_entity: 'Kültéri légnyomás',
      air_quality_entity: 'Levegőminőségi index (opcionális)',
      temperature_unit: 'Hőmérséklet mértékegysége', temperature_decimals: 'Hőmérséklet egy tizedesjeggyel', radon_unit: 'Radon mértékegysége',
      tvoc_unit: 'tVOC mérés típusa', nox_unit: 'NOx mérés típusa', language: 'Nyelv',
      recommendation_action: 'Ajánlás akciógomb',
      compact_alerts: 'Figyelmeztető ikonok összecsukott állapotban',
      auto_expand: 'Automatikus kibontás romló levegőminőségnél',
      section_additional: 'További szenzorok', section_outdoor: 'Kültéri szenzorok',
      section_advanced: 'Haladó beállítások',
      show_min_max: 'Min/max megjelenítése mérőszámonként', y_scale: 'Y tengely skálázása', show_status_banner: 'Állapotsáv megjelenítése', order: 'Szenzorok sorrendje', display: 'Megjelenítési mód',
      o2_entity: 'Oxigén (O₂) szenzor', no2_entity: 'Nitrogén-dioxid (NO₂) szenzor', o3_entity: 'Ózon (O₃) szenzor', c3h8_entity: 'Propán (C₃H₈) szenzor',
      outdoor_no2_entity: 'Kültéri NO₂', outdoor_o3_entity: 'Kültéri O₃'
    },
    label: { outdoor: 'Kültéri', out: 'kint', lt: 'HT', loading: 'Betöltés…' }
  },
  pl: {
    status: {
      excellent: 'Bardzo dobry', good: 'Dobry', moderate: 'Umiarkowany', fair: 'Dostateczny',
      poor: 'Zły', very_poor: 'Bardzo zły', extremely_poor: 'Ekstremalnie zły', dangerous: 'Niebezpieczny',
      safe: 'Bezpieczny', low: 'Niski', high: 'Wysoki', elevated: 'Podwyższony', clean: 'Czysty',
      too_dry: 'Zbyt sucho', dry: 'Sucho', comfortable: 'Komfortowo', humid: 'Wilgotno', too_humid: 'Zbyt wilgotno',
      cold: 'Zimno', cool: 'Chłodno', warm: 'Ciepło', hot: 'Gorąco',
      normal: 'W normie', enriched: 'Wzbogacony', slightly_low: 'Nieco niskie', slightly_high: 'Nieco wysokie',
      quiet: 'Cicho', loud: 'Głośno', very_loud: 'Bardzo głośno',
      unavailable: 'Niedostępny'
    },
    recommendation: {
      all_good: 'Wszystko w normie', ventilate_now: 'Wywietrz', run_air_purifier: 'Włącz oczyszczacz',
      consider_air_purifier: 'Rozważ użycie oczyszczacza', open_window: 'Otwórz okno',
      air_purifier_ventilate: 'Oczyszczaj i wywietrz', co_danger: 'Alarm CO — Opuść pomieszczenie!',
      co_warning: 'Ostrzeżenie CO — Wywietrz teraz!', co_elevated: 'Podwyższone stężenie CO — Wywietrz',
      consider_ventilating: 'Rozważ wietrzenie', keep_windows_closed: 'Nie otwieraj okien',
      too_dry: 'Zbyt suche powietrze', too_humid: 'Zbyt wilgotne powietrze', ventilate_formaldehyde: 'Wywietrz — Formaldehyd',
      ventilate_vocs: 'Wywietrz — LZO', reduce_noise: 'Zmniejsz poziom hałasu',
      propane_danger: 'Wyciek gazu — Ewakuuj się!', propane_warning: 'Możliwy wyciek gazu — Wywietrz teraz!',
      o2_danger: 'Niski poziom tlenu — Opuść pomieszczenie!', o2_warning: 'Obniżony poziom tlenu — Wywietrz teraz!',
      ventilate_no2: 'Wywietrz — NO₂', ventilate_o3: 'Wywietrz — O₃'
    },
    subtitle: {
      air_quality_healthy: 'Powietrze w normie',
      co_danger: 'CO {value} — Niebezpieczny poziom CO!', co_danger_unknown: 'Niebezpieczny poziom CO!',
      co_warning: 'CO {value} — Otwórz okna!', co_warning_unknown: 'Wysoki poziom CO — Otwórz okna!',
      co_elevated: 'CO {value} — Popraw wentylację!', co_elevated_unknown: 'Podwyższone stężenie CO',
      purifier_pm25: 'PM2.5 {value} - Przefiltruj powietrze',
      purifier_pm10: 'PM10 {value} - Przefiltruj powietrze',
      purifier_generic: 'Podwyższony poziom pyłów zawieszonych',
      consider_purifier_pm10: 'PM10 {value}',
      open_window_co2: 'CO₂ {value} - Pora otworzyć okna',
      purifier_ventilate: 'CO₂: {co2}, PM2.5: {pm25}',
      ventilate_now_co2: 'CO₂ {value} - Może pogarszać koncentrację',
      ventilate_formaldehyde: 'HCHO {value} - Potrzebna wentylacja',
      ventilate_formaldehyde_unknown: 'Podwyższony poziom formaldehydu',
      ventilate_vocs: 'LZO {value} - Potrzebna wentylacja',
      ventilate_vocs_unknown: 'Podniesiony poziom LZO',
      too_dry: 'Wilgotność {value} - Rozważ nawilżanie',
      too_humid: 'Wilgotność {value} - Wywietrz',
      consider_ventilating_co2: 'CO₂ {value}',
      consider_ventilating_pm25: 'PM2.5 {value}',
      consider_ventilating_generic: 'Nieznacznie podwyższone poziomy',
      keep_closed_outdoor_pm25_poor: 'PM2.5 na zew.: {value} - Nie otwieraj okien',
      keep_closed_outdoor_pm25:'PM2.5 na zew.: {value} — gorzej niż wewnątrz',
      keep_closed_outdoor_co2:'CO₂ na zew.: {value} — gorzej niż wewnątrz',
      keep_closed_generic: 'Niska jakość powietrza na zewnątrz',
      reduce_noise: 'Hałas {value} - długotrwały może szkodzić słuchowi', reduce_noise_unknown: 'Podwyższony poziom hałasu',
      propane_danger: 'Propan {value} — Poziom wybuchowy, natychmiast się ewakuuj!', propane_danger_unknown: 'Niebezpieczny poziom propanu!',
      propane_warning: 'Propan {value} — Możliwy wyciek gazu, wywietrz teraz', propane_warning_unknown: 'Podwyższony poziom propanu',
      o2_danger: 'O₂ {value} — Niebezpiecznie niski poziom tlenu!', o2_danger_unknown: 'Niebezpiecznie niski poziom tlenu!',
      o2_warning: 'O₂ {value} — Popraw wentylację', o2_warning_unknown: 'Obniżony poziom tlenu',
      ventilate_no2: 'NO₂ {value} - Potrzebna wentylacja', ventilate_no2_unknown: 'Podwyższony poziom NO₂',
      ventilate_o3: 'O₃ {value} - Potrzebna wentylacja', ventilate_o3_unknown: 'Podwyższony poziom O₃'
    },
    radon: {
      advisory_danger: 'Zagrożenie Radonem - Wymagane działanie',
      advisory_warning: 'Radon powyżej progu działania EPA',
      advisory_info: 'Radon - monitoruj uważnie',
      short_term: 'Krótkoterminowy', long_term: 'Długoterminowy',
      subtitle_single: 'Radon {value}', action_danger: 'skontaktuj się z certyfikowanym specjalistą ds. radonu', action_warning: 'EPA zaleca działania powyżej {threshold}', action_info: 'zbliża się do progu działania'
    },
    metric: { humidity: 'Wilgotność', temperature: 'Temperatura', pressure: 'Ciśnienie', noise: 'Hałas' },
    editor: {
      co2_entity: 'CO₂', pm25_entity: 'PM2.5',
      humidity_entity: 'Wilgotność', temperature_entity: 'Temperatura',
      radon_entity: 'Chwilowy poziom radonu', radon_longterm_entity: 'Średni poziom radonu',
      co_entity: 'Tlenek węgla (CO)', hcho_entity: 'Formaldehyd (HCHO)',
      tvoc_entity: 'LZO (tVOC)', pm4_entity: 'PM4', nox_entity: 'NOx',
      pm1_entity: 'PM1', pm10_entity: 'PM10', pm03_entity: 'PM0.3',
      pressure_entity: 'Ciśnienie atmosferyczne wew.', noise_entity: 'Czujnik hałasu (dB)',
      outdoor_co2_entity: 'Zew. CO₂', outdoor_pm25_entity: 'Zew. PM2.5',
      outdoor_humidity_entity: 'Zew. wilgotność', outdoor_temperature_entity: 'Zew. temperatura',
      outdoor_co_entity: 'Zew. tlenek węgla (CO)', outdoor_hcho_entity: 'Zew. Formaldehyd (HCHO)',
      outdoor_tvoc_entity: 'Zew. tVOC', outdoor_pm1_entity: 'Zew. PM1',
      outdoor_pm10_entity: 'Zew. PM10', outdoor_pm03_entity: 'Zew. PM0.3',
      outdoor_nox_entity: 'Zew. NOx', outdoor_pressure_entity: 'Ciśnienie atmosferyczne zew.',
      air_quality_entity: 'Indeks jakości powietrza (opcjonalnie)',
      temperature_unit: 'Jednostka temperatury', temperature_decimals: 'Temperatura z jednym miejscem po przecinku', radon_unit: 'Jednostka radonu',
      tvoc_unit: 'Typ pomiaru LZO (tVOC)', nox_unit: 'Typ pomiaru NOx', language: 'Język',
      recommendation_action: 'Akcja zalecanego działania (przycisk)',
      compact_alerts: 'Wyświetlaj ostrzeżenia w trybie zwiniętym',
      auto_expand: 'Automatycznie rozwiń wykresy przy pogorszeniu jakości powietrza',
      section_additional: 'Dodatkowe sensory', section_outdoor: 'Zewnętrzne sensory',
      section_advanced: 'Zawansowane', show_min_max: 'Pokazuj min/max na wykresie',
      order: 'Kolejność sensorów (wybierz w kolejności priorytetu)',
      display: 'Tryb wyświetlania',
      y_scale: 'Skala osi Y', show_status_banner: 'Pokazuj baner statusu',
      o2_entity: 'Tlen (O₂)', no2_entity: 'Dwutlenek azotu (NO₂)', o3_entity: 'Ozon (O₃)', c3h8_entity: 'Propan (C₃H₈)',
      outdoor_no2_entity: 'Zew. NO₂', outdoor_o3_entity: 'Zew. O₃'
    },
    label: { outdoor: 'Na zewnątrz', out: 'zew.', lt: 'DT', loading: 'Ładowanie…' }
  },
};

class AirQualityCard extends HTMLElement {
  // HA's built-in form editor (no editor element, no Lit) — see configForm().
  static getConfigForm() {
    return configForm();
  }

  // Card-picker preview: build the card from the first device that has a
  // CO₂/PM2.5-style sensor, so the preview shows real data instead of the
  // "configure at least one sensor" error a sensor-less stub would throw.
  static getStubConfig(hass) {
    const states = hass?.states || {};
    const ids = Object.keys(states).filter(id => id.startsWith('sensor.')).sort();
    for (const metric of ['co2', 'pm25', 'tvoc', 'co', 'radon', 'humidity', 'temperature']) {
      const id = ids.find(e => DEVICE_CLASS_METRIC[states[e].attributes?.device_class] === metric);
      if (id) {
        const { type, ...config } = configForDevice(hass, id);
        return config;
      }
    }
    // Nothing recognizable: point at a placeholder so the preview still renders.
    return { co2_entity: ids[0] || 'sensor.co2' };
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._rendered = false;
    this._history = { co2: [], pm25: [], pm1: [], pm10: [], pm03: [], pm4: [], hcho: [], tvoc: [], nox: [], co: [], o2: [], no2: [], o3: [], c3h8: [], radon: [], radon_longterm: [], humidity: [], temperature: [], pressure: [], noise: [], outdoor_co2: [], outdoor_pm25: [], outdoor_pm1: [], outdoor_pm10: [], outdoor_pm03: [], outdoor_hcho: [], outdoor_tvoc: [], outdoor_nox: [], outdoor_co: [], outdoor_no2: [], outdoor_o3: [], outdoor_humidity: [], outdoor_temperature: [], outdoor_pressure: [] };
    this._historyLoaded = false;
    this._historyRaw = {}; // entity_id → [{time, value}] from the history/stream subscription
    this._historyUnsub = null; // Promise<unsubscribe fn> while subscribed
    this._graphData = {};
    this._expanded = false; // expandable display mode: collapsed by default
    this._userToggled = false; // a manual expand/collapse overrides auto_expand
    this._lastAbnormalMs = 0; // auto_expand collapse hysteresis anchor
  }

  setConfig(config) {
    if (!config) throw new Error('Invalid configuration');

    const indoorEntityKeys = [
      'co2_entity', 'pm25_entity', 'pm1_entity', 'pm10_entity', 'pm03_entity',
      'pm4_entity', 'hcho_entity', 'tvoc_entity', 'nox_entity', 'co_entity',
      'o2_entity', 'no2_entity', 'o3_entity', 'c3h8_entity',
      'radon_entity', 'radon_longterm_entity', 'humidity_entity', 'temperature_entity',
      'pressure_entity', 'noise_entity'
    ];
    const outdoorEntityKeys = [
      'outdoor_co2_entity', 'outdoor_pm25_entity', 'outdoor_pm1_entity',
      'outdoor_pm10_entity', 'outdoor_pm03_entity', 'outdoor_hcho_entity',
      'outdoor_tvoc_entity', 'outdoor_nox_entity', 'outdoor_co_entity',
      'outdoor_no2_entity', 'outdoor_o3_entity',
      'outdoor_humidity_entity', 'outdoor_temperature_entity', 'outdoor_pressure_entity'
    ];
    const hasIndoor = indoorEntityKeys.some(k => config[k]);
    const hasOutdoor = outdoorEntityKeys.some(k => config[k]);

    if (!hasIndoor && !hasOutdoor) {
      throw new Error('Please configure at least one sensor entity');
    }

    this._rawConfig = config;
    this._config = {
      name: 'Air Quality',
      hours_to_show: 24,
      temperature_unit: 'auto',
      temperature_decimals: false,
      radon_unit: 'auto',
      show_min_max: false,
      y_scale: 'fixed',
      show_status_banner: true,
      display: 'full',
      compact_alerts: true,
      language: 'auto',
      ...config
    };

    // Outdoor-only mode: when no indoor entities are set, promote each outdoor
    // entity into its primary slot so the existing render pipeline shows it.
    // Recommendations are suppressed in this mode since they assume indoor context.
    this._outdoorOnly = !hasIndoor;
    if (this._outdoorOnly) {
      const promotionMap = {
        outdoor_co2_entity: 'co2_entity',
        outdoor_pm25_entity: 'pm25_entity',
        outdoor_pm1_entity: 'pm1_entity',
        outdoor_pm10_entity: 'pm10_entity',
        outdoor_pm03_entity: 'pm03_entity',
        outdoor_hcho_entity: 'hcho_entity',
        outdoor_tvoc_entity: 'tvoc_entity',
        outdoor_nox_entity: 'nox_entity',
        outdoor_co_entity: 'co_entity',
        outdoor_no2_entity: 'no2_entity',
        outdoor_o3_entity: 'o3_entity',
        outdoor_humidity_entity: 'humidity_entity',
        outdoor_temperature_entity: 'temperature_entity',
        outdoor_pressure_entity: 'pressure_entity'
      };
      for (const [outdoorKey, primaryKey] of Object.entries(promotionMap)) {
        if (this._config[outdoorKey] && !this._config[primaryKey]) {
          this._config[primaryKey] = this._config[outdoorKey];
          delete this._config[outdoorKey];
        }
      }
    }

    this._unsubscribeHistory();
    this._rendered = false;
    this._historyLoaded = false;
  }

  // Sections-view sizing (HA 2024.11+). 12 columns = full section width;
  // rows are left to the card's own height since it varies with sensor count.
  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  // HA detaches cards that are hidden by visibility conditions and rebuilds
  // them in the editor preview, so the live history subscription and the
  // redraw timer follow the element's connection rather than its lifetime.
  connectedCallback() {
    if (this._rendered && this._hass && !this._isCompact()) this._loadHistory();
  }

  disconnectedCallback() {
    this._unsubscribeHistory();
  }

  _getMinMax(data) {
    if (!data || !data.length) return null;
    let min = data[0].value;
    let max = data[0].value;
    for (let i = 1; i < data.length; i++) {
      if (data[i].value < min) min = data[i].value;
      if (data[i].value > max) max = data[i].value;
    }
    return { min, max };
  }

  // Graph values (min/max markers, tooltip) use the same precision and
  // number format as the metric's readout.
  _formatGraphValue(value, metric) {
    return this._formatNumber(value, this._metricDecimals(metric, this._graphEntity(metric)));
  }

  // Anchor min/max value labels to the actual data points on the line.
  // The position percentages are computed against the SVG's 300×50 viewBox;
  // because preserveAspectRatio="none" stretches the SVG to fill the wrapper,
  // the same percentage maps cleanly to the wrapper's dimensions.
  _updateMinMaxDisplay(graphId, data, colorFn) {
    const minMax = this._getMinMax(data);
    if (!minMax || minMax.min === minMax.max) {
      this._clearMinMaxMarkers(graphId);
      return;
    }
    let minIdx = 0, maxIdx = 0;
    for (let i = 1; i < data.length; i++) {
      if (data[i].value < data[minIdx].value) minIdx = i;
      if (data[i].value > data[maxIdx].value) maxIdx = i;
    }
    const points = this._graphData[graphId] && this._graphData[graphId].points;
    if (!points || !points.length) return;
    const wrapper = this.shadowRoot.getElementById(`${graphId}-graph`);
    if (!wrapper) return;

    this._renderMinMaxMarker(graphId, 'max', points[maxIdx], colorFn(minMax.max), this._formatGraphValue(minMax.max, graphId));
    this._renderMinMaxMarker(graphId, 'min', points[minIdx], colorFn(minMax.min), this._formatGraphValue(minMax.min, graphId));
  }

  _renderMinMaxMarker(graphId, kind, point, color, valueStr) {
    if (!point) return;
    const wrapper = this.shadowRoot.getElementById(`${graphId}-graph`);
    if (!wrapper) return;
    const id = `${graphId}-minmax-${kind}`;
    let marker = this.shadowRoot.getElementById(id);
    if (!marker) {
      marker = document.createElement('div');
      marker.id = id;
      marker.className = `minmax-marker minmax-marker--${kind}`;
      wrapper.appendChild(marker);
    }
    // Y position: point.y is in the 0..50 SVG coordinate system; convert to %
    const leftPct = (point.x / 300) * 100;
    const topPct = (point.y / 50) * 100;
    // Flip the label across the chart vertical midline so it can't get
    // clipped by the chart's top/bottom edge: anchor the label on the
    // opposite side of the data point from where it sits.
    const placeBelow = point.y < 25;
    // Same idea for horizontal: when very close to an edge, anchor the
    // label to that edge instead of centering on the point.
    let anchor = 'center';
    if (leftPct < 12) anchor = 'left';
    else if (leftPct > 88) anchor = 'right';
    marker.style.left = `${leftPct}%`;
    marker.style.top = `${topPct}%`;
    marker.style.color = color;
    marker.dataset.place = placeBelow ? 'below' : 'above';
    marker.dataset.anchor = anchor;
    marker.textContent = valueStr;
  }

  _clearMinMaxMarkers(graphId) {
    ['min', 'max'].forEach(kind => {
      const el = this.shadowRoot.getElementById(`${graphId}-minmax-${kind}`);
      if (el) el.remove();
    });
  }

  // True when the card should render its compact summary. Static `compact`
  // always is; `expandable` is compact until the user taps to expand (#36).
  _isCompact() {
    if (this._config.display === 'compact') return true;
    if (this._config.display === 'expandable') return !this._expanded;
    return false;
  }

  _isExpandable() {
    return this._config.display === 'expandable';
  }

  // Flip between the compact summary and the full card, re-rendering in place.
  // History is fetched lazily the first time the user expands.
  _toggleExpanded() {
    this._userToggled = true;
    this._expanded = !this._expanded;
    this._initialRender();
    this._updateStates();
    if (this._expanded && !this._historyLoaded) {
      this._loadHistory();
    } else if (this._expanded && this._historyLoaded) {
      this._renderGraphs();
    }
  }

  // Auto-expand (#40, opt-in via `auto_expand: true`): until the user
  // manually toggles the card, keep an expandable card's state in sync with
  // air quality — expanded while any sensor reads out of range, collapsed
  // again once everything returns to normal. Called from the hass setter, so
  // _updateStates runs right after and populates whichever view this picked.
  _maybeAutoExpand() {
    if (!this._isExpandable() || !this._config.auto_expand || this._userToggled) return;
    const abnormal = this._getAbnormalMetrics().length > 0;
    if (abnormal) this._lastAbnormalMs = Date.now();
    // Hysteresis: expand immediately, but only collapse after readings have
    // stayed clean for 5 minutes — a sensor hovering at a tier boundary must
    // not rebuild the card on every state update.
    const desired = abnormal ||
      (this._expanded && this._lastAbnormalMs > 0 && (Date.now() - this._lastAbnormalMs) < 300000);
    if (desired === this._expanded) return;
    this._expanded = desired;
    this._initialRender();
    this._updateStates();
    if (this._expanded && !this._historyLoaded) {
      this._loadHistory();
    } else if (this._expanded && this._historyLoaded) {
      this._renderGraphs();
    }
  }

  // Resolve the active translation language. Order of precedence:
  //   1. Explicit `language` config (when not 'auto')
  //   2. hass.locale.language (modern HA, since the deprecation of hass.language)
  //   3. hass.language (older HA versions, deprecated but still present)
  //   4. 'en'
  // Falls back to 'en' if the resolved code isn't shipped.
  _resolveLanguage() {
    const explicit = this._config.language;
    let lang;
    if (explicit && explicit !== 'auto') {
      lang = explicit;
    } else {
      lang = this._hass?.locale?.language || this._hass?.language || 'en';
    }
    const code = String(lang).split('-')[0].toLowerCase();
    return TRANSLATIONS[code] ? code : 'en';
  }

  // Locale for date/time formatting (#55). Unlike _resolveLanguage this
  // returns the full BCP 47 tag (e.g. 'pt-BR') and doesn't require a shipped
  // translation pack — Intl knows far more locales than TRANSLATIONS does.
  // An explicit `language` config wins so a forced card language also gets
  // matching date formats; `undefined` lets the browser decide.
  _dateLocale() {
    const explicit = this._config.language;
    if (explicit && explicit !== 'auto') return explicit;
    return this._hass?.locale?.language || this._hass?.language || undefined;
  }

  // The profile's clock format is independent of its language (#60).
  _timeHourCycle() {
    const format = this._hass?.locale?.time_format;
    if (format === '12') return 'h12';
    if (format === '24') return 'h23';
    if (format === 'system') {
      return new Intl.DateTimeFormat(undefined, { hour: 'numeric' })
        .resolvedOptions().hour12 ? 'h12' : 'h23';
    }
    // 'language' and older HA versions keep the date locale's default.
    return undefined;
  }

  // The profile's time zone setting: 'server' shows times in the HA server's
  // zone, 'local' (the default) in the browser's — same as HA's own
  // resolveTimeZone. `undefined` lets Intl use the browser zone.
  _timeZone() {
    if (this._hass?.locale?.time_zone === 'server' && this._hass?.config?.time_zone) {
      return this._hass.config.time_zone;
    }
    return undefined;
  }

  // Graph time labels adapt to the configured window (#53): plain times up
  // to a day, weekday + hour across a few days, calendar dates beyond that.
  _formatAxisTime(d) {
    const hours = Number(this._config.hours_to_show) || 24;
    const loc = this._dateLocale();
    const hourCycle = this._timeHourCycle();
    const timeZone = this._timeZone();
    if (hours <= 24) return d.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit', hourCycle, timeZone });
    if (hours <= 96) return d.toLocaleString(loc, { weekday: 'short', hour: 'numeric', hourCycle, timeZone });
    return d.toLocaleDateString(loc, { month: 'short', day: 'numeric', timeZone });
  }

  // Hover tooltip time: include the day once the window spans more than one.
  _formatTooltipTime(d) {
    const hours = Number(this._config.hours_to_show) || 24;
    const loc = this._dateLocale();
    const hourCycle = this._timeHourCycle();
    const timeZone = this._timeZone();
    if (hours <= 24) return d.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit', hourCycle, timeZone });
    return d.toLocaleString(loc, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hourCycle, timeZone });
  }

  // Number formatting follows the profile's "Number format" setting the same
  // way HA's formatNumber does (decimal comma, grouping, …), so 21.4 reads
  // "21,4" for a German user just like the rest of their dashboard.
  _formatNumber(value, decimals) {
    const format = this._hass?.locale?.number_format;
    const locales = {
      comma_decimal: ['en-US', 'en'], decimal_comma: ['de', 'es', 'it'],
      space_comma: ['fr', 'sv', 'cs'], quote_decimal: ['de-CH'], none: 'en-US', system: undefined
    };
    const locale = format in locales ? locales[format] : this._dateLocale();
    const key = `${locale}|${format}|${decimals}`;
    this._numberFormats = this._numberFormats || {};
    let fmt = this._numberFormats[key];
    if (!fmt) {
      try {
        fmt = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: format !== 'none' });
      } catch (e) {
        fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      }
      this._numberFormats[key] = fmt;
    }
    return fmt.format(value);
  }

  // Look up a translated string: _t('status', 'good') → 'Bueno' (es).
  // Falls back to English, then to the literal key if neither is found.
  _t(group, key) {
    const lang = this._resolveLanguage();
    const langPack = TRANSLATIONS[lang] && TRANSLATIONS[lang][group];
    if (langPack && langPack[key] !== undefined) return langPack[key];
    const enPack = TRANSLATIONS.en[group];
    if (enPack && enPack[key] !== undefined) return enPack[key];
    return key;
  }

  // Translate with {placeholder} interpolation: _ts('subtitle', 'co_danger', { value: 42 })
  _ts(group, key, vars) {
    let str = this._t(group, key);
    if (vars) {
      for (const k of Object.keys(vars)) {
        str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
      }
    }
    return str;
  }

  set hass(hass) {
    const old = this._hass;
    this._hass = hass;
    editorLanguage = this._resolveLanguage();
    if (!this._rendered) {
      this._initialRender();
      this._rendered = true;
      // Compact mode doesn't draw graphs, so skip the history subscription.
      // A card HA hasn't attached yet (e.g. hidden by a visibility condition)
      // subscribes from connectedCallback instead, so nothing leaks.
      if (!this._isCompact() && this.isConnected !== false) this._loadHistory();
    } else if (old && old.locale !== hass.locale) {
      // Labels and number/time formats are baked into the markup — rebuild.
      this._numberFormats = null;
      this._initialRender();
      if (this._historyLoaded) this._renderGraphs();
    } else if (old && !this._watchedEntityChanged(old, hass)) {
      // HA pushes a new hass object for every state change in the whole
      // system; skip the DOM work unless one of our sensors changed.
      return;
    }
    this._maybeAutoExpand();
    this._updateStates();
  }

  // Every entity this card reads, for change detection and history.
  _watchedEntities() {
    return Object.keys(this._config)
      .filter(k => k.endsWith('_entity') && typeof this._config[k] === 'string' && this._config[k])
      .map(k => this._config[k]);
  }

  _watchedEntityChanged(oldHass, hass) {
    if (oldHass.states === hass.states) return false;
    return this._watchedEntities().some(id => oldHass.states?.[id] !== hass.states?.[id]);
  }

  // Resolve the metric display order. User's `order` wins; anything they
  // didn't list is appended in the default order so users never lose a
  // configured metric by forgetting to mention it.
  _getMetricOrder() {
    const all = ['co', 'c3h8', 'o2', 'radon', 'co2', 'pm25', 'pm10', 'pm1', 'pm03', 'pm4', 'hcho', 'tvoc', 'nox', 'no2', 'o3', 'noise', 'humidity', 'temperature', 'pressure'];
    if (!Array.isArray(this._config.order) || !this._config.order.length) return all;
    const valid = this._config.order.filter(m => all.includes(m));
    const remaining = all.filter(m => !valid.includes(m));
    return [...valid, ...remaining];
  }

  // Reorder graph cards via flexbox `order` rather than rebuilding the DOM —
  // .graphs is already display:flex, so setting style.order on each container
  // is enough to reflow them visually.
  _applyMetricOrder() {
    if (!Array.isArray(this._config.order) || !this._config.order.length) return;
    this._getMetricOrder().forEach((metric, idx) => {
      const container = this.shadowRoot.getElementById(`${metric}-graph-container`);
      if (container) container.style.order = idx;
    });
  }

  getCardSize() {
    if (this._isCompact()) return 1;
    let size = 3; // Base size for header and recommendation
    if (this._config.co_entity) size += 1;
    if (this._config.radon_entity) size += 1;
    if (this._config.co2_entity) size += 1;
    if (this._config.pm25_entity) size += 1;
    if (this._config.pm10_entity) size += 1;
    if (this._config.pm1_entity) size += 1;
    if (this._config.pm03_entity) size += 1;
    if (this._config.hcho_entity) size += 1;
    if (this._config.tvoc_entity) size += 1;
    if (this._config.pm4_entity) size += 1;
    if (this._config.nox_entity) size += 1;
    if (this._config.o2_entity) size += 1;
    if (this._config.no2_entity) size += 1;
    if (this._config.o3_entity) size += 1;
    if (this._config.c3h8_entity) size += 1;
    if (this._config.pressure_entity) size += 1;
    if (this._config.noise_entity) size += 1;
    if (this._config.humidity_entity) size += 1;
    if (this._config.temperature_entity) size += 1;
    return size;
  }

  // Dispatch HA's standard action event for tap/hold/double_tap. HA's action
  // handler reads tap_action/hold_action/double_tap_action from the config.
  // Pattern documented at developers.home-assistant.io/blog/2023/07/07.
  // An action the user actually configured — the editor's "Nothing" choice
  // stores {action: 'none'}, which must not make the card look clickable.
  _hasAction(key) {
    const action = this._config[key];
    return !!action && action.action !== 'none';
  }

  _fireAction(action) {
    const actionKey = `${action}_action`;
    if (!this._hasAction(actionKey)) return;
    const event = new CustomEvent('hass-action', {
      bubbles: true,
      composed: true,
      detail: { config: this._config, action }
    });
    this.dispatchEvent(event);
  }

  // Graph series key → entity id. Outdoor mirrors share the indoor metric's
  // series key with an `outdoor_` prefix; radon keeps its two sensors apart.
  _historySeries() {
    const series = {};
    for (const key of Object.keys(this._history)) {
      const entityId = this._config[`${key}_entity`];
      if (entityId) series[key] = entityId;
    }
    return series;
  }

  // Live history, the way HA's own history-graph card does it: one
  // `history/stream` subscription for every graphed entity. HA sends the
  // window's history first, then each new state as it's recorded, so the
  // graphs stay current on an always-on dashboard. The subscription follows
  // the element's connection (see connected/disconnectedCallback).
  _loadHistory() {
    if (this._historyUnsub || !this._hass?.connection?.subscribeMessage) return;
    const entityIds = [...new Set(Object.values(this._historySeries()))];
    if (!entityIds.length) return;
    const hours = Number(this._config.hours_to_show) || 24;
    const start = new Date(Date.now() - hours * 3600000);
    // A token guards against a stale subscription delivering into a card
    // whose config changed while the request was in flight.
    const token = {};
    this._historyToken = token;
    this._historyRaw = {};
    this._timeWindow = { start: start.getTime(), end: Date.now() };
    const connection = this._hass.connection;
    this._historyUnsub = connection.subscribeMessage(
      (message) => { if (this._historyToken === token) this._onHistoryMessage(message); },
      {
        type: 'history/stream',
        entity_ids: entityIds,
        start_time: start.toISOString(),
        minimal_response: true,
        significant_changes_only: true,
        no_attributes: true
      },
      { resubscribe: false }
    );
    this._historyUnsub.catch((e) => {
      console.warn('Air Quality Card: history subscription failed:', e);
      if (this._historyToken === token) this._unsubscribeHistory();
    });
    // After a websocket reconnect (also every time HA resumes a backgrounded
    // tab), start over with a fresh window rather than replaying the original
    // start_time — HA's own history-graph does the same. Registered once per
    // connection, not per subscription.
    if (this._historyConnection !== connection) {
      this._historyConnection?.removeEventListener?.('ready', this._onReconnect);
      connection.addEventListener?.('ready', this._onReconnect);
      this._historyConnection = connection;
    }
    // Slide the window forward even when no sensor reports a new value.
    this._redrawTimer = setInterval(() => this._onRedrawTick(), 60000);
  }

  // The old subscription died with the old socket. Its unsubscribe function
  // must not be called: the library reuses message ids on the new connection,
  // so it would cancel some other subscription. Drop it and resubscribe.
  _onReconnect = () => {
    this._historyUnsub = null;
    this._historyToken = null;
    clearInterval(this._redrawTimer);
    this._redrawTimer = null;
    this._loadHistory();
  };

  _unsubscribeHistory() {
    this._historyToken = null;
    this._historyLoaded = false; // the data stops being live; resubscribe on next show
    if (this._historyUnsub) {
      this._historyUnsub.then(unsub => unsub()).catch(() => {});
      this._historyUnsub = null;
    }
    if (this._historyConnection && this._onReconnect) {
      this._historyConnection.removeEventListener?.('ready', this._onReconnect);
      this._historyConnection = null;
    }
    clearInterval(this._redrawTimer);
    this._redrawTimer = null;
    clearTimeout(this._renderGraphsTimer);
    this._renderGraphsTimer = null;
  }

  // history/stream messages: {states: {entity_id: [{s, lu, lc?}]}}. The
  // first carries the whole window; later ones only new rows. Times are
  // epoch seconds. Non-numeric states (unavailable/unknown) are skipped so
  // an outage doesn't plot as a drop to zero.
  _onHistoryMessage(message) {
    for (const [entityId, rows] of Object.entries(message?.states || {})) {
      const list = this._historyRaw[entityId] || (this._historyRaw[entityId] = []);
      let sorted = true;
      for (const row of rows) {
        const value = parseFloat(row.s);
        if (!Number.isFinite(value)) continue;
        const time = (row.lu ?? row.lc) * 1000;
        if (list.length && time < list[list.length - 1].time) sorted = false;
        list.push({ time, value });
      }
      if (!sorted) list.sort((x, y) => x.time - y.time);
    }
    this._historyLoaded = true;
    this._scheduleRenderGraphs();
  }

  _onRedrawTick() {
    this._maybeAutoExpand();
    if (this._historyLoaded) this._renderGraphs();
  }

  // Coalesce bursts of stream messages (many sensors updating together).
  _scheduleRenderGraphs() {
    if (this._renderGraphsTimer) return;
    this._renderGraphsTimer = setTimeout(() => {
      this._renderGraphsTimer = null;
      this._renderGraphs();
    }, 250);
  }

  // Rebuild the per-metric series for the current window: drop rows that
  // slid out (keeping the last one, which still sets the line's left edge),
  // convert units, and carry the latest reading to "now".
  _buildHistory() {
    const hours = Number(this._config.hours_to_show) || 24;
    const now = Date.now();
    const start = now - hours * 3600000;
    this._timeWindow = { start, end: now };
    for (const list of Object.values(this._historyRaw)) {
      let firstInWindow = list.findIndex(p => p.time > start);
      if (firstInWindow === -1) firstInWindow = list.length;
      if (firstInWindow > 1) list.splice(0, firstInWindow - 1);
    }
    const series = this._historySeries();
    for (const key of Object.keys(this._history)) {
      const entityId = series[key];
      const raw = entityId ? this._historyRaw[entityId] || [] : [];
      const factor = this._unitFactor(key.replace(/^outdoor_/, ''), entityId);
      const converted = factor === 1 ? raw : raw.map(p => ({ time: p.time, value: p.value * factor }));
      this._history[key] = this._extendToNow(converted, entityId, now, factor);
    }
  }

  // Append the entity's current value as a final point at `nowMs` so the line
  // reaches the right edge even when a steady sensor hasn't reported for a
  // while (HA's own history-graph extends the last state to "now" too).
  // Skips when there's no data, no current numeric reading, or the last point
  // is already essentially at `now` (avoids a zero-length duplicate segment).
  _extendToNow(processed, entityId, nowMs, factor = 1) {
    if (!entityId || !processed.length) return processed;
    const value = this._getNumericState(entityId);
    if (value === null) return processed;
    const last = processed[processed.length - 1];
    if (nowMs - last.time < 1000) return processed; // already at the edge
    return [...processed, { time: nowMs, value: value * factor }];
  }

  _getState(entityId) {
    if (!entityId) return 'unknown';
    return this._hass?.states[entityId]?.state ?? 'unknown';
  }

  // Numeric reading, or null when the entity is missing, unavailable, unknown
  // or otherwise non-numeric. Never 0: a dead sensor must not read as a clean
  // (or, for O₂, a lethal) value.
  _getNumericState(entityId) {
    const value = parseFloat(this._getState(entityId));
    return Number.isFinite(value) ? value : null;
  }

  // Reading of the entity configured under `entityKey` (default
  // `<metric>_entity`), converted into the unit the metric's thresholds use.
  _metricValue(metric, entityKey = `${metric}_entity`) {
    const entityId = this._config[entityKey];
    if (!entityId) return null;
    const value = this._getNumericState(entityId);
    return value === null ? null : value * this._unitFactor(metric, entityId);
  }

  // Multiplier from the entity's unit into the metric's threshold unit — 1
  // when there's nothing to convert, the unit is unrecognized, or the user
  // supplied their own thresholds (those are in the sensor's unit; see
  // UNIT_CONVERSIONS).
  _unitFactor(metric, entityId) {
    const conv = UNIT_CONVERSIONS[metric];
    if (!conv || !entityId || this._thresholdOverride(metric)) return 1;
    const unit = normalizeUnit(this._hass?.states[entityId]?.attributes?.unit_of_measurement);
    return conv.from[unit] ?? 1;
  }

  // Unit shown next to a converted gas reading: the threshold unit normally,
  // the sensor's own unit when the user's thresholds are in it.
  _gasUnit(metric) {
    const conv = UNIT_CONVERSIONS[metric];
    if (this._thresholdOverride(metric)) {
      const unit = this._hass?.states[this._config[`${metric}_entity`]]?.attributes?.unit_of_measurement;
      if (unit) return normalizeUnit(unit);
    }
    return conv.unit;
  }

  // Generic ascending-tier lookup. `thresholds` is 4 ascending boundaries;
  // `tiers` is the 5-element output array (colors, labels, …).
  _tieredValue(value, thresholds, tiers) {
    for (let i = 0; i < thresholds.length; i++) {
      if (value < thresholds[i]) return tiers[i];
    }
    return tiers[tiers.length - 1];
  }

  // Plot points by timestamp within the configured time window so spikes
  // appear at the correct X position even when data is unevenly sampled.
  _computeGraphX(timestamp, width, padding) {
    if (!this._timeWindow) return padding;
    const { start, end } = this._timeWindow;
    const span = end - start;
    if (span <= 0) return padding;
    const ratio = (timestamp - start) / span;
    const clamped = Math.max(0, Math.min(1, ratio));
    return padding + clamped * (width - 2 * padding);
  }

  // The user's `<x>_thresholds` for a METRIC_DEFS key (e.g. 'co2' →
  // `co2_thresholds`, 'temp_c' → `temperature_thresholds`) when it's a valid
  // list of 4 numbers, else null. _metricThresholds falls back to defaults.
  _thresholdOverride(metric) {
    const overrideKey = {
      co: 'co_thresholds', co2: 'co2_thresholds', pm25: 'pm25_thresholds',
      pm10: 'pm10_thresholds', pm1: 'pm1_thresholds', pm03: 'pm03_thresholds',
      pm4: 'pm4_thresholds', hcho: 'hcho_thresholds', pressure: 'pressure_thresholds', noise: 'noise_thresholds',
      nox_ppb: 'nox_thresholds', nox_index: 'nox_thresholds',
      o2: 'o2_thresholds', no2: 'no2_thresholds', o3: 'o3_thresholds', c3h8: 'c3h8_thresholds',
      radon: 'radon_thresholds', humidity: 'humidity_thresholds',
      tvoc_ppb: 'tvoc_thresholds', tvoc_index: 'tvoc_thresholds',
      temp_c: 'temperature_thresholds', temp_f: 'temperature_thresholds'
    }[metric];
    const override = overrideKey && this._config[overrideKey];
    if (Array.isArray(override) && override.length === 4 && override.every(n => typeof n === 'number')) {
      return override;
    }
    return null;
  }

  _metricThresholds(metric) {
    return this._thresholdOverride(metric) || METRIC_DEFS[metric].defaultThresholds;
  }

  // Backward-compat proxies for the bug-fix branch's named status helpers.
  // The canonical entry point is _getMetricStatus; these exist so existing
  // tests (and any third-party code) keep working unchanged.
  _getCO2Status(value)      { return this._getMetricStatus('co2', value); }
  _getHumidityStatus(value) { return this._getMetricStatus('humidity', value); }
  _getTempStatus(value)     { return this._getMetricStatus(this._tempMetric(), value); }

  _getMetricColor(metric, value) {
    return this._tieredValue(value, this._metricThresholds(metric), METRIC_DEFS[metric].colors);
  }

  _getMetricStatus(metric, value) {
    const key = this._tieredValue(value, this._metricThresholds(metric), METRIC_DEFS[metric].labelKeys);
    return this._t('status', key);
  }

  _getCO2Color(value)  { return this._getMetricColor('co2', value); }
  _getPM25Color(value) { return this._getMetricColor('pm25', value); }
  _getHCHOColor(value) { return this._getMetricColor('hcho', value); }
  _getPM4Color(value)  { return this._getMetricColor('pm4', value); }
  _getNOxColor(value)  { return this._getMetricColor(this._noxMetric(), value); }
  _getPressureColor(value) { return this._getMetricColor('pressure', value); }
  _getNoiseColor(value)  { return this._getMetricColor('noise', value); }
  _getHumidityColor(value) { return this._getMetricColor('humidity', value); }
  _getPM1Color(value)  { return this._getMetricColor('pm1', value); }
  _getPM10Color(value) { return this._getMetricColor('pm10', value); }
  _getPM03Color(value) { return this._getMetricColor('pm03', value); }
  _getCOColor(value)   { return this._getMetricColor('co', value); }
  _getRadonColor(bq)   { return this._getMetricColor('radon', bq); }
  _getO2Color(value)   { return this._getMetricColor('o2', value); }
  _getNO2Color(value)  { return this._getMetricColor('no2', value); }
  _getO3Color(value)   { return this._getMetricColor('o3', value); }
  _getC3H8Color(value) { return this._getMetricColor('c3h8', value); }

  _isVOCIndex() {
    if (this._config.tvoc_unit && String(this._config.tvoc_unit).toLowerCase() !== 'auto') {
      return String(this._config.tvoc_unit).toLowerCase() === 'index';
    }
    // Auto-detect from the entity's unit_of_measurement: Sensirion VOC Index
    // sensors report no unit at all.
    if (this._hass && this._config.tvoc_entity) {
      const uom = this._hass.states[this._config.tvoc_entity]?.attributes?.unit_of_measurement;
      if (uom === undefined || uom === null || uom === '' || String(uom).toLowerCase() === 'voc index') return true;
    }
    return false;
  }

  // Absolute tVOC: show the sensor's real unit. The default tvoc_thresholds
  // are ppb; µg/m³ or mg/m³ sensors should override them (there's no single
  // ppb↔mass factor for a VOC mixture).
  _getTVOCUnit() {
    if (this._isVOCIndex()) return '';
    const uom = this._hass?.states[this._config.tvoc_entity]?.attributes?.unit_of_measurement;
    return uom ? normalizeUnit(uom) : 'ppb';
  }

  _tvocMetric() {
    return this._isVOCIndex() ? 'tvoc_index' : 'tvoc_ppb';
  }

  _getTVOCColor(value) {
    return this._getMetricColor(this._tvocMetric(), value);
  }

  // NOx mirrors the tVOC index/absolute split. Sensirion SGP41-based sensors
  // (AirGradient et al.) report a unitless NOx Index; HA exposes those with
  // no unit_of_measurement, so a missing/empty unit means index.
  _isNOxIndex() {
    if (this._config.nox_unit && String(this._config.nox_unit).toLowerCase() !== 'auto') {
      return String(this._config.nox_unit).toLowerCase() === 'index';
    }
    if (this._hass && this._config.nox_entity) {
      const uom = this._hass.states[this._config.nox_entity]?.attributes?.unit_of_measurement;
      if (uom === undefined || uom === null || uom === '' || String(uom).toLowerCase() === 'nox index') return true;
    }
    return false;
  }

  _getNOxUnit() {
    if (this._isNOxIndex()) return '';
    // Show whatever the sensor actually reports (e.g. µg/m³). Note the
    // default nox_thresholds assume ppb — µg/m³ users should override them.
    const uom = this._hass?.states[this._config.nox_entity]?.attributes?.unit_of_measurement;
    return uom ? normalizeUnit(uom) : 'ppb';
  }

  _noxMetric() {
    return this._isNOxIndex() ? 'nox_index' : 'nox_ppb';
  }

  // Radon display unit. Thresholds are always Bq/m³; pCi/L readings are
  // converted for comparison. Auto-detect reads whichever radon sensor is
  // configured — a long-term-only setup must not be mistaken for Bq/m³.
  _getRadonUnit() {
    const unit = normalizeUnit(this._config.radon_unit);
    if (unit.toLowerCase() === 'pci/l') return 'pCi/L';
    if (unit === 'Bq/m³') return 'Bq/m³';
    const entityId = this._config.radon_entity || this._config.radon_longterm_entity;
    const entityUnit = this._hass?.states[entityId]?.attributes?.unit_of_measurement;
    if (entityUnit && String(entityUnit).toLowerCase().includes('pci')) return 'pCi/L';
    return 'Bq/m³';
  }

  _isRadonPciL() {
    return this._getRadonUnit() === 'pCi/L';
  }

  _getRadonBqm3(value) {
    if (this._isRadonPciL()) return value * 37;
    return value;
  }

  _formatRadon(value) {
    const unit = this._getRadonUnit();
    return `${this._formatNumber(value, unit === 'pCi/L' ? 1 : 0)} ${unit}`;
  }

  // Short- and long-term radon readings in the display unit (null when
  // unconfigured or unavailable) plus the higher of the two in Bq/m³.
  _radonReadings() {
    const short = this._config.radon_entity ? this._getNumericState(this._config.radon_entity) : null;
    const long = this._config.radon_longterm_entity ? this._getNumericState(this._config.radon_longterm_entity) : null;
    const shortBq = short === null ? null : this._getRadonBqm3(short);
    const longBq = long === null ? null : this._getRadonBqm3(long);
    const bq = shortBq === null && longBq === null ? null : Math.max(shortBq ?? -Infinity, longBq ?? -Infinity);
    return { short, long, bq };
  }

  _getRadonAdvisory() {
    if (!this._config.radon_entity && !this._config.radon_longterm_entity) return null;
    const { short, long, bq } = this._radonReadings();
    if (bq === null) return null;
    const t = this._metricThresholds('radon');
    const raw = long === null || (short !== null && this._getRadonBqm3(short) >= this._getRadonBqm3(long)) ? short : long;
    const valuesStr = short !== null && long !== null
      ? `${this._t('radon', 'short_term')}: ${this._formatRadon(short)}, ${this._t('radon', 'long_term')}: ${this._formatRadon(long)}`
      : this._ts('radon', 'subtitle_single', { value: this._formatRadon(raw) });
    const actionLevel = this._formatRadon(this._isRadonPciL() ? t[2] / 37 : t[2]);

    if (bq >= t[3]) return {
      level: 'danger',
      text: this._t('radon', 'advisory_danger'),
      subtitle: `${valuesStr} - ${this._t('radon', 'action_danger')}`
    };
    if (bq >= t[2]) return {
      level: 'warning',
      text: this._t('radon', 'advisory_warning'),
      subtitle: `${valuesStr} - ${this._ts('radon', 'action_warning', { threshold: actionLevel })}`
    };
    if (bq >= t[1]) return {
      level: 'info',
      text: this._t('radon', 'advisory_info'),
      subtitle: `${valuesStr} - ${this._t('radon', 'action_info')}`
    };
    return null;
  }

  // Temperature unit: explicit `temperature_unit` first, then the sensor's
  // own unit_of_measurement (an entity can be set to °F in a metric install),
  // then the HA unit system.
  _isCelsius() {
    const unit = this._config.temperature_unit;
    if (unit === 'C') return true;
    if (unit === 'F') return false;
    const entityId = this._config.temperature_entity || this._config.outdoor_temperature_entity;
    const uom = this._hass?.states[entityId]?.attributes?.unit_of_measurement;
    if (uom === '°C' || uom === '°F') return uom === '°C';
    return this._hass?.config?.unit_system?.temperature === '°C';
  }

  _getTempUnit() {
    return this._isCelsius() ? '°C' : '°F';
  }

  _tempMetric() {
    return this._isCelsius() ? 'temp_c' : 'temp_f';
  }

  _getTempColor(value) {
    return this._getMetricColor(this._tempMetric(), value);
  }

  // Temperature display: whole number by default, one decimal when
  // `temperature_decimals` is enabled.
  _formatTemp(value) {
    return this._formatNumber(value, this._config.temperature_decimals ? 1 : 0);
  }

  // METRIC_DEFS key for a display metric (tVOC/NOx/temperature pick a table
  // by sensor mode/unit).
  _defKey(metric) {
    if (metric === 'tvoc') return this._tvocMetric();
    if (metric === 'nox') return this._noxMetric();
    if (metric === 'temperature') return this._tempMetric();
    return metric;
  }

  // Current reading of a display metric in its threshold unit, with its tier
  // color and status label; null when unconfigured or unavailable. Radon is
  // the worse of its short- and long-term sensors, in Bq/m³.
  _metricReading(metric) {
    let value;
    if (metric === 'radon') value = this._radonReadings().bq;
    else value = this._metricValue(metric);
    if (value === null) return null;
    const defKey = this._defKey(metric);
    return { metric, value, color: this._getMetricColor(defKey, value), status: this._getMetricStatus(defKey, value) };
  }

  _getOverallStatus() {
    const T = (m) => this._metricThresholds(m);
    const co = this._metricValue('co');
    const c3h8 = this._metricValue('c3h8');
    // O2's "unconfigured/unavailable" value is null, never 0 — 0% O2 is the
    // worst possible reading.
    const o2 = this._metricValue('o2');
    const dangerous = { status: this._t('status', 'dangerous'), color: '#d32f2f' };
    const poor = { status: this._t('status', 'poor'), color: '#f44336' };

    // Life-safety first, and above everything else — including a configured
    // air_quality_entity, which knows nothing about a CO or gas leak.
    if (co !== null && co >= T('co')[2]) return dangerous;
    if (c3h8 !== null && c3h8 >= T('c3h8')[2]) return dangerous;
    if (o2 !== null && o2 < T('o2')[0]) return dangerous;
    if (co !== null && co >= T('co')[1]) return poor;
    if (c3h8 !== null && c3h8 >= T('c3h8')[1]) return poor;
    if (o2 !== null && o2 < T('o2')[1]) return poor;

    if (this._config.air_quality_entity) {
      const quality = this._getState(this._config.air_quality_entity);
      // Numeric index sensors (e.g. Netatmo's health index, #45): with
      // `air_quality_thresholds` configured, interpret the number through
      // the usual 5-tier machinery instead of parroting the raw value.
      const aqThresholds = this._config.air_quality_thresholds;
      const numeric = parseFloat(quality);
      if (Array.isArray(aqThresholds) && aqThresholds.length === 4 &&
          aqThresholds.every(n => typeof n === 'number') && Number.isFinite(numeric)) {
        const key = this._tieredValue(numeric, aqThresholds, ['excellent', 'good', 'fair', 'poor', 'very_poor']);
        const color = this._tieredValue(numeric, aqThresholds, SCALE_AIRQUALITY);
        return { status: this._t('status', key), color };
      }
      const statusKey = String(quality || '').toLowerCase().replace(/\s+/g, '_');
      const translated = this._t('status', statusKey);
      // If translation found, use it; otherwise show the raw entity state cleaned up
      const display = translated !== statusKey ? translated : String(quality || '').replace('_', ' ');
      return { status: display, color: this._getQualityColor(quality) };
    }

    // Radon only degrades the header at the EPA action level and above — it
    // has its own advisory banner for the lower tiers.
    const radon = this._radonReadings().bq;
    if (radon !== null && radon >= T('radon')[3]) return poor;
    let worst = radon === null ? -1 : radon >= T('radon')[2] ? 3 : 0;

    // Every other configured air-quality metric contributes its tier; the
    // header shows the worst one (it used to look at CO₂ and PM2.5 only).
    const AIR = ['co', 'c3h8', 'o2', 'co2', 'pm25', 'pm10', 'pm1', 'pm03', 'pm4', 'hcho', 'tvoc', 'nox', 'no2', 'o3'];
    for (const metric of AIR) {
      const reading = this._metricReading(metric);
      if (reading) worst = Math.max(worst, OVERALL_SEVERITY[reading.color] ?? 0);
    }
    if (worst >= 0) {
      const key = ['excellent', 'good', 'moderate', 'fair', 'poor'][worst];
      return { status: this._t('status', key), color: SCALE_AIRQUALITY[worst] };
    }

    // No air-quality reading at all (e.g. a temperature-only card, #51): let
    // the comfort metrics speak for themselves rather than claiming
    // "Excellent" air nobody measured.
    let comfort = null;
    for (const metric of ['temperature', 'humidity', 'noise']) {
      const reading = this._metricReading(metric);
      if (reading && (!comfort || (OVERALL_SEVERITY[reading.color] ?? 0) > (OVERALL_SEVERITY[comfort.color] ?? 0))) comfort = reading;
    }
    if (comfort) return { status: comfort.status, color: comfort.color };
    return { status: this._t('status', 'unavailable'), color: '#9e9e9e' };
  }

  _getQualityColor(quality) {
    const colors = {
      'good': '#4caf50',
      'excellent': '#4caf50',
      'moderate': '#8bc34a',
      'fair': '#ffc107',
      'poor': '#ff9800',
      'very_poor': '#f44336',
      'very poor': '#f44336',
      'extremely_poor': '#b71c1c'
    };
    return colors[quality?.toLowerCase()] || '#9e9e9e';
  }

  // Configured metrics whose current tier sits outside the calm palette —
  // greens plus the mild 'Cool' blue; i.e. amber/orange/red tiers and the
  // 'Cold' blue. Drives the compact view's alert chips and the opt-in
  // auto_expand behavior (#40). Sorted most-severe first so the worst
  // problems survive chip-row truncation; ties keep the user's metric order.
  _getAbnormalMetrics() {
    const CALM_COLORS = ['#4caf50', '#8bc34a', '#03a9f4'];
    const SEVERITY = { '#f44336': 4, '#ff9800': 3, '#ffc107': 2, '#2196f3': 1 };
    // Life-safety metrics must never be outranked — or truncated out of the
    // chip row — by a comfort metric that happens to share a tier color.
    const PRIORITY_BOOST = { co: 10, c3h8: 10, o2: 10, radon: 5 };
    const results = [];
    for (const metric of this._getMetricOrder()) {
      // Pressure is informational (and its thresholds assume hPa) — ordinary
      // barometric weather must never read as an air-quality alert.
      if (metric === 'pressure') continue;
      // Unavailable sensors are skipped rather than alerting on a made-up value.
      const reading = this._metricReading(metric);
      if (!reading || CALM_COLORS.includes(reading.color)) continue;
      results.push({
        metric, label: this._metricLabel(metric), color: reading.color, status: reading.status,
        severity: (SEVERITY[reading.color] || 0) + (PRIORITY_BOOST[metric] || 0)
      });
    }
    return results.sort((a, b) => b.severity - a.severity);
  }

  // Short display name for a metric (graph headers, alert chips).
  _metricLabel(metric) {
    const labels = {
      co: 'CO', radon: 'Radon', co2: 'CO₂', pm25: 'PM2.5', pm10: 'PM10',
      pm1: 'PM1', pm03: 'PM0.3', pm4: 'PM4', hcho: 'HCHO', tvoc: 'tVOC',
      nox: 'NOx', no2: 'NO₂', o3: 'O₃', o2: 'O₂', c3h8: 'Propane'
    };
    return labels[metric] || this._t('metric', metric);
  }

  // Outdoor PM2.5/CO₂ against indoor, for the "keep windows closed" override.
  // With an indoor reading, outdoor is worse when it's higher. Without one
  // (unconfigured or unavailable) a plain `outdoor > indoor` comparison is
  // meaningless (#35), so outdoor counts as worse once it reaches the
  // metric's elevated tier on its own.
  _outdoorComparison() {
    const T = (m) => this._metricThresholds(m);
    const pm25 = this._metricValue('pm25');
    const co2 = this._metricValue('co2');
    const outdoorPm25 = this._metricValue('pm25', 'outdoor_pm25_entity');
    const outdoorCo2 = this._metricValue('co2', 'outdoor_co2_entity');
    const pm25Worse = outdoorPm25 !== null && (pm25 !== null ? outdoorPm25 > pm25 : outdoorPm25 >= T('pm25')[2]);
    const co2Worse = outdoorCo2 !== null && (co2 !== null ? outdoorCo2 > co2 : outdoorCo2 >= T('co2')[2]);
    return { outdoorPm25, outdoorCo2, pm25Worse, co2Worse };
  }

  // Translation-key-based recommendation dispatcher. Used internally for icon
  // lookup and subtitle generation. `_getRecommendation()` translates the key
  // for display. Every cutoff is a tier boundary of the metric's (possibly
  // user-overridden) thresholds, so the recommendation always agrees with the
  // per-metric badges (#59).
  _getRecommendationKey() {
    // Outdoor-only mode: recommendations assume an indoor context (open window,
    // run air purifier, etc.) and are nonsensical when monitoring ambient air.
    if (this._outdoorOnly) return null;
    const T = (m) => this._metricThresholds(m);
    // `above(value, metric, tier)`: value has reached that tier boundary —
    // the same `>=` the badges' tier lookup uses, so a CO₂ sensor reading
    // exactly 1000 gets the same verdict from the badge, header and banner.
    // null (unconfigured/unavailable) is never above anything.
    const above = (value, metric, tier) => value !== null && value >= T(metric)[tier];
    const co = this._metricValue('co');
    const co2 = this._metricValue('co2');
    const pm25 = this._metricValue('pm25');
    const pm10 = this._metricValue('pm10');
    const hcho = this._metricValue('hcho');
    const tvoc = this._metricValue('tvoc');
    const no2 = this._metricValue('no2');
    const o3 = this._metricValue('o3');
    const c3h8 = this._metricValue('c3h8');
    const o2 = this._metricValue('o2');
    const humidity = this._metricValue('humidity');
    const noise = this._metricValue('noise');

    // Life-safety first; never suppressed by the outdoor override.
    if (above(co, 'co', 3)) return 'co_danger';
    if (above(co, 'co', 2)) return 'co_warning';
    if (c3h8 !== null && c3h8 >= T('c3h8')[2]) return 'propane_danger';
    if (c3h8 !== null && c3h8 >= T('c3h8')[1]) return 'propane_warning';
    if (o2 !== null && o2 < T('o2')[0]) return 'o2_danger';
    if (o2 !== null && o2 < T('o2')[1]) return 'o2_warning';
    // Elevated CO comes next, ahead of particulates: an air purifier does
    // nothing for CO, and outdoor air is still the remedy.
    if (above(co, 'co', 1)) return 'co_elevated';

    let key = 'all_good';
    if (above(co2, 'co2', 3)) key = 'ventilate_now';
    else if (above(pm25, 'pm25', 3)) key = 'run_air_purifier';
    else if (above(pm10, 'pm10', 3)) key = 'run_air_purifier';
    else if (above(hcho, 'hcho', 2)) key = 'ventilate_formaldehyde';
    else if (above(no2, 'no2', 3)) key = 'ventilate_no2';
    else if (above(o3, 'o3', 3)) key = 'ventilate_o3';
    // tVOC: the elevated tier of whichever table applies — 500 ppb, or 250
    // on the 1–500 VOC Index (a fixed 500 could never fire in index mode).
    else if (above(tvoc, this._tvocMetric(), 2)) key = 'ventilate_vocs';
    else if (above(pm25, 'pm25', 2) && above(co2, 'co2', 2)) key = 'air_purifier_ventilate';
    else if (above(pm25, 'pm25', 2)) key = 'run_air_purifier';
    else if (above(pm10, 'pm10', 2)) key = 'consider_air_purifier';
    else if (above(co2, 'co2', 2)) key = 'open_window';
    else if (humidity !== null && humidity < T('humidity')[0]) key = 'too_dry';
    else if (above(humidity, 'humidity', 3)) key = 'too_humid';
    else if (above(noise, 'noise', 3)) key = 'reduce_noise';
    else if (above(co2, 'co2', 1) || above(pm25, 'pm25', 1)) key = 'consider_ventilating';

    // Ventilation advice flips when outdoor air is worse. CO/propane/O2 keys
    // are intentionally absent — they're life-safety and returned above.
    const ventilationKeys = ['ventilate_now', 'open_window', 'consider_ventilating', 'air_purifier_ventilate', 'ventilate_formaldehyde', 'ventilate_vocs', 'ventilate_no2', 'ventilate_o3'];
    const { pm25Worse, co2Worse } = this._outdoorComparison();
    if ((pm25Worse || co2Worse) && ventilationKeys.includes(key)) {
      if (above(pm25, 'pm25', 2)) return 'run_air_purifier';
      return 'keep_windows_closed';
    }
    return key;
  }

  // Public-facing recommendation as a translated display string. Returns
  // null when the key is null (e.g. outdoor-only mode suppresses recs).
  _getRecommendation() {
    const key = this._getRecommendationKey();
    if (!key) return null;
    return this._t('recommendation', key);
  }

  _getRecommendationIcon(rec) {
    // Accept either a translation key (preferred for new callers) or an
    // English display string (backward-compat with older callers/tests).
    const iconByKey = {
      all_good: 'mdi:check-circle',
      consider_ventilating: 'mdi:information',
      open_window: 'mdi:window-open-variant',
      run_air_purifier: 'mdi:air-purifier',
      consider_air_purifier: 'mdi:air-purifier',
      air_purifier_ventilate: 'mdi:alert',
      ventilate_now: 'mdi:alert-circle',
      ventilate_formaldehyde: 'mdi:alert-circle',
      ventilate_vocs: 'mdi:alert-circle',
      ventilate_no2: 'mdi:alert-circle',
      ventilate_o3: 'mdi:alert-circle',
      co_danger: 'mdi:alert-octagon',
      co_warning: 'mdi:alert-octagon',
      co_elevated: 'mdi:alert',
      propane_danger: 'mdi:propane-tank',
      propane_warning: 'mdi:propane-tank',
      o2_danger: 'mdi:lungs',
      o2_warning: 'mdi:lungs',
      keep_windows_closed: 'mdi:window-closed-variant',
      reduce_noise: 'mdi:volume-high',
      too_dry: 'mdi:water-percent',
      too_humid: 'mdi:water'
    };
    if (iconByKey[rec]) return iconByKey[rec];
    // Backward-compat: translated/English text → reverse to key via en pack.
    const enRec = TRANSLATIONS.en.recommendation;
    for (const k of Object.keys(enRec)) {
      if (enRec[k] === rec) return iconByKey[k] || 'mdi:air-filter';
    }
    return 'mdi:air-filter';
  }

  _renderCompact() {
    const expandable = this._isExpandable();
    // In expandable mode the tap is reserved for expand/collapse, so any
    // configured tap_action is ignored while collapsed; hold and double-tap
    // actions still work.
    const tap = expandable ? () => this._toggleExpanded()
      : this._hasAction('tap_action') ? () => this._fireAction('tap') : null;
    const hold = this._hasAction('hold_action') ? () => this._fireAction('hold') : null;
    const doubleTap = this._hasAction('double_tap_action') ? () => this._fireAction('double_tap') : null;
    const clickable = !!(tap || hold || doubleTap);
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --aq-excellent: #4caf50;
          --aq-good: #8bc34a;
          --aq-moderate: #ffc107;
          --aq-poor: #ff9800;
          --aq-very-poor: #f44336;
          --aq-critical: #d32f2f;
        }
        ha-card.compact {
          padding: 12px 16px;
          ${clickable ? 'cursor: pointer; transition: background 0.15s ease;' : ''}
        }
        ${clickable ? `
        ha-card.compact:hover {
          background: rgba(var(--rgb-primary-text-color, 0, 0, 0), 0.04);
        }
        ha-card.compact:focus-visible {
          outline: 2px solid var(--primary-color);
          outline-offset: 2px;
        }
        ` : ''}
        .compact-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .compact-left {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          flex: 1 1 auto;
        }
        .alert-chips {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 4px;
          min-width: 0;
        }
        .alert-chip {
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 0.72em;
          font-weight: 600;
          white-space: nowrap;
        }
        .alert-chip--more {
          background: rgba(var(--rgb-primary-text-color, 0, 0, 0), 0.06);
          color: var(--secondary-text-color);
        }
        .title {
          font-size: 1.05em;
          font-weight: 600;
          color: var(--primary-text-color);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .status-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 16px;
          font-size: 0.85em;
          font-weight: 500;
          text-transform: capitalize;
          color: var(--primary-text-color);
          flex: 0 0 auto;
        }
        .status-badge ha-icon {
          --mdc-icon-size: 18px;
        }
        .expand-chevron {
          --mdc-icon-size: 20px;
          color: var(--secondary-text-color);
          flex: 0 0 auto;
        }
      </style>
      <ha-card class="compact"${clickable ? ' role="button" tabindex="0"' : ''}${expandable ? ' aria-expanded="false"' : ''}>
        <div class="compact-row">
          <span class="compact-left">
            ${expandable ? '<ha-icon class="expand-chevron" icon="mdi:chevron-down"></ha-icon>' : ''}
            <span class="title">${escapeHtml(this._config.name)}</span>
          </span>
          ${this._config.compact_alerts !== false ? '<div class="alert-chips" id="alert-chips"></div>' : ''}
          <div class="status-badge" id="status-badge">
            <ha-icon id="status-icon" icon="mdi:leaf"></ha-icon>
            <span id="status-text">${this._t('label', 'loading')}</span>
          </div>
        </div>
      </ha-card>
    `;
    const card = this.shadowRoot.querySelector('ha-card');
    if (card && clickable) this._bindActions(card, { tap, hold, doubleTap });
  }

  _initialRender() {
    if (this._isCompact()) {
      this._renderCompact();
      return;
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --aq-excellent: #4caf50;
          --aq-good: #8bc34a;
          --aq-moderate: #ffc107;
          --aq-poor: #ff9800;
          --aq-very-poor: #f44336;
          --aq-critical: #d32f2f;
        }

        /* An expanded expandable card can be taller than the slot some
           layouts (e.g. a sections view with fixed rows) reserved for it.
           Later sibling cards would otherwise paint over the overflow (#43),
           so lift the expanded card above them — a pop-over, not a reflow. */
        ${this._isExpandable() ? ':host { position: relative; z-index: 8; }' : ''}

        /* <ha-card> supplies the themed background, border and radius; the
           inner wrapper only pads (and pins the text color for themes that
           style ha-card's color differently). */
        .card {
          padding: 16px;
          color: var(--primary-text-color);
        }

        .graph-container:focus-visible,
        .header--collapsible:focus-visible {
          outline: 2px solid var(--primary-color);
          outline-offset: 2px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        /* Expandable mode: the header doubles as a collapse control (#36). */
        .header--collapsible {
          cursor: pointer;
          margin: -4px -4px 8px;
          padding: 4px;
          border-radius: 8px;
          transition: background 0.15s ease;
        }
        .header--collapsible:hover {
          background: rgba(var(--rgb-primary-text-color, 0, 0, 0), 0.04);
        }

        .title {
          font-size: 1.1em;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .collapse-chevron {
          --mdc-icon-size: 20px;
          color: var(--secondary-text-color);
        }

        .status-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 0.8em;
          font-weight: 500;
          text-transform: capitalize;
        }

        .recommendation {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 10px;
          margin-bottom: 14px;
          background: var(--secondary-background-color);
        }

        .recommendation ha-icon {
          --mdc-icon-size: 24px;
        }

        .recommendation-text {
          flex: 1;
        }

        .recommendation-title {
          font-weight: 600;
          font-size: 1em;
        }

        .recommendation-subtitle {
          font-size: 0.8em;
          color: var(--secondary-text-color);
          margin-top: 1px;
        }

        /* One-tap action button on the recommendation strip (#34). Inherits the
           recommendation's accent color via currentColor so it matches severity. */
        .rec-action {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          padding: 0;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          background: transparent;
          color: inherit;
          transition: background 0.15s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .rec-action:hover {
          background: rgba(var(--rgb-primary-text-color, 0, 0, 0), 0.08);
        }
        .rec-action:active {
          background: rgba(var(--rgb-primary-text-color, 0, 0, 0), 0.16);
        }
        .rec-action ha-icon {
          --mdc-icon-size: 24px;
        }

        .radon-advisory {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 14px;
          border-radius: 8px;
          margin-bottom: 14px;
          border-left: 3px solid var(--aq-moderate);
          background: var(--secondary-background-color);
          font-size: 0.9em;
        }

        .radon-advisory ha-icon {
          --mdc-icon-size: 20px;
          flex-shrink: 0;
        }

        .radon-advisory-text {
          flex: 1;
        }

        .radon-advisory-title {
          font-weight: 600;
          font-size: 0.9em;
        }

        .radon-advisory-subtitle {
          font-size: 0.75em;
          color: var(--secondary-text-color);
          margin-top: 1px;
        }

        .graphs {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .graph-container {
          background: var(--secondary-background-color);
          border-radius: 10px;
          padding: 10px 12px;
          cursor: pointer;
        }

        .graph-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }

        .graph-label {
          font-size: 0.75em;
          color: var(--secondary-text-color);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .graph-value {
          font-size: 1em;
          font-weight: 700;
        }

        .graph-value .unit {
          font-size: 0.7em;
          font-weight: 400;
          opacity: 0.8;
        }

        .graph-value .status {
          font-size: 0.7em;
          font-weight: 500;
          margin-left: 6px;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .graph-value-secondary {
          font-size: 0.8em;
          font-weight: 500;
          opacity: 0.7;
          margin-top: -2px;
          margin-bottom: 4px;
          text-align: right;
        }

        .graph-value-secondary .unit {
          font-size: 0.75em;
          font-weight: 400;
          opacity: 0.8;
        }

        .graph-value-secondary .status {
          font-size: 0.75em;
          font-weight: 500;
          margin-left: 4px;
          padding: 1px 4px;
          border-radius: 3px;
        }

        /* Min/max value labels overlaid on the graph at the actual data points
           where the extremes occurred. The text-shadow halo lets them remain
           legible regardless of where they land on the gradient fill. */
        .minmax-marker {
          position: absolute;
          pointer-events: none;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.2px;
          font-variant-numeric: tabular-nums;
          line-height: 1;
          white-space: nowrap;
          transform: translate(-50%, -100%);
          margin-top: -6px;
          text-shadow:
            0 0 3px var(--ha-card-background, var(--card-background-color, #fff)),
            0 0 6px var(--ha-card-background, var(--card-background-color, #fff)),
            0 1px 2px var(--ha-card-background, var(--card-background-color, #fff));
          opacity: 0.95;
        }

        .minmax-marker[data-place="below"] {
          transform: translate(-50%, 0);
          margin-top: 6px;
        }

        /* When near a chart edge, anchor the label's side to the point rather
           than centering on it — keeps text inside the chart. */
        .minmax-marker[data-anchor="left"] {
          transform: translate(0, -100%);
        }
        .minmax-marker[data-anchor="left"][data-place="below"] {
          transform: translate(0, 0);
        }
        .minmax-marker[data-anchor="right"] {
          transform: translate(-100%, -100%);
        }
        .minmax-marker[data-anchor="right"][data-place="below"] {
          transform: translate(-100%, 0);
        }

        .graph-wrapper {
          position: relative;
        }

        .graph {
          height: 50px;
          position: relative;
        }

        .graph svg {
          width: 100%;
          height: 100%;
        }

        .graph-line {
          fill: none;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .graph-cursor {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 1px;
          background: var(--primary-text-color);
          opacity: 0.7;
          pointer-events: none;
          display: none;
        }

        .graph-cursor::before {
          content: '';
          position: absolute;
          top: 50%;
          left: -4px;
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: var(--primary-text-color);
          transform: translateY(-50%);
        }

        .graph-tooltip {
          position: absolute;
          top: -6px;
          transform: translateX(-50%);
          background: var(--primary-background-color);
          border: 1px solid var(--divider-color);
          border-radius: 6px;
          padding: 3px 7px;
          font-size: 0.7em;
          font-weight: 600;
          white-space: nowrap;
          pointer-events: none;
          display: none;
          z-index: 10;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        }

        .graph-tooltip-time {
          font-size: 0.85em;
          font-weight: 400;
          color: var(--secondary-text-color);
          margin-top: 1px;
        }

        .graph-tooltip-outdoor {
          font-size: 0.8em;
          font-weight: 400;
          color: var(--secondary-text-color);
          opacity: 0.7;
          margin-top: 1px;
          display: none;
        }

        .outdoor-value {
          font-size: 0.75em;
          color: var(--secondary-text-color);
          opacity: 0.7;
        }

        .graph-time-axis {
          display: flex;
          justify-content: space-between;
          font-size: 0.6em;
          color: var(--secondary-text-color);
          margin-top: 4px;
          opacity: 0.8;
        }

        .no-data {
          text-align: center;
          padding: 20px;
          color: var(--secondary-text-color);
        }
      </style>

      <ha-card>
        <div class="card">
          <div class="header${this._isExpandable() ? ' header--collapsible' : ''}" id="card-header"${this._isExpandable() ? ' role="button" tabindex="0" aria-expanded="true"' : ''}>
            <span class="title">
              ${this._isExpandable() ? '<ha-icon class="collapse-chevron" icon="mdi:chevron-up"></ha-icon>' : ''}${escapeHtml(this._config.name)}
            </span>
            <div class="status-badge" id="status-badge">
              <ha-icon id="status-icon" icon="mdi:leaf"></ha-icon>
              <span id="status-text">${this._t('label', 'loading')}</span>
            </div>
          </div>

          ${!this._outdoorOnly && this._config.show_status_banner !== false ? `
          <div class="recommendation" id="recommendation">
            <ha-icon id="rec-icon" icon="mdi:check-circle"></ha-icon>
            <div class="recommendation-text">
              <div class="recommendation-title" id="rec-title"></div>
              <div class="recommendation-subtitle" id="rec-subtitle"></div>
            </div>
            ${this._hasAction('recommendation_action') ? `
            <button class="rec-action" id="rec-action" style="display:none" title="${escapeHtml(this._t('editor', 'recommendation_action'))}" aria-label="${escapeHtml(this._t('editor', 'recommendation_action'))}">
              <ha-icon id="rec-action-icon" icon="mdi:play-circle"></ha-icon>
            </button>
            ` : ''}
          </div>
          ` : ''}

          <div class="radon-advisory" id="radon-advisory" style="display:none">
            <ha-icon id="radon-advisory-icon" icon="mdi:radioactive"></ha-icon>
            <div class="radon-advisory-text">
              <div class="radon-advisory-title" id="radon-advisory-title"></div>
              <div class="radon-advisory-subtitle" id="radon-advisory-subtitle"></div>
            </div>
          </div>

          <div class="graphs">
            ${GRAPH_ORDER.filter(m => this._graphEntity(m)).map(m => this._graphBlockHtml(m)).join('')}
          </div>
        </div>
      </ha-card>
    `;

    this._applyMetricOrder();

    const recAction = this.shadowRoot.getElementById('rec-action');
    if (recAction) {
      recAction.addEventListener('click', (e) => {
        e.stopPropagation();
        this._fireRecommendationAction();
      });
    }

    if (this._isExpandable()) {
      const header = this.shadowRoot.getElementById('card-header');
      if (header) this._bindActivation(header, () => this._toggleExpanded());
    }

    this._setupGraphInteractions();
  }

  // Entity behind a metric's graph (radon falls back to its long-term sensor).
  _graphEntity(metric) {
    if (metric === 'radon') return this._config.radon_entity || this._config.radon_longterm_entity;
    return this._config[`${metric}_entity`];
  }

  _graphBlockHtml(metric) {
    const entityId = this._graphEntity(metric);
    const label = GRAPH_LABELS[metric] || this._metricLabel(metric);
    // Radon's overlay is its long-term sensor; everything else's is outdoor.
    const hasOverlay = metric !== 'radon' || !!(this._config.radon_entity && this._config.radon_longterm_entity);
    return `
            <div class="graph-container" id="${metric}-graph-container" data-entity="${escapeHtml(entityId)}" role="button" tabindex="0" aria-label="${escapeHtml(label)}">
              <div class="graph-header">
                <span class="graph-label">${escapeHtml(label)}</span>
                <span class="graph-value" id="${metric}-value">--</span>
              </div>
              ${metric === 'radon' && this._config.radon_longterm_entity ? '<div class="graph-value-secondary" id="radon-lt-value"></div>' : ''}
              <div class="graph-wrapper">
                <div class="graph" id="${metric}-graph">
                  <svg id="${metric}-svg" viewBox="0 0 300 50" preserveAspectRatio="none"></svg>
                </div>
                <div class="graph-cursor" id="${metric}-cursor"></div>
                <div class="graph-tooltip" id="${metric}-tooltip">
                  <div class="graph-tooltip-value"></div>
                  ${hasOverlay ? '<div class="graph-tooltip-outdoor"></div>' : ''}
                  <div class="graph-tooltip-time"></div>
                </div>
              </div>
              <div class="graph-time-axis" id="${metric}-time-axis"></div>
            </div>`;
  }

  // Fire the configured recommendation action via HA's standard action handler.
  // Reuses the documented `hass-action` event so it supports the full action
  // vocabulary (perform-action/toggle/navigate/url/more-info/etc.).
  _fireRecommendationAction() {
    const action = this._config.recommendation_action;
    if (!action) return;
    const event = new CustomEvent('hass-action', {
      bubbles: true,
      composed: true,
      detail: {
        config: { tap_action: action, entity: action.entity },
        action: 'tap'
      }
    });
    this.dispatchEvent(event);
  }

  _updateStates() {
    if (!this._hass || !this._rendered) return;

    const recKey = this._getRecommendationKey();
    const overall = this._getOverallStatus();

    // Update status badge
    const statusBadge = this.shadowRoot.getElementById('status-badge');
    const statusText = this.shadowRoot.getElementById('status-text');
    const statusIcon = this.shadowRoot.getElementById('status-icon');

    if (statusBadge) {
      statusBadge.style.background = overall.color + '22';
      statusBadge.style.color = overall.color;
      statusText.textContent = overall.status;
      statusIcon.style.color = overall.color;
    }

    // Alert chips (#40): while collapsed, itemize which sensors are out of
    // range. Capped at 4 chips (most severe first) plus a +N overflow pill.
    const chipsEl = this.shadowRoot.getElementById('alert-chips');
    if (chipsEl) {
      const abnormal = this._getAbnormalMetrics();
      const shown = abnormal.slice(0, 4);
      const extra = abnormal.length - shown.length;
      chipsEl.innerHTML = shown.map(c =>
        `<span class="alert-chip" style="background:${c.color}22;color:${c.color}" title="${escapeHtml(`${c.label}: ${c.status}`)}">${escapeHtml(c.label)}</span>`
      ).join('') + (extra > 0 ? `<span class="alert-chip alert-chip--more">+${extra}</span>` : '');
    }

    // Compact mode only renders the status badge — skip the rest of the DOM updates
    if (this._isCompact()) return;

    this._updateRecommendation(recKey);
    for (const metric of GRAPH_ORDER) this._updateMetricValue(metric);
    this._updateRadonLongTerm();

    // Update radon advisory banner
    const radonAdvisory = this._getRadonAdvisory();
    const advisoryEl = this.shadowRoot.getElementById('radon-advisory');
    if (advisoryEl) {
      if (radonAdvisory) {
        advisoryEl.style.display = '';
        const advisoryColors = { danger: 'var(--aq-very-poor)', warning: 'var(--aq-poor)', info: 'var(--aq-moderate)' };
        advisoryEl.style.borderLeftColor = advisoryColors[radonAdvisory.level] || 'var(--aq-moderate)';
        const titleEl = this.shadowRoot.getElementById('radon-advisory-title');
        const subtitleEl = this.shadowRoot.getElementById('radon-advisory-subtitle');
        const iconEl = this.shadowRoot.getElementById('radon-advisory-icon');
        if (titleEl) titleEl.textContent = radonAdvisory.text;
        if (subtitleEl) subtitleEl.textContent = radonAdvisory.subtitle;
        if (iconEl) iconEl.style.color = advisoryColors[radonAdvisory.level] || 'var(--aq-moderate)';
      } else {
        advisoryEl.style.display = 'none';
      }
    }
  }

  // Number + unit for prose (recommendation subtitles), e.g. "12 ppm", "45%".
  _formatWithUnit(metric, value, entityKey = `${metric}_entity`) {
    const unit = this._metricUnit(metric);
    const number = this._formatNumber(value, this._metricDecimals(metric, this._config[entityKey]));
    if (!unit) return number;
    return unit === '%' ? `${number}%` : `${number} ${unit}`;
  }

  _updateRecommendation(recKey) {
    const recIcon = this.shadowRoot.getElementById('rec-icon');
    const recTitle = this.shadowRoot.getElementById('rec-title');
    const recSubtitle = this.shadowRoot.getElementById('rec-subtitle');
    const recContainer = this.shadowRoot.getElementById('recommendation');
    if (!recIcon || !recKey) return;

    const T = (m) => this._metricThresholds(m);
    const v = (metric) => this._metricValue(metric);
    const fmt = (metric, value) => this._formatWithUnit(metric, value);
    // "<key>" with the reading interpolated, or "<key>_unknown" without one.
    const withValue = (key, metric) => {
      const value = v(metric);
      return value !== null ? this._ts('subtitle', key, { value: fmt(metric, value) }) : this._t('subtitle', `${key}_unknown`);
    };

    recIcon.setAttribute('icon', this._getRecommendationIcon(recKey));
    recTitle.textContent = this._t('recommendation', recKey);

    const co2 = v('co2'), pm25 = v('pm25'), pm10 = v('pm10'), humidity = v('humidity');
    let subtitle = '';
    switch (recKey) {
      case 'co_danger': case 'co_warning': case 'co_elevated':
        subtitle = withValue(recKey, 'co'); break;
      case 'propane_danger': case 'propane_warning':
        subtitle = withValue(recKey, 'c3h8'); break;
      case 'o2_danger': case 'o2_warning':
        subtitle = withValue(recKey, 'o2'); break;
      case 'ventilate_formaldehyde': subtitle = withValue(recKey, 'hcho'); break;
      case 'ventilate_vocs': subtitle = withValue(recKey, 'tvoc'); break;
      case 'ventilate_no2': subtitle = withValue(recKey, 'no2'); break;
      case 'ventilate_o3': subtitle = withValue(recKey, 'o3'); break;
      case 'reduce_noise': subtitle = withValue(recKey, 'noise'); break;
      case 'all_good': subtitle = this._t('subtitle', 'air_quality_healthy'); break;
      case 'run_air_purifier':
        if (pm25 !== null && pm25 >= T('pm25')[3]) subtitle = this._ts('subtitle', 'purifier_pm25', { value: fmt('pm25', pm25) });
        else if (pm10 !== null && pm10 >= T('pm10')[3]) subtitle = this._ts('subtitle', 'purifier_pm10', { value: fmt('pm10', pm10) });
        else if (pm25 !== null) subtitle = this._ts('subtitle', 'purifier_pm25', { value: fmt('pm25', pm25) });
        else subtitle = this._t('subtitle', 'purifier_generic');
        break;
      case 'consider_air_purifier':
        if (pm10 !== null) subtitle = this._ts('subtitle', 'consider_purifier_pm10', { value: fmt('pm10', pm10) });
        break;
      case 'open_window':
        if (co2 !== null) subtitle = this._ts('subtitle', 'open_window_co2', { value: fmt('co2', co2) });
        break;
      case 'air_purifier_ventilate':
        if (co2 !== null && pm25 !== null) subtitle = this._ts('subtitle', 'purifier_ventilate', { co2: fmt('co2', co2), pm25: fmt('pm25', pm25) });
        break;
      case 'ventilate_now':
        if (co2 !== null) subtitle = this._ts('subtitle', 'ventilate_now_co2', { value: fmt('co2', co2) });
        break;
      case 'too_dry': case 'too_humid':
        if (humidity !== null) subtitle = this._ts('subtitle', recKey, { value: fmt('humidity', humidity) });
        break;
      case 'consider_ventilating':
        if (co2 !== null && co2 >= T('co2')[1]) subtitle = this._ts('subtitle', 'consider_ventilating_co2', { value: fmt('co2', co2) });
        else if (pm25 !== null && pm25 >= T('pm25')[1]) subtitle = this._ts('subtitle', 'consider_ventilating_pm25', { value: fmt('pm25', pm25) });
        else subtitle = this._t('subtitle', 'consider_ventilating_generic');
        break;
      case 'keep_windows_closed': {
        // Name whichever outdoor reading actually triggered the override.
        const { outdoorPm25, outdoorCo2, pm25Worse, co2Worse } = this._outdoorComparison();
        const outPm = (key) => this._ts('subtitle', key, { value: this._formatWithUnit('pm25', outdoorPm25, 'outdoor_pm25_entity') });
        if (pm25Worse && (outdoorPm25 >= T('pm25')[3] || pm25 === null)) subtitle = outPm('keep_closed_outdoor_pm25_poor');
        else if (pm25Worse) subtitle = outPm('keep_closed_outdoor_pm25');
        else if (co2Worse) subtitle = this._ts('subtitle', 'keep_closed_outdoor_co2', { value: this._formatWithUnit('co2', outdoorCo2, 'outdoor_co2_entity') });
        else subtitle = this._t('subtitle', 'keep_closed_generic');
        break;
      }
    }
    recSubtitle.textContent = subtitle;

    const severity = REC_SEVERITY[recKey] || 'moderate';
    const accents = {
      good: ['var(--aq-excellent)', 'rgba(76, 175, 80, 0.1)'],
      moderate: ['var(--aq-moderate)', 'rgba(255, 193, 7, 0.1)'],
      poor: ['var(--aq-poor)', 'rgba(255, 152, 0, 0.15)'],
      critical: ['var(--aq-very-poor)', 'rgba(244, 67, 54, 0.15)']
    };
    const [accent, background] = accents[severity];
    recIcon.style.color = accent;
    recContainer.style.background = background;

    // Action button: only meaningful when there's actually something to act on.
    const recAction = this.shadowRoot.getElementById('rec-action');
    if (recAction) {
      const actionable = this._hasAction('recommendation_action') && severity !== 'good';
      recAction.style.display = actionable ? 'inline-flex' : 'none';
      if (actionable) recAction.style.color = accent;
    }
  }

  // Unit shown for a metric's reading.
  _metricUnit(metric) {
    switch (metric) {
      case 'co': case 'hcho': case 'no2': case 'o3': return this._gasUnit(metric);
      case 'co2': return 'ppm';
      case 'pm25': case 'pm10': case 'pm1': case 'pm4': return 'μg/m³';
      case 'pm03': return 'p/0.1L';
      case 'tvoc': return this._getTVOCUnit();
      case 'nox': return this._getNOxUnit();
      case 'c3h8': case 'o2': case 'humidity': return '%';
      case 'temperature': return this._getTempUnit();
      case 'pressure': return this._getPressureUnit();
      case 'noise': {
        const uom = this._hass?.states[this._config.noise_entity]?.attributes?.unit_of_measurement;
        return uom ? normalizeUnit(uom) : 'dB';
      }
      case 'radon': return this._getRadonUnit();
    }
    return '';
  }

  // Decimal places for a reading. The entity's own "Display precision"
  // setting (HA entity settings) wins when the value isn't unit-converted —
  // except temperature, where an explicit `temperature_decimals` does.
  _metricDecimals(metric, entityId) {
    const precision = entityId ? this._hass?.entities?.[entityId]?.display_precision : undefined;
    const explicitTemp = metric === 'temperature' && this._rawConfig && 'temperature_decimals' in this._rawConfig;
    if (typeof precision === 'number' && !explicitTemp && this._unitFactor(metric, entityId) === 1) return precision;
    switch (metric) {
      case 'co2': case 'pm03': case 'humidity': case 'noise': return 0;
      case 'no2': case 'o3': return 0;
      case 'c3h8': return 2;
      case 'temperature': return this._config.temperature_decimals ? 1 : 0;
      case 'radon': return this._isRadonPciL() ? 1 : 0;
      case 'tvoc': return this._isVOCIndex() ? 0 : (this._getTVOCUnit() === 'mg/m³' ? 2 : 1);
      case 'nox': return this._isNOxIndex() ? 0 : 1;
      case 'pressure': return this._getPressureUnit().toLowerCase() === 'inhg' ? 2 : 0;
      default: return 1;
    }
  }

  // Write one metric's readout: value, unit, tier badge, outdoor suffix.
  _updateMetricValue(metric) {
    const el = this.shadowRoot.getElementById(`${metric}-value`);
    if (!el) return;
    let value, bandValue, entityId;
    if (metric === 'radon') {
      // Main readout is the short-term sensor (long-term when that's all
      // there is); the color/status band is always in Bq/m³.
      const { short, long } = this._radonReadings();
      entityId = this._config.radon_entity ? this._config.radon_entity : this._config.radon_longterm_entity;
      value = this._config.radon_entity ? short : long;
      bandValue = value === null ? null : this._getRadonBqm3(value);
    } else {
      entityId = this._config[`${metric}_entity`];
      value = this._metricValue(metric);
      bandValue = value;
    }
    if (value === null) {
      el.innerHTML = `— <span class="status"></span>`;
      const statusEl = el.querySelector('.status');
      statusEl.textContent = this._t('status', 'unavailable');
      statusEl.style.background = 'rgba(158, 158, 158, 0.15)';
      statusEl.style.color = 'var(--secondary-text-color)';
      el.style.color = 'var(--secondary-text-color)';
      return;
    }
    const defKey = this._defKey(metric);
    const color = this._getMetricColor(defKey, bandValue);
    const unit = this._metricUnit(metric);
    const number = this._formatNumber(value, this._metricDecimals(metric, entityId));
    const unitSpan = unit ? ` <span class="unit">${escapeHtml(unit)}</span>` : '';
    el.innerHTML = `${number}${unitSpan}<span class="status"></span>${this._outdoorSuffix(metric)}`;
    const statusEl = el.querySelector('.status');
    statusEl.textContent = this._getMetricStatus(defKey, bandValue);
    statusEl.style.background = color + '22';
    statusEl.style.color = color;
    el.style.color = color;
  }

  // " (out: 12.3 μg/m³)" when the metric has an outdoor sensor configured.
  _outdoorSuffix(metric) {
    const entityKey = `outdoor_${metric}_entity`;
    if (!this._config[entityKey]) return '';
    const value = this._metricValue(metric, entityKey);
    const unit = this._metricUnit(metric);
    const text = value === null ? '—'
      : `${this._formatNumber(value, this._metricDecimals(metric, this._config[entityKey]))}${unit ? ' ' + unit : ''}`;
    return ` <span class="outdoor-value">(${escapeHtml(this._t('label', 'out'))}: ${escapeHtml(text)})</span>`;
  }

  _updateRadonLongTerm() {
    const ltValueEl = this.shadowRoot.getElementById('radon-lt-value');
    if (!ltValueEl) return;
    const { long } = this._radonReadings();
    const label = escapeHtml(this._t('label', 'lt'));
    if (long === null) {
      ltValueEl.textContent = `${this._t('label', 'lt')}: —`;
      ltValueEl.style.color = 'var(--secondary-text-color)';
      return;
    }
    const ltBq = this._getRadonBqm3(long);
    const ltColor = this._getRadonColor(ltBq);
    const unit = escapeHtml(this._getRadonUnit());
    ltValueEl.innerHTML = `${label}: ${this._formatNumber(long, this._isRadonPciL() ? 1 : 0)} <span class="unit">${unit}</span><span class="status"></span>`;
    const statusEl = ltValueEl.querySelector('.status');
    statusEl.textContent = this._getMetricStatus('radon', ltBq);
    statusEl.style.background = ltColor + '22';
    statusEl.style.color = ltColor;
    ltValueEl.style.color = ltColor;
  }

  // Pressure unit: use the sensor's own unit_of_measurement when present,
  // else default to hPa (what the bell thresholds assume).
  _getPressureUnit() {
    const uom = this._hass?.states[this._config.pressure_entity]?.attributes?.unit_of_measurement;
    return uom || 'hPa';
  }

  // Fixed y-axis range for a metric's graph: the metric's meaningful span by
  // default, or — when the user overrode its thresholds (other units, e.g.
  // inHg pressure or µg/m³ CO) — the override's span plus one tier of margin.
  _graphRange(metric) {
    const defKey = this._defKey(metric);
    const defaults = {
      co: [0, 100], co2: [400, 2000], pm25: [0, 60], pm10: [0, 200], pm1: [0, 60], pm03: [0, 5000],
      pm4: [0, 75], hcho: [0, 300], tvoc_index: [0, 500], tvoc_ppb: [0, 1500], nox_index: [0, 500],
      nox_ppb: [0, 300], c3h8: [0, 2.5], o2: [15, 25], no2: [0, 300], o3: [0, 300], humidity: [0, 100],
      temp_c: [10, 32], temp_f: [50, 90], noise: [20, 90], pressure: [980, 1045], radon: [0, 370]
    };
    const toDisplay = (v) => metric === 'radon' && this._isRadonPciL() ? v / 37 : v;
    const override = this._thresholdOverride(defKey);
    if (!override) return defaults[defKey].map(toDisplay);
    const [t0, t1, t2, t3] = override;
    let lo = t0 - (t1 - t0);
    if (defaults[defKey][0] >= 0) lo = Math.max(0, lo);
    return [toDisplay(lo), toDisplay(t3 + (t3 - t2))];
  }

  _renderGraphs() {
    this._buildHistory();
    this._graphData = {};
    for (const metric of GRAPH_ORDER) {
      if (!this._graphEntity(metric)) continue;
      let data, overlay, overlayLabel, colorFn;
      if (metric === 'radon') {
        data = this._history.radon.length ? this._history.radon : this._history.radon_longterm;
        overlay = this._config.radon_entity && this._config.radon_longterm_entity ? this._history.radon_longterm : [];
        overlayLabel = this._t('radon', 'long_term');
        colorFn = (v) => this._getRadonColor(this._getRadonBqm3(v));
      } else {
        data = this._history[metric];
        overlay = this._history[`outdoor_${metric}`];
        overlayLabel = this._t('label', 'outdoor');
        const defKey = this._defKey(metric);
        colorFn = (v) => this._getMetricColor(defKey, v);
      }
      if (!data || !data.length) continue;
      const [min, max] = this._graphRange(metric);
      this._renderGraph(metric, data, colorFn, min, max, this._metricUnit(metric), overlay, overlayLabel);
    }
  }

  _renderGraph(graphId, data, colorFn, minVal, maxVal, unit, outdoorData, outdoorLabel) {
    const svg = this.shadowRoot.getElementById(`${graphId}-svg`);
    const timeAxis = this.shadowRoot.getElementById(`${graphId}-time-axis`);
    if (!svg || !data.length) return;

    const width = 300;
    const height = 50;
    const padding = 2;

    // Include outdoor values in min/max calculation so both lines share the same scale
    const allValues = data.map(d => d.value);
    if (outdoorData && outdoorData.length) {
      allValues.push(...outdoorData.map(d => d.value));
    }
    // Fixed scale (default) anchors every graph to the metric's meaningful
    // range so tier colors stay comparable across cards. `y_scale: auto`
    // (#52) instead zooms to the data with 10% headroom, making small
    // variations visible when readings sit far from the tier boundaries.
    let dataMin, dataMax;
    if (this._config.y_scale === 'auto') {
      dataMin = Math.min(...allValues);
      dataMax = Math.max(...allValues);
      const pad = (dataMax - dataMin) * 0.1 || Math.abs(dataMax) * 0.05 || 1;
      dataMin -= pad;
      dataMax += pad;
      // Don't zoom below zero for metrics whose fixed floor is zero —
      // a negative axis on a concentration graph reads as bad data.
      if (minVal >= 0 && dataMin < 0) dataMin = 0;
    } else {
      dataMin = Math.min(...allValues, minVal);
      dataMax = Math.max(...allValues, maxVal);
    }
    const range = dataMax - dataMin || 1;

    const points = data.map(d => {
      const x = this._computeGraphX(d.time, width, padding);
      const y = height - padding - ((d.value - dataMin) / range) * (height - 2 * padding);
      return { x, y, value: d.value, time: d.time, color: colorFn(d.value) };
    });

    // Map outdoor data to points using the same coordinate system
    let outdoorPoints = [];
    if (outdoorData && outdoorData.length >= 2) {
      outdoorPoints = outdoorData.map(d => {
        const x = this._computeGraphX(d.time, width, padding);
        const y = height - padding - ((d.value - dataMin) / range) * (height - 2 * padding);
        return { x, y, value: d.value, time: d.time, color: colorFn(d.value) };
      });
    }

    this._graphData[graphId] = { points, outdoorPoints, unit, colorFn, outdoorLabel: outdoorLabel || this._t('label', 'outdoor') };

    if (this._config.show_min_max) {
      this._updateMinMaxDisplay(graphId, data, colorFn);
    } else {
      this._clearMinMaxMarkers(graphId);
    }

    if (points.length < 2) return;

    const ts = Date.now();
    const gradientId = `gradient-${graphId}-${ts}`;
    const fillGradientId = `fill-${graphId}-${ts}`;
    // Horizontal color gradients in user space: stops follow each point's X
    // position, and (unlike the default bounding-box units) a perfectly flat
    // line — a steady PM 0 or NOx Index 1 — still gets painted; a zero-height
    // bounding box makes the browser drop the stroke entirely.
    const stopPct = (px) => (((px - padding) / (width - 2 * padding)) * 100);
    const colorGradient = (id, pts) => `
          <linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${padding}" y1="0" x2="${width - padding}" y2="0">
            ${pts.map(p => `<stop offset="${stopPct(p.x).toFixed(2)}%" style="stop-color:${p.color}" />`).join('')}
          </linearGradient>`;
    const pathOf = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');

    const linePath = pathOf(points);
    const areaPath = linePath + ` L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
    const hasOverlay = outdoorPoints.length >= 2;
    const overlayGradientId = `outdoor-gradient-${graphId}-${ts}`;

    // The area under the line is a faint neutral fade (currentColor), masked
    // to the line's shape; the overlay (outdoor / long-term) is dashed.
    svg.innerHTML = `
        <defs>
          ${colorGradient(gradientId, points)}
          ${hasOverlay ? colorGradient(overlayGradientId, outdoorPoints) : ''}
          <linearGradient id="${fillGradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:currentColor;stop-opacity:0.2" />
            <stop offset="100%" style="stop-color:currentColor;stop-opacity:0.02" />
          </linearGradient>
          <mask id="mask-${graphId}">
            <path d="${areaPath}" fill="white" />
          </mask>
        </defs>
        <rect x="0" y="0" width="${width}" height="${height}" fill="url(#${fillGradientId})" mask="url(#mask-${graphId})" />
        <path d="${linePath}" stroke="url(#${gradientId})" class="graph-line" fill="none" />
        ${hasOverlay ? `<path d="${pathOf(outdoorPoints)}" stroke="url(#${overlayGradientId})" class="graph-line" fill="none" stroke-dasharray="4 3" opacity="0.5" />` : ''}
      `;

    if (timeAxis && points.length > 0) {
      // Use the configured time window so labels match the X scale even when
      // data doesn't span the full window (e.g. sensor unavailable for hours).
      const win = this._timeWindow || { start: points[0].time, end: points[points.length - 1].time };
      const startTime = new Date(win.start);
      const endTime = new Date(win.end);
      const midTime = new Date((win.start + win.end) / 2);

      const formatTime = (d) => this._formatAxisTime(d);
      timeAxis.innerHTML = `
        <span>${formatTime(startTime)}</span>
        <span>${formatTime(midTime)}</span>
        <span>${formatTime(endTime)}</span>
      `;
    }
  }

  // Wired once per render (not per graph redraw, which happens every minute
  // and on every streamed state). Tap/Enter opens HA's more-info dialog;
  // mouse hover or a touch press-and-hold scrubs the graph.
  _setupGraphInteractions() {
    for (const graphId of GRAPH_ORDER) {
      const container = this.shadowRoot.getElementById(`${graphId}-graph-container`);
      const graphEl = this.shadowRoot.getElementById(`${graphId}-graph`);
      if (!container || !graphEl) continue;
      const entityId = this._graphEntity(graphId);
      let suppressClickUntil = 0;
      const openMoreInfo = () => this.dispatchEvent(new CustomEvent('hass-more-info', {
        bubbles: true,
        composed: true,
        detail: { entityId }
      }));
      container.addEventListener('click', () => {
        if (Date.now() < suppressClickUntil) return; // the tap ended a scrub
        openMoreInfo();
      });
      container.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openMoreInfo();
        }
      });

      graphEl.addEventListener('mouseenter', () => this._showCursor(graphId));
      graphEl.addEventListener('mouseleave', () => this._hideCursor(graphId));
      graphEl.addEventListener('mousemove', (e) => this._updateCursor(graphId, e));

      // Touch: holding still for 200 ms starts a scrub; moving first is a
      // page scroll and must stay one (state is per graph and always reset,
      // so a scroll can never leave the graph swallowing later gestures).
      let touchTimer = null;
      let scrubbing = false;
      let origin = null;
      graphEl.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        origin = { x: touch.clientX, y: touch.clientY };
        touchTimer = setTimeout(() => {
          touchTimer = null;
          scrubbing = true;
          this._showCursor(graphId);
          this._updateCursor(graphId, touch);
        }, 200);
      }, { passive: true });
      graphEl.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        if (scrubbing) {
          e.preventDefault();
          this._updateCursor(graphId, touch);
        } else if (touchTimer && Math.hypot(touch.clientX - origin.x, touch.clientY - origin.y) > 8) {
          clearTimeout(touchTimer);
          touchTimer = null;
        }
      }, { passive: false });
      const endTouch = () => {
        clearTimeout(touchTimer);
        touchTimer = null;
        if (scrubbing) {
          scrubbing = false;
          suppressClickUntil = Date.now() + 500;
          setTimeout(() => this._hideCursor(graphId), 1000);
        }
      };
      graphEl.addEventListener('touchend', endTouch);
      graphEl.addEventListener('touchcancel', endTouch);
    }
  }

  // HA-style tap / hold / double-tap for a plain element (HA's action-handler
  // directive is internal to its Lit components): 500 ms hold, 250 ms
  // double-tap window, movement or a scroll cancels a hold, and Enter/Space
  // count as a tap for keyboard users.
  _bindActions(el, { tap, hold, doubleTap }) {
    let holdTimer = null;
    let held = false;
    let tapTimer = null;
    let origin = null;
    const cancelHold = () => { clearTimeout(holdTimer); holdTimer = null; };
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      held = false;
      origin = { x: e.clientX, y: e.clientY };
      if (hold) holdTimer = setTimeout(() => { holdTimer = null; held = true; hold(); }, 500);
    });
    el.addEventListener('pointermove', (e) => {
      if (holdTimer && Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > 10) cancelHold();
    });
    el.addEventListener('pointerup', cancelHold);
    el.addEventListener('pointerleave', cancelHold);
    el.addEventListener('pointercancel', cancelHold);
    if (hold) el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('click', () => {
      if (held) { held = false; return; }
      if (doubleTap) {
        if (tapTimer) {
          clearTimeout(tapTimer);
          tapTimer = null;
          doubleTap();
          return;
        }
        tapTimer = setTimeout(() => { tapTimer = null; if (tap) tap(); }, 250);
        return;
      }
      if (tap) tap();
    });
    el.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && tap) {
        e.preventDefault();
        tap();
      }
    });
  }

  _bindActivation(el, activate) {
    this._bindActions(el, { tap: activate });
  }

  _showCursor(graphId) {
    const cursor = this.shadowRoot.getElementById(`${graphId}-cursor`);
    const tooltip = this.shadowRoot.getElementById(`${graphId}-tooltip`);
    if (cursor) cursor.style.display = 'block';
    if (tooltip) tooltip.style.display = 'block';
  }

  _hideCursor(graphId) {
    const cursor = this.shadowRoot.getElementById(`${graphId}-cursor`);
    const tooltip = this.shadowRoot.getElementById(`${graphId}-tooltip`);
    if (cursor) cursor.style.display = 'none';
    if (tooltip) tooltip.style.display = 'none';
  }

  _updateCursor(graphId, event) {
    const graphEl = this.shadowRoot.getElementById(`${graphId}-graph`);
    const cursor = this.shadowRoot.getElementById(`${graphId}-cursor`);
    const tooltip = this.shadowRoot.getElementById(`${graphId}-tooltip`);
    const data = this._graphData[graphId];

    if (!graphEl || !cursor || !tooltip || !data || !data.points.length) return;

    const rect = graphEl.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));

    const targetX = pct * 300;
    let closest = data.points[0];
    let minDist = Math.abs(closest.x - targetX);

    for (const point of data.points) {
      const dist = Math.abs(point.x - targetX);
      if (dist < minDist) {
        minDist = dist;
        closest = point;
      }
    }

    cursor.style.left = `${pct * 100}%`;
    cursor.style.background = closest.color;
    cursor.style.setProperty('--cursor-color', closest.color);

    const valueEl = tooltip.querySelector('.graph-tooltip-value');
    const outdoorEl = tooltip.querySelector('.graph-tooltip-outdoor');
    const timeEl = tooltip.querySelector('.graph-tooltip-time');

    const formatVal = (val) => {
      const number = this._formatGraphValue(val, graphId);
      if (!data.unit) return number;
      return data.unit === '%' ? `${number}%` : `${number} ${data.unit}`;
    };

    if (valueEl) {
      valueEl.textContent = formatVal(closest.value);
      valueEl.style.color = closest.color;
    }

    // Show outdoor value in tooltip if available
    if (outdoorEl) {
      if (data.outdoorPoints && data.outdoorPoints.length) {
        let closestOutdoor = data.outdoorPoints[0];
        let minOutdoorDist = Math.abs(closestOutdoor.x - targetX);
        for (const point of data.outdoorPoints) {
          const dist = Math.abs(point.x - targetX);
          if (dist < minOutdoorDist) {
            minOutdoorDist = dist;
            closestOutdoor = point;
          }
        }
        outdoorEl.textContent = `${data.outdoorLabel}: ${formatVal(closestOutdoor.value)}`;
        outdoorEl.style.color = closestOutdoor.color;
        outdoorEl.style.display = 'block';
      } else {
        outdoorEl.style.display = 'none';
      }
    }

    if (timeEl && closest.time) {
      const time = new Date(closest.time);
      timeEl.textContent = this._formatTooltipTime(time);
    }

    let tooltipX = pct * 100;
    if (tooltipX < 12) tooltipX = 12;
    if (tooltipX > 88) tooltipX = 88;
    tooltip.style.left = `${tooltipX}%`;
  }
}

// Register the card
customElements.define('air-quality-card', AirQualityCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'air-quality-card',
  name: 'Air Quality Card',
  description: 'A custom card for air quality monitoring with WHO-based thresholds and gradient graphs',
  preview: true,
  documentationURL: 'https://github.com/KadenThomp36/air-quality-card',
  // Card picker suggestions (HA 2026.6+): offered for air-quality sensors,
  // pre-filled with the rest of that device's sensors.
  getEntitySuggestion(hass, entityId) {
    const metric = DEVICE_CLASS_METRIC[hass?.states?.[entityId]?.attributes?.device_class];
    if (!SUGGEST_FOR.includes(metric)) return null;
    return { config: configForDevice(hass, entityId) };
  }
});

console.info(
  `%c AIR-QUALITY-CARD %c v${CARD_VERSION} `,
  'color: white; background: #4caf50; font-weight: bold;',
  'color: #4caf50; background: white; font-weight: bold;'
);

// ============================================
// VISUAL CONFIGURATION EDITOR
// HA's built-in form editor via the card's static getConfigForm(): HA renders
// the ha-form itself, so the card needs no editor element and no Lit.
// ============================================

// Fields whose labels HA already translates (ui.panel.lovelace.editor.card.
// generic.*): returning nothing from computeLabel lets HA use its own.
const NATIVE_EDITOR_LABELS = ['name', 'hours_to_show', 'tap_action', 'hold_action', 'double_tap_action', 'interactions'];

function configForm() {
  const sensor = (name) => ({ name, selector: { entity: { domain: 'sensor' } } });
  const pair = (a, b) => ({ type: 'grid', name: '', schema: [sensor(a), sensor(b)] });
  return {
    schema: [
      { name: 'name', selector: { text: {} } },
      pair('co2_entity', 'pm25_entity'),
      pair('humidity_entity', 'temperature_entity'),
      {
        type: 'expandable', name: 'section_additional', flatten: true,
        schema: [
          pair('radon_entity', 'radon_longterm_entity'),
          pair('co_entity', 'hcho_entity'),
          pair('tvoc_entity', 'pm4_entity'),
          pair('nox_entity', 'pm1_entity'),
          pair('pm10_entity', 'pm03_entity'),
          pair('c3h8_entity', 'o2_entity'),
          pair('no2_entity', 'o3_entity'),
          pair('pressure_entity', 'noise_entity')
        ]
      },
      {
        type: 'expandable', name: 'section_outdoor', flatten: true,
        schema: [
          pair('outdoor_co2_entity', 'outdoor_pm25_entity'),
          pair('outdoor_humidity_entity', 'outdoor_temperature_entity'),
          pair('outdoor_co_entity', 'outdoor_hcho_entity'),
          pair('outdoor_tvoc_entity', 'outdoor_pm1_entity'),
          pair('outdoor_pm10_entity', 'outdoor_pm03_entity'),
          pair('outdoor_nox_entity', 'outdoor_no2_entity'),
          pair('outdoor_o3_entity', 'outdoor_pressure_entity')
        ]
      },
      {
        type: 'expandable', name: 'interactions', flatten: true,
        schema: [
          { name: 'tap_action', selector: { ui_action: { default_action: 'none' } } },
          { name: 'hold_action', selector: { ui_action: { default_action: 'none' } } },
          { name: 'double_tap_action', selector: { ui_action: { default_action: 'none' } } },
          { name: 'recommendation_action', selector: { ui_action: { default_action: 'none' } } }
        ]
      },
      {
        type: 'expandable', name: 'section_advanced', flatten: true,
        schema: [
          sensor('air_quality_entity'),
          { name: 'hours_to_show', default: 24, selector: { number: { min: 1, max: 168, mode: 'box', unit_of_measurement: 'h' } } },
          { name: 'show_min_max', selector: { boolean: {} } },
          { name: 'y_scale', selector: { select: { options: [{ value: 'fixed', label: 'Fixed (full metric range)' }, { value: 'auto', label: 'Auto (zoom to data)' }], mode: 'dropdown' } } },
          { name: 'show_status_banner', default: true, selector: { boolean: {} } },
          { name: 'order', selector: { select: { multiple: true, mode: 'list', options: [
            { value: 'co', label: 'CO' },
            { value: 'radon', label: 'Radon' },
            { value: 'co2', label: 'CO₂' },
            { value: 'pm25', label: 'PM2.5' },
            { value: 'pm10', label: 'PM10' },
            { value: 'pm1', label: 'PM1' },
            { value: 'pm03', label: 'PM0.3' },
            { value: 'pm4', label: 'PM4' },
            { value: 'hcho', label: 'HCHO' },
            { value: 'tvoc', label: 'tVOC' },
            { value: 'nox', label: 'NOx' },
            { value: 'no2', label: 'NO₂' },
            { value: 'o3', label: 'O₃' },
            { value: 'o2', label: 'O₂' },
            { value: 'c3h8', label: 'Propane' },
            { value: 'humidity', label: 'Humidity' },
            { value: 'temperature', label: 'Temperature' },
            { value: 'noise', label: 'Noise' },
            { value: 'pressure', label: 'Pressure' }
          ] } } },
          { name: 'display', selector: { select: { options: [{ value: 'full', label: 'Full (graphs and details)' }, { value: 'compact', label: 'Compact (status badge only)' }, { value: 'expandable', label: 'Expandable (compact, tap to expand)' }], mode: 'dropdown' } } },
          { name: 'compact_alerts', default: true, selector: { boolean: {} } },
          { name: 'auto_expand', selector: { boolean: {} } },
          { name: 'language', selector: { select: { options: [{ value: 'auto', label: 'Auto (from HA)' }, { value: 'en', label: 'English' }, { value: 'es', label: 'Español' }, { value: 'fr', label: 'Français' }, { value: 'de', label: 'Deutsch' }, { value: 'pt', label: 'Português' }, { value: 'hu', label: 'Magyar' }, { value: 'pl', label: 'Polski' }], mode: 'dropdown' } } },
          { name: 'temperature_unit', selector: { select: { options: [{ value: 'auto', label: 'Auto (from sensor/HA)' }, { value: 'F', label: 'Fahrenheit (°F)' }, { value: 'C', label: 'Celsius (°C)' }], mode: 'dropdown' } } },
          { name: 'temperature_decimals', selector: { boolean: {} } },
          { name: 'radon_unit', selector: { select: { options: [{ value: 'auto', label: 'Auto (from sensor)' }, { value: 'pCi/L', label: 'pCi/L (US)' }, { value: 'Bq/m³', label: 'Bq/m³ (International)' }], mode: 'dropdown' } } },
          { name: 'tvoc_unit', selector: { select: { options: [{ value: 'auto', label: 'Auto-detect' }, { value: 'ppb', label: 'Absolute (ppb)' }, { value: 'index', label: 'VOC Index (Sensirion)' }], mode: 'dropdown' } } },
          { name: 'nox_unit', selector: { select: { options: [{ value: 'auto', label: 'Auto-detect' }, { value: 'ppb', label: 'Absolute (ppb)' }, { value: 'index', label: 'NOx Index (Sensirion)' }], mode: 'dropdown' } } }
        ]
      }
    ],
    // Labels come from the card's own translations in the language the card
    // instances resolved (HA's callback only hands us `localize`).
    computeLabel(schema) {
      if (!schema?.name || NATIVE_EDITOR_LABELS.includes(schema.name)) return undefined;
      const pack = TRANSLATIONS[editorLanguage]?.editor;
      return pack?.[schema.name] ?? TRANSLATIONS.en.editor[schema.name];
    }
  };
}
