<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { registerWithEmail, hasAdmin, getCurrentSession, signOut } from '@/services/auth'

const router = useRouter()

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const submitting = ref(false)

const passwordTooShort = computed(() => password.value.length > 0 && password.value.length < 8)
const passwordsMismatch = computed(() => confirmPassword.value.length > 0 && password.value !== confirmPassword.value)

const canSubmit = computed(() => {
  return (
    email.value.trim().length > 0 &&
    password.value.length >= 8 &&
    password.value === confirmPassword.value &&
    !submitting.value
  )
})

const goToLogin = () => router.push('/login')

const handleRegister = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  submitting.value = true
  try {
    await registerWithEmail(email.value, password.value)
    successMessage.value = 'Account created successfully. Redirecting to dashboard...'
    const session = await getCurrentSession()
    if (session) router.push('/dashboard')
  } catch (e) {
    errorMessage.value = e?.message || 'Failed to register admin'
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  // If a user is already logged in and they clicked "Create one",
  // sign them out so they can register a new account instead of being redirected.
  const session = await getCurrentSession()
  if (session) {
    await signOut()
  }
})
</script>

<template>
  <v-app>
    <div class="d-flex align-center justify-center fill-height" style="background: linear-gradient(135deg, #dfe9f3, #e3d8f7);">
      <v-card class="pa-6" width="440" elevation="6" rounded="xl">
        <v-card-title class="text-center text-h5 font-weight-bold text-blue-600">
          Create Admin Account
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="email"
            label="Email"
            variant="outlined"
            hide-details
            class="mb-4"
          />

          <v-text-field
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            label="Password (min 8 chars)"
            variant="outlined"
            :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
            @click:append-inner="showPassword = !showPassword"
            class="mb-2"
          />
          <v-alert v-if="passwordTooShort" type="warning" variant="tonal" class="mb-2">Password is too short.</v-alert>

          <v-text-field
            v-model="confirmPassword"
            :type="showPassword ? 'text' : 'password'"
            label="Confirm Password"
            variant="outlined"
            hide-details
            class="mb-2"
          />
          <v-alert v-if="passwordsMismatch" type="warning" variant="tonal" class="mb-2">Passwords do not match.</v-alert>

          <v-alert v-if="errorMessage" type="error" variant="tonal" border="start" class="mb-3">{{ errorMessage }}</v-alert>
          <v-alert v-if="successMessage" type="success" variant="tonal" border="start" class="mb-3">{{ successMessage }}</v-alert>

          <v-btn :disabled="!canSubmit" block color="primary" size="large" class="mt-2 text-white" @click="handleRegister">
            {{ submitting ? 'Creating...' : 'Create Account' }}
          </v-btn>

          <div class="text-caption mt-4 text-center">
            Already have an account?
            <v-btn variant="text" color="primary" @click="goToLogin">Go to Login</v-btn>
          </div>
        </v-card-text>
      </v-card>
    </div>
  </v-app>
  
</template>

<style>
html, body, #app {
  height: 100%;
  margin: 0;
}
</style>


