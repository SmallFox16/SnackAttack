# SnackAttack

SnackAttack is a lightweight web application for finding vending machines around ETSU. The Sprint 1 implementation displays vending-machine information from a CSV file and provides filtering, availability status, and expandable machine details.

## Sprint 1 Features

- Display each vending machine's availability status.
- Store availability in the vending-machine data.
- Filter the machine list by type.
- Use standardized machine types: `Drink`, `Snack`, and `Personal Care`.
- Expand a machine card to view additional information.
- Display machine type directly in the list.
- Store observed machine types in the CSV data.
- Store vending-machine records in `vending_machines.csv`.
- Display vending-machine information in a responsive web UI.

## Data Notes

The original sample CSV used placeholder GPS coordinates for every machine. Those placeholders were removed. The verified Brinkley coordinates from `miscFiles/VendingMachGenInfo` are stored as decimal coordinates in the CSV. Other machines retain the building/type values from the Sprint 1 sample data, while unverified fields remain blank or are marked `Unknown` rather than inventing data.

`Availability` supports these values:

- `Available`
- `Unavailable`
- `Unknown`

Update `Unknown` values after a machine's operating status has been verified.

## Project Structure

```text
SnackAttack/
├── index.html                  # Front-end UI and client-side behavior
├── vending_machines.csv        # Vending-machine data used by the UI
├── miscFiles/
│   └── VendingMachGenInfo      # Original verified Brinkley survey notes
├── Task13_NumVendingMachines   # Sprint count notes
├── vercel.json                 # Vercel static deployment configuration
└── README.md
```

## Run Locally

The page loads its CSV with `fetch()`, so use a local web server instead of opening `index.html` with `file://`.

From the project folder:

```bash
python -m http.server 8000
```

Then browse to:

```text
http://localhost:8000
```

## Production Deployment

The repository is configured as a static site for Vercel. Use `main` as the Vercel production branch. Development changes should be made on `dev`, reviewed in a pull request, and merged into `main` when ready for production.
