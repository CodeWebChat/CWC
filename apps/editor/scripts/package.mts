import * as fs from 'node:fs'
import * as path from 'node:path'
import * as zlib from 'node:zlib'
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

// --- Minimal zip writer ---

const crc_table = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

const crc32 = (buffer: Buffer | Uint8Array) => {
  let crc = 0xffffffff
  for (let i = 0; i < buffer.length; i++) {
    crc = crc_table[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

const dos_datetime = (date: Date) => ({
  time:
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2),
  date:
    ((date.getFullYear() - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate()
})

const create_zip = (entries: { name: string; data: Buffer | Uint8Array }[]) => {
  const { time, date } = dos_datetime(new Date())
  const chunks = []
  const central = []
  let offset = 0

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8')
    const raw = entry.data
    const deflated = zlib.deflateRawSync(raw)
    const use_deflate = deflated.length < raw.length
    const data = use_deflate ? deflated : raw
    const method = use_deflate ? 8 : 0
    const crc = crc32(raw)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6) // UTF-8 names
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(date, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)

    const header = Buffer.alloc(46)
    header.writeUInt32LE(0x02014b50, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(20, 6)
    header.writeUInt16LE(0x0800, 8)
    header.writeUInt16LE(method, 10)
    header.writeUInt16LE(time, 12)
    header.writeUInt16LE(date, 14)
    header.writeUInt32LE(crc, 16)
    header.writeUInt32LE(data.length, 20)
    header.writeUInt32LE(raw.length, 24)
    header.writeUInt16LE(name.length, 28)
    header.writeUInt16LE(0, 30)
    header.writeUInt16LE(0, 32)
    header.writeUInt16LE(0, 34)
    header.writeUInt16LE(0, 36)
    header.writeUInt32LE(0, 38)
    header.writeUInt32LE(offset, 42)

    chunks.push(local, name, data)
    central.push(header, name)
    offset += local.length + name.length + data.length
  }

  const central_buffer = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(central_buffer.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([...chunks, central_buffer, end])
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