export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { installDnsFallback } = await import('@/lib/server/dns-fallback')
    installDnsFallback()
  }
}
