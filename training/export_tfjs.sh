#!/bin/bash
# Use the guarded exporter; explicit model paths and a new destination are required.
# Example: ./export_tfjs.sh --lstm models_v2/lstm_proficiency.keras --public-dir exports_v2
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
python "$SCRIPT_DIR/export_tfjs.py" "$@"
