// this setup happens once, then function is always available
extern "C" {
  void getScreen(const int,   const int,   const int,   const int,   const int,             const int,                       unsigned char *);
}
// #define PRINT_DURATION

// Thank you! https://stackoverflow.com/q/16171283/4151489

#import <ApplicationServices/ApplicationServices.h>
#include <chrono>


int displayId = CGMainDisplayID(); // ~45ms
CGImageRef image_ref = NULL;
CFDataRef dataref = NULL;

void printDuration(const char *str, std::chrono::high_resolution_clock::time_point start) {
  #ifdef PRINT_DURATION
  printf("%s: %lldms\n", str, std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::high_resolution_clock::now() - start).count());
  #endif
}

std::chrono::high_resolution_clock::time_point nowTime() {
  return std::chrono::high_resolution_clock::now();
}

void getScreen(const int,   const int,   const int,   const int,   const int,             const int,                       unsigned char *);
void getScreen(const int xx,const int yy,const int W, const int H, const int resizedWidth,const int resizedHeight, /*out*/ unsigned char * data) {

// printf("resized w h %d %d\n", resizedWidth, resizedHeight);
// https://github.com/OutbackMan/py-layout/blob/8b994e7db14011fae56e8188283a797589a70c38/c-extensions/screenshot.c
// https://www.cplusplus.com/reference/chrono/high_resolution_clock/now/
  int ii = 0;
  auto test = nowTime();
  auto start1 = nowTime();
	image_ref = CGDisplayCreateImage(displayId); // takes ~50ms
  printDuration("display create image", start1);

	int image_width = CGImageGetWidth(image_ref); // very fast (< 1ms)
	int image_height = CGImageGetHeight(image_ref); // very fast (< 1ms)

	CGDataProviderRef provider = CGImageGetDataProvider(image_ref); // very fast (< 1ms)
  auto start2 = nowTime();
	dataref = CGDataProviderCopyData(provider); // takes ~35ms
  printDuration("provider setup", start2);

	const uint8_t* pixels = CFDataGetBytePtr(dataref);

  auto start3 = nowTime();
  for (int y = 0; y < image_height; y++) {
	  for (int x = 0; x < image_width; x++) {
			const uint8_t blue = *pixels++;
			const uint8_t green = *pixels++;
			const uint8_t red = *pixels++;
			pixels++;
      data[ii] = red;
      data[ii + 1] = green;
      data[ii + 2] = blue;
      ii += 3;
		}		
	}
  printDuration("loop", start3);

	CFRelease(dataref);
	CGImageRelease(image_ref);
  printDuration("complete capture", test);
}