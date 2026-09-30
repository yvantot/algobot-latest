"""Descriptive gameplay comparison, not a learning-improvement evaluation.

Session logs cannot substitute for paired algorithmic-logic pre/post scores.
Repeated sessions are not independent students, so no unplanned significance
claims are produced. Missing groups/measurements remain null, never zero.
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
from prepare_dataset import load_sessions, summary_of, student_id_of, session_id_of, quest_attempts_of
from evaluate_model import write_new_json

METRICS = [
    ('completion_rate', 'Quest Completion Rate'), ('quests_completed', 'Quests Completed'),
    ('errors_per_quest', 'Errors per Quest'), ('total_resets', 'Total Resets'),
    ('code_success_rate', 'Code Success Rate'), ('avg_frustration', 'Avg Frustration'),
    ('avg_flow', 'Avg Flow Score'), ('max_stage', 'Max Stage Reached'),
    ('duration_minutes', 'Session Duration (min)'),
]


def _number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value) if np.isfinite(value) else None


def load_sessions_by_group(input_dir):
    groups = {'bootstrap': [], 'ml': []}
    unknown = 0
    for session in load_sessions(input_dir):
        summary = summary_of(session)
        state = session.get('agentState') if isinstance(session.get('agentState'), dict) else {}
        # Never silently assign missing, mixed, or fallback exposure to bootstrap.
        mode = session.get('dda_mode', state.get('mode', summary.get('dda_mode')))
        if mode not in groups:
            unknown += 1
            continue
        attempts = quest_attempts_of(session)
        has_attempts = 'quest_attempts' in session or 'questAttempts' in session
        attempted = _number(summary.get('total_quests_attempted', len(attempts) if has_attempts else None))
        completed = _number(summary.get('total_quests_completed', summary.get('questsCompleted',
                            sum(bool(q.get('completed')) for q in attempts) if has_attempts else None)))
        record = {
            'student_id': student_id_of(session), 'session_id': session_id_of(session) or 'unknown',
            'dda_mode': mode, 'quests_attempted': attempted, 'quests_completed': completed,
            'duration_minutes': _number(session.get('duration_minutes', summary.get('duration_minutes', summary.get('durationMinutes')))),
        }
        fields = {
            'total_errors': ('total_errors', 'totalErrors'),
            'total_resets': ('total_resets', 'totalResets'),
            'code_success_rate': ('code_run_success_rate', 'codeRunSuccessRate'),
            'avg_frustration': ('avg_frustration', 'avgFrustration'),
            'avg_flow': ('avg_flow', 'avgFlow'),
            'max_stage': ('max_stage_reached', 'currentStage'),
        }
        for key, (canonical, legacy) in fields.items():
            record[key] = _number(summary.get(canonical, summary.get(legacy)))
        record['completion_rate'] = completed / attempted if attempted and completed is not None else None
        record['errors_per_quest'] = record['total_errors'] / attempted if attempted and record['total_errors'] is not None else None
        groups[mode].append(record)
    print(f"Bootstrap sessions: {len(groups['bootstrap'])}; ML sessions: {len(groups['ml'])}; unknown/mixed exposure excluded: {unknown}")
    return groups['bootstrap'], groups['ml']


def _values(records, key):
    return np.asarray([r[key] for r in records if _number(r.get(key)) is not None], dtype=np.float64)


def compare_groups(group_a, group_b):
    results = []
    for key, label in METRICS:
        result = {'metric': label, 'key': key, 'p_value': None, 'significant': '',
                  'inference_status': 'not_tested_repeated_sessions_and_unverified_experimental_design'}
        for name, records in (('a', group_a), ('b', group_b)):
            values = _values(records, key)
            result.update({f'group_{name}_mean': float(values.mean()) if len(values) else None,
                           f'group_{name}_std': float(values.std()) if len(values) else None,
                           f'group_{name}_n': len(values)})
        results.append(result)
    return results


def create_comparison_plots(group_a, group_b, output_dir):
    if not group_a or not group_b:
        print('Comparison plot omitted: both exposure groups are required.')
        return
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
    except ImportError:
        print('matplotlib unavailable; numeric descriptive report remains available.')
        return
    path = Path(output_dir) / 'ab_comparison.png'
    if path.exists():
        raise FileExistsError(f'Will not overwrite {path}')
    fig, axes = plt.subplots(2, 3, figsize=(15, 8))
    for ax, (key, label) in zip(axes.flat, METRICS[:6]):
        for index, (name, group) in enumerate((('Bootstrap', group_a), ('ML', group_b))):
            values = _values(group, key)
            if len(values):
                ax.bar(index, values.mean(), yerr=values.std(), capsize=5)
            else:
                ax.text(index, 0, 'No data', ha='center')
        ax.set_xticks([0, 1], ['Bootstrap', 'ML'])
        ax.set_title(label)
    fig.suptitle('Descriptive session outcomes; no causal or learning-gain inference')
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def main():
    root = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', type=Path, default=root / 'data/raw')
    parser.add_argument('--output', type=Path, default=root / 'results_v2')
    args = parser.parse_args()
    if args.output.exists() and (not args.output.is_dir() or any(args.output.iterdir())):
        parser.error('Choose a new/empty output directory; historical reports are preserved')
    a, b = load_sessions_by_group(args.data)
    report = {
        'evaluation_date': datetime.now(timezone.utc).isoformat(), 'analysis_type': 'descriptive_session_outcomes',
        'comparison_status': 'descriptive_only' if a and b else 'not_evaluable_missing_exposure_group',
        'learning_improvement': 'unevaluated_pending_paired_pretest_posttest',
        'group_a_sessions': len(a), 'group_b_sessions': len(b),
        'group_a_students': len({r['student_id'] for r in a if r['student_id'] != 'unknown'}),
        'group_b_students': len({r['student_id'] for r in b if r['student_id'] != 'unknown'}),
        'metrics': compare_groups(a, b),
        'limitations': ['Sessions are repeated observations, not independent students.',
                        'Exposure modes in historical exports may describe the last mode rather than the whole session.',
                        'Missing or mixed exposure is excluded; unrecorded measures are null.',
                        'Gameplay outcomes do not measure improvement in independent algorithmic-logic test scores.'],
    }
    write_new_json(args.output / 'evaluation_report.json', report)
    create_comparison_plots(a, b, args.output)
    print(f'Saved descriptive report to {args.output}')


if __name__ == '__main__':
    main()
