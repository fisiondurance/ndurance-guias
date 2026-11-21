/**
 * Presentacion de la calculadora de bidon y gel casero: redondeo para la cocina, medidas
 * caseras en cuartos, opciones de la pantalla, valores por defecto y traduccion del estado
 * de la pantalla a la entrada de los motores. Funciones puras, sin DOM.
 *
 * Spec: docs/specs/2026-10-03-calculadora-bidon-gel-brand-html.md
 */
(function (global) {
  'use strict';

  const enNode = typeof module !== 'undefined' && module.exports;
  const bidon = enNode ? require('./calc-bidon.js') : global.NduranceBidon;

  // Decimales maximos por tipo de dato: lo que se puede pesar o medir en casa.
  const DECIMALES = Object.freeze({ fuente: 0, sal: 1, ml: 0, cho: 1, concentracion: 1, densidad: 2, mg: 0 });

  /** Cifra en es-ES con los decimales de su tipo y sin ceros de relleno. */
  function cifra(valor, tipo) {
    if (!(tipo in DECIMALES)) throw new Error(`Tipo de cifra desconocido: ${tipo}`);
    const n = Number(valor);
    if (!Number.isFinite(n)) return '0';
    return new Intl.NumberFormat('es-ES', { maximumFractionDigits: DECIMALES[tipo] }).format(n);
  }

  const FRACCIONES = ['', '¼', '½', '¾'];

  /** Cantidad al cuarto mas cercano: 0,23 -> ¼ y 4,68 -> 4 ¾. Vacio si no hay nada que medir. */
  function cuartos(valor) {
    const n = Number(valor);
    if (!Number.isFinite(n) || n <= 0) return '';
    const total = Math.round(n * 4);
    if (total === 0) return 'menos de ¼';
    const enteros = Math.floor(total / 4);
    const fraccion = FRACCIONES[total % 4];
    if (!enteros) return fraccion;
    return fraccion ? `${enteros} ${fraccion}` : String(enteros);
  }

  const UNIDADES = Object.freeze({
    rasa: ['cucharada rasa', 'cucharadas rasas'],
    sopera: ['cucharada sopera', 'cucharadas soperas'],
    cucharadita: ['cucharadita rasa', 'cucharaditas rasas'],
  });
  const SAL_POR_CUCHARADITA = 5; // g: 1 g de sal es 1/5 de cucharadita

  /** "≈ 4 ¾ cucharadas rasas"; en plural solo por encima de una unidad. */
  function medidaCasera(cantidad, unidad) {
    const texto = cuartos(cantidad);
    if (!texto) return '';
    const [singular, plural] = UNIDADES[unidad];
    const nombre = Math.round(Number(cantidad) * 4) > 4 ? plural : singular;
    return texto.startsWith('menos') ? `${texto} ${nombre}` : `≈ ${texto} ${nombre}`;
  }

  function medidaFuente(fuente, gramos) {
    if (!fuente || !(gramos > 0)) return '';
    return medidaCasera(gramos / fuente.cucharada.gramos, fuente.cucharada.tipo);
  }

  function medidaSal(gramos) {
    return gramos > 0 ? medidaCasera(gramos / SAL_POR_CUCHARADITA, 'cucharadita') : '';
  }

  // Opciones de la pantalla. Donde hay desplegable, los enlaces solo aceptan estos valores.
  const RATIOS = Object.freeze(['2:1', '1:0.8', '1:1', '1:0']);
  const ETIQUETAS_RATIO = Object.freeze({ '2:1': '2:1', '1:0.8': '1:0,8', '1:1': '1:1', '1:0': 'Solo CHO 1' });
  const NIVELES_SODIO = Object.freeze([
    { mg: 0, nombre: 'Sin sodio', descripcion: 'Solo agua o bebida sin sales' },
    { mg: 250, nombre: 'Bajo', descripcion: 'Poco sodio' },
    { mg: 400, nombre: 'Moderado', descripcion: 'Para sesiones suaves o clima fresco' },
    { mg: 600, nombre: 'Estándar', descripcion: 'Opción general para entrenamientos largos' },
    { mg: 800, nombre: 'Alto', descripcion: 'Calor, mucho sudor o sesiones largas' },
    { mg: 1000, nombre: 'Muy alto', descripcion: 'Sudador salado o condiciones exigentes' },
  ].map((nivel) => Object.freeze(nivel)));
  const SODIO_GEL = Object.freeze([0, 100, 150, 200, 250, 300, 400]);
  const CAPACIDADES_GEL = Object.freeze([100, 150, 250, 300, 500]);
  // Tope de tomas por softflask (Mario, 2026-10-03): frena un enlace con un millon de tomas,
  // que generaria una tabla de dosis capaz de colgar la pestana.
  const TOMAS_MAX = 20;

  const POR_DEFECTO = Object.freeze({
    bidon: Object.freeze({
      modo: 'cantidad', cho: 60, conc: 6, ml: 750, n: 1,
      f1: 'maltodextrina', f2: 'fructosa', ratio: '2:1', sodio: 600, sodioprod: 0,
    }),
    gel: Object.freeze({
      modo: 'softflask', cho: 90, ml: 150, formato: 'gel', tomas: 4,
      f1: 'maltodextrina', f2: 'fructosa', ratio: '1:0.8', sodio: 200, sodioprod: 0,
    }),
  });

  const RATIO = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/;

  /** "1:0.8" -> [1, 0.8]; null si no es un ratio o sus partes suman cero. */
  function partesRatio(texto) {
    const m = RATIO.exec(String(texto));
    if (!m) return null;
    const a = Number(m[1]);
    const b = Number(m[2]);
    return a + b > 0 ? [a, b] : null;
  }

  function textoRatio(ratio) {
    if (ETIQUETAS_RATIO[ratio]) return ETIQUETAS_RATIO[ratio];
    const [a, b] = partesRatio(ratio) || [0, 0];
    return `${cifra(a, 'cho')} : ${cifra(b, 'cho')} (personalizado)`;
  }

  /** El nivel de sodio del bidon (mg/L) traducido a mg por bidon con el volumen elegido. */
  function traduccionSodio(mgL, ml) {
    if (!(mgL > 0)) return 'Sin sodio añadido.';
    if (!(ml > 0)) return `${cifra(mgL, 'mg')} mg/L de sodio.`;
    return `Con bidón de ${cifra(ml, 'ml')} ml, aporta ${cifra((mgL * ml) / 1000, 'mg')} mg de sodio por bidón.`;
  }

  function densidad(id) {
    const fuente = bidon.fuentePorId(id);
    return fuente ? fuente.densidad : 0;
  }

  /** Estado del bidon en pantalla -> entrada de validarEntrada y calcularBidon. */
  function aEntradaBidon(e) {
    // Un ratio que no reparte nada (0:0) se queda en 0:0, como hacia la calculadora anterior.
    const [ratioA, ratioB] = partesRatio(e.ratio) || [0, 0];
    return {
      modo: e.modo, cho: e.cho, concentracion: e.conc, capacidad: e.ml, nBidones: e.n,
      densidadA: densidad(e.f1), densidadB: densidad(e.f2), ratioA, ratioB,
      sodioLitro: e.sodio, sodioProducto: e.sodioprod,
    };
  }

  /** Estado del gel en pantalla -> entrada de validarGel y calcularGel. */
  function aEntradaGel(e) {
    const [ratioA, ratioB] = partesRatio(e.ratio) || [0, 0];
    return {
      modo: e.modo, cho: e.cho, formato: e.formato, capacidad: e.ml, nTomas: e.tomas,
      densidadA: densidad(e.f1), densidadB: densidad(e.f2), ratioA, ratioB,
      sodioPorToma: e.sodio, sodioProducto: e.sodioprod,
    };
  }

  const api = {
    cifra, cuartos, medidaFuente, medidaSal, partesRatio, textoRatio, traduccionSodio,
    aEntradaBidon, aEntradaGel,
    RATIOS, ETIQUETAS_RATIO, NIVELES_SODIO, SODIO_GEL, CAPACIDADES_GEL, TOMAS_MAX, POR_DEFECTO,
  };
  global.NdurancePresentacion = api;
  if (enNode) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
