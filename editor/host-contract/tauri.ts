// 生产适配器只连接真实宿主；普通浏览器明确不可用，不静默切到mock。
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { EditorHostPort, HostMethodMap, HostRequest, HostResponse } from "./editor-host";
import type { EditorUXPort, UXMethodMap, UXRequest, UXResponse } from "./editor-ux";
export class TauriHost implements EditorHostPort {
  async dispatch<M extends keyof HostMethodMap>(request: HostRequest<M>): Promise<HostResponse<M>> {
    if (!isTauri()) throw new Error("NATIVE_HOST_REQUIRED");
    return invoke<HostResponse<M>>("core_dispatch", { request });
  }
}
export class TauriUX implements EditorUXPort {
  async dispatch<M extends keyof UXMethodMap>(request: UXRequest<M>): Promise<UXResponse<M>> {
    if (!isTauri()) throw new Error("NATIVE_HOST_REQUIRED");
    return invoke<UXResponse<M>>("ux_dispatch", { request });
  }
}
export const nativeHostAvailable = isTauri;
