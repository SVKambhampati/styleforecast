import os
import requests


OWM_BASE = "https://api.openweathermap.org/data/2.5"
UV_BASE = "https://api.openweathermap.org/data/2.5/uvi"


def _api_key():
    key = os.environ.get("OPENWEATHER_API_KEY", "")
    if not key:
        raise ValueError("OPENWEATHER_API_KEY not set")
    return key


def fetch_weather(query: str) -> dict:
    """
    Fetch current weather for a city name or ZIP code.
    Returns a normalized dict ready to store in WeatherLog.
    Raises RuntimeError on API errors.
    """
    key = _api_key()

    # Determine if query looks like a US ZIP code
    params = {"appid": key, "units": "metric"}
    if query.strip().lstrip("-").isdigit():
        params["zip"] = f"{query.strip()},us"
    else:
        params["q"] = query.strip()

    resp = requests.get(f"{OWM_BASE}/weather", params=params, timeout=8)
    if resp.status_code == 401:
        raise RuntimeError("Invalid OpenWeatherMap API key.")
    if resp.status_code == 404:
        raise RuntimeError(f"Location '{query}' not found.")
    if not resp.ok:
        raise RuntimeError(f"Weather API error {resp.status_code}: {resp.text}")

    data = resp.json()

    temp_c = data["main"]["temp"]
    temp_f = temp_c * 9 / 5 + 32
    condition = data["weather"][0]["main"]
    description = data["weather"][0]["description"].capitalize()
    icon = data["weather"][0]["icon"]
    wind_speed = data.get("wind", {}).get("speed", 0)
    humidity = data["main"].get("humidity", 0)
    city_name = data.get("name", query)
    lat = data["coord"]["lat"]
    lon = data["coord"]["lon"]

    # Rain chance: OWM current doesn't expose probability; use rain volume as proxy
    rain_1h = data.get("rain", {}).get("1h", 0)
    rain_chance = min(rain_1h * 40, 100) if rain_1h else (80 if condition in ("Rain", "Drizzle", "Thunderstorm") else 0)

    # UV index (separate endpoint)
    uv_index = _fetch_uv(lat, lon, key)

    return {
        "city": city_name,
        "query": query.strip(),
        "temp_c": round(temp_c, 1),
        "temp_f": round(temp_f, 1),
        "condition": condition,
        "description": description,
        "rain_chance": round(rain_chance, 1),
        "wind_speed": round(wind_speed, 1),
        "uv_index": round(uv_index, 1),
        "humidity": humidity,
        "icon": icon,
    }


def _fetch_uv(lat: float, lon: float, key: str) -> float:
    try:
        resp = requests.get(
            UV_BASE,
            params={"lat": lat, "lon": lon, "appid": key},
            timeout=5,
        )
        if resp.ok:
            return resp.json().get("value", 0)
    except Exception:
        pass
    return 0
