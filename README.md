# WorldQuant BRAIN API Client

A lightweight Python wrapper for the WorldQuant BRAIN REST API: authenticate,
discover datasets/data fields, and submit alpha expressions for simulation.

## ⚠️ Important — what this can and can't do

**BRAIN does not accept arbitrary external data uploads.** There is no
endpoint for pushing your own datasets into BRAIN's simulation engine. All
alpha expressions are built using the data fields BRAIN *itself* provides
(price/volume, fundamental, alternative datasets it has licensed).

What this client actually does:
- Authenticates with your BRAIN account (handles the biometric/persona
  verification step BRAIN sometimes requires).
- Lists datasets and data fields available to your account/region/universe.
- Submits FASTEXPR alpha expressions for simulation and polls until results
  are ready.
- Summarizes key result stats (Sharpe, fitness, turnover, check pass/fail).

What it does **not** do:
- Upload or inject external/custom data into BRAIN.
- Guarantee "accurate" data — it surfaces exactly what BRAIN's API returns,
  nothing more. Treat BRAIN's own published data field descriptions as the
  source of truth for what each field actually measures.

If your goal is to bring *outside* research or ideas into your alpha
construction, the realistic path is: do that research separately, then
hand-translate or use an LLM to help translate the idea into a FASTEXPR
expression built from BRAIN's existing fields — then simulate it with this
client. That's also the pattern used by most existing open-source BRAIN
tools that "use AI" alongside BRAIN.

## Setup

```bash
pip install requests
cp credentials.example.json credentials.json
# edit credentials.json with your real email & password
```

**Never commit `credentials.json` to version control.** Add it to
`.gitignore` if you put this in a git repo.

## Usage

```python
from wq_client import WQClient

client = WQClient(credentials_file="credentials.json")
client.login()

# Discover datasets
datasets = client.get_datasets(region="USA", universe="TOP3000", delay=1)

# List fields in a dataset
fields = client.get_data_fields(dataset_id=datasets[0]["id"],
                                 region="USA", universe="TOP3000", delay=1)

# Submit and simulate an alpha expression
result = client.simulate_alpha(
    "rank(ts_mean(close, 5) / ts_mean(close, 20))",
    region="USA", universe="TOP3000", delay=1
)
print(result)
```

Or just run the included example end-to-end:

```bash
python example_usage.py
```

## Files

- `wq_client.py` — the API client (auth, datasets, fields, simulation)
- `example_usage.py` — runnable example exercising all major methods
- `credentials.example.json` — template; copy to `credentials.json` and fill in

## Notes on rate limits & batching

BRAIN limits how many simulations an account can run concurrently. The
`simulate_batch()` method submits expressions **sequentially** rather than
firing them all in parallel, to stay within typical account limits. If you
need true concurrency, check your account's specific simulation slot limit
on the BRAIN platform first.
# brain-world
