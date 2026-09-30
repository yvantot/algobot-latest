// Fixed collection conditions for research sessions (adviser-approved, September 2026).
// Active only when the researcher opened the game with an assigned participant code.
// Ordinary play keeps every speed setting and the adaptive difficulty policy.
export const STUDY_PROTOCOL = Object.freeze({
  id: "fixed-conditions-v1",
  game_speed: 1,
  difficulty: "fixed_normal",
  scheduled_hazards: false,
  task_order: Object.freeze(["first-harvest-v1", "careful-steps-v1"]),
  fresh_window_after_previous_task: true,
});

const TASK_TITLES = { "first-harvest-v1": "Your first harvest", "careful-steps-v1": "Two careful steps" };

export const studyProtocolFor = participantSource =>
  participantSource === "researcher_assigned_code" ? STUDY_PROTOCOL : null;

// Pause (0) is always allowed; otherwise only the fixed study speed.
export const studySpeedAllowed = (protocol, speed) => !protocol || speed === 0 || speed === protocol.game_speed;

// Tasks in the study order must be opened in that order. Other tasks wait until the
// ordered tasks have been opened, so optional practice cannot precede a study task.
export function studyTaskGate(protocol, taskId, openedTaskIds = []) {
  if (!protocol || openedTaskIds.includes(taskId)) return { allowed: true };
  const next = protocol.task_order.find(id => !openedTaskIds.includes(id));
  if (!next || next === taskId) return { allowed: true };
  return { allowed: false, next, reason: `Study order: try "${TASK_TITLES[next] ?? next}" first.` };
}

// The next task's gameplay window must start after the previous challenge ended,
// so its input reflects fresh farming rather than the window used for the earlier task.
export function studyWindowStart(protocol, attempts = [], before = Infinity) {
  if (!protocol?.fresh_window_after_previous_task) return -Infinity;
  const ends = attempts
    .map(attempt => Date.parse(attempt.finished_at ?? attempt.started_at))
    .filter(time => Number.isFinite(time) && time < before);
  return ends.length ? Math.max(...ends) : -Infinity;
}

export const studyTaskTitle = taskId => TASK_TITLES[taskId] ?? taskId;
