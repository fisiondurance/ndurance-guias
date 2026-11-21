/**
 * Motor de calculo del gel casero. Funciones puras, sin DOM.
 * Reutiliza los helpers de reparto del bidon.
 *
 * Reglas de calculo: docs/specs/2026-07-28-calculadora-bidon-y-gel-casero.md
 */
(function (global) {
  'use strict';

  const enNode = typeof module !== 'undefined' && module.exports;
  const { repartoRatio, choAProducto } = enNode ? require('./calc-bidon.js') : global.NduranceBidon;

  const VOL_CHO = 0.62; // ml de disolucion aproximados por gramo de CHO

  const FORMATOS_GEL = {
    muy_liquido: { densidad: 0.4, etiqueta: 'muy líquido' },
    hidrogel: { densidad: 0.6, etiqueta: 'hidrogel' },
    gel: { densidad: 0.8, etiqueta: 'gel' },
    gel_muy_denso: { densidad: 1.0, etiqueta: 'gel muy denso' },
  };

  const DENSIDAD_MAX_VIABLE = 1.1; // g CHO/ml: techo fisico de viabilidad

  function densidadFormato(formato) {
    const f = FORMATOS_GEL[formato];
    return f ? f.densidad : 0;
  }

  function resolverGel({ modo, cho, formato, capacidad }) {
    const choTotal = Number(cho);
    if (modo === 'formato') {
      // Del formato deseado se deriva la densidad y, con el CHO, la capacidad
      const densidad = densidadFormato(formato);
      const cap = densidad > 0 ? choTotal / densidad : 0;
      return { choTotal, capacidad: cap, densidad };
    }
    // modo 'softflask' (por defecto): de la capacidad del softflask se deriva la densidad
    const cap = Number(capacidad);
    const densidad = cap > 0 ? choTotal / cap : 0;
    return { choTotal, capacidad: cap, densidad };
  }

  function interpretarFormato(densidad) {
    const d = Number(densidad);
    if (d > DENSIDAD_MAX_VIABLE) {
      return { formato: 'gel_muy_denso', etiqueta: 'no viable', avisoBlando: false, viable: false };
    }
    if (d >= 0.9) return { formato: 'gel_muy_denso', etiqueta: 'gel muy denso', avisoBlando: true, viable: true };
    if (d >= 0.7) return { formato: 'gel', etiqueta: 'gel', avisoBlando: false, viable: true };
    if (d >= 0.5) return { formato: 'hidrogel', etiqueta: 'hidrogel', avisoBlando: false, viable: true };
    return { formato: 'muy_liquido', etiqueta: 'muy líquido', avisoBlando: false, viable: true };
  }

  function calcularSodioTotal({ sodioTotal, sodioProducto }) {
    // Clamp defensivo: la UI nunca envia un objetivo negativo, pero lo aseguramos
    const objetivo = Math.max(0, Number(sodioTotal || 0));
    const pendiente = Math.max(0, objetivo - Number(sodioProducto || 0));
    const sal = pendiente / 400;
    return { objetivo, pendiente, sal };
  }

  function tablaTomas(choTotal, capacidad, nTomas) {
    const n = Math.max(1, Math.floor(Number(nTomas) || 1));
    const choPorToma = Number(choTotal) / n;
    const mlPorToma = Number(capacidad) / n;
    const filas = [];
    for (let k = 1; k <= n; k += 1) {
      filas.push({ toma: k, ml: mlPorToma, cho: choPorToma, choAcumulado: choPorToma * k });
    }
    return { n, choPorToma, mlPorToma, filas };
  }

  function referenciaMl(densidad, capacidad, mls = [10, 15, 20, 25, 30, 50]) {
    const cap = Number(capacidad);
    return mls
      .filter((ml) => ml <= cap)
      .map((ml) => ({ ml, cho: Number(densidad) * ml }));
  }

  function validarGel(input) {
    // Devuelve errores tipados { campo, mensaje }. `campo` es semantico
    // (no un id del DOM); la capa de interfaz lo mapea a su campo visible.
    const errores = [];
    const cho = Number(input.cho);
    if (Number.isNaN(cho) || cho <= 0) errores.push({ campo: 'choGel', mensaje: 'Introduce una cantidad válida de CHO.' });
    if (input.modo === 'formato') {
      if (!densidadFormato(input.formato)) errores.push({ campo: 'formatoGel', mensaje: 'Elige un formato de gel.' });
    } else {
      const cap = Number(input.capacidad);
      if (!cap || cap <= 0) errores.push({ campo: 'capacidadGel', mensaje: 'Introduce una capacidad válida del softflask.' });
    }
    const n = Number(input.nTomas);
    if (Number.isNaN(n) || n < 1) errores.push({ campo: 'nTomas', mensaje: 'El número de tomas debe ser al menos 1.' });
    return errores;
  }

  function calcularGel(input) {
    const { choTotal, capacidad, densidad } = resolverGel(input);
    const { etiqueta, avisoBlando, viable } = interpretarFormato(densidad);
    const { choA, choB } = repartoRatio(choTotal, input.ratioA, input.ratioB);
    const productoA = choAProducto(choA, input.densidadA);
    const productoB = choAProducto(choB, input.densidadB);
    const tomas = tablaTomas(choTotal, capacidad, input.nTomas);
    // El deportista indica el sodio por toma; el total del softflask = sodio/toma x numero de tomas
    const sodioObjetivo = Number(input.sodioPorToma || 0) * tomas.n;
    const sodio = calcularSodioTotal({ sodioTotal: sodioObjetivo, sodioProducto: input.sodioProducto });
    const referencia = referenciaMl(densidad, capacidad);
    const aguaAprox = Math.max(0, capacidad - choTotal * VOL_CHO);
    return {
      choTotal, capacidad, densidad, formato: etiqueta, avisoBlando, viable,
      fuenteA: { cho: choA, producto: productoA },
      fuenteB: { cho: choB, producto: productoB },
      sodio, tomas, referencia, aguaAprox,
    };
  }

  const api = {
    VOL_CHO, FORMATOS_GEL, DENSIDAD_MAX_VIABLE,
    densidadFormato, resolverGel, interpretarFormato, calcularSodioTotal,
    tablaTomas, referenciaMl, validarGel, calcularGel,
  };
  global.NduranceGel = api;
  if (enNode) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
