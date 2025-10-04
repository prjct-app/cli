import { ReactNode } from 'react'

interface TechnicalDetailsProps {
  details: ReactNode[]
}

export function TechnicalDetails({ details }: TechnicalDetailsProps) {
  return (
    <div className="rounded-2xl border border-muted/20 bg-muted/10 p-6">
      <h3 className="mb-3 text-lg font-bold">Technical Details</h3>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {details.map((detail, index) => (
          <li key={index}>{detail}</li>
        ))}
      </ul>
    </div>
  )
}
