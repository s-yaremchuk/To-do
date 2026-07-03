/**
 * Generates a cryptographically random code verifier for PKCE.
 * @returns {string}
 */
export function generateCodeVerifier() {
  const array = new Uint8Array(64);
  window.crypto.getRandomValues(array);
  
  // Characters allowed in PKCE code verifier: [A-Z], [a-z], [0-9], "-", ".", "_", "~"
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let verifier = '';
  for (let i = 0; i < array.length; i++) {
    verifier += chars[array[i] % chars.length];
  }
  return verifier;
}

/**
 * Generates a SHA-256 code challenge from a code verifier (Base64URL encoded).
 * @param {string} verifier 
 * @returns {Promise<string>}
 */
export async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  
  const bytes = new Uint8Array(digest);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
