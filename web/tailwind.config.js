import animate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  safelist: [
    // Priority dynamic classes used by taskStyles helper
    'border-l-priority-critical', 'border-l-priority-high', 'border-l-priority-medium', 'border-l-priority-low', 'border-l-priority-normal',
    'text-priority-critical', 'text-priority-high', 'text-priority-medium', 'text-priority-low', 'text-priority-normal',
    'bg-priority-critical-bg', 'bg-priority-high-bg', 'bg-priority-medium-bg', 'bg-priority-low-bg', 'bg-priority-normal-bg',
    'bg-priority-critical', 'bg-priority-high', 'bg-priority-medium', 'bg-priority-low', 'bg-priority-normal',
    // Type dynamic classes
    'text-type-bug', 'text-type-feature', 'text-type-improvement', 'text-type-security', 'text-type-chore',
    'bg-type-bug-bg', 'bg-type-feature-bg', 'bg-type-improvement-bg', 'bg-type-security-bg', 'bg-type-chore-bg',
    'bg-type-bug', 'bg-type-feature', 'bg-type-improvement', 'bg-type-security', 'bg-type-chore',
    // Status dynamic classes
    'text-status-active', 'text-status-blocked', 'text-status-done',
    'bg-status-active-bg', 'bg-status-blocked-bg', 'bg-status-done-bg',
    'bg-status-active', 'bg-status-blocked', 'bg-status-done',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        surface: {
          1: 'hsl(var(--surface-1))',
          2: 'hsl(var(--surface-2))',
          3: 'hsl(var(--surface-3))',
        },
        priority: {
          critical: { DEFAULT: 'hsl(var(--priority-critical))', bg: 'hsl(var(--priority-critical-bg))' },
          high: { DEFAULT: 'hsl(var(--priority-high))', bg: 'hsl(var(--priority-high-bg))' },
          medium: { DEFAULT: 'hsl(var(--priority-medium))', bg: 'hsl(var(--priority-medium-bg))' },
          low: { DEFAULT: 'hsl(var(--priority-low))', bg: 'hsl(var(--priority-low-bg))' },
          normal: { DEFAULT: 'hsl(var(--priority-normal))', bg: 'hsl(var(--priority-normal-bg))' },
        },
        type: {
          bug: { DEFAULT: 'hsl(var(--type-bug))', bg: 'hsl(var(--type-bug-bg))' },
          feature: { DEFAULT: 'hsl(var(--type-feature))', bg: 'hsl(var(--type-feature-bg))' },
          improvement: { DEFAULT: 'hsl(var(--type-improvement))', bg: 'hsl(var(--type-improvement-bg))' },
          security: { DEFAULT: 'hsl(var(--type-security))', bg: 'hsl(var(--type-security-bg))' },
          chore: { DEFAULT: 'hsl(var(--type-chore))', bg: 'hsl(var(--type-chore-bg))' },
        },
        status: {
          active: { DEFAULT: 'hsl(var(--status-active))', bg: 'hsl(var(--status-active-bg))' },
          blocked: { DEFAULT: 'hsl(var(--status-blocked))', bg: 'hsl(var(--status-blocked-bg))' },
          done: { DEFAULT: 'hsl(var(--status-done))', bg: 'hsl(var(--status-done-bg))' },
        },
      },
      fontSize: {
        micro: ['10px', { lineHeight: '14px', letterSpacing: '0.01em' }],
        xs: ['11px', { lineHeight: '16px' }],
        sm: ['13px', { lineHeight: '18px' }],
        base: ['14px', { lineHeight: '20px' }],
        lg: ['15px', { lineHeight: '22px' }],
        xl: ['18px', { lineHeight: '26px' }],
        '2xl': ['22px', { lineHeight: '28px' }],
        '3xl': ['28px', { lineHeight: '34px' }],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [animate],
}
