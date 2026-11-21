// Buscador del catalogo de alimentos: filtra las tarjetas y las etiquetas de la
// seccion en la que esta, por texto, sin acentos ni mayusculas. Tambien enciende el
// desplegable «Ir a categoria», que en el movil sustituye a los botones del indice.
// No hay dependencias.
(function () {
  "use strict";

  function normalizar(texto) {
    return texto
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
  }

  function montar() {
    const entrada = document.querySelector("[data-buscador]");
    const estado = document.querySelector("[data-buscador-estado]");
    if (!entrada) return;
    // Solo busca dentro de su propia seccion (el catalogo), no en el resto de la guia.
    const ambito = entrada.closest(".seccion") || document;
    const elementos = Array.from(ambito.querySelectorAll(".producto, .etiquetas li")).map((el) => ({
      el,
      texto: normalizar(el.textContent || ""),
    }));
    const categorias = Array.from(ambito.querySelectorAll(".categoria"));

    function filtrar() {
      const consulta = normalizar(entrada.value);
      let visibles = 0;
      elementos.forEach(({ el, texto }) => {
        const coincide = consulta === "" || texto.includes(consulta);
        el.hidden = !coincide;
        if (coincide) visibles += 1;
      });
      categorias.forEach((categoria) => {
        const hayAlgo = categoria.querySelector(".producto:not([hidden]), .etiquetas li:not([hidden])");
        categoria.hidden = consulta !== "" && !hayAlgo;
        categoria.querySelectorAll("h3").forEach((titulo) => {
          let siguiente = titulo.nextElementSibling;
          let conContenido = false;
          while (siguiente && siguiente.tagName !== "H3") {
            if (siguiente.querySelector(".producto:not([hidden]), li:not([hidden])")) conContenido = true;
            siguiente = siguiente.nextElementSibling;
          }
          titulo.hidden = consulta !== "" && !conContenido;
        });
      });
      if (estado) {
        estado.textContent =
          consulta === "" ? "" : visibles === 0 ? "Sin resultados" : `${visibles} resultados`;
      }
    }

    entrada.addEventListener("input", filtrar);

    // Sin este script el desplegable no hace nada, asi que el CSS solo cambia los botones
    // por el desplegable cuando la clase esta puesta.
    const selector = ambito.querySelector("[data-ir-categoria] select");
    if (!selector) return;
    document.documentElement.classList.add("con-selector-categorias");
    selector.addEventListener("change", () => {
      const destino = selector.value && document.getElementById(selector.value);
      if (!destino) return;
      // Una busqueda activa puede tener oculta la categoria elegida.
      if (entrada.value !== "") {
        entrada.value = "";
        filtrar();
      }
      destino.scrollIntoView({ block: "start" });
      selector.value = "";
    });
  }

  document.addEventListener("DOMContentLoaded", montar);
})();
