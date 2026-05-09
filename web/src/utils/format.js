export function fmtNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const abs = Math.abs(Number(value));
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(digits)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(digits)}M`;
  if (abs >= 1_000) return Number(value).toLocaleString('es-ES', { maximumFractionDigits: digits });
  return Number(value).toLocaleString('es-ES', { maximumFractionDigits: digits });
}

export function fmtPct(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(digits)}%`;
}

export function classForLevel(level) {
  const v = String(level || '').toLowerCase();
  if (['risk_off', 'sell', 'alert', 'action', 'alto'].includes(v)) return 'danger';
  if (['watch', 'neutral', 'hold', 'medio'].includes(v)) return 'warn';
  if (['risk_on', 'buy', 'ok', 'bajo'].includes(v)) return 'ok';
  return 'muted';
}

export function lastOf(arr) {
  return Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null;
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  }[c]));
}

const TREASURY_MATURITY_UNITS = {
  Year: ['año', 'años'],
  Month: ['mes', 'meses']
};

const DB_EXACT_TRANSLATIONS = new Map([
  ['Market Yield on U.S. Treasury Securities at 30-Year Constant Maturity, Quoted on an Investment Basis', 'Rendimiento de mercado de los valores del Tesoro de EE. UU. a vencimiento constante de 30 años, cotizado sobre base de inversión'],
  ['Market Yield on U.S. Treasury Securities at 20-Year Constant Maturity, Quoted on an Investment Basis', 'Rendimiento de mercado de los valores del Tesoro de EE. UU. a vencimiento constante de 20 años, cotizado sobre base de inversión'],
  ['Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity, Quoted on an Investment Basis', 'Rendimiento de mercado de los valores del Tesoro de EE. UU. a vencimiento constante de 10 años, cotizado sobre base de inversión'],
  ['Market Yield on U.S. Treasury Securities at 5-Year Constant Maturity, Quoted on an Investment Basis', 'Rendimiento de mercado de los valores del Tesoro de EE. UU. a vencimiento constante de 5 años, cotizado sobre base de inversión'],
  ['Market Yield on U.S. Treasury Securities at 2-Year Constant Maturity, Quoted on an Investment Basis', 'Rendimiento de mercado de los valores del Tesoro de EE. UU. a vencimiento constante de 2 años, cotizado sobre base de inversión'],
  ['Federal Funds Effective Rate', 'Tasa efectiva de fondos federales'],
  ['Effective Federal Funds Rate', 'Tasa efectiva de fondos federales'],
  ['Unemployment Rate', 'Tasa de desempleo'],
  ['Real Gross Domestic Product', 'Producto interior bruto real'],
  ['Gross Domestic Product', 'Producto interior bruto'],
  ['Consumer Price Index for All Urban Consumers: All Items in U.S. City Average', 'Índice de precios al consumo para todos los consumidores urbanos: todos los artículos en el promedio de ciudades de EE. UU.'],
  ['Industrial Production: Total Index', 'Producción industrial: índice total'],
  ['M2 Money Stock', 'Masa monetaria M2'],
  ['Personal Consumption Expenditures', 'Gasto en consumo personal'],
  ['All Employees, Total Nonfarm', 'Todos los empleados, total no agrícola'],
  ['Retail Sales: Retail Trade', 'Ventas minoristas: comercio minorista'],
  ['Assets', 'Activos'],
  ['Macro indicators', 'Indicadores macro'],
  ['Crypto', 'Cripto'],
  ['prices', 'precios'],
  ['series_prices', 'precios de series'],
  ['daily', 'diaria'],
  ['weekly', 'semanal'],
  ['monthly', 'mensual'],
  ['quarterly', 'trimestral'],
  ['annual', 'anual'],

  // Traducciones específicas de la página Macro datos.
  ['AAII Bullish % - MA50w', 'AAII % alcistas - media móvil de 50 semanas'],
  ['AAII Bullish %', 'AAII % alcistas'],
  ['Bad weather at work 1–34h (usually full-time)', 'Mal tiempo en el trabajo 1–34 h (normalmente jornada completa)'],
  ['Bad weather at work 1-34h (usually full-time)', 'Mal tiempo en el trabajo 1–34 h (normalmente jornada completa)'],
  ['IWM/SPX Ratio (Russell 2000 proxy vs S&P 500) - semanal', 'Ratio IWM/SPX (IWM como proxy del Russell 2000 frente al S&P 500) - semanal'],
  ['IWM/SPX Ratio (Russell 2000 proxy vs S&P 500) - weekly', 'Ratio IWM/SPX (IWM como proxy del Russell 2000 frente al S&P 500) - semanal'],
  ['SPX EMA 20', 'SPX media móvil exponencial de 20 sesiones'],
  ['SPX EMA 50', 'SPX media móvil exponencial de 50 sesiones'],
  ['SPX EMA 200', 'SPX media móvil exponencial de 200 sesiones'],

  // Fuentes y tipos frecuentes.
  ['calc', 'cálculo'],
  ['CALC', 'cálculo'],
  ['BMR_HYPOTHESIS', 'Hipótesis BMR'],
  ['BMR hypothesis', 'Hipótesis BMR'],
  ['BMR Hypothesis', 'Hipótesis BMR'],
  ['FRED', 'FRED'],
  ['BLS', 'BLS'],
  ['AAII', 'AAII']
]);

const DB_TEXT_REPLACEMENTS = [
  [/\bMarket Yield on U\.S\. Treasury Securities at (\d+)-(Year|Month) Constant Maturity, Quoted on an Investment Basis\b/gi, (_, amount, unit) => {
    const [singular, plural] = TREASURY_MATURITY_UNITS[unit] || [unit.toLowerCase(), `${unit.toLowerCase()}s`];
    const unitLabel = Number(amount) === 1 ? singular : plural;
    return `Rendimiento de mercado de los valores del Tesoro de EE. UU. a vencimiento constante de ${amount} ${unitLabel}, cotizado sobre base de inversión`;
  }],
  [/\b(\d+)-(Year|Month) Treasury Constant Maturity Rate\b/gi, (_, amount, unit) => {
    const [singular, plural] = TREASURY_MATURITY_UNITS[unit] || [unit.toLowerCase(), `${unit.toLowerCase()}s`];
    const unitLabel = Number(amount) === 1 ? singular : plural;
    return `Tasa del Tesoro a vencimiento constante de ${amount} ${unitLabel}`;
  }],

  // Reglas genéricas para indicadores de mercado y sentimiento.
  [/\b([A-Z][A-Z0-9./-]*)\s+EMA\s+(\d+)\b/g, '$1 media móvil exponencial de $2 sesiones'],
  [/\b([A-Z][A-Z0-9./-]*)\s+SMA\s+(\d+)\b/g, '$1 media móvil simple de $2 sesiones'],
  [/\b([A-Z][A-Z0-9./-]*)\s+MA\s*(\d+)\s*w\b/gi, '$1 media móvil de $2 semanas'],
  [/\bMA\s*(\d+)\s*w\b/gi, 'media móvil de $1 semanas'],
  [/\bEMA\s+(\d+)\b/g, 'media móvil exponencial de $1 sesiones'],
  [/\bSMA\s+(\d+)\b/g, 'media móvil simple de $1 sesiones'],
  [/\bBullish\b/gi, 'alcistas'],
  [/\bBearish\b/gi, 'bajistas'],
  [/\bNeutral\b/gi, 'neutral'],
  [/\bSentiment\b/gi, 'sentimiento'],
  [/\bRatio\b/gi, 'ratio'],
  [/\bproxy\b/gi, 'proxy'],
  [/\bvs\.?\b/gi, 'frente a'],
  [/\busually full-time\b/gi, 'normalmente jornada completa'],
  [/\bBad weather at work\b/gi, 'Mal tiempo en el trabajo'],
  [/(\d+)\s*[–-]\s*(\d+)h\b/gi, '$1–$2 h'],

  // Reglas macroeconómicas generales.
  [/\bTreasury\b/g, 'Tesoro'],
  [/\bU\.S\.\b/g, 'EE. UU.'],
  [/\bUnited States\b/gi, 'Estados Unidos'],
  [/\bFederal Funds\b/gi, 'fondos federales'],
  [/\bEffective Rate\b/gi, 'tasa efectiva'],
  [/\bInterest Rate\b/gi, 'tipo de interés'],
  [/\bExchange Rate\b/gi, 'tipo de cambio'],
  [/\bUnemployment Rate\b/gi, 'tasa de desempleo'],
  [/\bInflation\b/gi, 'inflación'],
  [/\bConsumer Price Index\b/gi, 'índice de precios al consumo'],
  [/\bProducer Price Index\b/gi, 'índice de precios de producción'],
  [/\bGross Domestic Product\b/gi, 'producto interior bruto'],
  [/\bReal\b/g, 'real'],
  [/\bIndustrial Production\b/gi, 'producción industrial'],
  [/\bRetail Sales\b/gi, 'ventas minoristas'],
  [/\bRetail Trade\b/gi, 'comercio minorista'],
  [/\bTotal Nonfarm\b/gi, 'total no agrícola'],
  [/\bAll Employees\b/gi, 'todos los empleados'],
  [/\bMoney Stock\b/gi, 'masa monetaria'],
  [/\bPersonal Consumption Expenditures\b/gi, 'gasto en consumo personal'],
  [/\bCorporate Bond Yield\b/gi, 'rendimiento de bonos corporativos'],
  [/\bMortgage Rate\b/gi, 'tipo hipotecario'],
  [/\bConstant Maturity\b/gi, 'vencimiento constante'],
  [/\bQuoted on an Investment Basis\b/gi, 'cotizado sobre base de inversión'],
  [/\bMarket Yield\b/gi, 'rendimiento de mercado'],
  [/\bSecurities\b/gi, 'valores'],
  [/\bAverage\b/gi, 'promedio'],
  [/\bIndex\b/gi, 'índice'],
  [/\bPrice\b/gi, 'precio'],
  [/\bPrices\b/gi, 'precios'],
  [/\bYield\b/gi, 'rendimiento'],
  [/\bRate\b/gi, 'tasa'],
  [/\bLevel\b/gi, 'nivel'],
  [/\bChange\b/gi, 'cambio'],
  [/\bMonthly\b/gi, 'mensual'],
  [/\bQuarterly\b/gi, 'trimestral'],
  [/\bWeekly\b/gi, 'semanal'],
  [/\bDaily\b/gi, 'diaria'],
  [/\bAnnual\b/gi, 'anual'],
  [/\bAssets\b/gi, 'activos'],
  [/\bAsset\b/gi, 'activo'],
  [/\bSeries\b/gi, 'series'],
  [/\bMacro indicators\b/gi, 'indicadores macro'],
  [/\bprices\b/g, 'precios'],
  [/\bseries_prices\b/g, 'precios de series'],
  [/\bcrypto\b/gi, 'cripto'],
  [/\bcoinpaprika\b/gi, 'Coinpaprika'],
  [/\bBMR_HYPOTHESIS\b/g, 'Hipótesis BMR'],
  [/\bcalc\b/gi, 'cálculo']
];

export function translateDbText(value) {
  const text = String(value ?? '');
  if (!text) return text;
  if (DB_EXACT_TRANSLATIONS.has(text)) return DB_EXACT_TRANSLATIONS.get(text);
  let translated = text;
  for (const [pattern, replacement] of DB_TEXT_REPLACEMENTS) {
    translated = translated.replace(pattern, replacement);
  }
  return translated;
}
