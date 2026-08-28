INSERT INTO control_plane.contract_schemas (
  schema_name,
  schema_version,
  json_schema_id,
  schema_sha256,
  active
)
VALUES
  ('corpus-chunk.v1', 1, 'urn:orca:migration-control-plane:corpus-chunk.v1', 'f310dc5298109b4a6ceba32692907222534e0f7e37d3b64a71011e18e7221827', true),
  ('corpus-entity.v1', 1, 'urn:orca:migration-control-plane:corpus-entity.v1', '2addedb09fafdd33ed535b1cd14d9dde942a65e69e879854a5a5d13496470b28', true),
  ('corpus-parse-version.v1', 1, 'urn:orca:migration-control-plane:corpus-parse-version.v1', 'aaf4d18c4caaece995b5f238e5723fa05259cd21a41111599c9d7788a4bd5375', true),
  ('corpus-relation.v1', 1, 'urn:orca:migration-control-plane:corpus-relation.v1', 'ec9a2c43f4b65b9ca7668d5fb142208a6cabb72701df6d3019c9e71accdf8e9d', true),
  ('corpus-source-manifest.v1', 1, 'urn:orca:migration-control-plane:corpus-source-manifest.v1', '0c7c0b4ad200ab7e24f81adfb55917a4a07b3f2d2d21b0276f01981d0ec3f9be', true);

UPDATE control_plane.kernel_metadata
SET value = 'cf9dadff605a2cc69de2979a9982e961ae504f93128af84faafc083ffc841947',
    updated_at = transaction_timestamp()
WHERE key = 'contract_registry_digest';

CREATE FUNCTION control_plane.reject_immutable_knowledge_record_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'corpus record % is immutable', OLD.record_id
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER domain_records_immutable_knowledge
BEFORE UPDATE OR DELETE ON control_plane.domain_records
FOR EACH ROW
WHEN (OLD.schema_name LIKE 'corpus-%')
EXECUTE FUNCTION control_plane.reject_immutable_knowledge_record_mutation();
