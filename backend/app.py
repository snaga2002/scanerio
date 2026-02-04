import io
import re
import csv
import json
import sqlite3
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import BaseModel, Field
from openai import AzureOpenAI
import requests
import logging

# Optional libs (graceful degradation)
HAS_PDFMINER = False
HAS_PYTESS = False
HAS_BS4 = False
HAS_DOCX = False

try:
    from pdfminer.high_level import extract_text as pdf_extract_text
    HAS_PDFMINER = True
except Exception:
    pass

try:
    from PIL import Image
    import pytesseract
    HAS_PYTESS = True
except Exception:
    pass

try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except Exception:
    pass

try:
    from docx import Document
    HAS_DOCX = True
except Exception:
    pass

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app")

# =========================
# Configuration
# =========================

class Settings(BaseSettings):
    AZURE_OPENAI_KEY: str
    AZURE_OPENAI_ENDPOINT: str
    AZURE_OPENAI_CHAT_DEPLOYMENT: str
    FIGMA_TOKEN: Optional[str] = None
    OPENAI_API_VERSION: Optional[str] = "2024-02-15-preview"

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).with_name(".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

settings = Settings()

client = AzureOpenAI(
    api_key=settings.AZURE_OPENAI_KEY,
    api_version=settings.OPENAI_API_VERSION or "2024-02-15-preview",
    azure_endpoint=settings.AZURE_OPENAI_ENDPOINT
)

app = FastAPI(title="Figma → Test Scenario Generator (Grounded, Multi-format)")

# CORS (OK for local dev; tighten in prod)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# =========================
# SQLite (Feedback)
# =========================
DB_PATH = "feedback.db"
with sqlite3.connect(DB_PATH) as conn:
    conn.execute("""
      CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        correlation_id TEXT,
        rating INTEGER,             -- +1 or -1
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    """)
    conn.commit()

# =========================
# Figma helpers
# =========================
FIGMA_FILE_RE = re.compile(
    r"(?:https://)?(?:www\.)?figma\.com/(?:file|design|proto)/([a-zA-Z0-9]+)"
)

def is_figma_url(url: str) -> bool:
    return bool(FIGMA_FILE_RE.search(url or ""))

def extract_figma_key(url: str) -> Optional[str]:
    m = FIGMA_FILE_RE.search(url or "")
    return m.group(1) if m else None

def fetch_figma_file_json(file_key: str, figma_token: Optional[str]) -> Dict[str, Any]:
    if not figma_token:
        raise HTTPException(status_code=400, detail="FIGMA_TOKEN is not configured in the server.")
    headers = {"X-Figma-Token": figma_token}
    try:
        resp = requests.get(f"https://api.figma.com/v1/files/{file_key}", headers=headers, timeout=60)
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Figma API request failed: {e}")
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Figma API error: {resp.status_code} {resp.text}")
    return resp.json()

def flatten_figma_nodes(node: Dict[str, Any], path: str = "") -> List[Dict[str, Any]]:
    out = []
    current = {
        "name": node.get("name"),
        "type": node.get("type"),
        "path": path + "/" + (node.get("name") or ""),
        "chars": node.get("characters") if node.get("type") == "TEXT" else None,
        "reactions": node.get("reactions"),
        "layoutMode": node.get("layoutMode"),
    }
    out.append(current)
    for child in (node.get("children") or []):
        out.extend(flatten_figma_nodes(child, current["path"]))
    return out

def summarize_figma_structure(figma_json: Dict[str, Any]) -> str:
    document = figma_json.get("document") or {}
    nodes = flatten_figma_nodes(document)

    frames = [n for n in nodes if n["type"] == "FRAME"]
    components = [n for n in nodes if n["type"] in ("COMPONENT", "COMPONENT_SET", "INSTANCE")]
    texts = [n for n in nodes if n["type"] == "TEXT" and (n["chars"] or "").strip()]
    interactive = [n for n in nodes if n.get("reactions")]

    lines = []
    lines.append(f"Frames ({len(frames)}): " + ", ".join([f.get('name') or 'unnamed' for f in frames][:20]))
    lines.append(f"Components ({len(components)}): " + ", ".join([c.get('name') or 'unnamed' for c in components][:20]))
    lines.append("Sample text labels: " + "; ".join([(t.get('chars') or '').strip()[:80] for t in texts[:20]]))
    if interactive:
        lines.append(f"Prototype interactions found on {len(interactive)} nodes.")
    return "\n".join(lines)

# =========================
# File extraction
# =========================
MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB per file hard cap

def read_limited_bytes(fileobj, limit: int = MAX_FILE_BYTES) -> Tuple[bytes, bool]:
    data = fileobj.read(limit + 1)
    truncated = len(data) > limit
    if truncated:
        data = data[:limit]
    return data, truncated

def read_text_file(upload: UploadFile) -> Tuple[str, bool]:
    data, truncated = read_limited_bytes(upload.file)
    return data.decode("utf-8", errors="ignore"), truncated

def read_json_file(upload: UploadFile) -> Tuple[str, bool]:
    data, truncated = read_limited_bytes(upload.file)
    try:
        parsed = json.loads(data.decode("utf-8", errors="ignore"))
        return json.dumps(parsed, indent=2), truncated
    except Exception:
        return data.decode("utf-8", errors="ignore"), truncated

def read_pdf_file(upload: UploadFile) -> Tuple[str, bool]:
    if not HAS_PDFMINER:
        return "(pdfminer.six not installed) PDF text extraction disabled.", False
    content, truncated = read_limited_bytes(upload.file)
    with io.BytesIO(content) as bio:
        text = pdf_extract_text(bio) or ""
    if truncated:
        text += "\n...[PDF truncated]..."
    return text, truncated

def read_image_file(upload: UploadFile) -> Tuple[str, bool]:
    if not HAS_PYTESS:
        return "(pytesseract/Pillow not installed) Image OCR disabled.", False
    content, truncated = read_limited_bytes(upload.file)
    img = Image.open(io.BytesIO(content))
    text = pytesseract.image_to_string(img)
    if truncated:
        text += "\n...[Image truncated]..."
    return text, truncated

def read_csv_file(upload: UploadFile) -> Tuple[str, bool]:
    data, truncated = read_limited_bytes(upload.file)
    text = data.decode("utf-8", errors="ignore")
    if truncated:
        text += "\n...[CSV truncated]..."
    return text, truncated

def read_md_file(upload: UploadFile) -> Tuple[str, bool]:
    data, truncated = read_limited_bytes(upload.file)
    text = data.decode("utf-8", errors="ignore")
    if truncated:
        text += "\n...[Markdown truncated]..."
    return text, truncated

def read_html_file(upload: UploadFile) -> Tuple[str, bool]:
    data, truncated = read_limited_bytes(upload.file)
    html = data.decode("utf-8", errors="ignore")
    if truncated:
        html += "\n<!--[HTML truncated]-->"
    return html, truncated

def read_docx_file(upload: UploadFile) -> Tuple[str, bool]:
    if not HAS_DOCX:
        return "(python-docx not installed) DOCX extraction disabled.", False
    data, truncated = read_limited_bytes(upload.file)
    with io.BytesIO(data) as bio:
        doc = Document(bio)
        text = "\n".join([p.text for p in doc.paragraphs])
    if truncated:
        text += "\n...[DOCX truncated]..."
    return text, truncated

def extract_text_from_file(upload: UploadFile) -> Tuple[str, str]:
    """
    Returns (kind, text) where kind in
    {"txt","json","pdf","image","csv","md","html","docx","binary","error"}
    """
    filename = (upload.filename or "").lower()
    try:
        if filename.endswith(".txt"):
            text, truncated = read_text_file(upload)
            if truncated:
                text += "\n...[Text file truncated]..."
            return "txt", text

        if filename.endswith(".json"):
            text, truncated = read_json_file(upload)
            if truncated:
                text += "\n...[JSON file truncated]..."
            return "json", text

        if filename.endswith(".pdf"):
            text, _ = read_pdf_file(upload)
            return "pdf", text

        if filename.endswith((".png", ".jpg", ".jpeg")):
            text, _ = read_image_file(upload)
            return "image", text

        if filename.endswith(".csv"):
            text, _ = read_csv_file(upload)
            return "csv", text

        if filename.endswith((".md", ".markdown")):
            text, _ = read_md_file(upload)
            return "md", text

        if filename.endswith((".html", ".htm")):
            text, _ = read_html_file(upload)
            return "html", text

        if filename.endswith(".docx"):
            text, _ = read_docx_file(upload)
            return "docx", text

        data, truncated = read_limited_bytes(upload.file)
        try:
            text = data.decode("utf-8", errors="ignore")
            if truncated:
                text += "\n...[File truncated]..."
            return "txt", text
        except Exception:
            return "binary", ""
    except Exception as e:
        return "error", f"Failed to extract from {upload.filename}: {e}"

# =========================
# Evidence-only UI summarizers
# =========================

def summarize_ui_from_json(json_text: str, max_len: int = 5000) -> Optional[str]:
    try:
        data = json.loads(json_text)
    except Exception:
        return None

    fields = []

    def walk(node, path: str):
        if isinstance(node, dict):
            keys = set(node.keys())
            field_keys = {"label", "name", "placeholder", "required", "type", "validation", "pattern", "min", "max", "options", "minLength", "maxLength"}
            if keys & field_keys:
                fields.append({
                    "path": path,
                    "label": node.get("label") or node.get("name"),
                    "name": node.get("name"),
                    "type": node.get("type"),
                    "required": node.get("required"),
                    "placeholder": node.get("placeholder"),
                    "validation": node.get("validation") or node.get("pattern"),
                    "min": node.get("min") if "min" in node else node.get("minLength"),
                    "max": node.get("max") if "max" in node else node.get("maxLength"),
                    "options": node.get("options") if isinstance(node.get("options"), (list, tuple)) else None
                })
            for k, v in node.items():
                walk(v, f"{path}.{k}" if path else k)
        elif isinstance(node, list):
            for i, v in enumerate(node):
                walk(v, f"{path}[{i}]")

    walk(data, "")

    if not fields:
        return None

    lines = ["# JSON UI Summary (derived from file; no fabrication)"]
    for f in fields[:300]:
        parts = []
        if f["label"]:
            parts.append(f'Label="{f["label"]}"')
        if f["name"] and f["name"] != f["label"]:
            parts.append(f'Name="{f["name"]}"')
        if f["type"]:
            parts.append(f'Type={f["type"]}')
        if isinstance(f["required"], bool):
            parts.append("Required" if f["required"] else "Optional")
        if f["min"] is not None or f["max"] is not None:
            parts.append(f'Bounds=[{f["min"]},{f["max"]}]')
        if f["validation"]:
            parts.append(f'Validation="{f["validation"]}"')
        if f["options"]:
            opt_preview = ", ".join([str(o) for o in f["options"][:8]])
            if len(f["options"]) > 8:
                opt_preview += f" (+{len(f['options'])-8} more)"
            parts.append(f"Options=[{opt_preview}]")
        line = f"- {f['path']}: " + "; ".join(parts) if parts else f"- {f['path']}"
        lines.append(line)

    summary = "\n".join(lines)
    if len(summary) > max_len:
        summary = summary[:max_len] + "\n...[UI summary truncated]..."
    return summary

EMAIL_RE = re.compile(r"(^|[^a-zA-Z])email([^a-zA-Z]|$)", re.IGNORECASE)
PHONE_RE = re.compile(r"(^|[^a-zA-Z])phone([^a-zA-Z]|$)", re.IGNORECASE)
PASS_RE = re.compile(r"(^|[^a-zA-Z])password([^a-zA-Z]|$)", re.IGNORECASE)

def summarize_ui_from_csv(csv_text: str, max_len: int = 4000) -> Optional[str]:
    try:
        reader = csv.reader(io.StringIO(csv_text))
        rows = list(reader)
    except Exception:
        return None
    if not rows:
        return None
    headers = rows[0]
    sample = rows[1:26]
    col_types = []
    for idx, h in enumerate(headers):
        values = [r[idx] for r in sample if len(r) > idx]
        is_int = all(v.strip().isdigit() for v in values if v.strip() != "")
        is_float = all(re.match(r"^-?\d+(\.\d+)?$", v.strip() or "") for v in values if v.strip() != "")
        has_email = any(re.search(r"@.+\.", v) for v in values)
        has_phone = any(re.search(r"\+?\d[\d\s\-()]{6,}", v) for v in values)

        t = "string"
        if is_int: t = "integer"
        elif is_float: t = "number"
        if has_email: t = "email"
        if has_phone: t = "phone"
        col_types.append((h, t))

    lines = ["# CSV UI Summary (derived from columns; no fabrication)"]
    for h, t in col_types:
        parts = [f'Column="{h}"', f"Type={t}"]
        if "*" in h or "required" in h.lower() or "mandatory" in h.lower():
            parts.append("RequiredHint")
        if EMAIL_RE.search(h): parts.append("EmailLabelHint")
        if PASS_RE.search(h): parts.append("PasswordLabelHint")
        if PHONE_RE.search(h): parts.append("PhoneLabelHint")
        lines.append("- " + "; ".join(parts))

    summary = "\n".join(lines)
    if len(summary) > max_len:
        summary = summary[:max_len] + "\n...[CSV summary truncated]..."
    return summary

def summarize_ui_from_html(html_text: str, max_len: int = 6000) -> Optional[str]:
    if not HAS_BS4:
        return None
    try:
        soup = BeautifulSoup(html_text, "html.parser")
    except Exception:
        return None

    forms = soup.find_all("form")
    if not forms:
        return None

    def get_label_for(inp):
        lid = inp.get("id")
        if lid:
            lbl = soup.find("label", attrs={"for": lid})
            if lbl and lbl.get_text(strip=True):
                return lbl.get_text(strip=True)
        parent_label = inp.find_parent("label")
        if parent_label and parent_label.get_text(strip=True):
            return parent_label.get_text(strip=True)
        return None

    lines = ["# HTML UI Summary (derived from forms; no fabrication)"]
    for fi, form in enumerate(forms):
        lines.append(f"Form[{fi}]")
        for inp in form.find_all(["input", "textarea", "select"]):
            tag = inp.name
            itype = (inp.get("type") or "").lower() if tag == "input" else tag
            name = inp.get("name")
            req = True if inp.has_attr("required") else False
            pattern = inp.get("pattern")
            min_v = inp.get("min")
            max_v = inp.get("max")
            label = get_label_for(inp)
            parts = []
            if label: parts.append(f'Label="{label}"')
            if name: parts.append(f'Name="{name}"')
            if itype: parts.append(f'Type={itype}')
            parts.append("Required" if req else "Optional")
            if min_v or max_v: parts.append(f"Bounds=[{min_v},{max_v}]")
            if pattern: parts.append(f'Pattern="{pattern}"')
            if tag == "select":
                opts = [o.get_text(strip=True) for o in inp.find_all("option")]
                if opts:
                    preview = ", ".join(opts[:8]) + (f" (+{len(opts)-8} more)" if len(opts) > 8 else "")
                    parts.append(f"Options=[{preview}]")
            lines.append("- " + "; ".join(parts))
    summary = "\n".join(lines)
    if len(summary) > max_len:
        summary = summary[:max_len] + "\n...[HTML summary truncated]..."
    return summary

def summarize_ui_from_markdown(md_text: str, max_len: int = 4000) -> Optional[str]:
    lines_in = [ln.strip() for ln in md_text.splitlines()]
    items = []
    for ln in lines_in:
        if ":" in ln:
            k, v = [x.strip() for x in ln.split(":", 1)]
            if any(tok in k.lower() for tok in ["label", "field", "name"]):
                items.append((k, v))
        if "|" in ln and ln.count("|") >= 2 and not ln.lower().startswith("| ---"):
            items.append(("table_row", ln))
    if not items:
        return None
    out = ["# Markdown UI Summary (derived from text/table; no fabrication)"]
    for k, v in items[:200]:
        out.append(f"- {k}: {v}")
    summary = "\n".join(out)
    if len(summary) > max_len:
        summary = summary[:max_len] + "\n...[Markdown summary truncated]..."
    return summary

def summarize_ui_from_text(text: str, max_len: int = 3000) -> Optional[str]:
    hits = []
    for ln in text.splitlines():
        if EMAIL_RE.search(ln) or PASS_RE.search(ln) or PHONE_RE.search(ln):
            hits.append(ln.strip())
    if not hits:
        return None
    out = ["# Text UI Summary (keyword matches; no fabrication)"]
    for h in hits[:200]:
        out.append(f"- {h}")
    summary = "\n".join(out)
    if len(summary) > max_len:
        summary = summary[:max_len] + "\n...[Text summary truncated]..."
    return summary

# =========================
# Prompting & LLM Call (Grounded)
# =========================

SYSTEM_PROMPT = """You are Senior QA Engineer AI.

Your mission:
- Generate *original* test artifacts from provided product context (Figma summary, free text, uploaded files).
- **Ground every detail in the evidence**. Do not fabricate labels, fields, pages, flows, or behaviors.

Absolute rules (no exceptions):
- Never assume navigation, validation, error messages, submission, or search/filter behaviors unless explicitly present in the evidence (e.g., reactions, destination, required, pattern, min/max, debounce).
- Do not assert outcomes such as “navigates”, “filters”, “shows validation”, or “triggers login” without explicit evidence.
- When behavior is unknown, use phrasing like “outcome is not specified in the evidence” and/or populate `insufficient_context`.
- Be specific with labels/selectors only if present verbatim in the evidence.

Output format:
Return **strict JSON** with these keys:
- navigation_scenarios: array of {id, title, steps[], expected_results[]}
- form_scenarios: array of {id, title, steps[], expected_results[], validations[]}
- edge_cases: array of {id, title, steps[], expected_results[]}
- user_stories: array of {id, as_a, i_want, so_that, acceptance_criteria[]}
- gherkin: array of strings (each a Gherkin Scenario or Scenario Outline)
- insufficient_context: optional object { reasons: string[], missing_evidence: string[] }

Derive scenarios strictly from the evidence (Figma summary, JSON/CSV/HTML/Markdown/Text/PDF/OCR). Include validations/boundaries/accessibility only if justified by evidence. If evidence is insufficient, keep arrays minimal and set `insufficient_context` with clear reasons and missing data.
"""

def get_feedback_summary(max_items: int = 5) -> str:
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute("SELECT rating, comment FROM feedback ORDER BY id DESC LIMIT 100")
        rows = cur.fetchall()

    if not rows:
        return "No prior feedback."

    positives = [c for r, c in rows if r == 1 and c]
    negatives = [c for r, c in rows if r == -1 and c]

    def top_samples(comments: List[str]) -> List[str]:
        uniq = []
        for c in comments:
            c = (c or "").strip()
            if c and c not in uniq:
                uniq.append(c)
            if len(uniq) >= max_items:
                break
        return uniq

    pos = top_samples(positives)
    neg = top_samples(negatives)

    summary = []
    if pos:
        summary.append("Users liked:")
        summary.extend([f"- {p}" for p in pos])
    if neg:
        summary.append("Users disliked:")
        summary.extend([f"- {n}" for n in neg])
    return "\n".join(summary) or "No prior feedback."

def build_user_context(
    free_text: Optional[str],
    url: Optional[str],
    file_texts: List[Tuple[str, str]],
    figma_summary: Optional[str],
    feedback_summary: str,
    ui_summaries: Optional[List[str]] = None
) -> str:
    parts = []
    if free_text:
        parts.append(f"# User Text\n{free_text}")
    if url:
        parts.append(f"# URL\n{url}")
    if figma_summary:
        parts.append(f"# Figma Summary\n{figma_summary}")

    for s in (ui_summaries or []):
        parts.append(s)

    for kind, text in file_texts:
        snippet = (text or "").strip()
        if len(snippet) > 6000:
            snippet = snippet[:6000] + "\n...[truncated]..."
        parts.append(f"# File ({kind})\n{snippet}")
    parts.append(f"# Feedback Hints\n{feedback_summary}")

    ctx = "\n\n".join(parts)
    max_chars = 22000
    return ctx[:max_chars]

def call_azure_openai(context_text: str) -> Dict[str, Any]:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": context_text},
    ]
    resp = client.chat.completions.create(
        model=settings.AZURE_OPENAI_CHAT_DEPLOYMENT,
        temperature=0.2,
        max_tokens=3000,
        messages=messages,
        response_format={"type": "json_object"}
    )
    content = resp.choices[0].message.content
    try:
        return json.loads(content)
    except Exception:
        m = re.search(r"\{[\s\S]*\}", content or "")
        if not m:
            return {"error": "Model did not return valid JSON", "raw": content}
        try:
            return json.loads(m.group(0))
        except Exception as e:
            return {"error": f"JSON parse failed: {e}", "raw": content}

# =========================
# Evidence flags & sanitization (guarantee 100% grounded output)
# =========================

NAV_PHRASES = [
    "navigates to", "should be navigated", "navigated to", "navigate to",
    "redirects to", "route to", "opens the projects page", "takes the user to"
]
VALIDATION_PHRASES = [
    "validation message", "validation error", "prevents login",
    "invalid", "required", "must enter", "error is shown", "shows error"
]
SEARCH_PHRASES = [
    "filters", "updates the list", "search results", "results update", "shows matching"
]

def compute_evidence_flags(context_text: str) -> Dict[str, bool]:
    has_nav = re.search(r"\b(reactions?|destination|navigate|onClick)\b", context_text, re.IGNORECASE) is not None
    has_validation = re.search(r"\b(required|pattern|minLength|maxLength|validation)\b", context_text, re.IGNORECASE) is not None
    # Optional: only treat "search behavior" as evidenced when we have signals beyond just placeholder text
    has_search_behavior = re.search(r"\b(debounce|filter|results|list|search results)\b", context_text, re.IGNORECASE) is not None
    return {
        "has_nav": has_nav,
        "has_validation": has_validation,
        "has_search_behavior": has_search_behavior
    }

def _line_is_speculative(line: str, phrases: List[str]) -> bool:
    l = (line or "").lower()
    return any(p in l for p in phrases)

def sanitize_items(items: List[Dict[str, Any]], flags: Dict[str, bool]) -> List[Dict[str, Any]]:
    if not isinstance(items, list):
        return []
    out = []
    for it in items:
        if not isinstance(it, dict):
            continue
        exp = []
        for line in (it.get("expected_results") or []):
            replaced = False
            if not flags.get("has_nav") and _line_is_speculative(line, NAV_PHRASES):
                exp.append("Outcome is not specified in the evidence")
                replaced = True
            if not replaced and not flags.get("has_validation") and _line_is_speculative(line, VALIDATION_PHRASES):
                exp.append("Outcome is not specified in the evidence")
                replaced = True
            if not replaced and not flags.get("has_search_behavior") and _line_is_speculative(line, SEARCH_PHRASES):
                exp.append("Outcome is not specified in the evidence")
                replaced = True
            if not replaced:
                exp.append(line)
        it["expected_results"] = exp
        out.append(it)
    return out

def sanitize_user_stories(stories: List[Dict[str, Any]], flags: Dict[str, bool]) -> List[Dict[str, Any]]:
    if not isinstance(stories, list):
        return []
    out = []
    for s in stories:
        if not isinstance(s, dict):
            continue
        ac_new = []
        for ac in (s.get("acceptance_criteria") or []):
            replaced = False
            if not flags.get("has_nav") and _line_is_speculative(ac, NAV_PHRASES):
                ac_new.append("Outcome is not specified in the evidence")
                replaced = True
            if not replaced and not flags.get("has_validation") and _line_is_speculative(ac, VALIDATION_PHRASES):
                ac_new.append("Outcome is not specified in the evidence")
                replaced = True
            if not replaced and not flags.get("has_search_behavior") and _line_is_speculative(ac, SEARCH_PHRASES):
                ac_new.append("Outcome is not specified in the evidence")
                replaced = True
            if not replaced:
                ac_new.append(ac)
        s["acceptance_criteria"] = ac_new
        out.append(s)
    return out

def sanitize_gherkin(gherkin_list: List[str], flags: Dict[str, bool]) -> List[str]:
    if not isinstance(gherkin_list, list):
        return []
    out = []
    for block in gherkin_list:
        text = block or ""
        # If behavior not evidenced, neutralize speculative steps
        if not flags.get("has_nav"):
            for phrase in NAV_PHRASES:
                text = re.sub(re.escape(phrase), "outcome is not specified in the evidence", text, flags=re.IGNORECASE)
        if not flags.get("has_validation"):
            for phrase in VALIDATION_PHRASES:
                text = re.sub(re.escape(phrase), "outcome is not specified in the evidence", text, flags=re.IGNORECASE)
        if not flags.get("has_search_behavior"):
            for phrase in SEARCH_PHRASES:
                text = re.sub(re.escape(phrase), "outcome is not specified in the evidence", text, flags=re.IGNORECASE)
        out.append(text)
    return out

def normalize_scenarios(raw: Dict[str, Any], flags: Dict[str, bool]) -> Dict[str, Any]:
    def arr(x): return x if isinstance(x, list) else []
    nav = sanitize_items(arr(raw.get("navigation_scenarios")), flags)
    forms = sanitize_items(arr(raw.get("form_scenarios")), flags)
    edges = sanitize_items(arr(raw.get("edge_cases")), flags)
    stories = sanitize_user_stories(arr(raw.get("user_stories")), flags)
    gherkin = sanitize_gherkin(arr(raw.get("gherkin")), flags)
    insufficient = raw.get("insufficient_context") if isinstance(raw.get("insufficient_context"), dict) else None
    return {
        "navigation_scenarios": nav,
        "form_scenarios": forms,
        "edge_cases": edges,
        "user_stories": stories,
        "gherkin": gherkin,
        "insufficient_context": insufficient
    }

def all_sections_empty(scenarios: Dict[str, Any]) -> bool:
    return not any([
        scenarios.get("navigation_scenarios"),
        scenarios.get("form_scenarios"),
        scenarios.get("edge_cases"),
        scenarios.get("user_stories"),
        scenarios.get("gherkin"),
    ])

# =========================
# API Schemas
# =========================

class Scenarios(BaseModel):
    navigation_scenarios: List[Dict[str, Any]] = Field(default_factory=list)
    form_scenarios: List[Dict[str, Any]] = Field(default_factory=list)
    edge_cases: List[Dict[str, Any]] = Field(default_factory=list)
    user_stories: List[Dict[str, Any]] = Field(default_factory=list)
    gherkin: List[str] = Field(default_factory=list)
    insufficient_context: Optional[Dict[str, Any]] = None

class GenerateResponse(BaseModel):
    correlation_id: Optional[str] = None
    scenarios: Dict[str, Any]

class FeedbackRequest(BaseModel):
    correlation_id: Optional[str] = None
    rating: int   # +1 or -1
    comment: Optional[str] = None

# =========================
# Routes (UI + API)
# =========================

@app.get("/", response_class=HTMLResponse)
def index():
    html = """
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Figma → Test Scenario Generator</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
:root{--bg:#0d1117;--panel:#161b22;--text:#e6edf3;--muted:#8b949e;--primary:#2f81f7;--accent:#0aa370;--danger:#e5534b;--border:#30363d}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--text);font-family:Segoe UI,Roboto,Arial;margin:0}
.container{max-width:1100px;margin:24px auto;padding:0 16px}
.panel{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:16px}
.header{display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap}
.header h1{font-size:20px;margin:0}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:900px){.form-grid{grid-template-columns:1fr}}
textarea,input[type=text]{width:100%;background:#0b0f14;color:var(--text);border:1px solid var(--border);border-radius:8px;padding:10px}
.button-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px}
button{background:var(--primary);border:none;color:#fff;padding:10px 14px;border-radius:8px;cursor:pointer}
button.secondary{background:#3a3f46}
button.danger{background:var(--danger)}
button:disabled{opacity:.6;cursor:not-allowed}
.dropzone{background:#0b0f14;border:1px dashed var(--border);padding:18px;border-radius:8px;color:var(--muted);text-align:center;cursor:pointer}
.alert{margin-top:10px;color:var(--danger)}
.tabs{margin-top:20px}
.tabbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.tabbar button{background:#2b3138}
.tabbar button.active{background:var(--accent)}
.list{display:grid;gap:14px;padding-left:16px}
.list h4{margin:0 0 8px}
.list h5{margin:10px 0 6px}
.muted{color:var(--muted)}
.json-actions{display:flex;gap:8px;margin-bottom:8px}
.json-pre,.gherkin-pre{background:#0b0f14;padding:12px;border-radius:8px;border:1px solid var(--border);overflow-x:auto;white-space:pre-wrap}
.spinner{display:inline-block}
.spinner>div{width:10px;height:10px;background-color:var(--primary);border-radius:100%;display:inline-block;animation:sk-bouncedelay 1.4s infinite ease-in-out both;margin:0 2px}
.spinner .b1{animation-delay:-.32s}.spinner .b2{animation-delay:-.16s}
@keyframes sk-bouncedelay{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}
.banner{border:1px solid #8b949e;background:#0b0f14;color:#e6edf3;padding:12px;border-radius:8px;margin-bottom:12px}
.proc{color:#8b949e;font-size:13px}
</style>
</head>
<body>
<div class="container">
  <div class="panel">
    <div class="header">
      <h1>Figma → Test Scenario Generator</h1>
      <div id="spinner" class="spinner" style="display:none"><div class="b1"></div><div class="b2"></div><div class="b3"></div></div>
      <div id="processingMsg" class="proc" style="display:none;"></div>
    </div>

    <div class="form-grid">
      <div>
        <label>Free Text Context</label>
        <textarea id="txt" rows="8" placeholder="Describe the flow, forms, roles, constraints..."></textarea>
      </div>
      <div>
        <label>URL (supports Figma file/design/proto URL)</label>
        <input id="url" type="text" placeholder="https://www.figma.com/file/XXXX/Project..."/>
        <div style="height:12px"></div>
        <div id="drop" class="dropzone" tabindex="0" role="button">Drop files here or click to browse (.txt, .json, .csv, .html, .md, .pdf, .png, .jpg, .docx)</div>
        <input id="fileInput" type="file" multiple accept=".txt,.json,.csv,.html,.htm,.md,.pdf,.png,.jpg,.jpeg,.docx" style="display:none"/>
        <div id="fileInfo" class="muted" style="margin-top:8px"></div>
      </div>
    </div>

    <div class="button-row">
      <button id="genBtn">Generate Scenarios</button>
      <button class="secondary" id="resetBtn">Reset</button>
      <button id="upBtn" style="display:none">👍 Helpful</button>
      <button class="danger" id="downBtn" style="display:none">👎 Not helpful</button>
    </div>

    <div id="err" class="alert" style="display:none"></div>

    <div class="tabs" id="tabs" style="display:none">
      <div class="tabbar">
        <button data-tab="navigation" class="active">Navigation</button>
        <button data-tab="forms">Forms</button>
        <button data-tab="edge">Edge Cases</button>
        <button data-tab="stories">User Stories</button>
        <button data-tab="gherkin">Gherkin</button>
        <button data-tab="raw">Raw JSON</button>
      </div>
      <div class="tabcontent">
        <div id="tab-navigation"></div>
        <div id="tab-forms" style="display:none"></div>
        <div id="tab-edge" style="display:none"></div>
        <div id="tab-stories" style="display:none"></div>
        <div id="tab-gherkin" style="display:none"></div>
        <div id="tab-raw" style="display:none"></div>
      </div>
    </div>
  </div>
</div>

<script>
(() => {
  const txt = document.getElementById('txt');
  const url = document.getElementById('url');
  const drop = document.getElementById('drop');
  const fileInput = document.getElementById('fileInput');
  const fileInfo = document.getElementById('fileInfo');
  const genBtn = document.getElementById('genBtn');
  const resetBtn = document.getElementById('resetBtn');
  const err = document.getElementById('err');
  const tabs = document.getElementById('tabs');
  const upBtn = document.getElementById('upBtn');
  const downBtn = document.getElementById('downBtn');
  const spinner = document.getElementById('spinner');
  const processingMsg = document.getElementById('processingMsg');

  let files = [];
  let correlationId = null;
  let lastResult = null;

  function newCorrelationId(){ return 'run-' + Date.now(); }
  function setBusy(b){
    spinner.style.display = b ? 'inline-block' : 'none';
    processingMsg.style.display = b ? 'block' : 'none';
    genBtn.disabled = b; resetBtn.disabled = b; upBtn.disabled = b; downBtn.disabled = b;
  }
  function setError(message){
    if(!message){ err.style.display='none'; err.textContent=''; return; }
    err.style.display='block'; err.textContent = message;
  }
  function updateFileInfo(){
    fileInfo.textContent = files.length ? ('Files selected ('+files.length+'): ' + files.map(f=>f.name).join(', ')) : '';
  }

  drop.addEventListener('click', () => fileInput.click());
  drop.addEventListener('dragover', e => { e.preventDefault(); });
  drop.addEventListener('drop', e => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files || []);
    files = files.concat(dropped);
    updateFileInfo();
  });
  fileInput.addEventListener('change', e => {
    const picked = Array.from(e.target.files || []);
    files = files.concat(picked);
    updateFileInfo();
  });

  function showTabs(show){
    tabs.style.display = show ? 'block' : 'none';
    upBtn.style.display = show ? 'inline-block' : 'none';
    downBtn.style.display = show ? 'inline-block' : 'none';
  }

  function renderList(containerId, items){
    const el = document.getElementById(containerId);
    el.innerHTML = '';
    if(!items || !items.length){
      el.innerHTML = '<p class="muted">No items.</p>';
      return;
    }
    const ul = document.createElement('ul'); ul.className = 'list';
    items.forEach(it => {
      const li = document.createElement('li');
      const h4 = document.createElement('h4');
      const title = (it.title ? (it.id ? it.id + ': ' + it.title : it.title) : (it.id || ''));
      h4.textContent = title; li.appendChild(h4);

      if(it.as_a){
        const p = document.createElement('p');
        p.innerHTML = `<b>As a</b> ${it.as_a}, <b>I want</b> ${it.i_want}, <b>so that</b> ${it.so_that}.`;
        li.appendChild(p);
      }

      if(it.steps && it.steps.length){
        const h5 = document.createElement('h5'); h5.textContent='Steps'; li.appendChild(h5);
        const ol = document.createElement('ol');
        it.steps.forEach(s => { const li2 = document.createElement('li'); li2.textContent = s; ol.appendChild(li2); });
        li.appendChild(ol);
      }

      if(it.expected_results && it.expected_results.length){
        const h5 = document.createElement('h5'); h5.textContent='Expected'; li.appendChild(h5);
        const ul2 = document.createElement('ul');
        it.expected_results.forEach(s => { const li2 = document.createElement('li'); li2.textContent = s; ul2.appendChild(li2); });
        li.appendChild(ul2);
      }

      if(it.validations && it.validations.length){
        const h5 = document.createElement('h5'); h5.textContent='Validations'; li.appendChild(h5);
        const ul2 = document.createElement('ul');
        it.validations.forEach(s => { const li2 = document.createElement('li'); li2.textContent = s; ul2.appendChild(li2); });
        li.appendChild(ul2);
      }

      if(it.acceptance_criteria && it.acceptance_criteria.length){
        const h5 = document.createElement('h5'); h5.textContent='Acceptance Criteria'; li.appendChild(h5);
        const ul2 = document.createElement('ul');
        it.acceptance_criteria.forEach(s => { const li2 = document.createElement('li'); li2.textContent = s; ul2.appendChild(li2); });
        li.appendChild(ul2);
      }

      ul.appendChild(li);
    });
    el.appendChild(ul);
  }

  function renderGherkin(containerId, arr){
    const el = document.getElementById(containerId);
    el.innerHTML = '';
    if(!arr || !arr.length){
      el.innerHTML = '<p class="muted">No Gherkin provided.</p>';
      return;
    }
    const pre = document.createElement('pre');
    pre.className='gherkin-pre';
    pre.textContent = arr.join('\\n\\n');
    el.appendChild(pre);
  }

  function renderRaw(containerId, data){
    const el = document.getElementById(containerId);
    el.innerHTML = '';
    const div = document.createElement('div');
    div.className='json-actions';
    const copyBtn = document.createElement('button'); copyBtn.textContent='Copy JSON';
    copyBtn.onclick = async () => { await navigator.clipboard.writeText(JSON.stringify(data,null,2)); alert('JSON copied'); };
    const dlBtn = document.createElement('button'); dlBtn.textContent='Download JSON';
    dlBtn.onclick = () => {
      const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = 'scenarios.json'; a.click(); URL.revokeObjectURL(url);
    };
    div.appendChild(copyBtn); div.appendChild(dlBtn);
    const pre = document.createElement('pre'); pre.className='json-pre'; pre.textContent = JSON.stringify(data,null,2);
    el.appendChild(div); el.appendChild(pre);
  }

  function renderInsufficient(data){
    const container = document.getElementById('tab-navigation');
    const info = data?.insufficient_context;
    if(!info) return;
    const box = document.createElement('div');
    box.className = 'banner';
    const title = document.createElement('div');
    title.innerHTML = '<b>Insufficient context</b> — the model avoided fabricating details.';
    const reasons = (info.reasons || []).map(r => `<li>${r}</li>`).join('');
    const missing = (info.missing_evidence || []).map(r => `<li>${r}</li>`).join('');
    const body = document.createElement('div');
    body.innerHTML = `
      ${reasons ? '<div><b>Reasons:</b><ul>'+reasons+'</ul></div>' : ''}
      ${missing ? '<div><b>Missing evidence to proceed:</b><ul>'+missing+'</ul></div>' : ''}
    `;
    box.appendChild(title);
    box.appendChild(body);
    container.prepend(box);
  }

  function switchTab(key){
    const idMap = {
      navigation:'tab-navigation',
      forms:'tab-forms',
      edge:'tab-edge',
      stories:'tab-stories',
      gherkin:'tab-gherkin',
      raw:'tab-raw'
    };
    Object.keys(idMap).forEach(k => {
      const btn = document.querySelector('.tabbar button[data-tab="'+k+'"]');
      if(btn) btn.classList.toggle('active', k===key);
      const pane = document.getElementById(idMap[k]);
      if(pane) pane.style.display = (k===key) ? 'block' : 'none';
    });
  }
  document.querySelectorAll('.tabbar button').forEach(b => {
    b.addEventListener('click', () => switchTab(b.getAttribute('data-tab')));
  });

  function buildProcessingText(hasText, hasURL, hasFiles){
    const parts = [];
    if (hasText) parts.push("text");
    if (hasURL) parts.push("URL");
    if (hasFiles) parts.push("files");
    let what = "";
    if (parts.length === 1) {
      what = parts[0];
    } else if (parts.length === 2) {
      what = parts[0] + " and " + parts[1];
    } else if (parts.length === 3) {
      what = parts[0] + ", " + parts[1] + ", and " + parts[2];
    } else {
      what = "input";
    }
    return `Processing your ${what}… AI is generating the best possible output.`;
  }

  async function generate(){
    setError(null);
    const textVal = (txt.value||'').trim();
    const urlVal = (url.value||'').trim();
    const hasText = !!textVal;
    const hasURL = !!urlVal;
    const hasFiles = files.length > 0;
    processingMsg.textContent = buildProcessingText(hasText, hasURL, hasFiles);
    setBusy(true);
    showTabs(false);
    correlationId = newCorrelationId();

    try{
      const form = new FormData();
      if(hasText) form.append('text', textVal);
      if(hasURL) form.append('url', urlVal);
      if(correlationId) form.append('correlation_id', correlationId);
      files.forEach(f => form.append('files', f, f.name));

      const res = await fetch('/generate-scenarios', { method:'POST', body:form });
      if(!res.ok){
        const msg = await res.text();
        throw new Error('Generate failed: ' + res.status + ' ' + msg);
      }
      const data = await res.json();
      lastResult = data.scenarios || null;

      renderList('tab-navigation', lastResult?.navigation_scenarios);
      renderInsufficient(lastResult);
      renderList('tab-forms', lastResult?.form_scenarios);
      renderList('tab-edge', lastResult?.edge_cases);
      renderList('tab-stories', lastResult?.user_stories);
      renderGherkin('tab-gherkin', lastResult?.gherkin);
      renderRaw('tab-raw', lastResult || {});

      switchTab('navigation');
      showTabs(true);
    }catch(e){
      setError(e.message || 'Generation failed');
    }finally{
      setBusy(false);
    }
  }

  async function sendFeedback(rating){
    const comment = prompt('Optional comment? (Cancel to skip)') || undefined;
    try{
      const res = await fetch('/feedback', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ correlation_id: correlationId || undefined, rating, comment })
      });
      if(!res.ok) throw new Error('Feedback failed: ' + res.status);
      alert('Thanks for your feedback!');
    }catch(e){
      alert(e.message || 'Feedback failed');
    }
  }

  genBtn.addEventListener('click', generate);
  resetBtn.addEventListener('click', () => {
    txt.value=''; url.value=''; files=[]; updateFileInfo(); setError(null); showTabs(false); processingMsg.style.display='none';
  });
  upBtn.addEventListener('click', () => sendFeedback(1));
  downBtn.addEventListener('click', () => sendFeedback(-1));
})();
</script>
</body>
</html>
    """
    return HTMLResponse(html)

@app.post("/generate-scenarios")
async def generate_scenarios(
    text: Optional[str] = Form(default=None),
    url: Optional[str] = Form(default=None),
    files: Optional[List[UploadFile]] = File(default=None),
    correlation_id: Optional[str] = Form(default=None)
):
    # Gather file texts + build UI summaries per kind (evidence-only)
    file_texts: List[Tuple[str, str]] = []
    ui_summaries: List[str] = []

    if files:
        for f in files:
            kind, extracted = extract_text_from_file(f)
            if extracted:
                file_texts.append((kind, extracted))
                try:
                    if kind == "json":
                        s = summarize_ui_from_json(extracted)
                        if s: ui_summaries.append(s)
                    elif kind == "csv":
                        s = summarize_ui_from_csv(extracted)
                        if s: ui_summaries.append(s)
                    elif kind == "html":
                        s = summarize_ui_from_html(extracted)
                        if s: ui_summaries.append(s)
                    elif kind == "md":
                        s = summarize_ui_from_markdown(extracted)
                        if s: ui_summaries.append(s)
                    elif kind in ("txt", "docx", "pdf", "image"):
                        s = summarize_ui_from_text(extracted)
                        if s: ui_summaries.append(s)
                except Exception as ex:
                    logger.warning("Summarizer error for %s: %s", kind, ex)
            elif kind == "error":
                file_texts.append((kind, extracted))

    # If Figma URL provided, summarize structure
    figma_summary = None
    if url and is_figma_url(url):
        key = extract_figma_key(url)
        if key:
            try:
                figma_json = fetch_figma_file_json(key, settings.FIGMA_TOKEN)
                figma_summary = summarize_figma_structure(figma_json)
            except HTTPException as he:
                raise he
            except Exception as e:
                raise HTTPException(status_code=502, detail=f"Could not process Figma file: {e}")

    # Feedback hints
    fb_summary = get_feedback_summary()

    # Build prompt + call model
    context_text = build_user_context(text, url, file_texts, figma_summary, fb_summary, ui_summaries=ui_summaries)
    logger.info("Context length=%d\n%s", len(context_text), context_text[:2000])

    # Compute evidence flags (used to sanitize model output)
    flags = compute_evidence_flags(context_text)

    raw = call_azure_openai(context_text)

    # Validate/normalize + sanitize so the UI does not crash and stays grounded
    coerced = normalize_scenarios(raw if isinstance(raw, dict) else {}, flags=flags)
    try:
        scenarios = Scenarios(**coerced).model_dump()
    except Exception:
        scenarios = Scenarios().model_dump()
        scenarios["raw_model_output"] = raw  # include raw for debugging

    # Attach raw + context preview when everything is empty, to aid debugging
    if all_sections_empty(scenarios) and "raw_model_output" not in scenarios:
        scenarios["raw_model_output"] = raw
        scenarios["_debug_context_preview"] = context_text[:1200]

    return JSONResponse(content=GenerateResponse(correlation_id=correlation_id, scenarios=scenarios).model_dump())

@app.post("/feedback")
async def feedback(payload: FeedbackRequest):
    if payload.rating not in (-1, 1):
        raise HTTPException(status_code=400, detail="rating must be +1 or -1")
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "INSERT INTO feedback (correlation_id, rating, comment) VALUES (?,?,?)",
            (payload.correlation_id, payload.rating, payload.comment)
        )
        conn.commit()
    return {"status": "ok"}

@app.get("/healthz")
def healthz():
    return {"status": "ok"}

@app.get("/health/aoai")
def health_aoai():
    try:
        resp = client.chat.completions.create(
            model=settings.AZURE_OPENAI_CHAT_DEPLOYMENT,
            temperature=0,
            max_tokens=5,
            messages=[
                {"role": "system", "content": "You are health check."},
                {"role": "user", "content": "respond with {}"}
            ],
            response_format={"type": "json_object"}
        )
        _ = resp.choices[0].message.content
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AOAI health failed: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)