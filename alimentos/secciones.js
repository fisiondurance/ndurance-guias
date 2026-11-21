// Navegacion por tarjetas de seccion: al abrir la guia solo se ven las tarjetas;
// al pulsar una se muestra esa seccion y las tarjetas pasan a modo compacto.
// El HTML llega con todas las secciones visibles (asi se lee sin JS y se imprime
// entero); este script es quien las oculta al arrancar.
(function () {
  "use strict";

  const nav = document.querySelector("[data-secciones]");
  if (!nav) return;
  const tarjetas = Array.from(nav.querySelectorAll(".tarjeta-seccion"));
  const secciones = tarjetas.map((t) => document.getElementById(t.dataset.seccion));
  // La entrada solo acompana a las tarjetas en la portada: con un apartado abierto sobra.
  const preambulo = document.querySelector(".preambulo");
  let abierta = null;

  function pintar() {
    secciones.forEach((s, i) => {
      s.hidden = abierta !== s;
      tarjetas[i].setAttribute("aria-pressed", String(abierta === s));
    });
    nav.classList.toggle("compacta", abierta !== null);
    if (preambulo) preambulo.hidden = abierta !== null;
  }

  function abrir(seccion, desplazar) {
    abierta = seccion;
    pintar();
    if (seccion) {
      history.replaceState(null, "", "#" + seccion.id);
      if (desplazar) nav.scrollIntoView({ block: "start" });
    } else {
      history.replaceState(null, "", location.pathname + location.search);
      if (desplazar) window.scrollTo({ top: 0 });
    }
  }

  tarjetas.forEach((t, i) => t.addEventListener("click", () => abrir(secciones[i], true)));
  document.querySelectorAll("[data-volver]").forEach((enlace) =>
    enlace.addEventListener("click", (evento) => {
      evento.preventDefault();
      abrir(null, true);
    })
  );

  // Con #seccion-2 se abre esa seccion; con un ancla interior (#cat-huevos) se abre la
  // seccion que la contiene y se deja al navegador llegar al ancla.
  function abrirDesdeHash() {
    const objetivo = location.hash ? document.getElementById(location.hash.slice(1)) : null;
    const contenedora = objetivo ? objetivo.closest(".seccion") : null;
    if (contenedora) {
      abierta = contenedora;
      pintar();
      if (objetivo !== contenedora) objetivo.scrollIntoView({ block: "start" });
      else nav.scrollIntoView({ block: "start" });
    } else {
      abrir(null, false);
    }
  }
  abrirDesdeHash();
  window.addEventListener("hashchange", abrirDesdeHash);

  // El PDF incluye todas las recetas; al terminar, se recupera lo que estaba abierto.
  let estadoImpresion = null;
  window.addEventListener("beforeprint", () => {
    if (estadoImpresion) return;
    estadoImpresion = Array.from(document.querySelectorAll("details.verdura-card, details.verduras-ayuda"),
      (tarjeta) => [tarjeta, tarjeta.open]);
    estadoImpresion.forEach(([tarjeta]) => { tarjeta.open = true; });
  });
  window.addEventListener("afterprint", () => {
    if (!estadoImpresion) return;
    estadoImpresion.forEach(([tarjeta, abiertaAntes]) => { tarjeta.open = abiertaAntes; });
    estadoImpresion = null;
  });
})();
