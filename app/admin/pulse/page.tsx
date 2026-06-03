'use client'
import { useEffect, useState } from 'react'

interface CounterStats {
  stool_moved: number
  plant_watered: number
  receipt_printed: number
  total_pulses: number
}

export default function PulsePage() {
  const [stats, setStats] = useState<CounterStats>({
    stool_moved: 0,
    plant_watered: 0,
    receipt_printed: 0,
    total_pulses: 0
  })
  const [logs, setLogs] = useState<string[]>([])
  const [flicker, setFlicker] = useState(false)

  useEffect(() => {
    const fetchPulseMetrics = async () => {
      setFlicker(true)
      setTimeout(() => setFlicker(false), 150)

      try {
        const res = await fetch('/api/admin/pulse-metrics')
        if (res.ok) {
          const data = await res.json()
          setStats(data.stats)
          setLogs(prev => [
            `[${new Date().toLocaleTimeString()}] TELEMETRY CAPTURED. ACTIVE CONNECTION PULSE: ${data.stats.total_pulses}`,
            ...prev.slice(0, 15)
          ])
        }
      } catch (e) {
        setLogs(prev => [
          `[${new Date().toLocaleTimeString()}] BEACON TIMEOUT. RETRYING GATEWAY...`,
          ...prev.slice(0, 15)
        ])
      }
    }

    fetchPulseMetrics()
    const interval = setInterval(fetchPulseMetrics, 5000) // 5秒冷寂式定期轮询
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-[#050505] text-[#39ff14] font-mono p-8 flex flex-col gap-8 select-none">
      
      {/* 终端头部 */}
      <div className="flex justify-between items-center border-b border-[#39ff14]/20 pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-base font-bold tracking-widest">[ ENDHERE::SPATIAL_PULSE_RADAR v2.1 ]</h1>
          <p className="text-[10px] text-[#39ff14]/40">OBJECTIVE PHYSICAL METRICS CONTROLLER // NON-PRIVACY RECORDED</p>
        </div>
        
        {/* 呼吸状态灯 */}
        <div className="flex items-center gap-3 bg-[#0a0a0a] px-4 py-2 border border-[#39ff14]/20">
          <span className={`w-2 h-2 rounded-full bg-[#39ff14] ${flicker ? 'opacity-100 scale-125' : 'animate-pulse opacity-60'} transition-all`} />
          <span className="text-[10px] tracking-widest font-bold">STREAM_LIVE</span>
        </div>
      </div>

      {/* 纯文本矩阵计数 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: '木凳挪动次数', value: stats.stool_moved, id: 'EVENT_MOVE_STOOL' },
          { label: '植物浇灌次数', value: stats.plant_watered, id: 'EVENT_WATER_PLANT' },
          { label: '小票热敏打印', value: stats.receipt_printed, id: 'EVENT_PRINT_RECEIPT' },
          { label: '全域物理总脉搏', value: stats.total_pulses, id: 'TOTAL_TELEMETRY' }
        ].map((item, idx) => (
          <div key={idx} className="border border-[#39ff14]/20 bg-[#080808] p-5 flex flex-col gap-1">
            <span className="text-[11px] text-[#39ff14]/50">{item.label}</span>
            <span className="text-3xl font-bold font-mono tracking-tight my-1">{item.value}</span>
            <span className="text-[9px] text-[#39ff14]/20">{item.id}</span>
          </div>
        ))}
      </div>

      {/* 实时系统终端流 */}
      <div className="flex-1 border border-[#39ff14]/10 bg-[#020202] p-4 flex flex-col gap-2 h-[320px]">
        <div className="text-[11px] text-[#39ff14]/60 border-b border-[#39ff14]/10 pb-1 font-bold">CONSOLE_SIGNAL_STREAM:</div>
        <div className="flex flex-col gap-1 overflow-y-auto font-mono text-[11px] text-[#39ff14]/80">
          {logs.length === 0 ? (
            <div className="text-[#39ff14]/20">[ Waiting for spatial pulses... ]</div>
          ) : (
            logs.map((log, i) => <div key={i} className="hover:bg-[#39ff14]/5 px-1">{log}</div>)
          )}
        </div>
      </div>
    </div>
  )
}