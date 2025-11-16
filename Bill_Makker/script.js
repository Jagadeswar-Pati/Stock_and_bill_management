const L = s => document.querySelector(s);
const format = n => '₹' + (parseFloat(n || 0)).toFixed(2);

const today = new Date();
L('#invoiceDate').value = `${String(today.getDate()).padStart(2,'0')}-${String(today.getMonth()+1).padStart(2,'0')}-${today.getFullYear()}`;

let items = [
  { desc: "10k Ohm Potentiometer", gst: 18, qty: 10, rate: 7.63, total: 0 },
  { desc: "Flex Sensor 2.2\"", gst: 12, qty: 5, rate: 190.68, total: 0 }
];

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m]));
}

function updateTotalsFromRate(it) {
  const amt = it.qty * it.rate;
  const gstAmt = amt * (it.gst / 100);
  it.total = amt + gstAmt;
}

function updateRateFromTotal(it) {
  const totalWithoutQty = it.total / it.qty;
  it.rate = totalWithoutQty / (1 + it.gst / 100);
}

function renderEditorRows() {
  const c = L('#itemsContainer');
  c.innerHTML = '';

  items.forEach((it, i) => {
    updateTotalsFromRate(it); // keep synced
    const row = document.createElement('div');
    row.innerHTML = `
      <input data-i="${i}" class="desc" style="flex:1" value="${it.desc}">
      <input data-i="${i}" class="gst" type="number" value="${it.gst}" style="width:60px" placeholder="GST%">
      <input data-i="${i}" class="qty" type="number" value="${it.qty}" style="width:60px" placeholder="Qty">
      <input data-i="${i}" class="rate" type="number" value="${it.rate.toFixed(2)}" style="width:80px" placeholder="Rate (excl)">
      <input data-i="${i}" class="total" type="number" value="${it.total.toFixed(2)}" style="width:90px" placeholder="Total (incl)">
      <button class="btn secondary" data-remove="${i}" style="padding:4px 6px">X</button>`;
    c.appendChild(row);
  });

  if (!items.length) c.innerHTML = '<div class="muted">No items</div>';

  // Handle inputs
  c.querySelectorAll('input').forEach(inp => {
    inp.onchange = e => {
      const i = +e.target.dataset.i;
      const v = parseFloat(e.target.value) || 0;
      const it = items[i];

      if (e.target.classList.contains('desc')) it.desc = e.target.value;
      if (e.target.classList.contains('gst')) it.gst = v;
      if (e.target.classList.contains('qty')) it.qty = v;

      if (e.target.classList.contains('rate')) {
        it.rate = v;
        updateTotalsFromRate(it);
      }
      if (e.target.classList.contains('total')) {
        it.total = v;
        updateRateFromTotal(it);
      }

      renderEditorRows();
      renderPreview();
    };
  });

  // Handle remove
  c.querySelectorAll('[data-remove]').forEach(btn => 
    btn.onclick = e => {
      items.splice(+e.target.dataset.remove, 1);
      renderEditorRows();
      renderPreview();
    });
}

function renderPreview() {
  L('#brandName').textContent = L('#fromName').value;
  L('#brandDetails').innerHTML = escapeHtml(L('#fromDetails').value).replace(/\n/g,'<br>');
  L('#metaInvoiceNo').textContent = L('#invoiceNo').value;
  L('#metaDate').textContent = L('#invoiceDate').value;
  L('#billTo').innerHTML = escapeHtml(L('#clientName').value)+'<br>'+escapeHtml(L('#clientDetails').value).replace(/\n/g,'<br>');

  const mode = L('#gstMode').value;
  const globalGST = parseFloat(L('#taxPercent').value) || 0;
  let subtotal = 0, totalGST = 0;

  const tb = L('#itemsTableBody');
  tb.innerHTML = '';

  items.forEach((it, i) => {
    const gst = mode === 'individual' ? it.gst : globalGST;
    const amt = it.qty * it.rate;
    const cgst = (amt * gst / 100) / 2, sgst = cgst;
    const total = amt + cgst + sgst;
    subtotal += amt; totalGST += cgst + sgst;

    tb.innerHTML += `<tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(it.desc)}</td>
      <td>${gst.toFixed(2)}</td>
      <td>${it.qty}</td>
      <td class="num">${it.rate.toFixed(2)}</td>
      <td class="num">${amt.toFixed(2)}</td>
      <td class="num">${cgst.toFixed(2)}</td>
      <td class="num">${sgst.toFixed(2)}</td>
      <td class="num">${total.toFixed(2)}</td>
    </tr>`;
  });

  const discount = parseFloat(L('#discount').value) || 0;
  const grand = subtotal - discount + totalGST;

  L('#subtotal').textContent = format(subtotal);
  L('#discountVal').textContent = format(discount);
  L('#taxVal').textContent = format(totalGST);
  L('#grandTotal').textContent = format(grand);
  L('#bankPreview').innerHTML = escapeHtml(L('#bankDetails').value).replace(/\n/g,'<br>');
  L('#notesPreview').innerHTML = escapeHtml(L('#notes').value).replace(/\n/g,'<br>');
}

// Button handlers
L('#addRow').onclick = () => {
  items.push({ desc: 'New Item', gst: 18, qty: 1, rate: 0, total: 0 });
  renderEditorRows();
};
L('#clearRows').onclick = () => {
  if (confirm('Clear all items?')) {
    items = [];
    renderEditorRows();
    renderPreview();
  }
};
L('#renderBtn').onclick = renderPreview;
L('#printBtn').onclick = () => window.print();

L('#downloadPdf').onclick = async () => {
  renderPreview();
  await html2pdf().set({
    margin: [10 / 25.4, 10 / 25.4, 10 / 25.4, 10 / 25.4],
    filename: (L('#invoiceNo').value || 'invoice') + '.pdf',
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  }).from(L('#invoicePreview')).save();
};

['#fromName', '#fromDetails', '#clientName', '#clientDetails', '#invoiceNo', '#invoiceDate', '#discount', '#bankDetails', '#notes', '#taxPercent', '#gstMode']
.forEach(sel => L(sel).addEventListener('input', renderPreview));

L('#logoInput').onchange = e => {
  const f = e.target.files?.[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = ev => {
    L('#logoPreview').src = ev.target.result;
    L('#logoPreview').style.display = 'block';
  };
  r.readAsDataURL(f);
};

renderEditorRows();
renderPreview();
