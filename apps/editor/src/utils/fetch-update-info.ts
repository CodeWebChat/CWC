import axios from 'axios'
import { UpdateInfo } from '@/views/prompt/types/messages'
import { is_newer } from './is-newer'

export const get_version_age_days = async (
  version: string,
  tag_name?: string
): Promise<number> => {
  const parts = version.split('.')
  if (parts.length >= 2) {
    const year = parseInt(parts[0], 10)
    const mmdd = parts[1]
    if (!isNaN(year) && mmdd.length === 4) {
      const month = parseInt(mmdd.substring(0, 2), 10) - 1
      const day = parseInt(mmdd.substring(2, 4), 10)
      if (!isNaN(month) && !isNaN(day)) {
        const version_date = Date.UTC(year, month, day)
        const age_days = Math.floor(
          (Date.now() - version_date) / (1000 * 60 * 60 * 24)
        )
        return age_days >= 0 ? age_days : 0
      }
    }
  }

  if (tag_name) {
    try {
      const res = await axios.get(
        `https://api.github.com/repos/CodeWebChat/CWC/commits/${tag_name}`,
        { validateStatus: () => true }
      )
      if (res.status === 200) {
        const date = res.data.commit?.committer?.date
        if (date) {
          const age_days = Math.floor(
            (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)
          )
          return age_days >= 0 ? age_days : 0
        }
      }
    } catch (e) {
      console.error('Failed to fetch commit date:', e)
    }
  }

  return Infinity
}

export const fetch_update_info = async (
  current_version: string,
  minimum_release_age: number
): Promise<UpdateInfo> => {
  if (!current_version) return { is_available: false }

  try {
    let page = 1
    while (page <= 10) {
      const res = await axios.get(
        `https://api.github.com/repos/CodeWebChat/CWC/tags?page=${page}`,
        { validateStatus: () => true }
      )
      if (res.status !== 200) break
      const tags = res.data
      if (!Array.isArray(tags) || tags.length === 0) break

      for (const tag of tags) {
        if (tag.name?.endsWith('-vscode')) {
          const latest_version = tag.name.replace('-vscode', '')
          if (is_newer(latest_version, current_version)) {
            if (minimum_release_age > 0) {
              const tag_age_days = await get_version_age_days(
                latest_version,
                tag.name
              )
              if (tag_age_days < minimum_release_age) {
                continue
              }
            }

            const current_version_age_days = await get_version_age_days(
              current_version,
              `${current_version}-vscode`
            )

            return {
              is_available: true,
              latest_version,
              latest_version_tag: tag.name,
              current_version_age_days
            }
          } else {
            return { is_available: false }
          }
        }
      }
      page++
    }
  } catch (e) {
    console.error('Failed to check for updates:', e)
  }

  return { is_available: false }
}
