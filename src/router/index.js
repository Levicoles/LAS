import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '@/views/LoginView.vue'
import RegisterAdminView from '@/views/RegisterAdminView.vue'
import DashboardAdmin from '@/components/DashboardAdmin.vue'
import MainView from '@/components/MainView.vue'
import { isAuthenticated, isAdminRegistered } from '@/services/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: MainView,
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterAdminView,
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardAdmin,
      meta: { requiresAuth: true },
    },

  ],
})

// Global navigation guard
router.beforeEach((to) => {
  // If no admin exists, only allow access to register (and home)
  if (!isAdminRegistered() && to.path !== '/register' && to.path !== '/') {
    return { path: '/register' }
  }
  // Protect routes that require auth
  if (to.meta?.requiresAuth && !isAuthenticated()) {
    return { path: '/login' }
  }
  return true
})

export default router
