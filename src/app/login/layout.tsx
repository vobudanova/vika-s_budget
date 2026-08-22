// title для клиентской страницы логина: metadata нельзя экспортировать из 'use client'
export const metadata = { title: 'Вход' };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
