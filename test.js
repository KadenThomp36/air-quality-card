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
  'radon_entity', 'co_entity', 'hcho_entity', 'tvoc_entity', 'pm1_entity', 'pm10_entity', 'pm03_entity',
  'outdoor_co2_entity', 'outdoor_pm25_entity', 'outdoor_humidity_entity', 'outdoor_temperature_entity',
  'outdoor_co_entity', 'outdoor_hcho_entity', 'outdoor_tvoc_entity',
  'outdoor_pm1_entity', 'outdoor_pm10_entity', 'outdoor_pm03_entity',
  'air_quality_entity', 'hours_to_show', 'temperature_unit', 'radon_unit'
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
  'co2', 'pm25', 'pm1', 'pm10', 'pm03', 'hcho', 'tvoc', 'co', 'radon',
  'humidity', 'temperature',
  'outdoor_co2', 'outdoor_pm25', 'outdoor_pm1', 'outdoor_pm10', 'outdoor_pm03',
  'outdoor_hcho', 'outdoor_tvoc', 'outdoor_co',
  'outdoor_humidity', 'outdoor_temperature'
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
