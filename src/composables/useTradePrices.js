import { computed, ref, watch } from 'vue'
import { getPrintingPrices } from '../services/scryfall.js'

/** @typedef {{ printingId: string, finish: string, quantity: number }} PricedLine */

/**
 * Estimates an unsaved trade using USD prices for the draft's printings and finishes.
 * @param {import('vue').Ref<readonly PricedLine[]>} giving Outgoing copies.
 * @param {import('vue').Ref<readonly PricedLine[]>} receiving Incoming copies.
 */
export function useTradePrices(giving, receiving) {
  const prices = ref(new Map())
  const loading = ref(false)
  const error = ref('')
  const retryCount = ref(0)

  const printingKey = computed(() => {
    const ids = new Set([...giving.value, ...receiving.value].map((line) => line.printingId))
    return JSON.stringify([...ids].sort())
  })

  /**
   * Looks up the market price per copy for the selected printing and finish.
   * @param {string} printingId Scryfall printing ID.
   * @param {string} finish Nonfoil, foil, or etched.
   * @returns {number|null} USD cents, including zero, or null when unavailable.
   */
  function unitPriceMinor(printingId, finish) {
    return prices.value.get(printingId)?.[finish] ?? null
  }

  /**
   * Totals the priced copies and counts draft lines with missing prices.
   * @param {readonly PricedLine[]} lines One side of the draft.
   * @returns {{ totalMinor: number | null, missing: number }} Subtotal in USD cents and number of unpriced lines. The subtotal is null if it exceeds the safe integer range.
   */
  function summarize(lines) {
    let totalMinor = 0
    let missing = 0

    for (const { printingId, finish, quantity } of lines) {
      const price = unitPriceMinor(printingId, finish)
      if (price === null) missing += 1
      else totalMinor += price * quantity
    }

    return { totalMinor: Number.isSafeInteger(totalMinor) ? totalMinor : null, missing }
  }

  const givingEstimate = computed(() => summarize(giving.value))
  const receivingEstimate = computed(() => summarize(receiving.value))

  /** Receiving minus giving in USD cents, or null until both sides have complete, usable totals. */
  const differenceMinor = computed(() => {
    const outgoing = givingEstimate.value
    const incoming = receivingEstimate.value

    if (
      loading.value ||
      error.value ||
      !giving.value.length ||
      !receiving.value.length ||
      outgoing.missing ||
      incoming.missing ||
      outgoing.totalMinor === null ||
      incoming.totalMinor === null
    )
      return null

    return incoming.totalMinor - outgoing.totalMinor
  })

  watch([printingKey, retryCount], ([key], _, onCleanup) => {
    const ids = JSON.parse(key)
    loading.value = ids.length > 0
    error.value = ''
    prices.value = new Map()
    if (!ids.length) return

    const controller = new AbortController()
    const timer = setTimeout(loadPrices, 250)
    onCleanup(() => {
      clearTimeout(timer)
      controller.abort()
    })

    async function loadPrices() {
      const estimates = new Map()
      try {
        for (let offset = 0; offset < ids.length; offset += 75) {
          if (offset > 0) await new Promise((resolve) => setTimeout(resolve, 120))
          if (controller.signal.aborted) return

          const batch = await getPrintingPrices(ids.slice(offset, offset + 75), {
            signal: controller.signal,
          })
          for (const [id, price] of batch) estimates.set(id, price)
        }

        if (!controller.signal.aborted) prices.value = estimates
      } catch {
        if (!controller.signal.aborted) error.value = 'Could not load market prices.'
      } finally {
        if (!controller.signal.aborted) loading.value = false
      }
    }
  })

  function retry() {
    retryCount.value += 1
  }

  return {
    loading,
    error,
    unitPriceMinor,
    givingEstimate,
    receivingEstimate,
    differenceMinor,
    retry,
  }
}
