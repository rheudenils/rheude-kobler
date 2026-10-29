// behandlungstage.js schreibt in "window" – im Worker gibt es das nicht.
globalThis.window = globalThis.window || globalThis;
