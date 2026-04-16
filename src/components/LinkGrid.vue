<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { getAutoLogo, linkInitial, normalizeImg } from '../utils/links'

const props = defineProps({
  links: {
    type: Array,
    default: () => []
  },
  showAdd: {
    type: Boolean,
    default: true
  },
  addLabel: {
    type: String,
    default: '添加'
  },
  keyPrefix: {
    type: String,
    default: 'link'
  },
  draggable: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['add', 'remove', 'drag-start', 'drag-enter', 'drag-end'])
const failedIcons = ref({})
const rootRef = ref(null)
const editMode = ref(false)
const suppressClick = ref(false)

let longPressTimer = null
let docPointerdownHandler = null

function clearLongPressTimer() {
  if (!longPressTimer) return
  clearTimeout(longPressTimer)
  longPressTimer = null
}

function onDragStart(id, event) {
  emit('drag-start', id, event)
}

function onDragEnter(id) {
  emit('drag-enter', id)
}

function onDragEnd() {
  emit('drag-end')
}

function onRemove(id) {
  emit('remove', id)
}

function onAdd() {
  emit('add')
}

function getIconKey(id, type) {
  return `${id}:${type}`
}

function getIconSource(link) {
  const uploadedLogo = normalizeImg(link.logo)
  const uploadedKey = getIconKey(link.id, 'uploaded')
  if (uploadedLogo && !failedIcons.value[uploadedKey]) return uploadedLogo

  const autoLogo = getAutoLogo(link.url)
  const autoKey = getIconKey(link.id, 'auto')
  if (autoLogo && !failedIcons.value[autoKey]) return autoLogo

  return ''
}

function onIconError(link) {
  const uploadedLogo = normalizeImg(link.logo)
  const uploadedKey = getIconKey(link.id, 'uploaded')
  if (uploadedLogo && !failedIcons.value[uploadedKey]) {
    failedIcons.value = {
      ...failedIcons.value,
      [uploadedKey]: true
    }
    return
  }

  const autoKey = getIconKey(link.id, 'auto')
  if (!failedIcons.value[autoKey]) {
    failedIcons.value = {
      ...failedIcons.value,
      [autoKey]: true
    }
  }
}

function startLongPress(id, event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return

  clearLongPressTimer()
  longPressTimer = window.setTimeout(() => {
    editMode.value = true
    suppressClick.value = true
  }, 450)
}

function cancelLongPress() {
  clearLongPressTimer()
}

function onLinkClick(event) {
  if (!suppressClick.value) return

  event.preventDefault()
  event.stopPropagation()
  suppressClick.value = false
}

onMounted(() => {
  docPointerdownHandler = (event) => {
    if (rootRef.value?.contains(event.target)) return
    editMode.value = false
    suppressClick.value = false
  }

  document.addEventListener('pointerdown', docPointerdownHandler)
})

onBeforeUnmount(() => {
  clearLongPressTimer()
  if (docPointerdownHandler) {
    document.removeEventListener('pointerdown', docPointerdownHandler)
  }
})
</script>

<template>
  <ul ref="rootRef" class="quick-links">
    <li
      v-for="link in links"
      :key="`${keyPrefix}-${link.id}`"
      class="quick-link-card"
      :class="{ 'quick-link-card-open': editMode }"
      :draggable="draggable"
      @pointerdown="startLongPress(link.id, $event)"
      @pointerup="cancelLongPress"
      @pointerleave="cancelLongPress"
      @pointercancel="cancelLongPress"
      @dragstart="onDragStart(link.id, $event)"
      @dragenter.prevent="onDragEnter(link.id)"
      @dragover.prevent
      @dragend="onDragEnd"
    >
      <a :href="link.url" target="_blank" rel="noreferrer" class="quick-link-item" @click="onLinkClick($event)">
        <div class="quick-link-icon">
          <img v-if="getIconSource(link)" :src="getIconSource(link)" :alt="link.name" @error="onIconError(link)" />
          <span v-else>{{ linkInitial(link.name) }}</span>
        </div>
        <span class="quick-link-name">{{ link.name }}</span>
      </a>
      <button class="quick-link-remove" type="button" @click="onRemove(link.id)">×</button>
    </li>

    <li v-if="showAdd" class="quick-link-card quick-link-add" :class="{ 'quick-link-card-open': editMode }" @click="editMode ? null : onAdd()">
      <div class="quick-link-icon plus">+</div>
      <span class="quick-link-name">{{ addLabel }}</span>
    </li>
  </ul>
</template>
