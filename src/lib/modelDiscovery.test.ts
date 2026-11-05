import { afterEach, describe, expect, it, vi } from 'vitest'
import { appendDiscoveredModels, fetchAvailableModels, parseDiscoveredModels, supportsModelDiscovery } from './modelDiscovery'
import { createDefaultOpenAIProfile } from './apiProfiles'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('model discovery', () => {
  it('enables the OpenAI-compatible and sub2api async providers', () => {
    expect(supportsModelDiscovery('openai')).toBe(true)
    expect(supportsModelDiscovery('sb2api-async')).toBe(true)
    expect(supportsModelDiscovery('fal')).toBe(false)
  })

  it('extracts unique IDs and ignores invalid entries', () => {
    expect(parseDiscoveredModels({
      object: 'list',
      data: [
        { id: ' gpt-image-2 ' },
        { id: 'gpt-image-2' },
        { id: 'custom/image-model' },
        { id: 'bad,model' },
        { id: '' },
        null,
        { name: 'no-id' },
      ],
    })).toEqual(['gpt-image-2', 'custom/image-model'])
    expect(() => parseDiscoveredModels({ models: [] })).toThrow(/data/)
  })

  it('appends selected models without erasing custom models', () => {
    expect(appendDiscoveredModels('manual-model, gpt-image-2', [
      'gpt-image-2',
      'gpt-image-2.5-sunburst',
    ])).toBe('manual-model, gpt-image-2, gpt-image-2.5-sunburst')
  })

  it('requests sub2api GET /v1/models using the profile API key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      object: 'list',
      data: [{ id: 'image-a' }, { id: 'image-b' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const models = await fetchAvailableModels(createDefaultOpenAIProfile({
      provider: 'sb2api-async',
      baseUrl: 'https://sub.example.com/v1',
      apiKey: 'secret-key',
      apiProxy: false,
    }))
    expect(models).toEqual(['image-a', 'image-b'])
    expect(fetchMock).toHaveBeenCalledWith('https://sub.example.com/v1/models', expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({ Authorization: 'Bearer secret-key' }),
    }))
  })

  it('never modifies configured models if the upstream API fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)
    const profile = createDefaultOpenAIProfile({
      provider: 'sb2api-async',
      baseUrl: 'https://sub.example.com/v1',
      apiKey: 'wrong',
      model: 'manually-added',
    })
    await expect(fetchAvailableModels(profile)).rejects.toThrow(/401/)
    expect(profile.model).toBe('manually-added')
  })
})
