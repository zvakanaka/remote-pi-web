# Remote Pi Web

Operate your Raspberry Pi (or any Linux machine) from a web browser. Streams the screen as MJPEG and accepts mouse and keyboard input over a socket connection.

![Screen capture](https://i.imgur.com/H10m7uN.gif)

## Requirements

- [Node.js](https://github.com/nvm-sh/nvm#about)
- System dependencies depending on your display server (see below)

## Installation

```sh
git clone https://github.com/zvakanaka/remote-pi-web
cd remote-pi-web
npm install
```

Then install the dependencies for your display server below and run `npm start`.

## Wayland — Sway and other wlroots-based compositors

Install build dependencies and runtime tools:

```sh
sudo apt install libwayland-dev wayland-scanner wtype
```

Install `dotool` for mouse control (the `dotoold` daemon must be running):

```sh
sudo apt install libxkbcommon-dev scdoc
git clone https://git.sr.ht/~geb/dotool
cd dotool
./build.sh
sudo ./build.sh install
```

Grant `/dev/uinput` access:

```sh
sudo cp /usr/local/share/dotool/80-dotool.rules /etc/udev/rules.d/
sudo udevadm control --reload
sudo udevadm trigger
sudo usermod -aG input $USER
# log out and back in for the group change to take effect
```

Start the daemon. To start it for the current session only:

```sh
dotoold &
```

To start it automatically with Sway, add to `~/.config/sway/config`:

```
exec dotoold
```

To run it as a persistent systemd user service:

```sh
cat > ~/.config/systemd/user/dotoold.service << 'EOF'
[Unit]
Description=dotool input daemon

[Service]
ExecStart=dotoold
Restart=on-failure

[Install]
WantedBy=default.target
EOF

systemctl --user enable --now dotoold
```

Run the server:

```sh
npm start
```

## Wayland — GNOME (Ubuntu 24.04)

Screen capture uses `org.gnome.Mutter.ScreenCast` via D-Bus, PipeWire, and GStreamer:

```sh
sudo apt install python3-gi python3-dbus gir1.2-gstreamer-1.0 gir1.2-gst-plugins-base-1.0 gstreamer1.0-pipewire
```

Mouse and keyboard use `dotool` (no daemon needed here — it is spawned directly). Install from source and grant uinput access as shown in the Sway section above.

Run the server:

```sh
XDG_SESSION_TYPE=wayland XDG_CURRENT_DESKTOP=GNOME npm start
```

## X11 (older systems)

For older hardware or systems still running X11.

```sh
sudo apt install libx11-dev xdotool
```

Run the server:

```sh
env DISPLAY=:0 npm start
```

## Configuration

The following environment variables can be set at startup:

| Variable           | Default    | Description                              |
|--------------------|------------|------------------------------------------|
| `QUALITY`          | `25`       | JPEG quality (1–100)                     |
| `CAPTURE_INTERVAL` | `500`      | Milliseconds between screen captures     |
| `VIEW_ONLY`        | `false`    | Disable mouse and keyboard input         |
| `CAPTURE_METHOD`   | `native`   | Set to `scrot` to use scrot instead      |

## Raspberry Pi screen setup

If your Pi has no physical display attached, you can force HDMI output by editing [`/boot/config.txt`](https://www.raspberrypi.org/documentation/configuration/config-txt/boot.md) and uncommenting:

```
hdmi_safe=1
```

## Testing

```sh
npm run postinstall && npm test && xdg-open output.jpg
```
