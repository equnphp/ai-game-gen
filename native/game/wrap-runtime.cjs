// 仅静态拼接已编译glue和固定wrapper；不执行生成代码，不访问项目或凭据。
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const [template, generated, output, inventoryPath] = process.argv.slice(2);
const source = fs.readFileSync(template, 'utf8');
const marker = '// @GAMEGEN_GENERATED_GLUE@';
if (source.split(marker).length !== 2) throw Error('Wrapper marker mismatch');
fs.writeFileSync(output, source.replace(marker, () => fs.readFileSync(generated, 'utf8')));
if (inventoryPath) {
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  const directory = path.dirname(output);
  const files = ['game-runtime.js', 'game-runtime.wasm'].map(name => {
    const bytes = fs.readFileSync(path.join(directory, name));
    return { name, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  });
  const receipt = { schema:'gg-game-runtime-pair-1', abi:'1.1', profileId:inventory.profileId, profileHash:inventory.profileHash,
    runtimeBuild:inventory.runtimeBuild, variant:inventory.identity.variant, files, initialization:'not_run', world_scenarios:'not_run',
    compatibility_verified:false, quality_verified:false, release_permitted:false };
  const destination = path.join(directory, 'game-runtime.pair.json');
  fs.writeFileSync(destination + '.partial', JSON.stringify(receipt, null, 2) + '\n');
  fs.renameSync(destination + '.partial', destination);
}
