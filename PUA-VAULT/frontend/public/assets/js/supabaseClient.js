const SUPABASE_URL = 'https://wruyvpfbiebfkqclfroa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndydXl2cGZiaWViZmtxY2xmcm9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2Mzk3NjEsImV4cCI6MjEwMDIxNTc2MX0.JhRVIqEW2mkCtSO-GQIrBFU-Av3mKe8ZzJw7k9tpgMc';

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast-container');
    if (!existing) {
        const container = document.createElement('div');
        container.className = 'toast-container';
        container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    const bg = type === 'success' ? 'bg-brand-green' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
    const icon = type === 'success' ? 'ph-check-circle' : type === 'error' ? 'ph-x-circle' : 'ph-info';
    toast.innerHTML = `<div class="${bg} text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in-up"><i class="ph-bold ${icon}"></i> ${message}</div>`;
    document.querySelector('.toast-container')?.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 4000);
}
