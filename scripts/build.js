const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const rollup = require('rollup')
const terser = require('terser')

if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist')
}

let builds = require('./config').getAllBuilds()

build(builds)

async function build(builds) {
  try {
    for (const build of builds) {
      await buildEntry(build)
    }
  } catch (error) {
    logError(error)
  }
}

async function buildEntry(config) {
  // api 模式时，output 会被忽略，取而代之是 bundle.generate 的方式
  // @see https://rollupjs.org/guide/en/#differences-to-the-javascript-api
  const {output} = config
  const {file, banner} = output
  const isProd = /(min|prod)\.js$/.test(file)
  const bundle = await rollup.rollup(config)
  const {
    output: [{code}],
  } = await bundle.generate(output)
  if (isProd) {
    const {code} = terser.minify(code, {
      toplevel: true,
      output: {
        ascii_only: true,
      },
      compress: {
        pure_funcs: ['makeMap'],
      },
    })
    const minified = (banner ? banner + '\n' : '') + code
    return write(file, minified, true)
  } else {
    return write(file, code)
  }
}

function write(dest, code, zip) {
  return new Promise((resolve, reject) => {
    function report(extra = '') {
      console.log(
        blue(path.relative(process.cwd(), dest)) + ' ' + getSize(code) + extra,
      )
      resolve()
    }

    fs.writeFile(dest, code, (err) => {
      if (err) return reject(err)
      if (zip) {
        zlib.gzip(code, (err, zipped) => {
          if (err) return reject(err)
          report(' (gzipped: ' + getSize(zipped) + ')')
        })
      } else {
        report()
      }
    })
  })
}

function getSize(code) {
  return (code.length / 1024).toFixed(2) + 'kb'
}

function logError(e) {
  console.log(e)
}

function blue(str) {
  return '\x1b[1m\x1b[34m' + str + '\x1b[39m\x1b[22m'
}
