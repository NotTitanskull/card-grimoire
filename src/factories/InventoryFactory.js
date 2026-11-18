import { CardFactory } from './CardFactory.js'
import { Inventory } from '../models/Inventory.js'

/** Constructs ownership models without depending on Vue or Firebase. */
export class InventoryFactory {
  /**
   * Creates a new entry, defaulting to a finish offered by its printing.
   * @param {import('../models/Card.js').Card} card Selected printing.
   * @param {Object} [details={}] Ownership details.
   * @returns {Inventory} Validated ownership model.
   */
  static create(card, details = {}) {
    return new Inventory(card, { finish: card?.finishes?.[0], ...details })
  }

  /**
   * Restores a saved entry; incomplete records fail instead of receiving new-entry defaults.
   * Document IDs and timestamps are handled separately by the persistence service.
   * @param {Object} data Stored document fields.
   * @returns {Inventory} Restored ownership model.
   * @throws {TypeError} If the saved record is incomplete or invalid.
   */
  static fromStoredData(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new TypeError('Stored collection entry must be an object.')
    }

    const fields = [
      'card',
      'quantity',
      'condition',
      'finish',
      'purchasePriceMinor',
      'currency',
      'favorite',
      'availableForTrade',
      'binderQuantities',
    ]

    for (const field of fields) {
      if (!Object.hasOwn(data, field) || data[field] === undefined) {
        throw new TypeError(`Stored collection entry requires "${field}".`)
      }
    }

    const card = CardFactory.fromStoredData(data.card)
    return new Inventory(card, data)
  }

  /**
   * Creates an independent working copy, retaining model behavior and validation.
   * @param {Inventory} entry Existing ownership model.
   * @returns {Inventory} Independent copy.
   */
  static copy(entry) {
    if (!(entry instanceof Inventory)) {
      throw new TypeError('An Inventory instance is required.')
    }

    return new Inventory(entry.card, entry)
  }
}
