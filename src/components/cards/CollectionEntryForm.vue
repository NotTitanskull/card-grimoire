<script setup>
import { ref } from 'vue'
import { Card } from '@/models/Card.js'
import { CollectionEntry } from '@/models/CollectionEntry.js'
import { CollectionEntryFactory } from '@/factories/CollectionEntryFactory.js'

const props = defineProps({
  saving: {
    type: Boolean,
    default: false,
  },
  saveError: {
    type: String,
    default: '',
  },
  card: {
    type: Card,
    required: true,
  },
  initialEntry: {
    type: CollectionEntry,
    default: null,
  },
})

const emit = defineEmits(['submit', 'cancel'])

const conditions = ['Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged']

const quantity = ref(props.initialEntry?.quantity ?? 1)
const condition = ref(props.initialEntry?.condition ?? 'Near Mint')
const finish = ref(props.initialEntry?.finish ?? props.card.finishes[0])

const initialPrice = props.initialEntry?.purchasePriceMinor

const purchasePrice = ref(initialPrice == null ? '' : (initialPrice / 100).toFixed(2))

const favorite = ref(props.initialEntry?.favorite ?? false)
const availableForTrade = ref(props.initialEntry?.availableForTrade ?? false)
const errorMessage = ref('')

/**
 * Converts a USD amount into integer cents.
 * @param {string} value Dollar amount entered in the form.
 * @returns {number|null} Per-copy cost in cents, or null when blank.
 * @throws {TypeError} If the amount is invalid or too large.
 */
function parsePurchasePrice(value) {
  const trimmed = value.trim()

  if (trimmed === '') return null

  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new TypeError('Enter a price such as 4, 4.50, or leave it blank.')
  }

  const [dollars, cents = ''] = trimmed.split('.')
  const amount = Number(dollars) * 100 + Number(cents.padEnd(2, '0'))

  if (!Number.isSafeInteger(amount)) {
    throw new TypeError('Purchase price is too large.')
  }

  return amount
}

/**
 * Validates ownership details and emits the completed entry.
 * @returns {void}
 */
function submitEntry() {
  if (props.saving) return

  errorMessage.value = ''

  let entry

  try {
    const changes = {
      quantity: Number(quantity.value),
      condition: condition.value,
      finish: finish.value,
      purchasePriceMinor: parsePurchasePrice(purchasePrice.value),
      favorite: favorite.value,
      availableForTrade: availableForTrade.value,
    }

    if (props.initialEntry) {
      entry = CollectionEntryFactory.copy(props.initialEntry)
      entry.updateDetails(changes)
    } else {
      entry = CollectionEntryFactory.create(props.card, changes)
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Please check your ownership details.'
    return
  }

  emit('submit', entry)
}
</script>

<template>
  <q-form class="q-gutter-y-md" @submit="submitEntry">
    <div>
      <h2 class="text-h6 q-ma-none">{{ card.name }}</h2>
      <p class="text-grey-7 q-mb-none">{{ card.setName }} · #{{ card.collectorNumber }}</p>
    </div>

    <q-banner
      v-if="errorMessage || saveError"
      class="bg-red-1 text-negative rounded-borders"
      role="alert"
    >
      {{ errorMessage || saveError }}
    </q-banner>

    <q-input
      v-model.number="quantity"
      :disable="saving"
      outlined
      hide-bottom-space
      type="number"
      label="Quantity"
      min="1"
      step="1"
      required
    />

    <q-select
      v-model="condition"
      :disable="saving"
      outlined
      hide-bottom-space
      label="Condition"
      :options="conditions"
    />

    <q-select
      :disable="saving"
      v-model="finish"
      outlined
      hide-bottom-space
      label="Finish"
      :options="card.finishes"
    />

    <q-input
      v-model="purchasePrice"
      :disable="saving"
      outlined
      type="text"
      inputmode="decimal"
      label="Purchase price per copy (optional)"
      prefix="$"
      hint="USD — leave blank if unknown."
    />

    <div class="column">
      <q-checkbox :disable="saving" v-model="favorite" label="Favorite" />
      <q-checkbox :disable="saving" v-model="availableForTrade" label="Available for trade" />
    </div>

    <div class="row justify-end q-gutter-sm">
      <q-btn
        :disable="saving"
        flat
        no-caps
        :label="initialEntry ? 'Cancel' : 'Back to printings'"
        @click="emit('cancel')"
      />

      <q-btn
        type="submit"
        color="primary"
        no-caps
        :label="initialEntry ? 'Save changes' : 'Save to collection'"
        :loading="saving"
        :disable="saving"
      />
    </div>
  </q-form>
</template>

<style scoped></style>
