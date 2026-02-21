#!/usr/bin/env python3
"""
GNOME Wayland screen capture via org.gnome.Mutter.ScreenCast + PipeWire + GStreamer.
No user dialog required. Same stream interface as wayland_cap.

Usage:
  gnome_mutter_cap.py query          -> print "W H" to stdout
  gnome_mutter_cap.py stream nW nH   -> on each stdin newline, write nW*nH*3 raw RGB bytes to stdout
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


def setup_mutter_session(bus):
    """Create a Mutter ScreenCast session and return (node_id, pw_fd).
    pw_fd may be None if OpenPipeWireRemote fails; fall back to default PipeWire socket."""
    mutter_obj = bus.get_object(MUTTER_BUS, MUTTER_PATH)
    screencopy = dbus.Interface(mutter_obj, MUTTER_BUS)

    session_path = screencopy.CreateSession(dbus.Dictionary({}, signature='sv'))
    session_obj = bus.get_object(MUTTER_BUS, session_path)
    session = dbus.Interface(session_obj, f'{MUTTER_BUS}.Session')

    stream_path = session.RecordMonitor(
        '',  # empty = primary monitor
        dbus.Dictionary({'cursor-mode': dbus.UInt32(1)}, signature='sv')
    )
    stream_obj = bus.get_object(MUTTER_BUS, stream_path)
    stream_iface = dbus.Interface(stream_obj, f'{MUTTER_BUS}.Stream')

    loop = GLib.MainLoop()
    node_id = [None]

    def on_pw_added(nid):
        node_id[0] = int(nid)
        loop.quit()

    stream_iface.connect_to_signal('PipeWireStreamAdded', on_pw_added)
    session.Start()

    def on_timeout():
        print('gnome_mutter_cap: timed out waiting for PipeWire stream', file=sys.stderr)
        loop.quit()
        return False

    GLib.timeout_add_seconds(10, on_timeout)
    loop.run()

    if node_id[0] is None:
        print('gnome_mutter_cap: no PipeWire node ID received', file=sys.stderr)
        sys.exit(1)

    pw_fd = None
    try:
        pw_fd = int(session.OpenPipeWireRemote(dbus.Dictionary({}, signature='sv')))
    except Exception as e:
        print(f'gnome_mutter_cap: OpenPipeWireRemote failed ({e}), using default PipeWire socket', file=sys.stderr)

    return node_id[0], pw_fd


def build_pipeline(node_id, pw_fd, mode, nW, nH):
    if pw_fd is not None:
        src = f'pipewiresrc fd={pw_fd} path={node_id} do-timestamp=true'
    else:
        src = f'pipewiresrc path={node_id} do-timestamp=true'

    if mode == 'query':
        return (
            f'{src} ! videoconvert ! video/x-raw,format=RGB ! '
            f'appsink name=sink max-buffers=1 drop=true emit-signals=true sync=false'
        )
    else:
        return (
            f'{src} ! videoconvert ! videoscale ! '
            f'video/x-raw,format=RGB,width={nW},height={nH} ! '
            f'appsink name=sink max-buffers=1 drop=true emit-signals=true sync=false'
        )


def run_query(pipe, sink):
    sample = [None]
    q_loop = GLib.MainLoop()

    def on_sample(s):
        sample[0] = s.emit('pull-sample')
        q_loop.quit()
        return Gst.FlowReturn.OK

    sink.connect('new-sample', on_sample)
    pipe.set_state(Gst.State.PLAYING)
    GLib.timeout_add_seconds(10, lambda: (q_loop.quit(), False)[1])
    q_loop.run()
    pipe.set_state(Gst.State.NULL)

    if not sample[0]:
        print('gnome_mutter_cap: no frame received for query', file=sys.stderr)
        sys.exit(1)

    caps = sample[0].get_caps()
    st = caps.get_structure(0)
    w = st.get_int('width')[1]
    h = st.get_int('height')[1]
    print(f'{w} {h}', flush=True)


def run_stream(pipe, sink):
    current = [None]
    out = os.fdopen(sys.stdout.fileno(), 'wb', buffering=0)
    s_loop = GLib.MainLoop()

    def on_sample(s):
        current[0] = s.emit('pull-sample')
        return Gst.FlowReturn.OK

    sink.connect('new-sample', on_sample)
    pipe.set_state(Gst.State.PLAYING)

    # Non-blocking stdin watched by GLib so GStreamer mainloop keeps running
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


def main():
    Gst.init(None)
    dbus.mainloop.glib.DBusGMainLoop(set_as_default=True)

    mode = sys.argv[1] if len(sys.argv) > 1 else 'stream'
    nW = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    nH = int(sys.argv[3]) if len(sys.argv) > 3 else 0

    bus = dbus.SessionBus()
    node_id, pw_fd = setup_mutter_session(bus)

    pipeline_str = build_pipeline(node_id, pw_fd, mode, nW, nH)
    pipe = Gst.parse_launch(pipeline_str)
    sink = pipe.get_by_name('sink')

    if mode == 'query':
        run_query(pipe, sink)
    else:
        run_stream(pipe, sink)


if __name__ == '__main__':
    main()
