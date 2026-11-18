import { addDoc, collection, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { Binder } from '../models/Binder.js'
import { db } from './firestore.js'

function bindersCollection(userId) {
  if (typeof userId !== 'string' || userId.trim() === '' || userId.includes('/')) {
    throw new TypeError('A valid user ID is required.')
  }

  return collection(db, 'users', userId, 'binders')
}

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
