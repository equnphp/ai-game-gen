/** 仅声明独立只读端口；不授予文件访问/构建/测试权限。 */
export type Sha256 = `sha256:${string}`;
export interface RuntimeSelection {
  runtimeProfileId: string; runtimeProfileHash: Sha256; runtimeBuild: string;
  variant: 'development' | 'release'; runtimeAbi: '1.1';
  runtimePortProtocol: '1.0' | '1.1' | '1.2';
  bundleFormat: 'gg-runtime-bundle-1' | 'gg-runtime-bundle-1.1' | 'gg-runtime-bundle-1.2' | 'gg-runtime-bundle-1.3';
  irVersion: number; irRevision: number;
  runtimePairSha256: Sha256; runtimeJsSha256: Sha256; runtimeWasmSha256: Sha256;
}
export interface CompilerComponent {
  componentGeneration: string; metadataSha256: Sha256; nativeBundleSha256: Sha256;
  artifactLibrarySha256: Sha256; nativeBuildId: string;
  platform: 'windows-x64' | 'windows-arm64' | 'android-arm64-v8a' | 'android-x86_64' | 'linux-x64' | 'macos-arm64' | 'macos-x64';
  compilerBuild: string; compilerBuildInputsHash: Sha256; catalogHash: Sha256;
  runtimeProfiles: RuntimeSelection[]; integrityState: 'bound_to_installed_files';
  declarationKind: 'build_declaration';
}
export interface CompilerComponentRead {
  protocolVersion: '1.0'; requestId: string; method: 'compiler.component.read'; params: Record<string, never>;
}
export type CompilerComponentReply =
  | { protocolVersion: '1.0'; requestId: string; ok: true; data: CompilerComponent }
  | { protocolVersion: '1.0'; requestId: string; ok: false; error: {
      code: 'INVALID_MESSAGE' | 'UNSUPPORTED_PROTOCOL' | 'UNSUPPORTED_METHOD' | 'COMPONENT_UNAVAILABLE' | 'COMPONENT_INTEGRITY_ERROR' | 'COMPONENT_CHANGED' | 'LIMIT_EXCEEDED' | 'TIMEOUT' | 'INTERNAL_ERROR';
      messageKey: string; retryable: boolean;
    } };
export interface CompilerComponentPort {
  /** 由native adapter校核并读构建声明；无Core/source依赖，不是运行验证。 */
  invoke(request: CompilerComponentRead): Promise<CompilerComponentReply>;
}
