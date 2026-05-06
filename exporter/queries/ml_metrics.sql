SELECT metric_code, metric_value, details_json, created_at
FROM ml_run_metrics
WHERE run_id = %s
ORDER BY metric_code;
