SELECT time AS dt, close_p AS value, open_p, high_p, low_p, volume, source_kind, source_id
FROM series_prices
WHERE series_id = :series_id
ORDER BY time;
