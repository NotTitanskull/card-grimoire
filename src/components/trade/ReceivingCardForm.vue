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
  <q-form class="q-gutter-y-md" @submit.prevent="submit">
    <div>
      <h3 class="text-subtitle1 text-weight-bold q-ma-none">{{ card.name }}</h3>
      <p class="text-grey-8 q-ma-none">{{ card.setName }} · #{{ card.collectorNumber }}</p>
    </div>

    <q-banner v-if="errorMessage" class="bg-red-1 text-negative" role="alert">
      {{ errorMessage }}
    </q-banner>

    <q-select v-model="condition" :options="CARD_CONDITIONS" label="Condition" outlined />

    <q-select
      v-if="card.finishes.length > 1"
      v-model="finish"
      :options="card.finishes"
      label="Finish"
      outlined
    />
    <p v-else>Finish: {{ finish }}</p>

    <q-input
      v-model.number="quantity"
      type="number"
      min="1"
      step="1"
      label="Quantity"
      outlined
      required
    />

    <div class="row justify-end q-gutter-sm">
      <q-btn flat no-caps label="Back to printings" @click="emit('back')" />
      <q-btn type="submit" unelevated no-caps color="primary" label="Add to Receiving" />
    </div>
  </q-form>
</template>

<style scoped lang="scss"></style>
