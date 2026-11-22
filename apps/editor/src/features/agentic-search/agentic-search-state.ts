export class AgenticSearchState {
  private _in_progress: boolean = false
  private _abort_controller: AbortController | null = null
  private _completion_promise: Promise<void> | null = null
  private _resolve_completion: (() => void) | null = null

  get in_progress(): boolean {
    return this._in_progress
  }

  set in_progress(value: boolean) {
    this._in_progress = value
    if (value) {
      if (!this._abort_controller) {
        this._abort_controller = new AbortController()
      }
      if (!this._completion_promise) {
        this._completion_promise = new Promise<void>((resolve) => {
          this._resolve_completion = resolve
        })
      }
    } else {
      if (this._abort_controller) {
        this._abort_controller.abort()
        this._abort_controller = null
      }
      if (this._resolve_completion) {
        this._resolve_completion()
        this._resolve_completion = null
        this._completion_promise = null
      }
    }
  }

  get abort_signal(): AbortSignal | undefined {
    return this._abort_controller?.signal
  }

  async cancel() {
    if (this._abort_controller) {
      this._abort_controller.abort()
    }
    if (this._completion_promise) {
      await this._completion_promise
    }
  }
}
