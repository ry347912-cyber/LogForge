import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Custom hook for WebSocket connection to log stream.
 * Auto-reconnects on disconnect.
 */
export function useWebSocket({ onLog, onAlert, onAnomaly, enabled = true }) {
  const ws = useRef(null)
  const [connected, setConnected] = useState(false)
  const [reconnectCount, setReconnectCount] = useState(0)
  const reconnectTimer = useRef(null)
  const clientId = useRef(`client-${Date.now()}-${Math.random().toString(36).slice(2)}`)

  const connect = useCallback(() => {
    if (!enabled) return

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const host = window.location.host
    const url = `${protocol}://${host}/ws/${clientId.current}`

    try {
      ws.current = new WebSocket(url)

      ws.current.onopen = () => {
        setConnected(true)
        setReconnectCount(0)
        // Subscribe to all channels
        ws.current.send(JSON.stringify({ type: 'subscribe', channel: 'logs' }))
        ws.current.send(JSON.stringify({ type: 'subscribe', channel: 'alerts' }))
      }

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          switch (message.type) {
            case 'log':
              onLog?.(message.data)
              break
            case 'alert':
              onAlert?.(message.data)
              break
            case 'anomaly':
              onAnomaly?.(message.data)
              break
          }
        } catch (e) {
          console.debug('WS parse error:', e)
        }
      }

      ws.current.onclose = () => {
        setConnected(false)
        // Exponential backoff reconnect
        const delay = Math.min(1000 * 2 ** reconnectCount, 30000)
        reconnectTimer.current = setTimeout(() => {
          setReconnectCount(c => c + 1)
          connect()
        }, delay)
      }

      ws.current.onerror = () => {
        ws.current?.close()
      }
    } catch (e) {
      console.debug('WS connection error:', e)
    }
  }, [enabled, reconnectCount, onLog, onAlert, onAnomaly])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      ws.current?.close()
    }
  }, []) // Only connect once on mount

  return { connected, reconnectCount }
}
