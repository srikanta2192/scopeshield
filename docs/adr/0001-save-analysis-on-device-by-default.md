# Save the analysis on this device by default

The analysis screen has its own URL so users can return to their Findings later, which requires the original PDF, Redactions and Findings to persist in the browser (IndexedDB, seven days of inactivity). Previously nothing was saved unless "Remember this session" was ticked. We save automatically after a successful analysis, because a credit was spent and losing the result on refresh is worse than keeping it locally; the user can delete it at any time. Nothing is saved server-side.
