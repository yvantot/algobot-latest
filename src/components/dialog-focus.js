export function dialogFocus(node) {
  const previous = document.activeElement;
  const buttons = () => [...node.querySelectorAll('button:not(:disabled), [tabindex="0"]')];
  queueMicrotask(() => buttons()[0]?.focus());
  function trap(event) {
    if (event.key !== "Tab") return;
    const items = buttons();
    const next = event.shiftKey ? items.at(-1) : items[0];
    if (document.activeElement === (event.shiftKey ? items[0] : items.at(-1)) || !node.contains(document.activeElement)) {
      event.preventDefault(); next?.focus();
    }
  }
  node.addEventListener("keydown", trap);
  return { destroy() { node.removeEventListener("keydown", trap); if (previous?.isConnected) previous.focus(); } };
}
