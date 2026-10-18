# client feature: messaging

Post-anchored private messages, message requests and named group chats over Socket.io (FR6, FR7, FR13; D50).

Contents: `MessagingContext.tsx` (one websocket per signed-in session, the inbox state, `useUnread`, `useSocketEvent`),
`inboxReducer.ts` and `chatReducer.ts` (pure reducers for socket events and paging merges), `Messages.tsx` (route and
panes), `ConversationList.tsx` (chats and requests), `Chat.tsx` with `MessageBubble.tsx` and `Composer.tsx`,
`StartChat.tsx` (`/messages?to=<id>`), `Pickers.tsx` (new chat, new group), `GroupDetails.tsx`.

Serves: FR6, FR7, FR13. Test table: `CLI-TC58` to `CLI-TC69` in `docs/chapter4/4.5_test_cases.md`.
