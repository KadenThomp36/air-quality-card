/**
 * Air Quality Card v2.1.0
 * A custom Home Assistant card for air quality visualization
 * Thresholds based on WHO 2021 guidelines and ASHRAE standards
 *
 * https://github.com/KadenThomp36/air-quality-card
 */

const CARD_VERSION = '2.2.0';

class AirQualityCard extends HTMLElement {
  // Visual editor using getConfigForm (preferred modern approach)
  static getConfigForm() {
    return {
      schema: [
        { name: 'name', selector: { text: {} } },
        {
          type: 'grid',
          schema: [
            { name: 'co2_entity', selector: { entity: { domain: 'sensor' } } },
            { name: 'pm25_entity', selector: { entity: { domain: 'sensor' } } },
          ]
        },
        {
          type: 'grid',
          schema: [
            { name: 'hcho_entity', selector: { entity: { domain: 'sensor' } } },
            { name: 'tvoc_entity', selector: { entity: { domain: 'sensor' } } },
          ]
        },
        {
          type: 'grid',
          schema: [
            { name: 'humidity_entity', selector: { entity: { domain: 'sensor' } } },
            { name: 'temperature_entity', selector: { entity: { domain: 'sensor' } } },
          ]
        },
        {
          type: 'expandable',
          title: 'Advanced',
          schema: [
            { name: 'air_quality_entity', selector: { entity: { domain: 'sensor' } } },
            { name: 'recommendation_entity', selector: { entity: { domain: 'sensor' } } },
            { name: 'hours_to_show', selector: { number: { min: 1, max: 168, mode: 'box', unit_of_measurement: 'hours' } } },
            { name: 'temperature_unit', selector: { select: { options: [{ value: 'F', label: 'Fahrenheit (°F)' }, { value: 'C', label: 'Celsius (°C)' }], mode: 'dropdown' } } },
          ]
        }
      ],
      computeLabel: (schema) => {
        const labels = {
          name: 'Card Name',
          co2_entity: 'CO₂ Sensor',
          pm25_entity: 'PM2.5 Sensor',
          humidity_entity: 'Humidity Sensor (optional)',
          temperature_entity: 'Temperature Sensor (optional)',
          air_quality_entity: 'Air Quality Index (optional)',
          hcho_entity: 'Formaldehyde (HCHO; CH2O) Sensor (optional)',
          tvoc_entity: 'Volatile Organic Compounds (tVOC) Sensor (optional)',
          recommendation_entity: 'Recommendation Sensor (optional)',
          hours_to_show: 'Graph History',
          temperature_unit: 'Temperature Unit'
        };
        return labels[schema.name] || schema.name;
      }
    };
  }

  // Fallback for older HA versions - use getConfigElement
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
    this._history = { co2: [], pm25: [], hcho: [], tvoc: [], humidity: [], temperature: [] };
    this._historyLoaded = false;
    this._graphData = {};
    this._isDragging = false;
  }

  setConfig(config) {
    if (!config) throw new Error('Invalid configuration');

    // Validate required entities
    if (!config.co2_entity && !config.pm25_entity) {
      throw new Error('Please configure at least a CO₂ or PM2.5 sensor entity');
    }

    this._config = {
      name: 'Air Quality',
      hours_to_show: 24,
      temperature_unit: 'F',
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
    if (this._config.co2_entity) size += 1;
    if (this._config.pm25_entity) size += 1;
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

      if (this._config.co2_entity) {
        promises.push(this._fetchHistory(this._config.co2_entity, startTime, endTime));
        keys.push('co2');
      }
      if (this._config.pm25_entity) {
        promises.push(this._fetchHistory(this._config.pm25_entity, startTime, endTime));
        keys.push('pm25');
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

  _isCelsius() {
    return this._config.temperature_unit === 'C';
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
    const co2 = this._config.co2_entity ? this._getNumericState(this._config.co2_entity) : 0;
    const pm25 = this._config.pm25_entity ? this._getNumericState(this._config.pm25_entity) : 0;

    // If air_quality_entity is configured, use it
    if (this._config.air_quality_entity) {
      const quality = this._getState(this._config.air_quality_entity);
      return { status: quality.replace('_', ' '), color: this._getQualityColor(quality) };
    }

    // Otherwise calculate from CO2 and PM2.5
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
    // If recommendation_entity is configured, use it
    if (this._config.recommendation_entity) {
      const rec = this._getState(this._config.recommendation_entity);
      return rec !== 'unknown' ? rec : null;
    }

    // Otherwise calculate from sensor values
    const co2 = this._config.co2_entity ? this._getNumericState(this._config.co2_entity) : 0;
    const pm25 = this._config.pm25_entity ? this._getNumericState(this._config.pm25_entity) : 0;
    const humidity = this._config.humidity_entity ? this._getNumericState(this._config.humidity_entity) : 45;

    if (co2 > 1500) return 'Ventilate Now';
    if (pm25 > 35) return 'Run Air Purifier';
    if (pm25 > 25 && co2 > 1000) return 'Air Purifier + Ventilate';
    if (pm25 > 25) return 'Run Air Purifier';
    if (co2 > 1000) return 'Open Window';
    if (humidity < 30) return 'Too Dry';
    if (humidity > 60) return 'Too Humid';
    if (co2 > 800 || pm25 > 15) return 'Consider Ventilating';
    return 'All Good';
  }

  _getRecommendationIcon(rec) {
    const icons = {
      'All Good': 'mdi:check-circle',
      'Consider Ventilating': 'mdi:information',
      'Open Window': 'mdi:window-open-variant',
      'Run Air Purifier': 'mdi:air-purifier',
      'Air Purifier + Ventilate': 'mdi:alert',
      'Ventilate Now': 'mdi:alert-circle',
      'Too Dry': 'mdi:water-percent',
      'Too Humid': 'mdi:water'
    };
    return icons[rec] || 'mdi:air-filter';
  }

  _initialRender() {
    const showCO2 = !!this._config.co2_entity;
    const showPM25 = !!this._config.pm25_entity;
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

          <div class="graphs">
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
                  <div class="graph-tooltip-time"></div>
                </div>
              </div>
              <div class="graph-time-axis" id="pm25-time-axis"></div>
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

    const co2 = this._config.co2_entity ? this._getNumericState(this._config.co2_entity) : null;
    const pm25 = this._config.pm25_entity ? this._getNumericState(this._config.pm25_entity) : null;
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
      if (recommendation === 'All Good') {
        subtitle = 'Air quality is within healthy limits';
      } else if (recommendation === 'Run Air Purifier' && pm25 !== null) {
        subtitle = `PM2.5 at ${pm25.toFixed(0)} μg/m³ - filter the air`;
      } else if (recommendation === 'Open Window' && co2 !== null) {
        subtitle = `CO₂ at ${Math.round(co2)} ppm - fresh air needed`;
      } else if (recommendation === 'Air Purifier + Ventilate' && co2 !== null && pm25 !== null) {
        subtitle = `CO₂: ${Math.round(co2)} ppm, PM2.5: ${pm25.toFixed(0)} μg/m³`;
      } else if (recommendation === 'Ventilate Now' && co2 !== null) {
        subtitle = `CO₂ at ${Math.round(co2)} ppm - may affect focus`;
      } else if (recommendation === 'Too Dry' && humidity !== null) {
        subtitle = `Humidity at ${Math.round(humidity)}% - consider humidifier`;
      } else if (recommendation === 'Too Humid' && humidity !== null) {
        subtitle = `Humidity at ${Math.round(humidity)}% - ventilate`;
      } else if (recommendation === 'Consider Ventilating') {
        if (co2 !== null && co2 > 800) subtitle = `CO₂ at ${Math.round(co2)} ppm`;
        else if (pm25 !== null && pm25 > 15) subtitle = `PM2.5 at ${pm25.toFixed(0)} μg/m³`;
        else subtitle = 'Slightly elevated levels';
      }
      recSubtitle.textContent = subtitle;

      const isGood = recommendation === 'All Good';
      const isPoor = ['Run Air Purifier', 'Open Window', 'Ventilate Now', 'Air Purifier + Ventilate'].includes(recommendation);
      recIcon.style.color = isGood ? 'var(--aq-excellent)' : (isPoor ? 'var(--aq-poor)' : 'var(--aq-moderate)');
      recContainer.style.background = isGood ?
        'rgba(76, 175, 80, 0.1)' : (isPoor ? 'rgba(255, 152, 0, 0.15)' : 'rgba(255, 193, 7, 0.1)');
    }

    // Update CO2
    if (co2 !== null) {
      const co2Color = this._getCO2Color(co2);
      const co2ValueEl = this.shadowRoot.getElementById('co2-value');
      const co2StatusEl = this.shadowRoot.getElementById('co2-status');
      if (co2ValueEl) {
        co2ValueEl.innerHTML = `${Math.round(co2)} <span class="unit">ppm</span><span class="status" id="co2-status"></span>`;
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
        pm25ValueEl.innerHTML = `${pm25.toFixed(1)} <span class="unit">μg/m³</span><span class="status" id="pm25-status"></span>`;
        const statusEl = pm25ValueEl.querySelector('.status');
        statusEl.textContent = pm25 < 5 ? 'Excellent' : pm25 < 15 ? 'Good' : pm25 < 25 ? 'Moderate' : pm25 < 35 ? 'Elevated' : 'Poor';
        statusEl.style.background = pm25Color + '22';
        statusEl.style.color = pm25Color;
        pm25ValueEl.style.color = pm25Color;
      }
    }

    // Update HCHO
    if (hcho !== null) {
      const hchoColor = this._getHCHOColor(hcho);
      const hchoValueEl = this.shadowRoot.getElementById('hcho-value');
      if (hchoValueEl) {
        hchoValueEl.innerHTML = `${hcho.toFixed(1)} <span class="unit">ppb</span><span class="status" id="hcho-status"></span>`;
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
        tvocValueEl.innerHTML = `${tvoc.toFixed(1)} <span class="unit">ppb</span><span class="status" id="tvoc-status"></span>`;
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
        humidityValueEl.innerHTML = `${Math.round(humidity)} <span class="unit">%</span><span class="status" id="humidity-status"></span>`;
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
        tempValueEl.innerHTML = `${Math.round(temp)} <span class="unit">${tempUnit}</span><span class="status" id="temperature-status"></span>`;
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

    if (this._config.co2_entity && this._history.co2.length) {
      this._renderGraph('co2', this._history.co2, this._getCO2Color.bind(this), 400, 2000, 'ppm');
    }
    if (this._config.pm25_entity && this._history.pm25.length) {
      this._renderGraph('pm25', this._history.pm25, this._getPM25Color.bind(this), 0, 60, 'μg/m³');
    }
    if (this._config.hcho_entity && this._history.hcho.length) {
      this._renderGraph('hcho', this._history.hcho, this._getHCHOColor.bind(this), 0, 300, 'ppb');
    }
    if (this._config.tvoc_entity && this._history.tvoc.length) {
      this._renderGraph('tvoc', this._history.tvoc, this._getTVOCColor.bind(this), 0, 1500, 'ppb');
    }
    if (this._config.humidity_entity && this._history.humidity.length) {
      this._renderGraph('humidity', this._history.humidity, this._getHumidityColor.bind(this), 0, 100, '%');
    }
    if (this._config.temperature_entity && this._history.temperature.length) {
      const tempUnit = this._getTempUnit();
      const tempMin = this._isCelsius() ? 10 : 50;
      const tempMax = this._isCelsius() ? 32 : 90;
      this._renderGraph('temperature', this._history.temperature, this._getTempColor.bind(this), tempMin, tempMax, tempUnit);
    }

    this._setupGraphInteractions();
  }

  _renderGraph(graphId, data, colorFn, minVal, maxVal, unit) {
    const svg = this.shadowRoot.getElementById(`${graphId}-svg`);
    const timeAxis = this.shadowRoot.getElementById(`${graphId}-time-axis`);
    if (!svg || !data.length) return;

    const width = 300;
    const height = 50;
    const padding = 2;

    const values = data.map(d => d.value);
    const dataMin = Math.min(...values, minVal);
    const dataMax = Math.max(...values, maxVal);
    const range = dataMax - dataMin || 1;

    const points = data.map((d, i) => {
      const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((d.value - dataMin) / range) * (height - 2 * padding);
      return { x, y, value: d.value, time: d.time, color: colorFn(d.value) };
    });

    this._graphData[graphId] = { points, unit, colorFn };

    if (points.length < 2) return;

    const gradientId = `gradient-${graphId}-${Date.now()}`;
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
    const fillGradientId = `fill-${graphId}-${Date.now()}`;

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
    const graphIds = ['co2', 'pm25', 'hcho', 'tvoc', 'humidity', 'temperature'].filter(id => {
      return this._config[`${id === 'pm25' ? 'pm25' : id}_entity`];
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
    const timeEl = tooltip.querySelector('.graph-tooltip-time');

    if (valueEl) {
      let displayValue;
      if (data.unit === 'ppm' || data.unit === 'ppb') displayValue = Math.round(closest.value);
      else if (data.unit === '%' || data.unit === '°F' || data.unit === '°C') displayValue = Math.round(closest.value);
      else displayValue = closest.value.toFixed(1);
      valueEl.textContent = `${displayValue} ${data.unit}`;
      valueEl.style.color = closest.color;
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
// FALLBACK VISUAL CONFIGURATION EDITOR
// For older Home Assistant versions that don't support getConfigForm
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
        temperature_unit: 'F',
        ...config
      };
    }

    _computeLabel(schema) {
      const labels = {
        name: 'Card Name',
        co2_entity: 'CO₂ Sensor',
        pm25_entity: 'PM2.5 Sensor',
        hcho_entity: 'HCHO Sensor (optional)',
        tvoc_entity: 'tVOC Sensor (optional)',
        humidity_entity: 'Humidity Sensor (optional)',
        temperature_entity: 'Temperature Sensor (optional)',
        air_quality_entity: 'Air Quality Index (optional)',
        recommendation_entity: 'Recommendation Sensor (optional)',
        hours_to_show: 'Graph History (hours)',
        temperature_unit: 'Temperature Unit'
      };
      return labels[schema.name] || schema.name;
    }

    _schema() {
      return [
        { name: 'name', selector: { text: {} } },
        { name: 'co2_entity', selector: { entity: { domain: 'sensor' } } },
        { name: 'pm25_entity', selector: { entity: { domain: 'sensor' } } },
        { name: 'hcho_entity', selector: { entity: { domain: 'sensor' } } },
        { name: 'tvoc_entity', selector: { entity: { domain: 'sensor' } } },
        { name: 'humidity_entity', selector: { entity: { domain: 'sensor' } } },
        { name: 'temperature_entity', selector: { entity: { domain: 'sensor' } } },
        { name: 'air_quality_entity', selector: { entity: { domain: 'sensor' } } },
        { name: 'recommendation_entity', selector: { entity: { domain: 'sensor' } } },
        { name: 'hours_to_show', selector: { number: { min: 1, max: 168, mode: 'box' } } },
        { name: 'temperature_unit', selector: { select: { options: [{ value: 'F', label: 'Fahrenheit (°F)' }, { value: 'C', label: 'Celsius (°C)' }], mode: 'dropdown' } } }
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
