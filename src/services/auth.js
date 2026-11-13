import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
} from 'firebase/auth'

import { auth } from './firebase'

/**
 * Creates an account and signs the user in.
 * @param {string} email User's email address.
 * @param {string} password User's chosen password.
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export function registerUser(email, password) {
    return createUserWithEmailAndPassword(auth, email.trim(), password)
}

/**
 * Signs in an existing user.
 * @param {string} email User's email address.
 * @param {string} password User's password.
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export function loginUser(email, password) {
    return signInWithEmailAndPassword(auth, email.trim(), password)
}

/**
 * Signs out the current user.
 * @returns {Promise<void>}
 */
export function logoutUser() {
    return signOut(auth)
}

/**
 * Observes the initial session and subsequent sign-in/sign-out changes.
 * @param {(user: import('firebase/auth').User | null) => void} callback
 * @returns {() => void} Function that stops listening.
 */
export function observeAuthState(callback) {
    return onAuthStateChanged(auth, callback)
}