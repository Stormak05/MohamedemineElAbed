import { Resend } from "resend";

export type EmailConfig = {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
};

const SUBJECTS = {
  "sign-in": "Ton code de connexion à Clausus",
  "email-verification": "Vérifie ton adresse e-mail pour Clausus",
  "forget-password": "Réinitialise ton mot de passe Clausus",
  "change-email": "Confirme ta nouvelle adresse e-mail pour Clausus",
} as const;

export type OtpType = keyof typeof SUBJECTS;

// Sends the one-time code with Resend. Without RESEND_API_KEY (local dev), the code goes to the server logs instead.
export function createOtpSender(config: EmailConfig) {
  const resend = config.RESEND_API_KEY ? new Resend(config.RESEND_API_KEY) : null;
  const from = config.EMAIL_FROM || "Clausus <onboarding@resend.dev>";

  return async ({ email, otp, type }: { email: string; otp: string; type: OtpType }) => {
    if (!resend) {
      console.warn(`[auth] RESEND_API_KEY absent : code ${type} pour ${email} = ${otp}`);
      return;
    }
    const { error } = await resend.emails.send({
      from,
      to: email,
      subject: SUBJECTS[type],
      text: `Ton code : ${otp}\n\nIl expire dans 5 minutes. Si tu n'as rien demandé, ignore cet e-mail.`,
      html: `<p>Ton code :</p><p style="font-size:28px;letter-spacing:6px;font-family:monospace"><b>${otp}</b></p><p>Il expire dans 5 minutes. Si tu n'as rien demandé, ignore cet e-mail.</p>`,
    });
    // Better Auth logs this error and still answers 200 (so nobody can probe which addresses exist): check the API logs.
    if (error)
      throw new Error(
        `[auth] Resend a refusé l'e-mail pour ${email} (${error.name}) : ${error.message}`,
      );
  };
}
