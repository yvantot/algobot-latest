# Algobot — Project Setup Guide

> For the current research status and checked commands, start with [README.md](README.md) and [documentation/RESEARCH_EVALUATION.md](documentation/RESEARCH_EVALUATION.md). Version numbers below describe the original setup. The audit runs on Node 24.19.0; the old local `.venv` points to a removed Python installation and must be replaced with a new environment if Python training is needed. The game requires no Python. Keep the supplied samples, models and lockfile intact.

> Complete guide to set up the Algobot project from scratch on a new Windows machine.

---

## 📋 Prerequisites Overview

| Tool | Version (Current) | Purpose |
|---|---|---|
| **Git** | latest | Clone the repository |
| **Node.js** | **v22.16.0** (LTS) | JavaScript runtime for Vite dev server |
| **npm** | **10.9.2** (bundled with Node) | Package manager |
| **Python** | **3.12.10** | ML training scripts (TensorFlow) |
| **VS Code** | latest (recommended) | Code editor |

---

## 1️⃣ Install Git

1. Download from [https://git-scm.com/downloads/win](https://git-scm.com/downloads/win)
2. Run the installer with default settings
3. Verify:
   ```powershell
   git --version
   ```

---

## 2️⃣ Install Node.js (v22 LTS)

> **Important**: You are using Node.js **v22.16.0**. Install the v22 LTS line to keep compatibility.

1. Download **Node.js v22 LTS** from [https://nodejs.org](https://nodejs.org)
   - Or directly: [https://nodejs.org/en/download](https://nodejs.org/en/download) → select **v22 LTS**
2. Run the installer:
   - ✅ Check "Automatically install necessary tools" if prompted
   - This bundles **npm 10.x** automatically
3. **Restart your terminal** after installation
4. Verify:
   ```powershell
   node --version    # Expected: v22.16.0 (or v22.x.x)
   npm --version     # Expected: 10.9.2 (or 10.x.x)
   ```

### Fix PowerShell Execution Policy (if npm doesn't work)

If you get `npm : cannot be loaded because running scripts is disabled`, run this **once** in an **Admin PowerShell**:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 3️⃣ Install Python 3.12

> **Important**: You are using Python **3.12.10**. This is required for the ML training pipeline.
> ⚠️ Only needed if you plan to train/retrain ML models. The game itself runs without Python.

1. Download **Python 3.12** from [https://www.python.org/downloads/](https://www.python.org/downloads/)
2. Run the installer:
   - ✅ **Check "Add python.exe to PATH"** (bottom of first screen)
   - Click "Install Now"
3. Verify:
   ```powershell
   python --version    # Expected: Python 3.12.x
   ```

---

## 4️⃣ Clone the Repository

```powershell
git clone https://github.com/yvantot/algobot-latest.git
cd algobot-latest
```

### Branches

| Branch | Description |
|---|---|
| `main` | Stable release branch |
| `improve_quest` | Quest improvement feature branch |

To switch branches:
```powershell
git checkout main
# or
git checkout improve_quest
```

---

## 5️⃣ Install Node.js Dependencies

```powershell
npm ci
```

This installs everything defined in `package.json`:

### Dependencies (Runtime)

| Package | Version | Purpose |
|---|---|---|
| `kaplay` | `^4000.0.0-alpha.26` | Game engine (KaPlay) |
| `blockly` | `^12.4.1` | Block-based visual programming |
| `codemirror` | `^6.0.2` | Code editor component |
| `@codemirror/lang-javascript` | `^6.2.4` | JavaScript language support for CodeMirror |
| `@codemirror/theme-one-dark` | `^6.1.3` | Dark theme for CodeMirror |
| `@tensorflow/tfjs` | `^4.22.0` | TensorFlow.js for in-browser ML inference |
| `@tailwindcss/vite` | `^4.2.0` | Tailwind CSS v4 Vite plugin |

### DevDependencies (Build Tools)

| Package | Version | Purpose |
|---|---|---|
| `vite` | `^7.3.1` | Build tool / dev server |
| `svelte` | `^5.53.3` | UI framework (Svelte 5) |
| `@sveltejs/vite-plugin-svelte` | `^6.2.4` | Svelte integration with Vite |
| `tailwindcss` | `^4.2.0` | Tailwind CSS v4 |
| `postcss` | `^8.5.6` | CSS post-processor |
| `autoprefixer` | `^10.4.24` | Auto-add vendor prefixes |
| `prettier` | `^3.8.1` | Code formatter |
| `prettier-plugin-svelte` | `^3.5.1` | Prettier support for `.svelte` files |

---

## 6️⃣ Run the Development Server

```powershell
npm run dev
```

This starts the Vite dev server (usually at `http://localhost:5173`).
Open that URL in your browser to see the game.

### All Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with hot-reload |
| `npm run build` | Build for production (outputs to `dist/`) |
| `npm run preview` | Preview production build locally |

---

## 7️⃣ Python ML Training Setup (Optional)

> Only needed if you want to train or retrain the LSTM/DQN models.
> The game works without this — it uses pre-trained models in `public/models/`.

### Create a Virtual Environment

```powershell
cd training
python -m venv ../.venv
```

### Activate the Virtual Environment

```powershell
..\.venv\Scripts\Activate.ps1
```

> If activation fails due to execution policy, run (Admin PowerShell):
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

### Install Python Dependencies

```powershell
pip install -r requirements.txt
```

This installs:

| Package | Purpose |
|---|---|
| `tensorflow>=2.15` | Deep learning framework |
| `numpy` | Numerical computing |
| `pandas` | Data manipulation |
| `scikit-learn` | ML utilities (preprocessing, metrics) |
| `matplotlib` | Plotting and visualization |
| `seaborn` | Statistical data visualization |
| `tensorflowjs` | Export Keras models to TF.js format |

### Training Scripts

All training scripts are in the `training/` directory:

| File | Purpose |
|---|---|
| `prepare_dataset.py` | Prepare and preprocess training data |
| `train_lstm.py` | Train the LSTM proficiency model |
| `train_dqn.py` | Train the DQN policy model |
| `evaluate.py` | Summarize recorded gameplay conditions (not a learning-gain test) |
| `evaluate_model.py` | Evaluate regression predictions and proficiency categories |
| `export_tfjs.py` | Export trained Keras models to TF.js format |
| `export_tfjs.sh` | Bash script wrapper for TF.js export |

### Export Models to TF.js (after training)

To export the trained Keras models to TensorFlow.js format for the game:

```powershell
python export_tfjs.py
```

The guarded exporter writes to a new `training/exports_v2/` directory by default. It requires the scaler used for the selected LSTM. Inspect and test an export before promoting it into `public/models/`; do not overwrite the preserved deployment as part of a diagnostic evaluation. The DQN remains gated pending policy evaluation. See [the current evaluation commands](documentation/RESEARCH_EVALUATION.md).

---

## 📁 Project Structure

```
algobot-latest/
├── public/                    # Static assets (served as-is)
│   ├── fonts/                 # Custom fonts
│   ├── music/                 # Background music
│   ├── sounds/                # Sound effects
│   ├── sprites/               # Game sprites and UI art (101 files)
│   └── js-interpreter.js      # JS-Interpreter (sandboxed code execution)
│
├── src/                       # Source code
│   ├── main.js                # App entry point (mounts Svelte)
│   ├── App.svelte             # Root Svelte component
│   ├── index.css              # Global styles (Tailwind v4)
│   ├── blockly/               # Blockly visual programming config
│   ├── components/            # Svelte UI components
│   ├── editor/                # Code editor (CodeMirror) setup
│   ├── game/                  # Game logic
│   │   ├── game.js            # Main game setup (KaPlay)
│   │   ├── event.js           # Game events
│   │   ├── components-kaplay/ # KaPlay game components
│   │   ├── global/            # Global state and interpreter
│   │   ├── ml/                # ML inference and telemetry
│   │   └── utils/             # Game utilities
│   └── lib/                   # Shared library code
│
├── training/                  # Python ML training pipeline
│   ├── requirements.txt       # Python dependencies
│   ├── prepare_dataset.py     # Data preparation
│   ├── train_lstm.py          # LSTM training
│   ├── train_dqn.py           # DQN training
│   ├── evaluate.py            # Model evaluation
│   └── export_tfjs.sh         # Export to TF.js
│
├── documentation/             # Project documentation
│   ├── ml-doc.md              # ML system documentation
│   └── ml-doc.html            # ML docs (HTML version)
│
├── index.html                 # HTML entry point
├── package.json               # Node.js dependencies and scripts
├── vite.config.ts             # Vite configuration
├── svelte.config.js           # Svelte configuration
├── jsconfig.json              # JS/TS config for IDE
├── algoscripts.js             # Example robot scripts
├── .prettierignore            # Prettier ignore rules
└── .gitignore                 # Git ignore rules
```

---

## 🛠️ Recommended VS Code Extensions

Install these for the best development experience:

| Extension | ID |
|---|---|
| Svelte for VS Code | `svelte.svelte-vscode` |
| Prettier | `esbenp.prettier-vscode` |
| Tailwind CSS IntelliSense | `bradlc.vscode-tailwindcss` |
| ESLint | `dbaeumer.vscode-eslint` |
| Python | `ms-python.python` |

---

## ⚡ Quick Start (TL;DR)

```powershell
# 1. Clone
git clone https://github.com/yvantot/algobot-latest.git
cd algobot-latest

# 2. Install dependencies
npm install

# 3. Run
npm run dev

# 4. Open browser at http://localhost:5173
```

---

## ❓ Troubleshooting

### `npm` script execution error on PowerShell
```
npm : File ... cannot be loaded because running scripts is disabled
```
**Fix** (run as Admin):
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### `node_modules` issues / dependency errors
Reinstall from the committed lockfile:
```powershell
npm ci
```

### Vite dev server port conflict
If port 5173 is in use, Vite auto-picks the next port. Check the terminal output for the actual URL.

### Python venv activation fails
Make sure you are using PowerShell (not CMD) and execution policy is set:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### TensorFlow installation issues on Windows
If `pip install tensorflow` fails:
```powershell
pip install --upgrade pip
pip install tensorflow>=2.15
```
Ensure you are using Python 3.12 (TensorFlow may not support newer Python versions yet).
