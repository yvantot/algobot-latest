function cell(value) {
  let text = value == null ? "" : String(value);
  if (typeof value === "string" && /^[=+@-]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function questCSV(sessions) {
  const rows = [["student_id", "session_id", "quest_key", "stage", "completed", "observation_status",
    "observed_duration_seconds", "errors", "resets", "code_runs", "hints_shown", "gameplay_proxy_label"]];
  for (const session of sessions) for (const a of session.quest_attempts ?? []) rows.push([
    session.student_id, session.session_id, a.quest_key, a.stage, a.completed ? 1 : 0,
    a.observation_status ?? "legacy", a.observed_duration_seconds ?? a.duration_seconds,
    a.errors, a.resets, a.code_runs, a.hints_shown, a.proficiency_label,
  ]);
  return rows.map(row => row.map(cell).join(",")).join("\n");
}
