import { useState, useEffect, useCallback } from 'react'
import { Server, Database, Wifi, Activity, RefreshCw, CheckCircle, AlertCircle, Cpu, HardDrive } from 'lucide-react'
import { systemApi, ingestApi, authApi } from '../utils/api.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

export default function SystemPage() {
  const { isAdmin } = useAuth()
  const [health, setHealth] = useState(null)
  const [sources, setSources] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'analyst' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [hRes, sRes] = await Promise.all([systemApi.health(), systemApi.sources()])
      setHealth(hRes.data)
      setSources(sRes.data)
      if (isAdmin) {
        const uRes = await authApi.listUsers()
        setUsers(uRes.data)
      }
    } catch (e) {
      toast.error('Failed to load system info')
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [load])

  const handleAddUser = async (e) => {
    e.preventDefault()
    try {
      await authApi.createUser(newUser)
      toast.success('User created')
      setShowAddUser(false)
      setNewUser({ username: '', email: '', password: '', role: 'analyst' })
      load()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create user')
    }
  }

  const HealthCard = ({ title, icon: Icon, color, children }) => (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
      </div>
      {children}
    </div>
  )

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-forge-400" /> System Health
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Platform status, sources, and user management</p>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Status Banner */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
        health?.status === 'healthy'
          ? 'bg-green-500/10 border-green-500/30 text-green-400'
          : 'bg-red-500/10 border-red-500/30 text-red-400'
      }`}>
        {health?.status === 'healthy'
          ? <CheckCircle className="w-5 h-5 shrink-0" />
          : <AlertCircle className="w-5 h-5 shrink-0" />}
        <div>
          <span className="font-semibold">LogForge Platform {health?.status === 'healthy' ? 'Operational' : 'Degraded'}</span>
          <span className="text-sm opacity-70 ml-3">{health?.timestamp && format(new Date(health.timestamp), 'MMM d, HH:mm:ss')}</span>
        </div>
      </div>

      {/* Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <HealthCard title="Database" icon={Database} color="bg-blue-500/10 text-blue-400">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Total Logs</span>
              <span className="text-white font-mono">{health?.database?.total_logs?.toLocaleString() ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Active Alerts</span>
              <span className={`font-mono ${(health?.database?.active_alerts ?? 0) > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                {health?.database?.active_alerts ?? '—'}
              </span>
            </div>
          </div>
        </HealthCard>

        <HealthCard title="Log Processor" icon={Activity} color="bg-forge-500/10 text-forge-400">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Processed Total</span>
              <span className="text-white font-mono">{health?.processor?.processed_count?.toLocaleString() ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Queue Size</span>
              <span className="text-white font-mono">{health?.processor?.queue_size ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">ML Model</span>
              <span className={`font-mono text-xs ${health?.processor?.model_trained ? 'text-green-400' : 'text-yellow-400'}`}>
                {health?.processor?.model_trained ? '✓ Trained' : '⏳ Training...'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Errors</span>
              <span className={`font-mono ${(health?.processor?.error_count ?? 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {health?.processor?.error_count ?? '—'}
              </span>
            </div>
          </div>
        </HealthCard>

        <HealthCard title="Network" icon={Wifi} color="bg-purple-500/10 text-purple-400">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">WS Connections</span>
              <span className="text-white font-mono">{health?.websocket?.active_connections ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Ingest Rate</span>
              <span className="text-white font-mono">{health?.ingestion?.rate_per_minute ?? '—'}/min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Python</span>
              <span className="text-slate-400 font-mono text-xs">{health?.platform?.python ?? '—'}</span>
            </div>
          </div>
        </HealthCard>
      </div>

      {/* Log Sources Table */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Active Log Sources (Last 24h)</h3>
        {sources.length === 0 ? (
          <div className="text-center py-8 text-slate-600 text-sm">No log sources detected yet. Start ingesting logs!</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-forge-700/50">
                  <th className="pb-3 pr-4">Source</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Host</th>
                  <th className="pb-3 pr-4 text-right">Log Count</th>
                  <th className="pb-3 text-right">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forge-800">
                {sources.map(s => (
                  <tr key={`${s.source}-${s.host}`} className="hover:bg-forge-700/20 transition-colors">
                    <td className="py-2.5 pr-4">
                      <span className="text-slate-200 font-medium">{s.source}</span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="badge-info">{s.type}</span>
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-slate-400 text-xs">{s.host}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      <span className="text-forge-400 font-medium">{s.count.toLocaleString()}</span>
                    </td>
                    <td className="py-2.5 text-right text-slate-500 text-xs font-mono">
                      {s.last_seen ? format(new Date(s.last_seen), 'HH:mm:ss') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Management (Admin Only) */}
      {isAdmin && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-300">User Management</h3>
            <button onClick={() => setShowAddUser(s => !s)} className="btn-primary text-xs px-3 py-1.5">
              + Add User
            </button>
          </div>

          {showAddUser && (
            <form onSubmit={handleAddUser} className="grid grid-cols-2 gap-3 mb-4 p-4 bg-forge-900/50 rounded-xl border border-forge-700/40 animate-slide-in">
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Username *</label>
                <input required value={newUser.username} onChange={e => setNewUser(u => ({...u, username: e.target.value}))}
                  className="w-full bg-forge-800 border border-forge-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-forge-500" />
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Email *</label>
                <input required type="email" value={newUser.email} onChange={e => setNewUser(u => ({...u, email: e.target.value}))}
                  className="w-full bg-forge-800 border border-forge-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-forge-500" />
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Password *</label>
                <input required type="password" value={newUser.password} onChange={e => setNewUser(u => ({...u, password: e.target.value}))}
                  className="w-full bg-forge-800 border border-forge-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-forge-500" />
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Role</label>
                <select value={newUser.role} onChange={e => setNewUser(u => ({...u, role: e.target.value}))}
                  className="w-full bg-forge-800 border border-forge-600/50 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none">
                  {['admin', 'analyst', 'viewer'].map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div className="col-span-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddUser(false)} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
                <button type="submit" className="btn-primary text-xs px-3 py-1.5">Create User</button>
              </div>
            </form>
          )}

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-forge-700/50">
                <th className="pb-3 pr-4">Username</th>
                <th className="pb-3 pr-4">Email</th>
                <th className="pb-3 pr-4">Role</th>
                <th className="pb-3 text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forge-800">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-forge-700/20 transition-colors">
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-forge-500 flex items-center justify-center text-white text-xs font-bold">
                        {u.username[0].toUpperCase()}
                      </div>
                      <span className="text-slate-200 font-medium">{u.username}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-slate-400 text-xs">{u.email}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      u.role === 'admin' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                      u.role === 'analyst' ? 'bg-forge-500/20 text-forge-400 border border-forge-500/30' :
                      'badge-info'
                    }`}>{u.role}</span>
                  </td>
                  <td className="py-2.5 text-right text-slate-500 text-xs">
                    {u.created_at ? format(new Date(u.created_at), 'MMM d, yyyy') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
