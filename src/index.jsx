import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Register the service worker for PWA / offline support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((reg) => console.log("SW registered:", reg.scope))
      .catch((err) => console.log("SW registration failed:", err));
  });
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
