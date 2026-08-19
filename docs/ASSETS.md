# Assets

## Photography

Four background photographs, extracted from `natus-mockups.html` where they
were embedded as base64 JPEG data URIs.

**Origin: AI-generated.** No third-party licence applies and no attribution is
required. Recorded here so the question does not have to be re-litigated when
the repository changes owner.

| File | Screen | Source dimensions | Shipped | Size |
|------|--------|-------------------|---------|------|
| `public/img/forest.avif` | Landing | 1125 x 2000 | 1080 x 1920 | 80 KB |
| `public/img/surf.avif` | Onboarding, Generating | 1080 x 1920 | 1080 x 1920 | 232 KB |
| `public/img/palm.avif` | Soul Map, Meditations | 736 x 1308 | 736 x 1308 | 104 KB |
| `public/img/grass.avif` | Recommendations | 1000 x 2000 | 1000 x 2000 | 36 KB |

Total 452 KB, down from 1.18 MB of inline JPEG in the mockup.

`palm` and `grass` ship at their native resolution rather than the planned
1080px width. Upscaling them added weight without adding detail — `palm` grew
to 156 KB when stretched to 1080 and dropped to 104 KB at its native 736.

### Format

AVIF, quality 68. The plan called for WebP; the `sips` build on macOS reads
WebP but cannot write it, and no `cwebp` or ImageMagick is installed. AVIF is
supported by every browser that supports WebP, compresses better on this kind
of low-contrast photographic content, and avoided adding a native toolchain
dependency to the project.

If a fallback ever becomes necessary, regenerate JPEG siblings and use
`<picture>` — the components reference the images through CSS custom
properties, so it is a change in one place.

### Regenerating

The originals live only in the mockup file. To re-extract:

```bash
# lines 114, 242, 402, 634 of natus-mockups.html hold the data URIs
sed -n '114p' natus-mockups.html \
  | grep -o 'base64,[^)"]*' | sed 's/^base64,//' | tr -d '\n' \
  | base64 -d > forest-source.jpg

sips -s format avif -s formatOptions 68 forest-source.jpg --out forest.avif
```

## Typography

Cormorant Garamond and DM Sans, loaded from Google Fonts in `index.html`.

Both are licensed under the SIL Open Font License. They are currently linked
rather than self-hosted, which means the demo falls back to system serif and
sans when offline. Self-hosting is worth doing before any presentation that
cannot rely on a network.

## Audio

None. Meditation bed tracks are synthesised in the browser with
`OscillatorNode` rather than shipped as files, which is why `data/bed-tracks.json`
holds synthesis descriptors instead of storage paths. There is therefore no
audio licence to track.
