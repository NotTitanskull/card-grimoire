<script setup>
import { computed } from 'vue'
import CardSearch from './CardSearch.vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  saving: {
    type: Boolean,
    default: false,
  },
  step: {
    type: String,
    default: 'search',
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'search', 'hide'])

const steps = {
  search: { number: 1, title: 'Find a card' },
  printing: { number: 2, title: 'Choose a printing' },
  details: { number: 3, title: 'Set collection details' },
  variant: { number: null, title: 'Add another variant' },
}
const currentStep = computed(() => steps[props.step] ?? steps.search)
</script>

<template>
  <q-dialog
    :model-value="modelValue"
    :persistent="saving"
    aria-labelledby="add-card-title"
    @update:model-value="emit('update:modelValue', $event)"
    @hide="emit('hide')"
  >
    <q-card class="add-card-dialog">
      <q-card-section class="row items-center">
        <div>
          <p v-if="currentStep.number" class="text-caption text-grey-7 q-mb-none">
            Add a card · Step {{ currentStep.number }} of 3
          </p>
          <h2 id="add-card-title" class="text-h6 q-ma-none">{{ currentStep.title }}</h2>
        </div>

        <q-space />

        <q-btn
          v-close-popup
          :disable="saving"
          flat
          round
          dense
          icon="close"
          aria-label="Close add card dialog"
        />
      </q-card-section>

      <q-separator />

      <q-card-section v-show="step === 'search'">
        <CardSearch :loading="loading" @search="emit('search', $event)" />
      </q-card-section>

      <q-card-section>
        <slot />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">
.add-card-dialog {
  width: 40rem;
  max-width: calc(100vw - 2rem);
}
</style>
