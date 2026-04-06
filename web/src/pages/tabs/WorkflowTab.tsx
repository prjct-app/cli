import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap, MarkerType,
  Handle, Position, addEdge, applyNodeChanges, applyEdgeChanges,
  type Node, type Edge, type NodeProps, type OnNodesChange, type OnEdgesChange, type OnConnect, type Connection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { GitBranch, Play, Plus, Shield, Trash2, Zap, X } from 'lucide-react'
import { api, type Workflow, type WorkflowRule } from '@/api/client'
import { useApi } from '@/hooks/useApi'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useTabCtx } from '../Project'

// ═══════════════════════════════════════════════════════════════════════
// Node components
// ═══════════════════════════════════════════════════════════════════════

const TYPE_STYLES: Record<string, { border: string; bg: string; icon: string }> = {
  hook: { border: 'border-teal-500/50', bg: 'bg-teal-500/5', icon: 'text-teal-400' },
  gate: { border: 'border-amber-500/50', bg: 'bg-amber-500/5', icon: 'text-amber-400' },
  step: { border: 'border-indigo-500/50', bg: 'bg-indigo-500/5', icon: 'text-indigo-400' },
  instruction: { border: 'border-muted-foreground/30', bg: 'bg-muted/20', icon: 'text-muted-foreground' },
}
const TYPE_ICONS: Record<string, typeof Zap> = { hook: Zap, gate: Shield, step: Play, instruction: GitBranch }

function CommandNode({ data }: NodeProps) {
  const d = data as any
  return (
    <div className={cn(
      "rounded-lg border-2 min-w-[190px] transition-colors select-none",
      d.enabled ? "border-foreground/20 bg-card shadow-lg shadow-black/20" : "border-border bg-card/40 opacity-50"
    )}>
      <Handle type="target" position={Position.Left} className="!bg-foreground/30 !w-2.5 !h-2.5 !border-2 !border-background" />
      {/* Drag handle area */}
      <div className="px-4 py-3 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2.5 mb-1">
          <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", d.enabled ? "bg-emerald-500 shadow-[0_0_6px_theme(colors.emerald.500)]" : "bg-muted-foreground/30")} />
          <span className="text-sm font-bold text-foreground">{d.label}</span>
          {d.isBuiltin && <span className="text-[9px] text-muted-foreground/40 uppercase tracking-wider ml-auto">Built-in</span>}
        </div>
        <p className="text-[11px] text-muted-foreground/70 leading-snug">{d.description}</p>
      </div>
      {/* Toggle — separate from drag */}
      <div className="px-4 pb-2.5 flex items-center gap-2" onMouseDown={e => e.stopPropagation()}>
        <button type="button" onClick={d.onToggle}
          className={cn("h-4 w-7 rounded-full relative shrink-0 transition-colors", d.enabled ? "bg-emerald-500" : "bg-muted-foreground/30")}>
          <span className={cn("absolute top-[2px] h-3 w-3 rounded-full bg-white shadow transition-transform", d.enabled ? "left-[12px]" : "left-[2px]")} />
        </button>
        <span className="text-[10px] text-muted-foreground/50">{d.enabled ? 'Enabled' : 'Disabled'}</span>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-foreground/30 !w-2.5 !h-2.5 !border-2 !border-background" />
    </div>
  )
}

function RuleNode({ data }: NodeProps) {
  const d = data as any
  const r: WorkflowRule = d.rule
  const s = TYPE_STYLES[r.type] || TYPE_STYLES.instruction
  const Icon = TYPE_ICONS[r.type] || GitBranch
  return (
    <div className={cn("rounded-lg border min-w-[240px] max-w-[340px] group select-none shadow-md shadow-black/10", s.border, s.bg)}>
      <Handle type="target" position={Position.Left} className="!bg-foreground/30 !w-2.5 !h-2.5 !border-2 !border-background" />
      <div className="px-3.5 py-2.5 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2 mb-1.5">
          <Icon className={cn("h-3.5 w-3.5 shrink-0", s.icon)} />
          <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/70">{r.type}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-foreground/5 text-muted-foreground capitalize">{r.position}</span>
          <div className="ml-auto flex items-center gap-1.5" onMouseDown={e => e.stopPropagation()}>
            <button type="button" onClick={d.onToggle}
              className={cn("h-3 w-5 rounded-full relative shrink-0 transition-colors", r.enabled ? "bg-emerald-500" : "bg-muted-foreground/30")}>
              <span className={cn("absolute top-[1px] h-[10px] w-[10px] rounded-full bg-white shadow transition-transform", r.enabled ? "left-[9px]" : "left-[1px]")} />
            </button>
            <button type="button" onClick={d.onDelete} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all"><X className="h-3 w-3" /></button>
          </div>
        </div>
        <p className={cn("text-xs leading-snug", r.enabled ? "text-foreground/80" : "text-muted-foreground/50")}>{r.action}</p>
        {r.description && <p className="text-[10px] text-muted-foreground/50 mt-1 leading-snug">{r.description}</p>}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-foreground/30 !w-2.5 !h-2.5 !border-2 !border-background" />
    </div>
  )
}

function AddNode({ data }: NodeProps) {
  const d = data as any
  return (
    <div className="select-none">
      <Handle type="target" position={Position.Left} className="!bg-transparent !w-0 !h-0" />
      <button type="button" onClick={d.onClick}
        className="rounded-lg border border-dashed border-muted-foreground/20 hover:border-muted-foreground/50 hover:bg-surface-2 px-4 py-2.5 flex items-center gap-2 transition-colors cursor-pointer">
        <Plus className="h-3.5 w-3.5 text-muted-foreground/40" />
        <span className="text-xs text-muted-foreground/40 hover:text-muted-foreground">Add rule</span>
      </button>
      <Handle type="source" position={Position.Right} className="!bg-transparent !w-0 !h-0" />
    </div>
  )
}

const nodeTypes = { command: CommandNode, rule: RuleNode, add: AddNode }

// ═══════════════════════════════════════════════════════════════════════
// Layout builder
// ═══════════════════════════════════════════════════════════════════════

function buildLayout(
  workflows: Workflow[], rules: WorkflowRule[],
  toggleWf: (name: string, enabled: boolean) => void,
  toggleRule: (id: number, enabled: boolean) => void,
  deleteRule: (id: number) => void,
  openAdd: (cmd: string) => void,
): { nodes: Node[]; edges: Edge[] } {
  const n: Node[] = []
  const e: Edge[] = []
  const COL0 = 80, COL1 = 400, COL2 = 760, COL_ADD = 1100
  const ROW_H = 180

  workflows.forEach((wf, wi) => {
    const cmdId = `cmd-${wf.name}`
    const y = wi * ROW_H + 50
    const wfRules = rules.filter(r => r.command === wf.name)
    const before = wfRules.filter(r => r.position === 'before')
    const after = wfRules.filter(r => r.position !== 'before')

    // Command node
    n.push({ id: cmdId, type: 'command', position: { x: COL0, y }, data: { label: wf.name, description: wf.description || '', enabled: wf.enabled, isBuiltin: wf.isBuiltin, ruleCount: wfRules.length, onToggle: () => toggleWf(wf.name, !wf.enabled) } })

    let lastSourceId = cmdId

    // Before rules
    before.forEach((r, i) => {
      const rid = `rule-${r.id}`
      const ry = y + (i - (before.length - 1) / 2) * 110
      n.push({ id: rid, type: 'rule', position: { x: COL1, y: ry }, data: { rule: r, onToggle: () => toggleRule(r.id, !r.enabled), onDelete: () => deleteRule(r.id) } })
      e.push(makeEdge(lastSourceId, rid, r.enabled))
      lastSourceId = rid
    })

    // After rules
    after.forEach((r, i) => {
      const rid = `rule-${r.id}`
      const col = before.length > 0 ? COL2 : COL1
      const ry = y + (i - (after.length - 1) / 2) * 110
      n.push({ id: rid, type: 'rule', position: { x: col, y: ry }, data: { rule: r, onToggle: () => toggleRule(r.id, !r.enabled), onDelete: () => deleteRule(r.id) } })
      e.push(makeEdge(lastSourceId, rid, r.enabled))
      lastSourceId = rid
    })

    // Add node
    const addId = `add-${wf.name}`
    const addX = after.length > 0 ? (before.length > 0 ? COL_ADD : COL2) : (before.length > 0 ? COL2 : COL1)
    n.push({ id: addId, type: 'add', position: { x: addX, y }, data: { onClick: () => openAdd(wf.name), command: wf.name } })
    e.push({ id: `e-${lastSourceId}-${addId}`, source: lastSourceId, target: addId, type: 'smoothstep', style: { stroke: 'hsl(0 0% 50% / 0.08)', strokeWidth: 1, strokeDasharray: '5 5' } })
  })

  return { nodes: n, edges: e }
}

function makeEdge(source: string, target: string, active: boolean): Edge {
  return {
    id: `e-${source}-${target}`, source, target, type: 'smoothstep',
    animated: active,
    style: { stroke: active ? 'hsl(160 60% 45% / 0.4)' : 'hsl(0 0% 50% / 0.1)', strokeWidth: active ? 2 : 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: active ? 'hsl(160 60% 45% / 0.4)' : 'hsl(0 0% 50% / 0.1)' },
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════════

export function WorkflowTab() {
  const { projectId } = useTabCtx()
  const { data, refresh } = useApi(() => api.workflows(projectId), [projectId])
  const [addDialog, setAddDialog] = useState<string | null>(null)

  const workflows = data?.workflows || []
  const allRules = data?.rules || []

  const toggleWf = useCallback((name: string, enabled: boolean) => api.toggleWorkflow(projectId, name, enabled).then(refresh), [projectId, refresh])
  const toggleRule = useCallback((id: number, enabled: boolean) => api.updateWorkflowRule(projectId, id, { enabled }).then(refresh), [projectId, refresh])
  const deleteRule = useCallback((id: number) => api.deleteWorkflowRule(projectId, id).then(refresh), [projectId, refresh])

  // Load saved graph edges
  const { data: graphData } = useApi(() => api.getWorkflowGraph(projectId), [projectId])
  const savedEdges = graphData?.edges || []

  // React Flow state
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])

  // Sync layout when data changes — merge auto-generated edges with user-drawn saved edges
  useEffect(() => {
    const layout = buildLayout(workflows, allRules, toggleWf, toggleRule, deleteRule, setAddDialog)
    setNodes(layout.nodes)
    // Merge: auto-generated edges + saved user edges (with styling)
    const autoEdgeIds = new Set(layout.edges.map(e => e.id))
    const userEdges: Edge[] = savedEdges
      .filter(se => !autoEdgeIds.has(se.id))
      .map(se => ({
        ...se, type: 'smoothstep', animated: se.animated ?? true,
        style: { stroke: 'hsl(160 60% 45% / 0.4)', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed as const, width: 14, height: 14, color: 'hsl(160 60% 45% / 0.4)' },
      }))
    setEdges([...layout.edges, ...userEdges])
  }, [workflows, allRules, toggleWf, toggleRule, deleteRule, savedEdges])

  // Persist user-drawn edges (exclude auto-generated ones starting with "e-")
  const persistEdges = useCallback((allEdges: Edge[]) => {
    const userEdges = allEdges
      .filter(e => !e.id.startsWith('e-'))
      .map(e => ({ id: e.id, source: e.source, target: e.target, animated: e.animated }))
    api.saveWorkflowGraph(projectId, userEdges)
  }, [projectId])

  const onNodesChange: OnNodesChange = useCallback((changes) => setNodes(nds => applyNodeChanges(changes, nds)), [])
  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges(eds => {
      const next = applyEdgeChanges(changes, eds)
      // Persist if edges were removed
      if (changes.some(c => c.type === 'remove')) persistEdges(next)
      return next
    })
  }, [persistEdges])
  const onConnect: OnConnect = useCallback((conn: Connection) => {
    setEdges(eds => {
      const next = addEdge({
        ...conn, type: 'smoothstep', animated: true,
        style: { stroke: 'hsl(160 60% 45% / 0.4)', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: 'hsl(160 60% 45% / 0.4)' },
      }, eds)
      persistEdges(next)
      return next
    })
  }, [persistEdges])

  if (!data) return <div className="h-full flex items-center justify-center"><div className="h-40 w-80 bg-surface-2 rounded animate-pulse" /></div>

  if (workflows.length === 0) return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-3">
        <GitBranch className="h-8 w-8 text-muted-foreground/20 mx-auto" />
        <p className="text-sm text-muted-foreground">No workflows configured</p>
        <p className="text-xs text-muted-foreground/50">Use <code className="bg-surface-2 px-1 py-0.5 rounded">prjct workflow</code> to create workflows</p>
      </div>
    </div>
  )

  return (
    <div className="h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={2}
        snapToGrid
        snapGrid={[20, 20]}
        connectionLineStyle={{ stroke: 'hsl(160 60% 45% / 0.3)', strokeWidth: 2 }}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        className="!bg-background"
      >
        <Background color="hsl(var(--foreground) / 0.03)" gap={20} size={1} />
        <Controls showInteractive={false} className="!bg-card !border-border !rounded-lg !shadow-lg [&>button]:!bg-transparent [&>button]:!border-border [&>button]:!text-muted-foreground [&>button:hover]:!bg-surface-2" />
        <MiniMap
          nodeColor={(n) => n.type === 'command' ? 'hsl(var(--foreground) / 0.2)' : n.type === 'rule' ? 'hsl(160 60% 45% / 0.3)' : 'transparent'}
          maskColor="hsl(var(--background) / 0.85)"
          className="!bg-card !border-border !rounded-lg"
        />
      </ReactFlow>

      <div className="absolute top-3 right-3 z-10">
        <Button size="sm" variant="outline" className="text-xs bg-card shadow-lg" onClick={() => setAddDialog(workflows[0]?.name || '')}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add rule
        </Button>
      </div>

      {addDialog !== null && (
        <AddRuleDialog projectId={projectId} defaultCommand={addDialog} workflows={workflows} onClose={() => setAddDialog(null)} onSaved={refresh} />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Add Rule Dialog
// ═══════════════════════════════════════════════════════════════════════

function AddRuleDialog({ projectId, defaultCommand, workflows, onClose, onSaved }: {
  projectId: string; defaultCommand: string; workflows: Workflow[]; onClose: () => void; onSaved: () => void
}) {
  const [type, setType] = useState('hook')
  const [command, setCommand] = useState(defaultCommand)
  const [position, setPosition] = useState('after')
  const [action, setAction] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const typeInfo: Record<string, { icon: typeof Zap; color: string; title: string; desc: string; example: string }> = {
    hook: { icon: Zap, color: 'text-teal-400', title: 'Hook', desc: 'Runs a shell command or script. Doesn\'t block the workflow — if it fails, execution continues.', example: 'e.g. "Send Slack notification", "Update Linear ticket status"' },
    gate: { icon: Shield, color: 'text-amber-400', title: 'Gate', desc: 'A quality check that MUST pass before the workflow continues. If the gate fails, the entire workflow stops.', example: 'e.g. "npm test", "lint-staged", "type-check"' },
    step: { icon: Play, color: 'text-indigo-400', title: 'Step', desc: 'An additional action that runs as part of the workflow. Similar to a hook but treated as a required step.', example: 'e.g. "Build project", "Generate changelog"' },
    instruction: { icon: GitBranch, color: 'text-muted-foreground', title: 'Instruction', desc: 'A prompt or guidance passed to the AI agent. Not a shell command — this tells Claude what to do or consider.', example: 'e.g. "Always write tests for new features", "Follow conventional commits"' },
  }

  const currentType = typeInfo[type]

  async function handleSave() {
    if (!command.trim() || !action.trim()) return
    setSaving(true)
    try {
      await api.addWorkflowRule(projectId, {
        type: type as 'hook' | 'gate' | 'step' | 'instruction',
        command: command.trim(), position, action: action.trim(),
        description: description.trim() || null, enabled: true, timeoutMs: 30000,
      })
      onSaved(); onClose()
    } finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle className="text-sm font-semibold">Add workflow rule</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Type selector — visual cards */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Type</label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(typeInfo).map(([key, info]) => {
                const Icon = info.icon
                const selected = type === key
                return (
                  <button key={key} type="button" onClick={() => setType(key)}
                    className={cn(
                      "rounded-lg border p-2.5 text-left transition-colors",
                      selected ? "border-foreground/30 bg-surface-2" : "border-border hover:border-foreground/15 hover:bg-surface-2/50"
                    )}>
                    <Icon className={cn("h-4 w-4 mb-1.5", info.color)} />
                    <p className="text-xs font-semibold">{info.title}</p>
                  </button>
                )
              })}
            </div>
            {/* Type description */}
            <div className="mt-2.5 rounded-lg bg-surface-2/60 border border-border/60 px-3 py-2.5">
              <p className="text-xs text-foreground/80 leading-relaxed">{currentType.desc}</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1 italic">{currentType.example}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Workflow</label>
              <Select value={command} onValueChange={setCommand}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{workflows.map(w => <SelectItem key={w.name} value={w.name}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Position</label>
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="before">Before — runs before the command</SelectItem>
                  <SelectItem value="after">After — runs after completion</SelectItem>
                  <SelectItem value="on_error">On error — runs only if it fails</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{type === 'instruction' ? 'Instruction text' : 'Action (shell command)'}</label>
            <Input value={action} onChange={e => setAction(e.target.value)}
              placeholder={type === 'instruction' ? 'e.g. Always write tests for new features' : 'e.g. npm test, lint-staged'}
              className={cn("h-8 text-sm", type !== 'instruction' && "font-mono")} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Description (optional)</label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Short note about what this rule does" className="h-8 text-sm" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-3">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !command.trim() || !action.trim()}>{saving ? 'Adding…' : 'Add rule'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
