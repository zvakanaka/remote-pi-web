# Remote Pi Web
Operate your Raspberry Pi from a web browser.

## The Plan
[x] Capture the screen and make it accessible to the web client  
[x] Create a canvas that scales to the browser's screen  
[x] Allow controlling the server's desktop from the canvas  
[ ] Client-side configuration  
[ ] Server configuration

## Installation
```sh
git clone https://github.com/zvakanaka/remote-pi-web
cd remote-pi-web
npm install
```

## System Dependencies
- `npm` (this project uses Node.js)
- `scrot` (for capturing the screen)
- `xdotool` (for mouse and keyboard control)