"""Tiny SVG drawing helpers producing PlantUML-like, print-friendly UML diagrams."""
from html import escape

FONT = "Arial, Helvetica, sans-serif"
INK = "#1f2a24"
LINE = "#3b4a41"
FILL = "#f3f6f1"        # light neutral box fill
HEAD = "#dfe8dc"        # header band fill
NOTE = "#fbf6e6"
LANE = "#fafbf9"


def tw(text, size=12, bold=False):
    """Approximate text width in px for Arial."""
    w = 0.0
    for ch in str(text):
        if ch in "il.,:;|!'ijtf[]()":
            w += 0.30
        elif ch in "mwMW@":
            w += 0.85
        elif ch.isupper():
            w += 0.68
        elif ch == " ":
            w += 0.28
        else:
            w += 0.55
    return w * size * (1.07 if bold else 1.0)


class SVG:
    def __init__(self, w, h, title=None):
        self.w, self.h = w, h
        self.items = []
        self.title = title

    # -- primitives -----------------------------------------------------
    def add(self, s):
        self.items.append(s)

    def text(self, x, y, s, size=12, anchor="start", bold=False, italic=False, color=INK, underline=False):
        st = []
        if bold:
            st.append("font-weight:bold")
        if italic:
            st.append("font-style:italic")
        if underline:
            st.append("text-decoration:underline")
        self.add(f'<text x="{x:.1f}" y="{y:.1f}" font-family="{FONT}" font-size="{size}" fill="{color}" '
                 f'text-anchor="{anchor}" style="{";".join(st)}">{escape(str(s))}</text>')

    def rect(self, x, y, w, h, fill=FILL, stroke=LINE, rx=0, sw=1.2, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="{fill}" '
                 f'stroke="{stroke}" stroke-width="{sw}"{d}/>')

    def line(self, x1, y1, x2, y2, sw=1.2, dash=None, color=LINE, start=None, end=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        ms = f' marker-start="url(#{start})"' if start else ""
        me = f' marker-end="url(#{end})"' if end else ""
        self.add(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{color}" '
                 f'stroke-width="{sw}"{d}{ms}{me}/>')

    def path(self, d, sw=1.2, dash=None, end=None, start=None, fill="none", color=LINE):
        da = f' stroke-dasharray="{dash}"' if dash else ""
        me = f' marker-end="url(#{end})"' if end else ""
        ms = f' marker-start="url(#{start})"' if start else ""
        self.add(f'<path d="{d}" fill="{fill}" stroke="{color}" stroke-width="{sw}"{da}{me}{ms}/>')

    def ellipse(self, cx, cy, rx, ry, fill=FILL, sw=1.2):
        self.add(f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" fill="{fill}" stroke="{LINE}" stroke-width="{sw}"/>')

    def circle(self, cx, cy, r, fill=INK, stroke=INK, sw=1.2):
        self.add(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')

    def polygon(self, pts, fill=FILL, sw=1.2):
        p = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
        self.add(f'<polygon points="{p}" fill="{fill}" stroke="{LINE}" stroke-width="{sw}"/>')

    # -- UML shapes -----------------------------------------------------
    def actor(self, cx, top, label, size=12):
        self.circle(cx, top + 8, 8, fill="white", stroke=LINE)
        self.line(cx, top + 16, cx, top + 38)
        self.line(cx - 14, top + 24, cx + 14, top + 24)
        self.line(cx, top + 38, cx - 11, top + 54)
        self.line(cx, top + 38, cx + 11, top + 54)
        self.text(cx, top + 70, label, size=size, anchor="middle", bold=True)

    def usecase(self, cx, cy, label, size=12):
        rx = max(70, tw(label, size) / 2 + 18)
        self.ellipse(cx, cy, rx, 19)
        self.text(cx, cy + 4, label, size=size, anchor="middle")
        return rx

    def classbox(self, x, y, name, attrs, methods=(), w=None, stereo=None, size=11):
        lines = [name] + list(attrs) + list(methods)
        w = w or max(tw(s, size) for s in lines) + 22
        lh = size + 4
        h_head = 24 + (12 if stereo else 0)
        h = h_head + len(attrs) * lh + 8 + (len(methods) * lh + 8 if methods else 6)
        self.rect(x, y, w, h, fill="white")
        self.rect(x, y, w, h_head, fill=HEAD)
        if stereo:
            self.text(x + w / 2, y + 12, stereo, size=size - 1, anchor="middle", italic=True)
        self.text(x + w / 2, y + h_head - 7, name, size=size + 1, anchor="middle", bold=True)
        yy = y + h_head + lh
        for a in attrs:
            self.text(x + 8, yy - 3, a, size=size)
            yy += lh
        if methods:
            self.line(x, yy - lh + 6, x + w, yy - lh + 6)
            yy += 6
            for m in methods:
                self.text(x + 8, yy - 3, m, size=size)
                yy += lh
        return (x, y, w, h)

    def entity(self, x, y, name, fields, w=None, size=11):
        """ERD entity: header + rows of (key, field, type)."""
        w = w or max([tw(name, size + 1, True)] + [tw(f"{k} {f} : {t}", size) for k, f, t in fields]) + 26
        lh = size + 5
        h = 24 + len(fields) * lh + 8
        self.rect(x, y, w, h, fill="white")
        self.rect(x, y, w, 24, fill=HEAD)
        self.text(x + w / 2, y + 16, name, size=size + 1, anchor="middle", bold=True)
        yy = y + 24 + lh
        for k, f, t in fields:
            if k:
                self.text(x + 6, yy - 4, k, size=size - 2, bold=True, color="#5b6b60")
            self.text(x + 30, yy - 4, f, size=size, bold=(k == "PK"), underline=(k == "PK"))
            self.text(x + w - 6, yy - 4, t, size=size - 1, anchor="end", color="#5b6b60")
            yy += lh
        return (x, y, w, h)

    def activity(self, cx, cy, label, size=11, w=None):
        w = w or tw(label, size) + 26
        self.rect(cx - w / 2, cy - 14, w, 28, fill=FILL, rx=12)
        self.text(cx, cy + 4, label, size=size, anchor="middle")
        return w

    def diamond(self, cx, cy, label=None, r=13, size=10):
        self.polygon([(cx, cy - r), (cx + r * 1.4, cy), (cx, cy + r), (cx - r * 1.4, cy)], fill="white")
        if label:
            self.text(cx + r * 1.4 + 6, cy - 6, label, size=size, italic=True)

    def start(self, cx, cy):
        self.circle(cx, cy, 8)

    def end(self, cx, cy):
        self.circle(cx, cy, 10, fill="white")
        self.circle(cx, cy, 6)

    def note(self, x, y, lines, size=10):
        w = max(tw(s, size) for s in lines) + 16
        h = len(lines) * (size + 4) + 10
        self.path(f"M{x},{y} h{w-10} l10,10 v{h-10} h-{w} z", fill=NOTE)
        for i, s in enumerate(lines):
            self.text(x + 8, y + 14 + i * (size + 4), s, size=size)
        return w, h

    # -- output -----------------------------------------------------------
    def svg(self):
        defs = f'''<defs>
<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{LINE}"/></marker>
<marker id="open" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10" fill="none" stroke="{LINE}" stroke-width="1.3"/></marker>
<marker id="tri" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="13" markerHeight="13" orient="auto-start-reverse"><path d="M0,0 L12,6 L0,12 z" fill="white" stroke="{LINE}" stroke-width="1.2"/></marker>
<marker id="dia" viewBox="0 0 16 10" refX="1" refY="5" markerWidth="16" markerHeight="10" orient="auto-start-reverse"><path d="M1,5 L8,1 L15,5 L8,9 z" fill="white" stroke="{LINE}" stroke-width="1.1"/></marker>
<marker id="fdia" viewBox="0 0 16 10" refX="1" refY="5" markerWidth="16" markerHeight="10" orient="auto-start-reverse"><path d="M1,5 L8,1 L15,5 L8,9 z" fill="{LINE}" stroke="{LINE}" stroke-width="1.1"/></marker>
<marker id="crow" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="14" markerHeight="14" orient="auto-start-reverse"><path d="M13,7 L1,1 M13,7 L1,13 M13,7 L1,7 M4,1 L4,13" fill="none" stroke="{LINE}" stroke-width="1.1"/></marker>
<marker id="one" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="14" markerHeight="14" orient="auto-start-reverse"><path d="M13,7 L1,7 M6,1 L6,13 M10,1 L10,13" fill="none" stroke="{LINE}" stroke-width="1.1"/></marker>
</defs>'''
        body = "\n".join(self.items)
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" '
                f'viewBox="0 0 {self.w} {self.h}">{defs}<rect width="100%" height="100%" fill="white"/>\n{body}\n</svg>')

    def save(self, path):
        with open(path, "w") as f:
            f.write(self.svg())


def border_point(box, tx, ty):
    """Point where the line from the box centre towards (tx, ty) leaves the box."""
    x, y, w, h = box
    cx, cy = x + w / 2, y + h / 2
    dx, dy = tx - cx, ty - cy
    if dx == 0 and dy == 0:
        return cx, cy
    sx = (w / 2) / abs(dx) if dx else float("inf")
    sy = (h / 2) / abs(dy) if dy else float("inf")
    s = min(sx, sy)
    return cx + dx * s, cy + dy * s


def connect(svg, a, b, label=None, la=None, lb=None, dash=None, end=None, start=None, size=10, lab_off=(0, -4)):
    """Straight connector between two boxes, clipped at their borders, with optional labels."""
    ax, ay = a[0] + a[2] / 2, a[1] + a[3] / 2
    bx, by = b[0] + b[2] / 2, b[1] + b[3] / 2
    p1 = border_point(a, bx, by)
    p2 = border_point(b, ax, ay)
    svg.line(*p1, *p2, dash=dash, end=end, start=start)
    if label:
        mx, my = (p1[0] + p2[0]) / 2 + lab_off[0], (p1[1] + p2[1]) / 2 + lab_off[1]
        svg.rect(mx - tw(label, size) / 2 - 3, my - size, tw(label, size) + 6, size + 4, fill="white", stroke="white", sw=0)
        svg.text(mx, my, label, size=size, anchor="middle", italic=True, color="#4a5a50")
    for lab, p, q in ((la, p1, p2), (lb, p2, p1)):
        if lab:
            vx, vy = q[0] - p[0], q[1] - p[1]
            n = max((vx * vx + vy * vy) ** 0.5, 1)
            ox, oy = p[0] + vx / n * 16 - vy / n * 9, p[1] + vy / n * 16 + vx / n * 9
            svg.text(ox, oy + 4, lab, size=size, anchor="middle", bold=True, color="#4a5a50")
