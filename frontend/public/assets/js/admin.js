let currentRole = null;
let currentUserId = null;
let adminProvisioningClient = null;

function getAdminProvisioningClient() {
    if (!adminProvisioningClient) {
        adminProvisioningClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
                detectSessionInUrl: false,
                storageKey: 'pua-vault-admin-provisioning'
            }
        });
    }

    return adminProvisioningClient;
}

document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (!session) return;

    currentUserId = session.user.id;

    const { data: profile, error: profileError } = await client.from('profiles')
        .select('role, first_name, last_name')
        .eq('id', currentUserId)
        .maybeSingle();

    if (profileError || !profile || profile.role !== 'admin') {
        showToast('Access denied.', 'error');
        window.location.href = 'login.html';
        return;
    }

    currentRole = profile.role;
    document.getElementById('user-role-badge').textContent =
        `${profile.first_name} ${profile.last_name} • ${profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}`;

    switchTab('overview');
});

function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('tab-active', 'bg-brand-dark', 'text-white'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.add('text-gray-600', 'hover:bg-gray-100'));

    const content = document.getElementById(`tab-${tab}`);
    if (content) content.classList.remove('hidden');

    const btn = document.querySelector(`[data-tab="${tab}"]`);
    if (btn) {
        btn.classList.remove('text-gray-600', 'hover:bg-gray-100');
        btn.classList.add('tab-active', 'bg-brand-dark', 'text-white');
    }

    if (tab === 'overview') loadOverview();
    else if (tab === 'upload') initUpload();
    else if (tab === 'documents') loadDocumentsTab();
    else if (tab === 'admins') loadAdminsTab();
}

async function loadOverview() {
    try {
        const { data: docs, error } = await client.from('documents')
            .select('*, courses(code)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const totalDocs = docs?.length || 0;
        const totalDownloads = docs?.reduce((s, d) => s + (d.downloads_count || 0), 0) || 0;
        document.getElementById('stat-docs').textContent = totalDocs;
        document.getElementById('stat-downloads').textContent = totalDownloads;

        const { data: admins } = await client.from('profiles')
            .select('id')
            .eq('role', 'admin');
        document.getElementById('stat-admins').textContent = admins?.length || 0;

        const tbody = document.getElementById('recent-table-body');
        if (!docs || docs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-500">No documents uploaded yet.</td></tr>';
            return;
        }

        tbody.innerHTML = docs.slice(0, 10).map(doc => `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4 font-medium text-gray-900">${doc.title}</td>
                <td class="px-6 py-4 text-sm text-gray-600">${doc.courses?.code || 'Unknown'}</td>
                <td class="px-6 py-4 text-sm text-gray-600">${doc.downloads_count || 0}</td>
                <td class="px-6 py-4 text-sm text-gray-500">${new Date(doc.created_at).toLocaleDateString()}</td>
            </tr>
        `).join('');
    } catch (err) {
        console.error(err);
        document.getElementById('stat-docs').textContent = '0';
        document.getElementById('stat-downloads').textContent = '0';
        document.getElementById('stat-admins').textContent = '0';
    }
}

function initUpload() {
    const form = document.getElementById('upload-form');
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const dropzoneText = document.getElementById('dropzone-text');
    const deptSelect = form.department;

    dropzone.onclick = () => fileInput.click();
    fileInput.onchange = () => {
        if (fileInput.files.length > 0) {
            dropzoneText.textContent = `Selected: ${fileInput.files[0].name}`;
        }
    };

    populateDepartments(deptSelect);

    form.onsubmit = async (e) => {
        e.preventDefault();
        const title = form.title.value;
        const courseCode = form.courseCode.value;
        const docType = form.docType.value;
        const year = form.year.value;
        const semester = form.semester.value;
        const file = fileInput.files[0];

        if (!file) { showToast('Please select a PDF file.', 'error'); return; }

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i> Uploading...';
        submitBtn.disabled = true;

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
            const filePath = `${courseCode}/${fileName}`;

            const { error: uploadError } = await client.storage
                .from('documents')
                .upload(filePath, file);
            if (uploadError) throw uploadError;

            const codePrefix = courseCode.split(' ')[0];
            let course;
            const { data: foundCourse, error: courseError } = await client.from('courses')
                .select('id')
                .eq('code', codePrefix)
                .single();

            if (courseError || !foundCourse) {
                const departmentId = deptSelect.value;
                const courseTitle = form.courseTitle.value.trim();

                if (!departmentId || !courseTitle) {
                    throw new Error(`Course "${courseCode}" not found. Select a Department and enter a Course Title to create it.`);
                }

                const parts = courseCode.split(' ');
                const levelNum = parts.length > 1 ? parseInt(parts[1]) : null;
                const courseLevel = levelNum ? Math.floor(levelNum / 100) * 100 : 100;

                const { data: newCourse, error: createError } = await client.from('courses')
                    .insert({
                        code: codePrefix,
                        title: courseTitle,
                        department_id: departmentId,
                        level: courseLevel
                    })
                    .select('id')
                    .single();

                if (createError) throw createError;
                course = newCourse;
            } else {
                course = foundCourse;
            }

            const { error: dbError } = await client.from('documents').insert({
                course_id: course.id,
                uploaded_by: currentUserId,
                type: docType,
                title: title,
                year: year,
                semester: semester,
                file_path: filePath,
                file_size: file.size
            });
            if (dbError) throw dbError;

            showToast('Document uploaded successfully!', 'success');
            form.reset();
            dropzoneText.textContent = 'Click to select PDF';
        } catch (err) {
            showToast('Upload failed: ' + err.message, 'error');
        } finally {
            submitBtn.innerHTML = '<i class="ph-bold ph-upload-simple"></i> Upload Document';
            submitBtn.disabled = false;
        }
    };
}

async function populateDepartments(selectEl) {
    try {
        const { data: departments, error } = await client.from('departments')
            .select('id, name, code')
            .order('name');
        if (error) throw error;

        selectEl.innerHTML = '<option value="">Select department...</option>';
        if (departments) {
            departments.forEach(dept => {
                const opt = document.createElement('option');
                opt.value = dept.id;
                opt.textContent = `${dept.name} (${dept.code})`;
                selectEl.appendChild(opt);
            });
        }
    } catch (err) {
        console.error('Failed to load departments:', err);
    }
}

async function loadDocumentsTab() {
    const tbody = document.getElementById('documents-table-body');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8"><i class="ph-bold ph-spinner animate-spin text-brand-green text-xl"></i></td></tr>';

    try {
        const searchQuery = document.getElementById('doc-search')?.value || '';

        let query = client.from('documents')
            .select('*, courses(code)');

        if (searchQuery) {
            query = query.ilike('title', `%${searchQuery}%`);
        }

        const { data: docs, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;

        if (!docs || docs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500">No documents found.</td></tr>';
            return;
        }

        tbody.innerHTML = docs.map(doc => `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4">
                    <div class="font-medium text-gray-900">${doc.title}</div>
                    <div class="text-xs text-gray-500 mt-1">${(doc.file_size / 1024 / 1024).toFixed(1)} MB</div>
                </td>
                <td class="px-6 py-4"><span class="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">${doc.courses?.code || 'Unknown'}</span></td>
                <td class="px-6 py-4 text-sm text-gray-600 capitalize">${doc.type || 'N/A'}</td>
                <td class="px-6 py-4 text-sm text-gray-600">${doc.downloads_count || 0}</td>
                <td class="px-6 py-4 text-sm text-gray-500">${new Date(doc.created_at).toLocaleDateString()}</td>
                <td class="px-6 py-4 text-right">
                    <button onclick="deleteDocument('${doc.id}')" class="text-gray-400 hover:text-red-500 transition-colors"><i class="ph-bold ph-trash"></i></button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-red-500">${err.message}</td></tr>`;
    }
}

async function deleteDocument(docId) {
    if (!confirm('Delete this document permanently?')) return;
    try {
        const { data: doc, error: fetchError } = await client.from('documents')
            .select('file_path')
            .eq('id', docId)
            .single();
        if (fetchError) throw fetchError;

        if (doc?.file_path) {
            await client.storage.from('documents').remove([doc.file_path]);
        }

        const { error } = await client.from('documents').delete().eq('id', docId);
        if (error) throw error;
        showToast('Document deleted.', 'success');
        loadDocumentsTab();
    } catch (err) {
        showToast('Failed to delete: ' + err.message, 'error');
    }
}

async function loadAdminsTab() {
    if (currentRole !== 'admin') return;

    const tbody = document.getElementById('admins-table-body');
    tbody.innerHTML = '<tr><td colspan="3" class="text-center py-8"><i class="ph-bold ph-spinner animate-spin text-brand-green text-xl"></i></td></tr>';

    try {
        const { data: admins, error } = await client.from('profiles')
            .select('*')
            .eq('role', 'admin')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!admins || admins.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center py-8 text-gray-500">No admins registered yet.</td></tr>';
        } else {
            tbody.innerHTML = admins.map((admin) => `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4 font-medium text-gray-900">${admin.first_name} ${admin.last_name}</td>
                <td class="px-6 py-4 text-sm text-gray-600">${admin.id}</td>
                <td class="px-6 py-4 text-sm text-gray-500">${new Date(admin.created_at).toLocaleDateString()}</td>
            </tr>
        `).join('');
        }
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-red-500">${err.message}</td></tr>`;
    }

    const form = document.getElementById('admin-form');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const firstName = form.firstName.value;
        const lastName = form.lastName.value;
        const email = form.email.value;
        const password = form.password.value;

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i> Creating...';
        submitBtn.disabled = true;

        try {
            const provisioningClient = getAdminProvisioningClient();
            const { data, error } = await provisioningClient.auth.signUp({
                email,
                password
            });
            if (error) throw error;

            if (!data?.user?.id) {
                throw new Error('Supabase did not return a new admin account.');
            }

            const { error: profileError } = await client.from('profiles').upsert({
                id: data.user.id,
                first_name: firstName,
                last_name: lastName,
                role: 'admin'
            });
            if (profileError) throw profileError;

            showToast(`Admin ${firstName} ${lastName} created!`, 'success');
            form.reset();
            loadAdminsTab();
        } catch (err) {
            showToast('Failed: ' + err.message, 'error');
        } finally {
            submitBtn.innerHTML = '<i class="ph-bold ph-user-plus"></i> Add Admin';
            submitBtn.disabled = false;
        }
    };
}
