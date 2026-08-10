import React from "react";
import { createRoot } from "react-dom/client";
import GPProveedoresFeed from "./App.jsx";

// ── Puente landing ↔ app ──
// La landing es HTML estático (index.html); la app React vive oculta en #app-shell
// y se muestra a pantalla completa al pulsar "Acceso", "Ver la app por dentro",
// "Probar la app" o el botón flotante. "Salir" dentro de la app llama a __gpSalir.
const shell = document.getElementById("app-shell");

window.__gpAbrir = () => {
  shell.style.display = "block";
  document.body.style.overflow = "hidden";
};
window.__gpSalir = () => {
  shell.style.display = "none";
  document.body.style.overflow = "";
};

document.getElementById("gp-abrir-flotante").addEventListener("click", window.__gpAbrir);

document.addEventListener("click", (ev) => {
  const el = ev.target.closest("a,button");
  if (!el || shell.contains(el)) return;
  const t = (el.textContent || "").trim().toLowerCase();
  if (
    t === "acceso" ||
    t.includes("ver la app por dentro") ||
    t.includes("probar la app") ||
    t.includes("entrar a la app")
  ) {
    ev.preventDefault();
    window.__gpAbrir();
  }
});

createRoot(document.getElementById("root")).render(<GPProveedoresFeed />);
