import { create_zip } from './utils/create-zip'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const app_dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const pkg = JSON.parse(
  fs.readFileSync(path.join(app_dir, 'package.json'), 'utf8')
)

// Files and directories (relative to app_dir) that go into the extension.
const include = [
  'package.json',
  'README.md',
  'CHANGELOG.md',
  'out',
  'media',
  'resources'
]

const is_excluded = (file: string) =>
  file.endsWith('.map') ||
  file.endsWith('.vsix') ||
  path.basename(file) == '.DS_Store'

const content_types: Record<string, string> = {
  '.json': 'application/json',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.md': 'text/markdown',
  '.txt': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.vsixmanifest': 'text/xml'
}

const escape_xml = (value: any) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const collect_files = (relative_path: string): string[] => {
  const absolute_path = path.join(app_dir, relative_path)
  if (!fs.existsSync(absolute_path)) return []
  const stat = fs.statSync(absolute_path)
  if (stat.isFile()) {
    return is_excluded(relative_path) ? [] : [relative_path]
  }
  return fs
    .readdirSync(absolute_path)
    .flatMap((name) => collect_files(path.join(relative_path, name)))
}

const resolve_files = () => {
  const extra = fs
    .readdirSync(app_dir)
    .filter((name) => /^package\.nls(\..+)?\.json$/.test(name))
    .concat(
      fs.readdirSync(app_dir).filter((name) => /^LICENSE(\..+)?$/i.test(name))
    )
  const files = [...new Set([...include, ...extra])].flatMap(collect_files)
  return files.map((file) => file.split(path.sep).join('/'))
}

// --- VSIX metadata ---

const create_content_types = (names: string[]) => {
  const extensions = new Set(['.vsixmanifest'])
  for (const name of names) {
    const extension = path.extname(name).toLowerCase()
    if (extension) extensions.add(extension)
  }
  const defaults = [...extensions]
    .map((extension) => {
      const type = content_types[extension] ?? 'application/octet-stream'
      return `<Default Extension="${escape_xml(extension)}" ContentType="${type}"/>`
    })
    .join('')
  return `<?xml version="1.0" encoding="utf-8"?><Types>${defaults}</Types>`
}

const create_manifest = (files: string[]) => {
  const has = (file: string) => files.includes(file)
  const license = files.find((file) => /^LICENSE(\..+)?$/i.test(file))
  const assets = [
    `<Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/>`
  ]
  if (has('README.md')) {
    assets.push(
      `<Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true"/>`
    )
  }
  if (has('CHANGELOG.md')) {
    assets.push(
      `<Asset Type="Microsoft.VisualStudio.Services.Content.Changelog" Path="extension/CHANGELOG.md" Addressable="true"/>`
    )
  }
  if (license) {
    assets.push(
      `<Asset Type="Microsoft.VisualStudio.Services.Content.License" Path="extension/${license}" Addressable="true"/>`
    )
  }
  if (pkg.icon && has(pkg.icon)) {
    assets.push(
      `<Asset Type="Microsoft.VisualStudio.Services.Icons.Default" Path="extension/${escape_xml(pkg.icon)}" Addressable="true"/>`
    )
  }

  const properties = [
    ['Microsoft.VisualStudio.Code.Engine', pkg.engines.vscode],
    ['Microsoft.VisualStudio.Code.ExtensionDependencies', ''],
    ['Microsoft.VisualStudio.Code.ExtensionPack', ''],
    ['Microsoft.VisualStudio.Code.ExtensionKind', 'workspace'],
    ['Microsoft.VisualStudio.Code.LocalizedLanguages', ''],
    ['Microsoft.VisualStudio.Code.EnabledApiProposals', ''],
    ['Microsoft.VisualStudio.Code.ExecutesCode', 'true']
  ]
    .map(
      ([id, value]: any[]) =>
        `<Property Id="${id}" Value="${escape_xml(value)}"/>`
    )
    .join('')

  return `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="${escape_xml(pkg.name)}" Version="${escape_xml(pkg.version)}" Publisher="${escape_xml(pkg.publisher)}"/>
    <DisplayName>${escape_xml(pkg.displayName ?? pkg.name)}</DisplayName>
    <Description xml:space="preserve">${escape_xml(pkg.description ?? '')}</Description>
    <Categories>Other</Categories>
    <GalleryFlags>Public</GalleryFlags>
    <Properties>${properties}</Properties>${license ? `\n    <License>extension/${escape_xml(license)}</License>` : ''}${pkg.icon && has(pkg.icon) ? `\n    <Icon>extension/${escape_xml(pkg.icon)}</Icon>` : ''}
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code"/>
  </Installation>
  <Dependencies/>
  <Assets>
    ${assets.join('\n    ')}
  </Assets>
</PackageManifest>
`
}

const run = () => {
  if (!fs.existsSync(path.join(app_dir, 'out', 'extension.js'))) {
    throw new Error('Missing out/extension.js. Run "npm run compile" first.')
  }

  const files = resolve_files()
  const entries: { name: string; data: Buffer }[] = [
    ...files.map((file) => ({
      name: `extension/${file}`,
      data: fs.readFileSync(path.join(app_dir, file))
    })),
    {
      name: 'extension.vsixmanifest',
      data: Buffer.from(create_manifest(files), 'utf8')
    }
  ]
  entries.unshift({
    name: '[Content_Types].xml',
    data: Buffer.from(create_content_types(entries.map((e) => e.name)), 'utf8')
  })

  const output = path.join(app_dir, `${pkg.name}-${pkg.version}.vsix`)
  fs.writeFileSync(output, create_zip(entries))

  const size = (fs.statSync(output).size / 1024 / 1024).toFixed(2)
  console.log(
    `Packaged ${files.length} files: ${path.basename(output)} (${size} MB)`
  )
}

try {
  run()
} catch (error: any) {
  console.error(error)
  process.exit(1)
}