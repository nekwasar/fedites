import React from "react";
import ReactDOM from "react-dom/client";
import "@fedites/ui/styles.css";
import App from "./App.js";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
