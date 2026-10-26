import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'calculator',
    component: () => import('@/views/CalculatorView.vue'),
    meta: { title: 'Calculator' },
  },
  {
    path: '/shelf',
    name: 'shelf',
    component: () => import('@/views/ShelfView.vue'),
    meta: { title: 'Shelf' },
  },
  {
    path: '/shelf/:id',
    name: 'vial',
    component: () => import('@/views/VialView.vue'),
    props: true,
    meta: { title: 'Vial' },
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/views/HistoryView.vue'),
    meta: { title: 'History' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { title: 'Settings' },
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

/*
 * Hash history: GitHub Pages has no SPA rewrite, so a path URL reloaded offline or opened from
 * a bookmark would 404. With a hash every URL resolves to index.html.
 */
export function createAppRouter() {
  return createRouter({
    history: createWebHashHistory(),
    routes,
    scrollBehavior: () => ({ top: 0 }),
  })
}
