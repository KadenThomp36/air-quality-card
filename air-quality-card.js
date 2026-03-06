/**
 * Air Quality Card v2.6.1
 * A custom Home Assistant card for air quality visualization
 * Thresholds based on WHO 2021 guidelines and ASHRAE standards
 *
 * https://github.com/KadenThomp36/air-quality-card
 */

const CARD_VERSION = '2.7.0';

class AirQualityCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement('air-quality-card-editor');
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
    this._history = { co2: [], pm25: [], pm1: [], pm10: [], pm03: [], hcho: [], tvoc: [], co: [], radon: [], humidity: [], temperature: [], outdoor_co2: [], outdoor_pm25: [], outdoor_pm1: [], outdoor_pm10: [], outdoor_pm03: [], outdoor_hcho: [], outdoor_tvoc: [], outdoor_co: [], outdoor_humidity: [], outdoor_temperature: [] };
    this._historyLoaded = false;
    this._graphData = {};
    this._isDragging = false;
  }

  setConfig(config) {
    if (!config) throw new Error('Invalid configuration');

    // Validate that at least one sensor entity is configured
    const hasEntity = config.co2_entity || config.pm25_entity || config.pm1_entity ||
      config.pm10_entity || config.pm03_entity || config.hcho_entity ||
      config.tvoc_entity || config.co_entity || config.radon_entity ||
      config.humidity_entity || config.temperature_entity;
    if (!hasEntity) {
      throw new Error('Please configure at least one sensor entity');
    }

    this._config = {
      name: 'Air Quality',
      hours_to_show: 24,
      temperature_unit: 'auto',
      radon_unit: 'auto',
      ...config
    };
    this._rendered = false;
    this._historyLoaded = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._rendered) {
      this._initialRender();
      this._rendered = true;
      this._loadHistory();
    }
    this._updateStates();
  }

  getCardSize() {
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
      if (this._config.radon_entity) {
        promises.push(this._fetchHistory(this._config.radon_entity, startTime, endTime));
        keys.push('radon');
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

  _getRadonColor(bq) {
    if (bq < 48) return '#4caf50';
    if (bq < 100) return '#8bc34a';
    if (bq < 148) return '#ffc107';
    if (bq < 300) return '#ff9800';
    return '#f44336';
  }

  _getRadonUnit() {
    const unit = this._config.radon_unit;
    if (unit === 'pCi/L') return 'pCi/L';
    if (unit === 'Bq/m³') return 'Bq/m³';
    // Auto-detect from entity's unit_of_measurement
    if (this._config.radon_entity) {
      const entityUnit = this._hass?.states[this._config.radon_entity]?.attributes?.unit_of_measurement;
      if (entityUnit && entityUnit.toLowerCase().includes('pci')) return 'pCi/L';
    }
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
    if (unit === 'pCi/L') return `${value.toFixed(1)} pCi/L`;
    return `${Math.round(value)} Bq/m³`;
  }

  _getRadonAdvisory() {
    if (!this._config.radon_entity) return null;
    const raw = this._getNumericState(this._config.radon_entity);
    const bq = this._getRadonBqm3(raw);
    const display = this._formatRadon(raw);
    const threshold = this._isRadonPciL() ? '4.0 pCi/L' : '148 Bq/m³';

    if (bq >= 300) return {
      level: 'danger',
      text: 'Radon High \u2014 Mitigation Needed',
      subtitle: `Radon at ${display} \u2014 contact a certified radon mitigator`
    };
    if (bq >= 148) return {
      level: 'warning',
      text: 'Radon Above EPA Action Level',
      subtitle: `Radon at ${display} \u2014 EPA recommends mitigation above ${threshold}`
    };
    if (bq >= 100) return {
      level: 'info',
      text: 'Radon \u2014 Monitor Closely',
      subtitle: `Radon at ${display} \u2014 approaching action level`
    };
    return null;
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
    const radon = this._config.radon_entity ? this._getRadonBqm3(this._getNumericState(this._config.radon_entity)) : 0;

    // If air_quality_entity is configured, use it
    if (this._config.air_quality_entity) {
      const quality = this._getState(this._config.air_quality_entity);
      return { status: quality.replace('_', ' '), color: this._getQualityColor(quality) };
    }

    // CO is a life-safety metric — always takes priority
    if (co > 35) return { status: 'Dangerous', color: '#d32f2f' };
    if (co > 9) return { status: 'Poor', color: '#f44336' };

    // Radon — only degrades status at EPA action level and above
    if (radon >= 300) return { status: 'Poor', color: '#f44336' };
    if (radon >= 148) return { status: 'Fair', color: '#ff9800' };

    // Calculate from CO2 and PM2.5
    if (co2 > 1500 || pm25 > 35) return { status: 'Poor', color: '#f44336' };
    if (co2 > 1000 || pm25 > 25) return { status: 'Fair', color: '#ff9800' };
    if (co2 > 800 || pm25 > 15) return { status: 'Moderate', color: '#ffc107' };
    if (co2 > 600 || pm25 > 5) return { status: 'Good', color: '#8bc34a' };
    return { status: 'Excellent', color: '#4caf50' };
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
    if (co > 100) return 'CO Danger — Leave Area';
    if (co > 35) return 'CO Warning — Ventilate Now';

    let rec = 'All Good';
    if (co2 > 1500) rec = 'Ventilate Now';
    else if (pm25 > 35) rec = 'Run Air Purifier';
    else if (pm10 > 150) rec = 'Run Air Purifier';
    else if (hcho > 100) rec = 'Ventilate — Formaldehyde';
    else if (tvoc > 500) rec = 'Ventilate — VOCs Elevated';
    else if (pm25 > 25 && co2 > 1000) rec = 'Air Purifier + Ventilate';
    else if (pm25 > 25) rec = 'Run Air Purifier';
    else if (pm10 > 75) rec = 'Consider Air Purifier';
    else if (co2 > 1000) rec = 'Open Window';
    else if (co > 9) rec = 'CO Elevated — Ventilate';
    else if (humidity < 30) rec = 'Too Dry';
    else if (humidity > 60) rec = 'Too Humid';
    else if (co2 > 800 || pm25 > 15) rec = 'Consider Ventilating';

    // Override ventilation recommendations if outdoor air is worse
    // CO recommendations are NOT in this list — CO is always a life-safety concern
    const ventilationRecs = ['Ventilate Now', 'Open Window', 'Consider Ventilating', 'Air Purifier + Ventilate', 'Ventilate — Formaldehyde', 'Ventilate — VOCs Elevated', 'CO Elevated — Ventilate'];
    if (outdoorIsWorse && ventilationRecs.includes(rec)) {
      if (pm25 > 25) return 'Run Air Purifier';
      return 'Keep Windows Closed';
    }

    return rec;
  }

  _getRecommendationIcon(rec) {
    const icons = {
      'All Good': 'mdi:check-circle',
      'Consider Ventilating': 'mdi:information',
      'Open Window': 'mdi:window-open-variant',
      'Run Air Purifier': 'mdi:air-purifier',
      'Consider Air Purifier': 'mdi:air-purifier',
      'Air Purifier + Ventilate': 'mdi:alert',
      'Ventilate Now': 'mdi:alert-circle',
      'Ventilate — Formaldehyde': 'mdi:alert-circle',
      'Ventilate — VOCs Elevated': 'mdi:alert-circle',
      'CO Danger — Leave Area': 'mdi:alert-octagon',
      'CO Warning — Ventilate Now': 'mdi:alert-octagon',
      'CO Elevated — Ventilate': 'mdi:alert',
      'Keep Windows Closed': 'mdi:window-closed-variant',
      'Too Dry': 'mdi:water-percent',
      'Too Humid': 'mdi:water'
    };
    return icons[rec] || 'mdi:air-filter';
  }

  _initialRender() {
    const showCO = !!this._config.co_entity;
    const showRadon = !!this._config.radon_entity;
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
              <span id="status-text">Good</span>
            </div>
          </div>

          <div class="recommendation" id="recommendation">
            <ha-icon id="rec-icon" icon="mdi:check-circle"></ha-icon>
            <div class="recommendation-text">
              <div class="recommendation-title" id="rec-title">All Good</div>
              <div class="recommendation-subtitle" id="rec-subtitle">Air quality is within healthy limits</div>
            </div>
          </div>

          <div class="radon-advisory" id="radon-advisory" style="display:none">
            <ha-icon id="radon-advisory-icon" icon="mdi:radioactive"></ha-icon>
            <div class="radon-advisory-text">
              <div class="radon-advisory-title" id="radon-advisory-title"></div>
              <div class="radon-advisory-subtitle" id="radon-advisory-subtitle"></div>
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

            ${showRadon ? `
            <div class="graph-container" id="radon-graph-container" data-entity="${this._config.radon_entity}">
              <div class="graph-header">
                <span class="graph-label">Radon</span>
                <span class="graph-value" id="radon-value">-- <span class="unit">${this._getRadonUnit()}</span><span class="status" id="radon-status"></span></span>
              </div>
              <div class="graph-wrapper">
                <div class="graph" id="radon-graph">
                  <svg id="radon-svg" viewBox="0 0 300 50" preserveAspectRatio="none"></svg>
                </div>
                <div class="graph-cursor" id="radon-cursor"></div>
                <div class="graph-tooltip" id="radon-tooltip">
                  <div class="graph-tooltip-value"></div>
                  <div class="graph-tooltip-time"></div>
                </div>
              </div>
              <div class="graph-time-axis" id="radon-time-axis"></div>
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
                <span class="graph-label">Humidity</span>
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
                <span class="graph-label">Temperature</span>
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
    const recommendation = this._getRecommendation();
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

    if (recIcon && recommendation) {
      recIcon.setAttribute('icon', this._getRecommendationIcon(recommendation));
      recTitle.textContent = recommendation;

      let subtitle = '';
      if (recommendation === 'CO Danger — Leave Area') {
        subtitle = co !== null ? `CO at ${co.toFixed(0)} ppm — dangerous levels detected` : 'Dangerous CO levels';
      } else if (recommendation === 'CO Warning — Ventilate Now') {
        subtitle = co !== null ? `CO at ${co.toFixed(0)} ppm — open all windows immediately` : 'High CO levels';
      } else if (recommendation === 'CO Elevated — Ventilate') {
        subtitle = co !== null ? `CO at ${co.toFixed(0)} ppm — improve ventilation` : 'CO levels elevated';
      } else if (recommendation === 'All Good') {
        subtitle = 'Air quality is within healthy limits';
      } else if (recommendation === 'Run Air Purifier') {
        if (pm25 !== null && pm25 > 35) subtitle = `PM2.5 at ${pm25.toFixed(0)} μg/m³ - filter the air`;
        else if (pm10 !== null && pm10 > 150) subtitle = `PM10 at ${pm10.toFixed(0)} μg/m³ - filter the air`;
        else if (pm25 !== null) subtitle = `PM2.5 at ${pm25.toFixed(0)} μg/m³ - filter the air`;
        else subtitle = 'Particulate levels elevated';
      } else if (recommendation === 'Consider Air Purifier' && pm10 !== null) {
        subtitle = `PM10 at ${pm10.toFixed(0)} μg/m³`;
      } else if (recommendation === 'Open Window' && co2 !== null) {
        subtitle = `CO₂ at ${Math.round(co2)} ppm - fresh air needed`;
      } else if (recommendation === 'Air Purifier + Ventilate' && co2 !== null && pm25 !== null) {
        subtitle = `CO₂: ${Math.round(co2)} ppm, PM2.5: ${pm25.toFixed(0)} μg/m³`;
      } else if (recommendation === 'Ventilate Now' && co2 !== null) {
        subtitle = `CO₂ at ${Math.round(co2)} ppm - may affect focus`;
      } else if (recommendation === 'Ventilate — Formaldehyde') {
        const hcho = this._config.hcho_entity ? this._getNumericState(this._config.hcho_entity) : null;
        subtitle = hcho !== null ? `HCHO at ${hcho.toFixed(0)} ppb - ventilation needed` : 'Formaldehyde levels elevated';
      } else if (recommendation === 'Ventilate — VOCs Elevated') {
        const tvoc = this._config.tvoc_entity ? this._getNumericState(this._config.tvoc_entity) : null;
        subtitle = tvoc !== null ? `tVOC at ${tvoc.toFixed(0)} ppb - ventilation needed` : 'VOC levels elevated';
      } else if (recommendation === 'Too Dry' && humidity !== null) {
        subtitle = `Humidity at ${Math.round(humidity)}% - consider humidifier`;
      } else if (recommendation === 'Too Humid' && humidity !== null) {
        subtitle = `Humidity at ${Math.round(humidity)}% - ventilate`;
      } else if (recommendation === 'Consider Ventilating') {
        if (co2 !== null && co2 > 800) subtitle = `CO₂ at ${Math.round(co2)} ppm`;
        else if (pm25 !== null && pm25 > 15) subtitle = `PM2.5 at ${pm25.toFixed(0)} μg/m³`;
        else subtitle = 'Slightly elevated levels';
      } else if (recommendation === 'Keep Windows Closed') {
        const outdoorPm25 = this._config.outdoor_pm25_entity ? this._getNumericState(this._config.outdoor_pm25_entity) : null;
        const outdoorCo2 = this._config.outdoor_co2_entity ? this._getNumericState(this._config.outdoor_co2_entity) : null;
        if (outdoorPm25 !== null && outdoorPm25 > 35) subtitle = `Outdoor PM2.5 at ${outdoorPm25.toFixed(0)} μg/m³ - poor outdoor air`;
        else if (outdoorPm25 !== null) subtitle = `Outdoor PM2.5 at ${outdoorPm25.toFixed(0)} μg/m³ - worse than indoor`;
        else if (outdoorCo2 !== null) subtitle = `Outdoor CO₂ at ${Math.round(outdoorCo2)} ppm - worse than indoor`;
        else subtitle = 'Outdoor air quality is worse than indoor';
      }
      recSubtitle.textContent = subtitle;

      const isGood = recommendation === 'All Good';
      const isCritical = ['CO Danger — Leave Area', 'CO Warning — Ventilate Now'].includes(recommendation);
      const isPoor = ['Run Air Purifier', 'Open Window', 'Ventilate Now', 'Air Purifier + Ventilate', 'Keep Windows Closed', 'Ventilate — Formaldehyde', 'Ventilate — VOCs Elevated', 'CO Elevated — Ventilate', 'Consider Air Purifier'].includes(recommendation);
      recIcon.style.color = isGood ? 'var(--aq-excellent)' : (isCritical ? 'var(--aq-very-poor)' : (isPoor ? 'var(--aq-poor)' : 'var(--aq-moderate)'));
      recContainer.style.background = isGood ?
        'rgba(76, 175, 80, 0.1)' : (isCritical ? 'rgba(244, 67, 54, 0.15)' : (isPoor ? 'rgba(255, 152, 0, 0.15)' : 'rgba(255, 193, 7, 0.1)'));
    }

    // Helper to render outdoor value suffix
    const outdoorSuffix = (entityKey, value, unit) => {
      if (!this._config[entityKey]) return '';
      const val = this._getNumericState(this._config[entityKey]);
      return ` <span class="outdoor-value">(out: ${unit === 'μg/m³' || unit === 'ppb' ? val.toFixed(1) : Math.round(val)} ${unit})</span>`;
    };

    // Update CO
    if (co !== null) {
      const coColor = this._getCOColor(co);
      const coValueEl = this.shadowRoot.getElementById('co-value');
      if (coValueEl) {
        coValueEl.innerHTML = `${co.toFixed(1)} <span class="unit">ppm</span><span class="status" id="co-status"></span>${outdoorSuffix('outdoor_co_entity', co, 'ppm')}`;
        const statusEl = coValueEl.querySelector('.status');
        statusEl.textContent = co < 4 ? 'Safe' : co < 9 ? 'Low' : co < 35 ? 'Moderate' : co < 100 ? 'High' : 'Dangerous';
        statusEl.style.background = coColor + '22';
        statusEl.style.color = coColor;
        coValueEl.style.color = coColor;
      }
    }

    // Update Radon
    if (this._config.radon_entity) {
      const radonRaw = this._getNumericState(this._config.radon_entity);
      const radonBq = this._getRadonBqm3(radonRaw);
      const radonColor = this._getRadonColor(radonBq);
      const radonUnit = this._getRadonUnit();
      const radonValueEl = this.shadowRoot.getElementById('radon-value');
      if (radonValueEl) {
        const displayVal = radonUnit === 'pCi/L' ? radonRaw.toFixed(1) : Math.round(radonRaw);
        radonValueEl.innerHTML = `${displayVal} <span class="unit">${radonUnit}</span><span class="status" id="radon-status"></span>`;
        const statusEl = radonValueEl.querySelector('.status');
        statusEl.textContent = radonBq < 48 ? 'Excellent' : radonBq < 100 ? 'Good' : radonBq < 148 ? 'Elevated' : radonBq < 300 ? 'High' : 'Dangerous';
        statusEl.style.background = radonColor + '22';
        statusEl.style.color = radonColor;
        radonValueEl.style.color = radonColor;
      }
    }

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

    // Update CO2
    if (co2 !== null) {
      const co2Color = this._getCO2Color(co2);
      const co2ValueEl = this.shadowRoot.getElementById('co2-value');
      if (co2ValueEl) {
        co2ValueEl.innerHTML = `${Math.round(co2)} <span class="unit">ppm</span><span class="status" id="co2-status"></span>${outdoorSuffix('outdoor_co2_entity', co2, 'ppm')}`;
        const statusEl = co2ValueEl.querySelector('.status');
        statusEl.textContent = co2 < 800 ? 'Excellent' : co2 < 1000 ? 'Good' : co2 < 1500 ? 'Elevated' : 'Poor';
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
        statusEl.textContent = pm25 < 5 ? 'Excellent' : pm25 < 15 ? 'Good' : pm25 < 25 ? 'Moderate' : pm25 < 35 ? 'Elevated' : 'Poor';
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
        statusEl.textContent = pm10 < 15 ? 'Excellent' : pm10 < 45 ? 'Good' : pm10 < 75 ? 'Moderate' : pm10 < 150 ? 'Elevated' : 'Poor';
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
        statusEl.textContent = pm1 < 5 ? 'Excellent' : pm1 < 15 ? 'Good' : pm1 < 25 ? 'Moderate' : pm1 < 35 ? 'Elevated' : 'Poor';
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
        statusEl.textContent = pm03 < 500 ? 'Clean' : pm03 < 1000 ? 'Good' : pm03 < 3000 ? 'Moderate' : pm03 < 5000 ? 'Elevated' : 'Poor';
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
        statusEl.textContent = hcho < 20 ? 'Excellent' : hcho < 50 ? 'Good' : hcho < 100 ? 'Moderate' : hcho < 200 ? 'Elevated' : 'Poor';
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
        statusEl.textContent = tvoc < 100 ? 'Excellent' : tvoc < 300 ? 'Good' : tvoc < 500 ? 'Moderate' : tvoc < 1000 ? 'Elevated' : 'Poor';
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
        let humidityStatus = 'Comfortable';
        if (humidity < 30) humidityStatus = 'Too Dry';
        else if (humidity < 40) humidityStatus = 'Dry';
        else if (humidity > 60) humidityStatus = 'Too Humid';
        else if (humidity > 50) humidityStatus = 'Humid';
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
        let tempStatus = 'Comfortable';
        if (this._isCelsius()) {
          if (temp < 18) tempStatus = 'Cold';
          else if (temp < 20) tempStatus = 'Cool';
          else if (temp > 24) tempStatus = 'Hot';
          else if (temp > 22) tempStatus = 'Warm';
        } else {
          if (temp < 65) tempStatus = 'Cold';
          else if (temp < 68) tempStatus = 'Cool';
          else if (temp > 76) tempStatus = 'Hot';
          else if (temp > 72) tempStatus = 'Warm';
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
    if (this._config.radon_entity && this._history.radon.length) {
      const radonUnit = this._getRadonUnit();
      const radonMax = this._isRadonPciL() ? 10 : 370;
      this._renderGraph('radon', this._history.radon, (v) => this._getRadonColor(this._getRadonBqm3(v)), 0, radonMax, radonUnit);
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
    const graphIds = ['co', 'radon', 'co2', 'pm25', 'pm10', 'pm1', 'pm03', 'hcho', 'tvoc', 'humidity', 'temperature'].filter(id => {
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
      if (data.unit === 'ppm' || data.unit === 'ppb' || data.unit === 'p/0.1L' || data.unit === 'Bq/m³') return Math.round(val);
      if (data.unit === '%' || data.unit === '°F' || data.unit === '°C') return Math.round(val);
      if (data.unit === 'pCi/L') return val.toFixed(1);
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
        outdoorEl.textContent = `Outdoor: ${formatVal(closestOutdoor.value)} ${data.unit}`;
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

// ============================================
// VISUAL CONFIGURATION EDITOR
// Uses ha-form with expandable sections via getConfigElement
// ============================================

const LitElement = Object.getPrototypeOf(
  customElements.get("hui-masonry-view") || customElements.get("hui-view")
);
const html = LitElement?.prototype?.html;
const css = LitElement?.prototype?.css;

if (LitElement && !customElements.get('air-quality-card-editor')) {
  class AirQualityCardEditor extends LitElement {
    static get properties() {
      return {
        hass: { type: Object },
        _config: { type: Object }
      };
    }

    setConfig(config) {
      this._config = {
        name: 'Air Quality',
        hours_to_show: 24,
        temperature_unit: 'auto',
        radon_unit: 'auto',
        ...config
      };
    }

    _computeLabel(schema) {
      const labels = {
        name: 'Card Name',
        co2_entity: 'CO₂ Sensor',
        pm25_entity: 'PM2.5 Sensor',
        humidity_entity: 'Humidity Sensor',
        temperature_entity: 'Temperature Sensor',
        radon_entity: 'Radon Sensor',
        co_entity: 'CO (Carbon Monoxide) Sensor',
        hcho_entity: 'Formaldehyde (HCHO) Sensor',
        tvoc_entity: 'tVOC Sensor',
        pm1_entity: 'PM1 Sensor',
        pm10_entity: 'PM10 Sensor',
        pm03_entity: 'PM0.3 Sensor',
        outdoor_co2_entity: 'Outdoor CO₂',
        outdoor_pm25_entity: 'Outdoor PM2.5',
        outdoor_humidity_entity: 'Outdoor Humidity',
        outdoor_temperature_entity: 'Outdoor Temperature',
        outdoor_co_entity: 'Outdoor CO',
        outdoor_hcho_entity: 'Outdoor HCHO',
        outdoor_tvoc_entity: 'Outdoor tVOC',
        outdoor_pm1_entity: 'Outdoor PM1',
        outdoor_pm10_entity: 'Outdoor PM10',
        outdoor_pm03_entity: 'Outdoor PM0.3',
        air_quality_entity: 'Air Quality Index (optional)',
        hours_to_show: 'Graph History',
        temperature_unit: 'Temperature Unit',
        radon_unit: 'Radon Unit'
      };
      return labels[schema.name] || schema.name;
    }

    _schema() {
      return [
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
          title: 'Additional Sensors',
          flatten: true,
          schema: [
            {
              type: 'grid',
              schema: [
                { name: 'radon_entity', selector: { entity: { domain: 'sensor' } } },
                { name: 'co_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'carbon_monoxide' }] } } },
              ]
            },
            {
              type: 'grid',
              schema: [
                { name: 'hcho_entity', selector: { entity: { domain: 'sensor' } } },
                { name: 'tvoc_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'volatile_organic_compounds' }] } } },
              ]
            },
            {
              type: 'grid',
              schema: [
                { name: 'pm1_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'pm1' }] } } },
                { name: 'pm10_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'pm10' }] } } },
              ]
            },
            { name: 'pm03_entity', selector: { entity: { domain: 'sensor' } } },
          ]
        },
        {
          type: 'expandable',
          title: 'Outdoor Sensors',
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
          title: 'Advanced',
          flatten: true,
          schema: [
            { name: 'air_quality_entity', selector: { entity: { domain: 'sensor' } } },
            { name: 'hours_to_show', selector: { number: { min: 1, max: 168, mode: 'box', unit_of_measurement: 'hours' } } },
            { name: 'temperature_unit', selector: { select: { options: [{ value: 'auto', label: 'Auto (from HA)' }, { value: 'F', label: 'Fahrenheit (°F)' }, { value: 'C', label: 'Celsius (°C)' }], mode: 'dropdown' } } },
            { name: 'radon_unit', selector: { select: { options: [{ value: 'auto', label: 'Auto (from sensor)' }, { value: 'pCi/L', label: 'pCi/L (US)' }, { value: 'Bq/m³', label: 'Bq/m³ (International)' }], mode: 'dropdown' } } },
          ]
        }
      ];
    }

    render() {
      if (!this._config) return html``;

      return html`
        <div class="card-config">
          <ha-form
            .hass=${this.hass}
            .data=${this._config}
            .schema=${this._schema()}
            .computeLabel=${this._computeLabel}
            @value-changed=${this._valueChanged}
          ></ha-form>
        </div>
      `;
    }

    _valueChanged(ev) {
      const newConfig = { type: 'custom:air-quality-card', ...ev.detail.value };
      this.dispatchEvent(new CustomEvent('config-changed', {
        detail: { config: newConfig },
        bubbles: true,
        composed: true
      }));
    }

    static get styles() {
      return css`
        .card-config {
          padding: 16px;
        }
      `;
    }
  }

  customElements.define('air-quality-card-editor', AirQualityCardEditor);
}

