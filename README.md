# Swimming Visual Study Guides

Interactive, animated guides for studying swimming technique part by part. No build step: open the HTML files in a browser.

| Guide | Language | Live |
|---|---|---|
| **Total Immersion Freestyle** | English | https://vlinhart.github.io/total-immersion-guide/ |
| **Prsa s hlavou nad vodou** (heads-up recreational breaststroke) | Czech | https://vlinhart.github.io/total-immersion-guide/breaststroke/ |

Each guide includes:

- **Stroke Lab:** one animated swimmer and three synchronized cameras, a timeline you can drag through, slow motion, stepping through key positions, overlays, and a mistake simulator with a correct-form "ghost" for comparison.
- **Stroke anatomy:** animated close-ups of each part of the stroke.
- **Frame by frame**, **common mistakes**, **drill progression**, **practice tips** and a **focal-point checklist**.

Stroke Lab keys: `Space` play/pause · `←` `→` step (hold `Shift` for bigger steps) · `[` `]` previous/next key position.

## Code layout

```
index.html                  freestyle page
breaststroke/index.html     breaststroke page (Czech)
style.css                   shared styles
js/engine/geom.js           math, 3D helpers, IK, keyframe sampling
js/engine/render.js         shared SVG renderer (side, front, top, below cameras)
js/engine/ui.js             shared page UI (lab, timeline, figures, mistakes, drills, checklist)
js/freestyle/model.js       freestyle movement model + overlays
js/freestyle/content.js     freestyle texts and figure setup
js/breaststroke/model.js    breaststroke movement model + overlays
js/breaststroke/content.js  breaststroke texts and figure setup
```

The animated swimmers are simplified kinematic models for showing positions and timing, not precise biomechanical simulations. The freestyle guide is inspired by the Total Immersion method created by Terry Laughlin.
