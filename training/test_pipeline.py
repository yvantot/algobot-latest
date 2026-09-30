"""Regression checks runnable with NumPy and unittest; no TensorFlow required."""
import json
import tempfile
import unittest
from pathlib import Path
import numpy as np

from prepare_dataset import extract_training_samples, load_sessions, normalize_features, split_indices
from model_metrics import categorize, evaluate_predictions
from evaluate_model import split_status, write_new_json
from train_dqn import load_experiences, action_coverage
from evaluate import compare_groups, load_sessions_by_group
from export_tfjs import validate_scaler, validate_layer_config
from train_lstm import augment_data
from prepare_dataset import FEATURE_NAMES


def quest(end, value, label=0.8):
    return {"quest_key": str(end), "endTime": end, "featureVectorAtEnd": [value] * 10,
            "proficiencyLabel": label, "completed": True}


class PreparationTests(unittest.TestCase):
    def test_legacy_uses_chronological_endpoints_and_no_future(self):
        session = {"student_id": "a", "session_id": "s", "questAttempts": [quest(2000, .2), quest(1000, .1)],
                   "featureSnapshots": [{"index": 0, "vector": [.99] * 10}]}
        X, y, meta = extract_training_samples([session])
        np.testing.assert_allclose(X[0, -2:, 0], [.1, .2])
        np.testing.assert_allclose(X[1, -1, 0], .1)
        self.assertEqual(meta[0]["sequence_source"], "legacy_quest_end_vectors")
        self.assertEqual(np.count_nonzero(X[1, :-1]), 0)

    def test_timestamped_snapshots_exclude_later_observations(self):
        session = {"student_id": "a", "quest_attempts": [quest(2000, .2, 0)],
                   "feature_timeseries": [{"timestamp_ms": t, "vector": [v] * 10}
                                          for t, v in [(3000, .9), (1500, .15), (1000, .1)]]}
        X, y, meta = extract_training_samples([session])
        np.testing.assert_allclose(X[0, -2:, 0], [.1, .15])
        self.assertEqual(float(y[0]), 0)
        self.assertEqual(meta[0]["real_timesteps"], 2)

    def test_relative_snapshots_and_canonical_quest(self):
        session = {"start_time": "1970-01-01T00:00:01Z", "quest_attempts": [
            {"end_time": "1970-01-01T00:00:02Z", "proficiency_label": .9, "feature_vector_end": [.4] * 10}],
            "feature_timeseries": [{"t": 500, "vector": [.2] * 10}, {"t": 1500, "vector": [.8] * 10}]}
        X, _, meta = extract_training_samples([session])
        np.testing.assert_allclose(X[0, -1], [.2] * 10)
        self.assertEqual(meta[0]["sequence_source"], "timestamped_snapshots")

    def test_no_synthetic_labels_or_all_zero_placeholder_samples(self):
        unlabelled = {"featureSnapshots": [{"vector": [.5] * 10}], "summary": {"questsCompleted": 1}}
        no_features = {"questAttempts": [{"proficiencyLabel": .9}]}
        X, y, _ = extract_training_samples([unlabelled, no_features])
        self.assertEqual(X.shape, (0, 20, 10))
        self.assertEqual(len(y), 0)

    def test_latest_complete_export_wins_over_first_incomplete_record(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            (path / "a.json").write_text(json.dumps({"session_id": "s", "questAttempts": []}))
            (path / "b.json").write_text(json.dumps({"session_id": "s", "questAttempts": [quest(1000, .1)]}))
            sessions = load_sessions(path)
            self.assertEqual(len(sessions), 1)
            self.assertEqual(len(sessions[0]["questAttempts"]), 1)

    def test_students_are_disjoint_and_seeded(self):
        metadata = [{"student_id": name} for name in ("a", "a", "b", "c", "d", "d")]
        splits = split_indices(metadata)
        self.assertEqual(sorted(np.concatenate(list(splits.values())).tolist()), list(range(6)))
        groups = [{metadata[i]["student_id"] for i in split} for split in splits.values()]
        self.assertFalse(groups[0] & groups[1] or groups[0] & groups[2] or groups[1] & groups[2])
        for key, rows in split_indices(metadata).items():
            np.testing.assert_array_equal(rows, splits[key])

    def test_insufficient_or_unknown_students_fail_instead_of_copying(self):
        for names in (("a", "b"), ("a", "b", "unknown")):
            with self.assertRaises(ValueError):
                split_indices([{"student_id": name} for name in names])

    def test_scaler_fitted_on_training_only(self):
        train = np.zeros((1, 20, 10), dtype=np.float32)
        train[0, -1] = .5
        val = np.ones((1, 20, 10), dtype=np.float32)
        a, b, c, scaler = normalize_features(train, val, val)
        np.testing.assert_allclose(b, 2)
        self.assertEqual(scaler["feature_max"], [.5] * 10)

    def test_noise_augmentation_preserves_padding(self):
        X = np.zeros((1, 20, 10), dtype=np.float32)
        X[0, -1] = .5
        augmented, labels = augment_data(X, np.asarray([.8]))
        self.assertEqual(np.count_nonzero(augmented[:, :-1]), 0)
        self.assertEqual(len(labels), 2)

    def test_export_rejects_mismatched_scaler_contract(self):
        scaler = {"feature_min": [0] * 10, "feature_max": [1] * 10,
                  "feature_range": [1] * 10, "feature_names": FEATURE_NAMES}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "scaler.json"
            path.write_text(json.dumps(scaler))
            self.assertEqual(validate_scaler(path), scaler)
            for change in ({"feature_names": list(reversed(FEATURE_NAMES))}, {"feature_range": [.5] * 10}):
                path.write_text(json.dumps({**scaler, **change}))
                with self.assertRaises(ValueError):
                    validate_scaler(path)

    def test_export_rejects_silently_changed_activation(self):
        class Layer:
            name = "proficiency_output"

            def get_config(self):
                return {"activation": "tanh", "units": 1}

        with self.assertRaises(ValueError):
            validate_layer_config(Layer(), activation="sigmoid", units=1)


class MetricsTests(unittest.TestCase):
    def test_boundary_categories_are_prespecified(self):
        np.testing.assert_array_equal(categorize([0, .299, .3, .599, .6, 1]), [0, 0, 1, 1, 2, 2])

    def test_perfect_single_class_does_not_claim_three_class_discrimination(self):
        report = evaluate_predictions([.8, .9], [.85, .95], [.8, .9])
        metrics = report["classification"]
        self.assertEqual(metrics["accuracy"], 1)
        self.assertAlmostEqual(metrics["macro_f1"], 1 / 3)
        self.assertEqual(metrics["weighted_f1"], 1)
        self.assertIsNone(metrics["per_class"][0]["recall"])
        self.assertEqual(metrics["per_class"][0]["support"], 0)
        self.assertIn("unevaluated", report["learning_improvement"])

    def test_baseline_uses_training_mean_not_test_mean(self):
        report = evaluate_predictions([.8, 1], [.8, 1], [.2, .4])
        self.assertAlmostEqual(report["baselines"]["train_mean"]["predicted_score"], .3)
        self.assertAlmostEqual(report["baselines"]["train_mean"]["rmse"], np.sqrt(.37))

    def test_constant_labels_and_baseline_serialize_without_nan(self):
        report = evaluate_predictions([1, 1], [1, 1], [1])
        self.assertIsNone(report["regression"]["r2"])
        self.assertIsNone(report["baselines"]["train_mean"]["improvement_percent"])
        json.dumps(report, allow_nan=False)

    def test_invalid_or_misaligned_predictions_fail(self):
        for values in ([float("nan")], [float("inf")], [1.1], [-.1], [.8, .9]):
            with self.assertRaises(ValueError):
                evaluate_predictions([.8], values, [.8])

    def test_confusion_matrix_and_macro_metrics(self):
        report = evaluate_predictions([.1, .4, .9, .8], [.1, .9, .4, .8], [.1, .4, .9])
        self.assertEqual(report["classification"]["confusion_matrix"], [[1, 0, 0], [0, 0, 1], [0, 1, 1]])
        self.assertEqual(report["classification"]["accuracy"], .5)
        self.assertAlmostEqual(report["classification"]["macro_f1"], .5)

    def test_output_refuses_to_replace_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "report.json"
            write_new_json(path, {"old": True})
            with self.assertRaises(FileExistsError):
                write_new_json(path, {"old": False})
            self.assertTrue(json.loads(path.read_text())["old"])

    def test_manifest_overlap_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            self.assertEqual(split_status(path)["status"], "historical_split_unverified")
            for split in ("train", "val", "test"):
                np.save(path / f"y_{split}.npy", [.8])
            manifest = {"split_unit": "student_id", "partitions": {
                split: [{"student_id": "same"}] for split in ("train", "val", "test")}}
            (path / "split_manifest.json").write_text(json.dumps(manifest))
            with self.assertRaises(ValueError):
                split_status(path)


class ReplayAndExposureTests(unittest.TestCase):
    def test_replay_deduplicates_exports_and_rejects_invalid_actions(self):
        record = {"state": [.5, .2, 0, .5], "action": 0, "reward": .2,
                  "nextState": [.5, .2, 0, .5], "done": False, "timestamp": 1000}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            invalid = [{**record, "action": a} for a in (-1, 5, 1.5, True)]
            invalid += [{**record, "reward": float("nan")}, {**record, "done": "false"}]
            (path / "replay.json").write_text(json.dumps([record, *invalid]))
            (path / "dataset.json").write_text(json.dumps({"sessions": [{"replay_buffer": [record]}]}))
            loaded = load_experiences(path)
            self.assertEqual(len(loaded), 1)
            self.assertEqual(action_coverage(loaded)["unsupported_action_ids"], [1, 2, 3, 4])

    def test_missing_group_is_null_not_zero(self):
        records = [{"completion_rate": .5}]
        result = compare_groups(records, [])[0]
        self.assertEqual(result["group_a_mean"], .5)
        self.assertIsNone(result["group_b_mean"])
        self.assertIsNone(result["p_value"])

    def test_unknown_mode_not_silently_assigned_to_bootstrap(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            (path / "dataset.json").write_text(json.dumps({"sessions": [
                {"session_id": "unknown", "summary": {}},
                {"session_id": "known", "agentState": {"mode": "bootstrap"}, "summary": {}}]}))
            a, b = load_sessions_by_group(path)
            self.assertEqual(len(a), 1)
            self.assertEqual(len(b), 0)
            self.assertIsNone(a[0]["avg_flow"])


if __name__ == "__main__":
    unittest.main()
