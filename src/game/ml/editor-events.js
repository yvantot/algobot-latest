export function isBlocklyProgramEdit(event) {
  if (!event.recordUndo || event.isUiEvent) return false;
  if (["create", "delete", "change", "var_create", "var_delete", "var_rename"].includes(event.type)) return true;
  // Moving a block on the canvas is layout; connecting it changes the program.
  return event.type === "move" && (event.oldParentId !== event.newParentId || event.oldInputName !== event.newInputName);
}
