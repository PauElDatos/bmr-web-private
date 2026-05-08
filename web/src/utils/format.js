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

const INDICATOR_NAME_TRANSLATIONS = new Map([
  ["AAII Bullish % - MA50w", "AAII: porcentaje de inversores alcistas - media m?vil de 50 semanas"],
  ["AAII Bullish %", "AAII: porcentaje de inversores alcistas"],
  ["Bad weather at work 1?34h (usually full-time)", "Mal tiempo en el trabajo, 1-34 h (normalmente jornada completa)"],
  ["Bad weather at work 1-34h (usually full-time)", "Mal tiempo en el trabajo, 1-34 h (normalmente jornada completa)"],
  ["IWM/SPX Ratio (Russell 2000 proxy vs S&P 500) - Weekly", "Ratio IWM/SPX (IWM como aproximaci?n al Russell 2000 frente al S&P 500) - semanal"],
  ["IWM/SPX Ratio (Russell 2000 proxy vs S&P 500) - semanal", "Ratio IWM/SPX (IWM como aproximaci?n al Russell 2000 frente al S&P 500) - semanal"],
  ["SPX EMA 20", "SPX: media m?vil exponencial de 20 sesiones"],
  ["SPX EMA 200", "SPX: media m?vil exponencial de 200 sesiones"],
  ["SPX EMA 50", "SPX: media m?vil exponencial de 50 sesiones"],
  ["MOVE proxy (20d ann.)", "Proxy del MOVE (20 d?as anualizado)"],
  ["1y-3m spread (calc)", "Diferencial 1 a?o-3 meses (calculado)"],
  ["Personal saving as a percentage of disposable personal income", "Ahorro personal como porcentaje de la renta personal disponible"],
  ["Federal government current expenditures: Interest payments", "Gasto corriente del Gobierno federal: pagos de intereses"],
  ["Real Gross Domestic Product", "Producto interior bruto real"],
  ["Personal interest payments", "Pagos de intereses personales"],
  ["Consumer Price Index for All Urban Consumers: All Items in U.S. City Average", "?ndice de precios al consumo para todos los consumidores urbanos: todos los art?culos, promedio de ciudades de EE. UU."],
  ["Composite Leading Indicators: Composite Consumer Confidence Amplitude Adjusted for United States", "Indicadores adelantados compuestos: confianza del consumidor compuesta ajustada por amplitud para Estados Unidos"],
  ["Crude Oil Prices: West Texas Intermediate (WTI) - Cushing, Oklahoma", "Precios del petr?leo crudo: West Texas Intermediate (WTI) - Cushing, Oklahoma"],
  ["Market Yield on U.S. Treasury Securities at 1-Year Constant Maturity, Quoted on an Investment Basis", "Rendimiento de mercado de los valores del Tesoro de EE. UU. a vencimiento constante de 1 a?o, cotizado sobre base de inversi?n"],
  ["Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity, Quoted on an Investment Basis", "Rendimiento de mercado de los valores del Tesoro de EE. UU. a vencimiento constante de 10 a?os, cotizado sobre base de inversi?n"],
  ["Market Yield on U.S. Treasury Securities at 2-Year Constant Maturity, Quoted on an Investment Basis", "Rendimiento de mercado de los valores del Tesoro de EE. UU. a vencimiento constante de 2 a?os, cotizado sobre base de inversi?n"],
  ["Market Yield on U.S. Treasury Securities at 30-Year Constant Maturity, Quoted on an Investment Basis", "Rendimiento de mercado de los valores del Tesoro de EE. UU. a vencimiento constante de 30 a?os, cotizado sobre base de inversi?n"],
  ["Market Yield on U.S. Treasury Securities at 3-Month Constant Maturity, Quoted on an Investment Basis", "Rendimiento de mercado de los valores del Tesoro de EE. UU. a vencimiento constante de 3 meses, cotizado sobre base de inversi?n"],
  ["Market Yield on U.S. Treasury Securities at 5-Year Constant Maturity, Quoted on an Investment Basis", "Rendimiento de mercado de los valores del Tesoro de EE. UU. a vencimiento constante de 5 a?os, cotizado sobre base de inversi?n"],
  ["Dow Jones Industrial Average", "Media industrial Dow Jones"],
  ["Delinquency Rate on Consumer Loans, All Commercial Banks", "Tasa de morosidad de los pr?stamos al consumo, todos los bancos comerciales"],
  ["Nominal Broad U.S. Dollar Index", "?ndice nominal amplio del d?lar estadounidense"],
  ["Austria / U.S. Foreign Exchange Rate (DISCONTINUED)", "Austria / EE. UU., tipo de cambio (descontinuado)"],
  ["Belgium / U.S. Foreign Exchange Rate (DISCONTINUED)", "B?lgica / EE. UU., tipo de cambio (descontinuado)"],
  ["Brazilian Reals to U.S. Dollar Spot Exchange Rate", "Reales brasile?os por d?lar estadounidense, tipo de cambio spot"],
  ["Canadian Dollars to U.S. Dollar Spot Exchange Rate", "D?lares canadienses por d?lar estadounidense, tipo de cambio spot"],
  ["Chinese Yuan Renminbi to U.S. Dollar Spot Exchange Rate", "Yuan renminbi chino por d?lar estadounidense, tipo de cambio spot"],
  ["Danish Kroner to U.S. Dollar Spot Exchange Rate", "Coronas danesas por d?lar estadounidense, tipo de cambio spot"],
  ["Finland / U.S. Foreign Exchange Rate (DISCONTINUED)", "Finlandia / EE. UU., tipo de cambio (descontinuado)"],
  ["France / U.S. Foreign Exchange Rate (DISCONTINUED)", "Francia / EE. UU., tipo de cambio (descontinuado)"],
  ["Germany / U.S. Foreign Exchange Rate (DISCONTINUED)", "Alemania / EE. UU., tipo de cambio (descontinuado)"],
  ["Greece / U.S. Foreign Exchange Rate (DISCONTINUED)", "Grecia / EE. UU., tipo de cambio (descontinuado)"],
  ["Hong Kong Dollars to U.S. Dollar Spot Exchange Rate", "D?lares de Hong Kong por d?lar estadounidense, tipo de cambio spot"],
  ["Existing Home Sales", "Ventas de viviendas usadas"],
  ["Indian Rupees to U.S. Dollar Spot Exchange Rate", "Rupias indias por d?lar estadounidense, tipo de cambio spot"],
  ["Italy / U.S. Foreign Exchange Rate (DISCONTINUED)", "Italia / EE. UU., tipo de cambio (descontinuado)"],
  ["Japanese Yen to U.S. Dollar Spot Exchange Rate", "Yenes japoneses por d?lar estadounidense, tipo de cambio spot"],
  ["South Korean Won to U.S. Dollar Spot Exchange Rate", "Wones surcoreanos por d?lar estadounidense, tipo de cambio spot"],
  ["Malaysian Ringgit to U.S. Dollar Spot Exchange Rate", "Ringgits malasios por d?lar estadounidense, tipo de cambio spot"],
  ["Mexican Pesos to U.S. Dollar Spot Exchange Rate", "Pesos mexicanos por d?lar estadounidense, tipo de cambio spot"],
  ["Netherlands / U.S. Foreign Exchange Rate (DISCONTINUED)", "Pa?ses Bajos / EE. UU., tipo de cambio (descontinuado)"],
  ["Norwegian Kroner to U.S. Dollar Spot Exchange Rate", "Coronas noruegas por d?lar estadounidense, tipo de cambio spot"],
  ["Portugal / U.S. Foreign Exchange Rate (DISCONTINUED)", "Portugal / EE. UU., tipo de cambio (descontinuado)"],
  ["Swedish Kronor to U.S. Dollar Spot Exchange Rate", "Coronas suecas por d?lar estadounidense, tipo de cambio spot"],
  ["South African Rand to U.S. Dollar Spot Exchange Rate", "Rands sudafricanos por d?lar estadounidense, tipo de cambio spot"],
  ["Singapore Dollars to U.S. Dollar Spot Exchange Rate", "D?lares de Singapur por d?lar estadounidense, tipo de cambio spot"],
  ["Sri Lankan Rupees to U.S. Dollar Spot Exchange Rate", "Rupias de Sri Lanka por d?lar estadounidense, tipo de cambio spot"],
  ["Spain / U.S. Foreign Exchange Rate (DISCONTINUED)", "Espa?a / EE. UU., tipo de cambio (descontinuado)"],
  ["Swiss Francs to U.S. Dollar Spot Exchange Rate", "Francos suizos por d?lar estadounidense, tipo de cambio spot"],
  ["Taiwan Dollars to U.S. Dollar Spot Exchange Rate", "D?lares taiwaneses por d?lar estadounidense, tipo de cambio spot"],
  ["Thai Baht to U.S. Dollar Spot Exchange Rate", "Baht tailandeses por d?lar estadounidense, tipo de cambio spot"],
  ["U.S. Dollars to Australian Dollar Spot Exchange Rate", "D?lares estadounidenses por d?lar australiano, tipo de cambio spot"],
  ["Foreign Exchange Rate: Euro Community (DISCONTINUED)", "Tipo de cambio: Comunidad del euro (descontinuado)"],
  ["U.S. Dollars to Euro Spot Exchange Rate", "D?lares estadounidenses por euro, tipo de cambio spot"],
  ["U.S. / Ireland Foreign Exchange Rate (DISCONTINUED)", "EE. UU. / Irlanda, tipo de cambio (descontinuado)"],
  ["U.S. Dollars to New Zealand Dollar Spot Exchange Rate", "D?lares estadounidenses por d?lar neozeland?s, tipo de cambio spot"],
  ["U.S. Dollars to U.K. Pound Sterling Spot Exchange Rate", "D?lares estadounidenses por libra esterlina brit?nica, tipo de cambio spot"],
  ["Venezuelan Bolivares to U.S. Dollar Spot Exchange Rate", "Bol?vares venezolanos por d?lar estadounidense, tipo de cambio spot"],
  ["Federal Funds Effective Rate", "Tipo efectivo de los fondos federales"],
  ["Inflation, consumer prices for the United States", "Inflaci?n, precios de consumo en Estados Unidos"],
  ["New One Family Houses Sold: United States", "Viviendas unifamiliares nuevas vendidas: Estados Unidos"],
  ["Motor Vehicle Retail Sales: Heavy Weight Trucks", "Ventas minoristas de veh?culos de motor: camiones pesados"],
  ["30-Year Fixed Rate Mortgage Average in the United States", "Tipo hipotecario fijo medio a 30 a?os en Estados Unidos"],
  ["NASDAQ-100", "NASDAQ-100"],
  ["All Employees, Total Nonfarm (Change)", "Empleo total no agr?cola (variaci?n)"],
  ["Sahm Rule Recession Indicator", "Indicador de recesi?n de la regla de Sahm"],
  ["S&P 500", "S&P 500"],
  ["10-Year Treasury Constant Maturity Minus 2-Year Treasury Constant Maturity", "Tesoro a 10 a?os menos Tesoro a 2 a?os, vencimiento constante"],
  ["10-Year Treasury Constant Maturity Minus 3-Month Treasury Constant Maturity", "Tesoro a 10 a?os menos Tesoro a 3 meses, vencimiento constante"],
  ["10-Year Breakeven Inflation Rate", "Tasa de inflaci?n impl?cita a 10 a?os"],
  ["Commercial Bank Interest Rate on Credit Card Plans, All Accounts", "Tipo de inter?s bancario comercial en planes de tarjetas de cr?dito, todas las cuentas"],
  ["Nominal Broad U.S. Dollar Index (Goods Only) (DISCONTINUED)", "?ndice nominal amplio del d?lar estadounidense (solo bienes) (descontinuado)"],
  ["Nominal Major Currencies U.S. Dollar Index (Goods Only) (DISCONTINUED)", "?ndice nominal del d?lar estadounidense frente a principales divisas (solo bienes) (descontinuado)"],
  ["Trade-Weighted Exchange Value of U.S. Dollar vs G-10 Countries (DISCONTINUED)", "Valor del d?lar estadounidense ponderado por comercio frente a pa?ses del G-10 (descontinuado)"],
  ["Nominal Other Important Trading Partners U.S. Dollar Index (Goods Only) (DISCONTINUED)", "?ndice nominal del d?lar estadounidense frente a otros socios comerciales importantes (solo bienes) (descontinuado)"],
  ["University of Michigan: Consumer Sentiment", "Universidad de Michigan: sentimiento del consumidor"],
  ["Unemployment Level", "Nivel de desempleo"],
  ["Unemployment Rate", "Tasa de desempleo"],
  ["NBER based Recession Indicators for the United States from the Period following the Peak through the Trough", "Indicadores de recesi?n para Estados Unidos basados en el NBER, desde el periodo posterior al pico hasta el valle"],
  ["CBOE Volatility Index: VIX", "?ndice de volatilidad CBOE: VIX"],
  ["Federal government total expenditures", "Gasto total del Gobierno federal"],
  ["Nonfarm Payrolls (FRED)", "N?minas no agr?colas (FRED)"],
  ["Geopolitical Risk Index (news-based)", "?ndice de riesgo geopol?tico (basado en noticias)"],
  ["ISM Manufacturing PMI (from Windows TXT)", "PMI manufacturero ISM (desde TXT de Windows)"],
  ["Gold/Silver Ratio (GC=F / SI=F)", "Ratio oro/plata (GC=F / SI=F)"],
  ["Shiller PE (CAPE) Annual", "PER de Shiller (CAPE) anual"],
  ["Aluminum Futures", "Futuros del aluminio"],
  ["Brent Crude Futures", "Futuros del crudo Brent"],
  ["Coffee Futures", "Futuros del caf?"],
  ["Copper Futures", "Futuros del cobre"],
  ["Corn Futures", "Futuros del ma?z"],
  ["Cotton Futures", "Futuros del algod?n"],
  ["Natural Gas Futures", "Futuros del gas natural"],
  ["Sugar Futures", "Futuros del az?car"],
  ["Wheat Futures", "Futuros del trigo"],
  ["WTI Crude Futures", "Futuros del crudo WTI"],
]);

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
  ['AAII', 'AAII'],
  ["FREE_MARKET", "Mercado libre"],
  ["YAHOO_FINANCE", "Yahoo Finance"],
  ["INVESTING (via Windows TXT)", "Investing (v?a TXT de Windows)"],
  ["MULTPL", "Multpl"],
  ["GPR", "GPR"],
  ["ML", "ML"]
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
  if (INDICATOR_NAME_TRANSLATIONS.has(text)) return INDICATOR_NAME_TRANSLATIONS.get(text);
  if (DB_EXACT_TRANSLATIONS.has(text)) return DB_EXACT_TRANSLATIONS.get(text);
  let translated = text;
  for (const [pattern, replacement] of DB_TEXT_REPLACEMENTS) {
    translated = translated.replace(pattern, replacement);
  }
  return translated;
}
