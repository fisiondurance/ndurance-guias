// Consulta de una receta sin mover la cuadricula. El desplegable nativo queda como alternativa.
(function () {
  "use strict";

  const tarjetas = Array.from(document.querySelectorAll("details.verdura-card"));
  if (!tarjetas.length || typeof HTMLDialogElement === "undefined" ||
      typeof HTMLDialogElement.prototype.showModal !== "function") return;

  const dialogo = document.createElement("dialog");
  dialogo.className = "verdura-dialogo";
  dialogo.setAttribute("aria-labelledby", "verdura-dialogo-titulo");

  const barra = document.createElement("div");
  barra.className = "verdura-dialogo-barra";
  const cerrar = document.createElement("button");
  cerrar.type = "button";
  cerrar.className = "verdura-cerrar";
  cerrar.textContent = "Cerrar";
  barra.append(cerrar);

  const contenido = document.createElement("div");
  dialogo.append(barra, contenido);
  document.body.append(dialogo);

  let origen = null;
  let overflowAnterior = "";

  tarjetas.forEach((tarjeta) => {
    const activador = tarjeta.querySelector("summary");
    const cuerpo = tarjeta.querySelector(".verdura-cuerpo");
    const foto = tarjeta.querySelector(".verdura-foto");
    if (!activador || !cuerpo || !foto) return;

    activador.setAttribute("aria-haspopup", "dialog");
    activador.addEventListener("click", (evento) => {
      evento.preventDefault();
      const copia = cuerpo.cloneNode(true);
      copia.querySelectorAll("[id]").forEach((elemento) => elemento.removeAttribute("id"));
      const titulo = copia.querySelector("h3");
      if (titulo) titulo.id = "verdura-dialogo-titulo";
      contenido.replaceChildren(foto.cloneNode(true), copia);
      origen = activador;
      overflowAnterior = document.body.style.overflow;
      dialogo.showModal();
      document.body.style.overflow = "hidden";
      dialogo.scrollTop = 0;
      cerrar.focus({ preventScroll: true });
    });
  });

  cerrar.addEventListener("click", () => dialogo.close());
  dialogo.addEventListener("click", (evento) => {
    if (evento.target !== dialogo) return;
    const limites = dialogo.getBoundingClientRect();
    if (evento.clientX < limites.left || evento.clientX > limites.right ||
        evento.clientY < limites.top || evento.clientY > limites.bottom) dialogo.close();
  });
  dialogo.addEventListener("close", () => {
    document.body.style.overflow = overflowAnterior;
    if (origen && origen.isConnected) origen.focus({ preventScroll: true });
    contenido.replaceChildren();
    origen = null;
  });
})();
