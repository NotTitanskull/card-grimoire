import { CardFactory } from './CardFactory.js'
import { CollectionEntry } from '../models/CollectionEntry.js'

/** Constructs ownership models without depending on Vue or Firebase. */
export class CollectionEntryFactory {
  /**
   * Creates a new entry, defaulting to a finish offered by its printing.
   * @param {import('../models/Card.js').Card} card Selected printing.
   * @param {Object} [details={}] Ownership details.
   * @returns {CollectionEntry} Validated ownership model.
   */
  static create(card, details = {}) {
    return new CollectionEntry(card, { finish: card?.finishes?.[0], ...details })
  }

  /**
   * Restores a saved entry; incomplete records fail instead of receiving new-entry defaults.
   * Document IDs and timestamps are handled separately by the persistence service.
   * @param {Object} data Stored document fields.
   * @returns {CollectionEntry} Restored ownership model.
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
    return new CollectionEntry(card, data)
  }

  /**
   * Creates an independent working copy, retaining model behavior and validation.
   * @param {CollectionEntry} entry Existing ownership model.
   * @returns {CollectionEntry} Independent copy.
   */
  static copy(entry) {
    if (!(entry instanceof CollectionEntry)) {
      throw new TypeError('A CollectionEntry instance is required.')
    }

    return new CollectionEntry(entry.card, entry)
  }
}
