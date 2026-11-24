import { computed, onScopeDispose, ref, shallowRef } from 'vue'
import { completeTrade, TradeConflictError } from '../services/trades.js'
import { copiesFromBinder } from './useTradeDraft.js'

/** @typedef {import('./useTradeDraft.js').TradeDraftLine} TradeDraftLine */
/** @typedef {import('../models/Card.js').Card} Card */
/** @typedef {{ card: Card, condition: string, finish: string, quantity: number }} ReceivingLine */
/** @typedef {{ giving: readonly TradeDraftLine[], receiving: readonly ReceivingLine[] }} TradeDraft */
/** @typedef {import('../services/trades.js').TradeCompletion & { id: string }} TradeAttempt */

/**
 * Captures a trade at confirmation and preserves it across retries.
 * @param {(printingId: string, finish: string) => number | null} unitPriceMinor
 */
export function useTradeConfirmation(unitPriceMinor) {
  const saving = ref(false)
  const saveError = ref('')
  const pendingTrade = shallowRef(/** @type {TradeAttempt | null} */ (null))
  const retryRequired = computed(() => pendingTrade.value !== null)

  /**
   * Saves the draft or retries the same confirmation if its outcome is unknown.
   * @param {string} userId Signed-in account ID.
   * @param {TradeDraft} draft Current trade selections.
   * @returns {Promise<'saved' | 'conflict' | undefined>}
   */
  async function confirm(userId, { giving, receiving }) {
    if (saving.value || !userId || !giving.length || !receiving.length) return

    const isRetry = pendingTrade.value !== null
    const attempt = pendingTrade.value ?? {
      id: crypto.randomUUID(),
      giving: giving.map((line) => ({
        ...line,
        binderQuantity: copiesFromBinder(line),
        unitValueMinor: unitPriceMinor(line.printingId, line.finish),
      })),
      receiving: receiving.map((line) => ({
        ...line,
        unitValueMinor: unitPriceMinor(line.card.scryfallId, line.finish),
      })),
    }

    pendingTrade.value = attempt
    saving.value = true
    saveError.value = ''

    let keepForRetry = false

    try {
      await completeTrade(userId, attempt.id, attempt)
      if (pendingTrade.value === attempt) return 'saved'
    } catch (error) {
      if (pendingTrade.value !== attempt) return

      if (error instanceof TradeConflictError) {
        saveError.value = error.message
        return 'conflict'
      }

      if (!isRetry && error?.code === 'permission-denied') {
        saveError.value = 'Firestore denied the save. Check the published trade rules.'
        return
      }

      keepForRetry = true
      saveError.value = 'Could not verify the save. Retry confirmation to check the same trade.'
    } finally {
      if (pendingTrade.value === attempt) {
        saving.value = false
        if (!keepForRetry) pendingTrade.value = null
      }
    }
  }

  function reset() {
    pendingTrade.value = null
    saving.value = false
    saveError.value = ''
  }

  onScopeDispose(reset)

  return { saving, saveError, retryRequired, confirm, reset }
}
