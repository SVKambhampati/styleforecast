from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class WardrobeItem(db.Model):
    __tablename__ = "wardrobe_items"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50), nullable=False)  # top, bottom, outerwear, shoes, accessory
    color = db.Column(db.String(50), nullable=False)
    warmth = db.Column(db.String(20), nullable=False)    # light, medium, heavy
    formality = db.Column(db.String(30), nullable=False) # casual, smart casual, formal
    weather_tags = db.Column(db.String(200), default="")  # comma-separated: rain, cold, hot, windy
    season = db.Column(db.String(100), nullable=False)   # spring, summer, fall, winter, all-season
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def weather_tag_list(self):
        return [t.strip() for t in self.weather_tags.split(",") if t.strip()]

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "color": self.color,
            "warmth": self.warmth,
            "formality": self.formality,
            "weather_tags": self.weather_tag_list(),
            "season": self.season,
        }


class WeatherLog(db.Model):
    __tablename__ = "weather_logs"

    id = db.Column(db.Integer, primary_key=True)
    city = db.Column(db.String(100), nullable=False)
    query = db.Column(db.String(100), nullable=False)   # original search string
    temp_c = db.Column(db.Float)
    temp_f = db.Column(db.Float)
    condition = db.Column(db.String(100))
    description = db.Column(db.String(200))
    rain_chance = db.Column(db.Float, default=0)        # 0–100
    wind_speed = db.Column(db.Float, default=0)         # m/s
    uv_index = db.Column(db.Float, default=0)
    humidity = db.Column(db.Float, default=0)
    icon = db.Column(db.String(20))
    fetched_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "city": self.city,
            "temp_c": self.temp_c,
            "temp_f": self.temp_f,
            "condition": self.condition,
            "description": self.description,
            "rain_chance": self.rain_chance,
            "wind_speed": self.wind_speed,
            "uv_index": self.uv_index,
            "humidity": self.humidity,
            "icon": self.icon,
            "fetched_at": self.fetched_at.strftime("%Y-%m-%d %H:%M") if self.fetched_at else None,
        }


class OutfitRating(db.Model):
    __tablename__ = "outfit_ratings"

    id = db.Column(db.Integer, primary_key=True)
    item_ids = db.Column(db.String(200), nullable=False)  # comma-separated WardrobeItem ids
    rating = db.Column(db.Integer, nullable=False)         # 1–5
    weather_log_id = db.Column(db.Integer, db.ForeignKey("weather_logs.id"), nullable=True)
    rated_at = db.Column(db.DateTime, default=datetime.utcnow)

    def item_id_list(self):
        return [int(i) for i in self.item_ids.split(",") if i.strip()]


class FavoriteOutfit(db.Model):
    __tablename__ = "favorite_outfits"

    id = db.Column(db.Integer, primary_key=True)
    item_ids = db.Column(db.String(200), nullable=False)
    label = db.Column(db.String(200), default="")
    score = db.Column(db.Float, default=0)
    reason = db.Column(db.String(500), default="")
    saved_at = db.Column(db.DateTime, default=datetime.utcnow)

    def item_id_list(self):
        return [int(i) for i in self.item_ids.split(",") if i.strip()]
