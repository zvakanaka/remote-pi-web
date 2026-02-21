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

    def on_pw_added(nid, **_kw):
        log(f'PipeWireStreamAdded node_id={nid}')
        node_id[0] = int(nid)
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

    GLib.timeout_add_seconds(15, lambda: (log('timeout waiting for PipeWire'), loop.quit(), False)[2])
    loop.run()

    if node_id[0] is None:
        log('no PipeWire node ID — aborting')
        sys.exit(1)

    return node_id[0]


def main():
    Gst.init(None)
    dbus.mainloop.glib.DBusGMainLoop(set_as_default=True)

    divider = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0

    bus = dbus.SessionBus()
    node_id = setup_mutter_session(bus)

    src = f'pipewiresrc path={node_id} do-timestamp=true'

    # ── Step 1: probe full-resolution dims from one frame ──────────────────
    probe = Gst.parse_launch(
        f'{src} ! videoconvert ! video/x-raw,format=RGB ! '
        f'appsink name=sink max-buffers=1 drop=true emit-signals=true sync=false'
    )
    probe_sink = probe.get_by_name('sink')
    sample = [None]
    probe_loop = GLib.MainLoop()

    def on_probe_sample(s):
        sample[0] = s.emit('pull-sample')
        probe_loop.quit()
        return Gst.FlowReturn.OK

    probe_sink.connect('new-sample', on_probe_sample)
    probe.set_state(Gst.State.PLAYING)
    GLib.timeout_add_seconds(10, lambda: (probe_loop.quit(), False)[1])
    probe_loop.run()
    probe.set_state(Gst.State.NULL)

    if not sample[0]:
        log('no frame from probe pipeline')
        sys.exit(1)

    caps = sample[0].get_caps()
    st = caps.get_structure(0)
    W = st.get_int('width')[1]
    H = st.get_int('height')[1]
    nW = round(W / divider)
    nH = round(H / divider)

    # Report full dims to Node.js (gnome_cap.js watches stderr for "DIMS W H")
    print(f'DIMS {W} {H}', file=sys.stderr, flush=True)
    log(f'screen={W}x{H}  scaled={nW}x{nH}  divider={divider}')

    # ── Step 2: persistent stream pipeline at scaled resolution ────────────
    pipe = Gst.parse_launch(
        f'{src} ! videoconvert ! videoscale ! '
        f'video/x-raw,format=RGB,width={nW},height={nH} ! '
        f'appsink name=sink max-buffers=1 drop=true emit-signals=true sync=false'
    )
    sink = pipe.get_by_name('sink')
    current = [None]
    out = os.fdopen(sys.stdout.fileno(), 'wb', buffering=0)
    s_loop = GLib.MainLoop()

    def on_sample(s):
        current[0] = s.emit('pull-sample')
        return Gst.FlowReturn.OK

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
        s = current[0]
        if s is not None:
            buf = s.get_buffer()
            ok, mapinfo = buf.map(Gst.MapFlags.READ)
            if ok:
                out.write(bytes(mapinfo.data))
                buf.unmap(mapinfo)
        return True

    GLib.io_add_watch(sys.stdin.fileno(), GLib.IOCondition.IN, on_stdin)
    s_loop.run()
    pipe.set_state(Gst.State.NULL)


if __name__ == '__main__':
    main()
