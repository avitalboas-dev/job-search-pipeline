import { Badge } from './ui/badge'

export default function FitBadge({ level }) {
  if (!level || level === 'Unknown') return null
  const variant = level === 'High' ? 'success' : level === 'Medium' ? 'warning' : 'muted'
  return (
    <Badge variant={variant}>
      {level} fit
    </Badge>
  )
}
