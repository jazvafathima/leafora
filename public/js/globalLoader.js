const overlay = document.getElementById("pageLoader");

// Hide loader when page has finished loading
window.addEventListener("load", () => {
  overlay.classList.add("hidden");
});

// Show loader only for normal page navigation
document.addEventListener("click", (e) => {
  const link = e.target.closest("a");

  if (!link) return;

  // Ignore anchors, javascript links, downloads, new tabs
  if (
    link.target === "_blank" ||
    link.hasAttribute("download") ||
    link.href.startsWith("javascript:") ||
    link.href.startsWith("#")
  ) {
    return;
  }

  // Only show loader for same-origin page navigation
  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin) return;

  overlay.classList.remove("hidden");
});