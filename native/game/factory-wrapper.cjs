// 静态打包边界：glue只看到显式facade，不修改真实globalThis，也不使用eval。
'use strict';
module.exports = function createGameGenRuntime(safeGlobal, options) {
  if (!safeGlobal || typeof safeGlobal.crypto?.getRandomValues !== 'function' || typeof safeGlobal.performance?.now !== 'function' ||
      typeof options?.instantiateWasm !== 'function' || typeof options?.ggHostBridge !== 'function') {
    return Promise.reject(new Error('GAME_HOST_CAPABILITY_MISSING'));
  }
  const facade = Object.freeze({
    window: Object.freeze({}),
    crypto: Object.freeze({ getRandomValues: view => safeGlobal.crypto.getRandomValues(view) }),
    performance: Object.freeze({ now: () => safeGlobal.performance.now() }),
    WebAssembly: safeGlobal.WebAssembly,
    console: safeGlobal.console,
    setTimeout: safeGlobal.setTimeout,
    clearTimeout: safeGlobal.clearTimeout,
    // 构造器与静态glue处在同一realm；不从别的窗口借用数组构造器。
    ArrayBuffer, DataView, Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array,
    Int32Array, Uint32Array, Float32Array, Float64Array,
    TextDecoder: typeof TextDecoder === 'function' ? TextDecoder : undefined,
    TextEncoder: typeof TextEncoder === 'function' ? TextEncoder : undefined,
    Promise, Object, Array, Math, Number, String, Boolean, JSON, Error, TypeError, RangeError,
    Map, Set, Symbol, Reflect, RegExp
  });
  const globalThis = facade;
  const window = facade.window;
  const document = undefined;
  const process = undefined;
  const os = undefined;
  const self = facade;
  const crypto = facade.crypto;
  const WebAssembly = facade.WebAssembly;
  const performance = facade.performance;
  const console = facade.console;
  const setTimeout = facade.setTimeout;
  const clearTimeout = facade.clearTimeout;
  const module = undefined;
  const exports = undefined;
  const require = undefined;
  const fetch = () => { throw new Error('GAME_NETWORK_FALLBACK_FORBIDDEN'); };
  const XMLHttpRequest = undefined;
  // @GAMEGEN_GENERATED_GLUE@
  return GameGenRuntimeFactory(options);
};
