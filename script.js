// ==========================================
// 1. 画面切り替え（ナビゲーション）の処理
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
// 2. カテゴリの管理処理
// ==========================================
const categoryForm = document.getElementById('category-form');
const recordTypeSelect = document.getElementById('record-type');
const categorySelect = document.getElementById('category');
const categorySubmitBtn = document.getElementById('category-submit-btn');

let currentCategoryEditIndex = -1;

const defaultCategories = [
  { name: '食費', type: '変動費' },
  { name: '日用品', type: '変動費' },
  { name: '家賃', type: '固定費' },
  { name: '交通費', type: '変動費' },
  { name: 'その他', type: '変動費' }
];

function getCategories() {
  let categories = JSON.parse(localStorage.getItem('kakeiboCategories')) || defaultCategories;
  if (categories.length > 0 && typeof categories[0] === 'string') {
    categories = categories.map(catName => ({ name: catName, type: '変動費' }));
    localStorage.setItem('kakeiboCategories', JSON.stringify(categories));
  }
  return categories;
}

function updateCategoriesOrder() {
  const newCategories = [];
  const listVariable = document.getElementById('category-list-variable');
  const listFixed = document.getElementById('category-list-fixed');

  Array.from(listVariable.children).forEach(li => {
    if (li.dataset.name) newCategories.push({ name: li.dataset.name, type: '変動費' });
  });
  Array.from(listFixed.children).forEach(li => {
    if (li.dataset.name) newCategories.push({ name: li.dataset.name, type: '固定費' });
  });

  localStorage.setItem('kakeiboCategories', JSON.stringify(newCategories));
  updateCategorySelect(); 
}

function updateCategorySelect() {
  const categories = getCategories();
  const currentType = recordTypeSelect.value;
  
  categorySelect.innerHTML = '';
  const filteredCategories = categories.filter(cat => cat.type === currentType);
  
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
  const categories = getCategories();
  const listVariable = document.getElementById('category-list-variable');
  const listFixed = document.getElementById('category-list-fixed');
  
  listVariable.innerHTML = '';
  listFixed.innerHTML = '';

  categories.forEach((cat) => {
    const li = document.createElement('li');
    li.dataset.name = cat.name; 
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
      
      const currentCats = getCategories();
      currentCategoryEditIndex = currentCats.findIndex(c => c.name === cat.name);
      
      categorySubmitBtn.textContent = '更新';
      setCategoryEditMode(true); 
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '削除';
    deleteBtn.className = 'delete-btn';
    deleteBtn.onclick = () => {
      if (confirm(`カテゴリ「${cat.name}」を削除しますか？\n※過去の記録はそのまま残りますが、集計などでカテゴリなし扱いになる場合があります。`)) {
        let currentCats = getCategories();
        currentCats = currentCats.filter(c => c.name !== cat.name);
        localStorage.setItem('kakeiboCategories', JSON.stringify(currentCats));
        
        if (currentCategoryEditIndex > -1 && document.getElementById('new-category').value === cat.name) {
          currentCategoryEditIndex = -1;
          categorySubmitBtn.textContent = '追加';
          document.getElementById('new-category').value = '';
          setCategoryEditMode(false);
        }
        displayCategories();
      }
    };

    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);
    li.appendChild(leftDiv);
    li.appendChild(actionsDiv);

    if (cat.type === '固定費') listFixed.appendChild(li);
    else listVariable.appendChild(li);
  });

  updateCategorySelect();
}

categoryForm.addEventListener('submit', function(e) {
  e.preventDefault();
  const newCategoryInput = document.getElementById('new-category');
  const newCategoryType = document.getElementById('new-category-type').value;
  const newCategoryName = newCategoryInput.value.trim();

  if (newCategoryName !== '') {
    const categories = getCategories();
    
    if (currentCategoryEditIndex > -1) {
      const oldCategoryName = categories[currentCategoryEditIndex].name;
      categories[currentCategoryEditIndex] = { name: newCategoryName, type: newCategoryType };
      
      let records = JSON.parse(localStorage.getItem('kakeiboRecords')) || [];
      records.forEach(record => {
        if (record.category === oldCategoryName) {
          record.category = newCategoryName;
          record.type = newCategoryType;
        }
      });
      localStorage.setItem('kakeiboRecords', JSON.stringify(records));
      
      currentCategoryEditIndex = -1;
      categorySubmitBtn.textContent = '追加';
      setCategoryEditMode(false); 
    } else {
      categories.push({ name: newCategoryName, type: newCategoryType });
    }

    localStorage.setItem('kakeiboCategories', JSON.stringify(categories));
    newCategoryInput.value = '';
    displayCategories();
    displayRecords(); 
  }
});


// ==========================================
// 3. 支出の記録・表示・編集・削除処理
// ==========================================
const form = document.getElementById('kakeibo-form');
const recordList = document.getElementById('record-list');
const submitBtn = document.getElementById('submit-btn');
const recordMonthInput = document.getElementById('record-month'); 

recordMonthInput.addEventListener('change', displayRecords);

let currentEditIndex = -1;

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

form.addEventListener('submit', function(e) {
  e.preventDefault();

  const date = document.getElementById('date').value;
  const categoryType = document.getElementById('record-type').value;
  const categoryName = document.getElementById('category').value;
  const amount = parseInt(document.getElementById('amount').value, 10);
  const memo = document.getElementById('memo').value.trim();

  const record = { date, category: categoryName, type: categoryType, amount, memo };
  let records = JSON.parse(localStorage.getItem('kakeiboRecords')) || [];

  if (currentEditIndex > -1) {
    records[currentEditIndex] = record;
    currentEditIndex = -1;
    submitBtn.textContent = '記録を保存';
    setExpenseEditMode(false); 
  } else {
    records.push(record);
  }

  localStorage.setItem('kakeiboRecords', JSON.stringify(records));
  document.getElementById('amount').value = '';
  document.getElementById('memo').value = '';
  
  displayRecords();
  displaySummary(); 
});

function displayRecords() {
  recordList.innerHTML = '';
  let allRecords = JSON.parse(localStorage.getItem('kakeiboRecords')) || [];
  let displayData = allRecords.map((record, index) => ({ ...record, originalIndex: index }));

  const selectedMonth = recordMonthInput.value;
  if (selectedMonth) displayData = displayData.filter(record => record.date.startsWith(selectedMonth));

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
      
      currentEditIndex = item.originalIndex;
      submitBtn.textContent = '記録を更新';
      setExpenseEditMode(true); 
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '削除';
    deleteBtn.className = 'delete-btn';
    deleteBtn.onclick = () => {
      if (confirm('この記録を削除しますか？')) {
        let currentAllRecords = JSON.parse(localStorage.getItem('kakeiboRecords')) || [];
        currentAllRecords.splice(item.originalIndex, 1);
        localStorage.setItem('kakeiboRecords', JSON.stringify(currentAllRecords));
        
        if (currentEditIndex === item.originalIndex) {
          currentEditIndex = -1;
          submitBtn.textContent = '記録を保存';
          document.getElementById('amount').value = '';
          document.getElementById('memo').value = '';
          setExpenseEditMode(false);
        }
        displayRecords();
        displaySummary();
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
// 4. 集計とグラフ描画処理
// ==========================================
let summaryChart = null;
const summaryMonthInput = document.getElementById('summary-month');
const chartTypeSelect = document.getElementById('chart-type');

summaryMonthInput.addEventListener('change', displaySummary);
chartTypeSelect.addEventListener('change', displaySummary);

function displaySummary() {
  let records = JSON.parse(localStorage.getItem('kakeiboRecords')) || [];
  const selectedMonth = summaryMonthInput.value;
  const chartType = chartTypeSelect.value;

  let total = 0, fixedTotal = 0, variableTotal = 0;
  let allCategoryTotals = {}, fixedCategoryTotals = {}, variableCategoryTotals = {};

  const filteredRecords = records.filter(record => record.date.startsWith(selectedMonth));

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

  const chartLabels = [], chartData = [];

  if (chartType === 'type') {
    if (fixedTotal > 0) { chartLabels.push('固定費'); chartData.push(fixedTotal); }
    if (variableTotal > 0) { chartLabels.push('変動費'); chartData.push(variableTotal); }
  } else if (chartType === 'fixed') {
    Object.entries(fixedCategoryTotals).sort((a, b) => b[1] - a[1]).forEach(([cat, amt]) => { chartLabels.push(cat); chartData.push(amt); });
  } else if (chartType === 'variable') {
    Object.entries(variableCategoryTotals).sort((a, b) => b[1] - a[1]).forEach(([cat, amt]) => { chartLabels.push(cat); chartData.push(amt); });
  } else {
    Object.entries(allCategoryTotals).sort((a, b) => b[1] - a[1]).forEach(([cat, amt]) => { chartLabels.push(cat); chartData.push(amt); });
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
  if (summaryChart) summaryChart.destroy();

  const colorfulPalette = [ '#E07A5F', '#3D405B', '#81B29A', '#F2CC8F', '#E8A598', '#6F7C85', '#A2D2FF', '#FFB703', '#219EBC' ];

  summaryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{ data: data, backgroundColor: colorfulPalette, borderWidth: 2, borderColor: '#ffffff' }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
  });
}


// ==========================================
// 5. 画面読み込み時の初期化処理
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  displayCategories();
  
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  
  const todayStr = `${year}-${month}-${day}`;
  const currentMonthStr = `${year}-${month}`;
  
  document.getElementById('date').value = todayStr;
  summaryMonthInput.value = currentMonthStr;
  recordMonthInput.value = currentMonthStr; 
  
  displayRecords(); 
  displaySummary(); 

  new Sortable(document.getElementById('category-list-variable'), { animation: 150, handle: '.drag-handle', onEnd: updateCategoriesOrder });
  new Sortable(document.getElementById('category-list-fixed'), { animation: 150, handle: '.drag-handle', onEnd: updateCategoriesOrder });
});