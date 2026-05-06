SELECT dt, value, signal_code, score, level, explanation
FROM ml_signal_values
WHERE run_id = %s
ORDER BY dt ASC;
