import type { Condition, LogicGraph, Op } from './contract/index.js'
import { evaluateGraph } from './graph.js'

/**
 * Resolves one logic input to a boolean, given the author's params/op/value.
 * The host provides one resolver per registered input id (featureFlag,
 * environment, auth, region, ...). This is where build-time vs request-time
 * resolution actually happens; the contract only declares which is which.
 */
export type InputResolver = (
  params: Record<string, unknown> | undefined,
  op: Op | undefined,
  value: unknown,
) => boolean

export type LogicEnv = Record<string, InputResolver>

/**
 * Evaluates a Condition tree to a visibility boolean. `graphs` supplies the
 * logic graphs referenced by { kind: 'graph' } conditions (stored on the page
 * document); a graph condition with no matching graph defaults to visible.
 */
export function evaluate(
  condition: Condition | undefined,
  env: LogicEnv,
  graphs?: Record<string, LogicGraph>,
): boolean {
  if (!condition || condition.kind === 'always') return true
  switch (condition.kind) {
    case 'simple': {
      const resolve = env[condition.input]
      return resolve ? resolve(condition.params, condition.op, condition.value) : false
    }
    case 'all':
      return condition.of.every((c) => evaluate(c, env, graphs))
    case 'any':
      return condition.of.some((c) => evaluate(c, env, graphs))
    case 'not':
      return !evaluate(condition.of, env, graphs)
    case 'graph': {
      const graph = graphs?.[condition.graphId]
      return graph ? evaluateGraph(graph, env).visible : true
    }
  }
}
