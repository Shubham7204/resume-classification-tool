// Some networks' DNS (e.g. Jio) refuse to resolve hosts such as Neon Object Storage's
// *.storage.*.neon.tech, while public resolvers answer fine. When the system lookup fails,
// retry through Google/Cloudflare DNS. Only this Node process is affected; system settings are not.

import dns from 'dns'

const RETRYABLE = new Set(['ENOTFOUND', 'EREFUSED', 'ESERVFAIL', 'EAI_AGAIN'])

export function installDnsFallback() {
  const g = globalThis as typeof globalThis & { __dnsFallbackInstalled?: boolean }
  if (g.__dnsFallbackInstalled) return
  g.__dnsFallbackInstalled = true

  const resolver = new dns.promises.Resolver()
  resolver.setServers(['8.8.8.8', '1.1.1.1', '2001:4860:4860::8888', '2606:4700:4700::1111'])
  const systemLookup = dns.lookup

  async function publicLookup(hostname: string, family: number) {
    const v4 = family === 6 ? [] : await resolver.resolve4(hostname).catch(() => [] as string[])
    const v6 = family === 4 || v4.length ? [] : await resolver.resolve6(hostname).catch(() => [] as string[])
    return [...v4.map((address) => ({ address, family: 4 })), ...v6.map((address) => ({ address, family: 6 }))]
  }

  // Same signature as dns.lookup: (hostname, [options], callback).
  function lookup(hostname: string, options: unknown, callback?: unknown) {
    const cb = (typeof options === 'function' ? options : callback) as (...args: unknown[]) => void
    const opts = (typeof options === 'function' ? {} : typeof options === 'number' ? { family: options } : (options ?? {})) as dns.LookupOptions
    systemLookup(hostname, opts, (err: NodeJS.ErrnoException | null, ...rest: unknown[]) => {
      if (!err || !RETRYABLE.has(err.code ?? '')) return cb(err, ...rest)
      publicLookup(hostname, Number(opts.family) || 0).then(
        (found) => {
          if (!found.length) return cb(err, ...rest)
          if (opts.all) cb(null, found)
          else cb(null, found[0].address, found[0].family)
        },
        () => cb(err, ...rest)
      )
    })
  }

  ;(dns as { lookup: unknown }).lookup = lookup
}
