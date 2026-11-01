# 0091 - Video kept as a frozen addition (R29, R40, 29 Oct 2026)

- **Context:** Video on slides (R29, D59, D72) and the video pipeline (R40, D67) are built and tested, but are not in
  the IR's requirements. Sprint 6 measured their cost at 10x (#78, ADR 0090: 0 video bytes on a cold feed load, since
  the feed's `<video>` uses `preload="none"`) and closed the polling idle gap (#98).
- **Decision:** (user, 29 Oct) keep video as built and freeze it: it is an addition beyond the IR (counted with the
  others under ADR 0092), and it gets only fixes, no new video features, before submission.
- **Alternatives:** cut video (loses built, tested work and a demo point); extend it (spends days the R28 milestone
  needs).
- **Reversibility:** High; a later decision can unfreeze it.
- **Tests:** existing video tests; OPS-TC19 and OPS-TC20 (#78).
