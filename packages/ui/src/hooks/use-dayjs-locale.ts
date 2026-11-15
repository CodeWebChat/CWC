import { useEffect } from 'react'
import dayjs from 'dayjs'

export const use_dayjs_locale = () => {
  useEffect(() => {
    const lang = document.documentElement.lang || 'en'
    if (lang !== 'en') {
      // @ts-ignore
      import(`../../node_modules/dayjs/locale/${lang}.js`)
        .then(() => {
          dayjs.locale(lang)
        })
        .catch(() => {
          dayjs.locale('en')
        })
    } else {
      dayjs.locale('en')
    }
  }, [])
}
