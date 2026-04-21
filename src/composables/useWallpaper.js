import { ref } from 'vue'
import { STORAGE_KEYS } from '../config/storageKeys'
import {
  cacheWallpaperResponse,
  ensureWallpaperConnections,
  ensureWallpaperPreload,
  getWallpaperUrl,
  readCachedWallpaperObjectUrl,
  revokeWallpaperObjectUrl
} from '../utils/wallpaper'

const LEGACY_WALLPAPER_STORAGE_KEY = 'isWallpaper'
const COLOR_WHITE = '#fff'
const COLOR_BLACK = '#000'

function normalizeColor(value, fallback = COLOR_WHITE) {
  if (value === COLOR_BLACK || value === COLOR_WHITE) return value
  return fallback
}

function normalizePopupTheme(value, fallback = 'light') {
  if (value === 'light' || value === 'dark') return value
  return fallback
}

function applyPoemVars(color) {
  const root = document.documentElement
  if (!root) return

  if (color === COLOR_BLACK) {
    root.style.setProperty('--poem-text-color', 'rgba(0, 0, 0, 0.84)')
    root.style.setProperty('--poem-subtext-color', 'rgba(0, 0, 0, 0.64)')
    root.style.setProperty('--poem-text-shadow', '0 1px 3px rgba(0,0,0,0.18)')
    return
  }

  root.style.setProperty('--poem-text-color', 'rgba(255, 255, 255, 0.95)')
  root.style.setProperty('--poem-subtext-color', 'rgba(255, 255, 255, 0.8)')
  root.style.setProperty('--poem-text-shadow', '0 1px 3px rgba(0,0,0,0.18)')
}

function applyPopupTheme(theme) {
  const root = document.documentElement
  if (!root) return
  root.setAttribute('data-popup-theme', theme)
}

export function useWallpaper() {
  const wallpaperMode = ref('bing')
  const textColor = ref(COLOR_WHITE)
  const logoColor = textColor
  const poemColor = textColor
  const popupTheme = ref('light')
  let activeWallpaperObjectUrl = ''

  function persistTextColor(color) {
    localStorage.setItem(STORAGE_KEYS.LOGO_COLOR, color)
    localStorage.setItem(STORAGE_KEYS.POEM_COLOR, color)
  }

  function savePureModeSnapshot() {
    localStorage.setItem(STORAGE_KEYS.PURE_MODE_LOGO_COLOR, textColor.value)
    localStorage.setItem(STORAGE_KEYS.PURE_MODE_POEM_COLOR, textColor.value)
  }

  function clearPureModeSnapshot() {
    localStorage.removeItem(STORAGE_KEYS.PURE_MODE_LOGO_COLOR)
    localStorage.removeItem(STORAGE_KEYS.PURE_MODE_POEM_COLOR)
  }

  function restorePureModeSnapshot() {
    const storedTextColor =
      localStorage.getItem(STORAGE_KEYS.PURE_MODE_LOGO_COLOR) || localStorage.getItem(STORAGE_KEYS.PURE_MODE_POEM_COLOR)

    if (storedTextColor) {
      setTextColor(storedTextColor)
    }

    clearPureModeSnapshot()
  }

  function setTextColor(color) {
    textColor.value = normalizeColor(color, textColor.value)
    persistTextColor(textColor.value)
    applyPoemVars(textColor.value)
  }

  function setLogoColor(color) {
    setTextColor(color)
  }

  function setPoemColor(color) {
    setTextColor(color)
  }

  function setPopupTheme(theme) {
    popupTheme.value = normalizePopupTheme(theme, popupTheme.value)
    localStorage.setItem(STORAGE_KEYS.POPUP_THEME, popupTheme.value)
    applyPopupTheme(popupTheme.value)
  }

  // async function qhImg(fileID) {
  //   try {
  //     const response = await fetch(`/style/json/${fileID}.txt`, { cache: 'no-store' })
  //     const text = await response.text()
  //     const lines = text.split(/\r?\n/).filter(Boolean)
  //     if (lines.length === 0) return ''
  //     const random = lines[Math.floor(Math.random() * Math.min(lines.length, 500))]
  //     return `https://p${fileID}.qhimg.com/${random}`
  //   } catch {
  //     return ''
  //   }
  // }

  // async function loliconImg() {
  //   try {
  //     const response = await fetch('https://api.lolicon.app/setu/v2', { cache: 'no-store' })
  //     const data = await response.json()
  //     const urls = data?.data?.[0]?.urls
  //     return urls?.original || urls?.regular || urls?.small || ''
  //   } catch {
  //     return ''
  //   }
  // }

  function applyWallpaperImage(url) {
    const body = document.body
    if (!body) return

    if (activeWallpaperObjectUrl && activeWallpaperObjectUrl !== url) {
      revokeWallpaperObjectUrl(activeWallpaperObjectUrl)
      activeWallpaperObjectUrl = ''
    }

    if (typeof url === 'string' && url.startsWith('blob:')) {
      activeWallpaperObjectUrl = url
    }

    body.style.backgroundImage = `url(${url})`
  }

  async function fetchFreshWallpaperObjectUrl(url) {
    const response = await fetch(url, {
      cache: 'no-store',
      mode: 'cors'
    })

    if (!response.ok) {
      throw new Error(`wallpaper_fetch_${response.status}`)
    }

    const blob = await response.blob()
    if (!blob.type.startsWith('image/')) {
      throw new Error('wallpaper_blob_invalid')
    }

    await cacheWallpaperResponse(url, new Response(blob, { headers: { 'Content-Type': blob.type } }))
    return URL.createObjectURL(blob)
  }

  function refreshWallpaperCache(url, mode) {
    ;(async () => {
      try {
        const freshWallpaperObjectUrl = await fetchFreshWallpaperObjectUrl(url)
        if (wallpaperMode.value === mode) {
          applyWallpaperImage(freshWallpaperObjectUrl)
        } else {
          revokeWallpaperObjectUrl(freshWallpaperObjectUrl)
        }
      } catch {
        // Ignore background refresh errors to avoid affecting first paint.
      }
    })()
  }

  async function applyWallpaper(mode) {
    const body = document.body
    if (!body) return
    ensureWallpaperConnections()

    const wallpaperUrl = getWallpaperUrl(mode)
    if (!wallpaperUrl) {
      if (activeWallpaperObjectUrl) {
        revokeWallpaperObjectUrl(activeWallpaperObjectUrl)
        activeWallpaperObjectUrl = ''
      }
      body.style.removeProperty('background-image')
      return
    }

    const cachedWallpaperUrl = await readCachedWallpaperObjectUrl(wallpaperUrl)
    if (cachedWallpaperUrl) {
      applyWallpaperImage(cachedWallpaperUrl)
      refreshWallpaperCache(wallpaperUrl, mode)
      return
    }

    ensureWallpaperPreload(wallpaperUrl)
    applyWallpaperImage(wallpaperUrl)

    // Fill cache after first paint, but don't compete with the visible request immediately.
    window.setTimeout(() => {
      if (wallpaperMode.value === mode) {
        refreshWallpaperCache(wallpaperUrl, mode)
      }
    }, 1200)
  }

  async function setWallpaper(mode) {
    const previousMode = wallpaperMode.value

    if (previousMode !== 'none' && mode === 'none') {
      savePureModeSnapshot()
      setLogoColor(COLOR_BLACK)
      setPoemColor(COLOR_BLACK)
    }

    if (previousMode === 'none' && mode !== 'none') {
      restorePureModeSnapshot()
    }

    wallpaperMode.value = mode
    localStorage.setItem(STORAGE_KEYS.WALLPAPER_MODE, mode)
    await applyWallpaper(mode)
  }

  async function initWallpaper(bgParam) {
    const storedWallpaper =
      localStorage.getItem(STORAGE_KEYS.WALLPAPER_MODE) || localStorage.getItem(LEGACY_WALLPAPER_STORAGE_KEY)

    wallpaperMode.value = bgParam || storedWallpaper || 'bing'
    localStorage.setItem(STORAGE_KEYS.WALLPAPER_MODE, wallpaperMode.value)
    await applyWallpaper(wallpaperMode.value)

    if (
      wallpaperMode.value !== 'none' &&
      (localStorage.getItem(STORAGE_KEYS.PURE_MODE_LOGO_COLOR) ||
        localStorage.getItem(STORAGE_KEYS.PURE_MODE_POEM_COLOR))
    ) {
      persistTextColor(
        normalizeColor(
          localStorage.getItem(STORAGE_KEYS.PURE_MODE_LOGO_COLOR) ||
            localStorage.getItem(STORAGE_KEYS.PURE_MODE_POEM_COLOR),
          COLOR_WHITE
        )
      )
      clearPureModeSnapshot()
    }

    const defaultTextColor = wallpaperMode.value === 'none' ? COLOR_BLACK : COLOR_WHITE
    textColor.value = normalizeColor(
      localStorage.getItem(STORAGE_KEYS.LOGO_COLOR) || localStorage.getItem(STORAGE_KEYS.POEM_COLOR),
      defaultTextColor
    )
    popupTheme.value = normalizePopupTheme(localStorage.getItem(STORAGE_KEYS.POPUP_THEME), 'light')

    persistTextColor(textColor.value)
    localStorage.setItem(STORAGE_KEYS.POPUP_THEME, popupTheme.value)

    applyPoemVars(textColor.value)
    applyPopupTheme(popupTheme.value)
  }

  return {
    wallpaperMode,
    textColor,
    logoColor,
    poemColor,
    popupTheme,
    setWallpaper,
    setTextColor,
    setLogoColor,
    setPoemColor,
    setPopupTheme,
    initWallpaper
  }
}
