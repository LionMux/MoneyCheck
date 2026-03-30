-- Migration: add last_login_at column to users table
-- Run once manually: psql $DATABASE_URL -f migrations/add_last_login_at.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TEXT;
