<script setup>
import { ref } from 'vue'

const username = ref('')
const password = ref('')
const errorMessage = ref('')

const handleLogin = () => {
  if (username.value === 'admin' && password.value === 'admin123') {
    errorMessage.value = ''
    alert('✅ Login successful! Welcome Admin.')
    // Example redirect (if you are using vue-router)
    // router.push('/dashboard')
  } else {
    errorMessage.value = '❌ Invalid username or password.'
  }
}
</script>

<template>
  <v-app>
    <!-- Background Gradient -->
    <div class="d-flex align-center justify-center fill-height" 
         style="background: linear-gradient(135deg, #dfe9f3, #e3d8f7);">
      
      <!-- Login Card -->
      <v-card class="pa-6" width="400" elevation="6" rounded="xl">
        <v-card-title class="text-center text-h5 font-weight-bold text-blue-600">
          Admin Login
        </v-card-title>

        <v-card-text>
          <!-- Username -->
          <v-text-field
            v-model="username"
            label="Username"
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
            color="blue"
            size="large"
            class="mt-2 text-white"
            @click="handleLogin"
          >
            Login
          </v-btn>
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
