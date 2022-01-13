linux: screen.c
	gcc -shared -O3 -Wall -fPIC -Wl,-soname,screen -o ../lib/screen/screen.so screen.c -lX11
mac: screen.c
	g++ -shared -O3 -Wall -fPIC -Wl,-install_name,screen -framework ApplicationServices mac.cpp -o ../lib/screen/screen.dylib
