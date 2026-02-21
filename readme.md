# Remote Pi Web
Operate your Raspberry Pi from a web browser.  
![Screen capture](https://i.imgur.com/H10m7uN.gif)

## Roadmap
- [x] Screen viewable from web client  
- [x] Scale canvas to browser's screen  
- [x] Mouse control
- [x] Keyboard control  
- [ ] Client-side configuration  
- [x] Server configuration
- [x] Sockets

## Installation
[Install Node.js](https://github.com/nvm-sh/nvm#about)
```sh
sudo apt install xdotool

git clone https://github.com/zvakanaka/remote-pi-web
cd remote-pi-web
npm install
```

You can make your Pi think it has a screen by forcing HDMI output in the [`config.txt`](https://www.raspberrypi.org/documentation/configuration/config-txt/boot.md).

This can be done by removing the `#` from the line of the `config.txt` that looks like this: `#hdmi_safe=1`.

## Run
Other env vars: `CAPTURE_METHOD` (defaults to 'native', 'scrot' requires it to be installed), `QUALITY` (defaults to 25), `CAPTURE_INTERVAL` (defaults to 500), `VIEW_ONLY` (defaults to false)
```
env DISPLAY=:0 npm start
``` 

## System Dependencies
- `npm` ([Comes with Node.js when installed using nvm](https://github.com/nvm-sh/nvm#about))

### X11
- `xdotool` (mouse and keyboard control)
- `libx11-dev` (to compile the screen capture binary)

### Wayland (Sway and other wlroots-based compositors)
- `libwayland-dev` + `wayland-scanner` (to compile the screen capture binary)
- `wtype` (keyboard control)
- `dotool` (mouse control) — requires the `dotoold` daemon to be running (see below)

#### Setting up dotoold (Wayland mouse daemon)

`dotool` injects mouse events via `/dev/uinput` through a daemon called `dotoold`.

**Start the daemon for the current session:**
```sh
dotoold &
```

**Start automatically with Sway** — add to `~/.config/sway/config`:
```
exec dotoold
```

**Start as a systemd user service:**
```sh
# Create the service file
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

You may also need to add your user to the `input` group and reload udev rules:
```sh
sudo usermod -aG input $USER
# log out and back in for the group change to take effect
```

## Testing
```
npm run postinstall && npm test && xdg-open output.jpg
```
