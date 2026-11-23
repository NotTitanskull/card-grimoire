<script setup>
import { useId } from 'vue'

const open = defineModel({ type: Boolean, default: false })

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  icon: { type: String, required: true },
  width: { type: String, default: undefined },
  persistent: { type: Boolean, default: false },
  hideClose: { type: Boolean, default: false },
  danger: { type: Boolean, default: false },
})

const titleId = useId()
</script>

<template>
  <q-dialog v-model="open" :persistent="persistent" :aria-labelledby="titleId">
    <q-card
      class="grimoire-dialog grimoire-dialog--scroll grimoire-dialog-sized"
      :class="{ 'grimoire-dialog--danger': danger }"
      :style="{ '--dialog-width': width }"
    >
      <q-card-section class="grimoire-dialog__header">
        <q-icon :name="icon" class="grimoire-dialog__icon" aria-hidden="true" />
        <div class="grimoire-dialog__heading">
          <h2 :id="titleId" class="grimoire-dialog__title">{{ title }}</h2>
          <p v-if="subtitle" class="grimoire-dialog__subtitle">{{ subtitle }}</p>
        </div>
        <q-btn
          v-if="!hideClose"
          v-close-popup
          :disable="persistent"
          flat
          round
          dense
          icon="close"
          class="grimoire-dialog__close"
          aria-label="Close dialog"
        />
      </q-card-section>

      <q-card-section class="grimoire-dialog__body">
        <slot />
      </q-card-section>

      <q-card-actions v-if="$slots.actions" align="right" class="grimoire-dialog__footer">
        <slot name="actions" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
