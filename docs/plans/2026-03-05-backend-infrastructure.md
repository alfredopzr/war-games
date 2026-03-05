# Backend Infrastructure Plan

## Current State

The server (`packages/server/`) is a stateless Socket.io + Express app with:

- In-memory room management (no persistence)
- No player accounts or authentication
- No database
- Game state lives only in memory during a match
- No concept of currencies, progression, or matchmaking tiers

This plan outlines what needs to be built **before** implementing the gold economy and PvP systems.

---

## Phase 1: Database & Player Accounts

### 1.1 Database Selection

**PostgreSQL** via Drizzle ORM.

Rationale: relational data (players, matches, inventories) with transactional guarantees for gold transfers and wagers. Drizzle gives type-safe queries with minimal overhead and works well with the existing strict TypeScript setup.

Dependencies to add to `packages/server/`:
- `drizzle-orm`
- `drizzle-kit` (dev)
- `postgres` (pg driver)

### 1.2 Schema: Core Tables

```
players
├── id              UUID, PK
├── username        VARCHAR(32), UNIQUE, NOT NULL
├── email           VARCHAR(255), UNIQUE, NOT NULL
├── password_hash   VARCHAR(255), NOT NULL
├── gold            INTEGER, NOT NULL, DEFAULT 0
├── medals          INTEGER, NOT NULL, DEFAULT 0
├── elo_rating      INTEGER, NOT NULL, DEFAULT 1000
├── rank_tier       VARCHAR(16), NOT NULL, DEFAULT 'bronze'
├── created_at      TIMESTAMP, DEFAULT NOW()
└── updated_at      TIMESTAMP, DEFAULT NOW()

sessions
├── id              UUID, PK
├── player_id       UUID, FK → players.id
├── token           VARCHAR(255), NOT NULL
├── expires_at      TIMESTAMP, NOT NULL
└── created_at      TIMESTAMP, DEFAULT NOW()

campaign_progress
├── id              UUID, PK
├── player_id       UUID, FK → players.id
├── chapter         INTEGER, NOT NULL
├── battle          INTEGER, NOT NULL
├── cleared         BOOLEAN, NOT NULL, DEFAULT false
├── replay_count    INTEGER, NOT NULL, DEFAULT 0
├── best_time_ms    INTEGER, NULLABLE
└── UNIQUE(player_id, chapter, battle)

inventory
├── id              UUID, PK
├── player_id       UUID, FK → players.id
├── item_type       VARCHAR(32), NOT NULL  -- e.g. 'field-rations', 'artillery-strike'
├── quantity         INTEGER, NOT NULL, DEFAULT 0
└── UNIQUE(player_id, item_type)

match_history
├── id              UUID, PK
├── mode            VARCHAR(16), NOT NULL  -- 'casual', 'competitive', 'campaign'
├── player1_id      UUID, FK → players.id
├── player2_id      UUID, NULLABLE, FK → players.id  -- NULL for campaign
├── winner_id       UUID, NULLABLE, FK → players.id
├── tier            VARCHAR(16), NULLABLE  -- competitive tier at time of match
├── pot_total       INTEGER, NULLABLE      -- total gold in pot (competitive only)
├── rounds_played   INTEGER, NOT NULL
├── duration_ms     INTEGER, NOT NULL
├── created_at      TIMESTAMP, DEFAULT NOW()
└── replay_data     JSONB, NULLABLE        -- serialized turn log for replays

competitive_tickets
├── id              UUID, PK
├── player_id       UUID, FK → players.id
├── date            DATE, NOT NULL
├── free_remaining  INTEGER, NOT NULL, DEFAULT 3
└── UNIQUE(player_id, date)

daily_rewards
├── id              UUID, PK
├── player_id       UUID, FK → players.id
├── date            DATE, NOT NULL
├── login_claimed   BOOLEAN, DEFAULT false
├── casual_win      BOOLEAN, DEFAULT false
├── competitive_win BOOLEAN, DEFAULT false
├── challenge_done  BOOLEAN, DEFAULT false
├── casual_gold_earned INTEGER, DEFAULT 0  -- tracks toward 500g daily cap
└── UNIQUE(player_id, date)

gold_transactions
├── id              UUID, PK
├── player_id       UUID, FK → players.id
├── amount          INTEGER, NOT NULL      -- positive = credit, negative = debit
├── type            VARCHAR(32), NOT NULL  -- 'campaign', 'casual-win', 'wager-win', 'wager-loss', 'fold-tax', 'consumable-purchase', 'ticket-purchase'
├── reference_id    UUID, NULLABLE         -- FK to match_history or other source
├── balance_after   INTEGER, NOT NULL      -- snapshot for audit trail
└── created_at      TIMESTAMP, DEFAULT NOW()

cosmetic_unlocks
├── id              UUID, PK
├── player_id       UUID, FK → players.id
├── cosmetic_id     VARCHAR(64), NOT NULL  -- e.g. 'skin-veteran-infantry', 'title-warlord'
├── equipped        BOOLEAN, DEFAULT false
├── unlocked_at     TIMESTAMP, DEFAULT NOW()
└── UNIQUE(player_id, cosmetic_id)
```

### 1.3 Authentication

**Session-based auth** using secure HTTP-only cookies. No JWTs for now — simpler and more secure for a game that already uses persistent WebSocket connections.

Flow:
1. Player registers with username/email/password.
2. Server hashes password with `bcrypt`, stores in `players`.
3. On login, server creates a session row, sets a secure cookie.
4. WebSocket connection sends the session cookie on handshake — server validates before allowing room operations.
5. Session expires after 7 days of inactivity.

Dependencies to add:
- `bcrypt` (password hashing)
- `cookie-parser` (Express middleware)

### 1.4 REST API Endpoints

Add an API router (`src/api/`) alongside the existing Socket.io handlers:

```
POST   /api/auth/register        -- create account
POST   /api/auth/login            -- authenticate, set session cookie
POST   /api/auth/logout           -- destroy session
GET    /api/auth/me               -- current player profile

GET    /api/player/profile        -- gold, medals, rank, stats
GET    /api/player/inventory      -- consumable quantities
GET    /api/player/cosmetics      -- unlocked cosmetics + equipped state

GET    /api/campaign/progress     -- chapter/battle clear status
POST   /api/campaign/start        -- start a campaign battle (validates chapter unlocked)

GET    /api/shop/catalog          -- consumable items + prices
POST   /api/shop/buy              -- purchase consumable (deducts gold, adds to inventory)

GET    /api/cosmetics/catalog     -- medal cosmetics + prices
POST   /api/cosmetics/buy         -- purchase cosmetic (deducts medals)
POST   /api/cosmetics/equip       -- equip/unequip a cosmetic

GET    /api/competitive/tickets   -- remaining tickets for today
POST   /api/competitive/queue     -- queue for competitive match (validates tier, ticket, ante)

GET    /api/leaderboard           -- top players by ELO
GET    /api/match-history         -- recent matches for current player

GET    /api/daily/status          -- daily reward claim status
POST   /api/daily/claim-login     -- claim login reward
```

---

## Phase 2: Matchmaking & Competitive Queue

### 2.1 Matchmaking Service

The current room system is manual (create room, share code, join). Competitive PvP needs automated matchmaking.

**New module: `src/matchmaking.ts`**

Responsibilities:
- Maintains a queue per competitive tier (Bronze, Silver, Gold, Diamond, Master).
- Players enter the queue via `POST /api/competitive/queue` or a socket event.
- Server validates: player has a ticket (free or purchased), player has enough gold for the tier ante, player is not already in a match.
- When two players are in the same tier queue, server creates a room, deducts antes from both, and starts the match.
- Ante gold is held in escrow (deducted from player balance, not yet awarded to anyone).
- If no match is found within 60 seconds, widen the search by one tier in each direction.
- Queue position is communicated to the client via socket events.

### 2.2 Wager Escrow

**New module: `src/wager.ts`**

Gold wagering requires transactional safety — a player's gold must be locked when committed and only transferred on match resolution.

```
wager_escrow
├── id              UUID, PK
├── match_id        UUID, FK → match_history.id
├── player_id       UUID, FK → players.id
├── amount          INTEGER, NOT NULL      -- total committed (ante + raises)
├── status          VARCHAR(16), NOT NULL  -- 'held', 'won', 'lost', 'refunded'
└── created_at      TIMESTAMP, DEFAULT NOW()
```

Flow:
1. **Ante**: when match starts, deduct ante from both players, create escrow rows with status `held`.
2. **Raise**: between rounds, player submits a raise. Server validates they have enough gold, deducts it, updates escrow amount.
3. **Call**: opponent's gold is deducted and their escrow updated.
4. **All-in cap**: if opponent can't match the full raise, they go all-in for their remaining gold. Excess raise is refunded to the raiser.
5. **Fold**: match ends. Folder's escrow status → `lost`. Winner's escrow status → `won`. Fold tax (10% of total pot) is calculated and deducted from the folder's escrow before transferring to winner.
6. **Match end**: winner receives the full pot. Loser's escrow status → `lost`. Winner's escrow status → `won`.
7. **Disconnect/crash**: if neither player completes the match, both escrows are refunded.

All gold mutations happen inside database transactions to prevent race conditions.

### 2.3 Raise Phase — New Socket Events

The raise phase is a new game phase that happens between rounds in competitive matches. New socket events:

```
Client → Server:
  'raise'              { amount: number }
  'call'               {}
  'fold'               {}

Server → Client:
  'raise-phase-start'  { pot: number, yourEscrow: number, opponentEscrow: number, maxRaise: number }
  'opponent-raised'    { amount: number, pot: number, yourMaxCall: number }
  'opponent-called'    {}
  'opponent-folded'    {}
  'raise-phase-end'    { pot: number }
```

The raise phase has a **30-second timer**. If a player doesn't respond to a raise, they auto-fold.

---

## Phase 3: Campaign Service

### 3.1 Campaign Definitions

**New module: `packages/engine/src/campaign.ts`**

Static data defining all chapters and battles:

```typescript
interface CampaignBattle {
  chapter: number;
  battle: number;
  name: string;
  description: string;
  aiDifficulty: 'easy' | 'medium' | 'hard' | 'expert';
  mapSeed: number;
  constraints?: {
    playerManpower?: number;      // override starting manpower
    bannedUnits?: UnitType[];     // units player can't use
    deploymentSlots?: number;     // limit deployment zone size
  };
  rewards: {
    firstClearGold: number;
    replayGold: number;           // 20% of firstClearGold
    replayGoldAfterFive: number;  // 10% of firstClearGold
  };
  isBoss: boolean;
}

interface CampaignChapter {
  chapter: number;
  name: string;
  description: string;
  battles: CampaignBattle[];
}
```

This lives in the engine package so both client and server can reference it.

### 3.2 Campaign Server Logic

**New module: `src/campaign-service.ts`**

Responsibilities:
- Validate a player can start a specific battle (previous battles/chapters cleared).
- Create a local game instance (engine + AI opponent) on the server.
- On battle completion, calculate gold reward based on first-clear vs replay count.
- Update `campaign_progress` and `gold_transactions` tables.
- Award daily challenge completion if applicable.

Campaign battles run server-side to prevent gold farming exploits. The client sends commands, the server runs the engine, and results are authoritative.

---

## Phase 4: Inventory & Shop Service

### 4.1 Shop Service

**New module: `src/shop-service.ts`**

Responsibilities:
- Serve consumable catalog (static data: item type, tier, gold cost, description, effect).
- Handle purchase requests: validate player has enough gold, deduct gold, increment inventory quantity.
- All purchases are logged in `gold_transactions`.

### 4.2 Consumable Integration with Matches

Consumables need to integrate with the existing game loop:

1. **Pre-match loadout selection**: before a match starts (after matchmaking, before build phase), both players select up to 3 consumables from their inventory. Server validates: items exist in inventory, max 1 Epic, max 3 total.
2. **Loadout lock**: once the match starts, consumables are deducted from inventory (they're committed even if unused — prevents backing out). If the match is aborted/refunded, consumables are returned.
3. **In-match usage**: new socket event `'use-consumable'` with `{ slot: number }`. Server validates it's the player's turn, the consumable hasn't been used yet, and applies the effect to the game state.
4. **Engine integration**: add consumable effects to the engine as a new action type. Each consumable maps to a pure function that transforms `GameState`.

New socket events:
```
Client → Server:
  'select-loadout'     { items: [string, string, string] }  -- item types, empty string for unused slots
  'use-consumable'     { slot: number, target?: CubeCoord | string }

Server → Client:
  'loadout-confirmed'  { items: [string, string, string] }
  'opponent-loadout'   { filledSlots: number }  -- only count, not which items
  'consumable-used'    { player: PlayerId, slot: number, effect: string }
```

---

## Phase 5: Rank, Leaderboard & Daily Systems

### 5.1 ELO Service

**New module: `src/elo-service.ts`**

- Standard ELO calculation with K-factor of 32.
- After each competitive match, update both players' `elo_rating`.
- Recalculate `rank_tier` based on rating brackets:

| Tier | ELO Range |
|---|---|
| Bronze | 0 - 1099 |
| Silver | 1100 - 1399 |
| Gold | 1400 - 1699 |
| Diamond | 1700 - 1999 |
| Master | 2000+ |

- Award medals based on winner's tier at time of match.

### 5.2 Weekly Demotion Job

A scheduled job (cron or `node-cron`) runs once per week:

1. Query all Master-tier players.
2. Rank them by ELO within Master.
3. Bottom 70% are demoted to Diamond (ELO set to 1999).
4. Top 30% retain Master.
5. Send notification to affected players (via socket if online, or flagged for next login).

### 5.3 Seasonal Reset Job

Runs at the start of each season (monthly or bi-monthly):

1. All players' ELO decays toward 1000 by 25%: `newElo = 1000 + (currentElo - 1000) * 0.75`.
2. Rank tiers are recalculated.
3. Season rewards are distributed (bonus medals based on peak tier during the season).

### 5.4 Daily Reset & Rewards

A scheduled job at midnight UTC:

1. Reset `competitive_tickets.free_remaining` to 3 for all players (or create new rows for the new date).
2. Reset `daily_rewards` for the new date.
3. Rotate the daily challenge (select from a pool of predefined challenges).

### 5.5 Leaderboard

- Query top 100 players by `elo_rating`, cached and refreshed every 5 minutes.
- Expose via `GET /api/leaderboard` with pagination.
- Include player's own rank position even if not in top 100.

---

## Phase 6: Cosmetics Service

**New module: `src/cosmetics-service.ts`**

### 6.1 Cosmetic Catalog

Static data defining all cosmetics:

```typescript
interface CosmeticItem {
  id: string;                    // e.g. 'skin-veteran-infantry'
  name: string;
  category: 'unit-skin' | 'hex-theme' | 'victory-animation' | 'title' | 'border';
  medalCost: number;
  description: string;
  previewAsset: string;          // path to preview image/animation
  unitType?: UnitType;           // for unit skins
}
```

### 6.2 Service Responsibilities

- Serve catalog filtered by category.
- Handle purchase: validate player has enough medals, deduct medals, create `cosmetic_unlocks` row.
- Handle equip/unequip: only one of each category can be equipped at a time (one title, one border, one victory animation, one hex theme, one skin per unit type).
- Equipped cosmetics are sent to opponents during matches so they can see them.

---

## Implementation Order

This is the recommended build order, with each phase producing a testable milestone:

| Phase | What | Depends On | Milestone |
|---|---|---|---|
| **1** | Database + Auth + Player Accounts | Nothing | Players can register, login, see their profile |
| **2** | Matchmaking + Wager Escrow + Raise Phase | Phase 1 | Competitive PvP with gold wagering works end-to-end |
| **3** | Campaign Service + Gold Rewards | Phase 1 | Players can grind campaign, earn gold, track progress |
| **4** | Inventory + Shop + Consumable Integration | Phase 1, 3 | Players can buy and use consumables in matches |
| **5** | ELO + Rank + Leaderboard + Daily Systems | Phase 1, 2 | Competitive ranking, daily rewards, seasonal resets |
| **6** | Cosmetics Service | Phase 1, 5 | Medal shop with equippable cosmetics |

### New Package Structure

```
packages/server/
  src/
    api/                    -- REST API routes
      auth.ts
      player.ts
      campaign.ts
      shop.ts
      cosmetics.ts
      competitive.ts
      leaderboard.ts
      daily.ts
    db/                     -- Database layer
      schema.ts             -- Drizzle schema definitions
      migrations/           -- Generated migrations
      index.ts              -- DB connection + Drizzle instance
    services/               -- Business logic
      auth-service.ts
      campaign-service.ts
      shop-service.ts
      cosmetics-service.ts
      elo-service.ts
      wager-service.ts
      matchmaking.ts
      daily-service.ts
    jobs/                   -- Scheduled tasks
      weekly-demotion.ts
      seasonal-reset.ts
      daily-reset.ts
    middleware/
      auth-middleware.ts    -- Session validation for REST + WebSocket
    game-loop.ts            -- Existing (extended with consumable + raise support)
    rooms.ts                -- Existing (extended with matchmaking integration)
    index.ts                -- Existing (extended with API routes + jobs)
    ...existing files
```

### New Dependencies

```
drizzle-orm              -- Type-safe ORM
postgres                 -- PostgreSQL driver
drizzle-kit              -- Migration tooling (dev)
bcrypt                   -- Password hashing
cookie-parser            -- Session cookie parsing
node-cron                -- Scheduled jobs
```
