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
    python train_dqn.py --data data/raw/ --output models_dqn_v2/
"""

import json
import argparse
import numpy as np
from pathlib import Path
from datetime import datetime

# Constants
STATE_SIZE = 4
ACTION_COUNT = 5
ACTION_NAMES = ["Normal", "Scaffold", "Challenge", "Greedy Guide", "State Optimize"]


def load_experiences(input_dir):
    """Deduplicate overlapping replay exports and validate Bellman-update inputs."""
    candidates = []
    for path in sorted(Path(input_dir).glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8-sig"))
        except (ValueError, OSError):
            continue
        if isinstance(data, list) and "replay" in path.name.lower():
            candidates.extend(data)
        elif isinstance(data, dict):
            sessions = data.get("sessions", [data])
            for session in sessions if isinstance(sessions, list) else [sessions]:
                if isinstance(session, dict) and isinstance(session.get("replay_buffer"), list):
                    candidates.extend(session["replay_buffer"])
    valid, seen = [], set()
    invalid = 0
    for exp in candidates:
        try:
            if not isinstance(exp, dict):
                raise ValueError()
            state = np.asarray(exp["state"], dtype=np.float64)
            next_state = np.asarray(exp["nextState"], dtype=np.float64)
            action, reward = exp["action"], exp["reward"]
            done = exp.get("done", False)
            if (state.shape != (STATE_SIZE,) or next_state.shape != (STATE_SIZE,)
                    or not np.isfinite(state).all() or not np.isfinite(next_state).all()
                    or isinstance(action, bool) or not isinstance(action, (int, float))
                    or not np.isfinite(action) or int(action) != action or not 0 <= action < ACTION_COUNT
                    or isinstance(reward, bool) or not isinstance(reward, (int, float)) or not np.isfinite(reward)
                    or not isinstance(done, (bool, int)) or done not in (False, True)):
                raise ValueError()
            # Include timestamps to retain distinct visits to an identical state.
            identity = json.dumps([state.tolist(), int(action), float(reward), next_state.tolist(),
                                   bool(done), exp.get("timestamp"), exp.get("session_id")], sort_keys=True)
            if identity not in seen:
                seen.add(identity)
                valid.append({**exp, "action": int(action), "done": bool(done)})
        except (KeyError, ValueError, TypeError, OverflowError):
            invalid += 1
    print(f"Loaded {len(valid)} unique experiences from {len(candidates)} records; {invalid} invalid")
    return valid


def action_coverage(experiences):
    counts = np.bincount([e["action"] for e in experiences], minlength=ACTION_COUNT)
    return {
        "counts": {name: int(counts[i]) for i, name in enumerate(ACTION_NAMES)},
        "unsupported_action_ids": np.flatnonzero(counts == 0).tolist(),
        "policy_effectiveness": "unevaluated",
        "warning": "Action support is necessary but insufficient for policy validation. Offline TD loss and Q-values do not demonstrate learning benefit.",
    }


def build_dqn():
    """Build DQN model matching browser architecture."""
    import tensorflow as tf
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
            print(f"  Epoch {epoch + 1}/{epochs} - Loss: {loss:.6f}")

    return main_net, losses


def evaluate_dqn(model, experiences):
    """Evaluate trained DQN - show Q-value distributions and action preferences."""
    states = np.array([e["state"] for e in experiences], dtype=np.float32)
    q_values = model.predict(states, verbose=0)
    selected_actions = np.argmax(q_values, axis=1)

    print("\n" + "=" * 50)
    print("DQN IN-SAMPLE DIAGNOSTICS (NOT POLICY EFFECTIVENESS)")
    print("=" * 50)

    # Action distribution
    print("\nAction selection distribution:")
    for i, name in enumerate(ACTION_NAMES):
        count = np.sum(selected_actions == i)
        pct = count / len(selected_actions) * 100
        bar = "#" * int(pct / 2)
        print(f"  {name:20s}: {count:4d} ({pct:5.1f}%) {bar}")

    # Q-value statistics per action
    print("\nQ-value statistics per action:")
    for i, name in enumerate(ACTION_NAMES):
        q_col = q_values[:, i]
        print(f"  {name:20s}: mean={q_col.mean():+.4f}  std={q_col.std():.4f}  "
              f"min={q_col.min():+.4f}  max={q_col.max():+.4f}")

    # State-dependent analysis
    print("\nAction preferences by proficiency level:")
    for level, label in [(0.3, "Low (<0.3)"), (0.45, "Mid (0.3-0.6)"), (0.8, "High (>=0.6)")]:
        mask = states[:, 0] < 0.3 if level == 0.3 else (
            (states[:, 0] >= 0.3) & (states[:, 0] < 0.6) if level == 0.45 else states[:, 0] >= 0.6)


        if mask.sum() > 0:
            preferred = np.argmax(np.bincount(selected_actions[mask], minlength=ACTION_COUNT))
            print(f"  Proficiency {label:12s}: Prefers {ACTION_NAMES[preferred]}")

    print("=" * 50)


def main():
    root = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description="Train DQN from gameplay experiences")
    parser.add_argument("--data", default=str(root / "data/raw"), help="Directory with replay buffer exports")
    parser.add_argument("--output", default=str(root / "models_dqn_v2"), help="Model output directory")
    parser.add_argument("--epochs", type=int, default=50, help="Training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Mini-batch size")
    parser.add_argument("--gamma", type=float, default=0.95, help="Discount factor")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--allow-unsupported-actions", action="store_true", help="Exploratory training only; outputs remain unvalidated for deployment")
    args = parser.parse_args()

    output_path = Path(args.output)
    if output_path.exists() and (not output_path.is_dir() or any(output_path.iterdir())):
        parser.error("Output must be a new or empty directory; existing models are preserved")

    # Load experiences
    experiences = load_experiences(args.data)
    if not experiences:
        print("No experience tuples found. Run the game in Bootstrap mode first.")
        return

    coverage = action_coverage(experiences)
    print(json.dumps(coverage, indent=2))
    if coverage["unsupported_action_ids"] and not args.allow_unsupported_actions:
        parser.error("Replay data has unsupported actions. Cannot train a supported five-action policy. --allow-unsupported-actions permits explicitly exploratory training only.")
    import tensorflow as tf
    tf.keras.utils.set_random_seed(args.seed)
    tf.config.experimental.enable_op_determinism()
    np.random.seed(args.seed)

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
        "seed": args.seed,
        "action_coverage": coverage,
        "evaluation_type": "in_sample_training_diagnostics",
        "deployment_validated": False,
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

    policy_metadata = {"schema_version": 1, "deployment_ready": False,
                       "observed_action_counts": {str(i): sum(e["action"] == i for e in experiences) for i in range(ACTION_COUNT)},
                       "reason": "Training diagnostics are not independent evidence of policy effectiveness."}
    (output_path / "policy_metadata.json").write_text(json.dumps(policy_metadata, indent=2), encoding="utf-8")

    print("Export to a new folder and verify inference before promotion:")
    print(f'  python "{root / "export_tfjs.py"}" --dqn "{keras_path}" --public-dir "{output_path / "tfjs_export"}"')



if __name__ == "__main__":
    main()
