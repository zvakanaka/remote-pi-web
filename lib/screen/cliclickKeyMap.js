// https://github.com/BlueM/cliclick

function singleCharacter(incomingKey) {
  return incomingKey.length === 1 ? incomingKey : undefined
}

module.exports = function key(incomingKey, ctrl, alt, shift, cmd, fn) {
  const currentKey = {
    'Backspace': 'delete',
    'Tab': 'tab',
    'Enter': 'enter',
    'Pause': 'play-pause',
    'Escape': 'esc',
    'Delete': 'fwd-delete',
    'Home': 'home',
    'ArrowLeft': 'arrow-left',
    'ArrowUp': 'arrow-up',
    'ArrowRight': 'arrow-right',
    'ArrowDown': 'arrow-down',
    'PageUp': 'page-up',
    'Next': 'play-next',
    'PageDown': 'page-down',
    'End': 'end',
    'F1': 'f1',
    'F2': 'f2',
    'F3': 'f3',
    'F4': 'f4',
    'F5': 'f5',
    'F6': 'f6',
    'F7': 'f7',
    'F8': 'f8',
    'F9': 'f9',
    'F10': 'f10',
    'F11': 'f11',
    'F12': 'f12',
    'F12': 'f13',
    'F12': 'f14',
    'F12': 'f15',
    'F12': 'f16',
    ' ': 'space',
  }[incomingKey] || singleCharacter(incomingKey);

  if (currentKey) {
    const modifierKeys = []
    if (ctrl) modifierKeys.push(ctrl)
    if (alt) modifierKeys.push(alt)
    if (shift) modifierKeys.push(shift)
    if (cmd) modifierKeys.push(cmd) // TODO: support cmd
    if (fn) modifierKeys.push(fn) // TODO: support fn

    const keyPressCommandPiece = ` ${currentKey.length === 1 ? `t:${currentKey}` : `kp:${currentKey}`}`
    const modifierKeysCommandPiece = modifierKeys.length > 0 ? `  kd:${modifierKeys.join(',')}` : ''
    const modifierKeysUpCommandPiece = modifierKeys.length > 0 ? `  ku:${modifierKeys.join(',')}` : ''
    return `${keyPressCommandPiece}${modifierKeysCommandPiece}${modifierKeysUpCommandPiece}`
  }
}
