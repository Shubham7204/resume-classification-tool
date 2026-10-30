// JSON-mode chat completion with provider fallback: Groq first, then Ollama Cloud.
// Used for the two "agent" steps: drafting a rubric from a JD, and planning/summarising talent searches.

interface Provider {
  name: string
  apiKey: string | undefined
  call: (apiKey: string, system: string, user: string) => Promise<string | undefined>
}

const PROVIDERS: Provider[] = [
  ...['openai/gpt-oss-120b', 'openai/gpt-oss-20b'].map(
    (model): Provider => ({
      name: `Groq · ${model}`,
      apiKey: process.env.GROQ_API_KEY,
      call: async (apiKey, system, user) => {
        const data = await postJson('https://api.groq.com/openai/v1/chat/completions', apiKey, {
          model,
          temperature: 0,
          max_tokens: 3000,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ]
        })
        return data.choices?.[0]?.message?.content
      }
    })
  ),
  {
    name: 'Ollama Cloud · gpt-oss:120b',
    apiKey: process.env.OLLAMA_API_KEY,
    call: async (apiKey, system, user) => {
      const data = await postJson('https://ollama.com/api/chat', apiKey, {
        model: 'gpt-oss:120b',
        stream: false,
        format: 'json',
        options: { temperature: 0 },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
      return data.message?.content
    }
  }
]

async function postJson(url: string, apiKey: string, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(40_000),
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 200)}`)
  return response.json()
}

/**
 * Returns the first provider's parsed JSON that passes `accept`, or null if every provider
 * is unconfigured, fails, or returns something unusable.
 */
export async function askJson<T>(
  system: string,
  user: string,
  accept: (parsed: Record<string, unknown>) => T | null
): Promise<{ value: T; provider: string } | null> {
  for (const provider of PROVIDERS) {
    if (!provider.apiKey) continue
    try {
      const content = await provider.call(provider.apiKey, system, user)
      if (!content) continue
      const value = accept(JSON.parse(content))
      if (value !== null) return { value, provider: provider.name }
      console.warn(`${provider.name} returned an unusable response`)
    } catch (err) {
      console.warn(`${provider.name} failed:`, err instanceof Error ? err.message : err)
    }
  }
  return null
}
