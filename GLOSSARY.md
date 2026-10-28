# NotaLah

A peer-to-peer academic note platform: students and lecturers publish slide notes, find them by module, and discuss them.

## Language

**Note**:
The unit a user publishes and shares. It has a title, a Module, a status and a visibility, and exactly one Deck.
_Avoid_: Post (legacy table name only)

**Deck**:
The slide content of a Note: an ordered list of Slides with a theme, an aspect ratio and optional music. Never published on its own.
_Avoid_: Presentation, slideshow

**Slide**:
One page of a Deck, holding positioned elements such as text, images, video and shapes.
_Avoid_: Board, page, card

**Module**:
An APU module with a code, a name and a programme. Every published Note belongs to one. "Subject search" means searching by Module.
_Avoid_: Subject, course

## Discovery

**Feed**:
The ranked vertical list of published Notes shown to a viewer.
_Avoid_: Timeline, home

**Following**:
The separate, time-ordered list of Notes from users the viewer follows. Not ranked.
_Avoid_: Following feed

**Ranking**:
The deterministic heuristic that orders the Feed, from four weighted components: engagement, recency, lecturer validation and relevance. It does not order search results, which have their own search order.
_Avoid_: Algorithm, recommendation

## People

**Lecturer**:
A user whose lecturer account an admin has approved. A user awaiting approval is an applicant, not a Lecturer.
_Avoid_: Teacher, staff

**Validation**:
A Lecturer's endorsement of a Note, shown to users as the "Super Like" and counted in Ranking.
_Avoid_: Verification, approval

**Owner**:
The user who authored a Note.
_Avoid_: Creator, uploader

**Collaborator**:
A named user added to a Note with a view or edit role. The Owner is not a Collaborator, and neither is someone using a share link.
_Avoid_: Contributor, co-author, member

## Not decided

Nothing yet: every core term above was settled in the grill.
