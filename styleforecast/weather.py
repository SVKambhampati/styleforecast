from __future__ import annotations

import requests

GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

# WMO weather interpretation codes → (condition label, icon emoji)
_WMO = {
    0:  ("Clear Sky",        "clear"),
    1:  ("Mainly Clear",     "clear"),
    2:  ("Partly Cloudy",    "clouds"),
    3:  ("Overcast",         "clouds"),
    45: ("Fog",              "fog"),
    48: ("Icy Fog",          "fog"),
    51: ("Light Drizzle",    "drizzle"),
    53: ("Drizzle",          "drizzle"),
    55: ("Heavy Drizzle",    "drizzle"),
    61: ("Light Rain",       "rain"),
    63: ("Rain",             "rain"),
    65: ("Heavy Rain",       "rain"),
    71: ("Light Snow",       "snow"),
    73: ("Snow",             "snow"),
    75: ("Heavy Snow",       "snow"),
    77: ("Snow Grains",      "snow"),
    80: ("Rain Showers",     "rain"),
    81: ("Heavy Showers",    "rain"),
    82: ("Violent Showers",  "rain"),
    85: ("Snow Showers",     "snow"),
    86: ("Heavy Snow Showers","snow"),
    95: ("Thunderstorm",     "thunderstorm"),
    96: ("Thunderstorm",     "thunderstorm"),
    99: ("Thunderstorm",     "thunderstorm"),
}


def _geocode(query: str) -> tuple[float, float, str]:
    """Return (lat, lon, display_name) for a city name or ZIP code."""
    resp = requests.get(GEOCODE_URL, params={"name": query, "count": 1, "language": "en", "format": "json"}, timeout=8)
    if not resp.ok:
        raise RuntimeError(f"Geocoding error {resp.status_code}")
    results = resp.json().get("results")
    if not results:
        raise RuntimeError(f"Location '{query}' not found.")
    r = results[0]
    name = r.get("name", query)
    country = r.get("country_code", "")
    display = f"{name}, {country}" if country else name
    return r["latitude"], r["longitude"], display


def fetch_weather_by_coords(lat: float, lon: float, display_name: str = "My Location") -> dict:
    """Fetch weather directly from coordinates — no geocoding needed."""
    return _get_weather_data(lat, lon, display_name, query=display_name)


def fetch_forecast(lat: float, lon: float) -> list:
    """Return a 5-day daily forecast list from Open-Meteo."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": [
            "weather_code",
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_probability_max",
            "wind_speed_10m_max",
            "uv_index_max",
        ],
        "forecast_days": 5,
        "timezone": "auto",
    }
    resp = requests.get(FORECAST_URL, params=params, timeout=8)
    resp.raise_for_status()
    data = resp.json()
    daily = data["daily"]

    days = []
    for i in range(len(daily["time"])):
        wmo = daily["weather_code"][i]
        condition_label, icon = _WMO.get(wmo, ("Unknown", "clear"))
        days.append({
            "date": daily["time"][i],
            "temp_max": round(daily["temperature_2m_max"][i], 1),
            "temp_min": round(daily["temperature_2m_min"][i], 1),
            "rain_chance": daily["precipitation_probability_max"][i] or 0,
            "wind_speed": round(daily["wind_speed_10m_max"][i], 1),
            "uv_index": round((daily["uv_index_max"][i] or 0), 1),
            "condition": condition_label,
            "icon": icon,
        })
    return days


def fetch_weather(query: str) -> dict:
    """
    Fetch current weather for a city name or ZIP code via Open-Meteo.
    No API key required.
    Returns a normalized dict ready to store in WeatherLog.
    """
    lat, lon, city_name = _geocode(query.strip())

    return _get_weather_data(lat, lon, city_name, query=query.strip())


def _get_weather_data(lat: float, lon: float, city_name: str, query: str = "") -> dict:
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": [
            "temperature_2m",
            "relative_humidity_2m",
            "wind_speed_10m",
            "precipitation",
            "weather_code",
            "uv_index",
        ],
        "hourly": "precipitation_probability",
        "forecast_hours": 3,
        "wind_speed_unit": "ms",
        "timezone": "auto",
    }

    resp = requests.get(FORECAST_URL, params=params, timeout=8)
    if not resp.ok:
        raise RuntimeError(f"Weather API error {resp.status_code}: {resp.text}")

    data = resp.json()
    cur = data["current"]

    temp_c = cur["temperature_2m"]
    temp_f = round(temp_c * 9 / 5 + 32, 1)
    humidity = cur.get("relative_humidity_2m", 0)
    wind_speed = cur.get("wind_speed_10m", 0)
    precipitation = cur.get("precipitation", 0)
    wmo_code = cur.get("weather_code", 0)
    uv_index = cur.get("uv_index", 0) or 0

    condition_label, icon = _WMO.get(wmo_code, ("Unknown", "clear"))

    # Rain chance: average of next 3 hourly precipitation probability values
    hourly_prob = data.get("hourly", {}).get("precipitation_probability", [])
    if hourly_prob:
        rain_chance = round(sum(hourly_prob[:3]) / len(hourly_prob[:3]), 1)
    else:
        rain_chance = min(precipitation * 40, 100) if precipitation else 0

    return {
        "city": city_name,
        "query": query or city_name,
        "lat": round(lat, 6),
        "lon": round(lon, 6),
        "temp_c": round(temp_c, 1),
        "temp_f": temp_f,
        "condition": condition_label.split()[0],   # short form: "Rain", "Clear", etc.
        "description": condition_label,
        "rain_chance": rain_chance,
        "wind_speed": round(wind_speed, 1),
        "uv_index": round(uv_index, 1),
        "humidity": humidity,
        "icon": icon,
    }
