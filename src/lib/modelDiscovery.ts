import type { ApiProfile } from '../types'
import { buildApiUrl, readClientDevProxyConfig, shouldUseApiProxy } from './devProxy'
import { apiFetch } from './platform'

/** OpenAI and sub2api share the OpenAI-compatible GET /v1/models endpoint. */
export function supportsModelDiscovery(provider: ApiProfile['provider']): boolean {
  return provider === 'openai' || provider === 'sb2api-async'
}

/** Parse the public model-list protocol without assuming any model capability metadata. */
export function parseDiscoveredModels(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object' || !('data' in payload) || !Array.isArray(payload.data)) {
    throw new Error('上游返回的模型列表格式不正确（缺少 data 数组）')
  }

  const models = payload.data
    .map((item: unknown) => {
      if (!item || typeof item !== 'object' || !('id' in item)) return ''
      return typeof item.id === 'string' ? item.id.trim() : ''
    })
    // The existing configuration uses comma-separated IDs, so never import an ambiguous ID.
    .filter((id: string) => id.length > 0 && id.length <= 256 && !/[,\r\n]/.test(id))

  return [...new Set<string>(models)]
}

/** Add discovered IDs while keeping user-defined models and their original order. */
export function appendDiscoveredModels(current: string, additions: readonly string[]): string {
  const existing = current.split(',').map((id) => id.trim()).filter(Boolean)
  const incoming = additions.map((id) => id.trim()).filter((id) => id && !/[,\r\n]/.test(id))
  return [...new Set([...existing, ...incoming])].join(', ')
}

export async function fetchAvailableModels(profile: ApiProfile, signal?: AbortSignal): Promise<string[]> {
  if (!supportsModelDiscovery(profile.provider)) {
    throw new Error('当前服务商暂不支持动态获取模型列表')
  }
  if (!profile.apiKey.trim()) {
    throw new Error('请先填写 API Key，再获取模型列表')
  }

  const proxyConfig = readClientDevProxyConfig()
  const useProxy = shouldUseApiProxy(profile.apiProxy, proxyConfig)
  if (!profile.baseUrl.trim() && !useProxy) {
    throw new Error('请先填写 API 地址，再获取模型列表')
  }

  const response = await apiFetch(buildApiUrl(profile.baseUrl, 'models', proxyConfig, useProxy), {
    method: 'GET',
    headers: {
      Authorization: 'Bearer ' + profile.apiKey.trim(),
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal,
  })

  if (!response.ok) {
    let detail = ''
    if (response.status === 401 || response.status === 403) detail = '，请检查 API Key 和模型访问权限'
    if (response.status === 404) detail = '，上游可能未提供 /v1/models 接口'
    throw new Error('获取模型列表失败（HTTP ' + response.status + detail + '）')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('上游模型列表不是有效的 JSON')
  }
  return parseDiscoveredModels(payload)
}
