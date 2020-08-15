# Remote Pi Web
Operate your Raspberry Pi from a web browser.

## The Plan
- [x] Screen viewable from web client  
- [x] Scale canvas to browser's screen  
- [x] Mouse control (still missing drag-and-drop)  
- [ ] Keyboard control  
- [ ] Client-side configuration  
- [ ] Server configuration

## Installation
```sh
sudo apt install xdotool

git clone https://github.com/zvakanaka/remote-pi-web
cd remote-pi-web
npm install
```

## Run
```
env DISPLAY=:0 npm start
``` 

## System Dependencies
- `npm` (this project uses Node.js)
- `scrot` (for capturing the screen - already installed on Raspberry Pi OS)
- `xdotool` (for mouse and keyboard control)