import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all rounded cursor-pointer',
        {
          primary: 'bg-ink text-cream hover:bg-black',
          secondary: 'bg-cream-2 text-ink border border-ink/10 hover:bg-cream-3',
          ghost: 'text-ink-3 hover:text-ink',
        }[variant],
        { sm: 'text-xs px-3 py-1.5', md: 'text-sm px-4 py-2', lg: 'text-base px-6 py-3' }[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
