import { useState, useEffect, useCallback } from 'react'
import { Bell, CheckCircle, Loader, AlertTriangle, Shield, ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import SeverityBadge from '../components/dashboard/SeverityBadge.jsx'
import { alertsApi } from '../utils/api.js'
import { formatDistanceToNow, format } from 'date-fns'
import toast from 'react-hot-toast'

const SEVERITIES = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  // Filters
  const [severity, setSeverity] = useState('ALL')
  const [resolved, setResolved] = useState(false)

  // Create form
  const [newAlert, setNewAlert] = useState({ title: '', description: '', severity: 'MEDIUM', alert_type: 'manual' })

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        page_size: 50,
        is_resolved: resolved,
        ...(severity !== 'ALL' && { severity }),
      }
      const res = await alertsApi.list(params)
      setAlerts(res.data.alerts)
      setTotal(res.data.total)
    } catch { toast.error('Failed to load alerts') }
    finally { setLoading(false) }
  }, [severity, resolved])

  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  const handleResolve = async (id) => {
    try {
      await alertsApi.resolve(id)
      toast.success('Alert resolved')
      fetchAlerts()
    } catch { toast.error('Failed to resolve alert') }
  }

  const handleAnalyze = async (alert) => {
    setAnalyzing(alert.id)
    try {
      const res = await alertsApi.analyze(alert.id)
      const a = res.data.analysis
      toast.success('AI analysis complete')
      // Refresh to get updated alert
      fetchAlerts()
      setExpanded(alert.id)
    } catch { toast.error('AI analysis failed') }
    finally { setAnalyzing(null) }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await alertsApi.create(newAlert)
      toast.success('Alert created')
      setShowCreate(false)
      setNewAlert({ title: '', description: '', severity: 'MEDIUM', alert_type: 'manual' })
      fetchAlerts()
    } catch { toast.error('Failed to create alert') }
  }

  const severityBg = (s) => ({
    CRITICAL: 'border-l-red-500 bg-red-500/5',
    HIGH: 'border-l-orange-500 bg-orange-500/5',
    MEDIUM: 'border-l-yellow-500 bg-yellow-500/5',
    LOW: 'border-l-blue-500',
  }[s] || '')

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-forge-400" /> Alerts & Incidents
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">{total} alerts • AI-powered threat detection</p>
        </div>
        <button onClick={() => setShowCreate(s => !s)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Alert
        </button>
      </div>

      {/* Create Alert Modal */}
      {showCreate && (
        <div className="card border-forge-500/40 animate-slide-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Create Manual Alert</h3>
            <button onClick={() => setShowCreate(false)}><X className="w-4 h-4 text-slate-400" /></button>
          </div>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-slate-400 text-xs mb-1 block">Title *</label>
              <input required value={newAlert.title} onChange={e => setNewAlert(a => ({...a, title: e.target.value}))}
                className="w-full bg-forge-900 border border-forge-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-forge-500" />
            </div>
            <div className="col-span-2">
              <label className="text-slate-400 text-xs mb-1 block">Description</label>
              <textarea value={newAlert.description} onChange={e => setNewAlert(a => ({...a, description: e.target.value}))}
                rows={2} className="w-full bg-forge-900 border border-forge-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-forge-500 resize-none" />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Severity</label>
              <select value={newAlert.severity} onChange={e => setNewAlert(a => ({...a, severity: e.target.value}))}
                className="w-full bg-forge-900 border border-forge-600/50 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none">
                {['LOW','MEDIUM','HIGH','CRITICAL'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Type</label>
              <input value={newAlert.alert_type} onChange={e => setNewAlert(a => ({...a, alert_type: e.target.value}))}
                className="w-full bg-forge-900 border border-forge-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-forge-500" />
            </div>
            <div className="col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Create Alert</button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {SEVERITIES.map(s => (
          <button key={s} onClick={() => setSeverity(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              severity === s ? 'bg-forge-500 text-white border-forge-500' : 'text-slate-400 border-forge-600/50 hover:text-white'
            }`}>{s}</button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
            <input type="checkbox" checked={resolved} onChange={e => setResolved(e.target.checked)}
              className="rounded accent-forge-500" />
            Show Resolved
          </label>
        </div>
      </div>

      {/* Alerts List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader className="animate-spin text-forge-400 w-5 h-5" /></div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-16 text-slate-600">
          <Shield className="w-8 h-8 mx-auto mb-3 opacity-50" />
          <p>No alerts found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map(alert => (
            <div key={alert.id} className={`card border-l-4 ${severityBg(alert.severity)} hover:border-forge-600/60 transition-colors`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SeverityBadge level={alert.severity} />
                    <span className="text-forge-400 text-xs font-mono bg-forge-900/50 px-1.5 py-0.5 rounded">{alert.alert_type}</span>
                    {alert.is_resolved && (
                      <span className="badge-info flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Resolved
                      </span>
                    )}
                    <span className="text-slate-500 text-xs ml-auto">
                      {formatDistanceToNow(new Date(alert.triggered_at), { addSuffix: true })}
                    </span>
                  </div>
                  <h3 className="text-slate-100 font-medium text-sm mt-2">{alert.title}</h3>
                  {alert.description && <p className="text-slate-400 text-xs mt-1">{alert.description}</p>}
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                    {alert.ip_address && <span className="font-mono">IP: {alert.ip_address}</span>}
                    {alert.event_count > 1 && <span>{alert.event_count} events</span>}
                    {alert.confidence_score > 0 && <span>Confidence: {(alert.confidence_score * 100).toFixed(0)}%</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!alert.is_resolved && (
                    <>
                      <button onClick={() => handleAnalyze(alert)} disabled={analyzing === alert.id}
                        className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 disabled:opacity-50">
                        {analyzing === alert.id
                          ? <><Loader className="w-3 h-3 animate-spin" /> Analyzing...</>
                          : <><AlertTriangle className="w-3 h-3" /> AI Analyze</>}
                      </button>
                      <button onClick={() => handleResolve(alert.id)}
                        className="py-1.5 px-3 text-xs rounded-lg bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 transition-colors flex items-center gap-1.5">
                        <CheckCircle className="w-3 h-3" /> Resolve
                      </button>
                    </>
                  )}
                  <button onClick={() => setExpanded(expanded === alert.id ? null : alert.id)}
                    className="text-slate-500 hover:text-slate-300">
                    {expanded === alert.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded AI Analysis */}
              {expanded === alert.id && (alert.ai_analysis || alert.remediation) && (
                <div className="mt-4 pt-4 border-t border-forge-700/50 grid grid-cols-1 md:grid-cols-2 gap-4 animate-slide-in">
                  {alert.ai_analysis && (
                    <div>
                      <h4 className="text-xs font-semibold text-forge-400 mb-2 uppercase tracking-wider">Root Cause Analysis</h4>
                      <p className="text-slate-300 text-xs leading-relaxed">{alert.ai_analysis}</p>
                    </div>
                  )}
                  {alert.remediation && (
                    <div>
                      <h4 className="text-xs font-semibold text-green-400 mb-2 uppercase tracking-wider">Remediation Steps</h4>
                      <div className="space-y-1">
                        {alert.remediation.split('\n').filter(Boolean).map((step, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                            <span className="text-forge-400 font-mono shrink-0">{i + 1}.</span>
                            <span>{step.replace(/^\d+\.\s*/, '')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
