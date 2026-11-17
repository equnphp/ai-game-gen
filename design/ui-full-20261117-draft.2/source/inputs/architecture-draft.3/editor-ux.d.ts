/* 架构类型声明；未编译。Schema与UX-CONTRACTS.md约束权限、范围、版本与状态；此接口不修改Core HostPort1.0。 */
export type UUID = string;
export type U64 = string;
export type GuideId = string;
export type GuideVersion = string;
export type StepId = string;
export type HintId = string;
export type StepStatus = "not_started" | "active" | "completed" | "acknowledged" | "skipped" | "blocked";
export type GuideStatus = "not_started" | "in_progress" | "skipped" | "ended" | "completed";
export type PersistenceState = "clean" | "pending" | "failed";
export type ProfileAvailability = "new" | "loaded" | "read_only" | "corrupt" | "future_schema" | "memory_only";
export type Limits = { "profileBytes": 262144; "practiceJournalBytes": 8388608; "pendingPracticeRuns": 1; "practiceJournalRecords": 128; "commandReceipts": 128; "courseVersionRecords": 32; "stepsPerCourse": 64; "suppressedHints": 512; "requestBytes": 65536; "responseBytes": 524288; "eventRing": 256; "eventReadItems": 100; };
export type StepRecord = { "stepId": StepId; "status": StepStatus; "proofRefs": ReadonlyArray<UUID>; "lastIntentId": UUID | null; "reasonCode": string | null; };
export type Binding = { "projectId": UUID | null; "entityId": UUID | null; "creationIntentId": UUID | null; };
export type CourseRecord = { "guideId": GuideId; "guideVersion": GuideVersion; "guideRevision": U64; "status": GuideStatus; "steps": ReadonlyArray<StepRecord>; "lastStepId": StepId | null; "binding": Binding; };
export type ActiveRun = { "runId": UUID; "guideId": GuideId; "guideVersion": GuideVersion; "stepId": StepId; "workspaceId": UUID; "displayState": "running" | "suspended"; "blockedReason": string | null; };
export type Preferences = { "autoHints": boolean; "showLearningProgress": boolean; "suppressedHintIds": ReadonlyArray<HintId>; };
export type ProfileSnapshot = { "serviceInstanceId": UUID; "profileSchemaVersion": 1; "profileRevision": U64; "persistedRevision": U64 | null; "persistenceState": PersistenceState; "availability": ProfileAvailability; "lastWriteError": string | null; "welcomeHandled": boolean; "preferences": Preferences; "courses": ReadonlyArray<CourseRecord>; "activeRun": ActiveRun | null; };
export type Error = { "code": "INVALID_MESSAGE" | "UNSUPPORTED_PROTOCOL" | "PERMISSION_DENIED" | "SERVICE_RESTARTED" | "PROFILE_CONFLICT" | "GUIDE_CONFLICT" | "GUIDE_RUN_INVALID" | "GUIDE_STEP_INVALID" | "GUIDE_NOT_FOUND" | "PROFILE_WRITE_FAILED" | "PROFILE_READ_ONLY" | "PROFILE_LIMIT" | "COURSE_UNAVAILABLE" | "MISSING_CAPABILITY" | "TARGET_UNAVAILABLE" | "IDEMPOTENCY_CONFLICT" | "STATE_NOT_READY" | "INTERNAL_ERROR"; "messageKey": string; "retryable": boolean; "snapshot"?: ProfileSnapshot; };
export type MutationReceipt = { "commandId": UUID; "appliedInSession": true; "profile": ProfileSnapshot; };
export type GuideAction = { "kind": "welcome.dismiss"; } | { "kind": "start"; } | { "kind": "resume"; } | { "kind": "replay"; } | { "kind": "select_step"; "runId": UUID; "stepId": StepId; } | { "kind": "acknowledge"; "runId": UUID; "stepId": StepId; } | { "kind": "skip_step"; "runId": UUID; "stepId": StepId; } | { "kind": "end"; "runId": UUID; };
export type Event = { "seq": U64; "kind": "profile.changed" | "profile.persisted" | "profile.write_failed" | "guide.changed" | "guide.blocked" | "guide.ended"; "profileRevision": U64; "guideId"?: GuideId; "runId"?: UUID; "errorCode"?: string; };
export type Method = "ux.describe" | "ux.snapshot" | "ux.preferences.update" | "ux.guide.intent" | "ux.preferences.reset" | "ux.events.read";
export type ux_describe_Params = {  };
export type ux_describe_Result = { "uxProtocol": "1.0"; "serviceInstanceId": UUID; "adapterKind": "tauri-local" | "browser-real-local" | "mock"; "profileSchemaVersion": 1; "guideCatalogHash": string | null; "availableGuides": ReadonlyArray<{ "guideId": GuideId; "guideVersion": GuideVersion; "available": boolean; "missingCapabilities": ReadonlyArray<string>; }>; "implementedMethods": ReadonlyArray<Method>; "limits": Limits; };
export type ux_snapshot_Params = { "serviceInstanceId": UUID; };
export type ux_snapshot_Result = ProfileSnapshot;
export type ux_preferences_update_Params = { "serviceInstanceId": UUID; "commandId": UUID; "expectedProfileRevision": U64; "changes": { "autoHints"?: boolean; "showLearningProgress"?: boolean; "hintSuppression"?: { "hintId": HintId; "suppressed": boolean; }; }; };
export type ux_preferences_update_Result = MutationReceipt;
export type ux_guide_intent_Params = { "serviceInstanceId": UUID; "commandId": UUID; "guideId": GuideId; "guideVersion": GuideVersion; "expectedGuideRevision": U64; "action": GuideAction; };
export type ux_guide_intent_Result = MutationReceipt;
export type ux_preferences_reset_Params = { "serviceInstanceId": UUID; "commandId": UUID; "expectedProfileRevision": U64; "scope": { "kind": "one-course"; "guideId": GuideId; "guideVersion": GuideVersion; } | { "kind": "all-guide-records"; }; "resetHintPreferences": boolean; };
export type ux_preferences_reset_Result = MutationReceipt;
export type ux_events_read_Params = { "serviceInstanceId": UUID; "afterSeq": U64; "limit": number; };
export type ux_events_read_Result = { "serviceInstanceId": UUID; "nextSeq": U64; "gap": boolean; "events": ReadonlyArray<Event>; };
export interface UXMethodMap {
  "ux.describe": { params: ux_describe_Params; result: ux_describe_Result; };
  "ux.snapshot": { params: ux_snapshot_Params; result: ux_snapshot_Result; };
  "ux.preferences.update": { params: ux_preferences_update_Params; result: ux_preferences_update_Result; };
  "ux.guide.intent": { params: ux_guide_intent_Params; result: ux_guide_intent_Result; };
  "ux.preferences.reset": { params: ux_preferences_reset_Params; result: ux_preferences_reset_Result; };
  "ux.events.read": { params: ux_events_read_Params; result: ux_events_read_Result; };
}
export type UXRequest<M extends keyof UXMethodMap = keyof UXMethodMap> = { [K in M]: { uxProtocol: "1.0"; callId: UUID; method: K; params: UXMethodMap[K]["params"]; } }[M];
export type UXResponse<M extends keyof UXMethodMap = keyof UXMethodMap> = { [K in M]: { uxProtocol: "1.0"; callId: UUID; method: K; ok: true; result: UXMethodMap[K]["result"]; } | { uxProtocol: "1.0"; callId: UUID; method: K; ok: false; error: Error; } }[M];
export interface EditorUXPort { dispatch<M extends keyof UXMethodMap>(request: UXRequest<M>): Promise<UXResponse<M>>; }
