const PAGE_SIZE = 10;
let currentPage = 1;

async function resolveDepartmentId(departmentCode) {
    if (!departmentCode) return null;

    const { data: department, error } = await client.from('departments')
        .select('id')
        .eq('code', departmentCode)
        .maybeSingle();

    if (error) throw error;
    return department?.id || null;
}

async function getFilteredCourseIds({ departmentId, level, searchQuery }) {
    let query = client.from('courses').select('id');

    if (departmentId) query = query.eq('department_id', departmentId);
    if (level) query = query.eq('level', parseInt(level, 10));
    if (searchQuery) {
        const escapedQuery = searchQuery.replace(/,/g, '\\,');
        query = query.or(`code.ilike.%${escapedQuery}%,title.ilike.%${escapedQuery}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data?.map((course) => course.id) || [];
}

function emptyResults(resultsGrid, resultsCount) {
    if (resultsCount) resultsCount.innerText = '0';
    renderDocuments([], resultsGrid);
    renderPagination(0);
}

async function loadDocuments(page = 1) {
    const resultsGrid = document.getElementById('results-grid');
    const resultsCount = document.getElementById('results-count');
    if (!resultsGrid) return;

    currentPage = page;
    resultsGrid.innerHTML = '<div class="col-span-full text-center py-10"><i class="ph-bold ph-spinner animate-spin text-3xl text-brand-green"></i></div>';

    const searchQuery = document.getElementById('search-input')?.value || '';
    const department = document.getElementById('filter-department')?.value || '';
    const level = document.getElementById('filter-level')?.value || '';
    const year = document.getElementById('filter-year')?.value || '';
    const sem1 = document.getElementById('filter-semester-1')?.checked || false;
    const sem2 = document.getElementById('filter-semester-2')?.checked || false;
    const sort = document.getElementById('sort-select')?.value || 'recent';

    try {
        const departmentId = await resolveDepartmentId(department);
        const hasCourseFilters = Boolean(departmentId || level);
        const filteredCourseIds = hasCourseFilters
            ? await getFilteredCourseIds({ departmentId, level, searchQuery: '' })
            : [];

        if (hasCourseFilters && filteredCourseIds.length === 0) {
            emptyResults(resultsGrid, resultsCount);
            return;
        }

        const matchingCourseIds = searchQuery
            ? await getFilteredCourseIds({ departmentId, level, searchQuery })
            : [];

        let countQuery = client.from('documents')
            .select('*', { count: 'exact', head: true });

        if (hasCourseFilters) {
            countQuery = countQuery.in('course_id', filteredCourseIds);
        }

        if (searchQuery) {
            const q = `%${searchQuery}%`;
            if (matchingCourseIds.length > 0) {
                countQuery = countQuery.or(`title.ilike.${q},course_id.in.(${matchingCourseIds.join(',')})`);
            } else {
                countQuery = countQuery.ilike('title', q);
            }
        }
        if (year) countQuery = countQuery.eq('year', year);
        if (sem1 && !sem2) countQuery = countQuery.eq('semester', 'First');
        else if (!sem1 && sem2) countQuery = countQuery.eq('semester', 'Second');

        const { count } = await countQuery;
        const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

        const from = (currentPage - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let query = client.from('documents')
            .select('*, courses(code, title)');

        if (hasCourseFilters) {
            query = query.in('course_id', filteredCourseIds);
        }

        if (searchQuery) {
            const q = `%${searchQuery}%`;
            if (matchingCourseIds.length > 0) {
                query = query.or(`title.ilike.${q},course_id.in.(${matchingCourseIds.join(',')})`);
            } else {
                query = query.ilike('title', q);
            }
        }
        if (year) query = query.eq('year', year);
        if (sem1 && !sem2) query = query.eq('semester', 'First');
        else if (!sem1 && sem2) query = query.eq('semester', 'Second');

        if (sort === 'downloads') {
            query = query.order('downloads_count', { ascending: false });
        } else {
            query = query.order('created_at', { ascending: false });
        }

        const { data, error } = await query.range(from, to);
        if (error) throw error;

        if (resultsCount) resultsCount.innerText = count || 0;
        renderDocuments(data, resultsGrid);
        renderPagination(count || 0);
    } catch (error) {
        resultsGrid.innerHTML = `<div class="col-span-full text-center text-red-500 py-10">Failed to load documents: ${error.message}</div>`;
    }
}

function renderDocuments(docs, container) {
    if (!docs || docs.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500">
            <i class="ph-bold ph-file-dashed text-4xl mb-2"></i><br>
            No documents found matching your criteria.
        </div>`;
        return;
    }

    container.innerHTML = docs.map(doc => `
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-brand-green/10 hover:shadow-xl hover:shadow-brand-green/5 hover:border-brand-green/30 transition-all group cursor-pointer" onclick="downloadDocument('${doc.id}', '${doc.file_path}')">
            <div class="flex justify-between items-start mb-4">
                <div class="inline-block px-3 py-1 bg-brand-lightgreen text-brand-darkgreen text-xs font-semibold rounded-full border border-brand-green/20">
                    ${doc.courses?.code || 'GEN'}
                </div>
                <span class="text-xs text-gray-400 capitalize">${doc.type || 'material'}</span>
            </div>
            <h4 class="text-lg font-bold text-gray-900 mb-2 group-hover:text-brand-green transition-colors">${doc.title}</h4>

            <div class="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
                <div class="flex flex-col">
                    <span class="text-xs text-gray-400">Session</span>
                    <span class="text-sm font-medium text-gray-700">${doc.year || 'N/A'}</span>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-xs text-gray-500 flex items-center gap-1"><i class="ph-bold ph-download-simple"></i> ${doc.downloads_count || 0}</span>
                    <button class="w-8 h-8 rounded-full bg-brand-milk flex items-center justify-center text-brand-green hover:bg-brand-green hover:text-white transition-colors">
                        <i class="ph-bold ph-arrow-right"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

async function downloadDocument(docId, path) {
    if (!path) return;
    try {
        const { data, error } = await client.storage.from('documents').createSignedUrl(path, 60);
        if (error) throw error;
        window.open(data.signedUrl, '_blank');
        const { data: doc } = await client.from('documents')
            .select('downloads_count')
            .eq('id', docId)
            .single();
        await client.from('documents')
            .update({ downloads_count: (doc?.downloads_count || 0) + 1 })
            .eq('id', docId);
    } catch (err) {
        console.error("Download failed", err);
    }
}

function renderPagination(total) {
    const container = document.getElementById('pagination');
    if (!container) return;

    const totalPages = Math.ceil(total / PAGE_SIZE);
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    let html = '';
    if (currentPage > 1) {
        html += `<button onclick="loadDocuments(${currentPage - 1})" class="w-10 h-10 rounded-lg flex items-center justify-center border border-gray-200 text-gray-500 hover:bg-brand-milk hover:text-brand-green transition-colors"><i class="ph-bold ph-caret-left"></i></button>`;
    }

    for (let i = 1; i <= totalPages; i++) {
        const active = i === currentPage ? 'bg-brand-green text-white shadow-md' : 'border border-gray-200 text-gray-700 hover:bg-brand-milk hover:text-brand-green';
        html += `<button onclick="loadDocuments(${i})" class="w-10 h-10 rounded-lg flex items-center justify-center ${active} transition-colors font-medium">${i}</button>`;
    }

    if (currentPage < totalPages) {
        html += `<button onclick="loadDocuments(${currentPage + 1})" class="w-10 h-10 rounded-lg flex items-center justify-center border border-gray-200 text-gray-500 hover:bg-brand-milk hover:text-brand-green transition-colors"><i class="ph-bold ph-caret-right"></i></button>`;
    }

    container.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('results-grid')) return;

    loadDocuments();

    document.getElementById('search-btn')?.addEventListener('click', () => loadDocuments(1));
    document.getElementById('search-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') loadDocuments(1);
    });
    document.getElementById('apply-filters-btn')?.addEventListener('click', () => loadDocuments(1));
    document.getElementById('sort-select')?.addEventListener('change', () => loadDocuments(1));
});
