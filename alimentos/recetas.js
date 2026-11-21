/**
 * Vista de recetas de la guia de alimentos: el paciente marca las que quiere probar y se las
 * envia a Mario por WhatsApp. El enlace abre el mensaje ya escrito para elegir el contacto,
 * asi que no publica ningun numero. No guarda nada.
 *
 * Spec: docs/specs/2026-11-06-pauta-por-opciones.md
 */
(function (global) {
  "use strict";

  function normalizar(texto) {
    return String(texto)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
  }

  function coincide(texto, consulta) {
    return normalizar(texto).includes(normalizar(consulta));
  }

  function mensaje(elegidas) {
    const lineas = elegidas.map((r) => `- ${r.nombre} (${r.familia})`);
    return `Hola, Mario. Me gustaría probar estas recetas:\n\n${lineas.join("\n")}`;
  }

  function enlace(elegidas) {
    return `https://wa.me/?text=${encodeURIComponent(mensaje(elegidas))}`;
  }

  function contador(cuantas) {
    return cuantas === 1 ? "1 elegida" : `${cuantas} elegidas`;
  }

  function montar(raiz) {
    if (!raiz) return;
    const pestanas = Array.from(raiz.querySelectorAll("[data-pestana]"));
    const grupos = Array.from(raiz.querySelectorAll("[data-grupo]"));
    const recetas = Array.from(raiz.querySelectorAll(".receta"));
    const casillas = recetas.map((r) => r.querySelector("input"));
    const buscar = raiz.querySelector("[data-recetas-buscar]");
    const estado = raiz.querySelector("[data-recetas-estado]");
    const barra = raiz.querySelector("[data-recetas-barra]");
    const cuenta = raiz.querySelector("[data-recetas-contador]");
    const enviar = raiz.querySelector("[data-recetas-enviar]");
    let activa = pestanas.length ? pestanas[0].dataset.pestana : "";

    function pintar() {
      const consulta = buscar ? buscar.value : "";
      const buscando = consulta.trim() !== "";
      let visibles = 0;
      recetas.forEach((receta) => {
        const coinciden = !buscando || coincide(receta.textContent, consulta);
        receta.hidden = !coinciden;
      });
      grupos.forEach((grupo) => {
        const hay = grupo.querySelector(".receta:not([hidden])");
        // Al buscar se mira en todos los tipos de comida, no solo en el de la pestaña.
        grupo.hidden = buscando ? !hay : grupo.dataset.grupo !== activa;
        grupo.classList.toggle("buscando", buscando);
        if (!grupo.hidden) visibles += grupo.querySelectorAll(".receta:not([hidden])").length;
      });
      pestanas.forEach((p) => {
        p.setAttribute("aria-pressed", String(!buscando && p.dataset.pestana === activa));
      });
      if (estado) {
        estado.textContent = !buscando ? "" : visibles === 0 ? "Sin resultados" : `${visibles} resultados`;
      }
    }

    function actualizarBarra() {
      const elegidas = casillas
        .filter((c) => c.checked)
        .map((c) => ({ nombre: c.dataset.nombre, familia: c.dataset.familia }));
      recetas.forEach((r) => r.classList.toggle("elegida", r.querySelector("input").checked));
      barra.hidden = elegidas.length === 0;
      if (elegidas.length) {
        cuenta.textContent = contador(elegidas.length);
        enviar.href = enlace(elegidas);
      }
    }

    pestanas.forEach((p) =>
      p.addEventListener("click", () => {
        activa = p.dataset.pestana;
        if (buscar) buscar.value = "";
        pintar();
      }),
    );
    if (buscar) buscar.addEventListener("input", pintar);
    casillas.forEach((c) => c.addEventListener("change", actualizarBarra));
    pintar();
    actualizarBarra();
  }

  const api = { coincide, mensaje, enlace, contador, montar };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.NduranceRecetas = api;
})(typeof window !== "undefined" ? window : globalThis);
