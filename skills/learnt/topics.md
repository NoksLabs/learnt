# Topics and explaining

## Explain recipe

Every new idea, four beats, in order. Operator-facing, plain sentences.

1. **Picture.** Everyday thing a 5-year-old knows: toy box, lunch line, post office, lego, fridge notes.
2. **Map.** Same picture, mapped onto operator's real system. Name real files, tables, endpoints, queues, numbers. Small table "picture → your system" when helps.
3. **Name.** Real term + one exact sentence definition.
4. **Break.** Concrete failure in their system without it, and what fixes cost.

Rules:
- One picture per idea. Picture must match mechanism, not just mood.
- Real names from system.md or code. Not `foo`, `ServiceA`, `User 1`.
- Numbers concrete: "500 orders/min", "4 KB row", "30 s timeout".
- Picture breaks down somewhere → say where.
- Operator gets it → drop picture next time, use real term.

## Tracks

Seed curriculum.md from operator's focus. Add tracks operator asks for (security, testing, observability, ML, anything). Below: what each covers + sample picture. Sample uses a shop app (`orders` table, `POST /checkout`, `emails` queue); always swap for operator's own system.

### System design
Covers: requirements → components, load, scaling, caching, queues, failure, consistency, tradeoffs.
Picture: lemonade stand gets too busy. One kid takes orders, one pours → split `POST /checkout` from `emails` worker. Line too long → second pourer = second worker. Cooler of pre-poured cups = cache.

### Software architecture
Covers: boundaries, modules, layers, dependencies direction, coupling/cohesion, ports/adapters.
Picture: kitchen drawers. Spoons drawer doesn't know where forks are. `checkout` module calls `payments` only through its front door (`charge()`), never reaches into its tables.

### DDD and vertical slicing
Covers: domain language, bounded contexts, aggregates, invariants, feature slices end to end.
Picture: school has words that change by room. "Order" at kitchen = food ticket; at billing = money owed. Two contexts, two models. Vertical slice = one whole cake slice (UI + API + DB for "cancel order"), not one layer of the cake.

### Encoding and decoding
Covers: bytes vs text, UTF-8, JSON/Protobuf, base64, serialization, schemas, validation at edges, versioning.
Picture: secret letter. Write in agreed code (encode), friend reads with same code book (decode). Different book → nonsense. `orders.note` saved UTF-8, read as Latin-1 → "cafÃ©". Validate at door: decode `POST /checkout` body with schema before trusting it.

### Memory management
Covers: stack vs heap, references, GC, leaks, buffers, streaming vs loading whole, object lifetime.
Picture: toy box has fixed room. Take toys out, never put back → box full (leak). Big export: read all 2 M `orders` rows into array = dump every toy on floor; stream 1 k at a time = one handful.

### Concurrency
Covers: threads/async, race conditions, locks, transactions, idempotency, backpressure, deadlock.
Picture: two kids, one cookie jar with 1 cookie, both see "1 left", both grab. Two `POST /checkout` read `stock = 1`, both sell. Fix: one hand on jar at a time (row lock / atomic `UPDATE ... WHERE stock > 0`).

### Infrastructure
Covers: processes, containers, networking, DNS, load balancers, deploys, config/secrets, observability, cost.
Picture: post office. Address (DNS) → front desk (load balancer) → many clerks (instances). Clerk sick → desk sends letters to others (health check). Logs = clerk's diary.

### Operator-asked tracks
New topic → add track to curriculum.md, same recipe, same rules.

## Mastery levels

`unseen` → `introduced` (you explained) → `practicing` (operator applied with help) → `solid` (operator applied alone + teach back).
Only operator evidence moves level past introduced. Shaky again → drop one level, add `Revisit:`.
Revisit: when task touches a tracked idea marked Revisit, ask operator to use it first before explaining.
