import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts'
import { Search, Shield, TrendingUp, Globe } from 'lucide-react'
import { analyticsApi } from '../utils/api.js'
import toast from 'react-hot-toast'

const PIE_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#38bdf8', '#64748b', '#8b5cf6']
const TT_STYLE = { background: '#1a2440', border: '1px solid #1e3a5f', borderRadius: '8px', fontSize: '12px', color: '#f1f5f9' }

export default function AnalyticsPage() {
  const [hours, setHours] = useState(24)
  const [topIps, setTopIps] = useState([])
  const [severity, setSeverity] = useState([])
  const [sources, setSources] = useState([])
  const [ipSearch, setIpSearch] = useState('')
  const [ipResult, setIpResult] = useState(null)
  const [ipLoading, setIpLoading] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [ipsRes, sevRes, srcRes] = await Promise.all([
        analyticsApi.topIps(hours),
        analyticsApi.severity(hours),
        analyticsApi.sources(hours),
      ])
      setTopIps(ipsRes.data)
      setSeverity(sevRes.data)
      setSources(srcRes.data.slice(0, 10))
    } catch { toast.error('Failed to load analytics') }
  }, [hours])

  useEffect(() => { loadData() }, [loadData])

  const checkIp = async (e) => {
    e.preventDefault()
    if (!ipSearch.trim()) return
    setIpLoading(true)
    try {
      const res = await analyticsApi.checkIp(ipSearch.trim())
      setIpResult(res.data)
    } catch { toast.error('IP lookup failed') }
    finally { setIpLoading(false) }
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-forge-400" /> Analytics
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Traffic patterns, threat intelligence & source analysis</p>
        </div>
        <div className="flex items-center gap-2">
          {[6, 24, 48, 168].map(h => (
            <button key={h} onClick={() => setHours(h)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                hours === h ? 'bg-forge-500 text-white' : 'text-slate-400 bg-forge-800 border border-forge-700/50 hover:text-white'
              }`}>
              {h < 24 ? `${h}h` : h < 48 ? '1d' : h < 72 ? '2d' : '7d'}
            </button>
          ))}
        </div>
      </div>

      {/* Top IPs Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Top IP Addresses</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topIps} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis dataKey="ip" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} width={110} />
              <Tooltip contentStyle={TT_STYLE} />
              <Bar dataKey="total" fill="#38bdf8" radius={[0,4,4,0]} name="Total" />
              <Bar dataKey="errors" fill="#ef4444" radius={[0,4,4,0]} name="Errors" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Severity Donut */}
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Log Severity Breakdown</h3>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={severity} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>
                  {severity.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={TT_STYLE} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {severity.map((s, i) => (
                <div key={s.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: PIE_COLORS[i] }} />
                    <span className="text-slate-400">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300 tabular-nums font-medium">{s.value.toLocaleString()}</span>
                    <span className="text-slate-600 w-10 text-right">{s.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sources Bar */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Log Sources Volume</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={sources}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
            <XAxis dataKey="source" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip contentStyle={TT_STYLE} />
            <Bar dataKey="count" fill="#38bdf8" radius={[4,4,0,0]} name="Log Count" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* IP Reputation Checker */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-forge-400" />
          <h3 className="text-sm font-semibold text-slate-300">IP Reputation Checker</h3>
        </div>
        <form onSubmit={checkIp} className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text" placeholder="192.168.1.1"
              value={ipSearch} onChange={e => setIpSearch(e.target.value)}
              className="w-full bg-forge-900 border border-forge-600/50 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-forge-500 font-mono"
            />
          </div>
          <button type="submit" disabled={ipLoading} className="btn-primary px-5 disabled:opacity-50">
            {ipLoading ? 'Checking...' : 'Check IP'}
          </button>
        </form>

        {ipResult && (
          <div className="bg-forge-900/60 rounded-xl border border-forge-700/40 p-4 animate-slide-in">
            <div className="flex items-center justify-between mb-3">
              <div className="font-mono text-lg font-bold text-white">{ipResult.ip}</div>
              <div className={`px-3 py-1 rounded-lg text-sm font-medium ${
                ipResult.risk_level === 'HIGH' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                ipResult.risk_level === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                'bg-green-500/20 text-green-400 border border-green-500/30'
              }`}>
                {ipResult.risk_level} RISK • {ipResult.risk_score}/10
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="bg-forge-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-white">{ipResult.total_requests}</div>
                <div className="text-slate-500 text-xs mt-1">Total Requests</div>
              </div>
              <div className="bg-forge-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-400">{ipResult.error_count}</div>
                <div className="text-slate-500 text-xs mt-1">Errors</div>
              </div>
              <div className="bg-forge-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-yellow-400">{ipResult.warning_count}</div>
                <div className="text-slate-500 text-xs mt-1">Warnings</div>
              </div>
            </div>
            {ipResult.is_suspicious && (
              <div className="mt-3 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-300 flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 shrink-0" />
                This IP shows suspicious activity patterns. Consider blocking or monitoring closely.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
