import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, writeBatch, query, where, arrayUnion, or } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAyBFPe2br0E_Nubc1ZYMGoTMh09vEKVCw",
  authDomain: "family-portal-79822.firebaseapp.com",
  projectId: "family-portal-79822",
  storageBucket: "family-portal-79822.firebasestorage.app",
  messagingSenderId: "825094653178",
  appId: "1:825094653178:web:fbbea49cab91cea744b543",
  measurementId: "G-CXX2Z9VN8V"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
auth.languageCode = 'ja';

let currentUser = null;
let currentBookId = null; 
let globalBooks = [];
let globalCategories = [];
let globalRecords = [];
let unsubscribeBooks = null;
let unsubscribeCategories = null;
let unsubscribeRecords = null;
let selectedRecordForModal = null; 

function showScreen(screenId) {
  document.querySelectorAll('.app-screen').forEach(s => s.classList.remove('active', 'hidden'));
  document.querySelectorAll('.app-screen').forEach(s => {
    if (s.id !== screenId) s.classList.add('hidden');
    else s.classList.add('active');
  });
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    showScreen('screen-mypage');
    subscribeToBooks(); 
  } else {
    currentUser = null;
    currentBookId = null;
    showScreen('screen-login');
    if (unsubscribeBooks) unsubscribeBooks();
    if (unsubscribeCategories) unsubscribeCategories();
    if (unsubscribeRecords) unsubscribeRecords();
  }
});

document.getElementById('show-register-btn').onclick = () => { document.getElementById('login-form-area').classList.add('hidden'); document.getElementById('register-form-area').classList.remove('hidden'); };
document.getElementById('show-login-btn').onclick = () => { document.getElementById('register-form-area').classList.add('hidden'); document.getElementById('login-form-area').classList.remove('hidden'); };

document.getElementById('login-form').onsubmit = async (e) => {
  e.preventDefault();
  try { await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value); }
  catch(error) { alert("ログインに失敗しました。認証情報を確認してください。"); }
};

document.getElementById('register-form').onsubmit = async (e) => {
  e.preventDefault();
  try { await createUserWithEmailAndPassword(auth, document.getElementById('register-email').value, document.getElementById('register-password').value); alert("アカウントを作成しました！"); }
  catch(error) { alert("エラー: " + error.message); }
};

document.getElementById('logout-btn').onclick = () => { if(confirm("ログアウトしますか？")) signOut(auth); };

function subscribeToBooks() {
  if (!currentUser) return;
  const q = query(collection(db, 'kakeibo_books'), or(where('uid', '==', currentUser.uid), where('members', 'array-contains', currentUser.uid)));
  
  unsubscribeBooks = onSnapshot(q, (snapshot) => {
    globalBooks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    globalBooks.sort((a, b) => a.createdAt - b.createdAt);
    
    const bookList = document.getElementById('book-list');
    bookList.innerHTML = '';
    
    if (globalBooks.length === 0) {
      bookList.innerHTML = '<li style="color:#666; padding:10px;">まだ家計簿がありません。</li>';
      return;
    }

    globalBooks.forEach(book => {
      const li = document.createElement('li');
      li.className = 'category-card book-card';
      
      // ★変更：3段レイアウト構築用のHTML構造
      li.innerHTML = `
        <div class="book-info">
          <span style="font-size:20px; margin-right:8px;">📘</span>
          <span>${book.name}</span>
        </div>
        <div class="book-actions-group primary">
          <button class="edit-btn rename-btn">編集</button>
          <button class="delete-btn">削除</button>
        </div>
        <div class="book-actions-group secondary">
          <button class="edit-btn invite-code-btn" style="border-color:#d97736; color:#d97736;">招待コード</button>
        </div>
      `;
      
      li.onclick = (e) => { if (e.target.tagName === 'BUTTON') return; openKakeibo(book.id, book.name); };
      
      li.querySelector('.invite-code-btn').onclick = () => {
        navigator.clipboard.writeText(book.id).then(() => { alert(`招待コード（ID）をコピーしました！\nこのコードを家族のマイページ画面で入力してもらってください。\n\nコード: ${book.id}`); })
        .catch(() => { alert(`手動でコピーしてください: ${book.id}`); });
      };
      
      li.querySelector('.rename-btn').onclick = async () => {
        const newName = prompt("新しい家計簿の名前を入力してください:", book.name);
        if (newName !== null && newName.trim() !== "") await updateDoc(doc(db, 'kakeibo_books', book.id), { name: newName.trim() });
      };
      
      li.querySelector('.delete-btn').onclick = async () => {
        if (confirm(`「${book.name}」を削除しますか？\n※全メンバーのマイページから表示されなくなります。`)) await deleteDoc(doc(db, 'kakeibo_books', book.id));
      };
      
      bookList.appendChild(li);
    });
  });
}

document.getElementById('create-book-form').onsubmit = async (e) => {
  e.preventDefault();
  const nameInput = document.getElementById('new-book-name');
  if (nameInput.value.trim()) {
    await addDoc(collection(db, 'kakeibo_books'), { name: nameInput.value.trim(), uid: currentUser.uid, members: [currentUser.uid], createdAt: Date.now() });
    nameInput.value = '';
  }
};

document.getElementById('join-book-form').onsubmit = async (e) => {
  e.preventDefault();
  const idInput = document.getElementById('join-book-id');
  if (idInput.value.trim()) {
    try {
      await updateDoc(doc(db, 'kakeibo_books', idInput.value.trim()), { members: arrayUnion(currentUser.uid) });
      alert("共有家計簿に参加しました！一覧を確認してください。"); idInput.value = '';
    } catch (err) { alert("参加に失敗しました。コードが正しいか確認してください。"); }
  }
};

function openKakeibo(bookId, bookName) {
  currentBookId = bookId;
  document.getElementById('current-book-name-display').textContent = `開いている家計簿：${bookName}`;
  showScreen('screen-kakeibo');
  subscribeToKakeiboData(); 
}

document.getElementById('back-to-mypage-btn').onclick = () => {
  currentBookId = null;
  if (unsubscribeCategories) unsubscribeCategories();
  if (unsubscribeRecords) unsubscribeRecords();
  showScreen('screen-mypage');
};

function subscribeToKakeiboData() {
  if (!currentUser || !currentBookId) return;

  const catQuery = query(collection(db, 'kakeibo_v2_categories'), where('bookId', '==', currentBookId));
  const recQuery = query(collection(db, 'kakeibo_v2_records'), where('bookId', '==', currentBookId));

  unsubscribeCategories = onSnapshot(catQuery, (snapshot) => {
    globalCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (globalCategories.length === 0) { initializeDefaultCategories(); return; }
    globalCategories.sort((a, b) => (a.order || 0) - (b.order || 0));
    displayCategories(); updateCategorySelect();
  });

  // ★リアルタイム更新（パートナーが編集したときにも即時反映）
  unsubscribeRecords = onSnapshot(recQuery, (snapshot) => {
    globalRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    displayRecords();
    displaySummary();
    
    // モーダル表示中に裏側でデータが更新・削除された場合の安全な同期
    if (selectedRecordForModal) {
      const updated = globalRecords.find(r => r.id === selectedRecordForModal.id);
      if (updated) {
        selectedRecordForModal = updated;
        // もし閲覧モードで開いているなら、最新のテキストに書き換える
        if (!document.getElementById('modal-view-mode').classList.contains('hidden')) {
          document.getElementById('modal-date').textContent = updated.date;
          document.getElementById('modal-type').textContent = updated.type;
          document.getElementById('modal-category').textContent = updated.category;
          document.getElementById('modal-amount').textContent = `${updated.amount.toLocaleString()} 円`;
          document.getElementById('modal-memo').textContent = updated.memo || '（なし）';
        }
      } else {
        closeModal();
      }
    }
  });
}

const navRecord = document.getElementById('nav-record'), navSummary = document.getElementById('nav-summary'), navSettings = document.getElementById('nav-settings');
const viewRecord = document.getElementById('view-record'), viewSummary = document.getElementById('view-summary'), viewSettings = document.getElementById('view-settings');

function switchView(showView, activeBtn) {
  [viewRecord, viewSummary, viewSettings].forEach(v => v.classList.add('hidden'));
  [navRecord, navSummary, navSettings].forEach(b => b.classList.remove('active'));
  showView.classList.remove('hidden'); activeBtn.classList.add('active');
  if (showView === viewSummary) displaySummary();
}
navRecord.onclick = () => switchView(viewRecord, navRecord);
navSummary.onclick = () => switchView(viewSummary, navSummary);
navSettings.onclick = () => switchView(viewSettings, navSettings);


let currentCategoryEditId = null;
const categoryForm = document.getElementById('category-form'), recordTypeSelect = document.getElementById('record-type');
const categorySelect = document.getElementById('category'), categorySubmitBtn = document.getElementById('category-submit-btn');

async function initializeDefaultCategories() {
  const defaultCats = [ { name: '食費', type: '変動費', order: 0 }, { name: '日用品', type: '変動費', order: 1 }, { name: '家賃', type: '固定費', order: 2 }, { name: '交通費', type: '変動費', order: 3 }, { name: 'その他', type: '変動費', order: 4 } ];
  const batch = writeBatch(db);
  defaultCats.forEach(cat => batch.set(doc(collection(db, 'kakeibo_v2_categories')), { ...cat, uid: currentUser.uid, bookId: currentBookId }));
  await batch.commit();
}

function updateCategorySelect() {
  categorySelect.innerHTML = '';
  globalCategories.filter(cat => cat.type === recordTypeSelect.value).forEach(cat => {
    const opt = document.createElement('option'); opt.value = cat.name; opt.textContent = cat.name; categorySelect.appendChild(opt);
  });
}
recordTypeSelect.addEventListener('change', updateCategorySelect);

function displayCategories() {
  const listVar = document.getElementById('category-list-variable'), listFix = document.getElementById('category-list-fixed');
  listVar.innerHTML = ''; listFix.innerHTML = '';
  globalCategories.forEach((cat) => {
    const li = document.createElement('li'); li.dataset.id = cat.id; li.className = 'category-card category-item';
    const typeClass = cat.type === '固定費' ? 'type-fixed' : 'type-variable';
    li.innerHTML = `<div class="category-item-left"><span class="drag-handle">≡</span><span><span class="type-label ${typeClass}">${cat.type}</span>${cat.name}</span></div><div class="category-actions"><button class="edit-btn">編集</button><button class="delete-btn">削除</button></div>`;
    
    li.querySelector('.edit-btn').onclick = () => {
      document.getElementById('new-category').value = cat.name; document.getElementById('new-category-type').value = cat.type;
      currentCategoryEditId = cat.id; categorySubmitBtn.textContent = '更新';
      document.getElementById('new-category').classList.add('edit-mode-input'); categorySubmitBtn.classList.add('edit-mode-btn');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    li.querySelector('.delete-btn').onclick = async () => {
      if (confirm(`カテゴリ「${cat.name}」を削除しますか？`)) {
        await deleteDoc(doc(db, 'kakeibo_v2_categories', cat.id));
        if (currentCategoryEditId === cat.id) { currentCategoryEditId = null; categorySubmitBtn.textContent = '追加'; document.getElementById('new-category').value = ''; document.getElementById('new-category').classList.remove('edit-mode-input'); categorySubmitBtn.classList.remove('edit-mode-btn'); }
      }
    };
    if (cat.type === '固定費') listFix.appendChild(li); else listVar.appendChild(li);
  });
}

categoryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('new-category').value.trim(), type = document.getElementById('new-category-type').value;
  if (name !== '') {
    if (currentCategoryEditId) {
      const oldName = globalCategories.find(c => c.id === currentCategoryEditId).name;
      const batch = writeBatch(db);
      batch.update(doc(db, 'kakeibo_v2_categories', currentCategoryEditId), { name, type });
      globalRecords.filter(r => r.category === oldName).forEach(r => batch.update(doc(db, 'kakeibo_v2_records', r.id), { category: name, type }));
      await batch.commit();
      currentCategoryEditId = null; categorySubmitBtn.textContent = '追加';
      document.getElementById('new-category').classList.remove('edit-mode-input'); categorySubmitBtn.classList.remove('edit-mode-btn');
    } else {
      await addDoc(collection(db, 'kakeibo_v2_categories'), { name, type, order: globalCategories.length, uid: currentUser.uid, bookId: currentBookId });
    }
    document.getElementById('new-category').value = '';
  }
});

// 新規記録フォーム
const form = document.getElementById('kakeibo-form');
const recordList = document.getElementById('record-list');
const recordMonthInput = document.getElementById('record-month');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    date: document.getElementById('date').value, type: document.getElementById('record-type').value,
    category: document.getElementById('category').value, amount: parseInt(document.getElementById('amount').value, 10),
    memo: document.getElementById('memo').value.trim(), uid: currentUser.uid, bookId: currentBookId
  };
  await addDoc(collection(db, 'kakeibo_v2_records'), data);
  document.getElementById('amount').value = ''; document.getElementById('memo').value = '';
});

function displayRecords() {
  recordList.innerHTML = '';
  const month = recordMonthInput.value;
  let displayData = globalRecords.filter(r => !month || r.date.startsWith(month));
  displayData.sort((a, b) => new Date(b.date) - new Date(a.date));

  displayData.forEach(item => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="record-minimal-left">
        <span class="record-minimal-date">${item.date.substring(5)}</span>
        <span class="record-minimal-cat">【${item.category}】${item.memo ? item.memo : ''}</span>
      </div>
      <span class="record-minimal-amount">${item.amount.toLocaleString()}円</span>
    `;
    li.onclick = () => openModal(item);
    recordList.appendChild(li);
  });
}
recordMonthInput.addEventListener('change', displayRecords);


// ★変更：モーダル内での編集機能の制御
const detailModal = document.getElementById('detail-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalViewMode = document.getElementById('modal-view-mode');
const modalEditMode = document.getElementById('modal-edit-mode');
const modalTitle = document.getElementById('modal-title');
const modalEditCategorySelect = document.getElementById('modal-edit-category');

function updateModalEditCategorySelect(selectedType) {
  modalEditCategorySelect.innerHTML = '';
  globalCategories.filter(cat => cat.type === selectedType).forEach(cat => {
    const opt = document.createElement('option'); 
    opt.value = cat.name; opt.textContent = cat.name; 
    modalEditCategorySelect.appendChild(opt);
  });
}

document.getElementById('modal-edit-type').addEventListener('change', (e) => {
  updateModalEditCategorySelect(e.target.value);
});

function openModal(item) {
  selectedRecordForModal = item;
  
  // モーダルを開くときは常に閲覧モードにする
  modalViewMode.classList.remove('hidden');
  modalEditMode.classList.add('hidden');
  modalTitle.textContent = '記録の詳細';

  // 閲覧用のデータをセット
  document.getElementById('modal-date').textContent = item.date;
  document.getElementById('modal-type').textContent = item.type;
  document.getElementById('modal-category').textContent = item.category;
  document.getElementById('modal-amount').textContent = `${item.amount.toLocaleString()} 円`;
  document.getElementById('modal-memo').textContent = item.memo || '（なし）';
  
  detailModal.classList.add('active');
}

function closeModal() {
  detailModal.classList.remove('active');
  selectedRecordForModal = null;
}

modalCloseBtn.onclick = closeModal;
detailModal.onclick = (e) => { if (e.target === detailModal) closeModal(); };

// モーダル内「編集する」ボタン
document.getElementById('modal-edit-btn').onclick = () => {
  modalViewMode.classList.add('hidden');
  modalEditMode.classList.remove('hidden');
  modalTitle.textContent = '記録の編集';

  const item = selectedRecordForModal;
  document.getElementById('modal-edit-date').value = item.date;
  document.getElementById('modal-edit-type').value = item.type;
  
  updateModalEditCategorySelect(item.type);
  document.getElementById('modal-edit-category').value = item.category;
  
  document.getElementById('modal-edit-amount').value = item.amount;
  document.getElementById('modal-edit-memo').value = item.memo;
};

// モーダル内「キャンセル」ボタン
document.getElementById('modal-cancel-btn').onclick = () => {
  modalViewMode.classList.remove('hidden');
  modalEditMode.classList.add('hidden');
  modalTitle.textContent = '記録の詳細';
};

// モーダル内「更新する」ボタン
document.getElementById('modal-save-btn').onclick = async () => {
  if (!selectedRecordForModal) return;
  const data = {
    date: document.getElementById('modal-edit-date').value,
    type: document.getElementById('modal-edit-type').value,
    category: document.getElementById('modal-edit-category').value,
    amount: parseInt(document.getElementById('modal-edit-amount').value, 10),
    memo: document.getElementById('modal-edit-memo').value.trim()
  };
  
  // Firebaseのデータを更新
  await updateDoc(doc(db, 'kakeibo_v2_records', selectedRecordForModal.id), data);
  
  // 更新が完了したら閲覧モードに戻す
  modalViewMode.classList.remove('hidden');
  modalEditMode.classList.add('hidden');
  modalTitle.textContent = '記録の詳細';
};

document.getElementById('modal-delete-btn').onclick = async () => {
  if (!selectedRecordForModal) return;
  if (confirm('この記録を削除しますか？')) {
    const idToDelete = selectedRecordForModal.id;
    closeModal();
    await deleteDoc(doc(db, 'kakeibo_v2_records', idToDelete));
  }
};

let summaryChart = null;
const summaryMonthInput = document.getElementById('summary-month');
const chartTypeSelect = document.getElementById('chart-type');

function displaySummary() {
  const month = summaryMonthInput.value;
  const filtered = globalRecords.filter(r => r.date.startsWith(month));
  const totals = { fixed: 0, variable: 0, cats: {} };

  filtered.forEach(r => {
    if (r.type === '固定費') totals.fixed += r.amount; else totals.variable += r.amount;
    totals.cats[r.category] = (totals.cats[r.category] || 0) + r.amount;
  });

  document.getElementById('total-amount').textContent = (totals.fixed + totals.variable).toLocaleString();
  document.getElementById('total-fixed').textContent = totals.fixed.toLocaleString();
  document.getElementById('total-variable').textContent = totals.variable.toLocaleString();

  const type = chartTypeSelect.value;
  let labels = [], data = [];
  if (type === 'type') { labels = ['固定費', '変動費']; data = [totals.fixed, totals.variable]; } 
  else {
    const sorted = Object.entries(totals.cats).filter(([name]) => {
      const c = globalCategories.find(cat => cat.name === name);
      return type === 'all' || (type === 'fixed' && c?.type === '固定費') || (type === 'variable' && c?.type === '変動費');
    }).sort((a, b) => b[1] - a[1]);
    labels = sorted.map(s => s[0]); data = sorted.map(s => s[1]);
  }

  document.getElementById('summary-category-list').innerHTML = labels.map((l, i) => `<li><span>【${l}】</span><span>${data[i].toLocaleString()}円</span></li>`).join('');
  drawChart(labels, data);
}

function drawChart(labels, data) {
  const ctx = document.getElementById('category-chart').getContext('2d');
  if (summaryChart) summaryChart.destroy();
  summaryChart = new Chart(ctx, { type: 'doughnut', data: { labels, datasets: [{ data, backgroundColor: ['#E07A5F', '#3D405B', '#81B29A', '#F2CC8F', '#E8A598', '#6F7C85', '#A2D2FF', '#FFB703', '#219EBC'], borderWidth: 2, borderColor: '#ffffff' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } } });
}
summaryMonthInput.addEventListener('change', displaySummary);
chartTypeSelect.addEventListener('change', displaySummary);

document.addEventListener('DOMContentLoaded', () => {
  const d = new Date(); const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; const month = today.substring(0, 7);
  document.getElementById('date').value = today; summaryMonthInput.value = month; recordMonthInput.value = month;

  const updateOrder = async (listId) => {
    const batch = writeBatch(db); let i = 0;
    Array.from(document.getElementById(listId).children).forEach(li => { if(li.dataset.id) batch.update(doc(db, 'kakeibo_v2_categories', li.dataset.id), { order: i++ }); });
    await batch.commit();
  };
  new Sortable(document.getElementById('category-list-variable'), { animation: 150, handle: '.drag-handle', onEnd: () => updateOrder('category-list-variable') });
  new Sortable(document.getElementById('category-list-fixed'), { animation: 150, handle: '.drag-handle', onEnd: () => updateOrder('category-list-fixed') });
});
