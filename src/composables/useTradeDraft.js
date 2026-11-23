import { computed, readonly, ref } from 'vue'
import { Card } from '../models/Card.js'
import { CARD_CONDITIONS } from '../models/cardConditions.js'

/**
 * An inventory entry available to the Giving picker.
 * @typedef {Object} TradeOption
 * @property {string} id Inventory document ID.
 * @property {string} name Card name.
 * @property {string} details Printing, condition, and finish shown in the picker.
 * @property {string} printingId Scryfall ID of the owned printing.
 * @property {string} condition Condition of the owned copies.
 * @property {string} finish Finish of the owned copies.
 * @property {string} imageUrl Thumbnail source for the owned printing.
 * @property {number} available Maximum copies available with the selected source.
 * @property {number} unassigned Copies outside binders.
 * @property {string} [binderId] Selected binder when assigned copies may be traded.
 * @property {string} [binderName] Display name of the selected binder.
 */

/** @typedef {TradeOption & { quantity: number }} TradeDraftLine */

/** @param {TradeDraftLine} line Outgoing copies. */
export function copiesFromBinder(line) {
  return line.binderId ? Math.max(0, line.quantity - line.unassigned) : 0
}

/** Manages the cards and quantities in an unsaved trade draft. */
export function useTradeDraft() {
  /** @type {import('vue').Ref<TradeDraftLine[]>} */
  const giving = ref([])

  const totalCopies = computed(() => giving.value.reduce((total, card) => total + card.quantity, 0))

  /** @type {import('vue').Ref<{ id: string, card: Card, condition: string, finish: string, quantity: number }[]>} */
  const receiving = ref([])

  const totalReceivedCopies = computed(() =>
    receiving.value.reduce((total, line) => total + line.quantity, 0),
  )

  /**
   * Adds copies of a selected printing to the Receiving side of the draft.
   * @param {Card} card The selected printing.
   * @param {{ condition: string, finish: string, quantity: number }} details Incoming copies.
   * @throws {TypeError} If the printing, condition, finish, or quantity is invalid.
   */
  function addReceivedCard(card, { condition, finish, quantity }) {
    if (!(card instanceof Card)) throw new TypeError('Choose a card printing.')
    if (!CARD_CONDITIONS.includes(condition)) throw new TypeError('Choose a valid condition.')
    if (!card.finishes.includes(finish))
      throw new TypeError('Choose a finish this printing offers.')
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      throw new TypeError('Enter a whole number of copies, at least 1.')
    }

    const id = JSON.stringify([card.scryfallId, condition, finish])
    const existing = receiving.value.find((line) => line.id === id)

    if (existing) {
      const next = existing.quantity + quantity
      if (!Number.isSafeInteger(next)) throw new TypeError('The combined quantity is too large.')
      existing.quantity = next
      return
    }

    receiving.value.push({ id, card: new Card(card), condition, finish, quantity })
  }

  /** @param {string} id Receiving line ID. */
  function removeReceivedCard(id) {
    receiving.value = receiving.value.filter((line) => line.id !== id)
  }

  /** @param {TradeOption} card Inventory entry to add at one copy. */
  function addCard(card) {
    if (card.available < 1 || giving.value.some(({ id }) => id === card.id)) return

    giving.value.push({ ...card, quantity: 1 })
  }

  /**
   * Adjusts the draft quantity without exceeding the available copies.
   * @param {string} id Inventory document ID.
   * @param {-1 | 1} amount One fewer or one more copy.
   */
  function changeQuantity(id, amount) {
    const card = giving.value.find((line) => line.id === id)
    if (!card) return

    const next = card.quantity + amount
    if (next >= 1 && next <= card.available) card.quantity = next
  }

  /** @param {string} id Inventory document ID to remove from the draft. */
  function removeCard(id) {
    giving.value = giving.value.filter((card) => card.id !== id)
  }

  function clearDraft() {
    giving.value = []
    receiving.value = []
  }

  return {
    giving: readonly(giving),
    totalCopies,
    addCard,
    changeQuantity,
    removeCard,
    clearDraft,
    receiving: readonly(receiving),
    totalReceivedCopies,
    addReceivedCard,
    removeReceivedCard,
  }
}
