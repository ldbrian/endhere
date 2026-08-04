-- EndHere DB 清理（第一轮）：删除无任何代码引用的 0 行空表 + 遗留 RPC
-- 日期：2026-08-04
-- 背景：代码只使用 visit_logs / fragments / reader_annotations 三张表。
--       以下 13 张表经 grep 全库确认零引用，且当前行数为 0。

-- ════════════════════════════════════════════════════════════════
-- 第一步（必做）：先在 SQL Editor 跑下面的【依赖审计】，确认无活对象依赖它们。
-- 若返回结果中出现了 fragments / visit_logs / reader_annotations 之一，
-- 或出现任何视图/函数/触发器，请先停下，不要执行 DROP。
-- ════════════════════════════════════════════════════════════════
--
-- select 'obj' as kind, pgc.relkind::text || ' ' || pgc.relname as dependent
-- from pg_depend d
-- join pg_class pgc on pgc.oid = d.objid
-- where d.refobjid in (
--   select oid from pg_class
--   where relname in ('comment_configs','daily_questions','hero_feed_items',
--     'item_usage_logs','pledge_contracts','question_options','transactions',
--     'user_achievements','user_calibrations','user_life_tracks','user_mind_tracks',
--     'users','world_registry')
-- )
--   and pgc.relkind in ('v','m','f','p')
--   and pgc.relname not like 'pg_%'
-- union all
-- select 'fk_incoming', conrelid::regclass::text || ' -> ' || confrelid::regclass::text
-- from pg_constraint
-- where contype = 'f'
--   and confrelid::regclass::text in ('comment_configs','daily_questions','hero_feed_items',
--     'item_usage_logs','pledge_contracts','question_options','transactions',
--     'user_achievements','user_calibrations','user_life_tracks','user_mind_tracks',
--     'users','world_registry')
-- union all
-- select 'trigger', tgrelid::regclass::text || ' ' || tgname
-- from pg_trigger
-- where tgenabled <> 'D'
--   and tgrelid::regclass::text in ('comment_configs','daily_questions','hero_feed_items',
--     'item_usage_logs','pledge_contracts','question_options','transactions',
--     'user_achievements','user_calibrations','user_life_tracks','user_mind_tracks',
--     'users','world_registry');

-- ════════════════════════════════════════════════════════════════
-- 第二步：审计确认无误后，执行下面清理。
-- 单条 DROP 多表：Postgres 自动处理这组表之间的 FK 依赖；
-- 若仍有外部对象依赖，会直接报错（而不是连带删除活对象），可安全重跑。
-- ════════════════════════════════════════════════════════════════

drop table if exists
  comment_configs,
  daily_questions,
  hero_feed_items,
  item_usage_logs,
  pledge_contracts,
  question_options,
  transactions,
  user_achievements,
  user_calibrations,
  user_life_tracks,
  user_mind_tracks,
  users,
  world_registry;

-- 遗留 RPC：process_world_tick（world 旧系统函数，无签名假设）
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'process_world_tick'
  loop
    execute format('drop function %s', r.sig);
    raise notice 'dropped function %', r.sig;
  end loop;
end $$;
