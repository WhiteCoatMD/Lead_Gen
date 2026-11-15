import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/migrations/20261115231500_santa_orders.sql", import.meta.url), "utf8");

test("the migration stays inside schema santa and is safe to re-run", () => {
  assert.match(sql, /create schema if not exists santa/i);
  assert.match(sql, /create table if not exists santa\.orders/i);
  assert.match(sql, /create table if not exists santa\.children/i);
  assert.match(sql, /create table if not exists santa\.letter_drafts/i);
  assert.match(sql, /create table if not exists santa\.audit_log/i);
  assert.match(sql, /create table if not exists santa\.order_messages/i);
  assert.match(sql, /create table if not exists santa\.stripe_events/i);
  const code = sql.replace(/--[^\n]*/g, "");
  assert.doesNotMatch(code, /public\./);
  assert.doesNotMatch(code, /schema public/i);
  assert.doesNotMatch(code, /table public/i);
  assert.doesNotMatch(code, /\bdrop\s+(table|schema)\b/i);
  assert.doesNotMatch(code, /create policy/i);
  assert.doesNotMatch(code, /security definer/i);
  assert.equal((sql.match(/enable row level security/gi) || []).length, 7);
  assert.match(sql, /grant select, insert, update, delete on table santa\.orders to service_role/i);
  assert.match(sql, /from public, anon, authenticated/i);
  assert.match(sql, /'draft', 'approved', 'rejected', 'sent', 'mailed'/);
});

test("the children table has no email column", () => {
  const body = sql.match(/create table if not exists santa\.children \(([\s\S]*?)\);/i)?.[1] || "";
  assert.ok(body);
  assert.doesNotMatch(body, /email/i);
  assert.match(body, /first_name/);
  assert.match(body, /references santa\.orders/);
});
