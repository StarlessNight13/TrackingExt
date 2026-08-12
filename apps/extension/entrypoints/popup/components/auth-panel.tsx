import { useEffect, useState, useTransition } from "react";

import { validateLoginId, validatePassword } from "@/lib/auth-credentials";
import { getAuthConfig } from "@/lib/auth-config";
import { sendMessage, type PopupSnapshot } from "@/lib/messaging";
import {
  clearRememberedUser,
  getInitials,
  loadRememberedUser,
  type RememberedUser,
} from "@/lib/remembered-user";

import { M3Button, M3Spinner } from "./m3-button";
import { IconEye, IconLock, IconUser, M3TextField } from "./m3-text-field";

function openDashboard(serverUrl: string, path = "/login") {
  void browser.tabs.create({ url: new URL(path, `${serverUrl}/`).toString() });
}

function SignInForm({
  snapshot,
  allowSignUp,
  onDone,
}: {
  snapshot: PopupSnapshot;
  allowSignUp: boolean;
  onDone: (snapshot: PopupSnapshot) => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loginId, setLoginId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginIdError, setLoginIdError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    const idValue = mode === "signup" ? email : loginId;
    const idErr = mode === "signup" ? validateLoginId(email, true) : validateLoginId(loginId, allowSignUp);
    const passErr = validatePassword(password);

    setLoginIdError(idErr);
    setPasswordError(passErr);
    if (idErr || passErr || (mode === "signup" && !name.trim())) {
      return;
    }

    startTransition(async () => {
      const res =
        mode === "signin"
          ? await sendMessage({
              type: "SIGN_IN",
              loginId: idValue.trim(),
              password,
              rememberMe: true,
            })
          : await sendMessage({ type: "SIGN_UP", name: name.trim(), email: email.trim(), password });

      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.snapshot) onDone(res.snapshot);
    });
  };

  return (
    <div className="auth-stack">
      {mode === "signup" ? (
        <M3TextField
          label="Username"
          value={name}
          onChange={setName}
          autoComplete="username"
          icon={<IconUser />}
        />
      ) : null}

      <M3TextField
        label={mode === "signup" ? "Email" : allowSignUp ? "Username or email" : "Username"}
        value={mode === "signup" ? email : loginId}
        onChange={mode === "signup" ? setEmail : setLoginId}
        autoComplete={mode === "signup" ? "email" : "username"}
        icon={<IconUser />}
        error={loginIdError ?? undefined}
      />

      <M3TextField
        label="Password"
        type={showPassword ? "text" : "password"}
        value={password}
        onChange={setPassword}
        autoComplete={mode === "signin" ? "current-password" : "new-password"}
        icon={<IconLock />}
        error={passwordError ?? undefined}
        endAction={{
          label: showPassword ? "Hide password" : "Show password",
          icon: <IconEye open={showPassword} />,
          onClick: () => setShowPassword((current) => !current),
        }}
      />

      {error ? <p className="m3-banner m3-banner--error">{error}</p> : null}

      <M3Button block disabled={pending} onClick={submit}>
        {pending ? (
          <>
            <M3Spinner /> Working…
          </>
        ) : mode === "signin" ? (
          "Sign in"
        ) : (
          "Create account"
        )}
      </M3Button>

      {allowSignUp ? (
        <M3Button variant="text" block onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </M3Button>
      ) : null}

      <M3Button variant="text" block onClick={() => openDashboard(snapshot.serverUrl!, "/login")}>
        Open dashboard
      </M3Button>
    </div>
  );
}

function WelcomeBackForm({
  snapshot,
  user,
  allowSignUp,
  onDone,
  onSwitchAccount,
}: {
  snapshot: PopupSnapshot;
  user: RememberedUser;
  allowSignUp: boolean;
  onDone: (snapshot: PopupSnapshot) => void;
  onSwitchAccount: () => void;
}) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const subtitle = [user.email, user.username?.toUpperCase()].filter(Boolean).join(" • ");

  const submit = () => {
    setError(null);
    const passErr = validatePassword(password);
    setPasswordError(passErr);
    if (passErr) return;

    startTransition(async () => {
      const res = await sendMessage({
        type: "SIGN_IN",
        loginId: user.loginId,
        password,
        rememberMe: true,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.snapshot) onDone(res.snapshot);
    });
  };

  return (
    <div className="auth-stack">
      <div className="auth-welcome">
        <span className="auth-welcome__badge">Welcome back</span>
        <div className="auth-welcome__avatar">{getInitials(user.displayName)}</div>
        <div className="auth-welcome__meta">
          <strong>{user.displayName}</strong>
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
      </div>

      <M3TextField
        label="Password"
        type={showPassword ? "text" : "password"}
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        icon={<IconLock />}
        error={passwordError ?? undefined}
        endAction={{
          label: showPassword ? "Hide password" : "Show password",
          icon: <IconEye open={showPassword} />,
          onClick: () => setShowPassword((current) => !current),
        }}
      />

      {error ? <p className="m3-banner m3-banner--error">{error}</p> : null}

      <M3Button block disabled={pending} onClick={submit}>
        {pending ? (
          <>
            <M3Spinner /> Unlocking…
          </>
        ) : (
          "Unlock extension"
        )}
      </M3Button>

      <div className="auth-row-end">
        <button type="button" className="m3-link" onClick={onSwitchAccount}>
          Switch account
        </button>
      </div>

      {!allowSignUp ? null : (
        <M3Button variant="text" block onClick={() => openDashboard(snapshot.serverUrl!, "/login")}>
          Open dashboard
        </M3Button>
      )}
    </div>
  );
}

export function AuthPanel({
  snapshot,
  onDone,
  embedded = false,
}: {
  snapshot: PopupSnapshot;
  onDone: (snapshot: PopupSnapshot) => void;
  embedded?: boolean;
}) {
  const [allowSignUp, setAllowSignUp] = useState(true);
  const [rememberedUser, setRememberedUser] = useState<RememberedUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getAuthConfig()
      .then((config) => {
        if (!cancelled) setAllowSignUp(config.allowSignUp);
      })
      .catch(() => {
        if (!cancelled) setAllowSignUp(true);
      });
    return () => {
      cancelled = true;
    };
  }, [snapshot.serverUrl]);

  useEffect(() => {
    let cancelled = false;
    void loadRememberedUser().then((user) => {
      if (!cancelled) {
        setRememberedUser(user);
        setLoadingUser(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const switchAccount = () => {
    void clearRememberedUser().then(() => setRememberedUser(null));
  };

  return (
    <div className={embedded ? "stack" : "stack"}>
      {embedded ? (
        <p className="muted" style={{ margin: 0 }}>
          Sign in with your TrackingExt account to enable server sync.
        </p>
      ) : (
        <>
          <div className="brand">
            <h1>TrackingExt</h1>
            <span className="meta">Extension</span>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            Sign in to sync tracked activities across browsers.
          </p>
        </>
      )}
      <p className="muted endpoint" style={{ margin: 0 }}>
        {snapshot.serverUrl}
      </p>

      <div className="panel auth-panel">
        {loadingUser ? (
          <div className="empty">Loading…</div>
        ) : rememberedUser ? (
          <WelcomeBackForm
            snapshot={snapshot}
            user={rememberedUser}
            allowSignUp={allowSignUp}
            onDone={onDone}
            onSwitchAccount={switchAccount}
          />
        ) : (
          <SignInForm snapshot={snapshot} allowSignUp={allowSignUp} onDone={onDone} />
        )}
      </div>
    </div>
  );
}
