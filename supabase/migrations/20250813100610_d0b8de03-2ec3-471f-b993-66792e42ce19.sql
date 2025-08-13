-- Move extension installed in public to extensions schema to satisfy linter 0014
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_net SET SCHEMA extensions;