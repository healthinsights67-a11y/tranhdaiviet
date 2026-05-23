const fs = require('fs');
const file = 'src/components/layout/Navbar.tsx';
let content = fs.readFileSync(file, 'utf8');

const replacement = `                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={onLogin} className="hidden sm:inline-flex">Đăng nhập</Button>
            </div>
          )}
        </div>
      </div>
      
      <Dialog open={showPopup} onOpenChange={setShowPopup}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Bạn có {unreadCount} thông báo mới!
            </DialogTitle>
            <DialogDescription>
              Hãy cập nhật các thông báo quan trọng dưới đây.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
             {notifications.filter(n => !(n.readBy || []).includes(currentUserId)).map((n) => (
                <div key={n.id} className="flex flex-col items-start gap-1 p-4 rounded-xl bg-secondary/50 border">
                  <div className="flex items-center justify-between w-full">
                    <span className="font-semibold text-sm">{n.title}</span>
                    <span className="text-[10px] text-muted-foreground">{getRelativeTime(n.createdAt)}</span>
                  </div>
                  <p className="text-xs text-foreground mt-1 leading-relaxed whitespace-pre-wrap">
                    {n.message}
                  </p>
                </div>
              ))}
          </div>
          <DialogFooter className="flex gap-2 sm:gap-0">
             <Button variant="outline" onClick={handleDismissPopup}>Đóng</Button>
             <Button onClick={() => {
               markAllAsRead();
               handleDismissPopup();
             }}>Đã xem tất cả</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}`;

content = content.replace(/                    <\/DropdownMenuLabel>[\s\S]*?<\/header>\s*?\n\s*?\);\s*?\}/, replacement);
fs.writeFileSync(file, content);
console.log('Fixed file.');
