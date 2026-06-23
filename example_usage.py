"""
Example usage of the WQClient.

Before running:
  1. Copy credentials.example.json -> credentials.json
  2. Fill in your real BRAIN email/password in credentials.json
  3. pip install requests
"""

from wq_client import WQClient

def main():
    client = WQClient(credentials_file="credentials.json")
    client.login()

    # 1. Discover datasets available to your account
    datasets = client.get_datasets(region="USA", universe="TOP3000", delay=1)
    print(f"\nFound {len(datasets)} datasets. First 5:")
    for ds in datasets[:5]:
        print(f"  - {ds.get('id')}: {ds.get('name')}")

    if not datasets:
        print("No datasets returned — check your account access/region settings.")
        return

    # 2. List fields inside the first dataset found
    first_dataset_id = datasets[0]["id"]
    fields = client.get_data_fields(
        dataset_id=first_dataset_id, region="USA", universe="TOP3000", delay=1
    )
    print(f"\nFields in '{first_dataset_id}' (first 10 of {len(fields)}):")
    for f in fields[:10]:
        print(f"  - {f.get('id')}: {f.get('description')}")

    # 3. Submit a simple alpha expression and wait for results
    expression = "rank(ts_mean(close, 5) / ts_mean(close, 20))"
    print(f"\nSimulating alpha: {expression}")
    result = client.simulate_alpha(
        expression, region="USA", universe="TOP3000", delay=1
    )

    print("\n--- Simulation Result ---")
    print(f"Link:           {result['link']}")
    print(f"Checks passed:  {result['passed_checks']}/{result['total_checks']}")
    print(f"Sharpe:         {result['sharpe']}")
    print(f"Fitness:        {result['fitness']}")
    print(f"Turnover:       {result['turnover']}")
    print(f"Weight check:   {result['weight_check']}")


if __name__ == "__main__":
    main()
