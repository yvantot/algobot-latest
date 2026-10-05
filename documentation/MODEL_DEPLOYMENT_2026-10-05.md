# Objective 4 model promotion — 5 October 2026

The user requested deployment of the model evaluated under thesis Objective 4. The production bundle now contains the augmented first-harvest holdout checkpoint, seed 42, epoch 6, with 20 observations and 14 features (active-14f-v2). The runtime already supports this schema; the difficulty policy and fixed study protocol are unchanged.

The topology and weights are byte-identical to the saved Objective 4 candidate. Scaling values and feature order are unchanged; only model_status changes from research-candidate to provisional. No refitting or test-based checkpoint selection occurred. The careful-steps model remains a separate evaluation model.

Training used 19 real participants and a training-only pool of 90 augmented sequences; validation used five participants and testing used five others. The eight-unit LSTM and sigmoid output have 745 parameters. The model card records hashes, selection provenance, and aggregate evaluation results without student records.

The deployed checkpoint achieved 60% accuracy, macro precision 0.2000, recall 0.3333, F1 0.2500, MAE 0.1812 and RMSE 0.1840 on its five-student holdout. All predictions were Intermediate. Separate five-fold models obtained 41.38% accuracy and RMSE 0.3597. Augmentation did not establish a generalization benefit; the training-mean baseline had lower cross-validation error.

This is an experimental deployment, not a claim of validated general proficiency measurement. The output estimates a normalized first-harvest score. Explicit rules combine it with recent gameplay and curriculum stage to adjust farming conditions and guidance. Researcher-assigned study sessions continue to apply Normal difficulty and log proposed adjustments.

Production uses the existing main-branch Cloudflare build and upload-configuration verification. Deployment must be confirmed from successful build status and the live model file hashes. The prior bundle is recoverable from commit 71f6c1e; it is not overwritten in the Objective 4 research archive.
