// tarifas-calc.js — funciones puras de cálculo (sin DOM, sin Firebase)

function tarifasCalcRow(row, tc) {
  const usd = +row.usd || 0;
  const comisionUsd = +row.comisionUsd || 0;
  const tarifaGuiaUsd = +row.tarifaGuiaUsd || 0;
  const costoPaseoArs = +row.costoPaseoArs || 0;
  const costoTransporteArs = +row.costoTransporteArs || 0;
  const blueCompra = +tc.blue_compra || 1;
  const real = +tc.real || 1;
  const costoTotalArs = costoPaseoArs + costoTransporteArs;
  const conversionUsd = costoTotalArs / blueCompra;
  const gananciaUsd = usd - comisionUsd - tarifaGuiaUsd - conversionUsd;
  const gananciaConDescuento = (usd * 0.9) - comisionUsd - tarifaGuiaUsd - conversionUsd;
  const precioReales = usd * (blueCompra / real);
  const margenPct = usd > 0 ? gananciaUsd / usd : 0;
  return { costoTotalArs, conversionUsd, gananciaUsd, gananciaConDescuento, precioReales, margenPct };
}

function tarifasMargenColor(margenPct, gananciaUsd) {
  if (gananciaUsd <= 0) return 'neg';
  if (margenPct >= 0.30) return 'green';
  if (margenPct >= 0.15) return 'yellow';
  return 'red';
}

function tfFmtUSD(v) { return (+v).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2}); }
function tfFmtARS(v) { return Math.round(+v).toLocaleString('es-AR'); }
function tfFmtBRL(v) { return (+v).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2}); }
function tfFmtPct(v) { return (v * 100).toFixed(1) + '%'; }
