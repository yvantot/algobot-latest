"""Evaluate a preserved model without retraining or overwriting historical reports.

Supports Keras or externally generated predictions in test-row order. Export the
already normalized test inputs for the deployed TFJS model with --export-inputs.
"""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
from model_metrics import DEFAULT_CUTOFFS, evaluate_predictions


def write_new_json(path, content):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation prevents accidental replacement of historical evidence.
    with path.open("x", encoding="utf-8") as stream:
        json.dump(content, stream, indent=2, allow_nan=False)


def split_status(data_path):
    path = data_path / "split_manifest.json"
    if not path.exists():
        return {"status": "historical_split_unverified", "warning": "No split manifest exists. The original preparation shuffled quest samples, allowing the same student across partitions. These results are descriptive legacy-model diagnostics, not a student-independent validation."}
    manifest = json.loads(path.read_text(encoding="utf-8-sig"))
    if manifest.get("split_unit") != "student_id":
        raise ValueError("Split manifest does not declare student-disjoint groups")
    groups = {}
    for split in ("train", "val", "test"):
        records = manifest["partitions"][split]
        if len(records) != len(np.load(data_path / f"y_{split}.npy", allow_pickle=False)):
            raise ValueError(f"Manifest length does not match {split} labels")
        groups[split] = {r["student_id"] for r in records}
        if not groups[split] or any(str(g).strip().lower() in {"unknown", "anonymous", "none", ""} for g in groups[split]):
            raise ValueError("Manifest contains empty groups or missing student identities")
    if any(groups[a] & groups[b] for a, b in (("train", "val"), ("train", "test"), ("val", "test"))):
        raise ValueError("Student overlap found in split manifest")
    return {"status": "student_disjoint_manifest_verified", "student_counts": {k: len(v) for k, v in groups.items()},
            "warning": "This checks recorded ID grouping only. Identity provenance and model training history require verification."}


def main():
    root = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=root / "data/processed")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--predictions", type=Path, help="JSON array or object containing predictions in test-row order")
    source.add_argument("--model", type=Path, help="Saved .keras model (requires TensorFlow)")
    source.add_argument("--export-inputs", type=Path, help="New JSON file of normalized test inputs; no evaluation")
    parser.add_argument("--output", type=Path, help="New report JSON path, required for evaluation")
    parser.add_argument("--cutoffs", nargs=2, type=float, default=DEFAULT_CUTOFFS)
    args = parser.parse_args()
    try:
        X = np.load(args.data / "X_test.npy", allow_pickle=False)
        if X.ndim != 3 or X.shape[1:] != (20, 10) or not len(X) or not np.isfinite(X).all():
            raise ValueError("X_test must be finite, nonempty and shaped [N, 20, 10]")
        if args.export_inputs:
            write_new_json(args.export_inputs, {"inputs": X.tolist(), "normalized": True,
                "source_sha256": hashlib.sha256((args.data / "X_test.npy").read_bytes()).hexdigest()})
            print(f"Exported {len(X)} normalized test inputs to {args.export_inputs}")
            return
        if args.output is None:
            parser.error("--output is required for evaluation; choose a new report path")
        if args.output.exists():
            parser.error("Report exists; choose a new output path to preserve evidence")
        provenance = {}
        if args.model:
            import tensorflow as tf
            model = tf.keras.models.load_model(args.model, compile=False)
            predictions = model.predict(X, verbose=0).reshape(-1)
            provenance["model_sha256"] = hashlib.sha256(args.model.read_bytes()).hexdigest()
        else:
            document = json.loads(args.predictions.read_text(encoding="utf-8-sig"))
            predictions = document["predictions"] if isinstance(document, dict) else document
            provenance["predictions_sha256"] = hashlib.sha256(args.predictions.read_bytes()).hexdigest()
            if isinstance(document, dict):
                provenance["prediction_metadata"] = {k: v for k, v in document.items() if k != "predictions"}
        y_test = np.load(args.data / "y_test.npy", allow_pickle=False)
        y_train = np.load(args.data / "y_train.npy", allow_pickle=False)
        if len(X) != len(y_test):
            raise ValueError("Test inputs and labels have unequal row counts")
        report = evaluate_predictions(y_test, predictions, y_train, tuple(args.cutoffs))
        report.update({"evaluated_at": datetime.now(timezone.utc).isoformat(), "split_validation": split_status(args.data),
                       "provenance": provenance,
                       "input_sha256": {name: hashlib.sha256((args.data / name).read_bytes()).hexdigest()
                                        for name in ("X_test.npy", "y_test.npy", "y_train.npy", "scaler_params.json")}})
        write_new_json(args.output, report)
        print(f"Saved diagnostic evaluation to {args.output}")
        print(f"Accuracy: {report['classification']['accuracy']:.4f}; macro F1: {report['classification']['macro_f1']:.4f}")
        for warning in report["warnings"]:
            print(f"Caution: {warning}")
    except (ValueError, KeyError, OSError, ImportError) as exc:
        parser.error(str(exc))


if __name__ == "__main__":
    main()
