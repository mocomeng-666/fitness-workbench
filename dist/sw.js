/* sw.js — Service Worker：Cache First（应用外壳），安装后核心训练功能可离线使用 */
'use strict';

const VERSION = '3c3acb101e125be6';
const CACHE_PREFIX = 'fitness-workbench:' + self.registration.scope + ':';
const CACHE = CACHE_PREFIX + VERSION;
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  // 构建产物 dist/index.html 已内联全部 css/js；icon 为 data-URI 无需缓存
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (!SHELL.some(path => new URL(path, self.registration.scope).href === url.origin + url.pathname)) return;
  e.respondWith(
    caches.open(CACHE).then(c => c.match(e.request, { ignoreSearch: true })).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(resp => {
        // 同源静态资源运行时缓存
        if (resp.ok && new URL(e.request.url).origin === self.location.origin) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => {
        if (e.request.mode === 'navigate') return caches.open(CACHE).then(c => c.match(new URL('./index.html', self.registration.scope).href));
        return new Response('', { status: 504, statusText: 'offline' });
      });
    })
  );
});
