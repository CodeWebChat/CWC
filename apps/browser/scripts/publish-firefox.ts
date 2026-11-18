import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const base_dir = path.join(__dirname, '..')

const env_path = path.join(base_dir, '.env')
if (fs.existsSync(env_path)) {
  process.loadEnvFile(env_path)
}

const get_version = (): string => {
  const manifest_path = path.join(base_dir, 'src', 'manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifest_path, 'utf8'))
  return manifest.version
}

const create_jwt = (issuer: string, secret: string) => {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' })
  ).toString('base64url')
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + 300
  const jti = crypto.randomBytes(16).toString('hex')
  const payload = Buffer.from(
    JSON.stringify({ iss: issuer, jti, iat, exp })
  ).toString('base64url')

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url')

  return `${header}.${payload}.${signature}`
}

const log = (msg: string) => console.log(`[publish-firefox] ${msg}`)

const main = async () => {
  const api_key = process.env.FIREFOX_JWT_ISSUER
  const api_secret = process.env.FIREFOX_JWT_SECRET
  const extension_id = process.env.FIREFOX_EXTENSION_ID

  if (!api_key || !api_secret || !extension_id) {
    console.error(
      '[publish-firefox] Missing required environment variables (FIREFOX_JWT_ISSUER, FIREFOX_JWT_SECRET, FIREFOX_EXTENSION_ID).'
    )
    process.exit(1)
  }

  const version = get_version()
  const zip_name = `extension-${version}-firefox.zip`
  const zip_path = path.join(base_dir, zip_name)

  if (!fs.existsSync(zip_path)) {
    console.error(`[publish-firefox] Could not find ZIP file: ${zip_name}`)
    console.error(`[publish-firefox] Ensure you run the "build" step first.`)
    process.exit(1)
  }

  log(`Publishing version ${version} to Mozilla Add-ons (AMO) store...`)

  const token = create_jwt(api_key, api_secret)
  const headers = { Authorization: `JWT ${token}` }

  log(`Uploading ${zip_name}...`)
  const zip_buffer = fs.readFileSync(zip_path)
  const blob = new Blob([zip_buffer], { type: 'application/zip' })
  const form = new FormData()
  form.append('upload', blob, zip_name)
  form.append('channel', 'listed')

  const upload_res = await fetch(
    'https://addons.mozilla.org/api/v5/addons/upload/',
    {
      method: 'POST',
      headers,
      body: form
    }
  )

  if (!upload_res.ok) {
    const error_text = await upload_res.text()
    console.error(
      `[publish-firefox] Upload failed with status ${upload_res.status}:`,
      error_text
    )
    process.exit(1)
  }

  const upload_data = await upload_res.json()
  const upload_uuid = upload_data.uuid
  log(`Upload successful (UUID: ${upload_uuid}). Waiting for validation...`)

  let processed = false
  let valid = false
  let poll_count = 0

  while (!processed && poll_count < 60) {
    await new Promise((r) => setTimeout(r, 5000))
    const check_res = await fetch(
      `https://addons.mozilla.org/api/v5/addons/upload/${upload_uuid}/`,
      { headers }
    )

    if (!check_res.ok) {
      log(`Validation check returned status ${check_res.status}, retrying...`)
      continue
    }

    const check_data = await check_res.json()
    processed = check_data.processed
    valid = check_data.valid

    if (processed && !valid) {
      console.error('[publish-firefox] AMO Validation failed:')
      console.error(JSON.stringify(check_data.validation, null, 2))
      process.exit(1)
    }

    if (!processed) {
      log('Still validating...')
    }
    poll_count++
  }

  if (!processed) {
    console.error('[publish-firefox] Validation timed out after 5 minutes.')
    process.exit(1)
  }

  log('Validation passed. Creating new version on the store...')

  const version_res = await fetch(
    `https://addons.mozilla.org/api/v5/addons/addon/${extension_id}/versions/`,
    {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ upload: upload_uuid })
    }
  )

  if (version_res.status === 409) {
    log(`Version ${version} already exists on AMO.`)
    process.exit(0)
  }

  if (!version_res.ok) {
    const error_text = await version_res.text()
    console.error(
      `[publish-firefox] Version creation failed with status ${version_res.status}:`,
      error_text
    )
    process.exit(1)
  }

  log(`Successfully published version ${version} to the Firefox Add-ons store!`)
}

main().catch((err) => {
  console.error('[publish-firefox] Unexpected error:', err)
  process.exit(1)
})
