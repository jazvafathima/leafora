// Reusable functions to refresh badges — call these after any cart/wishlist action
async function updateCartCount() {
  try {
    const res = await fetch("/cart/count");
    const data = await res.json();
    const badge =
      document.getElementById("cartBadge") ||
      document.getElementById("cartCount");
    if (badge) {
      badge.textContent = data.count;
      badge.style.display = data.count > 0 ? "flex" : "none";
    }
  } catch (err) {
    console.error("Failed to update cart count:", err);
  }
}

async function updateWishlistCount() {
  try {
    const res = await fetch("/wishlist/count");
    const data = await res.json();
    const badge = document.getElementById("wishlistCount");
    if (badge) {
      badge.textContent = data.count;
      badge.classList.toggle("hidden", data.count === 0);
    }
  } catch (err) {
    console.error("Failed to update wishlist count:", err);
  }
}

// Optional: keep counts in sync automatically on every page load
document.addEventListener("DOMContentLoaded", () => {
  updateCartCount();
  updateWishlistCount();
});
