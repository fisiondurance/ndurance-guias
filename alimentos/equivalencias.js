/**
 * Calculadora de equivalencias de la guia de alimentos.
 *
 * Iguala un macro: de los gramos que el menu marca de un alimento saca los gramos de su
 * macro principal y devuelve, para cada alternativa de su grupo de intercambio, la cantidad
 * que aporta esos mismos gramos. Lo que no se iguala se ensena como diferencia, porque una
 * equivalencia no es una identidad nutricional.
 *
 * Spec: docs/specs/2026-09-27-calculadora-equivalencias-guia.md, revisada en
 * docs/specs/2026-10-04-revision-calculadora-equivalencias.md
 */
(function (global) {
  "use strict";

  const ETIQUETAS = { kcal: "kcal", proteinas: "proteína", hc: "hidratos", grasas: "grasa" };
  const ICONO_AJUSTE = '<svg class="eq-aviso-icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path class="eq-aviso-triangulo" d="M12 3 2 21h20L12 3Z"/>' +
    '<path class="eq-aviso-signo" d="M12 9v5m0 3v.1"/></svg>';
  // Los grupos de intercambio se nombran para el deportista, no con la jerga de la base.
  const ETIQUETAS_GRUPO = {
    "HC comida / guarnición": "Hidratos para comida o cena",
    "HC desayuno / snack": "Hidratos para desayuno o snack",
    "Proteína magra": "Proteínas magras",
    "Proteína grasa / mixta": "Proteínas con más grasa",
    "Legumbre / mixto": "Legumbres",
    "Lácteos / bebidas": "Leche, yogures y kéfir",
    "Lácteos proteicos": "Lácteos altos en proteína",
  };
  const nombreGrupo = (grupo) => ETIQUETAS_GRUPO[grupo] || grupo;
  // En que estado se pesa cada alimento: la cantidad del menu y la de cada alternativa se
  // leen asi. "listo" no lleva etiqueta: se pesa tal como viene y no hay duda posible.
  const ESTADOS = {
    crudo: { nota: "En crudo", etiqueta: "crudo" },
    cocido: { nota: "Ya cocinado", etiqueta: "cocido" },
    escurrido: { nota: "Escurrido", etiqueta: "escurrido" },
    seco: { nota: "En seco", etiqueta: "en seco" },
    listo: { nota: "Tal como viene", etiqueta: "" },
  };
  const REDONDEO = "Resultados redondeados a 5 g.";

  /** La nota bajo la cantidad: en que estado se pesa el alimento elegido. */
  function notaCantidad(origen) {
    const estado = origen && propio(ESTADOS, origen.estado);
    return estado ? `${estado.nota}. ${REDONDEO}` : REDONDEO;
  }
  // El macro que iguala cada grupo. Un grupo que no esta aqui no entra en la calculadora.
  // Los lacteos, por proteina desde el 2026-10-08: por racion no eran equivalentes.
  const MACRO_POR_GRUPO = {
    "HC comida / guarnición": "hc",
    "HC desayuno / snack": "hc",
    "HC rápido / competición": "hc",
    "Proteína magra": "proteinas",
    "Proteína grasa / mixta": "proteinas",
    "Proteína vegetal": "proteinas",
    "Lácteos proteicos": "proteinas",
    "Lácteos / bebidas": "proteinas",
    Grasas: "grasas",
    "Legumbre / mixto": "mayor", // el que mas pese de hidratos y proteina
  };
  // Grupos que se cruzan, en un bloque detras de los del propio grupo: hidratos de comida y de
  // desayuno, y leche o yogur con los lacteos altos en proteina.
  const GRUPO_AFIN = {
    "HC comida / guarnición": "HC desayuno / snack",
    "HC desayuno / snack": "HC comida / guarnición",
    "Lácteos / bebidas": "Lácteos proteicos",
    "Lácteos proteicos": "Lácteos / bebidas",
  };
  // Solo claves propias: un grupo llamado "constructor" no es un grupo del mapa.
  const propio = (mapa, clave) =>
    Object.prototype.hasOwnProperty.call(mapa, clave) ? mapa[clave] : undefined;
  const ORDEN_MACROS = ["kcal", "proteinas", "hc", "grasas"];
  const PESO_PRIORIDAD = { Alta: 0, Media: 1, Baja: 2 };
  const PASO = 5; // los gramos se redondean a multiplos de 5: nadie pesa 137 g de arroz
  // Margenes aprobados por Mario el 2026-11-08, sobre la racion final redondeada.
  const MARGENES = {
    kcal: { minimo: 30, proporcion: 0.2 },
    grasas: { minimo: 3, proporcion: 0.3 },
    proteinas: { minimo: 5, proporcion: 0.2 },
    hc: { minimo: 5, proporcion: 0.2 },
  };
  // Cada bloque ensena sus primeras alternativas y guarda el resto tras su propio boton: un
  // grupo de proteina magra trae 40 y, con un corte unico, el ultimo bloque no se veia.
  const POR_BLOQUE = 4;
  const SUGERENCIAS = 8; // alimentos que propone el buscador mientras se escribe
  const SIN_RESULTADO =
    "No lo encuentro en la calculadora. Si es fruta o verdura, se cambia por ración: lo " +
    "tienes en «Frutas y verduras». Si es otra cosa, prueba con otro nombre o pregúntame.";

  const redondear = (valor, decimales) => {
    const factor = 10 ** decimales;
    return Math.round(valor * factor) / factor;
  };

  /** El macro que define el intercambio: lo dice el grupo, y en las legumbres el que mas pesa. */
  function macroPorDefecto(alimento) {
    const macro = propio(MACRO_POR_GRUPO, alimento.grupo);
    if (macro === "mayor") return alimento.hc >= alimento.proteinas ? "hc" : "proteinas";
    return macro || null;
  }

  /** Solo entran los grupos del mapa. */
  function entraEnCalculadora(alimento) {
    return propio(MACRO_POR_GRUPO, alimento.grupo) !== undefined;
  }

  /** Solo en las legumbres se ofrece cambiar el macro: es donde el automatico se discute. */
  function macroConmutable(alimento) {
    return propio(MACRO_POR_GRUPO, alimento.grupo) === "mayor";
  }

  /** Gramos del macro elegido que aporta esa cantidad del alimento. */
  function gramosDeMacro(alimento, cantidad, macro) {
    return redondear((cantidad * alimento[macro]) / 100, 2);
  }

  /** Cantidad del destino que aporta esos gramos del macro, redondeada a 5 g. */
  function cantidadEquivalente(gramosMacro, destino, macro) {
    if (!destino[macro]) return 0;
    return Math.round((gramosMacro * 100) / destino[macro] / PASO) * PASO;
  }

  function _valores(alimento, cantidad) {
    return {
      kcal: Math.round((cantidad * alimento.kcal) / 100),
      proteinas: redondear((cantidad * alimento.proteinas) / 100, 1),
      hc: redondear((cantidad * alimento.hc) / 100, 1),
      grasas: redondear((cantidad * alimento.grasas) / 100, 1),
    };
  }

  /** Diferencias que superan su margen; el macro igualado no se clasifica. */
  function ajustesDe(origen, cantidadOrigen, destino, cantidadDestino, macro) {
    return ORDEN_MACROS.filter((m) => m !== macro).flatMap((m) => {
      const valorOrigen = (cantidadOrigen * origen[m]) / 100;
      const delta = (cantidadDestino * destino[m]) / 100 - valorOrigen;
      const margen = Math.max(MARGENES[m].minimo, valorOrigen * MARGENES[m].proporcion);
      // Admitir el limite exacto aunque la multiplicacion introduzca ruido binario.
      return Math.abs(delta) - margen > 1e-9
        ? [{ macro: m, delta: redondear(delta, m === "kcal" ? 0 : 1) }]
        : [];
    });
  }

  /**
   * Las alternativas del grupo del origen y de su grupo afin, con su cantidad equivalente y
   * lo que se desvian.
   *
   * La familia no excluye: agrupa. `permitir_misma_familia` viaja en los datos pero no se
   * aplica, decision cerrada con Mario el 2026-10-08: los duplicados se ocultan con `Oculto`.
   * Para volver a aplicarlo, filtrar con
   * `origen.permitir_misma_familia || a.familia !== origen.familia`.
   * Orden: su familia, el resto de su grupo y, al final, el grupo afin.
   */
  function alternativas(origen, cantidad, macro, alimentos) {
    const gramosMacro = gramosDeMacro(origen, cantidad, macro);
    const valoresOrigen = _valores(origen, cantidad);
    const afin = propio(GRUPO_AFIN, origen.grupo);
    const lista = alimentos
      .filter((a) => a.id !== origen.id && a[macro] > 0)
      .filter((a) => a.grupo === origen.grupo || (afin !== undefined && a.grupo === afin))
      .map((a) => {
        const equivalente = cantidadEquivalente(gramosMacro, a, macro);
        const valores = _valores(a, equivalente);
        const mismoGrupo = a.grupo === origen.grupo;
        return {
          id: a.id,
          nombre: a.nombre,
          grupo: a.grupo,
          familia: a.familia,
          marca: a.marca || "",
          estado: a.estado || "",
          prioridad: a.prioridad,
          cantidad: equivalente,
          kcal: valores.kcal,
          ajustes: ajustesDe(origen, cantidad, a, equivalente, macro),
          misma_familia: mismoGrupo && a.familia === origen.familia,
          afin: !mismoGrupo,
          diferencias: ORDEN_MACROS.filter((m) => m !== macro).map((m) => ({
            macro: m,
            origen: valoresOrigen[m],
            destino: valores[m],
            delta: redondear((equivalente * a[m]) / 100 - (cantidad * origen[m]) / 100,
              m === "kcal" ? 0 : 1),
          })),
        };
      })
      .filter((a) => a.cantidad > 0);

    const bloque = (a) => (a.misma_familia ? 0 : a.afin ? 2 : 1);
    return lista.sort((a, b) => {
      if (bloque(a) !== bloque(b)) return bloque(a) - bloque(b);
      const prioridad = (PESO_PRIORIDAD[a.prioridad] ?? 1) - (PESO_PRIORIDAD[b.prioridad] ?? 1);
      if (prioridad) return prioridad;
      return (
        Math.abs(a.kcal - valoresOrigen.kcal) - Math.abs(b.kcal - valoresOrigen.kcal)
      );
    });
  }

  const normalizar = (texto) =>
    String(texto).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  /**
   * Los alimentos cuyo nombre lleva todas las palabras de la consulta, sin tildes ni
   * mayusculas. Primero los que empiezan por ella, despues los que tienen una palabra que
   * empieza por ella y al final el resto; a igualdad, por orden alfabetico.
   */
  function buscar(alimentos, consulta, maximo = SUGERENCIAS) {
    const texto = normalizar(consulta);
    if (!texto) return [];
    const palabras = texto.split(/\s+/);
    return alimentos
      .map((alimento) => ({ alimento, nombre: normalizar(alimento.nombre) }))
      .filter(({ nombre }) => palabras.every((palabra) => nombre.includes(palabra)))
      .map((c) => ({
        ...c,
        puntos: c.nombre.startsWith(texto)
          ? 0
          : c.nombre.split(/[^a-z0-9]+/).some((trozo) => trozo.startsWith(palabras[0]))
            ? 1
            : 2,
      }))
      .sort((a, b) => a.puntos - b.puntos || a.nombre.localeCompare(b.nombre, "es"))
      .slice(0, maximo)
      .map((c) => c.alimento);
  }

  // --- Interfaz ------------------------------------------------------------------

  const escapar = (texto) =>
    String(texto).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /** Numero como se escribe en castellano: coma decimal, sin decimal inutil y con su signo. */
  function cifra(valor, decimales, conSigno) {
    const texto = Math.abs(valor).toFixed(decimales).replace(/[.,]0+$/, "").replace(".", ",");
    if (!conSigno) return texto;
    return (valor > 0 ? "+" : valor < 0 ? "\u2212" : "") + texto;
  }

  /** Una sugerencia por alimento: el nombre y, debajo, su grupo y la marca si la tiene. */
  function _sugerencias(alimentos) {
    return alimentos
      .map(
        (a) =>
          `<li role="option"><button type="button" data-eq-elegir="${escapar(a.id)}">` +
          `<span class="eq-alimento">${escapar(a.nombre)}</span>` +
          `<span class="eq-detalle">${escapar(nombreGrupo(a.grupo))}` +
          `${a.marca ? `, ${escapar(a.marca)}` : ""}</span></button></li>`
      )
      .join("");
  }

  /**
   * El detalle bajo cada alternativa, en piezas que no se parten: el estado en que se pesa,
   * sus kcal con el desvio y cada macro que cambia. Lo que se iguala no sale: no cambia.
   */
  function _detalle(alternativa) {
    const estado = propio(ESTADOS, alternativa.estado);
    const kcal = alternativa.diferencias.find((d) => d.macro === "kcal");
    const partes = [];
    if (estado && estado.etiqueta) partes.push(`<span class="eq-estado">${estado.etiqueta}</span>`);
    partes.push(
      `<span class="eq-dato">${alternativa.kcal} kcal` +
        (kcal && kcal.delta ? ` <span class="eq-delta">${cifra(kcal.delta, 0, true)}</span>` : "") +
        "</span>"
    );
    alternativa.diferencias
      .filter((d) => d.macro !== "kcal" && d.delta !== 0)
      .forEach((d) =>
        partes.push(
          `<span class="eq-dato"><span class="eq-delta">${cifra(d.delta, 1, true)}</span> g ${ETIQUETAS[d.macro]}</span>`
        )
      );
    return partes.join("");
  }

  /** Cada alternativa es una ficha: nombre y marca, los gramos a la derecha y el detalle debajo. */
  function _lista(filas) {
    const items = filas
      .map((a, i) => {
        const oculta = i >= POR_BLOQUE ? ' class="eq-oculta"' : "";
        const marca = a.marca ? `<span class="eq-marca">${escapar(a.marca)}</span>` : "";
        return (
          `<li${oculta}>` +
          `<span class="eq-alimento">${escapar(a.nombre)}${marca}</span>` +
          `<span class="eq-gramos">${a.cantidad} g</span>` +
          `<span class="eq-detalle">${_detalle(a)}</span>` +
          (a.ajustes && a.ajustes.length
            ? `<span class="eq-ajuste">${ICONO_AJUSTE}Requiere ajuste: ${a.ajustes.map((d) =>
              `${cifra(d.delta, d.macro === "kcal" ? 0 : 1, true)} ${d.macro === "kcal" ? "kcal" : `g de ${ETIQUETAS[d.macro]}`}`
            ).join("; ")}.</span>`
            : "") +
          "</li>"
        );
      })
      .join("");
    return `<ul class="eq-lista">${items}</ul>`;
  }

  /**
   * Las alternativas en bloques: su familia, el resto de su grupo y el grupo afin. Cada bloque
   * ensena sus primeras y guarda el resto tras su propio boton.
   */
  function _familias(filas, origen) {
    const suyas = filas.filter((a) => a.misma_familia);
    const resto = filas.filter((a) => !a.misma_familia && !a.afin);
    const afines = filas.filter((a) => a.afin);
    const partes = [];
    const anadir = (titulo, lista) => {
      if (!lista.length) return;
      const mas =
        lista.length > POR_BLOQUE
          ? `<p class="eq-mas"><button type="button" data-eq-mas>Ver ${lista.length - POR_BLOQUE} más</button></p>`
          : "";
      partes.push(`<div class="eq-bloque"><h4>${escapar(titulo)}</h4>${_lista(lista)}${mas}</div>`);
    };
    anadir(origen.familia || "De la misma familia", suyas);
    anadir(suyas.length ? "Otras opciones" : nombreGrupo(origen.grupo), resto);
    if (afines.length) anadir(nombreGrupo(afines[0].grupo), afines);
    return partes.join("");
  }

  /** Separar por compatibilidad antes de agrupar por familia, sin quitar alternativas. */
  function bloques(filas, origen) {
    if (!filas.length) {
      return '<p class="eq-vacio">Este alimento todavía no tiene alternativas con macros en la base.</p>';
    }
    const directas = filas.filter((a) => !a.ajustes || !a.ajustes.length);
    const ajustar = filas.filter((a) => a.ajustes && a.ajustes.length);
    const partes = [
      '<div class="eq-categoria"><h3>Sustituciones directas</h3>' +
      (directas.length
        ? '<p class="eq-nota">Igualan el nutriente de referencia sin superar los márgenes de energía y los demás nutrientes. Comprueba que el cambio tenga sentido en tu receta.</p>' + _familias(directas, origen)
        : '<p class="eq-vacio">Para esta cantidad no hay sustituciones directas dentro de los márgenes.</p>') +
      '</div>',
    ];
    if (ajustar.length) {
      partes.push(`<details class="eq-categoria eq-categoria-ajuste"><summary>${ICONO_AJUSTE}Ver opciones que requieren ajuste (${ajustar.length})</summary><div class="eq-categoria-contenido">` +
        '<p class="eq-nota">Mantienen el macro de referencia, pero cambian demasiado la energía u otros macros. Consúltame antes de hacer el cambio.</p>' +
        _familias(ajustar, origen) + '</div></details>');
    }
    return partes.join("");
  }

  /** Monta la calculadora en `contenedor` con los alimentos de `datos`. */
  function montar(contenedor, datos) {
    const disponibles = (datos || []).filter(entraEnCalculadora);
    if (!contenedor || !disponibles.length) return;
    contenedor.innerHTML =
      '<div class="eq-controles">' +
      '<div class="eq-campo eq-buscar" data-eq-buscar><label for="eq-alimento">Alimento del menú</label>' +
      '<input id="eq-alimento" type="search" autocomplete="off" spellcheck="false" ' +
      'placeholder="Escribe: arroz, pollo, avena" role="combobox" aria-autocomplete="list" ' +
      'aria-expanded="false" aria-controls="eq-sugerencias" data-eq-alimento>' +
      '<ul id="eq-sugerencias" class="eq-sugerencias" role="listbox" hidden data-eq-sugerencias></ul>' +
      "</div>" +
      '<p class="eq-campo"><label for="eq-cantidad">Cantidad</label>' +
      '<span class="eq-cantidad"><input id="eq-cantidad" type="number" min="5" step="5" value="100" ' +
      'inputmode="numeric" data-eq-cantidad><span>g</span></span>' +
      `<span class="eq-ayuda" data-eq-ayuda>${REDONDEO}</span></p>` +
      "</div>" +
      // La referencia: lo que aporta el alimento elegido y el macro que se iguala.
      '<div class="eq-referencia" data-eq-referencia hidden>' +
      '<p class="eq-resumen" data-eq-resumen></p>' +
      '<p class="eq-macro" data-eq-macro></p>' +
      "</div>" +
      '<div data-eq-resultado></div>';

    const campo = contenedor.querySelector("[data-eq-buscar]");
    const buscador = contenedor.querySelector("[data-eq-alimento]");
    const sugerencias = contenedor.querySelector("[data-eq-sugerencias]");
    const cantidad = contenedor.querySelector("[data-eq-cantidad]");
    const resumen = contenedor.querySelector("[data-eq-resumen]");
    const resultado = contenedor.querySelector("[data-eq-resultado]");
    const pie = contenedor.querySelector("[data-eq-macro]");
    const referencia = contenedor.querySelector("[data-eq-referencia]");
    const ayuda = contenedor.querySelector("[data-eq-ayuda]");
    let origen = null;
    let macro = null;

    function cerrarSugerencias() {
      sugerencias.hidden = true;
      sugerencias.innerHTML = "";
      buscador.setAttribute("aria-expanded", "false");
    }

    function sugerir() {
      if (!normalizar(buscador.value)) {
        cerrarSugerencias();
        return;
      }
      const encontrados = buscar(disponibles, buscador.value);
      sugerencias.innerHTML = encontrados.length
        ? _sugerencias(encontrados)
        : `<li class="eq-sin-resultado">${escapar(SIN_RESULTADO)}</li>`;
      sugerencias.hidden = false;
      buscador.setAttribute("aria-expanded", "true");
    }

    function elegir(id) {
      const elegido = disponibles.find((a) => a.id === id);
      if (!elegido) return;
      if (elegido !== origen) macro = macroPorDefecto(elegido);
      origen = elegido;
      buscador.value = elegido.nombre;
      cerrarSugerencias();
      pintar();
    }

    function pintar() {
      ayuda.textContent = notaCantidad(origen);
      // Sin alimento elegido no hay referencia: la indicacion va encima, en el texto de la guia.
      if (!origen) {
        referencia.hidden = true;
        resumen.textContent = "";
        resultado.innerHTML = "";
        pie.innerHTML = "";
        return;
      }
      referencia.hidden = false;
      const gramos = Math.max(Number(cantidad.value) || 0, 0);
      if (!gramos) {
        resumen.textContent = "Escribe la cantidad que marca tu menú.";
        resultado.innerHTML = "";
        pie.innerHTML = "";
        return;
      }
      const gramosMacro = gramosDeMacro(origen, gramos, macro);
      resumen.innerHTML =
        `<strong>${gramos} g de ${escapar(origen.nombre)}</strong> aportan ` +
        `<span class="eq-aporte">${cifra(gramosMacro, 1)} g de ${ETIQUETAS[macro]}</span>`;
      resultado.innerHTML = bloques(alternativas(origen, gramos, macro, disponibles), origen);

      pie.innerHTML = `Igualando <strong>${ETIQUETAS[macro]}</strong>.`;
      if (macroConmutable(origen)) {
        const otro = macro === "hc" ? "proteinas" : "hc";
        pie.innerHTML +=
          ` <button type="button" data-eq-cambiar>Igualar por ${ETIQUETAS[otro]}</button>`;
        pie.querySelector("[data-eq-cambiar]").addEventListener("click", () => {
          macro = otro;
          pintar();
        });
      }

      resultado.querySelectorAll("[data-eq-mas]").forEach((boton) => {
        boton.addEventListener("click", () => {
          boton
            .closest(".eq-bloque")
            .querySelectorAll(".eq-oculta")
            .forEach((fila) => fila.classList.remove("eq-oculta"));
          boton.parentElement.remove();
        });
      });
    }

    buscador.addEventListener("input", sugerir);
    // Al volver al campo se selecciona lo escrito: en el movil, teclear ya lo sustituye.
    buscador.addEventListener("focus", () => buscador.select());
    buscador.addEventListener("keydown", (evento) => {
      const primera = sugerencias.querySelector("[data-eq-elegir]");
      if (evento.key === "Enter" && primera) {
        evento.preventDefault();
        elegir(primera.dataset.eqElegir);
      } else if (evento.key === "ArrowDown" && primera) {
        evento.preventDefault();
        primera.focus();
      } else if (evento.key === "Escape") {
        cerrarSugerencias();
      }
    });
    sugerencias.addEventListener("click", (evento) => {
      const boton = evento.target.closest("[data-eq-elegir]");
      if (boton) elegir(boton.dataset.eqElegir);
    });
    sugerencias.addEventListener("keydown", (evento) => {
      const botones = Array.from(sugerencias.querySelectorAll("[data-eq-elegir]"));
      const i = botones.indexOf(evento.target);
      if (evento.key === "ArrowDown" && i < botones.length - 1) {
        evento.preventDefault();
        botones[i + 1].focus();
      } else if (evento.key === "ArrowUp") {
        evento.preventDefault();
        (i > 0 ? botones[i - 1] : buscador).focus();
      } else if (evento.key === "Escape") {
        cerrarSugerencias();
        buscador.focus();
      }
    });
    // La lista se cierra al salir del campo con el teclado o al tocar fuera. En iOS un boton
    // tocado no recibe el foco, asi que perderlo sin destino no cierra nada.
    campo.addEventListener("focusout", (evento) => {
      if (evento.relatedTarget && !campo.contains(evento.relatedTarget)) cerrarSugerencias();
    });
    document.addEventListener("click", (evento) => {
      if (!campo.contains(evento.target)) cerrarSugerencias();
    });
    cantidad.addEventListener("input", pintar);
    pintar();
  }

  const api = {
    macroPorDefecto, entraEnCalculadora, macroConmutable, gramosDeMacro, cantidadEquivalente,
    alternativas, ajustesDe, bloques, buscar, nombreGrupo, notaCantidad, montar,
  };
  global.NduranceEquivalencias = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
