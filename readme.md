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
- `xdotool` (if you want mouse and keyboard control)

## Testing
```
npm run postinstall && npm test && xdg-open output.jpg
```
