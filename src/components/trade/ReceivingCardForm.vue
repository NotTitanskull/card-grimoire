<script setup>
import { ref } from 'vue'
import { Card } from '../../models/Card.js'
import { CARD_CONDITIONS } from '../../models/cardConditions.js'

const props = defineProps({
  card: { type: Card, required: true },
  errorMessage: { type: String, default: '' },
})

const emit = defineEmits(['submit', 'back'])

const condition = ref('Near Mint')
const finish = ref(props.card.finishes[0])
const quantity = ref(1)

function submit() {
  emit('submit', {
    condition: condition.value,
    finish: finish.value,
    quantity: Number(quantity.value),
  })
}
</script>

<template>
  <q-form class="card-form" @submit.prevent="submit">
    <div class="card-form__summary">
      <h3>{{ card.name }}</h3>
      <p>{{ card.setName }} · #{{ card.collectorNumber }}</p>
    </div>

    <q-banner v-if="errorMessage" class="bg-red-1 text-negative" role="alert">
      {{ errorMessage }}
    </q-banner>

    <div class="card-form__section">
      <div class="card-form__copy-details">
        <q-select
          v-model="condition"
          :options="CARD_CONDITIONS"
          label="Condition"
          popup-content-class="grimoire-options"
          outlined
        />

        <q-input
          v-model.number="quantity"
          type="number"
          min="1"
          step="1"
          label="Quantity"
          outlined
          required
        />
      </div>

      <q-select
        v-if="card.finishes.length > 1"
        v-model="finish"
        :options="card.finishes"
        label="Finish"
        popup-content-class="grimoire-options"
        outlined
      />
      <p v-else class="q-mb-none">Finish: {{ finish }}</p>
    </div>

    <div class="card-form__actions">
      <q-btn flat no-caps label="Back to printings" @click="emit('back')" />
      <q-btn type="submit" unelevated no-caps color="primary" label="Add to Receiving" />
    </div>
  </q-form>
</template>
