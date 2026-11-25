import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "./estilos.css";
import { DatosProvider } from "./store.jsx";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <DatosProvider>
      <App />
    </DatosProvider>
  </StrictMode>
);

// App instalable y sin conexión (solo en la versión compilada)
if (import.meta.env.PROD && "serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker
    .register("./sw.js")
    .then((reg) => {
      reg.addEventListener("updatefound", () => {
        const nuevo = reg.installing;
        nuevo?.addEventListener("statechange", () => {
          if (nuevo.state === "activated" && navigator.serviceWorker.controller) {
            window.dispatchEvent(new Event("cuadra:nueva-version"));
          }
        });
      });
    })
    .catch((e) => console.warn("Service worker no registrado", e));
}
