<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from '@/services/supabaseClient'

const router = useRouter()
const route = useRoute()

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
    password.value.length >= 8 &&
    password.value === confirmPassword.value &&
    !submitting.value
  )
})

const handleResetPassword = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  submitting.value = true
  
  try {
    const { error } = await supabase.auth.updateUser({
      password: password.value
    })
    
    if (error) throw error
    
    successMessage.value = 'Password updated successfully! Redirecting to login...'
    setTimeout(() => {
      router.push('/login')
    }, 2000)
  } catch (e) {
    errorMessage.value = e?.message || 'Failed to reset password'
  } finally {
    submitting.value = false
  }
}

const goToLogin = () => router.push('/login')

onMounted(async () => {
  // Check if user came from a valid reset link
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    errorMessage.value = 'Invalid or expired reset link. Please request a new password reset.'
  }
})
</script>

<template>
  <v-app>
    <div
      class="d-flex align-center justify-center fill-height"
      style="background: linear-gradient(180deg, #0B4F18 0%, #003366 55%, #001b33 100%);"
    >
      <v-card class="pa-6" width="440" elevation="6" rounded="xl">
        <v-card-title class="text-center text-h5 font-weight-bold text-blue-600">
          <v-icon color="primary" size="32" class="mr-2">mdi-lock-reset</v-icon>
          Reset Password
        </v-card-title>
        <v-card-text>
          <p class="text-body-2 text-grey-darken-1 mb-4 text-center">
            Enter your new password below.
          </p>

          <v-text-field
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            label="New Password (min 8 chars)"
            variant="outlined"
            :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
            @click:append-inner="showPassword = !showPassword"
            class="mb-2"
          />
          <v-alert v-if="passwordTooShort" type="warning" variant="tonal" class="mb-2">Password is too short.</v-alert>

          <v-text-field
            v-model="confirmPassword"
            :type="showPassword ? 'text' : 'password'"
            label="Confirm New Password"
            variant="outlined"
            hide-details
            class="mb-2"
          />
          <v-alert v-if="passwordsMismatch" type="warning" variant="tonal" class="mb-2">Passwords do not match.</v-alert>

          <v-alert v-if="errorMessage" type="error" variant="tonal" border="start" class="mb-3">{{ errorMessage }}</v-alert>
          <v-alert v-if="successMessage" type="success" variant="tonal" border="start" class="mb-3">{{ successMessage }}</v-alert>

          <v-btn :disabled="!canSubmit" block color="green" size="large" class="mt-2 text-white" @click="handleResetPassword">
            {{ submitting ? 'Updating...' : 'Update Password' }}
          </v-btn>

          <div class="text-caption mt-4 text-center">
            Remember your password?
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

