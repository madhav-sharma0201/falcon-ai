import redis from "../../../shared/redis/redis.js";

const WEEK = 60 * 60 * 24 * 7;

// The gateway serves /api/me straight from the cached session, so the coin
// balance stored there is a snapshot taken at login. Without this index a
// purchase updates MongoDB while the user keeps seeing their old balance —
// which is exactly how an account with 999,450 coins displayed 0.
const indexKey = (userId) => `userSessions:${userId}`;

export const buildSession = (user) => ({
  userId: user._id,
  name: user.name,
  email: user.email,
  interviewCoin: user.interviewCoin,
});

/** Write a session and record it against the user so it can be refreshed later. */
export const saveSession = async (sessionId, user) => {
  await redis.set(`session:${sessionId}`, JSON.stringify(buildSession(user)), "EX", WEEK);
  await redis.sadd(indexKey(user._id), sessionId);
  await redis.expire(indexKey(user._id), WEEK);
};

/**
 * Push a new balance into every live session for this user.
 * Called after any server-side balance change, including credits made by the
 * billing service, which has no access to the user's cookie.
 */
export const refreshUserSessions = async (user) => {
  const key = indexKey(user._id);
  const sessionIds = await redis.smembers(key);
  if (!sessionIds.length) return;

  const payload = JSON.stringify(buildSession(user));

  for (const sessionId of sessionIds) {
    const exists = await redis.exists(`session:${sessionId}`);
    if (!exists) {
      // Expired or logged out — drop it so the index doesn't grow forever.
      await redis.srem(key, sessionId);
      continue;
    }
    const ttl = await redis.ttl(`session:${sessionId}`);
    await redis.set(`session:${sessionId}`, payload, "EX", ttl > 0 ? ttl : WEEK);
  }
};
