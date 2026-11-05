-- ==============================================================================
-- CONA CASH — MIGRATION 005_GOALS.SQL (Fase 5 — Metas, Conquistas e Sons)
-- Totalmente aditiva e idempotente (IF NOT EXISTS)
-- ==============================================================================

-- 1. Tabela de Metas
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('earning', 'expense_limit', 'saving')),
  period text not null check (period in ('daily', 'weekly', 'monthly')),
  target_cents bigint not null check (target_cents > 0),
  income_source_id uuid references public.income_sources(id) on delete set null,
  active boolean not null default true,
  celebrated_periods jsonb not null default '[]'::jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices de consulta rápida
create index if not exists idx_goals_user on public.goals(user_id, active, archived);
create index if not exists idx_goals_source on public.goals(income_source_id);

-- 2. Tabela de Histórico de Metas Conquistadas / Medalhas
create table if not exists public.goal_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  period_key text not null,
  medal_tier text not null check (medal_tier in ('bronze', 'silver', 'gold')),
  achieved_cents bigint not null,
  target_cents bigint not null,
  achieved_at timestamptz not null default now(),
  constraint uq_goal_achievement unique (user_id, goal_id, period_key)
);

create index if not exists idx_goal_achievements_user on public.goal_achievements(user_id, achieved_at desc);

-- 3. Habilitação de RLS
alter table public.goals enable row level security;
alter table public.goal_achievements enable row level security;

-- Policies para goals
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'goals' and policyname = 'goals_isolation_all'
  ) then
    create policy goals_isolation_all on public.goals
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- Policies para goal_achievements
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'goal_achievements' and policyname = 'goal_achievements_isolation_all'
  ) then
    create policy goal_achievements_isolation_all on public.goal_achievements
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- 4. Função para registrar celebração de meta batida (dispara 1x por período)
create or replace function public.record_goal_celebration(
  p_goal_id uuid,
  p_period_key text,
  p_achieved_cents bigint,
  p_target_cents bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_already boolean;
  v_tier text;
  v_ratio numeric;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  -- Verifica se este período já foi celebrado
  select (celebrated_periods ? p_period_key) into v_already
  from public.goals
  where id = p_goal_id and user_id = v_user_id;

  if v_already is true then
    return false;
  end if;

  -- Determina a medalha
  if p_target_cents > 0 then
    v_ratio := (p_achieved_cents::numeric / p_target_cents::numeric);
  else
    v_ratio := 1.0;
  end if;

  if v_ratio >= 1.5 then
    v_tier := 'gold';
  elsif v_ratio >= 1.2 then
    v_tier := 'silver';
  else
    v_tier := 'bronze';
  end if;

  -- Atualiza o array jsonb na meta
  update public.goals
  set
    celebrated_periods = celebrated_periods || to_jsonb(p_period_key),
    updated_at = now()
  where id = p_goal_id and user_id = v_user_id;

  -- Insere no histórico de medalhas (ignora conflito se já existir)
  insert into public.goal_achievements (
    user_id,
    goal_id,
    period_key,
    medal_tier,
    achieved_cents,
    target_cents,
    achieved_at
  )
  values (
    v_user_id,
    p_goal_id,
    p_period_key,
    v_tier,
    p_achieved_cents,
    p_target_cents,
    now()
  )
  on conflict (user_id, goal_id, period_key) do nothing;

  return true;
end;
$$;

-- 5. Seed inicial de metas gerais caso o usuário não tenha nenhuma
create or replace function public.ensure_my_goals()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_count integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return;
  end if;

  select count(*) into v_count
  from public.goals
  where user_id = v_user_id and archived = false;

  if v_count = 0 then
    insert into public.goals (user_id, title, kind, period, target_cents, income_source_id)
    values
      (v_user_id, 'Meta de Ganho Diário', 'earning', 'daily', 15000, null),
      (v_user_id, 'Limite de Gastos Semanal', 'expense_limit', 'weekly', 35000, null),
      (v_user_id, 'Economia Mensal', 'saving', 'monthly', 100000, null);
  end if;
end;
$$;

-- Permissões
grant select, insert, update, delete on public.goals to authenticated;
grant select, insert, update, delete on public.goal_achievements to authenticated;
grant execute on function public.record_goal_celebration(uuid, text, bigint, bigint) to authenticated;
grant execute on function public.ensure_my_goals() to authenticated;

