<?php

namespace ThePrintTrade\Theme\Forum\Auth;

use Flarum\Forum\Auth\Registration;
use Flarum\Forum\Auth\ResponseFactory as BaseResponseFactory;
use Flarum\User\LoginProvider;
use Flarum\User\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Laminas\Diactoros\Response\RedirectResponse;
use Psr\Http\Message\ResponseInterface;

/**
 * Replaces Flarum core's auth ResponseFactory for two related reasons:
 *
 *   1) Bypass the SignUpModal entirely. fof/oauth's flow goes
 *      OIDC roundtrip → registration_token → SignUpModal → user clicks
 *      "Sign Up" → account created. Under our SSO-only setup the modal
 *      is a UX dead-end: testers (Jake, Dow) hit "Already have an
 *      account? Log In" — which re-triggers OAuth, which re-shows the
 *      modal, which loops. With force_userid/force_email/force_name=1
 *      every required field is already trusted from the OIDC payload,
 *      so we can auto-create the account server-side and skip the modal
 *      entirely.
 *
 *   2) Replace the popup-completion HTML response with a plain
 *      RedirectResponse. Core's makeResponse() returns a
 *      `<script>window.close(); window.opener.app.authenticationComplete(...)`
 *      blob that only works inside a window.open() popup. iOS Safari
 *      opens popups as new tabs where window.opener postMessage
 *      silently fails — breaking the OAuth handoff. Returning a
 *      RedirectResponse to "/" instead works both top-level and (less
 *      relevantly) inside any popup that happens to be open.
 *
 * Combined with a JS monkey-patch in our theme that swaps the
 * LogInButton onclick from window.open() to a top-level
 * window.location.assign(), this kills the popup AND the modal.
 */
class TopLevelResponseFactory extends BaseResponseFactory
{
    public function make(string $provider, string $identifier, callable $configureRegistration): ResponseInterface
    {
        // 1) Existing linked account → log in (unchanged from core).
        if ($user = LoginProvider::logIn($provider, $identifier)) {
            return $this->makeLoggedInResponse($user);
        }

        $configureRegistration($registration = new Registration);
        $provided = $registration->getProvided();

        // 2) Email matches an existing forum user → link + log in
        //    (unchanged from core).
        if (! empty($provided['email'])
            && $user = User::where(Arr::only($provided, 'email'))->first()) {
            $user->loginProviders()->create(compact('provider', 'identifier'));

            return $this->makeLoggedInResponse($user);
        }

        // 3) New user, with username + email both trusted in the OIDC
        //    payload → auto-create + log in. This is the path that
        //    eliminates the SignUpModal loop.
        if (! empty($provided['username']) && ! empty($provided['email'])) {
            // After the 2026-05-16 sub migration, `id_parameter = sub`
            // and fof-oauth's `force_userid = 1` together mean
            // $provided['username'] is now the 32-char Better-Auth
            // `sub` — useless as a human-readable username. Source the
            // real username from the OIDC `preferred_username` claim
            // (which the parent's getAdditionalUserInfoClaim derives
            // from the email local-part), falling back to deriving it
            // ourselves if for any reason the claim is missing.
            $payload = $registration->getPayload();
            $rawUsername = ! empty($payload['preferred_username'])
                ? (string) $payload['preferred_username']
                : $this->deriveUsernameFromEmail($provided['email']);
            $username = $this->ensureUniqueUsername($rawUsername);

            $user = User::register(
                $username,
                $provided['email'],
                // Cryptographically unguessable password — OIDC is the
                // only auth path so nobody (including the user) ever
                // uses it. Store *something* because Flarum's password
                // column is NOT NULL.
                Str::random(64)
            );
            $user->is_email_confirmed = true;

            if (! empty($provided['nickname'])) {
                $user->nickname = $provided['nickname'];
            }

            $user->save();
            $user->loginProviders()->create(compact('provider', 'identifier'));

            return $this->makeLoggedInResponse($user);
        }

        // 4) Fallback: provider didn't trust enough fields to auto-create.
        //    Fall back to core's registration-token flow. The modal will
        //    still appear, but at least the makeResponse() override below
        //    means the response itself is a redirect (so the user lands
        //    somewhere sane rather than on a blank popup-completion page).
        return parent::make($provider, $identifier, $configureRegistration);
    }

    /**
     * Replace core's popup-completion <script> blob with a server-side
     * redirect to the forum root. The remember/session cookies set by
     * makeLoggedInResponse() are attached to *this* response, so the
     * browser carries them through the redirect and the user lands
     * logged in.
     */
    protected function makeResponse(array $payload): ResponseInterface
    {
        return new RedirectResponse('/');
    }

    /**
     * Fallback username derivation if the OIDC `preferred_username` claim
     * is missing. Mirrors the parent site's getAdditionalUserInfoClaim
     * logic so that, in the absence of the claim, both sides converge
     * on the same slug. Defensive only — under normal operation the
     * claim is always present.
     */
    private function deriveUsernameFromEmail(string $email): string
    {
        $local = strtolower((string) strstr($email, '@', true));
        $slug = preg_replace('/[^a-z0-9_.-]/', '', $local) ?? '';
        $slug = substr($slug, 0, 30);

        return $slug !== '' ? $slug : 'user';
    }

    /**
     * If the OIDC `preferred_username` collides with an existing Flarum
     * username (different user than the one we're auto-creating), append
     * a short numeric suffix until unique. Prevents auto-create from
     * 500-ing on rare collisions.
     */
    private function ensureUniqueUsername(string $base): string
    {
        $candidate = $base;
        $i = 0;

        while (User::where('username', $candidate)->exists()) {
            $i++;
            $candidate = $base.$i;

            if ($i > 10) {
                // Pathological case (>10 collisions). Append random
                // tail rather than spinning further.
                $candidate = $base.'-'.Str::lower(Str::random(6));
                break;
            }
        }

        return $candidate;
    }
}
