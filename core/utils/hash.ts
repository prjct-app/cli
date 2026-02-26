import { createHash } from 'node:crypto'

export function sha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex')
}

export function sha256Short(input: string): string {
  return sha256(input).slice(0, 16)
}

export function md5(input: string | Buffer): string {
  return createHash('md5').update(input).digest('hex')
}
