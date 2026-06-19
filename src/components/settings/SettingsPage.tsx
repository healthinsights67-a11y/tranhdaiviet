import * as React from 'react';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Building2 } from 'lucide-react';

export function SettingsPage() {
  return (
    <div className="h-full flex flex-col p-6 space-y-6 overflow-hidden">
      <div className="flex flex-col gap-1 shrink-0">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Cài đặt</h1>
        <p className="text-slate-500 text-sm">Quản lý tài khoản và thông tin công ty của bạn.</p>
      </div>

      <Tabs defaultValue="profile" className="flex-1 flex flex-col min-h-0">
        <TabsList className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 h-auto shrink-0 w-fit">
          <TabsTrigger 
            value="profile" 
            className="rounded-lg data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm px-4 py-2 text-sm font-semibold flex items-center gap-2"
          >
            <User className="h-4 w-4" />
            Hồ sơ cá nhân
          </TabsTrigger>
          <TabsTrigger 
            value="company" 
            className="rounded-lg data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm px-4 py-2 text-sm font-semibold flex items-center gap-2"
          >
            <Building2 className="h-4 w-4" />
            Thông tin công ty
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto pt-6 min-h-0">
          <TabsContent value="profile" className="m-0 h-full">
            <div className="flex items-center justify-center h-[400px] bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
              <p className="text-slate-500">Chức năng "Hồ sơ cá nhân" đang được phát triển.</p>
            </div>
          </TabsContent>

          <TabsContent value="company" className="m-0 h-full">
            <div className="flex items-center justify-center h-[400px] bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
              <p className="text-slate-500">Chức năng "Thông tin công ty" đang được phát triển.</p>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
