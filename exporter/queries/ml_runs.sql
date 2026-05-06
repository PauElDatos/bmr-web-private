SELECT run_id, hypothesis_code, data_from, data_to, notes, created_at
FROM ml_runs
WHERE hypothesis_code LIKE 'M%' OR hypothesis_code LIKE 'MARKET%'
ORDER BY created_at DESC, run_id DESC;
