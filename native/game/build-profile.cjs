// 构建工具只读固定源码闭包与真实取得的工具清单；不加载工程脚本或执行测试。
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const [nativeRoot, profilePath, lockPath, variant, output] = process.argv.slice(2);
if (!nativeRoot || !output || !['development', 'release'].includes(variant)) throw Error('Invalid profile arguments');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value !== null && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
if (lock.version !== '6.0.13' || lock.commit !== 'e13ee988ce3d87a738dd8f3661d02223308c412a' || !lock.archives.length ||
    lock.archives.some(item => !/^[0-9a-f]{64}$/.test(item.sha256) || !Number.isSafeInteger(item.bytes) || item.bytes <= 0)) throw Error('Toolchain acquisition missing');
const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
profile.emscripten.archiveHashes = Object.fromEntries(lock.archives.map(item => [item.file, { bytes: item.bytes, sha256: item.sha256 }]));
profile.emscripten.archiveHashState = 'recorded_actual_acquisition';
const reports = {};
for (const tool of ['emcc', 'clang', 'wasm_opt']) {
  const raw = fs.readFileSync(path.join(path.dirname(output), `${tool}-report.txt`), 'utf8').replaceAll('\r\n', '\n');
  if (lock.tools[tool].split(/\s+/).some(token => !raw.includes(token))) throw Error(`Tool report mismatch: ${tool}`);
  reports[tool] = raw.replace(/^InstalledDir:.*\n?/gm, '').trim();
}
profile.emscripten.toolReports = reports;
delete profile.execution_status;
delete profile.compatibility_verified;
const files = [
  'game/CMakeLists.txt', 'game/abi.cpp', 'game/identity.cpp', 'game/identity.hpp', 'game/game_runtime_v1_1.h',
  'game/host-library.js', 'game/factory-wrapper.cjs', 'game/build-profile.cjs', 'game/wrap-runtime.cjs', 'game/game-exports-1.1.json',
  'cmake/Dependencies.cmake', 'cmake/RuntimeLibraries.cmake', 'cmake/runtime-contracts.hpp.in', 'cmake/game-build.hpp.in', 'cmake/gg_mbedtls_config.h',
  'core/schema/value.cpp', 'core/schema/value.hpp', 'core/schema/validator.cpp', 'third_party/json/nlohmann/json.hpp'
];
for (const name of ['math2d', 'input', 'catalog', 'ir', 'vm', 'world', 'camera', 'runner', 'resource', 'port']) {
  files.push(`engine/${name}.cpp`, `engine/${name}.hpp`);
}
files.push('engine/node-catalog.json', 'engine/ir1_2.schema.json', 'engine/runtime_bundle.schema.json',
  'engine/runtime_resources.schema.json', 'engine/runtime_port_1_0.schema.json', 'engine/runtime_port_1_1.schema.json');
for (const name of ['sha256.c', 'platform_util.c', 'aes.c', 'ctr_drbg.c', 'common.h', 'alignment.h', 'constant_time_internal.h', 'ctr.h']) files.push(`third_party/mbedtls/library/${name}`);
for (const directory of ['third_party/mbedtls/include/mbedtls', 'third_party/mbedtls/include/psa']) {
  for (const entry of fs.readdirSync(path.join(nativeRoot, directory))) if (entry.endsWith('.h')) files.push(`${directory}/${entry}`);
}
const inputs = Object.fromEntries([...new Set(files)].sort().map(file => [file, digest(fs.readFileSync(path.join(nativeRoot, file)))]));
const identity = canonical({ schema: 'gg-runtime-build-inputs-1', profile, variant, inputs });
const hash = digest(JSON.stringify(identity));
fs.writeFileSync(output, JSON.stringify({ profileId: profile.profileId, profileHash: `sha256:${hash}`, runtimeBuild: `gg-game-abi1.1-${hash.slice(0, 16)}`,
  identity, compatibility_verified: false, execution_status: 'not_run' }, null, 2) + '\n');
