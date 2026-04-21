import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import {
  ensureWallpaperConnections,
  ensureWallpaperPreload,
  getInitialWallpaperMode,
  getWallpaperUrl,
  readCachedWallpaperObjectUrl
} from './utils/wallpaper'

ensureWallpaperConnections()

const initialWallpaperUrl = getWallpaperUrl(getInitialWallpaperMode())
if (initialWallpaperUrl) {
  ensureWallpaperPreload(initialWallpaperUrl)
  ;(async () => {
    const cachedWallpaperUrl = await readCachedWallpaperObjectUrl(initialWallpaperUrl)
    document.body.style.backgroundImage = cachedWallpaperUrl ? `url(${cachedWallpaperUrl})` : `url(${initialWallpaperUrl})`
  })()
}

createApp(App).mount('#app')
