const tsConfigPaths = require('tsconfig-paths');
const path = require('path');

const configPath = path.resolve(__dirname, '..', 'tsconfig.scripts.json');
const configResult = tsConfigPaths.loadConfig(configPath);

if (configResult.resultType === 'success') {
  tsConfigPaths.register({
    baseUrl: configResult.absoluteBaseUrl,
    paths: configResult.paths,
    addMatchAll: configResult.addMatchAll
  });
  console.log('[tsconfig-paths] Registered from', configPath);
} else {
  console.warn('[tsconfig-paths] Failed to load', configPath);
}
