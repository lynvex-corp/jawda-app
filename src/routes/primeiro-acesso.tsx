import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

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
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { JawdaLogo } from "@/components/brand/logo";
import { getSupabaseBrowserClient } from "@/lib/supabase";

// Primeiro acesso de quem chegou via convite (ABA 8, jawda-admin): sessão já
// existe (aal1, criada pelo link de auth.admin.inviteUserByEmail), mas sem
// senha e sem 2FA — nunca passou pelo formulário de e-mail/senha do /login.
// __root.tsx só deixa chegar aqui quando profiles.status = 'invited'
// (getAuthState/needsFirstAccess), então não repetimos essa checagem no
// componente: se a sessão não existir mais, as chamadas abaixo falham com
// erro do Supabase e o usuário vê o toast, sem crash.
export const Route = createFileRoute("/primeiro-acesso")({
  head: () => ({
    meta: [{ title: "Primeiro acesso — Jáwda" }],
  }),
  component: FirstAccessPage,
});

const passwordSchema = z
  .object({
    password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres"),
    confirmPassword: z.string().min(1, "Confirme a senha"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });
type PasswordForm = z.infer<typeof passwordSchema>;

const codeSchema = z.object({
  code: z.string().length(6, "O código tem 6 dígitos"),
});
type CodeForm = z.infer<typeof codeSchema>;

type OrgOption = { org_id: string; legal_name: string; trade_name: string | null };

type Step =
  | { name: "password" }
  | { name: "mfa-enroll"; factorId: string; qrCode: string; secret: string }
  | { name: "select-org"; options: OrgOption[] };

function FirstAccessPage() {
  const navigate = useNavigate();
  const supabase = getSupabaseBrowserClient();
  const [step, setStep] = useState<Step>({ name: "password" });
  const [submitting, setSubmitting] = useState(false);

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const codeForm = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });

  // Espelha finishLogin() de login.tsx — mesma resolução de organização
  // ativa (seção 8 do Guia: usuário pode pertencer a mais de uma empresa),
  // só que chamada ao final do primeiro acesso em vez do login normal.
  async function finishAccess() {
    const { error: completeError } = await supabase.rpc("complete_first_access");
    if (completeError) {
      toast.error("2FA confirmado, mas houve um erro ao liberar o acesso", {
        description: completeError.message,
      });
      return;
    }

    const { data: orgs, error } = await supabase.rpc("list_my_organizations");
    if (error || !orgs || orgs.length === 0) {
      toast.error("Nenhuma empresa associada a este usuário", {
        description: "Fale com o administrador da sua organização.",
      });
      await supabase.auth.signOut();
      navigate({ to: "/login" });
      return;
    }

    void supabase.rpc("touch_last_activity");

    const current = orgs.find((o: { is_current: boolean }) => o.is_current);
    if (current || orgs.length === 1) {
      if (!current) {
        await supabase.rpc("set_active_org", { p_org_id: orgs[0].org_id });
        await supabase.auth.refreshSession();
      }
      navigate({ to: "/" });
      return;
    }

    setStep({ name: "select-org", options: orgs });
  }

  async function onSubmitPassword(values: PasswordForm) {
    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: values.password,
      });
      if (updateError) {
        toast.error("Não foi possível definir a senha", { description: updateError.message });
        return;
      }

      const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Autenticador",
      });
      if (enrollError || !enrollData) {
        toast.error("Erro ao iniciar configuração do 2FA", {
          description: enrollError?.message,
        });
        return;
      }

      setStep({
        name: "mfa-enroll",
        factorId: enrollData.id,
        qrCode: enrollData.totp.qr_code,
        secret: enrollData.totp.secret,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitCode(values: CodeForm, factorId: string) {
    setSubmitting(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError || !challenge) {
        toast.error("Não foi possível gerar o desafio de verificação", {
          description: challengeError?.message,
        });
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: values.code,
      });
      if (verifyError) {
        toast.error("Código inválido", { description: verifyError.message });
        codeForm.resetField("code");
        return;
      }

      await finishAccess();
    } finally {
      setSubmitting(false);
    }
  }

  async function onSelectOrg(orgId: string) {
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("set_active_org", { p_org_id: orgId });
      if (error) {
        toast.error("Não foi possível trocar de empresa", { description: error.message });
        return;
      }
      await supabase.auth.refreshSession();
      navigate({ to: "/" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-brand-soft/50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <JawdaLogo showWordmark={false} size={48} />
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Bem-vindo à Jáwda
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Vamos concluir a configuração da sua conta.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
          {step.name === "password" && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-sm font-semibold text-foreground">Defina sua senha</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Essa será a senha usada para entrar na plataforma daqui pra frente.
                </p>
              </div>
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(onSubmitPassword)} className="space-y-4">
                  <FormField
                    control={passwordForm.control}
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
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Confirme a senha</FormLabel>
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
                    {submitting ? "Salvando…" : "Continuar"}
                  </Button>
                </form>
              </Form>
            </div>
          )}

          {step.name === "mfa-enroll" && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-sm font-semibold text-foreground">
                  Configure a verificação em duas etapas
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Obrigatória para todo acesso à plataforma. Escaneie o QR code com seu aplicativo
                  autenticador (Google Authenticator, Authy…) e informe o código gerado.
                </p>
              </div>
              <div className="flex justify-center rounded-lg border border-border/60 bg-white p-3">
                <img src={step.qrCode} alt="QR code para configurar o 2FA" className="h-40 w-40" />
              </div>
              <div className="rounded-lg bg-muted/50 p-2 text-center">
                <p className="text-[11px] text-muted-foreground">Ou digite manualmente:</p>
                <p className="break-all font-mono text-xs text-foreground">{step.secret}</p>
              </div>
              <Form {...codeForm}>
                <form
                  onSubmit={codeForm.handleSubmit((values) => onSubmitCode(values, step.factorId))}
                  className="space-y-4"
                >
                  <FormField
                    control={codeForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem className="flex flex-col items-center">
                        <FormLabel className="text-xs font-medium">Código de 6 dígitos</FormLabel>
                        <FormControl>
                          <InputOTP maxLength={6} {...field}>
                            <InputOTPGroup>
                              {Array.from({ length: 6 }).map((_, i) => (
                                <InputOTPSlot key={i} index={i} />
                              ))}
                            </InputOTPGroup>
                          </InputOTP>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="h-10 w-full rounded-lg bg-brand text-brand-foreground hover:bg-brand/90"
                  >
                    {submitting ? "Confirmando…" : "Confirmar e entrar"}
                  </Button>
                </form>
              </Form>
            </div>
          )}

          {step.name === "select-org" && (
            <div className="space-y-3">
              <div className="text-center">
                <h2 className="text-sm font-semibold text-foreground">Selecione a empresa</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Você tem acesso a mais de uma organização.
                </p>
              </div>
              <div className="space-y-2">
                {step.options.map((org) => (
                  <button
                    key={org.org_id}
                    type="button"
                    disabled={submitting}
                    onClick={() => onSelectOrg(org.org_id)}
                    className="w-full rounded-lg border border-border/70 p-3 text-left text-sm font-medium text-foreground transition-colors hover:border-brand hover:bg-brand-soft/40 disabled:opacity-50"
                  >
                    {org.trade_name || org.legal_name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          © 2026 Jáwda · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
