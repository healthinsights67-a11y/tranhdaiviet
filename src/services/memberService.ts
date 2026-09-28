import { z } from 'zod';
import { db, collection, addDoc, doc, setDoc, updateDoc, query, where, getDocs, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { Member, MemberPermissions } from '@/src/types';
import { authService } from './authService';
import { moveToTrash } from './trashService';

export const MemberPermissionsSchema = z.custom<MemberPermissions>((val) => typeof val === 'object' && val !== null);

export const CreateMemberSchema = z.object({
  name: z.string().trim().min(2, "Họ và tên phải có ít nhất 2 ký tự"),
  email: z.string().trim().toLowerCase().email("Địa chỉ email không đúng định dạng"),
  role: z.string().min(1, "Vui lòng chọn chức vụ"),
  workshop: z.string().default('all'),
  avatar: z.string().optional().default(''),
  zaloUserId: z.string().optional().default(''),
  permissions: MemberPermissionsSchema,
  password: z.string().optional(),
}).refine(data => {
  if (data.password && data.password.trim() !== '') {
    return data.password.trim().length >= 6;
  }
  return true;
}, {
  message: "Mật khẩu khởi tạo phải có ít nhất 6 ký tự",
  path: ["password"],
});

export const UpdateMemberSchema = z.object({
  name: z.string().trim().min(2, "Họ và tên phải có ít nhất 2 ký tự"),
  email: z.string().trim().toLowerCase().email("Địa chỉ email không đúng định dạng"),
  role: z.string().min(1, "Vui lòng chọn chức vụ"),
  workshop: z.string().default('all'),
  avatar: z.string().optional().default(''),
  zaloUserId: z.string().optional().default(''),
  permissions: MemberPermissionsSchema,
});

export type CreateMemberInput = z.infer<typeof CreateMemberSchema>;
export type UpdateMemberInput = z.infer<typeof UpdateMemberSchema>;

export const memberService = {
  /**
   * Thêm nhân sự mới kèm tuỳ chọn khởi tạo tài khoản đăng nhập Firebase Auth
   */
  async addMember(data: CreateMemberInput, existingMembers: Member[] = [], currentUserEmail: string = ''): Promise<{ member: Member; accountCreated: boolean }> {
    // 1. Validate với Zod
    const validated = CreateMemberSchema.parse(data);

    // 2. Kiểm tra trùng lặp email trong danh sách nhân sự
    const isDuplicate = existingMembers.some(
      m => m.email?.trim().toLowerCase() === validated.email
    );
    if (isDuplicate) {
      throw new Error(`Email "${validated.email}" đã tồn tại trong danh sách nhân sự.`);
    }

    // 3. Khởi tạo tài khoản đăng nhập nếu có mật khẩu
    let accountCreated = false;
    if (validated.password && validated.password.trim().length >= 6) {
      try {
        await authService.createStaffAccount(
          validated.email,
          validated.password.trim(),
          validated.name,
          validated.role
        );
        accountCreated = true;
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-in-use') {
          // Email đã có tài khoản trên Auth -> Kích hoạt duyệt tài khoản trong users
          try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', validated.email));
            const snap = await getDocs(q);
            if (!snap.empty) {
              await updateDoc(snap.docs[0].ref, { status: 'approved' });
            }
          } catch (e) {
            console.warn("Could not auto-approve existing user document", e);
          }
        } else {
          throw new Error(`Lỗi khi tạo tài khoản đăng nhập: ${authError.message || authError}`);
        }
      }
    }

    // 4. Lưu bản ghi nhân sự vào Firestore collection 'members'
    const memberData = {
      name: validated.name,
      email: validated.email,
      role: validated.role,
      workshop: validated.workshop || 'all',
      avatar: validated.avatar || `https://i.pravatar.cc/150?u=${validated.email}`,
      zaloUserId: validated.zaloUserId || '',
      permissions: validated.permissions,
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, 'members'), memberData);
    const newMember: Member = {
      id: docRef.id,
      name: validated.name,
      email: validated.email,
      role: validated.role,
      workshop: validated.workshop || 'all',
      avatar: validated.avatar || `https://i.pravatar.cc/150?u=${validated.email}`,
      zaloUserId: validated.zaloUserId || '',
      permissions: validated.permissions as MemberPermissions,
    };

    return { member: newMember, accountCreated };
  },

  /**
   * Cập nhật thông tin nhân sự
   */
  async updateMember(memberId: string, data: UpdateMemberInput): Promise<void> {
    const validated = UpdateMemberSchema.parse(data);

    const updatePayload = {
      name: validated.name,
      email: validated.email,
      role: validated.role,
      workshop: validated.workshop || 'all',
      avatar: validated.avatar || '',
      zaloUserId: validated.zaloUserId || '',
      permissions: validated.permissions,
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'members', memberId), updatePayload, { merge: true });

    // Đồng bộ tên hiển thị nếu có trong users collection
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', validated.email));
      const snap = await getDocs(q);
      snap.forEach(d => {
        updateDoc(d.ref, { displayName: validated.name });
      });
    } catch (e) {
      console.warn("Could not sync user display name", e);
    }
  },

  /**
   * Xóa nhân sự: Di chuyển vào Thùng rác và vô hiệu hóa tài khoản đăng nhập
   */
  async deleteMember(member: Member, currentUserEmail: string = ''): Promise<void> {
    if (!member || !member.id) {
      throw new Error("Thông tin nhân sự không hợp lệ để xóa.");
    }

    // 1. Chuyển vào thùng rác
    const title = `Nhân sự: ${member.name} (${member.email})`;
    await moveToTrash('members', member.id, title, currentUserEmail);

    // 2. Vô hiệu hóa tài khoản đăng nhập trong collection 'users'
    if (member.email) {
      await authService.disableUserByEmail(member.email);
    }
  },

  /**
   * Gửi link đặt lại mật khẩu qua email từ Firebase Auth
   */
  async sendPasswordResetLink(email: string): Promise<void> {
    const cleanEmail = z.string().trim().toLowerCase().email("Email không hợp lệ").parse(email);
    await authService.sendPasswordReset(cleanEmail);
  },

  /**
   * Cấp tài khoản mới hoặc đặt mật khẩu ban đầu cho nhân sự chưa có tài khoản
   */
  async createAccountForMember(member: Member, password: string): Promise<void> {
    if (!password || password.trim().length < 6) {
      throw new Error("Mật khẩu phải có ít nhất 6 ký tự.");
    }
    const cleanEmail = z.string().trim().toLowerCase().email().parse(member.email);
    await authService.createStaffAccount(cleanEmail, password.trim(), member.name, member.role);
  }
};
