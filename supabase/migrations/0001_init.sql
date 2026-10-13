-- MoneyGuard 초기 스키마
-- 1인 사용을 전제로 하지만 구조는 멀티유저다. 모든 테이블이 user_id 로 쪼개지고
-- RLS 로 자기 행만 보게 막는다. 서비스 키 없이 anon 키 + 로그인만으로 동작한다.

create extension if not exists "pgcrypto";

-- 카테고리처럼 사람이 읽는 고정 id('c-food')를 쓰므로 PK 는 (user_id, id) 복합키다.
create table if not exists public.accounts (
  user_id       uuid not null references auth.users(id) on delete cascade,
  id            text not null,
  name          text not null,
  type          text not null check (type in ('checking','savings','card','cash','invest','loan')),
  balance       numeric not null default 0,
  is_business   boolean not null default false,
  interest_rate numeric,
  due_day       int check (due_day between 1 and 31),
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.categories (
  user_id       uuid not null references auth.users(id) on delete cascade,
  id            text not null,
  name          text not null,
  parent_id     text,
  grade         text not null check (grade in ('need','want','waste')),
  icon          text not null default '🔖',
  direction     text not null check (direction in ('in','out')),
  default_fixed boolean not null default false,
  sort          int not null default 0,
  primary key (user_id, id)
);

create table if not exists public.transactions (
  user_id     uuid not null references auth.users(id) on delete cascade,
  id          text not null,
  account_id  text,
  date        date not null,
  amount      numeric not null check (amount >= 0),
  direction   text not null check (direction in ('in','out')),
  category_id text,
  merchant    text,
  memo        text,
  is_business boolean not null default false,
  is_fixed    boolean not null default false,
  tags        text[] not null default '{}',
  hour        int check (hour between 0 and 23),
  created_at  timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists transactions_user_date_idx on public.transactions (user_id, date desc);
create index if not exists transactions_user_cat_idx on public.transactions (user_id, category_id);

create table if not exists public.budgets (
  user_id           uuid not null references auth.users(id) on delete cascade,
  id                text not null,
  category_id       text not null,
  month             text not null,              -- yyyy-MM
  planned           numeric not null default 0,
  carryover_enabled boolean not null default false,
  primary key (user_id, id),
  unique (user_id, category_id, month)
);

create table if not exists public.subscriptions (
  user_id        uuid not null references auth.users(id) on delete cascade,
  id             text not null,
  name           text not null,
  amount         numeric not null default 0,
  cycle          text not null default 'monthly' check (cycle in ('monthly','yearly','weekly')),
  next_charge_at date not null,
  last_used_at   date,
  value_rating   int not null default 3 check (value_rating between 1 and 5),
  status         text not null default 'active' check (status in ('active','zombie','cancelled')),
  category_id    text,
  price_history  jsonb not null default '[]'::jsonb,
  primary key (user_id, id)
);

create table if not exists public.assets (
  user_id   uuid not null references auth.users(id) on delete cascade,
  id        text not null,
  name      text not null,
  kind      text not null check (kind in ('cash','invest','realestate','other')),
  value     numeric not null default 0,
  valued_at date not null,
  primary key (user_id, id)
);

create table if not exists public.debts (
  user_id       uuid not null references auth.users(id) on delete cascade,
  id            text not null,
  name          text not null,
  principal     numeric not null default 0,
  balance       numeric not null default 0,
  interest_rate numeric not null default 0,
  min_payment   numeric not null default 0,
  maturity      date,
  primary key (user_id, id)
);

create table if not exists public.goals (
  user_id        uuid not null references auth.users(id) on delete cascade,
  id             text not null,
  name           text not null,
  target_amount  numeric not null default 0,
  deadline       date not null,
  current_amount numeric not null default 0,
  priority       int not null default 3,
  primary key (user_id, id)
);

create table if not exists public.tax_reserve (
  user_id         uuid not null references auth.users(id) on delete cascade,
  id              text not null,
  month           text not null,                -- yyyy-MM
  business_income numeric not null default 0,
  required        numeric not null default 0,
  reserved        numeric not null default 0,
  primary key (user_id, id),
  unique (user_id, month)
);

create table if not exists public.receivables (
  user_id uuid not null references auth.users(id) on delete cascade,
  id      text not null,
  client  text not null,
  amount  numeric not null default 0,
  due_at  date not null,
  paid_at date,
  memo    text,
  primary key (user_id, id)
);

create table if not exists public.alerts (
  user_id      uuid not null references auth.users(id) on delete cascade,
  id           text not null,
  type         text not null,
  severity     text not null check (severity in ('info','warn','danger','praise')),
  title        text not null,
  message      text not null,
  action_label text,
  action_href  text,
  weight       int not null default 0,
  action_taken boolean not null default false,
  dismissed_at timestamptz,
  created_at   timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists alerts_user_created_idx on public.alerts (user_id, created_at desc);

create table if not exists public.rules (
  user_id uuid not null references auth.users(id) on delete cascade,
  id      text not null,
  code    text not null,
  enabled boolean not null default true,
  params  jsonb not null default '{}'::jsonb,
  primary key (user_id, id)
);

create table if not exists public.routine_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  id      text not null,
  kind    text not null,
  item    text not null,
  period  text not null,
  done_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, kind, item, period)
);

create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data    jsonb not null default '{}'::jsonb
);

-- ── RLS: 내 행만 ───────────────────────────────────────────────────
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'accounts','categories','transactions','budgets','subscriptions','assets','debts',
      'goals','tax_reserve','receivables','alerts','rules','routine_logs','settings'
    ])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format(
      'create policy own_rows on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t
    );
  end loop;
end $$;
