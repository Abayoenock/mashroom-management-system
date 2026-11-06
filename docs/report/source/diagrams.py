"""Generate all UML / design figures for the MycoFarm report as SVG files."""
import os
import sys

from svglib import FILL, HEAD, INK, LANE, LINE, SVG, connect, tw

OUT = sys.argv[1] if len(sys.argv) > 1 else "diagrams"
os.makedirs(OUT, exist_ok=True)


# ============================================================ swimlane activity helper
def swimlane(name, lanes, nodes, edges, lane_w=230, row_h=56, title_h=34, width=None):
    """nodes: id -> (lane, row, kind, label); kind in start/end/act/dec/fork. edges: (src, dst, label)."""
    rows = max(r for _, r, _, _ in nodes.values()) + 1
    W = width or lane_w * len(lanes)
    H = title_h + rows * row_h + 30
    s = SVG(W + 2, H + 2)
    for i, ln in enumerate(lanes):
        s.rect(i * lane_w + 1, 1, lane_w, H, fill=LANE if i % 2 == 0 else "white")
        s.rect(i * lane_w + 1, 1, lane_w, title_h, fill=HEAD)
        s.text(i * lane_w + lane_w / 2, 22, ln, size=13, anchor="middle", bold=True)
    pos, size = {}, {}
    for nid, (lane, row, kind, label) in nodes.items():
        cx = lane * lane_w + lane_w / 2 + 1
        cy = title_h + row * row_h + row_h / 2 + 6
        pos[nid] = (cx, cy)
        if kind == "start":
            s.start(cx, cy); size[nid] = (8, 8)
        elif kind == "end":
            s.end(cx, cy); size[nid] = (10, 10)
        elif kind == "dec":
            s.diamond(cx, cy); size[nid] = (18, 13)
            if label:
                s.text(cx + 24, cy - 8, label, size=10, italic=True)
        else:
            w = s.activity(cx, cy, label, size=11, w=min(lane_w - 16, tw(label, 11) + 24))
            size[nid] = (w / 2, 14)
    for e in edges:
        a, b = e[0], e[1]
        lab = e[2] if len(e) > 2 else None
        mode = e[3] if len(e) > 3 else None
        (ax, ay), (bx, by) = pos[a], pos[b]
        (aw, ah), (bw, bh) = size[a], size[b]
        if mode == "around":                       # same lane, skip intermediate nodes on the left
            xl = ax - max(aw, bw) - 70
            s.path(f"M{ax - aw},{ay} H{xl} V{by} H{bx - bw}", end="arrow")
            lx, ly = xl + 4, (ay + by) / 2
        elif isinstance(mode, tuple) and mode[0] == "branch":   # shared trunk to the right, enter target from the left
            x = mode[1]
            s.path(f"M{ax + aw},{ay} H{x} V{by} H{bx - bw}", end="arrow")
            lx, ly = x + 6, by - 5
        elif isinstance(mode, tuple) and mode[0] == "merge":    # shared trunk on the right, enter target from the right
            x = mode[1]
            s.path(f"M{ax + aw},{ay} H{x} V{by} H{bx + bw}", end="arrow")
            lx, ly = x + 4, by - 5
        elif abs(ax - bx) < 1 and by > ay:          # straight down
            s.line(ax, ay + ah, bx, by - bh, end="arrow")
            lx, ly = ax + 6, (ay + by) / 2
        elif by > ay:                              # down-and-across elbow
            my = by - bh - 12
            s.path(f"M{ax},{ay + ah} V{my} H{bx} V{by - bh}", end="arrow")
            lx, ly = (ax + bx) / 2, my - 4
        else:                                      # loop back up (route along the right of the source)
            off = max(aw, bw) + 18
            xr = max(ax, bx) + off
            s.path(f"M{ax + aw},{ay} H{xr} V{by} H{bx + bw}", end="arrow")
            lx, ly = xr + 4, (ay + by) / 2
        if lab:
            s.text(lx, ly, lab, size=10, italic=True, color="#4a5a50")
    s.save(f"{OUT}/{name}.svg")


# ============================================================ sequence helper
def sequence(name, parts, msgs, step=34, gap=170):
    """parts: [(id, label, is_actor)]; msgs: (from, to, label, kind) kind: call/ret/self/note/alt/else/endalt."""
    xs = {p[0]: 80 + i * gap for i, p in enumerate(parts)}
    W = 80 + (len(parts) - 1) * gap + 160
    top = 30
    y = top + 80
    events = []
    for m in msgs:
        events.append((y, m))
        y += step if m[3] not in ("alt", "else", "endalt") else 24
    H = y + 90
    s = SVG(W, H)
    # lifelines
    for pid, label, is_actor in parts:
        x = xs[pid]
        s.line(x, top + 70, x, H - 70, dash="5,4", color="#8a9a90")
        for yy in (top, H - 75):
            if is_actor:
                s.actor(x, yy - 4 if yy == top else yy - 2, label, size=11)
            else:
                w = tw(label, 11, True) + 20
                s.rect(x - w / 2, yy + 22, w, 28, fill=HEAD, rx=3)
                s.text(x, yy + 40, label, size=11, anchor="middle", bold=True)
    # activation bars: span of messages touching each non-actor participant
    span = {}
    for yy, (a, b, _, k) in events:
        if k in ("alt", "else", "endalt", "note"):
            continue
        for p in (a, b):
            lo, hi = span.get(p, (yy, yy))
            span[p] = (min(lo, yy), max(hi, yy + (18 if k == "self" else 0)))
    for pid, label, is_actor in parts:
        if pid in span and not is_actor:
            lo, hi = span[pid]
            s.rect(xs[pid] - 5, lo - 6, 10, hi - lo + 14, fill="white")
    # alt frames: span every participant touched between alt..endalt
    frames, stack = [], []
    for yy, (a, b, label, k) in events:
        if k == "alt":
            stack.append({"y0": yy, "label": label, "parts": {a, b}, "else": []})
        elif k == "else":
            stack[-1]["else"].append((yy, label))
        elif k == "endalt":
            f = stack.pop(); f["y1"] = yy; frames.append(f)
            if stack:
                stack[-1]["parts"] |= f["parts"]
        elif stack and k != "note":
            for fr in stack:
                fr["parts"] |= {a, b}
    for f in frames:
        x1 = min(xs[p] for p in f["parts"]) - 70
        x2 = max(xs[p] for p in f["parts"]) + 70
        s.rect(x1, f["y0"] - 4, x2 - x1, f["y1"] - f["y0"], fill="none", sw=1)
        s.path(f"M{x1},{f['y0'] - 4} h34 v10 l-6,6 h-28 z", fill=HEAD, sw=1)
        s.text(x1 + 6, f["y0"] + 8, "alt", size=10, bold=True)
        s.text(x1 + 40, f["y0"] + 8, f"[{f['label']}]", size=10, italic=True)
        for ey, el in f["else"]:
            s.line(x1, ey, x2, ey, dash="6,4")
            s.text(x1 + 6, ey + 13, f"[{el}]", size=10, italic=True)
    for yy, (a, b, label, k) in events:
        if k in ("alt", "else", "endalt"):
            continue
        if k == "note":
            s.note(xs[a] + 12, yy - 12, [label]); continue
        x1, x2 = xs[a], xs[b]
        if k == "self":
            s.path(f"M{x1 + 5},{yy} h34 v16 h-29", end="arrow")
            s.text(x1 + 44, yy + 4, label, size=10)
            continue
        d = 1 if x2 > x1 else -1
        s.line(x1 + 5 * d, yy, x2 - 5 * d, yy, dash="6,4" if k == "ret" else None, end="open" if k == "ret" else "arrow")
        tx = (x1 + x2) / 2
        s.rect(tx - tw(label, 10) / 2 - 2, yy - 15, tw(label, 10) + 4, 12, fill="white", stroke="white", sw=0)
        s.text(tx, yy - 5, label, size=10, anchor="middle", italic=(k == "ret"))
    s.save(f"{OUT}/{name}.svg")


# ============================================================ Figure: current system (manual process)
swimlane(
    "fig01_current_system",
    ["Farm Worker", "Farm Manager", "Farm Owner", "Sales / Customer"],
    {
        "s": (0, 0, "start", None),
        "a1": (0, 1, "act", "Prepare substrate & fill bags"),
        "a2": (0, 2, "act", "Write batch details in notebook"),
        "a3": (0, 3, "act", "Check rooms, note temp/humidity"),
        "a4": (0, 4, "act", "Harvest & weigh mushrooms"),
        "a5": (0, 5, "act", "Record weight in logbook"),
        "m1": (1, 6, "act", "Review notebooks weekly"),
        "d1": (1, 7, "dec", "records complete?"),
        "m2": (1, 8, "act", "Copy figures to spreadsheet"),
        "c1": (3, 6, "act", "Customer orders by phone"),
        "c2": (1, 9, "act", "Check stock physically"),
        "c3": (3, 10, "act", "Write paper receipt"),
        "o1": (2, 11, "act", "Reconcile cash & expenses monthly"),
        "o2": (2, 12, "act", "Estimate profit manually"),
        "e": (2, 13, "end", None),
    },
    [("s", "a1"), ("a1", "a2"), ("a2", "a3"), ("a3", "a4"), ("a4", "a5"), ("a5", "m1"), ("m1", "d1"),
     ("d1", "a3", "no: re-check"), ("d1", "m2", "yes"), ("c1", "c2"), ("m2", "c2"), ("c2", "c3"), ("c3", "o1"),
     ("o1", "o2"), ("o2", "e")],
    lane_w=225, row_h=50,
)

# ============================================================ Figure: use case diagram
def usecase_diagram():
    W, H = 1180, 1000
    s = SVG(W, H)
    bx, by, bw, bh = 250, 20, 680, 960
    s.rect(bx, by, bw, bh, fill="white", sw=1.4)
    s.text(bx + bw / 2, by + 24, "MycoFarm – Mushroom Farm Management System", size=14, anchor="middle", bold=True)
    left = [
        ("Login / Logout", 0), ("Manage Organizations (tenants)", 0), ("Suspend / Reactivate Tenant", 0),
        ("Register Account & Organization", 0), ("Manage Farms & Cultivation Rooms", 0), ("Manage Mushroom Varieties", 0),
        ("Manage Users & Staff", 0), ("View Dashboard & Analytics", 0), ("Manage Expenses", 0), ("Generate & Export Reports", 0),
        ("Create Production Batch", 0), ("Update Production Stage", 0), ("Approve / Reject Harvest", 0),
        ("Manage Inventory & Supplies", 0), ("Assign Tasks", 0),
    ]
    right = [
        ("Record Growth Observation", 1), ("Report Contamination", 1), ("Record Harvest (flush)", 1), ("View Assigned Tasks", 1),
        ("Receive Notifications", 1), ("Manage Customers", 1), ("Create Sales Order", 1), ("Deduct Stock (FIFO)", 1),
        ("Record Payment", 1), ("Print Invoice / Receipt", 1), ("Update Stock Automatically", 1),
    ]
    pos = {}
    for i, (u, _) in enumerate(left):
        cx, cy = bx + 175, by + 70 + i * 59
        rx = s.usecase(cx, cy, u, size=11)
        pos[u] = (cx, cy, rx)
    for i, (u, _) in enumerate(right):
        cx, cy = bx + bw - 175, by + 110 + i * 76
        rx = s.usecase(cx, cy, u, size=11)
        pos[u] = (cx, cy, rx)
    actors = {
        "Super Admin": (90, 80), "Farm Owner": (90, 360), "Farm Manager": (90, 700),
        "Farm Worker": (W - 90, 190), "Sales Manager": (W - 90, 600),
    }
    for a, (x, y) in actors.items():
        s.actor(x, y, a)
    links = {
        "Super Admin": ["Login / Logout", "Manage Organizations (tenants)", "Suspend / Reactivate Tenant", "Manage Users & Staff"],
        "Farm Owner": ["Register Account & Organization", "Login / Logout", "Manage Farms & Cultivation Rooms", "Manage Mushroom Varieties",
                       "Manage Users & Staff", "View Dashboard & Analytics", "Manage Expenses", "Generate & Export Reports"],
        "Farm Manager": ["Create Production Batch", "Update Production Stage", "Approve / Reject Harvest", "Manage Inventory & Supplies",
                         "Assign Tasks", "View Dashboard & Analytics"],
        "Farm Worker": ["Record Growth Observation", "Record Harvest (flush)", "View Assigned Tasks", "Receive Notifications"],
        "Sales Manager": ["Manage Customers", "Create Sales Order", "Record Payment", "Print Invoice / Receipt", "Receive Notifications"],
    }
    for a, ucs in links.items():
        ax, ay = actors[a]
        ay += 30
        for u in ucs:
            cx, cy, rx = pos[u]
            ex = cx - rx if ax < cx else cx + rx
            s.line(ax + (16 if ax < cx else -16), ay, ex, cy, color="#56665c", sw=1)
    for a, b in (("Record Growth Observation", "Report Contamination"), ("Approve / Reject Harvest", "Update Stock Automatically"),
                 ("Create Sales Order", "Deduct Stock (FIFO)")):
        x1, y1, r1 = pos[a]; x2, y2, r2 = pos[b]
        p1 = (x1 + (r1 if x2 > x1 else 0), y1 + (19 if x2 <= x1 else 0))
        p2 = (x2 - (r2 if x2 > x1 else 0), y2 - (19 if x2 <= x1 else 0))
        s.line(*p1, *p2, dash="5,4", end="open")
        lab = "«extend»" if a == "Record Growth Observation" else "«include»"
        s.text((p1[0] + p2[0]) / 2 + 4, (p1[1] + p2[1]) / 2 - 4, lab, size=10, italic=True)
    s.save(f"{OUT}/fig02_use_case.svg")


usecase_diagram()

# ============================================================ Figure: class diagram
def class_diagram():
    s = SVG(1730, 1130)
    X = [20, 305, 590, 875, 1160, 1445]
    Y = [20, 345, 760]
    C = {}
    C["Notification"] = s.classbox(X[0], Y[0], "Notification", ["- id : ObjectId", "- farmId : ObjectId", "- type : String",
                                                                "- title : String", "- roles : String[]", "- readBy : ObjectId[]"],
                                   ["+ markRead(user)"])
    C["User"] = s.classbox(X[1], Y[0], "User", ["- id : ObjectId", "- name : String", "- email : String", "- passwordHash : String",
                                                "- role : Role", "- orgId : ObjectId", "- farmIds : ObjectId[]"],
                           ["+ register()", "+ login()", "+ updateProfile()"])
    C["Organization"] = s.classbox(X[2], Y[0], "Organization", ["- id : ObjectId", "- name : String", "- status : String",
                                                                "- ownerId : ObjectId"], ["+ create()", "+ suspend()", "+ reactivate()"])
    C["Farm"] = s.classbox(X[3], Y[0], "Farm", ["- id : ObjectId", "- orgId : ObjectId", "- code : String", "- name : String",
                                                "- location : String", "- sizeSqm : Double", "- status : String"],
                           ["+ addRoom()", "+ getStatistics()"])
    C["CultivationRoom"] = s.classbox(X[4], Y[0], "CultivationRoom", ["- id : ObjectId", "- farmId : ObjectId", "- code : String",
                                                                      "- capacityBags : Int", "- temperature : Double",
                                                                      "- humidity : Double", "- ventilation : String"], ["+ occupancy()"])
    C["MushroomVariety"] = s.classbox(X[5], Y[0], "MushroomVariety", ["- id : ObjectId", "- orgId : ObjectId", "- name : String",
                                                                      "- incubationDays : Int", "- fruitingDays : Int",
                                                                      "- yieldPerBag : Double", "- pricePerKg : Double"],
                                      ["+ expectedYield(bags)"])
    C["Employee"] = s.classbox(X[0], Y[1], "Employee", ["- id : ObjectId", "- farmId : ObjectId", "- name : String",
                                                        "- position : String", "- roomId : ObjectId", "- status : String"])
    C["Customer"] = s.classbox(X[1], Y[1], "Customer", ["- id : ObjectId", "- orgId : ObjectId", "- name : String", "- type : String",
                                                        "- phone : String", "- email : String"], ["+ purchaseHistory()"])
    C["Expense"] = s.classbox(X[2], Y[1], "Expense", ["- id : ObjectId", "- farmId : ObjectId", "- category : String",
                                                      "- amount : Double", "- date : Date", "- batchId : ObjectId"])
    C["InventoryItem"] = s.classbox(X[3], Y[1], "InventoryItem", ["- id : ObjectId", "- farmId : ObjectId", "- sku : String",
                                                                  "- category : String", "- quantity : Double", "- minLevel : Double"],
                                    ["+ receive(qty)", "+ consume(qty)", "+ isLow()"])
    C["ProductionBatch"] = s.classbox(X[4], Y[1], "ProductionBatch", ["- id : ObjectId", "- code : String", "- farmId : ObjectId",
                                                                      "- roomId : ObjectId", "- varietyId : ObjectId", "- bags : Int",
                                                                      "- spawningDate : Date", "- stage : Stage",
                                                                      "- expectedYieldKg : Double", "- harvestedKg : Double"],
                                      ["+ changeStage(stage)", "+ addObservation()", "+ flags()"])
    C["StageHistory"] = s.classbox(X[5], Y[1], "StageHistory", ["- batchId : ObjectId", "- from : Stage", "- to : Stage",
                                                                "- at : DateTime", "- by : String", "- notes : String"])
    C["Task"] = s.classbox(X[0], Y[2], "Task", ["- id : ObjectId", "- farmId : ObjectId", "- title : String", "- employeeId : ObjectId",
                                                "- dueDate : Date", "- priority : String", "- status : String"], ["+ complete()"])
    C["SalesOrder"] = s.classbox(X[1], Y[2], "SalesOrder", ["- id : ObjectId", "- number : String", "- customerId : ObjectId",
                                                            "- farmId : ObjectId", "- items : SaleItem[]", "- total : Double",
                                                            "- paid : Double", "- paymentStatus : String"],
                                  ["+ create()", "+ addPayment(amount)", "+ cancel()", "+ return()"])
    C["StockLot"] = s.classbox(X[2], Y[2], "StockLot", ["- id : ObjectId", "- harvestId : ObjectId", "- varietyId : ObjectId",
                                                        "- grade : String", "- availableKg : Double", "- expiryDate : Date"],
                               ["+ allocate(kg)", "+ release(kg)"])
    C["Harvest"] = s.classbox(X[3], Y[2], "Harvest", ["- id : ObjectId", "- code : String", "- batchId : ObjectId", "- flush : Int",
                                                      "- weightKg : Double", "- grade : String", "- rejectedKg : Double",
                                                      "- status : String"], ["+ submit()", "+ approve()", "+ reject()"])
    C["AuditLog"] = s.classbox(X[4], Y[2] + 120, "AuditLog", ["- action : String", "- entity : String", "- entityId : ObjectId",
                                                              "- userId : ObjectId", "- orgId : ObjectId", "- createdAt : DateTime"])
    C["GrowthObservation"] = s.classbox(X[5], Y[2], "GrowthObservation", ["- batchId : ObjectId", "- date : Date",
                                                                          "- temperature : Double", "- humidity : Double",
                                                                          "- condition : String", "- contamination : Boolean",
                                                                          "- affectedBags : Int"])
    nbox = len(s.items)
    rel = [
        ("Organization", "User", "employs", "1", "*", "dia"), ("Organization", "Farm", "owns", "1", "*", "dia"),
        ("Organization", "Customer", "serves", "1", "*", None), ("User", "Notification", "receives", "1", "*", None),
        ("Farm", "CultivationRoom", "has", "1", "*", "fdia"), ("Farm", "Expense", "incurs", "1", "*", None),
        ("Farm", "InventoryItem", "stores", "1", "*", None), ("CultivationRoom", "ProductionBatch", "hosts", "1", "*", None),
        ("MushroomVariety", "ProductionBatch", "of variety", "1", "*", None),
        ("ProductionBatch", "StageHistory", "", "1", "*", "fdia"), ("ProductionBatch", "GrowthObservation", "", "1", "*", "fdia"),
        ("ProductionBatch", "Harvest", "flushes", "1", "*", "fdia"), ("Harvest", "StockLot", "approved into", "1", "0..1", None),
        ("SalesOrder", "StockLot", "allocates", "*", "*", None), ("Customer", "SalesOrder", "places", "1", "*", None),
        ("Employee", "Task", "assigned", "1", "*", None),
    ]
    for a, b, lab, ma, mb, kind in rel:
        connect(s, C[a], C[b], lab or None, ma, mb, start=kind)
    s.items = s.items[nbox:] + s.items[:nbox]          # connectors under the boxes
    s.save(f"{OUT}/fig03_class_diagram.svg")


class_diagram()

# ============================================================ Figures: sequence diagrams
sequence("fig04_seq_register", [("u", "Farm Owner", True), ("ui", "Register Page", False), ("api", "Auth API", False),
                                 ("org", "Organization Service", False), ("db", "MongoDB", False)], [
    ("u", "ui", "open registration form", "call"),
    ("ui", "u", "display form", "ret"),
    ("u", "ui", "submit name, email, farm, password", "call"),
    ("ui", "ui", "validate (zod)", "self"),
    ("ui", "api", "POST /auth/register", "call"),
    ("api", "db", "find user by email", "call"),
    ("db", "api", "result", "ret"),
    ("api", "api", "email exists?", "alt"),
    ("api", "ui", "409 email already registered", "ret"),
    ("api", "api", "new email", "else"),
    ("api", "org", "create organization + starter varieties", "call"),
    ("org", "db", "insert organization, varieties, farm", "call"),
    ("db", "org", "ids", "ret"),
    ("org", "api", "orgId", "ret"),
    ("api", "db", "insert user (hashed password, farm_owner)", "call"),
    ("api", "api", "issue JWT access + refresh", "self"),
    ("api", "ui", "201 user + tokens", "ret"),
    ("api", "db", "", "endalt"),
    ("ui", "u", "redirect to dashboard", "ret"),
], gap=185)

sequence("fig05_seq_login", [("u", "User", True), ("ui", "Login Page", False), ("api", "Auth API", False), ("db", "MongoDB", False)], [
    ("u", "ui", "enter email & password", "call"),
    ("ui", "api", "POST /auth/login", "call"),
    ("api", "db", "find user, organization", "call"),
    ("db", "api", "user record", "ret"),
    ("api", "api", "credentials valid & org active?", "alt"),
    ("api", "api", "verify password hash", "self"),
    ("api", "db", "update last_login", "call"),
    ("api", "ui", "200 user, access & refresh token", "ret"),
    ("ui", "u", "show role-based dashboard", "ret"),
    ("api", "api", "invalid / suspended", "else"),
    ("api", "ui", "401 / 403 error message", "ret"),
    ("ui", "u", "display error", "ret"),
    ("api", "db", "", "endalt"),
], gap=210)

sequence("fig06_seq_harvest", [("w", "Farm Worker", True), ("ui", "Web App", False), ("api", "Harvest API", False),
                                ("db", "MongoDB", False), ("m", "Farm Manager", True)], [
    ("w", "ui", "record harvest (flush, kg, grade)", "call"),
    ("ui", "api", "POST /harvests", "call"),
    ("api", "db", "check batch stage & farm access", "call"),
    ("db", "api", "batch (fruiting/harvesting)", "ret"),
    ("api", "db", "insert harvest (status: pending)", "call"),
    ("api", "db", "create notification for managers", "call"),
    ("api", "ui", "201 submitted for approval", "ret"),
    ("m", "ui", "open pending harvests", "call"),
    ("m", "ui", "approve harvest", "call"),
    ("ui", "api", "PATCH /harvests/{id}/approve", "call"),
    ("api", "db", "findOneAndUpdate(status=pending → approved)", "call"),
    ("api", "db", "insert stock lot + inventory transaction", "call"),
    ("api", "db", "increment batch harvested_kg", "call"),
    ("api", "ui", "200 harvest approved", "ret"),
    ("ui", "m", "stock & dashboard updated", "ret"),
], gap=200)

sequence("fig07_seq_sale", [("s", "Sales Manager", True), ("ui", "Sales Page", False), ("api", "Sales API", False),
                             ("al", "Stock Allocator", False), ("db", "MongoDB", False)], [
    ("s", "ui", "add customer, products, payment", "call"),
    ("ui", "api", "POST /sales", "call"),
    ("api", "db", "verify customer & variety belong to org", "call"),
    ("db", "api", "ok", "ret"),
    ("api", "al", "allocate(variety, grade, kg)", "call"),
    ("al", "db", "decrement oldest lots (guarded $inc)", "call"),
    ("al", "al", "enough stock?", "alt"),
    ("al", "api", "allocations", "ret"),
    ("api", "db", "insert order, stock transactions", "call"),
    ("api", "db", "notify owner & sales", "call"),
    ("api", "ui", "201 order + invoice", "ret"),
    ("al", "al", "insufficient", "else"),
    ("al", "db", "release already-taken lots", "call"),
    ("api", "ui", "409 not enough stock", "ret"),
    ("api", "db", "", "endalt"),
    ("ui", "s", "show invoice / error", "ret"),
], gap=190)

# ============================================================ Figure: activity diagram of the system
swimlane(
    "fig08_activity",
    ["User", "System", "Dashboards / Modules"],
    {
        "s": (0, 0, "start", None),
        "a1": (0, 1, "act", "Open MycoFarm web app"),
        "d0": (0, 2, "dec", "has account?"),
        "a2": (0, 3, "act", "Register farm & owner account"),
        "s0": (1, 4, "act", "Create organization & starter data"),
        "a3": (0, 5, "act", "Enter email & password"),
        "s1": (1, 6, "act", "Validate credentials & tenant status"),
        "d1": (1, 7, "dec", "valid?"),
        "s2": (1, 8, "act", "Issue JWT, load role & farms"),
        "d2": (1, 9, "dec", "role?"),
        "m1": (2, 10, "act", "Super Admin: Organizations console"),
        "m2": (2, 11, "act", "Owner / Manager: Dashboard"),
        "m3": (2, 12, "act", "Worker: Batches, observations, harvests"),
        "m4": (2, 13, "act", "Sales: Customers, orders, payments"),
        "s3": (1, 14, "act", "Validate, save, update stock, notify"),
        "a4": (0, 15, "act", "Logout"),
        "e": (0, 16, "end", None),
    },
    [("s", "a1"), ("a1", "d0"), ("d0", "a2", "no"), ("a2", "s0"), ("s0", "a3"), ("d0", "a3", "yes", "around"), ("a3", "s1"),
     ("s1", "d1"), ("d1", "a3", "no: show error"), ("d1", "s2", "yes"), ("s2", "d2"),
     ("d2", "m1", None, ("branch", 615)), ("d2", "m2", None, ("branch", 615)), ("d2", "m3", None, ("branch", 615)),
     ("d2", "m4", None, ("branch", 615)),
     ("m1", "s3", None, ("merge", 885)), ("m2", "s3", None, ("merge", 885)), ("m3", "s3", None, ("merge", 885)),
     ("m4", "s3", None, ("merge", 885)), ("s3", "a4"), ("a4", "e")],
    lane_w=300, row_h=48,
)

# ============================================================ Figure: ERD
def erd():
    s = SVG(1700, 1060)
    X = [20, 300, 580, 860, 1140, 1420]
    Y = [20, 330, 680]
    E = {}
    E["notifications"] = s.entity(X[0], Y[0], "notifications", [("PK", "_id", "ObjectId"), ("FK", "farm_id", "ObjectId"),
                                                                ("", "type", "string"), ("", "roles[]", "string"), ("", "read_by[]", "ObjectId")])
    E["users"] = s.entity(X[1], Y[0], "users", [("PK", "_id", "ObjectId"), ("FK", "org_id", "ObjectId"), ("", "name", "string"),
                                                ("", "email", "string (unique)"), ("", "password_hash", "string"), ("", "role", "string"),
                                                ("FK", "farm_ids", "ObjectId[]"), ("", "active", "bool")])
    E["organizations"] = s.entity(X[2], Y[0], "organizations", [("PK", "_id", "ObjectId"), ("", "name", "string"), ("", "status", "string"),
                                                                ("FK", "owner_id", "ObjectId"), ("", "created_at", "date")])
    E["farms"] = s.entity(X[3], Y[0], "farms", [("PK", "_id", "ObjectId"), ("FK", "org_id", "ObjectId"), ("", "code", "string"),
                                                ("", "name", "string"), ("", "location", "string"), ("", "size_sqm", "double"),
                                                ("", "status", "string")])
    E["rooms"] = s.entity(X[4], Y[0], "cultivation_rooms", [("PK", "_id", "ObjectId"), ("FK", "farm_id", "ObjectId"),
                                                            ("FK", "variety_id", "ObjectId"), ("", "code", "string"),
                                                            ("", "capacity_bags", "int"), ("", "temperature", "double"), ("", "humidity", "double")])
    E["varieties"] = s.entity(X[5], Y[0], "mushroom_varieties", [("PK", "_id", "ObjectId"), ("FK", "org_id", "ObjectId"), ("", "name", "string"),
                                                                 ("", "incubation_days", "int"), ("", "fruiting_days", "int"),
                                                                 ("", "yield_kg_per_bag", "double"), ("", "price_per_kg", "double")])
    E["employees"] = s.entity(X[0], Y[1], "employees", [("PK", "_id", "ObjectId"), ("FK", "farm_id", "ObjectId"), ("FK", "room_id", "ObjectId"),
                                                        ("", "name", "string"), ("", "position", "string"), ("", "status", "string")])
    E["customers"] = s.entity(X[1], Y[1], "customers", [("PK", "_id", "ObjectId"), ("FK", "org_id", "ObjectId"), ("", "name", "string"),
                                                        ("", "type", "string"), ("", "phone", "string"), ("", "status", "string")])
    E["expenses"] = s.entity(X[2], Y[1], "expenses", [("PK", "_id", "ObjectId"), ("FK", "farm_id", "ObjectId"), ("FK", "batch_id", "ObjectId"),
                                                      ("", "category", "string"), ("", "amount", "double"), ("", "date", "date")])
    E["items"] = s.entity(X[3], Y[1], "inventory_items", [("PK", "_id", "ObjectId"), ("FK", "farm_id", "ObjectId"), ("", "sku", "string"),
                                                          ("", "category", "string"), ("", "quantity", "double"), ("", "min_level", "double")])
    E["batches"] = s.entity(X[4], Y[1], "production_batches", [("PK", "_id", "ObjectId"), ("", "code", "string (unique)"),
                                                               ("FK", "farm_id", "ObjectId"), ("FK", "room_id", "ObjectId"),
                                                               ("FK", "variety_id", "ObjectId"), ("", "bags", "int"), ("", "spawning_date", "date"),
                                                               ("", "stage", "string"), ("", "expected_yield_kg", "double"),
                                                               ("", "harvested_kg", "double")])
    E["history"] = s.entity(X[5], Y[1], "stage_history", [("PK", "_id", "ObjectId"), ("FK", "batch_id", "ObjectId"), ("", "from", "string"),
                                                          ("", "to", "string"), ("", "at", "date"), ("", "by", "string")])
    E["tasks"] = s.entity(X[0], Y[2], "tasks", [("PK", "_id", "ObjectId"), ("FK", "farm_id", "ObjectId"), ("FK", "employee_id", "ObjectId"),
                                                ("", "title", "string"), ("", "due_date", "date"), ("", "status", "string")])
    E["sales"] = s.entity(X[1], Y[2], "sales", [("PK", "_id", "ObjectId"), ("", "number", "string (unique)"), ("FK", "customer_id", "ObjectId"),
                                                ("FK", "farm_id", "ObjectId"), ("", "items[]", "embedded"), ("", "total", "double"),
                                                ("", "paid / balance", "double"), ("", "payment_status", "string"), ("", "payments[]", "embedded")])
    E["lots"] = s.entity(X[2], Y[2], "stock_lots", [("PK", "_id", "ObjectId"), ("FK", "harvest_id", "ObjectId"), ("FK", "variety_id", "ObjectId"),
                                                    ("FK", "farm_id", "ObjectId"), ("", "available_kg", "double"), ("", "expiry_date", "date")])
    E["harvests"] = s.entity(X[3], Y[2], "harvests", [("PK", "_id", "ObjectId"), ("", "code", "string (unique)"), ("FK", "batch_id", "ObjectId"),
                                                      ("FK", "farm_id", "ObjectId"), ("", "flush", "int"), ("", "weight_kg", "double"),
                                                      ("", "grade", "string"), ("", "rejected_kg", "double"), ("", "status", "string")])
    E["audit"] = s.entity(X[4], Y[2] + 110, "audit_logs", [("PK", "_id", "ObjectId"), ("FK", "user_id", "ObjectId"), ("FK", "org_id", "ObjectId"),
                                                           ("", "action", "string"), ("", "entity", "string"), ("", "created_at", "date")])
    E["obs"] = s.entity(X[5], Y[2], "growth_observations", [("PK", "_id", "ObjectId"), ("FK", "batch_id", "ObjectId"), ("", "date", "date"),
                                                            ("", "temperature", "double"), ("", "humidity", "double"),
                                                            ("", "contamination", "bool"), ("", "affected_bags", "int")])
    E["txn"] = s.entity(X[2], Y[2] + 210, "inventory_transactions", [("PK", "_id", "ObjectId"), ("FK", "item_id / lot_id", "ObjectId"),
                                                                     ("", "type", "string"), ("", "direction", "in/out"), ("", "quantity", "double")])
    nbox = len(s.items)
    rel = [("organizations", "users"), ("organizations", "farms"), ("organizations", "customers"), ("users", "notifications"),
           ("farms", "rooms"), ("farms", "expenses"), ("farms", "items"), ("rooms", "batches"), ("varieties", "batches"),
           ("batches", "history"), ("batches", "obs"), ("batches", "harvests"), ("harvests", "lots"), ("lots", "txn"),
           ("customers", "sales"), ("lots", "sales"), ("employees", "tasks"), ("batches", "audit")]
    for a, b in rel:
        if (a, b) == ("batches", "audit"):
            continue
        connect(s, E[a], E[b], start="one", end="crow")
    s.items = s.items[nbox:] + s.items[:nbox]
    s.save(f"{OUT}/fig09_erd.svg")


erd()

# ============================================================ Figure: architecture
def architecture():
    s = SVG(1180, 820)
    def layer(y, h, title, sub):
        s.rect(20, y, 1140, h, fill="#f7f9f6", rx=6, sw=1.4)
        s.text(36, y + 22, title, size=14, bold=True)
        s.text(36, y + 40, sub, size=11, italic=True, color="#5b6b60")
    def box(x, y, w, label, sub=None, h=48):
        s.rect(x, y, w, h, fill="white", rx=4)
        s.text(x + w / 2, y + (20 if sub else 29), label, size=12, anchor="middle", bold=True)
        if sub:
            s.text(x + w / 2, y + 37, sub, size=10, anchor="middle", color="#5b6b60")
        return (x, y, w, h)
    layer(20, 170, "Presentation Layer (Browser – React SPA)", "Vite · TypeScript · Tailwind CSS v4 · shadcn/ui · TanStack Query · Zustand · Recharts")
    fe = [box(40 + i * 223, 80, 205, a, b) for i, (a, b) in enumerate([
        ("Public Landing", "features, stats, contact"), ("Authentication", "login, register, reset"),
        ("Dashboards", "KPIs & charts per role"), ("Operations Modules", "farms, batches, harvests"),
        ("Business Modules", "stock, sales, expenses, reports")])]
    s.text(590, 172, "Axios client → attaches JWT + X-Farm-Id header, auto-refreshes expired tokens", size=11, anchor="middle", italic=True)
    layer(230, 300, "Application Layer (Flask REST API – /api/v1)", "Python · Flask · Flask-JWT-Extended · Pydantic · Flask-CORS")
    mw = [box(40 + i * 375, 290, 350, a, b) for i, (a, b) in enumerate([
        ("Authentication & JWT", "access + rotating refresh tokens, blocklist"),
        ("RBAC & Tenancy Guard", "roles_required · org_scope · farm_scope"),
        ("Validation & Audit", "pydantic schemas · audit_logs · errors")])]
    mods = ["auth", "organizations", "users", "farms/rooms", "varieties", "production", "harvests", "inventory", "sales", "customers",
            "expenses", "employees/tasks", "dashboard", "reports", "notifications"]
    for i, m in enumerate(mods):
        box(40 + (i % 8) * 139, 370 + (i // 8) * 70, 128, m, None, 40)
    layer(570, 230, "Data Layer (MongoDB)", "PyMongo · indexes · aggregation pipelines · guarded atomic updates")
    cols = ["organizations", "users", "farms", "cultivation_rooms", "mushroom_varieties", "production_batches", "stage_history",
            "growth_observations", "harvests", "stock_lots", "inventory_items", "inventory_transactions", "customers", "sales",
            "expenses", "employees", "tasks", "notifications", "audit_logs", "token_blocklist"]
    for i, c in enumerate(cols):
        x, y = 40 + (i % 5) * 223, 630 + (i // 5) * 40
        s.rect(x, y, 205, 30, fill="white", rx=3)
        s.text(x + 102, y + 20, c, size=11, anchor="middle")
    for x in (300, 590, 880):
        s.line(x, 190, x, 230, end="arrow", start="arrow", sw=1.6)
        s.line(x, 530, x, 570, end="arrow", start="arrow", sw=1.6)
    s.text(610, 215, "HTTPS · JSON · Bearer JWT", size=11, bold=True)
    s.text(610, 556, "PyMongo driver", size=11, bold=True)
    s.save(f"{OUT}/fig10_architecture.svg")


architecture()


# ============================================================ element-table icons (small illustrations)
def icon(name, w, h, draw):
    s = SVG(w, h)
    draw(s)
    s.save(f"{OUT}/icon_{name}.svg")


icon("class", 120, 70, lambda s: s.classbox(10, 4, "ClassName", ["- attribute"], ["+ method()"], w=100, size=10))
icon("attribute", 120, 40, lambda s: (s.rect(10, 5, 100, 30, fill="white"), s.text(18, 25, "- name : String", size=11)))
icon("method", 120, 40, lambda s: (s.rect(10, 5, 100, 30, fill="white"), s.text(18, 25, "+ approve() : void", size=11)))
icon("inheritance", 120, 40, lambda s: s.line(10, 20, 108, 20, end="tri"))
icon("association", 120, 40, lambda s: (s.line(10, 20, 110, 20), s.text(14, 14, "1", size=10), s.text(104, 14, "*", size=10)))
icon("aggregation", 120, 40, lambda s: s.line(110, 20, 10, 20, end="dia"))
icon("composition", 120, 40, lambda s: s.line(110, 20, 10, 20, end="fdia"))
icon("seq_actor", 70, 80, lambda s: s.actor(35, 4, "Actor", size=10))
icon("seq_lifeline", 70, 80, lambda s: (s.rect(10, 4, 50, 20, fill=HEAD), s.line(35, 24, 35, 76, dash="5,4", color="#8a9a90")))
icon("seq_object", 100, 40, lambda s: (s.rect(10, 6, 80, 26, fill=HEAD, rx=3), s.text(50, 23, ":Object", size=11, anchor="middle", bold=True)))
icon("seq_message", 120, 40, lambda s: (s.line(10, 24, 110, 24, end="arrow"), s.text(60, 18, "request()", size=10, anchor="middle")))
icon("seq_activation", 60, 80, lambda s: (s.line(30, 2, 30, 78, dash="5,4", color="#8a9a90"), s.rect(25, 16, 10, 48, fill="white")))
icon("act_activity", 120, 40, lambda s: s.activity(60, 20, "Activity", w=100))
icon("act_flow", 120, 40, lambda s: s.line(10, 20, 110, 20, end="arrow"))
icon("act_decision", 80, 40, lambda s: s.diamond(40, 20))
icon("act_swimlane", 120, 70, lambda s: (s.rect(5, 5, 55, 60, fill=LANE), s.rect(60, 5, 55, 60, fill="white"), s.rect(5, 5, 110, 16, fill=HEAD, sw=1),
                                         s.text(32, 17, "Lane A", size=9, anchor="middle"), s.text(88, 17, "Lane B", size=9, anchor="middle")))
icon("act_start", 40, 40, lambda s: s.start(20, 20))
icon("act_end", 40, 40, lambda s: s.end(20, 20))
icon("act_flowfinal", 40, 40, lambda s: (s.circle(20, 20, 10, fill="white"), s.line(13, 13, 27, 27), s.line(27, 13, 13, 27)))
icon("db_entity", 120, 60, lambda s: s.entity(10, 4, "entity", [("PK", "_id", "ObjectId")], w=100, size=10))
icon("db_attribute", 120, 36, lambda s: (s.rect(10, 4, 100, 26, fill="white"), s.text(18, 22, "name : string", size=11)))
icon("db_relationship", 120, 36, lambda s: s.line(10, 18, 110, 18))
icon("db_cardinality", 120, 36, lambda s: s.line(10, 18, 110, 18, start="one", end="crow"))
icon("uc_actor", 70, 80, lambda s: s.actor(35, 4, "Actor", size=10))
icon("uc_usecase", 140, 46, lambda s: s.usecase(70, 23, "Use case", size=11))
icon("uc_boundary", 120, 60, lambda s: (s.rect(8, 6, 104, 48, fill="white"), s.text(60, 22, "System", size=10, anchor="middle", bold=True)))
icon("uc_include", 120, 36, lambda s: (s.line(10, 22, 110, 22, dash="5,4", end="open"), s.text(60, 16, "«include»", size=10, anchor="middle", italic=True)))
print("ok")
