import { motion } from 'framer-motion'
import { Star } from 'lucide-react'

interface ProductHuntButtonProps {
  variant?: 'desktop' | 'mobile'
  onClick?: () => void
}

export const ProductHuntButton = ({ variant = 'desktop', onClick }: ProductHuntButtonProps) => {
  const baseClasses = "flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-800 px-4 py-2 font-medium text-white transition-all hover:from-orange-400 hover:to-orange-700"
  
  const variantClasses = {
    desktop: `${baseClasses} text-sm delay-75 ease-linear`,
    mobile: `${baseClasses} gap-3 py-3`
  }

  const content = (
    <>
      <Star className="h-4 w-4" />
      <span>Review on Product Hunt</span>
    </>
  )

  if (variant === 'desktop') {
    return (
      <motion.a
        href="https://www.producthunt.com/products/prjct-cli/reviews?feed=single"
        target="_blank"
        rel="noopener noreferrer"
        className={variantClasses.desktop}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Review on Product Hunt"
        onClick={onClick}
      >
        {content}
      </motion.a>
    )
  }

  return (
    <a
      href="https://www.producthunt.com/products/prjct-cli/reviews?feed=single"
      target="_blank"
      rel="noopener noreferrer"
      className={variantClasses.mobile}
      onClick={onClick}
      aria-label="Review on Product Hunt"
    >
      {content}
    </a>
  )
}
