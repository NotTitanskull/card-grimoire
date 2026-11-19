import { addDoc, collection, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { Binder } from '../models/Binder.js'
import { db } from './firestore.js'

/**
 * A binder model with the metadata from its Firestore document.
 * @typedef {Object} BinderRecord
 * @property {string} id Firestore document ID.
 * @property {Binder} binder Validated binder data.
 * @property {import('firebase/firestore').Timestamp | null} createdAt Server creation timestamp.
 * @property {import('firebase/firestore').Timestamp | null} updatedAt Server update timestamp.
 */

/**
 * Resolves the binder collection for a single account.
 * @param {string} userId Firebase Authentication UID.
 * @returns {import('firebase/firestore').CollectionReference}
 * @throws {TypeError} If the user ID is invalid.
 */
function bindersCollection(userId) {
  if (typeof userId !== 'string' || userId.trim() === '' || userId.includes('/')) {
    throw new TypeError('A valid user ID is required.')
  }

  return collection(db, 'users', userId, 'binders')
}

/**
 * Saves a validated binder with server timestamps under its owner's account.
 * @param {string} userId Firebase Authentication UID.
 * @param {Binder} binder Binder to save.
 * @returns {Promise<string>} ID of the saved binder.
 * @throws {Error} If validation or the write fails.
 */
export async function createBinder(userId, binder) {
  if (!(binder instanceof Binder)) {
    throw new TypeError('A Binder instance is required.')
  }

  const document = await addDoc(bindersCollection(userId), {
    name: binder.name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return document.id
}

/**
 * Retrieves the account's binders, newest first, with document metadata kept separate.
 * @param {string} userId Firebase Authentication UID.
 * @returns {Promise<BinderRecord[]>}
 * @throws {Error} If the query fails or a saved binder is invalid.
 */
export async function getBinders(userId) {
  const snapshot = await getDocs(query(bindersCollection(userId), orderBy('createdAt', 'desc')))

  return snapshot.docs.map((document) => {
    const data = document.data()

    return {
      id: document.id,
      binder: new Binder(data.name),
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }
  })
}
