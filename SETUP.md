# Free Ask AI replacement and Pricing Control portal box

Upload these files to the **root of `aftabz-lab/aftabz-lab.github.io`**.

This single ZIP replaces the shared Azure chatbot used by the current portal, Receiving, Credit Card Extra Amount, Z-Report, Visit Compliance, Audit Quality, Zone Distribution and Pricing Control pages. No other dashboard repository needs a chatbot upload.

Feasibility and New Outlet Opening Approval are excluded.

## Upload

1. Extract `SHWAPNO_Free_Ask_AI_And_Pricing_Link_GitHub_Upload.zip` on your computer.
2. Open https://github.com/aftabz-lab/aftabz-lab.github.io on its `main` branch.
3. At the repository root, choose **Add file → Upload files**.
4. Upload the five files from the extracted ZIP:
   - `index.html`
   - `azure-dashboard-chat.js`
   - `dashboard-ai.js`
   - `dashboard-ai-worker.js`
   - `dashboard-ai-notices.txt`
5. Commit the files. Keep the repository's existing files and folders. Do not upload the ZIP itself or create another enclosing folder.
6. Wait for the new GitHub Pages deployment to complete.
7. Open the portal and each dashboard, then press **Ctrl + F5** once to replace cached chatbot scripts.

The `SETUP.md` file is this guide; uploading it is optional.

## What the assistant does

- The button stays **Ask AI**, with the existing size, position and isolated panel styling.
- Visible figures, outlet rows, filters and snapshot times can be looked up immediately, without downloading a model.
- Questions needing an explanation use **Qwen2.5 1.5B Instruct** through **WebLLM 0.2.85** in a browser worker. This is an open-source local model, not OpenAI's paid API or Azure OpenAI.
- No Azure account, API key, server, subscription, sign-in or payment is required.
- Model weights are about 869 MB, plus the runtime, tokenizer and model library. The first AI explanation downloads these public model assets. The browser caches them when storage permits; clearing its cache or storage eviction requires another download.
- Generative AI needs a working **WebGPU** adapter and sufficient device memory (approximately 1.6–1.9 GB of GPU memory for the selected model, depending on the adapter). Current Chrome or Edge with hardware acceleration is a suitable starting point.
- When the model cannot run or load, the panel clearly identifies **Dashboard lookup** and uses visible data. It does not pretend that a generated AI explanation was produced.
- Progress is shown while the model loads. **Stop**, **New conversation**, closing the panel, and leaving the page cancel active work. Closing the panel releases model memory; reopening an explanation reloads cached model assets.
- Questions and dashboard context are processed locally. Network downloads are the public model/runtime files; there are no cloud chat requests.
- Each question captures the current visible scope. Source KPI totals are read exactly as displayed, rather than recalculated from a partial visible table. Hidden and paginated records are not available to the assistant.
- Model answers can make mistakes. Check important conclusions against the displayed source figures; possible causes are not established facts.
- The assistant cannot modify filters, calculations, files, exports or snapshot schedules.

## Why one ZIP reaches all dashboards

The eight current entry pages already load the same `azure-dashboard-chat.js` from the main portal. That filename is retained as a small compatibility loader, which now loads `dashboard-ai.js`. It contains no Azure requests. Keep it so the existing dashboard pages continue to work.

The old `azure-dashboard-chat-config.json` is no longer read. No Azure backend deployment is needed.

## Pricing Control box

The current portal already contains the Pricing Control link in navigation and as card **07**, below the first six cards. The supplied `index.html` includes that box once and places it first in the grid so it is visible in the first row. The existing card sizes, fonts, colors and grid format are retained.

Target: https://aftabz-lab.github.io/Pricing-control-dashboard-Shwapno/

## Scope and verification

Only the shared chatbot assets, the portal's chatbot script reference and the Pricing card's display order are changed. Existing dashboard CSS/fonts, KPI formulas, table logic, exports, source queries, snapshot workers and workflows are untouched. The Pricing card's existing format is retained.

Verified against the current repository pages:

- Eight page integrations and compatibility loading.
- Fresh figure/filter/snapshot lookup, exact outlet-code matching, private/hidden data exclusion and safe text rendering.
- Worker protocol, streaming, reuse, initialization cancellation, stop/clear behavior and fallback handling.
- Both theme modes, print hiding, responsive panel width, the two excluded dashboards, iframe/snapshot-worker exclusion and the Pricing link/card.
- Existing Pricing Control calculation/source tests.
- Public model metadata and WebGPU libraries are reachable and permit cross-origin model loading.

The worker integration was tested with controlled model responses. Actual model inference needs a WebGPU device and was not hardware-tested in this build environment. Verify the first explanation on your own device after Pages deployment.

References:

- https://webllm.mlc.ai/docs/
- https://github.com/mlc-ai/web-llm
- https://huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC
- https://developers.openai.com/api/docs/pricing
