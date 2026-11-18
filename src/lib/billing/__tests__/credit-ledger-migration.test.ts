import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

const userId = "7f9b0d3a-e4b0-4ec4-9e0c-b21766e4b733";
const secondUserId = "bb6b16e7-3db1-487f-8f68-c58c0fc72b77";
const requestId = "20261103-0000-4000-8000-000000000001";

describe("credit ledger migration", () => {
  let database: PGlite;

  beforeAll(async () => {
    database = new PGlite();
    await database.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create function auth.role() returns text language sql stable as $$
        select nullif(current_setting('request.jwt.claim.role', true), '')
      $$;
    `);
    const migrationPath = fileURLToPath(new URL("../../../../supabase/migrations/20261103000000_credit_ledger.sql", import.meta.url));
    await database.exec(await readFile(migrationPath, "utf8"));
    await database.query("insert into auth.users(id) values ($1), ($2)", [userId, secondUserId]);
  });

  afterAll(async () => { await database.close(); });

  it("creates private user balances and makes credit mutations atomic and idempotent", async () => {
    const initialBalance = await database.query<{ balance: number }>("select balance from public.credit_accounts where user_id = $1", [userId]);
    expect(initialBalance.rows[0].balance).toBe(0);

    await database.query("select set_config('request.jwt.claim.role', 'service_role', false)");
    await database.exec("set role service_role");
    const granted = await database.query<{ result: boolean }>(
      "select public.grant_purchased_credits($1, 5, 'cs_test_pack', 'evt_test_paid') as result", [userId],
    );
    expect(granted.rows[0].result).toBe(true);
    const singleGranted = await database.query<{ result: boolean }>(
      "select public.grant_purchased_credits($1, 1, 'cs_test_single', 'evt_test_single') as result", [secondUserId],
    );
    expect(singleGranted.rows[0].result).toBe(true);
    const singleBalance = await database.query<{ balance: number }>("select balance from public.credit_accounts where user_id = $1", [secondUserId]);
    expect(singleBalance.rows[0].balance).toBe(1);
    const duplicatePurchase = await database.query<{ result: boolean }>(
      "select public.grant_purchased_credits($1, 5, 'cs_test_pack', 'evt_test_retry') as result", [userId],
    );
    expect(duplicatePurchase.rows[0].result).toBe(false);
    await expect(database.query("select public.grant_purchased_credits($1, 3, 'cs_bad_pack', 'evt_bad_pack')", [userId]))
      .rejects.toThrow("invalid purchase");

    const reserved = await database.query<{ status: string }>(
      "select public.reserve_analysis_credit($1, $2) as status", [userId, requestId],
    );
    expect(reserved.rows[0].status).toBe("reserved");
    const duplicateRequest = await database.query<{ status: string }>(
      "select public.reserve_analysis_credit($1, $2) as status", [userId, requestId],
    );
    expect(duplicateRequest.rows[0].status).toBe("duplicate_request");
    const refunded = await database.query<{ result: boolean }>(
      "select public.refund_analysis_credit($1, $2) as result", [userId, requestId],
    );
    expect(refunded.rows[0].result).toBe(true);
    const duplicateRefund = await database.query<{ result: boolean }>(
      "select public.refund_analysis_credit($1, $2) as result", [userId, requestId],
    );
    expect(duplicateRefund.rows[0].result).toBe(false);

    for (let attempt = 2; attempt <= 5; attempt += 1) {
      const id = `20261103-0000-4000-8000-${String(attempt).padStart(12, "0")}`;
      const result = await database.query<{ status: string }>(
        "select public.reserve_analysis_credit($1, $2) as status", [userId, id],
      );
      expect(result.rows[0].status).toBe("reserved");
    }
    const limited = await database.query<{ status: string }>(
      "select public.reserve_analysis_credit($1, '20261103-0000-4000-8000-000000000006') as status", [userId],
    );
    expect(limited.rows[0].status).toBe("rate_limited");

    const remaining = await database.query<{ balance: number }>("select balance from public.credit_accounts where user_id = $1", [userId]);
    expect(remaining.rows[0].balance).toBe(1);
  });

  it("restricts balance reads to the authenticated owner and denies browser mutations", async () => {
    await database.exec("reset role");
    await database.query("select set_config('request.jwt.claim.role', 'authenticated', false)");
    await database.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
    await database.exec("set role authenticated");
    const visibleAccounts = await database.query<{ user_id: string }>("select user_id from public.credit_accounts");
    expect(visibleAccounts.rows.map((row) => row.user_id)).toEqual([userId]);
    await expect(database.query("update public.credit_accounts set balance = 100 where user_id = $1", [userId]))
      .rejects.toThrow();
    await expect(database.query("select public.reserve_analysis_credit($1, $2)", [userId, requestId]))
      .rejects.toThrow();
    await database.exec("reset role");
    await database.exec("set role anon");
    await expect(database.query("select user_id from public.credit_accounts")).rejects.toThrow();
  });
});
