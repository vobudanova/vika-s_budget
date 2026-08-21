import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Вика.Финансы',
    short_name: 'Вика.Финансы',
    description: 'Личные финансы: траты, амортизация, КАП и фонд КС',
    start_url: '/',
    display: 'standalone',
    background_color: '#f6f8f6',
    theme_color: '#f6f8f6',
    lang: 'ru',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
