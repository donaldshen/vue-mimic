const path = require('path')
const buble = require('@rollup/plugin-buble')
const alias = require('@rollup/plugin-alias')
const replace = require('@rollup/plugin-replace')
const version = process.env.VERSION || require('../package.json').version
const featureFlags = require('./feature-flags')

const banner =
  '/*!\n' +
  ` * Vue.js v${version}\n` +
  ` * (c) 2014-${new Date().getFullYear()} Evan You\n` +
  ' * Released under the MIT License.\n' +
  ' */'

const aliases = require('./alias')
const resolve = (p) => {
  const base = p.split('/')[0]
  if (aliases[base]) {
    return path.resolve(aliases[base], p.slice(base.length + 1))
  } else {
    return path.resolve(__dirname, '../', p)
  }
}

const builds = {
  // Runtime+compiler ES modules build (for bundlers)
  'web-full-esm': {
    entry: resolve('web/entry-runtime-with-compiler.js'),
    dest: resolve('dist/vue.esm.js'),
    format: 'es',
    alias: {he: './entity-decoder'},
    banner,
  },
  // Runtime+compiler ES modules build (for direct import in browser)
  'web-full-esm-browser-prod': {
    entry: resolve('web/entry-runtime-with-compiler.js'),
    dest: resolve('dist/vue.esm.browser.min.js'),
    format: 'es',
    transpile: false,
    env: 'production',
    alias: {he: './entity-decoder'},
    banner,
  },
  // Runtime+compiler development build (Browser)
  'web-full-dev': {
    entry: resolve('web/entry-runtime-with-compiler.js'),
    dest: resolve('dist/vue.js'),
    format: 'umd',
    env: 'development',
    alias: {he: './entity-decoder'},
    banner,
  },
}

function genConfig(name) {
  const opts = builds[name]
  const config = {
    input: opts.entry,
    external: opts.external,
    // TODO: 所有插件都要重新测试
    plugins: [
      alias({entries: {...aliases, ...opts.alias}}),
      ...(opts.plugins || []),
      // built-in vars
      replace({
        __VERSION__: version,
        // feature flags
        ...Object.fromEntries(
          Object.entries(featureFlags).map(([k, v]) => [`process.env.${k}`, v]),
        ),
        // build-specific env
        ...(opts.env ? {'process.env.NODE_ENV': JSON.stringify(opts.env)} : {}),
      }),
      ...(opts.transpile !== false ? [buble()] : []),
    ],
    output: {
      file: opts.dest,
      format: opts.format,
      banner: opts.banner,
      name: opts.moduleName || 'Vue',
    },
    onwarn: (msg, warn) => {
      if (!/Circular/.test(msg)) {
        warn(msg)
      }
    },
  }

  // 不可遍历、不可重新配置、不可写，也就是只读
  Object.defineProperty(config, '_name', {
    value: name,
  })

  return config
}

if (process.env.TARGET) {
  module.exports = genConfig(process.env.TARGET)
} else {
  exports.getAllBuilds = () => Object.keys(builds).map(genConfig)
}
