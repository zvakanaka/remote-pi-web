linux: screen.c
	gcc -shared -O3 -Wall -fPIC -Wl,-soname,screen -o ../lib/screen/screen.so screen.c -lX11
mac: screen.c
	g++ -Wno-c++11-extensions -shared -O3 -Wall -fPIC -Wl,-install_name,screen -framework ApplicationServices mac.cpp -o ../lib/screen/screen.dylib
