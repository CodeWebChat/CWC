import * as vscode from 'vscode'

type ChainEntry<TMeta = undefined> = {
  promise: Promise<void>
  resolve: () => void
  meta: TMeta
}

export class WaitingChain<TMeta = undefined> {
  private _chains = new Map<string, ChainEntry<TMeta>>()

  enqueue(params: {
    key: string
    meta?: TMeta
    should_wait?: (previous_meta: TMeta) => boolean
    replace_tail?: boolean
  }) {
    const previous = this._chains.get(params.key)
    const must_wait =
      !!previous &&
      (params.should_wait ? params.should_wait(previous.meta) : true)

    let resolve_gate!: () => void
    const gate_promise = new Promise<void>((resolve) => {
      resolve_gate = resolve
    })

    const promise =
      previous && must_wait
        ? Promise.all([previous.promise, gate_promise]).then(() => {})
        : gate_promise

    const entry: ChainEntry<TMeta> = {
      promise,
      resolve: resolve_gate,
      meta: params.meta as TMeta
    }

    if (!previous || !must_wait || (params.replace_tail ?? true)) {
      this._chains.set(params.key, entry)
    }

    let is_released = false
    const release = () => {
      if (is_released) return
      is_released = true
      if (this._chains.get(params.key)?.promise === promise) {
        this._chains.delete(params.key)
      }
      resolve_gate()
    }

    const wait = async (
      cancel_source?: AbortSignal | vscode.CancellationToken
    ) => {
      if (!must_wait || !previous) return
      if (!cancel_source) {
        await previous.promise
        return
      }

      let cleanup: (() => void) | undefined
      const abort_promise = new Promise<void>((_, reject) => {
        if ('aborted' in cancel_source) {
          if (cancel_source.aborted) return reject(cancel_source.reason)
          const on_abort = () => reject(cancel_source.reason)
          cancel_source.addEventListener('abort', on_abort, { once: true })
          cleanup = () => cancel_source.removeEventListener('abort', on_abort)
        } else {
          if (cancel_source.isCancellationRequested) {
            return reject(new Error('Cancelled'))
          }
          const d = cancel_source.onCancellationRequested(() => {
            d.dispose()
            reject(new Error('Cancelled'))
          })
          cleanup = () => d.dispose()
        }
      })

      try {
        await Promise.race([previous.promise, abort_promise])
      } finally {
        cleanup?.()
      }
    }

    return { must_wait, wait, release }
  }
}
