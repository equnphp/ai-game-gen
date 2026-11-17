/* 原型和检查工具使用各自运行环境；保留推荐规则以检查未定义变量与不可达代码。 */
"use strict";
const js = require("@eslint/js");

module.exports = [
  js.configs.recommended,
  {
    files: ["i18n.js", "locales/*.js", "app.js", "studio.js", "workflow.js", "creation.js", "effects-preview.js", "gameplay.js", "networking.js", "isometric.js", "assistant-setup.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        navigator: "readonly", MutationObserver: "readonly", NodeFilter: "readonly", window: "readonly", document: "readonly", location: "readonly", history: "readonly",
        localStorage: "readonly", Date: "readonly", performance: "readonly", requestAnimationFrame: "readonly", cancelAnimationFrame: "readonly",
        innerWidth: "readonly", URLSearchParams: "readonly", Event: "readonly",
        setTimeout: "readonly", clearTimeout: "readonly",
      },
    },
  },
  {
    files: ["tools/*.cjs", "eslint.config.cjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        require: "readonly", module: "readonly", process: "readonly", Buffer: "readonly",
        console: "readonly", fetch: "readonly", WebSocket: "readonly", URLSearchParams: "readonly",
        setTimeout: "readonly", clearTimeout: "readonly",
      },
    },
  },
];
