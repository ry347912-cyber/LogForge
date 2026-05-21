import { TrendingUp, TrendingDown } from 'lucide-react'
import clsx from 'clsx'

export default function StatCard({ title, value, subtitle, icon: Icon, color = 'blue', trend }) {
  const colors = {
    blue: 'text-forge-400 bg-forge-500/10 border-forge-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
    yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    green: 'text-green-400 bg-green-500/10 border-green-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  }

  return (
    <div className="card flex flex-col gap-3 hover:border-forge-600/60 transition-colors">
      <div className="flex items-start justify-between">
        <span className="text-slate-400 text-sm font-medium">{title}</span>
        {Icon && (
          <div className={clsx('p-2 rounded-lg border', colors[color])}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold text-white tabular-nums">
          {value ?? <span className="text-slate-600 animate-pulse">—</span>}
        </div>
        {subtitle && <div className="text-slate-500 text-xs mt-1">{subtitle}</div>}
      </div>
      {trend !== undefined && (
        <div className={clsx('flex items-center gap-1 text-xs', trend >= 0 ? 'text-red-400' : 'text-green-400')}>
          {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          <span>{Math.abs(trend)}% vs last period</span>
        </div>
      )}
    </div>
  )
}
