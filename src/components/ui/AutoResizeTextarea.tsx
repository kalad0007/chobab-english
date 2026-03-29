'use client'

import { useRef, useEffect } from 'react'

interface Props {
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  placeholder?: string
  minRows?: number
  className?: string
  required?: boolean
}

export default function AutoResizeTextarea({ value, onChange, placeholder, minRows = 2, className, required }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={minRows}
      required={required}
      style={{ overflow: 'hidden', resize: 'none' }}
      className={className}
    />
  )
}
