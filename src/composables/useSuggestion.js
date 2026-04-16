import { ref } from 'vue'

export function useSuggestion(keywordRef, options = {}) {
  const suggestions = ref([])
  const activeSuggestion = ref(-1)
  const typing = ref(false)

  let jsonpScript = null
  let jsonpCallbackName = ''
  let jsonpSeed = 0
  let debounceTimer = null

  const onPick = options.onPick || (() => {})

  function clearSuggestions() {
    suggestions.value = []
    activeSuggestion.value = -1
  }

  function cleanupJsonp() {
    if (jsonpScript && jsonpScript.parentNode) {
      jsonpScript.parentNode.removeChild(jsonpScript)
    }
    jsonpScript = null
    if (jsonpCallbackName && window[jsonpCallbackName]) {
      delete window[jsonpCallbackName]
    }
    jsonpCallbackName = ''
  }

  function fetchSuggestions(text) {
    cleanupJsonp()
    const callbackName = `__kuangso_sug_${Date.now()}_${++jsonpSeed}`
    jsonpCallbackName = callbackName

    window[callbackName] = (data) => {
      if (keywordRef.value.trim() !== text) return
      suggestions.value = Array.isArray(data?.s) ? data.s : []
      activeSuggestion.value = -1
      cleanupJsonp()
    }

    jsonpScript = document.createElement('script')
    jsonpScript.src = `https://suggestion.baidu.com/su?wd=${encodeURIComponent(text)}&cb=${callbackName}`
    jsonpScript.onerror = () => {
      clearSuggestions()
      cleanupJsonp()
    }
    document.body.appendChild(jsonpScript)
  }

  function scheduleSuggestions() {
    if (debounceTimer) clearTimeout(debounceTimer)
    const text = keywordRef.value.trim()
    if (!text) {
      clearSuggestions()
      return
    }
    debounceTimer = setTimeout(() => {
      fetchSuggestions(text)
    }, 180)
  }

  function onKeywordInput() {
    scheduleSuggestions()
  }

  function onKeywordFocus() {
    scheduleSuggestions()
  }

  function onKeywordKeydown(event) {
    if (typing.value || suggestions.value.length === 0) return
    const lastIndex = suggestions.value.length - 1

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      activeSuggestion.value = activeSuggestion.value >= lastIndex ? 0 : activeSuggestion.value + 1
      keywordRef.value = suggestions.value[activeSuggestion.value]
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      activeSuggestion.value = activeSuggestion.value <= 0 ? lastIndex : activeSuggestion.value - 1
      keywordRef.value = suggestions.value[activeSuggestion.value]
      return
    }

    if (event.key === 'Escape') {
      clearSuggestions()
    }
  }

  function onCompositionStart() {
    typing.value = true
  }

  function onCompositionEnd() {
    typing.value = false
  }

  function pickSuggestion(value) {
    keywordRef.value = value
    clearSuggestions()
    onPick(value)
  }

  function cleanup() {
    if (debounceTimer) clearTimeout(debounceTimer)
    cleanupJsonp()
  }

  return {
    suggestions,
    activeSuggestion,
    typing,
    clearSuggestions,
    onKeywordInput,
    onKeywordFocus,
    onKeywordKeydown,
    onCompositionStart,
    onCompositionEnd,
    pickSuggestion,
    cleanup
  }
}
