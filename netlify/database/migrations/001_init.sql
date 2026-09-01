CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  mode TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('STRONG BUY','STRONG SELL')),
  confidence INTEGER NOT NULL,
  entry_low DOUBLE PRECISION,
  entry_high DOUBLE PRECISION,
  stop_loss DOUBLE PRECISION,
  take_profit_1 DOUBLE PRECISION,
  take_profit_2 DOUBLE PRECISION,
  take_profit_3 DOUBLE PRECISION,
  risk_reward DOUBLE PRECISION,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  conflicts JSONB NOT NULL DEFAULT '[]'::jsonb,
  timeframe_scores JSONB NOT NULL DEFAULT '[]'::jsonb,
  news_risk JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_candle_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'Active',
  acknowledged_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS signals_created_idx ON signals(created_at DESC);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  subscription_id BIGINT PRIMARY KEY REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  strong_buy BOOLEAN NOT NULL DEFAULT TRUE,
  strong_sell BOOLEAN NOT NULL DEFAULT TRUE,
  target_updates BOOLEAN NOT NULL DEFAULT FALSE,
  stop_loss_updates BOOLEAN NOT NULL DEFAULT FALSE,
  invalidation_updates BOOLEAN NOT NULL DEFAULT FALSE,
  alert_sound BOOLEAN NOT NULL DEFAULT TRUE,
  cooldown_minutes INTEGER NOT NULL DEFAULT 30
);

CREATE TABLE IF NOT EXISTS notification_history (
  id BIGSERIAL PRIMARY KEY,
  signal_id TEXT NOT NULL,
  subscription_id BIGINT NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivery_status TEXT NOT NULL,
  UNIQUE(signal_id, subscription_id, notification_type)
);

CREATE TABLE IF NOT EXISTS cached_news (
  event_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  currency TEXT,
  impact TEXT,
  source_time TEXT,
  utc_time TIMESTAMPTZ,
  malaysia_time TEXT,
  actual TEXT,
  forecast TEXT,
  previous TEXT,
  event_url TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
