export function createLinkId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function normalizeImg(path) {
  const text = String(path || '')
  if (!text) return ''
  if (text.startsWith('data:image/')) return text
  if (text.startsWith('//')) return `https:${text}`
  if (text.startsWith('./')) return `/${text.slice(2)}`
  return text
}

export function normalizeUrl(rawUrl) {
  const text = String(rawUrl || '').trim()
  if (!text) return ''
  if (/^https?:\/\//i.test(text)) return text
  return `https://${text}`
}

export function normalizeLocalLogo(rawLogo) {
  const text = String(rawLogo || '').trim()
  if (!text) return ''
  if (text.startsWith('data:image/')) return text
  if (/^https?:\/\//i.test(text)) return text
  if (text.startsWith('//')) return `https:${text}`
  if (text.startsWith('./')) return `/${text.slice(2)}`
  if (text.startsWith('/')) return text
  return `/${text}`
}

export function getAutoLogo(url) {
  const normalizedUrl = normalizeUrl(url)

  try {
    const { hostname } = new URL(normalizedUrl)
    if (!hostname) return ''
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`
  } catch {
    return ''
  }
}

export function sanitizeLink(item) {
  const name = String(item?.name || '').trim()
  const url = normalizeUrl(item?.url)
  const logo = normalizeLocalLogo(item?.logo)
  if (!name || !url) return null

  return {
    id: String(item?.id || createLinkId()),
    name,
    url,
    logo
  }
}

export function linkInitial(name) {
  return String(name || '').trim().slice(0, 1).toUpperCase() || '•'
}
