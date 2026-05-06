# Fase 3 — Sentimiento del Mercado conectado a `ml_*`

Esta fase mejora la página **Sentimiento del mercado** para que pueda representar la estructura real de BMR alrededor de `ml_runs`, `ml_signal_values`, `ml_run_inputs`, `ml_signal_scores`, `ml_signal_events` y `ml_run_metrics`.

## Cambios en la web

La página ahora incluye:

- selector M1–M5;
- gráfico SPX normalizado + señal seleccionada;
- chips para cambiar entre señales del run;
- tabla de señales disponibles;
- tabla de pesos/contribuciones H→M;
- tabla de inputs declarados;
- tabla de métricas del run;
- tabla de eventos históricos;
- bloque de lectura operativa.

## Contrato JSON nuevo

Por cada módulo `m1`–`m5` se generan estos archivos:

```text
web/data/market/m1.json
web/data/market/weights/m1.json
web/data/market/inputs/m1.json
web/data/market/metrics/m1.json
web/data/market/events/m1.json
```

La misma estructura se repite para `m2`, `m3`, `m4` y `m5`.

## Lógica de pesos

El exportador usa este orden de preferencia:

1. `ml_signal_scores` filtrado por `run_id` del módulo.
2. Para `M1`, fallback a `ml_signal_scores` de hipótesis `H%`, porque el scoring puede estar asociado a runs H.
3. Si no hay scores, fallback a `ml_run_inputs` sin peso explícito.

Cuando los scores existen, el peso visual se calcula como:

```text
peso = max(score, 0) / suma(max(score, 0))
```

Esto no pretende sustituir la fórmula interna del motor; es una normalización para visualización.

## Tablas usadas

```text
ml_runs
ml_signal_values
ml_run_inputs
ml_signal_scores
ml_signal_events
ml_run_metrics
series / series_prices para SPX
indicators / indicator_values o assets / prices como fallback SPX
```

## Validación

Ejecuta:

```bash
python exporter/validate_web_json.py --data-dir web/data
```

El validador de Fase 3 comprueba que existan los archivos de `weights`, `inputs`, `metrics` y `events` para M1–M5.
