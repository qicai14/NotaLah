import type { Server as HttpServer, IncomingMessage } from 'node:http';
import jwt from 'jsonwebtoken';
import { Server, type Socket } from 'socket.io';
import { env } from '../../lib/env';
import { logger } from '../../lib/logger';
import { fromAuthCookie, passport } from '../auth/passport';
import { type AuthUser, isBlocked } from '../users/repository';
import { MESSAGING } from './config';
import * as repo from './repository';

// shortcut: rooms, typing throttles and the kicks done through them (suspension, removal from a group) live in this
// process's memory, so the app runs on a single Fly machine (D50); add the Socket.io Postgres adapter (R27) before scaling out.
let io: Server | undefined;

export const userRoom = (id: number) => `user:${id}`;
export const convRoom = (id: number) => `conv:${id}`;

/** The user behind the handshake's auth cookie, by the same passport-jwt rules as requireAuth (reloaded; suspended or deleted refused). */
const authenticate = (req: IncomingMessage) =>
  new Promise<AuthUser | false>((resolve, reject) => {
    passport.authenticate('jwt', { session: false }, (err: unknown, user: AuthUser | false) =>
      err ? reject(err) : resolve(user),
    )(req, {}, reject);
  });

interface SocketData {
  user: AuthUser;
  typingAt: Map<number, number>;
}

/** Attaches Socket.io to the HTTP server (D35, D50): Origin must be CLIENT_ORIGIN, the auth cookie must be valid. `io.close()` also closes the HTTP server. */
export function attachSocket(server: HttpServer): Server {
  io = new Server(server, {
    serveClient: false,
    // Clients send only small typing events; every other write is REST.
    maxHttpBufferSize: 1_000,
    cors: { origin: env.CLIENT_ORIGIN, credentials: true },
    // WebSockets bypass CORS and the CSRF header, so every engine request must come from the client's origin.
    allowRequest: (req, callback) => callback(null, req.headers.origin === env.CLIENT_ORIGIN),
  });
  io.use(async (socket, next) => {
    try {
      const user = await authenticate(socket.request);
      if (!user) return next(new Error('Unauthorized'));
      const data: Partial<SocketData> = socket.data;
      data.user = user;
      next();
    } catch (err) {
      logger.error({ err }, 'socket handshake failed');
      next(new Error('Unauthorized'));
    }
  });
  io.on('connection', (socket: Socket) => void onConnection(socket));
  return io;
}

// Rooms are joined here, not in the handshake middleware: until connect the socket is not in the namespace, so the
// socketsJoin, socketsLeave and disconnectSockets calls the routes make would miss it.
async function onConnection(socket: Socket): Promise<void> {
  const data = socket.data as SocketData;
  const { user } = data;
  void socket.join(userRoom(user.id));
  data.typingAt = new Map();
  // A socket must not outlive its token, so it is cut when the JWT expires.
  const { exp } = jwt.decode(fromAuthCookie(socket.request) ?? '') as { exp: number };
  const expiry = setTimeout(() => socket.disconnect(true), exp * 1000 - Date.now());
  socket.on('disconnect', () => clearTimeout(expiry));

  // Typing is relayed, never stored, at most once per throttle window per conversation; members only, never across a block.
  socket.on('typing', async (payload: unknown) => {
    const id = Number((payload as { conversationId?: unknown } | null)?.conversationId);
    if (!Number.isSafeInteger(id) || !socket.rooms.has(convRoom(id))) return;
    const now = Date.now();
    if (now - (data.typingAt.get(id) ?? 0) < MESSAGING.typingThrottleMs) return;
    data.typingAt.set(id, now);
    try {
      const peer = await repo.directPeer(id, user.id);
      if (peer !== null && (await isBlocked(user.id, peer))) return;
      socket.to(convRoom(id)).emit('typing', { conversationId: id, userId: user.id });
    } catch (err) {
      logger.error({ err }, 'typing relay failed');
    }
  });

  // shortcut: a group removal (socketsLeave) that commits while these ids are read can still be missed, leaving the socket
  // in that room until it reconnects; re-check membership on delivery if that ever matters (D50).
  try {
    await socket.join((await repo.conversationIds(user.id)).map(convRoom));
  } catch (err) {
    logger.error({ err }, 'socket room join failed');
    socket.disconnect(true);
  }
}

/** Emits to a room; a no-op when Socket.io is not attached (REST-only tests). */
export const emit = (room: string, event: string, payload: unknown) => void io?.to(room).emit(event, payload);

/** Puts every open socket of the users into (or takes them out of) the conversation's room. */
export const joinConversation = (userIds: number[], conversationId: number) => {
  io?.in(userIds.map(userRoom)).socketsJoin(convRoom(conversationId));
};
export const leaveConversation = (userId: number, conversationId: number) => {
  io?.in(userRoom(userId)).socketsLeave(convRoom(conversationId));
};

/** Cuts a user's sockets, for a suspension or deletion (the handshake then refuses them). */
export const disconnectUser = (userId: number) => {
  io?.in(userRoom(userId)).disconnectSockets(true);
};
