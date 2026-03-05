/**
 * Air Quality Card v2.6.0
 * A custom Home Assistant card for air quality visualization
 * Thresholds based on WHO 2021 guidelines and ASHRAE standards
 *
 * https://github.com/KadenThomp36/air-quality-card
 */

const CARD_VERSION = '2.6.0';

// ─────────────────────────────────────────────────────────────────────────────
// Locale loader — each language lives in locales/<lang>.json.
// To add a new language: copy locales/en.json, rename it and translate.
// ─────────────────────────────────────────────────────────────────────────────

const _CARD_BASE_URL = (() => {
  const s = document.currentScript ||
    [...document.querySelectorAll('script')].find(s => s.src && s.src.includes('air-quality-card'));
  return s && s.src ? s.src.replace(/[^/]*$/, '') : '/hacsfiles/air-quality-card/';
})();

const _localeCache = {};

async function _loadLocale(lang) {
  const code = (lang || 'en').split('-')[0].toLowerCase();
  if (_localeCache[code]) return _localeCache[code];
  try {
    const res = await fetch(`${_CARD_BASE_URL}locales/${code}.json`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    _localeCache[code] = await res.json();
    return _localeCache[code];
  } catch (e) {
    if (code !== 'en') return _loadLocale('en');
    _localeCache['en'] = {};
    return {};
  }
}

class AirQualityCard extends HTMLElement {
  // Visual editor using getConfigForm (preferred modern approach)
  static getConfigForm() {
    return {
      schema: [
        { name: 'name', selector: { text: {} } },
        {
          type: 'grid',
          schema: [
            { name: 'co2_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'carbon_dioxide' }] } } },
            { name: 'pm25_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'pm25' }] } } },
          ]
        },
        {
          type: 'grid',
          schema: [
            { name: 'humidity_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'humidity' }] } } },
            { name: 'temperature_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'temperature' }] } } },
          ]
        },
        {
          type: 'expandable',
          title: (this._editorLocale || {}).editor?.section_additional || 'Additional Sensors',
          flatten: true,
          schema: [
            {
              type: 'grid',
              schema: [
                { name: 'co_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'carbon_monoxide' }] } } },
                { name: 'hcho_entity', selector: { entity: { domain: 'sensor' } } },
              ]
            },
            {
              type: 'grid',
              schema: [
                { name: 'tvoc_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'volatile_organic_compounds' }] } } },
                { name: 'pm1_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'pm1' }] } } },
              ]
            },
            {
              type: 'grid',
              schema: [
                { name: 'pm10_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'pm10' }] } } },
                { name: 'pm03_entity', selector: { entity: { domain: 'sensor' } } },
              ]
            },
          ]
        },
        {
          type: 'expandable',
          title: (this._editorLocale || {}).editor?.section_outdoor || 'Outdoor Sensors',
          flatten: true,
          schema: [
            {
              type: 'grid',
              schema: [
                { name: 'outdoor_co2_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'carbon_dioxide' }] } } },
                { name: 'outdoor_pm25_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'pm25' }] } } },
              ]
            },
            {
              type: 'grid',
              schema: [
                { name: 'outdoor_humidity_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'humidity' }] } } },
                { name: 'outdoor_temperature_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'temperature' }] } } },
              ]
            },
            {
              type: 'grid',
              schema: [
                { name: 'outdoor_co_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'carbon_monoxide' }] } } },
                { name: 'outdoor_hcho_entity', selector: { entity: { domain: 'sensor' } } },
              ]
            },
            {
              type: 'grid',
              schema: [
                { name: 'outdoor_tvoc_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'volatile_organic_compounds' }] } } },
                { name: 'outdoor_pm1_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'pm1' }] } } },
              ]
            },
            {
              type: 'grid',
              schema: [
                { name: 'outdoor_pm10_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'pm10' }] } } },
                { name: 'outdoor_pm03_entity', selector: { entity: { domain: 'sensor' } } },
              ]
            },
          ]
        },
        {
          type: 'expandable',
          title: (this._editorLocale || {}).editor?.section_advanced || 'Advanced',
          flatten: true,
          schema: [
            { name: 'air_quality_entity', selector: { entity: { domain: 'sensor' } } },
            { name: 'hours_to_show', selector: { number: { min: 1, max: 168, mode: 'box', unit_of_measurement: 'hours' } } },
            { name: 'temperature_unit', selector: { select: { options: [{ value: 'auto', label: 'Auto (from HA)' }, { value: 'F', label: 'Fahrenheit (°F)' }, { value: 'C', label: 'Celsius (°C)' }], mode: 'dropdown' } } },
          ]
        }
      ],
      computeLabel: (schema) => {
        const name = schema && typeof schema === 'object' ? schema.name : undefined;
        if (!name || typeof name !== 'string') return ' ';
        const editor = (this._editorLocale || {}).editor || {};
        return editor[name] || name;
      }
    };
  }

  static getStubConfig() {
    return {
      name: 'Air Quality',
      hours_to_show: 24
    };
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._rendered = false;
    this._history = { co2: [], pm25: [], pm1: [], pm10: [], pm03: [], hcho: [], tvoc: [], co: [], humidity: [], temperature: [], outdoor_co2: [], outdoor_pm25: [], outdoor_pm1: [], outdoor_pm10: [], outdoor_pm03: [], outdoor_hcho: [], outdoor_tvoc: [], outdoor_co: [], outdoor_humidity: [], outdoor_temperature: [] };
    this._historyLoaded = false;
    this._graphData = {};
    this._isDragging = false;
    this._locale = {};
    this._initializing = false;
  }

  setConfig(config) {
    if (!config) throw new Error('Invalid configuration');

    // Do not throw while editing an empty/new card config; let the visual editor open.
    // Validation is handled naturally by rendering state and user-provided entities.

    this._config = {
      name: 'Air Quality',
      hours_to_show: 24,
      temperature_unit: 'auto',
      ...config
    };
    this._rendered = false;
    this._historyLoaded = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._rendered && !this._initializing) {
      this._initializeCard();
    } else {
      this._updateStates();
    }
  }

  async _initializeCard() {
    this._initializing = true;
    this._locale = await _loadLocale(this._hass && this._hass.language);
    // Make the locale available to the static visual editor
    AirQualityCard._editorLocale = this._locale;
    this._initialRender();
    this._rendered = true;
    this._initializing = false;
    this._loadHistory();
    this._updateStates();
  }

  getCardSize() {
    let size = 3; // Base size for header and recommendation
    if (this._config.co_entity) size += 1;
    if (this._config.co2_entity) size += 1;
    if (this._config.pm25_entity) size += 1;
    if (this._config.pm10_entity) size += 1;
    if (this._config.pm1_entity) size += 1;
    if (this._config.pm03_entity) size += 1;
    if (this._config.hcho_entity) size += 1;
    if (this._config.tvoc_entity) size += 1;
    if (this._config.humidity_entity) size += 1;
    if (this._config.temperature_entity) size += 1;
    return size;
  }

  async _loadHistory() {
    if (!this._hass || this._historyLoaded) return;

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (this._config.hours_to_show * 60 * 60 * 1000));

    try {
      const promises = [];
      const keys = [];

      if (this._config.co_entity) {
        promises.push(this._fetchHistory(this._config.co_entity, startTime, endTime));
        keys.push('co');
      }
      if (this._config.co2_entity) {
        promises.push(this._fetchHistory(this._config.co2_entity, startTime, endTime));
        keys.push('co2');
      }
      if (this._config.pm25_entity) {
        promises.push(this._fetchHistory(this._config.pm25_entity, startTime, endTime));
        keys.push('pm25');
      }
      if (this._config.pm10_entity) {
        promises.push(this._fetchHistory(this._config.pm10_entity, startTime, endTime));
        keys.push('pm10');
      }
      if (this._config.pm1_entity) {
        promises.push(this._fetchHistory(this._config.pm1_entity, startTime, endTime));
        keys.push('pm1');
      }
      if (this._config.pm03_entity) {
        promises.push(this._fetchHistory(this._config.pm03_entity, startTime, endTime));
        keys.push('pm03');
      }
      if (this._config.hcho_entity) {
        promises.push(this._fetchHistory(this._config.hcho_entity, startTime, endTime));
        keys.push('hcho');
      }
      if (this._config.tvoc_entity) {
        promises.push(this._fetchHistory(this._config.tvoc_entity, startTime, endTime));
        keys.push('tvoc');
      }
      if (this._config.humidity_entity) {
        promises.push(this._fetchHistory(this._config.humidity_entity, startTime, endTime));
        keys.push('humidity');
      }
      if (this._config.temperature_entity) {
        promises.push(this._fetchHistory(this._config.temperature_entity, startTime, endTime));
        keys.push('temperature');
      }

      // Outdoor sensors
      const outdoorSensors = ['co2', 'pm25', 'pm1', 'pm10', 'pm03', 'hcho', 'tvoc', 'co', 'humidity', 'temperature'];
      for (const sensor of outdoorSensors) {
        const key = `outdoor_${sensor}_entity`;
        if (this._config[key]) {
          promises.push(this._fetchHistory(this._config[key], startTime, endTime));
          keys.push(`outdoor_${sensor}`);
        }
      }

      const results = await Promise.all(promises);

      keys.forEach((key, i) => {
        this._history[key] = this._processHistory(results[i]);
      });

      this._historyLoaded = true;
      this._renderGraphs();
    } catch (e) {
      console.warn('Air Quality Card: Failed to load history:', e);
    }
  }

  async _fetchHistory(entityId, startTime, endTime) {
    if (!entityId) return [];
    const uri = `history/period/${startTime.toISOString()}?filter_entity_id=${entityId}&end_time=${endTime.toISOString()}&minimal_response&no_attributes`;
    const response = await this._hass.callApi('GET', uri);
    return response?.[0] || [];
  }

  _processHistory(history) {
    return history
      .filter(item => item.state && !isNaN(parseFloat(item.state)))
      .map(item => ({
        time: new Date(item.last_changed).getTime(),
        value: parseFloat(item.state)
      }));
  }

  _getState(entityId) {
    if (!entityId) return 'unknown';
    return this._hass?.states[entityId]?.state ?? 'unknown';
  }

  _getNumericState(entityId) {
    const state = this._getState(entityId);
    return parseFloat(state) || 0;
  }

  // Translate a key: _t('status', 'good') → 'Bueno' (in es)
  _t(group, key) {
    return this._locale && this._locale[group] && this._locale[group][key] !== undefined
      ? this._locale[group][key] : key;
  }

  // Translate with {placeholder} interpolation: _ts('subtitle', 'co_danger', {value: 42})
  _ts(group, key, vars) {
    let str = this._t(group, key);
    if (vars) Object.keys(vars).forEach(k => { str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]); });
    return str;
  }

  _getCO2Color(value) {
    if (value < 600) return '#4caf50';
    if (value < 800) return '#8bc34a';
    if (value < 1000) return '#ffc107';
    if (value < 1500) return '#ff9800';
    return '#f44336';
  }

  _getPM25Color(value) {
    if (value < 5) return '#4caf50';
    if (value < 15) return '#8bc34a';
    if (value < 25) return '#ffc107';
    if (value < 35) return '#ff9800';
    return '#f44336';
  }

  _getHCHOColor(value) {
    if (value < 20) return '#4caf50';
    if (value < 50) return '#8bc34a';
    if (value < 100) return '#ffc107';
    if (value < 200) return '#ff9800';
    return '#f44336';
  }

  _getTVOCColor(value) {
    if (value < 100) return '#4caf50';
    if (value < 300) return '#8bc34a';
    if (value < 500) return '#ffc107';
    if (value < 1000) return '#ff9800';
    return '#f44336';
  }

  _getHumidityColor(value) {
    if (value < 30) return '#ff9800';
    if (value < 40) return '#8bc34a';
    if (value < 50) return '#4caf50';
    if (value < 60) return '#8bc34a';
    return '#ff9800';
  }

  _getPM1Color(value) {
    if (value < 5) return '#4caf50';
    if (value < 15) return '#8bc34a';
    if (value < 25) return '#ffc107';
    if (value < 35) return '#ff9800';
    return '#f44336';
  }

  _getPM10Color(value) {
    if (value < 15) return '#4caf50';
    if (value < 45) return '#8bc34a';
    if (value < 75) return '#ffc107';
    if (value < 150) return '#ff9800';
    return '#f44336';
  }

  _getPM03Color(value) {
    if (value < 500) return '#4caf50';
    if (value < 1000) return '#8bc34a';
    if (value < 3000) return '#ffc107';
    if (value < 5000) return '#ff9800';
    return '#f44336';
  }

  _getCOColor(value) {
    if (value < 4) return '#4caf50';
    if (value < 9) return '#8bc34a';
    if (value < 35) return '#ffc107';
    if (value < 100) return '#ff9800';
    return '#f44336';
  }

  _isCelsius() {
    const unit = this._config.temperature_unit;
    if (unit === 'C') return true;
    if (unit === 'F') return false;
    // Auto-detect from Home Assistant unit system
    try {
      return this._hass.config.unit_system.temperature === '°C';
    } catch (e) {
      return false;
    }
  }

  _getTempUnit() {
    return this._isCelsius() ? '°C' : '°F';
  }

  _getTempColor(value) {
    if (this._isCelsius()) {
      if (value < 18) return '#2196f3';
      if (value < 20) return '#03a9f4';
      if (value < 22) return '#4caf50';
      if (value < 24) return '#ff9800';
      return '#f44336';
    }
    if (value < 65) return '#2196f3';
    if (value < 68) return '#03a9f4';
    if (value < 72) return '#4caf50';
    if (value < 76) return '#ff9800';
    return '#f44336';
  }

  _getOverallStatus() {
    const co = this._config.co_entity ? this._getNumericState(this._config.co_entity) : 0;
    const co2 = this._config.co2_entity ? this._getNumericState(this._config.co2_entity) : 0;
    const pm25 = this._config.pm25_entity ? this._getNumericState(this._config.pm25_entity) : 0;

    // If air_quality_entity is configured, use it
    if (this._config.air_quality_entity) {
      const quality = this._getState(this._config.air_quality_entity);
      const statusKey = quality.toLowerCase().replace(/\s+/g, '_');
      return { status: this._t('status', statusKey), color: this._getQualityColor(quality) };
    }

    // CO is a life-safety metric — always takes priority
    if (co > 35) return { status: this._t('status', 'dangerous'), color: '#d32f2f' };
    if (co > 9) return { status: this._t('status', 'poor'), color: '#f44336' };

    // Calculate from CO2 and PM2.5
    if (co2 > 1500 || pm25 > 35) return { status: this._t('status', 'poor'), color: '#f44336' };
    if (co2 > 1000 || pm25 > 25) return { status: this._t('status', 'fair'), color: '#ff9800' };
    if (co2 > 800 || pm25 > 15) return { status: this._t('status', 'moderate'), color: '#ffc107' };
    if (co2 > 600 || pm25 > 5) return { status: this._t('status', 'good'), color: '#8bc34a' };
    return { status: this._t('status', 'excellent'), color: '#4caf50' };
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

  _getRecommendation() {
    const co = this._config.co_entity ? this._getNumericState(this._config.co_entity) : 0;
    const co2 = this._config.co2_entity ? this._getNumericState(this._config.co2_entity) : 0;
    const pm25 = this._config.pm25_entity ? this._getNumericState(this._config.pm25_entity) : 0;
    const pm10 = this._config.pm10_entity ? this._getNumericState(this._config.pm10_entity) : 0;
    const hcho = this._config.hcho_entity ? this._getNumericState(this._config.hcho_entity) : 0;
    const tvoc = this._config.tvoc_entity ? this._getNumericState(this._config.tvoc_entity) : 0;
    const humidity = this._config.humidity_entity ? this._getNumericState(this._config.humidity_entity) : 45;

    // Read outdoor values for smart recommendations
    const outdoorCo2 = this._config.outdoor_co2_entity ? this._getNumericState(this._config.outdoor_co2_entity) : null;
    const outdoorPm25 = this._config.outdoor_pm25_entity ? this._getNumericState(this._config.outdoor_pm25_entity) : null;
    const outdoorIsWorse = (outdoorPm25 !== null && outdoorPm25 > pm25) || (outdoorCo2 !== null && outdoorCo2 > co2);

    // Priority waterfall — CO safety first (never suppressed by outdoor override)
    if (co > 100) return 'co_danger';
    if (co > 35) return 'co_warning';

    let rec = 'all_good';
    if (co2 > 1500) rec = 'ventilate_now';
    else if (pm25 > 35) rec = 'run_air_purifier';
    else if (pm10 > 150) rec = 'run_air_purifier';
    else if (hcho > 100) rec = 'ventilate_formaldehyde';
    else if (tvoc > 500) rec = 'ventilate_vocs';
    else if (pm25 > 25 && co2 > 1000) rec = 'air_purifier_ventilate';
    else if (pm25 > 25) rec = 'run_air_purifier';
    else if (pm10 > 75) rec = 'consider_air_purifier';
    else if (co2 > 1000) rec = 'open_window';
    else if (co > 9) rec = 'co_elevated';
    else if (humidity < 30) rec = 'too_dry';
    else if (humidity > 60) rec = 'too_humid';
    else if (co2 > 800 || pm25 > 15) rec = 'consider_ventilating';

    // Override ventilation recommendations if outdoor air is worse
    // CO recommendations are NOT in this list — CO is always a life-safety concern
    const ventilationKeys = ['ventilate_now', 'open_window', 'consider_ventilating', 'air_purifier_ventilate', 'ventilate_formaldehyde', 'ventilate_vocs', 'co_elevated'];
    if (outdoorIsWorse && ventilationKeys.includes(rec)) {
      if (pm25 > 25) return 'run_air_purifier';
      return 'keep_windows_closed';
    }

    return rec;
  }

  _getRecommendationIcon(recKey) {
    const icons = {
      'all_good': 'mdi:check-circle',
      'consider_ventilating': 'mdi:information',
      'open_window': 'mdi:window-open-variant',
      'run_air_purifier': 'mdi:air-purifier',
      'consider_air_purifier': 'mdi:air-purifier',
      'air_purifier_ventilate': 'mdi:alert',
      'ventilate_now': 'mdi:alert-circle',
      'ventilate_formaldehyde': 'mdi:alert-circle',
      'ventilate_vocs': 'mdi:alert-circle',
      'co_danger': 'mdi:alert-octagon',
      'co_warning': 'mdi:alert-octagon',
      'co_elevated': 'mdi:alert',
      'keep_windows_closed': 'mdi:window-closed-variant',
      'too_dry': 'mdi:water-percent',
      'too_humid': 'mdi:water'
    };
    return icons[recKey] || 'mdi:air-filter';
  }

  _initialRender() {
    const showCO = !!this._config.co_entity;
    const showCO2 = !!this._config.co2_entity;
    const showPM25 = !!this._config.pm25_entity;
    const showPM10 = !!this._config.pm10_entity;
    const showPM1 = !!this._config.pm1_entity;
    const showPM03 = !!this._config.pm03_entity;
    const showHCHO = !!this._config.hcho_entity;
    const showTVOC = !!this._config.tvoc_entity;
    const showHumidity = !!this._config.humidity_entity;
    const showTemp = !!this._config.temperature_entity;

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

        .card {
          background: var(--ha-card-background, var(--card-background-color, #fff));
          border-radius: var(--ha-card-border-radius, 12px);
          padding: 16px;
          color: var(--primary-text-color);
          font-family: var(--paper-font-body1_-_font-family);
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .title {
          font-size: 1.1em;
          font-weight: 600;
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
          <div class="header">
            <span class="title">${this._config.name}</span>
            <div class="status-badge" id="status-badge">
              <ha-icon id="status-icon" icon="mdi:leaf"></ha-icon>
              <span id="status-text">${this._t('status', 'good')}</span>
            </div>
          </div>

          <div class="recommendation" id="recommendation">
            <ha-icon id="rec-icon" icon="mdi:check-circle"></ha-icon>
            <div class="recommendation-text">
              <div class="recommendation-title" id="rec-title">${this._t('recommendation', 'all_good')}</div>
              <div class="recommendation-subtitle" id="rec-subtitle">${this._t('subtitle', 'air_quality_healthy')}</div>
            </div>
          </div>

          <div class="graphs">
            ${showCO ? `
            <div class="graph-container" id="co-graph-container" data-entity="${this._config.co_entity}">
              <div class="graph-header">
                <span class="graph-label">CO</span>
                <span class="graph-value" id="co-value">-- <span class="unit">ppm</span><span class="status" id="co-status"></span></span>
              </div>
              <div class="graph-wrapper">
                <div class="graph" id="co-graph">
                  <svg id="co-svg" viewBox="0 0 300 50" preserveAspectRatio="none"></svg>
                </div>
                <div class="graph-cursor" id="co-cursor"></div>
                <div class="graph-tooltip" id="co-tooltip">
                  <div class="graph-tooltip-value"></div>
                  <div class="graph-tooltip-outdoor"></div>
                  <div class="graph-tooltip-time"></div>
                </div>
              </div>
              <div class="graph-time-axis" id="co-time-axis"></div>
            </div>
            ` : ''}

            ${showCO2 ? `
            <div class="graph-container" id="co2-graph-container" data-entity="${this._config.co2_entity}">
              <div class="graph-header">
                <span class="graph-label">CO₂</span>
                <span class="graph-value" id="co2-value">-- <span class="unit">ppm</span><span class="status" id="co2-status"></span></span>
              </div>
              <div class="graph-wrapper">
                <div class="graph" id="co2-graph">
                  <svg id="co2-svg" viewBox="0 0 300 50" preserveAspectRatio="none"></svg>
                </div>
                <div class="graph-cursor" id="co2-cursor"></div>
                <div class="graph-tooltip" id="co2-tooltip">
                  <div class="graph-tooltip-value"></div>
                  <div class="graph-tooltip-outdoor"></div>
                  <div class="graph-tooltip-time"></div>
                </div>
              </div>
              <div class="graph-time-axis" id="co2-time-axis"></div>
            </div>
            ` : ''}

            ${showPM25 ? `
            <div class="graph-container" id="pm25-graph-container" data-entity="${this._config.pm25_entity}">
              <div class="graph-header">
                <span class="graph-label">PM2.5</span>
                <span class="graph-value" id="pm25-value">-- <span class="unit">μg/m³</span><span class="status" id="pm25-status"></span></span>
              </div>
              <div class="graph-wrapper">
                <div class="graph" id="pm25-graph">
                  <svg id="pm25-svg" viewBox="0 0 300 50" preserveAspectRatio="none"></svg>
                </div>
                <div class="graph-cursor" id="pm25-cursor"></div>
                <div class="graph-tooltip" id="pm25-tooltip">
                  <div class="graph-tooltip-value"></div>
                  <div class="graph-tooltip-outdoor"></div>
                  <div class="graph-tooltip-time"></div>
                </div>
              </div>
              <div class="graph-time-axis" id="pm25-time-axis"></div>
            </div>
            ` : ''}

            ${showPM10 ? `
            <div class="graph-container" id="pm10-graph-container" data-entity="${this._config.pm10_entity}">
              <div class="graph-header">
                <span class="graph-label">PM10</span>
                <span class="graph-value" id="pm10-value">-- <span class="unit">μg/m³</span><span class="status" id="pm10-status"></span></span>
              </div>
              <div class="graph-wrapper">
                <div class="graph" id="pm10-graph">
                  <svg id="pm10-svg" viewBox="0 0 300 50" preserveAspectRatio="none"></svg>
                </div>
                <div class="graph-cursor" id="pm10-cursor"></div>
                <div class="graph-tooltip" id="pm10-tooltip">
                  <div class="graph-tooltip-value"></div>
                  <div class="graph-tooltip-outdoor"></div>
                  <div class="graph-tooltip-time"></div>
                </div>
              </div>
              <div class="graph-time-axis" id="pm10-time-axis"></div>
            </div>
            ` : ''}

            ${showPM1 ? `
            <div class="graph-container" id="pm1-graph-container" data-entity="${this._config.pm1_entity}">
              <div class="graph-header">
                <span class="graph-label">PM1</span>
                <span class="graph-value" id="pm1-value">-- <span class="unit">μg/m³</span><span class="status" id="pm1-status"></span></span>
              </div>
              <div class="graph-wrapper">
                <div class="graph" id="pm1-graph">
                  <svg id="pm1-svg" viewBox="0 0 300 50" preserveAspectRatio="none"></svg>
                </div>
                <div class="graph-cursor" id="pm1-cursor"></div>
                <div class="graph-tooltip" id="pm1-tooltip">
                  <div class="graph-tooltip-value"></div>
                  <div class="graph-tooltip-outdoor"></div>
                  <div class="graph-tooltip-time"></div>
                </div>
              </div>
              <div class="graph-time-axis" id="pm1-time-axis"></div>
            </div>
            ` : ''}

            ${showPM03 ? `
            <div class="graph-container" id="pm03-graph-container" data-entity="${this._config.pm03_entity}">
              <div class="graph-header">
                <span class="graph-label">PM0.3</span>
                <span class="graph-value" id="pm03-value">-- <span class="unit">p/0.1L</span><span class="status" id="pm03-status"></span></span>
              </div>
              <div class="graph-wrapper">
                <div class="graph" id="pm03-graph">
                  <svg id="pm03-svg" viewBox="0 0 300 50" preserveAspectRatio="none"></svg>
                </div>
                <div class="graph-cursor" id="pm03-cursor"></div>
                <div class="graph-tooltip" id="pm03-tooltip">
                  <div class="graph-tooltip-value"></div>
                  <div class="graph-tooltip-outdoor"></div>
                  <div class="graph-tooltip-time"></div>
                </div>
              </div>
              <div class="graph-time-axis" id="pm03-time-axis"></div>
            </div>
            ` : ''}

            ${showHCHO ? `
            <div class="graph-container" id="hcho-graph-container" data-entity="${this._config.hcho_entity}">
              <div class="graph-header">
                <span class="graph-label">HCHO / CH₂O</span>
                <span class="graph-value" id="hcho-value">-- <span class="unit">ppb</span><span class="status" id="hcho-status"></span></span>
              </div>
              <div class="graph-wrapper">
                <div class="graph" id="hcho-graph">
                  <svg id="hcho-svg" viewBox="0 0 300 50" preserveAspectRatio="none"></svg>
                </div>
                <div class="graph-cursor" id="hcho-cursor"></div>
                <div class="graph-tooltip" id="hcho-tooltip">
                  <div class="graph-tooltip-value"></div>
                  <div class="graph-tooltip-outdoor"></div>
                  <div class="graph-tooltip-time"></div>
                </div>
              </div>
              <div class="graph-time-axis" id="hcho-time-axis"></div>
            </div>
            ` : ''}

            ${showTVOC ? `
            <div class="graph-container" id="tvoc-graph-container" data-entity="${this._config.tvoc_entity}">
              <div class="graph-header">
                <span class="graph-label">tVOC</span>
                <span class="graph-value" id="tvoc-value">-- <span class="unit">ppb</span><span class="status" id="tvoc-status"></span></span>
              </div>
              <div class="graph-wrapper">
                <div class="graph" id="tvoc-graph">
                  <svg id="tvoc-svg" viewBox="0 0 300 50" preserveAspectRatio="none"></svg>
                </div>
                <div class="graph-cursor" id="tvoc-cursor"></div>
                <div class="graph-tooltip" id="tvoc-tooltip">
                  <div class="graph-tooltip-value"></div>
                  <div class="graph-tooltip-outdoor"></div>
                  <div class="graph-tooltip-time"></div>
                </div>
              </div>
              <div class="graph-time-axis" id="tvoc-time-axis"></div>
            </div>
            ` : ''}

            ${showHumidity ? `
            <div class="graph-container" id="humidity-graph-container" data-entity="${this._config.humidity_entity}">
              <div class="graph-header">
                <span class="graph-label">${this._t('graph_label', 'humidity')}</span>
                <span class="graph-value" id="humidity-value">-- <span class="unit">%</span><span class="status" id="humidity-status"></span></span>
              </div>
              <div class="graph-wrapper">
                <div class="graph" id="humidity-graph">
                  <svg id="humidity-svg" viewBox="0 0 300 50" preserveAspectRatio="none"></svg>
                </div>
                <div class="graph-cursor" id="humidity-cursor"></div>
                <div class="graph-tooltip" id="humidity-tooltip">
                  <div class="graph-tooltip-value"></div>
                  <div class="graph-tooltip-outdoor"></div>
                  <div class="graph-tooltip-time"></div>
                </div>
              </div>
              <div class="graph-time-axis" id="humidity-time-axis"></div>
            </div>
            ` : ''}

            ${showTemp ? `
            <div class="graph-container" id="temperature-graph-container" data-entity="${this._config.temperature_entity}">
              <div class="graph-header">
                <span class="graph-label">${this._t('graph_label', 'temperature')}</span>
                <span class="graph-value" id="temperature-value">-- <span class="unit">${this._getTempUnit()}</span><span class="status" id="temperature-status"></span></span>
              </div>
              <div class="graph-wrapper">
                <div class="graph" id="temperature-graph">
                  <svg id="temperature-svg" viewBox="0 0 300 50" preserveAspectRatio="none"></svg>
                </div>
                <div class="graph-cursor" id="temperature-cursor"></div>
                <div class="graph-tooltip" id="temperature-tooltip">
                  <div class="graph-tooltip-value"></div>
                  <div class="graph-tooltip-outdoor"></div>
                  <div class="graph-tooltip-time"></div>
                </div>
              </div>
              <div class="graph-time-axis" id="temperature-time-axis"></div>
            </div>
            ` : ''}
          </div>
        </div>
      </ha-card>
    `;
  }

  _updateStates() {
    if (!this._hass || !this._rendered) return;

    const co = this._config.co_entity ? this._getNumericState(this._config.co_entity) : null;
    const co2 = this._config.co2_entity ? this._getNumericState(this._config.co2_entity) : null;
    const pm25 = this._config.pm25_entity ? this._getNumericState(this._config.pm25_entity) : null;
    const pm10 = this._config.pm10_entity ? this._getNumericState(this._config.pm10_entity) : null;
    const pm1 = this._config.pm1_entity ? this._getNumericState(this._config.pm1_entity) : null;
    const pm03 = this._config.pm03_entity ? this._getNumericState(this._config.pm03_entity) : null;
    const hcho = this._config.hcho_entity ? this._getNumericState(this._config.hcho_entity) : null;
    const tvoc = this._config.tvoc_entity ? this._getNumericState(this._config.tvoc_entity) : null;
    const humidity = this._config.humidity_entity ? this._getNumericState(this._config.humidity_entity) : null;
    const temp = this._config.temperature_entity ? this._getNumericState(this._config.temperature_entity) : null;
    const recKey = this._getRecommendation();
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

    // Update recommendation
    const recIcon = this.shadowRoot.getElementById('rec-icon');
    const recTitle = this.shadowRoot.getElementById('rec-title');
    const recSubtitle = this.shadowRoot.getElementById('rec-subtitle');
    const recContainer = this.shadowRoot.getElementById('recommendation');

    if (recIcon && recKey) {
      recIcon.setAttribute('icon', this._getRecommendationIcon(recKey));
      recTitle.textContent = this._t('recommendation', recKey);

      let subtitle = '';
      if (recKey === 'co_danger') {
        subtitle = co !== null ? this._ts('subtitle', 'co_danger', {value: co.toFixed(0)}) : this._t('subtitle', 'co_danger_unknown');
      } else if (recKey === 'co_warning') {
        subtitle = co !== null ? this._ts('subtitle', 'co_warning', {value: co.toFixed(0)}) : this._t('subtitle', 'co_warning_unknown');
      } else if (recKey === 'co_elevated') {
        subtitle = co !== null ? this._ts('subtitle', 'co_elevated', {value: co.toFixed(0)}) : this._t('subtitle', 'co_elevated_unknown');
      } else if (recKey === 'all_good') {
        subtitle = this._t('subtitle', 'air_quality_healthy');
      } else if (recKey === 'run_air_purifier') {
        if (pm25 !== null && pm25 > 35) subtitle = this._ts('subtitle', 'purifier_pm25', {value: pm25.toFixed(0)});
        else if (pm10 !== null && pm10 > 150) subtitle = this._ts('subtitle', 'purifier_pm10', {value: pm10.toFixed(0)});
        else if (pm25 !== null) subtitle = this._ts('subtitle', 'purifier_pm25', {value: pm25.toFixed(0)});
        else subtitle = this._t('subtitle', 'purifier_generic');
      } else if (recKey === 'consider_air_purifier' && pm10 !== null) {
        subtitle = this._ts('subtitle', 'consider_purifier_pm10', {value: pm10.toFixed(0)});
      } else if (recKey === 'open_window' && co2 !== null) {
        subtitle = this._ts('subtitle', 'open_window_co2', {value: Math.round(co2)});
      } else if (recKey === 'air_purifier_ventilate' && co2 !== null && pm25 !== null) {
        subtitle = this._ts('subtitle', 'purifier_ventilate', {co2: Math.round(co2), pm25: pm25.toFixed(0)});
      } else if (recKey === 'ventilate_now' && co2 !== null) {
        subtitle = this._ts('subtitle', 'ventilate_now_co2', {value: Math.round(co2)});
      } else if (recKey === 'ventilate_formaldehyde') {
        const hcho = this._config.hcho_entity ? this._getNumericState(this._config.hcho_entity) : null;
        subtitle = hcho !== null ? this._ts('subtitle', 'ventilate_formaldehyde', {value: hcho.toFixed(0)}) : this._t('subtitle', 'ventilate_formaldehyde_unknown');
      } else if (recKey === 'ventilate_vocs') {
        const tvoc = this._config.tvoc_entity ? this._getNumericState(this._config.tvoc_entity) : null;
        subtitle = tvoc !== null ? this._ts('subtitle', 'ventilate_vocs', {value: tvoc.toFixed(0)}) : this._t('subtitle', 'ventilate_vocs_unknown');
      } else if (recKey === 'too_dry' && humidity !== null) {
        subtitle = this._ts('subtitle', 'too_dry', {value: Math.round(humidity)});
      } else if (recKey === 'too_humid' && humidity !== null) {
        subtitle = this._ts('subtitle', 'too_humid', {value: Math.round(humidity)});
      } else if (recKey === 'consider_ventilating') {
        if (co2 !== null && co2 > 800) subtitle = this._ts('subtitle', 'consider_ventilating_co2', {value: Math.round(co2)});
        else if (pm25 !== null && pm25 > 15) subtitle = this._ts('subtitle', 'consider_ventilating_pm25', {value: pm25.toFixed(0)});
        else subtitle = this._t('subtitle', 'consider_ventilating_generic');
      } else if (recKey === 'keep_windows_closed') {
        const outdoorPm25 = this._config.outdoor_pm25_entity ? this._getNumericState(this._config.outdoor_pm25_entity) : null;
        const outdoorCo2 = this._config.outdoor_co2_entity ? this._getNumericState(this._config.outdoor_co2_entity) : null;
        if (outdoorPm25 !== null && outdoorPm25 > 35) subtitle = this._ts('subtitle', 'keep_closed_outdoor_pm25_poor', {value: outdoorPm25.toFixed(0)});
        else if (outdoorPm25 !== null) subtitle = this._ts('subtitle', 'keep_closed_outdoor_pm25', {value: outdoorPm25.toFixed(0)});
        else if (outdoorCo2 !== null) subtitle = this._ts('subtitle', 'keep_closed_outdoor_co2', {value: Math.round(outdoorCo2)});
        else subtitle = this._t('subtitle', 'keep_closed_generic');
      }
      recSubtitle.textContent = subtitle;

      const isGood = recKey === 'all_good';
      const isCritical = ['co_danger', 'co_warning'].includes(recKey);
      const isPoor = ['run_air_purifier', 'open_window', 'ventilate_now', 'air_purifier_ventilate', 'keep_windows_closed', 'ventilate_formaldehyde', 'ventilate_vocs', 'co_elevated', 'consider_air_purifier'].includes(recKey);
      recIcon.style.color = isGood ? 'var(--aq-excellent)' : (isCritical ? 'var(--aq-very-poor)' : (isPoor ? 'var(--aq-poor)' : 'var(--aq-moderate)'));
      recContainer.style.background = isGood ?
        'rgba(76, 175, 80, 0.1)' : (isCritical ? 'rgba(244, 67, 54, 0.15)' : (isPoor ? 'rgba(255, 152, 0, 0.15)' : 'rgba(255, 193, 7, 0.1)'));
    }

    // Helper to render outdoor value suffix
    const outdoorSuffix = (entityKey, value, unit) => {
      if (!this._config[entityKey]) return '';
      const val = this._getNumericState(this._config[entityKey]);
      return ` <span class="outdoor-value">(${this._t('tooltip', 'outdoor')}: ${unit === 'μg/m³' || unit === 'ppb' ? val.toFixed(1) : Math.round(val)} ${unit})</span>`;
    };

    // Update CO
    if (co !== null) {
      const coColor = this._getCOColor(co);
      const coValueEl = this.shadowRoot.getElementById('co-value');
      if (coValueEl) {
        coValueEl.innerHTML = `${co.toFixed(1)} <span class="unit">ppm</span><span class="status" id="co-status"></span>${outdoorSuffix('outdoor_co_entity', co, 'ppm')}`;
        const statusEl = coValueEl.querySelector('.status');
        statusEl.textContent = co < 4 ? this._t('sensor_status', 'safe') : co < 9 ? this._t('sensor_status', 'low') : co < 35 ? this._t('sensor_status', 'moderate') : co < 100 ? this._t('sensor_status', 'high') : this._t('sensor_status', 'dangerous');
        statusEl.style.background = coColor + '22';
        statusEl.style.color = coColor;
        coValueEl.style.color = coColor;
      }
    }

    // Update CO2
    if (co2 !== null) {
      const co2Color = this._getCO2Color(co2);
      const co2ValueEl = this.shadowRoot.getElementById('co2-value');
      if (co2ValueEl) {
        co2ValueEl.innerHTML = `${Math.round(co2)} <span class="unit">ppm</span><span class="status" id="co2-status"></span>${outdoorSuffix('outdoor_co2_entity', co2, 'ppm')}`;
        const statusEl = co2ValueEl.querySelector('.status');
        statusEl.textContent = co2 < 800 ? this._t('sensor_status', 'excellent') : co2 < 1000 ? this._t('sensor_status', 'good') : co2 < 1500 ? this._t('sensor_status', 'elevated') : this._t('sensor_status', 'poor');
        statusEl.style.background = co2Color + '22';
        statusEl.style.color = co2Color;
        co2ValueEl.style.color = co2Color;
      }
    }

    // Update PM2.5
    if (pm25 !== null) {
      const pm25Color = this._getPM25Color(pm25);
      const pm25ValueEl = this.shadowRoot.getElementById('pm25-value');
      if (pm25ValueEl) {
        pm25ValueEl.innerHTML = `${pm25.toFixed(1)} <span class="unit">μg/m³</span><span class="status" id="pm25-status"></span>${outdoorSuffix('outdoor_pm25_entity', pm25, 'μg/m³')}`;
        const statusEl = pm25ValueEl.querySelector('.status');
        statusEl.textContent = pm25 < 5 ? this._t('sensor_status', 'excellent') : pm25 < 15 ? this._t('sensor_status', 'good') : pm25 < 25 ? this._t('sensor_status', 'moderate') : pm25 < 35 ? this._t('sensor_status', 'elevated') : this._t('sensor_status', 'poor');
        statusEl.style.background = pm25Color + '22';
        statusEl.style.color = pm25Color;
        pm25ValueEl.style.color = pm25Color;
      }
    }

    // Update PM10
    if (pm10 !== null) {
      const pm10Color = this._getPM10Color(pm10);
      const pm10ValueEl = this.shadowRoot.getElementById('pm10-value');
      if (pm10ValueEl) {
        pm10ValueEl.innerHTML = `${pm10.toFixed(1)} <span class="unit">μg/m³</span><span class="status" id="pm10-status"></span>${outdoorSuffix('outdoor_pm10_entity', pm10, 'μg/m³')}`;
        const statusEl = pm10ValueEl.querySelector('.status');
        statusEl.textContent = pm10 < 15 ? this._t('sensor_status', 'excellent') : pm10 < 45 ? this._t('sensor_status', 'good') : pm10 < 75 ? this._t('sensor_status', 'moderate') : pm10 < 150 ? this._t('sensor_status', 'elevated') : this._t('sensor_status', 'poor');
        statusEl.style.background = pm10Color + '22';
        statusEl.style.color = pm10Color;
        pm10ValueEl.style.color = pm10Color;
      }
    }

    // Update PM1
    if (pm1 !== null) {
      const pm1Color = this._getPM1Color(pm1);
      const pm1ValueEl = this.shadowRoot.getElementById('pm1-value');
      if (pm1ValueEl) {
        pm1ValueEl.innerHTML = `${pm1.toFixed(1)} <span class="unit">μg/m³</span><span class="status" id="pm1-status"></span>${outdoorSuffix('outdoor_pm1_entity', pm1, 'μg/m³')}`;
        const statusEl = pm1ValueEl.querySelector('.status');
        statusEl.textContent = pm1 < 5 ? this._t('sensor_status', 'excellent') : pm1 < 15 ? this._t('sensor_status', 'good') : pm1 < 25 ? this._t('sensor_status', 'moderate') : pm1 < 35 ? this._t('sensor_status', 'elevated') : this._t('sensor_status', 'poor');
        statusEl.style.background = pm1Color + '22';
        statusEl.style.color = pm1Color;
        pm1ValueEl.style.color = pm1Color;
      }
    }

    // Update PM0.3
    if (pm03 !== null) {
      const pm03Color = this._getPM03Color(pm03);
      const pm03ValueEl = this.shadowRoot.getElementById('pm03-value');
      if (pm03ValueEl) {
        pm03ValueEl.innerHTML = `${Math.round(pm03)} <span class="unit">p/0.1L</span><span class="status" id="pm03-status"></span>${outdoorSuffix('outdoor_pm03_entity', pm03, 'p/0.1L')}`;
        const statusEl = pm03ValueEl.querySelector('.status');
        statusEl.textContent = pm03 < 500 ? this._t('sensor_status', 'clean') : pm03 < 1000 ? this._t('sensor_status', 'good') : pm03 < 3000 ? this._t('sensor_status', 'moderate') : pm03 < 5000 ? this._t('sensor_status', 'elevated') : this._t('sensor_status', 'poor');
        statusEl.style.background = pm03Color + '22';
        statusEl.style.color = pm03Color;
        pm03ValueEl.style.color = pm03Color;
      }
    }

    // Update HCHO
    if (hcho !== null) {
      const hchoColor = this._getHCHOColor(hcho);
      const hchoValueEl = this.shadowRoot.getElementById('hcho-value');
      if (hchoValueEl) {
        hchoValueEl.innerHTML = `${hcho.toFixed(1)} <span class="unit">ppb</span><span class="status" id="hcho-status"></span>${outdoorSuffix('outdoor_hcho_entity', hcho, 'ppb')}`;
        const statusEl = hchoValueEl.querySelector('.status');
        statusEl.textContent = hcho < 20 ? this._t('sensor_status', 'excellent') : hcho < 50 ? this._t('sensor_status', 'good') : hcho < 100 ? this._t('sensor_status', 'moderate') : hcho < 200 ? this._t('sensor_status', 'elevated') : this._t('sensor_status', 'poor');
        statusEl.style.background = hchoColor + '22';
        statusEl.style.color = hchoColor;
        hchoValueEl.style.color = hchoColor;
      }
    }

    // Update tVOC
    if (tvoc !== null) {
      const tvocColor = this._getTVOCColor(tvoc);
      const tvocValueEl = this.shadowRoot.getElementById('tvoc-value');
      if (tvocValueEl) {
        tvocValueEl.innerHTML = `${tvoc.toFixed(1)} <span class="unit">ppb</span><span class="status" id="tvoc-status"></span>${outdoorSuffix('outdoor_tvoc_entity', tvoc, 'ppb')}`;
        const statusEl = tvocValueEl.querySelector('.status');
        statusEl.textContent = tvoc < 100 ? this._t('sensor_status', 'excellent') : tvoc < 300 ? this._t('sensor_status', 'good') : tvoc < 500 ? this._t('sensor_status', 'moderate') : tvoc < 1000 ? this._t('sensor_status', 'elevated') : this._t('sensor_status', 'poor');
        statusEl.style.background = tvocColor + '22';
        statusEl.style.color = tvocColor;
        tvocValueEl.style.color = tvocColor;
      }
    }

    // Update Humidity
    if (humidity !== null) {
      const humidityColor = this._getHumidityColor(humidity);
      const humidityValueEl = this.shadowRoot.getElementById('humidity-value');
      if (humidityValueEl) {
        humidityValueEl.innerHTML = `${Math.round(humidity)} <span class="unit">%</span><span class="status" id="humidity-status"></span>${outdoorSuffix('outdoor_humidity_entity', humidity, '%')}`;
        const statusEl = humidityValueEl.querySelector('.status');
        let humidityStatus = this._t('sensor_status', 'comfortable');
        if (humidity < 30) humidityStatus = this._t('sensor_status', 'too_dry');
        else if (humidity < 40) humidityStatus = this._t('sensor_status', 'dry');
        else if (humidity > 60) humidityStatus = this._t('sensor_status', 'too_humid');
        else if (humidity > 50) humidityStatus = this._t('sensor_status', 'humid');
        statusEl.textContent = humidityStatus;
        statusEl.style.background = humidityColor + '22';
        statusEl.style.color = humidityColor;
        humidityValueEl.style.color = humidityColor;
      }
    }

    // Update Temperature
    if (temp !== null) {
      const tempColor = this._getTempColor(temp);
      const tempUnit = this._getTempUnit();
      const tempValueEl = this.shadowRoot.getElementById('temperature-value');
      if (tempValueEl) {
        tempValueEl.innerHTML = `${Math.round(temp)} <span class="unit">${tempUnit}</span><span class="status" id="temperature-status"></span>${outdoorSuffix('outdoor_temperature_entity', temp, tempUnit)}`;
        const statusEl = tempValueEl.querySelector('.status');
        let tempStatus = this._t('sensor_status', 'comfortable');
        if (this._isCelsius()) {
          if (temp < 18) tempStatus = this._t('sensor_status', 'cold');
          else if (temp < 20) tempStatus = this._t('sensor_status', 'cool');
          else if (temp > 24) tempStatus = this._t('sensor_status', 'hot');
          else if (temp > 22) tempStatus = this._t('sensor_status', 'warm');
        } else {
          if (temp < 65) tempStatus = this._t('sensor_status', 'cold');
          else if (temp < 68) tempStatus = this._t('sensor_status', 'cool');
          else if (temp > 76) tempStatus = this._t('sensor_status', 'hot');
          else if (temp > 72) tempStatus = this._t('sensor_status', 'warm');
        }
        statusEl.textContent = tempStatus;
        statusEl.style.background = tempColor + '22';
        statusEl.style.color = tempColor;
        tempValueEl.style.color = tempColor;
      }
    }
  }

  _renderGraphs() {
    this._graphData = {};

    if (this._config.co_entity && this._history.co.length) {
      this._renderGraph('co', this._history.co, this._getCOColor.bind(this), 0, 100, 'ppm', this._history.outdoor_co);
    }
    if (this._config.co2_entity && this._history.co2.length) {
      this._renderGraph('co2', this._history.co2, this._getCO2Color.bind(this), 400, 2000, 'ppm', this._history.outdoor_co2);
    }
    if (this._config.pm25_entity && this._history.pm25.length) {
      this._renderGraph('pm25', this._history.pm25, this._getPM25Color.bind(this), 0, 60, 'μg/m³', this._history.outdoor_pm25);
    }
    if (this._config.pm10_entity && this._history.pm10.length) {
      this._renderGraph('pm10', this._history.pm10, this._getPM10Color.bind(this), 0, 200, 'μg/m³', this._history.outdoor_pm10);
    }
    if (this._config.pm1_entity && this._history.pm1.length) {
      this._renderGraph('pm1', this._history.pm1, this._getPM1Color.bind(this), 0, 60, 'μg/m³', this._history.outdoor_pm1);
    }
    if (this._config.pm03_entity && this._history.pm03.length) {
      this._renderGraph('pm03', this._history.pm03, this._getPM03Color.bind(this), 0, 5000, 'p/0.1L', this._history.outdoor_pm03);
    }
    if (this._config.hcho_entity && this._history.hcho.length) {
      this._renderGraph('hcho', this._history.hcho, this._getHCHOColor.bind(this), 0, 300, 'ppb', this._history.outdoor_hcho);
    }
    if (this._config.tvoc_entity && this._history.tvoc.length) {
      this._renderGraph('tvoc', this._history.tvoc, this._getTVOCColor.bind(this), 0, 1500, 'ppb', this._history.outdoor_tvoc);
    }
    if (this._config.humidity_entity && this._history.humidity.length) {
      this._renderGraph('humidity', this._history.humidity, this._getHumidityColor.bind(this), 0, 100, '%', this._history.outdoor_humidity);
    }
    if (this._config.temperature_entity && this._history.temperature.length) {
      const tempUnit = this._getTempUnit();
      const tempMin = this._isCelsius() ? 10 : 50;
      const tempMax = this._isCelsius() ? 32 : 90;
      this._renderGraph('temperature', this._history.temperature, this._getTempColor.bind(this), tempMin, tempMax, tempUnit, this._history.outdoor_temperature);
    }

    this._setupGraphInteractions();
  }

  _renderGraph(graphId, data, colorFn, minVal, maxVal, unit, outdoorData) {
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
    const dataMin = Math.min(...allValues, minVal);
    const dataMax = Math.max(...allValues, maxVal);
    const range = dataMax - dataMin || 1;

    const points = data.map((d, i) => {
      const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((d.value - dataMin) / range) * (height - 2 * padding);
      return { x, y, value: d.value, time: d.time, color: colorFn(d.value) };
    });

    // Map outdoor data to points using same coordinate system
    let outdoorPoints = [];
    if (outdoorData && outdoorData.length >= 2) {
      outdoorPoints = outdoorData.map((d, i) => {
        const x = padding + (i / (outdoorData.length - 1)) * (width - 2 * padding);
        const y = height - padding - ((d.value - dataMin) / range) * (height - 2 * padding);
        return { x, y, value: d.value, time: d.time, color: colorFn(d.value) };
      });
    }

    this._graphData[graphId] = { points, outdoorPoints, unit, colorFn };

    if (points.length < 2) return;

    const ts = Date.now();
    const gradientId = `gradient-${graphId}-${ts}`;
    let gradientStops = '';
    for (let i = 0; i < points.length; i++) {
      const pct = (i / (points.length - 1)) * 100;
      gradientStops += `<stop offset="${pct}%" style="stop-color:${points[i].color}" />`;
    }

    let linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      linePath += ` L ${points[i].x} ${points[i].y}`;
    }

    const areaPath = linePath + ` L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
    const fillGradientId = `fill-${graphId}-${ts}`;

    // Build outdoor dashed line SVG if data exists
    let outdoorSvg = '';
    if (outdoorPoints.length >= 2) {
      const outdoorGradientId = `outdoor-gradient-${graphId}-${ts}`;
      let outdoorGradientStops = '';
      for (let i = 0; i < outdoorPoints.length; i++) {
        const pct = (i / (outdoorPoints.length - 1)) * 100;
        outdoorGradientStops += `<stop offset="${pct}%" style="stop-color:${outdoorPoints[i].color}" />`;
      }
      let outdoorLinePath = `M ${outdoorPoints[0].x} ${outdoorPoints[0].y}`;
      for (let i = 1; i < outdoorPoints.length; i++) {
        outdoorLinePath += ` L ${outdoorPoints[i].x} ${outdoorPoints[i].y}`;
      }
      outdoorSvg = `
        <linearGradient id="${outdoorGradientId}" x1="0%" y1="0%" x2="100%" y2="0%">
          ${outdoorGradientStops}
        </linearGradient>
      `;
      // The outdoor path is appended after the main line
      outdoorSvg += `</defs>
      <rect x="0" y="0" width="${width}" height="${height}" fill="url(#${fillGradientId})" mask="url(#mask-${graphId})" style="color: url(#${gradientId})" />
      <path d="${linePath}" stroke="url(#${gradientId})" class="graph-line" fill="none" />
      <path d="${outdoorLinePath}" stroke="url(#${outdoorGradientId})" class="graph-line" fill="none" stroke-dasharray="4 3" opacity="0.5" />`;
    }

    if (outdoorPoints.length >= 2) {
      svg.innerHTML = `
        <defs>
          <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="0%">
            ${gradientStops}
          </linearGradient>
          <linearGradient id="${fillGradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:currentColor;stop-opacity:0.2" />
            <stop offset="100%" style="stop-color:currentColor;stop-opacity:0.02" />
          </linearGradient>
          <mask id="mask-${graphId}">
            <path d="${areaPath}" fill="white" />
          </mask>
          ${outdoorSvg}
      `;
    } else {
      svg.innerHTML = `
        <defs>
          <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="0%">
            ${gradientStops}
          </linearGradient>
          <linearGradient id="${fillGradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:currentColor;stop-opacity:0.2" />
            <stop offset="100%" style="stop-color:currentColor;stop-opacity:0.02" />
          </linearGradient>
          <mask id="mask-${graphId}">
            <path d="${areaPath}" fill="white" />
          </mask>
        </defs>
        <rect x="0" y="0" width="${width}" height="${height}" fill="url(#${fillGradientId})" mask="url(#mask-${graphId})" style="color: url(#${gradientId})" />
        <path d="${linePath}" stroke="url(#${gradientId})" class="graph-line" fill="none" />
      `;
    }

    if (timeAxis && points.length > 0) {
      const startTime = new Date(points[0].time);
      const endTime = new Date(points[points.length - 1].time);
      const midTime = new Date((startTime.getTime() + endTime.getTime()) / 2);

      const formatTime = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      timeAxis.innerHTML = `
        <span>${formatTime(startTime)}</span>
        <span>${formatTime(midTime)}</span>
        <span>${formatTime(endTime)}</span>
      `;
    }
  }

  _setupGraphInteractions() {
    const graphIds = ['co', 'co2', 'pm25', 'pm10', 'pm1', 'pm03', 'hcho', 'tvoc', 'humidity', 'temperature'].filter(id => {
      return this._config[`${id}_entity`];
    });

    graphIds.forEach(graphId => {
      const container = this.shadowRoot.getElementById(`${graphId}-graph-container`);
      const graphEl = this.shadowRoot.getElementById(`${graphId}-graph`);
      const cursor = this.shadowRoot.getElementById(`${graphId}-cursor`);
      const tooltip = this.shadowRoot.getElementById(`${graphId}-tooltip`);

      if (!container || !graphEl || !cursor || !tooltip) return;

      const entityId = container.dataset.entity;

      container.addEventListener('click', (e) => {
        if (this._isDragging) {
          this._isDragging = false;
          return;
        }
        const event = new CustomEvent('hass-more-info', {
          bubbles: true,
          composed: true,
          detail: { entityId }
        });
        this.dispatchEvent(event);
      });

      graphEl.addEventListener('mouseenter', () => this._showCursor(graphId));
      graphEl.addEventListener('mouseleave', () => this._hideCursor(graphId));
      graphEl.addEventListener('mousemove', (e) => this._updateCursor(graphId, e));

      let touchTimeout;
      graphEl.addEventListener('touchstart', (e) => {
        touchTimeout = setTimeout(() => {
          this._isDragging = true;
          this._showCursor(graphId);
          this._updateCursor(graphId, e.touches[0]);
        }, 200);
      }, { passive: true });

      graphEl.addEventListener('touchmove', (e) => {
        if (this._isDragging) {
          e.preventDefault();
          this._updateCursor(graphId, e.touches[0]);
        }
      }, { passive: false });

      graphEl.addEventListener('touchend', () => {
        clearTimeout(touchTimeout);
        if (this._isDragging) {
          setTimeout(() => this._hideCursor(graphId), 1000);
        }
      });
    });
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
      if (data.unit === 'ppm' || data.unit === 'ppb' || data.unit === 'p/0.1L') return Math.round(val);
      if (data.unit === '%' || data.unit === '°F' || data.unit === '°C') return Math.round(val);
      return val.toFixed(1);
    };

    if (valueEl) {
      valueEl.textContent = `${formatVal(closest.value)} ${data.unit}`;
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
        outdoorEl.textContent = `${this._t('tooltip', 'outdoor')}: ${formatVal(closestOutdoor.value)} ${data.unit}`;
        outdoorEl.style.color = closestOutdoor.color;
        outdoorEl.style.display = 'block';
      } else {
        outdoorEl.style.display = 'none';
      }
    }

    if (timeEl && closest.time) {
      const time = new Date(closest.time);
      timeEl.textContent = time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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
  documentationURL: 'https://github.com/KadenThomp36/air-quality-card'
});

console.info(
  `%c AIR-QUALITY-CARD %c v${CARD_VERSION} `,
  'color: white; background: #4caf50; font-weight: bold;',
  'color: #4caf50; background: white; font-weight: bold;'
);

