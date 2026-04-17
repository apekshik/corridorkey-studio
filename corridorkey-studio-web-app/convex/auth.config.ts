// WorkOS AuthKit access tokens are JWTs signed with RS256, but they do not
// include an `aud` claim — instead they carry `client_id`. Convex's default
// OIDC provider requires `aud`, which would make every request fail.
//
// Using `type: "customJwt"` with `applicationID: null` tells Convex to skip
// the audience check while still verifying the signature (via the WorkOS
// JWKS) and the issuer.
//
// Set WORKOS_ISSUER and WORKOS_CLIENT_ID in the Convex dashboard:
//   npx convex env set WORKOS_ISSUER https://api.workos.com/user_management/<client_id> [--prod]
//   npx convex env set WORKOS_CLIENT_ID client_... [--prod]

export default {
  providers: [
    {
      type: "customJwt",
      applicationID: null,
      issuer: process.env.WORKOS_ISSUER!,
      jwks: `https://api.workos.com/sso/jwks/${process.env.WORKOS_CLIENT_ID}`,
      algorithm: "RS256",
    },
  ],
};
