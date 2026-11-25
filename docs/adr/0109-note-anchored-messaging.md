# 0109 - Messaging with message requests and note cards (D38, D49, D50, #152, 26 Nov 2026)

- **Context:** FR6, FR7, FR13, FR16 and UC15-UC18 need direct and group chat where students share notes, without letting
  strangers spam each other.
- **Decision:** a message can carry a note card (`noteId`), checked for visibility per reader, so a note is shared inside
  the conversation. Friends (mutual follows, D38) or a pair with an existing conversation message directly; otherwise
  the first message is a pending request (one per pair) that the recipient accepts or declines. One direct conversation
  exists per pair (`cnv_pair` is unique, so two racing first messages cannot open two chats). Blocks (D49) stop a message at
  the INSERT itself. Writes go over REST and Socket.io only delivers (see [0102](0102-three-tier-rest-api-with-socket-io.md)).
  Detail: D50 in [DECISIONS.md](../DECISIONS.md).
- **Alternatives:** open direct messaging for everyone (spam); a separate contact list (replaced by follows, D38).
- **Reversibility:** Medium; the request flow and the pair key are in the schema.
- **Tests:** MSG-TC1-10.
