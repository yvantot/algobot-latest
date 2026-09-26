# Provisional LSTM replacement in 1.3.3

At the user's explicit request, the legacy 20-by-10 gameplay-proxy LSTM was replaced with a 20-by-12 recent-gameplay LSTM. The new target is the first evaluated Your first harvest task score divided by its maximum, not a validated measure of general programming proficiency. This is an experimental active deployment despite weak pilot results; it is not a claim that the new model is more accurate.

The refit uses all five compatible participants from the September 26 batch, seed 42, the existing 8-unit LSTM and a scaler fitted on those five training sequences. Training lasts one epoch, the median of the pilot's validation-selected durations (1, 60, 1, 1, 36). No model or duration was chosen from held-out test errors. The final refit has no independent accuracy estimate; [pilot results](PILOT_RESULTS_2026-09-26.md) describe different fold models and remain unchanged. More epochs alone would not fix the lack of evidence.

Reproduction command, using a new output directory:

```powershell
npm run model -- refit-pilot training/prepared/collection-2026-09-26/first-harvest.json training/prepared/pilot-2026-09-26 training/prepared/refit-2026-09-26
```

The command checks input/plan hashes, trains the full-data model, verifies reload parity and creates `lstm/` with model topology, weights, scaler and a participant-free model card. It does not copy into public assets automatically. This explicit deployment copies those four files into `public/models/lstm`. `deployment_ready: false` in the card means statistical suitability has not been established; `status: provisional` identifies why it is nevertheless active. Do not present the pilot's 20% category accuracy as an evaluation of the full-data refit.

The browser uses the existing shared recent-feature normalization, waits for 21 contiguous normal-speed gameplay snapshots, and falls back to recent-performance rules when history is insufficient. High predicted scores still require successful gameplay before increasing challenge, with the existing policy confirmation and cooldown. Existing thresholds (assistance below 0.3, challenge above 0.7 plus successful gameplay) are provisional policy choices, not validated equivalents of broad student proficiency. Challenge category reporting still uses 0.3/0.6. No DQN was enabled.

Runtime loading bypasses cached model/scaler responses. DDA action records and agent diagnostics include the model ID, provisional status and prediction task, so later exports can distinguish the model used. Raw training exports remain unchanged and uncommitted. The public model card contains aggregate metrics and hashes, not participant IDs or raw observations.

The old LSTM is preserved at Git baseline `008bc124204c7ff47e90e051625dcbb2bba22cd4`; its preservation-manifest entries now read from Git history. The pre-deployment application commit is `a927c9c`. Reverting this deployment commit restores the previous runtime, model and scaler together. The unused historical DQN files are unchanged.

Verification: 243 tests passed, including actual installed-model runtime prediction, warm-up fallback, model identity logging, file hashes, full-data refit guards and tensor cleanup. All 40 historical artifact checks passed. Production build passed with existing UI accessibility/chunk-size warnings.
