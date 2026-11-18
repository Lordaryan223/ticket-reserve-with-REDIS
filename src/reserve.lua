local userId = ARGV[1]
local available = tonumber(redis.call("GET", KEYS[1]) or "0")

if redis.call("SISMEMBER", KEYS[2], userId) == 1 then
  return {-1, available}
end

if available <= 0 then
  return {0, 0}
end




local remaining = redis.call("DECR", KEYS[1])
redis.call("SADD", KEYS[2], userId)

local orderId = redis.call(
  "XADD", KEYS[3], "*",
  "eventId", ARGV[2],
  "userId", userId
)

return {1, remaining, orderId}

