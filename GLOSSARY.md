# NotaLah

A peer-to-peer academic note platform: students and lecturers share slide-style notes, found through a ranked feed and subject search.

## Language

**Note**:
The published unit a user shares, with a title, a Module, a status and a visibility. It has exactly one Deck and one Owner.
_Avoid_: Post (legacy table name only)

**Deck**:
The slide content of a Note: an ordered list of Slides. It is never published or shared on its own.
_Avoid_: Presentation

**Slide**:
One page of a Deck, holding positioned elements such as text, images and video.
_Avoid_: Board, page

**Module**:
The course unit a Note is filed under and searched by, with a code, a name and a programme. Admins add and rename Modules; the code never changes.

**Subject**:
The hashtags on a post, such as #science #physics #newtonslaw. Free text; it is not a Module.

## Discovery

**Feed**:
The ranked vertical list of published Notes shown to a viewer.
_Avoid_: Timeline, home

**Following**:
The separate list of Notes from followed users, newest first. It is not ranked.
_Avoid_: Feed (reserved for the ranked list)

**Ranking**:
The deterministic heuristic that orders the Feed from engagement, recency, lecturer validation and relevance. It orders the Feed only.
_Avoid_: Algorithm, recommendation

**Search order**:
The order of subject-search results; it reuses part of Ranking's inputs but has no personal relevance.
_Avoid_: Ranking

## People

**Owner**:
The author of a Note, who holds full control of it.
_Avoid_: Creator, uploader

**Collaborator**:
A named user with edit access to a Note. A user with view access only is a Viewer.
_Avoid_: Contributor, co-author

**Viewer**:
A user who can see a Note without edit access, whether through a view role or a share link.
_Avoid_: Reader

**Lecturer**:
An approved lecturer account. An account awaiting admin approval is an applicant, not a Lecturer.
_Avoid_: Teacher, staff

**Validation**:
A Lecturer's endorsement of a Note, shown to users as the "Super Like" and counted in Ranking.
_Avoid_: Verification, approval
