import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type LocationState = {
  from?: Location;
};

const emailRegex = /^\S+@\S+\.\S+$/;

function getLoginErrorMessage(message?: string) {
  if (!message) return "Une erreur est survenue. Réessayez.";
  if (message.toLowerCase().includes("invalid login credentials")) {
    return "Email ou mot de passe incorrect.";
  }
  if (message.toLowerCase().includes("email not confirmed")) {
    return "Votre email n'est pas confirmé. Vérifiez votre boîte mail.";
  }
  return message;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, loading } = useAuth();

  const redirectPath = useMemo(() => {
    const state = location.state as LocationState | null;
    return state?.from?.pathname ?? "/";
  }, [location.state]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate(redirectPath, { replace: true });
    }
  }, [isAuthenticated, loading, navigate, redirectPath]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!emailRegex.test(email)) {
      setError("Merci d'entrer une adresse email valide.");
      return;
    }

    if (!password) {
      setError("Merci d'entrer votre mot de passe.");
      return;
    }

    setSubmitting(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(getLoginErrorMessage(signInError.message));
        return;
      }

      const { data, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !data.session?.access_token) {
        setError("Connexion réussie, mais la session est introuvable.");
        return;
      }

      setSuccess("Connexion réussie. Redirection en cours...");
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setError(getLoginErrorMessage(err instanceof Error ? err.message : undefined));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-8 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Radio className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Connexion</h1>
            <p className="text-sm text-muted-foreground">
              Accédez aux stations et à votre session Supabase.
            </p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="password">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Connexion...
              </>
            ) : (
              "Se connecter"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
