-- CabShare DB Migration for AmazeCC
-- Run this on the Supabase PostgreSQL database

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── ENUM types ──────────────
DO $$ BEGIN
    CREATE TYPE trip_status AS ENUM ('active', 'expired', 'cancelled', 'fulfilled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE gender_pref AS ENUM ('boys', 'girls', 'mixed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ── Trigger function ──
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Users ──
CREATE TABLE IF NOT EXISTS cabshare_users (
    user_id       SERIAL       PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    phone_number  VARCHAR(15)  NOT NULL,
    reg_number    VARCHAR(20)  NOT NULL UNIQUE,
    created_at    TIMESTAMPTZ  DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TRIGGER trg_cabshare_users_updated_at
    BEFORE UPDATE ON cabshare_users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ── Hubs ──
CREATE TABLE IF NOT EXISTS cabshare_hubs (
    hub_id   SERIAL       PRIMARY KEY,
    hub_name VARCHAR(100) NOT NULL,
    city     VARCHAR(50)  NOT NULL DEFAULT 'Chennai'
);

INSERT INTO cabshare_hubs (hub_id, hub_name, city) VALUES
  (1, 'Chennai Airport',                 'Chennai'),
  (2, 'Chennai Central Railway Station', 'Chennai'),
  (3, 'Chennai Egmore Railway Station',  'Chennai'),
  (4, 'Koyambedu Bus Terminal',          'Chennai')
ON CONFLICT (hub_id) DO NOTHING;
SELECT setval('cabshare_hubs_hub_id_seq', (SELECT MAX(hub_id) FROM cabshare_hubs));

-- ── Trips ──
CREATE TABLE IF NOT EXISTS cabshare_trips (
    trip_id           SERIAL        PRIMARY KEY,
    user_id           INTEGER       NOT NULL REFERENCES cabshare_users(user_id) ON DELETE CASCADE,
    hub_id            INTEGER       NOT NULL REFERENCES cabshare_hubs(hub_id)  ON DELETE RESTRICT,

    travel_date       DATE          NOT NULL,
    preferred_time    TIME          NOT NULL,
    tolerance_hours   NUMERIC(3,1)  NOT NULL,

    seat_options      JSONB         NOT NULL,
    gender_preference gender_pref   NOT NULL,
    notes             VARCHAR(300)  DEFAULT NULL,

    status            trip_status   NOT NULL DEFAULT 'active',

    created_at        TIMESTAMPTZ   DEFAULT NOW(),
    updated_at        TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cabshare_matching
    ON cabshare_trips (hub_id, travel_date, preferred_time, status);

CREATE TRIGGER trg_cabshare_trips_updated_at
    BEFORE UPDATE ON cabshare_trips
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ── Match Events ──
CREATE TABLE IF NOT EXISTS cabshare_match_events (
    id            SERIAL       PRIMARY KEY,
    trip_id       INTEGER      NOT NULL REFERENCES cabshare_trips(trip_id) ON DELETE CASCADE,
    requester_id  INTEGER      NOT NULL REFERENCES cabshare_users(user_id) ON DELETE CASCADE,
    owner_id      INTEGER      NOT NULL REFERENCES cabshare_users(user_id) ON DELETE CASCADE,
    status        VARCHAR(20)  NOT NULL DEFAULT 'pending', -- pending, accepted, rejected, withdrawn
    created_at    TIMESTAMPTZ  DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  DEFAULT NOW(),
    UNIQUE (trip_id, requester_id)
);

CREATE TRIGGER trg_cabshare_match_events_updated_at
    BEFORE UPDATE ON cabshare_match_events
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ── Notifications ──
CREATE TABLE IF NOT EXISTS cabshare_notifications (
    notif_id      SERIAL       PRIMARY KEY,
    user_id       INTEGER      NOT NULL REFERENCES cabshare_users(user_id) ON DELETE CASCADE,
    title         VARCHAR(100) NOT NULL,
    message       TEXT         NOT NULL,
    type          VARCHAR(50)  NOT NULL,
    is_read       BOOLEAN      DEFAULT FALSE,
    created_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cabshare_notifs_user
    ON cabshare_notifications(user_id, is_read);

-- ── Waitlist ──
CREATE TABLE IF NOT EXISTS cabshare_waitlist (
    waitlist_id   SERIAL       PRIMARY KEY,
    user_id       INTEGER      NOT NULL REFERENCES cabshare_users(user_id) ON DELETE CASCADE,
    hub_id        INTEGER      NOT NULL REFERENCES cabshare_hubs(hub_id) ON DELETE CASCADE,
    travel_date   DATE         NOT NULL,
    created_at    TIMESTAMPTZ  DEFAULT NOW(),
    UNIQUE (user_id, hub_id, travel_date)
);

-- ── Ratings ──
CREATE TABLE IF NOT EXISTS cabshare_ratings (
    rating_id     SERIAL       PRIMARY KEY,
    trip_id       INTEGER      NOT NULL REFERENCES cabshare_trips(trip_id) ON DELETE CASCADE,
    rater_id      INTEGER      NOT NULL REFERENCES cabshare_users(user_id) ON DELETE CASCADE,
    ratee_id      INTEGER      NOT NULL REFERENCES cabshare_users(user_id) ON DELETE CASCADE,
    score         INTEGER      NOT NULL CHECK (score >= 1 AND score <= 5),
    comment       TEXT         DEFAULT NULL,
    created_at    TIMESTAMPTZ  DEFAULT NOW(),
    UNIQUE (trip_id, rater_id, ratee_id)
);

-- ── Blocks ──
CREATE TABLE IF NOT EXISTS cabshare_blocks (
    block_id      SERIAL       PRIMARY KEY,
    blocker_id    INTEGER      NOT NULL REFERENCES cabshare_users(user_id) ON DELETE CASCADE,
    blocked_id    INTEGER      NOT NULL REFERENCES cabshare_users(user_id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ  DEFAULT NOW(),
    UNIQUE (blocker_id, blocked_id)
);
