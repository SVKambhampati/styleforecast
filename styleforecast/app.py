import os
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from dotenv import load_dotenv
from sqlalchemy import select, desc

from models import db, WardrobeItem, WeatherLog, OutfitRating, FavoriteOutfit
from weather import fetch_weather
from recommend import generate_recommendations

load_dotenv()

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-change-me")
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///styleforecast.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)

with app.app_context():
    db.create_all()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _latest_weather_log():
    return db.session.execute(
        select(WeatherLog).order_by(desc(WeatherLog.fetched_at))
    ).scalars().first()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    weather_log = _latest_weather_log()
    weather = weather_log.to_dict() if weather_log else None
    recommendations = []
    if weather:
        wardrobe = db.session.execute(select(WardrobeItem)).scalars().all()
        ratings  = db.session.execute(select(OutfitRating)).scalars().all()
        raw = generate_recommendations(list(wardrobe), weather, list(ratings), max_results=3)
        labels = ["Best Match", "Casual Option", "Weather-Safe"]
        for i, r in enumerate(raw):
            r["label"] = labels[i] if i < len(labels) else f"Option {i+1}"
        recommendations = raw

    return render_template("index.html", weather=weather, recommendations=recommendations)


@app.route("/weather", methods=["POST"])
def weather_lookup():
    query = request.form.get("city", "").strip()
    if not query:
        flash("Please enter a city or ZIP code.", "error")
        return redirect(url_for("index"))

    try:
        data = fetch_weather(query)
    except RuntimeError as e:
        flash(str(e), "error")
        return redirect(url_for("index"))

    log = WeatherLog(**data)
    db.session.add(log)
    db.session.commit()

    return redirect(url_for("index"))


@app.route("/wardrobe")
def wardrobe():
    items = db.session.execute(
        select(WardrobeItem).order_by(WardrobeItem.category, WardrobeItem.name)
    ).scalars().all()
    by_category = {}
    for item in items:
        by_category.setdefault(item.category, []).append(item)
    return render_template("wardrobe.html", items=items, by_category=by_category)


@app.route("/wardrobe/add", methods=["POST"])
def wardrobe_add():
    tags = request.form.getlist("weather_tags")
    item = WardrobeItem(
        name=request.form["name"].strip(),
        category=request.form["category"],
        color=request.form["color"].strip(),
        warmth=request.form["warmth"],
        formality=request.form["formality"],
        weather_tags=",".join(tags),
        season=request.form["season"],
    )
    db.session.add(item)
    db.session.commit()
    flash(f"'{item.name}' added to your wardrobe.", "success")
    return redirect(url_for("wardrobe"))


@app.route("/wardrobe/edit/<int:item_id>", methods=["POST"])
def wardrobe_edit(item_id):
    item = db.session.get(WardrobeItem, item_id)
    if not item:
        flash("Item not found.", "error")
        return redirect(url_for("wardrobe"))
    tags = request.form.getlist("weather_tags")
    item.name         = request.form["name"].strip()
    item.category     = request.form["category"]
    item.color        = request.form["color"].strip()
    item.warmth       = request.form["warmth"]
    item.formality    = request.form["formality"]
    item.weather_tags = ",".join(tags)
    item.season       = request.form["season"]
    db.session.commit()
    flash(f"'{item.name}' updated.", "success")
    return redirect(url_for("wardrobe"))


@app.route("/wardrobe/delete/<int:item_id>", methods=["POST"])
def wardrobe_delete(item_id):
    item = db.session.get(WardrobeItem, item_id)
    if not item:
        flash("Item not found.", "error")
        return redirect(url_for("wardrobe"))
    db.session.delete(item)
    db.session.commit()
    flash(f"'{item.name}' removed.", "success")
    return redirect(url_for("wardrobe"))


@app.route("/recommend", methods=["POST"])
def recommend():
    weather_log = _latest_weather_log()
    if not weather_log:
        return jsonify({"error": "No weather data. Search for a city first."}), 400

    wardrobe = db.session.execute(select(WardrobeItem)).scalars().all()
    ratings  = db.session.execute(select(OutfitRating)).scalars().all()
    results  = generate_recommendations(list(wardrobe), weather_log.to_dict(), list(ratings), max_results=3)

    labels = ["Best Match", "Casual Option", "Weather-Safe"]
    output = []
    for i, r in enumerate(results):
        output.append({
            "label":    labels[i] if i < len(labels) else f"Option {i+1}",
            "score":    r["score"],
            "reason":   r["reason"],
            "item_ids": r["item_ids"],
            "pieces":   [it.to_dict() for it in r["pieces"]],
        })
    return jsonify(output)


@app.route("/favorite", methods=["POST"])
def favorite():
    data     = request.get_json()
    item_ids = data.get("item_ids", [])
    label    = data.get("label", "Saved Outfit")
    score    = data.get("score", 0)
    reason   = data.get("reason", "")

    if not item_ids:
        return jsonify({"error": "No items provided"}), 400

    ids_str  = ",".join(map(str, item_ids))
    existing = db.session.execute(
        select(FavoriteOutfit).where(FavoriteOutfit.item_ids == ids_str)
    ).scalars().first()

    if existing:
        return jsonify({"message": "Already in favorites", "id": existing.id})

    fav = FavoriteOutfit(item_ids=ids_str, label=label, score=score, reason=reason)
    db.session.add(fav)
    db.session.commit()
    return jsonify({"message": "Saved to favorites", "id": fav.id})


@app.route("/favorite/delete/<int:fav_id>", methods=["POST"])
def favorite_delete(fav_id):
    fav = db.session.get(FavoriteOutfit, fav_id)
    if not fav:
        flash("Not found.", "error")
        return redirect(url_for("favorites"))
    db.session.delete(fav)
    db.session.commit()
    flash("Outfit removed from favorites.", "success")
    return redirect(url_for("favorites"))


@app.route("/rate", methods=["POST"])
def rate():
    data     = request.get_json()
    item_ids = data.get("item_ids", [])
    rating   = data.get("rating")

    if not item_ids or rating is None:
        return jsonify({"error": "Missing data"}), 400
    if not (1 <= int(rating) <= 5):
        return jsonify({"error": "Rating must be 1–5"}), 400

    weather_log = _latest_weather_log()
    entry = OutfitRating(
        item_ids=",".join(map(str, item_ids)),
        rating=int(rating),
        weather_log_id=weather_log.id if weather_log else None,
    )
    db.session.add(entry)
    db.session.commit()
    return jsonify({"message": "Rating saved"})


@app.route("/favorites")
def favorites():
    favs = db.session.execute(
        select(FavoriteOutfit).order_by(desc(FavoriteOutfit.saved_at))
    ).scalars().all()

    resolved = []
    for fav in favs:
        id_list = fav.item_id_list()
        items = db.session.execute(
            select(WardrobeItem).where(WardrobeItem.id.in_(id_list))
        ).scalars().all() if id_list else []
        resolved.append({"fav": fav, "items": items})

    return render_template("favorites.html", favorites=resolved)


@app.route("/history")
def history():
    logs = db.session.execute(
        select(WeatherLog).order_by(desc(WeatherLog.fetched_at)).limit(20)
    ).scalars().all()

    ratings = db.session.execute(
        select(OutfitRating).order_by(desc(OutfitRating.rated_at)).limit(10)
    ).scalars().all()

    rated_items = []
    for r in ratings:
        id_list = r.item_id_list()
        items = db.session.execute(
            select(WardrobeItem).where(WardrobeItem.id.in_(id_list))
        ).scalars().all() if id_list else []
        rated_items.append({"rating": r, "items": items})

    return render_template("history.html", logs=logs, rated_items=rated_items)


if __name__ == "__main__":
    app.run(debug=True, port=5050)
