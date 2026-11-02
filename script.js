/**
 * =============================================
 *  SISTEM LAUNDRY — script.js
 *  Vanilla JavaScript | LocalStorage CRUD
 * =============================================
 */

/* =========================================
   STORAGE HELPERS
   ========================================= */

/** Ambil data transaksi dari LocalStorage */
function getTransactions() {
  return JSON.parse(localStorage.getItem('sl_transactions') || '[]');
}

/** Simpan array transaksi ke LocalStorage */
function saveTransactions(data) {
  localStorage.setItem('sl_transactions', JSON.stringify(data));
}

/** Ambil data pelanggan dari LocalStorage */
function getCustomers() {
  return JSON.parse(localStorage.getItem('sl_customers') || '[]');
}

/** Simpan array pelanggan ke LocalStorage */
function saveCustomers(data) {
  localStorage.setItem('sl_customers', JSON.stringify(data));
}

/* =========================================
   NAVIGATION (SPA sederhana)
   ========================================= */

/** Navigasi antar halaman (dashboard / transactions / customers) */
function navigateTo(page) {
  const pages = {
    dashboard:    document.getElementById('pageDashboard'),
    transactions: document.getElementById('pageTransactions'),
    customers:    document.getElementById('pageCustomers'),
  };

  const titles = {
    dashboard:    'Dashboard',
    transactions: 'Manajemen Transaksi',
    customers:    'Data Pelanggan',
  };

  // Sembunyikan semua halaman
  Object.values(pages).forEach(p => p.classList.add('d-none'));

  // Tampilkan halaman yang dipilih
  if (pages[page]) {
    pages[page].classList.remove('d-none');
    document.getElementById('pageTitle').textContent = titles[page];
  }

  // Update active state di sidebar
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === page);
  });

  // Tutup sidebar di mobile
  if (window.innerWidth <= 576) {
    document.getElementById('sidebar').classList.remove('mobile-open');
    document.querySelector('.sidebar-overlay').classList.remove('active');
  }

  // Refresh data halaman yang dituju
  if (page === 'dashboard')    updateDashboard();
  if (page === 'transactions') renderTransactions();
  if (page === 'customers')    renderCustomers();
}

/* =========================================
   DASHBOARD
   ========================================= */

/** Perbarui seluruh statistik dashboard */
function updateDashboard() {
  const transactions = getTransactions();

  const total    = transactions.length;
  const inProc   = transactions.filter(t => ['Menunggu','Diproses'].includes(t.status)).length;
  const done     = transactions.filter(t => t.status === 'Selesai').length;
  const revenue  = transactions
    .filter(t => t.payment === 'Lunas')
    .reduce((sum, t) => sum + t.totalCost, 0);

  document.getElementById('statTotal').textContent   = total;
  document.getElementById('statProcess').textContent = inProc;
  document.getElementById('statDone').textContent    = done;
  document.getElementById('statRevenue').textContent = formatRupiah(revenue);

  // Transaksi terbaru (maks 5)
  renderRecentTransactions(transactions.slice(-5).reverse());
}

/** Render tabel transaksi terbaru di dashboard */
function renderRecentTransactions(data) {
  const tbody = document.getElementById('recentTransactionsBody');

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Belum ada transaksi</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(t => `
    <tr>
      <td><span class="fw-semibold text-primary">${t.nota}</span></td>
      <td>${t.customerName}</td>
      <td>${t.service}</td>
      <td>${formatRupiah(t.totalCost)}</td>
      <td>${statusBadge(t.status)}</td>
    </tr>
  `).join('');
}

/* =========================================
   TRANSACTIONS — CRUD
   ========================================= */

/** Buka modal untuk MENAMBAH transaksi baru */
function openAddTransaction() {
  resetTransactionForm();
  document.getElementById('modalTransactionLabel').textContent = 'Tambah Transaksi';
  document.getElementById('txId').value = '';
  document.getElementById('txNota').value = generateNota();
  document.getElementById('txDate').value  = todayDate();
  populateCustomerDropdown();
}

/** Buka modal untuk MENGEDIT transaksi */
function openEditTransaction(id) {
  const transactions = getTransactions();
  const tx = transactions.find(t => t.id === id);
  if (!tx) return;

  resetTransactionForm();
  document.getElementById('modalTransactionLabel').textContent = 'Edit Transaksi';
  document.getElementById('txId').value        = tx.id;
  document.getElementById('txNota').value      = tx.nota;
  document.getElementById('txDate').value      = tx.date;
  document.getElementById('txWeight').value    = tx.weight;
  document.getElementById('txStatus').value    = tx.status;
  document.getElementById('txPayment').value   = tx.payment;
  document.getElementById('txNote').value      = tx.note || '';

  populateCustomerDropdown(tx.customerId);

  // Set layanan setelah dropdown diisi
  document.getElementById('txService').value = tx.service;
  calculateCost();

  // Buka modal
  new bootstrap.Modal(document.getElementById('modalTransaction')).show();
}

/** Simpan transaksi (tambah atau edit) */
function saveTransaction() {
  const form = document.getElementById('formTransaction');

  // Validasi Bootstrap
  if (!form.checkValidity()) {
    form.classList.add('was-validated');
    return;
  }

  const id         = document.getElementById('txId').value;
  const nota       = document.getElementById('txNota').value;
  const date       = document.getElementById('txDate').value;
  const customerId = document.getElementById('txCustomer').value;
  const service    = document.getElementById('txService').value;
  const weight     = parseFloat(document.getElementById('txWeight').value);
  const status     = document.getElementById('txStatus').value;
  const payment    = document.getElementById('txPayment').value;
  const note       = document.getElementById('txNote').value.trim();

  // Harga layanan
  const pricePerKg = getServicePrice(service);
  const totalCost  = pricePerKg * weight;

  // Nama pelanggan
  const customers    = getCustomers();
  const customer     = customers.find(c => c.id === customerId);
  const customerName = customer ? customer.name : '';

  const txData = { id: id || generateId(), nota, date, customerId, customerName, service, pricePerKg, weight, totalCost, status, payment, note };

  let transactions = getTransactions();

  if (id) {
    // Update transaksi yang sudah ada
    const idx = transactions.findIndex(t => t.id === id);
    if (idx !== -1) transactions[idx] = txData;
  } else {
    // Tambah transaksi baru
    transactions.push(txData);
  }

  saveTransactions(transactions);

  // Tutup modal & refresh
  bootstrap.Modal.getInstance(document.getElementById('modalTransaction')).hide();
  renderTransactions();
  updateDashboard();
  showToast(id ? 'Transaksi berhasil diperbarui!' : 'Transaksi berhasil ditambahkan!', 'success');
}

/** Hapus transaksi */
function deleteTransaction(id) {
  if (!confirm('Yakin ingin menghapus transaksi ini?')) return;

  let transactions = getTransactions().filter(t => t.id !== id);
  saveTransactions(transactions);
  renderTransactions();
  updateDashboard();
  showToast('Transaksi berhasil dihapus!', 'danger');
}

/** Tampilkan detail transaksi */
function viewTransaction(id) {
  const tx = getTransactions().find(t => t.id === id);
  if (!tx) return;

  document.getElementById('detailBody').innerHTML = `
    <dl class="row mb-0">
      <dt class="col-5 text-muted">No. Nota</dt>
      <dd class="col-7 fw-semibold text-primary">${tx.nota}</dd>

      <dt class="col-5 text-muted">Tanggal</dt>
      <dd class="col-7">${formatDate(tx.date)}</dd>

      <dt class="col-5 text-muted">Pelanggan</dt>
      <dd class="col-7">${tx.customerName}</dd>

      <dt class="col-5 text-muted">Jenis Layanan</dt>
      <dd class="col-7">${tx.service}</dd>

      <dt class="col-5 text-muted">Harga / kg</dt>
      <dd class="col-7">${formatRupiah(tx.pricePerKg)}</dd>

      <dt class="col-5 text-muted">Berat</dt>
      <dd class="col-7">${tx.weight} kg</dd>

      <dt class="col-5 text-muted">Total Biaya</dt>
      <dd class="col-7 fw-bold fs-5 text-primary">${formatRupiah(tx.totalCost)}</dd>

      <dt class="col-5 text-muted">Status Pesanan</dt>
      <dd class="col-7">${statusBadge(tx.status)}</dd>

      <dt class="col-5 text-muted">Status Bayar</dt>
      <dd class="col-7">${paymentBadge(tx.payment)}</dd>

      ${tx.note ? `
      <dt class="col-5 text-muted">Catatan</dt>
      <dd class="col-7">${tx.note}</dd>
      ` : ''}
    </dl>
  `;

  new bootstrap.Modal(document.getElementById('modalDetail')).show();
}

/** Render tabel transaksi dengan filter & pencarian */
function renderTransactions() {
  const search  = (document.getElementById('searchTransaction')?.value || '').toLowerCase();
  const fStatus  = document.getElementById('filterStatus')?.value || '';
  const fPayment = document.getElementById('filterPayment')?.value || '';

  let data = getTransactions();

  // Filter berdasarkan pencarian
  if (search) {
    data = data.filter(t =>
      t.customerName.toLowerCase().includes(search) ||
      t.nota.toLowerCase().includes(search)
    );
  }

  // Filter status pesanan
  if (fStatus) data = data.filter(t => t.status === fStatus);

  // Filter status pembayaran
  if (fPayment) data = data.filter(t => t.payment === fPayment);

  const tbody = document.getElementById('transactionsBody');

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">Tidak ada data transaksi</td></tr>`;
    return;
  }

  // Urutkan dari terbaru
  data = [...data].reverse();

  tbody.innerHTML = data.map((t, i) => `
    <tr>
      <td><span class="fw-semibold text-primary">${t.nota}</span></td>
      <td>${formatDate(t.date)}</td>
      <td>${t.customerName}</td>
      <td>${t.service}</td>
      <td>${t.weight} kg</td>
      <td>${formatRupiah(t.totalCost)}</td>
      <td>${statusBadge(t.status)}</td>
      <td>${paymentBadge(t.payment)}</td>
      <td class="text-center">
        <div class="action-btns d-flex gap-1 justify-content-center">
          <button class="btn btn-sm btn-outline-info" title="Detail" onclick="viewTransaction('${t.id}')">
            <i class="bi bi-eye"></i>
          </button>
          <button class="btn btn-sm btn-outline-warning" title="Edit" onclick="openEditTransaction('${t.id}')">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" title="Hapus" onclick="deleteTransaction('${t.id}')">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

/** Reset semua filter transaksi */
function resetFilters() {
  document.getElementById('searchTransaction').value = '';
  document.getElementById('filterStatus').value      = '';
  document.getElementById('filterPayment').value     = '';
  renderTransactions();
}

/* =========================================
   CUSTOMERS — CRUD
   ========================================= */

/** Buka modal untuk MENAMBAH pelanggan */
function openAddCustomer() {
  resetCustomerForm();
  document.getElementById('modalCustomerLabel').textContent = 'Tambah Pelanggan';
  document.getElementById('custId').value = '';
}

/** Buka modal untuk MENGEDIT pelanggan */
function openEditCustomer(id) {
  const customers = getCustomers();
  const cust = customers.find(c => c.id === id);
  if (!cust) return;

  resetCustomerForm();
  document.getElementById('modalCustomerLabel').textContent = 'Edit Pelanggan';
  document.getElementById('custId').value      = cust.id;
  document.getElementById('custName').value    = cust.name;
  document.getElementById('custPhone').value   = cust.phone;
  document.getElementById('custAddress').value = cust.address;

  new bootstrap.Modal(document.getElementById('modalCustomer')).show();
}

/** Simpan pelanggan (tambah atau edit) */
function saveCustomer() {
  const form = document.getElementById('formCustomer');

  if (!form.checkValidity()) {
    form.classList.add('was-validated');
    return;
  }

  const id      = document.getElementById('custId').value;
  const name    = document.getElementById('custName').value.trim();
  const phone   = document.getElementById('custPhone').value.trim();
  const address = document.getElementById('custAddress').value.trim();

  const custData = { id: id || generateId(), name, phone, address };
  let customers  = getCustomers();

  if (id) {
    const idx = customers.findIndex(c => c.id === id);
    if (idx !== -1) customers[idx] = custData;
  } else {
    customers.push(custData);
  }

  saveCustomers(customers);

  bootstrap.Modal.getInstance(document.getElementById('modalCustomer')).hide();
  renderCustomers();
  showToast(id ? 'Data pelanggan diperbarui!' : 'Pelanggan berhasil ditambahkan!', 'success');
}

/** Hapus pelanggan */
function deleteCustomer(id) {
  // Cek apakah pelanggan masih punya transaksi
  const hasTx = getTransactions().some(t => t.customerId === id);
  if (hasTx) {
    showToast('Tidak bisa dihapus! Pelanggan masih punya transaksi.', 'danger');
    return;
  }

  if (!confirm('Yakin ingin menghapus pelanggan ini?')) return;

  const customers = getCustomers().filter(c => c.id !== id);
  saveCustomers(customers);
  renderCustomers();
  showToast('Pelanggan berhasil dihapus!', 'danger');
}

/** Render tabel pelanggan */
function renderCustomers() {
  const search = (document.getElementById('searchCustomer')?.value || '').toLowerCase();
  const transactions = getTransactions();

  let data = getCustomers();

  if (search) {
    data = data.filter(c => c.name.toLowerCase().includes(search));
  }

  const tbody = document.getElementById('customersBody');

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Tidak ada data pelanggan</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((c, i) => {
    const txCount = transactions.filter(t => t.customerId === c.id).length;
    return `
      <tr>
        <td>${i + 1}</td>
        <td><span class="fw-semibold">${c.name}</span></td>
        <td>${c.phone}</td>
        <td class="text-muted" style="max-width:180px">${c.address}</td>
        <td><span class="badge bg-primary rounded-pill">${txCount} transaksi</span></td>
        <td class="text-center">
          <div class="action-btns d-flex gap-1 justify-content-center">
            <button class="btn btn-sm btn-outline-warning" title="Edit" onclick="openEditCustomer('${c.id}')">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" title="Hapus" onclick="deleteCustomer('${c.id}')">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/* =========================================
   FORM HELPERS
   ========================================= */

/** Isi dropdown pelanggan di form transaksi */
function populateCustomerDropdown(selectedId = '') {
  const customers = getCustomers();
  const select    = document.getElementById('txCustomer');

  select.innerHTML = `<option value="">-- Pilih Pelanggan --</option>`;
  customers.forEach(c => {
    const opt      = document.createElement('option');
    opt.value      = c.id;
    opt.textContent = c.name;
    if (c.id === selectedId) opt.selected = true;
    select.appendChild(opt);
  });
}

/** Hitung otomatis total biaya saat layanan / berat berubah */
function calculateCost() {
  const serviceEl  = document.getElementById('txService');
  const weightEl   = document.getElementById('txWeight');
  const priceEl    = document.getElementById('txPricePerKg');
  const totalEl    = document.getElementById('txTotal');

  const selectedOption = serviceEl.options[serviceEl.selectedIndex];
  const pricePerKg     = parseInt(selectedOption?.dataset?.price || '0', 10);
  const weight         = parseFloat(weightEl.value) || 0;
  const total          = pricePerKg * weight;

  priceEl.value = pricePerKg > 0 ? formatRupiah(pricePerKg) : '';
  totalEl.value = total > 0      ? formatRupiah(total)       : '';
}

/** Reset form transaksi */
function resetTransactionForm() {
  const form = document.getElementById('formTransaction');
  form.reset();
  form.classList.remove('was-validated');
  document.getElementById('txPricePerKg').value = '';
  document.getElementById('txTotal').value      = '';
}

/** Reset form pelanggan */
function resetCustomerForm() {
  const form = document.getElementById('formCustomer');
  form.reset();
  form.classList.remove('was-validated');
}

/* =========================================
   UTILITY / HELPER FUNCTIONS
   ========================================= */

/** Generate ID unik sederhana */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Generate nomor nota otomatis
 * Format: SL-YYYYMMDD-XXX
 */
function generateNota() {
  const transactions = getTransactions();
  const today        = new Date();
  const yyyymmdd     = today.toISOString().slice(0, 10).replace(/-/g, '');
  const seq          = (transactions.length + 1).toString().padStart(3, '0');
  return `SL-${yyyymmdd}-${seq}`;
}

/** Tanggal hari ini format YYYY-MM-DD (untuk input[type=date]) */
function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

/** Format tanggal ke format lokal ID */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Format angka ke Rupiah */
function formatRupiah(num) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
}

/** Ambil harga per kg berdasarkan nama layanan */
function getServicePrice(service) {
  const prices = {
    'Cuci Kering':     5000,
    'Cuci Setrika':    7000,
    'Setrika Saja':    4000,
    'Laundry Express': 12000,
  };
  return prices[service] || 0;
}

/** Render badge status pesanan */
function statusBadge(status) {
  const map = {
    'Menunggu':    'status-menunggu',
    'Diproses':    'status-diproses',
    'Siap Diambil':'status-siap',
    'Selesai':     'status-selesai',
  };
  return `<span class="badge-status ${map[status] || ''}">${status}</span>`;
}

/** Render badge status pembayaran */
function paymentBadge(payment) {
  const cls = payment === 'Lunas' ? 'status-lunas' : 'status-belumbayar';
  return `<span class="badge-status ${cls}">${payment}</span>`;
}

/** Tampilkan toast notifikasi */
function showToast(message, type = 'success') {
  const toastEl = document.getElementById('toastNotif');
  const msgEl   = document.getElementById('toastMsg');

  // Warna background sesuai tipe
  toastEl.className = 'toast align-items-center border-0';
  if (type === 'success') toastEl.classList.add('bg-success', 'text-white');
  if (type === 'danger')  toastEl.classList.add('bg-danger', 'text-white');
  if (type === 'warning') toastEl.classList.add('bg-warning', 'text-dark');

  msgEl.textContent = message;

  const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
  toast.show();
}

/** Update jam di topbar setiap detik */
function startClock() {
  function tick() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    document.getElementById('topbarTime').textContent = timeStr;
  }
  tick();
  setInterval(tick, 1000);
}

/* =========================================
   SIDEBAR TOGGLE
   ========================================= */

function initSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const wrapper  = document.getElementById('mainWrapper');
  const toggleBtn = document.getElementById('sidebarToggle');

  // Buat overlay untuk mobile
  const overlay  = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  document.body.appendChild(overlay);

  toggleBtn.addEventListener('click', () => {
    if (window.innerWidth <= 576) {
      // Mobile: slide in/out
      sidebar.classList.toggle('mobile-open');
      overlay.classList.toggle('active');
    } else {
      // Desktop/tablet: collapse/expand
      sidebar.classList.toggle('collapsed');
      wrapper.classList.toggle('collapsed');
    }
  });

  // Klik overlay tutup sidebar di mobile
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('active');
  });
}

/* =========================================
   SIDEBAR NAVIGATION LISTENER
   ========================================= */

function initNavigation() {
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const page = link.dataset.page;
      if (page) navigateTo(page);
    });
  });
}

/* =========================================
   INIT — dijalankan saat halaman dimuat
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initNavigation();
  startClock();
  updateDashboard();  // Halaman awal adalah dashboard
});
