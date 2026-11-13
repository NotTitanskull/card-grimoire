<script setup>
import {ref} from 'vue'
import {useRouter} from 'vue-router'
import {loginUser, registerUser} from '../services/auth'

const router = useRouter()

const mode = ref('login')
const email = ref('')
const password = ref('')
const submitting = ref(false)
const errorMessage = ref('')

const emailRules = [
  (value) => Boolean(value.trim()) || 'Enter your email address.',
]

const passwordRules = [
  (value) => Boolean(value) || 'Enter your password.',
]

/**
 * Submits credentials through the authentication service.
 * Navigates to the collection when authentication succeeds.
 * @returns {Promise<void>}
 */
async function submit() {
  if (submitting.value) return

  submitting.value = true
  errorMessage.value = ''

  try {
    if (mode.value === 'register') {
      await registerUser(email.value, password.value)
    } else {
      await loginUser(email.value, password.value)
    }

    password.value = ''
    await router.push({name: 'collection'})
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Authentication error code:', error.code)
    }
    const messages = {
      'auth/invalid-email': 'Enter a valid email address.',
      'auth/invalid-credential': 'Unable to sign in. Check your email and password.',
      'auth/weak-password': 'Choose a stronger password that meets the account requirements.',
      'auth/password-does-not-meet-requirements':
          'Choose a password that meets the account requirements.',
      'auth/email-already-in-use':
          'Unable to create this account. Try signing in instead.',
      'auth/too-many-requests': 'Too many attempts. Please try again later.',
      'auth/network-request-failed':
          'Unable to connect. Check your connection and try again.',
    }

    errorMessage.value =
        messages[error.code] ?? 'Authentication failed. Please try again.'
  } finally {
    submitting.value = false
  }
}

/**
 * Clears sensitive input and feedback when switching form modes.
 * @returns {void}
 */
function resetFeedback() {
  password.value = ''
  errorMessage.value = ''
}
</script>

<template>
  <section class="auth-page">
    <h1 class="text-h4 text-weight-bold q-mt-none q-mb-sm">
      Your Card Grimoire
    </h1>
    <p>Sign in or create an account to manage your collection.</p>

    <q-card flat bordered>
      <q-tabs
          v-model="mode"
          active-color="primary"
          indicator-color="primary"
          no-caps
          @update:model-value="resetFeedback"
      >
        <q-tab name="login" label="Sign in" :disable="submitting"/>
        <q-tab name="register" label="Create account" :disable="submitting"/>
      </q-tabs>

      <q-separator/>

      <q-card-section>
        <q-form :key="mode" class="q-gutter-y-md" @submit="submit">
          <q-input
              v-model="email"
              label="Email address"
              type="email"
              autocomplete="email"
              outlined
              hide-bottom-space
              :rules="emailRules"
              :disable="submitting"
          />

          <q-input
              v-model="password"
              label="Password"
              type="password"
              :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
              outlined
              hide-bottom-space
              :rules="passwordRules"
              :disable="submitting"
          />

          <q-banner
              v-if="errorMessage"
              class="bg-red-1 text-negative rounded-borders"
              role="alert"
          >
            {{ errorMessage }}
          </q-banner>

          <q-btn
              type="submit"
              color="primary"
              class="full-width"
              :label="mode === 'register' ? 'Create account' : 'Sign in'"
              :loading="submitting"
              :disable="submitting"
              no-caps
          />
        </q-form>
      </q-card-section>
    </q-card>
  </section>
</template>

<style scoped lang="scss">
.auth-page {
  width: 100%;
  max-width: 28rem;
  margin-inline: auto;
}
</style>