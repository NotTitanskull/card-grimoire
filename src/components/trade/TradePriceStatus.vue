<script setup>
defineProps({
  message: { type: String, required: true },
  warning: { type: Boolean, default: false },
})
</script>

<template>
  <div class="trade-price-status" :class="{ 'trade-price-status--warning': warning }" role="status">
    <q-icon v-if="warning" name="warning_amber" size="1.125rem" aria-hidden="true" />
    <span>{{ message }}</span>
  </div>
</template>

<style scoped>
.trade-price-status {
  font-weight: 500;
}

.trade-price-status--warning {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  border-inline-start: 3px solid var(--q-accent);
  border-radius: 0.375rem;
  background: color-mix(in srgb, var(--q-accent) 12%, white);
  color: color-mix(in srgb, var(--q-accent) 45%, #211503);
}

.trade-price-status--warning .q-icon {
  flex: 0 0 auto;
  margin-top: 0.0625rem;
}
</style>
