import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '@/views/LoginView.vue'
import RegisterAdminView from '@/views/RegisterAdminView.vue'
import DashboardAdmin from '@/components/DashboardAdmin.vue'
import MainView from '@/components/MainView.vue'
import { isAuthenticated, isCurrentUserAdmin, hasAdmin } from '@/services/auth'

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
router.beforeEach(async (to) => {
  // Short-circuit: if user already authenticated, do not block by admin-existence check
  const authed = await isAuthenticated()

  // If no admin exists yet and user is not authenticated, only allow register/home
  if (!authed) {
    const adminExists = await hasAdmin()
    if (!adminExists && to.path !== '/register' && to.path !== '/' && to.path !== '/login') {
      return { path: '/register' }
    }
  }

  // Protect routes that require auth
  if (to.meta?.requiresAuth) {
    if (!authed) return { path: '/login', query: { redirect: to.fullPath } }
    // Only admins can access dashboard
    if (to.path === '/dashboard') {
      const isAdmin = await isCurrentUserAdmin()
      if (!isAdmin) {
        // If no admin exists yet, allow the first authenticated user through
        const adminExistsNow = await hasAdmin()
        if (adminExistsNow) {
          return { path: '/' }
        }
      }
    }
  }
  return true
})

export default router
