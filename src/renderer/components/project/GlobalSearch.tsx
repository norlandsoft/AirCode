import { useState, useCallback } from 'react'
import { Search, X, FileText } from 'lucide-react'
import type { SearchResult } from '../../../shared/types'
import { useProjectStore } from '@/stores/project'

interface GlobalSearchProps {
  projectPath: string
  onResultClick: (result: SearchResult) => void
}

export function GlobalSearch({ projectPath, onResultClick }: GlobalSearchProps) {
  const { searchQuery, searchResults, setSearchQuery, setSearchResults } = useProjectStore()
  const [isSearching, setIsSearching] = useState(false)

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)
    try {
      const results = await window.api.files.search(projectPath, searchQuery.trim())
      setSearchResults(results)
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery, projectPath, setSearchResults])

  return (
    <div className="border-b border-[var(--border)] bg-[var(--background-alt)]">
      <div className="flex items-center gap-2 px-3 py-2">
        <Search size={14} className="shrink-0 text-[var(--foreground-subtle)]" />
        <input
          className="min-w-0 flex-1 bg-transparent text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--foreground-subtle)]"
          placeholder="搜索文件内容..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch()
          }}
          autoFocus
        />
        {isSearching && <span className="text-xs text-[var(--foreground-subtle)]">搜索中...</span>}
      </div>

      {searchResults.length > 0 && (
        <div className="max-h-[300px] overflow-y-auto border-t border-[var(--border)]">
          {searchResults.map((result, i) => (
            <div
              key={`${result.filePath}-${result.line}-${i}`}
              className="flex cursor-pointer items-start gap-2 px-3 py-1.5 text-xs hover:bg-[var(--hover-bg)]"
              onClick={() => onResultClick(result)}
            >
              <FileText size={12} className="mt-0.5 shrink-0 text-[var(--foreground-subtle)]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{result.fileName}</span>
                  <span className="text-[var(--foreground-subtle)]">:{result.line}</span>
                </div>
                <div className="truncate text-[var(--foreground-subtle)]">
                  {result.text.slice(0, Math.max(0, result.matchStart))}
                  <mark className="bg-yellow-200 text-[var(--foreground)]">
                    {result.text.slice(result.matchStart, result.matchEnd)}
                  </mark>
                  {result.text.slice(result.matchEnd)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {searchResults.length === 0 && searchQuery && !isSearching && (
        <div className="px-3 py-3 text-center text-xs text-[var(--foreground-subtle)]">
          没有找到结果
        </div>
      )}
    </div>
  )
}
