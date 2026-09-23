import Link from 'next/link'
import { LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  title: string
  description: string
  action?: { label: string; href: string }
}

export default function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="relative flex flex-col items-center text-center py-20 px-6 border border-dashed border-border rounded-md bg-background overflow-hidden">
      {/* Engineering Blueprint Grid */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(to right, #0F172A 1px, transparent 1px), linear-gradient(to bottom, #0F172A 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }}
      />
      
      <div className="relative z-10 w-16 h-16 rounded flex items-center justify-center mb-6 bg-surface border border-border shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
        {/* Reticles to tie into the biometric theme */}
        <div className="absolute top-1 left-1 w-1 h-1 border-t border-l border-text-muted/50" />
        <div className="absolute bottom-1 right-1 w-1 h-1 border-b border-r border-text-muted/50" />
        <Icon className="w-6 h-6 text-text-muted" strokeWidth={1.5} />
      </div>
      
      <h3 className="relative z-10 text-lg font-display font-bold text-text-primary mb-2 tracking-tight">
        {title}
      </h3>
      
      <p className="relative z-10 text-sm text-text-secondary max-w-xs mb-8 leading-relaxed">
        {description}
      </p>
      
      {action && (
        <Link href={action.href} className="relative z-10 btn-primary">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" />
            {action.label}
          </span>
        </Link>
      )}
    </div>
  )
}
