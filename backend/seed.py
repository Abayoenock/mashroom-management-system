"""Reset the database and load realistic demo data.  Usage:  python seed.py"""
import random
import warnings
warnings.filterwarnings('ignore', category=DeprecationWarning)
from datetime import datetime, timedelta

from werkzeug.security import generate_password_hash

from app import create_app
from app.extensions import get_db
from app.schemas.models import STAGES

random.seed(42)
app = create_app()
TODAY = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
NOW = datetime.utcnow()


def d(days_ago):
    return TODAY - timedelta(days=days_ago)


def base(**kw):
    return {**kw, "created_at": kw.get("created_at", NOW), "updated_at": NOW, "deleted_at": None}


with app.app_context():
    db = get_db()
    for name in db.list_collection_names():
        db.drop_collection(name)
    from app.db.indexes import ensure_indexes
    ensure_indexes(db)

    # ------------------------------------------------------------ organizations (tenants) + their varieties
    from app.db.defaults import DEFAULT_VARIETIES, create_organization
    ORGS = ["Imigina Mushrooms Ltd", "Huye Fresh Fungi"]
    org_ids, vids = [], {}          # vids[(org_index, variety_name)] -> variety id
    for oi, oname in enumerate(ORGS):
        oid_, vs = create_organization(db, oname, now=d(240))
        org_ids.append(oid_)
        vids.update({(oi, k): v for k, v in vs.items()})
    vdef = {v["name"]: v for v in DEFAULT_VARIETIES}
    vmap = {vid: vdef[name] for (_, name), vid in vids.items()}

    # ------------------------------------------------------------ farms + rooms
    farms = [
        base(name="Musanze Highland Farm", code="MHF01", location="Musanze, Northern Province",
             description="Main production site with climate-controlled grow rooms.", size_sqm=1800,
             manager="Jean Claude Habimana", contact_phone="+250 788 123 456",
             contact_email="musanze@mycofarm.rw", status="active"),
        base(name="Kigali Urban Mushrooms", code="KUM02", location="Gasabo, Kigali",
             description="Urban unit focused on oyster mushrooms for city restaurants.", size_sqm=650,
             manager="Aline Uwase", contact_phone="+250 789 654 321",
             contact_email="kigali@mycofarm.rw", status="active"),
        base(name="Huye Fresh Fungi Farm", code="HFF01", location="Huye, Southern Province",
             description="Second tenant: a smaller oyster and king oyster operation.", size_sqm=420,
             manager="Alice Uwamahoro", contact_phone="+250 789 534 004",
             contact_email="farm@huyefungi.rw", status="active"),
    ]
    FARM_ORG = [0, 0, 1]   # farm index -> organization index
    for f, oi in zip(farms, FARM_ORG):
        f["org_id"] = org_ids[oi]
    fids = [db.farms.insert_one(f).inserted_id for f in farms]
    room_defs = [
        (0, "Grow Room A", "MHF-A", 900, "Oyster", 21.5, 88), (0, "Grow Room B", "MHF-B", 700, "Button", 17.2, 86),
        (0, "Shiitake House", "MHF-S", 600, "Shiitake", 18.0, 82), (0, "Grow Room C", "MHF-C", 500, "King Oyster", 17.5, 89),
        (1, "Container 1", "KUM-1", 400, "Oyster", 22.0, 87), (1, "Container 2", "KUM-2", 400, "Oyster", 23.4, 85),
        (2, "Huye Room 1", "HFF-1", 400, "Oyster", 21.0, 86), (2, "Huye Room 2", "HFF-2", 300, "King Oyster", 17.0, 88),
    ]
    rooms = []
    for fi, name, code, cap, var, t, h in room_defs:
        rid = db.rooms.insert_one(base(farm_id=fids[fi], name=name, code=code, capacity_bags=cap,
                                       variety_id=vids[(FARM_ORG[fi], var)], temperature=t, humidity=h,
                                       ventilation="auto", status="active")).inserted_id
        rooms.append({"_id": rid, "farm_id": fids[fi], "variety": var, "org": FARM_ORG[fi]})

    # ------------------------------------------------------------ users
    cfg = app.config
    if not cfg["SUPERADMIN_EMAIL"] or not cfg["SUPERADMIN_PASSWORD"]:
        raise SystemExit("Set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD in backend/.env before seeding")
    from app.db.bootstrap import ensure_superadmin
    ensure_superadmin(db, cfg)  # collections were dropped above, so this always creates it fresh
    pw = generate_password_hash(cfg["DEMO_PASSWORD"])
    users = [  # (name, email, role, farm indexes, org index)
        ("Eric Nkurunziza", "owner@mycofarm.rw", "farm_owner", [0, 1], 0),
        ("Jean Claude Habimana", "manager@mycofarm.rw", "farm_manager", [0], 0),
        ("Patrick Mugisha", "worker@mycofarm.rw", "farm_worker", [0], 0),
        ("Diane Ingabire", "sales@mycofarm.rw", "sales_manager", [0, 1], 0),
        ("Alice Uwamahoro", "owner@huyefungi.rw", "farm_owner", [2], 1),
        ("Samuel Habiyaremye", "worker@huyefungi.rw", "farm_worker", [2], 1),
    ]
    for name, email, role, fis, oi in users:
        uid = db.users.insert_one(base(name=name, email=email, role=role, org_id=org_ids[oi], farm_ids=[fids[i] for i in fis],
                                       password_hash=pw, active=True, email_verified=True,
                                       phone="+250 78" + str(random.randint(1000000, 9999999)), demo=True,
                                       created_at=d(220))).inserted_id
        if role == "farm_owner":
            db.organizations.update_one({"_id": org_ids[oi]}, {"$set": {"owner_id": uid}})

    # ------------------------------------------------------------ employees + tasks
    emps = [("Patrick Mugisha", "Grow Room Technician", 0, 0), ("Claudine Uwimana", "Substrate Specialist", 0, None),
            ("Emmanuel Niyonzima", "Harvester", 0, 1), ("Josiane Mukeshimana", "Harvester", 0, 2),
            ("Olivier Hakizimana", "Sterilization Operator", 0, None), ("Sandrine Umutoni", "Packaging Lead", 0, None),
            ("Fabrice Ndayisaba", "Grow Technician", 1, 4), ("Chantal Nyirahabimana", "Harvester", 1, 5),
            ("Samuel Habiyaremye", "Grow Technician", 2, 6), ("Aimee Mukandayisenga", "Harvester", 2, 7)]
    emp_ids = []
    for name, pos, fi, ri in emps:
        emp_ids.append((db.employees.insert_one(base(
            farm_id=fids[fi], name=name, position=pos, phone="+250 72" + str(random.randint(1000000, 9999999)),
            email=name.split()[0].lower() + ("@huyefungi.rw" if fi == 2 else "@mycofarm.rw"), room_id=rooms[ri]["_id"] if ri is not None else None,
            status="active", hired_on=d(random.randint(200, 900)))).inserted_id, fi))
    task_defs = [("Prepare substrate for new oyster batch", "high", 2, "todo"), ("Sterilize 300 growing bags", "high", 1, "in_progress"),
                 ("Inoculate bags in Room C", "medium", 3, "todo"), ("Monitor humidity – Shiitake House", "medium", 0, "in_progress"),
                 ("Inspect bags for contamination – Room A", "high", 0, "todo"), ("Harvest Room A second flush", "high", 1, "todo"),
                 ("Package mushrooms for Kigali Serena order", "medium", 1, "todo"), ("Clean and disinfect Container 2", "low", 5, "todo"),
                 ("Calibrate humidity sensors", "low", -2, "done"), ("Restock packaging punnets", "medium", -1, "done")]
    for i, (title, pr, due, st) in enumerate(task_defs):
        eid, fi = emp_ids[i % len(emp_ids)]
        db.tasks.insert_one(base(farm_id=fids[fi], title=title, description="", employee_id=eid, room_id=None,
                                 due_date=TODAY + timedelta(days=due), priority=pr, status=st))

    # ------------------------------------------------------------ customers
    customers = [("Kigali Serena Hotel", "restaurant", 0), ("Simba Supermarket", "retailer", 0), ("Nakumatt Fresh", "retailer", 0),
                 ("Heaven Restaurant", "restaurant", 0), ("Kimironko Market Traders", "wholesaler", 0),
                 ("Green Basket Distributors", "distributor", 0), ("Marriott Kigali", "restaurant", 0),
                 ("Claire Uwera", "individual", 0), ("Musanze Fresh Foods", "wholesaler", 0), ("Virunga Lodge", "restaurant", 0),
                 ("Huye Campus Canteen", "restaurant", 1), ("Butare Fresh Market", "wholesaler", 1),
                 ("Hotel Credo Huye", "restaurant", 1), ("Jean Bosco Nshimiyimana", "individual", 1)]
    cids = {0: [], 1: []}   # org index -> [(customer id, name)]
    for name, t, oi in customers:
        cids[oi].append((db.customers.insert_one(base(
            org_id=org_ids[oi], name=name, type=t, phone="+250 78" + str(random.randint(1000000, 9999999)),
            email=name.split()[0].lower() + "@example.rw",
            address="Huye" if oi else random.choice(["Kigali", "Musanze", "Rubavu"]),
            status="active", notes="")).inserted_id, name))

    # ------------------------------------------------------------ batches, harvests, stock, sales
    substrates = {"Oyster": "Wheat straw + bran", "Button": "Composted straw + chicken manure",
                  "Shiitake": "Hardwood sawdust + bran", "King Oyster": "Sawdust + cotton seed hulls"}
    workers = ["Patrick Mugisha", "Claudine Uwimana", "Fabrice Ndayisaba", "Emmanuel Niyonzima"]
    hcount = scount = 0
    batch_n = 0
    sale_events = []
    starts = sorted([random.randint(-3, 210) for _ in range(18)] + [30, 31, 33, 47, 42], reverse=True)
    for i, ago in enumerate(starts):
        room = rooms[i % len(rooms)]
        vname = room["variety"]
        vid = vids[(room["org"], vname)]
        v = vmap[vid]
        bags = random.choice([150, 200, 250, 300, 350])
        spawn = d(ago)
        prep = spawn - timedelta(days=3)
        inc_end = spawn + timedelta(days=v["incubation_days"])
        first_h = inc_end + timedelta(days=v["fruiting_days"])
        exp_yield = round(bags * v["expected_yield_kg_per_bag"], 2)
        # timeline of stage transitions
        tl = [("substrate_preparation", prep), ("sterilization", prep + timedelta(days=1)), ("spawning", spawn),
              ("incubation", spawn + timedelta(days=1)), ("pinning", inc_end), ("fruiting", inc_end + timedelta(days=4)),
              ("harvesting", first_h), ("completed", first_h + timedelta(days=30))]
        if ago < 0:
            tl = tl[:1]
            prep = TODAY - timedelta(days=1)
            tl = [("substrate_preparation", prep)]
        passed = [(s, t) for s, t in tl if t <= TODAY]
        stage = passed[-1][0] if passed else "substrate_preparation"
        batch_n += 1
        code = f"MB-{spawn.year}-{batch_n:04d}"
        b = base(code=code, variety_id=vid, farm_id=room["farm_id"], room_id=room["_id"],
                 substrate_type=substrates[vname], substrate_prep_date=prep, spawning_date=spawn, bags=bags,
                 substrate_kg=bags * 1.8, spawn_kg=round(bags * 0.09, 1), worker=random.choice(workers),
                 expected_incubation_end=inc_end, expected_first_harvest=first_h, expected_yield_kg=exp_yield,
                 stage=stage, harvested_kg=0, rejected_kg=0, contaminated_bags=0, flush_count=0,
                 notes="", created_at=prep, stage_changed_at=passed[-1][1] if passed else prep)
        if stage == "completed":
            b["completed_at"] = passed[-1][1]
        bid = db.batches.insert_one(b).inserted_id
        prev = None
        for s, t in passed or tl[:1]:
            db.stage_history.insert_one({"batch_id": bid, "from": prev, "to": s, "at": t + timedelta(hours=9),
                                         "by": random.choice(["Jean Claude Habimana", "Eric Nkurunziza"]),
                                         "notes": "Batch created" if prev is None else ""})
            prev = s
        # observations
        if STAGES.index(stage) >= STAGES.index("incubation"):
            obs_day = spawn + timedelta(days=3)
            while obs_day <= min(TODAY, tl[-1][1]):
                cur = [s for s, t in tl if t <= obs_day][-1]
                t = round(random.uniform(v["temp_min"] + 0.5, v["temp_max"] - 0.5), 1)
                h = round(random.uniform(v["humidity_min"] + 1, v["humidity_max"] - 1), 1)
                db.observations.insert_one({"batch_id": bid, "farm_id": room["farm_id"], "date": obs_day, "stage": cur,
                                            "temperature": t, "humidity": h,
                                            "condition": random.choice(["excellent", "good", "good", "fair"]),
                                            "contamination": False, "affected_bags": 0, "notes": "",
                                            "by": random.choice(workers), "created_at": obs_day})
                obs_day += timedelta(days=7)
        # harvest flushes
        flush_share = [0.55, 0.3, 0.15]
        for f in range(3):
            hdate = first_h + timedelta(days=f * 10)
            if hdate > TODAY or stage not in ("harvesting", "completed"):
                break
            kg = round(exp_yield * flush_share[f] * random.uniform(0.78, 1.08), 1)
            rej = round(kg * random.uniform(0.02, 0.07), 1)
            pending = (TODAY - hdate).days < 2
            hcount += 1
            h = base(code=f"HV-{hcount:05d}", batch_id=bid, variety_id=vid, farm_id=room["farm_id"], date=hdate,
                     flush=f + 1, bags_harvested=bags - random.randint(0, 8), weight_kg=kg, grade=random.choice("AAAB"),
                     rejected_kg=rej, worker=random.choice(workers), notes="", status="pending" if pending else "approved",
                     submitted_by=random.choice(workers), created_at=hdate + timedelta(hours=11))
            if not pending:
                h.update(approved_by="Jean Claude Habimana", approved_at=hdate + timedelta(hours=15))
            hid = db.harvests.insert_one(h).inserted_id
            if pending:
                continue
            db.batches.update_one({"_id": bid}, {"$inc": {"harvested_kg": kg, "rejected_kg": rej, "flush_count": 1}})
            lot = {"farm_id": room["farm_id"], "variety_id": vid, "harvest_id": hid, "batch_id": bid,
                   "batch_code": code, "grade": h["grade"], "quantity_kg": kg, "available_kg": kg, "harvest_date": hdate,
                   "expiry_date": hdate + timedelta(days=7), "location": "Cold Room 1", "created_at": hdate, "deleted_at": None}
            lot["_id"] = db.stock_lots.insert_one(lot).inserted_id
            db.inventory_transactions.insert_one({"lot_id": lot["_id"], "farm_id": room["farm_id"], "type": "harvest",
                                                  "direction": "in", "quantity": kg, "unit": "kg", "reference": h["code"],
                                                  "by": "Jean Claude Habimana", "created_at": hdate + timedelta(hours=15)})
            # sell most of it over the next few days (only up to today)
            remaining = kg * random.uniform(0.8, 0.95) if (TODAY - hdate).days > 3 else kg * 0.35
            while remaining > 2:
                q = round(min(remaining, random.uniform(5, 40)), 1)
                sdate = hdate + timedelta(days=random.randint(0, 3))
                if sdate > TODAY:
                    sdate = TODAY
                sale_events.append((sdate, lot, q, v, room["org"]))
                remaining -= q

    # build sales orders from events
    sale_events.sort(key=lambda e: e[0])
    seq = {}
    for sdate, lot, q, v, oi in sale_events:
        cid, cname = random.choice(cids[oi])
        price = v["price_per_kg"] * random.choice([1, 1, 0.95, 0.9])
        total = round(q * price, 2)
        disc = round(total * 0.05, 0) if total > 150000 else 0
        total -= disc
        age = (TODAY - sdate).days
        paid = total if age > 20 or random.random() < 0.6 else (0 if random.random() < 0.5 else round(total / 2, 0))
        seq[sdate.year] = seq.get(sdate.year, 0) + 1
        number = f"SO-{sdate.year}-{seq[sdate.year]:05d}"
        method = random.choice(["cash", "mobile_money", "mobile_money", "bank_transfer"])
        db.stock_lots.update_one({"_id": lot["_id"]}, {"$inc": {"available_kg": -q}})
        db.sales.insert_one(base(
            number=number, customer_id=cid, customer_name=cname, farm_id=lot["farm_id"], date=sdate,
            items=[{"variety_id": lot["variety_id"], "variety_name": v["name"], "grade": lot["grade"], "quantity_kg": q,
                    "unit_price": price, "line_total": round(q * price, 2), "allocations": [{"lot_id": lot["_id"], "kg": q}]}],
            subtotal=round(q * price, 2), discount=disc, total=total, paid=paid, balance=round(total - paid, 2),
            payment_method=method, payment_status="paid" if paid >= total else ("partial" if paid else "unpaid"),
            delivery_status="delivered" if age > 2 else random.choice(["pending", "dispatched"]), status="confirmed",
            sales_person="Diane Ingabire", payments=[{"amount": paid, "method": method, "at": sdate}] if paid else [],
            notes="", created_at=sdate + timedelta(hours=14)))
        db.inventory_transactions.insert_one({"lot_id": lot["_id"], "farm_id": lot["farm_id"], "type": "sale",
                                              "direction": "out", "quantity": q, "unit": "kg", "reference": number,
                                              "by": "Diane Ingabire", "created_at": sdate + timedelta(hours=14)})
        scount += 1
    db.stock_lots.update_many({"available_kg": {"$lt": 0}}, {"$set": {"available_kg": 0}})

    # contamination + environment alert on a couple of active batches
    active = list(db.batches.find({"stage": {"$in": ["incubation", "pinning", "fruiting"]}}).limit(3))
    if active:
        b = active[0]
        db.observations.insert_one({"batch_id": b["_id"], "farm_id": b["farm_id"], "date": d(1), "stage": b["stage"],
                                    "temperature": 22.0, "humidity": 86, "condition": "fair", "contamination": True,
                                    "affected_bags": 12, "notes": "Green mould (Trichoderma) spotted on 12 bags, isolated.",
                                    "by": "Patrick Mugisha", "created_at": d(1)})
        db.batches.update_one({"_id": b["_id"]}, {"$set": {"contaminated_bags": 12}})
        db.notifications.insert_one({"title": "Contamination reported", "message": f"{b['code']}: 12 bag(s) affected",
                                     "type": "contamination", "farm_id": b["farm_id"], "roles": ["farm_owner", "farm_manager"],
                                     "link": f"/app/production/{b['_id']}", "read_by": [], "created_at": NOW - timedelta(hours=20)})
    if len(active) > 1:
        b = active[1]
        db.observations.insert_one({"batch_id": b["_id"], "farm_id": b["farm_id"], "date": TODAY, "stage": b["stage"],
                                    "temperature": 27.5, "humidity": 71, "condition": "fair", "contamination": False,
                                    "affected_bags": 0, "notes": "Cooling unit tripped overnight.",
                                    "by": "Patrick Mugisha", "created_at": NOW})
        db.batches.update_one({"_id": b["_id"]}, {"$set": {"last_env_alert": True}})
        db.notifications.insert_one({"title": "Environmental alert", "message": f"{b['code']}: 27.5°C / 71% outside range",
                                     "type": "environment", "farm_id": b["farm_id"], "roles": ["farm_owner", "farm_manager"],
                                     "link": f"/app/production/{b['_id']}", "read_by": [], "created_at": NOW - timedelta(hours=2)})

    # ------------------------------------------------------------ supplies inventory
    items = [("Wheat straw", "SUB-001", "substrate", "kg", 1200, 500, 120), ("Hardwood sawdust", "SUB-002", "substrate", "kg", 380, 400, 90),
             ("Wheat bran", "SUB-003", "substrate", "kg", 260, 150, 350), ("Oyster grain spawn", "SPN-001", "spawn", "kg", 45, 30, 4500),
             ("Shiitake sawdust spawn", "SPN-002", "spawn", "kg", 8, 15, 7000), ("Button spawn", "SPN-003", "spawn", "kg", 22, 20, 5200),
             ("PP growing bags 35x50", "BAG-001", "bags", "pcs", 2400, 1000, 60), ("Filter-patch bags", "BAG-002", "bags", "pcs", 300, 500, 180),
             ("250g punnets", "PKG-001", "packaging", "pcs", 1800, 1000, 85), ("Corrugated boxes 5kg", "PKG-002", "packaging", "pcs", 90, 150, 600),
             ("Cling film roll", "PKG-003", "packaging", "rolls", 14, 6, 9000), ("Sodium hypochlorite", "CLN-001", "cleaning", "L", 40, 20, 1500),
             ("Isopropyl alcohol 70%", "CLN-002", "cleaning", "L", 6, 10, 4000), ("Hygrometer batteries", "OTH-001", "other", "pcs", 24, 10, 500)]
    item_farm = {}
    for i, (name, sku, cat, unit, qty, mn, cost) in enumerate(items):
        fid = [fids[0], fids[0], fids[1], fids[2]][i % 4]
        item_farm[name] = fid
        iid = db.inventory_items.insert_one(base(farm_id=fid, name=name, sku=sku, category=cat, unit=unit, quantity=qty,
                                                 min_level=mn, unit_cost=cost, location="Main Store", expiry_date=None)).inserted_id
        for k in range(3):
            db.inventory_transactions.insert_one({"item_id": iid, "farm_id": fid, "type": random.choice(["received", "consumed"]),
                                                  "direction": "in", "quantity": round(qty * 0.2), "unit": unit, "notes": "",
                                                  "by": "Jean Claude Habimana", "created_at": d(random.randint(1, 90))})
    for (name, sku, cat, unit, qty, mn, cost) in items:
        if qty <= mn:
            db.notifications.insert_one({"title": "Low stock", "message": f"{name} is at {qty} {unit} (min {mn})",
                                         "type": "inventory", "farm_id": item_farm[name], "roles": ["farm_owner", "farm_manager"],
                                         "link": "/app/inventory", "read_by": [], "created_at": NOW - timedelta(hours=random.randint(3, 60))})

    # ------------------------------------------------------------ expenses (monthly, per farm)
    exp_cats = [("labor", "Monthly wages", 1_400_000, 450_000), ("electricity", "Electricity – climate control", 380_000, 160_000),
                ("water", "Water bill", 65_000, 25_000), ("spawn", "Spawn purchase", 420_000, 150_000),
                ("substrate", "Substrate materials", 300_000, 110_000), ("packaging", "Packaging materials", 140_000, 60_000),
                ("transportation", "Deliveries & fuel", 180_000, 90_000)]
    for m in range(7):
        for fi, fid in enumerate(fids):
            for cat, desc, a0, a1 in exp_cats:
                amt = (a0 if fi == 0 else a1) * 0.32 * random.uniform(0.85, 1.15)
                db.expenses.insert_one(base(farm_id=fid, description=desc, category=cat, amount=round(amt, -2),
                                            date=d(m * 30 + random.randint(0, 25)), payment_method="bank_transfer",
                                            responsible="Eric Nkurunziza", batch_id=None))
    db.expenses.insert_one(base(farm_id=fids[0], description="Humidifier replacement", category="equipment", amount=850_000,
                                date=d(40), payment_method="bank_transfer", responsible="Eric Nkurunziza", batch_id=None))
    db.expenses.insert_one(base(farm_id=fids[0], description="Autoclave servicing", category="maintenance", amount=220_000,
                                date=d(75), payment_method="cash", responsible="Jean Claude Habimana", batch_id=None))

    # misc notifications
    pend = db.harvests.count_documents({"status": "pending"})
    if pend:
        db.notifications.insert_one({"title": "Harvests awaiting approval", "message": f"{pend} harvest record(s) need review",
                                     "type": "approval", "farm_id": fids[0], "roles": ["farm_owner", "farm_manager"],
                                     "link": "/app/harvests", "read_by": [], "created_at": NOW - timedelta(hours=5)})

    print(f"Seeded: {len(fids)} farms, {len(rooms)} rooms, {batch_n} batches, {hcount} harvests, {scount} sales, "
          f"{db.expenses.count_documents({})} expenses")
    print("Organizations: " + ", ".join(ORGS))
    print(f"Super admin: {cfg['SUPERADMIN_EMAIL']} (password from SUPERADMIN_PASSWORD in .env)")
    print(f"Demo logins (password: {cfg['DEMO_PASSWORD']}):")
    for _, email, role, _, oi in users:
        print(f"  {ORGS[oi]:<22} {role:<14} {email}")
