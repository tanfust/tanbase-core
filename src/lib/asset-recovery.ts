// For a few seconds after a deployment, a page rendered by the new Worker
// version can reference a fingerprinted script or stylesheet that the edge
// location does not serve yet. This inline script reloads the page once when
// a same-origin script, stylesheet, or lazy chunk fails to load, and at most
// once per 30 seconds so a real outage cannot cause a reload loop.

/** Kept as source text: it runs as an inline script before the app loads. */
export const assetRecoverySource = `function (w, reload) {
  var key = "tanbase:asset-reload";
  function recover() {
    try {
      var last = Number(w.sessionStorage.getItem(key) || 0);
      if (Date.now() - last < 30000) return;
      w.sessionStorage.setItem(key, String(Date.now()));
    } catch (error) {
      return;
    }
    reload();
  }
  w.addEventListener("error", function (event) {
    var target = event.target;
    var url = target && target.tagName === "SCRIPT" ? target.src
      : target && target.tagName === "LINK" ? target.href : "";
    if (url && new URL(url, w.location.href).origin === w.location.origin) {
      recover();
    }
  }, true);
  w.addEventListener("vite:preloadError", function (event) {
    event.preventDefault();
    recover();
  });
}`

export const assetRecoveryScript = `(${assetRecoverySource})(window, function () { location.reload(); });`
