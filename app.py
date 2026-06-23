"""
WorldQuant BRAIN – Flask JSON API
===================================
Local auth gate:  watty.s@outlook.com / 1234
WQ BRAIN creds:   stored in credentials.json (configure via /setup in the UI)

Dev:
    pip install flask flask-cors requests
    python app.py          # API on :5000
    cd frontend && npm run dev   # React on :5173 (proxies /api → :5000)
"""

import hashlib
import json
import time
from pathlib import Path

import requests as _requests
from flask import Flask, jsonify, request, session
from flask_cors import CORS
from wq_client import WQClient, WQAuthError, WQSimulationError

BASE_URL = "https://api.worldquantbrain.com"
CREDENTIALS_FILE = Path(__file__).parent / "credentials.json"

app = Flask(__name__, static_folder="frontend/dist", static_url_path="")
app.secret_key = "wq-brain-local-dev-secret-xK9mP2"
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SECURE"] = False
CORS(app, supports_credentials=True, origins=["http://localhost:5173", "http://localhost:5000"])

# In-memory simulation history (last 100 runs per server session)
_simulation_history = []

# ---------------------------------------------------------------------------
# Local auth users  (email → sha256(password))
# ---------------------------------------------------------------------------
_LOCAL_USERS = {
    "watty.s@outlook.com": hashlib.sha256(b"1234").hexdigest(),
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _err(msg: str, code: int = 400):
    return jsonify({"error": msg}), code


def _require_auth():
    if "email" not in session:
        return _err("Not authenticated.", 401)
    return None


def _get_wq_creds():
    if CREDENTIALS_FILE.exists():
        try:
            d = json.loads(CREDENTIALS_FILE.read_text())
            return d.get("email"), d.get("password")
        except Exception:
            pass
    return None, None


def _make_client():
    email, pw = _get_wq_creds()
    if not email or not pw:
        return None
    c = WQClient(email=email, password=pw)
    c._logged_in = True
    return c


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

@app.route("/api/me")
def me():
    if "email" not in session:
        return _err("Not authenticated.", 401)
    wq_email, _ = _get_wq_creds()
    return jsonify({"email": session["email"], "wq_configured": wq_email is not None})


@app.route("/api/login", methods=["POST"])
def login():
    body = request.get_json(force=True) or {}
    email = body.get("email", "").strip().lower()
    password = body.get("password", "").strip()

    if not email or not password:
        return _err("Email and password are required.")

    pw_hash = hashlib.sha256(password.encode()).hexdigest()
    if _LOCAL_USERS.get(email) != pw_hash:
        return _err("Invalid email or password.", 401)

    session.clear()
    session["email"] = email
    return jsonify({"ok": True})


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# WQ BRAIN credentials management
# ---------------------------------------------------------------------------

@app.route("/api/wq-credentials")
def wq_credentials_status():
    guard = _require_auth()
    if guard:
        return guard
    wq_email, _ = _get_wq_creds()
    return jsonify({"configured": wq_email is not None, "email": wq_email or ""})


@app.route("/api/wq-credentials", methods=["POST"])
def save_wq_credentials():
    guard = _require_auth()
    if guard:
        return guard
    body = request.get_json(force=True) or {}
    email = body.get("email", "").strip()
    password = body.get("password", "").strip()
    if not email or not password:
        return _err("WQ email and password are required.")

    CREDENTIALS_FILE.write_text(json.dumps({"email": email, "password": password}, indent=2))
    return jsonify({"ok": True})


@app.route("/api/wq-credentials", methods=["DELETE"])
def delete_wq_credentials():
    guard = _require_auth()
    if guard:
        return guard
    if CREDENTIALS_FILE.exists():
        CREDENTIALS_FILE.unlink()
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# Simulation history
# ---------------------------------------------------------------------------

@app.route("/api/history")
def get_history():
    guard = _require_auth()
    if guard:
        return guard
    return jsonify(list(reversed(_simulation_history[-100:])))


@app.route("/api/history", methods=["DELETE"])
def clear_history():
    guard = _require_auth()
    if guard:
        return guard
    _simulation_history.clear()
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# Dataset & field discovery
# ---------------------------------------------------------------------------

@app.route("/api/datasets")
def datasets():
    guard = _require_auth()
    if guard:
        return guard

    client = _make_client()
    if not client:
        return _err("WQ BRAIN credentials not configured. Visit /setup to add them.", 503)

    region   = request.args.get("region", "USA")
    universe = request.args.get("universe", "TOP3000")
    delay    = int(request.args.get("delay", 1))
    search   = request.args.get("search", "").strip().lower()

    try:
        results = client.get_datasets(region=region, universe=universe, delay=delay)
    except Exception as exc:
        return _err(str(exc))

    if search:
        results = [
            d for d in results
            if search in (d.get("id", "") + " " + d.get("name", "")).lower()
        ]

    return jsonify(results)


@app.route("/api/fields")
def fields():
    guard = _require_auth()
    if guard:
        return guard

    client = _make_client()
    if not client:
        return _err("WQ BRAIN credentials not configured. Visit /setup to add them.", 503)

    dataset_id = request.args.get("dataset_id", "").strip()
    region     = request.args.get("region", "USA")
    universe   = request.args.get("universe", "TOP3000")
    delay      = int(request.args.get("delay", 1))
    search     = request.args.get("search", "").strip().lower()

    if not dataset_id:
        return _err("dataset_id is required.")

    try:
        results = client.get_data_fields(
            dataset_id=dataset_id, region=region, universe=universe, delay=delay
        )
    except Exception as exc:
        return _err(str(exc))

    if search:
        results = [
            f for f in results
            if search in (f.get("id", "") + " " + f.get("description", "")).lower()
        ]

    return jsonify(results)


# ---------------------------------------------------------------------------
# Alpha simulation
# ---------------------------------------------------------------------------

@app.route("/api/simulate", methods=["POST"])
def simulate():
    guard = _require_auth()
    if guard:
        return guard

    client = _make_client()
    if not client:
        return _err("WQ BRAIN credentials not configured. Visit /setup to add them.", 503)

    body       = request.get_json(force=True) or {}
    expression = body.get("expression", "").strip()
    if not expression:
        return _err("expression is required.")

    region      = body.get("region", "USA")
    universe    = body.get("universe", "TOP3000")
    delay       = int(body.get("delay", 1))
    decay       = int(body.get("decay", 6))
    truncation  = float(body.get("truncation", 0.1))
    neutralization = body.get("neutralization", "SUBINDUSTRY")
    pasteurization = body.get("pasteurization", "ON")
    nan_handling   = body.get("nan_handling", "OFF")
    timeout        = int(body.get("timeout", 300))

    try:
        result = client.simulate_alpha(
            expression,
            region=region,
            universe=universe,
            delay=delay,
            decay=decay,
            truncation=truncation,
            neutralization=neutralization,
            pasteurization=pasteurization,
            nan_handling=nan_handling,
            timeout=timeout,
        )
    except (WQSimulationError, WQAuthError) as exc:
        return _err(str(exc))
    except Exception as exc:
        return _err(f"Unexpected error: {exc}")

    # Store in history
    _simulation_history.append({
        "id": len(_simulation_history) + 1,
        "timestamp": time.time(),
        "expression": expression,
        "region": region,
        "universe": universe,
        "delay": delay,
        "sharpe": result.get("sharpe"),
        "fitness": result.get("fitness"),
        "turnover": result.get("turnover"),
        "passed_checks": result.get("passed_checks"),
        "total_checks": result.get("total_checks"),
        "alpha_id": result.get("alpha_id"),
        "link": result.get("link"),
    })
    if len(_simulation_history) > 100:
        _simulation_history.pop(0)

    return jsonify(result)


# ---------------------------------------------------------------------------
# Market data  (Alpha Vantage — free API key, 25 req/day, no credit card)
# Get a free key at: https://www.alphavantage.co/support/#api-key
# ---------------------------------------------------------------------------

AV_KEY_FILE = Path(__file__).parent / "av_key.txt"
AV_BASE     = "https://www.alphavantage.co/query"

_PERIOD_TO_OUTPUT = {
    "1mo": "compact",  "3mo": "compact",
    "6mo": "compact",  "1y":  "full",
    "2y":  "full",     "5y":  "full",
}
_PERIOD_DAYS = {"1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730, "5y": 1825}


def _av_key():
    if AV_KEY_FILE.exists():
        k = AV_KEY_FILE.read_text().strip()
        if k:
            return k
    return None


def _av_get(params):
    key = _av_key()
    if not key:
        raise ValueError("Alpha Vantage API key not configured. Visit /setup to add it.")
    params["apikey"] = key
    r = _requests.get(AV_BASE, params=params, timeout=20)
    r.raise_for_status()
    data = r.json()
    if "Information" in data:
        raise ValueError(data["Information"])
    if "Note" in data:
        raise ValueError("Rate limit reached. Alpha Vantage free tier: 25 requests/day.")
    return data


@app.route("/api/market/av-key")
def get_av_key_status():
    guard = _require_auth()
    if guard:
        return guard
    return jsonify({"configured": _av_key() is not None})


@app.route("/api/market/av-key", methods=["POST"])
def save_av_key():
    guard = _require_auth()
    if guard:
        return guard
    body = request.get_json(force=True) or {}
    key  = body.get("key", "").strip()
    if not key:
        return _err("API key is required.")
    # Quick validation
    try:
        r = _requests.get(AV_BASE, params={"function": "GLOBAL_QUOTE", "symbol": "IBM", "apikey": key}, timeout=15)
        d = r.json()
        if "Global Quote" not in d:
            return _err(d.get("Information") or d.get("Note") or "Invalid key.")
    except Exception as exc:
        return _err(f"Could not verify key: {exc}")
    AV_KEY_FILE.write_text(key)
    return jsonify({"ok": True})


@app.route("/api/market/av-key", methods=["DELETE"])
def delete_av_key():
    guard = _require_auth()
    if guard:
        return guard
    if AV_KEY_FILE.exists():
        AV_KEY_FILE.unlink()
    return jsonify({"ok": True})


@app.route("/api/market/search")
def market_search():
    guard = _require_auth()
    if guard:
        return guard
    query = request.args.get("q", "").strip()
    if not query:
        return _err("q is required.")
    try:
        data = _av_get({"function": "SYMBOL_SEARCH", "keywords": query})
        out = [
            {
                "symbol":   m.get("1. symbol", ""),
                "name":     m.get("2. name", ""),
                "type":     m.get("3. type", ""),
                "exchange": m.get("4. region", ""),
            }
            for m in data.get("bestMatches", [])
            if m.get("1. symbol")
        ]
        return jsonify(out)
    except Exception as exc:
        return _err(str(exc))


@app.route("/api/market/quote")
def market_quote():
    guard = _require_auth()
    if guard:
        return guard
    symbol = request.args.get("symbol", "").strip().upper()
    if not symbol:
        return _err("symbol is required.")
    try:
        data  = _av_get({"function": "GLOBAL_QUOTE", "symbol": symbol})
        q     = data.get("Global Quote", {})
        if not q:
            return _err(f"No data found for '{symbol}'.", 404)

        price = float(q.get("05. price", 0) or 0)
        prev  = float(q.get("08. previous close", 0) or 0)
        chg   = float(q.get("09. change", 0) or 0)
        chg_p_raw = q.get("10. change percent", "0%").replace("%", "")
        chg_p = float(chg_p_raw or 0)

        # Fetch overview for fundamentals (best-effort)
        name = symbol
        sector = industry = summary = None
        market_cap = pe = eps = week52h = week52l = beta = div_yield = None
        try:
            ov = _av_get({"function": "OVERVIEW", "symbol": symbol})
            name       = ov.get("Name", symbol)
            sector     = ov.get("Sector") or None
            industry   = ov.get("Industry") or None
            summary    = ov.get("Description") or None
            market_cap = int(ov["MarketCapitalization"]) if ov.get("MarketCapitalization", "None") not in ("None", "", None) else None
            pe         = float(ov["TrailingPE"]) if ov.get("TrailingPE", "None") not in ("None", "", "-") else None
            eps        = float(ov["EPS"]) if ov.get("EPS", "None") not in ("None", "", "-") else None
            week52h    = float(ov["52WeekHigh"]) if ov.get("52WeekHigh", "None") not in ("None", "", "-") else None
            week52l    = float(ov["52WeekLow"]) if ov.get("52WeekLow", "None") not in ("None", "", "-") else None
            beta       = float(ov["Beta"]) if ov.get("Beta", "None") not in ("None", "", "-") else None
            div_yield  = float(ov["DividendYield"]) if ov.get("DividendYield", "None") not in ("None", "", "-", "0") else None
        except Exception:
            pass

        return jsonify({
            "symbol":              symbol,
            "name":                name,
            "price":               price,
            "previous_close":      prev,
            "change":              chg,
            "change_pct":          chg_p,
            "currency":            "USD",
            "exchange":            q.get("Exchange", ""),
            "market_cap":          market_cap,
            "volume":              int(q.get("06. volume", 0) or 0),
            "avg_volume":          None,
            "fifty_two_week_high": week52h,
            "fifty_two_week_low":  week52l,
            "pe_ratio":            pe,
            "forward_pe":          None,
            "eps":                 eps,
            "dividend_yield":      div_yield,
            "beta":                beta,
            "sector":              sector,
            "industry":            industry,
            "summary":             summary,
        })
    except Exception as exc:
        return _err(str(exc))


@app.route("/api/market/history")
def market_history():
    guard = _require_auth()
    if guard:
        return guard
    symbol = request.args.get("symbol", "").strip().upper()
    period = request.args.get("period", "6mo")
    if not symbol:
        return _err("symbol is required.")

    outputsize = _PERIOD_TO_OUTPUT.get(period, "compact")
    days_limit = _PERIOD_DAYS.get(period, 180)

    try:
        import datetime
        cutoff = datetime.date.today() - datetime.timedelta(days=days_limit)
        data   = _av_get({"function": "TIME_SERIES_DAILY", "symbol": symbol, "outputsize": outputsize})
        ts     = data.get("Time Series (Daily)", {})
        rows   = []
        for date_str in sorted(ts):
            if datetime.date.fromisoformat(date_str) < cutoff:
                continue
            d = ts[date_str]
            rows.append({
                "date":   date_str,
                "open":   float(d.get("1. open", 0)),
                "high":   float(d.get("2. high", 0)),
                "low":    float(d.get("3. low", 0)),
                "close":  float(d.get("4. close", 0)),
                "volume": int(d.get("5. volume", 0)),
            })
        return jsonify(rows)
    except Exception as exc:
        return _err(str(exc))


# ---------------------------------------------------------------------------
# Serve React SPA in production
# ---------------------------------------------------------------------------

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def spa(path):
    from flask import send_from_directory
    import os
    dist = os.path.join(app.root_path, "frontend", "dist")
    file_path = os.path.join(dist, path)
    if path and os.path.exists(file_path):
        return send_from_directory(dist, path)
    return send_from_directory(dist, "index.html")


if __name__ == "__main__":
    print("=" * 55)
    print("  WQ BRAIN UI  →  http://localhost:5000")
    print("  Local login  :  watty.s@outlook.com / 1234")
    print("=" * 55)
    app.run(debug=True, port=5000, threaded=True)
