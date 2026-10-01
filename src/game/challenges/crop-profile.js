export function challengeCropData(base, task) {
  if (task.cropProfile !== "corn-5s-v1") return base;
  return { ...base, corn: { ...base.corn, duration: 5, adjacency_growth_reduction: 0 } };
}
