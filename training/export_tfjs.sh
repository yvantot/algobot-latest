#!/bin/bash
# Export trained Keras models to TensorFlow.js format for browser inference.
# Run this after train_lstm.py and train_dqn.py.
#
# Prerequisites:
#   pip install tensorflowjs

set -e

echo "=== Exporting LSTM to TensorFlow.js ==="
tensorflowjs_converter \
  --input_format=keras \
  --output_format=tfjs_layers_model \
  models/lstm_proficiency.keras \
  ../public/models/lstm/

echo ""
echo "=== Exporting DQN to TensorFlow.js ==="
tensorflowjs_converter \
  --input_format=keras \
  --output_format=tfjs_layers_model \
  models/dqn_policy.keras \
  ../public/models/dqn/

echo ""
echo "✅ Models exported to ../public/models/"
echo "   LSTM: ../public/models/lstm/model.json"
echo "   DQN:  ../public/models/dqn/model.json"
echo ""
echo "Restart the game — it will automatically detect and load the trained models."
