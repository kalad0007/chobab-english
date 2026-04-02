export default function PageContainer({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-4 md:p-7 ${className}`}>
      {children}
    </div>
  )
}
