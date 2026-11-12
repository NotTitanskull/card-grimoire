import { createRouter, createWebHashHistory } from 'vue-router'

import CollectionView from '../views/CollectionView.vue'
import TradeView from '../views/TradeView.vue'
import BindersView from '../views/BindersView.vue'

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
        },
        {
            path: '/trade',
            name: 'trade',
            component: TradeView,
        },
        {
            path: '/binders',
            name: 'binders',
            component: BindersView,
        },
    ],
})

export default router