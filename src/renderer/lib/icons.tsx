import { useRef, useEffect } from 'react'

const iconModules = import.meta.glob<{ default: string }>('../assets/icons/*.svg', {
  query: '?raw',
  eager: true
})

const iconCache = new Map<string, string>()

for (const [path, mod] of Object.entries(iconModules)) {
  const name = path.split('/').pop()!.replace('.svg', '')
  iconCache.set(name, mod.default)
}

interface IconProps {
  name: string
  size?: number
  className?: string
}

export function Icon({ name, size = 20, className }: IconProps) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const svg = iconCache.get(name)
    if (!svg) return
    ref.current.innerHTML = svg
    const svgEl = ref.current.querySelector('svg')
    if (svgEl) {
      svgEl.setAttribute('width', String(size))
      svgEl.setAttribute('height', String(size))
      if (className) svgEl.setAttribute('class', className)
    }
  }, [name, size, className])

  return <span ref={ref} className="inline-flex items-center justify-center" style={{ width: size, height: size }} />
}
