'use client'

import { useState } from 'react'

export function useExpandable(initialExpanded: boolean = false) {
  const [expanded, setExpanded] = useState(initialExpanded)
  const toggle = () => setExpanded(prev => !prev)
  return { expanded, toggle }
}
