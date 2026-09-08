// Supabase Edge Function: send-invoice-email (Deno)
// Dispatches emails with PDF attachments via Gmail SMTP (smtp.gmail.com)

// @ts-ignore - Handled by Deno runtime in Supabase Edge Functions
import nodemailer from "npm:nodemailer@6.9.16";

// Ambient declaration for Deno globals
declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  // Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const {
      smtpUser: payloadUser,
      smtpPass: payloadPass,
      to,
      subject,
      html,
      text,
      attachments = [],
      fromName = "Intersys BMS Billing",
    } = payload;

    const user = payloadUser || Deno.env.get("GMAIL_USER");
    const pass = (payloadPass || Deno.env.get("GMAIL_APP_PASSWORD") || "").replace(/\s+/g, "");

    if (!user || !pass) {
      return new Response(
        JSON.stringify({
          error: "Missing Gmail credentials. Please configure your Gmail address and 16-character Google App Password in Settings.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!to || !subject) {
      return new Response(
        JSON.stringify({ error: "Missing recipient 'to' or 'subject' field." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create SMTP Transporter for Gmail SSL
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: user.trim(),
        pass: pass.trim(),
      },
    });

    // Format attachments (Base64 PDF and inline images)
    const formattedAttachments = attachments.map((att: any) => ({
      filename: att.filename || "Utility_Invoice.pdf",
      content: att.content,
      encoding: att.encoding || "base64",
      contentType: att.contentType || "application/pdf",
      cid: att.cid,
    }));

    // Send Mail
    const info = await transporter.sendMail({
      from: `"${fromName}" <${user.trim()}>`,
      to: Array.isArray(to) ? to.join(", ") : to,
      subject: subject,
      text: text || "",
      html: html || undefined,
      attachments: formattedAttachments,
    });

    return new Response(
      JSON.stringify({
        success: true,
        messageId: info.messageId,
        recipient: to,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("Error sending email via Gmail SMTP:", err);
    return new Response(
      JSON.stringify({
        error: err.message || "Failed to send email via Gmail SMTP.",
        details: err.code || err.name,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
