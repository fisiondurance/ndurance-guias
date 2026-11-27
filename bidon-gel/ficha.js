/**
 * Ficha de receta imprimible de una pagina, comun a bidon y gel. Devuelve el documento
 * HTML completo; abrirlo en una ventana e imprimirlo es cosa de calculadora.js.
 *
 * Spec: docs/specs/2026-10-03-calculadora-bidon-gel-brand-html.md y, para la seccion 6 del
 * brand book y el cierre publico, docs/specs/2026-11-26-bidon-gel-web-y-publica.md
 */
(function (global) {
  'use strict';

  const enNode = typeof module !== 'undefined' && module.exports;
  const p = enNode ? require('./presentacion.js') : global.NdurancePresentacion;
  const res = enNode ? require('./resultado.js') : global.NduranceResultado;
  const { cifra } = p;

  // El logo llega como URL absoluta (el src del logo de la pagina): asi funciona igual en la
  // pagina servida y en el autocontenido. Sin el, la franja sale sin imagen.
  const franja = (logo) =>
    `<header class="rc-franja">${logo ? `<img src="${logo}" alt="FisioNdurance, Mario Godoy">` : ''}</header>`;
  const caja = (tipo, rotulo, texto) =>
    `<div class="rc-caja rc-caja-${tipo}"><p class="rc-rotulo">${rotulo}</p><p>${texto}</p></div>`;

  function documentoReceta({ titulo, ingredientes, extraLinea, aviso, pasos, tabla, params, cierre, logo }) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${titulo} | FisioNdurance</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo+Narrow:wght@600;700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
  /* Brand book 2.2, seccion 6 (documentos A4): franja negra a sangre con el wordmark, titular
     centrado a 28 pt, titulos de seccion a 14 pt, cajas de foco y de aviso con rotulo y pie.
     Filas, pasos y tabla van apretados para que la ficha del gel quepa en una hoja. */
  @page { size: A4; margin: 14mm 0 16mm; }
  @page :first { margin-top: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Inter', system-ui, sans-serif; color: #1F1A1D; background: #FFFFFF; font-size: 11pt; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .rc-franja { min-height: 22mm; padding: 5mm 17mm; background: #111111; }
  .rc-franja img { display: block; height: 12mm; width: auto; }
  .rc-cuerpo { padding: 0 17mm; }
  .rc-titular { margin: 6mm 0 4pt; font-family: 'Archivo Narrow', system-ui, sans-serif; font-weight: 700; font-size: 28pt; line-height: 1; text-align: center; color: #1F1A1D; }
  .rc-seccion { margin: 0; break-inside: avoid; }
  .rc-seccion h2 { margin: 18pt 0 8pt; padding-bottom: 4px; border-bottom: 1pt solid #B71677; font-family: 'Inter', system-ui, sans-serif; font-weight: 600; font-size: 14pt; text-transform: uppercase; color: #B71677; }
  .rc-ingredientes { list-style: none; margin: 0; padding: 0; }
  .rc-ing { display: flex; align-items: baseline; gap: 10px; padding: 5px 0; border-bottom: 1px solid #E5E5E5; }
  .rc-ing-nombre { flex: 1; font-weight: 600; }
  .rc-ing-casera { font-size: 9pt; color: #675E63; }
  .rc-ing-cant { font-family: 'Archivo Narrow', system-ui, sans-serif; font-weight: 700; font-size: 14pt; font-variant-numeric: tabular-nums; color: #1F1A1D; white-space: nowrap; }
  .rc-agua { margin: 8px 0 0; font-size: 10pt; font-weight: 600; color: #1F1A1D; }
  .rc-bascula { margin: 6px 0 0; font-size: 9pt; color: #675E63; }
  .rc-pasos { margin: 0; padding-left: 22px; }
  .rc-pasos li { margin-bottom: 3px; }
  .rc-tabla { border-collapse: collapse; width: 100%; }
  .rc-tabla th, .rc-tabla td { border-bottom: 1px solid #E5E5E5; padding: 4px 8px; text-align: left; font-size: 10pt; }
  .rc-tabla th { font-weight: 600; font-size: 11pt; color: #1F1A1D; border-bottom: 1.2pt solid #1F1A1D; }
  .rc-tabla tbody tr:nth-child(even) td { background: #F3F3F3; }
  .rc-tabla td:first-child { font-weight: 600; }
  .rc-tabla th:not(:first-child), .rc-tabla td:not(:first-child) { text-align: right; font-variant-numeric: tabular-nums; }
  .rc-caja { margin: 12pt 0 0; padding: 10px 14px; border-left: 1.2mm solid #B71677; background: #F3F3F3; font-size: 10pt; font-variant-numeric: tabular-nums; color: #1F1A1D; break-inside: avoid; }
  .rc-caja p { margin: 0; }
  .rc-caja .rc-rotulo { margin-bottom: 4px; font-weight: 600; font-size: 9pt; text-transform: uppercase; color: #B71677; }
  .rc-caja-aviso { border-left-color: #B45309; }
  .rc-caja-aviso .rc-rotulo { color: #B45309; }
  .rc-cierre { margin: 10pt 0 0; font-size: 9.5pt; color: #675E63; }
  .rc-footer { margin-top: 14px; padding-top: 8px; border-top: 1px solid #E5E5E5; font-size: 7pt; color: #675E63; }
</style>
</head>
<body>
  ${franja(logo)}
  <main class="rc-cuerpo">
  <h1 class="rc-titular">${titulo}</h1>
  <section class="rc-seccion">
    <h2>Ingredientes</h2>
    <ul class="rc-ingredientes">${ingredientes}</ul>
    ${extraLinea || ''}
  </section>
  <section class="rc-seccion">
    <h2>Preparación</h2>
    <ol class="rc-pasos">${pasos}</ol>
  </section>
  ${tabla || ''}
  ${aviso ? caja('aviso', 'Aviso', aviso) : ''}
  ${caja('foco', 'Parámetros', params)}
  <p class="rc-cierre">${cierre}</p>
  <footer class="rc-footer">NDURANCE Nutrition · Mario Godoy</footer>
  </main>
</body>
</html>`;
  }

  function ingredientesHTML(filas) {
    return filas.map((f) =>
      `<li class="rc-ing"><span class="rc-ing-nombre">${f.nombre}</span>` +
      (f.casera ? `<span class="rc-ing-casera">${f.casera}</span>` : '') +
      `<span class="rc-ing-cant">${f.gramos} g</span></li>`).join('');
  }

  const pasosHTML = (pasos) => pasos.map((paso) => `<li>${paso}</li>`).join('');
  const bascula = (filas) => (filas.length ? `<p class="rc-bascula">${res.BASCULA}</p>` : '');

  function fichaBidon(r, e, opciones = {}) {
    const filas = res.ingredientes(r, e);
    return documentoReceta({
      titulo: 'Receta de bidón',
      ingredientes: ingredientesHTML(filas),
      extraLinea: `<p class="rc-agua">Agua hasta ${cifra(e.ml, 'ml')} ml.</p>${bascula(filas)}`,
      aviso: r.aviso ? res.AVISO_CONCENTRADO : '',
      pasos: pasosHTML(res.pasosBidon(filas, e.ml)),
      params: `${cifra(r.choTotal, 'cho')} g CHO · ${cifra(r.concentracion, 'concentracion')}% · ` +
        `${res.NIVEL_TEXTO[r.nivel]} · ratio ${p.textoRatio(e.ratio)} · ${cifra(e.sodio, 'mg')} mg/L sodio`,
      cierre: res.cierreBidon(e.modo, Boolean(opciones.publica)),
      logo: opciones.logo || '',
    });
  }

  function fichaGel(r, e, opciones = {}) {
    const dosis = r.tomas.filas.map((f) =>
      `<tr><td>Toma ${f.toma}</td><td>${cifra(f.ml, 'ml')} ml</td><td>${cifra(f.cho, 'cho')} g</td></tr>`).join('');
    const sodioToma = Number(e.sodio) > 0 ? ` · ${cifra(e.sodio, 'mg')} mg sodio/toma` : '';
    const filas = res.ingredientes(r, e);
    return documentoReceta({
      titulo: 'Receta de gel casero',
      ingredientes: ingredientesHTML(filas),
      extraLinea: `<p class="rc-agua">Softflask de ${cifra(r.capacidad, 'ml')} ml · ${r.formato}.</p>${bascula(filas)}`,
      aviso: r.avisoBlando ? res.AVISO_DENSO : '',
      pasos: pasosHTML(res.pasosGel(r.capacidad)),
      tabla: '<section class="rc-seccion"><h2>Dosis por toma</h2><table class="rc-tabla">' +
        `<thead><tr><th>Toma</th><th>Volumen</th><th>CHO</th></tr></thead><tbody>${dosis}</tbody></table></section>`,
      params: `${cifra(r.choTotal, 'cho')} g CHO · ${r.tomas.n} tomas de ${cifra(r.tomas.choPorToma, 'cho')} g · ` +
        `${r.formato} · ${cifra(r.densidad, 'densidad')} g/ml${sodioToma}`,
      cierre: 'Tómalo siempre con agua: el softflask no sustituye la hidratación. Prepáralo el día de uso; sin conservantes no aguanta. Pruébalo en entrenamientos antes de competir.',
      logo: opciones.logo || '',
    });
  }

  const api = { fichaBidon, fichaGel };
  global.NduranceFicha = api;
  if (enNode) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
