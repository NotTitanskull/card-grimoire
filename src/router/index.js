import {createRouter, createWebHashHistory} from 'vue-router'
import {useAuthStore} from '../stores/auth'

const CollectionView = () => import('../views/CollectionView.vue')
const TradeView = () => import('../views/TradeView.vue')
const BindersView = () => import('../views/BindersView.vue')
const AuthView = () => import('../views/AuthView.vue')

const router = createRouter({
    history: createWebHashHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            redirect: '/collection',
        },
        {
            path: '/collection',
            name: 'collection',
            component: CollectionView,
            meta: {requiresAuth: true},
        },
        {
            path: '/trade',
            name: 'trade',
            component: TradeView,
            meta: {requiresAuth: true},
        },
        {
            path: '/binders',
            name: 'binders',
            component: BindersView,
            meta: {requiresAuth: true},
        },
        {
            path: '/auth',
            name: 'auth',
            component: AuthView,
        },
    ],
});

/**
 * Waits for the initial session before checking access to a route.
 */
router.beforeEach(async (to) => {
    const authStore = useAuthStore()

    await authStore.initialize()

    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
        return {name: 'auth'}
    }

    if (to.name === 'auth' && authStore.isAuthenticated) {
        return {name: 'collection'}
    }
});

export default router