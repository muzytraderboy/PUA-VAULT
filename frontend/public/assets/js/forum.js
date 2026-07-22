let forumCurrentPage = 1;
const FORUM_PAGE_SIZE = 20;
let isCatalogView = true;
let currentThreadId = null;

const COURSE_CODE_REGEX = /\b([A-Za-z]{2,4})\s*(\d{3})\b/g;

document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('forum-threads')) return;
    loadCourses();
    loadThreads();
    document.getElementById('new-thread-btn')?.addEventListener('click', openNewThreadModal);
    document.getElementById('thread-form')?.addEventListener('submit', handleNewThread);
    document.getElementById('forum-filter-course')?.addEventListener('change', () => loadThreads(1));

    const zone = document.getElementById('thread-image-zone');
    const input = document.getElementById('thread-image-input');
    if (zone && input) {
        zone.onclick = () => input.click();
        input.onchange = () => handleThreadImageSelect(input.files[0]);
    }

    document.addEventListener('click', (e) => {
        const replyImgBtn = e.target.closest('.reply-image-btn');
        if (replyImgBtn) {
            const form = replyImgBtn.closest('.reply-form');
            const input = form?.querySelector('.reply-image-input');
            if (input) input.click();
        }
    });
});

async function loadCourses() {
    const select = document.getElementById('forum-filter-course');
    if (!select) return;
    try {
        const { data } = await client.from('courses').select('code, title').order('code');
        select.innerHTML = '<option value="">All Courses</option>';
        if (data) {
            const seen = new Set();
            data.forEach(c => {
                if (!seen.has(c.code)) {
                    seen.add(c.code);
                    select.innerHTML += `<option value="${c.code}">${c.code} - ${c.title}</option>`;
                }
            });
        }
    } catch (err) {
        console.error('Failed to load courses:', err);
    }
}

async function loadThreads(page = 1) {
    forumCurrentPage = page;
    const container = document.getElementById('forum-threads');
    const detail = document.getElementById('thread-detail');
    if (!container) return;
    detail?.classList.add('hidden');
    document.getElementById('thread-count')?.classList.remove('hidden');

    container.innerHTML = '<div class="col-span-full text-center py-12"><i class="ph-bold ph-spinner animate-spin text-3xl text-brand-green"></i><p class="mt-3 text-gray-500">Loading discussions...</p></div>';

    const courseCode = document.getElementById('forum-filter-course')?.value || '';

    try {
        let countQuery = client.from('discussion_threads').select('*', { count: 'exact', head: true });
        let dataQuery = client.from('discussion_threads').select('*');

        if (courseCode) {
            countQuery = countQuery.eq('course_code', courseCode);
            dataQuery = dataQuery.eq('course_code', courseCode);
        }

        const { count } = await countQuery;
        const totalPages = Math.ceil((count || 0) / FORUM_PAGE_SIZE);
        const from = (forumCurrentPage - 1) * FORUM_PAGE_SIZE;
        const to = from + FORUM_PAGE_SIZE - 1;

        const { data: threads, error } = await dataQuery
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        document.getElementById('thread-count').textContent = `${count || 0} threads`;

        if (!threads || threads.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-16">
                    <i class="ph-bold ph-chats-circle text-5xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500 text-lg mb-2">No discussions yet</p>
                    <p class="text-gray-400 text-sm">Be the first to start a conversation!</p>
                </div>`;
            document.getElementById('forum-pagination').innerHTML = '';
            return;
        }

        if (isCatalogView) {
            renderCatalogView(container, threads);
        } else {
            renderListView(container, threads);
        }

        renderForumPagination(count || 0);
    } catch (err) {
        container.innerHTML = `<div class="col-span-full text-center py-10 text-red-500">Failed to load threads: ${err.message}</div>`;
    }
}

function renderCatalogView(container, threads) {
    container.className = 'catalog-grid';
    container.innerHTML = threads.map(t => `
        <div class="thread-card bg-white rounded-xl border border-brand-green/10 hover:border-brand-green/30 hover:shadow-lg overflow-hidden cursor-pointer" onclick="openThread('${t.id}')">
            ${t.image_url
                ? `<div class="w-full h-40 overflow-hidden bg-gray-100">
                       <img src="${t.image_url}" alt="" class="w-full h-full object-cover thread-image" loading="lazy"
                            onerror="this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center text-gray-300\\'><i class=\\'ph-bold ph-image text-3xl\\'></i></div>'">
                   </div>`
                : `<div class="w-full h-40 bg-gradient-to-br from-brand-lightgreen to-brand-milk flex items-center justify-center">
                       <i class="ph-bold ph-chats-circle text-4xl text-brand-green/30"></i>
                   </div>`
            }
            <div class="p-4">
                <div class="flex items-start justify-between gap-2 mb-2">
                    <h3 class="font-bold text-gray-900 text-sm leading-tight line-clamp-2 flex-1">${escapeHtml(t.title)}</h3>
                </div>
                <p class="text-gray-500 text-xs line-clamp-2 mb-3">${escapeHtml(t.content.substring(0, 120))}${t.content.length > 120 ? '...' : ''}</p>
                <div class="flex items-center justify-between text-xs">
                    <div class="flex items-center gap-2">
                        <span class="course-tag text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-lightgreen text-brand-darkgreen border border-brand-green/20">${escapeHtml(t.course_code || 'General')}</span>
                        <span class="text-gray-400"><i class="ph-bold ph-chats mr-0.5"></i>${t.reply_count || 0}</span>
                        ${t.detected_course_code ? `<span class="text-brand-accent font-medium" title="OCR detected"><i class="ph-bold ph-scan"></i></span>` : ''}
                    </div>
                    <span class="text-gray-400">${timeAgo(t.created_at)}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function renderListView(container, threads) {
    container.className = 'space-y-2';
    container.innerHTML = threads.map(t => `
        <div class="thread-card bg-white rounded-xl border border-brand-green/10 hover:border-brand-green/30 hover:shadow-md transition-all cursor-pointer p-4 flex items-center gap-4" onclick="openThread('${t.id}')">
            ${t.image_url
                ? `<div class="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                       <img src="${t.image_url}" alt="" class="w-full h-full object-cover" loading="lazy"
                            onerror="this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center text-gray-300\\'><i class=\\'ph-bold ph-image\\'></i></div>'">
                   </div>`
                : `<div class="w-16 h-16 rounded-lg bg-gradient-to-br from-brand-lightgreen to-brand-milk flex items-center justify-center shrink-0">
                       <i class="ph-bold ph-chats-circle text-xl text-brand-green/30"></i>
                   </div>`
            }
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-0.5">
                    <span class="course-tag text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-lightgreen text-brand-darkgreen border border-brand-green/20">${escapeHtml(t.course_code || 'General')}</span>
                    <h3 class="font-bold text-gray-900 text-sm truncate">${escapeHtml(t.title)}</h3>
                </div>
                <p class="text-gray-400 text-xs truncate">${escapeHtml(t.author_name || 'Anonymous')} — ${timeAgo(t.created_at)}</p>
            </div>
            <div class="shrink-0 text-right text-xs text-gray-400">
                <div><i class="ph-bold ph-chats mr-0.5"></i>${t.reply_count || 0}</div>
                ${t.detected_course_code ? `<div class="text-brand-accent"><i class="ph-bold ph-scan"></i></div>` : ''}
            </div>
        </div>
    `).join('');
}

function toggleCatalogView() {
    isCatalogView = !isCatalogView;
    document.getElementById('view-label').textContent = isCatalogView ? 'List' : 'Grid';
    document.getElementById('view-toggle').innerHTML = isCatalogView
        ? '<i class="ph-bold ph-list"></i> <span id="view-label">List</span>'
        : '<i class="ph-bold ph-grid-four"></i> <span id="view-label">Grid</span>';
    loadThreads(forumCurrentPage);
}

async function openThread(threadId) {
    currentThreadId = threadId;
    const container = document.getElementById('forum-threads');
    const detail = document.getElementById('thread-detail');
    const pagination = document.getElementById('forum-pagination');

    container.innerHTML = '';
    pagination.innerHTML = '';
    detail.classList.remove('hidden');
    detail.innerHTML = '<div class="text-center py-12"><i class="ph-bold ph-spinner animate-spin text-3xl text-brand-green"></i><p class="mt-3 text-gray-500">Loading thread...</p></div>';

    try {
        const { data: thread, error } = await client.from('discussion_threads')
            .select('*')
            .eq('id', threadId)
            .single();
        if (error || !thread) throw error || new Error('Thread not found');

        const { data: posts } = await client.from('discussion_posts')
            .select('*')
            .eq('thread_id', threadId)
            .order('created_at', { ascending: true });

        detail.innerHTML = renderThreadDetail(thread, posts || []);
        window.scrollTo({ top: detail.offsetTop - 100, behavior: 'smooth' });
    } catch (err) {
        detail.innerHTML = `<div class="text-center py-10 text-red-500">${err.message}</div>`;
    }
}

function renderThreadDetail(thread, posts) {
    const hasImage = thread.image_url;
    return `
        <div class="bg-white rounded-2xl border border-brand-green/10 shadow-sm overflow-hidden">
            <!-- Thread Header -->
            <div class="p-5 sm:p-6 border-b border-gray-100">
                <div class="flex items-start justify-between gap-3 mb-1">
                    <div>
                        <div class="flex items-center gap-2 mb-2">
                            <button onclick="closeThread()" class="text-gray-400 hover:text-brand-green transition-colors p-1 -ml-1">
                                <i class="ph-bold ph-arrow-left text-lg"></i>
                            </button>
                            <span class="course-tag text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-lightgreen text-brand-darkgreen border border-brand-green/20">${escapeHtml(thread.course_code || 'General')}</span>
                            ${thread.detected_course_code ? `<span class="course-tag text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-brand-accent border border-brand-accent/30"><i class="ph-bold ph-scan mr-0.5"></i>${escapeHtml(thread.detected_course_code)}</span>` : ''}
                        </div>
                        <h2 class="text-xl font-bold text-gray-900">${escapeHtml(thread.title)}</h2>
                    </div>
                </div>
                <div class="flex items-center gap-3 text-xs text-gray-400 mt-2">
                    <span><i class="ph-bold ph-user-circle mr-1"></i>${escapeHtml(thread.author_name || 'Anonymous')}</span>
                    <span>•</span>
                    <span>${timeAgo(thread.created_at)}</span>
                    <span>•</span>
                    <span class="text-brand-green font-medium">${thread.reply_count || 0} replies</span>
                    <span class="text-gray-300">#${thread.id.substring(0, 8)}</span>
                </div>
            </div>

            <!-- OP Post -->
            <div class="p-5 sm:p-6 border-b border-gray-100">
                ${hasImage ? `
                <div class="mb-4">
                    <img src="${thread.image_url}" alt="Thread image" class="op-image w-full cursor-pointer" loading="lazy"
                        onclick="window.open('${thread.image_url}', '_blank')"
                        onerror="this.outerHTML='<div class=\\'p-4 bg-red-50 rounded-lg text-red-400 text-sm\\'><i class=\\'ph-bold ph-image-broken mr-1\\'></i>Image failed to load</div>'">
                </div>
                ` : ''}
                <p class="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">${escapeHtml(thread.content)}</p>
            </div>

            <!-- Replies -->
            <div class="divide-y divide-gray-50" id="thread-posts-${thread.id}">
                ${posts.length === 0
                    ? '<div class="p-6 text-center text-gray-400 text-sm">No replies yet. Be the first!</div>'
                    : posts.map(p => `
                        <div class="p-5 sm:p-6 hover:bg-gray-50/50 transition-colors">
                            <div class="flex items-center gap-2 mb-2 text-xs text-gray-400">
                                <span class="font-medium text-gray-600"><i class="ph-bold ph-user-circle mr-1"></i>${escapeHtml(p.author_name || 'Anonymous')}</span>
                                <span>•</span>
                                <span>${timeAgo(p.created_at)}</span>
                                <span class="text-gray-300">#${p.id.substring(0, 8)}</span>
                                ${p.detected_course_code ? `<span class="course-tag text-xs px-1.5 py-0.5 rounded bg-green-50 text-brand-accent border border-brand-accent/20">${escapeHtml(p.detected_course_code)}</span>` : ''}
                            </div>
                            ${p.image_url ? `
                            <div class="mb-3">
                                <img src="${p.image_url}" alt="Reply image" class="reply-image max-h-48" loading="lazy"
                                    onclick="window.open('${p.image_url}', '_blank')"
                                    onerror="this.outerHTML='<span class=\\'text-red-400 text-xs\\'>Image failed to load</span>'">
                            </div>
                            ` : ''}
                            <p class="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">${escapeHtml(p.content)}</p>
                        </div>
                    `).join('')
                }
            </div>

            <!-- Reply Form -->
            <div class="p-5 sm:p-6 bg-gray-50/50 border-t border-gray-100">
                <form class="reply-form space-y-3" data-thread-id="${thread.id}">
                    <div>
                        <textarea class="reply-content w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white text-sm outline-none focus:ring-2 focus:ring-brand-green/50 focus:border-brand-green reply-form-input" placeholder="Write a reply..." rows="2" required></textarea>
                    </div>
                    <div class="flex items-center gap-3 flex-wrap">
                        <div class="relative">
                            <button type="button" class="reply-image-btn px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:text-brand-green hover:border-brand-green transition-colors flex items-center gap-1.5 bg-white">
                                <i class="ph-bold ph-image"></i> Image
                            </button>
                            <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" class="reply-image-input hidden">
                        </div>
                        <div class="reply-image-preview hidden relative">
                            <img class="max-h-16 rounded-lg border border-gray-200" alt="Preview">
                            <button type="button" class="clear-reply-image absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 transition-colors shadow">
                                <i class="ph-bold ph-x"></i>
                            </button>
                            <span class="reply-ocr-tag hidden text-xs font-mono text-brand-accent ml-2"></span>
                        </div>
                        <div class="flex-1"></div>
                        <button type="submit" class="px-5 py-2 bg-brand-green text-white rounded-lg text-sm font-medium hover:bg-brand-darkgreen transition-colors flex items-center gap-1.5 shadow-sm">
                            <i class="ph-bold ph-paper-plane-right"></i> Reply
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function closeThread() {
    currentThreadId = null;
    document.getElementById('thread-detail').classList.add('hidden');
    document.getElementById('thread-count')?.classList.remove('hidden');
    loadThreads(forumCurrentPage);
}

// === Image Upload & OCR ===

let threadImageFile = null;
let threadOcrCode = null;

function handleThreadImageSelect(file) {
    if (!file) return;
    threadImageFile = file;
    const reader = new FileReader();
    reader.onload = async (e) => {
        const dataUrl = e.target.result;
        document.getElementById('thread-image-placeholder').classList.add('hidden');
        const preview = document.getElementById('thread-image-preview');
        preview.classList.remove('hidden');
        document.getElementById('thread-image-img').src = dataUrl;
        document.getElementById('thread-ocr-status').innerHTML = '<span class="text-xs text-brand-green"><i class="ph-bold ph-spinner animate-spin"></i> Scanning image for course code...</span>';

        try {
            const code = await scanImageForCourseCode(dataUrl);
            if (code) {
                threadOcrCode = code;
                document.getElementById('thread-ocr-status').innerHTML = `<span class="text-xs text-brand-green"><i class="ph-bold ph-scan"></i> Detected: <strong>${code}</strong></span>`;
                const detectedDiv = document.getElementById('thread-detected-course');
                detectedDiv.classList.remove('hidden');
                document.getElementById('thread-detected-code-input').value = code;
                const select = document.getElementById('thread-course-code');
                const existingOpt = Array.from(select.options).find(opt => opt.value === code);
                if (existingOpt) {
                    select.value = code;
                }
            } else {
                threadOcrCode = null;
                document.getElementById('thread-ocr-status').innerHTML = '<span class="text-xs text-gray-400">No course code detected in image</span>';
            }
        } catch (err) {
            console.error('OCR error:', err);
            document.getElementById('thread-ocr-status').innerHTML = '<span class="text-xs text-red-400">OCR failed</span>';
        }
    };
    reader.readAsDataURL(file);
}

function clearThreadImage() {
    threadImageFile = null;
    threadOcrCode = null;
    document.getElementById('thread-image-preview').classList.add('hidden');
    document.getElementById('thread-image-placeholder').classList.remove('hidden');
    document.getElementById('thread-image-input').value = '';
    document.getElementById('thread-detected-course').classList.add('hidden');
    document.getElementById('thread-ocr-status').innerHTML = '';
}

function clearDetectedThreadCode() {
    threadOcrCode = null;
    document.getElementById('thread-detected-course').classList.add('hidden');
    document.getElementById('thread-detected-code-input').value = '';
}

async function scanImageForCourseCode(dataUrl) {
    const { data: { text } } = await Tesseract.recognize(dataUrl, 'eng', {
        logger: () => {}
    });

    const codes = [];
    let match;
    while ((match = COURSE_CODE_REGEX.exec(text)) !== null) {
        codes.push((match[1] + ' ' + match[2]).toUpperCase());
    }

    const unique = [...new Set(codes)];
    return unique.length > 0 ? unique[0] : null;
}

async function uploadForumImage(file, bucketPath) {
    const { error } = await client.storage
        .from('forum-images')
        .upload(bucketPath, file);
    if (error) throw error;

    const { data: { publicUrl } } = client.storage
        .from('forum-images')
        .getPublicUrl(bucketPath);

    return publicUrl;
}

// === Thread CRUD ===

function openNewThreadModal() {
    document.getElementById('new-thread-modal').classList.remove('hidden');
    document.getElementById('new-thread-modal').classList.add('flex');
    document.body.style.overflow = 'hidden';
    loadThreadCourses();
}

function closeNewThreadModal() {
    document.getElementById('new-thread-modal').classList.add('hidden');
    document.getElementById('new-thread-modal').classList.remove('flex');
    document.body.style.overflow = '';
    document.getElementById('thread-form').reset();
    clearThreadImage();
}

async function loadThreadCourses() {
    const select = document.getElementById('thread-course-code');
    if (!select || select.options.length > 1) return;
    try {
        const { data } = await client.from('courses').select('code, title').order('code');
        if (data) {
            const seen = new Set();
            select.innerHTML = '<option value="">General Discussion</option>';
            data.forEach(c => {
                if (!seen.has(c.code)) {
                    seen.add(c.code);
                    select.innerHTML += `<option value="${c.code}">${c.code} - ${c.title}</option>`;
                }
            });
        }
    } catch (err) {
        console.error(err);
    }
}

async function handleNewThread(e) {
    e.preventDefault();
    const form = e.target;
    const title = form.title.value.trim();
    const content = form.content.value.trim();
    const courseCode = form.courseCode.value.trim();
    const name = 'Anonymous';

    if (!title || !content) return;

    const identity = getAnonymousIdentity();

    const { data: banned } = await client.rpc('is_identity_banned', { check_identity: identity });
    if (banned) {
        showToast('You have been banned from posting.', 'error');
        closeNewThreadModal();
        return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i> Creating...';

    try {
        let courseId = null;
        if (courseCode) {
            const { data: course } = await client.from('courses').select('id').eq('code', courseCode).maybeSingle();
            if (course) courseId = course.id;
        }

        let imageUrl = null;
        let imgWidth = null;
        let imgHeight = null;
        let detectedCode = threadOcrCode || null;

        if (threadImageFile) {
            const ext = threadImageFile.name.split('.').pop();
            const fileName = `threads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
            imageUrl = await uploadForumImage(threadImageFile, fileName);

            const img = new Image();
            await new Promise((resolve) => {
                img.onload = () => { imgWidth = img.naturalWidth; imgHeight = img.naturalHeight; resolve(); };
                img.onerror = () => resolve();
                img.src = URL.createObjectURL(threadImageFile);
            });
        }

        const { error } = await client.from('discussion_threads').insert({
            course_id: courseId,
            course_code: courseCode || null,
            title,
            content,
            author_identity: identity,
            author_name: name,
            image_url: imageUrl,
            image_width: imgWidth,
            image_height: imgHeight,
            detected_course_code: detectedCode
        });

        if (error) throw error;

        showToast('Thread created!', 'success');
        closeNewThreadModal();
        loadThreads(1);
    } catch (err) {
        if (err.message?.includes('violates row-level security') || err.code === '42501') {
            showToast('You have been banned from posting.', 'error');
            closeNewThreadModal();
        } else {
            showToast('Failed to create thread: ' + err.message, 'error');
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="ph-bold ph-plus-circle"></i> Create Thread';
    }
}

// === Reply Handling ===

document.addEventListener('submit', async (e) => {
    const form = e.target.closest('.reply-form');
    if (!form) return;
    e.preventDefault();

    const threadId = form.dataset.threadId;
    const contentInput = form.querySelector('.reply-content');
    const content = contentInput.value.trim();
    if (!content) return;

    const identity = getAnonymousIdentity();

    const { data: banned } = await client.rpc('is_identity_banned', { check_identity: identity });
    if (banned) {
        showToast('You have been banned from posting.', 'error');
        return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i>';

    try {
        const imageInput = form.querySelector('.reply-image-input');
        const replyImageFile = imageInput?.files?.[0] || null;

        let imageUrl = null;
        let detectedCode = null;

        if (replyImageFile) {
            const ext = replyImageFile.name.split('.').pop();
            const fileName = `replies/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
            imageUrl = await uploadForumImage(replyImageFile, fileName);

            const reader = new FileReader();
            const dataUrl = await new Promise(resolve => {
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(replyImageFile);
            });
            detectedCode = await scanImageForCourseCode(dataUrl);
        }

        const { error } = await client.from('discussion_posts').insert({
            thread_id: threadId,
            content,
            author_identity: identity,
            author_name: 'Anonymous',
            image_url: imageUrl,
            detected_course_code: detectedCode
        });

        if (error) throw error;

        contentInput.value = '';
        if (imageInput) imageInput.value = '';
        const preview = form.querySelector('.reply-image-preview');
        if (preview) preview.classList.add('hidden');

        if (currentThreadId) await openThread(currentThreadId);
    } catch (err) {
        if (err.message?.includes('violates row-level security') || err.code === '42501') {
            showToast('You have been banned from posting.', 'error');
        } else {
            showToast('Failed to post reply: ' + err.message, 'error');
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="ph-bold ph-paper-plane-right"></i> Reply';
    }
});

// Reply image preview
document.addEventListener('change', (e) => {
    const input = e.target.closest('.reply-image-input');
    if (!input) return;

    const file = input.files[0];
    if (!file) return;

    const form = input.closest('.reply-form');
    const preview = form.querySelector('.reply-image-preview');
    const img = preview.querySelector('img');
    const tag = preview.querySelector('.reply-ocr-tag');

    const reader = new FileReader();
    reader.onload = async (ev) => {
        img.src = ev.target.result;
        preview.classList.remove('hidden');

        try {
            const code = await scanImageForCourseCode(ev.target.result);
            if (code) {
                tag.textContent = `OCR: ${code}`;
                tag.classList.remove('hidden');
            } else {
                tag.classList.add('hidden');
            }
        } catch {
            tag.classList.add('hidden');
        }
    };
    reader.readAsDataURL(file);

    const clearBtn = preview.querySelector('.clear-reply-image');
    if (clearBtn) {
        clearBtn.onclick = () => {
            input.value = '';
            preview.classList.add('hidden');
        };
    }
});

function renderForumPagination(total) {
    const container = document.getElementById('forum-pagination');
    if (!container) return;

    const totalPages = Math.ceil(total / FORUM_PAGE_SIZE);
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    let html = '';
    if (forumCurrentPage > 1) {
        html += `<button onclick="loadThreads(${forumCurrentPage - 1})" class="pagination-btn w-10 h-10 rounded-lg flex items-center justify-center border border-gray-200 text-gray-500 hover:bg-brand-milk hover:text-brand-green transition-colors"><i class="ph-bold ph-caret-left"></i></button>`;
    }
    for (let i = 1; i <= totalPages; i++) {
        const active = i === forumCurrentPage ? 'bg-brand-green text-white shadow-md' : 'border border-gray-200 text-gray-700 hover:bg-brand-milk hover:text-brand-green';
        html += `<button onclick="loadThreads(${i})" class="pagination-btn w-10 h-10 rounded-lg flex items-center justify-center ${active} transition-colors font-medium">${i}</button>`;
    }
    if (forumCurrentPage < totalPages) {
        html += `<button onclick="loadThreads(${forumCurrentPage + 1})" class="pagination-btn w-10 h-10 rounded-lg flex items-center justify-center border border-gray-200 text-gray-500 hover:bg-brand-milk hover:text-brand-green transition-colors"><i class="ph-bold ph-caret-right"></i></button>`;
    }
    container.innerHTML = html;
}

function escapeHtml(text) {
    if (!text) return '';
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

function timeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}
