/**
 * Logic contract: visibility and variation conditions.
 *
 * A Condition gates whether a Block or Page renders. It is either a simple
 * predicate, a boolean tree, or a reference to a NubiscoUI Blueprint graph for
 * the genuinely compound cases. Most content uses a simple predicate; the graph
 * is the escape hatch, not the default.
 *
 * Logic inputs are a registry. Adding a new input type (e.g. campaign source)
 * later is one LogicInputDefinition plus one Blueprint NodeDefinition. Nothing
 * in the engine or the content schema changes.
 */

export type Op = 'is' | 'not' | 'in' | 'gte' | 'lte' | 'between'

export type Condition =
  | { kind: 'always' }
  | {
      kind: 'simple'
      /** A registered LogicInputDefinition id. */
      input: string
      /** Input parameters, e.g. { flag: 'stagewright' } for featureFlag. */
      params?: Record<string, unknown>
      /** Comparison for enum/number/date inputs. Boolean inputs need none. */
      op?: Op
      value?: unknown
    }
  | { kind: 'all'; of: Condition[] } // AND
  | { kind: 'any'; of: Condition[] } // OR
  | { kind: 'not'; of: Condition }
  /** Reference to a serialized Blueprint graph stored alongside the content. */
  | { kind: 'graph'; graphId: string }

/**
 * Where a logic input can be evaluated. This is load-bearing for delivery:
 *  - `build`   inputs (flag, environment, locale) let a gated block prerender.
 *  - `request` inputs (auth, region) force the block to be resolved at the edge
 *              (a Worker) or revealed client-side. It cannot be baked.
 * A block whose condition mixes both is resolved at the most dynamic site.
 */
export type ResolveAt = 'build' | 'request'

export type LogicValueType = 'boolean' | 'enum' | 'number' | 'date'

/**
 * A logic input type, registered once. The value is resolved by a host-provided
 * resolver keyed by `id`; this definition only declares the shape and where it
 * can run, so the visual editor and the evaluator are fully data-driven.
 */
// ─── Logic graphs: the visual form of a Condition ────────────────────────
// A block's condition can reference a graph ({ kind: 'graph', graphId }); the
// graph itself is stored on the page document. These are pure data shapes; the
// node catalog and the evaluator live in the app, not the contract.

export type LogicKind =
  | 'featureFlag'
  | 'environment'
  | 'auth'
  | 'region'
  | 'and'
  | 'or'
  | 'not'
  | 'visible'

export interface LogicNode {
  id: string
  kind: LogicKind
  x: number
  y: number
  /** Flag key / environment value / region code, for the input nodes. */
  param?: string
}

export interface GraphConnection {
  fromNode: string
  fromPort: string
  toNode: string
  toPort: string
}

export interface LogicGraph {
  nodes: LogicNode[]
  connections: GraphConnection[]
}

export interface LogicInputDefinition {
  id: string
  label: string
  valueType: LogicValueType
  /** Parameters the author fills in, e.g. featureFlag needs a `flag`. */
  params?: Record<string, import('./content.js').FieldSchema>
  resolveAt: ResolveAt
  /** Allowed values for enum inputs (environment, region, locale). */
  enumValues?: string[]
}

/**
 * The initial catalog. Extend by appending a definition (and, for the visual
 * editor, a matching Blueprint NodeDefinition). `campaignSource` is the worked
 * example of a future input: append one entry with resolveAt: 'request'.
 */
export const CORE_LOGIC_INPUTS: LogicInputDefinition[] = [
  {
    id: 'featureFlag',
    label: 'Feature flag',
    valueType: 'boolean',
    params: { flag: { type: 'text', label: 'Flag key', required: true } },
    resolveAt: 'build',
  },
  {
    id: 'environment',
    label: 'Environment',
    valueType: 'enum',
    enumValues: ['staging', 'production'],
    resolveAt: 'build',
  },
  {
    id: 'locale',
    label: 'Locale',
    valueType: 'enum',
    enumValues: ['en', 'pt', 'es', 'fr'],
    resolveAt: 'build',
  },
  {
    id: 'schedule',
    label: 'Schedule window',
    valueType: 'date',
    params: {
      from: { type: 'date', label: 'From' },
      to: { type: 'date', label: 'To' },
    },
    resolveAt: 'build',
  },
  {
    id: 'auth',
    label: 'Signed in',
    valueType: 'boolean',
    resolveAt: 'request',
  },
  {
    id: 'region',
    label: 'Region',
    valueType: 'enum',
    enumValues: ['EU', 'NA', 'SA', 'AS', 'AF', 'OC'],
    resolveAt: 'request',
  },
]
