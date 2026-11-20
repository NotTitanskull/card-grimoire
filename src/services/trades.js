import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { InventoryFactory } from '../factories/InventoryFactory.js'
import { serializeNewInventoryEntry } from './collection.js'
import { db } from './firestore.js'

export class TradeConflictError extends Error {}

function isDocumentId(value) {
  return typeof value === 'string' && value.trim() !== '' && !value.includes('/')
}

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

/** Records a trade and applies its inventory changes in one transaction. */
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
    if (!isDocumentId(line.id) || outgoingIds.has(line.id)) {
      throw new TypeError('Each outgoing inventory entry must appear once.')
    }
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) {
      throw new TypeError('Outgoing quantities must be positive whole numbers.')
    }

    outgoingIds.add(line.id)
    return { line, ref: doc(inventory, line.id) }
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
      const { line, ref } = outgoing[index]

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

      const assigned = Object.values(entry.binderQuantities).reduce(
        (total, copies) => total + copies,
        0,
      )
      const remaining = entry.quantity - line.quantity

      if (remaining < assigned) {
        throw new TradeConflictError(
          `There are no longer enough copies of ${line.name} outside binders.`,
        )
      }

      return { ref, remaining, snapshot: makeSnapshot(entry.card, line) }
    })

    for (const { ref, remaining } of given) {
      if (remaining === 0) transaction.delete(ref)
      else transaction.update(ref, { quantity: remaining, updatedAt: serverTimestamp() })
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
