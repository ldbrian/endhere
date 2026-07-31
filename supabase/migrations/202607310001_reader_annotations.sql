-- EndHere 读者批注
-- 陌生用户翻完书之后的页边批注。匿名 device_id 关联访问行为，不落任何个人身份。
-- 批注被「人」读，不接 AI，不生成回应。

create table if not exists reader_annotations (
  id uuid primary key default gen_random_uuid(),
  device_id text,
  content text not null,
  source_path text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists reader_annotations_created_at_idx on reader_annotations(created_at desc);
create index if not exists reader_annotations_read_at_idx on reader_annotations(read_at);
