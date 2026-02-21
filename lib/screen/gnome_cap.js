/**
 * GNOME Wayland screen capture — single persistent Python process.
 *
 * The Python script (gnome_mutter_cap.py) is spawned once with the divider arg.
 * It emits "DIMS W H\n" on stderr when ready, then accepts '\n' on stdin to
 * trigger frame captures (raw RGB written to stdout).
 */
const { spawn } = require('child_process')
const path = require('path')

const SCRIPT = path.join(__dirname, '../../scripts/gnome_mutter_cap.py')

let _proc        = null
let _busy        = false
let _chunks      = []
let _bytesReceived = 0
let _frameBytes  = 0
let _pendingResolve = null
let _pendingReject  = null
let _pendingBuffer  = null

let _dimsPromise  = null
let _dimsResolve  = null
let _dimsReject   = null

function spawnProcess(divider) {
  if (_proc) return

  _dimsPromise = new Promise((resolve, reject) => {
    _dimsResolve = resolve
    _dimsReject  = reject
  })

  _proc = spawn('python3', [SCRIPT, String(divider)])

  _proc.on('error', (err) => {
    console.error(`gnome_mutter_cap spawn error: ${err.message}`)
    _proc = null
    if (_dimsReject)  { _dimsReject(err);  _dimsReject  = null }
    if (_pendingReject) { _pendingReject(err); _pendingReject = null }
    _busy = false
  })

  _proc.stderr.on('data', (data) => {
    const str = data.toString()
    // Watch for the DIMS handshake line
    const m = str.match(/^DIMS (\d+) (\d+)/m)
    if (m && _dimsResolve) {
      _dimsResolve({ width: parseInt(m[1], 10), height: parseInt(m[2], 10) })
      _dimsResolve = null
    }
    process.stderr.write(`gnome_mutter_cap: ${str}`)
  })

  _proc.stdout.on('data', (chunk) => {
    _chunks.push(chunk)
    _bytesReceived += chunk.length
    if (_bytesReceived >= _frameBytes) {
      const resolve = _pendingResolve
      const buf     = _pendingBuffer
      _pendingResolve = null
      _pendingReject  = null
      _pendingBuffer  = null
      _busy = false
      let offset = 0
      for (const c of _chunks) { c.copy(buf, offset); offset += c.length }
      _chunks = []
      _bytesReceived = 0
      if (resolve) resolve()
    }
  })

  _proc.stdout.on('error', (err) => {
    const reject = _pendingReject
    _pendingResolve = null; _pendingReject = null; _pendingBuffer = null
    _busy = false; _chunks = []; _bytesReceived = 0
    if (reject) reject(err)
  })

  _proc.on('close', (code) => {
    _proc = null
    const reject = _pendingReject
    _pendingResolve = null; _pendingReject = null; _pendingBuffer = null
    _busy = false; _chunks = []; _bytesReceived = 0
    if (reject) reject(new Error(`gnome_mutter_cap exited with code ${code}`))
    else if (code) console.warn(`gnome_mutter_cap: exited (${code}), will respawn on next frame`)
    if (_dimsReject) { _dimsReject(new Error(`process exited (${code})`)); _dimsReject = null }
  })
}

/** Called by screenDimensions.js — spawns the process and waits for DIMS. */
async function queryDimensions(divider) {
  if (!_proc) spawnProcess(divider)
  return _dimsPromise
}

/** library.getScreen — triggers a frame on the already-running process. */
const library = {
  getScreen: (xx, yy, W, H, nW, nH, buffer) => new Promise((resolve, reject) => {
    if (_busy) return reject(new Error('gnome_mutter_cap busy'))
    if (!_proc) return reject(new Error('gnome_mutter_cap process not running'))
    _busy = true
    _frameBytes    = nW * nH * 3
    _chunks        = []
    _bytesReceived = 0
    _pendingBuffer  = buffer
    _pendingResolve = resolve
    _pendingReject  = reject
    _proc.stdin.write('\n', (err) => {
      if (err) {
        _busy = false; _pendingBuffer = null; _pendingResolve = null; _pendingReject = null
        reject(err)
      }
    })
  })
}

module.exports = { library, queryDimensions }
