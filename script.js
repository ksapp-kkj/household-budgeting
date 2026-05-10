// ==========================================
// 1. Firebaseの初期化と設定
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

// ご提供いただいた最新の鍵
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

// クラウドから取得したデータを保持する変数
let globalCategories = [];
let globalRecords = [];

// ==========================================
// 2. 画面切り替え（ナビゲーション）の処理
// ==========================================
const navRecord = document.getElementById('nav-record');
const navSummary = document.getElementById('nav-summary');
const navSettings = document.getElementById('nav-settings');

const viewRecord = document.getElementById('view-record');
const viewSummary = document.getElementById('view-summary');
const viewSettings = document.getElementById('view-settings');

function switchView(showView, activeBtn) {
  viewRecord.classList.add('hidden');
  viewSummary.classList.add('hidden');
  viewSettings.classList.add('hidden');
  
  navRecord.classList.remove('active');
  navSummary.classList.remove('active');
  navSettings.classList.remove('active');
  
  showView.classList.remove('hidden');
  activeBtn.classList.add('active');

  if (showView === viewSummary) {
    displaySummary();
  }
}

navRecord.addEventListener('click', () => switchView(viewRecord, navRecord));
navSummary.addEventListener('click', () => switchView(viewSummary, navSummary));
navSettings.addEventListener('click', () => switchView(viewSettings, navSettings));


// ==========================================
// 3. カテゴリの管理処理 (Firebase連携)
// ==========================================
const categoryForm = document.getElementById('category-form');
const recordTypeSelect = document.getElementById('record-type');
const categorySelect = document.getElementById('category');
const categorySubmitBtn = document.getElementById('category-submit-btn');

let currentCategoryEditId = null;

// 初回起動時にデフォルトカテゴリをFirebaseに登録
async function initializeDefaultCategories() {
  const defaultCategories = [
    { name: '食費', type: '変動費', order: 0 },
    { name: '日用品', type: '変動費', order: 1 },
    { name: '家賃', type: '固定費', order: 2 },
    { name: '交通費', type: '変動費', order: 3 },
    { name: 'その他', type: '変動費', order: 4 }
  ];
  const batch = writeBatch(db);
  defaultCategories.forEach(cat => {
    const newDocRef = doc(collection(db, 'kakeibo_v2_categories'));
    batch.set(newDocRef, cat);
  });
  await batch.commit();
}

// リアルタイム同期（カテゴリ）
onSnapshot(collection(db, 'kakeibo_v2_categories'), (snapshot) => {
  globalCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  if (globalCategories.length === 0) {
    initializeDefaultCategories();
    return;
  }
  
  globalCategories.sort((a, b) => (a.order || 0) - (b.order || 0));
  displayCategories();
  updateCategorySelect();
});

// ドラッグ＆ドロップ後の並び順保存
async function updateCategoriesOrder() {
  const batch = writeBatch(db);
  let orderIndex = 0;
  
  const listVariable = document.getElementById('category-list-variable');
  const listFixed = document.getElementById('category-list-fixed');

  Array.from(listVariable.children).forEach(li => {
    if (li.dataset.id) {
      batch.update(doc(db, 'kakeibo_v2_categories', li.dataset.id), { order: orderIndex++ });
    }
  });

  Array.from(listFixed.children).forEach(li => {
    if (li.dataset.id) {
      batch.update(doc(db, 'kakeibo_v2_categories', li.dataset.id), { order: orderIndex++ });
    }
  });

  await batch.commit();
}

function updateCategorySelect() {
  const currentType = recordTypeSelect.value;
  categorySelect.innerHTML = '';
  
  const filteredCategories = globalCategories.filter(cat => cat.type === currentType);
  filteredCategories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat.name;
    option.textContent = cat.name;
    categorySelect.appendChild(option);
  });
}

recordTypeSelect.addEventListener('change', updateCategorySelect);

function setCategoryEditMode(isEdit) {
  const inputs = ['new-category', 'new-category-type'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (isEdit) el.classList.add('edit-mode-input');
    else el.classList.remove('edit-mode-input');
  });
  
  if (isEdit) categorySubmitBtn.classList.add('edit-mode-btn');
  else categorySubmitBtn.classList.remove('edit-mode-btn');
}

function displayCategories() {
  const listVariable = document.getElementById('category-list-variable');
  const listFixed = document.getElementById('category-list-fixed');
  
  listVariable.innerHTML = '';
  listFixed.innerHTML = '';

  globalCategories.forEach((cat) => {
    const li = document.createElement('li');
    li.dataset.id = cat.id; 
    li.className = 'category-card'; 

    const leftDiv = document.createElement('div');
    leftDiv.className = 'category-item-left';

    const dragHandle = document.createElement('span');
    dragHandle.className = 'drag-handle';
    dragHandle.textContent = '≡';

    const typeClass = cat.type === '固定費' ? 'type-fixed' : 'type-variable';
    const nameSpan = document.createElement('span');
    nameSpan.innerHTML = `<span class="type-label ${typeClass}">${cat.type}</span>${cat.name}`;
    
    leftDiv.appendChild(dragHandle);
    leftDiv.appendChild(nameSpan);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'category-actions';

    const editBtn = document.createElement('button');
    editBtn.textContent = '編集';
    editBtn.className = 'edit-btn';
    editBtn.onclick = () => {
      document.getElementById('new-category').value = cat.name;
      document.getElementById('new-category-type').value = cat.type;
      
      currentCategoryEditId = cat.id;
      categorySubmitBtn.textContent = '更新';
      setCategoryEditMode(true); 
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '削除';
    deleteBtn.className = 'delete-btn';
    deleteBtn.onclick = async () => {
      if (confirm(`カテゴリ「${cat.name}」を削除しますか？\n※過去の記録はそのまま残りますが、集計などでカテゴリなし扱いになる場合があります。`)) {
        await deleteDoc(doc(db, 'kakeibo_v2_categories', cat.id));
        
        if (currentCategoryEditId === cat.id) {
          currentCategoryEditId = null;
          categorySubmitBtn.textContent = '追加';
          document.getElementById('new-category').value = '';
          setCategoryEditMode(false);
        }
      }
    };

    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);
    li.appendChild(leftDiv);
    li.appendChild(actionsDiv);

    if (cat.type === '固定費') {
      listFixed.appendChild(li);
    } else {
      listVariable.appendChild(li);
    }
  });
}

categoryForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  const newCategoryInput = document.getElementById('new-category');
  const newCategoryType = document.getElementById('new-category-type').value;
  const newCategoryName = newCategoryInput.value.trim();

  if (newCategoryName !== '') {
    if (currentCategoryEditId) {
      // 編集：カテゴリ名が変わったら、過去の記録のカテゴリ名も一括変更
      const oldCategoryName = globalCategories.find(c => c.id === currentCategoryEditId).name;
      const batch = writeBatch(db);
      
      batch.update(doc(db, 'kakeibo_v2_categories', currentCategoryEditId), { name: newCategoryName, type: newCategoryType });
      
      globalRecords.forEach(record => {
        if (record.category === oldCategoryName) {
          batch.update(doc(db, 'kakeibo_v2_records', record.id), { category: newCategoryName, type: newCategoryType });
        }
      });
      
      await batch.commit();
      
      currentCategoryEditId = null;
      categorySubmitBtn.textContent = '追加';
      setCategoryEditMode(false); 
    } else {
      // 新規追加
      const newOrder = globalCategories.length;
      await addDoc(collection(db, 'kakeibo_v2_categories'), { name: newCategoryName, type: newCategoryType, order: newOrder });
    }
    newCategoryInput.value = '';
  }
});


// ==========================================
// 4. 支出の記録・表示・編集・削除処理 (Firebase連携)
// ==========================================
const form = document.getElementById('kakeibo-form');
const recordList = document.getElementById('record-list');
const submitBtn = document.getElementById('submit-btn');
const recordMonthInput = document.getElementById('record-month'); 

recordMonthInput.addEventListener('change', displayRecords);

let currentEditId = null;

// リアルタイム同期（支出記録）
onSnapshot(collection(db, 'kakeibo_v2_records'), (snapshot) => {
  globalRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  displayRecords();
  displaySummary();
});

function setExpenseEditMode(isEdit) {
  const inputs = ['date', 'record-type', 'category', 'amount', 'memo'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (isEdit) el.classList.add('edit-mode-input');
    else el.classList.remove('edit-mode-input');
  });
  
  if (isEdit) submitBtn.classList.add('edit-mode-btn');
  else submitBtn.classList.remove('edit-mode-btn');
}

form.addEventListener('submit', async function(e) {
  e.preventDefault();

  const date = document.getElementById('date').value;
  const categoryType = document.getElementById('record-type').value;
  const categoryName = document.getElementById('category').value;
  const amount = parseInt(document.getElementById('amount').value, 10);
  const memo = document.getElementById('memo').value.trim();

  const recordData = { date, category: categoryName, type: categoryType, amount, memo };

  if (currentEditId) {
    await updateDoc(doc(db, 'kakeibo_v2_records', currentEditId), recordData);
    currentEditId = null;
    submitBtn.textContent = '記録を保存';
    setExpenseEditMode(false); 
  } else {
    await addDoc(collection(db, 'kakeibo_v2_records'), recordData);
  }

  document.getElementById('amount').value = '';
  document.getElementById('memo').value = '';
});

function displayRecords() {
  recordList.innerHTML = '';
  let displayData = [...globalRecords];

  const selectedMonth = recordMonthInput.value;
  if (selectedMonth) {
    displayData = displayData.filter(record => record.date.startsWith(selectedMonth));
  }

  displayData.sort((a, b) => new Date(b.date) - new Date(a.date));

  displayData.forEach(item => {
    const li = document.createElement('li');

    let typeHtml = '';
    if (item.type) {
      const typeClass = item.type === '固定費' ? 'type-fixed' : 'type-variable';
      typeHtml = `<span class="type-label ${typeClass}">${item.type}</span>`;
    }

    const infoDiv = document.createElement('div');
    infoDiv.className = 'record-info';
    infoDiv.innerHTML = `<span>${item.date} ${typeHtml}【${item.category}】</span>`;
    
    if (item.memo) {
      const memoSpan = document.createElement('span');
      memoSpan.className = 'record-memo';
      memoSpan.textContent = item.memo;
      infoDiv.appendChild(memoSpan);
    }

    const rightDiv = document.createElement('div');
    rightDiv.className = 'record-actions';
    
    const amountSpan = document.createElement('span');
    amountSpan.className = 'record-amount';
    amountSpan.textContent = `${item.amount.toLocaleString()}円`;

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'action-buttons';

    const editBtn = document.createElement('button');
    editBtn.textContent = '編集';
    editBtn.className = 'edit-btn';
    editBtn.onclick = () => {
      document.getElementById('date').value = item.date;
      document.getElementById('record-type').value = item.type || '変動費';
      updateCategorySelect();
      document.getElementById('category').value = item.category;
      document.getElementById('amount').value = item.amount;
      document.getElementById('memo').value = item.memo || '';
      
      currentEditId = item.id;
      submitBtn.textContent = '記録を更新';
      setExpenseEditMode(true); 
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '削除';
    deleteBtn.className = 'delete-btn';
    deleteBtn.onclick = async () => {
      if (confirm('この記録を削除しますか？')) {
        await deleteDoc(doc(db, 'kakeibo_v2_records', item.id));
        
        if (currentEditId === item.id) {
          currentEditId = null;
          submitBtn.textContent = '記録を保存';
          document.getElementById('amount').value = '';
          document.getElementById('memo').value = '';
          setExpenseEditMode(false);
        }
      }
    };

    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);
    rightDiv.appendChild(amountSpan);
    rightDiv.appendChild(actionsDiv);

    li.appendChild(infoDiv);
    li.appendChild(rightDiv);
    recordList.appendChild(li);
  });
}


// ==========================================
// 5. 集計とグラフ描画処理
// ==========================================
let summaryChart = null;
const summaryMonthInput = document.getElementById('summary-month');
const chartTypeSelect = document.getElementById('chart-type'); 

summaryMonthInput.addEventListener('change', displaySummary);
chartTypeSelect.addEventListener('change', displaySummary);

function displaySummary() {
  const selectedMonth = summaryMonthInput.value;
  const chartType = chartTypeSelect.value; 

  let total = 0;
  let fixedTotal = 0;
  let variableTotal = 0;
  
  let allCategoryTotals = {};
  let fixedCategoryTotals = {};
  let variableCategoryTotals = {};

  const filteredRecords = globalRecords.filter(record => {
    return record.date.startsWith(selectedMonth);
  });

  filteredRecords.forEach(record => {
    total += record.amount;
    allCategoryTotals[record.category] = (allCategoryTotals[record.category] || 0) + record.amount;
    
    if (record.type === '固定費') {
      fixedTotal += record.amount;
      fixedCategoryTotals[record.category] = (fixedCategoryTotals[record.category] || 0) + record.amount;
    } else {
      variableTotal += record.amount;
      variableCategoryTotals[record.category] = (variableCategoryTotals[record.category] || 0) + record.amount;
    }
  });

  document.getElementById('total-amount').textContent = total.toLocaleString();
  document.getElementById('total-fixed').textContent = fixedTotal.toLocaleString();
  document.getElementById('total-variable').textContent = variableTotal.toLocaleString();

  const chartLabels = [];
  const chartData = [];

  if (chartType === 'type') {
    if (fixedTotal > 0) { chartLabels.push('固定費'); chartData.push(fixedTotal); }
    if (variableTotal > 0) { chartLabels.push('変動費'); chartData.push(variableTotal); }
  } else if (chartType === 'fixed') {
    const sorted = Object.entries(fixedCategoryTotals).sort((a, b) => b[1] - a[1]);
    for (const [cat, amt] of sorted) { chartLabels.push(cat); chartData.push(amt); }
  } else if (chartType === 'variable') {
    const sorted = Object.entries(variableCategoryTotals).sort((a, b) => b[1] - a[1]);
    for (const [cat, amt] of sorted) { chartLabels.push(cat); chartData.push(amt); }
  } else {
    const sorted = Object.entries(allCategoryTotals).sort((a, b) => b[1] - a[1]);
    for (const [cat, amt] of sorted) { chartLabels.push(cat); chartData.push(amt); }
  }

  const summaryCategoryList = document.getElementById('summary-category-list');
  summaryCategoryList.innerHTML = '';
  
  for (let i = 0; i < chartLabels.length; i++) {
    const li = document.createElement('li');
    li.innerHTML = `<span>【${chartLabels[i]}】</span> <span>${chartData[i].toLocaleString()}円</span>`;
    summaryCategoryList.appendChild(li);
  }

  drawChart(chartLabels, chartData);
}

function drawChart(labels, data) {
  const ctx = document.getElementById('category-chart').getContext('2d');
  
  if (summaryChart) {
    summaryChart.destroy();
  }

  const colorfulPalette = [
    '#E07A5F', '#3D405B', '#81B29A', '#F2CC8F', '#E8A598', 
    '#6F7C85', '#A2D2FF', '#FFB703', '#219EBC'
  ];

  summaryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colorfulPalette,
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
        }
      }
    }
  });
}


// ==========================================
// 6. 画面読み込み時の初期化処理
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  
  const todayStr = `${year}-${month}-${day}`;
  const currentMonthStr = `${year}-${month}`;
  
  document.getElementById('date').value = todayStr;
  summaryMonthInput.value = currentMonthStr;
  recordMonthInput.value = currentMonthStr; 
  
  // ドラッグ＆ドロップの設定
  const listVariable = document.getElementById('category-list-variable');
  const listFixed = document.getElementById('category-list-fixed');

  new Sortable(listVariable, {
    animation: 150,
    handle: '.drag-handle',
    onEnd: updateCategoriesOrder
  });

  new Sortable(listFixed, {
    animation: 150,
    handle: '.drag-handle',
    onEnd: updateCategoriesOrder
  });
});
