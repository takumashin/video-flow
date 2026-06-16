import { SITE_LOGO_SRC } from '@/lib/site-logo'

type SiteLogoProps = {
  size?: number
  className?: string
}

export function SiteLogo({ size = 32, className }: SiteLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={SITE_LOGO_SRC}
      alt="Seedance Studio"
      width={size}
      height={size}
      className={className}
      decoding="async"
    />
  )
}
