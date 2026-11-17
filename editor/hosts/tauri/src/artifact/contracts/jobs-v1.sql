-- 设备作业库的受信任内置DDL；仅创建新库，不从作者工程或归档执行SQL。
-- 只用本进程同一个gg_sqlite动态provider；Rust禁止rusqlite bundled或第二amalgamation。
PRAGMA application_id=1195854410;
PRAGMA user_version=1;
PRAGMA journal_mode=WAL;
PRAGMA synchronous=FULL;
PRAGMA foreign_keys=ON;

CREATE TABLE service_meta (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 store_id TEXT NOT NULL UNIQUE,
 schema_version INTEGER NOT NULL CHECK(schema_version=1),
 next_job_ordinal INTEGER NOT NULL CHECK(next_job_ordinal>=0)
) STRICT;
CREATE TABLE source_bindings (
 binding_id TEXT PRIMARY KEY, principal_scope_id TEXT NOT NULL,
 workspace_id TEXT NOT NULL, project_id TEXT NOT NULL, branch_id TEXT NOT NULL,
 directory_name TEXT NOT NULL, host_instance_id TEXT NOT NULL,
 session_id TEXT NOT NULL, core_instance_id TEXT NOT NULL,
 core_protocol TEXT NOT NULL CHECK(core_protocol IN('1.0','1.1')),
 state TEXT NOT NULL CHECK(state IN('active','awaiting_project_reopen','released','failed')),
 created_at_ms INTEGER NOT NULL
) STRICT;
CREATE TABLE jobs (
 job_id TEXT PRIMARY KEY, origin_request_id TEXT NOT NULL UNIQUE,
 principal_scope_id TEXT NOT NULL, job_ordinal INTEGER NOT NULL UNIQUE,
 kind TEXT NOT NULL CHECK(kind IN('compile','game_export','project_writer','reader','asset_process','archive','lan_sync','media_generate')),
 state TEXT NOT NULL CHECK(state IN('PREPARED','QUEUED','RUNNING','NEEDS_USER','COMMITTING','SUCCEEDED','FAILED','CANCELLED')),
 phase TEXT NOT NULL CHECK(phase IN('prepare','execute','recovery','terminal')),
 binding_id TEXT, snapshot_json TEXT CHECK(snapshot_json IS NULL OR json_valid(snapshot_json)),
 profile_id TEXT NOT NULL, options_json TEXT NOT NULL CHECK(json_valid(options_json)),
 input_grants_json TEXT NOT NULL CHECK(json_valid(input_grants_json)),
 output_grant_locator TEXT, cancel_requested INTEGER NOT NULL CHECK(cancel_requested IN(0,1)),
 recovery TEXT NOT NULL CHECK(recovery IN('none','reconcile','awaiting_project','awaiting_grant','awaiting_user','blocked')),
 target_compatibility TEXT NOT NULL CHECK(target_compatibility IN('not_checked','format_checked','opened','runtime_verified')),
 created_at_ms INTEGER NOT NULL, updated_at_ms INTEGER NOT NULL,
 FOREIGN KEY(binding_id) REFERENCES source_bindings(binding_id)
) STRICT;
CREATE INDEX jobs_by_principal_state ON jobs(principal_scope_id,state,job_ordinal);
CREATE TABLE requests (
 principal_scope_id TEXT NOT NULL, request_id TEXT NOT NULL, method TEXT NOT NULL,
 request_hash TEXT NOT NULL, job_id TEXT, plan_id TEXT,
 status TEXT NOT NULL CHECK(status IN('pending','succeeded','failed','unknown')),
 response_json TEXT CHECK(response_json IS NULL OR json_valid(response_json)),
 created_at_ms INTEGER NOT NULL, updated_at_ms INTEGER NOT NULL,
 PRIMARY KEY(principal_scope_id,request_id),
 FOREIGN KEY(job_id) REFERENCES jobs(job_id)
) STRICT;
CREATE TABLE plans (
 plan_id TEXT PRIMARY KEY, job_id TEXT NOT NULL UNIQUE,
 semantic_plan_hash TEXT NOT NULL, plan_json TEXT NOT NULL CHECK(json_valid(plan_json)),
 source_input_hash TEXT NOT NULL, component_set_hash TEXT NOT NULL,
 expires_at_ms INTEGER NOT NULL, expires_service_instance_id TEXT NOT NULL,
 bridge_plan_id TEXT, bridge_plan_hash TEXT,
 state TEXT NOT NULL CHECK(state IN('preparing','prepared','started','expired','failed')),
 FOREIGN KEY(job_id) REFERENCES jobs(job_id)
) STRICT;
CREATE TABLE job_stages (
 job_id TEXT NOT NULL, stage_id TEXT NOT NULL, ordinal INTEGER NOT NULL,
 state TEXT NOT NULL CHECK(state IN('PREPARED','QUEUED','RUNNING','NEEDS_USER','COMMITTING','SUCCEEDED','FAILED','CANCELLED')),
 pure INTEGER NOT NULL CHECK(pure IN(0,1)), cancellable INTEGER NOT NULL CHECK(cancellable IN(0,1)),
 attempt INTEGER NOT NULL CHECK(attempt>=0), input_hash TEXT, output_hash TEXT,
 receipt_json TEXT CHECK(receipt_json IS NULL OR json_valid(receipt_json)),
 diagnostics_json TEXT NOT NULL CHECK(json_valid(diagnostics_json)),
 PRIMARY KEY(job_id,stage_id), UNIQUE(job_id,ordinal),
 FOREIGN KEY(job_id) REFERENCES jobs(job_id)
) STRICT;
CREATE TABLE snapshot_owners (
 owner_id TEXT PRIMARY KEY, job_id TEXT, binding_id TEXT NOT NULL,
 owner_role TEXT NOT NULL CHECK(owner_role IN('save_coordinator','artifact_job')),
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
 consumer_id TEXT UNIQUE, retain_request_id TEXT NOT NULL UNIQUE,
 release_request_id TEXT,
 state TEXT NOT NULL CHECK(state IN('retain_pending','active','release_pending','released','unknown')),
 source_needed INTEGER NOT NULL CHECK(source_needed IN(0,1)),
 bridge_closed INTEGER NOT NULL CHECK(bridge_closed IN(0,1)),
 created_at_ms INTEGER NOT NULL, updated_at_ms INTEGER NOT NULL,
 FOREIGN KEY(job_id) REFERENCES jobs(job_id),
 FOREIGN KEY(binding_id) REFERENCES source_bindings(binding_id)
) STRICT;
CREATE TABLE save_handoffs (
 handoff_id TEXT PRIMARY KEY, principal_scope_id TEXT NOT NULL,
 binding_id TEXT NOT NULL, owner_id TEXT NOT NULL, snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
 state TEXT NOT NULL CHECK(state IN('capturing','captured','artifact_retaining','handed_off','cancelled','unknown')),
 artifact_request_id TEXT, artifact_job_id TEXT,
 FOREIGN KEY(owner_id) REFERENCES snapshot_owners(owner_id),
 FOREIGN KEY(binding_id) REFERENCES source_bindings(binding_id),
 FOREIGN KEY(artifact_job_id) REFERENCES jobs(job_id)
) STRICT;
CREATE TABLE artifacts (
 artifact_id TEXT PRIMARY KEY, producing_job_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN('runtime_bundle','game_package','editable_project','report')),
 content_hash TEXT NOT NULL, manifest_hash TEXT NOT NULL,
 bytes_text TEXT NOT NULL, ready INTEGER NOT NULL CHECK(ready IN(0,1)),
 verified_content INTEGER NOT NULL CHECK(verified_content IN(0,1)),
 manifest_relative_file TEXT NOT NULL, created_at_ms INTEGER NOT NULL,
 FOREIGN KEY(producing_job_id) REFERENCES jobs(job_id)
) STRICT;
CREATE TABLE artifact_blocks (
 artifact_id TEXT NOT NULL, block_hash TEXT NOT NULL, bytes_text TEXT NOT NULL,
 purpose TEXT NOT NULL, relative_file TEXT NOT NULL,
 PRIMARY KEY(artifact_id,block_hash), FOREIGN KEY(artifact_id) REFERENCES artifacts(artifact_id)
) STRICT;
CREATE TABLE artifact_owners (
 artifact_id TEXT NOT NULL, owner_kind TEXT NOT NULL CHECK(owner_kind IN('job_output','ui_result','runtime','stream','recovery')),
 owner_id TEXT NOT NULL, principal_scope_id TEXT NOT NULL,
 created_at_ms INTEGER NOT NULL,
 PRIMARY KEY(artifact_id,owner_kind,owner_id),
 FOREIGN KEY(artifact_id) REFERENCES artifacts(artifact_id)
) STRICT;
CREATE TABLE external_effects (
 effect_id TEXT PRIMARY KEY, job_id TEXT NOT NULL, stage_id TEXT NOT NULL,
 purpose TEXT NOT NULL, destination_locator TEXT,
 state TEXT NOT NULL CHECK(state IN('prepared','submitting','known','unknown')),
 receipt_json TEXT CHECK(receipt_json IS NULL OR json_valid(receipt_json)),
 FOREIGN KEY(job_id,stage_id) REFERENCES job_stages(job_id,stage_id)
) STRICT;
