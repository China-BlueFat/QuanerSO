import { ref } from 'vue'

import { STORAGE_KEYS } from '../config/storageKeys'

const SOURCE_POEM = 'poem'
const SOURCE_HITOKOTO = 'hitokoto'
let jinrishiciSdkPromise = null

function getStoredSource() {
  if (typeof window === 'undefined') return SOURCE_POEM

  const stored = localStorage.getItem(STORAGE_KEYS.QUOTE_SOURCE)
  return stored === SOURCE_HITOKOTO ? SOURCE_HITOKOTO : SOURCE_POEM
}

export function usePoem() {
  const verse = ref({
    recommend: '正在加载今日诗词...',
    authorTitle: '',
    title: '',
    authorDynasty: '',
    contentHtml: ''
  })
  const quoteSource = ref(getStoredSource())

  function persistSource(source) {
    if (typeof window === 'undefined') return
    localStorage.setItem(STORAGE_KEYS.QUOTE_SOURCE, source)
  }

  function setVerse(payload) {
    verse.value = payload
  }

  function fillPoem(result) {
    setVerse({
      recommend: `「${result.data.content}」`,
      authorTitle: `——${result.data.origin.author}《${result.data.origin.title}》`,
      title: `《${result.data.origin.title}》`,
      authorDynasty: `${result.data.origin.author} · ${result.data.origin.dynasty}`,
      contentHtml: result.data.origin.content.join('<br>')
    })
  }

  function fillHitokoto(result) {
    const fromWho = result.from_who?.trim() || ''
    const from = result.from?.trim() || ''
    const author = [fromWho, from ? `《${from}》` : ''].filter(Boolean).join('')

    setVerse({
      recommend: `「${result.hitokoto}」`,
      authorTitle: author ? `——${author}` : '',
      title: from ? `《${from}》` : '一言',
      authorDynasty: fromWho || from || '',
      contentHtml: result.hitokoto
    })
  }

  function setPoemError() {
    setVerse({
      recommend: '今日诗词加载失败',
      authorTitle: '',
      title: '',
      authorDynasty: '',
      contentHtml: ''
    })
  }

  function setHitokotoError() {
    setVerse({
      recommend: '一言加载失败',
      authorTitle: '',
      title: '',
      authorDynasty: '',
      contentHtml: ''
    })
  }

  function ensurePoemSdk() {
    if (window.jinrishici?.load) {
      return Promise.resolve()
    }

    if (jinrishiciSdkPromise) {
      return jinrishiciSdkPromise
    }

    jinrishiciSdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://sdk.jinrishici.com/v2/browser/jinrishici.js'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => {
        jinrishiciSdkPromise = null
        reject(new Error('jinrishici_sdk_failed'))
      }
      document.body.appendChild(script)
    })

    return jinrishiciSdkPromise
  }

  async function loadPoem() {
    try {
      await ensurePoemSdk()
      if (!window.jinrishici?.load) {
        throw new Error('jinrishici_loader_missing')
      }

      await new Promise((resolve, reject) => {
        window.jinrishici.load(
          (result) => {
            fillPoem(result)
            resolve()
          },
          () => {
            reject(new Error('jinrishici_load_failed'))
          }
        )
      })
    } catch {
      setPoemError()
    }
  }

  async function loadHitokoto() {
    try {
      const response = await fetch('https://v1.hitokoto.cn/', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`hitokoto_${response.status}`)
      }

      const result = await response.json()
      fillHitokoto(result)
    } catch {
      setHitokotoError()
    }
  }

  function loadCurrentQuote() {
    if (quoteSource.value === SOURCE_HITOKOTO) {
      return loadHitokoto()
    }

    loadPoem()
    return Promise.resolve()
  }

  function setQuoteSource(source) {
    quoteSource.value = source === SOURCE_HITOKOTO ? SOURCE_HITOKOTO : SOURCE_POEM
    persistSource(quoteSource.value)
    return loadCurrentQuote()
  }

  return {
    verse,
    quoteSource,
    loadCurrentQuote,
    setQuoteSource
  }
}
