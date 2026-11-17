export type ClassValue =
  | string
  | number
  | boolean
  | undefined
  | null
  | { [key: string]: any }
  | ClassArray

export type ClassArray = ClassValue[]

export default function cn(...inputs: ClassValue[]): string {
  const classes: string[] = []

  for (let i = 0; i < inputs.length; i++) {
    const arg = inputs[i]
    if (!arg) continue

    const argType = typeof arg

    if (argType === 'string' || argType === 'number') {
      classes.push(arg.toString())
    } else if (Array.isArray(arg)) {
      if (arg.length) {
        const inner = cn(...arg)
        if (inner) {
          classes.push(inner)
        }
      }
    } else if (argType === 'object') {
      if (
        arg.toString !== Object.prototype.toString &&
        !arg.toString.toString().includes('[native code]')
      ) {
        classes.push(arg.toString())
        continue
      }

      for (const key in arg as Record<string, any>) {
        if (
          Object.prototype.hasOwnProperty.call(arg, key) &&
          (arg as Record<string, any>)[key]
        ) {
          classes.push(key)
        }
      }
    }
  }

  return classes.join(' ')
}
