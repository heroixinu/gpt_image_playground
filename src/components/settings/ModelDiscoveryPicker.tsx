import { useEffect, useState } from 'react'
import type { ApiProfile } from '../../types'
import { appendDiscoveredModels, fetchAvailableModels } from '../../lib/modelDiscovery'

interface Props {
  profile: ApiProfile
  disabled: boolean
  onApply: (models: string) => void
}

export default function ModelDiscoveryPicker({ profile, disabled, onApply }: Props) {
  const [models, setModels] = useState<string[] | null>(null)
  const [chosen, setChosen] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  // Do not carry model choices across profiles or credentials; cancel in-flight requests.
  useEffect(() => {
    setModels(null)
    setChosen([])
    setSearch('')
    setOpen(false)
    setError(null)
  }, [profile.id, profile.provider, profile.baseUrl, profile.apiKey, profile.apiProxy])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  const load = async () => {
    setError(null)
    setLoading(true)
    setOpen(true)
    try {
      const discovered = await fetchAvailableModels(profile)
      setModels(discovered)
      // Existing choices stay untouched until the user explicitly adds models.
      setChosen([])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }

  const available = models?.filter((id) => id.toLowerCase().includes(search.trim().toLowerCase())) ?? []
  const current = new Set(profile.model.split(',').map((id) => id.trim()).filter(Boolean))
  const allSelected = available.length > 0 && available.every((id) => chosen.includes(id))

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => { if (models !== null && !open) setOpen(true); else void load() }}
          disabled={loading}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10"
        >
          {loading ? '获取中…' : models !== null && !open ? '查看上游模型' : '获取上游模型'}
        </button>
        {models !== null && (
          <span className="text-xs text-gray-500">已获取 {models.length} 个模型</span>
        )}
      </div>
      {open && (
        <div className="space-y-2 rounded-xl border border-gray-200 p-3 dark:border-white/10">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">上游模型</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => void load()} disabled={loading} className="text-xs text-blue-500 disabled:opacity-50">刷新</button>
              <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-500">收起</button>
            </div>
          </div>
          {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
          {models !== null && (
            <>
              <input
                type="search"
                aria-label="搜索上游模型"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="按模型 ID 搜索"
                className="w-full rounded-lg bg-black/[0.04] px-3 py-2 text-sm outline-none dark:bg-white/[0.06]"
              />
              <div className="flex items-center justify-between gap-2 text-xs">
                <label className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    disabled={!available.length || disabled}
                    onChange={(e) => {
                      const visible = new Set(available)
                      setChosen((previous) => e.target.checked
                        ? [...new Set([...previous, ...available])]
                        : previous.filter((id) => !visible.has(id)))
                    }}
                  />
                  全选当前结果
                </label>
                <span className="text-gray-500">已选 {chosen.length}</span>
              </div>
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {available.map((id) => (
                  <label key={id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
                    <input
                      type="checkbox"
                      checked={chosen.includes(id)}
                      disabled={disabled}
                      onChange={(e) => setChosen((previous) => e.target.checked
                        ? [...previous, id]
                        : previous.filter((item) => item !== id))}
                    />
                    <span className="min-w-0 flex-1 break-all">{id}</span>
                    {current.has(id) && <span className="shrink-0 text-gray-400">已配置</span>}
                  </label>
                ))}
                {!available.length && <p className="py-3 text-center text-xs text-gray-500">{models.length ? '没有匹配的模型' : '上游未返回任何模型'}</p>}
              </div>
              <button
                type="button"
                disabled={disabled || chosen.length === 0}
                onClick={() => {
                  onApply(appendDiscoveredModels(profile.model, chosen))
                  setChosen([])
                  setOpen(false)
                }}
                className="w-full rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
              >
                添加所选模型到当前配置
              </button>
              <p className="text-xs text-gray-500">保留已有手动填写的模型；列表不代表模型一定支持图片生成。</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
