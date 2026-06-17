import { redirect } from 'next/navigation';

export default function RootPage() {
  // 🟢 强行将所有根目录访问流量引导至 V2 新大厅
  redirect('/v2');
}