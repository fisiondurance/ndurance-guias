/**
 * Calculadora de equivalencias de la guia de alimentos.
 *
 * Iguala un macro: de los gramos que el menu marca de un alimento saca los gramos de su
 * macro principal y devuelve, para cada alternativa de su grupo de intercambio, la cantidad
 * que aporta esos mismos gramos. Lo que no se iguala se ensena como diferencia, porque una
 * equivalencia no es una identidad nutricional.
 *
 * Spec: docs/specs/2026-09-27-calculadora-equivalencias-guia.md, revisada en
 * docs/specs/2026-10-04-revision-calculadora-equivalencias.md y
 * docs/specs/2026-11-14-calculadora-equivalencias-dos-modos.md
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
    return estado ? `${estado.nota}. ${REDONDEO}` :
      (origen ? `Comprueba en tu pauta cómo se pesa. ${REDONDEO}` : REDONDEO);
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

  /** Todos los grupos permiten sustituir el criterio automatico por uno manual. */
  function macroConmutable(alimento) {
    return entraEnCalculadora(alimento);
  }

  /** Una celda vacia o no numerica no representa un aporte nulo. */
  function datosValidos(alimento) {
    return Boolean(alimento && typeof alimento.id === "string" && alimento.id &&
      typeof alimento.nombre === "string" && alimento.nombre &&
      ORDEN_MACROS.every((m) => typeof alimento[m] === "number" &&
        Number.isFinite(alimento[m]) && alimento[m] >= 0));
  }

  /** Gramos positivos, tambien con coma decimal; sin coerciones de texto ambiguo. */
  function leerCantidad(texto) {
    const valor = String(texto).trim();
    if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(valor)) return null;
    const numero = Number(valor.replace(",", "."));
    return Number.isFinite(numero) && numero > 0 ? numero : null;
  }

  /** El criterio manual no abre otros grupos de intercambio. */
  function destinosDe(origen, alimentos) {
    if (!origen || !entraEnCalculadora(origen)) return [];
    const afin = propio(GRUPO_AFIN, origen.grupo);
    return alimentos.filter((a) => datosValidos(a) && a.id !== origen.id &&
      (a.grupo === origen.grupo || (afin !== undefined && a.grupo === afin)));
  }

  /** Gramos del macro elegido que aporta esa cantidad del alimento. */
  function gramosDeMacro(alimento, cantidad, macro) {
    return redondear((cantidad * alimento[macro]) / 100, 2);
  }

  /** Cantidad del destino que aporta esos gramos del macro, redondeada a 5 g. */
  function cantidadEquivalente(gramosMacro, destino, macro) {
    if (!(gramosMacro > 0) || !(destino[macro] > 0)) return 0;
    const cantidad = Math.round((gramosMacro * 100) / destino[macro] / PASO) * PASO;
    return Number.isFinite(cantidad) ? cantidad : 0;
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

  /** Comparacion unica para el sustituto elegido y las recomendaciones. */
  function comparar(origen, cantidad, destino, macro) {
    if (!datosValidos(origen) || !datosValidos(destino) || !Number.isFinite(cantidad) ||
        cantidad <= 0 || !ORDEN_MACROS.includes(macro) || !(origen[macro] > 0) ||
        !destinosDe(origen, [destino]).length) return null;
    // El objetivo de calculo conserva su precision; gramosDeMacro redondea solo para mostrar.
    const equivalente = cantidadEquivalente((cantidad * origen[macro]) / 100, destino, macro);
    if (!equivalente || !ORDEN_MACROS.every((m) =>
      Number.isFinite(cantidad * origen[m]) && Number.isFinite(equivalente * destino[m]))) return null;
    const valoresOrigen = _valores(origen, cantidad);
    const valores = _valores(destino, equivalente);
    const comparacion = ORDEN_MACROS.map((m) => ({
      macro: m, origen: valoresOrigen[m], destino: valores[m],
      delta: redondear((equivalente * destino[m]) / 100 - (cantidad * origen[m]) / 100,
        m === "kcal" ? 0 : 1),
    }));
    return {
      id: destino.id, nombre: destino.nombre, grupo: destino.grupo, familia: destino.familia,
      marca: destino.marca || "", estado: destino.estado || "", prioridad: destino.prioridad,
      cantidad: equivalente, kcal: valores.kcal,
      ajustes: ajustesDe(origen, cantidad, destino, equivalente, macro),
      misma_familia: Boolean(origen.familia) && destino.grupo === origen.grupo && destino.familia === origen.familia,
      afin: destino.grupo !== origen.grupo,
      comparacion,
      diferencias: comparacion.filter((d) => d.macro !== macro),
    };
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
    if (!datosValidos(origen) || !Number.isFinite(cantidad) || cantidad <= 0) return [];
    const valoresOrigen = _valores(origen, cantidad);
    const lista = destinosDe(origen, alimentos)
      .map((a) => comparar(origen, cantidad, a, macro)).filter(Boolean);

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

  const icono = (trazo, clase = "") => `<svg class="eq-icono ${clase}" viewBox="0 0 24 24" ` +
    `fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true" focusable="false">${trazo}</svg>`;
  const LUPA = icono('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>');
  const CHEVRON = icono('<path d="m9 5 7 7-7 7"/>');
  const ELEGIDO = icono('<path d="m5 12 4 4L19 6"/>');
  const ORDEN_GRUPOS = Object.keys(MACRO_POR_GRUPO);
  function iconoGrupo(grupo) {
    if (grupo.startsWith("HC")) return icono('<path d="M4 20 18 6M7 17c-4 0-4-4-4-4 4 0 4 4 4 4ZM11 13c-4 0-4-4-4-4 4 0 4 4 4 4ZM15 9c-4 0-4-4-4-4 4 0 4 4 4 4ZM7 17c0 4 4 4 4 4 0-4-4-4-4-4ZM11 13c0 4 4 4 4 4 0-4-4-4-4-4ZM15 9c0 4 4 4 4 4 0-4-4-4-4-4Z"/>');
    if (grupo.startsWith("Lácteos")) return icono('<path d="M9 3h6v5l3 4v9H6v-9l3-4V3ZM9 7h6M6 14h12"/>');
    if (grupo === "Grasas") return icono('<path d="M12 3s-7 8-7 12a7 7 0 0 0 14 0c0-4-7-12-7-12Z"/>');
    if (grupo.startsWith("Legumbre")) return icono('<path d="M12 21V11M12 15C5 15 4 11 4 6c5 0 8 2 8 7M12 11c0-5 3-7 8-7 0 5-1 9-8 9"/>');
    return icono('<path d="M4 3v6a3 3 0 0 0 6 0V3M7 3v18M18 3v18M18 3c-4 3-4 9 0 9"/>');
  }

  /** Cabeceras al explorar; metadatos de grupo al buscar, sin alterar la relevancia. */
  function _sugerencias(alimentos, prefijo, atributo, agrupar, seleccionado) {
    let grupoAnterior = null;
    return alimentos.map((a, i) => {
      let cabecera = "";
      if (agrupar && a.grupo !== grupoAnterior) {
        grupoAnterior = a.grupo;
        const total = alimentos.filter((opcion) => opcion.grupo === a.grupo).length;
        cabecera = `<li class="eq-opciones-grupo" role="presentation" aria-hidden="true">` +
          `${iconoGrupo(a.grupo)}<span>${escapar(nombreGrupo(a.grupo))}</span><span class="eq-grupo-total">${total}</span></li>`;
      }
      const elegido = seleccionado === a.id;
      const estado = propio(ESTADOS, a.estado);
      const detalles = [!agrupar ? nombreGrupo(a.grupo) : "", a.marca || "", estado ? estado.nota : ""].filter(Boolean);
      return cabecera + `<li role="presentation"><button type="button" role="option" tabindex="-1" ` +
        `id="${prefijo}-opcion-${i}" aria-selected="${elegido}" data-eq-grupo="${escapar(a.grupo)}" ` +
        `data-eq-seleccionada="${elegido}" aria-label="${escapar([a.nombre, nombreGrupo(a.grupo), a.marca || "", estado ? estado.nota : ""].filter(Boolean).join(", "))}" ` +
        `${atributo}="${escapar(a.id)}"><span class="eq-opcion-texto">` +
        `<span class="eq-alimento">${escapar(a.nombre)}</span>` +
        (detalles.length ? `<span class="eq-opcion-meta">${detalles.map(d => `<span>${escapar(d)}</span>`).join("")}</span>` : "") +
        `</span><span class="eq-opcion-indicador">${elegido ? ELEGIDO : CHEVRON}</span></button></li>`;
    }).join("");
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
          `<button type="button" class="eq-comparar" data-eq-comparar="${escapar(a.id)}" ` +
          `aria-label="Comparar ${escapar(a.nombre)}, ${a.cantidad} g">` +
          `<span class="eq-gramos">${a.cantidad} g</span><span>Comparar</span></button>` +
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
  /** Mayusculas de titulo de las guias web (brand book 2.2) si la guia carga titulos.js. */
  function titular(texto) {
    const t = typeof globalThis !== "undefined" ? globalThis.NDTitulos : undefined;
    return t ? t.capitalizar(texto) : texto;
  }

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
      partes.push(`<div class="eq-bloque"><h4>${escapar(titular(titulo))}</h4>${_lista(lista)}${mas}</div>`);
    };
    anadir(origen.familia || "De la misma familia", suyas);
    anadir(suyas.length ? "Otras opciones" : nombreGrupo(origen.grupo), resto);
    if (afines.length) anadir(nombreGrupo(afines[0].grupo), afines);
    return partes.join("");
  }

  /** Separar por compatibilidad antes de agrupar por familia, sin quitar alternativas. */
  function bloques(filas, origen) {
    if (!filas.length) {
      return '<p class="eq-vacio">No hay alternativas calculables para este alimento y criterio en la base.</p>';
    }
    const directas = filas.filter((a) => !a.ajustes || !a.ajustes.length);
    const ajustar = filas.filter((a) => a.ajustes && a.ajustes.length);
    const partes = [
      `<div class="eq-categoria"><h3>${titular("Sustituciones directas")}</h3>` +
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

  /** Comparacion de las dos raciones, incluido el residuo del criterio igualado. */
  function fichaComparacion(a) {
    const estado = propio(ESTADOS, a.estado);
    const filas = ["kcal", "hc", "proteinas", "grasas"].map((m) => {
      const d = a.comparacion.find((c) => c.macro === m);
      const unidad = m === "kcal" ? "" : " g";
      const decimales = m === "kcal" ? 0 : 1;
      return `<tr><th scope="row">${{ kcal: "kcal", hc: "Hidratos", proteinas: "Proteína", grasas: "Grasa" }[m]}</th>` +
        `<td>${cifra(d.origen, decimales)}${unidad}</td><td>${cifra(d.destino, decimales)}${unidad}</td>` +
        `<td>${cifra(d.delta, decimales, true)}${unidad}</td></tr>`;
    }).join("");
    return '<div class="eq-elegido">' +
      `<div class="eq-elegido-cabecera"><div><h3>${escapar(a.nombre)}</h3>` +
      `${a.marca ? `<p class="eq-nota">${escapar(a.marca)}</p>` : ""}</div>` +
      `<strong class="eq-cantidad-destino">${a.cantidad} g</strong></div>` +
      `<p class="eq-nota">${estado ? estado.nota : "Comprueba en tu pauta cómo se pesa."}</p>` +
      (a.ajustes.length
        ? `<div class="eq-aviso-elegido"><strong>${ICONO_AJUSTE}Requiere ajuste</strong><p>` +
          a.ajustes.map((d) => `${cifra(d.delta, d.macro === "kcal" ? 0 : 1, true)} ` +
            `${d.macro === "kcal" ? "kcal" : `g de ${ETIQUETAS[d.macro]}`}`).join("; ") +
          '. Consúltame antes de hacer el cambio.</p></div>'
        : '<p class="eq-directa">Sustitución directa dentro de los márgenes.</p>') +
      '<table class="eq-comparacion"><caption>Comparación de las dos cantidades</caption>' +
      '<thead><tr><th scope="col">Nutriente</th><th scope="col">Pauta</th>' +
      '<th scope="col">Cambio</th><th scope="col">Diferencia</th></tr></thead>' +
      `<tbody>${filas}</tbody></table>` +
      '<p class="eq-nota">La equivalencia es aproximada por el redondeo. Comprueba que el cambio tenga sentido en tu receta.</p></div>';
  }

  let instancias = 0;

  /** Buscador con foco en el campo y opcion activa anunciada mediante ARIA. */
  function montarBuscador(campo, input, lista, obtener, seleccionar, alEscribir, prefijo, atributo, vacio, seleccionado) {
    let encontrados = [];
    let activo = -1;
    function cerrar() {
      lista.hidden = true;
      lista.innerHTML = "";
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      campo.classList.remove("eq-buscar-abierto");
      encontrados = [];
      activo = -1;
    }
    function activar(i) {
      activo = i;
      const opciones = [...lista.querySelectorAll('[role="option"]')];
      opciones.forEach((opcion, j) => opcion.setAttribute("aria-selected", String(i === j)));
      if (opciones[i]) {
        input.setAttribute("aria-activedescendant", opciones[i].id);
        opciones[i].scrollIntoView({ block: "nearest" });
      }
    }
    function elegir(id) {
      const elegido = encontrados.find((a) => a.id === id);
      if (!elegido) return;
      input.value = elegido.nombre;
      cerrar();
      seleccionar(elegido);
    }
    function mostrar(consulta = "") {
      cerrar();
      const opciones = obtener();
      // Sin texto se puede recorrer toda la lista; al escribir se muestran coincidencias.
      const filtrando = Boolean(normalizar(consulta));
      const coincidencias = filtrando ? buscar(opciones, consulta, opciones.length) : [];
      encontrados = filtrando ? coincidencias.slice(0, SUGERENCIAS) : [...opciones].sort((a, b) =>
        ORDEN_GRUPOS.indexOf(a.grupo) - ORDEN_GRUPOS.indexOf(b.grupo) || a.nombre.localeCompare(b.nombre, "es"));
      const total = filtrando && coincidencias.length > encontrados.length ?
        `${encontrados.length} de ${coincidencias.length}` : encontrados.length;
      const info = `<li class="eq-opciones-info" role="presentation" aria-hidden="true">` +
        `<span>${filtrando ? "Coincidencias" : "Elige un alimento"}</span><span>${total}</span></li>`;
      lista.innerHTML = encontrados.length ? info + _sugerencias(encontrados, prefijo, atributo, !filtrando, seleccionado()) :
        `<li class="eq-sin-resultado">${vacio()}</li>`;
      lista.hidden = false;
      input.setAttribute("aria-expanded", "true");
      campo.classList.add("eq-buscar-abierto");
    }
    input.addEventListener("input", () => {
      alEscribir();
      mostrar(input.value);
    });
    input.addEventListener("focus", () => {
      input.select();
      mostrar();
    });
    input.addEventListener("click", () => {
      if (lista.hidden) mostrar();
    });
    input.addEventListener("keydown", (evento) => {
      if (evento.key === "Escape") { cerrar(); return; }
      if (lista.hidden && (evento.key === "ArrowDown" || evento.key === "ArrowUp")) mostrar();
      if (lista.hidden || !encontrados.length) return;
      if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
        evento.preventDefault();
        const paso = evento.key === "ArrowDown" ? 1 : -1;
        activar(activo === -1 ? (paso === 1 ? 0 : encontrados.length - 1) :
          (activo + paso + encontrados.length) % encontrados.length);
      } else if (evento.key === "Enter") {
        evento.preventDefault();
        elegir(encontrados[Math.max(activo, 0)].id);
      }
    });
    lista.addEventListener("mousedown", (evento) => evento.preventDefault());
    lista.addEventListener("click", (evento) => {
      const opcion = evento.target.closest(`[${atributo}]`);
      if (opcion) elegir(opcion.getAttribute(atributo));
    });
    campo.addEventListener("focusout", (evento) => {
      if (evento.relatedTarget && !campo.contains(evento.relatedTarget)) cerrar();
    });
    document.addEventListener("click", (evento) => {
      if (!campo.contains(evento.target)) cerrar();
    });
    return { cerrar };
  }

  /** Monta origen compartido, selector de criterio y los dos paneles. */
  function montar(contenedor, datos) {
    const disponibles = (datos || []).filter((a) => datosValidos(a) && entraEnCalculadora(a));
    if (!contenedor || !disponibles.length) return;
    const id = `eq-${++instancias}`;
    const buscadorHTML = (nombre, etiqueta, atributo, listaAtributo, placeholder) =>
      `<div class="eq-campo eq-buscar" data-eq-campo-${nombre}><label for="${id}-${nombre}">${etiqueta}</label>` +
      `<div class="eq-buscador-entrada"><span class="eq-buscador-lupa">${LUPA}</span>` +
      `<input id="${id}-${nombre}" type="search" autocomplete="off" spellcheck="false" ` +
      `placeholder="${placeholder}" role="combobox" aria-autocomplete="list" aria-expanded="false" ` +
      `aria-controls="${id}-${nombre}-lista" ${atributo}>` +
      `<span class="eq-buscador-desplegar">${icono('<path d="m6 9 6 6 6-6"/>')}</span></div>` +
      `<ul id="${id}-${nombre}-lista" class="eq-sugerencias" role="listbox" aria-label="${etiqueta}" hidden ${listaAtributo}></ul></div>`;
    contenedor.innerHTML = '<div class="eq-controles">' +
      buscadorHTML("origen", "Alimento de tu pauta", "data-eq-alimento", "data-eq-sugerencias", "Escribe: arroz, pollo, avena") +
      `<div class="eq-campo eq-campo-cantidad"><label for="${id}-cantidad">Cantidad</label>` +
      `<span class="eq-cantidad"><input id="${id}-cantidad" type="text" inputmode="decimal" ` +
      `autocomplete="off" value="100" aria-describedby="${id}-ayuda" data-eq-cantidad><span>g</span></span>` +
      `<span id="${id}-ayuda" class="eq-ayuda" data-eq-ayuda>${REDONDEO}</span></div></div>` +
      '<div class="eq-referencia" data-eq-referencia hidden><p class="eq-resumen" data-eq-resumen></p>' +
      '<p class="eq-macro" data-eq-macro></p>' +
      `<details class="eq-criterio" data-eq-criterio-zona><summary>Cambiar criterio</summary>` +
      `<label for="${id}-criterio">Qué quieres igualar</label><select id="${id}-criterio" data-eq-criterio>` +
      '<option value="automatico">Automático por grupo</option><option value="hc">Hidratos</option>' +
      '<option value="proteinas">Proteína</option><option value="grasas">Grasa</option>' +
      '<option value="kcal">Kcal</option></select></details></div>' +
      '<div class="eq-modos" role="tablist" aria-label="Cómo quieres buscar el cambio">' +
      `<button type="button" role="tab" id="${id}-tab-elegir" aria-controls="${id}-panel-elegir" ` +
      'aria-selected="true" data-eq-modo="elegir">Elegir alimento</button>' +
      `<button type="button" role="tab" id="${id}-tab-recomendaciones" aria-controls="${id}-panel-recomendaciones" ` +
      'aria-selected="false" tabindex="-1" data-eq-modo="recomendaciones">Ver recomendaciones</button></div>' +
      '<p class="eq-vacio" role="status" data-eq-mensaje></p>' +
      `<div id="${id}-panel-elegir" role="tabpanel" aria-labelledby="${id}-tab-elegir" data-eq-panel="elegir">` +
      buscadorHTML("destino", "Lo quiero cambiar por", "data-eq-destino", "data-eq-sugerencias-destino", "Busca un sustituto") +
      '<div data-eq-comparacion aria-live="polite" aria-atomic="true"></div></div>' +
      `<div id="${id}-panel-recomendaciones" role="tabpanel" aria-labelledby="${id}-tab-recomendaciones" ` +
      'data-eq-panel="recomendaciones" hidden><div data-eq-resultado></div></div>';

    const q = (selector) => contenedor.querySelector(`[data-eq-${selector}]`);
    const entrada = q("alimento");
    const destinoInput = q("destino");
    const cantidad = q("cantidad");
    const criterio = q("criterio");
    const comparacion = q("comparacion");
    const resultado = q("resultado");
    const referencia = q("referencia");
    const mensaje = q("mensaje");
    const tabs = [...contenedor.querySelectorAll("[data-eq-modo]")];
    let origen = null;
    let ultimoOrigen = null;
    let destino = null;
    let modo = "elegir";
    const macroActual = () => criterio.value === "automatico" ? macroPorDefecto(origen) : criterio.value;
    const candidatos = () => origen ? destinosDe(origen, disponibles).filter((a) => a[macroActual()] > 0) : [];

    function pintar() {
      tabs.forEach((t) => {
        const activo = t.dataset.eqModo === modo;
        t.setAttribute("aria-selected", String(activo));
        t.tabIndex = activo ? 0 : -1;
      });
      contenedor.querySelectorAll("[data-eq-panel]").forEach((p) => { p.hidden = p.dataset.eqPanel !== modo; });
      q("ayuda").textContent = notaCantidad(origen);
      referencia.hidden = !origen;
      q("campo-origen").classList.toggle("eq-confirmado", Boolean(origen));
      q("campo-destino").classList.toggle("eq-confirmado", Boolean(destino));
      const gramos = leerCantidad(cantidad.value);
      cantidad.setAttribute("aria-invalid", String(gramos === null));
      resultado.innerHTML = "";
      comparacion.innerHTML = "";
      destinoInput.disabled = !origen;
      mensaje.textContent = "";
      if (!origen) {
        mensaje.textContent = "Busca el alimento de tu pauta y selecciónalo de la lista.";
        return;
      }
      const macro = macroActual();
      const automatico = criterio.value === "automatico";
      q("macro").textContent = `Igualando ${ETIQUETAS[macro]}. ${automatico ? "Criterio automático por grupo." : "Criterio elegido manualmente."}`;
      q("resumen").textContent = gramos === null ? origen.nombre :
        `${String(gramos).replace(".", ",")} g de ${origen.nombre} aportan ${cifra(gramosDeMacro(origen, gramos, macro), 1)} ${macro === "kcal" ? "kcal" : `g de ${ETIQUETAS[macro]}`}.`;
      if (gramos === null) {
        mensaje.textContent = "Escribe una cantidad mayor que 0 g.";
        return;
      }
      if (!(origen[macro] > 0)) {
        mensaje.textContent = `Este alimento no aporta ${ETIQUETAS[macro]}. Elige otro criterio.`;
        return;
      }
      if (!Number.isFinite(gramos * origen[macro])) {
        q("resumen").textContent = origen.nombre;
        mensaje.textContent = "No se puede calcular esta cantidad. Revisa los gramos de tu pauta.";
        return;
      }
      resultado.innerHTML = bloques(alternativas(origen, gramos, macro, disponibles), origen);
      if (!destino) {
        comparacion.innerHTML = '<p class="eq-vacio">Elige el alimento que quieres usar para ver su cantidad.</p>';
        return;
      }
      if (!(destino[macro] > 0)) {
        comparacion.innerHTML = `<p class="eq-vacio">${escapar(destino.nombre)} no aporta ${ETIQUETAS[macro]}. Elige otro alimento o criterio.</p>`;
        return;
      }
      const cambio = comparar(origen, gramos, destino, macro);
      comparacion.innerHTML = cambio ? fichaComparacion(cambio) :
        '<p class="eq-vacio">No se puede ofrecer una cantidad práctica con este cambio. Elige otro alimento o criterio.</p>';
    }

    const origenBuscador = montarBuscador(q("campo-origen"), entrada, q("sugerencias"),
      () => disponibles, (elegido) => {
        if (ultimoOrigen !== elegido.id) {
          destino = null;
          destinoInput.value = "";
          criterio.value = "automatico";
          q("criterio-zona").open = false;
          destinoBuscador.cerrar();
        }
        origen = elegido;
        ultimoOrigen = elegido.id;
        pintar();
      }, () => {
        if (origen && entrada.value !== origen.nombre) origen = null;
        destinoBuscador.cerrar();
        pintar();
      }, `${id}-origen`, "data-eq-elegir", () => escapar(SIN_RESULTADO), () => origen && origen.id);
    const destinoBuscador = montarBuscador(q("campo-destino"), destinoInput, q("sugerencias-destino"),
      candidatos, (elegido) => { destino = elegido; pintar(); }, () => {
        if (destino && destinoInput.value !== destino.nombre) destino = null;
        pintar();
      }, `${id}-destino`, "data-eq-elegir-destino", () =>
        'No hay coincidencias calculables en este grupo o sus grupos afines. ' +
        '<button type="button" data-eq-ver-recomendaciones>Ver recomendaciones</button>', () => destino && destino.id);

    function cambiarModo(nuevo, enfocar = false) {
      modo = nuevo;
      origenBuscador.cerrar();
      destinoBuscador.cerrar();
      pintar();
      if (enfocar) tabs.find((t) => t.dataset.eqModo === modo).focus();
    }
    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => cambiarModo(tab.dataset.eqModo));
      tab.addEventListener("keydown", (evento) => {
        const indices = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i + tabs.length - 1) % tabs.length,
          Home: 0, End: tabs.length - 1 };
        if (Object.prototype.hasOwnProperty.call(indices, evento.key)) {
          evento.preventDefault();
          cambiarModo(tabs[indices[evento.key]].dataset.eqModo, true);
        }
      });
    });
    contenedor.addEventListener("click", (evento) => {
      const compararBoton = evento.target.closest("[data-eq-comparar]");
      if (compararBoton && origen) {
        destino = candidatos().find((a) => a.id === compararBoton.dataset.eqComparar) || null;
        destinoInput.value = destino ? destino.nombre : "";
        cambiarModo("elegir", true);
      } else if (evento.target.closest("[data-eq-ver-recomendaciones]")) {
        cambiarModo("recomendaciones", true);
      }
      const mas = evento.target.closest("[data-eq-mas]");
      if (mas) {
        mas.closest(".eq-bloque").querySelectorAll(".eq-oculta").forEach((fila) => fila.classList.remove("eq-oculta"));
        const siguiente = mas.closest(".eq-bloque").querySelectorAll("[data-eq-comparar]")[POR_BLOQUE];
        if (siguiente) siguiente.focus();
        mas.parentElement.remove();
      }
    });
    cantidad.addEventListener("input", () => { destinoBuscador.cerrar(); pintar(); });
    criterio.addEventListener("change", () => { destinoBuscador.cerrar(); pintar(); });
    pintar();
  }

  const api = {
    macroPorDefecto, entraEnCalculadora, macroConmutable, gramosDeMacro, cantidadEquivalente,
    alternativas, ajustesDe, bloques, buscar, nombreGrupo, notaCantidad, montar,
    datosValidos, leerCantidad, destinosDe, comparar, fichaComparacion,
  };
  global.NduranceEquivalencias = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
