<script setup>
import CardSearch from './CardSearch.vue'

defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'search'])
</script>

<template>
  <q-dialog
      :model-value="modelValue"
      aria-labelledby="add-card-title"
      @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card class="add-card-dialog">
      <q-card-section class="row items-center">
        <h2 id="add-card-title" class="text-h6 q-ma-none">
          Add a card
        </h2>

        <q-space />

        <q-btn
            v-close-popup
            flat
            round
            dense
            icon="close"
            aria-label="Close add card dialog"
        />
      </q-card-section>

      <q-separator />

      <q-card-section>
        <CardSearch
            :loading="loading"
            @search="emit('search', $event)"
        />
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