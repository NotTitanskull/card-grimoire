<script setup>
const open = defineModel({ type: Boolean, default: false })

defineProps({
  sides: { type: Array, required: true },
  comparison: { type: String, required: true },
  saving: { type: Boolean, default: false },
  retryRequired: { type: Boolean, default: false },
  saveError: { type: String, default: '' },
})

const emit = defineEmits(['confirm'])
</script>

<template>
  <q-dialog
    v-model="open"
    :persistent="saving || retryRequired"
    aria-labelledby="trade-review-title"
  >
    <q-card class="trade-review">
      <q-card-section>
        <h2 id="trade-review-title" class="text-h6 q-ma-none">Review trade</h2>
      </q-card-section>

      <q-separator />

      <q-card-section class="q-gutter-y-lg">
        <section v-for="side in sides" :key="side.label">
          <h3 class="text-subtitle1 text-weight-bold q-ma-none">{{ side.label }}</h3>

          <q-list separator>
            <q-item v-for="line in side.lines" :key="line.id" class="q-px-none">
              <q-item-section>
                <q-item-label>{{ line.name }}</q-item-label>
                <q-item-label caption>{{ line.details }}</q-item-label>
              </q-item-section>

              <q-item-section side>×{{ line.quantity }}</q-item-section>
            </q-item>
          </q-list>

          <p class="q-mb-none">
            Estimated total <strong>{{ side.total }}</strong>
          </p>
        </section>

        <p class="q-mb-none" role="status">{{ comparison }}</p>
        <p class="text-caption text-grey-8 q-mb-none">
          Scryfall market estimates in USD, before condition adjustments.
        </p>
      </q-card-section>

      <q-separator />

      <q-card-section v-if="saveError">
        <q-banner class="bg-red-1 text-negative" role="alert">
          {{ saveError }}
        </q-banner>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn
          flat
          no-caps
          color="primary"
          label="Back to draft"
          :disable="saving || retryRequired"
          @click="open = false"
        />
        <q-btn
          unelevated
          no-caps
          color="primary"
          :label="retryRequired ? 'Retry confirmation' : 'Confirm trade'"
          :loading="saving"
          :disable="saving"
          @click="emit('confirm')"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.trade-review {
  width: 36rem;
  max-width: calc(100vw - 2rem);
}
</style>
