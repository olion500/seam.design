import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@xyflow/react/dist/style.css";
import "./index.css";
import { App } from "./App";
import { startPersistence } from "./store/persist";

void startPersistence().finally(() => {
  const root = document.getElementById("root");
  if (!root) throw new Error("#root element missing from index.html");
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
