const { spawn, execFile } = require('child_process')
const path = require('path')

const SCRIPT = path.join(__dirname, '../../scripts/gnome_mutter_cap.py')

/* ---- screen dimensions (query mode) ---- */

async function queryDimensions() {
  return new Promise((resolve, reject) => {
    execFile('python3', [SCRIPT, 'query'], { timeout: 15000 }, (err, stdout) => {
      if (err) return reject(new Error(`gnome_mutter_cap query failed: ${err.message}`))
      const [w, h] = stdout.trim().split(' ')
      if (!w || !h) return reject(new Error(`gnome_mutter_cap: bad query output: "${stdout.trim()}"`))
      resolve({ width: parseInt(w, 10), height: parseInt(h, 10) })
    })
  })
}

/* ---- persistent stream process (same interface as wayland_cap) ---- */

let _proc = null
let _busy = false
let _pendingResolve = null
let _pendingReject = null
let _pendingBuffer = null
let _chunks = []
let _bytesReceived = 0
let _frameBytes = 0

function spawnStream(nW, nH) {
  _chunks = []
  _bytesReceived = 0
  _frameBytes = nW * nH * 3

  const proc = spawn('python3', [SCRIPT, 'stream', String(nW), String(nH)])

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
      for (const c of _chunks) { c.copy(buf, offset); offset += c.length }
      _chunks = []
      _bytesReceived = 0
      if (resolve) resolve()
    }
  })

  proc.stdout.on('error', (err) => {
    const reject = _pendingReject
    _pendingResolve = null; _pendingReject = null; _pendingBuffer = null
    _busy = false; _chunks = []; _bytesReceived = 0
    if (reject) reject(err)
  })

  proc.on('close', (code) => {
    _proc = null
    const reject = _pendingReject
    _pendingResolve = null; _pendingReject = null; _pendingBuffer = null
    _busy = false; _chunks = []; _bytesReceived = 0
    if (reject) reject(new Error(`gnome_mutter_cap exited with code ${code}`))
    else console.warn(`gnome_mutter_cap: process exited (code ${code}), will respawn on next frame`)
  })

  proc.stderr.on('data', (data) => process.stderr.write(`gnome_mutter_cap: ${data}`))

  _proc = proc
}

const library = {
  getScreen: (xx, yy, W, H, nW, nH, buffer) => new Promise((resolve, reject) => {
    if (_busy) return reject(new Error('gnome_mutter_cap busy'))
    if (!_proc) spawnStream(nW, nH)
    _busy = true
    _pendingBuffer = buffer
    _pendingResolve = resolve
    _pendingReject = reject
    _proc.stdin.write('\n', (err) => {
      if (err) {
        _busy = false; _pendingBuffer = null; _pendingResolve = null; _pendingReject = null
        reject(err)
      }
    })
  })
}

module.exports = { library, queryDimensions }
