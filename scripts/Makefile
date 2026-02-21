linux-x11: screen_main.c
	gcc -O3 -Wall -o ../lib/screen/screen_cap screen_main.c -lX11

linux-wayland: wlr-screencopy-unstable-v1-protocol.c wlr-screencopy-unstable-v1-client-protocol.h wayland_main.c
	gcc -O3 -Wall -o ../lib/screen/wayland_cap \
		wayland_main.c wlr-screencopy-unstable-v1-protocol.c \
		-lwayland-client

linux: linux-x11 linux-wayland

wlr-screencopy-unstable-v1-protocol.c: wlr-screencopy-unstable-v1.xml
	wayland-scanner private-code \
		wlr-screencopy-unstable-v1.xml \
		wlr-screencopy-unstable-v1-protocol.c

wlr-screencopy-unstable-v1-client-protocol.h: wlr-screencopy-unstable-v1.xml
	wayland-scanner client-header \
		wlr-screencopy-unstable-v1.xml \
		wlr-screencopy-unstable-v1-client-protocol.h

mac: mac_main.cpp
	g++ -Wno-c++11-extensions -O3 -Wall \
		-framework ApplicationServices mac_main.cpp \
		-o ../lib/screen/screen_cap
