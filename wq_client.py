"""
WorldQuant BRAIN API Client
============================

A lightweight wrapper around the WorldQuant BRAIN REST API for:
  - Authenticating (with biometric/persona-check handling)
  - Listing available datasets
  - Listing/searching data fields within a dataset (with pagination)
  - Submitting alpha expressions for simulation
  - Polling simulation status and retrieving results

IMPORTANT — read this before using:
BRAIN does NOT accept arbitrary external data uploads into its simulator.
You can only build alpha *expressions* using the data fields BRAIN already
provides (price/volume, fundamental, alternative datasets it has licensed).
This client helps you authenticate, discover what fields/datasets exist,
and submit/test expressions against them — it does not and cannot inject
outside data into BRAIN's simulation engine.

Usage:
    from wq_client import WQClient

    client = WQClient(email="you@example.com", password="yourpassword")
    client.login()

    datasets = client.get_datasets(region="USA", universe="TOP3000", delay=1)
    fields = client.get_data_fields(dataset_id="fundamental6", region="USA",
                                     universe="TOP3000", delay=1)

    result = client.simulate_alpha(
        "rank(ts_mean(close, 5) / ts_mean(close, 20))",
        region="USA", universe="TOP3000", delay=1
    )
    print(result)
"""

import json
import time
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any

import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
log = logging.getLogger("wq_client")

BASE_URL = "https://api.worldquantbrain.com"


class WQAuthError(Exception):
    """Raised when authentication fails or credentials are rejected."""


class WQSimulationError(Exception):
    """Raised when a simulation fails or returns an unexpected response."""


class WQClient:
    def __init__(
        self,
        email: Optional[str] = None,
        password: Optional[str] = None,
        credentials_file: Optional[str] = None,
    ):
        """
        Provide either (email, password) directly, or a path to a JSON file
        containing {"email": "...", "password": "..."}.

        Never hardcode real credentials into scripts you share or commit —
        use a credentials file kept out of version control (e.g. via .gitignore).
        """
        if credentials_file:
            creds = json.loads(Path(credentials_file).read_text())
            email = creds.get("email")
            password = creds.get("password")

        if not email or not password:
            raise ValueError(
                "Must provide email & password, or a valid credentials_file."
            )

        self.session = requests.Session()
        self.session.auth = (email, password)
        self._logged_in = False

    # ------------------------------------------------------------------ #
    # Authentication
    # ------------------------------------------------------------------ #
    def login(self) -> None:
        """
        Authenticate with BRAIN. Handles the biometric/persona verification
        step that BRAIN sometimes requires on first login from a new client.
        """
        resp = self.session.post(f"{BASE_URL}/authentication")
        data = self._safe_json(resp)

        if "user" in data:
            self._logged_in = True
            log.info("Logged in to WorldQuant BRAIN.")
            return

        if "inquiry" in data:
            persona_url = f"{resp.url}/persona?inquiry={data['inquiry']}"
            log.warning(
                "Biometric verification required. Complete it at:\n  %s",
                persona_url,
            )
            input("Press Enter once you've completed verification in your browser...")
            retry = self.session.post(f"{resp.url}/persona", json=data)
            retry_data = self._safe_json(retry)
            if "user" in retry_data:
                self._logged_in = True
                log.info("Logged in to WorldQuant BRAIN after verification.")
                return
            raise WQAuthError(f"Verification did not complete: {retry_data}")

        raise WQAuthError(f"Login failed: {data}")

    def _ensure_login(self):
        if not self._logged_in:
            raise WQAuthError("Not logged in. Call client.login() first.")

    @staticmethod
    def _safe_json(resp: requests.Response) -> Dict[str, Any]:
        try:
            return resp.json()
        except ValueError:
            return {"_raw": resp.text, "_status": resp.status_code}

    # ------------------------------------------------------------------ #
    # Dataset & field discovery
    # ------------------------------------------------------------------ #
    def get_datasets(
        self, region: str = "USA", universe: str = "TOP3000", delay: int = 1
    ) -> List[Dict[str, Any]]:
        """List datasets available for a given region/universe/delay combo."""
        self._ensure_login()
        params = {"region": region, "universe": universe, "delay": delay, "limit": 50}
        results, offset = [], 0
        while True:
            params["offset"] = offset
            resp = self.session.get(f"{BASE_URL}/data-sets", params=params)
            data = self._safe_json(resp)
            batch = data.get("results", [])
            results.extend(batch)
            if len(batch) < params["limit"]:
                break
            offset += params["limit"]
        log.info("Found %d datasets for %s/%s/delay=%s", len(results), region, universe, delay)
        return results

    def get_data_fields(
        self,
        dataset_id: str,
        region: str = "USA",
        universe: str = "TOP3000",
        delay: int = 1,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        List all fields belonging to a dataset, paginating through results
        since BRAIN caps how many it returns per request.
        """
        self._ensure_login()
        params = {
            "dataset.id": dataset_id,
            "region": region,
            "universe": universe,
            "delay": delay,
            "limit": limit,
            "offset": 0,
        }
        results = []
        while True:
            resp = self.session.get(f"{BASE_URL}/data-fields", params=params)
            data = self._safe_json(resp)
            batch = data.get("results", [])
            results.extend(batch)
            if len(batch) < limit:
                break
            params["offset"] += limit
        log.info("Found %d fields in dataset '%s'", len(results), dataset_id)
        return results

    # ------------------------------------------------------------------ #
    # Alpha simulation
    # ------------------------------------------------------------------ #
    def simulate_alpha(
        self,
        expression: str,
        region: str = "USA",
        universe: str = "TOP3000",
        delay: int = 1,
        decay: int = 6,
        truncation: float = 0.1,
        neutralization: str = "SUBINDUSTRY",
        pasteurization: str = "ON",
        nan_handling: str = "OFF",
        poll_interval: int = 10,
        timeout: int = 600,
    ) -> Dict[str, Any]:
        """
        Submit a single alpha expression (FASTEXPR syntax) for simulation
        and block until it completes (or times out).

        Returns a dict with keys: passed_checks, sharpe, fitness, turnover,
        weight_check, link, raw (full alpha response).
        """
        self._ensure_login()

        payload = {
            "regular": expression.strip(),
            "type": "REGULAR",
            "settings": {
                "nanHandling": nan_handling,
                "instrumentType": "EQUITY",
                "delay": delay,
                "universe": universe,
                "truncation": truncation,
                "unitHandling": "VERIFY",
                "pasteurization": pasteurization,
                "region": region,
                "language": "FASTEXPR",
                "decay": decay,
                "neutralization": neutralization.upper(),
                "visualization": False,
            },
        }

        log.info("Submitting alpha: %s", expression)
        resp = self.session.post(f"{BASE_URL}/simulations", json=payload)
        if "Location" not in resp.headers:
            raise WQSimulationError(f"Submission failed: {self._safe_json(resp)}")

        progress_url = resp.headers["Location"]
        log.info("Simulation queued. Polling: %s", progress_url)

        elapsed = 0
        while elapsed < timeout:
            poll = self._safe_json(self.session.get(progress_url))
            if "alpha" in poll:
                alpha_id = poll["alpha"]
                break
            pct = poll.get("progress")
            if pct is not None:
                log.info("Simulation progress: %.0f%%", pct * 100)
            else:
                # No progress field usually means failure/finalization message
                raise WQSimulationError(f"Simulation did not complete: {poll}")
            time.sleep(poll_interval)
            elapsed += poll_interval
        else:
            raise WQSimulationError("Simulation timed out waiting for completion.")

        alpha = self._safe_json(self.session.get(f"{BASE_URL}/alphas/{alpha_id}"))
        return self._summarize_alpha(alpha, alpha_id)

    @staticmethod
    def _summarize_alpha(alpha: Dict[str, Any], alpha_id: str) -> Dict[str, Any]:
        is_stats = alpha.get("is", {})
        checks = is_stats.get("checks", [])
        passed = sum(1 for c in checks if c.get("result") == "PASS")

        weight_check = next(
            (c["result"] for c in checks if c.get("name") == "CONCENTRATED_WEIGHT"),
            None,
        )

        return {
            "alpha_id": alpha_id,
            "link": f"https://platform.worldquantbrain.com/alpha/{alpha_id}",
            "passed_checks": passed,
            "total_checks": len(checks),
            "sharpe": is_stats.get("sharpe"),
            "fitness": is_stats.get("fitness"),
            "turnover": is_stats.get("turnover"),
            "weight_check": weight_check,
            "raw": alpha,
        }

    def simulate_batch(
        self, expressions: List[str], **simulate_kwargs
    ) -> List[Dict[str, Any]]:
        """
        Submit several alpha expressions sequentially (BRAIN rate-limits
        concurrent simulations per account, so this stays sequential and
        safe rather than firing them all at once).
        """
        results = []
        for expr in expressions:
            try:
                results.append(self.simulate_alpha(expr, **simulate_kwargs))
            except WQSimulationError as e:
                log.error("Alpha failed: %s — %s", expr, e)
                results.append({"expression": expr, "error": str(e)})
        return results
