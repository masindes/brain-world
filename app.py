"""
WorldQuant BRAIN – Flask JSON API
===================================
Serves the React frontend in production and exposes /api/* endpoints.

Dev:
    pip install flask flask-cors requests
    python app.py          # API on :5000
    cd frontend && npm run dev   # React on :5173 (proxies /api → :5000)
"""

import requests as _requests
from flask import Flask, jsonify, request, session
from flask_cors import CORS
from wq_client import WQClient, WQAuthError, WQSimulationError

BASE_URL = "https://api.worldquantbrain.com"

app = Flask(__name__, static_folder="frontend/dist", static_url_path="")
app.secret_key = "wq-brain-local-dev-secret"
CORS(app, supports_credentials=True)


# ------------------------------------------------------------------ #
# Helpers
# ------------------------------------------------------------------ #

def _make_client():
    email = session.get("email")
    password = session.get("password")
    if not email or not password:
        return None
    c = WQClient(email=email, password=password)
    c._logged_in = True
    return c


def _err(msg, code=400):
    return jsonify({"error": msg}), code


def _require_auth():
    if "email" not in session:
        return _err("Not authenticated.", 401)
    return None


# ------------------------------------------------------------------ #
# Auth endpoints
# ------------------------------------------------------------------ #

@app.route("/api/me")
def me():
    if "email" not in session:
        return _err("Not authenticated.", 401)
    return jsonify({"email": session["email"]})


@app.route("/api/login", methods=["POST"])
def login():
    body = request.get_json(force=True) or {}
    email = body.get("email", "").strip()
    password = body.get("password", "").strip()

    if not email or not password:
        return _err("Email and password are required.")

    s = _requests.Session()
    s.auth = (email, password)

    try:
        resp = s.post(f"{BASE_URL}/authentication", timeout=20)
        data = resp.json()
    except Exception as exc:
        return _err(f"Request failed: {exc}")

    if "user" in data:
        session.clear()
        session["email"] = email
        session["password"] = password
        return jsonify({"ok": True})

    if "inquiry" in data:
        persona_url = f"{resp.url}/persona?inquiry={data['inquiry']}"
        # Stash pending credentials so /api/login/verify can retry
        session["pending_email"] = email
        session["pending_password"] = password
        session["pending_inquiry"] = data["inquiry"]
        session["pending_auth_url"] = resp.url
        return jsonify({"biometric_required": True, "biometric_url": persona_url})

    return _err(f"Login failed: {data}", 401)


@app.route("/api/login/verify", methods=["POST"])
def login_verify():
    """Called after the user completes biometric verification in their browser."""
    email = session.get("pending_email")
    password = session.get("pending_password")
    inquiry = session.get("pending_inquiry")
    auth_url = session.get("pending_auth_url")

    if not all([email, password, inquiry, auth_url]):
        return _err("No pending verification. Start login again.", 400)

    s = _requests.Session()
    s.auth = (email, password)

    try:
        retry = s.post(f"{auth_url}/persona", json={"inquiry": inquiry}, timeout=20)
        data = retry.json()
    except Exception as exc:
        return _err(f"Request failed: {exc}")

    if "user" in data:
        session.clear()
        session["email"] = email
        session["password"] = password
        return jsonify({"ok": True})

    return _err(f"Verification did not complete: {data}", 401)


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})


# ------------------------------------------------------------------ #
# Dataset & field discovery
# ------------------------------------------------------------------ #

@app.route("/api/datasets")
def datasets():
    guard = _require_auth()
    if guard:
        return guard

    region = request.args.get("region", "USA")
    universe = request.args.get("universe", "TOP3000")
    delay = int(request.args.get("delay", 1))
    search = request.args.get("search", "").strip().lower()

    try:
        results = _make_client().get_datasets(region=region, universe=universe, delay=delay)
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

    dataset_id = request.args.get("dataset_id", "").strip()
    region = request.args.get("region", "USA")
    universe = request.args.get("universe", "TOP3000")
    delay = int(request.args.get("delay", 1))
    search = request.args.get("search", "").strip().lower()

    if not dataset_id:
        return _err("dataset_id is required.")

    try:
        results = _make_client().get_data_fields(
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


# ------------------------------------------------------------------ #
# Alpha simulation
# ------------------------------------------------------------------ #

@app.route("/api/simulate", methods=["POST"])
def simulate():
    guard = _require_auth()
    if guard:
        return guard

    body = request.get_json(force=True) or {}
    expression = body.get("expression", "").strip()
    if not expression:
        return _err("expression is required.")

    try:
        result = _make_client().simulate_alpha(
            expression,
            region=body.get("region", "USA"),
            universe=body.get("universe", "TOP3000"),
            delay=int(body.get("delay", 1)),
            decay=int(body.get("decay", 6)),
            truncation=float(body.get("truncation", 0.1)),
            neutralization=body.get("neutralization", "SUBINDUSTRY"),
            pasteurization=body.get("pasteurization", "ON"),
            nan_handling=body.get("nan_handling", "OFF"),
            timeout=int(body.get("timeout", 300)),
        )
    except (WQSimulationError, WQAuthError) as exc:
        return _err(str(exc))
    except Exception as exc:
        return _err(f"Unexpected error: {exc}")

    return jsonify(result)


# ------------------------------------------------------------------ #
# Serve React SPA in production
# ------------------------------------------------------------------ #

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
    print("API server running at http://localhost:5000")
    print("For React dev UI: cd frontend && npm run dev")
    app.run(debug=True, port=5000, threaded=True)
