import clsx from 'clsx'

const configs = {
  CRITICAL: 'badge-critical',
  HIGH: 'badge-high',
  MEDIUM: 'badge-medium',
  LOW: 'badge-low',
  INFO: 'badge-info',
  DEBUG: 'badge-info',
  WARNING: 'badge-medium',
  ERROR: 'badge-high',
}

export default function SeverityBadge({ level, className }) {
  const cls = configs[level?.toUpperCase()] || 'badge-info'
  return <span className={clsx(cls, className)}>{level}</span>
}
