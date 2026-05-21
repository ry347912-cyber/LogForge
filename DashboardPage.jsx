import { useState, useEffect, useCallback } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts'
import { Activity, AlertTriangle, FileText, Shield, Zap, Eye, Clock } from 'lucide-react'
import StatCard from '../components/dashboard/StatCard.jsx'
import SeverityBadge from '../components/dashboard/SeverityBadge.jsx'
import { analyticsApi, alertsApi, logsApi } from '../utils/api.js'
import { formatDistanceToNow, format } from 'date-fns'

const LEVEL_COLORS = { ERROR: '#ef4444', CRITICAL: '#dc2626', WARNING: '#f59e0b', INFO: '#38bdf8', DEBUG: '#64748b' }
const PIE_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#38bdf8', '#64748b']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-forge-800 border border-forge-600/50 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-slate-400 mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-300 capitalize">{p.dataKey}: </span>
          <span className="text-white font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const [overview, setOverview] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [severity, setSeverity] = useState([])
  const [activeAlerts, setActiveAlerts] = useState([])
  const [recentLogs, setRecentLogs] = useState([])
  const [hours, setHours] = useState(24)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [ovRes, tlRes, sevRes, alRes, logsRes] = await Promise.all([
        analyticsApi.overview(hours),
        analyticsApi.timeline(hours, hours <= 6 ? 15 : 60),
        analyticsApi.severity(hours),
        alertsApi.active(),
        logsApi.recent(10),
      ])
      setOverview(ovRes.data)
      setTimeline(tlRes.data.map(d => ({ ...d, time: format(new Date(d.time), hours <= 24 ? 'HH:mm' : 'MM/dd HH:mm') })))
      setSeverity(sevRes.data)
      setActiveAlerts(alRes.data)
      setRecentLogs(logsRes.data)
    } catch (e) {
      console.error('Dashboard load error:', e)
    } finally {
      setLoading(false)
    }
  }, [hours])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Security Overview</h1>
          <p className="text-slate-400 text-sm mt-0.5">Real-time log monitoring & threat detection</p>
        </div>
        <div className="flex items-center gap-2">
          {[6, 24, 48, 168].map(h => (
            <button key={h} onClick={() => setHours(h)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${hours === h ? 'bg-forge-500 text-white' : 'text-slate-400 hover:text-white bg-forge-800 border border-forge-700/50'}`}>
              {h < 24 ? `${h}h` : h < 48 ? '1d' : h < 72 ? '2d' : '7d'}
            </button>
          ))}
          <button onClick={load} className="p-1.5 text-slate-400 hover:text-forge-400 transition-colors">
            <Activity className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Logs" value={overview?.total_logs?.toLocaleString()} subtitle={`Last ${hours}h`} icon={FileText} color="blue" />
        <StatCard title="Active Alerts" value={overview?.active_alerts} subtitle={`${overview?.critical_alerts || 0} critical`} icon={AlertTriangle} color="red" />
        <StatCard title="Anomalies" value={overview?.anomaly_count} subtitle="AI detected" icon={Zap} color="yellow" />
        <StatCard title="Unique IPs" value={overview?.unique_ips} subtitle="Distinct sources" icon={Eye} color="purple" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Timeline */}
        <div className="card lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Log Volume Timeline</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={timeline}>
              <defs>
                <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gErrors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="total" stroke="#38bdf8" fill="url(#gTotal)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="errors" stroke="#ef4444" fill="url(#gErrors)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="anomalies" stroke="#f59e0b" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-forge-400 inline-block" />Total</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-400 inline-block" />Errors</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-yellow-400 inline-block border-dashed" />Anomalies</span>
          </div>
        </div>

        {/* Severity Pie */}
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Severity Distribution</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={severity} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={2}>
                {severity.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ background: '#1a2440', border: '1px solid #1e3a5f', borderRadius: '8px', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {severity.slice(0, 5).map((s, i) => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i] }} />
                  <span className="text-slate-400">{s.name}</span>
                </div>
                <span className="text-slate-300 font-medium tabular-nums">{s.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row: Alerts + Recent Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active Alerts */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-300">Active Alerts</h3>
            <span className="text-xs text-slate-500">{activeAlerts.length} unresolved</span>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {activeAlerts.length === 0 ? (
              <div className="text-center py-8 text-slate-600 text-sm">
                <Shield className="w-6 h-6 mx-auto mb-2 opacity-50" />
                No active alerts
              </div>
            ) : activeAlerts.map(alert => (
              <div key={alert.id} className="flex items-start gap-3 p-2.5 bg-forge-900/50 rounded-lg border border-forge-700/30 hover:border-forge-600/50 transition-colors">
                <div className={`w-1 h-full min-h-8 rounded-full shrink-0 ${
                  alert.severity === 'CRITICAL' ? 'bg-red-500' :
                  alert.severity === 'HIGH' ? 'bg-orange-500' :
                  alert.severity === 'MEDIUM' ? 'bg-yellow-500' : 'bg-blue-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <SeverityBadge level={alert.severity} />
                    <span className="text-slate-400 text-xs font-mono">{alert.alert_type}</span>
                  </div>
                  <div className="text-slate-200 text-xs mt-1 truncate">{alert.title}</div>
                  {alert.ip_address && <div className="text-slate-500 text-xs font-mono">{alert.ip_address}</div>}
                </div>
                <span className="text-slate-600 text-xs shrink-0 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(alert.triggered_at), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Logs */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-300">Recent Logs</h3>
            <span className="text-xs text-slate-500">Last 10</span>
          </div>
          <div className="space-y-0.5 max-h-64 overflow-y-auto">
            {recentLogs.map(log => (
              <div key={log.id} className="log-line flex items-start gap-2">
                <span className={`shrink-0 text-xs font-mono w-16 ${
                  log.log_level === 'ERROR' || log.log_level === 'CRITICAL' ? 'text-red-400' :
                  log.log_level === 'WARNING' ? 'text-yellow-400' : 'text-forge-400'
                }`}>{log.log_level}</span>
                <span className="text-slate-500 text-xs shrink-0">{log.source}</span>
                <span className="text-slate-300 text-xs truncate">{log.parsed_message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
