/**
 * Interfaz de la calculadora de bidon y gel casero en la guia bidon-gel: monta el
 * formulario en el bloque :::calculadora, recalcula en vivo tras el primer calculo, abre
 * la ficha imprimible y copia el enlace con la pauta. Los calculos y el texto del
 * resultado viven en los modulos puros; aqui solo se lee y se escribe la pagina.
 *
 * Spec: docs/specs/2026-10-03-calculadora-bidon-gel-brand-html.md
 */
(function (global) {
  'use strict';

  const B = global.NduranceBidon;
  const G = global.NduranceGel;
  const P = global.NdurancePresentacion;
  const E = global.NduranceEnlace;
  const R = global.NduranceResultado;
  const F = global.NduranceFicha;

  const ICONO_BIDON = '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="20.5" y="4" width="7" height="4" rx="1"/><rect x="17" y="8" width="14" height="5" rx="1.5"/><rect x="15" y="13" width="18" height="31" rx="5"/><line x1="15" y1="25" x2="33" y2="25"/></svg>';
  const ICONO_GEL = '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="21" y="4" width="6" height="4" rx="1.5"/><path d="M19.5 8 h9 l-1 6 h-7 z"/><path d="M20 14 C 14 17, 12 24, 12 30 C 12 38, 17 42, 24 42 C 31 42, 36 38, 36 30 C 36 24, 34 17, 28 14 Z"/></svg>';
  const AVISO_ENLACE = 'Algún dato del enlace no era válido: revisa los campos antes de preparar.';
  const PREFIJO = { bidon: 'cb', gel: 'cg' };
  // Campo semantico de los errores del motor -> control visible.
  const CAMPO_ERROR = {
    capacidad: '#cb-ml', concentracion: '#cb-conc', cho: '#cb-cho', nBidones: '#cb-n',
    choGel: '#cg-cho', capacidadGel: '#cg-ml', formatoGel: '#cg-formato', nTomas: '#cg-tomas',
  };
  // Lo que el enlace no aceptaria (erroresEstado) -> control visible y mensaje.
  const CAMPO_ESTADO = {
    bidon: { cho: '#cb-cho', ml: '#cb-ml', n: '#cb-n', ratio: '#cb-ratio', sodio: '#cb-sodio', sodioprod: '#cb-sodioprod' },
    gel: { cho: '#cg-cho', tomas: '#cg-tomas', ratio: '#cg-ratio', sodioprod: '#cg-sodioprod' },
  };
  const MENSAJE_ESTADO = {
    cho: 'Introduce una cantidad válida de CHO.',
    ml: 'Introduce una capacidad válida en ml.',
    n: 'El número de bidones debe ser un entero de 1 o más.',
    tomas: `Las tomas deben ser un número entero de 1 a ${P.TOMAS_MAX}.`,
    ratio: 'Indica partes de CHO 1 y CHO 2 que no sumen cero.',
    sodio: 'El sodio no puede ser negativo.',
    sodioprod: 'El sodio del producto no puede ser negativo.',
  };

  // ---------- Marcado ----------

  const opciones = (pares) => pares.map(([valor, texto]) => `<option value="${valor}">${texto}</option>`).join('');
  const opcionesFuente = () => opciones(B.FUENTES.map((f) => [f.id, f.nombre]));
  const opcionesRatio = () => opciones(P.RATIOS.map((r) => [r, P.ETIQUETAS_RATIO[r]]).concat([['custom', 'Personalizado']]));
  const mayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);
  const nota = (texto, id) => `<span class="calc-nota"${id ? ` id="${id}"` : ''}>${texto}</span>`;
  const numero = (id, min, paso, teclado = 'numeric', max = '') =>
    `<input id="${id}" type="number" min="${min}"${max === '' ? '' : ` max="${max}"`} step="${paso}" inputmode="${teclado}">`;
  const campo = (clase, id, etiqueta, control, extra = '', modo = '') =>
    `<div class="calc-campo ${clase}"${modo ? ` data-solo-modo="${modo}"` : ''}>` +
    `<label for="${id}">${etiqueta}</label>${control}${extra}</div>`;

  const ratioLibre = (pre) =>
    `<div class="calc-ratio-libre" id="${pre}-ratio-libre" hidden>` +
    campo('', `${pre}-ra`, 'Partes CHO 1', numero(`${pre}-ra`, 0, 0.1, 'decimal')) +
    campo('', `${pre}-rb`, 'Partes CHO 2', numero(`${pre}-rb`, 0, 0.1, 'decimal')) +
    '</div>';

  const sodioProducto = (pre, resumen) =>
    `<details class="calc-avanzado"><summary>${resumen}</summary>` +
    `<input id="${pre}-sodioprod" type="number" min="0" step="10" inputmode="numeric" aria-label="Sodio ya aportado por producto en miligramos">` +
    nota('Sodio que ya aporta el producto elegido, si lo aporta.') + '</details>';

  const cola = (textoBoton) =>
    `<button type="button" class="calc-boton" data-calcular>${textoBoton}</button>` +
    `<div class="aviso" data-aviso-enlace hidden><p>${AVISO_ENLACE}</p></div>` +
    '<div class="calc-resultado" data-resultado aria-live="polite" hidden></div>' +
    '<div class="calc-acciones" data-acciones hidden>' +
    '<button type="button" class="calc-boton-secundario" data-imprimir>Imprimir receta</button>' +
    '<button type="button" class="calc-boton-secundario" data-copiar>Copiar enlace</button>' +
    '<span class="calc-estado" role="status" data-estado></span></div>';

  const selectorModo = (etiqueta, modos) =>
    `<div class="selector-objetivos" role="group" aria-label="${etiqueta}">` +
    modos.map(([modo, texto]) => `<button type="button" data-modo="${modo}">${texto}</button>`).join('') + '</div>';

  function htmlBidon() {
    const niveles = P.NIVELES_SODIO.map((s) => [s.mg, `${s.nombre} · ${s.mg} mg/L`]).concat([['custom', 'Personalizado']]);
    return '<section data-bloque="bidon">' +
      selectorModo('Modo de cálculo del bidón', [['cantidad', 'Cantidad de CHO'], ['concentracion', 'Concentración']]) +
      '<div class="calc-panel">' +
      campo('calc-corto', 'cb-cho', 'CHO del bidón (g)', numero('cb-cho', 0, 1), nota('Gramos de hidratos deseados.'), 'cantidad') +
      campo('calc-corto calc-ancho-movil', 'cb-conc', 'Concentración (%)',
        '<div class="calc-deslizador"><input id="cb-conc" type="range" min="4" max="12" step="0.5" ' +
        'aria-label="Concentración de carbohidratos del bidón, de 4 a 12 por ciento">' +
        '<output for="cb-conc" id="cb-conc-valor"></output></div>',
        nota('Porcentaje de CHO respecto al volumen final del bidón.'), 'concentracion') +
      campo('calc-corto', 'cb-ml', 'Capacidad final (ml)', numero('cb-ml', 100, 10)) +
      campo('calc-corto', 'cb-n', 'Bidones a preparar', numero('cb-n', 1, 1)) +
      campo('calc-medio', 'cb-f1', 'Carbohidrato 1', `<select id="cb-f1">${opcionesFuente()}</select>`) +
      campo('calc-medio', 'cb-f2', 'Carbohidrato 2', `<select id="cb-f2">${opcionesFuente()}</select>`) +
      campo('calc-medio', 'cb-ratio', 'Ratio CHO 1 : CHO 2', `<select id="cb-ratio">${opcionesRatio()}</select>`, ratioLibre('cb')) +
      campo('calc-medio', 'cb-sodio', 'Sodio de la bebida',
        `<select id="cb-sodio">${opciones(niveles)}</select>` +
        '<input id="cb-sodio-libre" type="number" min="0" step="10" inputmode="numeric" value="600" aria-label="Sodio personalizado en mg/L" hidden>',
        nota('', 'cb-sodio-desc') + nota('', 'cb-sodio-trad') + sodioProducto('cb', 'Sodio ya aportado por producto (opcional)')) +
      '</div>' + cola('Calcular bidón') + '</section>';
  }

  function htmlGel() {
    const formatos = Object.keys(G.FORMATOS_GEL).map((clave) => [clave, mayuscula(G.FORMATOS_GEL[clave].etiqueta)]);
    return '<section data-bloque="gel" hidden>' +
      selectorModo('Modo de cálculo del gel', [['softflask', 'Por softflask'], ['formato', 'Por formato']]) +
      '<div class="calc-panel">' +
      campo('calc-corto', 'cg-cho', 'CHO total del gel (g)', numero('cg-cho', 0, 1), nota('Gramos de hidratos del softflask.')) +
      campo('calc-corto', 'cg-ml', 'Capacidad del softflask (ml)',
        `<select id="cg-ml">${opciones(P.CAPACIDADES_GEL.map((ml) => [ml, `${ml} ml`]))}</select>`, '', 'softflask') +
      campo('calc-corto', 'cg-formato', 'Formato del gel', `<select id="cg-formato">${opciones(formatos)}</select>`,
        nota('La capacidad necesaria se calcula sola.'), 'formato') +
      campo('calc-corto', 'cg-tomas', 'Tomas por softflask', numero('cg-tomas', 1, 1, 'numeric', P.TOMAS_MAX)) +
      campo('calc-medio', 'cg-f1', 'Carbohidrato 1', `<select id="cg-f1">${opcionesFuente()}</select>`) +
      campo('calc-medio', 'cg-f2', 'Carbohidrato 2', `<select id="cg-f2">${opcionesFuente()}</select>`) +
      campo('calc-medio', 'cg-ratio', 'Ratio CHO 1 : CHO 2', `<select id="cg-ratio">${opcionesRatio()}</select>`, ratioLibre('cg')) +
      campo('calc-medio', 'cg-sodio', 'Sodio por toma (mg)',
        `<select id="cg-sodio">${opciones(P.SODIO_GEL.map((mg) => [mg, `${mg} mg`]))}</select>`,
        nota('El total del softflask se calcula multiplicando por las tomas.') +
        sodioProducto('cg', 'Sodio ya aportado por producto (opcional, total)')) +
      '</div>' + cola('Calcular gel casero') + '</section>';
  }

  function htmlFormulario() {
    const tarjeta = (prep, icono, texto) =>
      `<button type="button" class="tarjeta-seccion" data-prep="${prep}">` +
      `<span class="calc-prep-icono">${icono}</span><span class="tarjeta-titulo">${texto}</span></button>`;
    return '<p class="calc-pregunta">Empieza eligiendo qué vas a preparar</p>' +
      '<div class="calc-prep" role="group" aria-label="Qué quieres preparar">' +
      tarjeta('bidon', ICONO_BIDON, 'Bidón') + tarjeta('gel', ICONO_GEL, 'Gel casero') + '</div>' +
      htmlBidon() + htmlGel();
  }

  // ---------- Pagina ----------

  const valorNumero = (input) => (input.value.trim() === '' ? NaN : Number(input.value));

  function pulsar(botones, atributo, valor) {
    botones.forEach((boton) => boton.setAttribute('aria-pressed', String(boton.dataset[atributo] === valor)));
  }

  function montar(raiz) {
    if (!raiz) return;
    raiz.innerHTML = htmlFormulario();
    const $ = (selector) => raiz.querySelector(selector);
    const bloques = { bidon: $('[data-bloque="bidon"]'), gel: $('[data-bloque="gel"]') };
    const en = (prep, selector) => bloques[prep].querySelector(selector);
    const calculado = { bidon: false, gel: false };
    const enlace = E.deQuery(global.location.search);
    const inicial = enlace ? enlace.estado : E.estadoPorDefecto();
    let choPrevio = null;

    function leer(prep) {
      const pre = PREFIJO[prep];
      const ratioSel = $(`#${pre}-ratio`).value;
      const ratio = ratioSel === 'custom'
        ? `${Number($(`#${pre}-ra`).value) || 0}:${Number($(`#${pre}-rb`).value) || 0}`
        : ratioSel;
      const comunes = {
        modo: en(prep, '.selector-objetivos [aria-pressed="true"]').dataset.modo,
        cho: valorNumero($(`#${pre}-cho`)),
        f1: $(`#${pre}-f1`).value,
        f2: $(`#${pre}-f2`).value,
        ratio,
        sodioprod: Number($(`#${pre}-sodioprod`).value) || 0,
      };
      if (prep === 'bidon') {
        const sodioSel = $('#cb-sodio').value;
        return {
          ...comunes,
          conc: Number($('#cb-conc').value),
          ml: valorNumero($('#cb-ml')),
          n: valorNumero($('#cb-n')),
          sodio: sodioSel === 'custom' ? Number($('#cb-sodio-libre').value) || 0 : Number(sodioSel),
        };
      }
      return {
        ...comunes,
        ml: Number($('#cg-ml').value),
        formato: $('#cg-formato').value,
        tomas: valorNumero($('#cg-tomas')),
        sodio: Number($('#cg-sodio').value),
      };
    }

    function elegirModo(prep, modo) {
      pulsar(bloques[prep].querySelectorAll('.selector-objetivos button'), 'modo', modo);
      bloques[prep].querySelectorAll('[data-solo-modo]').forEach((c) => { c.hidden = c.dataset.soloModo !== modo; });
    }

    function actualizarAyudas(prep) {
      const pre = PREFIJO[prep];
      $(`#${pre}-ratio-libre`).hidden = $(`#${pre}-ratio`).value !== 'custom';
      if (prep !== 'bidon') return;
      const sodioSel = $('#cb-sodio').value;
      $('#cb-sodio-libre').hidden = sodioSel !== 'custom';
      const nivel = P.NIVELES_SODIO.find((s) => String(s.mg) === sodioSel);
      $('#cb-sodio-desc').textContent = nivel ? nivel.descripcion : 'Elige tu sodio exacto';
      const e = leer('bidon');
      $('#cb-sodio-trad').textContent = P.traduccionSodio(e.sodio, e.ml);
      $('#cb-conc-valor').textContent = `${P.cifra(e.conc, 'concentracion')}%`;
    }

    function escribir(prep, e) {
      const pre = PREFIJO[prep];
      elegirModo(prep, e.modo);
      $(`#${pre}-cho`).value = e.cho;
      $(`#${pre}-f1`).value = e.f1;
      $(`#${pre}-f2`).value = e.f2;
      const preset = P.RATIOS.includes(e.ratio);
      const [a, b] = P.partesRatio(e.ratio) || [1, 1];
      $(`#${pre}-ratio`).value = preset ? e.ratio : 'custom';
      $(`#${pre}-ra`).value = preset ? 1 : a;
      $(`#${pre}-rb`).value = preset ? 1 : b;
      $(`#${pre}-sodioprod`).value = e.sodioprod;
      // Con sodio del producto a la vista se entiende por que la sal baja o desaparece.
      $(`#${pre}-sodioprod`).closest('details').open = e.sodioprod > 0;
      if (prep === 'bidon') {
        $('#cb-conc').value = e.conc;
        $('#cb-ml').value = e.ml;
        $('#cb-n').value = e.n;
        const nivel = P.NIVELES_SODIO.some((s) => s.mg === e.sodio);
        $('#cb-sodio').value = nivel ? String(e.sodio) : 'custom';
        if (!nivel) $('#cb-sodio-libre').value = e.sodio;
      } else {
        $('#cg-ml').value = String(e.ml);
        $('#cg-formato').value = e.formato;
        $('#cg-tomas').value = e.tomas;
        $('#cg-sodio').value = String(e.sodio);
      }
      actualizarAyudas(prep);
    }

    function limpiarErrores() {
      raiz.querySelectorAll('.calc-error').forEach((error) => error.remove());
    }

    /** Errores como { selector, mensaje }: el mensaje va bajo su campo, abriendo el desplegable si lo hay. */
    function pintarErrores(errores) {
      errores.forEach(({ selector, mensaje }) => {
        const control = selector && $(selector);
        if (!control) return;
        const desplegable = control.closest('details');
        if (desplegable) desplegable.open = true;
        control.closest('.calc-campo').insertAdjacentHTML('beforeend', `<p class="calc-error">${mensaje}</p>`);
      });
    }

    function ocultar(prep) {
      const resultado = en(prep, '[data-resultado]');
      resultado.innerHTML = '';
      resultado.hidden = true;
      en(prep, '[data-acciones]').hidden = true;
      en(prep, '[data-estado]').textContent = '';
    }

    /** Calcula con lo que hay en pantalla y pinta el resultado; null si hay errores. */
    function calcular(prep) {
      limpiarErrores();
      // Un "Enlace copiado" de antes del cambio ya no describe lo que hay en pantalla.
      en(prep, '[data-estado]').textContent = '';
      const e = leer(prep);
      // Primero las reglas del enlace: lo que se calcula se tiene que poder compartir.
      const invalidos = E.erroresEstado(prep, e);
      const entrada = prep === 'bidon' ? P.aEntradaBidon(e) : P.aEntradaGel(e);
      const errores = invalidos.length
        ? invalidos.map((clave) => ({ selector: CAMPO_ESTADO[prep][clave], mensaje: MENSAJE_ESTADO[clave] }))
        : (prep === 'bidon' ? B.validarEntrada(entrada) : G.validarGel(entrada))
          .map(({ campo: clave, mensaje }) => ({ selector: CAMPO_ERROR[clave], mensaje }));
      if (errores.length) {
        pintarErrores(errores);
        ocultar(prep);
        return null;
      }
      const r = prep === 'bidon' ? B.calcularBidon(entrada) : G.calcularGel(entrada);
      const resultado = en(prep, '[data-resultado]');
      resultado.innerHTML = prep === 'bidon' ? R.htmlResultadoBidon(r, e) : R.htmlResultadoGel(r, e);
      resultado.hidden = false;
      en(prep, '[data-acciones]').hidden = prep === 'gel' && !r.viable;
      return { r, e };
    }

    // El boton "Calcular" (y un enlace con pauta) despliega el resultado y baja hasta el.
    // A partir de ahi cada cambio recalcula sin mover la pagina.
    function calcularYMostrar(prep) {
      calculado[prep] = true;
      if (!calcular(prep)) return;
      const avisoEnlace = en(prep, '[data-aviso-enlace]');
      const destino = avisoEnlace.hidden ? en(prep, '.calc-titulo') : avisoEnlace;
      destino.scrollIntoView({ behavior: 'smooth', block: 'start' });
      en(prep, '.calc-titulo').focus({ preventScroll: true });
    }

    // Al superar 60 g de CHO se sugiere 1:0,8 (glucosa:fructosa). Solo al cruzar el umbral
    // y sin pisar un ratio personalizado; el desplegable sigue siendo editable.
    function sugerirRatio() {
      const cho = B.resolverCho(P.aEntradaBidon(leer('bidon')));
      const cruza = (choPrevio === null || choPrevio <= 60) && cho > 60;
      if (cruza && $('#cb-ratio').value !== 'custom') $('#cb-ratio').value = '1:0.8';
      choPrevio = cho;
    }

    function alCambiar(prep, objetivo) {
      if (prep === 'bidon' && ['cb-cho', 'cb-ml', 'cb-conc'].includes(objetivo.id)) sugerirRatio();
      actualizarAyudas(prep);
      if (calculado[prep]) calcular(prep);
    }

    function elegirPreparacion(prep) {
      pulsar(raiz.querySelectorAll('[data-prep]'), 'prep', prep);
      Object.keys(bloques).forEach((clave) => {
        bloques[clave].hidden = clave !== prep;
        calculado[clave] = false;
        ocultar(clave);
        en(clave, '[data-aviso-enlace]').hidden = true;
      });
      limpiarErrores();
    }

    function abrirImpresion(prep, documentoHTML) {
      const ventana = global.open('', '_blank');
      if (!ventana) {
        en(prep, '[data-estado]').textContent = 'El navegador ha bloqueado la ventana de impresión. Permite las ventanas emergentes para esta página.';
        return;
      }
      ventana.document.open();
      ventana.document.write(documentoHTML);
      ventana.document.close();
      ventana.focus();
      // Imprime cuando las fuentes de marca han cargado, para que el PDF no caiga a fuentes
      // de sistema en red lenta. Guarda contra doble impresion y timeout de reserva.
      let impreso = false;
      const lanzar = () => {
        if (impreso) return;
        impreso = true;
        ventana.print();
      };
      if (ventana.document.fonts && ventana.document.fonts.ready) {
        ventana.document.fonts.ready.then(lanzar);
        setTimeout(lanzar, 1500);
      } else {
        setTimeout(lanzar, 150);
      }
    }

    function imprimir(prep) {
      const calculo = calcular(prep);
      if (!calculo || (prep === 'gel' && !calculo.r.viable)) return;
      const ficha = prep === 'bidon' ? F.fichaBidon(calculo.r, calculo.e) : F.fichaGel(calculo.r, calculo.e);
      abrirImpresion(prep, ficha);
    }

    async function copiarEnlace(prep) {
      const estado = { ...E.estadoPorDefecto(), prep, [prep]: leer(prep) };
      const url = `${global.location.href.split(/[?#]/)[0]}?${E.aQuery(estado)}`;
      const aviso = en(prep, '[data-estado]');
      try {
        await global.navigator.clipboard.writeText(url);
        aviso.textContent = 'Enlace copiado';
      } catch (error) {
        // Sin portapapeles (archivo local o permiso denegado): la URL queda seleccionada.
        aviso.innerHTML = '<input class="calc-enlace" type="text" readonly aria-label="Enlace con la pauta">';
        const campoEnlace = aviso.querySelector('input');
        campoEnlace.value = url;
        campoEnlace.select();
      }
    }

    // ---------- Eventos ----------

    raiz.querySelectorAll('[data-prep]').forEach((boton) => {
      boton.addEventListener('click', () => elegirPreparacion(boton.dataset.prep));
    });
    Object.keys(bloques).forEach((prep) => {
      bloques[prep].querySelectorAll('.selector-objetivos button').forEach((boton) => {
        boton.addEventListener('click', () => {
          elegirModo(prep, boton.dataset.modo);
          limpiarErrores();
          actualizarAyudas(prep);
          if (calculado[prep]) calcular(prep);
        });
      });
      ['input', 'change'].forEach((tipo) => {
        bloques[prep].addEventListener(tipo, (evento) => alCambiar(prep, evento.target));
      });
      en(prep, '[data-calcular]').addEventListener('click', () => calcularYMostrar(prep));
      en(prep, '[data-imprimir]').addEventListener('click', () => imprimir(prep));
      en(prep, '[data-copiar]').addEventListener('click', () => copiarEnlace(prep));
    });

    // ---------- Estado inicial ----------

    escribir('bidon', inicial.bidon);
    escribir('gel', inicial.gel);
    choPrevio = B.resolverCho(P.aEntradaBidon(inicial.bidon));
    elegirPreparacion(inicial.prep);
    if (enlace) {
      en(inicial.prep, '[data-aviso-enlace]').hidden = enlace.errores.length === 0;
      calcularYMostrar(inicial.prep);
    }
  }

  global.NduranceCalculadora = { montar };
})(typeof window !== 'undefined' ? window : globalThis);
