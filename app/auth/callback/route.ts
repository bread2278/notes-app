import { NextResponse, type NextRequest } from "next/server";
import { logDevError } from "@/lib/errors";
import { oauthCallbackSchema } from "@/lib/validation";
import { createClient } from "@/lib/supabase/server";

// OAuth callback. After the user approves on GitHub, Supabase redirects here
// with a one-time `code`. We exchange it for a session (stored in cookies),
// then send the user back to the single page.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  // Always redirect to our own home page (never to a URL from the query string).
  const home = new URL("/", origin);

  // Failures only send a short code back to the page (?auth_error=github),
  // which shows a friendly message. Details are logged in development only.

  // Validate the query string before using any of it.
  const parsed = oauthCallbackSchema.safeParse({
    code: searchParams.get("code") ?? undefined,
    error: searchParams.get("error") ?? undefined,
    error_description: searchParams.get("error_description") ?? undefined,
  });
  if (!parsed.success) {
    logDevError("GitHub OAuth callback: invalid query string", parsed.error);
    home.searchParams.set("auth_error", "github");
    return NextResponse.redirect(home);
  }
  const { code } = parsed.data;

  // The provider or Supabase can send an error instead of a code,
  // e.g. when the user clicks "Cancel" on GitHub.
  const providerError = parsed.data.error_description ?? parsed.data.error;
  if (providerError) {
    logDevError("GitHub OAuth callback: provider error", new Error(providerError));
    home.searchParams.set("auth_error", "github");
    return NextResponse.redirect(home);
  }

  if (!code) {
    logDevError("GitHub OAuth callback: missing code", new Error("No ?code= in callback URL"));
    home.searchParams.set("auth_error", "github");
    return NextResponse.redirect(home);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    logDevError("GitHub OAuth callback: code exchange", error);
    home.searchParams.set("auth_error", "github");
  }
  return NextResponse.redirect(home);
}
