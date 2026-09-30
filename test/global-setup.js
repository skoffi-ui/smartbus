process.env.TS_NODE_TRANSPILE_ONLY = '1';
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node10',
  },
});
require('tsconfig-paths/register');

module.exports = async () => {
  const { synchroniserSchemasDeTest } = require('./synchroniser-schemas');
  await synchroniserSchemasDeTest();
};
