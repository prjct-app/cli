import { ChevronDown } from "lucide-react"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export interface FilterDropdownProps {
  label: string
  options: string[]
  value: string[]
  onChange: (v: string[]) => void
  renderOption?: (opt: string) => React.ReactNode
}

export function FilterDropdown({ label, options, value, onChange, renderOption }: FilterDropdownProps) {
  if (options.length === 0) return null

  const toggle = (opt: string) => {
    if (value.includes(opt)) onChange(value.filter(v => v !== opt))
    else onChange([...value, opt])
  }

  const count = value.length
  const hasActive = count > 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-xs font-medium transition-colors outline-none",
            "focus-visible:ring-1 focus-visible:ring-ring",
            hasActive
              ? "border-foreground/20 bg-surface-2 text-foreground"
              : "border-border bg-transparent text-muted-foreground hover:text-foreground hover:bg-surface-2/60"
          )}
        >
          <span>{label}</span>
          {hasActive && (
            <span className="inline-flex items-center justify-center text-micro tabular-nums rounded-full bg-foreground text-background px-1.5 min-w-[18px] leading-[16px] font-semibold">
              {count}
            </span>
          )}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[180px]">
        {options.map(opt => (
          <DropdownMenuCheckboxItem
            key={opt}
            checked={value.includes(opt)}
            onCheckedChange={() => toggle(opt)}
            onSelect={(e) => e.preventDefault()}
            className="text-xs capitalize"
          >
            {renderOption ? renderOption(opt) : opt.replace(/_/g, ' ')}
          </DropdownMenuCheckboxItem>
        ))}
        {hasActive && (
          <>
            <DropdownMenuSeparator />
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-sm transition-colors"
            >
              Clear {label.toLowerCase()}
            </button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
