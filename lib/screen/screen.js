const ffi = require("ffi-napi");
// const ref = require('ref');
const screenDimensions = require('./screenDimensions')
;(async () => {
  const {width, height} = await screenDimensions()
  const newWidth = 128
  const newHeight = 64
  const size = newWidth * newHeight
  console.log(`${width}x${height} ${size}`)
  
  const buf = Buffer.alloc(size * 3) // multiply by 3 for RGB
  // buf.type = ref.types.uchar
  // buf.type = ref.refType(ref.types.uchar)
  // console.log(ref.types)

  const library = new ffi.Library("./screen", {
    "getScreen": [
        "void", ["int", "int", "int", "int", "int", "int", "uchar *"]
    ]
  });
  const THRESHOLD = 128 * 3
  console.time("getScreen");
  library.getScreen(0,0,width,height,newWidth,newHeight,buf)
  console.timeEnd("getScreen")
  for (let i = 0; i < newHeight; i++) {
    for (let j = 0; j < newWidth * 3; j += 3) {
      const r = Number(buf[i * newWidth * 3 + j])
      const g = Number(buf[i * newWidth * 3 + j + 1])
      const b = Number(buf[i * newWidth * 3 + j + 2])
      const isOn = r + g + b > THRESHOLD 
      process.stdout.write(isOn ? '##' : '  ');
      // process.stdout.write(i * newWidth * 3 + j);
    }
    console.log()
  }
})()

