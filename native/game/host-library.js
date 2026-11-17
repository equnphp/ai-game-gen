// Emscripten仅导入复制后的有界消息；异步Host逻辑不得保存线性内存指针或重入Module。
addToLibrary({
  gg_host_bridge: function(pointer, bytes) {
    if (bytes <= 0 || bytes > 2097152 || typeof Module.ggHostBridge !== 'function') {
      abort('GAME_HOST_BRIDGE_UNAVAILABLE');
    }
    var copy = HEAPU8.slice(pointer, pointer + bytes);
    Module.ggHostBridge(copy);
  }
});
