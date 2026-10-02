import { mount } from "svelte";
import "./index.css";
import App from "./App.svelte";

import { startErrorReporting } from './game/diagnostics.js';
import { uploadConfig } from './game/ml/cloud-upload.js';
import { telemetry } from './game/ml/telemetry.js';
let diagnosticStorage;
try { diagnosticStorage = localStorage; } catch { /* Reporting can use memory if storage is unavailable. */ }
function diagnosticParticipant() {
  if (telemetry.participantId !== 'anonymous') return telemetry.participantId;
  const requested = new URLSearchParams(location.search).get('study_participant');
  if (requested) return requested;
  try { return diagnosticStorage?.getItem('algobot_participant_id'); } catch { return null; }
}
const stopReporting = startErrorReporting({ config: uploadConfig(), storage: diagnosticStorage, context: () => ({
  participant: diagnosticParticipant(),
  session: telemetry.sessionId,
  build: typeof __BUILD_PROVENANCE__ === 'undefined' ? 'development' : __BUILD_PROVENANCE__.commit,
}) });
if (import.meta.hot) import.meta.hot.dispose(stopReporting);

const app = mount(App, {
  target: document.getElementById("app"),
});

export default app;
