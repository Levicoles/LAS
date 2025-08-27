<script setup>
import { ref } from 'vue'

const username = ref('')
const password = ref('')

const handleLogin = () => {
  if (username.value && password.value) {
    alert(`Username: ${username.value}\nPassword: ${password.value}`)
  } else {
    alert('Please enter username and password.')
  }
}
</script>

<template>
  <v-app>
    <!-- Background Gradient -->
    <div class="d-flex align-center justify-center fill-height" style="background: linear-gradient(135deg, #dfe9f3, #e3d8f7);">
      <!-- Login Card -->
      <v-card class="pa-6" width="400" elevation="6" rounded="xl">
        <v-card-title class="text-center text-h5 font-weight-bold text-blue-600">
          Admin Login
        </v-card-title>

        <v-card-text>
          <v-text-field
            v-model="username"
            label="Username"
            variant="outlined"
            hide-details
            class="mb-4"
          />

          <v-text-field
            v-model="password"
            label="Password"
            type="password"
            variant="outlined"
            hide-details
            class="mb-4"
          />

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
