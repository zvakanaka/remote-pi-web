#!/bin/bash
cd scripts
# Thank you https://stackoverflow.com/a/8597411/4151489
if [[ "$OSTYPE" == "linux-gnu"* ]]; then # Linux
  make linux
elif [[ "$OSTYPE" == "darwin"* ]]; then # Mac OSX
  make mac
else
  echo unsuported or unknown OS, not compiling screen capture shared object
fi
cd -