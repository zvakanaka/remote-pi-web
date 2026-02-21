#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <stdbool.h>
#include <unistd.h>
#include <fcntl.h>
#include <signal.h>
#include <sys/mman.h>
#include <wayland-client.h>
#include "wlr-screencopy-unstable-v1-client-protocol.h"

/* ---------- helpers ---------- */

static int create_anon_shm(size_t size) {
    int fd = memfd_create("wayland-cap", MFD_CLOEXEC);
    if (fd < 0) {
        /* fallback for older kernels */
        char name[] = "/tmp/wayland-cap-XXXXXX";
        fd = mkstemp(name);
        if (fd >= 0) unlink(name);
    }
    if (fd < 0) return -1;
    if (ftruncate(fd, (off_t)size) < 0) { close(fd); return -1; }
    return fd;
}

static size_t bpp_for_format(uint32_t fmt) {
    switch (fmt) {
    case WL_SHM_FORMAT_RGB888:
    case WL_SHM_FORMAT_BGR888:
        return 3;
    default:
        return 4; /* all other common formats are 32 bpp */
    }
}

/* Write one output pixel as packed RGB given a pointer to the raw source bytes
   and the wl_shm format. */
static void pixel_to_rgb(const uint8_t *src, uint32_t fmt,
                          uint8_t *r, uint8_t *g, uint8_t *b) {
    switch (fmt) {
    /* 32 bpp: byte order in memory is [B, G, R, A/X] */
    case WL_SHM_FORMAT_ARGB8888:
    case WL_SHM_FORMAT_XRGB8888:
        *b = src[0]; *g = src[1]; *r = src[2];
        break;
    /* 32 bpp: byte order in memory is [R, G, B, A/X] */
    case WL_SHM_FORMAT_ABGR8888:
    case WL_SHM_FORMAT_XBGR8888:
        *r = src[0]; *g = src[1]; *b = src[2];
        break;
    /* 24 bpp BGR */
    case WL_SHM_FORMAT_BGR888:
        *b = src[0]; *g = src[1]; *r = src[2];
        break;
    /* 24 bpp RGB */
    case WL_SHM_FORMAT_RGB888:
        *r = src[0]; *g = src[1]; *b = src[2];
        break;
    default:
        /* best-effort: assume XRGB8888 */
        *b = src[0]; *g = src[1]; *r = src[2];
        break;
    }
}

/* ---------- state ---------- */

struct state {
    /* Wayland globals */
    struct wl_display              *display;
    struct wl_registry             *registry;
    struct zwlr_screencopy_manager_v1 *screencopy_manager;
    uint32_t                        screencopy_version; /* bound version */
    struct wl_output               *output;
    struct wl_shm                  *shm;

    /* Output geometry (from wl_output::mode) */
    uint32_t out_width, out_height;
    bool     out_mode_received;

    /* SHM buffer for the captured frame */
    struct wl_shm_pool *pool;
    struct wl_buffer   *buffer;
    void               *shm_data;
    size_t              shm_size;

    /* Frame metadata */
    uint32_t fmt, cap_width, cap_height, stride;
    bool     shm_info_received; /* received at least one buffer event */
    bool     shm_allocated;     /* SHM created and mapped (reused in stream mode) */
    bool     buffer_created;    /* copy() already called */
    bool     y_invert;
    bool     frame_ready;
    bool     frame_failed;
};

/* ---------- wl_output listener (to get screen dimensions) ---------- */

static void output_geometry(void *d, struct wl_output *o,
    int32_t x, int32_t y, int32_t pw, int32_t ph,
    int32_t sub, const char *make, const char *model, int32_t tr) {
    (void)d; (void)o; (void)x; (void)y; (void)pw; (void)ph;
    (void)sub; (void)make; (void)model; (void)tr;
}
static void output_mode(void *data, struct wl_output *o,
    uint32_t flags, int32_t w, int32_t h, int32_t refresh) {
    (void)o; (void)refresh;
    struct state *s = data;
    if (flags & WL_OUTPUT_MODE_CURRENT) {
        s->out_width  = (uint32_t)w;
        s->out_height = (uint32_t)h;
        s->out_mode_received = true;
    }
}
static void output_done(void *d, struct wl_output *o) { (void)d; (void)o; }
static void output_scale(void *d, struct wl_output *o, int32_t f) {
    (void)d; (void)o; (void)f;
}
static const struct wl_output_listener output_listener = {
    .geometry = output_geometry,
    .mode     = output_mode,
    .done     = output_done,
    .scale    = output_scale,
    /* name and description (v4) intentionally absent; we bind at v2 */
};

/* ---------- frame listener ---------- */

static void do_copy(struct state *s, struct zwlr_screencopy_frame_v1 *frame) {
    if (s->buffer_created || !s->shm_info_received) return;

    if (!s->shm_allocated) {
        s->shm_size = (size_t)s->stride * s->cap_height;
        int fd = create_anon_shm(s->shm_size);
        if (fd < 0) { s->frame_failed = true; return; }

        s->shm_data = mmap(NULL, s->shm_size, PROT_READ | PROT_WRITE,
                           MAP_SHARED, fd, 0);
        if (s->shm_data == MAP_FAILED) {
            close(fd); s->frame_failed = true; return;
        }

        s->pool   = wl_shm_create_pool(s->shm, fd, (int32_t)s->shm_size);
        s->buffer = wl_shm_pool_create_buffer(s->pool, 0,
                        (int32_t)s->cap_width, (int32_t)s->cap_height,
                        (int32_t)s->stride, s->fmt);
        close(fd);
        s->shm_allocated = true;
    }

    zwlr_screencopy_frame_v1_copy(frame, s->buffer);
    s->buffer_created = true;
}

static void frame_buffer(void *data, struct zwlr_screencopy_frame_v1 *frame,
    uint32_t format, uint32_t width, uint32_t height, uint32_t stride) {
    struct state *s = data;
    s->fmt        = format;
    s->cap_width  = width;
    s->cap_height = height;
    s->stride     = stride;
    s->shm_info_received = true;

    /* v1/v2: no buffer_done event — copy immediately after buffer */
    if (s->screencopy_version < 3) {
        do_copy(s, frame);
    }
}

static void frame_flags(void *data, struct zwlr_screencopy_frame_v1 *frame,
    uint32_t flags) {
    (void)frame;
    struct state *s = data;
    s->y_invert = !!(flags & ZWLR_SCREENCOPY_FRAME_V1_FLAGS_Y_INVERT);
}

static void frame_ready(void *data, struct zwlr_screencopy_frame_v1 *frame,
    uint32_t tv_sec_hi, uint32_t tv_sec_lo, uint32_t tv_nsec) {
    (void)frame; (void)tv_sec_hi; (void)tv_sec_lo; (void)tv_nsec;
    ((struct state *)data)->frame_ready = true;
}

static void frame_failed(void *data, struct zwlr_screencopy_frame_v1 *frame) {
    (void)frame;
    ((struct state *)data)->frame_failed = true;
}

static void frame_damage(void *data, struct zwlr_screencopy_frame_v1 *frame,
    uint32_t x, uint32_t y, uint32_t width, uint32_t height) {
    (void)data; (void)frame; (void)x; (void)y; (void)width; (void)height;
}

static void frame_linux_dmabuf(void *data, struct zwlr_screencopy_frame_v1 *frame,
    uint32_t format, uint32_t width, uint32_t height) {
    /* We only use SHM buffers; ignore DMA-BUF hints */
    (void)data; (void)frame; (void)format; (void)width; (void)height;
}

static void frame_buffer_done(void *data,
    struct zwlr_screencopy_frame_v1 *frame) {
    /* v3+: all buffer options presented — now create buffer and copy */
    do_copy((struct state *)data, frame);
}

static const struct zwlr_screencopy_frame_v1_listener frame_listener = {
    .buffer      = frame_buffer,
    .flags       = frame_flags,
    .ready       = frame_ready,
    .failed      = frame_failed,
    .damage      = frame_damage,
    .linux_dmabuf  = frame_linux_dmabuf,
    .buffer_done = frame_buffer_done,
};

/* ---------- registry listener ---------- */

static void registry_global(void *data, struct wl_registry *reg,
    uint32_t name, const char *iface, uint32_t version) {
    struct state *s = data;
    if (strcmp(iface, zwlr_screencopy_manager_v1_interface.name) == 0) {
        uint32_t v = version < 3 ? version : 3;
        s->screencopy_manager = wl_registry_bind(reg, name,
            &zwlr_screencopy_manager_v1_interface, v);
        s->screencopy_version = v;
    } else if (strcmp(iface, wl_output_interface.name) == 0 && !s->output) {
        s->output = wl_registry_bind(reg, name, &wl_output_interface, 2);
        wl_output_add_listener(s->output, &output_listener, s);
    } else if (strcmp(iface, wl_shm_interface.name) == 0) {
        s->shm = wl_registry_bind(reg, name, &wl_shm_interface, 1);
    }
}
static void registry_global_remove(void *d, struct wl_registry *r, uint32_t n) {
    (void)d; (void)r; (void)n;
}
static const struct wl_registry_listener registry_listener = {
    .global        = registry_global,
    .global_remove = registry_global_remove,
};

/* ---------- pixel conversion helper ---------- */

static void convert_frame(struct state *s, uint8_t *out, int nW, int nH,
                           size_t bpp, float sx, float sy) {
    uint8_t *src = (uint8_t *)s->shm_data;
    int ii = 0;
    for (int y = 0; y < nH; y++) {
        int src_y = s->y_invert
            ? (int)((nH - 1 - y) * sy)
            : (int)(y * sy);
        for (int x = 0; x < nW; x++) {
            int    src_x  = (int)(x * sx);
            size_t offset = (size_t)src_y * s->stride + (size_t)src_x * bpp;
            uint8_t r, g, b;
            pixel_to_rgb(src + offset, s->fmt, &r, &g, &b);
            out[ii]     = r;
            out[ii + 1] = g;
            out[ii + 2] = b;
            ii += 3;
        }
    }
}

/* ---------- main ---------- */

int main(int argc, char *argv[]) {
    bool query_mode  = (argc >= 2 && strcmp(argv[1], "query")  == 0);
    bool stream_mode = (argc >= 2 && strcmp(argv[1], "stream") == 0);
    int nW = 0, nH = 0;

    if (!query_mode) {
        int off      = stream_mode ? 1 : 0;
        int min_argc = 7 + off;
        if (argc < min_argc) {
            fprintf(stderr,
                "Usage: %s xx yy W H newWidth newHeight\n"
                "       %s stream xx yy W H newWidth newHeight\n"
                "       %s query\n", argv[0], argv[0], argv[0]);
            return 1;
        }
        nW = atoi(argv[5 + off]);
        nH = atoi(argv[6 + off]);
        if (nW <= 0 || nH <= 0) {
            fprintf(stderr, "Invalid dimensions %d x %d\n", nW, nH);
            return 1;
        }
    }

    struct state s = {0};

    s.display = wl_display_connect(NULL);
    if (!s.display) {
        fprintf(stderr, "Cannot connect to Wayland display\n");
        return 1;
    }

    s.registry = wl_display_get_registry(s.display);
    wl_registry_add_listener(s.registry, &registry_listener, &s);
    wl_display_roundtrip(s.display);   /* enumerate globals */
    wl_display_roundtrip(s.display);   /* flush output mode events */

    if (!s.output) {
        fprintf(stderr, "No wl_output found\n");
        wl_display_disconnect(s.display);
        return 1;
    }

    if (query_mode) {
        printf("%u %u\n", s.out_width, s.out_height);
        wl_display_disconnect(s.display);
        return 0;
    }

    if (!s.screencopy_manager) {
        fprintf(stderr,
            "zwlr_screencopy_manager_v1 not supported by this compositor\n");
        wl_display_disconnect(s.display);
        return 1;
    }
    if (!s.shm) {
        fprintf(stderr, "wl_shm not available\n");
        wl_display_disconnect(s.display);
        return 1;
    }

    /* Bootstrap: capture first frame (allocates SHM, sets fmt/stride/dims) */
    {
        struct zwlr_screencopy_frame_v1 *frame =
            zwlr_screencopy_manager_v1_capture_output(
                s.screencopy_manager, 0 /* no cursor */, s.output);
        zwlr_screencopy_frame_v1_add_listener(frame, &frame_listener, &s);

        while (!s.frame_ready && !s.frame_failed) {
            if (wl_display_dispatch(s.display) < 0) break;
        }

        zwlr_screencopy_frame_v1_destroy(frame);
    }

    if (!s.frame_ready) {
        fprintf(stderr, "Screen capture failed\n");
        if (s.shm_data && s.shm_data != MAP_FAILED)
            munmap(s.shm_data, s.shm_size);
        wl_display_disconnect(s.display);
        return 1;
    }

    size_t   bpp       = bpp_for_format(s.fmt);
    float    sx        = (float)s.cap_width  / nW;
    float    sy        = (float)s.cap_height / nH;
    size_t   out_bytes = (size_t)nW * nH * 3;
    uint8_t *out       = malloc(out_bytes);
    if (!out) {
        fprintf(stderr, "malloc failed\n");
        if (s.shm_data && s.shm_data != MAP_FAILED)
            munmap(s.shm_data, s.shm_size);
        if (s.buffer) wl_buffer_destroy(s.buffer);
        if (s.pool)   wl_shm_pool_destroy(s.pool);
        wl_display_disconnect(s.display);
        return 1;
    }

    if (!stream_mode) {
        /* Single-shot: convert bootstrap frame and write to stdout */
        zwlr_screencopy_manager_v1_destroy(s.screencopy_manager);
        convert_frame(&s, out, nW, nH, bpp, sx, sy);
        munmap(s.shm_data, s.shm_size);
        if (s.buffer) wl_buffer_destroy(s.buffer);
        if (s.pool)   wl_shm_pool_destroy(s.pool);
        wl_display_disconnect(s.display);
        int ret = (fwrite(out, 1, out_bytes, stdout) != out_bytes) ? 1 : 0;
        free(out);
        return ret;
    }

    /* Stream mode: loop — read '\n' from stdin, capture, write RGB to stdout */
    signal(SIGPIPE, SIG_IGN);

    while (1) {
        int c = getchar();
        if (c == EOF) break;

        /* Reset per-frame flags; shm_info_received and shm_allocated stay true */
        s.frame_ready   = false;
        s.frame_failed  = false;
        s.buffer_created = false;

        struct zwlr_screencopy_frame_v1 *loop_frame =
            zwlr_screencopy_manager_v1_capture_output(
                s.screencopy_manager, 0, s.output);
        zwlr_screencopy_frame_v1_add_listener(loop_frame, &frame_listener, &s);

        while (!s.frame_ready && !s.frame_failed) {
            if (wl_display_dispatch(s.display) < 0) break;
        }

        zwlr_screencopy_frame_v1_destroy(loop_frame);

        if (!s.frame_ready) continue;

        convert_frame(&s, out, nW, nH, bpp, sx, sy);
        if (fwrite(out, 1, out_bytes, stdout) != out_bytes) break;
        fflush(stdout);
    }

    /* Cleanup */
    free(out);
    zwlr_screencopy_manager_v1_destroy(s.screencopy_manager);
    if (s.shm_data && s.shm_data != MAP_FAILED)
        munmap(s.shm_data, s.shm_size);
    if (s.buffer) wl_buffer_destroy(s.buffer);
    if (s.pool)   wl_shm_pool_destroy(s.pool);
    wl_display_disconnect(s.display);

    return 0;
}
