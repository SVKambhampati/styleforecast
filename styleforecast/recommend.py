"""
Outfit recommendation engine.

Scores outfits 0–100 based on weather conditions and wardrobe item attributes.
"""
from itertools import product
from typing import Optional


# ---------------------------------------------------------------------------
# Individual scoring helpers
# ---------------------------------------------------------------------------

def temperature_score(item, temp_c: float) -> float:
    """Score how appropriate the warmth level is for the temperature."""
    warmth = item.warmth
    if temp_c >= 25:          # hot
        scores = {"light": 100, "medium": 50, "heavy": 10}
    elif temp_c >= 15:        # warm/mild
        scores = {"light": 80, "medium": 100, "heavy": 55}
    elif temp_c >= 5:         # cool
        scores = {"light": 30, "medium": 80, "heavy": 100}
    else:                     # cold
        scores = {"light": 5, "medium": 40, "heavy": 100}
    return scores.get(warmth, 50)


def rain_score(item, rain_chance: float) -> float:
    """Penalize items with no rain suitability when rain is likely."""
    tags = item.weather_tag_list() if hasattr(item, "weather_tag_list") else []
    has_rain_tag = "rain" in tags
    if rain_chance >= 60:
        return 100 if has_rain_tag else 20
    elif rain_chance >= 30:
        return 80 if has_rain_tag else 60
    return 100  # doesn't matter if it's dry


def wind_score(item, wind_speed: float) -> float:
    """Prefer heavier or wind-tagged items on gusty days."""
    tags = item.weather_tag_list() if hasattr(item, "weather_tag_list") else []
    has_wind_tag = "windy" in tags
    warmth = item.warmth
    if wind_speed >= 10:      # strong wind (m/s)
        base = 100 if has_wind_tag else 50
        warmth_bonus = {"heavy": 20, "medium": 10, "light": 0}.get(warmth, 0)
        return min(base + warmth_bonus, 100)
    return 100


def uv_score(item, uv_index: float) -> float:
    """Light items score better in high UV; but coverage matters too."""
    tags = item.weather_tag_list() if hasattr(item, "weather_tag_list") else []
    if uv_index >= 8:         # very high / extreme
        return 80 if "hot" in tags else 60
    elif uv_index >= 5:       # moderate–high
        return 90
    return 100


def formality_score(items: list) -> float:
    """Score how consistent the formality levels are across all outfit items."""
    levels = [i.formality for i in items]
    formal_set = set(levels)
    if len(formal_set) == 1:
        return 100
    if formal_set <= {"casual", "smart casual"}:
        return 80
    if formal_set <= {"smart casual", "formal"}:
        return 75
    return 40  # mixed casual + formal = poor match


# Colour compatibility families
_COLOR_FAMILIES = {
    "neutral": {"white", "black", "grey", "gray", "cream", "beige", "tan", "off-white", "charcoal"},
    "earth": {"brown", "camel", "khaki", "olive", "sand", "rust", "terracotta"},
    "cool": {"blue", "navy", "teal", "slate", "mint", "sky", "cobalt"},
    "warm": {"red", "orange", "yellow", "coral", "burgundy", "maroon", "gold"},
    "nature": {"green", "forest", "sage", "hunter", "lime", "emerald"},
    "pastel": {"lavender", "pink", "lilac", "peach", "blush"},
}


def _color_family(color: str) -> Optional[str]:
    c = color.lower().strip()
    for family, members in _COLOR_FAMILIES.items():
        if c in members or any(m in c for m in members):
            return family
    return None


def color_score(items: list) -> float:
    """Reward neutral anchors and matching/complementary color families."""
    families = [_color_family(i.color) for i in items]
    neutral_count = sum(1 for f in families if f == "neutral")
    non_neutral = [f for f in families if f and f != "neutral"]
    unique_families = set(non_neutral)

    if neutral_count >= len(items) - 1:
        return 95   # mostly neutrals — always safe
    if len(unique_families) <= 1:
        return 90   # monochromatic family
    if len(unique_families) == 2:
        return 75
    return 50       # too many clashing families


def season_score(items: list, current_season: str) -> float:
    """Prefer items tagged for the current season or 'all-season'."""
    scores = []
    for item in items:
        if item.season == "all-season" or item.season == current_season:
            scores.append(100)
        else:
            scores.append(40)
    return sum(scores) / len(scores) if scores else 50


def rating_boost(item_ids: list, ratings: list) -> float:
    """
    Give a small boost (0–15 pts) for outfits whose items have been
    positively rated together before.
    """
    item_set = set(item_ids)
    relevant = [r for r in ratings if item_set & set(r.item_id_list())]
    if not relevant:
        return 0
    avg = sum(r.rating for r in relevant) / len(relevant)
    # map 1–5 → -10 to +15
    return (avg - 3) * 5


# ---------------------------------------------------------------------------
# Season detection
# ---------------------------------------------------------------------------

def detect_season(temp_c: float) -> str:
    if temp_c >= 22:
        return "summer"
    elif temp_c >= 12:
        return "spring"
    elif temp_c >= 2:
        return "fall"
    return "winter"


# ---------------------------------------------------------------------------
# Outfit assembly and scoring
# ---------------------------------------------------------------------------

REQUIRED_CATEGORIES = ["top", "bottom"]
OPTIONAL_CATEGORIES = ["outerwear", "shoes", "accessory"]


def _should_include_outerwear(temp_c: float, rain_chance: float, wind_speed: float) -> bool:
    return temp_c < 18 or rain_chance >= 50 or wind_speed >= 8


def score_outfit(items: list, weather: dict, ratings: list) -> dict:
    """
    Score a list of WardrobeItem objects against current weather.
    Returns {"score": float, "reason": str, "outfit": items}.
    """
    temp_c = weather.get("temp_c", 20)
    rain_chance = weather.get("rain_chance", 0)
    wind_speed = weather.get("wind_speed", 0)
    uv_index = weather.get("uv_index", 0)
    season = detect_season(temp_c)

    item_ids = [i.id for i in items]

    # Per-item weather scores (averaged)
    temp_scores = [temperature_score(i, temp_c) for i in items]
    rain_scores = [rain_score(i, rain_chance) for i in items]
    wind_scores = [wind_score(i, wind_speed) for i in items]
    uv_scores = [uv_score(i, uv_index) for i in items]

    avg_temp = sum(temp_scores) / len(temp_scores)
    avg_rain = sum(rain_scores) / len(rain_scores)
    avg_wind = sum(wind_scores) / len(wind_scores)
    avg_uv = sum(uv_scores) / len(uv_scores)

    formal = formality_score(items)
    color = color_score(items)
    seas = season_score(items, season)
    boost = rating_boost(item_ids, ratings)

    # Weighted total
    raw = (
        avg_temp  * 0.28 +
        avg_rain  * 0.20 +
        avg_wind  * 0.10 +
        avg_uv    * 0.07 +
        formal    * 0.15 +
        color     * 0.12 +
        seas      * 0.08
    )
    score = min(100, max(0, raw + boost))

    # Build human-readable reason
    reasons = []
    if avg_temp >= 75:
        reasons.append("great temperature match")
    elif avg_temp >= 50:
        reasons.append("acceptable for current temperature")
    else:
        reasons.append("may be too warm/cool for today")

    if rain_chance >= 40 and avg_rain >= 75:
        reasons.append("rain-safe")
    elif rain_chance >= 40:
        reasons.append("not ideal for rain")

    if wind_speed >= 8 and avg_wind >= 75:
        reasons.append("wind-resistant")

    if formal >= 90:
        reasons.append("consistent formality")
    elif formal < 60:
        reasons.append("mixed formality levels")

    if color >= 85:
        reasons.append("good color harmony")

    reason = "Recommended because " + ", ".join(reasons) + "." if reasons else "Recommended outfit."

    return {
        "score": round(score, 1),
        "reason": reason,
        "pieces": items,
        "item_ids": item_ids,
    }


def generate_recommendations(wardrobe: list, weather: dict, ratings: list, max_results: int = 3) -> list:
    """
    Build candidate outfits from the wardrobe and return up to max_results
    scored outfits sorted by score descending.
    """
    if not wardrobe:
        return []

    by_cat = {}
    for item in wardrobe:
        by_cat.setdefault(item.category, []).append(item)

    tops = by_cat.get("top", [])
    bottoms = by_cat.get("bottom", [])
    outerwears = by_cat.get("outerwear", [])
    shoes_list = by_cat.get("shoes", [])
    accessories = by_cat.get("accessory", [])

    if not tops or not bottoms:
        return []

    temp_c = weather.get("temp_c", 20)
    rain_chance = weather.get("rain_chance", 0)
    wind_speed = weather.get("wind_speed", 0)
    need_outerwear = _should_include_outerwear(temp_c, rain_chance, wind_speed)

    candidates = []

    for top, bottom in product(tops, bottoms):
        base = [top, bottom]

        outer_choices = outerwears if (need_outerwear and outerwears) else [None]
        shoe_choices = shoes_list if shoes_list else [None]
        acc_choices = accessories[:1] if accessories else [None]  # max 1 accessory

        for outer, shoe, acc in product(outer_choices, shoe_choices, acc_choices):
            outfit = base[:]
            if outer:
                outfit.append(outer)
            if shoe:
                outfit.append(shoe)
            if acc:
                outfit.append(acc)
            candidates.append(outfit)

    # Cap candidates to avoid huge iteration on big wardrobes
    if len(candidates) > 500:
        import random
        random.shuffle(candidates)
        candidates = candidates[:500]

    scored = [score_outfit(c, weather, ratings) for c in candidates]
    scored.sort(key=lambda x: x["score"], reverse=True)

    # Deduplicate: avoid returning outfits that share the same top+bottom pair
    seen_pairs = set()
    unique = []
    for s in scored:
        ids = s["item_ids"]
        top_ids = tuple(sorted(i.id for i in s["pieces"] if i.category == "top"))
        bot_ids = tuple(sorted(i.id for i in s["pieces"] if i.category == "bottom"))
        key = (top_ids, bot_ids)
        if key not in seen_pairs:
            seen_pairs.add(key)
            unique.append(s)
        if len(unique) >= max_results:
            break

    return unique
