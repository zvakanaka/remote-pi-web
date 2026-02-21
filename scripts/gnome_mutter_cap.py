#!/usr/bin/env python3
"""
GNOME Wayland screen capture via org.gnome.Mutter.ScreenCast + PipeWire + GStreamer.
Single persistent process — one Mutter session for both dimension query and frame streaming.

Usage:
  gnome_mutter_cap.py [divider=1]

Startup output (stderr):
  "DIMS W H\n"   full screen dimensions (Node.js reads this to resolve queryDimensions)

Stream protocol (after DIMS is emitted):
  stdin  '\n'        → trigger one frame capture
  stdout nW*nH*3 bytes → raw RGB frame  (nW=round(W/divider), nH=round(H/divider))
"""

import sys
import os
import fcntl
import gi

gi.require_version('GLib', '2.0')
gi.require_version('Gst', '1.0')
gi.require_version('GstApp', '1.0')
from gi.repository import GLib, Gst, GstApp  # noqa: F401

import dbus
import dbus.mainloop.glib

MUTTER_BUS = 'org.gnome.Mutter.ScreenCast'
MUTTER_PATH = '/org/gnome/Mutter/ScreenCast'


def log(msg):
    print(f'gnome_mutter_cap: {msg}', file=sys.stderr, flush=True)


def setup_mutter_session(bus):
    log('creating ScreenCast session')
    mutter_obj = bus.get_object(MUTTER_BUS, MUTTER_PATH)
    screencopy = dbus.Interface(mutter_obj, MUTTER_BUS)

    session_path = screencopy.CreateSession(dbus.Dictionary({}, signature='sv'))
    log(f'session={session_path}')
    session_obj = bus.get_object(MUTTER_BUS, session_path)
    session = dbus.Interface(session_obj, f'{MUTTER_BUS}.Session')

    stream_path = session.RecordMonitor(
        '',  # empty = primary monitor
        dbus.Dictionary({'cursor-mode': dbus.UInt32(1)}, signature='sv')
    )
    log(f'stream={stream_path}')

    loop = GLib.MainLoop()
    node_id = [None]
    timeout_id = [None]

    def on_pw_added(nid, **_kw):
        log(f'PipeWireStreamAdded node_id={nid}')
        node_id[0] = int(nid)
        if timeout_id[0] is not None:
            GLib.source_remove(timeout_id[0])  # cancel stale timeout
            timeout_id[0] = None
        loop.quit()

    bus.add_signal_receiver(
        on_pw_added,
        signal_name='PipeWireStreamAdded',
        dbus_interface=f'{MUTTER_BUS}.Stream',
        path=str(stream_path),
    )

    log('session.Start() ...')
    session.Start()
    log('waiting for PipeWireStreamAdded')

    def on_timeout():
        log('timeout waiting for PipeWire — aborting')
        loop.quit()
        return False

    timeout_id[0] = GLib.timeout_add_seconds(15, on_timeout)
    loop.run()

    if node_id[0] is None:
        log('no PipeWire node ID — aborting')
        sys.exit(1)

    return node_id[0]


def get_dims_gdk():
    """Get screen dimensions from GDK — fast, no GStreamer, always on GNOME."""
    try:
        gi.require_version('Gdk', '3.0')
        from gi.repository import Gdk
        display = Gdk.Display.get_default()
        if display is None:
            log('GDK: no default display')
            return None, None
        n = display.get_n_monitors()
        if n == 0:
            log('GDK: no monitors')
            return None, None
        # Bounding box of all monitors (handles multi-monitor setups)
        max_x = max_y = 0
        for i in range(n):
            m = display.get_monitor(i)
            g = m.get_geometry()
            s = m.get_scale_factor()
            max_x = max(max_x, (g.x + g.width) * s)
            max_y = max(max_y, (g.y + g.height) * s)
        return int(max_x), int(max_y)
    except Exception as e:
        log(f'GDK dims failed: {e}')
        return None, None


def main():
    Gst.init(None)
    dbus.mainloop.glib.DBusGMainLoop(set_as_default=True)

    divider = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0

    # ── Get screen dimensions from GDK (no GStreamer probe needed) ──────────
    W, H = get_dims_gdk()
    if not W or not H:
        log('could not determine screen dimensions — aborting')
        sys.exit(1)

    bus = dbus.SessionBus()
    node_id = setup_mutter_session(bus)

    nW = round(W / divider)
    nH = round(H / divider)

    # Report full dims to Node.js (gnome_cap.js watches stderr for "DIMS W H")
    print(f'DIMS {W} {H}', file=sys.stderr, flush=True)
    log(f'screen={W}x{H}  scaled={nW}x{nH}  divider={divider}')

    src = f'pipewiresrc path={node_id} do-timestamp=true'

    # ── Start persistent stream pipeline at scaled resolution ──────────────
    pipe = Gst.parse_launch(
        f'{src} ! videoconvert ! videoscale ! '
        f'video/x-raw,format=RGB,width={nW},height={nH} ! '
        f'appsink name=sink max-buffers=1 drop=true emit-signals=true sync=false'
    )
    sink = pipe.get_by_name('sink')
    current = [None]
    frame_requested = [False]
    out = os.fdopen(sys.stdout.fileno(), 'wb', buffering=0)
    s_loop = GLib.MainLoop()

    def write_current():
        s = current[0]
        if s is None:
            return
        buf = s.get_buffer()
        ok, mapinfo = buf.map(Gst.MapFlags.READ)
        if ok:
            out.write(bytes(mapinfo.data))
            buf.unmap(mapinfo)

    def on_sample(s):
        current[0] = s.emit('pull-sample')
        if frame_requested[0]:
            # Node.js sent '\n' before the first frame arrived — write it now
            frame_requested[0] = False
            write_current()
        return Gst.FlowReturn.OK

    # Watch pipeline bus so GStreamer errors show up in the log
    gst_bus = pipe.get_bus()
    gst_bus.add_signal_watch()
    def on_bus_msg(_bus, msg):
        if msg.type == Gst.MessageType.ERROR:
            err, dbg = msg.parse_error()
            log(f'GStreamer ERROR: {err.message} | {dbg}')
            s_loop.quit()
        elif msg.type == Gst.MessageType.WARNING:
            err, _ = msg.parse_warning()
            log(f'GStreamer WARNING: {err.message}')
    gst_bus.connect('message', on_bus_msg)

    sink.connect('new-sample', on_sample)
    pipe.set_state(Gst.State.PLAYING)

    # Non-blocking stdin so the GLib loop keeps running
    flags = fcntl.fcntl(sys.stdin.fileno(), fcntl.F_GETFL)
    fcntl.fcntl(sys.stdin.fileno(), fcntl.F_SETFL, flags | os.O_NONBLOCK)

    def on_stdin(fd, _condition):
        try:
            data = os.read(fd, 64)
        except BlockingIOError:
            return True
        if not data:
            s_loop.quit()
            return False
        if current[0] is not None:
            write_current()
        else:
            # No frame yet — defer write until on_sample fires
            frame_requested[0] = True
        return True

    GLib.io_add_watch(sys.stdin.fileno(), GLib.IOCondition.IN, on_stdin)
    s_loop.run()
    pipe.set_state(Gst.State.NULL)


if __name__ == '__main__':
    main()
