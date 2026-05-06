SELECT time AS dt, close_p AS value, open_p, high_p, low_p, volume
FROM prices
WHERE asset_id = :asset_id
ORDER BY time;
