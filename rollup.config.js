import babel from 'rollup-plugin-babel'
import builtins from 'rollup-plugin-node-builtins'
import commonjs from 'rollup-plugin-commonjs'
import globals from 'rollup-plugin-node-globals'
import json from 'rollup-plugin-json'
import resolve from 'rollup-plugin-node-resolve'
import replace from 'rollup-plugin-replace'
import { terser } from 'rollup-plugin-terser'

const plugins = [
  babel({ exclude: 'node_modules/**' }),
  resolve({
    browser: true,
    jsnext: true,
    main: true,
    module: true,
    preferBuiltins: true
  }),
  commonjs(),
  builtins(),
  globals(),
  replace({
    vars: {
      ENV: process.env.NODE_ENV || 'development'
    }
  }),
  json()
]

export default [
  {
    input: './src/mediatransboxer.js',
    output: [
      {
        file: 'dist/mediatransboxer.js',
        format: 'cjs'
      },
      {
        file: 'dist/mediatransboxer.esm.js',
        format: 'esm'
      },
      {
        file: 'dist/mediatransboxer.iife.js',
        format: 'iife',
        name: 'MediaTransboxer'
      },
      {
        file: 'dist/mediatransboxer.amd.js',
        format: 'amd',
        name: 'MediaTransboxer'
      },
      {
        file: 'dist/mediatransboxer.umd.js',
        format: 'umd',
        name: 'MediaTransboxer'
      }
    ],
    plugins
  },
  {
    input: './src/mediatransboxer.js',
    output: [
      {
        file: 'dist/mediatransboxer.js',
        format: 'cjs'
      },
      {
        file: 'dist/mediatransboxer.esm.js',
        format: 'esm'
      },
      {
        file: 'dist/mediatransboxer.iife.js',
        format: 'iife',
        name: 'MediaTransboxer'
      },
      {
        file: 'dist/mediatransboxer.amd.js',
        format: 'amd',
        name: 'MediaTransboxer'
      },
      {
        file: 'dist/mediatransboxer.umd.js',
        format: 'umd',
        name: 'MediaTransboxer'
      }
    ],
    plugins: [...plugins, terser({})]
  }
]
