import React from "react";
import ReactDOM from "react-dom/client";

import { applyExtensionPageMode } from "@/lib/extension-page-mode";

import App from "./App.tsx";

import "./style.css";

applyExtensionPageMode();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
