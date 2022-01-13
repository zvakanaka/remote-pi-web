extern "C" {
  void getScreen(const int,   const int,   const int,   const int,   const int,             const int,                       unsigned char *);
}

#import <ApplicationServices/ApplicationServices.h>

// Thank you! https://stackoverflow.com/q/16171283/4151489
void getScreen(const int,   const int,   const int,   const int,   const int,             const int,                       unsigned char *);
void getScreen(const int xx,const int yy,const int W, const int H, const int resizedWidth,const int resizedHeight, /*out*/ unsigned char * data) {
  CGRect captureRect;

  captureRect.origin.x = xx;
  captureRect.origin.y = yy;
  captureRect.size.width = W;
  captureRect.size.height = H;

  CGImageRef img = CGWindowListCreateImage(captureRect, kCGWindowListOptionOnScreenOnly, kCGNullWindowID, kCGWindowImageDefault);

  if(img == NULL) {
    fprintf(stderr, "CGWindowListCreateImage failed\n!");
    return;
  }

  /* get pixels */
  CGDataProviderRef provider = CGImageGetDataProvider(img);
  CFDataRef dataRef = CGDataProviderCopyData(provider);
  unsigned char* image = (unsigned char*)CFDataGetBytePtr(dataRef);
  int x, y;
  int ii = 0;
  float ratio = H / resizedHeight;
// printf("%d %d %d %d\n", xx, yy, W, H);
// printf("%d %d %d %d\n", resizedWidth, resizedHeight, ratio, ratio);
  //   printf("%f\n", ratio);
  for (y = 0; y < resizedHeight; y++) {
    for (x = 0; x < resizedWidth; x++) {
      int xR = x * ratio;
      int yR = y * ratio;
      //  printf("%d,%d \n", (int)xR, (int)yR);
      // unsigned long pixel = XGetPixel(data,(int)xR,(int)yR);
      // unsigned long pixel = ((W * (int)yR) + (int)xR) * 4;
      unsigned long pixel = (W * y * 2 + x) * 8;
      unsigned char red   = image[pixel + 2];
      unsigned char green = image[pixel + 1];
      unsigned char blue  = image[pixel];
      // if ((int)yR == 32) {
      //   printf("%d,%d,%d,%d,%d \n", (int)xR, (int)yR, (int)red, (int)green, (int)blue);
      // }

      data[ii + 2] = blue;
      data[ii + 1] = green;
      data[ii + 0] = red;
      ii += 3;
    }
  }
}