-- Migration: add code_hash to password_reset_tokens
-- Run once against an existing database that was created before the OTP flow.
-- Safe to re-run: uses IF NOT EXISTS / IF EXISTS guards.

ALTER TABLE password_reset_tokens
  ADD COLUMN IF NOT EXISTS code_hash TEXT;

CREATE INDEX IF NOT EXISTS prt_code_hash_idx
  ON password_reset_tokens (code_hash);
