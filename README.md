# Air Quality Card

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-yellow?style=flat&logo=buy-me-a-coffee)](https://buymeacoffee.com/kadenthomp36)

A custom Home Assistant Lovelace card for monitoring indoor air quality with beautiful gradient graphs and WHO-based health thresholds.

![Air Quality Card Preview](https://raw.githubusercontent.com/KadenThomp36/air-quality-card/main/images/preview.png)

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Built-in Recommendations](#built-in-recommendations)
- [Health Thresholds](#health-thresholds)
- [Supported Devices](#supported-devices)
- [Development](#development)
- [Other Cards](#other-cards)
- [Star History](#star-history)
- [Support](#support)

## Features

- **Real-time monitoring** of CO, Radon, CO2, PM2.5, PM10, PM1, PM0.3, HCHO, tVOC, humidity, and temperature
- **CO safety alerts** -- critical red warnings for dangerous carbon monoxide levels
- **Radon advisory banner** -- separate long-term health advisory with EPA/WHO thresholds (supports pCi/L and Bq/m3)
- **Gradient-colored graphs** that change color based on air quality levels
- **Interactive hover/touch** to see historical values at any point
- **Health-based thresholds** following WHO 2021 guidelines and ASHRAE standards
- **Actionable recommendations** like "Open Window" or "Run Air Purifier"
- **Outdoor sensor comparison** - optional dashed line overlay with smart ventilation recommendations
- **Tap to expand** - click any graph to open the full Home Assistant history view
- **Visual configuration editor** - no YAML required, with collapsible sections for clean organization

## Installation

### HACS (Recommended)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=KadenThomp36&repository=air-quality-card&category=plugin)

Or manually: open HACS, search for "Air Quality Card", click Install, and refresh your browser.

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
4. Primary sensors (CO₂, PM2.5, Humidity, Temperature) are always visible
5. Expand "Additional Sensors" for Radon, CO, HCHO, tVOC, PM1, PM10, PM0.3
6. Expand "Outdoor Sensors" for comparison data

### YAML Configuration

```yaml
type: custom:air-quality-card
name: Office Air Quality
co2_entity: sensor.air_quality_co2
pm25_entity: sensor.air_quality_pm25
pm10_entity: sensor.air_quality_pm10
co_entity: sensor.air_quality_co
radon_entity: sensor.wave_1_day_average
radon_longterm_entity: sensor.wave_longterm_average
humidity_entity: sensor.air_quality_humidity
temperature_entity: sensor.air_quality_temperature
air_quality_entity: sensor.air_quality_index
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
| `pm1_entity` | string | No* | - | PM1 sensor entity ID |
| `pm10_entity` | string | No* | - | PM10 sensor entity ID |
| `pm03_entity` | string | No* | - | PM0.3 particle count sensor entity ID |
| `co_entity` | string | No* | - | Carbon monoxide (CO) sensor entity ID |
| `radon_entity` | string | No* | - | Radon sensor entity ID (supports pCi/L and Bq/m3) |
| `radon_longterm_entity` | string | No | - | Radon long-term average sensor (shown as dashed overlay on radon graph) |
| `hcho_entity` | string | No* | - | Formaldehyde (HCHO) sensor entity ID |
| `tvoc_entity` | string | No* | - | Volatile organic compounds (tVOC) sensor entity ID |
| `humidity_entity` | string | No* | - | Humidity sensor entity ID |
| `temperature_entity` | string | No* | - | Temperature sensor entity ID |
| `air_quality_entity` | string | No | - | Overall air quality index entity |
| `hours_to_show` | number | No | 24 | Hours of history to display (1-168) |
| `temperature_unit` | string | No | "auto" | Temperature unit: "auto" (detect from HA), "F" (Fahrenheit), or "C" (Celsius) |
| `radon_unit` | string | No | "auto" | Radon unit: "auto" (detect from sensor), "pCi/L" (US), or "Bq/m3" (International) |
| `outdoor_co2_entity` | string | No | - | Outdoor CO2 sensor for comparison |
| `outdoor_pm25_entity` | string | No | - | Outdoor PM2.5 sensor for comparison |
| `outdoor_pm1_entity` | string | No | - | Outdoor PM1 sensor for comparison |
| `outdoor_pm10_entity` | string | No | - | Outdoor PM10 sensor for comparison |
| `outdoor_pm03_entity` | string | No | - | Outdoor PM0.3 sensor for comparison |
| `outdoor_co_entity` | string | No | - | Outdoor CO sensor for comparison |
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

## Built-in Recommendations

The card automatically generates actionable recommendations based on your sensor readings -- no template sensors needed. It evaluates CO, CO2, PM2.5, PM10, HCHO, tVOC, and humidity levels, and when outdoor sensors are configured, it avoids suggesting ventilation when outdoor air is worse.

**CO safety alerts** are always shown regardless of outdoor conditions -- carbon monoxide is a life-safety concern. If CO exceeds dangerous levels, the card shows a critical red warning with instructions to leave the area.

**Radon advisory banner** appears as a separate element below the main recommendation when radon levels are elevated. Unlike other pollutants, radon changes over days/weeks and requires professional mitigation (not "open a window"), so it uses its own advisory system instead of the main recommendation waterfall. The advisory shows at three levels: informational (approaching action level), warning (above EPA action level of 4.0 pCi/L / 148 Bq/m3), and danger (significantly elevated, mitigation needed).

## Health Thresholds

### CO (Carbon Monoxide)
| Level | Range | Color | Meaning |
|-------|-------|-------|---------|
| Safe | < 4 ppm | Green | Normal background levels |
| Low | 4-9 ppm | Light Green | Acceptable for short exposure |
| Moderate | 9-35 ppm | Yellow | Improve ventilation |
| High | 35-100 ppm | Orange | Ventilate immediately |
| Dangerous | > 100 ppm | Red | Leave area immediately |

### Radon
Based on EPA and WHO guidelines:
| Level | Range (pCi/L) | Range (Bq/m3) | Color | Meaning |
|-------|---------------|----------------|-------|---------|
| Excellent | < 1.3 | < 48 | Green | Low risk |
| Good | 1.3-2.7 | 48-100 | Light Green | Below WHO reference level |
| Elevated | 2.7-4.0 | 100-148 | Yellow | Approaching EPA action level |
| High | 4.0-8.0 | 148-300 | Orange | Above EPA action level, consider mitigation |
| Dangerous | > 8.0 | > 300 | Red | Professional mitigation needed |

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

### PM10 (Coarse Particulate Matter)
Based on WHO 2021 Air Quality Guidelines:
| Level | Range | Color | Meaning |
|-------|-------|-------|---------|
| Excellent | < 15 µg/m³ | Green | WHO annual guideline |
| Good | 15-45 µg/m³ | Light Green | Acceptable |
| Moderate | 45-75 µg/m³ | Yellow | Slightly elevated |
| Elevated | 75-150 µg/m³ | Orange | Consider air purifier |
| Poor | > 150 µg/m³ | Red | Air purifier recommended |

### PM1 (Ultrafine Particulate Matter)
| Level | Range | Color | Meaning |
|-------|-------|-------|---------|
| Excellent | < 5 µg/m³ | Green | Clean air |
| Good | 5-15 µg/m³ | Light Green | Acceptable |
| Moderate | 15-25 µg/m³ | Yellow | Slightly elevated |
| Elevated | 25-35 µg/m³ | Orange | Consider air purifier |
| Poor | > 35 µg/m³ | Red | Air purifier recommended |

### PM0.3 (Particle Count)
| Level | Range | Color | Meaning |
|-------|-------|-------|---------|
| Clean | < 500 p/0.1L | Green | Very clean air |
| Good | 500-1000 p/0.1L | Light Green | Normal levels |
| Moderate | 1000-3000 p/0.1L | Yellow | Slightly elevated |
| Elevated | 3000-5000 p/0.1L | Orange | Consider air purifier |
| Poor | > 5000 p/0.1L | Red | Air purifier recommended |

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

This card works with any sensor that provides entities for CO, Radon, CO2, PM2.5, PM10, PM1, PM0.3, HCHO, tVOC, humidity, or temperature. Use any combination -- even a single sensor works. Tested with:

- IKEA VINDSTYRKA / ALPSTUGA (via Matter)
- Aqara TVOC Air Quality Monitor
- Xiaomi Air Quality Monitor
- SenseAir S8
- AirGradient ONE / Open Air
- PurpleAir sensors
- Airthings Wave / Wave Plus (radon, CO2, tVOC, humidity, temperature)
- Any ESPHome-based air quality sensor

## Development

```bash
# Clone the repository
git clone https://github.com/KadenThomp36/air-quality-card.git

# The card is vanilla JavaScript with no build step required
# Simply edit air-quality-card.js and test in Home Assistant

# Run tests
node test.js
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Other Cards

If you like this card, check out my other Home Assistant cards:

- [Garage Card](https://github.com/KadenThomp36/garage-card) — A top-down visual garage card with door state, car presence, and light control

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=KadenThomp36/air-quality-card&type=Date)](https://star-history.com/#KadenThomp36/air-quality-card&Date)

## Support

If you find this card useful, consider buying me a coffee!

[![Buy Me a Coffee](https://raw.githubusercontent.com/KadenThomp36/air-quality-card/main/images/bmc-button.png)](https://buymeacoffee.com/kadenthomp36)

## Credits

- Thresholds based on [WHO 2021 Air Quality Guidelines](https://www.who.int/publications/i/item/9789240034228)
- CO2 recommendations based on [ASHRAE Standard 62.1](https://www.ashrae.org/technical-resources/bookstore/standards-62-1-62-2)
- CO thresholds based on [EPA/WHO carbon monoxide guidelines](https://www.epa.gov/co-pollution)
