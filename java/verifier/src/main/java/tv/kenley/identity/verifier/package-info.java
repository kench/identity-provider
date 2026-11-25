/**
 * Checks access tokens for our APIs and MCP servers. A token is trusted only if its {@code iss}
 * exactly matches an allowed issuer; its signature, audience and scopes are then checked against
 * that issuer's settings.
 */
package tv.kenley.identity.verifier;
