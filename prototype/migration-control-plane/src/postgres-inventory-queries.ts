export const DATABASE_QUERY = `
SELECT current_database() AS name,
       pg_get_userbyid(d.datdba) AS owner,
       pg_encoding_to_char(d.encoding) AS encoding,
       d.datcollate AS collation,
       d.datctype AS character_type,
       COALESCE(t.spcname, 'pg_default') AS default_tablespace,
       current_setting('server_version') AS server_version,
       current_setting('server_version_num')::int AS server_version_number,
       current_user AS current_user_name,
       current_setting('transaction_read_only') = 'on' AS read_only
FROM pg_database d
LEFT JOIN pg_tablespace t ON t.oid = d.dattablespace
WHERE d.datname = current_database()`

export const SCHEMAS_QUERY = `
SELECT n.nspname AS name,
       pg_get_userbyid(n.nspowner) AS owner,
       has_schema_privilege(current_user, n.oid, 'USAGE') AS can_use,
       has_schema_privilege(current_user, n.oid, 'CREATE') AS can_create
FROM pg_namespace n
WHERE n.nspname = ANY($1::text[])
ORDER BY n.nspname`

export const EXTENSIONS_QUERY = `
SELECT e.extname AS name, e.extversion AS version, n.nspname AS schema
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
ORDER BY e.extname`

export const RELATIONS_QUERY = `
SELECT n.nspname AS schema,
       c.relname AS name,
       c.relkind AS kind,
       pg_get_userbyid(c.relowner) AS owner,
       pn.nspname AS parent_schema,
       p.relname AS parent_name,
       CASE WHEN c.relkind = 'p' THEN pg_get_partkeydef(c.oid) ELSE NULL END AS partition_key,
       c.relrowsecurity AS row_security,
       GREATEST(c.reltuples, 0)::float8 AS estimated_rows
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_inherits i ON i.inhrelid = c.oid
LEFT JOIN pg_class p ON p.oid = i.inhparent
LEFT JOIN pg_namespace pn ON pn.oid = p.relnamespace
WHERE n.nspname = ANY($1::text[]) AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
ORDER BY n.nspname, c.relname`

export const COLUMNS_QUERY = `
SELECT n.nspname AS schema,
       c.relname AS name,
       a.attnum AS ordinal,
       a.attname AS column,
       format_type(a.atttypid, a.atttypmod) AS data_type,
       NOT a.attnotnull AS nullable,
       a.attgenerated <> '' AS generated,
       pg_get_expr(ad.adbin, ad.adrelid) AS default_expression
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
WHERE n.nspname = ANY($1::text[]) AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
  AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY n.nspname, c.relname, a.attnum`

export const CONSTRAINTS_QUERY = `
SELECT n.nspname AS schema,
       r.relname AS name,
       c.conname AS constraint,
       c.contype AS kind,
       ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(attnum, ord)
             JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
             ORDER BY k.ord)::text[] AS columns,
       rn.nspname AS referenced_schema,
       rr.relname AS referenced_name,
       ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(attnum, ord)
             JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.attnum
             ORDER BY k.ord)::text[] AS referenced_columns,
       pg_get_constraintdef(c.oid, true) AS definition
FROM pg_constraint c
JOIN pg_class r ON r.oid = c.conrelid
JOIN pg_namespace n ON n.oid = r.relnamespace
LEFT JOIN pg_class rr ON rr.oid = c.confrelid
LEFT JOIN pg_namespace rn ON rn.oid = rr.relnamespace
WHERE n.nspname = ANY($1::text[]) AND c.contype IN ('p', 'f', 'u', 'c', 'x')
ORDER BY n.nspname, r.relname, c.conname`

export const INDEXES_QUERY = `
SELECT n.nspname AS schema,
       r.relname AS name,
       i.relname AS index,
       x.indisunique AS unique,
       x.indisprimary AS primary,
       x.indisvalid AS valid,
       pg_get_indexdef(i.oid) AS definition
FROM pg_index x
JOIN pg_class i ON i.oid = x.indexrelid
JOIN pg_class r ON r.oid = x.indrelid
JOIN pg_namespace n ON n.oid = r.relnamespace
WHERE n.nspname = ANY($1::text[])
ORDER BY n.nspname, r.relname, i.relname`

export const ROUTINES_QUERY = `
SELECT n.nspname AS schema,
       p.proname AS name,
       pg_get_function_identity_arguments(p.oid) AS identity_arguments,
       p.prokind AS kind,
       l.lanname AS language,
       pg_get_function_result(p.oid) AS result_type,
       CASE WHEN p.prokind IN ('f', 'p') THEN pg_get_functiondef(p.oid) ELSE NULL END AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE n.nspname = ANY($1::text[])
ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)`

export const TRIGGERS_QUERY = `
SELECT n.nspname AS schema,
       c.relname AS name,
       t.tgname AS trigger,
       t.tgenabled AS enabled,
       pg_get_triggerdef(t.oid, true) AS definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = ANY($1::text[]) AND NOT t.tgisinternal
ORDER BY n.nspname, c.relname, t.tgname`

export const TYPES_QUERY = `
SELECT n.nspname AS schema,
       t.typname AS name,
       t.typtype AS kind,
       CASE t.typtype
         WHEN 'd' THEN format_type(t.typbasetype, t.typtypmod)
         WHEN 'e' THEN (SELECT string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder)
                        FROM pg_enum e WHERE e.enumtypid = t.oid)
         WHEN 'c' THEN t.typrelid::regclass::text
         WHEN 'r' THEN format_type(r.rngsubtype, NULL)
       END AS definition
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
LEFT JOIN pg_range r ON r.rngtypid = t.oid
WHERE n.nspname = ANY($1::text[]) AND t.typtype IN ('d', 'e', 'c', 'r')
  AND NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.reltype = t.oid AND c.relkind IN ('r','p','v','m','f'))
ORDER BY n.nspname, t.typname`

export const SEQUENCES_QUERY = `
SELECT sequence_schema AS schema,
       sequence_name AS name,
       data_type,
       start_value AS start,
       increment AS increment,
       cycle_option = 'YES' AS cycle
FROM information_schema.sequences
WHERE sequence_schema = ANY($1::text[])
ORDER BY sequence_schema, sequence_name`

export const GRANTS_QUERY = `
SELECT 'relation:' || table_schema || '.' || table_name AS object,
       grantee,
       privilege_type AS privilege,
       is_grantable = 'YES' AS grantable
FROM information_schema.role_table_grants
WHERE table_schema = ANY($1::text[])
UNION ALL
SELECT 'routine:' || routine_schema || '.' || routine_name AS object,
       grantee,
       privilege_type AS privilege,
       is_grantable = 'YES' AS grantable
FROM information_schema.role_routine_grants
WHERE routine_schema = ANY($1::text[])
ORDER BY object, grantee, privilege`
