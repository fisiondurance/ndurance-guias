/**
 * Resultado de la calculadora de bidon y gel casero como HTML: resumen, ingredientes en
 * filas con su medida casera, tablas del gel, pasos y avisos. Funciones puras: reciben el
 * resultado del motor y el estado de la pantalla y devuelven texto.
 *
 * Spec: docs/specs/2026-10-03-calculadora-bidon-gel-brand-html.md
 */
(function (global) {
  'use strict';

  const enNode = typeof module !== 'undefined' && module.exports;
  const bidon = enNode ? require('./calc-bidon.js') : global.NduranceBidon;
  const p = enNode ? require('./presentacion.js') : global.NdurancePresentacion;
  const { cifra } = p;

  const NIVEL_TEXTO = Object.freeze({
    suave: 'suave', estandar: 'estándar', cargado: 'cargado', muy_concentrado: 'muy concentrado',
  });
  const AVISO_CONCENTRADO = 'Bidón muy concentrado: puede causar molestias digestivas. Añade más agua o reparte la ingesta en tomas más pequeñas.';
  const AVISO_DENSO = 'Gel muy denso: cuesta disolver y tomar. Prueba con más agua o reparte la toma.';
  // Los cuartos de cucharada son mas gruesos que el gramo: la medida casera no sustituye a la bascula.
  const BASCULA = 'Las medidas caseras son orientativas: la báscula manda.';
  const CIERRE_GEL = 'Este gel es concentrado: tómalo con agua y pruébalo en entrenamientos antes de la competición. El softflask no sustituye la hidratación: bebe agua aparte según tu pauta. Prepáralo el día de uso; sin conservantes no aguanta.';

  // Cierre de la version publica: quien llega desde redes no tiene pauta que mandar
  // (spec 2026-11-26-bidon-gel-web-y-publica.md, postura de Mario sobre el intestino entrenado).
  const CIERRE_PUBLICO = 'Pruébalo antes en entrenamientos. El intestino también se entrena: no tomes por primera vez una cantidad alta el día de la competición.';
  // Phosphor «flask», peso regular: copia de brand_html/assets/iconos/flask.svg (nota con icono, seccion 10).
  const ICONO_CIERRE = '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M221.69,199.77,160,96.92V40h8a8,8,0,0,0,0-16H88a8,8,0,0,0,0,16h8V96.92L34.31,199.77A16,16,0,0,0,48,224H208a16,16,0,0,0,13.72-24.23ZM110.86,103.25A7.93,7.93,0,0,0,112,99.14V40h32V99.14a7.93,7.93,0,0,0,1.14,4.11L183.36,167c-12,2.37-29.07,1.37-51.75-10.11-15.91-8.05-31.05-12.32-45.22-12.81ZM48,208l28.54-47.58c14.25-1.74,30.31,1.85,47.82,10.72,19,9.61,35,12.88,48,12.88a69.89,69.89,0,0,0,19.55-2.7L208,208Z"/></svg>';

  function cierreBidon(modo, publica = false) {
    if (publica) return CIERRE_PUBLICO;
    return modo === 'cantidad'
      ? 'La pauta manda: mantén los gramos de CHO indicados. Consúltalo con tu nutricionista si cambias el volumen de líquido, el sodio o la concentración.'
      : 'Prueba siempre la tolerancia en entrenamientos, nunca en competición.';
  }

  /**
   * Lo que hay que pesar, con las cifras ya redondeadas: las mismas en las filas, en los
   * pasos y en la ficha. Con varios bidones, `tanda` redondea el total exacto.
   */
  function ingredientes(resultado, e) {
    const n = resultado.nBidones > 1 ? resultado.nBidones : 0;
    const fila = (tipo, nombre, gramos, casera, extra) => ({
      tipo, nombre, gramos: cifra(gramos, tipo), casera, extra, tanda: n ? cifra(gramos * n, tipo) : '',
    });
    const filas = [];
    [[e.f1, resultado.fuenteA.producto], [e.f2, resultado.fuenteB.producto]].forEach(([id, gramos]) => {
      if (!(gramos > 0)) return;
      const fuente = bidon.fuentePorId(id);
      filas.push(fila('fuente', fuente.nombre, gramos, p.medidaFuente(fuente, gramos), ''));
    });
    if (resultado.sodio.sal > 0) {
      const sodio = `${cifra(resultado.sodio.pendiente, 'mg')} mg de sodio`;
      filas.push(fila('sal', 'Sal', resultado.sodio.sal, p.medidaSal(resultado.sodio.sal), sodio));
    }
    // Lo que se redondea a 0 no se pesa: ni fila ni "Añade 0 g".
    return filas.filter((f) => f.gramos !== '0');
  }

  function htmlIngredientes(filas, nBidones) {
    if (!filas.length) return '<p class="calc-vacio">Solo agua: no hay nada que pesar.</p>';
    const items = filas.map((f) => {
      const tanda = f.tanda ? `Para ${nBidones} bidones: ${f.tanda} g` : '';
      const detalle = [f.extra, f.casera, tanda].filter(Boolean).join(' · ');
      return '<li><span class="calc-ing-nombre">' + f.nombre +
        (detalle ? `<span class="calc-ing-detalle">${detalle}</span>` : '') +
        `</span><span class="calc-ing-gramos">${f.gramos} g</span></li>`;
    }).join('');
    return `<ul class="calc-ingredientes">${items}</ul><p class="calc-nota">${BASCULA}</p>`;
  }

  const titulo = (texto) => `<h2 class="calc-titulo" tabindex="-1">${texto}</h2>`;
  // Caja neutra con filete magenta; `ambar` es para lo que pide cuidado. El cierre va como nota.
  const aviso = (texto, ambar = false) => `<div class="aviso${ambar ? ' aviso-ambar' : ''}"><p>${texto}</p></div>`;
  const cierre = (texto) => `<p class="nota calc-cierre">${ICONO_CIERRE}<span>${texto}</span></p>`;
  const lista = (pasos) => `<ol class="calc-pasos">${pasos.map((paso) => `<li>${paso}</li>`).join('')}</ol>`;

  function pasosBidon(filas, ml) {
    const sal = filas.find((f) => f.tipo === 'sal');
    return [
      'Agua hasta la mitad del bidón.',
      ...filas.filter((f) => f.tipo === 'fuente').map((f) => `Añade ${f.gramos} g de ${f.nombre}.`),
      sal ? `Añade ${sal.gramos} g de sal.` : 'No añadas sal: el sodio ya está cubierto o no está pautado.',
      'Agita fuerte.',
      `Completa con agua hasta ${cifra(ml, 'ml')} ml.`,
      'Vuelve a agitar. Enfría o añade hielo si hace calor.',
    ];
  }

  function pasosGel(capacidad) {
    return [
      'Añade los hidratos en un vaso o shaker pequeño.',
      'Añade poca agua templada y remueve.',
      'Añade sal o electrolitos si corresponde.',
      'Añade sabor opcional si quieres.',
      'Pasa la mezcla al softflask.',
      `Completa con agua hasta ${cifra(capacidad, 'ml')} ml.`,
      'Agita bien.',
      'Tómalo siempre con agua.',
    ];
  }

  function htmlResultadoBidon(r, e, opciones = {}) {
    const filas = ingredientes(r, e);
    const nivel = `<span class="calc-nivel calc-nivel-${r.nivel.replace('_', '-')}">${NIVEL_TEXTO[r.nivel]}</span>`;
    const bidones = r.nBidones > 1 ? ` · ${r.nBidones} bidones` : '';
    return [
      titulo('Tu Bidón'),
      `<p class="calc-resumen"><strong>${cifra(r.choTotal, 'cho')} g de CHO</strong> en ${cifra(e.ml, 'ml')} ml · ` +
        `${cifra(r.concentracion, 'concentracion')} % ${nivel}${bidones}</p>`,
      htmlIngredientes(filas, r.nBidones),
      r.aviso ? aviso(AVISO_CONCENTRADO, true) : '',
      lista(pasosBidon(filas, e.ml)),
      cierre(cierreBidon(e.modo, Boolean(opciones.publica))),
    ].join('');
  }

  function tablaDatos(cabecera, filas) {
    const th = cabecera.map((celda) => `<th>${celda}</th>`).join('');
    const tr = filas.map((celdas) => `<tr>${celdas.map((celda) => `<td>${celda}</td>`).join('')}</tr>`).join('');
    return `<div class="tabla-envoltorio"><table class="tabla-datos tabla-compacta"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
  }

  function resumenGel(r, e) {
    const donde = e.modo === 'formato'
      ? `en un softflask de ${cifra(r.capacidad, 'ml')} ml (agua ≈ ${cifra(r.aguaAprox, 'ml')} ml)`
      : `en ${cifra(r.capacidad, 'ml')} ml`;
    return `<p class="calc-resumen"><strong>${cifra(r.choTotal, 'cho')} g de CHO</strong> ${donde} · ` +
      `${cifra(r.densidad, 'densidad')} g/ml (${r.formato}) · ` +
      `${r.tomas.n} tomas de ${cifra(r.tomas.choPorToma, 'cho')} g</p>`;
  }

  function htmlResultadoGel(r, e) {
    if (!r.viable) {
      return titulo('Tu Gel Casero') + aviso(
        `No cabe: ${cifra(r.densidad, 'densidad')} g de CHO por ml supera lo exprimible. ` +
        'Sube la capacidad del softflask o baja el CHO.',
        true,
      );
    }
    const dosis = r.tomas.filas.map((f) => [
      `Toma ${f.toma}`, `${cifra(f.ml, 'ml')} ml`, `${cifra(f.cho, 'cho')} g`, `${cifra(f.choAcumulado, 'cho')} g`,
    ]);
    const referencia = r.referencia.map((f) => [`${f.ml} ml`, `${cifra(f.cho, 'cho')} g`]);
    return [
      titulo('Tu Gel Casero'),
      resumenGel(r, e),
      htmlIngredientes(ingredientes(r, e), 1),
      r.avisoBlando ? aviso(AVISO_DENSO, true) : '',
      '<h3>Dosis por División del Softflask</h3>',
      tablaDatos(['Toma', 'ml', 'CHO', 'Acumulado'], dosis),
      '<h3>Referencia Rápida por ml</h3>',
      tablaDatos(['Volumen', 'CHO'], referencia),
      lista(pasosGel(r.capacidad)),
      cierre(CIERRE_GEL),
    ].join('');
  }

  const api = {
    NIVEL_TEXTO, AVISO_CONCENTRADO, AVISO_DENSO, BASCULA, CIERRE_PUBLICO, ICONO_CIERRE, cierreBidon,
    ingredientes, pasosBidon, pasosGel, htmlResultadoBidon, htmlResultadoGel,
  };
  global.NduranceResultado = api;
  if (enNode) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
