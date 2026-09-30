const INSTALL_PROMPT_DISMISSED_KEY = "healthtracker.installPromptDismissed";

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true;
}

export function setupInstallPrompt({
  prompt,
  dismissButton
}) {
  if (!prompt || !dismissButton) return;

  const refresh = () => {
    const dismissed = localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY) === "1";
    prompt.hidden = dismissed || isStandalone();
  };

  dismissButton.addEventListener("click", () => {
    localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, "1");
    refresh();
  });

  window.addEventListener("appinstalled", () => {
    prompt.hidden = true;
  });

  const displayMode = window.matchMedia?.("(display-mode: standalone)");
  displayMode?.addEventListener?.("change", refresh);

  refresh();
}
