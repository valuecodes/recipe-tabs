import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Library } from "./library";

import "~/globals.css";

const rootElement = document.getElementById("root");
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <Library />
    </StrictMode>
  );
} else {
  const message = "Root element with id 'root' not found";
  console.error(message);
  throw new Error(message);
}
