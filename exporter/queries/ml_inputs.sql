SELECT input_kind, input_code, role, notes
FROM ml_run_inputs
WHERE run_id = %s
ORDER BY role, input_kind, input_code;
