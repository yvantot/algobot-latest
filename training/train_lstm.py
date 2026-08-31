"""
Algobot Offline LSTM Training
==============================
Trains an LSTM model to predict student proficiency from gameplay feature sequences.

Architecture (must match browser TF.js model):
    Input: [batch, 20, 10] — 20 timesteps × 10 features
    LSTM(16) → Dense(8, ReLU) → Dropout(0.2) → Dense(1, Sigmoid)

Output:
    - Saved Keras model (.keras)
    - Training history plot
    - Test set evaluation metrics

Usage:
    python train_lstm.py --data data/processed/ --output models/
"""

import os
import json
import argparse
import numpy as np
import tensorflow as tf
from pathlib import Path
from datetime import datetime

# Constants
SEQUENCE_LENGTH = 20
FEATURE_COUNT = 10


def load_data(data_dir):
    """Load preprocessed training data."""
    data_path = Path(data_dir)

    X_train = np.load(data_path / "X_train.npy")
    y_train = np.load(data_path / "y_train.npy")
    X_val = np.load(data_path / "X_val.npy")
    y_val = np.load(data_path / "y_val.npy")
    X_test = np.load(data_path / "X_test.npy")
    y_test = np.load(data_path / "y_test.npy")

    print(f"Train: {X_train.shape} -> {y_train.shape}")
    print(f"Val:   {X_val.shape} -> {y_val.shape}")
    print(f"Test:  {X_test.shape} -> {y_test.shape}")

    return X_train, y_train, X_val, y_val, X_test, y_test


def build_model():
    """
    Build LSTM model. Architecture must match the browser-side TF.js model
    in agent.js for weight compatibility.
    """
    model = tf.keras.Sequential([
        tf.keras.layers.LSTM(
            16,
            input_shape=(SEQUENCE_LENGTH, FEATURE_COUNT),
            return_sequences=False,
            name="lstm"
        ),
        tf.keras.layers.Dense(8, activation="relu", name="dense_encoder"),
        tf.keras.layers.Dropout(0.2, name="dropout"),
        tf.keras.layers.Dense(1, activation="sigmoid", name="proficiency_output"),
    ])

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss="mse",
        metrics=[
            tf.keras.metrics.RootMeanSquaredError(name="rmse"),
            tf.keras.metrics.MeanAbsoluteError(name="mae"),
        ]
    )

    model.summary()
    return model


def augment_data(X, y, noise_std=0.05):
    """Add Gaussian noise augmentation for small datasets."""
    noise = np.random.normal(0, noise_std, X.shape).astype(np.float32)
    X_aug = np.clip(X + noise, 0, 1)
    return np.concatenate([X, X_aug]), np.concatenate([y, y])


def train(model, X_train, y_train, X_val, y_val, epochs=100, batch_size=32,
          augment=False):
    """Train the model with early stopping and learning rate reduction."""

    if augment and len(X_train) < 100:
        print("Small dataset detected - applying Gaussian noise augmentation")
        X_train, y_train = augment_data(X_train, y_train)
        print(f"Augmented train size: {X_train.shape}")

    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=10,
            restore_best_weights=True,
            verbose=1
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=5,
            min_lr=1e-6,
            verbose=1
        ),
    ]

    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=epochs,
        batch_size=batch_size,
        callbacks=callbacks,
        verbose=1
    )

    return history


def evaluate(model, X_test, y_test):
    """Evaluate model on test set and compare with naive baseline."""
    results = model.evaluate(X_test, y_test, verbose=0)
    loss, rmse, mae = results

    # Naive baseline: always predict the mean of training labels
    y_mean = y_test.mean()
    baseline_mse = np.mean((y_test - y_mean) ** 2)
    baseline_rmse = np.sqrt(baseline_mse)

    # R2 score
    ss_res = np.sum((y_test - model.predict(X_test, verbose=0).flatten()) ** 2)
    ss_tot = np.sum((y_test - y_mean) ** 2)
    r2 = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0

    print("\n" + "=" * 50)
    print("TEST SET EVALUATION")
    print("=" * 50)
    print(f"  LSTM RMSE:     {rmse:.4f}")
    print(f"  LSTM MAE:      {mae:.4f}")
    print(f"  LSTM R^2:      {r2:.4f}")
    print(f"  Baseline RMSE: {baseline_rmse:.4f} (always predict mean)")
    print(f"  Improvement:   {((baseline_rmse - rmse) / baseline_rmse * 100):.1f}% over baseline")
    print("=" * 50)

    return {
        "test_loss": float(loss),
        "test_rmse": float(rmse),
        "test_mae": float(mae),
        "test_r2": float(r2),
        "baseline_rmse": float(baseline_rmse),
        "improvement_pct": float((baseline_rmse - rmse) / baseline_rmse * 100) if baseline_rmse > 0 else 0,
    }


def save_training_plot(history, output_dir):
    """Save training history plot."""
    try:
        import matplotlib.pyplot as plt

        fig, axes = plt.subplots(1, 2, figsize=(12, 4))

        # Loss
        axes[0].plot(history.history["loss"], label="Train Loss")
        axes[0].plot(history.history["val_loss"], label="Val Loss")
        axes[0].set_xlabel("Epoch")
        axes[0].set_ylabel("MSE Loss")
        axes[0].set_title("Training & Validation Loss")
        axes[0].legend()
        axes[0].grid(True, alpha=0.3)

        # RMSE
        axes[1].plot(history.history["rmse"], label="Train RMSE")
        axes[1].plot(history.history["val_rmse"], label="Val RMSE")
        axes[1].set_xlabel("Epoch")
        axes[1].set_ylabel("RMSE")
        axes[1].set_title("Training & Validation RMSE")
        axes[1].legend()
        axes[1].grid(True, alpha=0.3)

        plt.tight_layout()
        plot_path = Path(output_dir) / "training_history.png"
        plt.savefig(plot_path, dpi=150)
        plt.close()
        print(f"Training plot saved to {plot_path}")
    except ImportError:
        print("matplotlib not available — skipping training plot")


def main():
    parser = argparse.ArgumentParser(description="Train LSTM proficiency model")
    parser.add_argument("--data", default="data/processed/", help="Processed data directory")
    parser.add_argument("--output", default="models/", help="Model output directory")
    parser.add_argument("--epochs", type=int, default=100, help="Max training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Training batch size")
    parser.add_argument("--augment", action="store_true", help="Enable noise augmentation")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    args = parser.parse_args()

    tf.random.set_seed(args.seed)
    np.random.seed(args.seed)

    # Load data
    X_train, y_train, X_val, y_val, X_test, y_test = load_data(args.data)

    # Build model
    model = build_model()

    # Train
    history = train(model, X_train, y_train, X_val, y_val,
                    epochs=args.epochs, batch_size=args.batch_size,
                    augment=args.augment)

    # Evaluate
    eval_results = evaluate(model, X_test, y_test)

    # Save model
    output_path = Path(args.output)
    output_path.mkdir(parents=True, exist_ok=True)

    keras_path = output_path / "lstm_proficiency.keras"
    model.save(keras_path)
    print(f"\nKeras model saved to {keras_path}")

    # Save evaluation results
    eval_results["trained_at"] = datetime.now().isoformat()
    eval_results["epochs_trained"] = len(history.history["loss"])
    eval_results["train_samples"] = len(X_train)

    with open(output_path / "lstm_evaluation.json", "w") as f:
        json.dump(eval_results, f, indent=2)

    # Save training plot
    save_training_plot(history, args.output)

    # Instructions for TF.js export
    print("\n" + "=" * 50)
    print("TO EXPORT FOR BROWSER (TensorFlow.js):")
    print("=" * 50)
    print(f"  pip install tensorflowjs")
    print(f"  tensorflowjs_converter \\")
    print(f"    --input_format=keras \\")
    print(f"    --output_format=tfjs_layers_model \\")
    print(f"    {keras_path} \\")
    print(f"    ../public/models/lstm/")
    print("=" * 50)


if __name__ == "__main__":
    main()
