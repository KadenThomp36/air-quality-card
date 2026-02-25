# Air Quality Card

A custom Home Assistant Lovelace card for monitoring indoor air quality with beautiful gradient graphs and WHO-based health thresholds.

![Air Quality Card Preview](https://raw.githubusercontent.com/KadenThomp36/air-quality-card/main/images/preview.png)

## Features

- **Real-time monitoring** of CO2, PM2.5, HCHO, tVOC, humidity, and temperature
- **Gradient-colored graphs** that change color based on air quality levels
- **Interactive hover/touch** to see historical values at any point
- **Health-based thresholds** following WHO 2021 guidelines and ASHRAE standards
- **Actionable recommendations** like "Open Window" or "Run Air Purifier"
- **Outdoor sensor comparison** - optional dashed line overlay with smart ventilation recommendations
- **Tap to expand** - click any graph to open the full Home Assistant history view
- **Visual configuration editor** - no YAML required

## Installation

### HACS (Recommended)

1. Open HACS in Home Assistant
2. Click on "Frontend"
3. Click the three dots in the top right and select "Custom repositories"
4. Add the repository URL: `https://github.com/KadenThomp36/air-quality-card`
5. Select "Lovelace" as the category
6. Click "Add"
7. Search for "Air Quality Card" and install it
8. Refresh your browser

### Manual Installation

1. Download `air-quality-card.js` from the latest release
2. Copy it to `/config/www/air-quality-card/air-quality-card.js`
3. Add the resource in Home Assistant:
   - Go to Settings → Dashboards → Resources
   - Add `/local/air-quality-card/air-quality-card.js` as a JavaScript Module

## Configuration

### Using the Visual Editor

1. Add a new card to your dashboard
2. Search for "Air Quality Card"
3. Configure the entities using the visual editor

### YAML Configuration

```yaml
type: custom:air-quality-card
name: Office Air Quality
co2_entity: sensor.air_quality_co2
pm25_entity: sensor.air_quality_pm25
humidity_entity: sensor.air_quality_humidity
temperature_entity: sensor.air_quality_temperature
air_quality_entity: sensor.air_quality_index
recommendation_entity: sensor.air_quality_recommendation
hours_to_show: 24
temperature_unit: C
outdoor_co2_entity: sensor.outdoor_co2
outdoor_pm25_entity: sensor.outdoor_pm25
```

### Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `name` | string | No | "Air Quality" | Card title |
| `co2_entity` | string | No* | - | CO2 sensor entity ID |
| `pm25_entity` | string | No* | - | PM2.5 sensor entity ID |
| `hcho_entity` | string | No* | - | Formaldehyde (HCHO) sensor entity ID |
| `tvoc_entity` | string | No* | - | Volatile organic compounds (tVOC) sensor entity ID |
| `humidity_entity` | string | No* | - | Humidity sensor entity ID |
| `temperature_entity` | string | No* | - | Temperature sensor entity ID |
| `air_quality_entity` | string | No | - | Overall air quality index entity |
| `recommendation_entity` | string | No | - | Recommendation template sensor |
| `hours_to_show` | number | No | 24 | Hours of history to display (1-168) |
| `temperature_unit` | string | No | "F" | Temperature unit: "F" (Fahrenheit) or "C" (Celsius) |
| `outdoor_co2_entity` | string | No | - | Outdoor CO2 sensor for comparison |
| `outdoor_pm25_entity` | string | No | - | Outdoor PM2.5 sensor for comparison |
| `outdoor_hcho_entity` | string | No | - | Outdoor HCHO sensor for comparison |
| `outdoor_tvoc_entity` | string | No | - | Outdoor tVOC sensor for comparison |
| `outdoor_humidity_entity` | string | No | - | Outdoor humidity sensor for comparison |
| `outdoor_temperature_entity` | string | No | - | Outdoor temperature sensor for comparison |

\* At least one sensor entity is required. Use any combination that fits your setup.

### Outdoor Sensors

Configure outdoor sensor entities to see a **dashed comparison line** on each graph showing outdoor conditions alongside indoor readings. When outdoor sensors are configured:

- A subtle dashed line appears on the corresponding graph
- Hovering shows both indoor and outdoor values
- Current outdoor values appear next to indoor readings
- **Smart recommendations** avoid suggesting ventilation when outdoor air is worse (e.g., "Keep Windows Closed" instead of "Open Window")

## Recommendation Sensor

For the best experience, create a template sensor that provides recommendations. Add this to your `configuration.yaml`:

```yaml
template:
  - sensor:
      - name: "Air Quality Recommendation"
        unique_id: air_quality_recommendation
        state: >
          {% set co2 = states('sensor.YOUR_CO2_SENSOR') | float(0) %}
          {% set pm25 = states('sensor.YOUR_PM25_SENSOR') | float(0) %}
          {% set humidity = states('sensor.YOUR_HUMIDITY_SENSOR') | float(0) %}
          {% if co2 > 1500 %}
            Ventilate Now
          {% elif pm25 > 35 %}
            Run Air Purifier
          {% elif pm25 > 25 and co2 > 1000 %}
            Air Purifier + Ventilate
          {% elif pm25 > 25 %}
            Run Air Purifier
          {% elif co2 > 1000 %}
            Open Window
          {% elif humidity < 30 %}
            Too Dry
          {% elif humidity > 60 %}
            Too Humid
          {% elif co2 > 800 or pm25 > 15 %}
            Consider Ventilating
          {% else %}
            All Good
          {% endif %}
```

## Health Thresholds

### CO2 (Carbon Dioxide)
| Level | Range | Color | Meaning |
|-------|-------|-------|---------|
| Excellent | < 600 ppm | Green | Fresh outdoor air levels |
| Good | 600-800 ppm | Light Green | Well-ventilated space |
| Moderate | 800-1000 ppm | Yellow | Acceptable, consider ventilation |
| Elevated | 1000-1500 ppm | Orange | May affect concentration |
| Poor | > 1500 ppm | Red | Ventilation needed |

### PM2.5 (Fine Particulate Matter)
Based on WHO 2021 Air Quality Guidelines:
| Level | Range | Color | Meaning |
|-------|-------|-------|---------|
| Excellent | < 5 µg/m³ | Green | WHO annual guideline |
| Good | 5-15 µg/m³ | Light Green | WHO 24-hour guideline |
| Moderate | 15-25 µg/m³ | Yellow | Slightly elevated |
| Elevated | 25-35 µg/m³ | Orange | Consider air purifier |
| Poor | > 35 µg/m³ | Red | Air purifier recommended |

### HCHO (Formaldehyde)
| Level | Range | Color | Meaning |
|-------|-------|-------|---------|
| Excellent | < 20 ppb | Green | Safe levels |
| Good | 20-50 ppb | Light Green | Acceptable |
| Moderate | 50-100 ppb | Yellow | Consider ventilation |
| Elevated | 100-200 ppb | Orange | Ventilation needed |
| Poor | > 200 ppb | Red | Take action |

### tVOC (Volatile Organic Compounds)
| Level | Range | Color | Meaning |
|-------|-------|-------|---------|
| Excellent | < 100 ppb | Green | Clean air |
| Good | 100-300 ppb | Light Green | Acceptable |
| Moderate | 300-500 ppb | Yellow | Consider ventilation |
| Elevated | 500-1000 ppb | Orange | Ventilation needed |
| Poor | > 1000 ppb | Red | Take action |

### Humidity
| Level | Range | Color | Meaning |
|-------|-------|-------|---------|
| Too Dry | < 30% | Orange | Use humidifier |
| Dry | 30-40% | Light Green | Acceptable |
| Comfortable | 40-50% | Green | Ideal range |
| Humid | 50-60% | Light Green | Acceptable |
| Too Humid | > 60% | Orange | Improve ventilation |

## Supported Devices

This card works with any sensor that provides entities for CO2, PM2.5, HCHO, tVOC, humidity, or temperature. Use any combination — even a single sensor works. Tested with:

- IKEA VINDSTYRKA / ALPSTUGA (via Matter)
- Aqara TVOC Air Quality Monitor
- Xiaomi Air Quality Monitor
- SenseAir S8
- Any ESPHome-based air quality sensor

## Development

```bash
# Clone the repository
git clone https://github.com/KadenThomp36/air-quality-card.git

# The card is vanilla JavaScript with no build step required
# Simply edit air-quality-card.js and test in Home Assistant
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Credits

- Thresholds based on [WHO 2021 Air Quality Guidelines](https://www.who.int/publications/i/item/9789240034228)
- CO2 recommendations based on [ASHRAE Standard 62.1](https://www.ashrae.org/technical-resources/bookstore/standards-62-1-62-2)
