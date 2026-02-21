const { execFile, spawn } = require('child_process')
const path = require('path')
const screenDimensions = require('./screenDimensions')

const isOSX      = process.platform === 'darwin'
const isWayland  = process.env.XDG_SESSION_TYPE === 'wayland'

if (!isOSX && !isWayland && process.env.XDG_SESSION_TYPE !== 'x11') {
  console.warn(`No support for $XDG_SESSION_TYPE '${process.env.XDG_SESSION_TYPE}'`)
}

/* Persistent wayland_cap process state (stream mode) */
let _proc = null
let _busy = false
let _pendingResolve = null
let _pendingReject = null
let _pendingBuffer = null
let _chunks = []
let _bytesReceived = 0
let _frameBytes = 0

function spawnWaylandCap(execPath, xx, yy, W, H, nW, nH) {
  _chunks = []
  _bytesReceived = 0
  _frameBytes = nW * nH * 3

  const proc = spawn(execPath, [
    'stream',
    String(xx), String(yy), String(W), String(H), String(nW), String(nH)
  ])

  proc.stdout.on('data', (chunk) => {
    _chunks.push(chunk)
    _bytesReceived += chunk.length
    if (_bytesReceived >= _frameBytes) {
      const resolve = _pendingResolve
      const buf = _pendingBuffer
      _pendingResolve = null
      _pendingReject = null
      _pendingBuffer = null
      _busy = false
      let offset = 0
      for (const c of _chunks) {
        c.copy(buf, offset)
        offset += c.length
      }
      _chunks = []
      _bytesReceived = 0
      if (resolve) resolve()
    }
  })

  proc.stdout.on('error', (err) => {
    const reject = _pendingReject
    _pendingResolve = null
    _pendingReject = null
    _pendingBuffer = null
    _busy = false
    _chunks = []
    _bytesReceived = 0
    if (reject) reject(err)
  })

  proc.on('close', (code) => {
    _proc = null
    const reject = _pendingReject
    _pendingResolve = null
    _pendingReject = null
    _pendingBuffer = null
    _busy = false
    _chunks = []
    _bytesReceived = 0
    if (reject) reject(new Error(`wayland_cap exited with code ${code}`))
    else console.warn(`wayland_cap: process exited (code ${code}), will respawn on next frame`)
  })

  proc.stderr.on('data', (data) => {
    process.stderr.write(`wayland_cap: ${data}`)
  })

  _proc = proc
}

module.exports = async function setupNativeGetScreen(divider = process.env.DIVIDER || 1) {
  const { width, height } = await screenDimensions()
  const newWidth = Math.round(width / divider)
  const newHeight = Math.round(height / divider)
  const size = newWidth * newHeight
  const buf = Buffer.alloc(size * 3) // multiply by 3 for RGB

  const execName = isWayland ? 'wayland_cap' : 'screen_cap'
  const execPath = path.join(__dirname, '../../lib/screen', execName)

  const library = isWayland ? {
    getScreen: (xx, yy, W, H, nW, nH, buffer) => new Promise((resolve, reject) => {
      if (_busy) return reject(new Error('wayland_cap busy'))
      if (!_proc) spawnWaylandCap(execPath, xx, yy, W, H, nW, nH)
      _busy = true
      _pendingBuffer = buffer
      _pendingResolve = resolve
      _pendingReject = reject
      _proc.stdin.write('\n', (err) => {
        if (err) {
          _busy = false
          _pendingBuffer = null
          _pendingResolve = null
          _pendingReject = null
          reject(err)
        }
      })
    })
  } : {
    getScreen: (xx, yy, W, H, nW, nH, buffer) => new Promise((resolve, reject) => {
      execFile(execPath, [
        String(xx), String(yy), String(W), String(H), String(nW), String(nH)
      ], { maxBuffer: nW * nH * 3, encoding: 'buffer' }, (err, stdout) => {
        if (err) return reject(err)
        stdout.copy(buffer)
        resolve()
      })
    })
  }

  return { buf, library, width, height, newWidth, newHeight }
}
