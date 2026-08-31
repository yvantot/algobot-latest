"""
Algobot TensorFlow.js Model Exporter
====================================
Converts trained Keras (.keras) models into standard TensorFlow.js Layers Models
compatible with tf.loadLayersModel() in @tensorflow/tfjs (browser & node).
"""

import json
import numpy as np
import tensorflow as tf
from pathlib import Path


def export_lstm_to_tfjs(keras_model_path, output_dir):
    """Export LSTM proficiency model to TF.js layers model format."""
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    model = tf.keras.models.load_model(keras_model_path)

    # Extract weights in exact layer order
    lstm_layer = model.get_layer("lstm")
    dense_enc = model.get_layer("dense_encoder")
    dense_out = model.get_layer("proficiency_output")

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
    bin_bytes = bytearray()
    for w in all_weights:
        bin_bytes.extend(w.astype(np.float32).tobytes())

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
        "generatedBy": "keras v2.4.0",
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
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    model = tf.keras.models.load_model(keras_model_path)

    hidden1 = model.get_layer("hidden1")
    hidden2 = model.get_layer("hidden2")
    q_values = model.get_layer("q_values")

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
    bin_bytes = bytearray()
    for w in all_weights:
        bin_bytes.extend(w.astype(np.float32).tobytes())

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
        "generatedBy": "keras v2.4.0",
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


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Export Keras models to TensorFlow.js")
    parser.add_argument("--lstm", default="models/lstm_proficiency.keras", help="Path to LSTM .keras file")
    parser.add_argument("--dqn", default="models/dqn_policy.keras", help="Path to DQN .keras file")
    parser.add_argument("--public-dir", default="../public/models", help="Target public models directory")
    args = parser.parse_args()

    pub_path = Path(args.public_dir)

    lstm_file = Path(args.lstm)
    if lstm_file.exists():
        export_lstm_to_tfjs(lstm_file, pub_path / "lstm")
    else:
        print(f"LSTM model not found at {lstm_file}")

    dqn_file = Path(args.dqn)
    if dqn_file.exists():
        export_dqn_to_tfjs(dqn_file, pub_path / "dqn")
    else:
        print(f"DQN model not found at {dqn_file}")

    print("\nModels exported successfully for TensorFlow.js browser inference!")


if __name__ == "__main__":
    main()
