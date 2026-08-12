import { authClient } from "@/lib/auth-client";
import { isEmail } from "@/lib/auth-credentials";
import {
  buildRememberedUserFromSession,
  saveRememberedUser,
  type RememberedUser,
} from "@/lib/remembered-user";

type SignInInput = {
  loginId: string;
  password: string;
  rememberMe: boolean;
  allowSignUp: boolean;
  signInMethod?: RememberedUser["signInMethod"];
};

type SignInCallbacks = {
  onSuccess: () => void;
  onError: (error: { error: { message?: string; statusText?: string } }) => void;
};

export async function signInWithCredentials(input: SignInInput, callbacks: SignInCallbacks) {
  const useEmail =
    input.signInMethod === "email" ||
    (input.signInMethod === undefined && input.allowSignUp && isEmail(input.loginId));

  const authCallbacks = {
    onSuccess: async () => {
      const session = await authClient.getSession();
      if (session.data?.user) {
        saveRememberedUser(
          buildRememberedUserFromSession({
            loginId: input.loginId,
            signInMethod: useEmail ? "email" : "username",
            user: session.data.user,
          }),
        );
      } else {
        saveRememberedUser({
          loginId: input.loginId,
          signInMethod: useEmail ? "email" : "username",
          displayName: input.loginId,
        });
      }

      callbacks.onSuccess();
    },
    onError: callbacks.onError,
  };

  if (useEmail) {
    await authClient.signIn.email(
      {
        email: input.loginId,
        password: input.password,
        rememberMe: input.rememberMe,
      },
      authCallbacks,
    );
    return;
  }

  await authClient.signIn.username(
    {
      username: input.loginId,
      password: input.password,
      rememberMe: input.rememberMe,
    },
    authCallbacks,
  );
}
