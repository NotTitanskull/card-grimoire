import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { InventoryFactory } from '../factories/InventoryFactory.js'
import { db } from './firestore.js'

/** @typedef {import('../models/Inventory.js').Inventory} Inventory */
/** @typedef {{id: string, entry: Inventory, createdAt: import('firebase/firestore').Timestamp, updatedAt: import('firebase/firestore').Timestamp}} CollectionRecord */

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

  const validated = InventoryFactory.copy(entry)
  const card = validated.card

  const data = {
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

  const validated = InventoryFactory.copy(entry)
  const reference = doc(db, 'users', userId, 'inventory', entryId)

  await updateDoc(reference, {
    quantity: validated.quantity,
    condition: validated.condition,
    finish: validated.finish,
    purchasePriceMinor: validated.purchasePriceMinor,
    currency: validated.currency,
    favorite: validated.favorite,
    availableForTrade: validated.availableForTrade,
    binderQuantities: { ...validated.binderQuantities },
    updatedAt: serverTimestamp(),
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
