import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { JawdaLogo } from "@/components/brand/logo";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [{ title: "Redefinir senha — Jáwda" }],
  }),
  component: ResetPasswordPage,
});

const schema = z
  .object({
    password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres"),
    confirmPassword: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });
type FormValues = z.infer<typeof schema>;

// Item 1 da ABA 11: rota para onde o beforeLoad de __root.tsx redireciona
// sem exceção enquanto profiles.must_reset_password = true. Não tem link de
// "cancelar" nem sidebar — a única saída é trocar a senha (ou sair).
function ResetPasswordPage() {
  const navigate = useNavigate();
  const supabase = getSupabaseBrowserClient();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: values.password,
      });
      if (updateError) {
        toast.error("Não foi possível definir a nova senha", {
          description: updateError.message,
        });
        return;
      }

      const { error: clearError } = await supabase.rpc("clear_must_reset_password");
      if (clearError) {
        toast.error("Senha alterada, mas houve um erro ao liberar o acesso", {
          description: clearError.message,
        });
        return;
      }

      toast.success("Senha redefinida com sucesso");
      navigate({ to: "/" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-brand-soft/50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <JawdaLogo showWordmark={false} size={48} />
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Defina uma nova senha
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Por segurança, você precisa criar uma nova senha antes de continuar.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>A redefinição de senha foi exigida pela administração da sua organização.</span>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Nova senha</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        className="h-10 rounded-lg"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Confirme a nova senha</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        className="h-10 rounded-lg"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={submitting}
                className="mt-2 h-10 w-full rounded-lg bg-brand text-brand-foreground hover:bg-brand/90"
              >
                {submitting ? "Salvando…" : "Salvar nova senha"}
              </Button>
            </form>
          </Form>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-4 w-full text-center text-xs font-medium text-muted-foreground hover:underline"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
