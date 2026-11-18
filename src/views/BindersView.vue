<script setup>
import { onMounted, ref, shallowRef } from 'vue'
import { Binder } from '../models/Binder.js'
import { createBinder, getBinders } from '../services/binders.js'
import { useAuthStore } from '../stores/auth.js'

const authStore = useAuthStore()
const binders = shallowRef([])
const name = ref('')
const loading = ref(true)
const saving = ref(false)
const loadError = ref('')
const saveError = ref('')

async function loadBinders() {
  loading.value = true
  loadError.value = ''

  try {
    binders.value = await getBinders(authStore.user?.uid)
  } catch {
    loadError.value = 'Could not load binders. Please try again.'
  } finally {
    loading.value = false
  }
}

async function submitBinder() {
  if (saving.value || loading.value) return

  saveError.value = ''

  let binder
  try {
    binder = new Binder(name.value)
  } catch (error) {
    saveError.value = error.message
    return
  }

  saving.value = true

  try {
    await createBinder(authStore.user?.uid, binder)
    name.value = ''
    await loadBinders()
  } catch {
    saveError.value = 'Could not save the binder. Please try again.'
  } finally {
    saving.value = false
  }
}

onMounted(loadBinders)
</script>

<template>
  <section>
    <h1 class="text-h4 text-weight-bold q-mt-none q-mb-sm">Binders</h1>
    <p>Organize your collection into binders.</p>

    <q-form class="q-gutter-sm q-mb-lg" @submit.prevent="submitBinder">
      <q-input v-model="name" label="Binder name" outlined :disable="saving" />
      <p v-if="saveError" class="text-negative" role="alert">{{ saveError }}</p>
      <q-btn
        type="submit"
        label="Create binder"
        color="primary"
        :loading="saving"
        :disable="loading"
      />
    </q-form>

    <p v-if="loading" role="status">Loading binders…</p>
    <div v-else-if="loadError">
      <p class="text-negative" role="alert">{{ loadError }}</p>
      <q-btn flat label="Retry" @click="loadBinders" />
    </div>
    <p v-else-if="binders.length === 0">You haven't created any binders yet.</p>
    <q-list v-else bordered separator>
      <q-item v-for="record in binders" :key="record.id">
        <q-item-section>{{ record.binder.name }}</q-item-section>
      </q-item>
    </q-list>
  </section>
</template>
