# Fresh collection starting September 24, 2026

The previous collected exports, processed datasets, generated training examples,
experimental candidates and evaluation results were removed at the researcher's
request. The collection tools and assessment template remain ready for new data.

Recovery point: Git tag `checkpoint/pre-data-reset-2026-09-24`
(commit `12c65c70b57ff32718770af71044b9a63cd57074`). This is a working-tree reset,
not an erasure from Git history. Historical documentation describes the retired
pilot study; it is not an evaluation of the next dataset.

The deployed LSTM, its matching scaler and original Keras models remain legacy
models. They have not been retrained or validated on the new collection. DQN
artifacts remain historical and are not used by the game.

Browser-local research storage is separate from repository files. Before the new
collection, use the Dev Console's Clear Stored Data action to remove old local
sessions and replay records, then reload with the new participant code. Repository
cleanup does not clear an already-open browser or its in-memory session.

Follow `documentation/DATA_COLLECTION_PROTOCOL.md` for the new collection. Put
only new exports in `training/data/raw/`; keep independent assessment scores in
their own file and use the scored-task preparation command.
