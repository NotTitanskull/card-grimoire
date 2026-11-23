<script setup>
import { computed } from 'vue'
import DialogFrame from '../layout/DialogFrame.vue'
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
  detailsTitle: {
    type: String,
    default: 'Collection details',
  },
})

const emit = defineEmits(['update:modelValue', 'search', 'hide'])

const steps = {
  search: { number: 1, title: 'Find a card', icon: 'search' },
  printing: { number: 2, title: 'Choose a printing', icon: 'layers' },
  details: { number: 3, icon: 'tune' },
  variant: { number: null, title: 'Add another variant', icon: 'add' },
}
const currentStep = computed(() => steps[props.step] ?? steps.search)
const title = computed(() => currentStep.value.title ?? props.detailsTitle)
</script>

<template>
  <DialogFrame
    class="add-card-dialog"
    :model-value="modelValue"
    :persistent="saving"
    :title="title"
    :subtitle="currentStep.number ? `Step ${currentStep.number} of 3` : ''"
    :icon="currentStep.icon"
    width="40rem"
    @update:model-value="emit('update:modelValue', $event)"
    @hide="emit('hide')"
  >
    <CardSearch v-show="step === 'search'" :loading="loading" @search="emit('search', $event)" />
    <div :class="{ 'add-card-results': step === 'search' }">
      <slot />
    </div>
  </DialogFrame>
</template>

<style scoped lang="scss">
.add-card-results:not(:empty) {
  margin-top: 1rem;
}
</style>
