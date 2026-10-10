# Ask AI date-range fix

Upload this patch only to **aftabz-lab/aftabz-lab.github.io**.

## Upload

1. Download the ZIP and choose **Extract All**.
2. Open https://github.com/aftabz-lab/aftabz-lab.github.io and select **main**.
3. At the repository root, choose **Add file → Upload files**.
4. Upload these four extracted files, replacing the files with the same names:
   - `dashboard-ai-data.js`
   - `dashboard-ai.js`
   - `azure-dashboard-chat.js`
   - `index.html`
5. Commit the changes. Wait for the GitHub Pages deployment to finish successfully.
6. Open https://aftabz-lab.github.io/visit-compliance-dashboard/ and press **Ctrl + Shift + R**.
7. Open **Ask AI**, press **↺** for a new conversation, and ask:
   `Md. Eazul Islam (Mahin) visit list between 1 & 3 october`

Upload the extracted files, not the ZIP. `SETUP.md` is just this guide.
No upload to the separate dashboard repositories or Apps Script is required for this patch.
Keep the earlier installed backend-data bridges and the existing free AI runtime files.

## Correction

The previous query matched the officer's name but did not apply the requested dates. It selected outlet latest-visit summaries, which included 5 October even when the question requested 1–3 October.

Date-specific answers now select actual dated backend event records, apply both date boundaries inclusively in Bangladesh time, and then apply the officer/outlet conditions. Planned visit dates and an outlet's latest-visit summary are not used as proof of a completed visit in an earlier period. The complete available backend scope is searched before limiting the displayed list.

If a year is omitted, the backend report context supplies it. Ambiguous or invalid dates and unsupported date exclusions require clarification. Full month names or `YYYY-MM-DD` are recommended.

Verification used the published visit snapshot read on 9 October 2026, with a report cut-off of 7 October. For the question above it contains six recorded responses:

| Actual date | Outlet codes |
| --- | --- |
| 1 October 2026 | F229, F671 |
| 2 October 2026 | D060, D083, F275, F747 |
| 3 October 2026 | No matching recorded response in this snapshot |

Future answers read the current loaded backend snapshot; these outlet codes and dates are not hardcoded. An older report period unavailable in the loaded backend cannot be inferred from outlet ownership summaries.

The shared Ask AI query engine is the only functional change. The other three files only update the script version URL so browsers load this correction. Dashboard rules, fonts, formats, calculations, exports, snapshot rules and the feasibility/approval exclusions are unchanged.
