
import sys

def replace_in_file(path, target, repl):
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()
    if target in c:
        c = c.replace(target, repl)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(c)
        print(f'Updated {path}')
    else:
        print(f'Not found in {path}')

# InstallationPage
path = 'src/components/installations/InstallationPage.tsx'
t1 = '''  const handleFileUpload = async (schedule: InstallationSchedule, file: File) => {
    setIsUploading(schedule.id);
    const toastId = toast.loading('Ðang t?i ?nh nghi?m thu lên ImgBB...');

    try {
      const newUrl = await uploadToImgBB(file);
      if (!newUrl) {
        toast.dismiss(toastId);
        return;
      }
      
      const updatedUrls = [...(schedule.imageUrls || []), newUrl];
      
      await updateDoc(doc(db, 'installation_schedules', schedule.id), {
        imageUrls: updatedUrls
      });

      toast.dismiss(toastId);
      toast.success('Ðã t?i ?nh lên');
      queryClient.invalidateQueries({ queryKey: ['installation_schedules'] });
    } catch (error) {
      toast.dismiss(toastId);
      toast.error('L?i khi t?i ?nh');
    } finally {
      setIsUploading(null);
    }
  };'''

r1 = '''  const handleFileUpload = async (schedule: InstallationSchedule, files: FileList) => {
    setIsUploading(schedule.id);
    const toastId = toast.loading(Ðang t?i lên  ?nh...);

    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const newUrl = await uploadToImgBB(file);
        if (newUrl) {
          newUrls.push(newUrl);
        }
      }
      
      if (newUrls.length > 0) {
        const updatedUrls = [...(schedule.imageUrls || []), ...newUrls];
        await updateDoc(doc(db, 'installation_schedules', schedule.id), {
          imageUrls: updatedUrls
        });
        toast.dismiss(toastId);
        toast.success(Ðã t?i lên  ?nh);
        queryClient.invalidateQueries({ queryKey: ['installation_schedules'] });
      } else {
        toast.dismiss(toastId);
        toast.error('Không t?i du?c ?nh nào');
      }
    } catch (error) {
      toast.dismiss(toastId);
      toast.error('L?i khi t?i ?nh');
    } finally {
      setIsUploading(null);
    }
  };'''

t2 = '''                                        onChange={(e) => {
                                          if (e.target.files?.length) {
                                            handleFileUpload(schedule, e.target.files[0]);
                                          }
                                        }}'''

r2 = '''                                        multiple
                                        onChange={(e) => {
                                          if (e.target.files?.length) {
                                            handleFileUpload(schedule, e.target.files);
                                            e.target.value = '';
                                          }
                                        }}'''

replace_in_file(path, t1, r1)
replace_in_file(path, t2, r2)

