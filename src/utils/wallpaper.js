import { STORAGE_KEYS } from '../config/storageKeys'

const LEGACY_WALLPAPER_STORAGE_KEY = 'isWallpaper'
const WALLPAPER_ORIGIN = 'https://bing.img.run'
const WALLPAPER_CACHE_NAME = 'quaner-wallpaper-cache-v1'
const WALLPAPER_CACHE_PREFIX = '/__quaner_wallpaper_cache__/'

export function isMobileViewport() {
  if (typeof window === 'undefined') return false

  return window.matchMedia('(max-width: 768px)').matches
}

export function getWallpaperUrl(mode, isMobile = isMobileViewport()) {
  switch (mode) {
    case 'bing':
      // const bingUrl = 'https://api.dujin.org/bing/1920.php'
      return isMobile ? 'https://bing.img.run/m.php' : 'https://bing.img.run/uhd.php'
    case 'random':
      // const url = await loliconImg()
      // const fallback = await qhImg(Math.floor(Math.random() * 20))
      return isMobile ? 'https://bing.img.run/rand_m.php' : 'https://bing.img.run/rand_uhd.php'
    case 'none':
      return ''
    default:
      return mode
  }
}

export function getInitialWallpaperMode() {
  if (typeof window === 'undefined') return 'bing'

  const params = new URLSearchParams(window.location.search)
  const bg = params.get('bg')
  return bg || localStorage.getItem(STORAGE_KEYS.WALLPAPER_MODE) || localStorage.getItem(LEGACY_WALLPAPER_STORAGE_KEY) || 'bing'
}

function ensureHeadLink(selector, attributes) {
  if (typeof document === 'undefined') return
  if (document.head.querySelector(selector)) return

  const link = document.createElement('link')
  Object.entries(attributes).forEach(([key, value]) => {
    link.setAttribute(key, value)
  })
  document.head.appendChild(link)
}

export function ensureWallpaperConnections() {
  ensureHeadLink(`link[rel="preconnect"][href="${WALLPAPER_ORIGIN}"]`, {
    rel: 'preconnect',
    href: WALLPAPER_ORIGIN
  })

  ensureHeadLink(`link[rel="dns-prefetch"][href="${WALLPAPER_ORIGIN}"]`, {
    rel: 'dns-prefetch',
    href: WALLPAPER_ORIGIN
  })
}

export function ensureWallpaperPreload(url) {
  if (!url || typeof document === 'undefined') return

  ensureHeadLink(`link[rel="preload"][as="image"][href="${url}"]`, {
    rel: 'preload',
    as: 'image',
    href: url,
    fetchpriority: 'high'
  })
}

function getWallpaperCacheRequest(url) {
  if (typeof window === 'undefined' || !url) return null

  return new Request(`${window.location.origin}${WALLPAPER_CACHE_PREFIX}${encodeURIComponent(url)}`)
}

export async function readCachedWallpaperObjectUrl(url) {
  if (typeof window === 'undefined' || !('caches' in window) || !url) return ''

  const cacheRequest = getWallpaperCacheRequest(url)
  if (!cacheRequest) return ''

  const cache = await caches.open(WALLPAPER_CACHE_NAME)
  const cachedResponse = await cache.match(cacheRequest)
  if (!cachedResponse) return ''

  const blob = await cachedResponse.blob()
  if (!blob || !blob.type.startsWith('image/')) return ''

  return URL.createObjectURL(blob)
}

export async function cacheWallpaperResponse(url, response) {
  if (typeof window === 'undefined' || !('caches' in window) || !url || !response) return

  const cacheRequest = getWallpaperCacheRequest(url)
  if (!cacheRequest) return

  const cache = await caches.open(WALLPAPER_CACHE_NAME)
  await cache.put(cacheRequest, response.clone())
}

export function revokeWallpaperObjectUrl(url) {
  if (typeof url === 'string' && url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}
