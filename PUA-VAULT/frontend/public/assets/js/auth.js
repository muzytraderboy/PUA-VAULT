async function handleLogin(event) {
    event.preventDefault();
    const email = event.target.email.value;
    const password = event.target.password.value;
    const submitBtn = event.target.querySelector('button[type="submit"]');

    submitBtn.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i> Signing In...';
    submitBtn.disabled = true;

    try {
        const { data, error } = await client.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) throw error;

        if (!data?.user?.id) {
            throw new Error('Login succeeded, but no user profile was returned.');
        }

        const { data: profile, error: profileError } = await client.from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .maybeSingle();

        if (profileError) throw profileError;

        if (!profile || profile.role !== 'admin') {
            await client.auth.signOut();
            showToast('Access denied. Only admins can login.', 'error');
            submitBtn.innerHTML = 'Sign In <i class="ph-bold ph-arrow-right"></i>';
            submitBtn.disabled = false;
            return;
        }

        window.location.href = 'admin.html';
    } catch (error) {
        const message = error?.message === 'Failed to fetch'
            ? 'Unable to reach the authentication server. Check your connection and Supabase settings.'
            : (error?.message || 'Unknown error');
        showToast('Login failed: ' + message, 'error');
        submitBtn.innerHTML = 'Sign In <i class="ph-bold ph-arrow-right"></i>';
        submitBtn.disabled = false;
    }
}

async function handleLogout() {
    await client.auth.signOut();
    window.location.href = 'login.html';
}

async function requireAuth() {
    const { data: { session } } = await client.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return null;
    }
    return session;
}

async function requireRole(allowedRoles) {
    const session = await requireAuth();
    if (!session) return null;

    const { data: profile, error } = await client.from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();

    if (error) {
        showToast(error.message, 'error');
        window.location.href = 'login.html';
        return null;
    }

    if (!profile || !allowedRoles.includes(profile.role)) {
        showToast('Access denied.', 'error');
        window.location.href = 'admin.html';
        return null;
    }
    return { session, profile };
}

async function checkAdminExists() {
    try {
        const { data, error } = await client.from('profiles')
            .select('id')
            .eq('role', 'admin')
            .limit(1);

        if (error) return false;
        return data && data.length > 0;
    } catch {
        return false;
    }
}
