import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Send, Save, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { BotNotificationConfig, getBotNotificationConfig, updateBotNotificationConfig, sendTelegramTestMessage, sendZaloTestMessage } from '@/src/services/botNotificationService';
import { useAuth } from '@/src/contexts/AuthContext';

export function NotificationSettings() {
  const { user } = useAuth();
  const [config, setConfig] = React.useState<BotNotificationConfig>({
    telegram: { botToken: '', chatId: '', isActive: true, groups: { customers: '', measurements: '', production: '', design: '' } },
    zalo: { botToken: '', chatId: '', isActive: true, groups: { customers: '', measurements: '', production: '', design: '' } },
    updatedAt: new Date().toISOString()
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isTestingTelegram, setIsTestingTelegram] = React.useState(false);
  const [isTestingZalo, setIsTestingZalo] = React.useState(false);

  React.useEffect(() => {
    const loadConfig = async () => {
      try {
        const data = await getBotNotificationConfig();
        if (data) {
          setConfig(prev => ({
            ...prev,
            ...data,
            telegram: { 
              ...prev.telegram, 
              ...data.telegram,
              groups: { ...prev.telegram?.groups, ...data.telegram?.groups }
            },
            zalo: { 
              ...prev.zalo, 
              ...data.zalo,
              groups: { ...prev.zalo?.groups, ...data.zalo?.groups }
            }
          }));
        }
      } catch (error) {
        toast.error("Không thể tải cấu hình bot");
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
  }, []);

  const handleSave = async (type: 'telegram' | 'zalo') => {
    setIsSaving(true);
    try {
      await updateBotNotificationConfig({
        [type]: config[type]
      }, user?.email || undefined);
      toast.success(`Đã lưu cấu hình ${type === 'telegram' ? 'Telegram' : 'Zalo'} Bot`);
    } catch (error) {
      toast.error(`Lỗi khi lưu cấu hình ${type}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!config.telegram?.botToken || !config.telegram?.chatId) {
      toast.error("Vui lòng nhập đầy đủ Token và Chat ID trước khi test");
      return;
    }
    setIsTestingTelegram(true);
    try {
      await sendTelegramTestMessage(config.telegram.botToken, config.telegram.chatId);
      toast.success("Đã gửi tin nhắn test qua Telegram thành công!");
    } catch (error: any) {
      toast.error("Lỗi gửi tin nhắn: " + (error.message || 'Kiểm tra lại Token/Chat ID'));
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleTestZalo = async () => {
    if (!config.zalo?.botToken || !config.zalo?.chatId) {
      toast.error("Vui lòng nhập đầy đủ Token và Chat ID trước khi test");
      return;
    }
    setIsTestingZalo(true);
    try {
      await sendZaloTestMessage(config.zalo.botToken, config.zalo.chatId);
      toast.success("Đã gửi tin nhắn test qua Zalo thành công!");
    } catch (error: any) {
      toast.error("Lỗi gửi tin nhắn Zalo: " + (error.message || 'Kiểm tra lại Token/Chat ID'));
    } finally {
      setIsTestingZalo(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in zoom-in-95 duration-300">
      
      {/* Telegram Bot Settings */}
      <Card className="border-blue-100 shadow-sm overflow-hidden">
        <CardHeader className="bg-blue-50/50 border-b border-blue-50 p-4 pb-3 md:p-6 md:pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg text-blue-900">Cài đặt Telegram Bot</CardTitle>
              <CardDescription className="text-blue-700/70">Gửi thông báo công việc tự động qua Telegram</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 space-y-4 md:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="telegram-token" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bot Token</Label>
              <Input
                id="telegram-token"
                placeholder="Nhập Bot Token từ @BotFather"
                value={config.telegram?.botToken || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, telegram: { ...prev.telegram, botToken: e.target.value } }))}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telegram-chat-id" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Chat ID Mặc định</Label>
              <Input
                id="telegram-chat-id"
                placeholder="Ví dụ: -100123456789"
                value={config.telegram?.chatId || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, telegram: { ...prev.telegram, chatId: e.target.value } }))}
                className="font-mono text-sm"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 mt-2 space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phân bổ thông báo theo nhóm Telegram (Tùy chọn)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="telegram-group-customers" className="text-xs text-slate-500 font-medium">Nhóm 1: Data Khách Hàng</Label>
                <Input
                  id="telegram-group-customers"
                  placeholder="ID nhóm chat Data Khách Hàng"
                  value={config.telegram?.groups?.customers || ''}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    telegram: {
                      ...prev.telegram!,
                      groups: { ...prev.telegram?.groups, customers: e.target.value }
                    }
                  }))}
                  className="font-mono text-xs h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="telegram-group-measurements" className="text-xs text-slate-500 font-medium">Nhóm 2: Lịch Đo Đạc</Label>
                <Input
                  id="telegram-group-measurements"
                  placeholder="ID nhóm chat Lịch Đo Đạc"
                  value={config.telegram?.groups?.measurements || ''}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    telegram: {
                      ...prev.telegram!,
                      groups: { ...prev.telegram?.groups, measurements: e.target.value }
                    }
                  }))}
                  className="font-mono text-xs h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="telegram-group-production" className="text-xs text-slate-500 font-medium">Nhóm 3: Lịch Sản Xuất</Label>
                <Input
                  id="telegram-group-production"
                  placeholder="ID nhóm chat Lịch Sản Xuất"
                  value={config.telegram?.groups?.production || ''}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    telegram: {
                      ...prev.telegram!,
                      groups: { ...prev.telegram?.groups, production: e.target.value }
                    }
                  }))}
                  className="font-mono text-xs h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="telegram-group-design" className="text-xs text-slate-500 font-medium">Nhóm 4: Thiết Kế</Label>
                <Input
                  id="telegram-group-design"
                  placeholder="ID nhóm chat Thiết Kế"
                  value={config.telegram?.groups?.design || ''}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    telegram: {
                      ...prev.telegram!,
                      groups: { ...prev.telegram?.groups, design: e.target.value }
                    }
                  }))}
                  className="font-mono text-xs h-9"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => handleSave('telegram')} disabled={isSaving} className="w-full sm:w-auto justify-center">
              <Save className="h-4 w-4 mr-2" />
              Lưu Cấu Hinh
            </Button>
            <Button onClick={handleTestTelegram} disabled={isTestingTelegram} className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto justify-center">
              {isTestingTelegram ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Gửi Tin Nhắn Test
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Zalo Bot Settings */}
      <Card className="border-blue-100 shadow-sm overflow-hidden">
        <CardHeader className="bg-blue-50/50 border-b border-blue-50 p-4 pb-3 md:p-6 md:pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg text-blue-900">Cài đặt Zalo Bot Creator</CardTitle>
              <CardDescription className="text-blue-700/70">Gửi tin nhắn thông báo công việc tự động qua Zalo</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 space-y-4 md:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="zalo-token" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Zalo Bot Token (Access Token)</Label>
              <Input
                id="zalo-token"
                placeholder="Nhập Access Token từ Zalo OA"
                value={config.zalo?.botToken || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, zalo: { ...prev.zalo, botToken: e.target.value } }))}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zalo-chat-id" className="text-xs font-bold text-slate-500 uppercase tracking-wider">User ID Zalo Test Mặc định</Label>
              <Input
                id="zalo-chat-id"
                placeholder="Ví dụ: 1234567890123456"
                value={config.zalo?.chatId || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, zalo: { ...prev.zalo, chatId: e.target.value } }))}
                className="font-mono text-sm"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 mt-2 space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phân bổ thông báo theo nhóm Zalo (Tùy chọn)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="zalo-group-customers" className="text-xs text-slate-500 font-medium">Nhóm 1: Data Khách Hàng</Label>
                <Input
                  id="zalo-group-customers"
                  placeholder="ID nhóm Zalo Data Khách Hàng"
                  value={config.zalo?.groups?.customers || ''}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    zalo: {
                      ...prev.zalo!,
                      groups: { ...prev.zalo?.groups, customers: e.target.value }
                    }
                  }))}
                  className="font-mono text-xs h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="zalo-group-measurements" className="text-xs text-slate-500 font-medium">Nhóm 2: Lịch Đo Đạc</Label>
                <Input
                  id="zalo-group-measurements"
                  placeholder="ID nhóm Zalo Lịch Đo Đạc"
                  value={config.zalo?.groups?.measurements || ''}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    zalo: {
                      ...prev.zalo!,
                      groups: { ...prev.zalo?.groups, measurements: e.target.value }
                    }
                  }))}
                  className="font-mono text-xs h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="zalo-group-production" className="text-xs text-slate-500 font-medium">Nhóm 3: Lịch Sản Xuất</Label>
                <Input
                  id="zalo-group-production"
                  placeholder="ID nhóm Zalo Lịch Sản Xuất"
                  value={config.zalo?.groups?.production || ''}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    zalo: {
                      ...prev.zalo!,
                      groups: { ...prev.zalo?.groups, production: e.target.value }
                    }
                  }))}
                  className="font-mono text-xs h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="zalo-group-design" className="text-xs text-slate-500 font-medium">Nhóm 4: Thiết Kế</Label>
                <Input
                  id="zalo-group-design"
                  placeholder="ID nhóm Zalo Thiết Kế"
                  value={config.zalo?.groups?.design || ''}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    zalo: {
                      ...prev.zalo!,
                      groups: { ...prev.zalo?.groups, design: e.target.value }
                    }
                  }))}
                  className="font-mono text-xs h-9"
                />
              </div>
            </div>
          </div>
          
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm p-4 rounded-xl flex gap-3">
             <div className="shrink-0 pt-0.5">⚠️</div>
             <div className="space-y-1">
               <p className="font-semibold">Lưu ý về Zalo API</p>
               <p>Việc gửi tin nhắn qua Zalo yêu cầu ứng dụng phải được duyệt và kết nối Webhook. Nút "Gửi test" dưới đây có thể bị chặn bởi CORS trên trình duyệt hoặc yêu cầu Access Token còn hạn.</p>
             </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => handleSave('zalo')} disabled={isSaving} className="w-full sm:w-auto justify-center">
              <Save className="h-4 w-4 mr-2" />
              Lưu Cấu Hình
            </Button>
            <Button onClick={handleTestZalo} disabled={isTestingZalo} className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto justify-center">
              {isTestingZalo ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Gửi Tin Nhắn Test
            </Button>
          </div>
        </CardContent>
      </Card>
      
    </div>
  );
}
