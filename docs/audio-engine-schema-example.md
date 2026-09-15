# Cardiac Auscultation Data Schema Example v1

## 2026-09-10

This one is a workable start. Treat it as a draft and feel free to change things to make the data fit the functionallity.

Notes:

- There are four locations (audio source components) to generate the "lub, dub" (two sounds). You can see that S1 and S2 are each assigned to two audio sources
  - The AI agent I used inserted a slight delay to create a little flam -- which I think is interesting, though I don't know if the numbers it came up with are legit.
- There are filters at both the global level and at the local level (per audio source).
- There are named references to "anchors" which will be named null objects in the 3D model. This will be the 3D location of each audio source.

```
{
  "name": "Normal Heart Sounds (S1, S2)",
  "category": "Normal",
  "description": "Normal dual cardiac rhythm with distinct S1 (lub) and S2 (dub) sounds. No murmurs, gallops, or extra sounds present.",
  "defaultBpm": 72,
  "filter": {
    "type": "lowpass",
    "cutoffHz": 2500
  },
  "cycleEvents": [
    {
      "name": "S2 - Aortic Closure (A2)",
      "asset": "audio/cardiac/s2_normal.mp3",
      "normalizedOffset": 0.38,
      "sourceAnchor": "ANCHOR_AORTIC_VALVE",
      "volume": 0.90,
      "filter": null
    },
    {
      "name": "S2 - Pulmonic Closure (P2)",
      "asset": "audio/cardiac/s2_normal.mp3",
      "normalizedOffset": 0.39,
      "sourceAnchor": "ANCHOR_PULMONIC_VALVE",
      "volume": 0.75,
      "filter": null
    },
    {
      "name": "S1 - Tricuspid Closure",
      "asset": "audio/cardiac/s1_normal.mp3",
      "normalizedOffset": 0.01,
      "sourceAnchor": "ANCHOR_TRICUSPID_VALVE",
      "volume": 0.70,
      "filter": null
    },
    {
      "name": "S1 - Mitral Closure",
      "asset": "audio/cardiac/s1_normal.mp3",
      "normalizedOffset": 0.0,
      "sourceAnchor": "ANCHOR_MITRAL_VALVE",
      "volume": 0.95,
      "filter": null
    }
  ]
}
```
