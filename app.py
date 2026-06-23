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
