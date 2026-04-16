<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import LinkGrid from './components/LinkGrid.vue'
import { ENGINE_CONFIG, ENGINE_OPTIONS } from './config/searchEngines'
import { STORAGE_KEYS } from './config/storageKeys'
import { usePersistentLinks } from './composables/usePersistentLinks'
import { usePoem } from './composables/usePoem'
import { useSuggestion } from './composables/useSuggestion'
import { useWallpaper } from './composables/useWallpaper'
import { normalizeImg } from './utils/links'

const searchFormRef = ref(null)
const searchInputRef = ref(null)
const logoUploadInputRef = ref(null)

const currentEngineKey = ref('baidu')
const keyword = ref('')

const showEngineSelector = ref(false)
const poemOpen = ref(false)
const bookmarkOpen = ref(false)
const wallpaperOpen = ref(false)
const linkEditorOpen = ref(false)

function getInitialLogoVisibility() {
  if (typeof window === 'undefined') return true

  const params = new URLSearchParams(window.location.search)
  const bg = params.get('bg')
  const storedWallpaper =
    localStorage.getItem(STORAGE_KEYS.WALLPAPER_MODE) || localStorage.getItem('isWallpaper') || 'bing'
  const effectiveWallpaper = bg || storedWallpaper

  if (effectiveWallpaper === 'none') {
    return true
  }

  const pureModeLogoSnapshot = localStorage.getItem(STORAGE_KEYS.PURE_MODE_SHOW_LOGO)
  const showLogoFlag = pureModeLogoSnapshot ?? localStorage.getItem(STORAGE_KEYS.SHOW_LOGO)
  return showLogoFlag === null ? true : showLogoFlag === '1'
}

const quickLinksStore = usePersistentLinks(STORAGE_KEYS.QUICK_LINKS)
const navLinksStore = usePersistentLinks(STORAGE_KEYS.NAV_CUSTOM_LINKS)
const quickLinks = quickLinksStore.links
const navCustomLinks = navLinksStore.links

const showLogo = ref(getInitialLogoVisibility())
const showQuickAdd = ref(true)
const editorTarget = ref('quick')
const linkForm = ref({ name: '', url: '', logo: '', logoName: '' })

const draggingQuickLinkId = ref('')
const draggingNavLinkId = ref('')

const bookmarkLoaded = ref(false)
const bookmarkError = ref(false)
const bookmarkGroups = ref([])

const { verse, quoteSource, loadCurrentQuote, setQuoteSource } = usePoem()
const { wallpaperMode, logoColor, popupTheme, setWallpaper: applyWallpaperMode, setTextColor, setPopupTheme, initWallpaper } =
  useWallpaper()
const {
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
  cleanup: cleanupSuggestion
} = useSuggestion(keyword, {
  onPick: () => {
    nextTick(() => {
      searchFormRef.value?.requestSubmit()
    })
  }
})

const currentEngine = computed(() => ENGINE_CONFIG[currentEngineKey.value] || ENGINE_CONFIG.baidu)
const engineColumns = computed(() => Math.max(1, Math.min(5, ENGINE_OPTIONS.length)))
const canSubmit = computed(() => keyword.value.trim().length > 0)
const editorTitle = computed(() => (editorTarget.value === 'quick' ? '新增快捷网址' : '新增导航网址'))
const showMask = computed(
  () =>
    showEngineSelector.value || poemOpen.value || bookmarkOpen.value || wallpaperOpen.value || linkEditorOpen.value
)

let docClickHandler = null
let docKeydownHandler = null

function initStoredBoolean(key, setter, defaultValue = true) {
  const stored = localStorage.getItem(key)
  if (stored === null) {
    setter(defaultValue)
    return
  }

  setter(stored === '1')
}

function setLogoVisibility(visible) {
  showLogo.value = Boolean(visible)
  localStorage.setItem(STORAGE_KEYS.SHOW_LOGO, showLogo.value ? '1' : '0')
}

function savePureModeLogoSnapshot() {
  localStorage.setItem(STORAGE_KEYS.PURE_MODE_SHOW_LOGO, showLogo.value ? '1' : '0')
}

function restorePureModeLogoSnapshot() {
  const snapshot = localStorage.getItem(STORAGE_KEYS.PURE_MODE_SHOW_LOGO)
  if (snapshot !== null) {
    setLogoVisibility(snapshot === '1')
    localStorage.removeItem(STORAGE_KEYS.PURE_MODE_SHOW_LOGO)
  }
}

function setQuickAddVisibility(visible) {
  showQuickAdd.value = Boolean(visible)
  localStorage.setItem(STORAGE_KEYS.SHOW_QUICK_ADD, showQuickAdd.value ? '1' : '0')
}

function openLinkEditor(target) {
  closeAllPopups()
  editorTarget.value = target
  linkForm.value = { name: '', url: '', logo: '', logoName: '' }
  linkEditorOpen.value = true
}

function openLogoUpload() {
  logoUploadInputRef.value?.click()
}

function clearUploadedLogo() {
  linkForm.value = {
    ...linkForm.value,
    logo: '',
    logoName: ''
  }
  if (logoUploadInputRef.value) {
    logoUploadInputRef.value.value = ''
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function handleLogoUpload(event) {
  const file = event.target?.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    window.alert('请选择图片文件作为图标')
    event.target.value = ''
    return
  }

  try {
    const dataUrl = await readFileAsDataUrl(file)
    linkForm.value = {
      ...linkForm.value,
      logo: dataUrl,
      logoName: file.name
    }
  } catch {
    window.alert('图标读取失败，请重新选择')
  } finally {
    event.target.value = ''
  }
}

function addLink() {
  const payload = {
    name: linkForm.value.name,
    url: linkForm.value.url,
    logo: linkForm.value.logo
  }

  const success = editorTarget.value === 'quick' ? quickLinksStore.add(payload) : navLinksStore.add(payload)
  if (!success) {
    window.alert('请至少填写名称和网站 URL')
    return
  }

  linkEditorOpen.value = false
}

function removeQuickLink(id) {
  quickLinksStore.remove(id)
}

function removeNavLink(id) {
  navLinksStore.remove(id)
}

function onQuickLinkDragStart(id, event) {
  draggingQuickLinkId.value = id
  event.dataTransfer.effectAllowed = 'move'
}

function onQuickLinkDragEnter(id) {
  if (!draggingQuickLinkId.value || draggingQuickLinkId.value === id) return
  quickLinksStore.move(draggingQuickLinkId.value, id)
}

function onQuickLinkDragEnd() {
  draggingQuickLinkId.value = ''
}

function onNavLinkDragStart(id, event) {
  draggingNavLinkId.value = id
  event.dataTransfer.effectAllowed = 'move'
}

function onNavLinkDragEnter(id) {
  if (!draggingNavLinkId.value || draggingNavLinkId.value === id) return
  navLinksStore.move(draggingNavLinkId.value, id)
}

function onNavLinkDragEnd() {
  draggingNavLinkId.value = ''
}

function closeAllPopups() {
  showEngineSelector.value = false
  poemOpen.value = false
  bookmarkOpen.value = false
  wallpaperOpen.value = false
  linkEditorOpen.value = false
}

function openPoem() {
  if (quoteSource.value !== 'poem') return
  closeAllPopups()
  poemOpen.value = true
}

async function changeQuoteSource(source) {
  poemOpen.value = false
  await setQuoteSource(source)
}

function openWallpaper() {
  closeAllPopups()
  wallpaperOpen.value = true
}

function toggleEngineSelector() {
  const nextState = !showEngineSelector.value
  showEngineSelector.value = nextState

  if (!nextState) {
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  }
}

async function openBookmark() {
  closeAllPopups()
  bookmarkOpen.value = true

  if (bookmarkLoaded.value || bookmarkError.value) return
  try {
    const response = await fetch('/style/json/website.json')
    const data = await response.json()
    bookmarkGroups.value = data?.[0]?.object || []
    bookmarkLoaded.value = true
  } catch {
    bookmarkError.value = true
  }
}

function selectEngine(key) {
  if (!ENGINE_CONFIG[key]) return
  currentEngineKey.value = key
  localStorage.setItem('isEnginetype', key)
  showEngineSelector.value = false
  nextTick(() => {
    searchInputRef.value?.focus()
  })
}

function clearKeyword() {
  keyword.value = ''
  clearSuggestions()
  searchInputRef.value?.focus()
}

async function setWallpaper(mode) {
  const previousMode = wallpaperMode.value

  if (previousMode !== 'none' && mode === 'none') {
    savePureModeLogoSnapshot()
    setLogoVisibility(true)
  }

  if (previousMode === 'none' && mode !== 'none') {
    restorePureModeLogoSnapshot()
  }

  await applyWallpaperMode(mode)
}

function handleSubmit(event) {
  if (!canSubmit.value) {
    event.preventDefault()
    return
  }
  clearSuggestions()
  showEngineSelector.value = false
}

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const bg = params.get('bg')
  const wd = params.get('wd')
  if (wd) {
    window.location.href = `/group/?wd=${encodeURIComponent(wd)}`
    return
  }

  quickLinksStore.load()
  navLinksStore.load()

  initStoredBoolean(STORAGE_KEYS.SHOW_QUICK_ADD, setQuickAddVisibility)

  const storedEngine = localStorage.getItem('isEnginetype')
  currentEngineKey.value = ENGINE_CONFIG[storedEngine] ? storedEngine : 'baidu'

  await initWallpaper(bg)

  const pureModeLogoSnapshot = localStorage.getItem(STORAGE_KEYS.PURE_MODE_SHOW_LOGO)
  if (wallpaperMode.value === 'none') {
    setLogoVisibility(true)
  } else {
    const showLogoFlag = pureModeLogoSnapshot ?? localStorage.getItem(STORAGE_KEYS.SHOW_LOGO)
    if (showLogoFlag === null) {
      setLogoVisibility(true)
    } else {
      setLogoVisibility(showLogoFlag === '1')
    }

    if (pureModeLogoSnapshot !== null) {
      localStorage.removeItem(STORAGE_KEYS.PURE_MODE_SHOW_LOGO)
    }
  }

  await loadCurrentQuote()

  docClickHandler = (event) => {
    const target = event.target
    if (!searchFormRef.value?.contains(target)) {
      clearSuggestions()
      showEngineSelector.value = false
    }
  }
  document.addEventListener('click', docClickHandler)

  docKeydownHandler = (event) => {
    if (event.key === 'Escape') {
      closeAllPopups()
      clearSuggestions()
    }
  }
  document.addEventListener('keydown', docKeydownHandler)
})

onBeforeUnmount(() => {
  cleanupSuggestion()
  if (docClickHandler) document.removeEventListener('click', docClickHandler)
  if (docKeydownHandler) document.removeEventListener('keydown', docKeydownHandler)
})
</script>

<template>
  <div class="main">
    <header class="site-header">
      <div class="meicon btnGuide fillet" title="网址导航" @click="openBookmark">
        <svg t="1677074844640" class="icon" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
          <path d="M990.8 550.8c-2.3-24.5-24-43.3-66.1-57-2.1-49.5-12.9-97.5-32.1-143-20.8-49.2-50.6-93.4-88.6-131.4s-82.2-67.8-131.4-88.6c-51-21.6-105.1-32.5-160.9-32.5-55.8 0-109.9 10.9-160.9 32.5-49.2 20.8-93.4 50.6-131.4 88.6-38 38-67.8 82.2-88.6 131.4-21.6 51-32.5 105.1-32.5 160.9 0 18.2 1.2 36.3 3.5 54.1-18.5 9.2-33.3 18.6-43.8 28.1-16.1 14.5-23.5 30-22 46.1 3 32.2 39.8 54.8 112.2 68.5 19 35 42.8 67 71.3 95.5 38 38 82.2 67.8 131.4 88.6 51 21.6 105.1 32.5 160.9 32.5 55.8 0 109.9-10.9 160.9-32.5C721.9 871.8 766.1 842 804 804s67.8-82.2 88.6-131.4c5.5-12.9 10.2-26 14.3-39.3 59.2-25.3 86.7-52.5 83.9-82.5zM511.7 148.4c200.4 0 363.4 163 363.4 363.4 0 33.2-4.5 65.5-12.9 96.1-7.6 2.7-15.9 5.5-24.8 8.3-83.4 26.4-195.8 47.1-316.6 58.4-120.8 11.3-235.2 11.7-322 1.3-4.1-0.5-8.1-1-12-1.5-24.6-48.9-38.4-104.1-38.4-162.5 0-200.5 163-363.5 363.3-363.5z" fill="#272636"></path>
        </svg>
      </div>
      <div class="meicon btnWallpaper area fillet" title="设置" @click="openWallpaper">
        <svg t="1677076730072" class="icon" viewBox="0 0 1070 1024" xmlns="http://www.w3.org/2000/svg">
          <path d="M847.058824 867.137255H224.627451c-64 0-115.45098-45.176471-115.45098-101.647059V232.156863c0-56.470588 51.45098-101.647059 115.45098-101.647059h84.078431c10.039216 0 18.823529 8.784314 18.82353 18.823529s-8.784314 18.823529-18.82353 18.82353h-84.078431c-42.666667 0-77.803922 28.862745-77.803922 64V765.490196c0 35.137255 35.137255 64 77.803922 64h622.431373c42.666667 0 77.803922-28.862745 77.803921-64V232.156863c0-35.137255-35.137255-64-77.803921-64h-464.313726c-10.039216 0-18.823529-8.784314-18.823529-18.82353s8.784314-18.823529 18.823529-18.823529h464.313726c64 0 115.45098 45.176471 115.45098 101.647059V765.490196c-1.254902 56.470588-52.705882 101.647059-115.45098 101.647059z" fill="#272636"></path>
        </svg>
      </div>
    </header>

    <div class="searea">
      <div class="content">
        <div class="so">
          <div
            class="brand-logo"
            :class="{ 'brand-logo-hidden': !showLogo }"
            :style="{
              '--logo-color': logoColor === '#000' ? '#282828' : logoColor,
              '--logo-shadow': '0 1px 3px rgba(0,0,0,0.18)'
            }"
            aria-label="site-logo"
          >
            Quaner搜
          </div>
          <form
            ref="searchFormRef"
            method="get"
            class="form"
            :class="{ 'form-solid-mode': wallpaperMode === 'none' }"
            :action="currentEngine.formAction"
            @submit="handleSubmit"
          >
            <div class="search-type" :id="currentEngine.iconId" @click.stop="toggleEngineSelector"></div>

            <Transition name="engine-panel">
              <div id="engine" v-show="showEngineSelector">
                <ul :style="{ '--engine-cols': engineColumns }">
                  <li v-for="engine in ENGINE_OPTIONS" :key="engine.key" :class="engine.key" @click.stop="selectEngine(engine.key)">
                    <span>{{ engine.label }}</span>
                  </li>
                </ul>
              </div>
            </Transition>

            <input
              ref="searchInputRef"
              v-model="keyword"
              type="text"
              class="field"
              id="search-text"
              style="outline: 0"
              maxlength="2048"
              placeholder="输入关键词进行搜索"
              autofocus="autofocus"
              autocomplete="off"
              :name="currentEngine.param"
              @input="onKeywordInput"
              @focus="onKeywordFocus"
              @keydown="onKeywordKeydown"
              @compositionstart="onCompositionStart"
              @compositionend="onCompositionEnd"
            />

            <div class="delete" v-show="keyword.length > 0" @click.stop="clearKeyword"></div>
            <button type="submit" class="submit" id="submit" :disabled="!canSubmit"></button>

            <ul id="Sugword" v-show="suggestions.length > 0" :data-length="suggestions.length">
              <li
                v-for="(item, index) in suggestions"
                :key="`${item}-${index}`"
                class="sug"
                :data-id="index + 1"
                :class="{ choose: activeSuggestion === index }"
                @mousedown.prevent="pickSuggestion(item)"
              >
                {{ item }}
              </li>
            </ul>
          </form>

          <LinkGrid
            :links="quickLinks"
            :show-add="showQuickAdd"
            add-label="添加快捷方式"
            key-prefix="quick"
            @add="openLinkEditor('quick')"
            @remove="removeQuickLink"
            @drag-start="onQuickLinkDragStart"
            @drag-enter="onQuickLinkDragEnter"
            @drag-end="onQuickLinkDragEnd"
          />
        </div>
      </div>
    </div>

    <div class="hitokoto">
      <div class="hitokoto_content" @click="quoteSource === 'poem' ? openPoem() : null">
        <span id="verse_recommend">{{ verse.recommend }}</span>
        <span id="verse_author_title">{{ verse.authorTitle }}</span>
      </div>
    </div>
  </div>

  <div class="mask alClose" v-show="showMask" @click="closeAllPopups"></div>

  <div class="shutter shici close_area" :class="{ shutter_open: poemOpen }" @click.self="closeAllPopups">
    <div class="shutter_locking">
      <div class="shutter_global close_area_out">
        <div class="shutter_head">
          <h3>今日诗词</h3>
          <span class="btnClose fillet" @click="closeAllPopups">×</span>
        </div>
        <div class="shutter_content">
          <h3 id="verse_title">{{ verse.title }}</h3>
          <span id="verse_author_dynasty">{{ verse.authorDynasty }}</span>
          <span id="verse_content" v-html="verse.contentHtml"></span>
        </div>
      </div>
    </div>
  </div>

  <div class="full_shutter bookmark close_area" :class="{ shutter_open: bookmarkOpen }" @click.self="closeAllPopups">
    <div class="full_shutter_locking">
      <div class="full_shutter_global close_area_out">
        <div class="shutter_head">
          <h3>网址导航</h3>
          <span class="btnClose fillet" @click="closeAllPopups">×</span>
        </div>
        <div class="full_shutter_content">
          <h3>自定义网址</h3>
          <LinkGrid
            class="nav-quick-links"
            :links="navCustomLinks"
            :show-add="true"
            add-label="添加到导航"
            key-prefix="nav"
            @add="openLinkEditor('nav')"
            @remove="removeNavLink"
            @drag-start="onNavLinkDragStart"
            @drag-enter="onNavLinkDragEnter"
            @drag-end="onNavLinkDragEnd"
          />

          <ul class="bookmark_content" id="bookmarkgather">
            <li v-for="group in bookmarkGroups" :key="group.category">
              <h3>{{ group.category }}</h3>
              <ul class="gather">
                <li v-for="site in group.sitelist" :key="`${group.category}-${site.site}`">
                  <a :href="site.site" target="_blank" rel="noreferrer">
                    <div class="siteimg">
                      <img :src="normalizeImg(site.img)" :alt="site.title" />
                    </div>
                    <span>{{ site.title }}</span>
                  </a>
                </li>
              </ul>
            </li>
          </ul>
          <span v-if="bookmarkError" style="display: flex; justify-content: center">后端导航加载失败，请检查接口数据</span>
        </div>
      </div>
    </div>
  </div>

  <div class="shutter wallpaper close_area" :class="{ shutter_open: wallpaperOpen }" @click.self="closeAllPopups">
    <div class="shutter_locking">
      <div class="shutter_global close_area_out">
        <div class="shutter_head">
          <h3>设置</h3>
          <span class="btnClose fillet" @click="closeAllPopups">×</span>
        </div>
        <div class="shutter_content settings-wrap">
          <h4 class="pref-title">壁纸偏好</h4>
          <div class="setting-row">
            <span class="setting-label">壁纸来源</span>
            <div class="setting-buttons">
              <button type="button" class="setting-btn" :class="{ active: wallpaperMode === 'bing' }" @click="setWallpaper('bing')">每日必应</button>
              <button type="button" class="setting-btn" :class="{ active: wallpaperMode === 'random' }" @click="setWallpaper('random')">随机壁纸</button>
              <button type="button" class="setting-btn" :class="{ active: wallpaperMode === 'none' }" @click="setWallpaper('none')">纯色模式</button>
            </div>
          </div>

          <h4 class="pref-title">文案设置</h4>
          <div class="setting-row">
            <span class="setting-label">内容来源</span>
            <div class="setting-buttons">
              <button type="button" class="setting-btn" :class="{ active: quoteSource === 'poem' }" @click="changeQuoteSource('poem')">诗句</button>
              <button type="button" class="setting-btn" :class="{ active: quoteSource === 'hitokoto' }" @click="changeQuoteSource('hitokoto')">一言</button>
            </div>
          </div>

          <h4 class="pref-title">外观设置</h4>
          <label class="setting-row setting-row-switch" for="textColorSwitch">
            <span class="setting-label">主页文字颜色</span>
            <div class="setting-control">
              <input
                id="textColorSwitch"
                class="switch-box icon-switch logo-switch"
                type="checkbox"
                :checked="logoColor === '#000'"
                @change="setTextColor($event.target.checked ? '#000' : '#fff')"
              />
            </div>
          </label>

          <!--
          <label class="setting-row setting-row-switch" for="popupThemeSwitch">
            <span class="setting-label">窗口配色</span>
            <div class="setting-control">
              <input
                id="popupThemeSwitch"
                class="switch-box icon-switch theme-switch"
                type="checkbox"
                :checked="popupTheme === 'dark'"
                @change="setPopupTheme($event.target.checked ? 'dark' : 'light')"
              />
            </div>
          </label>
          -->

          <label class="setting-row setting-row-switch" for="showLogoSwitch">
            <span class="setting-label">显示 Logo</span>
            <div class="setting-control">
              <input
                id="showLogoSwitch"
                class="switch-box icon-switch visibility-switch"
                type="checkbox"
                :checked="showLogo"
                @change="setLogoVisibility($event.target.checked)"
              />
            </div>
          </label>

          <label class="setting-row setting-row-switch" for="quickAddSwitch">
            <span class="setting-label">快捷添加按钮</span>
            <div class="setting-control">
              <input
                id="quickAddSwitch"
                class="switch-box icon-switch visibility-switch"
                type="checkbox"
                :checked="showQuickAdd"
                @change="setQuickAddVisibility($event.target.checked)"
              />
            </div>
          </label>
        </div>
      </div>
    </div>
  </div>

  <div class="shutter shortcut-editor close_area" :class="{ shutter_open: linkEditorOpen }" @click.self="closeAllPopups">
    <div class="shutter_locking">
      <div class="shutter_global close_area_out">
        <div class="shutter_head">
          <h3>{{ editorTitle }}</h3>
          <span class="btnClose fillet" @click="closeAllPopups">×</span>
        </div>
        <div class="shutter_content quick-form">
          <label>
            名称
            <input v-model="linkForm.name" type="text" placeholder="例如：Github" />
          </label>
          <label>
            网站 URL
            <input v-model="linkForm.url" type="text" placeholder="例如：www.github.com" />
          </label>
          <label class="upload-field">
            上传图标（可选）
            <div class="upload-actions">
              <button type="button" class="quick-upload" @click="openLogoUpload">选择图标</button>
              <span class="upload-name">{{ linkForm.logoName || '未选择文件' }}</span>
              <button v-if="linkForm.logo" type="button" class="quick-upload secondary" @click="clearUploadedLogo">清除</button>
            </div>
            <input ref="logoUploadInputRef" class="upload-input" type="file" accept="image/*" @change="handleLogoUpload" />
          </label>
          <button type="button" class="quick-submit" @click="addLink">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>
