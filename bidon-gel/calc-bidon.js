/**
 * Motor de calculo del bidon. Funciones puras, sin DOM.
 *
 * Reglas de calculo: docs/specs/2026-07-28-calculadora-bidon-y-gel-casero.md
 * Empaquetado y catalogo de fuentes: docs/specs/2026-10-03-calculadora-bidon-gel-brand-html.md
 */
(function (global) {
  'use strict';

  // Fuentes de hidratos. El id viaja en los enlaces con la pauta: no cambiarlo.
  // densidad: % de CHO del producto. cucharada: gramos por cucharada (~15 ml); los polvos
  // se miden rasos y los liquidos (miel, sirope) como cucharada sopera. La bascula manda.
  const FUENTES = Object.freeze([
    { id: 'azucar', nombre: 'Azúcar de mesa', densidad: 100, cucharada: { gramos: 12, tipo: 'rasa' } },
    { id: 'maltodextrina', nombre: 'Maltodextrina', densidad: 95, cucharada: { gramos: 9, tipo: 'rasa' } },
    { id: 'dextrosa', nombre: 'Dextrosa/glucosa', densidad: 100, cucharada: { gramos: 10, tipo: 'rasa' } },
    { id: 'fructosa', nombre: 'Fructosa', densidad: 100, cucharada: { gramos: 12, tipo: 'rasa' } },
    { id: 'miel', nombre: 'Miel', densidad: 80, cucharada: { gramos: 21, tipo: 'sopera' } },
    { id: 'sirope', nombre: 'Sirope', densidad: 78, cucharada: { gramos: 20, tipo: 'sopera' } },
    { id: 'bebida-polvo', nombre: 'Bebida deportiva en polvo', densidad: 90, cucharada: { gramos: 9, tipo: 'rasa' } },
  ].map((fuente) => Object.freeze({ ...fuente, cucharada: Object.freeze({ ...fuente.cucharada }) })));

  function fuentePorId(id) {
    return FUENTES.find((fuente) => fuente.id === id) || null;
  }

  function formatearNumero(valor, maxDec = 2) {
    if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return '0';
    return new Intl.NumberFormat('es-ES', { maximumFractionDigits: maxDec }).format(Number(valor));
  }

  function calcularConcentracion(choTotal, capacidad) {
    const cap = Number(capacidad);
    if (!cap || cap <= 0) return 0;
    return (Number(choTotal) / cap) * 100;
  }

  function resolverCho({ modo, cho, concentracion, capacidad }) {
    if (modo === 'concentracion') {
      return (Number(concentracion) / 100) * Number(capacidad);
    }
    return Number(cho);
  }

  function repartoRatio(choTotal, ratioA, ratioB) {
    const a = Number(ratioA);
    const b = Number(ratioB);
    const suma = a + b;
    if (suma <= 0) return { choA: 0, choB: 0 };
    return {
      choA: (Number(choTotal) * a) / suma,
      choB: (Number(choTotal) * b) / suma,
    };
  }

  function choAProducto(choGramos, densidadPct) {
    const d = Number(densidadPct);
    if (!d || d <= 0) return 0;
    return Number(choGramos) / (d / 100);
  }

  function calcularSodio({ sodioLitro, capacidad, sodioProducto }) {
    const objetivo = (Number(sodioLitro) * Number(capacidad)) / 1000;
    const pendiente = Math.max(0, objetivo - Number(sodioProducto || 0));
    const sal = pendiente / 400;
    return { objetivo, pendiente, sal };
  }

  function interpretarConcentracion(pct) {
    const p = Number(pct);
    if (p < 6) return { nivel: 'suave', aviso: false };
    if (p <= 8) return { nivel: 'estandar', aviso: false };
    if (p <= 10) return { nivel: 'cargado', aviso: false };
    return { nivel: 'muy_concentrado', aviso: true };
  }

  function validarEntrada(input) {
    // Devuelve errores tipados { campo, mensaje }. `campo` es semantico
    // (no un id del DOM); la capa de interfaz lo mapea a su campo visible.
    const errores = [];
    const cap = Number(input.capacidad);
    if (!cap || cap <= 0) errores.push({ campo: 'capacidad', mensaje: 'Introduce una capacidad válida en ml.' });
    if (input.modo === 'concentracion') {
      const c = Number(input.concentracion);
      if (!c || c <= 0) errores.push({ campo: 'concentracion', mensaje: 'Introduce una concentración válida.' });
    } else {
      const cho = Number(input.cho);
      if (Number.isNaN(cho) || cho < 0) errores.push({ campo: 'cho', mensaje: 'Introduce una cantidad válida de CHO.' });
    }
    const n = Number(input.nBidones);
    if (Number.isNaN(n) || n < 1) errores.push({ campo: 'nBidones', mensaje: 'El número de bidones debe ser al menos 1.' });
    return errores;
  }

  function calcularBidon(input) {
    const choTotal = resolverCho(input);
    const capacidad = Number(input.capacidad);
    const concentracion = calcularConcentracion(choTotal, capacidad);
    const { nivel, aviso } = interpretarConcentracion(concentracion);
    const { choA, choB } = repartoRatio(choTotal, input.ratioA, input.ratioB);
    const productoA = choAProducto(choA, input.densidadA);
    const productoB = choAProducto(choB, input.densidadB);
    const sodio = calcularSodio(input);
    const n = Math.max(1, Math.floor(Number(input.nBidones) || 1));
    const tanda = n > 1
      ? { productoA: productoA * n, productoB: productoB * n, sal: sodio.sal * n }
      : null;
    return {
      choTotal, concentracion, nivel, aviso,
      fuenteA: { cho: choA, producto: productoA },
      fuenteB: { cho: choB, producto: productoB },
      sodio, nBidones: n, tanda,
    };
  }

  const api = {
    FUENTES, fuentePorId,
    formatearNumero, calcularConcentracion, resolverCho, repartoRatio, choAProducto,
    calcularSodio, interpretarConcentracion, validarEntrada, calcularBidon,
  };
  global.NduranceBidon = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
