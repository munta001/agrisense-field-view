import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type Target = { user_id: string; email: string | null; full_name: string | null };

export function ResetPasswordDialog({ target, orgId, onClose }: { target: Target | null; orgId?: string; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [askSure, setAskSure] = useState(false);
  const [busy, setBusy] = useState(false);

  const close = () => { setPassword(""); setConfirm(""); setAskSure(false); onClose(); };

  const validate = () => {
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setAskSure(true);
  };

  const reset = async () => {
    if (!target) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("reset-user-password", {
      body: { user_id: target.user_id, org_id: orgId, new_password: password },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      setAskSure(false);
      return toast.error((data as any)?.error || error?.message || "Could not reset password");
    }
    toast.success(`Password reset for ${target.full_name || target.email}`);
    close();
  };

  const name = target?.full_name || target?.email || "this user";

  return (
    <>
      <Dialog open={!!target && !askSure} onOpenChange={o => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>Set a new password for {name}{target?.email ? ` (${target.email})` : ""}. No email is sent — share it with them directly.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>New password</Label>
              <Input type="password" value={password} maxLength={72} onChange={e => setPassword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm password</Label>
              <Input type="password" value={confirm} maxLength={72} onChange={e => setConfirm(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button onClick={validate}>Reset password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={askSure} onOpenChange={o => !o && !busy && setAskSure(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              The password for {name} will be changed immediately. Their old password will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={e => { e.preventDefault(); reset(); }} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Yes, reset password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
