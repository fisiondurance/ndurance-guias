// Mayusculas de los titulos de las guias web (brand book 2.2, seccion 10): mayuscula inicial
// en cada palabra salvo articulos, preposiciones, conjunciones y posesivos; la primera, siempre.
// Gemela de titulos.py para lo que pinta el navegador (la calculadora); las dos se prueban
// con titulos_casos.json. En el navegador queda en globalThis.NDTitulos.
(function (raiz) {
  "use strict";

  const MENORES = new Set([
    "el", "la", "los", "las", "lo", "un", "una", "unos", "unas",
    "a", "al", "ante", "bajo", "con", "contra", "de", "del", "desde", "en", "entre", "hacia",
    "hasta", "para", "por", "según", "sin", "sobre", "tras",
    "y", "e", "o", "u", "ni", "que", "pero",
    "mi", "mis", "tu", "tus", "su", "sus",
    "ya",  // adverbio que Mario escribe en minuscula (2026-11-25)
  ]);
  const PUNTUACION = /^[,.;:()«»¿?¡!"']+|[,.;:()«»¿?¡!"']+$/g;

  function mayusculaInicial(palabra) {
    const i = palabra.search(/\p{L}/u);
    if (i < 0) return palabra;
    return palabra.slice(0, i) + palabra[i].toUpperCase() + palabra.slice(i + 1);
  }

  function capitalizar(texto) {
    return texto
      .split(" ")
      .map((palabra, i) => {
        const nucleo = palabra.replace(PUNTUACION, "").toLowerCase();
        return i > 0 && MENORES.has(nucleo) ? palabra.toLowerCase() : mayusculaInicial(palabra);
      })
      .join(" ");
  }

  const api = { capitalizar, MENORES };
  raiz.NDTitulos = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
