import { create_zip } from '@shared/utils/create-zip'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const get_version = (): string => {
  const manifest_path = path.join(__dirname, '..', 'src', 'manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifest_path, 'utf8'))
  return manifest.version
}

const collect_files = (
  dir: string,
  base_dir = dir
): { name: string; data: Buffer }[] => {
  const entries: { name: string; data: Buffer }[] = []
  if (!fs.existsSync(dir)) return entries
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const fullPath = path.join(dir, file)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      entries.push(...collect_files(fullPath, base_dir))
    } else {
      const relativePath = path.relative(base_dir, fullPath).replace(/\\/g, '/')
      entries.push({ name: relativePath, data: fs.readFileSync(fullPath) })
    }
  }
  return entries
}

const create_zip_from_directory = async (
  source_dir: string,
  output_path: string
): Promise<void> => {
  const entries = collect_files(source_dir)
  const zip_buffer = create_zip(entries)
  fs.writeFileSync(output_path, zip_buffer)
}

const log = (message: string) => console.log(`[create-zip-archives] ${message}`)

const delete_old_zip_archives = (current_version: string) => {
  const base_dir = path.join(__dirname, '..')
  const files = fs.readdirSync(base_dir)
  const zipPattern = /extension-(.+)-(chrome|firefox)\.zip$/
  let deletedFiles = 0

  files.forEach((file) => {
    const match = file.match(zipPattern)
    if (match && match[1] !== current_version) {
      const filePath = path.join(base_dir, file)
      log(`Deleting old archive: ${file}`)
      fs.unlinkSync(filePath)
      deletedFiles++
    }
  })

  if (deletedFiles > 0) {
    log(`Deleted ${deletedFiles} old extension archive(s)`)
  }
}

const main = async () => {
  const base_dir = path.join(__dirname, '..')
  const dist_dir = path.join(base_dir, 'out')
  const firefox_dist_dir = path.join(base_dir, 'out-firefox')
  const version = get_version()

  try {
    delete_old_zip_archives(version)

    await create_zip_from_directory(
      dist_dir,
      path.join(base_dir, `extension-${version}-chrome.zip`)
    )

    await create_zip_from_directory(
      firefox_dist_dir,
      path.join(base_dir, `extension-${version}-firefox.zip`)
    )

    log(`Successfully created ZIP archives for version ${version}`)
  } catch (error) {
    log(
      `Error creating ZIP archives: ${error instanceof Error ? error.message : String(error)}`
    )
    process.exit(1)
  }
}

main()
