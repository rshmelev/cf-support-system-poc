// plugin-node-resolve and plugin-commonjs are required for a rollup bundled project
// to resolve dependencies from node_modules. See the documentation for these plugins
// for more details.
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

// additional plugins
import nodePolyfills from 'rollup-plugin-node-polyfills';
import cleanup from 'rollup-plugin-cleanup';
import json from '@rollup/plugin-json';

const resultFile = 'dist/index.mjs';

export default {
  input: 'src/index.ts',
  output: {
    exports: 'named',
    format: 'es',
    file: resultFile,
    preserveModules: false,
    sourcemap: true,
  },
  plugins: [
    cleanup(),

    typescript({ compilerOptions: { target: 'es2021' } }),
    commonjs({ transformMixedEsModules: true }),
    nodeResolve({ browser: true, exportConditions: ['default', 'module', 'import'] }),
    json(),
    nodePolyfills(),
  ],
};
