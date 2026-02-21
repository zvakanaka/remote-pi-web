#import <ApplicationServices/ApplicationServices.h>
#include <cstdio>
#include <cstdlib>

int main(int argc, char *argv[]) {
  if (argc < 7) {
    fprintf(stderr, "Usage: %s xx yy W H newWidth newHeight\n", argv[0]);
    return 1;
  }

  int newWidth  = atoi(argv[5]);
  int newHeight = atoi(argv[6]);

  int displayId = CGMainDisplayID();
  CGImageRef image_ref = CGDisplayCreateImage(displayId);

  size_t image_width  = CGImageGetWidth(image_ref);
  size_t image_height = CGImageGetHeight(image_ref);

  CGDataProviderRef provider = CGImageGetDataProvider(image_ref);
  CFDataRef dataref = CGDataProviderCopyData(provider);
  const uint8_t *pixels = CFDataGetBytePtr(dataref);

  // Source pixels are BGRA (4 bytes per pixel)
  size_t src_stride = image_width * 4;

  size_t output_size = (size_t)newWidth * newHeight * 3;
  unsigned char *data = (unsigned char *)malloc(output_size);
  if (!data) {
    CFRelease(dataref);
    CGImageRelease(image_ref);
    return 1;
  }

  float scaleX = (float)image_width  / newWidth;
  float scaleY = (float)image_height / newHeight;

  int ii = 0;
  for (int y = 0; y < newHeight; y++) {
    for (int x = 0; x < newWidth; x++) {
      int srcX = (int)(x * scaleX);
      int srcY = (int)(y * scaleY);
      size_t offset = (size_t)srcY * src_stride + (size_t)srcX * 4;
      data[ii]     = pixels[offset + 2]; // red
      data[ii + 1] = pixels[offset + 1]; // green
      data[ii + 2] = pixels[offset + 0]; // blue
      ii += 3;
    }
  }

  CFRelease(dataref);
  CGImageRelease(image_ref);

  fwrite(data, 1, output_size, stdout);
  free(data);
  return 0;
}
