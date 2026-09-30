"""
Algobot TensorFlow.js Model Exporter
====================================
Converts trained Keras (.keras) models into standard TensorFlow.js Layers Models
compatible with tf.loadLayersModel() in @tensorflow/tfjs (browser & node).
"""

import json
import numpy as np
import shutil
from pathlib import Path
from prepare_dataset import FEATURE_NAMES


def validate_layer_config(layer, **expected):
    config = layer.get_config()
    for key, value in expected.items():
        if config.get(key) != value:
            raise ValueError(f"Unsupported {layer.name} configuration: {key} must equal {value!r}")


def export_lstm_to_tfjs(keras_model_path, output_dir):
    """Export LSTM proficiency model to TF.js layers model format."""
    import tensorflow as tf
    out_path = Path(output_dir)
    if out_path.exists() and any(out_path.iterdir()):
        raise FileExistsError(f"Will not overwrite existing export: {out_path}")
    model = tf.keras.models.load_model(keras_model_path, compile=False)

    # Extract weights in exact layer order
    lstm_layer = model.get_layer("lstm")
    dense_enc = model.get_layer("dense_encoder")
    dense_out = model.get_layer("proficiency_output")
    validate_layer_config(lstm_layer, units=16, activation="tanh", recurrent_activation="sigmoid",
                          return_sequences=False, return_state=False, go_backwards=False,
                          stateful=False, use_bias=True)
    validate_layer_config(dense_enc, units=8, activation="relu", use_bias=True)
    validate_layer_config(dense_out, units=1, activation="sigmoid", use_bias=True)

    lstm_w = lstm_layer.get_weights()  # [kernel, recurrent_kernel, bias]
    enc_w = dense_enc.get_weights()    # [kernel, bias]
    out_w = dense_out.get_weights()    # [kernel, bias]

    weight_specs = [
        {"name": "lstm/kernel", "shape": list(lstm_w[0].shape), "dtype": "float32"},
        {"name": "lstm/recurrent_kernel", "shape": list(lstm_w[1].shape), "dtype": "float32"},
        {"name": "lstm/bias", "shape": list(lstm_w[2].shape), "dtype": "float32"},
        {"name": "dense_encoder/kernel", "shape": list(enc_w[0].shape), "dtype": "float32"},
        {"name": "dense_encoder/bias", "shape": list(enc_w[1].shape), "dtype": "float32"},
        {"name": "proficiency_output/kernel", "shape": list(out_w[0].shape), "dtype": "float32"},
        {"name": "proficiency_output/bias", "shape": list(out_w[1].shape), "dtype": "float32"},
    ]

    all_weights = [lstm_w[0], lstm_w[1], lstm_w[2], enc_w[0], enc_w[1], out_w[0], out_w[1]]
    expected_shapes = ([(10, 64), (16, 64), (64,), (16, 8), (8,), (8, 1), (1,)]
                       if len(all_weights) == 7 else [(4, 16), (16,), (16, 16), (16,), (16, 5), (5,)])
    if [w.shape for w in all_weights] != expected_shapes or any(not np.isfinite(w).all() for w in all_weights):
        raise ValueError("Model weights do not match the supported finite browser architecture")
    out_path.mkdir(parents=True, exist_ok=True)
    bin_bytes = bytearray()
    for w in all_weights:
        bin_bytes.extend(w.astype("<f4").tobytes())

    bin_filename = "group1-shard1of1.bin"
    with open(out_path / bin_filename, "wb") as f:
        f.write(bin_bytes)

    topology = {
        "class_name": "Sequential",
        "config": {
            "name": "sequential_lstm",
            "layers": [
                {
                    "class_name": "LSTM",
                    "config": {
                        "name": "lstm",
                        "trainable": True,
                        "batch_input_shape": [None, 20, 10],
                        "dtype": "float32",
                        "return_sequences": False,
                        "return_state": False,
                        "go_backwards": False,
                        "stateful": False,
                        "unroll": False,
                        "units": 16,
                        "activation": "tanh",
                        "recurrent_activation": "sigmoid",
                        "use_bias": True,
                        "unit_forget_bias": True,
                        "dropout": 0.0,
                        "recurrent_dropout": 0.0,
                        "implementation": 2
                    }
                },
                {
                    "class_name": "Dense",
                    "config": {
                        "name": "dense_encoder",
                        "trainable": True,
                        "dtype": "float32",
                        "units": 8,
                        "activation": "relu",
                        "use_bias": True
                    }
                },
                {
                    "class_name": "Dropout",
                    "config": {
                        "name": "dropout",
                        "trainable": True,
                        "dtype": "float32",
                        "rate": 0.2
                    }
                },
                {
                    "class_name": "Dense",
                    "config": {
                        "name": "proficiency_output",
                        "trainable": True,
                        "dtype": "float32",
                        "units": 1,
                        "activation": "sigmoid",
                        "use_bias": True
                    }
                }
            ]
        },
        "keras_version": "2.4.0",
        "backend": "tensorflow"
    }

    tfjs_json = {
        "format": "layers-model",
        "generatedBy": f"TensorFlow {tf.__version__}",
        "convertedBy": "Algobot Model Converter",
        "modelTopology": topology,
        "weightsManifest": [
            {
                "paths": [bin_filename],
                "weights": weight_specs
            }
        ]
    }

    with open(out_path / "model.json", "w") as f:
        json.dump(tfjs_json, f, indent=2)

    print(f"Exported LSTM model to {out_path}/")
    print(f"  model.json ({len(weight_specs)} weights)")
    print(f"  {bin_filename} ({len(bin_bytes)} bytes)")


def export_dqn_to_tfjs(keras_model_path, output_dir):
    """Export DQN policy model to TF.js layers model format."""
    import tensorflow as tf
    out_path = Path(output_dir)
    if out_path.exists() and any(out_path.iterdir()):
        raise FileExistsError(f"Will not overwrite existing export: {out_path}")
    model = tf.keras.models.load_model(keras_model_path, compile=False)

    hidden1 = model.get_layer("hidden1")
    hidden2 = model.get_layer("hidden2")
    q_values = model.get_layer("q_values")
    validate_layer_config(hidden1, units=16, activation="relu", use_bias=True)
    validate_layer_config(hidden2, units=16, activation="relu", use_bias=True)
    validate_layer_config(q_values, units=5, activation="linear", use_bias=True)

    h1_w = hidden1.get_weights()
    h2_w = hidden2.get_weights()
    qv_w = q_values.get_weights()

    weight_specs = [
        {"name": "hidden1/kernel", "shape": list(h1_w[0].shape), "dtype": "float32"},
        {"name": "hidden1/bias", "shape": list(h1_w[1].shape), "dtype": "float32"},
        {"name": "hidden2/kernel", "shape": list(h2_w[0].shape), "dtype": "float32"},
        {"name": "hidden2/bias", "shape": list(h2_w[1].shape), "dtype": "float32"},
        {"name": "q_values/kernel", "shape": list(qv_w[0].shape), "dtype": "float32"},
        {"name": "q_values/bias", "shape": list(qv_w[1].shape), "dtype": "float32"},
    ]

    all_weights = [h1_w[0], h1_w[1], h2_w[0], h2_w[1], qv_w[0], qv_w[1]]
    expected_shapes = ([(10, 64), (16, 64), (64,), (16, 8), (8,), (8, 1), (1,)]
                       if len(all_weights) == 7 else [(4, 16), (16,), (16, 16), (16,), (16, 5), (5,)])
    if [w.shape for w in all_weights] != expected_shapes or any(not np.isfinite(w).all() for w in all_weights):
        raise ValueError("Model weights do not match the supported finite browser architecture")
    out_path.mkdir(parents=True, exist_ok=True)
    bin_bytes = bytearray()
    for w in all_weights:
        bin_bytes.extend(w.astype("<f4").tobytes())

    bin_filename = "group1-shard1of1.bin"
    with open(out_path / bin_filename, "wb") as f:
        f.write(bin_bytes)

    topology = {
        "class_name": "Sequential",
        "config": {
            "name": "sequential_dqn",
            "layers": [
                {
                    "class_name": "Dense",
                    "config": {
                        "name": "hidden1",
                        "trainable": True,
                        "batch_input_shape": [None, 4],
                        "dtype": "float32",
                        "units": 16,
                        "activation": "relu",
                        "use_bias": True
                    }
                },
                {
                    "class_name": "Dense",
                    "config": {
                        "name": "hidden2",
                        "trainable": True,
                        "dtype": "float32",
                        "units": 16,
                        "activation": "relu",
                        "use_bias": True
                    }
                },
                {
                    "class_name": "Dense",
                    "config": {
                        "name": "q_values",
                        "trainable": True,
                        "dtype": "float32",
                        "units": 5,
                        "activation": "linear",
                        "use_bias": True
                    }
                }
            ]
        },
        "keras_version": "2.4.0",
        "backend": "tensorflow"
    }

    tfjs_json = {
        "format": "layers-model",
        "generatedBy": f"TensorFlow {tf.__version__}",
        "convertedBy": "Algobot Model Converter",
        "modelTopology": topology,
        "weightsManifest": [
            {
                "paths": [bin_filename],
                "weights": weight_specs
            }
        ]
    }

    with open(out_path / "model.json", "w") as f:
        json.dump(tfjs_json, f, indent=2)

    print(f"Exported DQN model to {out_path}/")
    print(f"  model.json ({len(weight_specs)} weights)")
    print(f"  {bin_filename} ({len(bin_bytes)} bytes)")


def validate_scaler(path):
    scaler = json.loads(Path(path).read_text(encoding="utf-8-sig"))
    for key in ("feature_min", "feature_max", "feature_range"):
        values = np.asarray(scaler[key], dtype=np.float64)
        if values.shape != (10,) or not np.isfinite(values).all():
            raise ValueError(f"Invalid scaler {key}")
    if np.any(np.asarray(scaler["feature_range"]) <= 0):
        raise ValueError("Scaler ranges must be positive")
    difference = np.asarray(scaler["feature_max"]) - np.asarray(scaler["feature_min"])
    if np.any(difference < 0) or not np.allclose(scaler["feature_range"], np.where(difference == 0, 1, difference)):
        raise ValueError("Scaler ranges must agree with training min/max")
    if scaler.get("feature_names") != FEATURE_NAMES:
        raise ValueError("Scaler feature order differs from the browser input contract")
    return scaler


def main():
    import argparse
    root = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description="Export supported Keras models into a NEW TFJS directory")
    parser.add_argument("--lstm", type=Path, help="LSTM .keras model; omit for DQN-only export")
    parser.add_argument("--dqn", type=Path, help="DQN .keras model; omit for LSTM-only export")
    parser.add_argument("--scaler", type=Path, help="Matching LSTM scaler; defaults beside the Keras model")
    parser.add_argument("--public-dir", type=Path, default=root / "exports_v2", help="New export directory; promote verified artifacts separately")
    args = parser.parse_args()
    if not args.lstm and not args.dqn:
        parser.error("Specify at least one of --lstm or --dqn")
    if args.public_dir.exists() and (not args.public_dir.is_dir() or any(args.public_dir.iterdir())):
        parser.error("Export destination must be new or empty; deployed models are preserved")
    for model in (args.lstm, args.dqn):
        if model is not None and not model.is_file():
            parser.error(f"Requested model is missing: {model}")
    scaler_path = None
    if args.lstm:
        scaler_path = args.scaler or args.lstm.parent / "scaler_params.json"
        try:
            validate_scaler(scaler_path)
        except (ValueError, KeyError, OSError) as exc:
            parser.error(f"A valid matching LSTM scaler is required: {exc}")
    if args.lstm:
        export_lstm_to_tfjs(args.lstm, args.public_dir / "lstm")
        shutil.copy2(scaler_path, args.public_dir / "lstm/scaler_params.json")
    if args.dqn:
        export_dqn_to_tfjs(args.dqn, args.public_dir / "dqn")
        # Training diagnostics cannot authorize policy deployment. Carry a closed
        # gate forward even when all actions occur in the training data.
        metadata_path = args.dqn.parent / "policy_metadata.json"
        metadata = json.loads(metadata_path.read_text(encoding="utf-8-sig")) if metadata_path.exists() else {}
        metadata.update({"schema_version": 1, "deployment_ready": False,
                         "reason": "Exported policy requires separate action-support and effectiveness review before deployment."})
        (args.public_dir / "dqn/policy_metadata.json").write_text(json.dumps(metadata, indent=2, allow_nan=False), encoding="utf-8")
    print(f"Export completed in {args.public_dir}. Verify browser/Keras prediction parity before promotion.")


if __name__ == "__main__":
    main()
