"""
Algobot Offline DQN Training
==============================
Trains a DQN from experience tuples collected during Bootstrap DDA gameplay.

Architecture (must match browser TF.js model):
    Input: [batch, 4] — [proficiency, stage/5, frustration, flow]
    Dense(16, ReLU) → Dense(16, ReLU) → Dense(5, Linear)

Training:
    - Standard experience replay with mini-batch sampling
    - Target network with periodic hard updates
    - Gamma = 0.95 discount factor

Usage:
    python train_dqn.py --data data/raw/ --output models/
"""

import json
import argparse
import numpy as np
import tensorflow as tf
from pathlib import Path
from datetime import datetime

# Constants
STATE_SIZE = 4
ACTION_COUNT = 5
ACTION_NAMES = ["Normal", "Scaffold", "Challenge", "Greedy Guide", "State Optimize"]


def load_experiences(input_dir):
    """Load experience tuples from exported replay buffer JSON files."""
    experiences = []
    input_path = Path(input_dir)

    # Load from replay buffer exports
    for json_file in input_path.glob("*replay*.json"):
        with open(json_file, "r") as f:
            data = json.load(f)
        if isinstance(data, list):
            experiences.extend(data)

    # Also extract from full session exports
    for json_file in input_path.glob("*dataset*.json"):
        with open(json_file, "r") as f:
            data = json.load(f)
        if "sessions" in data:
            for session in data["sessions"]:
                buf = session.get("replay_buffer", [])
                if isinstance(buf, list):
                    experiences.extend(buf)

    # Filter valid experiences
    valid = []
    for exp in experiences:
        if (isinstance(exp.get("state"), list) and len(exp["state"]) == STATE_SIZE
                and isinstance(exp.get("nextState"), list) and len(exp["nextState"]) == STATE_SIZE
                and isinstance(exp.get("action"), (int, float))
                and isinstance(exp.get("reward"), (int, float))):
            valid.append(exp)

    print(f"Loaded {len(valid)} valid experience tuples from {input_dir}")
    return valid


def build_dqn():
    """Build DQN model matching browser architecture."""
    model = tf.keras.Sequential([
        tf.keras.layers.Dense(16, activation="relu", input_shape=(STATE_SIZE,), name="hidden1"),
        tf.keras.layers.Dense(16, activation="relu", name="hidden2"),
        tf.keras.layers.Dense(ACTION_COUNT, activation="linear", name="q_values"),
    ])
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.005),
        loss="mse"
    )
    model.summary()
    return model


def train_dqn(experiences, epochs=50, batch_size=32, gamma=0.95,
              target_update_freq=10):
    """Train DQN using experience replay."""
    if len(experiences) < batch_size:
        print(f"Not enough experiences ({len(experiences)}) for training. Need at least {batch_size}.")
        return None, None

    # Build main and target networks
    main_net = build_dqn()
    target_net = build_dqn()
    target_net.set_weights(main_net.get_weights())

    # Convert experiences to arrays
    states = np.array([e["state"] for e in experiences], dtype=np.float32)
    actions = np.array([int(e["action"]) for e in experiences], dtype=np.int32)
    rewards = np.array([e["reward"] for e in experiences], dtype=np.float32)
    next_states = np.array([e["nextState"] for e in experiences], dtype=np.float32)
    dones = np.array([e.get("done", False) for e in experiences], dtype=np.float32)

    n = len(experiences)
    losses = []

    for epoch in range(epochs):
        # Sample mini-batch
        indices = np.random.choice(n, size=min(batch_size, n), replace=False)

        batch_states = states[indices]
        batch_actions = actions[indices]
        batch_rewards = rewards[indices]
        batch_next_states = next_states[indices]
        batch_dones = dones[indices]

        # Compute targets using target network
        current_q = main_net.predict(batch_states, verbose=0)
        next_q = target_net.predict(batch_next_states, verbose=0)

        targets = current_q.copy()
        for i in range(len(indices)):
            if batch_dones[i]:
                targets[i][batch_actions[i]] = batch_rewards[i]
            else:
                targets[i][batch_actions[i]] = (
                    batch_rewards[i] + gamma * np.max(next_q[i])
                )

        loss = main_net.train_on_batch(batch_states, targets)
        losses.append(loss)

        # Update target network periodically
        if (epoch + 1) % target_update_freq == 0:
            target_net.set_weights(main_net.get_weights())

        if (epoch + 1) % 10 == 0:
            print(f"  Epoch {epoch + 1}/{epochs} — Loss: {loss:.6f}")

    return main_net, losses


def evaluate_dqn(model, experiences):
    """Evaluate trained DQN — show Q-value distributions and action preferences."""
    states = np.array([e["state"] for e in experiences], dtype=np.float32)
    q_values = model.predict(states, verbose=0)
    selected_actions = np.argmax(q_values, axis=1)

    print("\n" + "=" * 50)
    print("DQN EVALUATION")
    print("=" * 50)

    # Action distribution
    print("\nAction selection distribution:")
    for i, name in enumerate(ACTION_NAMES):
        count = np.sum(selected_actions == i)
        pct = count / len(selected_actions) * 100
        bar = "█" * int(pct / 2)
        print(f"  {name:20s}: {count:4d} ({pct:5.1f}%) {bar}")

    # Q-value statistics per action
    print("\nQ-value statistics per action:")
    for i, name in enumerate(ACTION_NAMES):
        q_col = q_values[:, i]
        print(f"  {name:20s}: mean={q_col.mean():+.4f}  std={q_col.std():.4f}  "
              f"min={q_col.min():+.4f}  max={q_col.max():+.4f}")

    # State-dependent analysis
    print("\nAction preferences by proficiency level:")
    for level, label in [(0.3, "Low (<0.3)"), (0.5, "Mid (0.3-0.7)"), (0.8, "High (>0.7)")]:
        mask = (
            (states[:, 0] < level + 0.2) & (states[:, 0] >= level - 0.2)
        ) if level != 0.8 else (states[:, 0] >= 0.7)
        if level == 0.3:
            mask = states[:, 0] < 0.3

        if mask.sum() > 0:
            preferred = np.argmax(np.bincount(selected_actions[mask], minlength=ACTION_COUNT))
            print(f"  Proficiency {label:12s}: Prefers {ACTION_NAMES[preferred]}")

    print("=" * 50)


def main():
    parser = argparse.ArgumentParser(description="Train DQN from gameplay experiences")
    parser.add_argument("--data", default="data/raw/", help="Directory with replay buffer exports")
    parser.add_argument("--output", default="models/", help="Model output directory")
    parser.add_argument("--epochs", type=int, default=50, help="Training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Mini-batch size")
    parser.add_argument("--gamma", type=float, default=0.95, help="Discount factor")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    args = parser.parse_args()

    tf.random.set_seed(args.seed)
    np.random.seed(args.seed)

    # Load experiences
    experiences = load_experiences(args.data)
    if not experiences:
        print("No experience tuples found. Run the game in Bootstrap mode first.")
        return

    # Train
    print(f"\nTraining DQN on {len(experiences)} experiences...")
    model, losses = train_dqn(
        experiences,
        epochs=args.epochs,
        batch_size=args.batch_size,
        gamma=args.gamma
    )

    if model is None:
        return

    # Evaluate
    evaluate_dqn(model, experiences)

    # Save
    output_path = Path(args.output)
    output_path.mkdir(parents=True, exist_ok=True)

    keras_path = output_path / "dqn_policy.keras"
    model.save(keras_path)
    print(f"\nKeras model saved to {keras_path}")

    # Save training metadata
    meta = {
        "trained_at": datetime.now().isoformat(),
        "experience_count": len(experiences),
        "epochs": args.epochs,
        "batch_size": args.batch_size,
        "gamma": args.gamma,
        "final_loss": float(losses[-1]) if losses else None,
        "state_size": STATE_SIZE,
        "action_count": ACTION_COUNT,
        "action_names": ACTION_NAMES,
    }
    with open(output_path / "dqn_evaluation.json", "w") as f:
        json.dump(meta, f, indent=2)

    # TF.js export instructions
    print("\n" + "=" * 50)
    print("TO EXPORT FOR BROWSER (TensorFlow.js):")
    print("=" * 50)
    print(f"  tensorflowjs_converter \\")
    print(f"    --input_format=keras \\")
    print(f"    --output_format=tfjs_layers_model \\")
    print(f"    {keras_path} \\")
    print(f"    ../public/models/dqn/")
    print("=" * 50)


if __name__ == "__main__":
    main()
