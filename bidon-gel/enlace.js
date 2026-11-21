/**
 * Enlace con la pauta: el estado de la calculadora viaja en la query de la URL para que
 * Mario mande a cada cliente su bidon o su gel ya rellenos. Funciones puras, sin DOM.
 *
 * Spec: docs/specs/2026-10-03-calculadora-bidon-gel-brand-html.md
 */
(function (global) {
  'use strict';

  const enNode = typeof module !== 'undefined' && module.exports;
  const bidon = enNode ? require('./calc-bidon.js') : global.NduranceBidon;
  const gel = enNode ? require('./calc-gel.js') : global.NduranceGel;
  const p = enNode ? require('./presentacion.js') : global.NdurancePresentacion;

  // Parametros de cada preparacion y modo, en el orden en que se escriben. El enlace lleva
  // todos, tambien los que coinciden con el valor por defecto: si un dia cambia un valor
  // por defecto, los enlaces que ya tienen los clientes no cambian solos.
  const CLAVES = Object.freeze({
    bidon: Object.freeze({
      cantidad: Object.freeze(['cho', 'ml', 'n', 'f1', 'f2', 'ratio', 'sodio', 'sodioprod']),
      concentracion: Object.freeze(['conc', 'ml', 'n', 'f1', 'f2', 'ratio', 'sodio', 'sodioprod']),
    }),
    gel: Object.freeze({
      softflask: Object.freeze(['cho', 'ml', 'tomas', 'f1', 'f2', 'ratio', 'sodio', 'sodioprod']),
      formato: Object.freeze(['cho', 'formato', 'tomas', 'f1', 'f2', 'ratio', 'sodio', 'sodioprod']),
    }),
  });

  // Cada validador devuelve el valor ya convertido o null si el campo no lo admite.
  const numero = (texto) => {
    if (texto === null || String(texto).trim() === '') return null;
    const n = Number(texto);
    return Number.isFinite(n) ? n : null;
  };
  const desde = (min) => (t) => { const n = numero(t); return n !== null && n >= min ? n : null; };
  const mayorQue = (min) => (t) => { const n = numero(t); return n !== null && n > min ? n : null; };
  const entero = (min, max = Infinity) => (t) => {
    const n = numero(t);
    return n !== null && Number.isInteger(n) && n >= min && n <= max ? n : null;
  };
  const unoDe = (lista) => (t) => { const n = numero(t); return n !== null && lista.includes(n) ? n : null; };
  const textoDe = (lista) => (t) => (lista.includes(t) ? t : null);
  const fuente = (t) => (bidon.fuentePorId(t) ? t : null);
  const ratio = (t) => (p.partesRatio(t) ? t : null);
  // El deslizador va de 4 a 12 % en pasos de medio punto.
  const concentracion = (t) => {
    const n = numero(t);
    return n !== null && n >= 4 && n <= 12 && Number.isInteger(n * 2) ? n : null;
  };

  const VALIDAR = Object.freeze({
    bidon: Object.freeze({
      modo: textoDe(['cantidad', 'concentracion']), cho: desde(0), conc: concentracion, ml: mayorQue(0),
      n: entero(1), f1: fuente, f2: fuente, ratio, sodio: desde(0), sodioprod: desde(0),
    }),
    gel: Object.freeze({
      modo: textoDe(['softflask', 'formato']), cho: mayorQue(0), ml: unoDe(p.CAPACIDADES_GEL),
      formato: textoDe(Object.keys(gel.FORMATOS_GEL)), tomas: entero(1, p.TOMAS_MAX), f1: fuente, f2: fuente,
      ratio, sodio: unoDe(p.SODIO_GEL), sodioprod: desde(0),
    }),
  });

  function estadoPorDefecto() {
    return { prep: 'bidon', bidon: { ...p.POR_DEFECTO.bidon }, gel: { ...p.POR_DEFECTO.gel } };
  }

  /** Estado -> query sin '?': prep, modo y los parametros de ese modo. */
  function aQuery(estado) {
    const datos = estado[estado.prep];
    const pares = [['prep', estado.prep], ['modo', datos.modo]]
      .concat(CLAVES[estado.prep][datos.modo].map((clave) => [clave, datos[clave]]));
    return pares
      .map(([clave, valor]) => `${clave}=${encodeURIComponent(String(valor)).replace(/%3A/g, ':')}`)
      .join('&');
  }

  /**
   * Query -> { estado, errores }, o null si la URL no trae una pauta (sin `prep`).
   * Un valor no valido deja su campo con el valor por defecto y su nombre en `errores`.
   * Los parametros que no son de la calculadora (los que anaden las redes al compartir)
   * se ignoran sin aviso.
   */
  function deQuery(search) {
    const params = new URLSearchParams(search);
    if (!params.has('prep')) return null;
    const estado = estadoPorDefecto();
    const errores = [];
    const prep = params.get('prep');
    if (prep === 'bidon' || prep === 'gel') estado.prep = prep;
    else errores.push('prep');
    const validar = VALIDAR[estado.prep];
    Object.keys(validar).forEach((clave) => {
      if (!params.has(clave)) return;
      const valor = validar[clave](params.get(clave));
      if (valor === null) errores.push(clave);
      else estado[estado.prep][clave] = valor;
    });
    return { estado, errores };
  }

  /**
   * Claves del modo activo que la pantalla tiene con un valor que el enlace no aceptaria.
   * La pantalla se valida con estas mismas reglas: lo que se calcula se puede compartir.
   */
  function erroresEstado(prep, datos) {
    const validar = VALIDAR[prep];
    const claves = ['modo', ...(CLAVES[prep][datos.modo] || [])];
    return claves.filter((clave) => validar[clave](String(datos[clave])) === null);
  }

  const api = { CLAVES, estadoPorDefecto, aQuery, deQuery, erroresEstado };
  global.NduranceEnlace = api;
  if (enNode) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
