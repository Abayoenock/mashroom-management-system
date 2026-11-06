from datetime import datetime

from flask import Blueprint

from ..extensions import get_db
from ..permissions.rbac import MANAGERS, SALES, assert_farm_access, current_user, farm_org, farm_scope, roles_required
from ..schemas.models import CustomerIn, ExpenseIn, PaymentIn, SaleIn, SaleStatusIn
from ..utils.audit import audit, notify
from ..utils.crud import attach, crud, validate
from ..utils.pagination import paginate
from ..utils.responses import ok
from ..utils.responses_base import ApiError
from ..utils.serialize import oid

bp = Blueprint("sales", __name__, url_prefix="/api/v1")


def enrich_customers(items):
    ids = [c["_id"] for c in items]
    stats = {r["_id"]: r for r in get_db().sales.aggregate([
        {"$match": {"customer_id": {"$in": ids}, "status": "confirmed", "deleted_at": None}},
        {"$group": {"_id": "$customer_id", "total": {"$sum": "$total"}, "balance": {"$sum": "$balance"},
                    "orders": {"$sum": 1}, "last": {"$max": "$date"}}}])}
    for c in items:
        s = stats.get(c["_id"], {})
        c.update(total_spent=round(s.get("total", 0), 2), outstanding=round(s.get("balance", 0), 2),
                 orders=s.get("orders", 0), last_order=s.get("last"))
    return items


find_customer = crud(bp, "/customers", "customers", CustomerIn, write_roles=SALES, search=("name", "phone", "email"),
                     filters=("type", "status"), scope_kind="org", enrich=enrich_customers, sort="name")


@bp.get("/customers/<id_>/history")
@roles_required()
def customer_history(id_):
    c = find_customer(id_)
    sales = list(get_db().sales.find({"customer_id": c["_id"], "deleted_at": None}).sort("date", -1))
    return ok({"customer": enrich_customers([c])[0], "sales": sales})


def enrich_expenses(items):
    attach(items, "farm_id", "farms", "farm_name")
    attach(items, "batch_id", "batches", "batch_code", "code")
    return items


crud(bp, "/expenses", "expenses", ExpenseIn, read_roles=MANAGERS, write_roles=MANAGERS, delete_roles=("super_admin", "farm_owner"),
     search=("description", "responsible"), filters=("farm_id", "category", "batch_id"), enrich=enrich_expenses,
     sort="date", refs={"batch_id": ("batches", "farm")})


# ---------------------------------------------------------------- sales

def next_number():
    year = datetime.utcnow().year
    n = get_db().sales.count_documents({"number": {"$regex": f"^SO-{year}-"}}) + 1
    while get_db().sales.find_one({"number": f"SO-{year}-{n:05d}"}):
        n += 1
    return f"SO-{year}-{n:05d}"


def release(allocations):
    db = get_db()
    for a in allocations:
        db.stock_lots.update_one({"_id": a["lot_id"]}, {"$inc": {"available_kg": a["kg"]}})


def allocate(farm_id, variety_id, grade, qty):
    """Deduct qty kg FIFO (oldest harvest first) from unexpired lots. Each decrement is guarded so concurrent
    sales can never drive a lot negative; on shortage everything taken so far is released."""
    db = get_db()
    q = {"farm_id": farm_id, "variety_id": variety_id, "available_kg": {"$gt": 0}, "deleted_at": None,
         "expiry_date": {"$gte": datetime.utcnow()}}
    if grade:
        q["grade"] = grade
    taken, remaining = [], round(qty, 3)
    for lot in db.stock_lots.find(q).sort("harvest_date", 1):
        if remaining <= 0:
            break
        take = round(min(lot["available_kg"], remaining), 3)
        res = db.stock_lots.update_one({"_id": lot["_id"], "available_kg": {"$gte": take}},
                                       {"$inc": {"available_kg": -take}})
        if res.modified_count:
            taken.append({"lot_id": lot["_id"], "kg": take})
            remaining = round(remaining - take, 3)
    if remaining > 0.0005:
        release(taken)
        return None
    return taken


def enrich_sales(items):
    attach(items, "farm_id", "farms", "farm_name")
    return items


@bp.get("/sales")
@roles_required()
def list_sales():
    items, meta = paginate(get_db().sales, farm_scope(), ("number", "customer_name"),
                           ("payment_status", "delivery_status", "status", "customer_id"), default_sort="date")
    return ok(enrich_sales(items), meta)


@bp.post("/sales")
@roles_required(*SALES, "farm_manager")
def create_sale():
    db = get_db()
    data = validate(SaleIn)
    assert_farm_access(data["farm_id"])
    org = farm_org(data["farm_id"])
    cust = db.customers.find_one({"_id": data["customer_id"], "org_id": org, "deleted_at": None})
    if not cust:
        raise ApiError("Customer not found", 422, {"customer_id": "Unknown customer"})
    lines, all_alloc, subtotal = [], [], 0.0
    for i, line in enumerate(data["items"]):
        v = db.varieties.find_one({"_id": line["variety_id"], "org_id": org})
        if not v:
            release(all_alloc)
            raise ApiError("Unknown variety", 422, {f"items.{i}.variety_id": "Unknown"})
        alloc = allocate(data["farm_id"], line["variety_id"], line.get("grade"), line["quantity_kg"])
        if alloc is None:
            release(all_alloc)
            raise ApiError(f"Not enough {v['name']} in stock for this order", 409,
                           {f"items.{i}.quantity_kg": "Insufficient stock"})
        all_alloc += alloc
        total = round(line["quantity_kg"] * line["unit_price"], 2)
        subtotal += total
        lines.append({**line, "variety_name": v["name"], "line_total": total, "allocations": alloc})
    discount = min(data["discount"], subtotal)
    total = round(subtotal - discount, 2)
    paid = min(data["amount_paid"], total)
    now = datetime.utcnow()
    sale = {
        "number": next_number(), "customer_id": cust["_id"], "customer_name": cust["name"], "farm_id": data["farm_id"],
        "date": data["date"], "items": lines, "subtotal": round(subtotal, 2), "discount": discount, "total": total,
        "paid": paid, "balance": round(total - paid, 2), "payment_method": data["payment_method"],
        "payment_status": "paid" if paid >= total else ("partial" if paid > 0 else "unpaid"),
        "delivery_status": "pending", "status": "confirmed", "sales_person": current_user()["name"],
        "payments": [{"amount": paid, "method": data["payment_method"], "at": now}] if paid else [],
        "notes": data.get("notes", ""), "created_at": now, "updated_at": now, "deleted_at": None,
    }
    sid = db.sales.insert_one(sale).inserted_id
    for line in lines:
        for a in line["allocations"]:
            db.inventory_transactions.insert_one({
                "lot_id": a["lot_id"], "farm_id": data["farm_id"], "type": "sale", "direction": "out",
                "quantity": a["kg"], "unit": "kg", "reference": sale["number"], "by": current_user()["name"],
                "created_at": now})
    notify("New sales order", f"{sale['number']} · {cust['name']} · {total:,.0f}", "sale", data["farm_id"],
           ["farm_owner", "sales_manager"], f"/app/sales/{sid}")
    audit("create", "sales", sid)
    return ok(db.sales.find_one({"_id": sid}), status=201, message=f"Order {sale['number']} created")


def get_sale(id_):
    s = get_db().sales.find_one({"_id": oid(id_), "deleted_at": None, **farm_scope()})
    if not s:
        raise ApiError("Sale not found", 404)
    return s


@bp.get("/sales/<id_>")
@roles_required()
def sale_detail(id_):
    s = enrich_sales([get_sale(id_)])[0]
    s["customer"] = get_db().customers.find_one({"_id": s["customer_id"]})
    s["farm"] = get_db().farms.find_one({"_id": s["farm_id"]})
    return ok(s)


@bp.patch("/sales/<id_>/status")
@roles_required(*SALES, "farm_manager")
def sale_status(id_):
    db = get_db()
    s = get_sale(id_)
    data = validate(SaleStatusIn)
    upd = {"updated_at": datetime.utcnow()}
    if data.get("delivery_status"):
        if s["status"] != "confirmed":
            raise ApiError("Order is not active", 400)
        upd["delivery_status"] = data["delivery_status"]
    if data.get("status") and data["status"] != s["status"]:
        if s["status"] != "confirmed":
            raise ApiError("Order is already closed", 400)
        # cancelled / returned: put stock back. Guarded by status so it only happens once.
        res = db.sales.update_one({"_id": s["_id"], "status": "confirmed"}, {"$set": {"status": data["status"]}})
        if res.modified_count:
            for line in s["items"]:
                release(line.get("allocations", []))
                for a in line.get("allocations", []):
                    db.inventory_transactions.insert_one({
                        "lot_id": a["lot_id"], "farm_id": s["farm_id"], "type": "return", "direction": "in",
                        "quantity": a["kg"], "unit": "kg", "reference": s["number"], "by": current_user()["name"],
                        "created_at": datetime.utcnow()})
            upd["balance"] = 0
    db.sales.update_one({"_id": s["_id"]}, {"$set": upd})
    audit("status", "sales", s["_id"], {k: v for k, v in data.items() if v})
    return ok(db.sales.find_one({"_id": s["_id"]}), message="Order updated")


@bp.post("/sales/<id_>/payments")
@roles_required(*SALES)
def add_payment(id_):
    db = get_db()
    s = get_sale(id_)
    data = validate(PaymentIn)
    if s["status"] != "confirmed":
        raise ApiError("Order is not active", 400)
    if data["amount"] > s["balance"] + 0.001:
        raise ApiError("Payment exceeds outstanding balance", 422, {"amount": f"Max {s['balance']}"})
    paid = round(s["paid"] + data["amount"], 2)
    balance = round(s["total"] - paid, 2)
    db.sales.update_one({"_id": s["_id"]}, {
        "$set": {"paid": paid, "balance": balance, "payment_status": "paid" if balance <= 0 else "partial"},
        "$push": {"payments": {"amount": data["amount"], "method": data["method"], "at": datetime.utcnow(),
                               "notes": data.get("notes", ""), "by": current_user()["name"]}}})
    notify("Payment received", f"{s['number']} · {data['amount']:,.0f} received", "payment", s["farm_id"],
           ["farm_owner", "sales_manager"], f"/app/sales/{s['_id']}")
    audit("payment", "sales", s["_id"], {"amount": data["amount"]})
    return ok(db.sales.find_one({"_id": s["_id"]}), message="Payment recorded")
