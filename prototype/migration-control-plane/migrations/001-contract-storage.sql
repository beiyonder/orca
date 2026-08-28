CREATE TABLE control_plane.kernel_metadata (
  key text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]{0,127}$'),
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);

INSERT INTO control_plane.kernel_metadata (key, value)
VALUES
  ('contract_registry_version', '1'),
  ('contract_registry_digest', 'c625dd7c6ea4d45dfb98d477959681f85bea23c314ef23e2237ce615c3948164'),
  ('minimum_postgres_major', '16');

CREATE TABLE control_plane.contract_schemas (
  schema_name text NOT NULL,
  schema_version smallint NOT NULL CHECK (schema_version > 0),
  json_schema_id text NOT NULL,
  schema_sha256 char(64) NOT NULL CHECK (schema_sha256 ~ '^[a-f0-9]{64}$'),
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (schema_name, schema_version),
  UNIQUE (json_schema_id)
);

INSERT INTO control_plane.contract_schemas (
  schema_name,
  schema_version,
  json_schema_id,
  schema_sha256
)
VALUES
  ('accepted-finding.v1', 1, 'urn:orca:migration-control-plane:accepted-finding.v1', 'e9d8be1184049b85a656e6603bfb97be97d3493c9d759463a510a86f244b5f5a'),
  ('artifact-version.v1', 1, 'urn:orca:migration-control-plane:artifact-version.v1', '37c235bed2c0f7a21237ca3aaba3e1f2ac26bc18d27e510c8843b98570488b87'),
  ('assertion.v1', 1, 'urn:orca:migration-control-plane:assertion.v1', 'a9924fd28bf9c36ba7df9343b03641bd0cbb64580b56a534827760b2b1ab682c'),
  ('assignment-attempt.v1', 1, 'urn:orca:migration-control-plane:assignment-attempt.v1', '8dd277e4dd22a4beef6a3580034cac8331671c27ae9916cfd5b25e888ff30ec7'),
  ('assignment-record.v1', 1, 'urn:orca:migration-control-plane:assignment-record.v1', '6309a59b8f988216466723d392f866ba82d5126f5ccb6c6ae00de8c1c7da4c64'),
  ('assignment-result.v1', 1, 'urn:orca:migration-control-plane:assignment-result.v1', 'c39abeb0010722deaab70312092c244cd1f17b08b6386844847de1e609d298d9'),
  ('capability-envelope.v1', 1, 'urn:orca:migration-control-plane:capability-envelope.v1', 'de34db9f856f22a2c0fce89d6be9c09bf67088770be75a1cfb56ed59e4521d95'),
  ('capability-manifest.v1', 1, 'urn:orca:migration-control-plane:capability-manifest.v1', '5c4ee097212f6699aeabf831b6093acb5dcf227fbd1268b61ac99681eaa00833'),
  ('capability-use.v1', 1, 'urn:orca:migration-control-plane:capability-use.v1', '616f5c20b3033f8bba34f160ae216b0e44b6ab4506dea38d0d7806927c3d8fba'),
  ('certification-result.v1', 1, 'urn:orca:migration-control-plane:certification-result.v1', 'c26431195ff0ef066a4921dd77f980d2d4e8d83223e51e94c8cf802e02e8cff0'),
  ('compensation.v1', 1, 'urn:orca:migration-control-plane:compensation.v1', '3e9548491684d4f8024ccb94cfaef031fdf594c69837958cfebea37bf53b085f'),
  ('context-manifest.v1', 1, 'urn:orca:migration-control-plane:context-manifest.v1', '5db7b26044848256000f8bb9b6c8f858f80c06d7679c9e43a52773d1e1fe78dc'),
  ('contradiction-set.v1', 1, 'urn:orca:migration-control-plane:contradiction-set.v1', '33bb65a7167e91736aba968b07858dac63d6c28b0dea7fe82902d9eb764f30e9'),
  ('correction-request.v1', 1, 'urn:orca:migration-control-plane:correction-request.v1', 'c165f76bfc5a9e82be946b768bb80d7dc8db567715bacb2c0d7d423757e445e8'),
  ('correction-result.v1', 1, 'urn:orca:migration-control-plane:correction-result.v1', '117f30c21b5ca604672af6de9e400ef41056eae44c79636468b2a6acc76ea313'),
  ('decision-record.v1', 1, 'urn:orca:migration-control-plane:decision-record.v1', '2ed0726f7c53cf16955b13267210b5aa534d5aefb4eb392c971e4b96c52b8f8c'),
  ('drift-signal.v1', 1, 'urn:orca:migration-control-plane:drift-signal.v1', 'e00f6a3db7bda2a8b88a5b63f0817fbf336f1e2895eb1a1cbd249c0a91b27faf'),
  ('effect-attempt.v1', 1, 'urn:orca:migration-control-plane:effect-attempt.v1', 'feb9c10f2396783bfe5ef50a8e235fea0e9d41b153a6ac443cee2fe0dd6c2fb4'),
  ('effect-intent.v1', 1, 'urn:orca:migration-control-plane:effect-intent.v1', '2c09e1d53356e780bec6811e8fc41a962d48b8c31fad4e6293c98d973cd452b4'),
  ('effect-receipt.v1', 1, 'urn:orca:migration-control-plane:effect-receipt.v1', '797d4dc82695bf80c3279b85a53c10af48f09f8d66c68a02fa1f77e6d630fd4c'),
  ('evaluation-assignment.v1', 1, 'urn:orca:migration-control-plane:evaluation-assignment.v1', 'aa6d468f87438b624c4dfe62160d4870e5938a7c040f7aa4206dd6f0cd057d6b'),
  ('evaluation-contract.v1', 1, 'urn:orca:migration-control-plane:evaluation-contract.v1', '9b38bca23bb287e1abdf8ed22eef6b1f0895cd3d0cb6cc019d023ec595c4ec0d'),
  ('evaluation-result.v1', 1, 'urn:orca:migration-control-plane:evaluation-result.v1', '15d7ea505e50d93e0b58eead60d061ac458b8dd804ab5e45a290b810f65043f3'),
  ('evaluator-definition.v1', 1, 'urn:orca:migration-control-plane:evaluator-definition.v1', '979b52138e13adb809877fcaa88651cbc7860e264c04f1d06bb0c13445f47fa9'),
  ('evidence-item.v1', 1, 'urn:orca:migration-control-plane:evidence-item.v1', '39c2595856509ec91d8705b586bd7f6be2014abce90c39451c5227a20ab0a5d5'),
  ('gap.v1', 1, 'urn:orca:migration-control-plane:gap.v1', '1338f8a68f85fcf9e2d967a043c867b5eccaae3c0c6ca25e5663d6b7dbcc6b5c'),
  ('impact-review.v1', 1, 'urn:orca:migration-control-plane:impact-review.v1', '67094c5776776b61a104f23930e97550f96c4f5b523e0f0b216f4db92a4211e2'),
  ('learning-candidate.v1', 1, 'urn:orca:migration-control-plane:learning-candidate.v1', 'cf9e35df3e4c12b19c2c61d22b7e114f4dda75575cb56d9b36164a762c76c2d9'),
  ('mission-command.v1', 1, 'urn:orca:migration-control-plane:mission-command.v1', 'f7a8218b3faef0a6badd3602085af290331d4854768029f0a1176467ce0a882b'),
  ('mission-event.v1', 1, 'urn:orca:migration-control-plane:mission-event.v1', '1a2292f5a413ed381f297b225f9435194cdcbb988b5ef059c46ae2fec3995dfd'),
  ('mission-record.v1', 1, 'urn:orca:migration-control-plane:mission-record.v1', '4d7d5f95e41856da535f9cd80a8322593bafc7db61603eaf8deae0322a3b229a'),
  ('plan-revision.v1', 1, 'urn:orca:migration-control-plane:plan-revision.v1', '1b2a524109973df86de8a09a2655bf58ca0521ccbc7f988487405fb2106f9cd5'),
  ('policy-decision.v1', 1, 'urn:orca:migration-control-plane:policy-decision.v1', '4b3c84237afd25018b75f1a576c21c31375bc7ceff2977128a1f36da7863fe26'),
  ('probe-request.v1', 1, 'urn:orca:migration-control-plane:probe-request.v1', 'ab4bb7388347dcad31b733386a24ed875a6764bbd5f720f6a14d23ac7806868a'),
  ('probe-result.v1', 1, 'urn:orca:migration-control-plane:probe-result.v1', 'f5609f4a8998c5f05e872ef9a82b2cedee6b3f2a4e6c4859c215e1c1df55b26e'),
  ('promotion-decision.v1', 1, 'urn:orca:migration-control-plane:promotion-decision.v1', 'cb09a599b4ced9b30a6b5e5910b3ee44257af92ffcffb08d2127b6fc8adc42a3'),
  ('proposition.v1', 1, 'urn:orca:migration-control-plane:proposition.v1', '2a21c3cb26d0b0bb1e375af7ebbc2d588a06b654b47299ba8f1959025a3c4d69'),
  ('recovery-disposition.v1', 1, 'urn:orca:migration-control-plane:recovery-disposition.v1', 'd970123af0561ca8fbd53410378d59c9762cee45e05fdc01d96ccf01b8ce710e'),
  ('secret-lease.v1', 1, 'urn:orca:migration-control-plane:secret-lease.v1', 'e6397fc2d35b40efae95d8320973451be434aacb43f1cf7906bf5dead6d53a9c'),
  ('target-observation.v1', 1, 'urn:orca:migration-control-plane:target-observation.v1', 'a98bdbc7734ca79dd30f8981ad5e0c0e85f6d200e013c4a028e787215f49e3f6'),
  ('task-record.v1', 1, 'urn:orca:migration-control-plane:task-record.v1', '5053b08d6feeb05a9faabde5d977edf72ddb6d1bba12bae840b99c17a2a1281c');

CREATE TABLE control_plane.domain_records (
  tenant_id text NOT NULL CHECK (tenant_id ~ '^tenant_[a-z0-9][a-z0-9_-]{0,111}$'),
  record_id text NOT NULL CHECK (length(record_id) BETWEEN 3 AND 128),
  mission_id text CHECK (mission_id ~ '^mission_[a-z0-9][a-z0-9_-]{0,111}$'),
  schema_name text NOT NULL,
  schema_version smallint NOT NULL CHECK (schema_version = 1),
  record_kind text NOT NULL CHECK (length(record_kind) BETWEEN 1 AND 128),
  aggregate_revision bigint CHECK (aggregate_revision BETWEEN 0 AND 9007199254740991),
  record_state text CHECK (length(record_state) BETWEEN 1 AND 128),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  payload_sha256 char(64) NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, record_id),
  FOREIGN KEY (schema_name, schema_version)
    REFERENCES control_plane.contract_schemas (schema_name, schema_version),
  CHECK (payload ->> 'id' = record_id),
  CHECK (payload ->> 'schemaVersion' = schema_version::text),
  CHECK (payload ->> 'kind' = record_kind),
  CHECK (updated_at >= created_at)
);

CREATE INDEX domain_records_by_mission_type_state
  ON control_plane.domain_records (tenant_id, mission_id, schema_name, record_state, updated_at DESC);
CREATE INDEX domain_records_by_mission_time
  ON control_plane.domain_records (tenant_id, mission_id, created_at, record_id);
CREATE INDEX domain_records_by_scope_entity
  ON control_plane.domain_records (tenant_id, mission_id, ((payload #>> '{scope,entity}')))
  WHERE payload #>> '{scope,entity}' IS NOT NULL;
