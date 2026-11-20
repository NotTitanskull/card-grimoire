import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore'
import { InventoryFactory } from '../factories/InventoryFactory.js'
import { db } from './firestore.js'

/** @typedef {import('../models/Inventory.js').Inventory} Inventory */
/** @typedef {{id: string, entry: Inventory, createdAt: import('firebase/firestore').Timestamp, updatedAt: import('firebase/firestore').Timestamp}} CollectionRecord */

/**
 * Builds the Firestore document for a new inventory entry.
 * @param {Inventory} entry Inventory entry to serialize.
 */
export function serializeNewInventoryEntry(entry) {
  const validated = InventoryFactory.copy(entry)
  const card = validated.card

  return {
    card: {
      scryfallId: card.scryfallId,
      oracleId: card.oracleId,
      name: card.name,
      setCode: card.setCode,
      setName: card.setName,
      collectorNumber: card.collectorNumber,
      typeLine: card.typeLine,
      rarity: card.rarity,
      imageUrl: card.imageUrl,
      finishes: [...card.finishes],
    },
    quantity: validated.quantity,
    condition: validated.condition,
    finish: validated.finish,
    purchasePriceMinor: validated.purchasePriceMinor,
    currency: validated.currency,
    favorite: validated.favorite,
    availableForTrade: validated.availableForTrade,
    binderQuantities: { ...validated.binderQuantities },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
}

/**
 * Saves a new collection entry under its owner's account.
 * @param {string} userId Firebase Authentication UID.
 * @param {Inventory} entry Ownership details to save.
 * @returns {Promise<string>} Created document ID.
 * @throws {Error} If validation or the Firestore write fails.
 */
export async function createCollectionEntry(userId, entry) {
  if (typeof userId !== 'string' || userId.trim() === '' || userId.includes('/')) {
    throw new TypeError('A valid user ID is required.')
  }

  const data = serializeNewInventoryEntry(entry)
  const entries = collection(db, 'users', userId, 'inventory')
  const document = await addDoc(entries, data)

  return document.id
}

/**
 * Retrieves the user's saved collection entries, newest first.
 * @param {string} userId Firebase Authentication UID.
 * @returns {Promise<CollectionRecord[]>} Models with separate document metadata.
 * @throws {Error} If the user ID is invalid or the request fails.
 */
export async function getCollectionEntries(userId) {
  if (typeof userId !== 'string' || userId.trim() === '' || userId.includes('/')) {
    throw new TypeError('A valid user ID is required.')
  }

  const entries = collection(db, 'users', userId, 'inventory')
  const entriesQuery = query(entries, orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(entriesQuery)

  return snapshot.docs.map((document) => {
    const data = document.data()

    return {
      id: document.id,
      entry: InventoryFactory.fromStoredData(data),
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }
  })
}

/**
 * Updates ownership details for an existing collection entry.
 * @param {string} userId Firebase Authentication UID.
 * @param {string} entryId Collection entry document ID.
 * @param {Inventory} entry Validated ownership details.
 * @returns {Promise<void>}
 * @throws {Error} If validation or the Firestore update fails.
 */
export async function updateCollectionEntry(userId, entryId, entry) {
  for (const id of [userId, entryId]) {
    if (typeof id !== 'string' || id.trim() === '' || id.includes('/')) {
      throw new TypeError('Valid user and entry IDs are required.')
    }
  }

  const reference = doc(db, 'users', userId, 'inventory', entryId)

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference)

    if (!snapshot.exists()) {
      throw new Error('This inventory entry no longer exists.')
    }

    const currentEntry = InventoryFactory.fromStoredData(snapshot.data())
    const changes = {
      quantity: entry.quantity,
      condition: entry.condition,
      finish: entry.finish,
      purchasePriceMinor: entry.purchasePriceMinor,
      favorite: entry.favorite,
      availableForTrade: entry.availableForTrade,
    }

    currentEntry.updateDetails(changes)

    transaction.update(reference, {
      ...changes,
      updatedAt: serverTimestamp(),
    })
  })
}

/**
 * Sets the number of copies assigned to one binder.
 * @param {string} userId Firebase Authentication UID.
 * @param {string} entryId Inventory document ID.
 * @param {string} binderId Binder document ID.
 * @param {number} quantity Assigned copies. Zero removes the assignment.
 * @returns {Promise<void>}
 */
export async function saveBinderAssignment(userId, entryId, binderId, quantity) {
  for (const id of [userId, entryId, binderId]) {
    if (typeof id !== 'string' || id.trim() === '' || id.includes('/')) {
      throw new TypeError('Valid user, inventory, and binder IDs are required.')
    }
  }

  const entryRef = doc(db, 'users', userId, 'inventory', entryId)
  const binderRef = doc(db, 'users', userId, 'binders', binderId)

  await runTransaction(db, async (transaction) => {
    const entrySnapshot = await transaction.get(entryRef)

    if (!entrySnapshot.exists()) {
      throw new Error('This inventory entry no longer exists.')
    }

    const entry = InventoryFactory.fromStoredData(entrySnapshot.data())
    entry.assignToBinder(binderId, quantity)

    if (quantity > 0) {
      const binderSnapshot = await transaction.get(binderRef)

      if (!binderSnapshot.exists()) {
        throw new Error('This binder no longer exists.')
      }
    }

    const binderQuantities = entry.binderQuantities
    const assignedQuantity = Object.values(binderQuantities).reduce(
      (total, copies) => total + copies,
      0,
    )

    transaction.update(entryRef, {
      binderQuantities,
      assignedQuantity,
      lastBinderId: binderId,
      updatedAt: serverTimestamp(),
    })
  })
}

/**
 * Deletes an entire owned collection entry.
 * @param {string} userId Firebase Authentication UID.
 * @param {string} entryId Collection entry document ID.
 * @returns {Promise<void>}
 * @throws {Error} If an identifier is invalid or deletion fails.
 */
export async function deleteCollectionEntry(userId, entryId) {
  for (const id of [userId, entryId]) {
    if (typeof id !== 'string' || id.trim() === '' || id.includes('/')) {
      throw new TypeError('Valid user and entry IDs are required.')
    }
  }

  const reference = doc(db, 'users', userId, 'inventory', entryId)

  await deleteDoc(reference)
}
