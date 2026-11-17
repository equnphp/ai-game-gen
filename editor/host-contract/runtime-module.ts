// 游戏模块只获准读取当前产物；本适配器不包含Core、文件选择器或编辑器会话凭据。
import { decodeBytes, type Bytes } from './codec';

export type RuntimeReply = { protocolVersion:'1.0'|'1.1'; requestId:string; ok:boolean;
  data?:Record<string,unknown>; error?:{code:string;messageKey:string;outcome:string;retryable:boolean} };
export type RuntimeRequest = {protocolVersion:'1.0'|'1.1';requestId:string;method:string;params:Record<string,unknown>};
export type ResourceRequest = {protocolVersion:'1.0';epoch:string;runtimeId:string;requestId:string;method:'resource.read';
  params:{artifactId:string;resourceKind:'manifest'|'block';hash:string;offset:string;maxBytes:number}};
export type ResourceChunk = Bytes & {offset:string;eof:boolean};
export interface GameModule {
  HEAPU8:Uint8Array;
  _gg_game_abi_version():number;
  _gg_game_alloc(bytes:number):number;
  _gg_game_free(pointer:number):void;
  _gg_game_submit(pointer:number,bytes:number):number;
  _gg_game_result_size():number;
  _gg_game_result_copy(pointer:number,capacity:number):number;
  _gg_game_result_release():void;
  _gg_game_complete(pointer:number,bytes:number):number;
  _gg_game_pump(low:number,high:number,now:number,maximum:number):number;
  _gg_game_pump_flags():number;
  _gg_game_lifecycle(event:number,now:number):number;
}
export interface RuntimePlatform {
  crypto:{getRandomValues<T extends ArrayBufferView>(view:T):T};
  performance:{now():number};
  WebAssembly:unknown;
  console:Pick<Console,'log'|'warn'|'error'>;
  setTimeout:typeof setTimeout;
  clearTimeout:typeof clearTimeout;
  defer(action:()=>void):void;
  sha256(bytes:Uint8Array):Promise<string>;
  instantiate(bytes:Uint8Array,imports:WebAssembly.Imports):Promise<WebAssembly.Instance>;
}
export type GameFactory = (facade:RuntimePlatform,options:{instantiateWasm(imports:WebAssembly.Imports,
  receive:(instance:WebAssembly.Instance)=>void):object;onAbort(reason:unknown):void;ggHostBridge(bytes:Uint8Array):void;
  print(message:string):void;printErr(message:string):void;locateFile(name:string):string})=>Promise<GameModule>;
export type RuntimePair = {abi:'1.1';profileId:string;profileHash:string;runtimeBuild:string;wasmHash:string};
const uuid = (value:unknown):value is string => typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const digest = (value:unknown):value is string => typeof value==='string' && /^sha256:[0-9a-f]{64}$/.test(value);
const u64 = (value:unknown):value is string => typeof value==='string' && /^(0|[1-9][0-9]*)$/.test(value) &&
  (value.length<20 || value.length===20 && value<='18446744073709551615');
const decoder = new TextDecoder('utf-8',{fatal:true});
const encoder = new TextEncoder();

export class WasmRuntimeModule {
  private module:GameModule|null=null;
  private alive=true;
  private generation=1;
  private callback=false;
  private frameLow=0;
  private frameHigh=0;
  private frameExhausted=false;
  private queued:{id:string;bytes:Uint8Array}[]=[];
  private queuedBytes=0;
  private queuedIds=new Set<string>();
  private readonly controller=new AbortController();
  private constructor(readonly platform:RuntimePlatform,readonly pair:RuntimePair,
    private readonly provider:(request:ResourceRequest,signal:AbortSignal)=>Promise<ResourceChunk>,
    private readonly onFailure:(error:Error)=>void) {}

  static async open(factory:GameFactory,platform:RuntimePlatform,pair:RuntimePair,wasm:Uint8Array,
    provider:(request:ResourceRequest,signal:AbortSignal)=>Promise<ResourceChunk>,onFailure:(error:Error)=>void,
    signal?:AbortSignal):Promise<WasmRuntimeModule> {
    if(pair.abi!=='1.1' || !digest(pair.profileHash) || !digest(pair.wasmHash) || !wasm.length || wasm.length>67108864)
      throw new Error('RUNTIME_PAIR_INVALID');
    if(await platform.sha256(wasm)!==pair.wasmHash)throw new Error('RUNTIME_PAIR_HASH_MISMATCH');
    if(signal?.aborted)throw new Error('CANCELLED');
    const runtime=new WasmRuntimeModule(platform,pair,provider,onFailure);const generation=runtime.generation;
    let rejectStartup:(reason:Error)=>void=()=>{};
    const failed=new Promise<never>((_,reject)=>{rejectStartup=reject;});
    const timer=platform.setTimeout(()=>rejectStartup(new Error('WASM_STARTUP_TIMEOUT')),30000);
    const cancelled=()=>rejectStartup(new Error('CANCELLED'));signal?.addEventListener('abort',cancelled,{once:true});
    try {
      const loaded=factory(platform,{
        instantiateWasm(imports,receive) {
          // 同版glue产生完整imports；失败通过外层Promise收束，迟到结果不得恢复generation。
          platform.instantiate(wasm,imports).then(instance=>{
            if(runtime.alive && runtime.generation===generation)receive(instance);
          }).catch(error=>rejectStartup(error instanceof Error?error:new Error('WASM_INSTANTIATE_FAILED')));
          return {};
        },
        onAbort(reason) {const error=new Error('WASM_ABORT',{cause:reason});rejectStartup(error);runtime.fatal(error);},
        ggHostBridge(bytes) {
          runtime.callback=true;
          try {
            if(!(bytes instanceof Uint8Array) || bytes.length>2097152)throw new Error('RUNTIME_HOST_MESSAGE_INVALID');
            const copy=bytes.slice();platform.defer(()=>{if(runtime.alive)void runtime.hostMessage(copy);});
          } catch(error){platform.defer(()=>runtime.fatal(error instanceof Error?error:new Error('RUNTIME_HOST_MESSAGE_INVALID')));}
          finally{runtime.callback=false;}
        },
        print:message=>platform.console.log(message),printErr:message=>platform.console.error(message),
        locateFile:()=>{throw new Error('RUNTIME_NETWORK_FALLBACK_FORBIDDEN');}
      });
      const module=await Promise.race([loaded,failed]);
      if(!runtime.alive || runtime.generation!==generation || module._gg_game_abi_version()!==0x10001)throw new Error('RUNTIME_ABI_MISMATCH');
      runtime.module=module;return runtime;
    } catch(error) {runtime.close();throw error;}
    finally{platform.clearTimeout(timer);signal?.removeEventListener('abort',cancelled);}
  }

  private current():GameModule {
    if(!this.alive || !this.module)throw new Error('RUNTIME_LOST');
    if(this.callback)throw new Error('RUNTIME_REENTRANT');return this.module;
  }
  private transfer(bytes:Uint8Array,call:(module:GameModule,pointer:number)=>number):number {
    const module=this.current();if(!bytes.length || bytes.length>2097152)throw new Error('LIMIT_EXCEEDED');
    const pointer=module._gg_game_alloc(bytes.length);if(!pointer)throw new Error('RUNTIME_MEMORY_LIMIT');
    try {module.HEAPU8.set(bytes,pointer);return call(module,pointer);}
    finally{module._gg_game_free(pointer);}
  }
  rpc(request:RuntimeRequest):RuntimeReply {
    if(!uuid(request.requestId))throw new Error('INVALID_REQUEST_ID');
    try {
      const module=this.current();const bytes=encoder.encode(JSON.stringify(request));
      const status=this.transfer(bytes,(module,pointer)=>module._gg_game_submit(pointer,bytes.length));
      if(status!==0)throw new Error(`RUNTIME_SUBMIT_${status}`);
      let pointer=0;
      try {
        const size=module._gg_game_result_size();if(!Number.isInteger(size) || size<1 || size>8388608)throw new Error('RUNTIME_RESULT_INVALID');
        pointer=module._gg_game_alloc(size);if(!pointer)throw new Error('RUNTIME_MEMORY_LIMIT');
        if(module._gg_game_result_copy(pointer,size)!==size)throw new Error('RUNTIME_RESULT_INVALID');
        // 分配后可能已增长内存，始终从Module重新取得HEAPU8并复制到宿主所有权。
        const reply=JSON.parse(decoder.decode(module.HEAPU8.slice(pointer,pointer+size))) as RuntimeReply;
        if(reply.requestId!==request.requestId || reply.protocolVersion!==request.protocolVersion || typeof reply.ok!=='boolean')throw new Error('RUNTIME_REPLY_MISMATCH');
        return reply;
      } finally {if(pointer)module._gg_game_free(pointer);module._gg_game_result_release();}
    } catch(error){this.fatal(error instanceof Error?error:new Error('RUNTIME_LOST'));throw error;}
  }
  pump(now:number,maximum=5):{completedTicks:number;flags:number} {
    if(!Number.isFinite(now) || now<0 || !Number.isInteger(maximum) || maximum<0 || maximum>5)throw new Error('INVALID_FRAME_TIME');
    try {
      this.flushCompletions();const module=this.current();if(this.frameExhausted)throw new Error('RUNTIME_FRAME_EXHAUSTED');
      const completed=module._gg_game_pump(this.frameLow,this.frameHigh,now,maximum);
      if(completed<0)throw new Error(`RUNTIME_PUMP_${completed}`);
      if(this.frameLow===0xffffffff){this.frameLow=0;if(this.frameHigh===0xffffffff)this.frameExhausted=true;else this.frameHigh++;}else this.frameLow++;
      return {completedTicks:completed,flags:module._gg_game_pump_flags()};
    } catch(error){this.fatal(error instanceof Error?error:new Error('RUNTIME_LOST'));throw error;}
  }
  lifecycle(event:1|2|3,now:number):void {
    const status=this.current()._gg_game_lifecycle(event,now);if(status!==0){const error=new Error(`RUNTIME_LIFECYCLE_${status}`);this.fatal(error);throw error;}
  }
  private async hostMessage(bytes:Uint8Array):Promise<void> {
    const generation=this.generation;
    try {
      const request=JSON.parse(decoder.decode(bytes)) as ResourceRequest;
      if(request.protocolVersion!=='1.0' || request.method!=='resource.read' || !uuid(request.epoch) || !uuid(request.runtimeId) || !uuid(request.requestId) ||
          !uuid(request.params?.artifactId) || !digest(request.params.hash) || !u64(request.params.offset) ||
          !['manifest','block'].includes(request.params.resourceKind) || !Number.isInteger(request.params.maxBytes) || request.params.maxBytes<1 || request.params.maxBytes>1048576)
        throw new Error('RUNTIME_HOST_MESSAGE_INVALID');
      let reply:Record<string,unknown>;
      try {
        const chunk=await this.provider(request,this.controller.signal);decodeBytes(chunk,request.params.maxBytes);
        if(chunk.offset!==request.params.offset || typeof chunk.eof!=='boolean')throw new Error('RESOURCE_RESULT_INVALID');
        reply={protocolVersion:'1.0',epoch:request.epoch,runtimeId:request.runtimeId,requestId:request.requestId,ok:true,
          data:{offset:chunk.offset,decodedBytes:chunk.decodedBytes,base64:chunk.base64,eof:chunk.eof}};
      } catch(error) {
        reply={protocolVersion:'1.0',epoch:request.epoch,runtimeId:request.runtimeId,requestId:request.requestId,ok:false,
          error:{code:'RESOURCE_IO_FAILED',messageKey:'runtime.RESOURCE_IO_FAILED',retryable:false}};
      }
      if(!this.alive || this.generation!==generation)return;const encoded=encoder.encode(JSON.stringify(reply));
      if(encoded.length>2097152 || this.queued.length>=256 || this.queuedBytes+encoded.length>8388608)throw new Error('RUNTIME_HOST_QUEUE_FULL');
      if(this.queuedIds.has(request.requestId))throw new Error('RESOURCE_DUPLICATE_COMPLETION');
      this.queued.push({id:request.requestId,bytes:encoded});this.queuedIds.add(request.requestId);this.queuedBytes+=encoded.length;
    }catch(error){if(this.alive && this.generation===generation)this.fatal(error instanceof Error?error:new Error('RUNTIME_HOST_MESSAGE_INVALID'));}
  }
  private flushCompletions():void {
    while(this.queued.length) {
      const packet=this.queued[0];const status=this.transfer(packet.bytes,(module,pointer)=>module._gg_game_complete(pointer,packet.bytes.length));
      if(status===-5)break;
      // stop/dispose后完成包可明确拒绝，不重投到新World。
      if(status!==0 && status!==-1)throw new Error(`RUNTIME_COMPLETE_${status}`);
      this.queued.shift();this.queuedIds.delete(packet.id);this.queuedBytes-=packet.bytes.length;
    }
  }
  private fatal(error:Error):void {if(!this.alive)return;this.close();this.onFailure(error);}
  close():void {
    if(!this.alive)return;this.alive=false;this.generation++;this.controller.abort();this.module=null;
    this.queued=[];this.queuedIds.clear();this.queuedBytes=0;
  }
}
