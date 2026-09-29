/**
 * Registers the service worker and surfaces updates explicitly.
 *
 * New workers wait until the user chooses "Reload to update". This prevents
 * an in-use page from silently switching application versions mid-session.
 */
export async function registerPwaUpdates({
  banner,
  reloadButton,
  onReady = () => {},
  onOnlineChange = () => {}
}) {
  if (!("serviceWorker" in navigator)) {
    onReady(false);
    return null;
  }

  let updateWorker = null;
  let reloadRequested = false;

  const registration = await navigator.serviceWorker.register("./sw.js", {
    updateViaCache: "none"
  });

  const showUpdate = worker => {
    updateWorker = worker;
    banner.hidden = false;
  };

  if (registration.waiting) showUpdate(registration.waiting);

  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    if (!worker) return;

    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        showUpdate(worker);
      }
    });
  });

  reloadButton.addEventListener("click", () => {
    const worker = registration.waiting || updateWorker;
    if (!worker) {
      window.location.reload();
      return;
    }
    reloadRequested = true;
    worker.postMessage({ type: "SKIP_WAITING" });
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadRequested) window.location.reload();
  });

  const checkForUpdates = () => registration.update().catch(() => {});
  window.addEventListener("focus", checkForUpdates);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkForUpdates();
  });

  const reportNetwork = () => onOnlineChange(navigator.onLine);
  window.addEventListener("online", reportNetwork);
  window.addEventListener("offline", reportNetwork);
  reportNetwork();

  await navigator.serviceWorker.ready;
  onReady(true);

  checkForUpdates();
  return registration;
}
