(function () {
  "use strict";

  const btn = document.createElement("button");
  btn.innerHTML = "⛶"; // fullscreen icon
  btn.id = "fs-toggle-btn";

  Object.assign(btn.style, {
    position: "fixed",
    bottom: "16px",
    right: "16px",
    zIndex: "9999",
    padding: "10px 14px",
    fontSize: "20px",
    borderRadius: "8px",
    border: "none",
    background: "rgba(0,0,0,0.7)",
    color: "#fff",
    cursor: "pointer"
  });

  document.addEventListener("DOMContentLoaded", function () {
    document.body.appendChild(btn);
  });

  btn.addEventListener("click", function () {
    if (isFullscreen()) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  });

  function isFullscreen() {
    return document.fullscreenElement;
  }

  function enterFullscreen() {
    const body = document.body
    if (body.requestFullscreen) {
      body.requestFullscreen().catch(console.error);
    }
  }

  function exitFullscreen() {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }

  function updateButtonVisibility() {
    btn.style.display = isFullscreen() ? "none" : "block";
  }

  function onFullscreenChange() {
    updateButtonVisibility();
    if (isFullscreen()) {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock("landscape").catch(console.error);
      }
    } else {
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
      }
    }
  }
  
  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);

  updateButtonVisibility();
})();