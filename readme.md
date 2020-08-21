# Remote Pi Web
Operate your Raspberry Pi from a web browser.

## The Plan
- [x] Screen viewable from web client  
- [x] Scale canvas to browser's screen  
- [x] Mouse control (still missing drag-and-drop)  
- [ ] Keyboard control (use `matchbox-keyboard` for now)  
- [ ] Client-side configuration  
- [x] Server configuration
- [x] Use sockets for screen updates/control

## Installation
```sh
sudo apt install nodejs
sudo apt install xdotool

git clone https://github.com/zvakanaka/remote-pi-web
cd remote-pi-web
npm install
```

## Run
Other env vars: `SCREENSHOT_QUALITY` (defaults to 25), `KEEP_SCREENSHOTS` (defaults to false), `VIEW_ONLY` (defaults to false)
```
env DISPLAY=:0 npm start
``` 

## System Dependencies
- `npm` (comes with `nodejs` package)
- `scrot` (for capturing the screen - already installed on Raspberry Pi OS)
- `xdotool` (for mouse and keyboard control)
