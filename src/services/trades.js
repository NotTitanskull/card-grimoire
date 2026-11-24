import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { InventoryFactory } from '../factories/InventoryFactory.js'
import { serializeNewInventoryEntry } from './collection.js'
import { db } from './firestore.js'

/** @typedef {import('../models/Card.js').Card} Card */
/** @typedef {import('firebase/firestore').Timestamp} Timestamp */

/**
 * @typedef {Object} TradeLineDetails
 * @property {number} quantity Positive whole number of copies.
 * @property {string} condition Condition of the copies.
 * @property {string} finish Finish of the copies.
 * @property {number|null} [unitValueMinor] Market price per copy in USD cents. Defaults to null when unavailable.
 */

/**
 * @typedef {Object} GivingSource
 * @property {string} id Inventory document ID.
 * @property {string} name Card name shown in conflict messages.
 * @property {string} printingId Expected Scryfall printing ID.
 * @property {string} [binderId] Required when any copies come from a binder.
 * @property {number} [binderQuantity=0] Copies included in quantity that come from the selected binder. The rest come from unassigned inventory.
 */

/**
 * @typedef {Object} TradeCompletion
 * @property {readonly (TradeLineDetails & GivingSource)[]} giving Outgoing copies, with one line per inventory document.
 * @property {readonly (TradeLineDetails & { card: Card })[]} receiving Incoming copies, with a new inventory document for each line.
 */

/**
 * @typedef {Omit<TradeLineDetails, 'unitValueMinor'> & { card: Card, unitValueMinor: number | null }} TradeSnapshot
 * A saved line with plain card data captured at completion.
 */

/**
 * @typedef {Object} TradeRecord
 * @property {string} id Trade document ID.
 * @property {TradeSnapshot[]} given Outgoing copies at completion.
 * @property {TradeSnapshot[]} received Incoming copies at completion.
 * @property {Timestamp|null} completedAt Server timestamp, or null while the server value is pending.
 * @property {Timestamp|null} createdAt Server timestamp when the record was written.
 * @property {'USD'} currency Currency of the saved prices.
 */

export class TradeConflictError extends Error {}

function isDocumentId(value) {
  return typeof value === 'string' && value.trim() !== '' && !value.includes('/')
}

/**
 * @param {Card} card Printing to snapshot.
 * @param {TradeLineDetails} details Copies and price to record.
 * @returns {TradeSnapshot}
 */
function makeSnapshot(card, { quantity, condition, finish, unitValueMinor = null }) {
  if (unitValueMinor !== null && (!Number.isSafeInteger(unitValueMinor) || unitValueMinor < 0)) {
    throw new TypeError('Trade prices must be nonnegative cents or null.')
  }

  return {
    card: { ...card, finishes: [...card.finishes] },
    quantity,
    condition,
    finish,
    unitValueMinor,
  }
}

/**
 * Saves a completed trade and applies its inventory changes in one transaction.
 * Retrying the same confirmation with the same ID returns that ID if the trade already exists.
 * @param {string} userId Firebase Authentication UID.
 * @param {string} tradeId Client-generated ID for this confirmation.
 * @param {TradeCompletion} trade Selections with at least one line on each side.
 * @returns {Promise<string>} Saved trade document ID.
 * @throws {TypeError} If the IDs, selections, quantities, or prices are invalid.
 * @throws {TradeConflictError} If current inventory can no longer fulfill an outgoing line.
 */
export async function completeTrade(userId, tradeId, { giving, receiving }) {
  if (!isDocumentId(userId) || !isDocumentId(tradeId)) {
    throw new TypeError('Valid user and trade IDs are required.')
  }

  if (!Array.isArray(giving) || !giving.length || !Array.isArray(receiving) || !receiving.length) {
    throw new TypeError('Add cards to both sides before completing the trade.')
  }

  const inventory = collection(db, 'users', userId, 'inventory')
  const tradeRef = doc(db, 'users', userId, 'trades', tradeId)
  const outgoingIds = new Set()

  const outgoing = giving.map((line) => {
    const { binderId, binderQuantity = 0 } = line

    if (!isDocumentId(line.id) || outgoingIds.has(line.id)) {
      throw new TypeError('Each outgoing inventory entry must appear once.')
    }
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) {
      throw new TypeError('Outgoing quantities must be positive whole numbers.')
    }
    if (
      !Number.isSafeInteger(binderQuantity) ||
      binderQuantity < 0 ||
      binderQuantity > line.quantity ||
      (binderQuantity > 0 && !isDocumentId(binderId))
    ) {
      throw new TypeError('Invalid number of outgoing copies from a binder.')
    }

    outgoingIds.add(line.id)
    return { line, binderId, binderQuantity, ref: doc(inventory, line.id) }
  })

  const incoming = receiving.map((line) => {
    const entry = InventoryFactory.create(line.card, {
      quantity: line.quantity,
      condition: line.condition,
      finish: line.finish,
    })

    return {
      ref: doc(inventory),
      data: serializeNewInventoryEntry(entry),
      snapshot: makeSnapshot(entry.card, line),
    }
  })

  return runTransaction(db, async (transaction) => {
    const savedTrade = await transaction.get(tradeRef)
    if (savedTrade.exists()) return tradeId

    const documents = await Promise.all(outgoing.map(({ ref }) => transaction.get(ref)))

    const given = documents.map((document, index) => {
      const { line, binderId, binderQuantity, ref } = outgoing[index]

      if (!document.exists()) {
        throw new TradeConflictError(`${line.name} is no longer in your inventory.`)
      }

      const entry = InventoryFactory.fromStoredData(document.data())
      if (
        entry.card.scryfallId !== line.printingId ||
        entry.condition !== line.condition ||
        entry.finish !== line.finish
      ) {
        throw new TradeConflictError(
          `${line.name} changed. Remove it from the draft and add it again.`,
        )
      }

      const remaining = entry.quantity - line.quantity

      if (line.quantity - binderQuantity > entry.unassignedQuantity) {
        throw new TradeConflictError(
          `There are no longer enough copies of ${line.name} outside binders.`,
        )
      }

      const changes = { quantity: remaining, updatedAt: serverTimestamp() }

      if (binderQuantity > 0) {
        const assigned = entry.binderQuantities[binderId] ?? 0
        if (!entry.availableForTrade || binderQuantity > assigned) {
          throw new TradeConflictError(
            `Copies of ${line.name} from the selected binder are no longer available for this trade.`,
          )
        }

        entry.assignToBinder(binderId, assigned - binderQuantity)
        Object.assign(changes, {
          binderQuantities: entry.binderQuantities,
          assignedQuantity: entry.assignedQuantity,
          lastBinderId: binderId,
        })
      }

      return { ref, changes, snapshot: makeSnapshot(entry.card, line) }
    })

    for (const { ref, changes } of given) {
      if (changes.quantity === 0) transaction.delete(ref)
      else transaction.update(ref, changes)
    }

    for (const { ref, data } of incoming) {
      transaction.set(ref, data)
    }

    transaction.set(tradeRef, {
      given: given.map(({ snapshot }) => snapshot),
      received: incoming.map(({ snapshot }) => snapshot),
      completedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      currency: 'USD',
    })

    return tradeId
  })
}

/**
 * Loads the signed-in user's completed trades, most recent first.
 * @param {string} userId Firebase Authentication UID.
 * @returns {Promise<TradeRecord[]>} Saved trade snapshots with their document IDs.
 */
export async function getTradeHistory(userId) {
  if (!isDocumentId(userId)) {
    throw new TypeError('A valid user ID is required.')
  }

  const trades = collection(db, 'users', userId, 'trades')
  const snapshot = await getDocs(query(trades, orderBy('completedAt', 'desc')))

  return snapshot.docs.map((document) => ({
    .../** @type {Omit<TradeRecord, 'id'>} */ (document.data()),
    id: document.id,
  }))
}
