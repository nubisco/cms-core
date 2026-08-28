import type { LogicGraph, LogicKind } from './contract/index.js'
import type { LogicEnv } from './evaluate.js'

/**
 * App-side logic for the graph form of a Condition (the data shapes live in the
 * contract). The node catalog, Blueprint card mapping, and evaluator are here.
 * Inputs (feature flag, environment, ...) feed gates (AND/OR/NOT) that feed a
 * single Visible sink; graphs are referenced from a condition as
 * { kind: 'graph', graphId }.
 */

interface NodePort {
  id: string
  label: string
  type: 'input' | 'output'
}

interface NodeSpec {
  label: string
  color: string
  category: string
  ports: NodePort[]
  /** Which parameter this node carries, if any. */
  param?: 'flag' | 'environment' | 'region'
}

export const NODE_SPECS: Record<LogicKind, NodeSpec> = {
  featureFlag: {
    label: 'Feature flag',
    color: '#6e6bd6',
    category: 'input',
    ports: [{ id: 'out', label: 'on', type: 'output' }],
    param: 'flag',
  },
  environment: {
    label: 'Environment',
    color: '#b9781e',
    category: 'input',
    ports: [{ id: 'out', label: 'is', type: 'output' }],
    param: 'environment',
  },
  auth: {
    label: 'Signed in',
    color: '#2c9560',
    category: 'input',
    ports: [{ id: 'out', label: 'yes', type: 'output' }],
  },
  region: {
    label: 'Region',
    color: '#3a86c8',
    category: 'input',
    ports: [{ id: 'out', label: 'in', type: 'output' }],
    param: 'region',
  },
  and: {
    label: 'AND',
    color: '#5a5a6a',
    category: 'gate',
    ports: [
      { id: 'a', label: 'a', type: 'input' },
      { id: 'b', label: 'b', type: 'input' },
      { id: 'out', label: 'out', type: 'output' },
    ],
  },
  or: {
    label: 'OR',
    color: '#5a5a6a',
    category: 'gate',
    ports: [
      { id: 'a', label: 'a', type: 'input' },
      { id: 'b', label: 'b', type: 'input' },
      { id: 'out', label: 'out', type: 'output' },
    ],
  },
  not: {
    label: 'NOT',
    color: '#5a5a6a',
    category: 'gate',
    ports: [
      { id: 'in', label: 'in', type: 'input' },
      { id: 'out', label: 'out', type: 'output' },
    ],
  },
  visible: {
    label: 'Visible',
    color: '#c0392b',
    category: 'output',
    ports: [{ id: 'in', label: 'show', type: 'input' }],
  },
}

export interface BlueprintCard {
  id: string
  x: number
  y: number
  width: number
  height: number
  paint: { title: string; color: string; category: string; ports: NodePort[] }
}

/** Maps the logic graph to Blueprint card geometry + paint. */
export function toCards(graph: LogicGraph): BlueprintCard[] {
  return graph.nodes.map((n) => {
    const spec = NODE_SPECS[n.kind]
    const title = n.param ? `${spec.label}: ${n.param}` : spec.label
    return {
      id: n.id,
      x: n.x,
      y: n.y,
      width: 160,
      height: 52 + spec.ports.length * 8,
      paint: { title, color: spec.color, category: spec.category, ports: spec.ports },
    }
  })
}

export interface GraphResult {
  visible: boolean
  nodeOut: Record<string, boolean>
}

/** Evaluates the graph to the Visible sink's value, plus each node's output. */
export function evaluateGraph(graph: LogicGraph, env: LogicEnv): GraphResult {
  const memo: Record<string, boolean> = {}

  const sourceOf = (nodeId: string, port: string): string | undefined =>
    graph.connections.find((c) => c.toNode === nodeId && c.toPort === port)?.fromNode

  const inVal = (nodeId: string, port: string): boolean => {
    const src = sourceOf(nodeId, port)
    return src ? out(src) : false
  }

  function out(nodeId: string): boolean {
    // `noUncheckedIndexedAccess`: an index read is `boolean | undefined` even
    // after an `in` guard, so read once and narrow rather than trusting the key.
    const seen = memo[nodeId]
    if (seen !== undefined) return seen
    memo[nodeId] = false // break cycles defensively
    const node = graph.nodes.find((n) => n.id === nodeId)
    if (!node) return false
    let v = false
    switch (node.kind) {
      case 'featureFlag':
        v = env.featureFlag?.({ flag: node.param ?? '' }, undefined, undefined) ?? false
        break
      case 'environment':
        v = env.environment?.(undefined, 'is', node.param ?? 'staging') ?? false
        break
      case 'auth':
        v = env.auth?.(undefined, undefined, undefined) ?? false
        break
      case 'region':
        v = env.region?.(undefined, 'in', [node.param ?? '']) ?? false
        break
      case 'and':
        v = inVal(nodeId, 'a') && inVal(nodeId, 'b')
        break
      case 'or':
        v = inVal(nodeId, 'a') || inVal(nodeId, 'b')
        break
      case 'not':
        v = !inVal(nodeId, 'in')
        break
      case 'visible':
        v = inVal(nodeId, 'in')
        break
    }
    memo[nodeId] = v
    return v
  }

  const sink = graph.nodes.find((n) => n.kind === 'visible')
  const nodeOut: Record<string, boolean> = {}
  for (const n of graph.nodes) nodeOut[n.id] = out(n.id)
  return { visible: sink ? out(sink.id) : false, nodeOut }
}
