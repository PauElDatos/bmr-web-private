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


const DB_EXACT_TRANSLATIONS = new Map([
  ['ALL', 'Todos'],
  ['Macro indicators', 'Indicadores macro'],
  ['Assets', 'Activos'],
  ['Crypto', 'Cripto'],
  ['prices', 'precios'],
  ['daily', 'diario'],
  ['weekly', 'semanal'],
  ['monthly', 'mensual'],
  ['quarterly', 'trimestral'],
  ['annual', 'anual'],
  ['calc', 'cálculo'],
  ['series_prices', 'precios de series'],
  ['equity', 'renta variable'],
  ['ETF', 'ETF'],
  ['coinpaprika', 'CoinPaprika'],
  ['Federal Funds Effective Rate', 'Tipo efectivo de fondos federales'],
  ['Consumer Price Index for All Urban Consumers: All Items in U.S. City Average', 'IPC para todos los consumidores urbanos: todos los artículos, promedio de ciudades de EE. UU.'],
  ['Unemployment Rate', 'Tasa de desempleo'],
  ['Civilian Unemployment Rate', 'Tasa de desempleo civil'],
  ['Initial Claims', 'Solicitudes iniciales de desempleo'],
  ['Continued Claims (Insured Unemployment)', 'Solicitudes continuadas de desempleo asegurado'],
  ['Industrial Production: Total Index', 'Producción industrial: índice total'],
  ['Retail Sales: Retail Trade', 'Ventas minoristas: comercio minorista'],
  ['Housing Starts: Total: New Privately Owned Housing Units Started', 'Inicios de viviendas: total de nuevas viviendas privadas iniciadas'],
  ['Real Gross Domestic Product', 'Producto interior bruto real'],
  ['Gross Domestic Product', 'Producto interior bruto'],
  ['Personal Consumption Expenditures', 'Gasto en consumo personal'],
  ['Producer Price Index by Commodity: All Commodities', 'Índice de precios al productor por mercancía: todas las mercancías'],
  ['ISM Manufacturing PMI', 'PMI manufacturero ISM'],
  ['Crude Oil Prices: West Texas Intermediate (WTI) - Cushing, Oklahoma', 'Precio del crudo: West Texas Intermediate (WTI) - Cushing, Oklahoma'],
  ['CBOE Volatility Index: VIX', 'Índice de volatilidad CBOE: VIX'],
  ['Market Yield on U.S. Treasury Securities at 30-Year Constant Maturity, Quoted on an Investment Basis', 'Rendimiento de mercado de valores del Tesoro de EE. UU. a 30 años con vencimiento constante, cotizado sobre base de inversión'],
  ['Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity, Quoted on an Investment Basis', 'Rendimiento de mercado de valores del Tesoro de EE. UU. a 10 años con vencimiento constante, cotizado sobre base de inversión'],
  ['Market Yield on U.S. Treasury Securities at 5-Year Constant Maturity, Quoted on an Investment Basis', 'Rendimiento de mercado de valores del Tesoro de EE. UU. a 5 años con vencimiento constante, cotizado sobre base de inversión'],
  ['Market Yield on U.S. Treasury Securities at 2-Year Constant Maturity, Quoted on an Investment Basis', 'Rendimiento de mercado de valores del Tesoro de EE. UU. a 2 años con vencimiento constante, cotizado sobre base de inversión'],
  ['Market Yield on U.S. Treasury Securities at 3-Month Constant Maturity, Quoted on an Investment Basis', 'Rendimiento de mercado de valores del Tesoro de EE. UU. a 3 meses con vencimiento constante, cotizado sobre base de inversión'],
  ['AAII Bullish % - MA50w', '% alcista AAII - media móvil 50 semanas'],
  ['AAII Bullish %', '% alcista AAII'],
  ['Bad weather at work 1–34h (usually full-time)', 'Mal tiempo en el trabajo 1–34 h (normalmente jornada completa)'],
  ['IWM/SPX Ratio (Russell 2000 proxy vs S&P 500) - Weekly', 'Ratio IWM/SPX (proxy Russell 2000 frente al S&P 500) - semanal'],
  ['SPX EMA 20', 'SPX media móvil exponencial 20'],
  ['SPX EMA 50', 'SPX media móvil exponencial 50'],
  ['SPX EMA 200', 'SPX media móvil exponencial 200'],
  ['MOVE proxy (20d ann.)', 'Proxy MOVE (20 días anualizado)'],
  ['S&P 500', 'S&P 500'],
  ['Russell 2000', 'Russell 2000'],
  ['Gold Fixing Price 10:30 A.M. (London time) in London Bullion Market, based in U.S. Dollars', 'Precio de fijación del oro 10:30 h (hora de Londres) en el mercado de lingotes de Londres, en dólares estadounidenses'],
  ['NASDAQ Composite Index', 'Índice compuesto NASDAQ'],
  ['Dow Jones Industrial Average', 'Promedio industrial Dow Jones']
]);

const DB_REGEX_TRANSLATIONS = [
  [/^Market Yield on U\.S\. Treasury Securities at (\d+)-Year Constant Maturity, Quoted on an Investment Basis$/i,
    (_m, years) => `Rendimiento de mercado de valores del Tesoro de EE. UU. a ${years} años con vencimiento constante, cotizado sobre base de inversión`],
  [/^Market Yield on U\.S\. Treasury Securities at (\d+)-Month Constant Maturity, Quoted on an Investment Basis$/i,
    (_m, months) => `Rendimiento de mercado de valores del Tesoro de EE. UU. a ${months} meses con vencimiento constante, cotizado sobre base de inversión`],
  [/^(.*) - Weekly$/i, (_m, name) => `${translateDbText(name)} - semanal`],
  [/^(.*) - Daily$/i, (_m, name) => `${translateDbText(name)} - diario`],
  [/^(.*) - Monthly$/i, (_m, name) => `${translateDbText(name)} - mensual`]
];

const DB_PHRASE_TRANSLATIONS = [
  ['Market Yield', 'Rendimiento de mercado'],
  ['U.S. Treasury Securities', 'valores del Tesoro de EE. UU.'],
  ['Treasury Securities', 'valores del Tesoro'],
  ['Constant Maturity', 'vencimiento constante'],
  ['Quoted on an Investment Basis', 'cotizado sobre base de inversión'],
  ['Federal Funds', 'fondos federales'],
  ['Effective Rate', 'tipo efectivo'],
  ['Consumer Price Index', 'índice de precios al consumidor'],
  ['All Urban Consumers', 'todos los consumidores urbanos'],
  ['All Items', 'todos los artículos'],
  ['U.S. City Average', 'promedio de ciudades de EE. UU.'],
  ['Unemployment Rate', 'tasa de desempleo'],
  ['Industrial Production', 'producción industrial'],
  ['Retail Sales', 'ventas minoristas'],
  ['Housing Starts', 'inicios de viviendas'],
  ['Real Gross Domestic Product', 'producto interior bruto real'],
  ['Gross Domestic Product', 'producto interior bruto'],
  ['Personal Consumption Expenditures', 'gasto en consumo personal'],
  ['Producer Price Index', 'índice de precios al productor'],
  ['Manufacturing', 'manufacturero'],
  ['Services', 'servicios'],
  ['Composite', 'compuesto'],
  ['Bullish', 'alcista'],
  ['Bearish', 'bajista'],
  ['Moving Average', 'media móvil'],
  ['Index', 'índice'],
  ['Volatility', 'volatilidad'],
  ['Total', 'total'],
  ['New', 'nuevas'],
  ['Privately Owned', 'privadas'],
  ['Usually full-time', 'normalmente jornada completa'],
  ['usually full-time', 'normalmente jornada completa'],
  ['Bad weather', 'mal tiempo'],
  ['at work', 'en el trabajo'],
  ['Ratio', 'ratio'],
  ['proxy vs', 'proxy frente a'],
  ['proxy', 'proxy'],
  ['Weekly', 'semanal'],
  ['Daily', 'diario'],
  ['Monthly', 'mensual'],
  ['Quarterly', 'trimestral'],
  ['Annual', 'anual'],
  ['EMA', 'media móvil exponencial'],
  ['ann.', 'anualizado'],
  ['United States', 'Estados Unidos'],
  ['U.S.', 'EE. UU.']
];

export function translateDbText(value) {
  const original = String(value ?? '').trim();
  if (!original) return '';
  if (DB_EXACT_TRANSLATIONS.has(original)) return DB_EXACT_TRANSLATIONS.get(original);
  for (const [pattern, replacer] of DB_REGEX_TRANSLATIONS) {
    if (pattern.test(original)) return original.replace(pattern, replacer);
  }
  let translated = original;
  for (const [from, to] of DB_PHRASE_TRANSLATIONS) {
    translated = translated.replaceAll(from, to);
  }
  translated = translated
    .replace(/\b(\d+)-Year\b/g, '$1 años')
    .replace(/\b(\d+)-Month\b/g, '$1 meses')
    .replace(/\b(\d+)d\b/g, '$1 días')
    .replace(/\s+/g, ' ')
    .trim();
  return translated;
}

export function translateOptionLabel(value) {
  return String(value ?? '')
    .split('·')
    .map(part => translateDbText(part.trim()))
    .join(' · ');
}
