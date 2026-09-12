-- Apply with an administrator after schema.sql. Supply the runtime user's password out of band.
-- The worker receives only SELECT on the restricted view, never the source tables or admin role.
CREATE ROLE IF NOT EXISTS accord_runtime_readonly;
GRANT SELECT ON accord_demo.accord_retention_view TO accord_runtime_readonly;
ALTER ROLE accord_runtime_readonly SETTINGS
  readonly = 1,
  max_execution_time = 10,
  max_rows_to_read = 10000,
  max_bytes_to_read = 1048576,
  max_result_rows = 1,
  max_result_bytes = 1048576,
  result_overflow_mode = 'throw';

-- Example operator sequence (substitute a secret outside this repository):
-- CREATE USER accord_runtime IDENTIFIED WITH sha256_password BY '<operator supplied password>';
-- GRANT accord_runtime_readonly TO accord_runtime;
-- Privilege proof, using the runtime identity, must fail for each of:
-- INSERT INTO accord_demo.accounts VALUES (...);
-- DELETE FROM accord_demo.records WHERE 1;
-- DROP TABLE accord_demo.records;
-- SELECT * FROM accord_demo.accord_private_operator_notes;
