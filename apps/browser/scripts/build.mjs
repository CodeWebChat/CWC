import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const app_dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const targets = ['background', 'send-prompt-content-script', 'popup']

const is_watch = process.argv.includes('--watch')
const mode = is_watch ? 'development' : 'production'
process.env.NODE_ENV = mode

const run = async () => {
  console.log('Building...')

  if (!is_watch) {
    fs.rmSync(path.join(app_dir, 'dist'), { recursive: true, force: true })
  }

  const pending = new Set(targets)
  const finish = (target) => {
    if (pending.delete(target) && pending.size == 0) {
      console.log('Done.')
    }
  }

  for (const target of targets) {
    process.env.CWC_TARGET = target

    const result = await build({
      root: app_dir,
      configFile: path.join(app_dir, 'vite.config.ts'),
      mode,
      logLevel: 'error',
      clearScreen: false,
      build: { watch: is_watch ? {} : null }
    })

    if (is_watch) {
      result.on('event', (event) => {
        if (event.code == 'END' || event.code == 'ERROR') {
          finish(target)
        }
      })
    } else {
      finish(target)
    }
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})