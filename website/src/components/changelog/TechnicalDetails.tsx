import { ReactNode } from "react"

interface TechnicalDetailsProps {
  details: ReactNode[]
}

export function TechnicalDetails({ details }: TechnicalDetailsProps) {
  return (
    <div className="p-6 bg-muted/10 rounded-2xl border border-muted/20">
      <h3 className="text-lg font-bold mb-3">Technical Details</h3>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {details.map((detail, index) => (
          <li key={index}>{detail}</li>
        ))}
      </ul>
    </div>
  )
}
