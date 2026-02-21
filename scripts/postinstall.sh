#!/bin/bash
cd scripts
# Thank you https://stackoverflow.com/a/8597411/4151489
if [[ "$OSTYPE" == "linux-gnu"* ]]; then # Linux
  make linux-x11     || echo "Warning: X11 screen capture build failed (install libx11-dev)"
  make linux-wayland || echo "Warning: Wayland screen capture build failed (install libwayland-dev wayland-scanner)"
elif [[ "$OSTYPE" == "darwin"* ]]; then # Mac OSX
  make mac
else
  echo "Unsupported or unknown OS, not compiling screen capture"
fi
cd -
