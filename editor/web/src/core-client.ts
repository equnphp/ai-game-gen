// 会话跨语言切换保留；保存/超时/取消分别表达，重试原请求必须复用原字节。
import type { EditorHostPort, HostMethodMap, HostRequest, TaskTicket, SessionToken } from "../../host-contract/editor-host";
import { encodeJSON, decodeJSON, decodeBytes, type Bytes } from "../../host-contract/codec";
export type CoreResult<T = Record<string, unknown>> = {
  ok: boolean; requestId: string; op: string; data: T | null;
  error: { code: string; messageKey: string; retryable: boolean } | null;
};
export type CoreTaskResult<T> = CoreResult<T> & {binary:Uint8Array|null};
export type ModelRegistration={kind:string;schemaVersion:number;status:string;runtimeProfiles:string[];writerProfiles:string[]};
export class CoreFailure extends Error {
  constructor(readonly response: CoreResult) { super(response.error?.code ?? "CORE_ERROR"); }
}
export class CoreClient {
  session: SessionToken | null = null;
  protocolVersion:'1.0'|'1.1'='1.0';
  schemaCatalogHash:string|null=null;
  readonly models=new Map<string,ModelRegistration>();
  private negotiated=false;
  readonly pending = new Map<string, { ticket: TaskTicket; original: Uint8Array | null }>();
  constructor(readonly host: EditorHostPort) {}
  async call<M extends keyof HostMethodMap>(method: M, params: HostMethodMap[M]["params"],
      callId: string = crypto.randomUUID()): Promise<HostMethodMap[M]["result"]> {
    const request = { protocol:"1.0",callId,method,params } as HostRequest<M>;
    const response = await this.host.dispatch(request);
    if (!response.ok) throw Object.assign(new Error(response.error.code), { detail:response.error });
    return response.result as HostMethodMap[M]["result"];
  }
  async open(grantRef: string): Promise<void> {
    const result = await this.call("session.open", { grantRef,requiredCapabilities:["core.project_store","core.scene_documents"] });
    this.session = result.sessionToken;
    await this.negotiateModels();
  }
  async negotiateModels():Promise<void> {
    if(this.negotiated)return;
    // 新协议只通过真实只读目录探测协商，旧核心明确拒绝后才保留M1模式。
    try {
      const registrations=new Map<string,ModelRegistration>();let after:string|null=null;let catalog:string|null=null;
      do {
        const request={protocolVersion:'1.1',requestId:crypto.randomUUID(),op:'schema.catalog.list',params:{after,limit:100}};
        const result:CoreResult<{schemaCatalogHash:string;items:ModelRegistration[];nextAfter:string|null}>=await this.submit(request);
        if(!result.data || !/^sha256:[0-9a-f]{64}$/.test(result.data.schemaCatalogHash) || !Array.isArray(result.data.items))throw new Error('CORE_CONTRACT_VIOLATION');
        if(catalog!==null && catalog!==result.data.schemaCatalogHash)throw new Error('MODEL_CATALOG_CHANGED');catalog=result.data.schemaCatalogHash;
        for(const item of result.data.items){
          if(typeof item.kind!=='string' || !Number.isInteger(item.schemaVersion) || item.status!=='implemented')throw new Error('CORE_CONTRACT_VIOLATION');
          const key=item.kind+'@'+item.schemaVersion;if(registrations.has(key))throw new Error('CORE_CONTRACT_VIOLATION');registrations.set(key,item);
        }
        if(registrations.size>1024 || result.data.nextAfter!==null && typeof result.data.nextAfter!=='string')throw new Error('MODEL_CATALOG_INCOMPLETE');
        if(result.data.nextAfter===after && after!==null)throw new Error('CORE_CONTRACT_VIOLATION');after=result.data.nextAfter;
      }while(after!==null);
      this.models.clear();for(const [key,item] of registrations)this.models.set(key,item);
      this.schemaCatalogHash=catalog;this.protocolVersion='1.1';this.negotiated=true;
    }catch(error) {
      if(error instanceof CoreFailure && ['INVALID_MESSAGE','PROTOCOL_VERSION_UNSUPPORTED','UNSUPPORTED_SCHEMA'].includes(error.response.error?.code??'')) {
        this.protocolVersion='1.0';this.negotiated=true;return;
      }
      throw error;
    }
  }
  async wait<T>(ticket: TaskTicket, original: Bytes | null = null, signal?: AbortSignal): Promise<CoreTaskResult<T>> {
    if (!this.session) throw new Error("SESSION_INVALID");
    this.pending.set(ticket.taskRef, { ticket,original:original ? decodeBytes(original) : null });
    const started = performance.now();
    let terminal = false, received = false;
    try {
      for (;;) {
        if (signal?.aborted || performance.now() - started > 30000)
          throw Object.assign(new Error("RESULT_UNKNOWN"), { ticket,requestUtf8:original });
        let status;
        try { status = await this.call("task.status", { sessionToken:this.session,taskRef:ticket.taskRef }); }
        catch (error) { throw Object.assign(new Error("RESULT_UNKNOWN"), { ticket,requestUtf8:original,cause:error }); }
        terminal = ["SUCCEEDED","FAILED","CANCELLED"].includes(status.state);
        if (terminal) {
          let result;
          try { result = await this.call("task.result", { sessionToken:this.session,taskRef:ticket.taskRef }); }
          catch(error){
            // BUSY/NOT_READY是明确的槽背压，等待原任务即可，不重发领域请求。
            if(["BUSY","NOT_READY"].includes((error as Error).message)){await new Promise<void>(resolve=>setTimeout(resolve,30));continue;}
            throw Object.assign(new Error("RESULT_UNKNOWN"),{ticket,requestUtf8:original,cause:error});
          }
          const value = decodeJSON<CoreResult<T>>(result.coreResultUtf8);
          const binary=result.binary===null?null:decodeBytes(result.binary,1048576);received=true;
          if (!value.ok) throw new CoreFailure(value as CoreResult);
          return {...value,binary};
        }
        // 计时器仅节流；成功始终由真实终态与结果决定。
        await new Promise<void>(resolve => setTimeout(resolve, 30));
      }
    } finally {
      if (received) {
        try { await this.call("task.release", { sessionToken:this.session,taskRef:ticket.taskRef });
          this.pending.delete(ticket.taskRef);
        } catch { /* 已知业务收据保留；清理失败留在真实任务清单供后续释放，不改报提交失败。 */ }
      }
    }
  }
  async submit<T = Record<string,unknown>>(request: Record<string,unknown>): Promise<CoreResult<T>> {
    if (!this.session) throw new Error("SESSION_INVALID");
    if(this.pending.size>=32){
      const actual=await this.call("session.state",{sessionToken:this.session});
      const retained=new Set(actual.tasks.map(task=>task.taskRef));
      for(const key of this.pending.keys())if(!retained.has(key))this.pending.delete(key);
      if(this.pending.size>=32)throw new Error("QUEUE_FULL");
    }
    const payload = encodeJSON(request), originCallId = crypto.randomUUID();
    let ticket: TaskTicket;
    try {
      ticket = await this.call("core.submit", { sessionToken:this.session,requestUtf8:payload }, originCallId);
    } catch (error) {
      if ((error as {detail?:{outcome?:string}}).detail?.outcome === "not_submitted") throw error;
      throw Object.assign(new Error("RESULT_UNKNOWN"), { originCallId,requestUtf8:payload,
        coreRequestId:request.requestId,projectId:request.projectId ?? (request.params as {projectId?:string})?.projectId,cause:error });
    }
    return this.wait<T>(ticket,payload);
  }
  async readBlobChunk(contentHash:string,offset:number,maxBytes:number):Promise<Uint8Array>{
    if(!this.session)throw new Error("SESSION_INVALID");
    const ticket=await this.call("blob.read",{sessionToken:this.session,contentHash,offset:String(offset),maxBytes});
    const response=await this.wait<{offset:string;byteLength:string;contentHash:string;eof:boolean}>(ticket);
    if(!response.binary || response.data?.offset!==String(offset)||response.data.contentHash!==contentHash||
      Number(response.data.byteLength)!==response.binary.length||response.binary.length>maxBytes)throw new Error("CORE_CONTRACT_VIOLATION");
    return response.binary;
  }
  async confirm(unknown: { ticket?:TaskTicket;originCallId?:string;coreRequestId?:string;projectId?:string;requestUtf8?:Bytes }): Promise<CoreResult> {
    if (!this.session) throw new Error("SESSION_INVALID");
    let ticket = unknown.ticket;
    if (!ticket && unknown.originCallId) {
      const session = await this.call("session.state", { sessionToken:this.session });
      ticket = session.tasks.find(item => item.originCallId === unknown.originCallId);
    }
    if (ticket) return this.wait(ticket,unknown.requestUtf8 ?? null);
    if (unknown.coreRequestId && unknown.projectId) {
      const lookup = await this.submit<{status:string;result:CoreResult}>(this.request("request.lookup",
        {targetRequestId:unknown.coreRequestId},unknown.projectId));
      if (lookup.data?.status === "SUCCEEDED") return lookup.data.result;
    }
    throw new Error("RESULT_UNKNOWN");
  }
  request(op: string, params: unknown, projectId?: string, expectedRevision?: string): Record<string,unknown> {
    return { protocolVersion:this.protocolVersion,requestId:crypto.randomUUID(),op,params,
      ...(projectId ? {projectId} : {}),...(expectedRevision !== undefined ? {expectedRevision} : {}) };
  }
  async edit(projectId: string,revision: string,operations: unknown[]): Promise<{revision:string;snapshotId:string;durable:boolean}> {
    const proposal = await this.submit<{proposalId:string;proposalHash:string}>(
      this.request("document.propose", {operations},projectId,revision));
    const validated = await this.submit<{validatedHash:string}>(
      this.request("document.validate", {proposalId:proposal.data!.proposalId,proposalHash:proposal.data!.proposalHash},projectId));
    const committed = await this.submit<{revision:string;snapshotId:string;durable:boolean}>(
      this.request("document.commit", {proposalId:proposal.data!.proposalId,validatedHash:validated.data!.validatedHash},projectId,revision));
    if (committed.data?.durable !== true) throw new Error("CORE_CONTRACT_VIOLATION");
    return committed.data;
  }
  async close(): Promise<void> {
    if (!this.session) return;
    await this.call("session.close", {sessionToken:this.session,mode:"drain",deadlineMs:30000});
    this.session = null; this.pending.clear();this.protocolVersion='1.0';this.schemaCatalogHash=null;this.models.clear();this.negotiated=false;
  }
}
