export interface Idea {
  title: string
  impact?: string
}

export interface IdeasCardProps {
  ideas: Idea[]
  codeHref?: string
  className?: string
}
