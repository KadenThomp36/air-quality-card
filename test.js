/**
 * Air Quality Card v2.6.0 — Unit Tests
 * Run with: node test.js
 *
 * Tests color functions, recommendation waterfall, config validation,
 * and overall status logic by extracting methods from the card class.
 */

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

function section(name) {
  console.log(`\n--- ${name} ---`);
}

// ============================================================
// Extract the class methods by evaluating in a mock DOM context
// ============================================================

// Minimal mock for HTMLElement and customElements
class MockHTMLElement {
  constructor() { this._shadowRoot = {}; }
  attachShadow() { return {}; }
  dispatchEvent() {}
}

// Mock LitElement base for the editor
class MockLitElementBase {
  static get properties() { return {}; }
  static get styles() { return ''; }
  render() { return ''; }
}
MockLitElementBase.prototype.html = (strings, ...values) => strings.join('');
MockLitElementBase.prototype.css = (strings, ...values) => strings.join('');
class MockHuiView extends MockLitElementBase {}

const registeredElements = {};
const mockCustomElements = {
  define(name, cls) { registeredElements[name] = cls; },
  get(name) {
    if (name === 'hui-masonry-view' || name === 'hui-view') return MockHuiView;
    return registeredElements[name];
  }
};

// Patch globals
global.HTMLElement = MockHTMLElement;
global.customElements = mockCustomElements;
global.window = { customCards: [] };
global.document = { createElement: () => ({}) };
global.CustomEvent = class CustomEvent {};
global.console = { ...console, info: () => {} }; // suppress banner

// Load the card
require('./air-quality-card.js');

const CardClass = registeredElements['air-quality-card'];
if (!CardClass) {
  console.error('FATAL: AirQualityCard class not registered');
  process.exit(1);
}

// Create instance with mock hass for method testing
const card = new CardClass();
card._hass = {
  config: { unit_system: { temperature: '°F' } },
  states: {},
  callApi: async () => []
};
card._config = {
  name: 'Test',
  hours_to_show: 24,
  temperature_unit: 'auto'
};

// ============================================================
// COLOR FUNCTION TESTS
// ============================================================

section('CO2 Color');
assert(card._getCO2Color(400) === '#4caf50', 'CO2 400 = green');
assert(card._getCO2Color(700) === '#8bc34a', 'CO2 700 = light green');
assert(card._getCO2Color(900) === '#ffc107', 'CO2 900 = yellow');
assert(card._getCO2Color(1200) === '#ff9800', 'CO2 1200 = orange');
assert(card._getCO2Color(2000) === '#f44336', 'CO2 2000 = red');

section('PM2.5 Color');
assert(card._getPM25Color(3) === '#4caf50', 'PM25 3 = green');
assert(card._getPM25Color(10) === '#8bc34a', 'PM25 10 = light green');
assert(card._getPM25Color(20) === '#ffc107', 'PM25 20 = yellow');
assert(card._getPM25Color(30) === '#ff9800', 'PM25 30 = orange');
assert(card._getPM25Color(50) === '#f44336', 'PM25 50 = red');

section('PM1 Color');
assert(card._getPM1Color(3) === '#4caf50', 'PM1 3 = green');
assert(card._getPM1Color(10) === '#8bc34a', 'PM1 10 = light green');
assert(card._getPM1Color(20) === '#ffc107', 'PM1 20 = yellow');
assert(card._getPM1Color(30) === '#ff9800', 'PM1 30 = orange');
assert(card._getPM1Color(40) === '#f44336', 'PM1 40 = red');

section('PM10 Color');
assert(card._getPM10Color(10) === '#4caf50', 'PM10 10 = green');
assert(card._getPM10Color(30) === '#8bc34a', 'PM10 30 = light green');
assert(card._getPM10Color(60) === '#ffc107', 'PM10 60 = yellow');
assert(card._getPM10Color(100) === '#ff9800', 'PM10 100 = orange');
assert(card._getPM10Color(200) === '#f44336', 'PM10 200 = red');

section('PM0.3 Color');
assert(card._getPM03Color(200) === '#4caf50', 'PM03 200 = green');
assert(card._getPM03Color(800) === '#8bc34a', 'PM03 800 = light green');
assert(card._getPM03Color(2000) === '#ffc107', 'PM03 2000 = yellow');
assert(card._getPM03Color(4000) === '#ff9800', 'PM03 4000 = orange');
assert(card._getPM03Color(6000) === '#f44336', 'PM03 6000 = red');

section('CO Color');
assert(card._getCOColor(2) === '#4caf50', 'CO 2 = green');
assert(card._getCOColor(6) === '#8bc34a', 'CO 6 = light green');
assert(card._getCOColor(20) === '#ffc107', 'CO 20 = yellow');
assert(card._getCOColor(50) === '#ff9800', 'CO 50 = orange');
assert(card._getCOColor(150) === '#f44336', 'CO 150 = red');

section('Radon Color (Bq/m³)');
assert(card._getRadonColor(30) === '#4caf50', 'Radon 30 Bq = green');
assert(card._getRadonColor(80) === '#8bc34a', 'Radon 80 Bq = light green');
assert(card._getRadonColor(120) === '#ffc107', 'Radon 120 Bq = yellow');
assert(card._getRadonColor(200) === '#ff9800', 'Radon 200 Bq = orange');
assert(card._getRadonColor(400) === '#f44336', 'Radon 400 Bq = red');

section('HCHO Color');
assert(card._getHCHOColor(10) === '#4caf50', 'HCHO 10 = green');
assert(card._getHCHOColor(30) === '#8bc34a', 'HCHO 30 = light green');
assert(card._getHCHOColor(80) === '#ffc107', 'HCHO 80 = yellow');
assert(card._getHCHOColor(150) === '#ff9800', 'HCHO 150 = orange');
assert(card._getHCHOColor(300) === '#f44336', 'HCHO 300 = red');

section('tVOC Color');
assert(card._getTVOCColor(50) === '#4caf50', 'tVOC 50 = green');
assert(card._getTVOCColor(200) === '#8bc34a', 'tVOC 200 = light green');
assert(card._getTVOCColor(400) === '#ffc107', 'tVOC 400 = yellow');
assert(card._getTVOCColor(800) === '#ff9800', 'tVOC 800 = orange');
assert(card._getTVOCColor(1500) === '#f44336', 'tVOC 1500 = red');

section('Humidity Color');
assert(card._getHumidityColor(20) === '#ff9800', 'Humidity 20 = orange (too dry)');
assert(card._getHumidityColor(35) === '#8bc34a', 'Humidity 35 = light green');
assert(card._getHumidityColor(45) === '#4caf50', 'Humidity 45 = green (ideal)');
assert(card._getHumidityColor(55) === '#8bc34a', 'Humidity 55 = light green');
assert(card._getHumidityColor(70) === '#ff9800', 'Humidity 70 = orange (too humid)');

section('Pressure Color + Status (bell, #38)');
assert(card._getPressureColor(975) === '#ff9800', 'Pressure 975 = orange (low)');
assert(card._getPressureColor(1000) === '#8bc34a', 'Pressure 1000 = light green (slightly low)');
assert(card._getPressureColor(1013) === '#4caf50', 'Pressure 1013 = green (normal)');
assert(card._getPressureColor(1030) === '#8bc34a', 'Pressure 1030 = light green (slightly high)');
assert(card._getPressureColor(1050) === '#ff9800', 'Pressure 1050 = orange (high)');
assert(card._getMetricStatus('pressure', 1013) === 'Normal', 'Pressure 1013 status = Normal');
assert(card._getMetricStatus('pressure', 975) === 'Low', 'Pressure 975 status = Low');
assert(card._getMetricStatus('pressure', 1050) === 'High', 'Pressure 1050 status = High');
// Custom thresholds work for pressure too (e.g. inHg or a tighter band)
const presCustom = new CardClass();
presCustom.setConfig({ pressure_entity: 'sensor.p', pressure_thresholds: [1000, 1010, 1020, 1030] });
assert(presCustom._getPressureColor(1015) === '#4caf50', 'custom pressure 1015 = green (normal band)');

section('Temperature Color (Fahrenheit)');
card._config.temperature_unit = 'F';
assert(card._getTempColor(60) === '#2196f3', 'Temp 60F = blue');
assert(card._getTempColor(66) === '#03a9f4', 'Temp 66F = light blue');
assert(card._getTempColor(70) === '#4caf50', 'Temp 70F = green');
assert(card._getTempColor(74) === '#ff9800', 'Temp 74F = orange');
assert(card._getTempColor(80) === '#f44336', 'Temp 80F = red');

section('Temperature Color (Celsius)');
card._config.temperature_unit = 'C';
assert(card._getTempColor(15) === '#2196f3', 'Temp 15C = blue');
assert(card._getTempColor(19) === '#03a9f4', 'Temp 19C = light blue');
assert(card._getTempColor(21) === '#4caf50', 'Temp 21C = green');
assert(card._getTempColor(23) === '#ff9800', 'Temp 23C = orange');
assert(card._getTempColor(28) === '#f44336', 'Temp 28C = red');

// ============================================================
// RECOMMENDATION WATERFALL TESTS
// ============================================================

// Helper to set up hass states for recommendation testing
function setStates(states) {
  card._hass.states = {};
  card._config = {
    name: 'Test',
    hours_to_show: 24,
    temperature_unit: 'auto'
  };
  for (const [key, value] of Object.entries(states)) {
    const entityId = `sensor.${key}`;
    card._config[`${key}_entity`] = entityId;
    card._hass.states[entityId] = { state: String(value) };
  }
}

section('Recommendation — CO Safety (highest priority)');
setStates({ co: 150, co2: 2000, pm25: 50 });
assert(card._getRecommendation() === 'CO Danger — Leave Area', 'CO > 100 = CO Danger even with high CO2/PM25');

setStates({ co: 50, co2: 2000 });
assert(card._getRecommendation() === 'CO Warning — Ventilate Now', 'CO > 35 = CO Warning');

setStates({ co: 15 });
assert(card._getRecommendation() === 'CO Elevated — Ventilate', 'CO > 9 = CO Elevated');

setStates({ co: 3 });
assert(card._getRecommendation() === 'All Good', 'CO 3 = All Good');

section('Recommendation — CO not suppressed by outdoor override');
setStates({ co: 150 });
card._config.outdoor_co2_entity = 'sensor.outdoor_co2';
card._config.outdoor_pm25_entity = 'sensor.outdoor_pm25';
card._hass.states['sensor.outdoor_co2'] = { state: '5000' };
card._hass.states['sensor.outdoor_pm25'] = { state: '100' };
assert(card._getRecommendation() === 'CO Danger — Leave Area', 'CO Danger not suppressed by outdoor override');

section('Recommendation — Standard waterfall');
setStates({ co2: 1800 });
assert(card._getRecommendation() === 'Ventilate Now', 'CO2 1800 = Ventilate Now');

setStates({ pm25: 40 });
assert(card._getRecommendation() === 'Run Air Purifier', 'PM25 40 = Run Air Purifier');

setStates({ pm10: 160 });
assert(card._getRecommendation() === 'Run Air Purifier', 'PM10 160 = Run Air Purifier');

setStates({ hcho: 150 });
assert(card._getRecommendation() === 'Ventilate — Formaldehyde', 'HCHO 150 = Ventilate Formaldehyde');

setStates({ tvoc: 600 });
assert(card._getRecommendation() === 'Ventilate — VOCs Elevated', 'tVOC 600 = Ventilate VOCs');

setStates({ pm25: 30, co2: 1100 });
assert(card._getRecommendation() === 'Air Purifier + Ventilate', 'PM25 30 + CO2 1100 = combo');

setStates({ pm25: 30 });
assert(card._getRecommendation() === 'Run Air Purifier', 'PM25 30 alone = Run Air Purifier');

setStates({ pm10: 100 });
assert(card._getRecommendation() === 'Consider Air Purifier', 'PM10 100 = Consider Air Purifier');

setStates({ co2: 1100 });
assert(card._getRecommendation() === 'Open Window', 'CO2 1100 = Open Window');

setStates({ humidity: 25 });
assert(card._getRecommendation() === 'Too Dry', 'Humidity 25 = Too Dry');

setStates({ humidity: 70 });
assert(card._getRecommendation() === 'Too Humid', 'Humidity 70 = Too Humid');

setStates({ co2: 850 });
assert(card._getRecommendation() === 'Consider Ventilating', 'CO2 850 = Consider Ventilating');

setStates({ pm25: 20 });
assert(card._getRecommendation() === 'Consider Ventilating', 'PM25 20 = Consider Ventilating');

setStates({ co2: 400, pm25: 3 });
assert(card._getRecommendation() === 'All Good', 'Low CO2 + PM25 = All Good');

section('Recommendation — Outdoor override');
setStates({ co2: 1100 });
card._config.outdoor_co2_entity = 'sensor.outdoor_co2';
card._hass.states['sensor.outdoor_co2'] = { state: '1500' };
assert(card._getRecommendation() === 'Keep Windows Closed', 'Open Window suppressed when outdoor CO2 worse');

setStates({ pm25: 30, co2: 1100 });
card._config.outdoor_pm25_entity = 'sensor.outdoor_pm25';
card._hass.states['sensor.outdoor_pm25'] = { state: '50' };
assert(card._getRecommendation() === 'Run Air Purifier', 'Combo rec falls back to purifier when outdoor worse');

section('Recommendation — Outdoor without indoor equivalent (#35)');

// Indoor CO2 only (high) + outdoor PM2.5 that is LOW (no indoor PM2.5 configured).
// Previously: outdoorPm25 (8) > indoor pm25 (defaulted 0) → false "keep windows closed".
// Now: with no indoor PM2.5, a low outdoor reading is NOT "worse" → open window stands.
setStates({ co2: 1100 });
card._config.outdoor_pm25_entity = 'sensor.outdoor_pm25';
card._hass.states['sensor.outdoor_pm25'] = { state: '8' };
assert(card._getRecommendation() === 'Open Window', 'low outdoor PM2.5 with no indoor PM2.5 does not falsely suppress ventilation');

// Same setup but outdoor PM2.5 is genuinely concerning (>= elevated tier, 25) → keep closed.
setStates({ co2: 1100 });
card._config.outdoor_pm25_entity = 'sensor.outdoor_pm25';
card._hass.states['sensor.outdoor_pm25'] = { state: '40' };
assert(card._getRecommendation() === 'Keep Windows Closed', 'high outdoor PM2.5 with no indoor PM2.5 keeps windows closed via absolute threshold');

// Outdoor CO2 with no indoor CO2: needs an indoor ventilation trigger to matter.
// Indoor humidity high (too_humid is not a ventilation key), so nothing to suppress — sanity check no crash.
setStates({ co2: 1100 });
card._config.outdoor_co2_entity = 'sensor.outdoor_co2';
card._hass.states['sensor.outdoor_co2'] = { state: '450' }; // typical fresh outdoor air
assert(card._getRecommendation() === 'Open Window', 'normal outdoor CO2 does not suppress (450 is below concerning threshold)');

// ============================================================
// RECOMMENDATION ICON TESTS
// ============================================================

section('Recommendation Icons');
assert(card._getRecommendationIcon('All Good') === 'mdi:check-circle', 'All Good icon');
assert(card._getRecommendationIcon('CO Danger — Leave Area') === 'mdi:alert-octagon', 'CO Danger icon');
assert(card._getRecommendationIcon('CO Warning — Ventilate Now') === 'mdi:alert-octagon', 'CO Warning icon');
assert(card._getRecommendationIcon('CO Elevated — Ventilate') === 'mdi:alert', 'CO Elevated icon');
assert(card._getRecommendationIcon('Consider Air Purifier') === 'mdi:air-purifier', 'Consider Air Purifier icon');
assert(card._getRecommendationIcon('Run Air Purifier') === 'mdi:air-purifier', 'Run Air Purifier icon');
assert(card._getRecommendationIcon('Open Window') === 'mdi:window-open-variant', 'Open Window icon');
assert(card._getRecommendationIcon('Keep Windows Closed') === 'mdi:window-closed-variant', 'Keep Windows Closed icon');

// ============================================================
// CONFIG VALIDATION TESTS
// ============================================================

section('Config Validation');

// Should throw with no entities
let threw = false;
try { card.setConfig({}); } catch (e) { threw = true; }
assert(threw, 'Empty config throws');

// Should accept any single sensor
const singleSensorConfigs = [
  'co2_entity', 'pm25_entity', 'pm1_entity', 'pm10_entity', 'pm03_entity',
  'hcho_entity', 'tvoc_entity', 'co_entity', 'radon_entity', 'humidity_entity', 'temperature_entity'
];
for (const key of singleSensorConfigs) {
  let ok = true;
  try { card.setConfig({ [key]: 'sensor.test' }); } catch (e) { ok = false; }
  assert(ok, `Single ${key} accepted`);
}

// Defaults
card.setConfig({ co2_entity: 'sensor.co2' });
assert(card._config.name === 'Air Quality', 'Default name');
assert(card._config.hours_to_show === 24, 'Default hours_to_show');
assert(card._config.temperature_unit === 'auto', 'Default temperature_unit is auto');
assert(card._config.radon_unit === 'auto', 'Default radon_unit is auto');

// ============================================================
// OVERALL STATUS TESTS
// ============================================================

section('Overall Status');

setStates({ co: 50 });
assert(card._getOverallStatus().status === 'Dangerous', 'CO 50 = Dangerous');
assert(card._getOverallStatus().color === '#d32f2f', 'CO 50 = dark red');

setStates({ co: 15 });
assert(card._getOverallStatus().status === 'Poor', 'CO 15 = Poor');

setStates({ co2: 2000 });
assert(card._getOverallStatus().status === 'Poor', 'CO2 2000 = Poor');

setStates({ co2: 1200 });
assert(card._getOverallStatus().status === 'Fair', 'CO2 1200 = Fair');

setStates({ co2: 900 });
assert(card._getOverallStatus().status === 'Moderate', 'CO2 900 = Moderate');

setStates({ co2: 700 });
assert(card._getOverallStatus().status === 'Good', 'CO2 700 = Good');

setStates({ co2: 400 });
assert(card._getOverallStatus().status === 'Excellent', 'CO2 400 = Excellent');

// ============================================================
// TEMPERATURE UNIT DETECTION
// ============================================================

section('Temperature Unit Detection');

card._config.temperature_unit = 'auto';
card._hass.config.unit_system.temperature = '°C';
assert(card._isCelsius() === true, 'Auto detects Celsius');
assert(card._getTempUnit() === '°C', 'Auto returns °C');

card._hass.config.unit_system.temperature = '°F';
assert(card._isCelsius() === false, 'Auto detects Fahrenheit');
assert(card._getTempUnit() === '°F', 'Auto returns °F');

card._config.temperature_unit = 'C';
assert(card._isCelsius() === true, 'Explicit C override');

card._config.temperature_unit = 'F';
assert(card._isCelsius() === false, 'Explicit F override');

// ============================================================
// RADON UNIT DETECTION
// ============================================================

section('Radon Unit Detection');

card._config.radon_unit = 'auto';
card._config.radon_entity = 'sensor.radon';
card._hass.states['sensor.radon'] = { state: '2.0', attributes: { unit_of_measurement: 'pCi/L' } };
assert(card._getRadonUnit() === 'pCi/L', 'Auto detects pCi/L from entity');
assert(card._isRadonPciL() === true, 'isRadonPciL true for pCi');
assert(card._getRadonBqm3(2.0) === 74, 'pCi/L to Bq/m³ conversion (2.0 * 37 = 74)');

card._hass.states['sensor.radon'] = { state: '100', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getRadonUnit() === 'Bq/m³', 'Auto detects Bq/m³ from entity');

card._config.radon_unit = 'Bq/m³';
assert(card._getRadonUnit() === 'Bq/m³', 'Explicit Bq/m³ override');
assert(card._getRadonBqm3(100) === 100, 'Bq/m³ passthrough');

card._config.radon_unit = 'pCi/L';
assert(card._getRadonUnit() === 'pCi/L', 'Explicit pCi/L override');

// ============================================================
// RADON ADVISORY TESTS
// ============================================================

section('Radon Advisory');

card._config = { name: 'Test', hours_to_show: 24, temperature_unit: 'auto', radon_unit: 'Bq/m³', radon_entity: 'sensor.radon' };
card._hass.states['sensor.radon'] = { state: '350', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getRadonAdvisory().level === 'danger', 'Radon 350 Bq = danger advisory');

card._hass.states['sensor.radon'] = { state: '200', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getRadonAdvisory().level === 'warning', 'Radon 200 Bq = warning advisory');

card._hass.states['sensor.radon'] = { state: '110', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getRadonAdvisory().level === 'info', 'Radon 110 Bq = info advisory');

card._hass.states['sensor.radon'] = { state: '40', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getRadonAdvisory() === null, 'Radon 40 Bq = no advisory');

// ============================================================
// RADON DOES NOT AFFECT RECOMMENDATIONS
// ============================================================

section('Radon does NOT affect recommendations');

setStates({ co2: 400 });
card._config.radon_entity = 'sensor.radon';
card._config.radon_unit = 'Bq/m³';
card._hass.states['sensor.radon'] = { state: '400', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getRecommendation() === 'All Good', 'High radon does not change recommendation');

// ============================================================
// RADON OVERALL STATUS
// ============================================================

section('Radon Overall Status');

setStates({});
card._config.radon_entity = 'sensor.radon';
card._config.radon_unit = 'Bq/m³';
card._hass.states['sensor.radon'] = { state: '300', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getOverallStatus().status === 'Poor', 'Radon 300 Bq = Poor status');

card._hass.states['sensor.radon'] = { state: '150', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getOverallStatus().status === 'Fair', 'Radon 150 Bq = Fair status');

card._hass.states['sensor.radon'] = { state: '50', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getOverallStatus().status === 'Excellent', 'Radon 50 Bq does not degrade status');

// ============================================================
// RADON LONGTERM TESTS
// ============================================================

section('Radon Long-Term Advisory');

// Advisory uses higher of short-term and long-term
card._config = { name: 'Test', hours_to_show: 24, temperature_unit: 'auto', radon_unit: 'Bq/m³', radon_entity: 'sensor.radon', radon_longterm_entity: 'sensor.radon_lt' };
card._hass.states['sensor.radon'] = { state: '50', attributes: { unit_of_measurement: 'Bq/m³' } };
card._hass.states['sensor.radon_lt'] = { state: '200', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getRadonAdvisory().level === 'warning', 'Advisory uses longterm when higher (200 Bq LT = warning)');

card._hass.states['sensor.radon'] = { state: '350', attributes: { unit_of_measurement: 'Bq/m³' } };
card._hass.states['sensor.radon_lt'] = { state: '50', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getRadonAdvisory().level === 'danger', 'Advisory uses short-term when higher (350 Bq ST = danger)');

// Advisory works with only longterm configured
card._config = { name: 'Test', hours_to_show: 24, temperature_unit: 'auto', radon_unit: 'Bq/m³', radon_longterm_entity: 'sensor.radon_lt' };
card._hass.states['sensor.radon_lt'] = { state: '200', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getRadonAdvisory().level === 'warning', 'Advisory works with only longterm entity (200 Bq = warning)');

card._hass.states['sensor.radon_lt'] = { state: '40', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getRadonAdvisory() === null, 'No advisory when longterm is low');

// Advisory subtitle shows both values when both configured
card._config = { name: 'Test', hours_to_show: 24, temperature_unit: 'auto', radon_unit: 'Bq/m³', radon_entity: 'sensor.radon', radon_longterm_entity: 'sensor.radon_lt' };
card._hass.states['sensor.radon'] = { state: '120', attributes: { unit_of_measurement: 'Bq/m³' } };
card._hass.states['sensor.radon_lt'] = { state: '110', attributes: { unit_of_measurement: 'Bq/m³' } };
const advisory = card._getRadonAdvisory();
assert(advisory && advisory.subtitle.includes('Short-term') && advisory.subtitle.includes('Long-term'), 'Advisory subtitle shows both values when both configured');

section('Radon Long-Term Overall Status');

// Overall status uses higher of short-term and long-term
setStates({});
card._config.radon_entity = 'sensor.radon';
card._config.radon_longterm_entity = 'sensor.radon_lt';
card._config.radon_unit = 'Bq/m³';
card._hass.states['sensor.radon'] = { state: '50', attributes: { unit_of_measurement: 'Bq/m³' } };
card._hass.states['sensor.radon_lt'] = { state: '300', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getOverallStatus().status === 'Poor', 'Overall status uses longterm when higher (300 Bq LT = Poor)');

card._hass.states['sensor.radon'] = { state: '150', attributes: { unit_of_measurement: 'Bq/m³' } };
card._hass.states['sensor.radon_lt'] = { state: '50', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getOverallStatus().status === 'Fair', 'Overall status uses short-term when higher (150 Bq ST = Fair)');

// Works with only longterm
card._config = { name: 'Test', hours_to_show: 24, temperature_unit: 'auto', radon_unit: 'Bq/m³', radon_longterm_entity: 'sensor.radon_lt' };
card._hass.states['sensor.radon_lt'] = { state: '300', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getOverallStatus().status === 'Poor', 'Overall status works with only longterm (300 Bq = Poor)');

section('Radon Long-Term Config Validation');

// radon_longterm_entity alone should be valid config
let configValid = true;
try {
  card.setConfig({ radon_longterm_entity: 'sensor.radon_lt' });
} catch (e) {
  configValid = false;
}
assert(configValid, 'radon_longterm_entity alone is valid config');

// ============================================================
// STATUS LABEL TESTS (must match color thresholds)
// ============================================================

section('CO2 Status Label');
assert(card._getCO2Status(400) === 'Excellent', 'CO2 400 = Excellent');
assert(card._getCO2Status(599) === 'Excellent', 'CO2 599 = Excellent');
assert(card._getCO2Status(600) === 'Good', 'CO2 600 = Good (boundary)');
assert(card._getCO2Status(700) === 'Good', 'CO2 700 = Good');
assert(card._getCO2Status(800) === 'Moderate', 'CO2 800 = Moderate (boundary, was missing tier)');
assert(card._getCO2Status(900) === 'Moderate', 'CO2 900 = Moderate (was incorrectly "Good")');
assert(card._getCO2Status(1000) === 'Elevated', 'CO2 1000 = Elevated (boundary)');
assert(card._getCO2Status(1200) === 'Elevated', 'CO2 1200 = Elevated');
assert(card._getCO2Status(1500) === 'Poor', 'CO2 1500 = Poor (boundary)');
assert(card._getCO2Status(2000) === 'Poor', 'CO2 2000 = Poor');

section('Humidity Status Label');
assert(card._getHumidityStatus(20) === 'Too Dry', 'Humidity 20 = Too Dry');
assert(card._getHumidityStatus(30) === 'Dry', 'Humidity 30 = Dry (boundary)');
assert(card._getHumidityStatus(35) === 'Dry', 'Humidity 35 = Dry');
assert(card._getHumidityStatus(40) === 'Comfortable', 'Humidity 40 = Comfortable (boundary)');
assert(card._getHumidityStatus(45) === 'Comfortable', 'Humidity 45 = Comfortable');
assert(card._getHumidityStatus(50) === 'Humid', 'Humidity 50 = Humid (boundary fix)');
assert(card._getHumidityStatus(55) === 'Humid', 'Humidity 55 = Humid');
assert(card._getHumidityStatus(60) === 'Too Humid', 'Humidity 60 = Too Humid (boundary fix)');
assert(card._getHumidityStatus(70) === 'Too Humid', 'Humidity 70 = Too Humid');

section('Temperature Status Label (Celsius)');
card._config.temperature_unit = 'C';
assert(card._getTempStatus(15) === 'Cold', 'Temp 15C = Cold');
assert(card._getTempStatus(18) === 'Cool', 'Temp 18C = Cool (boundary)');
assert(card._getTempStatus(19) === 'Cool', 'Temp 19C = Cool');
assert(card._getTempStatus(20) === 'Comfortable', 'Temp 20C = Comfortable (boundary)');
assert(card._getTempStatus(21) === 'Comfortable', 'Temp 21C = Comfortable');
assert(card._getTempStatus(22) === 'Warm', 'Temp 22C = Warm (boundary fix)');
assert(card._getTempStatus(23) === 'Warm', 'Temp 23C = Warm');
assert(card._getTempStatus(24) === 'Hot', 'Temp 24C = Hot (boundary fix)');
assert(card._getTempStatus(28) === 'Hot', 'Temp 28C = Hot');

section('Temperature Status Label (Fahrenheit)');
card._config.temperature_unit = 'F';
assert(card._getTempStatus(60) === 'Cold', 'Temp 60F = Cold');
assert(card._getTempStatus(65) === 'Cool', 'Temp 65F = Cool (boundary)');
assert(card._getTempStatus(68) === 'Comfortable', 'Temp 68F = Comfortable (boundary)');
assert(card._getTempStatus(70) === 'Comfortable', 'Temp 70F = Comfortable');
assert(card._getTempStatus(72) === 'Warm', 'Temp 72F = Warm (boundary fix)');
assert(card._getTempStatus(74) === 'Warm', 'Temp 74F = Warm');
assert(card._getTempStatus(76) === 'Hot', 'Temp 76F = Hot (boundary fix)');
assert(card._getTempStatus(80) === 'Hot', 'Temp 80F = Hot');
card._config.temperature_unit = 'auto';

// ============================================================
// TIME-BASED GRAPH X COORDINATE TESTS (issue #22)
// ============================================================

section('Graph X by timestamp');

// Setup a 24-hour window: start = 0, end = 86400000
card._timeWindow = { start: 0, end: 86400000 };
const W = 300, P = 2;

assert(card._computeGraphX(0, W, P) === P, 'point at window start → x = padding');
assert(card._computeGraphX(86400000, W, P) === W - P, 'point at window end → x = width - padding');
assert(Math.abs(card._computeGraphX(43200000, W, P) - (W / 2)) < 0.001, 'point at midpoint → x ≈ width/2');

// Points outside the window get clamped (defensive: API can occasionally return slightly out-of-range data)
assert(card._computeGraphX(-1000, W, P) === P, 'point before start → clamped to padding');
assert(card._computeGraphX(86400000 + 1000, W, P) === W - P, 'point after end → clamped to width-padding');

// Unevenly sampled data: a spike at hour 4 of a 24h window must render at ~16.6% of width
// (the bug that #22 reported: previously it would render based on data index, not timestamp)
const fourHoursIn = 4 * 60 * 60 * 1000;
const expectedX = P + (fourHoursIn / 86400000) * (W - 2 * P);
assert(Math.abs(card._computeGraphX(fourHoursIn, W, P) - expectedX) < 0.001,
  '4h-in spike renders at correct fractional X regardless of total data-point count');

// Defensive: zero-span window doesn't NaN
card._timeWindow = { start: 5000, end: 5000 };
assert(card._computeGraphX(5000, W, P) === P, 'zero-span window does not produce NaN');

// Defensive: missing time window doesn't crash
card._timeWindow = null;
assert(card._computeGraphX(12345, W, P) === P, 'missing time window returns padding instead of NaN');

card._timeWindow = undefined;

// ============================================================
// OUTDOOR-ONLY MODE TESTS
// ============================================================

section('Outdoor-Only Mode');

// Outdoor-only config is valid
let outdoorOnlyCard = new CardClass();
let outdoorOnlyValid = true;
try {
  outdoorOnlyCard.setConfig({ outdoor_pm25_entity: 'sensor.outdoor_pm25' });
} catch (e) {
  outdoorOnlyValid = false;
}
assert(outdoorOnlyValid, 'outdoor_pm25_entity alone is valid config');
assert(outdoorOnlyCard._outdoorOnly === true, '_outdoorOnly flag set when only outdoor entities configured');
assert(outdoorOnlyCard._config.pm25_entity === 'sensor.outdoor_pm25', 'outdoor_pm25_entity promoted to pm25_entity');
assert(outdoorOnlyCard._config.outdoor_pm25_entity === undefined, 'outdoor_pm25_entity removed after promotion');

// Multiple outdoor entities all promote
const multiOutdoor = new CardClass();
multiOutdoor.setConfig({
  outdoor_co2_entity: 'sensor.out_co2',
  outdoor_pm25_entity: 'sensor.out_pm25',
  outdoor_temperature_entity: 'sensor.out_temp'
});
assert(multiOutdoor._outdoorOnly === true, 'multi-outdoor: _outdoorOnly true');
assert(multiOutdoor._config.co2_entity === 'sensor.out_co2', 'outdoor_co2_entity promoted');
assert(multiOutdoor._config.pm25_entity === 'sensor.out_pm25', 'outdoor_pm25_entity promoted');
assert(multiOutdoor._config.temperature_entity === 'sensor.out_temp', 'outdoor_temperature_entity promoted');

// Indoor + outdoor: no promotion, outdoor remains as overlay
const mixed = new CardClass();
mixed.setConfig({
  pm25_entity: 'sensor.indoor_pm25',
  outdoor_pm25_entity: 'sensor.outdoor_pm25'
});
assert(mixed._outdoorOnly === false, 'mixed indoor+outdoor: _outdoorOnly false');
assert(mixed._config.pm25_entity === 'sensor.indoor_pm25', 'mixed: indoor entity preserved');
assert(mixed._config.outdoor_pm25_entity === 'sensor.outdoor_pm25', 'mixed: outdoor stays for overlay');

// Empty config still throws
let emptyThrew = false;
try {
  new CardClass().setConfig({});
} catch (e) {
  emptyThrew = true;
}
assert(emptyThrew, 'empty config still throws');

// Recommendations suppressed in outdoor-only mode
const outdoorRec = new CardClass();
outdoorRec.setConfig({ outdoor_co2_entity: 'sensor.out_co2' });
outdoorRec._hass = card._hass;
outdoorRec._hass.states['sensor.out_co2'] = { state: '2000', attributes: {} }; // would normally trigger "Ventilate Now"
assert(outdoorRec._getRecommendation() === null, '_getRecommendation returns null in outdoor-only mode');

// Recommendations work normally with indoor entity
const indoorRec = new CardClass();
indoorRec.setConfig({ co2_entity: 'sensor.in_co2' });
indoorRec._hass = card._hass;
indoorRec._hass.states['sensor.in_co2'] = { state: '2000', attributes: {} };
assert(indoorRec._getRecommendation() === 'Ventilate Now', 'indoor mode: _getRecommendation works normally');

// Restore card._config for downstream tests
card._config = { name: 'Test', hours_to_show: 24, temperature_unit: 'auto' };
card._outdoorOnly = false;

// ============================================================
// MIN/MAX HELPER TESTS (issue #23)
// ============================================================

section('Min/Max Helper');

assert(card._getMinMax(null) === null, 'null data → null');
assert(card._getMinMax([]) === null, 'empty array → null');

const sample = [
  { time: 1, value: 5 },
  { time: 2, value: 10 },
  { time: 3, value: 2 },
  { time: 4, value: 8 }
];
const mm = card._getMinMax(sample);
assert(mm && mm.min === 2, '_getMinMax min = 2');
assert(mm && mm.max === 10, '_getMinMax max = 10');

// Single-point edge case
const single = card._getMinMax([{ time: 1, value: 7 }]);
assert(single.min === 7 && single.max === 7, 'single point: min === max');

// All same values
const flat = card._getMinMax([{ time: 1, value: 4 }, { time: 2, value: 4 }, { time: 3, value: 4 }]);
assert(flat.min === 4 && flat.max === 4, 'flat data: min === max');

section('Graph value formatting');
assert(card._formatGraphValue(5.4, 'ppm') === 5, 'ppm rounds');
assert(card._formatGraphValue(5.4, 'ppb') === 5, 'ppb rounds');
assert(card._formatGraphValue(5.4, 'Bq/m³') === 5, 'Bq/m³ rounds');
assert(card._formatGraphValue(5.4, '°C') === 5, '°C rounds');
assert(card._formatGraphValue(5.45, 'pCi/L') === '5.5', 'pCi/L 1 decimal (rounded)');
assert(card._formatGraphValue(2.3, 'μg/m³') === '2.3', 'μg/m³ 1 decimal');

// Default config has show_min_max: false (opt-in)
const defaultCard = new CardClass();
defaultCard.setConfig({ co2_entity: 'sensor.co2' });
assert(defaultCard._config.show_min_max === false, 'show_min_max defaults to false');

// User can opt in
const minMaxCard = new CardClass();
minMaxCard.setConfig({ co2_entity: 'sensor.co2', show_min_max: true });
assert(minMaxCard._config.show_min_max === true, 'show_min_max can be enabled');

// ============================================================
// CARRY-FORWARD TO NOW (issue #39)
// ============================================================

section('Extend history to now');

const extCard = new CardClass();
extCard.setConfig({ pm1_entity: 'sensor.pm1' });
extCard._hass = { config: { unit_system: { temperature: '°F' } }, states: {} };

// Steady sensor: last history point is hours old, current value present → append point at now
extCard._hass.states['sensor.pm1'] = { state: '0' };
const NOW = 1000000;
const old = [{ time: NOW - 3 * 3600 * 1000, value: 0 }];
const extended = extCard._extendToNow(old, 'sensor.pm1', NOW);
assert(extended.length === 2, 'steady sensor: a point is appended at now');
assert(extended[1].time === NOW, 'appended point is at now');
assert(extended[1].value === 0, 'appended point carries current value (0)');

// Zero is a real value, not dropped
extCard._hass.states['sensor.pm1'] = { state: '0' };
assert(extCard._extendToNow([{ time: NOW - 7200000, value: 5 }], 'sensor.pm1', NOW)[1].value === 0, 'zero current value is carried forward, not dropped');

// Last point already at now → no duplicate
const fresh = [{ time: NOW - 500, value: 3 }];
assert(extCard._extendToNow(fresh, 'sensor.pm1', NOW).length === 1, 'point already at edge → no duplicate appended');

// Empty history → unchanged (nothing to anchor a line to)
assert(extCard._extendToNow([], 'sensor.pm1', NOW).length === 0, 'empty history stays empty');

// Unavailable/unknown current state → no append
extCard._hass.states['sensor.pm1'] = { state: 'unavailable' };
assert(extCard._extendToNow(old, 'sensor.pm1', NOW).length === 1, 'unavailable current state → no append');
extCard._hass.states['sensor.pm1'] = { state: 'unknown' };
assert(extCard._extendToNow(old, 'sensor.pm1', NOW).length === 1, 'unknown current state → no append');

// Non-numeric current state → no append
extCard._hass.states['sensor.pm1'] = { state: 'foo' };
assert(extCard._extendToNow(old, 'sensor.pm1', NOW).length === 1, 'non-numeric current state → no append');

// No entity id → unchanged
assert(extCard._extendToNow(old, undefined, NOW).length === 1, 'missing entity id → unchanged');

// ============================================================
// METRIC ORDERING (issue #19)
// ============================================================

section('Metric order — default');

const defaultOrderCard = new CardClass();
defaultOrderCard.setConfig({ co2_entity: 'sensor.co2' });
const defaultOrder = defaultOrderCard._getMetricOrder();
assert(defaultOrder[0] === 'co', 'default order: co first');
assert(defaultOrder[defaultOrder.length - 1] === 'pressure', 'default order: pressure last');
assert(defaultOrder.length === 18, 'default order: all 18 metrics');

section('Metric order — user override');

const reorderedCard = new CardClass();
reorderedCard.setConfig({
  co2_entity: 'sensor.co2',
  order: ['temperature', 'humidity', 'co2', 'pm10', 'pm25']
});
const reordered = reorderedCard._getMetricOrder();
assert(reordered[0] === 'temperature', 'user order: temperature first');
assert(reordered[1] === 'humidity', 'user order: humidity second');
assert(reordered[2] === 'co2', 'user order: co2 third');
assert(reordered[3] === 'pm10', 'user order: pm10 fourth');
assert(reordered[4] === 'pm25', 'user order: pm25 fifth');
// Unmentioned metrics get appended in default order — user never loses a sensor
assert(reordered.includes('radon'), 'unmentioned metrics still present');
assert(reordered.length === 18, 'user order: total still 18');

section('Metric order — invalid input');

const badOrderCard = new CardClass();
badOrderCard.setConfig({ co2_entity: 'sensor.co2', order: 'not an array' });
const fallback = badOrderCard._getMetricOrder();
assert(fallback[0] === 'co', 'non-array order falls back to defaults');

const partialBadCard = new CardClass();
partialBadCard.setConfig({
  co2_entity: 'sensor.co2',
  order: ['temperature', 'invalid_metric', 'co2']
});
const filtered = partialBadCard._getMetricOrder();
assert(filtered.indexOf('temperature') === 0, 'invalid metrics are dropped, valid ones preserved');
assert(filtered.indexOf('co2') === 1, 'invalid entries skipped in order');
assert(!filtered.includes('invalid_metric'), 'invalid metric never appears');

const emptyOrderCard = new CardClass();
emptyOrderCard.setConfig({ co2_entity: 'sensor.co2', order: [] });
assert(emptyOrderCard._getMetricOrder()[0] === 'co', 'empty array → default order');

// ============================================================
// RECOMMENDATION ACTION BUTTON (issue #34)
// ============================================================

section('Recommendation action');

// No action configured → _fireRecommendationAction is a no-op
const noRecAction = new CardClass();
noRecAction.setConfig({ co2_entity: 'sensor.co2' });
let recFired = null;
noRecAction.dispatchEvent = (ev) => { recFired = ev; };
noRecAction._fireRecommendationAction();
assert(recFired === null, 'no recommendation_action configured → no event');

// Configured → dispatches hass-action
const withRecAction = new CardClass();
withRecAction.setConfig({
  co2_entity: 'sensor.co2',
  recommendation_action: { action: 'perform-action', perform_action: 'homeassistant.toggle', target: { entity_id: 'fan.purifier' } }
});
let recEvent = null;
withRecAction.dispatchEvent = (ev) => { recEvent = ev; };
withRecAction._fireRecommendationAction();
assert(recEvent !== null, 'recommendation_action configured → hass-action dispatched');

// ============================================================
// COMPACT DISPLAY MODE (issue #20)
// ============================================================

section('Compact mode — config');

const compactCard = new CardClass();
compactCard.setConfig({ co2_entity: 'sensor.co2', display: 'compact' });
assert(compactCard._config.display === 'compact', 'display: compact accepted');
assert(compactCard._isCompact() === true, '_isCompact() true for compact display');

const fullCard = new CardClass();
fullCard.setConfig({ co2_entity: 'sensor.co2' });
assert(fullCard._config.display === 'full', 'display defaults to full');
assert(fullCard._isCompact() === false, '_isCompact() false for default display');

// Card size: compact should be smaller
assert(compactCard.getCardSize() === 1, 'compact getCardSize = 1');
assert(fullCard.getCardSize() >= 3, 'full getCardSize ≥ 3');

section('Expandable display mode (#36)');

const expCard = new CardClass();
expCard.setConfig({ co2_entity: 'sensor.co2', display: 'expandable' });
assert(expCard._isExpandable() === true, '_isExpandable() true for expandable display');
// Collapsed by default → renders compact
assert(expCard._isCompact() === true, 'expandable starts collapsed (compact)');
assert(expCard.getCardSize() === 1, 'collapsed expandable getCardSize = 1');
// Simulate expand
expCard._expanded = true;
assert(expCard._isCompact() === false, 'expanded → full render');
assert(expCard.getCardSize() >= 3, 'expanded expandable getCardSize ≥ 3');
// Full mode is not expandable
assert(fullCard._isExpandable() === false, 'full display is not expandable');
assert(compactCard._isExpandable() === false, 'static compact is not expandable');

// ============================================================
// COMPACT ALERT CHIPS + AUTO-EXPAND (issue #40)
// ============================================================

section('Abnormal metric detection (#40)');

const abCard = new CardClass();
abCard.setConfig({
  co2_entity: 'sensor.co2', pm25_entity: 'sensor.pm25',
  humidity_entity: 'sensor.hum', temperature_entity: 'sensor.temp'
});
abCard._hass = { config: { unit_system: { temperature: '°F' } }, states: {
  'sensor.co2': { state: '1600' },                    // Poor → red
  'sensor.pm25': { state: '20' },                     // Moderate → amber
  'sensor.hum': { state: '45' },                      // Comfortable → green
  'sensor.temp': { state: '66', attributes: {} }      // Cool → light blue (calm)
} };
let abnormal = abCard._getAbnormalMetrics();
assert(abnormal.length === 2, 'two metrics out of range');
assert(abnormal[0].metric === 'co2', 'most severe first (red CO2)');
assert(abnormal[0].color === '#f44336', 'CO2 chip is red');
assert(abnormal[0].label === 'CO₂', 'CO2 chip label');
assert(abnormal[1].metric === 'pm25', 'amber PM2.5 second');
assert(abnormal[1].status === 'Moderate', 'chip carries the status label');

// Cold (blue) is outside the comfort band → flagged; Cool (light blue) is not
abCard._hass.states['sensor.temp'].state = '60';
abnormal = abCard._getAbnormalMetrics();
assert(abnormal.some(c => c.metric === 'temperature' && c.color === '#2196f3'), 'Cold temperature flagged');

// All healthy → empty
abCard._hass.states['sensor.co2'].state = '500';
abCard._hass.states['sensor.pm25'].state = '3';
abCard._hass.states['sensor.temp'].state = '70';
assert(abCard._getAbnormalMetrics().length === 0, 'all healthy → no chips');

// Unavailable sensor is skipped, not flagged as Too Dry at implicit 0
abCard._hass.states['sensor.hum'].state = 'unavailable';
assert(abCard._getAbnormalMetrics().length === 0, 'unavailable sensor skipped');
abCard._hass.states['sensor.hum'].state = '25';
abnormal = abCard._getAbnormalMetrics();
assert(abnormal.length === 1 && abnormal[0].status === 'Too Dry', 'Too Dry humidity flagged');
assert(abnormal[0].label === 'Humidity', 'humidity chip label localized (en)');

// Chip labels for word-metrics follow the card language
const abEs = new CardClass();
abEs.setConfig({ humidity_entity: 'sensor.hum', language: 'es' });
abEs._hass = { config: { unit_system: { temperature: '°F' } }, states: { 'sensor.hum': { state: '25' } } };
const abEsChips = abEs._getAbnormalMetrics();
assert(abEsChips.length === 1 && abEsChips[0].label === 'Humedad', 'humidity chip label localized (es)');

// Radon uses max(short, long) in Bq/m³
const radonAbCard = new CardClass();
radonAbCard.setConfig({ radon_entity: 'sensor.radon' });
radonAbCard._hass = { config: { unit_system: { temperature: '°F' } }, states: {
  'sensor.radon': { state: '200', attributes: { unit_of_measurement: 'Bq/m³' } }
} };
abnormal = radonAbCard._getAbnormalMetrics();
assert(abnormal.length === 1 && abnormal[0].metric === 'radon', 'high radon flagged');
radonAbCard._hass.states['sensor.radon'].state = '20';
assert(radonAbCard._getAbnormalMetrics().length === 0, 'low radon not flagged');

// compact_alerts defaults on
assert(abCard._config.compact_alerts === true, 'compact_alerts defaults to true');

section('Auto-expand (#40)');

const aeCard = new CardClass();
aeCard.setConfig({ co2_entity: 'sensor.co2', display: 'expandable', auto_expand: true });
aeCard._hass = { config: { unit_system: { temperature: '°F' } }, states: { 'sensor.co2': { state: '1600' } } };
let aeRenders = 0;
aeCard._initialRender = () => { aeRenders++; };
aeCard._loadHistory = () => {};
aeCard._renderGraphs = () => {};
aeCard._maybeAutoExpand();
assert(aeCard._expanded === true, 'out-of-range CO2 → auto-expanded');
assert(aeRenders === 1, 'auto-expand re-rendered once');
aeCard._maybeAutoExpand();
assert(aeRenders === 1, 'no state change → no re-render');
// Recovery inside the 5-minute hysteresis window → stays expanded (no flapping)
aeCard._hass.states['sensor.co2'].state = '500';
aeCard._maybeAutoExpand();
assert(aeCard._expanded === true, 'recovered <5 min ago → stays expanded (hysteresis)');
// Once readings have been clean past the window → auto-collapse
aeCard._lastAbnormalMs = Date.now() - 301000;
aeCard._maybeAutoExpand();
assert(aeCard._expanded === false, 'clean for 5+ minutes → auto-collapsed');
// A manual toggle takes over for the session
aeCard._hass.states['sensor.co2'].state = '1600';
aeCard._updateStates = () => {};
aeCard._toggleExpanded(); // manual expand
assert(aeCard._userToggled === true, '_toggleExpanded marks manual override');
aeCard._hass.states['sensor.co2'].state = '500';
aeCard._maybeAutoExpand();
assert(aeCard._expanded === true, 'manual toggle pins state against auto-collapse');

// auto_expand is a no-op without expandable display or without opt-in
const aeFull = new CardClass();
aeFull.setConfig({ co2_entity: 'sensor.co2', auto_expand: true });
aeFull._hass = { config: { unit_system: { temperature: '°F' } }, states: { 'sensor.co2': { state: '1600' } } };
aeFull._initialRender = () => { throw new Error('should not re-render'); };
aeFull._maybeAutoExpand();
assert(aeFull._expanded === false, 'auto_expand ignored for full display');
const aeNoOpt = new CardClass();
aeNoOpt.setConfig({ co2_entity: 'sensor.co2', display: 'expandable' });
aeNoOpt._hass = { config: { unit_system: { temperature: '°F' } }, states: { 'sensor.co2': { state: '1600' } } };
aeNoOpt._initialRender = () => { throw new Error('should not re-render'); };
aeNoOpt._maybeAutoExpand();
assert(aeNoOpt._expanded === false, 'expandable without auto_expand stays collapsed');

// The hass setter is the production trigger for auto-expand — wire-test it
const aeWire = new CardClass();
aeWire.setConfig({ co2_entity: 'sensor.co2', display: 'expandable', auto_expand: true });
let aeWireHistory = 0;
aeWire._initialRender = () => {};
aeWire._updateStates = () => {};
aeWire._loadHistory = () => { aeWireHistory++; };
aeWire._renderGraphs = () => {};
aeWire.hass = { config: { unit_system: { temperature: '°F' } }, states: { 'sensor.co2': { state: '500' } } };
assert(aeWire._expanded === false, 'hass setter: healthy reading stays collapsed');
assert(aeWireHistory === 0, 'collapsed expandable skips the history fetch');
aeWire.hass = { config: { unit_system: { temperature: '°F' } }, states: { 'sensor.co2': { state: '1600' } } };
assert(aeWire._expanded === true, 'hass setter wires _maybeAutoExpand (unhealthy → expanded)');
assert(aeWireHistory === 1, 'auto-expand lazily loads history');

section('Alert chip priorities and exclusions (#40)');

// Pressure is informational — never a chip, never an auto-expand trigger
const presCard = new CardClass();
presCard.setConfig({ pressure_entity: 'sensor.press' });
presCard._hass = { config: { unit_system: { temperature: '°F' } }, states: { 'sensor.press': { state: '980' } } };
assert(presCard._getAbnormalMetrics().length === 0, 'informational pressure never produces a chip');

// Life-safety CO leads the chip row even when other metrics have redder tiers
const coChipCard = new CardClass();
coChipCard.setConfig({ co_entity: 'sensor.co', co2_entity: 'sensor.co2', humidity_entity: 'sensor.hum' });
coChipCard._hass = { config: { unit_system: { temperature: '°F' } }, states: {
  'sensor.co': { state: '12' },    // yellow warning tier
  'sensor.co2': { state: '1600' }, // red
  'sensor.hum': { state: '25' }    // orange Too Dry
} };
const coChips = coChipCard._getAbnormalMetrics();
assert(coChips.length === 3, 'CO + CO2 + humidity all flagged');
assert(coChips[0].metric === 'co', 'life-safety CO sorts first even at a lower tier color');

// Index-mode tVOC and NOx route through their metric-key special cases
const idxChipCard = new CardClass();
idxChipCard.setConfig({ tvoc_entity: 'sensor.tvoc', nox_entity: 'sensor.nox', tvoc_unit: 'index', nox_unit: 'index' });
idxChipCard._hass = { config: { unit_system: { temperature: '°F' } }, states: {
  'sensor.tvoc': { state: '300' },
  'sensor.nox': { state: '200' }
} };
const idxChips = idxChipCard._getAbnormalMetrics();
assert(idxChips.length === 2, 'index-mode tVOC and NOx both flagged');
assert(idxChips.some(c => c.metric === 'tvoc' && c.color === '#ff9800'), 'tVOC index 300 → orange via _tvocMetric');
assert(idxChips.some(c => c.metric === 'nox' && c.color === '#ff9800'), 'NOx index 200 → orange via _noxMetric');

// ============================================================
// NOX INDEX + OUTDOOR NOX (issue #41)
// ============================================================

section('NOx measurement type auto-detection (#41)');

const noxCard = new CardClass();
noxCard.setConfig({ nox_entity: 'sensor.nox' });
// AirGradient / ESPHome SGP41 NOx Index entities carry no unit_of_measurement
noxCard._hass = { config: { unit_system: { temperature: '°F' } }, states: { 'sensor.nox': { state: '1', attributes: {} } } };
assert(noxCard._isNOxIndex() === true, 'missing unit_of_measurement → NOx Index');
assert(noxCard._getNOxUnit() === '', 'index mode has no unit suffix');
assert(noxCard._noxMetric() === 'nox_index', 'index mode uses nox_index thresholds');
noxCard._hass.states['sensor.nox'].attributes = { unit_of_measurement: '' };
assert(noxCard._isNOxIndex() === true, 'empty unit_of_measurement → NOx Index');
noxCard._hass.states['sensor.nox'].attributes = { unit_of_measurement: 'NOx Index' };
assert(noxCard._isNOxIndex() === true, "'NOx Index' unit → NOx Index");
noxCard._hass.states['sensor.nox'].attributes = { unit_of_measurement: 'ppb' };
assert(noxCard._isNOxIndex() === false, 'ppb unit → absolute');
assert(noxCard._getNOxUnit() === 'ppb', 'absolute mode shows ppb');
assert(noxCard._noxMetric() === 'nox_ppb', 'absolute mode uses nox_ppb thresholds');
noxCard._hass.states['sensor.nox'].attributes = { unit_of_measurement: 'µg/m³' }; // U+00B5 micro sign (HA core)
assert(noxCard._isNOxIndex() === false, 'µg/m³ (micro sign) → absolute');
noxCard._hass.states['sensor.nox'].attributes = { unit_of_measurement: 'μg/m³' }; // U+03BC Greek mu (card display strings)
assert(noxCard._isNOxIndex() === false, 'μg/m³ (Greek mu) → absolute');
// Explicit nox_unit config beats auto-detection
noxCard.setConfig({ nox_entity: 'sensor.nox', nox_unit: 'index' });
assert(noxCard._isNOxIndex() === true, 'nox_unit: index forces index mode');
noxCard.setConfig({ nox_entity: 'sensor.nox', nox_unit: 'ppb' });
noxCard._hass.states['sensor.nox'].attributes = {};
assert(noxCard._isNOxIndex() === false, 'nox_unit: ppb forces absolute despite missing unit');
// nox_unit matching is case-insensitive
noxCard.setConfig({ nox_entity: 'sensor.nox', nox_unit: 'Index' });
assert(noxCard._isNOxIndex() === true, 'nox_unit value is case-insensitive');
// µg/m³ sensors keep their real display unit (default thresholds still assume ppb)
noxCard.setConfig({ nox_entity: 'sensor.nox' });
noxCard._hass.states['sensor.nox'].attributes = { unit_of_measurement: 'µg/m³' };
assert(noxCard._getNOxUnit() === 'µg/m³', 'µg/m³ sensor displays µg/m³, not ppb');

section('NOx Index colors (Sensirion/AirGradient bands)');

const noxIdx = new CardClass();
noxIdx.setConfig({ nox_entity: 'sensor.nox', nox_unit: 'index' });
noxIdx._hass = { config: { unit_system: { temperature: '°F' } }, states: {} };
assert(noxIdx._getNOxColor(1) === '#4caf50', 'index 1 (clean-air baseline) = green');
assert(noxIdx._getNOxColor(4) === '#4caf50', 'index 4 = green');
assert(noxIdx._getNOxColor(10) === '#8bc34a', 'index 10 = light green');
assert(noxIdx._getNOxColor(100) === '#ffc107', 'index 100 = yellow');
assert(noxIdx._getNOxColor(200) === '#ff9800', 'index 200 = orange');
assert(noxIdx._getNOxColor(350) === '#f44336', 'index 350 = red');
assert(noxIdx._getMetricStatus('nox_index', 1) === 'Excellent', 'index 1 = Excellent');
assert(noxIdx._getMetricStatus('nox_index', 25) === 'Moderate', 'index 25 = Moderate (>20 Sensirion purifier trigger)');

section('NOx ppb colors (WHO/EPA NO2 anchors)');

const noxPpb = new CardClass();
noxPpb.setConfig({ nox_entity: 'sensor.nox', nox_unit: 'ppb' });
noxPpb._hass = { config: { unit_system: { temperature: '°F' } }, states: {} };
assert(noxPpb._getNOxColor(10) === '#4caf50', 'ppb 10 = green');
assert(noxPpb._getNOxColor(40) === '#8bc34a', 'ppb 40 = light green (under EPA annual 53)');
assert(noxPpb._getNOxColor(80) === '#ffc107', 'ppb 80 = yellow (under EPA 1-hr 100)');
assert(noxPpb._getNOxColor(200) === '#ff9800', 'ppb 200 = orange');
assert(noxPpb._getNOxColor(400) === '#f44336', 'ppb 400 = red (over AQI USG/Unhealthy 360)');

// Custom nox_thresholds override applies in either mode
const noxCustom = new CardClass();
noxCustom.setConfig({ nox_entity: 'sensor.nox', nox_unit: 'index', nox_thresholds: [10, 30, 60, 100] });
noxCustom._hass = { config: { unit_system: { temperature: '°F' } }, states: {} };
assert(noxCustom._getNOxColor(50) === '#ffc107', 'custom nox_thresholds respected in index mode');
noxCustom.setConfig({ nox_entity: 'sensor.nox', nox_unit: 'ppb', nox_thresholds: [10, 30, 60, 100] });
assert(noxCustom._getNOxColor(50) === '#ffc107', 'custom nox_thresholds respected in ppb mode');

section('Outdoor NOx (#41)');

// outdoor_nox_entity alone satisfies config validation and promotes in outdoor-only mode
const outNox = new CardClass();
outNox.setConfig({ outdoor_nox_entity: 'sensor.out_nox' });
assert(outNox._outdoorOnly === true, 'outdoor NOx only → outdoor-only mode');
assert(outNox._config.nox_entity === 'sensor.out_nox', 'outdoor NOx promoted to primary slot');
// Paired with an indoor sensor it stays an overlay
const pairNox = new CardClass();
pairNox.setConfig({ nox_entity: 'sensor.nox', outdoor_nox_entity: 'sensor.out_nox' });
assert(pairNox._outdoorOnly === false, 'indoor+outdoor NOx → normal mode');
assert(pairNox._config.outdoor_nox_entity === 'sensor.out_nox', 'outdoor NOx kept as overlay');

// _loadHistory actually fetches the outdoor NOx entity (calls to callApi are
// issued synchronously before _loadHistory's first await)
const histNox = new CardClass();
histNox.setConfig({ nox_entity: 'sensor.nox', outdoor_nox_entity: 'sensor.out_nox' });
const histCalls = [];
histNox._hass = {
  config: { unit_system: { temperature: '°F' } },
  states: { 'sensor.nox': { state: '1', attributes: {} }, 'sensor.out_nox': { state: '2', attributes: {} } },
  callApi: async (method, uri) => { histCalls.push(uri); return [[{ last_changed: '2026-06-11T00:00:00Z', state: '5' }]]; }
};
histNox._renderGraphs = () => {};
histNox._loadHistory();
assert(histCalls.some(u => u.includes('sensor.nox')), '_loadHistory fetches the indoor NOx entity');
assert(histCalls.some(u => u.includes('sensor.out_nox')), '_loadHistory fetches the outdoor NOx entity');

// ============================================================
// O2, NO2, O3, PROPANE (air-Q Science support)
// ============================================================

section('O2 Color (bell, OSHA-based)');
assert(card._getO2Color(10) === '#f44336', 'O2 10% = red (dangerous, <16%)');
assert(card._getO2Color(18) === '#ff9800', 'O2 18% = orange (low, 16-19.5%)');
assert(card._getO2Color(21) === '#4caf50', 'O2 21% = green (normal, 19.5-23.5%)');
assert(card._getO2Color(24) === '#ff9800', 'O2 24% = orange (enriched, 23.5-25%)');
assert(card._getO2Color(27) === '#f44336', 'O2 27% = red (dangerous, >=25%)');
assert(card._getMetricStatus('o2', 10) === 'Dangerous', 'O2 10% status = Dangerous');
assert(card._getMetricStatus('o2', 21) === 'Normal', 'O2 21% status = Normal');

section('NO2 Color (WHO 2021 + EU AQD anchors)');
assert(card._getNO2Color(5) === '#4caf50', 'NO2 5 µg/m³ = green');
assert(card._getNO2Color(15) === '#8bc34a', 'NO2 15 µg/m³ = light green');
assert(card._getNO2Color(30) === '#ffc107', 'NO2 30 µg/m³ = yellow');
assert(card._getNO2Color(100) === '#ff9800', 'NO2 100 µg/m³ = orange');
assert(card._getNO2Color(250) === '#f44336', 'NO2 250 µg/m³ = red');

section('O3 Color (WHO 2021 + EU AQD anchors)');
assert(card._getO3Color(30) === '#4caf50', 'O3 30 µg/m³ = green');
assert(card._getO3Color(80) === '#8bc34a', 'O3 80 µg/m³ = light green');
assert(card._getO3Color(150) === '#ffc107', 'O3 150 µg/m³ = yellow');
assert(card._getO3Color(200) === '#ff9800', 'O3 200 µg/m³ = orange');
assert(card._getO3Color(300) === '#f44336', 'O3 300 µg/m³ = red');

section('Propane (C3H8) Color (%vol, LEL-anchored safety bands)');
assert(card._getC3H8Color(0.01) === '#4caf50', 'Propane 0.01% = green (safe)');
assert(card._getC3H8Color(0.1) === '#8bc34a', 'Propane 0.1% = light green (low)');
assert(card._getC3H8Color(0.3) === '#ffc107', 'Propane 0.3% = yellow (moderate)');
assert(card._getC3H8Color(0.6) === '#ff9800', 'Propane 0.6% = orange (high)');
assert(card._getC3H8Color(1.5) === '#f44336', 'Propane 1.5% = red (dangerous)');
assert(card._getMetricStatus('c3h8', 0.01) === 'Safe', 'Propane 0.01% status = Safe');
assert(card._getMetricStatus('c3h8', 1.5) === 'Dangerous', 'Propane 1.5% status = Dangerous');

section('Recommendation — Propane/O2 Safety (life-safety like CO)');
setStates({ c3h8: 0.5 });
assert(card._getRecommendation() === 'Gas Leak Danger — Evacuate', 'Propane 0.5% (>=0.42) = Gas Leak Danger');

setStates({ c3h8: 0.3 });
assert(card._getRecommendation() === 'Gas Leak Warning — Ventilate Now', 'Propane 0.3% (>=0.21) = Gas Leak Warning');

setStates({ c3h8: 0.05 });
assert(card._getRecommendation() === 'All Good', 'Propane 0.05% (below warning) = All Good');

setStates({ o2: 14 });
assert(card._getRecommendation() === 'Low Oxygen Danger — Leave Area', 'O2 14% (<16) = Low Oxygen Danger');

setStates({ o2: 18 });
assert(card._getRecommendation() === 'Low Oxygen Warning — Ventilate Now', 'O2 18% (<19.5) = Low Oxygen Warning');

setStates({ o2: 21 });
assert(card._getRecommendation() === 'All Good', 'O2 21% (normal) = All Good');

// CO still wins over propane/O2 (documented top life-safety priority)
setStates({ co: 150, c3h8: 0.5, o2: 10 });
assert(card._getRecommendation() === 'CO Danger — Leave Area', 'CO still takes priority over propane/O2 danger');

// Propane/O2 danger take priority over the CO2/PM2.5 waterfall and radon
setStates({ c3h8: 0.5, co2: 2000, pm25: 50 });
assert(card._getRecommendation() === 'Gas Leak Danger — Evacuate', 'Propane danger overrides CO2/PM2.5 waterfall');

// Not suppressed by outdoor override (mirrors CO's exclusion from ventilationKeys)
setStates({ c3h8: 0.5 });
card._config.outdoor_co2_entity = 'sensor.outdoor_co2';
card._config.outdoor_pm25_entity = 'sensor.outdoor_pm25';
card._hass.states['sensor.outdoor_co2'] = { state: '5000' };
card._hass.states['sensor.outdoor_pm25'] = { state: '100' };
assert(card._getRecommendation() === 'Gas Leak Danger — Evacuate', 'Propane danger not suppressed by outdoor override');

setStates({ o2: 14 });
card._config.outdoor_co2_entity = 'sensor.outdoor_co2';
card._hass.states['sensor.outdoor_co2'] = { state: '5000' };
assert(card._getRecommendation() === 'Low Oxygen Danger — Leave Area', 'O2 danger not suppressed by outdoor override');

section('O2 unconfigured does not trigger a false life-safety alarm (regression guard)');
// Unlike other gases, O2's unconfigured fallback must be null, not 0 — 0% O2
// is the worst possible reading, so a naive `: 0` default would make an
// unconfigured sensor look like a life-threatening emergency.
setStates({ co2: 400 });
assert(card._getRecommendation() === 'All Good', 'no o2_entity configured → no false O2 alarm in recommendation');
assert(card._getOverallStatus().status === 'Excellent', 'no o2_entity configured → no false O2 alarm in overall status');

section('Recommendation — NO2/O3 waterfall + outdoor override');
setStates({ no2: 250 });
assert(card._getRecommendation() === 'Ventilate — NO₂ Elevated', 'NO2 250 µg/m³ (>200) = Ventilate NO2');

setStates({ o3: 250 });
assert(card._getRecommendation() === 'Ventilate — O₃ Elevated', 'O3 250 µg/m³ (>240) = Ventilate O3');

// HCHO still outranks NO2/O3 in the waterfall (checked first)
setStates({ hcho: 150, no2: 250 });
assert(card._getRecommendation() === 'Ventilate — Formaldehyde', 'HCHO outranks NO2 in the waterfall');

// Suppressed/redirected by the existing outdoor CO2/PM2.5-worse override, same as HCHO/tVOC
setStates({ no2: 250, co2: 1100 });
card._config.outdoor_co2_entity = 'sensor.outdoor_co2';
card._hass.states['sensor.outdoor_co2'] = { state: '1200' };
assert(card._getRecommendation() === 'Keep Windows Closed', 'ventilate_no2 suppressed when outdoor CO2 is worse');

section('Outdoor NO2/O3 mirror');

const outNo2 = new CardClass();
outNo2.setConfig({ outdoor_no2_entity: 'sensor.out_no2' });
assert(outNo2._outdoorOnly === true, 'outdoor NO2 only → outdoor-only mode');
assert(outNo2._config.no2_entity === 'sensor.out_no2', 'outdoor NO2 promoted to primary slot');

const pairNo2 = new CardClass();
pairNo2.setConfig({ no2_entity: 'sensor.no2', outdoor_no2_entity: 'sensor.out_no2' });
assert(pairNo2._outdoorOnly === false, 'indoor+outdoor NO2 → normal mode');
assert(pairNo2._config.outdoor_no2_entity === 'sensor.out_no2', 'outdoor NO2 kept as overlay');

const outO3 = new CardClass();
outO3.setConfig({ outdoor_o3_entity: 'sensor.out_o3' });
assert(outO3._outdoorOnly === true, 'outdoor O3 only → outdoor-only mode');
assert(outO3._config.o3_entity === 'sensor.out_o3', 'outdoor O3 promoted to primary slot');

const histGases = new CardClass();
histGases.setConfig({
  no2_entity: 'sensor.no2', outdoor_no2_entity: 'sensor.out_no2',
  o3_entity: 'sensor.o3', outdoor_o3_entity: 'sensor.out_o3'
});
const gasHistCalls = [];
histGases._hass = {
  config: { unit_system: { temperature: '°F' } },
  states: {
    'sensor.no2': { state: '10' }, 'sensor.out_no2': { state: '20' },
    'sensor.o3': { state: '40' }, 'sensor.out_o3': { state: '60' }
  },
  callApi: async (method, uri) => { gasHistCalls.push(uri); return [[{ last_changed: '2026-06-11T00:00:00Z', state: '5' }]]; }
};
histGases._renderGraphs = () => {};
histGases._loadHistory();
assert(gasHistCalls.some(u => u.includes('sensor.no2')), '_loadHistory fetches the indoor NO2 entity');
assert(gasHistCalls.some(u => u.includes('sensor.out_no2')), '_loadHistory fetches the outdoor NO2 entity');
assert(gasHistCalls.some(u => u.includes('sensor.o3')), '_loadHistory fetches the indoor O3 entity');
assert(gasHistCalls.some(u => u.includes('sensor.out_o3')), '_loadHistory fetches the outdoor O3 entity');

section('Alert chip priority — O2/Propane life-safety boost');
const safetyChipCard = new CardClass();
safetyChipCard.setConfig({ o2_entity: 'sensor.o2', c3h8_entity: 'sensor.c3h8', co2_entity: 'sensor.co2' });
safetyChipCard._hass = { config: { unit_system: { temperature: '°F' } }, states: {
  'sensor.o2': { state: '18' },   // orange (Low) tier
  'sensor.c3h8': { state: '0.3' }, // yellow (Moderate) tier
  'sensor.co2': { state: '2000' }  // red (Poor) tier, no boost
} };
const safetyChips = safetyChipCard._getAbnormalMetrics();
assert(safetyChips.length === 3, 'O2 + Propane + CO2 all flagged');
assert(safetyChips[0].metric === 'o2', 'life-safety O2 sorts first even at a lower tier color than CO2');
assert(safetyChips[1].metric === 'c3h8', 'life-safety Propane sorts ahead of CO2 too');

section('Y-axis scale (#52)');

const yCard = new CardClass();
yCard.setConfig({ humidity_entity: 'sensor.h' });
yCard._timeWindow = { start: 0, end: 3600000 };
const ySvg = { innerHTML: '' };
yCard.shadowRoot = { getElementById: (id) => id === 'humidity-svg' ? ySvg : null };
const yData = [ { time: 600000, value: 50 }, { time: 1800000, value: 52 }, { time: 3000000, value: 51 } ];
const ySpread = pts => Math.max(...pts) - Math.min(...pts);

yCard._renderGraph('humidity', yData, () => '#4caf50', 0, 100, '%');
const yFixed = ySpread(yCard._graphData.humidity.points.map(p => p.y));
yCard._config.y_scale = 'auto';
yCard._renderGraph('humidity', yData, () => '#4caf50', 0, 100, '%');
const yAuto = ySpread(yCard._graphData.humidity.points.map(p => p.y));
assert(yFixed < 2, 'fixed scale: a 2% humidity wiggle is nearly flat on the 0-100 axis');
assert(yAuto > yFixed * 5, 'auto scale zooms to the data and amplifies small variations');
assert(yCard._config.y_scale === 'auto' && ySvg.innerHTML.includes('graph-line'), 'auto scale still renders the line SVG');

section('Adaptive, localized graph time labels (#53, #55)');

const timeCard = new CardClass();
timeCard.setConfig({ co2_entity: 'sensor.co2', language: 'en', hours_to_show: 12 });
const sampleTime = new Date('2026-07-18T14:30:00'); // a Saturday
assert(/2:30/.test(timeCard._formatAxisTime(sampleTime)), '≤24h axis label is a plain time');
timeCard._config.hours_to_show = 72;
assert(/Sat/.test(timeCard._formatAxisTime(sampleTime)), 'multi-day axis label shows the weekday');
timeCard._config.hours_to_show = 168;
const weekLabel = timeCard._formatAxisTime(sampleTime);
assert(/Jul/.test(weekLabel) && /18/.test(weekLabel), 'week-long axis label shows the date');
const tooltipLabel = timeCard._formatTooltipTime(sampleTime);
assert(/Jul/.test(tooltipLabel) && /2:30/.test(tooltipLabel), 'multi-day tooltip includes date and time');
timeCard._config.hours_to_show = 12;
assert(!/Jul/.test(timeCard._formatTooltipTime(sampleTime)), 'single-day tooltip stays a plain time');
timeCard._config.language = 'de';
timeCard._config.hours_to_show = 72;
assert(/Sa/.test(timeCard._formatAxisTime(sampleTime)), 'axis label follows forced card language');
assert(timeCard._dateLocale() === 'de', 'explicit language wins for the date locale');
timeCard._config.language = 'auto';
timeCard._hass = { locale: { language: 'fr-FR' }, config: { unit_system: { temperature: '°C' } }, states: {} };
assert(timeCard._dateLocale() === 'fr-FR', 'auto date locale uses the full hass locale tag');

section('Compact mode — tap actions');

// _fireAction is a no-op when the corresponding action isn't configured
const noAction = new CardClass();
noAction.setConfig({ co2_entity: 'sensor.co2', display: 'compact' });
let dispatched = null;
noAction.dispatchEvent = (event) => { dispatched = event; };
noAction._fireAction('tap');
assert(dispatched === null, 'no tap_action configured → no event dispatched');

// When tap_action IS configured, hass-action event is dispatched with the right detail
const withTap = new CardClass();
withTap.setConfig({
  co2_entity: 'sensor.co2',
  display: 'compact',
  tap_action: { action: 'navigate', navigation_path: '/lovelace/air-quality' }
});
let captured = null;
withTap.dispatchEvent = (event) => { captured = event; };
withTap._fireAction('tap');
// Note: in node's mocked CustomEvent, we don't get the full event API, but we can
// verify _fireAction's dispatch logic was reached by side-effect (captured set).
assert(captured !== null, 'tap_action configured → event dispatched');

// hold_action and double_tap_action also work
const withHold = new CardClass();
withHold.setConfig({
  co2_entity: 'sensor.co2',
  display: 'compact',
  hold_action: { action: 'more-info' }
});
let held = null;
withHold.dispatchEvent = (event) => { held = event; };
withHold._fireAction('hold');
assert(held !== null, 'hold_action configured → event dispatched');

// _fireAction does nothing if the specific action isn't configured (tap_action set, hold_action not)
const onlyTap = new CardClass();
onlyTap.setConfig({
  co2_entity: 'sensor.co2',
  display: 'compact',
  tap_action: { action: 'more-info' }
});
let unwanted = null;
onlyTap.dispatchEvent = (event) => { unwanted = event; };
onlyTap._fireAction('hold');
assert(unwanted === null, 'tap_action set but hold_action absent → no hold event');

// ============================================================
// CUSTOM THRESHOLDS (issues #21 / #24)
// ============================================================

section('Custom Thresholds — CO2');
const co2Custom = new CardClass();
co2Custom.setConfig({ co2_entity: 'sensor.co2', co2_thresholds: [500, 700, 900, 1200] });
assert(co2Custom._getCO2Color(450) === '#4caf50', 'custom CO2: 450 < 500 → green');
assert(co2Custom._getCO2Color(550) === '#8bc34a', 'custom CO2: 550 < 700 → light green');
assert(co2Custom._getCO2Color(800) === '#ffc107', 'custom CO2: 800 < 900 → yellow');
assert(co2Custom._getCO2Color(1000) === '#ff9800', 'custom CO2: 1000 < 1200 → orange');
assert(co2Custom._getCO2Color(1500) === '#f44336', 'custom CO2: 1500 → red');
assert(co2Custom._getMetricStatus('co2', 800) === 'Moderate', 'custom CO2 status follows custom thresholds');
// Original defaults still work for cards without override
const co2Default = new CardClass();
co2Default.setConfig({ co2_entity: 'sensor.co2' });
assert(co2Default._getCO2Color(700) === '#8bc34a', 'unchanged default behavior (CO2 700 = light green)');
assert(co2Default._getCO2Color(900) === '#ffc107', 'unchanged default behavior (CO2 900 = yellow)');

section('Custom Thresholds — Temperature (Brad in Thailand)');
const tempThai = new CardClass();
// Brad keeps AC at 26-29 °C; with custom thresholds, 28 °C reads as Comfortable, not Hot
tempThai.setConfig({ temperature_entity: 'sensor.t', temperature_unit: 'C', temperature_thresholds: [22, 25, 28, 31] });
assert(tempThai._getTempColor(20) === '#2196f3', 'Thai temp 20°C = blue (Cold)');
assert(tempThai._getTempColor(26) === '#4caf50', 'Thai temp 26°C = green (Comfortable)');
assert(tempThai._getTempColor(28) === '#ff9800', 'Thai temp 28°C = orange (Warm)');
assert(tempThai._getTempColor(32) === '#f44336', 'Thai temp 32°C = red (Hot)');
assert(tempThai._getMetricStatus('temp_c', 28) === 'Warm', 'Thai temp 28°C status = Warm');

section('Custom Thresholds — Humidity');
const humidCustom = new CardClass();
humidCustom.setConfig({ humidity_entity: 'sensor.h', humidity_thresholds: [25, 35, 55, 65] });
assert(humidCustom._getHumidityColor(20) === '#ff9800', 'custom humidity 20 = too dry');
assert(humidCustom._getHumidityColor(30) === '#8bc34a', 'custom humidity 30 = dry');
assert(humidCustom._getHumidityColor(45) === '#4caf50', 'custom humidity 45 = comfortable');
assert(humidCustom._getHumidityColor(60) === '#8bc34a', 'custom humidity 60 = humid');
assert(humidCustom._getHumidityColor(70) === '#ff9800', 'custom humidity 70 = too humid');

section('Custom Thresholds — PM2.5 (single override)');
const pmCustom = new CardClass();
pmCustom.setConfig({ pm25_entity: 'sensor.pm25', pm25_thresholds: [3, 8, 15, 25] });
assert(pmCustom._getPM25Color(2) === '#4caf50', 'custom PM2.5 2 = green');
assert(pmCustom._getPM25Color(20) === '#ff9800', 'custom PM2.5 20 = orange');
// Other metrics still use defaults
assert(pmCustom._getCO2Color(700) === '#8bc34a', 'PM override does not affect CO2 defaults');

section('Custom Thresholds — Validation (invalid input falls back to defaults)');
const invalidCard = new CardClass();
invalidCard.setConfig({ co2_entity: 'sensor.co2', co2_thresholds: [600, 800] }); // too few
assert(invalidCard._getCO2Color(700) === '#8bc34a', 'too-few thresholds → fall back to defaults');

const wrongType = new CardClass();
wrongType.setConfig({ co2_entity: 'sensor.co2', co2_thresholds: 'not an array' });
assert(wrongType._getCO2Color(700) === '#8bc34a', 'non-array thresholds → defaults');

const mixedType = new CardClass();
mixedType.setConfig({ co2_entity: 'sensor.co2', co2_thresholds: [600, '800', 1000, 1500] });
assert(mixedType._getCO2Color(700) === '#8bc34a', 'mixed-type thresholds → defaults');

section('Custom Thresholds — tVOC (mode-specific)');
const tvocPpb = new CardClass();
tvocPpb.setConfig({ tvoc_entity: 'sensor.tvoc', tvoc_unit: 'ppb', tvoc_thresholds: [50, 150, 300, 600] });
assert(tvocPpb._getTVOCColor(100) === '#8bc34a', 'tVOC ppb 100 < 150 = light green (custom)');
assert(tvocPpb._getTVOCColor(700) === '#f44336', 'tVOC ppb 700 > 600 = red (custom)');

const tvocIndex = new CardClass();
tvocIndex.setConfig({ tvoc_entity: 'sensor.tvoc', tvoc_unit: 'index', tvoc_thresholds: [80, 130, 200, 350] });
assert(tvocIndex._getTVOCColor(100) === '#8bc34a', 'tVOC index 100 < 130 = light green (custom)');

// ============================================================
// LOCALIZATION (issue #10, supersedes PR #11)
// ============================================================

section('Language resolution');

// Default behavior: no language config, no hass.locale → English
const enCard = new CardClass();
enCard.setConfig({ co2_entity: 'sensor.co2' });
enCard._hass = { config: { unit_system: { temperature: '°F' } }, states: {} };
assert(enCard._resolveLanguage() === 'en', 'default → en');

// hass.locale.language wins (modern HA)
enCard._hass = { config: { unit_system: { temperature: '°F' } }, states: {}, locale: { language: 'es' } };
assert(enCard._resolveLanguage() === 'es', 'hass.locale.language → es');

// hass.language fallback (older HA)
enCard._hass = { config: { unit_system: { temperature: '°F' } }, states: {}, language: 'fr' };
assert(enCard._resolveLanguage() === 'fr', 'hass.language fallback → fr');

// Explicit config wins over both
enCard._hass = { config: { unit_system: { temperature: '°F' } }, states: {}, locale: { language: 'es' } };
enCard._config.language = 'de';
assert(enCard._resolveLanguage() === 'de', 'config.language overrides hass.locale.language');

// Unknown language falls back to en
enCard._config.language = 'xx';
assert(enCard._resolveLanguage() === 'en', 'unknown language → en fallback');

// Regional code is stripped (e.g. en-US → en)
enCard._config.language = 'auto';
enCard._hass = { config: { unit_system: { temperature: '°F' } }, states: {}, locale: { language: 'es-MX' } };
assert(enCard._resolveLanguage() === 'es', 'es-MX → es (regional code stripped)');

section('Translation lookup');

// English baseline
enCard._config.language = 'en';
assert(enCard._t('status', 'excellent') === 'Excellent', 'en status: excellent');
assert(enCard._t('status', 'poor') === 'Poor', 'en status: poor');
assert(enCard._t('recommendation', 'open_window') === 'Open Window', 'en recommendation: open_window');

// Spanish
enCard._config.language = 'es';
assert(enCard._t('status', 'excellent') === 'Excelente', 'es status: Excelente');
assert(enCard._t('status', 'poor') === 'Malo', 'es status: Malo');
assert(enCard._t('recommendation', 'open_window') === 'Abre la ventana', 'es recommendation: Abre la ventana');

// French
enCard._config.language = 'fr';
assert(enCard._t('status', 'excellent') === 'Excellent', 'fr status: Excellent');
assert(enCard._t('recommendation', 'run_air_purifier') === 'Utiliser le purificateur', 'fr recommendation: Utiliser le purificateur');

// German
enCard._config.language = 'de';
assert(enCard._t('status', 'good') === 'Gut', 'de status: Gut');
assert(enCard._t('recommendation', 'all_good') === 'Alles gut', 'de recommendation: Alles gut');

// Missing key falls back to English
enCard._config.language = 'es';
assert(enCard._t('status', 'not_a_real_key') === 'not_a_real_key', 'unknown key returns the key itself');

section('Interpolation (_ts)');
enCard._config.language = 'en';
assert(enCard._ts('subtitle', 'co_danger', { value: 42 }) === 'CO at 42 ppm — dangerous levels detected', 'en interpolated subtitle');
enCard._config.language = 'es';
assert(enCard._ts('subtitle', 'co_danger', { value: 42 }) === 'CO en 42 ppm — niveles peligrosos detectados', 'es interpolated subtitle');

section('Overall status reflects language');

// Reuse the existing setup pattern
function aqCardWithLang(lang) {
  const c = new CardClass();
  c.setConfig({ co2_entity: 'sensor.co2', language: lang });
  c._hass = { config: { unit_system: { temperature: '°F' } }, states: { 'sensor.co2': { state: '2000' } } };
  return c;
}

assert(aqCardWithLang('en')._getOverallStatus().status === 'Poor', 'en: 2000ppm → Poor');
assert(aqCardWithLang('es')._getOverallStatus().status === 'Malo', 'es: 2000ppm → Malo');
assert(aqCardWithLang('fr')._getOverallStatus().status === 'Mauvais', 'fr: 2000ppm → Mauvais');
assert(aqCardWithLang('de')._getOverallStatus().status === 'Schlecht', 'de: 2000ppm → Schlecht');

section('Recommendation key + translation');

function recCardWithLang(lang, co2) {
  const c = new CardClass();
  c.setConfig({ co2_entity: 'sensor.co2', language: lang });
  c._hass = { config: { unit_system: { temperature: '°F' } }, states: { 'sensor.co2': { state: String(co2) } } };
  return c;
}

assert(recCardWithLang('en', 2000)._getRecommendationKey() === 'ventilate_now', 'key for high CO2 = ventilate_now');
assert(recCardWithLang('en', 2000)._getRecommendation() === 'Ventilate Now', 'en rec text: Ventilate Now');
assert(recCardWithLang('es', 2000)._getRecommendation() === 'Ventila ahora', 'es rec text: Ventila ahora');
assert(recCardWithLang('de', 2000)._getRecommendation() === 'Jetzt lüften', 'de rec text: Jetzt lüften');

section('Per-metric status reflects language');

function metricCardWithLang(lang) {
  const c = new CardClass();
  c.setConfig({ co2_entity: 'sensor.co2', pm25_entity: 'sensor.pm25', humidity_entity: 'sensor.h', temperature_entity: 'sensor.t', temperature_unit: 'C', language: lang });
  c._hass = { config: { unit_system: { temperature: '°C' } }, states: {} };
  return c;
}

// The bug: per-metric badge labels (`Poor`, `Elevated`, …) ignored the
// configured language because METRIC_DEFS held English strings directly.
// Verify each locale resolves them through the `status` translation group.
assert(metricCardWithLang('en')._getMetricStatus('co2', 2000) === 'Poor', 'en CO2 2000 → Poor');
assert(metricCardWithLang('pt')._getMetricStatus('co2', 2000) === 'Ruim', 'pt CO2 2000 → Ruim');
assert(metricCardWithLang('es')._getMetricStatus('co2', 2000) === 'Malo', 'es CO2 2000 → Malo');
assert(metricCardWithLang('de')._getMetricStatus('pm25', 50) === 'Schlecht', 'de PM2.5 50 → Schlecht');
assert(metricCardWithLang('fr')._getMetricStatus('co2', 1200) === 'Élevé', 'fr CO2 1200 → Élevé');
assert(metricCardWithLang('pt')._getMetricStatus('humidity', 20) === 'Muito Seco', 'pt humidity 20 → Muito Seco');
assert(metricCardWithLang('pt')._getMetricStatus('temp_c', 23) === 'Morno', 'pt temp 23°C → Morno');
assert(metricCardWithLang('es')._getMetricStatus('temp_c', 23) === 'Cálido', 'es temp 23°C → Cálido');

// New-locale packs (hu #42, pl #54) localize the header status and per-metric pills
assert(recCardWithLang('hu', 2000)._getRecommendation() === 'Szellőztessen most', 'hu rec text: Szellőztessen most');
assert(recCardWithLang('pl', 2000)._getRecommendation() === 'Wywietrz', 'pl rec text: Wywietrz');
assert(metricCardWithLang('hu')._getMetricStatus('co2', 2000) === 'Gyenge', 'hu CO2 2000 → Gyenge');
assert(metricCardWithLang('pl')._getMetricStatus('co2', 2000) === 'Zły', 'pl CO2 2000 → Zły');
assert(metricCardWithLang('hu')._getMetricStatus('temp_c', 23) === 'Meleg', 'hu temp 23°C → Meleg');
assert(metricCardWithLang('pl')._getMetricStatus('humidity', 20) === 'Zbyt sucho', 'pl humidity 20 → Zbyt sucho');

// Status keys added after #37 (O2/pressure tiers) resolve in every locale (en text or translation, never the raw key)
for (const lang of ['en', 'es', 'fr', 'de', 'pt', 'hu', 'pl']) {
  const c = metricCardWithLang(lang);
  assert(c._getMetricStatus('o2', 21) !== 'normal', `${lang}: o2 normal status resolves`);
  assert(c._getMetricStatus('pressure', 1000) !== 'slightly_low', `${lang}: pressure slightly_low status resolves`);
}

// Icon resolution works with both key (preferred) and English text (backward-compat)
assert(recCardWithLang('en', 2000)._getRecommendationIcon('ventilate_now') === 'mdi:alert-circle', 'icon by key');
assert(recCardWithLang('en', 2000)._getRecommendationIcon('Ventilate Now') === 'mdi:alert-circle', 'icon by English text (backward-compat)');

// Reset card._config for downstream tests
card._config = { name: 'Test', hours_to_show: 24, temperature_unit: 'auto' };

// ============================================================
// CARD SIZE TESTS
// ============================================================

section('Card Size');

card._config = { name: 'Test', hours_to_show: 24, temperature_unit: 'auto' };
assert(card.getCardSize() === 3, 'Base size = 3');

card._config.co2_entity = 'sensor.co2';
assert(card.getCardSize() === 4, 'One sensor = 4');

card._config.pm25_entity = 'sensor.pm25';
card._config.humidity_entity = 'sensor.hum';
card._config.temperature_entity = 'sensor.temp';
assert(card.getCardSize() === 7, 'Four sensors = 7');

card._config.co_entity = 'sensor.co';
card._config.radon_entity = 'sensor.radon';
card._config.pm10_entity = 'sensor.pm10';
card._config.pm1_entity = 'sensor.pm1';
card._config.pm03_entity = 'sensor.pm03';
card._config.hcho_entity = 'sensor.hcho';
card._config.tvoc_entity = 'sensor.tvoc';
assert(card.getCardSize() === 14, 'All 11 sensors = 14');

card._config.pressure_entity = 'sensor.pressure';
assert(card.getCardSize() === 15, 'pressure adds one more = 15');

card._config.o2_entity = 'sensor.o2';
card._config.no2_entity = 'sensor.no2';
card._config.o3_entity = 'sensor.o3';
card._config.c3h8_entity = 'sensor.c3h8';
assert(card.getCardSize() === 19, 'O2/NO2/O3/Propane add one each = 19');

// ============================================================
// GETCONFIG FORM TESTS
// ============================================================

section('Editor Structure');

// Card should have getConfigElement
assert(typeof CardClass.getConfigElement === 'function', 'getConfigElement exists');

// Editor class should be registered
const EditorClass = registeredElements['air-quality-card-editor'];
assert(EditorClass !== undefined, 'Editor custom element registered');

// Test editor schema and labels
const editor = new EditorClass();
editor.setConfig({ co2_entity: 'sensor.co2' });
const schema = editor._schema();
assert(schema && schema.length > 0, 'Editor schema exists');
assert(typeof editor._computeLabel === 'function', 'computeLabel is a function');

// Check all expected labels exist
const allLabels = [
  'name', 'co2_entity', 'pm25_entity', 'humidity_entity', 'temperature_entity',
  'radon_entity', 'radon_longterm_entity', 'co_entity', 'hcho_entity', 'tvoc_entity',
  'pm4_entity', 'nox_entity', 'pm1_entity', 'pm10_entity', 'pm03_entity',
  'o2_entity', 'no2_entity', 'o3_entity', 'c3h8_entity',
  'outdoor_co2_entity', 'outdoor_pm25_entity', 'outdoor_humidity_entity', 'outdoor_temperature_entity',
  'outdoor_co_entity', 'outdoor_hcho_entity', 'outdoor_tvoc_entity',
  'outdoor_pm1_entity', 'outdoor_pm10_entity', 'outdoor_pm03_entity', 'outdoor_nox_entity',
  'outdoor_no2_entity', 'outdoor_o3_entity',
  'pressure_entity', 'outdoor_pressure_entity',
  'air_quality_entity', 'hours_to_show', 'temperature_unit', 'radon_unit', 'show_min_max',
  'tvoc_unit', 'nox_unit', 'language',
  'recommendation_action', 'compact_alerts', 'auto_expand'
];
for (const name of allLabels) {
  const label = editor._computeLabel({ name });
  assert(label !== name, `Label for ${name} is defined (got: "${label}")`);
}

// Check expandable sections exist
function findExpandable(schemaArr, title) {
  for (const item of schemaArr) {
    if (item.type === 'expandable' && item.title === title) return item;
  }
  return null;
}

const additionalSection = findExpandable(schema, 'Additional Sensors');
assert(additionalSection !== null, 'Additional Sensors expandable exists');
assert(additionalSection.flatten === true, 'Additional Sensors has flatten: true');

const outdoorSection = findExpandable(schema, 'Outdoor Sensors');
assert(outdoorSection !== null, 'Outdoor Sensors expandable exists');
assert(outdoorSection.flatten === true, 'Outdoor Sensors has flatten: true');

const advancedSection = findExpandable(schema, 'Advanced');
assert(advancedSection !== null, 'Advanced expandable exists');
assert(advancedSection.flatten === true, 'Advanced has flatten: true');

// ============================================================
// HISTORY KEYS TEST
// ============================================================

section('History Keys');

const freshCard = new CardClass();
const expectedKeys = [
  'co2', 'pm25', 'pm1', 'pm10', 'pm03', 'pm4', 'hcho', 'tvoc', 'nox', 'co', 'radon', 'radon_longterm',
  'o2', 'no2', 'o3', 'c3h8',
  'humidity', 'temperature', 'pressure',
  'outdoor_co2', 'outdoor_pm25', 'outdoor_pm1', 'outdoor_pm10', 'outdoor_pm03',
  'outdoor_hcho', 'outdoor_tvoc', 'outdoor_nox', 'outdoor_co', 'outdoor_no2', 'outdoor_o3',
  'outdoor_humidity', 'outdoor_temperature', 'outdoor_pressure'
];
for (const key of expectedKeys) {
  assert(Array.isArray(freshCard._history[key]), `History key '${key}' exists and is array`);
}

// ============================================================
// SUMMARY
// ============================================================

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(40)}`);

process.exit(failed > 0 ? 1 : 0);
