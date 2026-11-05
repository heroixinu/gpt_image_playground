import { createDefaultOpenAIProfile, DEFAULT_SETTINGS } from '../apiProfiles'

// Upstream tests exercise OpenAI-specific behavior. Use an explicit OpenAI fixture
// instead of changing the fork's actual sub2api-async deployment default.
const openAIProfile = createDefaultOpenAIProfile()
export const OPENAI_TEST_DEFAULT_SETTINGS = {
  ...DEFAULT_SETTINGS,
  profiles: [openAIProfile],
  activeProfileId: openAIProfile.id,
}
