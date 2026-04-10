require('dotenv').config({ path: '.env.local' });

const path = require('path');
if (!process.env.TS_NODE_PROJECT) {
  process.env.TS_NODE_PROJECT = path.resolve(__dirname, '..', 'tsconfig.scripts.json');
}

require('ts-node/register');
require('tsconfig-paths/register');

require('./copperFailureScan.ts');
