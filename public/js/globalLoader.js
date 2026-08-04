document.addEventListener("DOMContentLoaded", () => {
  // Create overlay
  const overlay = document.createElement("div");
  overlay.id = "pageLoader";

  overlay.innerHTML = `
    <div class="loader"></div>
  `;

  document.body.appendChild(overlay);

  // Hide loader when page finishes loading
  window.addEventListener("load", () => {
    overlay.classList.add("hidden");
  });

  // Show loader whenever a link is clicked
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a");

    if (
      link &&
      link.href &&
      !link.target &&
      !link.href.startsWith("javascript:")
    ) {
      overlay.classList.remove("hidden");
    }
  });

  // Show loader when any form is submitted
  document.addEventListener("submit", () => {
    overlay.classList.remove("hidden");
  });
});