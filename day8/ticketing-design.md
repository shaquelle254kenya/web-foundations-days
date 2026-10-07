# TicketHub Design

TicketHub is a website that sells tickets for concerts and events. This document follows the six-part design framework: requirements, estimates, API, data model, architecture and trade-offs. It also explains how the design stops two people buying the same seat.

## 1. Requirements

### Functional requirements
- Users can sign up, log in and see their profile.
- Users can browse and search upcoming events.
- Users can view an event and its seat map (which seats are free).
- Users can pick seats and hold them for a short time while they pay.
- Users can pay for held seats and receive their tickets.
- Users can view their tickets and past orders.

### Non-functional requirements
- **Correctness (most important):** one seat can only ever be sold to one person. Overselling is not acceptable.
- **Speed:** browsing pages load in under 300 ms. Holding a seat responds in under 1 second, even during a big sale.
- **Fairness:** during a big sale, people get a fair turn (first come, first served), and bots cannot grab all the seats.
- **Availability:** the site stays up during a big sale, and one failed server does not stop sales.
- **Scalability:** it handles a huge spike (hundreds of times normal traffic) for a few minutes.
- **Security and money safety:** payments are never charged twice, passwords are hashed, and all traffic uses HTTPS.
- **Durability:** a paid ticket is never lost.

## 2. Estimates

One day is about 100,000 seconds (rounded for easy estimates). Normal peak is 5x the average.

### Normal day

| Measure | Calculation | Average | Peak (5x) |
|---------|-------------|---------|-----------|
| Page views per day | 50,000 visitors x 10 pages | 500,000 | |
| Reads per second | 500,000 / 100,000 | **5 per second** | 25 per second |
| Tickets sold per day | given | 5,000 | |
| Purchases per second | 5,000 / 100,000 | **0.05 per second** (one every 20 seconds) | 0.25 per second |
| Storage per year | 5,000 tickets x 365 = 1.8 million tickets x about 1 KB | **about 2 GB** | |

A normal day is tiny. One small database would cope easily.

### Big sale (a popular concert)

Assumptions: 200,000 people try to buy 20,000 seats within the first 10 minutes (600 seconds), and each person makes about 10 requests (open the page, load the seat map a few times, try to hold seats, pay).

| Measure | Calculation | Result |
|---------|-------------|--------|
| People arriving per second | 200,000 / 600 | **about 333 per second** |
| Requests per second | 200,000 x 10 = 2,000,000 / 600 | **about 3,300 per second** |
| Seat hold attempts per second | 200,000 people / 600 | **about 333 per second** |
| Successful sales per second | 20,000 seats / 600 | **about 33 per second** |
| Share of people who get a seat | 20,000 / 200,000 | **10%** (90% will be told "sold out") |

### Comparison

- Reads go from about **5 per second to about 3,300 per second**, roughly **660 times more**.
- Purchases go from **0.05 per second to about 33 per second**, also roughly **660 times more**.
- The spike lasts only about 10 minutes, so it is cheaper to handle it with a waiting room, caching and short-term extra servers than to run huge servers all year.
- The hardest part is not the size, it is **contention**: thousands of people fighting for the same 20,000 seats at the same moment. The design must stay correct under that fight.

## 3. API

Base URL: `https://api.tickethub.example/v1`. All requests and responses use JSON. Every endpoint except browsing events needs `Authorization: Bearer <token>`.

| # | Method | Path | Description | Success status |
|---|--------|------|-------------|----------------|
| 1 | GET | `/events` | Browse upcoming events (supports `?q=`, `?page=`, `?limit=`) | 200 OK |
| 2 | GET | `/events/{id}` | Get the details of one event | 200 OK |
| 3 | GET | `/events/{id}/seats` | View the seat map and which seats are available | 200 OK |
| 4 | POST | `/events/{id}/holds` | Hold chosen seats for 10 minutes and create a pending order | 201 Created |
| 5 | POST | `/orders/{id}/payment` | Pay for a held order | 200 OK |
| 6 | DELETE | `/orders/{id}` | Cancel a pending order and release its seats | 204 No Content |
| 7 | GET | `/me/tickets` | View the logged-in user's tickets | 200 OK |

### Example: hold seats, `POST /events/55/holds`

Request body:

```json
{
  "seatIds": [1201, 1202]
}
```

Response: 201 Created

```json
{
  "orderId": 9001,
  "eventId": 55,
  "seatIds": [1201, 1202],
  "status": "pending",
  "totalPrice": 12000,
  "expiresAt": "2026-10-20T18:10:00Z"
}
```

### Example: pay, `POST /orders/9001/payment`

The request must send an `Idempotency-Key` header, so a double tap or a retry can never charge the customer twice.

Request body:

```json
{
  "paymentMethod": "mobile_money",
  "phone": "+254700000000"
}
```

Response: 200 OK

```json
{
  "orderId": 9001,
  "status": "paid",
  "tickets": [
    { "ticketId": 7001, "seatId": 1201 },
    { "ticketId": 7002, "seatId": 1202 }
  ]
}
```

### Error codes

| Status | When it happens |
|--------|-----------------|
| 400 Bad Request | Invalid data, for example an empty `seatIds` list or more than 6 seats |
| 401 Unauthorized | Missing or expired token |
| 403 Forbidden | Paying for an order that belongs to another user |
| 404 Not Found | The event or order does not exist |
| 409 Conflict | **A seat is already held or sold.** The user must pick other seats |
| 410 Gone | The hold expired before payment |
| 429 Too Many Requests | The user is sending too many requests (bot protection) or must wait in the queue |
| 500 Internal Server Error | Something failed on the server |

Example error body for a double-booking attempt:

```json
{
  "error": {
    "code": "SEAT_UNAVAILABLE",
    "message": "Seat 1201 has just been taken. Please choose another seat.",
    "status": 409
  }
}
```

## 4. Data model

Five tables: `users`, `events`, `seats`, `orders` and `tickets`.

### Relationships

- **users to orders: one-to-many.** One user can place many orders, and each order belongs to one user.
- **events to seats: one-to-many.** One event has many seats, and each seat belongs to one event.
- **events to orders: one-to-many.** An order is for one event.
- **orders to tickets: one-to-many.** One paid order can contain several tickets.
- **seats to tickets: one-to-one.** A seat can have at most one ticket, enforced by a UNIQUE constraint.
- **orders and seats: many-to-many in effect.** An order covers many seats, and over time a seat may appear in many orders (cancelled or expired ones). The `tickets` table, together with `seats.held_by_order_id`, is the link.

### CREATE TABLE statements

```sql
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  venue      TEXT NOT NULL,
  starts_at  TEXT NOT NULL,
  on_sale_at TEXT NOT NULL
);

CREATE TABLE orders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  event_id    INTEGER NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'cancelled', 'expired')),
  total_price INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  TEXT NOT NULL,
  FOREIGN KEY (user_id)  REFERENCES users(id),
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE seats (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id         INTEGER NOT NULL,
  section          TEXT NOT NULL,
  row_label        TEXT NOT NULL,
  seat_number      INTEGER NOT NULL,
  price            INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'available'
                   CHECK (status IN ('available', 'held', 'sold')),
  held_by_order_id INTEGER,
  hold_expires_at  TEXT,
  UNIQUE (event_id, section, row_label, seat_number),
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (held_by_order_id) REFERENCES orders(id)
);

CREATE TABLE tickets (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  seat_id  INTEGER NOT NULL UNIQUE,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (seat_id)  REFERENCES seats(id)
);

CREATE INDEX idx_seats_event_status ON seats(event_id, status);
CREATE INDEX idx_orders_user ON orders(user_id, created_at DESC);
```

### Why these indexes
- `seats(event_id, status)`: the seat map query ("all free seats for event 55") runs thousands of times during a sale, so it must be fast.
- `orders(user_id, created_at DESC)`: "show my orders and tickets" starts from the user.

## 5. How double-booking is prevented

The database is the single source of truth. Cached data and the screen can be wrong, but the database never sells one seat twice. Three layers work together.

### Layer 1: an atomic conditional update inside a transaction

Holding a seat is one SQL statement that checks and changes the seat in a single, uninterruptible step:

```sql
BEGIN;

UPDATE seats
SET status = 'held',
    held_by_order_id = :order_id,
    hold_expires_at = :now_plus_10_minutes
WHERE id = :seat_id
  AND (
        status = 'available'
        OR (status = 'held' AND hold_expires_at < :now)
      );

-- Check how many rows changed.
-- 1 row changed  -> the seat is ours, continue.
-- 0 rows changed -> someone else got it first: ROLLBACK and return 409 Conflict.

COMMIT;
```

If two people try to hold seat 1201 at the same instant, the database processes the two updates one after the other. The first one finds the seat `available` and changes it to `held`. The second one finds it already `held`, so its `WHERE` condition fails and **0 rows change**. The second person gets a `409` and is asked to choose another seat. There is no moment when both checks pass, because "check" and "change" are one atomic step, not two separate steps in app code.

When a user selects several seats, all the updates run in **one transaction**. If any seat fails, the whole transaction is rolled back, so the user never ends up with half an order.

### Layer 2: a unique constraint as the final safety net

`tickets.seat_id` is `UNIQUE`. Even if there were a bug in the app code, the database would refuse to create a second ticket for the same seat. The failed insert would roll back the payment confirmation, and the customer would be refunded.

### Layer 3: holds that expire

A hold lasts 10 minutes. If the user does not pay, a worker releases the seats (sets them back to `available`) and marks the order `expired`. This stops abandoned carts from locking seats forever, and the `hold_expires_at` check in the update means an expired hold can be taken even before the worker runs.

### What does not protect against double-booking
- The **cache** of the seat map can show a seat as free when it was just taken. That only causes a `409` for the user, never a double sale.
- The **CDN** and the **waiting room** reduce load and keep things fair, but they do not guarantee correctness. Only the database transaction and constraint do.

## 6. Architecture

    [ Client: browser / phone ]
                |
                v
          +-----------+
          |    DNS    |
          +-----+-----+
                |
                v
          +-----------+   caches event pages, images,
          |    CDN    |   CSS and JavaScript
          +-----+-----+
                |
                v
       +------------------+
       |  Waiting Room    |   lets people in at a safe rate
       |  / Rate Limiter  |   during a big sale
       +--------+---------+
                |
                v
       +------------------+
       |  Load Balancer   |   (two instances)
       +--------+---------+
                |
       +--------+---------+
       v        v         v
    +-------+ +-------+ +-------+
    | App   | | App   | | App   |   stateless, added
    | Srv 1 | | Srv 2 | | Srv N |   before a big sale
    +--+-+--+ +--+-+--+ +--+-+--+
       | |       | |       | |
       | +-------+-+-------+ +-----------------+
       |         |                             |
       v         v                             v
    +--------+ +---------------------+   +-----------+
    | Cache  | |  Primary Database   |   |   Queue   |
    | Redis  | |  holds, orders,     |   +-----+-----+
    +--------+ |  tickets (writes)   |         |
               +----------+----------+         v
                          |              +-----------+
                          | replicates   |  Workers  |
                          v              | - emails  |
               +---------------------+   | - tickets |
               |    Read Replica     |   | - expire  |
               | (browsing, events)  |   |   holds   |
               +---------------------+   +-----+-----+
                                               |
                                               v
                                    +--------------------+
                                    |  Payment Provider  |
                                    |     (external)     |
                                    +--------------------+

### Components (one sentence each)

- **Client:** the browser or app the user uses to browse events, pick seats and pay.
- **DNS:** turns `tickethub.example` into the address of our CDN and servers.
- **CDN:** serves event pages, images and static files from servers near the user, so most of the big-sale traffic never reaches our servers.
- **Waiting room and rate limiter:** puts people into a fair, first-come queue and lets them in at a rate our system can handle, which also blocks bots and prevents a crash.
- **Load balancer:** spreads requests across the app servers and skips any server that fails.
- **App servers:** run the TicketHub logic (browse, hold, pay, tickets) and are stateless, so we can add many more before a big sale.
- **Cache (Redis):** stores event details and the seat map for a second or two, so thousands of people looking at the seat map do not each hit the database.
- **Primary database:** the single source of truth that handles every hold, order and ticket, and enforces the no-double-booking rules.
- **Read replica:** a live copy of the database that serves browsing and event queries, so the primary is kept free for holds and payments.
- **Queue:** holds slow background jobs so a payment request can finish quickly.
- **Workers:** take jobs from the queue to send confirmation emails, generate tickets (QR codes) and release expired holds.
- **Payment provider:** an external service that actually charges the customer, called with an idempotency key so retries never double-charge.

### How it survives the big sale

1. **Before the sale:** the team adds extra app servers, warms the cache with the event details and seat map, and turns on the waiting room for that event.
2. **The CDN absorbs most traffic.** The event page, images and scripts come from the CDN, so only API calls reach our servers.
3. **The waiting room smooths the spike.** Instead of 200,000 people hitting the seat-hold endpoint at once, we let in a few hundred per second. The rest see a "you are in line" page, served cheaply.
4. **The cache protects the database from seat-map reads.** The seat map is cached for 1 to 2 seconds, so thousands of requests per second become a handful of database queries per second.
5. **The database only handles the real work:** about 33 successful holds and sales per second, which one primary database handles comfortably because each hold is a small update on a single seat row.
6. **Slow work is moved off the request path.** Emails, ticket generation and hold cleanup are done by workers through the queue.
7. **After 10 minutes:** the seats are gone, the waiting room closes, and the extra servers are shut down to save money.

### Single points of failure
- Run two load balancers, several app servers and a standby copy of Redis.
- Keep the read replica ready to be promoted if the primary database fails, and take regular backups.
- Use a durable queue so jobs are not lost if a worker crashes.
- Run in more than one data centre (zone) so one failure does not stop sales.

## 7. Trade-offs

- **Cache speed vs seat-map accuracy:** caching the seat map for 1 to 2 seconds protects the database but means a user may click a seat that was just taken. We accept this because the database check returns a clear `409` and the user simply picks another seat. Correctness is never at risk, only a little convenience.
- **Waiting room: fairness and stability vs user experience:** the waiting room keeps the site alive and gives everyone a fair turn, but people must wait and some may leave. Without it, the site would likely crash and the fastest bots would win. We choose stability and fairness.
- **Hold time: short vs long:** a 10-minute hold gives people time to pay with mobile money or a card, but it locks seats that may never be bought. A shorter hold frees seats faster but causes more failed payments. We chose 10 minutes and release expired holds quickly.
- **SQL with one primary vs NoSQL:** we chose SQL because correctness matters most, and transactions and unique constraints give the strongest protection against double-booking. The cost is that writes go through one primary database, which is harder to scale than some NoSQL systems. At about 33 sales per second even during the big sale, one primary is enough.
- **Cost vs readiness:** adding servers, a waiting room and a replica costs money for an event that lasts only minutes. We reduce the cost by scaling up just before the sale and down straight afterwards.
