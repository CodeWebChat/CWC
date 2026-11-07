const start_time = Date.now()

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const { build } = await import('vite')

const app_dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const targets = [
  'extension',
  'websocket-server-process',
  'prompt',
  'settings',
  'chats'
]

const is_watch = process.argv.includes('--watch')
const mode = is_watch ? 'development' : 'production'
process.env.NODE_ENV = mode

const clean = () => {
  for (const file of fs.readdirSync(app_dir)) {
    if (file.endsWith('.vsix')) {
      fs.rmSync(path.join(app_dir, file))
    }
  }
  if (!is_watch) {
    fs.rmSync(path.join(app_dir, 'out'), { recursive: true, force: true })
  }
}

const run = async () => {
  clean()

  if (is_watch) {
    const tsc = spawn('tsc', ['--noEmit', '--watch', '--preserveWatchOutput'], {
      cwd: app_dir,
      stdio: 'inherit',
      shell: process.platform == 'win32'
    })
    tsc.on('error', (error) => {
      console.error(`Could not start tsc: ${error.message}`)
    })
    process.on('exit', () => tsc.kill())
  }

  const pending = new Set(targets)
  const finish = (target) => {
    if (pending.delete(target) && pending.size == 0) {
      const time = ((Date.now() - start_time) / 1000).toFixed(1)
      console.log(`Built in ${time}s.`)
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