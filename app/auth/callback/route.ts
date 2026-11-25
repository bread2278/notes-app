import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// OAuth callback. After the user approves on GitHub, Supabase redirects here
// with a one-time `code`. We exchange it for a session (stored in cookies),
// then send the user back to the single page.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Always redirect to our own home page (never to a URL from the query string).
  const home = new URL("/", origin);

  // The provider or Supabase can send an error instead of a code,
  // e.g. when the user clicks "Cancel" on GitHub.
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError) {
    home.searchParams.set("auth_error", providerError);
    return NextResponse.redirect(home);
  }

  if (!code) {
    home.searchParams.set("auth_error", "Missing sign-in code. Please try again.");
    return NextResponse.redirect(home);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    home.searchParams.set("auth_error", error.message);
  }
  return NextResponse.redirect(home);
}
