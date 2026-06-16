'use client'

import { Fragment } from 'react'

const SEEDANCE_PATTERN = /(Seedance)/g

export function SeedanceBrandText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const parts = text.split(SEEDANCE_PATTERN)

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part === 'Seedance'
          ? (
              <span key={index} translate="no" className="notranslate">
                Seedance
              </span>
            )
          : (
              <Fragment key={index}>{part}</Fragment>
            ),
      )}
    </span>
  )
}
