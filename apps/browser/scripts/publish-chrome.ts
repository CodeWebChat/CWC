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

const log = (msg: string) => console.log(`[publish-chrome] ${msg}`)

const main = async () => {
  const client_id = process.env.CHROME_CLIENT_ID
  const client_secret = process.env.CHROME_CLIENT_SECRET
  const refresh_token = process.env.CHROME_REFRESH_TOKEN
  const extension_id = process.env.CHROME_EXTENSION_ID

  if (!client_id || !client_secret || !refresh_token || !extension_id) {
    console.error(
      '[publish-chrome] Missing required environment variables (CHROME_CLIENT_ID, CHROME_CLIENT_SECRET, CHROME_REFRESH_TOKEN, CHROME_EXTENSION_ID).'
    )
    process.exit(1)
  }

  const version = get_version()
  const zip_name = `extension-${version}-chrome.zip`
  const zip_path = path.join(base_dir, zip_name)

  if (!fs.existsSync(zip_path)) {
    console.error(`[publish-chrome] Could not find ZIP file: ${zip_name}`)
    console.error(`[publish-chrome] Ensure you run the "build" step first.`)
    process.exit(1)
  }

  log(`Publishing version ${version} to Chrome Web Store...`)

  log('Fetching access token...')
  const token_res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id,
      client_secret,
      refresh_token,
      grant_type: 'refresh_token'
    })
  })

  if (!token_res.ok) {
    const error_text = await token_res.text()
    console.error(
      `[publish-chrome] Failed to get access token (status ${token_res.status}):`,
      error_text
    )
    process.exit(1)
  }

  const token_data = await token_res.json()
  const access_token = token_data.access_token

  if (!access_token) {
    console.error('[publish-chrome] No access token returned.')
    process.exit(1)
  }

  log(`Uploading ${zip_name}...`)
  const zip_buffer = fs.readFileSync(zip_path)

  const upload_res = await fetch(
    `https://www.googleapis.com/upload/chromewebstore/v1.1/items/${extension_id}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'x-goog-api-version': '2'
      },
      body: zip_buffer
    }
  )

  if (!upload_res.ok) {
    const error_text = await upload_res.text()
    console.error(
      `[publish-chrome] Upload failed with status ${upload_res.status}:`,
      error_text
    )
    process.exit(1)
  }

  const upload_data = await upload_res.json()

  if (upload_data.uploadState !== 'SUCCESS') {
    console.error('[publish-chrome] Upload failed validation:')
    console.error(JSON.stringify(upload_data, null, 2))
    process.exit(1)
  }

  log('Upload successful. Publishing item...')

  const publish_res = await fetch(
    `https://www.googleapis.com/chromewebstore/v1.1/items/${extension_id}/publish`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'x-goog-api-version': '2'
      }
    }
  )

  if (!publish_res.ok) {
    const error_text = await publish_res.text()
    console.error(
      `[publish-chrome] Publish failed with status ${publish_res.status}:`,
      error_text
    )
    process.exit(1)
  }

  const publish_data = await publish_res.json()

  if (!publish_data.status || publish_data.status[0] !== 'OK') {
    console.warn('[publish-chrome] Publish status is not OK. Response:')
    console.warn(JSON.stringify(publish_data, null, 2))
  }

  log(`Successfully published version ${version} to the Chrome Web Store!`)
}

main().catch((err) => {
  console.error('[publish-chrome] Unexpected error:', err)
  process.exit(1)
})
