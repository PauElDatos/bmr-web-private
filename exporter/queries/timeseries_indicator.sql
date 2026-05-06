SELECT dt, value
FROM indicator_values
WHERE indicator_id = :indicator_id
ORDER BY dt;
