"""Metrics for a regression model categorized against recorded gameplay labels."""
import numpy as np

CATEGORY_NAMES = ("Beginner", "Intermediate", "Advanced")
DEFAULT_CUTOFFS = (0.3, 0.6)


def score_vector(values, name):
    result = np.asarray(values, dtype=np.float64)
    if result.ndim == 2 and result.shape[1] == 1:
        result = result[:, 0]
    if result.ndim != 1 or not len(result):
        raise ValueError(f"{name} must be a nonempty vector")
    if not np.isfinite(result).all() or ((result < 0) | (result > 1)).any():
        raise ValueError(f"{name} must contain finite scores in [0, 1]")
    return result


def categorize(values, cutoffs=DEFAULT_CUTOFFS):
    if len(cutoffs) != 2 or not 0 < cutoffs[0] < cutoffs[1] < 1:
        raise ValueError("Two strictly increasing cutoffs inside (0, 1) are required")
    # Half-open intervals: [0, lower), [lower, upper), [upper, 1].
    return np.digitize(score_vector(values, "scores"), cutoffs, right=False)


def classification_metrics(y_true, y_pred, cutoffs=DEFAULT_CUTOFFS):
    true, pred = categorize(y_true, cutoffs), categorize(y_pred, cutoffs)
    if len(true) != len(pred):
        raise ValueError("Labels and predictions must have equal lengths")
    matrix = np.zeros((3, 3), dtype=np.int64)
    np.add.at(matrix, (true, pred), 1)
    per_class = []
    for i, name in enumerate(CATEGORY_NAMES):
        tp, support, predicted = int(matrix[i, i]), int(matrix[i].sum()), int(matrix[:, i].sum())
        per_class.append({
            "category": name, "support": support, "predicted_count": predicted,
            "precision": tp / predicted if predicted else None,
            "recall": tp / support if support else None,
            "f1": 2 * tp / (support + predicted) if support + predicted else None,
        })
    result = {
        "accuracy": float(np.mean(true == pred)), "category_order": list(CATEGORY_NAMES),
        "confusion_matrix": matrix.tolist(), "confusion_matrix_axes": "rows=true, columns=predicted",
        "per_class": per_class, "observed_categories": int(np.count_nonzero(matrix.sum(axis=1))),
        "aggregation": "Macro averages include all three prespecified categories; undefined terms contribute zero. Per-class undefined metrics are null.",
    }
    for metric in ("precision", "recall", "f1"):
        result[f"macro_{metric}"] = sum(c[metric] or 0.0 for c in per_class) / 3
        result[f"weighted_{metric}"] = sum((c[metric] or 0.0) * c["support"] for c in per_class) / len(true)
    return result


def evaluate_predictions(y_true, y_pred, y_train, cutoffs=DEFAULT_CUTOFFS):
    true, pred = score_vector(y_true, "labels"), score_vector(y_pred, "predictions")
    train = score_vector(y_train, "training labels")
    if len(true) != len(pred):
        raise ValueError("Labels and predictions must have equal lengths")
    mse = float(np.mean((true - pred) ** 2))
    variance_sum = float(np.sum((true - true.mean()) ** 2))
    train_mean = float(train.mean())
    baseline_rmse = float(np.sqrt(np.mean((true - train_mean) ** 2)))
    categories = classification_metrics(true, pred, cutoffs)
    majority_category = int(np.argmax(np.bincount(categorize(train, cutoffs), minlength=3)))
    majority_scores = (cutoffs[0] / 2, sum(cutoffs) / 2, (cutoffs[1] + 1) / 2)
    warnings = [
        "Cutoffs are provisional and require research approval; do not tune them on these test predictions.",
        "Labels are a gameplay formula. Category agreement does not establish independently assessed skill or learning improvement.",
    ]
    if categories["observed_categories"] < 3:
        warnings.append("Some test categories have zero support; performance on those categories cannot be established.")
    if categories["observed_categories"] == 1:
        warnings.append("Only one category occurs in the test set. High accuracy/weighted F1 cannot demonstrate category discrimination.")
    return {
        "task": "categorized_regression_against_gameplay_proxy_labels", "test_samples": len(true),
        "cutoffs": list(cutoffs), "cutoff_status": "provisional",
        "category_intervals": [f"0 <= p < {cutoffs[0]}", f"{cutoffs[0]} <= p < {cutoffs[1]}", f"{cutoffs[1]} <= p <= 1"],
        "regression": {"mse": mse, "rmse": mse ** 0.5, "mae": float(np.mean(np.abs(true - pred))),
                       "r2": 1 - float(np.sum((true - pred) ** 2)) / variance_sum if len(true) > 1 and variance_sum > 0 else None},
        "classification": categories,
        "baselines": {
            "train_mean": {"predicted_score": train_mean, "rmse": baseline_rmse,
                           "improvement_percent": (baseline_rmse - mse ** 0.5) / baseline_rmse * 100 if baseline_rmse > 0 else None},
            "train_majority_category": {"category": CATEGORY_NAMES[majority_category],
                                        **classification_metrics(true, np.full(len(true), majority_scores[majority_category]), cutoffs)},
        },
        "learning_improvement": "unevaluated_pending_paired_pretest_posttest",
        "warnings": warnings,
    }
