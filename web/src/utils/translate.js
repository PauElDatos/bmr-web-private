const EXACT_TEXT_TRANSLATIONS = new Map([
  ['Federal Funds Effective Rate', 'Tipo efectivo de los fondos federales'],
  ['AAII Bullish % - MA50w', '% alcista AAII - media móvil de 50 semanas'],
  ['AAII Bullish %', '% alcista AAII'],
  ['Bad weather at work 1–34h (usually full-time)', 'Mal tiempo en el trabajo 1–34 h (normalmente jornada completa)'],
  ['Bad weather at work 1-34h (usually full-time)', 'Mal tiempo en el trabajo 1–34 h (normalmente jornada completa)'],
  ['IWM/SPX Ratio (Russell 2000 proxy vs S&P 500) - Weekly', 'Ratio IWM/SPX (proxy del Russell 2000 frente al S&P 500) - semanal'],
  ['SPX EMA 20', 'Media móvil exponencial SPX 20'],
  ['SPX EMA 50', 'Media móvil exponencial SPX 50'],
  ['SPX EMA 200', 'Media móvil exponencial SPX 200'],
  ['MOVE proxy (20d ann.)', 'Proxy MOVE (20 días anualizado)'],
  ['CBOE Volatility Index: VIX', 'Índice de volatilidad CBOE: VIX'],
  ['Consumer Price Index for All Urban Consumers: All Items in U.S. City Average', 'Índice de precios al consumo para todos los consumidores urbanos: todos los artículos en el promedio de ciudades de EE. UU.'],
  ['Market Yield on U.S. Treasury Securities at 30-Year Constant Maturity, Quoted on an Investment Basis', 'Rendimiento de los valores del Tesoro de EE. UU. a 30 años con vencimiento constante, cotizado sobre base de inversión'],
  ['Market Yield on U.S. Treasury Securities at 20-Year Constant Maturity, Quoted on an Investment Basis', 'Rendimiento de los valores del Tesoro de EE. UU. a 20 años con vencimiento constante, cotizado sobre base de inversión'],
  ['Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity, Quoted on an Investment Basis', 'Rendimiento de los valores del Tesoro de EE. UU. a 10 años con vencimiento constante, cotizado sobre base de inversión'],
  ['Market Yield on U.S. Treasury Securities at 7-Year Constant Maturity, Quoted on an Investment Basis', 'Rendimiento de los valores del Tesoro de EE. UU. a 7 años con vencimiento constante, cotizado sobre base de inversión'],
  ['Market Yield on U.S. Treasury Securities at 5-Year Constant Maturity, Quoted on an Investment Basis', 'Rendimiento de los valores del Tesoro de EE. UU. a 5 años con vencimiento constante, cotizado sobre base de inversión'],
  ['Market Yield on U.S. Treasury Securities at 3-Year Constant Maturity, Quoted on an Investment Basis', 'Rendimiento de los valores del Tesoro de EE. UU. a 3 años con vencimiento constante, cotizado sobre base de inversión'],
  ['Market Yield on U.S. Treasury Securities at 2-Year Constant Maturity, Quoted on an Investment Basis', 'Rendimiento de los valores del Tesoro de EE. UU. a 2 años con vencimiento constante, cotizado sobre base de inversión'],
  ['Market Yield on U.S. Treasury Securities at 1-Year Constant Maturity, Quoted on an Investment Basis', 'Rendimiento de los valores del Tesoro de EE. UU. a 1 año con vencimiento constante, cotizado sobre base de inversión'],
  ['Market Yield on U.S. Treasury Securities at 6-Month Constant Maturity, Quoted on an Investment Basis', 'Rendimiento de los valores del Tesoro de EE. UU. a 6 meses con vencimiento constante, cotizado sobre base de inversión'],
  ['Market Yield on U.S. Treasury Securities at 3-Month Constant Maturity, Quoted on an Investment Basis', 'Rendimiento de los valores del Tesoro de EE. UU. a 3 meses con vencimiento constante, cotizado sobre base de inversión'],
  ['Market Yield on U.S. Treasury Securities at 1-Month Constant Maturity, Quoted on an Investment Basis', 'Rendimiento de los valores del Tesoro de EE. UU. a 1 mes con vencimiento constante, cotizado sobre base de inversión']
]);

const SOURCE_TRANSLATIONS = new Map([
  ['ALL', 'Todas'],
  ['all', 'Todas'],
  ['calc', 'Cálculo'],
  ['BMR_HYPOTHESIS', 'Hipótesis BMR'],
  ['prices', 'Precios'],
  ['series_prices', 'Series de precios'],
  ['crypto', 'Cripto'],
  ['coinpaprika', 'CoinPaprika'],
  ['none', 'Ninguna']
]);

function translateKnownPatterns(text) {
  let out = text;

  out = out.replace(
    /^Market Yield on U\.S\. Treasury Securities at (\d+)-(Year|Month) Constant Maturity, Quoted on an Investment Basis$/i,
    (_, n, unit) => `Rendimiento de los valores del Tesoro de EE. UU. a ${n} ${unit.toLowerCase() === 'year' ? (n === '1' ? 'año' : 'años') : (n === '1' ? 'mes' : 'meses')} con vencimiento constante, cotizado sobre base de inversión`
  );

  const replacements = [
    [/\bFederal Funds Effective Rate\b/gi, 'Tipo efectivo de los fondos federales'],
    [/\bConsumer Price Index\b/gi, 'Índice de precios al consumo'],
    [/\bProducer Price Index\b/gi, 'Índice de precios al productor'],
    [/\bPersonal Consumption Expenditures\b/gi, 'Gastos de consumo personal'],
    [/\bGross Domestic Product\b/gi, 'Producto interior bruto'],
    [/\bReal Gross Domestic Product\b/gi, 'Producto interior bruto real'],
    [/\bUnemployment Rate\b/gi, 'Tasa de desempleo'],
    [/\bCivilian Unemployment Rate\b/gi, 'Tasa de desempleo civil'],
    [/\bIndustrial Production\b/gi, 'Producción industrial'],
    [/\bInitial Claims\b/gi, 'Solicitudes iniciales de desempleo'],
    [/\bContinued Claims\b/gi, 'Solicitudes continuadas de desempleo'],
    [/\bAll Employees\b/gi, 'Todos los empleados'],
    [/\bNonfarm Payrolls\b/gi, 'Nóminas no agrícolas'],
    [/\bRetail Sales\b/gi, 'Ventas minoristas'],
    [/\bHousing Starts\b/gi, 'Inicios de viviendas'],
    [/\bBuilding Permits\b/gi, 'Permisos de construcción'],
    [/\bDurable Goods Orders\b/gi, 'Pedidos de bienes duraderos'],
    [/\bManufacturers'? New Orders\b/gi, 'Nuevos pedidos de fabricantes'],
    [/\bUniversity of Michigan\b/gi, 'Universidad de Michigan'],
    [/\bConsumer Sentiment\b/gi, 'Confianza del consumidor'],
    [/\bBusiness Tendency Surveys\b/gi, 'Encuestas de tendencia empresarial'],
    [/\bComposite Leading Indicator\b/gi, 'Indicador compuesto adelantado'],
    [/\bLeading Index\b/gi, 'Índice adelantado'],
    [/\bCoincident Index\b/gi, 'Índice coincidente'],
    [/\bRecession Indicators?\b/gi, 'Indicador de recesión'],
    [/\bTotal\b/gi, 'Total'],
    [/\bIndex\b/gi, 'Índice'],
    [/\bRatio\b/gi, 'Ratio'],
    [/\bproxy\b/gi, 'proxy'],
    [/\bWeekly\b/gi, 'semanal'],
    [/\bMonthly\b/gi, 'mensual'],
    [/\bDaily\b/gi, 'diario'],
    [/\bAnnual\b/gi, 'anual'],
    [/\bBullish\b/gi, 'alcista'],
    [/\bBearish\b/gi, 'bajista'],
    [/\bNeutral\b/gi, 'neutral'],
    [/\bMoving Average\b/gi, 'media móvil'],
    [/\bEMA\b/g, 'media móvil exponencial'],
    [/\bMA(\d+)(w|d)?\b/g, (_, n, unit = '') => `media móvil ${n}${unit === 'w' ? ' semanas' : unit === 'd' ? ' días' : ''}`],
    [/\bU\.S\.\b/g, 'EE. UU.'],
    [/\bUnited States\b/gi, 'Estados Unidos'],
    [/\bTreasury Securities\b/gi, 'valores del Tesoro'],
    [/\bConstant Maturity\b/gi, 'vencimiento constante'],
    [/\bQuoted on an Investment Basis\b/gi, 'cotizado sobre base de inversión'],
    [/\bMarket Yield on\b/gi, 'Rendimiento de'],
    [/\bEffective Rate\b/gi, 'tipo efectivo'],
    [/\bRate\b/gi, 'tasa'],
    [/\bPercent\b/gi, 'porcentaje'],
    [/\bAll Items\b/gi, 'todos los artículos'],
    [/\bCity Average\b/gi, 'promedio de ciudades'],
    [/\bSecurities\b/gi, 'valores'],
    [/\b30-Year\b/gi, '30 años'],
    [/\b20-Year\b/gi, '20 años'],
    [/\b10-Year\b/gi, '10 años'],
    [/\b7-Year\b/gi, '7 años'],
    [/\b5-Year\b/gi, '5 años'],
    [/\b3-Year\b/gi, '3 años'],
    [/\b2-Year\b/gi, '2 años'],
    [/\b1-Year\b/gi, '1 año'],
    [/\b6-Month\b/gi, '6 meses'],
    [/\b3-Month\b/gi, '3 meses'],
    [/\b1-Month\b/gi, '1 mes'],
    [/\bvs\b/gi, 'frente a'],
    [/\bann\.\b/gi, 'anualizado'],
    [/\b20d\b/gi, '20 días'],
    [/\bfull-time\b/gi, 'jornada completa'],
    [/\busually\b/gi, 'normalmente']
  ];

  for (const [pattern, replacement] of replacements) out = out.replace(pattern, replacement);
  return out.replace(/\s+-\s+/g, ' - ').replace(/\s{2,}/g, ' ').trim();
}

export function translateDbText(value) {
  if (value === null || value === undefined) return value;
  const raw = String(value);
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  return EXACT_TEXT_TRANSLATIONS.get(trimmed) || translateKnownPatterns(trimmed);
}

export function translateDbSource(value) {
  if (value === null || value === undefined) return value;
  const raw = String(value);
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  return SOURCE_TRANSLATIONS.get(trimmed) || translateDbText(trimmed);
}
