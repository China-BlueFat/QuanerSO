import { ref } from 'vue'
import { createLinkId, normalizeLocalLogo, normalizeUrl, sanitizeLink } from '../utils/links'

export function usePersistentLinks(storageKey) {
  const links = ref([])

  function setLinks(nextLinks) {
    links.value = nextLinks
    save()
  }

  function sanitizeLinks(items) {
    return items.map(sanitizeLink).filter(Boolean)
  }

  function save() {
    localStorage.setItem(storageKey, JSON.stringify(links.value))
  }

  function load() {
    const raw = localStorage.getItem(storageKey)
    if (raw === null) {
      links.value = []
      save()
      return
    }

    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) throw new Error('invalid link list')
      links.value = sanitizeLinks(parsed)
    } catch {
      setLinks([])
    }
  }

  function add(form) {
    const name = String(form?.name || '').trim()
    const url = normalizeUrl(form?.url)
    const logo = normalizeLocalLogo(form?.logo)

    if (!name || !url) {
      return false
    }

    setLinks([
      ...links.value,
      {
        id: createLinkId(),
        name,
        url,
        logo
      }
    ])
    return true
  }

  function remove(id) {
    setLinks(links.value.filter((item) => item.id !== id))
  }

  function move(fromId, toId) {
    const list = [...links.value]
    const fromIndex = list.findIndex((item) => item.id === fromId)
    const toIndex = list.findIndex((item) => item.id === toId)
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return

    const [moved] = list.splice(fromIndex, 1)
    list.splice(toIndex, 0, moved)
    setLinks(list)
  }

  return {
    links,
    load,
    save,
    add,
    remove,
    move
  }
}
