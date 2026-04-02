interface ResponsiveGridProps {
  children: React.ReactNode
  cols?: { base?: number; sm?: number; md?: number; lg?: number }
  gap?: string
  className?: string
}

const colMap: Record<number, string> = {
  1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3',
  4: 'grid-cols-4', 5: 'grid-cols-5', 6: 'grid-cols-6',
}
const smMap: Record<number, string> = {
  1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4', 5: 'sm:grid-cols-5', 6: 'sm:grid-cols-6',
}
const mdMap: Record<number, string> = {
  1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3',
  4: 'md:grid-cols-4', 5: 'md:grid-cols-5', 6: 'md:grid-cols-6',
}
const lgMap: Record<number, string> = {
  1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6',
}

export default function ResponsiveGrid({
  children,
  cols = { base: 2, md: 4 },
  gap = 'gap-3',
  className = '',
}: ResponsiveGridProps) {
  const classes = [
    'grid',
    gap,
    cols.base ? colMap[cols.base] : 'grid-cols-2',
    cols.sm ? smMap[cols.sm] : '',
    cols.md ? mdMap[cols.md] : '',
    cols.lg ? lgMap[cols.lg] : '',
    className,
  ].filter(Boolean).join(' ')

  return <div className={classes}>{children}</div>
}
