/**
 * Air Quality Card v2.9.0
 * A custom Home Assistant card for air quality visualization
 * Thresholds based on WHO 2021 guidelines and ASHRAE standards
 *
 * https://github.com/KadenThomp36/air-quality-card
 */

const CARD_VERSION = '2.9.0';

// Shared color palettes for the 5-tier color scale used across metrics.
const SCALE_AIRQUALITY = ['#4caf50', '#8bc34a', '#ffc107', '#ff9800', '#f44336']; // green → red
const SCALE_TEMPERATURE = ['#2196f3', '#03a9f4', '#4caf50', '#ff9800', '#f44336']; // blue → red
const SCALE_HUMIDITY = ['#ff9800', '#8bc34a', '#4caf50', '#8bc34a', '#ff9800'];   // bell

// Per-metric thresholds, color scale, and status labels. Users may override
// the thresholds via config (e.g. `co2_thresholds: [500, 700, 900, 1200]`).
// Defaults follow WHO 2021 Air Quality Guidelines and ASHRAE standards.
//
// Each `defaultThresholds` array has exactly 4 ascending values defining 5
// tiers. The corresponding `colors`/`labels` arrays have exactly 5 entries.
const METRIC_DEFS = {
  co:         { defaultThresholds: [4, 9, 35, 100],          colors: SCALE_AIRQUALITY, labels: ['Safe', 'Low', 'Moderate', 'High', 'Dangerous'] },
  co2:        { defaultThresholds: [600, 800, 1000, 1500],   colors: SCALE_AIRQUALITY, labels: ['Excellent', 'Good', 'Moderate', 'Elevated', 'Poor'] },
  pm25:       { defaultThresholds: [5, 15, 25, 35],          colors: SCALE_AIRQUALITY, labels: ['Excellent', 'Good', 'Moderate', 'Elevated', 'Poor'] },
  pm10:       { defaultThresholds: [15, 45, 75, 150],        colors: SCALE_AIRQUALITY, labels: ['Excellent', 'Good', 'Moderate', 'Elevated', 'Poor'] },
  pm1:        { defaultThresholds: [5, 15, 25, 35],          colors: SCALE_AIRQUALITY, labels: ['Excellent', 'Good', 'Moderate', 'Elevated', 'Poor'] },
  pm03:       { defaultThresholds: [500, 1000, 3000, 5000],  colors: SCALE_AIRQUALITY, labels: ['Clean', 'Good', 'Moderate', 'Elevated', 'Poor'] },
  pm4:        { defaultThresholds: [10, 25, 37.5, 50],       colors: SCALE_AIRQUALITY, labels: ['Excellent', 'Good', 'Moderate', 'Elevated', 'Poor'] },
  hcho:       { defaultThresholds: [20, 50, 100, 200],       colors: SCALE_AIRQUALITY, labels: ['Excellent', 'Good', 'Moderate', 'Elevated', 'Poor'] },
  nox:        { defaultThresholds: [20, 50, 150, 250],       colors: SCALE_AIRQUALITY, labels: ['Excellent', 'Good', 'Moderate', 'Elevated', 'Poor'] },
  radon:      { defaultThresholds: [48, 100, 148, 300],      colors: SCALE_AIRQUALITY, labels: ['Excellent', 'Good', 'Elevated', 'High', 'Dangerous'] },
  humidity:   { defaultThresholds: [30, 40, 50, 60],         colors: SCALE_HUMIDITY,   labels: ['Too Dry', 'Dry', 'Comfortable', 'Humid', 'Too Humid'] },
  // tVOC and temperature defaults depend on mode/unit and are computed at call time.
  tvoc_ppb:   { defaultThresholds: [100, 300, 500, 1000],    colors: SCALE_AIRQUALITY, labels: ['Excellent', 'Good', 'Moderate', 'Elevated', 'Poor'] },
  tvoc_index: { defaultThresholds: [100, 150, 250, 400],     colors: SCALE_AIRQUALITY, labels: ['Excellent', 'Good', 'Moderate', 'Elevated', 'Poor'] },
  temp_c:     { defaultThresholds: [18, 20, 22, 24],         colors: SCALE_TEMPERATURE, labels: ['Cold', 'Cool', 'Comfortable', 'Warm', 'Hot'] },
  temp_f:     { defaultThresholds: [65, 68, 72, 76],         colors: SCALE_TEMPERATURE, labels: ['Cold', 'Cool', 'Comfortable', 'Warm', 'Hot'] }
};

// Embedded translations. Spanish/French/German contributed by @b0rv3g4r4 on
// GitHub PR #11 (with thanks). English is the baseline and the fallback for
// any key missing in a translated locale. To add a language: copy the `en`
// block, rename the key, translate the values, keep the structure identical.
const TRANSLATIONS = {
  en: {
    status: {
      excellent: 'Excellent', good: 'Good', moderate: 'Moderate', fair: 'Fair',
      poor: 'Poor', very_poor: 'Very Poor', extremely_poor: 'Extremely Poor', dangerous: 'Dangerous'
    },
    recommendation: {
      all_good: 'All Good', ventilate_now: 'Ventilate Now', run_air_purifier: 'Run Air Purifier',
      consider_air_purifier: 'Consider Air Purifier', open_window: 'Open Window',
      air_purifier_ventilate: 'Air Purifier + Ventilate', co_danger: 'CO Danger — Leave Area',
      co_warning: 'CO Warning — Ventilate Now', co_elevated: 'CO Elevated — Ventilate',
      consider_ventilating: 'Consider Ventilating', keep_windows_closed: 'Keep Windows Closed',
      too_dry: 'Too Dry', too_humid: 'Too Humid', ventilate_formaldehyde: 'Ventilate — Formaldehyde',
      ventilate_vocs: 'Ventilate — VOCs Elevated'
    },
    subtitle: {
      air_quality_healthy: 'Air quality is within healthy limits',
      co_danger: 'CO at {value} ppm — dangerous levels detected', co_danger_unknown: 'Dangerous CO levels',
      co_warning: 'CO at {value} ppm — open all windows immediately', co_warning_unknown: 'High CO levels',
      co_elevated: 'CO at {value} ppm — improve ventilation', co_elevated_unknown: 'CO levels elevated',
      purifier_pm25: 'PM2.5 at {value} μg/m³ - filter the air',
      purifier_pm10: 'PM10 at {value} μg/m³ - filter the air',
      purifier_generic: 'Particulate levels elevated',
      consider_purifier_pm10: 'PM10 at {value} μg/m³',
      open_window_co2: 'CO₂ at {value} ppm - fresh air needed',
      purifier_ventilate: 'CO₂: {co2} ppm, PM2.5: {pm25} μg/m³',
      ventilate_now_co2: 'CO₂ at {value} ppm - may affect focus',
      ventilate_formaldehyde: 'HCHO at {value} ppb - ventilation needed',
      ventilate_formaldehyde_unknown: 'Formaldehyde levels elevated',
      ventilate_vocs: 'tVOC at {value} ppb - ventilation needed',
      ventilate_vocs_unknown: 'VOC levels elevated',
      too_dry: 'Humidity at {value}% - consider humidifier',
      too_humid: 'Humidity at {value}% - ventilate',
      consider_ventilating_co2: 'CO₂ at {value} ppm',
      consider_ventilating_pm25: 'PM2.5 at {value} μg/m³',
      consider_ventilating_generic: 'Slightly elevated levels',
      keep_closed_outdoor_pm25_poor: 'Outdoor PM2.5 at {value} μg/m³ - poor outdoor air',
      keep_closed_outdoor_pm25: 'Outdoor PM2.5 at {value} μg/m³ - worse than indoor',
      keep_closed_outdoor_co2: 'Outdoor CO₂ at {value} ppm - worse than indoor',
      keep_closed_generic: 'Outdoor air quality is worse than indoor'
    },
    radon: {
      advisory_danger: 'Radon High - Mitigation Needed',
      advisory_warning: 'Radon Above EPA Action Level',
      advisory_info: 'Radon - Monitor Closely',
      short_term: 'Short-term', long_term: 'Long-term'
    },
    editor: {
      name: 'Card Name', co2_entity: 'CO₂ Sensor', pm25_entity: 'PM2.5 Sensor',
      humidity_entity: 'Humidity Sensor', temperature_entity: 'Temperature Sensor',
      radon_entity: 'Radon Sensor', radon_longterm_entity: 'Radon Long-Term Sensor',
      co_entity: 'CO (Carbon Monoxide) Sensor', hcho_entity: 'Formaldehyde (HCHO) Sensor',
      tvoc_entity: 'tVOC Sensor', pm4_entity: 'PM4 Sensor', nox_entity: 'NOx Sensor',
      pm1_entity: 'PM1 Sensor', pm10_entity: 'PM10 Sensor', pm03_entity: 'PM0.3 Sensor',
      outdoor_co2_entity: 'Outdoor CO₂', outdoor_pm25_entity: 'Outdoor PM2.5',
      outdoor_humidity_entity: 'Outdoor Humidity', outdoor_temperature_entity: 'Outdoor Temperature',
      outdoor_co_entity: 'Outdoor CO', outdoor_hcho_entity: 'Outdoor HCHO',
      outdoor_tvoc_entity: 'Outdoor tVOC', outdoor_pm1_entity: 'Outdoor PM1',
      outdoor_pm10_entity: 'Outdoor PM10', outdoor_pm03_entity: 'Outdoor PM0.3',
      air_quality_entity: 'Air Quality Index (optional)', hours_to_show: 'Graph History',
      temperature_unit: 'Temperature Unit', radon_unit: 'Radon Unit',
      tvoc_unit: 'tVOC Measurement Type', language: 'Language',
      section_additional: 'Additional Sensors', section_outdoor: 'Outdoor Sensors',
      section_advanced: 'Advanced'
    }
  },
  es: {
    status: { excellent: 'Excelente', good: 'Bueno', moderate: 'Moderado', fair: 'Regular', poor: 'Malo', very_poor: 'Muy malo', extremely_poor: 'Extremadamente malo', dangerous: 'Peligroso' },
    recommendation: { all_good: 'Todo bien', ventilate_now: 'Ventila ahora', run_air_purifier: 'Enciende el purificador', consider_air_purifier: 'Plantéate usar un purificador', open_window: 'Abre la ventana', air_purifier_ventilate: 'Purificador y ventilación', co_danger: 'Peligro por CO — evacúa la zona', co_warning: 'Alerta de CO — ventila ahora', co_elevated: 'CO elevado — ventila', consider_ventilating: 'Considera ventilar', keep_windows_closed: 'Mantén las ventanas cerradas', too_dry: 'Demasiado seco', too_humid: 'Demasiado húmedo', ventilate_formaldehyde: 'Ventila — formaldehído', ventilate_vocs: 'Ventila — COV elevados' },
    subtitle: { air_quality_healthy: 'La calidad del aire está dentro de límites saludables', co_danger: 'CO en {value} ppm — niveles peligrosos detectados', co_danger_unknown: 'Niveles de CO peligrosos', co_warning: 'CO en {value} ppm — abre todas las ventanas de inmediato', co_warning_unknown: 'Niveles de CO altos', co_elevated: 'CO en {value} ppm — mejora la ventilación', co_elevated_unknown: 'Niveles de CO elevados', purifier_pm25: 'PM2.5 en {value} μg/m³ - filtra el aire', purifier_pm10: 'PM10 en {value} μg/m³ - filtra el aire', purifier_generic: 'Niveles elevados de partículas', consider_purifier_pm10: 'PM10 en {value} μg/m³', open_window_co2: 'CO₂ en {value} ppm - hace falta aire fresco', purifier_ventilate: 'CO₂: {co2} ppm, PM2.5: {pm25} μg/m³', ventilate_now_co2: 'CO₂ en {value} ppm - puede afectar a la concentración', ventilate_formaldehyde: 'HCHO en {value} ppb - ventilación necesaria', ventilate_formaldehyde_unknown: 'Niveles de formaldehído elevados', ventilate_vocs: 'tVOC en {value} ppb - ventilación necesaria', ventilate_vocs_unknown: 'Niveles de COV elevados', too_dry: 'Humedad en {value}% - plantéate usar un humidificador', too_humid: 'Humedad en {value}% - ventila', consider_ventilating_co2: 'CO₂ en {value} ppm', consider_ventilating_pm25: 'PM2.5 en {value} μg/m³', consider_ventilating_generic: 'Niveles ligeramente elevados', keep_closed_outdoor_pm25_poor: 'PM2.5 exterior en {value} μg/m³ - mala calidad del aire exterior', keep_closed_outdoor_pm25: 'PM2.5 exterior en {value} μg/m³ - peor que en interior', keep_closed_outdoor_co2: 'CO₂ exterior en {value} ppm - peor que en interior', keep_closed_generic: 'La calidad del aire exterior es peor que en interior' },
    radon: { advisory_danger: 'Radón alto — se necesita mitigación', advisory_warning: 'Radón por encima del nivel de acción EPA', advisory_info: 'Radón — monitorear de cerca', short_term: 'Corto plazo', long_term: 'Largo plazo' },
    editor: { name: 'Nombre de la tarjeta', co2_entity: 'Sensor de CO₂', pm25_entity: 'Sensor de PM2.5', humidity_entity: 'Sensor de humedad', temperature_entity: 'Sensor de temperatura', radon_entity: 'Sensor de radón', radon_longterm_entity: 'Sensor de radón (largo plazo)', co_entity: 'Sensor de CO (monóxido de carbono)', hcho_entity: 'Sensor de formaldehído (HCHO)', tvoc_entity: 'Sensor de tVOC', pm4_entity: 'Sensor de PM4', nox_entity: 'Sensor de NOx', pm1_entity: 'Sensor de PM1', pm10_entity: 'Sensor de PM10', pm03_entity: 'Sensor de PM0.3', outdoor_co2_entity: 'CO₂ exterior', outdoor_pm25_entity: 'PM2.5 exterior', outdoor_humidity_entity: 'Humedad exterior', outdoor_temperature_entity: 'Temperatura exterior', outdoor_co_entity: 'CO exterior', outdoor_hcho_entity: 'HCHO exterior', outdoor_tvoc_entity: 'tVOC exterior', outdoor_pm1_entity: 'PM1 exterior', outdoor_pm10_entity: 'PM10 exterior', outdoor_pm03_entity: 'PM0.3 exterior', air_quality_entity: 'Índice de calidad del aire (opcional)', hours_to_show: 'Historial del gráfico', temperature_unit: 'Unidad de temperatura', radon_unit: 'Unidad de radón', tvoc_unit: 'Tipo de medición tVOC', language: 'Idioma', section_additional: 'Sensores adicionales', section_outdoor: 'Sensores exteriores', section_advanced: 'Avanzado' }
  },
  fr: {
    status: { excellent: 'Excellent', good: 'Bon', moderate: 'Modéré', fair: 'Passable', poor: 'Mauvais', very_poor: 'Très mauvais', extremely_poor: 'Extrêmement mauvais', dangerous: 'Dangereux' },
    recommendation: { all_good: 'Tout va bien', ventilate_now: 'Ventiler maintenant', run_air_purifier: 'Utiliser le purificateur', consider_air_purifier: 'Envisager le purificateur', open_window: 'Ouvrir une fenêtre', air_purifier_ventilate: 'Purificateur + Ventiler', co_danger: 'Danger au CO — évacuer', co_warning: 'Alerte CO — ventiler maintenant', co_elevated: 'CO élevé — ventiler', consider_ventilating: 'Envisager de ventiler', keep_windows_closed: 'Garder les fenêtres fermées', too_dry: 'Trop sec', too_humid: 'Trop humide', ventilate_formaldehyde: 'Ventiler — Formaldéhyde', ventilate_vocs: 'Ventiler — COV élevés' },
    subtitle: { air_quality_healthy: "La qualité de l'air est dans les limites saines", co_danger: 'CO à {value} ppm — niveaux dangereux détectés', co_danger_unknown: 'Niveaux de CO dangereux', co_warning: 'CO à {value} ppm — ouvrir toutes les fenêtres immédiatement', co_warning_unknown: 'Niveaux de CO élevés', co_elevated: 'CO à {value} ppm — améliorer la ventilation', co_elevated_unknown: 'Niveaux de CO élevés', purifier_pm25: "PM2.5 à {value} μg/m³ - filtrer l'air", purifier_pm10: "PM10 à {value} μg/m³ - filtrer l'air", purifier_generic: 'Niveaux de particules élevés', consider_purifier_pm10: 'PM10 à {value} μg/m³', open_window_co2: 'CO₂ à {value} ppm - air frais nécessaire', purifier_ventilate: 'CO₂: {co2} ppm, PM2.5: {pm25} μg/m³', ventilate_now_co2: 'CO₂ à {value} ppm - peut affecter la concentration', ventilate_formaldehyde: 'HCHO à {value} ppb - ventilation nécessaire', ventilate_formaldehyde_unknown: 'Niveaux de formaldéhyde élevés', ventilate_vocs: 'tVOC à {value} ppb - ventilation nécessaire', ventilate_vocs_unknown: 'Niveaux de COV élevés', too_dry: 'Humidité à {value}% - utiliser un humidificateur', too_humid: 'Humidité à {value}% - ventiler', consider_ventilating_co2: 'CO₂ à {value} ppm', consider_ventilating_pm25: 'PM2.5 à {value} μg/m³', consider_ventilating_generic: 'Niveaux légèrement élevés', keep_closed_outdoor_pm25_poor: 'PM2.5 extérieur à {value} μg/m³ - mauvaise qualité extérieure', keep_closed_outdoor_pm25: "PM2.5 extérieur à {value} μg/m³ - pire qu'à l'intérieur", keep_closed_outdoor_co2: "CO₂ extérieur à {value} ppm - pire qu'à l'intérieur", keep_closed_generic: "La qualité de l'air extérieur est pire qu'à l'intérieur" },
    radon: { advisory_danger: 'Radon élevé — mitigation nécessaire', advisory_warning: "Radon au-dessus du niveau d'action EPA", advisory_info: 'Radon — surveiller de près', short_term: 'Court terme', long_term: 'Long terme' },
    editor: { name: 'Nom de la carte', co2_entity: 'Capteur CO₂', pm25_entity: 'Capteur PM2.5', humidity_entity: "Capteur d'humidité", temperature_entity: 'Capteur de température', radon_entity: 'Capteur de radon', radon_longterm_entity: 'Capteur de radon (long terme)', co_entity: 'Capteur CO (Monoxyde de carbone)', hcho_entity: 'Capteur Formaldéhyde (HCHO)', tvoc_entity: 'Capteur tVOC', pm4_entity: 'Capteur PM4', nox_entity: 'Capteur NOx', pm1_entity: 'Capteur PM1', pm10_entity: 'Capteur PM10', pm03_entity: 'Capteur PM0.3', outdoor_co2_entity: 'CO₂ extérieur', outdoor_pm25_entity: 'PM2.5 extérieur', outdoor_humidity_entity: 'Humidité extérieure', outdoor_temperature_entity: 'Température extérieure', outdoor_co_entity: 'CO extérieur', outdoor_hcho_entity: 'HCHO extérieur', outdoor_tvoc_entity: 'tVOC extérieur', outdoor_pm1_entity: 'PM1 extérieur', outdoor_pm10_entity: 'PM10 extérieur', outdoor_pm03_entity: 'PM0.3 extérieur', air_quality_entity: "Indice de qualité de l'air (optionnel)", hours_to_show: 'Historique du graphique', temperature_unit: 'Unité de température', radon_unit: 'Unité de radon', tvoc_unit: 'Type de mesure tVOC', language: 'Langue', section_additional: 'Capteurs supplémentaires', section_outdoor: 'Capteurs extérieurs', section_advanced: 'Avancé' }
  },
  de: {
    status: { excellent: 'Ausgezeichnet', good: 'Gut', moderate: 'Mäßig', fair: 'Akzeptabel', poor: 'Schlecht', very_poor: 'Sehr schlecht', extremely_poor: 'Extrem schlecht', dangerous: 'Gefährlich' },
    recommendation: { all_good: 'Alles gut', ventilate_now: 'Jetzt lüften', run_air_purifier: 'Luftreiniger einschalten', consider_air_purifier: 'Luftreiniger erwägen', open_window: 'Fenster öffnen', air_purifier_ventilate: 'Luftreiniger + Lüften', co_danger: 'CO-Gefahr — Bereich verlassen', co_warning: 'CO-Warnung — Sofort lüften', co_elevated: 'CO erhöht — Lüften', consider_ventilating: 'Lüften erwägen', keep_windows_closed: 'Fenster geschlossen halten', too_dry: 'Zu trocken', too_humid: 'Zu feucht', ventilate_formaldehyde: 'Lüften — Formaldehyd', ventilate_vocs: 'Lüften — VOC erhöht' },
    subtitle: { air_quality_healthy: 'Luftqualität liegt innerhalb gesunder Grenzen', co_danger: 'CO bei {value} ppm — gefährliche Werte erkannt', co_danger_unknown: 'Gefährliche CO-Werte', co_warning: 'CO bei {value} ppm — alle Fenster sofort öffnen', co_warning_unknown: 'Hohe CO-Werte', co_elevated: 'CO bei {value} ppm — Belüftung verbessern', co_elevated_unknown: 'CO-Werte erhöht', purifier_pm25: 'PM2.5 bei {value} μg/m³ - Luft filtern', purifier_pm10: 'PM10 bei {value} μg/m³ - Luft filtern', purifier_generic: 'Partikelwerte erhöht', consider_purifier_pm10: 'PM10 bei {value} μg/m³', open_window_co2: 'CO₂ bei {value} ppm - Frischluft benötigt', purifier_ventilate: 'CO₂: {co2} ppm, PM2.5: {pm25} μg/m³', ventilate_now_co2: 'CO₂ bei {value} ppm - kann Konzentration beeinträchtigen', ventilate_formaldehyde: 'HCHO bei {value} ppb - Lüftung erforderlich', ventilate_formaldehyde_unknown: 'Formaldehydwerte erhöht', ventilate_vocs: 'tVOC bei {value} ppb - Lüftung erforderlich', ventilate_vocs_unknown: 'VOC-Werte erhöht', too_dry: 'Luftfeuchtigkeit bei {value}% - Luftbefeuchter empfohlen', too_humid: 'Luftfeuchtigkeit bei {value}% - Lüften', consider_ventilating_co2: 'CO₂ bei {value} ppm', consider_ventilating_pm25: 'PM2.5 bei {value} μg/m³', consider_ventilating_generic: 'Leicht erhöhte Werte', keep_closed_outdoor_pm25_poor: 'Außen PM2.5 bei {value} μg/m³ - schlechte Außenluft', keep_closed_outdoor_pm25: 'Außen PM2.5 bei {value} μg/m³ - schlechter als innen', keep_closed_outdoor_co2: 'Außen CO₂ bei {value} ppm - schlechter als innen', keep_closed_generic: 'Außenluft ist schlechter als Innenluft' },
    radon: { advisory_danger: 'Radon hoch — Minderung erforderlich', advisory_warning: 'Radon über EPA-Eingreifrichtwert', advisory_info: 'Radon — genau beobachten', short_term: 'Kurzfristig', long_term: 'Langfristig' },
    editor: { name: 'Kartenname', co2_entity: 'CO₂-Sensor', pm25_entity: 'PM2.5-Sensor', humidity_entity: 'Feuchtigkeitssensor', temperature_entity: 'Temperatursensor', radon_entity: 'Radon-Sensor', radon_longterm_entity: 'Radon-Sensor (Langzeit)', co_entity: 'CO-Sensor (Kohlenmonoxid)', hcho_entity: 'Formaldehyd-Sensor (HCHO)', tvoc_entity: 'tVOC-Sensor', pm4_entity: 'PM4-Sensor', nox_entity: 'NOx-Sensor', pm1_entity: 'PM1-Sensor', pm10_entity: 'PM10-Sensor', pm03_entity: 'PM0.3-Sensor', outdoor_co2_entity: 'Außen CO₂', outdoor_pm25_entity: 'Außen PM2.5', outdoor_humidity_entity: 'Außen Luftfeuchtigkeit', outdoor_temperature_entity: 'Außen Temperatur', outdoor_co_entity: 'Außen CO', outdoor_hcho_entity: 'Außen HCHO', outdoor_tvoc_entity: 'Außen tVOC', outdoor_pm1_entity: 'Außen PM1', outdoor_pm10_entity: 'Außen PM10', outdoor_pm03_entity: 'Außen PM0.3', air_quality_entity: 'Luftqualitätsindex (optional)', hours_to_show: 'Diagrammverlauf', temperature_unit: 'Temperatureinheit', radon_unit: 'Radon-Einheit', tvoc_unit: 'tVOC-Messtyp', language: 'Sprache', section_additional: 'Weitere Sensoren', section_outdoor: 'Außensensoren', section_advanced: 'Erweitert' }
  },
  pt: {
    status: { excellent: 'Excelente', good: 'Bom', moderate: 'Moderado', fair: 'Regular', poor: 'Ruim', very_poor: 'Muito Ruim', extremely_poor: 'Extremamente Ruim', dangerous: 'Perigoso' },
    recommendation: { all_good: 'Tudo Bem', ventilate_now: 'Ventile Agora', run_air_purifier: 'Ligar o Purificador', consider_air_purifier: 'Considere um Purificador', open_window: 'Abra a Janela', air_purifier_ventilate: 'Purificador + Ventilação', co_danger: 'Perigo de CO — Saia do Ambiente', co_warning: 'Alerta de CO — Ventile Agora', co_elevated: 'CO Elevado — Ventile', consider_ventilating: 'Considere Ventilar', keep_windows_closed: 'Mantenha as Janelas Fechadas', too_dry: 'Muito Seco', too_humid: 'Muito Úmido', ventilate_formaldehyde: 'Ventile — Formaldeído', ventilate_vocs: 'Ventile — COVs Elevados' },
    subtitle: { air_quality_healthy: 'A qualidade do ar está dentro dos limites saudáveis', co_danger: 'CO em {value} ppm — níveis perigosos detectados', co_danger_unknown: 'Níveis perigosos de CO', co_warning: 'CO em {value} ppm — abra todas as janelas imediatamente', co_warning_unknown: 'Níveis altos de CO', co_elevated: 'CO em {value} ppm — melhore a ventilação', co_elevated_unknown: 'Níveis de CO elevados', purifier_pm25: 'PM2.5 em {value} μg/m³ - filtre o ar', purifier_pm10: 'PM10 em {value} μg/m³ - filtre o ar', purifier_generic: 'Níveis de partículas elevados', consider_purifier_pm10: 'PM10 em {value} μg/m³', open_window_co2: 'CO₂ em {value} ppm - ar fresco necessário', purifier_ventilate: 'CO₂: {co2} ppm, PM2.5: {pm25} μg/m³', ventilate_now_co2: 'CO₂ em {value} ppm - pode afetar a concentração', ventilate_formaldehyde: 'HCHO em {value} ppb - ventilação necessária', ventilate_formaldehyde_unknown: 'Níveis de formaldeído elevados', ventilate_vocs: 'tVOC em {value} ppb - ventilação necessária', ventilate_vocs_unknown: 'Níveis de COVs elevados', too_dry: 'Umidade em {value}% - considere um umidificador', too_humid: 'Umidade em {value}% - ventile', consider_ventilating_co2: 'CO₂ em {value} ppm', consider_ventilating_pm25: 'PM2.5 em {value} μg/m³', consider_ventilating_generic: 'Níveis levemente elevados', keep_closed_outdoor_pm25_poor: 'PM2.5 externo em {value} μg/m³ - ar externo de má qualidade', keep_closed_outdoor_pm25: 'PM2.5 externo em {value} μg/m³ - pior que o ar interno', keep_closed_outdoor_co2: 'CO₂ externo em {value} ppm - pior que o ar interno', keep_closed_generic: 'A qualidade do ar externo é pior que o interno' },
    radon: { advisory_danger: 'Radônio Alto — Mitigação Necessária', advisory_warning: 'Radônio Acima do Nível de Ação da EPA', advisory_info: 'Radônio — Monitorar de Perto', short_term: 'Curto prazo', long_term: 'Longo prazo' },
    editor: { name: 'Nome do Cartão', co2_entity: 'Sensor de CO₂', pm25_entity: 'Sensor de PM2.5', humidity_entity: 'Sensor de Umidade', temperature_entity: 'Sensor de Temperatura', radon_entity: 'Sensor de Radônio', radon_longterm_entity: 'Sensor de Radônio (Longo Prazo)', co_entity: 'Sensor de CO (Monóxido de Carbono)', hcho_entity: 'Sensor de Formaldeído (HCHO)', tvoc_entity: 'Sensor de tVOC', pm4_entity: 'Sensor de PM4', nox_entity: 'Sensor de NOx', pm1_entity: 'Sensor de PM1', pm10_entity: 'Sensor de PM10', pm03_entity: 'Sensor de PM0.3', outdoor_co2_entity: 'CO₂ Externo', outdoor_pm25_entity: 'PM2.5 Externo', outdoor_humidity_entity: 'Umidade Externa', outdoor_temperature_entity: 'Temperatura Externa', outdoor_co_entity: 'CO Externo', outdoor_hcho_entity: 'HCHO Externo', outdoor_tvoc_entity: 'tVOC Externo', outdoor_pm1_entity: 'PM1 Externo', outdoor_pm10_entity: 'PM10 Externo', outdoor_pm03_entity: 'PM0.3 Externo', air_quality_entity: 'Índice de Qualidade do Ar (opcional)', hours_to_show: 'Histórico do Gráfico', temperature_unit: 'Unidade de Temperatura', radon_unit: 'Unidade de Radônio', tvoc_unit: 'Tipo de Medição de tVOC', language: 'Idioma', section_additional: 'Sensores Adicionais', section_outdoor: 'Sensores Externos', section_advanced: 'Avançado' }
  }
};

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
    this._history = { co2: [], pm25: [], pm1: [], pm10: [], pm03: [], pm4: [], hcho: [], tvoc: [], nox: [], co: [], radon: [], radon_longterm: [], humidity: [], temperature: [], outdoor_co2: [], outdoor_pm25: [], outdoor_pm1: [], outdoor_pm10: [], outdoor_pm03: [], outdoor_hcho: [], outdoor_tvoc: [], outdoor_co: [], outdoor_humidity: [], outdoor_temperature: [] };
    this._historyLoaded = false;
    this._graphData = {};
    this._isDragging = false;
  }

  setConfig(config) {
    if (!config) throw new Error('Invalid configuration');

    const indoorEntityKeys = [
      'co2_entity', 'pm25_entity', 'pm1_entity', 'pm10_entity', 'pm03_entity',
      'pm4_entity', 'hcho_entity', 'tvoc_entity', 'nox_entity', 'co_entity',
      'radon_entity', 'radon_longterm_entity', 'humidity_entity', 'temperature_entity'
    ];
    const outdoorEntityKeys = [
      'outdoor_co2_entity', 'outdoor_pm25_entity', 'outdoor_pm1_entity',
      'outdoor_pm10_entity', 'outdoor_pm03_entity', 'outdoor_hcho_entity',
      'outdoor_tvoc_entity', 'outdoor_co_entity', 'outdoor_humidity_entity',
      'outdoor_temperature_entity'
    ];
    const hasIndoor = indoorEntityKeys.some(k => config[k]);
    const hasOutdoor = outdoorEntityKeys.some(k => config[k]);

    if (!hasIndoor && !hasOutdoor) {
      throw new Error('Please configure at least one sensor entity');
    }

    this._config = {
      name: 'Air Quality',
      hours_to_show: 24,
      temperature_unit: 'auto',
      radon_unit: 'auto',
      show_min_max: false,
      display: 'full',
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
        outdoor_co_entity: 'co_entity',
        outdoor_humidity_entity: 'humidity_entity',
        outdoor_temperature_entity: 'temperature_entity'
      };
      for (const [outdoorKey, primaryKey] of Object.entries(promotionMap)) {
        if (this._config[outdoorKey] && !this._config[primaryKey]) {
          this._config[primaryKey] = this._config[outdoorKey];
          delete this._config[outdoorKey];
        }
      }
    }

    this._rendered = false;
    this._historyLoaded = false;
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

  _formatGraphValue(value, unit) {
    if (unit === 'pCi/L') return value.toFixed(1);
    if (unit === 'ppm' || unit === 'ppb' || unit === 'p/0.1L' || unit === 'Bq/m³' || unit === '%' || unit === '°F' || unit === '°C') {
      return Math.round(value);
    }
    return value.toFixed(1);
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

    this._renderMinMaxMarker(graphId, 'max', points[maxIdx], colorFn(minMax.max), this._formatGraphValue(minMax.max, this._graphData[graphId].unit));
    this._renderMinMaxMarker(graphId, 'min', points[minIdx], colorFn(minMax.min), this._formatGraphValue(minMax.min, this._graphData[graphId].unit));
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

  _isCompact() {
    return this._config.display === 'compact';
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
    this._hass = hass;
    if (!this._rendered) {
      this._initialRender();
      this._rendered = true;
      // Compact mode doesn't draw graphs, so skip the history fetch
      if (!this._isCompact()) this._loadHistory();
    }
    this._updateStates();
  }

  // Resolve the metric display order. User's `order` wins; anything they
  // didn't list is appended in the default order so users never lose a
  // configured metric by forgetting to mention it.
  _getMetricOrder() {
    const all = ['co', 'radon', 'co2', 'pm25', 'pm10', 'pm1', 'pm03', 'pm4', 'hcho', 'tvoc', 'nox', 'humidity', 'temperature'];
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
    if (this._config.humidity_entity) size += 1;
    if (this._config.temperature_entity) size += 1;
    return size;
  }

  // Dispatch HA's standard action event for tap/hold/double_tap. HA's action
  // handler reads tap_action/hold_action/double_tap_action from the config.
  // Pattern documented at developers.home-assistant.io/blog/2023/07/07.
  _fireAction(action) {
    const actionKey = `${action}_action`;
    if (!this._config[actionKey]) return;
    const event = new CustomEvent('hass-action', {
      bubbles: true,
      composed: true,
      detail: { config: this._config, action }
    });
    this.dispatchEvent(event);
  }

  async _loadHistory() {
    if (!this._hass || this._historyLoaded) return;

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (this._config.hours_to_show * 60 * 60 * 1000));
    // Persist the requested time window so _renderGraph can plot points by
    // timestamp (not by data-point index) and so axis labels reflect the
    // configured window even when data doesn't span it.
    this._timeWindow = { start: startTime.getTime(), end: endTime.getTime() };

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
      if (this._config.radon_longterm_entity) {
        promises.push(this._fetchHistory(this._config.radon_longterm_entity, startTime, endTime));
        keys.push('radon_longterm');
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
      if (this._config.pm4_entity) {
        promises.push(this._fetchHistory(this._config.pm4_entity, startTime, endTime));
        keys.push('pm4');
      }
      if (this._config.nox_entity) {
        promises.push(this._fetchHistory(this._config.nox_entity, startTime, endTime));
        keys.push('nox');
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

  // Resolve the active threshold array for a metric — config override first,
  // then the metric's default. The metric key matches the key in METRIC_DEFS
  // (e.g. 'co2' uses `co2_thresholds`; 'temp_c' uses `temperature_thresholds`).
  _metricThresholds(metric) {
    const overrideKey = {
      co: 'co_thresholds', co2: 'co2_thresholds', pm25: 'pm25_thresholds',
      pm10: 'pm10_thresholds', pm1: 'pm1_thresholds', pm03: 'pm03_thresholds',
      pm4: 'pm4_thresholds', hcho: 'hcho_thresholds', nox: 'nox_thresholds',
      radon: 'radon_thresholds', humidity: 'humidity_thresholds',
      tvoc_ppb: 'tvoc_thresholds', tvoc_index: 'tvoc_thresholds',
      temp_c: 'temperature_thresholds', temp_f: 'temperature_thresholds'
    }[metric];
    const override = overrideKey && this._config[overrideKey];
    if (Array.isArray(override) && override.length === 4 && override.every(n => typeof n === 'number')) {
      return override;
    }
    return METRIC_DEFS[metric].defaultThresholds;
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
    return this._tieredValue(value, this._metricThresholds(metric), METRIC_DEFS[metric].labels);
  }

  _getCO2Color(value)  { return this._getMetricColor('co2', value); }
  _getPM25Color(value) { return this._getMetricColor('pm25', value); }
  _getHCHOColor(value) { return this._getMetricColor('hcho', value); }
  _getPM4Color(value)  { return this._getMetricColor('pm4', value); }
  _getNOxColor(value)  { return this._getMetricColor('nox', value); }
  _getHumidityColor(value) { return this._getMetricColor('humidity', value); }
  _getPM1Color(value)  { return this._getMetricColor('pm1', value); }
  _getPM10Color(value) { return this._getMetricColor('pm10', value); }
  _getPM03Color(value) { return this._getMetricColor('pm03', value); }
  _getCOColor(value)   { return this._getMetricColor('co', value); }
  _getRadonColor(bq)   { return this._getMetricColor('radon', bq); }

  _isVOCIndex() {
    if (this._config.tvoc_unit && this._config.tvoc_unit !== 'auto') {
      return this._config.tvoc_unit === 'index';
    }
    // Auto-detect from entity unit_of_measurement
    if (this._hass && this._config.tvoc_entity) {
      const uom = this._hass.states[this._config.tvoc_entity]?.attributes?.unit_of_measurement;
      if (uom === undefined || uom === null || uom === '' || uom?.toLowerCase() === 'voc index') return true;
      if (uom === 'ppb' || uom === 'mg/m³') return false;
    }
    return false;
  }

  _getTVOCUnit() {
    return this._isVOCIndex() ? '' : 'ppb';
  }

  _tvocMetric() {
    return this._isVOCIndex() ? 'tvoc_index' : 'tvoc_ppb';
  }

  _getTVOCColor(value) {
    return this._getMetricColor(this._tvocMetric(), value);
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
    if (!this._config.radon_entity && !this._config.radon_longterm_entity) return null;
    const shortRaw = this._config.radon_entity ? this._getNumericState(this._config.radon_entity) : 0;
    const longRaw = this._config.radon_longterm_entity ? this._getNumericState(this._config.radon_longterm_entity) : 0;
    const shortBq = this._getRadonBqm3(shortRaw);
    const longBq = this._getRadonBqm3(longRaw);
    const bq = Math.max(shortBq, longBq);
    const raw = shortBq >= longBq ? shortRaw : longRaw;
    const display = this._formatRadon(raw);
    const threshold = this._isRadonPciL() ? '4.0 pCi/L' : '148 Bq/m³';

    // Build subtitle with both values when both are configured
    const bothConfigured = this._config.radon_entity && this._config.radon_longterm_entity;
    const valuesStr = bothConfigured
      ? `${this._t('radon', 'short_term')}: ${this._formatRadon(shortRaw)}, ${this._t('radon', 'long_term')}: ${this._formatRadon(longRaw)}`
      : `Radon at ${display}`;

    if (bq >= 300) return {
      level: 'danger',
      text: this._t('radon', 'advisory_danger'),
      subtitle: `${valuesStr} - contact a certified radon mitigator`
    };
    if (bq >= 148) return {
      level: 'warning',
      text: this._t('radon', 'advisory_warning'),
      subtitle: `${valuesStr} - EPA recommends mitigation above ${threshold}`
    };
    if (bq >= 100) return {
      level: 'info',
      text: this._t('radon', 'advisory_info'),
      subtitle: `${valuesStr} - approaching action level`
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

  _tempMetric() {
    return this._isCelsius() ? 'temp_c' : 'temp_f';
  }

  _getTempColor(value) {
    return this._getMetricColor(this._tempMetric(), value);
  }

  _getOverallStatus() {
    const co = this._config.co_entity ? this._getNumericState(this._config.co_entity) : 0;
    const co2 = this._config.co2_entity ? this._getNumericState(this._config.co2_entity) : 0;
    const pm25 = this._config.pm25_entity ? this._getNumericState(this._config.pm25_entity) : 0;
    const radonShort = this._config.radon_entity ? this._getRadonBqm3(this._getNumericState(this._config.radon_entity)) : 0;
    const radonLong = this._config.radon_longterm_entity ? this._getRadonBqm3(this._getNumericState(this._config.radon_longterm_entity)) : 0;
    const radon = Math.max(radonShort, radonLong);

    // If air_quality_entity is configured, use it
    if (this._config.air_quality_entity) {
      const quality = this._getState(this._config.air_quality_entity);
      const statusKey = String(quality || '').toLowerCase().replace(/\s+/g, '_');
      const translated = this._t('status', statusKey);
      // If translation found, use it; otherwise show the raw entity state cleaned up
      const display = translated !== statusKey ? translated : String(quality || '').replace('_', ' ');
      return { status: display, color: this._getQualityColor(quality) };
    }

    // CO is a life-safety metric — always takes priority
    if (co > 35) return { status: this._t('status', 'dangerous'), color: '#d32f2f' };
    if (co > 9) return { status: this._t('status', 'poor'), color: '#f44336' };

    // Radon — only degrades status at EPA action level and above
    if (radon >= 300) return { status: this._t('status', 'poor'), color: '#f44336' };
    if (radon >= 148) return { status: this._t('status', 'fair'), color: '#ff9800' };

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

  // Translation-key-based recommendation dispatcher. Used internally for icon
  // lookup and subtitle generation. `_getRecommendation()` translates the key
  // for display.
  _getRecommendationKey() {
    // Outdoor-only mode: recommendations assume an indoor context (open window,
    // run air purifier, etc.) and are nonsensical when monitoring ambient air.
    if (this._outdoorOnly) return null;
    const co = this._config.co_entity ? this._getNumericState(this._config.co_entity) : 0;
    const co2 = this._config.co2_entity ? this._getNumericState(this._config.co2_entity) : 0;
    const pm25 = this._config.pm25_entity ? this._getNumericState(this._config.pm25_entity) : 0;
    const pm10 = this._config.pm10_entity ? this._getNumericState(this._config.pm10_entity) : 0;
    const hcho = this._config.hcho_entity ? this._getNumericState(this._config.hcho_entity) : 0;
    const tvoc = this._config.tvoc_entity ? this._getNumericState(this._config.tvoc_entity) : 0;
    const humidity = this._config.humidity_entity ? this._getNumericState(this._config.humidity_entity) : 45;

    const outdoorCo2 = this._config.outdoor_co2_entity ? this._getNumericState(this._config.outdoor_co2_entity) : null;
    const outdoorPm25 = this._config.outdoor_pm25_entity ? this._getNumericState(this._config.outdoor_pm25_entity) : null;
    const outdoorIsWorse = (outdoorPm25 !== null && outdoorPm25 > pm25) || (outdoorCo2 !== null && outdoorCo2 > co2);

    // CO life-safety first (never suppressed by outdoor override)
    if (co > 100) return 'co_danger';
    if (co > 35) return 'co_warning';

    let key = 'all_good';
    if (co2 > 1500) key = 'ventilate_now';
    else if (pm25 > 35) key = 'run_air_purifier';
    else if (pm10 > 150) key = 'run_air_purifier';
    else if (hcho > 100) key = 'ventilate_formaldehyde';
    else if (tvoc > 500) key = 'ventilate_vocs';
    else if (pm25 > 25 && co2 > 1000) key = 'air_purifier_ventilate';
    else if (pm25 > 25) key = 'run_air_purifier';
    else if (pm10 > 75) key = 'consider_air_purifier';
    else if (co2 > 1000) key = 'open_window';
    else if (co > 9) key = 'co_elevated';
    else if (humidity < 30) key = 'too_dry';
    else if (humidity > 60) key = 'too_humid';
    else if (co2 > 800 || pm25 > 15) key = 'consider_ventilating';

    // CO recommendations are intentionally excluded — CO is always life-safety
    const ventilationKeys = ['ventilate_now', 'open_window', 'consider_ventilating', 'air_purifier_ventilate', 'ventilate_formaldehyde', 'ventilate_vocs', 'co_elevated'];
    if (outdoorIsWorse && ventilationKeys.includes(key)) {
      if (pm25 > 25) return 'run_air_purifier';
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
      co_danger: 'mdi:alert-octagon',
      co_warning: 'mdi:alert-octagon',
      co_elevated: 'mdi:alert',
      keep_windows_closed: 'mdi:window-closed-variant',
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
    const hasAction = !!this._config.tap_action;
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
          ${hasAction ? 'cursor: pointer; transition: background 0.15s ease;' : ''}
        }
        ${hasAction ? `
        ha-card.compact:hover {
          background: rgba(var(--rgb-primary-text-color, 0, 0, 0), 0.04);
        }
        ` : ''}
        .compact-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .title {
          font-size: 1.05em;
          font-weight: 600;
          color: var(--primary-text-color);
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
        }
        .status-badge ha-icon {
          --mdc-icon-size: 18px;
        }
      </style>
      <ha-card class="compact">
        <div class="compact-row">
          <span class="title">${this._config.name}</span>
          <div class="status-badge" id="status-badge">
            <ha-icon id="status-icon" icon="mdi:leaf"></ha-icon>
            <span id="status-text">Loading…</span>
          </div>
        </div>
      </ha-card>
    `;
    const card = this.shadowRoot.querySelector('ha-card');
    if (card && hasAction) {
      card.addEventListener('click', () => this._fireAction('tap'));
    }
    if (card && this._config.hold_action) {
      // Distinguish a hold (>500ms) from a tap
      let timer = null;
      let held = false;
      const start = () => {
        held = false;
        timer = setTimeout(() => { held = true; this._fireAction('hold'); }, 500);
      };
      const end = () => { if (timer) { clearTimeout(timer); timer = null; } };
      card.addEventListener('mousedown', start);
      card.addEventListener('mouseup', end);
      card.addEventListener('mouseleave', end);
      card.addEventListener('touchstart', start, { passive: true });
      card.addEventListener('touchend', end);
      // Suppress the tap action when a hold fired
      card.addEventListener('click', (e) => {
        if (held) { e.stopImmediatePropagation(); held = false; }
      }, true);
    }
  }

  _initialRender() {
    if (this._isCompact()) {
      this._renderCompact();
      return;
    }
    const showCO = !!this._config.co_entity;
    const showRadon = !!(this._config.radon_entity || this._config.radon_longterm_entity);
    const showCO2 = !!this._config.co2_entity;
    const showPM25 = !!this._config.pm25_entity;
    const showPM10 = !!this._config.pm10_entity;
    const showPM1 = !!this._config.pm1_entity;
    const showPM03 = !!this._config.pm03_entity;
    const showHCHO = !!this._config.hcho_entity;
    const showTVOC = !!this._config.tvoc_entity;
    const showPM4 = !!this._config.pm4_entity;
    const showNOx = !!this._config.nox_entity;
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
          <div class="header">
            <span class="title">${this._config.name}</span>
            <div class="status-badge" id="status-badge">
              <ha-icon id="status-icon" icon="mdi:leaf"></ha-icon>
              <span id="status-text">Good</span>
            </div>
          </div>

          ${!this._outdoorOnly ? `
          <div class="recommendation" id="recommendation">
            <ha-icon id="rec-icon" icon="mdi:check-circle"></ha-icon>
            <div class="recommendation-text">
              <div class="recommendation-title" id="rec-title">All Good</div>
              <div class="recommendation-subtitle" id="rec-subtitle">Air quality is within healthy limits</div>
            </div>
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
            <div class="graph-container" id="radon-graph-container" data-entity="${this._config.radon_entity || this._config.radon_longterm_entity}">
              <div class="graph-header">
                <span class="graph-label">Radon</span>
                <span class="graph-value" id="radon-value">-- <span class="unit">${this._getRadonUnit()}</span><span class="status" id="radon-status"></span></span>
              </div>
              ${this._config.radon_longterm_entity ? `<div class="graph-value-secondary" id="radon-lt-value">LT: -- <span class="unit">${this._getRadonUnit()}</span></div>` : ''}
              <div class="graph-wrapper">
                <div class="graph" id="radon-graph">
                  <svg id="radon-svg" viewBox="0 0 300 50" preserveAspectRatio="none"></svg>
                </div>
                <div class="graph-cursor" id="radon-cursor"></div>
                <div class="graph-tooltip" id="radon-tooltip">
                  <div class="graph-tooltip-value"></div>
                  ${this._config.radon_longterm_entity ? `<div class="graph-tooltip-outdoor"></div>` : ''}
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
                <span class="graph-value" id="tvoc-value">-- <span class="unit">${this._config.tvoc_unit === 'index' ? '' : 'ppb'}</span><span class="status" id="tvoc-status"></span></span>
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

            ${showPM4 ? `
            <div class="graph-container" id="pm4-graph-container" data-entity="${this._config.pm4_entity}">
              <div class="graph-header">
                <span class="graph-label">PM4</span>
                <span class="graph-value" id="pm4-value">-- <span class="unit">μg/m³</span><span class="status" id="pm4-status"></span></span>
              </div>
              <div class="graph-wrapper">
                <div class="graph" id="pm4-graph">
                  <svg id="pm4-svg" viewBox="0 0 300 50" preserveAspectRatio="none"></svg>
                </div>
                <div class="graph-cursor" id="pm4-cursor"></div>
                <div class="graph-tooltip" id="pm4-tooltip">
                  <div class="graph-tooltip-value"></div>
                  <div class="graph-tooltip-outdoor"></div>
                  <div class="graph-tooltip-time"></div>
                </div>
              </div>
              <div class="graph-time-axis" id="pm4-time-axis"></div>
            </div>
            ` : ''}

            ${showNOx ? `
            <div class="graph-container" id="nox-graph-container" data-entity="${this._config.nox_entity}">
              <div class="graph-header">
                <span class="graph-label">NOx</span>
                <span class="graph-value" id="nox-value">-- <span class="unit">ppb</span><span class="status" id="nox-status"></span></span>
              </div>
              <div class="graph-wrapper">
                <div class="graph" id="nox-graph">
                  <svg id="nox-svg" viewBox="0 0 300 50" preserveAspectRatio="none"></svg>
                </div>
                <div class="graph-cursor" id="nox-cursor"></div>
                <div class="graph-tooltip" id="nox-tooltip">
                  <div class="graph-tooltip-value"></div>
                  <div class="graph-tooltip-outdoor"></div>
                  <div class="graph-tooltip-time"></div>
                </div>
              </div>
              <div class="graph-time-axis" id="nox-time-axis"></div>
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

    this._applyMetricOrder();
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
    const pm4 = this._config.pm4_entity ? this._getNumericState(this._config.pm4_entity) : null;
    const nox = this._config.nox_entity ? this._getNumericState(this._config.nox_entity) : null;
    const humidity = this._config.humidity_entity ? this._getNumericState(this._config.humidity_entity) : null;
    const temp = this._config.temperature_entity ? this._getNumericState(this._config.temperature_entity) : null;
    const recKey = this._getRecommendationKey();
    const recommendation = this._t('recommendation', recKey);
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

    // Compact mode only renders the status badge — skip the rest of the DOM updates
    if (this._isCompact()) return;

    // Update recommendation
    const recIcon = this.shadowRoot.getElementById('rec-icon');
    const recTitle = this.shadowRoot.getElementById('rec-title');
    const recSubtitle = this.shadowRoot.getElementById('rec-subtitle');
    const recContainer = this.shadowRoot.getElementById('recommendation');

    if (recIcon && recommendation) {
      recIcon.setAttribute('icon', this._getRecommendationIcon(recKey));
      recTitle.textContent = recommendation;

      let subtitle = '';
      if (recKey === 'co_danger') {
        subtitle = co !== null ? this._ts('subtitle', 'co_danger', { value: co.toFixed(0) }) : this._t('subtitle', 'co_danger_unknown');
      } else if (recKey === 'co_warning') {
        subtitle = co !== null ? this._ts('subtitle', 'co_warning', { value: co.toFixed(0) }) : this._t('subtitle', 'co_warning_unknown');
      } else if (recKey === 'co_elevated') {
        subtitle = co !== null ? this._ts('subtitle', 'co_elevated', { value: co.toFixed(0) }) : this._t('subtitle', 'co_elevated_unknown');
      } else if (recKey === 'all_good') {
        subtitle = this._t('subtitle', 'air_quality_healthy');
      } else if (recKey === 'run_air_purifier') {
        if (pm25 !== null && pm25 > 35) subtitle = this._ts('subtitle', 'purifier_pm25', { value: pm25.toFixed(0) });
        else if (pm10 !== null && pm10 > 150) subtitle = this._ts('subtitle', 'purifier_pm10', { value: pm10.toFixed(0) });
        else if (pm25 !== null) subtitle = this._ts('subtitle', 'purifier_pm25', { value: pm25.toFixed(0) });
        else subtitle = this._t('subtitle', 'purifier_generic');
      } else if (recKey === 'consider_air_purifier' && pm10 !== null) {
        subtitle = this._ts('subtitle', 'consider_purifier_pm10', { value: pm10.toFixed(0) });
      } else if (recKey === 'open_window' && co2 !== null) {
        subtitle = this._ts('subtitle', 'open_window_co2', { value: Math.round(co2) });
      } else if (recKey === 'air_purifier_ventilate' && co2 !== null && pm25 !== null) {
        subtitle = this._ts('subtitle', 'purifier_ventilate', { co2: Math.round(co2), pm25: pm25.toFixed(0) });
      } else if (recKey === 'ventilate_now' && co2 !== null) {
        subtitle = this._ts('subtitle', 'ventilate_now_co2', { value: Math.round(co2) });
      } else if (recKey === 'ventilate_formaldehyde') {
        const hcho = this._config.hcho_entity ? this._getNumericState(this._config.hcho_entity) : null;
        subtitle = hcho !== null ? this._ts('subtitle', 'ventilate_formaldehyde', { value: hcho.toFixed(0) }) : this._t('subtitle', 'ventilate_formaldehyde_unknown');
      } else if (recKey === 'ventilate_vocs') {
        const tvoc = this._config.tvoc_entity ? this._getNumericState(this._config.tvoc_entity) : null;
        subtitle = tvoc !== null ? this._ts('subtitle', 'ventilate_vocs', { value: tvoc.toFixed(0) }) : this._t('subtitle', 'ventilate_vocs_unknown');
      } else if (recKey === 'too_dry' && humidity !== null) {
        subtitle = this._ts('subtitle', 'too_dry', { value: Math.round(humidity) });
      } else if (recKey === 'too_humid' && humidity !== null) {
        subtitle = this._ts('subtitle', 'too_humid', { value: Math.round(humidity) });
      } else if (recKey === 'consider_ventilating') {
        if (co2 !== null && co2 > 800) subtitle = this._ts('subtitle', 'consider_ventilating_co2', { value: Math.round(co2) });
        else if (pm25 !== null && pm25 > 15) subtitle = this._ts('subtitle', 'consider_ventilating_pm25', { value: pm25.toFixed(0) });
        else subtitle = this._t('subtitle', 'consider_ventilating_generic');
      } else if (recKey === 'keep_windows_closed') {
        const outdoorPm25 = this._config.outdoor_pm25_entity ? this._getNumericState(this._config.outdoor_pm25_entity) : null;
        const outdoorCo2 = this._config.outdoor_co2_entity ? this._getNumericState(this._config.outdoor_co2_entity) : null;
        if (outdoorPm25 !== null && outdoorPm25 > 35) subtitle = this._ts('subtitle', 'keep_closed_outdoor_pm25_poor', { value: outdoorPm25.toFixed(0) });
        else if (outdoorPm25 !== null) subtitle = this._ts('subtitle', 'keep_closed_outdoor_pm25', { value: outdoorPm25.toFixed(0) });
        else if (outdoorCo2 !== null) subtitle = this._ts('subtitle', 'keep_closed_outdoor_co2', { value: Math.round(outdoorCo2) });
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
      return ` <span class="outdoor-value">(out: ${unit === 'μg/m³' || unit === 'ppb' ? val.toFixed(1) : Math.round(val)} ${unit})</span>`;
    };

    // Update CO
    if (co !== null) {
      const coColor = this._getCOColor(co);
      const coValueEl = this.shadowRoot.getElementById('co-value');
      if (coValueEl) {
        coValueEl.innerHTML = `${co.toFixed(1)} <span class="unit">ppm</span><span class="status" id="co-status"></span>${outdoorSuffix('outdoor_co_entity', co, 'ppm')}`;
        const statusEl = coValueEl.querySelector('.status');
        statusEl.textContent = this._getMetricStatus('co', co);
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
        statusEl.textContent = this._getMetricStatus('radon', radonBq);
        statusEl.style.background = radonColor + '22';
        statusEl.style.color = radonColor;
        radonValueEl.style.color = radonColor;
      }
    }

    // Update Radon Long-Term
    if (this._config.radon_longterm_entity) {
      const ltRaw = this._getNumericState(this._config.radon_longterm_entity);
      const ltBq = this._getRadonBqm3(ltRaw);
      const ltColor = this._getRadonColor(ltBq);
      const radonUnit = this._getRadonUnit();
      const ltValueEl = this.shadowRoot.getElementById('radon-lt-value');
      if (ltValueEl) {
        const displayVal = radonUnit === 'pCi/L' ? ltRaw.toFixed(1) : Math.round(ltRaw);
        const statusText = this._getMetricStatus('radon', ltBq);
        ltValueEl.innerHTML = `LT: ${displayVal} <span class="unit">${radonUnit}</span><span class="status">${statusText}</span>`;
        const statusEl = ltValueEl.querySelector('.status');
        statusEl.style.background = ltColor + '22';
        statusEl.style.color = ltColor;
        ltValueEl.style.color = ltColor;
      }
      // If no short-term radon entity, show long-term as the main value
      if (!this._config.radon_entity) {
        const radonValueEl = this.shadowRoot.getElementById('radon-value');
        if (radonValueEl) {
          const displayVal = radonUnit === 'pCi/L' ? ltRaw.toFixed(1) : Math.round(ltRaw);
          radonValueEl.innerHTML = `${displayVal} <span class="unit">${radonUnit}</span><span class="status" id="radon-status"></span>`;
          const statusEl = radonValueEl.querySelector('.status');
          statusEl.textContent = this._getMetricStatus('radon', ltBq);
          statusEl.style.background = ltColor + '22';
          statusEl.style.color = ltColor;
          radonValueEl.style.color = ltColor;
        }
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
        statusEl.textContent = this._getMetricStatus('co2', co2);
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
        statusEl.textContent = this._getMetricStatus('pm25', pm25);
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
        statusEl.textContent = this._getMetricStatus('pm10', pm10);
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
        statusEl.textContent = this._getMetricStatus('pm1', pm1);
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
        statusEl.textContent = this._getMetricStatus('pm03', pm03);
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
        statusEl.textContent = this._getMetricStatus('hcho', hcho);
        statusEl.style.background = hchoColor + '22';
        statusEl.style.color = hchoColor;
        hchoValueEl.style.color = hchoColor;
      }
    }

    // Update tVOC
    if (tvoc !== null) {
      const tvocColor = this._getTVOCColor(tvoc);
      const tvocUnit = this._getTVOCUnit();
      const tvocValueEl = this.shadowRoot.getElementById('tvoc-value');
      if (tvocValueEl) {
        const unitSpan = tvocUnit ? ` <span class="unit">${tvocUnit}</span>` : '';
        tvocValueEl.innerHTML = `${tvoc.toFixed(1)}${unitSpan}<span class="status" id="tvoc-status"></span>${outdoorSuffix('outdoor_tvoc_entity', tvoc, tvocUnit)}`;
        const statusEl = tvocValueEl.querySelector('.status');
        statusEl.textContent = this._getMetricStatus(this._tvocMetric(), tvoc);
        statusEl.style.background = tvocColor + '22';
        statusEl.style.color = tvocColor;
        tvocValueEl.style.color = tvocColor;
      }
    }

    // Update PM4
    if (pm4 !== null) {
      const pm4Color = this._getPM4Color(pm4);
      const pm4ValueEl = this.shadowRoot.getElementById('pm4-value');
      if (pm4ValueEl) {
        pm4ValueEl.innerHTML = `${pm4.toFixed(1)} <span class="unit">μg/m³</span><span class="status" id="pm4-status"></span>`;
        const statusEl = pm4ValueEl.querySelector('.status');
        statusEl.textContent = this._getMetricStatus('pm4', pm4);
        statusEl.style.background = pm4Color + '22';
        statusEl.style.color = pm4Color;
        pm4ValueEl.style.color = pm4Color;
      }
    }

    // Update NOx
    if (nox !== null) {
      const noxColor = this._getNOxColor(nox);
      const noxValueEl = this.shadowRoot.getElementById('nox-value');
      if (noxValueEl) {
        noxValueEl.innerHTML = `${nox.toFixed(1)} <span class="unit">ppb</span><span class="status" id="nox-status"></span>`;
        const statusEl = noxValueEl.querySelector('.status');
        statusEl.textContent = this._getMetricStatus('nox', nox);
        statusEl.style.background = noxColor + '22';
        statusEl.style.color = noxColor;
        noxValueEl.style.color = noxColor;
      }
    }

    // Update Humidity
    if (humidity !== null) {
      const humidityColor = this._getHumidityColor(humidity);
      const humidityValueEl = this.shadowRoot.getElementById('humidity-value');
      if (humidityValueEl) {
        humidityValueEl.innerHTML = `${Math.round(humidity)} <span class="unit">%</span><span class="status" id="humidity-status"></span>${outdoorSuffix('outdoor_humidity_entity', humidity, '%')}`;
        const statusEl = humidityValueEl.querySelector('.status');
        statusEl.textContent = this._getMetricStatus('humidity', humidity);
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
        statusEl.textContent = this._getMetricStatus(this._tempMetric(), temp);
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
    if ((this._config.radon_entity || this._config.radon_longterm_entity) && (this._history.radon.length || this._history.radon_longterm.length)) {
      const radonUnit = this._getRadonUnit();
      const radonMax = this._isRadonPciL() ? 10 : 370;
      const primaryData = this._history.radon.length ? this._history.radon : this._history.radon_longterm;
      const overlayData = this._config.radon_entity && this._config.radon_longterm_entity ? this._history.radon_longterm : [];
      this._renderGraph('radon', primaryData, (v) => this._getRadonColor(this._getRadonBqm3(v)), 0, radonMax, radonUnit, overlayData, 'Long-term');
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
      const tvocUnit = this._getTVOCUnit();
      const tvocMax = this._isVOCIndex() ? 500 : 1500;
      this._renderGraph('tvoc', this._history.tvoc, this._getTVOCColor.bind(this), 0, tvocMax, tvocUnit, this._history.outdoor_tvoc);
    }
    if (this._config.pm4_entity && this._history.pm4.length) {
      this._renderGraph('pm4', this._history.pm4, this._getPM4Color.bind(this), 0, 75, 'μg/m³');
    }
    if (this._config.nox_entity && this._history.nox.length) {
      this._renderGraph('nox', this._history.nox, this._getNOxColor.bind(this), 0, 300, 'ppb');
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
    const dataMin = Math.min(...allValues, minVal);
    const dataMax = Math.max(...allValues, maxVal);
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

    this._graphData[graphId] = { points, outdoorPoints, unit, colorFn, outdoorLabel: outdoorLabel || 'Outdoor' };

    if (this._config.show_min_max) {
      this._updateMinMaxDisplay(graphId, data, colorFn);
    } else {
      this._clearMinMaxMarkers(graphId);
    }

    if (points.length < 2) return;

    const ts = Date.now();
    const gradientId = `gradient-${graphId}-${ts}`;
    // Gradient stops follow each point's actual X position so colors line up
    // with the (now time-based) line geometry instead of being evenly spaced.
    const stopPct = (px) => (((px - padding) / (width - 2 * padding)) * 100);
    let gradientStops = '';
    for (let i = 0; i < points.length; i++) {
      gradientStops += `<stop offset="${stopPct(points[i].x).toFixed(2)}%" style="stop-color:${points[i].color}" />`;
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
        outdoorGradientStops += `<stop offset="${stopPct(outdoorPoints[i].x).toFixed(2)}%" style="stop-color:${outdoorPoints[i].color}" />`;
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
      // Use the configured time window so labels match the X scale even when
      // data doesn't span the full window (e.g. sensor unavailable for hours).
      const win = this._timeWindow || { start: points[0].time, end: points[points.length - 1].time };
      const startTime = new Date(win.start);
      const endTime = new Date(win.end);
      const midTime = new Date((win.start + win.end) / 2);

      const formatTime = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      timeAxis.innerHTML = `
        <span>${formatTime(startTime)}</span>
        <span>${formatTime(midTime)}</span>
        <span>${formatTime(endTime)}</span>
      `;
    }
  }

  _setupGraphInteractions() {
    const graphIds = ['co', 'radon', 'co2', 'pm25', 'pm10', 'pm1', 'pm03', 'pm4', 'hcho', 'tvoc', 'nox', 'humidity', 'temperature'].filter(id => {
      if (id === 'radon') return this._config.radon_entity || this._config.radon_longterm_entity;
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
        outdoorEl.textContent = `${data.outdoorLabel}: ${formatVal(closestOutdoor.value)} ${data.unit}`;
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
        language: 'auto',
        ...config
      };
    }

    _resolveLanguage() {
      const explicit = this._config && this._config.language;
      let lang;
      if (explicit && explicit !== 'auto') {
        lang = explicit;
      } else {
        lang = (this.hass && this.hass.locale && this.hass.locale.language) || (this.hass && this.hass.language) || 'en';
      }
      const code = String(lang).split('-')[0].toLowerCase();
      return TRANSLATIONS[code] ? code : 'en';
    }

    _t(group, key) {
      const lang = this._resolveLanguage();
      const pack = TRANSLATIONS[lang] && TRANSLATIONS[lang][group];
      if (pack && pack[key] !== undefined) return pack[key];
      const enPack = TRANSLATIONS.en[group];
      if (enPack && enPack[key] !== undefined) return enPack[key];
      return key;
    }

    _computeLabel = (schema) => {
      // Arrow form preserves `this` since ha-form invokes computeLabel detached from the editor.
      if (!schema || !schema.name) return '';
      // English fallback for fields added after the translation pack was written.
      const localFallbacks = {
        show_min_max: 'Show min/max for each metric',
        order: 'Sensor Order (list of metric names)',
        display: 'Display Mode',
        tap_action: 'Tap Action',
        hold_action: 'Hold Action',
        double_tap_action: 'Double-Tap Action'
      };
      const translated = this._t('editor', schema.name);
      if (translated !== schema.name) return translated;
      return localFallbacks[schema.name] || schema.name;
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
          title: this._t('editor', 'section_additional'),
          flatten: true,
          schema: [
            {
              type: 'grid',
              schema: [
                { name: 'radon_entity', selector: { entity: { domain: 'sensor' } } },
                { name: 'radon_longterm_entity', selector: { entity: { domain: 'sensor' } } },
              ]
            },
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
                { name: 'tvoc_entity', selector: { entity: { domain: 'sensor' } } },
                { name: 'pm4_entity', selector: { entity: { domain: 'sensor' } } },
              ]
            },
            {
              type: 'grid',
              schema: [
                { name: 'nox_entity', selector: { entity: { domain: 'sensor' } } },
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
          title: this._t('editor', 'section_outdoor'),
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
                { name: 'outdoor_tvoc_entity', selector: { entity: { domain: 'sensor' } } },
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
          title: this._t('editor', 'section_advanced'),
          flatten: true,
          schema: [
            { name: 'air_quality_entity', selector: { entity: { domain: 'sensor' } } },
            { name: 'hours_to_show', selector: { number: { min: 1, max: 168, mode: 'box', unit_of_measurement: 'hours' } } },
            { name: 'show_min_max', selector: { boolean: {} } },
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
              { value: 'humidity', label: 'Humidity' },
              { value: 'temperature', label: 'Temperature' }
            ] } } },
            { name: 'display', selector: { select: { options: [{ value: 'full', label: 'Full (graphs and details)' }, { value: 'compact', label: 'Compact (status badge only)' }], mode: 'dropdown' } } },
            { name: 'tap_action', selector: { ui_action: {} } },
            { name: 'hold_action', selector: { ui_action: {} } },
            { name: 'double_tap_action', selector: { ui_action: {} } },
            { name: 'language', selector: { select: { options: [{ value: 'auto', label: 'Auto (from HA)' }, { value: 'en', label: 'English' }, { value: 'es', label: 'Español' }, { value: 'fr', label: 'Français' }, { value: 'de', label: 'Deutsch' }, { value: 'pt', label: 'Português' }], mode: 'dropdown' } } },
            { name: 'temperature_unit', selector: { select: { options: [{ value: 'auto', label: 'Auto (from HA)' }, { value: 'F', label: 'Fahrenheit (°F)' }, { value: 'C', label: 'Celsius (°C)' }], mode: 'dropdown' } } },
            { name: 'radon_unit', selector: { select: { options: [{ value: 'auto', label: 'Auto (from sensor)' }, { value: 'pCi/L', label: 'pCi/L (US)' }, { value: 'Bq/m³', label: 'Bq/m³ (International)' }], mode: 'dropdown' } } },
            { name: 'tvoc_unit', selector: { select: { options: [{ value: 'auto', label: 'Auto-detect' }, { value: 'ppb', label: 'Absolute (ppb)' }, { value: 'index', label: 'VOC Index (Sensirion)' }], mode: 'dropdown' } } },
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

