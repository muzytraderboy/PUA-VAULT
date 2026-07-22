const ANONYMOUS_ID_KEY = 'pua-vault-anonymous-identity';

function getAnonymousIdentity() {
    let identity = localStorage.getItem(ANONYMOUS_ID_KEY);
    if (!identity) {
        identity = crypto.randomUUID();
        localStorage.setItem(ANONYMOUS_ID_KEY, identity);
    }
    return identity;
}
