INSERT INTO control_plane.contract_schemas (
  schema_name,
  schema_version,
  json_schema_id,
  schema_sha256,
  active
)
VALUES
  ('memory-candidate.v1', 1, 'urn:orca:migration-control-plane:memory-candidate.v1', 'fe783a4af55604347abd9fccf3146b91e003dcf43d0309ed5f22dbe5c015c192', true),
  ('memory-invalidation.v1', 1, 'urn:orca:migration-control-plane:memory-invalidation.v1', '7cff905a4dc4f786704aaeea6d0cb40da65eb86958e288cde50b99ba60f40d24', true),
  ('memory-use.v1', 1, 'urn:orca:migration-control-plane:memory-use.v1', 'e7387a73fdd34c0b13b86dd043157cf11158ef389c23fc64c00bee549f2f0942', true),
  ('memory-version.v1', 1, 'urn:orca:migration-control-plane:memory-version.v1', 'f0ed3d41e89e4e83c14916939338b3a728e8e890db931ae8b6009246ff54e6cb', true),
  ('skill-lifecycle-event.v1', 1, 'urn:orca:migration-control-plane:skill-lifecycle-event.v1', 'c4c4d7b96e2154200775caf29f61961f92d3b14ea718ba1bf8bf419e1203a962', true),
  ('skill-version.v1', 1, 'urn:orca:migration-control-plane:skill-version.v1', '70ef0c03f8b010236fc3dc96acf07c2d40245d28495ca85354804f50d9071c83', true);

UPDATE control_plane.kernel_metadata
SET value = '21e090687ee57eb3f248a48e8a08284c037a5ce3f99dd50507fbd5aea3239f50',
    updated_at = transaction_timestamp()
WHERE key = 'contract_registry_digest';

DROP TRIGGER domain_records_immutable_knowledge
  ON control_plane.domain_records;

CREATE TRIGGER domain_records_immutable_knowledge
BEFORE UPDATE OR DELETE ON control_plane.domain_records
FOR EACH ROW
WHEN (
  OLD.schema_name LIKE 'corpus-%'
  OR OLD.schema_name LIKE 'retrieval-%'
  OR OLD.schema_name LIKE 'memory-%'
  OR OLD.schema_name LIKE 'skill-%'
  OR OLD.schema_name = 'knowledge-context-manifest.v1'
)
EXECUTE FUNCTION control_plane.reject_immutable_knowledge_record_mutation();
