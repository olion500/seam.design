/*
 * seam-bridge: add to the React app under review so the spec editor can
 * preview token changes live.
 *
 *   <script src="https://<editor-host>/seam-bridge.js"></script>
 *
 * The editor embeds the app in an iframe and posts
 * { type: "seam:tokens", vars: { "--accent": "#0085E4", ... } }.
 * The bridge writes each entry as a CSS custom property on <html>, so the
 * app's own styles must read colors, radii and spacing from those variables.
 */
(() => {
  if (window.parent === window) return;
  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || event.data?.type !== "seam:tokens") return;
    const root = document.documentElement;
    for (const [name, value] of Object.entries(event.data.vars ?? {})) {
      if (name.startsWith("--") && typeof value === "string") root.style.setProperty(name, value);
    }
  });
  window.parent.postMessage({ type: "seam:ready" }, "*");
})();
