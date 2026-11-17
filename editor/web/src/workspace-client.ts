// 工作区恢复只查询原commandId；传输失败后不换ID再次打开第二个Core会话。
import { invoke,isTauri } from '@tauri-apps/api/core';
import type {WorkspaceMethodMap,WorkspaceResponse,WorkspaceOpenOperation,WorkspaceError} from '../../host-contract/workspace-port';
export type OpenIntent=Omit<WorkspaceMethodMap['workspace.open.start']['params'],'serviceInstanceId'|'commandId'|'requiredCapabilities'>;
export type WorkspaceDescription=WorkspaceMethodMap['workspace.describe']['result'];
type PendingOpen={commandId:string;operationId:string|null};
const pendingKey='gamegen.workspace-open.1';
const uuid=(s:unknown):s is string=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(s);
export class WorkspaceFailure extends Error {constructor(readonly detail:WorkspaceError){super(detail.code);}}
export class WorkspaceClient {
  private description:WorkspaceDescription|null=null;
  private describing:Promise<WorkspaceDescription>|null=null;
  async call<M extends keyof WorkspaceMethodMap>(method:M,params:WorkspaceMethodMap[M]['params']):Promise<WorkspaceMethodMap[M]['result']>{
    if(!isTauri())throw new Error('NATIVE_HOST_REQUIRED');
    const callId=crypto.randomUUID(),request={workspaceProtocol:'1.0',callId,method,params};
    if(new TextEncoder().encode(JSON.stringify(request)).length>65536)throw new Error('LIMIT_EXCEEDED');
    const response=await invoke<WorkspaceResponse<M>>('workspace_dispatch',{request});
    if(response.workspaceProtocol!=='1.0'||response.callId!==callId||response.method!==method||typeof response.ok!=='boolean'||new TextEncoder().encode(JSON.stringify(response)).length>524288)throw new Error('WORKSPACE_CONTRACT_VIOLATION');
    if(!response.ok)throw new WorkspaceFailure(response.error);return response.result as WorkspaceMethodMap[M]['result'];
  }
  async initialize(refresh=false):Promise<WorkspaceDescription>{
    if(this.describing)return this.describing;if(this.description&&!refresh)return this.description;
    this.describing=this.call('workspace.describe',{}).then(description=>{
      if(description.adapterKind!=='tauri_native'||!uuid(description.serviceInstanceId))throw new Error('WORKSPACE_CONTRACT_VIOLATION');
      this.description=description;return description;
    }).finally(()=>{this.describing=null;});return this.describing;
  }
  pending():PendingOpen|null {
    const raw=sessionStorage.getItem(pendingKey);if(raw===null)return null;
    try {const v=JSON.parse(raw);if(Object.keys(v).length!==2||!uuid(v.commandId)||v.operationId!==null&&!uuid(v.operationId))throw new Error();return v;}
    catch {throw new Error('WORKSPACE_RECOVERY_INVALID');}
  }
  acknowledge(){sessionStorage.removeItem(pendingKey);}
  async begin(intent:OpenIntent):Promise<string>{
    if(this.pending())throw new Error('WORKSPACE_RESULT_UNKNOWN');
    const description=await this.initialize();const pending:PendingOpen={commandId:crypto.randomUUID(),operationId:null};
    // 存储中只有查询身份，没有sessionToken、grant、绝对路径或伪造Core回执。
    sessionStorage.setItem(pendingKey,JSON.stringify(pending));
    try {
      const accepted=await this.call('workspace.open.start',{...intent,serviceInstanceId:description.serviceInstanceId,commandId:pending.commandId,requiredCapabilities:['core.project_store','core.scene_documents']});
      pending.operationId=accepted.operationId;sessionStorage.setItem(pendingKey,JSON.stringify(pending));return accepted.operationId;
    }catch(error){if(error instanceof WorkspaceFailure&&error.detail.outcome==='not_submitted')this.acknowledge();throw error;}
  }
  async recover():Promise<string>{
    const pending=this.pending();if(!pending)throw new Error('OPERATION_NOT_FOUND');const description=await this.initialize(true);
    if(pending.operationId)return pending.operationId;
    const found=await this.call('workspace.request.lookup',{serviceInstanceId:description.serviceInstanceId,commandId:pending.commandId});
    if(!found.found||!found.record?.operationId)throw new Error('WORKSPACE_RESULT_UNKNOWN');
    pending.operationId=found.record.operationId;sessionStorage.setItem(pendingKey,JSON.stringify(pending));return pending.operationId;
  }
  async wait(operationId:string,onProgress:(operation:WorkspaceOpenOperation)=>void):Promise<WorkspaceOpenOperation>{
    const description=await this.initialize();const start=performance.now();
    for(;;){
      const {operation}=await this.call('workspace.operation.read',{serviceInstanceId:description.serviceInstanceId,operationId});onProgress(operation);
      if(['READY','FAILED','CANCELLED','UNKNOWN'].includes(operation.state))return operation;
      if(performance.now()-start>120000)throw new Error('WORKSPACE_RESULT_UNKNOWN');await new Promise<void>(resolve=>setTimeout(resolve,100));
    }
  }
  async cancel(operationId:string){const d=await this.initialize();return this.call('workspace.operation.cancel',{serviceInstanceId:d.serviceInstanceId,commandId:crypto.randomUUID(),operationId});}
}
