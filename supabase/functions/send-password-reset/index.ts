import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: PasswordResetRequest = await req.json();

    console.log("Password reset requested for:", email);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user exists
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    const userExists = users?.users.some(user => user.email === email);

    if (!userExists) {
      // Don't reveal if user exists or not for security
      console.log("Password reset requested for non-existent user:", email);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    // Generate password reset link using Supabase
    const resetUrl = "https://threads-genius-ai.lovable.app/auth/reset-password";
    
    const { error: resetError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: resetUrl,
      }
    });

    if (resetError) {
      console.error("Error generating reset link:", resetError);
      throw new Error("パスワードリセットリンクの生成に失敗しました");
    }

    // Send email with Resend
    const emailResponse = await resend.emails.send({
      from: "Threads-Genius AI <noreply@threads-genius-ai.lovable.app>",
      to: [email],
      subject: "パスワードリセットのご案内",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
            Threads-Genius AI
          </h1>
          
          <h2 style="color: #555;">パスワードリセットのご案内</h2>
          
          <p>お客様のアカウントでパスワードリセットがリクエストされました。</p>
          
          <div style="background-color: #f8f9fa; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0;">
            <p><strong>重要:</strong> このリンクは15分間のみ有効です。</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;
                      font-weight: bold;">
              パスワードをリセット
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            このメールに心当たりがない場合は、このメールを無視してください。
            あなたのアカウントは安全に保たれています。
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            このメールは Threads-Genius AI から送信されました。<br/>
            ご不明な点がございましたら、サポートまでお問い合わせください。
          </p>
        </div>
      `,
    });

    console.log("Password reset email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-password-reset function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "パスワードリセットメールの送信に失敗しました" 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);