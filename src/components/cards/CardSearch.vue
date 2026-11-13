<script setup>
import { ref } from 'vue'

defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['search'])

const query = ref('')

const queryRules = [
  (value) => Boolean(value.trim()) || 'Enter a card name.',
]

/**
 * Sends the search text to the parent after form validation.
 * @returns {void}
 */
function submitSearch() {
  emit('search', query.value.trim())
}
</script>

<template>
  <q-form class="q-gutter-y-md" @submit="submitSearch">
    <q-input
        v-model="query"
        label="Search card names"
        placeholder="For example, Sol Ring"
        outlined
        hide-bottom-space
        :rules="queryRules"
        :disable="loading"
    />

    <q-btn
        type="submit"
        color="primary"
        icon="search"
        label="Search"
        no-caps
        :loading="loading"
        :disable="loading"
    />
  </q-form>
</template>