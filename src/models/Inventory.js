import { Card } from './Card.js'
import { CARD_CONDITIONS } from './cardConditions.js'

const FINISHES = ['nonfoil', 'foil', 'etched']

/**
 * Represents owned copies of a specific card printing.
 */
export class Inventory {
  #card
  #details
  /**
   * @param {Card} card Normalized card printing.
   * @param {Object} [options={}] Ownership details.
   * @param {number} [options.quantity=1] Number of owned copies.
   * @param {string} [options.condition='Near Mint'] Condition of the owned copies.
   * @param {'nonfoil'|'foil'|'etched'} [options.finish='nonfoil'] Finish of the owned copies.
   * @param {boolean} [options.favorite=false] Whether the entry is a favorite.
   * @param {boolean} [options.availableForTrade=false] Whether the entry is offered for trade.
   * @param {number|null} [options.purchasePriceMinor=null] Per-copy purchase cost in cents.
   * @param {'USD'} [options.currency='USD'] Currency used for the purchase cost.
   * @param {Object<string, number>} [options.binderQuantities={}]
   *   Binder IDs mapped to assigned copy counts.
   * @throws {TypeError} If the card or ownership details are invalid.
   */
  constructor(
    card,
    {
      quantity = 1,
      condition = 'Near Mint',
      finish = 'nonfoil',
      favorite = false,
      availableForTrade = false,
      purchasePriceMinor = null,
      currency = 'USD',
      binderQuantities = {},
    } = {},
  ) {
    if (!(card instanceof Card)) {
      throw new TypeError('Collection entry requires a Card instance.')
    }

    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      throw new TypeError('Quantity must be a positive safe integer.')
    }

    if (!CARD_CONDITIONS.includes(condition)) {
      throw new TypeError('Unsupported card condition.')
    }

    if (!FINISHES.includes(finish)) {
      throw new TypeError('Unsupported card finish.')
    }

    if (!card.finishes.includes(finish)) {
      throw new TypeError('This finish is unavailable for the selected printing.')
    }

    if (
      purchasePriceMinor !== null &&
      (!Number.isSafeInteger(purchasePriceMinor) || purchasePriceMinor < 0)
    ) {
      throw new TypeError('Purchase price must be null or a nonnegative safe integer.')
    }

    if (currency !== 'USD') {
      throw new TypeError('Only USD is currently supported.')
    }

    if (
      binderQuantities === null ||
      typeof binderQuantities !== 'object' ||
      Array.isArray(binderQuantities) ||
      Object.getPrototypeOf(binderQuantities) !== Object.prototype
    ) {
      throw new TypeError('Binder quantities must be a plain object.')
    }

    let totalAssigned = 0

    for (const [binderId, assignedQuantity] of Object.entries(binderQuantities)) {
      if (binderId.trim() === '') {
        throw new TypeError('Binder IDs must not be blank.')
      }

      if (!Number.isSafeInteger(assignedQuantity) || assignedQuantity < 1) {
        throw new TypeError('Assigned quantities must be positive safe integers.')
      }

      totalAssigned += assignedQuantity

      if (totalAssigned > quantity) {
        throw new TypeError('Binder assignments cannot exceed the owned quantity.')
      }
    }

    if (typeof favorite !== 'boolean') {
      throw new TypeError('Favorite must be a boolean.')
    }

    if (typeof availableForTrade !== 'boolean') {
      throw new TypeError('Available for trade must be a boolean.')
    }

    // Keep an independent, immutable printing snapshot.
    const printing = new Card(card)
    Object.freeze(printing.finishes)

    this.#card = Object.freeze(printing)

    this.#details = {
      quantity,
      condition,
      finish,
      purchasePriceMinor,
      currency,
      binderQuantities: { ...binderQuantities },
      favorite,
      availableForTrade,
    }
  }

  get card() {
    return this.#card
  }

  get quantity() {
    return this.#details.quantity
  }

  get condition() {
    return this.#details.condition
  }

  get finish() {
    return this.#details.finish
  }

  get purchasePriceMinor() {
    return this.#details.purchasePriceMinor
  }

  get currency() {
    return this.#details.currency
  }

  get favorite() {
    return this.#details.favorite
  }

  get availableForTrade() {
    return this.#details.availableForTrade
  }

  /**
   * Returns a copy so callers cannot change internal assignments.
   * @returns {Object<string, number>}
   */
  get binderQuantities() {
    return { ...this.#details.binderQuantities }
  }

  /**
   * Sets the number of copies assigned to a binder.
   * @param {string} binderId Firestore document ID of the binder.
   * @param {number} quantity Assigned copies. Zero removes the assignment.
   * @throws {TypeError} If the binder ID, quantity, or total assignment is invalid.
   */
  assignToBinder(binderId, quantity) {
    if (typeof binderId !== 'string' || binderId.trim() === '' || binderId.includes('/')) {
      throw new TypeError('A valid binder ID is required.')
    }

    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      throw new TypeError('Binder quantity must be a nonnegative safe integer.')
    }

    const binderQuantities = { ...this.#details.binderQuantities, [binderId]: quantity }

    if (quantity === 0) {
      delete binderQuantities[binderId]
    }

    const candidate = new Inventory(this.#card, {
      ...this.#details,
      binderQuantities,
    })

    this.#details = candidate.#details
  }

  /**
   * Applies ownership changes only when the complete result is valid.
   * Card identity and binder assignments cannot be changed here.
   * @param {Object} changes Ownership fields to change.
   * @returns {void}
   * @throws {TypeError} If a field or proposed ownership state is invalid.
   */
  updateDetails(changes) {
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
      throw new TypeError('Ownership changes must be an object.')
    }

    const editableFields = [
      'quantity',
      'condition',
      'finish',
      'purchasePriceMinor',
      'favorite',
      'availableForTrade',
    ]

    for (const field of Object.keys(changes)) {
      if (!editableFields.includes(field)) {
        throw new TypeError(`Cannot change "${field}" through ownership editing.`)
      }
    }

    // Construction validates the entire proposed state using the existing rules.
    const candidate = new Inventory(this.#card, {
      ...this.#details,
      ...changes,
    })

    // This line runs only if every validation succeeded.
    this.#details = candidate.#details
  }
}
