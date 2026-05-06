SELECT hypothesis_code, run_id, signal_code, direction, event_dt_effective,
       entry_close, exit_close_12m, end_ret_12m_pct, max_dd_12m_pct,
       horizon_days, lag_days_used
FROM ml_signal_events
WHERE run_id = %s
ORDER BY event_dt_effective DESC;
