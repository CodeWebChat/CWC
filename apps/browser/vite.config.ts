import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { defineConfig, type Plugin } from 'vite'

const targets: Record<string, string> = {
  'send-prompt-content-script':
    'src/content-scripts/send-prompt-content-script/send-prompt-content-script.ts',
  background: 'src/background/main.ts',
  popup: 'src/views/popup/App.tsx'
}

const root_dir = __dirname
const out_dir = path.resolve(root_dir, 'dist')
const src_dir = path.resolve(root_dir, 'src')
const shared_dir = path.resolve(root_dir, '../../packages/shared/src')
const ui_dir = path.resolve(root_dir, '../../packages/ui/src')

const static_files = [
  { from: 'src/manifest.json', to: 'manifest.json' },
  { from: 'src/icons', to: 'icons' },
  { from: 'src/fonts', to: 'fonts' },
  { from: 'src/views/popup/index.html', to: 'popup.html' },
  { from: 'src/views/popup/index.css', to: 'index.css' }
]

const collect_files = (target_path: string): string[] => {
  if (!fs.statSync(target_path).isDirectory()) return [target_path]
  return fs
    .readdirSync(target_path)
    .flatMap((name) => collect_files(path.join(target_path, name)))
}

const copy_static_files = (): Plugin => ({
  name: 'copy-static-files',
  buildStart() {
    for (const { from } of static_files) {
      for (const file of collect_files(path.resolve(root_dir, from))) {
        this.addWatchFile(file)
      }
    }
  },
  writeBundle() {
    for (const { from, to } of static_files) {
      fs.cpSync(path.resolve(root_dir, from), path.resolve(out_dir, to), {
        recursive: true
      })
    }
  }
})

const generate_scoped_name = (local_name: string, filename: string) => {
  const file = filename.split('?')[0]
  const relative_file = path.relative(root_dir, file).replace(/\\/g, '/')
  const module_name = path.basename(file).replace(/\.module\.(scss|css)$/i, '')
  const hash = crypto
    .createHash('md5')
    .update(`${relative_file}${local_name}`)
    .digest('hex')
    .substring(0, 5)
  return `${module_name}__${local_name}__${hash}`
}

export default defineConfig(({ mode }) => {
  const target = process.env.CWC_TARGET ?? ''
  const is_production = mode == 'production'

  if (!Object.hasOwn(targets, target)) {
    throw new Error(
      `Unknown CWC_TARGET "${target}". Build with "node scripts/build.mjs".`
    )
  }

  return {
    publicDir: false,
    plugins: target == 'popup' ? [copy_static_files()] : [],
    define: {
      'process.env.NODE_ENV': JSON.stringify(
        is_production ? 'production' : 'development'
      )
    },
    resolve: {
      alias: {
        '@': src_dir,
        '@shared': shared_dir,
        '@ui': ui_dir
      }
    },
    oxc: {
      jsx: { runtime: 'automatic' }
    },
    css: {
      modules: {
        generateScopedName: generate_scoped_name
      }
    },
    build: {
      outDir: out_dir,
      emptyOutDir: false,
      target: 'es2022',
      minify: is_production,
      sourcemap: !is_production,
      reportCompressedSize: false,
      lib: {
        entry: path.resolve(root_dir, targets[target]),
        name: `cwc_${target.replace(/\W/g, '_')}`,
        formats: ['iife'],
        cssFileName: target
      },
      rolldownOptions: {
        output: {
          entryFileNames: `${target}.js`,
          codeSplitting: false
        }
      }
    }
  }
})
