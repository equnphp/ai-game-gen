-- 设计DDL：未执行。仅由受信任核心在新库初始化事务中运行，不能执行项目自带SQL。
-- 连接初始化必须先设置WAL/FULL/foreign_keys，见storage.md；下列表共同组成format v1。
PRAGMA application_id = 1195853134; -- ASCII GGEN，0x4747454e。
PRAGMA user_version = 1;

CREATE TABLE project (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1),
  project_id TEXT NOT NULL UNIQUE,
  branch_id TEXT NOT NULL,
  format_version INTEGER NOT NULL CHECK(format_version=1),
  name TEXT NOT NULL,
  settings_document_id TEXT NOT NULL,
  default_scene_id TEXT NOT NULL,
  head_revision INTEGER NOT NULL CHECK(head_revision>=0),
  hash_version TEXT NOT NULL CHECK(hash_version='gg-json-v1'),
  initialized INTEGER NOT NULL CHECK(initialized IN(0,1))
) STRICT;

CREATE TABLE transactions (
  revision INTEGER PRIMARY KEY CHECK(revision>=0),
  transaction_id TEXT NOT NULL UNIQUE,
  parent_revision INTEGER,
  request_id TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK(kind IN('init','edit','attach','undo','redo','restore')),
  source_transaction_id TEXT,
  forward_json TEXT NOT NULL CHECK(json_valid(forward_json)),
  inverse_json TEXT NOT NULL CHECK(json_valid(inverse_json)),
  committed_at_ms INTEGER NOT NULL,
  FOREIGN KEY(parent_revision) REFERENCES transactions(revision)
) STRICT;

CREATE TABLE requests (
  request_id TEXT PRIMARY KEY,
  op TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  result_json TEXT NOT NULL CHECK(json_valid(result_json)),
  committed_revision INTEGER,
  created_at_ms INTEGER NOT NULL,
  FOREIGN KEY(committed_revision) REFERENCES transactions(revision)
) STRICT;

CREATE TABLE document_versions (
  version_id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK(schema_version>0),
  body_json TEXT NOT NULL CHECK(json_valid(body_json) AND length(CAST(body_json AS BLOB))<=1048576),
  content_hash TEXT NOT NULL,
  created_revision INTEGER NOT NULL,
  FOREIGN KEY(created_revision) REFERENCES transactions(revision)
) STRICT;
CREATE INDEX document_versions_by_id ON document_versions(document_id,created_revision);

CREATE TABLE document_heads (
  document_id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL UNIQUE,
  FOREIGN KEY(version_id) REFERENCES document_versions(version_id)
) STRICT;

-- 索引属于对应不可变版本；target_id不直接FK，候选完整状态由核心处理领域引用。
CREATE TABLE document_refs (
  version_id TEXT NOT NULL,
  field_path TEXT NOT NULL,
  target_kind TEXT NOT NULL CHECK(target_kind IN('document','entity','asset')),
  target_id TEXT NOT NULL,
  required INTEGER NOT NULL CHECK(required IN(0,1)),
  PRIMARY KEY(version_id,field_path),
  FOREIGN KEY(version_id) REFERENCES document_versions(version_id) ON DELETE CASCADE
) STRICT;
CREATE INDEX document_refs_by_target ON document_refs(target_kind,target_id,version_id);

CREATE TABLE blob_objects (
  blob_id TEXT PRIMARY KEY,
  content_hash TEXT UNIQUE,
  expected_size INTEGER NOT NULL CHECK(expected_size>=0 AND expected_size<=67108864),
  received_size INTEGER NOT NULL CHECK(received_size>=0 AND received_size<=expected_size),
  state TEXT NOT NULL CHECK(state IN('STAGING','READY')),
  created_at_ms INTEGER NOT NULL,
  CHECK(state='STAGING' OR (content_hash IS NOT NULL AND received_size=expected_size))
) STRICT;
CREATE TABLE blob_chunks (
  blob_id TEXT NOT NULL,
  byte_offset INTEGER NOT NULL CHECK(byte_offset>=0),
  data BLOB NOT NULL CHECK(length(data)>0 AND length(data)<=1048576),
  chunk_hash TEXT NOT NULL,
  PRIMARY KEY(blob_id,byte_offset),
  FOREIGN KEY(blob_id) REFERENCES blob_objects(blob_id) ON DELETE CASCADE
) STRICT;

CREATE TABLE uploads (
  upload_id TEXT PRIMARY KEY,
  blob_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  media_type TEXT NOT NULL,
  source_json TEXT NOT NULL CHECK(json_valid(source_json)),
  license_json TEXT NOT NULL CHECK(json_valid(license_json)),
  expected_hash TEXT,
  state TEXT NOT NULL CHECK(state IN('UPLOADING','READY','ATTACHED','CANCELLED')),
  created_at_ms INTEGER NOT NULL,
  FOREIGN KEY(blob_id) REFERENCES blob_objects(blob_id)
) STRICT;

-- 元信息不可变；相同内容可有多个asset_id，各自保留来源与许可。
CREATE TABLE assets (
  asset_id TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  media_type TEXT NOT NULL,
  source_json TEXT NOT NULL CHECK(json_valid(source_json)),
  license_json TEXT NOT NULL CHECK(json_valid(license_json)),
  local_only INTEGER NOT NULL CHECK(local_only=1),
  created_revision INTEGER NOT NULL,
  FOREIGN KEY(content_hash) REFERENCES blob_objects(content_hash),
  FOREIGN KEY(created_revision) REFERENCES transactions(revision)
) STRICT;
CREATE INDEX assets_by_hash ON assets(content_hash);
CREATE TABLE asset_heads (
  asset_id TEXT PRIMARY KEY,
  FOREIGN KEY(asset_id) REFERENCES assets(asset_id)
) STRICT;

CREATE TABLE snapshots (
  snapshot_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK(reason IN('init','edit','attach','undo','redo','restore')),
  manifest_hash TEXT NOT NULL,
  locked INTEGER NOT NULL DEFAULT 0 CHECK(locked IN(0,1)),
  created_at_ms INTEGER NOT NULL,
  FOREIGN KEY(revision) REFERENCES transactions(revision)
) STRICT;
CREATE INDEX snapshots_retention ON snapshots(locked,revision);
CREATE TABLE snapshot_documents (
  snapshot_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  PRIMARY KEY(snapshot_id,document_id),
  FOREIGN KEY(snapshot_id) REFERENCES snapshots(snapshot_id) ON DELETE CASCADE,
  FOREIGN KEY(version_id) REFERENCES document_versions(version_id)
) STRICT;
CREATE TABLE snapshot_assets (
  snapshot_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  PRIMARY KEY(snapshot_id,asset_id),
  FOREIGN KEY(snapshot_id) REFERENCES snapshots(snapshot_id) ON DELETE CASCADE,
  FOREIGN KEY(asset_id) REFERENCES assets(asset_id)
) STRICT;

-- slot为历史序号；Undo/Redo自身记录事务，但不追加普通编辑栈项。
CREATE TABLE history_entries (
  slot INTEGER PRIMARY KEY CHECK(slot>0),
  transaction_id TEXT NOT NULL UNIQUE,
  applied INTEGER NOT NULL CHECK(applied IN(0,1)),
  FOREIGN KEY(transaction_id) REFERENCES transactions(transaction_id)
) STRICT;

CREATE TABLE format_migrations (
  from_version INTEGER NOT NULL,
  to_version INTEGER NOT NULL,
  migration_id TEXT NOT NULL UNIQUE,
  source_backup_hash TEXT NOT NULL,
  completed_at_ms INTEGER NOT NULL,
  PRIMARY KEY(from_version,to_version)
) STRICT;

-- READY检查只是数据库辅助防线，不能替代核心对hash、长度和实际分块的校验。
CREATE TRIGGER assets_require_ready BEFORE INSERT ON assets
BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM blob_objects WHERE content_hash=NEW.content_hash AND state='READY'
  ) THEN RAISE(ABORT,'asset_blob_not_ready') END;
END;
