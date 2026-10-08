# Ask AI device compatibility fix

This patch adds a free local CPU model when WebGPU is unavailable, disabled, or fails to load or generate. The existing GPU model remains available on compatible devices. The Ask AI button, dashboard appearance, data calculations, exports and snapshot rules are unchanged.

## Upload

1. Extract this ZIP on your computer.
2. Open https://github.com/aftabz-lab/aftabz-lab.github.io on the `main` branch.
3. At the repository root, choose **Add file → Upload files**.
4. Upload these four files and the complete runtime folder, keeping its two files inside the folder:

   - `azure-dashboard-chat.js`
   - `dashboard-ai.js`
   - `dashboard-ai-cpu-worker.js`
   - `dashboard-ai-notices.txt`
   - `dashboard-ai-cpu-runtime/ort-wasm-simd-threaded.jsep.mjs`
   - `dashboard-ai-cpu-runtime/ort-wasm-simd-threaded.jsep.wasm`

5. Commit the uploaded files to `main` and wait for the existing GitHub Pages deployment to complete.
6. Open the dashboard and press **Ctrl+F5** to reload the updated chatbot.

Upload the extracted files at the root of **aftabz-lab.github.io**, not inside the Pricing dashboard repository. Keep `dashboard-ai-cpu-runtime` as a folder. The existing `dashboard-ai-worker.js` stays in the repository. This instruction file is optional to upload.

## Use

Click **Ask AI**. Exact visible figures, outlets, filters and snapshot times continue to answer immediately. For an explanation, the assistant uses the existing GPU model if available, or automatically loads the CPU model. It also retries on CPU if GPU generation fails.

First CPU use downloads about 550 MB of public model files. Keep the tab open while it loads; progress appears in the conversation. The browser caches model files when its storage allows. CPU generation may be slower than GPU generation. **Stop**, **Clear** and closing the panel release the active model worker.

No Azure subscription, paid API, account, token, Google Apps Script or new snapshot workflow is needed. AI inference runs on the device; dashboard prompts are not sent to an AI server. The local model is Qwen2.5, not the OpenAI API.

The shared loader applies to the portal, Receiving, Credit Card, Z-Report, Visit Compliance, Audit Quality, Zone Distribution and Pricing dashboards. Feasibility, New Outlet Opening Approval and snapshot worker pages remain excluded.

## Validation

- Real inference and streamed generation passed using the shipped browser CPU/WASM runtime and the pinned Qwen2.5-0.5B model.
- All 22 chatbot regression checks passed, including the eight allowed routes, CPU selection, GPU load and generation recovery, cancellation, fresh visible context and exact-value lookup.
- Dashboard styles, fonts, data calculations, exports and snapshot files are unchanged.

Built against repository commit `5ac961aee239687df637a4a38dab952a874f6189`. Transformers.js 3.8.1 and its matching ONNX Runtime Web runtime are bundled. Model revision: `22942cb7d7ba4cc81bb4673549ca4d4614469b5e`. Third-party license notices are included.
