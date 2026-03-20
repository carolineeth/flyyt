import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/PageHeader";
import { Lock } from "lucide-react";

export default function ChangePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Passordet må være minst 6 tegn");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passordene stemmer ikke overens");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Passordet er oppdatert!");
      setPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Bytt passord" description="Endre passordet til kontoen din" />
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" />
            Nytt passord
          </CardTitle>
          <CardDescription>Skriv inn ditt nye passord nedenfor.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nytt passord</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minst 6 tegn"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Bekreft passord</Label>
              <Input
                id="confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Gjenta passordet"
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Oppdaterer..." : "Oppdater passord"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
