<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { signInWithEmail } from '@/services/auth'

const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const errorMessage = ref('')

const handleLogin = async () => {
  errorMessage.value = ''
  try {
    await signInWithEmail(email.value, password.value)
    const redirectTo = String(route.query.redirect || '/dashboard')
    router.push(redirectTo)
  } catch (e) {
    errorMessage.value = e?.message || '❌ Invalid email or password.'
  }
}

</script>

<template>
  <v-app>
    <!-- Background Gradient -->
    <div
      class="d-flex align-center justify-center fill-height"
      style="background: linear-gradient(180deg, #0B4F18 0%, #003366 55%, #001b33 100%);"
    >
      
      <!-- Login Card -->
      <v-card class="pa-6" width="400" elevation="6" rounded="xl">
        <div class="d-flex align-center mb-2">
          <v-btn icon="mdi-arrow-left" variant="text" @click="router.push('/')" />
        </div>
        <v-card-title class="text-center text-h5 font-weight-bold text-blue-600">
          Admin Login
        </v-card-title>

        <v-card-text>
          <!-- Email -->
          <v-text-field
            v-model="email"
            label="Email"
            variant="outlined"
            hide-details
            class="mb-4"
          />

          <!-- Password -->
          <v-text-field
            v-model="password"
            label="Password"
            type="password"
            variant="outlined"
            hide-details
            class="mb-4"
          />

          <!-- Error Notification -->
          <v-alert
            v-if="errorMessage"
            type="error"
            variant="tonal"
            border="start"
            class="mb-4"
          >
            {{ errorMessage }}
          </v-alert>

          <!-- Login Button -->
          <v-btn
            block
            color="green"
            size="large"
            class="mt-2 text-white"
            @click="handleLogin"
          >
            Login
          </v-btn>

          <div class="text-caption mt-4 text-center">
            No account yet?
            <v-btn variant="text" color="primary" @click="router.push('/register')">Create one</v-btn>
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

