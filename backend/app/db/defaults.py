"""Starter data given to every new organization (tenant)."""
from datetime import datetime

DEFAULT_VARIETIES = [
    dict(name="Oyster", scientific_name="Pleurotus ostreatus", incubation_days=21, fruiting_days=7,
         expected_yield_kg_per_bag=0.9, temp_min=18, temp_max=25, humidity_min=80, humidity_max=92,
         price_per_kg=3000, description="Fast-growing, high-yield variety ideal for straw or sawdust substrates."),
    dict(name="Button", scientific_name="Agaricus bisporus", incubation_days=16, fruiting_days=18,
         expected_yield_kg_per_bag=1.1, temp_min=14, temp_max=20, humidity_min=82, humidity_max=90,
         price_per_kg=4500, description="The world's most popular mushroom, grown on composted substrate with casing layer."),
    dict(name="Shiitake", scientific_name="Lentinula edodes", incubation_days=60, fruiting_days=12,
         expected_yield_kg_per_bag=0.7, temp_min=12, temp_max=22, humidity_min=75, humidity_max=90,
         price_per_kg=8000, description="Premium gourmet mushroom on supplemented hardwood sawdust blocks."),
    dict(name="King Oyster", scientific_name="Pleurotus eryngii", incubation_days=30, fruiting_days=14,
         expected_yield_kg_per_bag=0.6, temp_min=15, temp_max=20, humidity_min=85, humidity_max=92,
         price_per_kg=6000, description="Thick, meaty stems with long shelf life; prized by restaurants."),
]


def create_organization(db, name, owner=None, now=None):
    """Create a tenant with its starter varieties. Returns (org_id, {variety_name: variety_id})."""
    now = now or datetime.utcnow()
    org_id = db.organizations.insert_one({
        "name": name, "status": "active", "owner_id": owner, "created_at": now, "updated_at": now, "deleted_at": None,
    }).inserted_id
    vids = {}
    for v in DEFAULT_VARIETIES:
        vids[v["name"]] = db.varieties.insert_one({**v, "org_id": org_id, "created_at": now, "updated_at": now,
                                                    "deleted_at": None}).inserted_id
    return org_id, vids
