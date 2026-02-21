#include <stdio.h>
#include <stdlib.h>
#include <X11/X.h>
#include <X11/Xutil.h>

static void getScreen(const int xx, const int yy, const int W, const int H,
                      const int resizedWidth, const int resizedHeight,
                      unsigned char *data) {
  Display *display = XOpenDisplay(NULL);
  Window root = DefaultRootWindow(display);

  XImage *image = XGetImage(display, root, xx, yy, W, H, AllPlanes, ZPixmap);

  unsigned long red_mask   = image->red_mask;
  unsigned long green_mask = image->green_mask;
  unsigned long blue_mask  = image->blue_mask;

  int x, y, ii = 0;
  float ratio = (float)H / resizedHeight;

  for (y = 0; y < resizedHeight; y++) {
    for (x = 0; x < resizedWidth; x++) {
      int xR = (int)(x * ratio);
      int yR = (int)(y * ratio);
      unsigned long pixel = XGetPixel(image, xR, yR);
      data[ii]     = (unsigned char)((pixel & red_mask) >> 16);
      data[ii + 1] = (unsigned char)((pixel & green_mask) >> 8);
      data[ii + 2] = (unsigned char)(pixel & blue_mask);
      ii += 3;
    }
  }

  XDestroyImage(image);
  XCloseDisplay(display);
}

int main(int argc, char *argv[]) {
  if (argc < 7) {
    fprintf(stderr, "Usage: %s xx yy W H newWidth newHeight\n", argv[0]);
    return 1;
  }

  int xx        = atoi(argv[1]);
  int yy        = atoi(argv[2]);
  int W         = atoi(argv[3]);
  int H         = atoi(argv[4]);
  int newWidth  = atoi(argv[5]);
  int newHeight = atoi(argv[6]);

  size_t size = (size_t)newWidth * newHeight * 3;
  unsigned char *data = malloc(size);
  if (!data) {
    fprintf(stderr, "malloc failed\n");
    return 1;
  }

  getScreen(xx, yy, W, H, newWidth, newHeight, data);

  if (fwrite(data, 1, size, stdout) != size) {
    free(data);
    return 1;
  }

  free(data);
  return 0;
}
