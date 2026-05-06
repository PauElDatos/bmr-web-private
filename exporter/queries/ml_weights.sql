SELECT hypothesis_code, run_id, signal_code, direction, score,
       rank_within_direction, n_events, avg_end_ret_12m_pct, updated_at
FROM ml_signal_scores
ORDER BY score DESC;
