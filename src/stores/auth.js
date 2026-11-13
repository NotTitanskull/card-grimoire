import { computed, onScopeDispose, ref } from 'vue'
import { defineStore } from 'pinia'
import { observeAuthState } from '../services/auth'

export const useAuthStore = defineStore('auth', () => {
    const user = ref(null)
    const initialized = ref(false)

    const isAuthenticated = computed(() => user.value !== null)

    let initializationPromise = null
    let stopObserving = null

    /**
     * Starts one authentication listener and waits for the initial session.
     * Repeated calls reuse the same initialization promise.
     * @returns {Promise<void>}
     */
    function initialize() {
        if (!initializationPromise) {
            initializationPromise = new Promise((resolve) => {
                stopObserving = observeAuthState((firebaseUser) => {
                    user.value = firebaseUser
                        ? {
                            uid: firebaseUser.uid,
                            email: firebaseUser.email,
                            displayName: firebaseUser.displayName,
                        }
                        : null

                    initialized.value = true
                    resolve()
                })
            })
        }

        return initializationPromise
    }

    onScopeDispose(() => {
        stopObserving?.()
    })

    return {
        user,
        initialized,
        isAuthenticated,
        initialize,
    }
})