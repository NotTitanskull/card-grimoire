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
    <q-card class="trade-review grimoire-dialog grimoire-dialog--scroll grimoire-dialog-sized">
      <q-card-section class="grimoire-dialog__header">
        <q-icon name="swap_horiz" class="grimoire-dialog__icon" aria-hidden="true" />
        <h2 id="trade-review-title" class="grimoire-dialog__title grimoire-dialog__heading">
          Review trade
        </h2>
      </q-card-section>

      <q-card-section class="grimoire-dialog__body trade-review-body">
        <section v-for="side in sides" :key="side.label" class="trade-review-side">
          <h3 class="text-subtitle1 text-weight-bold q-ma-none">{{ side.label }}</h3>

          <q-list separator>
            <q-item v-for="line in side.lines" :key="line.id" class="q-px-none">
              <q-item-section>
                <q-item-label>{{ line.name }}</q-item-label>
                <q-item-label caption>{{ line.details }}</q-item-label>
                <q-item-label v-if="line.binderQuantity" caption>
                  {{ line.binderQuantity }} from {{ line.binderName }}
                </q-item-label>
              </q-item-section>

              <q-item-section side>×{{ line.quantity }}</q-item-section>
            </q-item>
          </q-list>

          <p class="trade-review-total q-ma-none">
            <span>Estimated total</span>
            <strong>{{ side.total }}</strong>
          </p>
        </section>

        <div class="trade-review-comparison">
          <p class="q-ma-none text-weight-medium" role="status">{{ comparison }}</p>
          <p class="grimoire-dialog__subtitle">
            Scryfall market estimates in USD, before condition adjustments.
          </p>
        </div>

        <q-banner v-if="saveError" class="bg-red-1 text-negative rounded-borders" role="alert">
          {{ saveError }}
        </q-banner>
      </q-card-section>

      <q-card-actions align="right" class="grimoire-dialog__footer">
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
.trade-review-body {
  display: grid;
  gap: 0.75rem;
}

.trade-review-side,
.trade-review-comparison {
  padding: 0.75rem;
  border-radius: 0.75rem;
  overflow-wrap: anywhere;
}

.trade-review-side {
  border: 1px solid var(--dialog-line);
}

.trade-review-comparison {
  background: var(--dialog-tint);
}

.trade-review-total {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.25rem 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--dialog-line);
}
</style>
