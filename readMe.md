# Ticket Booking with Redis

A learning project for reserving limited tickets safely during a flash sale. Redis manages ticket availability and queues successful reservations. A worker saves orders to MongoDB.

## Features

- Uses a Redis Lua script to check availability and reserve a ticket atomically.
- Prevents the same user from reserving more than once per event.
- Adds successful reservations to a Redis Stream.
- Reads stream messages with a Redis consumer group.
- Saves processed orders to MongoDB.
- Rate-limits reservation attempts per user.
- Caches the orders API response in Redis for 30 seconds.

## Technologies

- Node.js and Express
- Redis and ioredis
- Redis Lua scripts and Streams
- MongoDB
- Docker Compose

## How a reservation works

1. The client sends an event ID and user ID to `POST /reserve`.
2. A Lua script checks availability and whether the user already reserved.
3. If eligible, the script reduces the ticket count and adds an order to the event’s Redis Stream.
4. The worker reads the order, saves it to MongoDB, then acknowledges the stream message.
5. `GET /events/:eventId/orders` returns saved orders. Its response is cached in Redis for 30 seconds.

## Redis keys

| Key | Purpose |
| --- | --- |
| `tickets:<eventId>:available` | Remaining ticket count |
| `tickets:<eventId>:users` | Users who reserved for the event |
| `orders:<eventId>` | Stream of successful reservations |
| `cache:orders:<eventId>` | Cached orders API response |

The event ID is part of each key so different events use separate data.

## Run locally

Install dependencies:

```bash
npm install
```

Start Redis and MongoDB:

```bash
docker compose up -d
```

Start the API in one terminal:

```bash
node src/index.js
```

Start the order worker in another terminal:

```bash
node src/worker.js
```

## API

### Reserve a ticket

`POST /reserve`

Example JSON body:

```json
{
  "eventId": "concert-1",
  "userId": "user-123"
}
```

### Get saved orders for an event

`GET /events/:eventId/orders`

Example:

```text
GET http://localhost:3000/events/concert-1/orders
```

Use your project’s event-initialization endpoint to create the event and set its starting ticket count before making reservations.

## Try it

1. Initialize an event with a small number of tickets.
2. Reserve tickets using different user IDs.
3. Try reserving twice with the same user ID.
4. Check the Redis Stream with `XRANGE orders:<eventId> - +`.
5. Check the consumer group’s pending messages with `XPENDING orders:<eventId> order-worker`.
6. Fetch the saved orders from `GET /events/:eventId/orders`.

## Learning notes

- The Lua script keeps the availability check and decrement together as one atomic Redis operation.
- `XADD` puts a successful reservation in the Stream.
- `XREADGROUP` lets the worker read messages as part of a consumer group.
- `XACK` marks a message as processed for that group. The message itself remains in the Stream.
- The orders API cache can be up to 30 seconds old.

This is a local learning project. Performance results depend on the machine, Docker setup, test data, and load-test configuration.