"""
Algobot A/B Experimental Evaluation
=====================================
Compares Group A (Bootstrap DDA) vs Group B (ML DDA) across educational metrics.

Statistical tests: Mann-Whitney U (non-parametric, robust to small samples).

Usage:
    python evaluate.py --data data/raw/ --output results/
"""

import json
import argparse
import numpy as np
from pathlib import Path
from datetime import datetime

try:
    from scipy import stats as scipy_stats
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False
    print("Warning: scipy not installed — statistical tests will be skipped")

try:
    import matplotlib.pyplot as plt
    import matplotlib
    matplotlib.use("Agg")
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False


def load_sessions_by_group(input_dir):
    """Load sessions and split by DDA mode (bootstrap vs ml)."""
    input_path = Path(input_dir)
    group_a = []  # Bootstrap DDA
    group_b = []  # ML DDA
    seen_session_ids = set()

    json_files = [f for f in input_path.glob("*.json") if "replay" not in f.name.lower()]

    for json_file in json_files:
        with open(json_file, "r") as f:
            try:
                data = json.load(f)
            except Exception:
                continue

        if not isinstance(data, dict):
            continue

        raw_sessions = data.get("sessions", [data])
        if not isinstance(raw_sessions, list):
            raw_sessions = [raw_sessions]

        for session in raw_sessions:
            if not isinstance(session, dict):
                continue

            sid = (
                session.get("session_id")
                or session.get("sessionId")
                or session.get("summary", {}).get("sessionId")
                or session.get("summary", {}).get("session_id")
            )
            if sid:
                if sid in seen_session_ids:
                    continue
                seen_session_ids.add(sid)

            mode = session.get("dda_mode", "bootstrap")
            summary = session.get("summary", {}) if isinstance(session.get("summary"), dict) else {}

            quest_attempts = session.get("quest_attempts") or session.get("questAttempts") or []
            if isinstance(quest_attempts, dict):
                quest_attempts = list(quest_attempts.values())

            quests_attempted = summary.get("total_quests_attempted", len(quest_attempts))
            quests_completed = summary.get("total_quests_completed", summary.get("questsCompleted", len([q for q in quest_attempts if q.get("completed")])))

            record = {
                "student_id": session.get("student_id") or summary.get("participantId") or "unknown",
                "session_id": sid or "unknown",
                "duration_minutes": summary.get("duration_minutes", summary.get("durationMinutes", session.get("duration_minutes", 0))),
                "quests_attempted": quests_attempted,
                "quests_completed": quests_completed,
                "total_errors": summary.get("total_errors", summary.get("totalErrors", 0)),
                "total_resets": summary.get("total_resets", summary.get("totalResets", 0)),
                "total_code_runs": summary.get("total_code_runs", summary.get("totalCodeRuns", 0)),
                "code_success_rate": summary.get("code_run_success_rate", summary.get("codeRunSuccessRate", 0)),
                "total_hints": summary.get("total_hints_shown", summary.get("totalHintsShown", 0)),
                "max_stage": summary.get("max_stage_reached", summary.get("currentStage", 1)),
                "avg_frustration": summary.get("avg_frustration", summary.get("avgFrustration", 0)),
                "avg_flow": summary.get("avg_flow", summary.get("avgFlow", 0.5)),
                "dda_mode": mode,
            }

            # Compute quest completion rate
            if record["quests_attempted"] > 0:
                record["completion_rate"] = record["quests_completed"] / record["quests_attempted"]
            else:
                record["completion_rate"] = 0

            # Compute errors per quest
            record["errors_per_quest"] = (
                record["total_errors"] / max(1, record["quests_attempted"])
            )

            if mode == "ml":
                group_b.append(record)
            else:
                group_a.append(record)

    print(f"Group A (Bootstrap DDA): {len(group_a)} sessions")
    print(f"Group B (ML DDA):        {len(group_b)} sessions")
    return group_a, group_b


def compare_groups(group_a, group_b):
    """Compare groups across all evaluation metrics."""
    metrics = [
        ("completion_rate", "Quest Completion Rate"),
        ("quests_completed", "Quests Completed"),
        ("errors_per_quest", "Errors per Quest"),
        ("total_resets", "Total Resets"),
        ("code_success_rate", "Code Success Rate"),
        ("avg_frustration", "Avg Frustration"),
        ("avg_flow", "Avg Flow Score"),
        ("max_stage", "Max Stage Reached"),
        ("duration_minutes", "Session Duration (min)"),
    ]

    results = []

    print("\n" + "=" * 80)
    print(f"{'Metric':<25s} {'Group A (Boot.)':<18s} {'Group B (ML)':<18s} {'p-value':<10s} {'Sig.':<5s}")
    print("=" * 80)

    for key, label in metrics:
        a_vals = np.array([r[key] for r in group_a], dtype=np.float64)
        b_vals = np.array([r[key] for r in group_b], dtype=np.float64)

        a_mean = a_vals.mean() if len(a_vals) > 0 else 0
        a_std = a_vals.std() if len(a_vals) > 0 else 0
        b_mean = b_vals.mean() if len(b_vals) > 0 else 0
        b_std = b_vals.std() if len(b_vals) > 0 else 0

        # Mann-Whitney U test
        p_value = None
        significant = ""
        if HAS_SCIPY and len(a_vals) >= 3 and len(b_vals) >= 3:
            try:
                stat, p_value = scipy_stats.mannwhitneyu(a_vals, b_vals, alternative="two-sided")
                significant = "*" if p_value < 0.05 else ""
                if p_value < 0.01:
                    significant = "**"
                if p_value < 0.001:
                    significant = "***"
            except Exception:
                pass

        p_str = f"{p_value:.4f}" if p_value is not None else "N/A"
        print(f"{label:<25s} {a_mean:>6.3f} +/- {a_std:<6.3f}  {b_mean:>6.3f} +/- {b_std:<6.3f}  {p_str:<10s} {significant}")

        results.append({
            "metric": label,
            "key": key,
            "group_a_mean": float(a_mean),
            "group_a_std": float(a_std),
            "group_a_n": len(a_vals),
            "group_b_mean": float(b_mean),
            "group_b_std": float(b_std),
            "group_b_n": len(b_vals),
            "p_value": float(p_value) if p_value is not None else None,
            "significant": significant,
        })

    print("=" * 80)
    print("Significance: * p<0.05, ** p<0.01, *** p<0.001")

    return results


def create_comparison_plots(group_a, group_b, output_dir):
    """Generate comparison bar charts."""
    if not HAS_MATPLOTLIB:
        print("matplotlib not available - skipping plots")
        return

    metrics = [
        ("completion_rate", "Quest Completion Rate"),
        ("errors_per_quest", "Errors per Quest"),
        ("avg_frustration", "Avg Frustration"),
        ("avg_flow", "Avg Flow Score"),
        ("max_stage", "Max Stage Reached"),
        ("code_success_rate", "Code Success Rate"),
    ]

    fig, axes = plt.subplots(2, 3, figsize=(15, 8))
    axes = axes.flatten()

    for idx, (key, label) in enumerate(metrics):
        ax = axes[idx]
        a_vals = [r[key] for r in group_a]
        b_vals = [r[key] for r in group_b]

        a_mean = np.mean(a_vals) if a_vals else 0
        b_mean = np.mean(b_vals) if b_vals else 0
        a_std = np.std(a_vals) if a_vals else 0
        b_std = np.std(b_vals) if b_vals else 0

        bars = ax.bar(
            ["Bootstrap DDA", "ML DDA"],
            [a_mean, b_mean],
            yerr=[a_std, b_std],
            color=["#f59e0b", "#3b82f6"],
            capsize=5,
            alpha=0.8
        )
        ax.set_title(label, fontsize=10, fontweight="bold")
        ax.grid(axis="y", alpha=0.3)

    plt.suptitle("Algobot A/B Evaluation: Bootstrap DDA vs ML DDA", fontsize=14, fontweight="bold")
    plt.tight_layout()

    plot_path = Path(output_dir) / "ab_comparison.png"
    plt.savefig(plot_path, dpi=150)
    plt.close()
    print(f"\nComparison plot saved to {plot_path}")


def main():
    parser = argparse.ArgumentParser(description="A/B evaluation: Bootstrap DDA vs ML DDA")
    parser.add_argument("--data", default="data/raw/", help="Directory with session exports")
    parser.add_argument("--output", default="results/", help="Output directory for results")
    args = parser.parse_args()

    # Load
    group_a, group_b = load_sessions_by_group(args.data)

    if not group_a and not group_b:
        print("No session data found. Export gameplay data from the game first.")
        return

    # Compare
    results = compare_groups(group_a, group_b)

    # Save results
    output_path = Path(args.output)
    output_path.mkdir(parents=True, exist_ok=True)

    report = {
        "evaluation_date": datetime.now().isoformat(),
        "group_a_sessions": len(group_a),
        "group_b_sessions": len(group_b),
        "group_a_students": len(set(r["student_id"] for r in group_a)),
        "group_b_students": len(set(r["student_id"] for r in group_b)),
        "metrics": results,
    }

    with open(output_path / "evaluation_report.json", "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nEvaluation report saved to {output_path / 'evaluation_report.json'}")

    # Plots
    create_comparison_plots(group_a, group_b, args.output)


if __name__ == "__main__":
    main()
