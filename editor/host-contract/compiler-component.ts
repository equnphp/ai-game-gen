// 独立只读组件端口不借用Core会话；浏览器原型缺少native时明确报告未安装。
import {invoke} from '@tauri-apps/api/core';
import type {CompilerComponentPort,CompilerComponentRead,CompilerComponentReply} from './compiler-component-port';
import {nativeHostAvailable} from './tauri';
export class TauriCompilerComponents implements CompilerComponentPort {
  async invoke(request:CompilerComponentRead):Promise<CompilerComponentReply>{
    if(!nativeHostAvailable())return {protocolVersion:'1.0',requestId:request.requestId,ok:false,error:{code:'COMPONENT_UNAVAILABLE',messageKey:'compiler.COMPONENT_UNAVAILABLE',retryable:false}};
    const reply=await invoke<CompilerComponentReply>('compiler_component_rpc',{request});
    if(reply?.protocolVersion!=='1.0'||reply.requestId!==request.requestId||typeof reply.ok!=='boolean')throw new Error('COMPONENT_INTEGRITY_ERROR');
    if(reply.ok&&(!/^gg-compiler-1-[0-9a-f]{64}$/.test(reply.data.compilerBuild)||reply.data.integrityState!=='bound_to_installed_files'||!Array.isArray(reply.data.runtimeProfiles)||reply.data.runtimeProfiles.length<1||reply.data.runtimeProfiles.length>16))throw new Error('COMPONENT_INTEGRITY_ERROR');
    return reply;
  }
}
