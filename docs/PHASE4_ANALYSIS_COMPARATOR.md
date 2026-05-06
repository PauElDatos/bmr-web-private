# Fase 4 — Página Análisis tipo comparador_graf

## Objetivo

Esta fase convierte la página `Análisis` en una versión web del comparador local `comparador_graf.py`. La web no ejecuta SQL ni Python: consume únicamente JSON preexportados desde MariaDB.

## Fuentes de datos

La página usa los catálogos:

- `catalog/indicators.json` → tabla `indicators`.
- `catalog/assets.json` → tabla `assets`.
- `catalog/series.json` → tabla `series`.
- `catalog/crypto.json` → tabla `crypto_ohlcv_cp` agrupada por símbolo.

Y carga series desde:

- `timeseries/indicators/<CODE>.json` → `indicator_values`.
- `timeseries/assets/<SYMBOL>.json` → `prices`.
- `timeseries/series/<CODE>.json` → `series_prices`.
- `timeseries/crypto/<SYMBOL>.json` → `crypto_ohlcv_cp`.

## Funcionalidad implementada

### Slots

Hay tres slots visuales:

- Azul.
- Rojo.
- Verde.

Cada slot permite elegir una serie del catálogo, invertirla, aplicar una transformación y desplazarla en meses.

### Transformaciones

- `NORMAL`: valor original.
- `LOG`: logaritmo natural.
- `EXP`: `exp(valor / 100)`, útil para pruebas compatibles con la idea previa de escala EXP.
- `DIFF_1`: diferencia contra observación anterior.
- `DIFF_12`: diferencia contra 12 observaciones antes.
- `PCT_1`: variación porcentual contra observación anterior.
- `PCT_12`: variación porcentual contra 12 observaciones antes.
- `ZSCORE`: estandarización de la serie visible.

### Cálculos

La serie derivada se calcula entre azul y rojo:

- suma;
- resta;
- ratio;
- multiplicación;
- spread z-score;
- correlación rolling de 24 observaciones.

El modo de alineación por defecto usa forward-fill entre calendarios diferentes. Esto es importante porque muchas series macro son mensuales y muchas series de mercado son diarias.

### Overlays

Los overlays se definen en `analysis/overlays.json`. La Fase 4 también genera `analysis/recession_bands.json`, normalmente derivado de `USREC`.

### Exportación CSV

El botón `Exportar CSV` descarga un CSV con las series visibles del gráfico actual.

## Limitaciones actuales

- El cálculo se hace en navegador, no en base de datos.
- La correlación rolling usa ventanas de observaciones, no ventanas exactas de días naturales.
- La página no persiste presets personalizados del usuario.
- La seguridad de Patreon queda para la fase de gateway/autenticación.
