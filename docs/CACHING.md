# Master loading and caching

Implemented October 30, 2026. The real wizard remains local-development-only.
This guide describes the actual implementation, not a hosting/authentication plan.

## Initial render

`src/app/page.tsx` streams a static frame and stable `MasterSkeleton` while a Server
Component reads the active pointer. The server validates the loopback request
before any privileged read, then obtains a lightweight master summary. The ready
screen (or welcome, if no master exists) is server-rendered and passed as initial
state to the interactive wizard. No initial browser `/active` request is needed.
Neither converted HTML nor PDF bytes are serialized into the page.

The thumbnail is a normal private same-origin PNG image, not a browser PDF.js
canvas. Its complete frame, filename and Replace row reserve space from the start.
The frame is Letter-shaped at 210 px desktop / 180 px mobile; other aspect ratios
fit inside it without changing its size. Actual PNG dimensions are retained for
the PDF viewer. Pop and hover use transforms and do not move surrounding layout.

## The caches

| Layer | Key/content | Policy |
| --- | --- | --- |
| Active pointer | `active_master_resume.master_id` | No cache. Read from Supabase on each server render. |
| Next server | Summary, PNG bytes, PDF bytes | Separate `use cache` functions, keyed by master ID and project/bucket namespace, plus Next's function/build identity. Revalidate after 24 hours; expire after 7 days. `stale: 0` requests minimal client staleness, but Next enforces a 30-second minimum for time-based client Router-cache expiration; it does not disable all navigation caching. |
| Browser HTTP | Versioned `/api/master-resume/assets/<id>/thumbnail` and `/pdf` responses | `Cache-Control: private, max-age=86400, immutable`, SHA-256 `ETag`, and conditional 304 responses. No public/CDN cache. |
| Open-page memory | PDF fetch promise / downloaded File | One request per mounted master, reused by background preload and every viewer open. A failed request clears the promise so retry can work. Abort on master unmount. |
| Legacy derived files | `private/master-previews/<project-hash>/<id>-v1.png` | Private, ignored PNG files for masters created before previews existed. Generated only on a cold/missing/invalid derived file. |

Next Cache Components and Partial Prefetching are enabled. The default Next cache
handler is bounded process memory (LRU). It can evict entries or disappear on a
server restart/build; it is not durable storage. Development HMR changes cache
identity, and hard reload / DevTools no-cache requests can bypass server caches in
development. These do not indicate a production cache policy failure.

The active pointer is fresh whenever the server workspace executes; this does
not mean every client-side Back/Forward navigation necessarily runs SSR again.
Next's Router/Activity cache is separate from the browser HTTP cache. Confirmation
updates the current wizard state immediately with the new ID, and a document
reload executes a new server read.

The Supabase client's underlying fetches explicitly use `no-store`. This keeps
unwrapped reads, especially the mutable active pointer, fresh. The outer `use cache`
functions cache their immutable results explicitly; they are separate from HTTP
response caching. Route checks run before cache access, and errors use `no-store`.
Production remains disabled even when an asset was previously cached server-side.

Browser `private` means a browser's own cache may store the response; a shared
proxy/CDN may not. `max-age=86400` permits reuse for one day. `immutable` says the
bytes at that versioned URL will not change during freshness. After expiration,
the browser can revalidate with `If-None-Match` and receive 304 if unchanged.
Browsers may evict files sooner. This is HTTP caching, not localStorage.

## Persistence and replacement

For new confirmations, the server reads the authoritative private PDF and renders
only page 1 using PDF.js's existing Node canvas factory. A PNG up to 640 px wide,
its dimensions and preview version are stored inside the existing snapshot's
`content.preview` JSON. The client does not supply the authoritative image. This
uses the existing JSONB column and requires no additional SQL migration or bucket
MIME changes. Original PDF and HTML persistence remain unchanged.

Existing snapshots without a preview stay immutable. Their first read generates
a derived private local PNG from the stored PDF, then Next caches its bytes. That
first cold legacy read takes longer; subsequent reads avoid rasterization. Deleting
this derived cache is safe: the original private PDF remains the source of truth.

Replacing a master creates a new upload/master ID and URLs. The active pointer
switches atomically on confirmation. The current UI receives the new summary;
subsequent SSR reads the new pointer. Old immutable cache entries need no purge
because they are never stored under a generic mutable `/current.pdf` URL. Previous
confirmed versions remain addressable behind the same local access checks.

## PDF viewer

After the thumbnail loads, an idle callback starts a lower-priority PDF download.
Clicking before preload finishes reuses its in-flight promise, or starts the fetch
immediately. After confirming in the current tab, the original selected File is
already available, so no PDF download is needed for that viewer.

Motion connects the thumbnail and viewer through `layoutId`. Radix Dialog handles
focus containment/return, Escape, outside dismissal and scroll locking. The viewer
has only the PDF's vertical scroll area and a close icon inside the top-right
corner. The desktop viewer adds another 10% over the previous enlarged size (up to
1003.2 px, 1.32 times the original sizing formula), with its
height capped to the viewport and narrower screens constrained to available space.
Only the thumbnail blocks selection and native image dragging; viewer content
does not inherit that restriction. PDF.js and its
worker are lazy-loaded on open. The thumbnail image covers the first page until
its full-resolution canvas is ready. Reduced motion uses opacity transitions and
omits shared layout movement. The overlay does not change page layout.

## Verification

Offline tests use synthetic PDFs and mocked Supabase. They cover PNG output,
summary payloads, private cache headers, ETags/304, local-access gates and confirmed
asset addressing without rereading the active pointer. Unit tests bypass Next's
compiler/runtime cache scope and test the reads themselves.

An isolated Next development instance with a local synthetic Supabase server was
also tested in Chromium: server-rendered candidate HTML without a welcome flash,
summary cache reuse across requests, fresh active-pointer reads, no initial PDF.js,
background PDF loading, viewer scrolling, all three close methods, focus return,
mobile/reduced motion, legacy PNG generation, and real server confirmation against
the mock followed by SSR of the replacement. Measured initial CLS was 0 for
that synthetic scenario; real-network timings and arbitrary PDFs can differ.
