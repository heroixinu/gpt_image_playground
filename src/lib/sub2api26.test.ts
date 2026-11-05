import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultOpenAIProfile, DEFAULT_SETTINGS, getCustomProviderDefinition, normalizeSettings } from './apiProfiles'
import { isProfileApiProxyEligible, prepareSettingsForCommit } from './settingsActions'

afterEach(() => vi.unstubAllEnvs())

describe('sub2api async GPT Image 2.6 migration', () => {
  it('keeps the async sub2api default', () => {
    expect(DEFAULT_SETTINGS.profiles[0]).toMatchObject({ provider: 'sb2api-async', streamImages: false })
  })
  it('maps complexity, GIF frames and SVG in the async generator', () => {
    const provider = getCustomProviderDefinition(DEFAULT_SETTINGS, 'sb2api-async')
    expect(provider?.submit).toMatchObject({
      path: 'images/generations/async',
      body: {
        complexity: '$params.complexity',
        frame_count: '$params.frame_count',
        frame_duration_ms: '$params.frame_duration_ms',
        svg: '$params.svg',
      },
    })
    expect(provider?.editSubmit?.body).toMatchObject({
      complexity: '$params.complexity',
      frame_count: '$params.frame_count',
      frame_duration_ms: '$params.frame_duration_ms',
    })
    expect(provider?.editSubmit?.body).not.toHaveProperty('svg')
  })
  it('preserves the async API proxy after saving the profile', () => {
    vi.stubEnv('VITE_API_PROXY_AVAILABLE', 'true')
    const profile = createDefaultOpenAIProfile({
      provider: 'sb2api-async',
      apiProxy: true,
      baseUrl: 'https://sub2api.example.com/v1',
    })
    const settings = normalizeSettings({ profiles: [profile], activeProfileId: profile.id })
    expect(isProfileApiProxyEligible(settings, settings.profiles[0])).toBe(true)
    expect(prepareSettingsForCommit(settings).profiles[0].apiProxy).toBe(true)
  })
})
