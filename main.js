// main.js - 統合・画面切り替え対応版

const STORAGE_KEY_CATEGORIES = 'household_categories';
const STORAGE_KEY_RECORDS = 'household_records';

// グラフのインスタンスを保持
let charts = {};

/**
 * 画面切り替え制御
 * @param {string} pageId - 表示したいセクションのID (record, summary, budget, analysis, settings)
 */
function showPage(pageId) {
    // すべてのセクションを非表示にする
    document.querySelectorAll('.page-content').forEach(section => {
        section.classList.remove('active');
    });

    // 指定されたセクションを表示
    const activeSection = document.getElementById('page-' + pageId);
    if (activeSection) {
        activeSection.classList.add('active');
    }

    // 各画面に応じた初期化処理を呼び出す
    if (pageId === 'record') {
        updateCategorySelect();
        showHistory();
    } else if (pageId === 'summary') {
        initSummaryPage();
    } else if (pageId === 'settings') {
        initSettingsPage();
    }
}

/**
 * ページ読み込み時の初期化
 */
window.addEventListener('DOMContentLoaded', () => {
    console.log("家計管理アプリ 統合版 起動");
    
    // 起動時は「支出記録」画面を表示
    showPage('record');
    
    // 記録フォームのイベントリスナーは一度だけ登録
    initRecordPage();
});

// ==========================================
// 支出記録（record）ロジック
// ==========================================

function updateCategorySelect() {
    const categorySelect = document.getElementById('category');
    const typeDisplay = document.getElementById('type-display');
    const categories = JSON.parse(localStorage.getItem(STORAGE_KEY_CATEGORIES) || '[]');

    categorySelect.innerHTML = '<option value="">選択してください</option>';

    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.name;
        option.setAttribute('data-type', cat.type);
        categorySelect.appendChild(option);
    });

    categorySelect.onchange = () => {
        const selectedOption = categorySelect.options[categorySelect.selectedIndex];
        const type = selectedOption ? selectedOption.getAttribute('data-type') : '--';
        typeDisplay.textContent = type || '--';
        
        // 色分け
        if (type === '固定費') {
            typeDisplay.style.color = '#e74c3c';
        } else if (type === '変動費') {
            typeDisplay.style.color = '#2980b9';
        } else {
            typeDisplay.style.color = '#333';
        }
    };
}

function initRecordPage() {
    const saveButton = document.getElementById('save-button');
    const dateInput = document.getElementById('date');
    const amountInput = document.getElementById('amount');
    const categorySelect = document.getElementById('category');
    const memoInput = document.getElementById('memo');

    dateInput.value = new Date().toLocaleDateString('sv-SE');

    saveButton.onclick = (e) => {
        e.preventDefault();

        const amount = parseInt(amountInput.value);
        const category = categorySelect.value;
        const type = document.getElementById('type-display').textContent;

        if (!dateInput.value || isNaN(amount) || amount <= 0 || !category) {
            alert("日付、金額、カテゴリを正しく入力してください。");
            return;
        }

        const newRecord = {
            id: Date.now(),
            date: dateInput.value,
            amount: amount,
            category: category,
            type: type,
            memo: memoInput.value
        };

        const records = JSON.parse(localStorage.getItem(STORAGE_KEY_RECORDS) || '[]');
        records.push(newRecord);
        localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));

        showHistory();

        // 入力クリア
        amountInput.value = "";
        memoInput.value = "";
        categorySelect.selectedIndex = 0;
        document.getElementById('type-display').textContent = "--";
    };
}

function showHistory() {
    const list = document.getElementById('recent-records-list');
    if (!list) return;

    const records = JSON.parse(localStorage.getItem(STORAGE_KEY_RECORDS) || '[]');
    const latest = records.sort((a, b) => b.id - a.id).slice(0, 5);
    
    list.innerHTML = latest.map(r => `
        <tr>
            <td>${r.date.substring(5)}</td>
            <td><strong>${r.category}</strong></td>
            <td style="color: #888; font-size: 0.85rem;">${r.memo || '-'}</td>
            <td class="text-right" style="font-weight:bold;">${r.amount.toLocaleString()}円</td>
            <td style="text-align: center;">
                <button onclick="deleteItem(${r.id})" style="background-color: #e74c3c; width: auto; padding: 4px 12px; margin: 0; font-size: 0.8rem;">削除</button>
            </td>
        </tr>
    `).join("");
}

// ==========================================
// 月別集計（summary）ロジック
// ==========================================

function initSummaryPage() {
    const monthInput = document.getElementById('view-month');
    if (!monthInput.value) {
        const now = new Date();
        monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    monthInput.onchange = () => renderSummary(monthInput.value);
    renderSummary(monthInput.value);
}

function renderSummary(targetMonth) {
    const records = JSON.parse(localStorage.getItem(STORAGE_KEY_RECORDS) || '[]');
    const recordList = document.getElementById('record-list');
    const totalDisp = document.getElementById('total-amount');
    const fixedDisp = document.getElementById('fixed-total');
    const variableDisp = document.getElementById('variable-total');

    let total = 0, fixed = 0, variable = 0;
    let fixedDetails = {}; 
    let variableDetails = {};

    recordList.innerHTML = "";

    const filteredRecords = records
        .filter(r => r.date.startsWith(targetMonth))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    filteredRecords.forEach(r => {
        total += r.amount;
        if (r.type === '固定費') {
            fixed += r.amount;
            fixedDetails[r.category] = (fixedDetails[r.category] || 0) + r.amount;
        } else {
            variable += r.amount;
            variableDetails[r.category] = (variableDetails[r.category] || 0) + r.amount;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.date.split('-')[2]}日</td>
            <td>${r.category}</td>
            <td style="color: #666; font-size: 0.9rem;">${r.memo || '-'}</td>
            <td class="text-right" style="font-weight: bold;">${r.amount.toLocaleString()}円</td>
        `;
        recordList.appendChild(tr);
    });

    updateChart('chart-total', ['固定費', '変動費'], [fixed, variable], ['#ffffff', 'rgba(255,255,255,0.4)']);
    updateChart('chart-fixed', Object.keys(fixedDetails), Object.values(fixedDetails));
    updateChart('chart-variable', Object.keys(variableDetails), Object.values(variableDetails));

    totalDisp.textContent = `${total.toLocaleString()}円`;
    fixedDisp.textContent = `${fixed.toLocaleString()}円`;
    variableDisp.textContent = `${variable.toLocaleString()}円`;
}

function updateChart(canvasId, labels, data, customColors = null) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (charts[canvasId]) charts[canvasId].destroy();
    if (data.length === 0 || data.every(v => v === 0)) return;

    charts[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: customColors || ['#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff', '#ff9f40'],
                borderWidth: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

// ==========================================
// 設定画面（settings）ロジック
// ==========================================

function initSettingsPage() {
    const addButton = document.getElementById('add-category-button');
    const nameInput = document.getElementById('new-category-name');
    const typeSelect = document.getElementById('new-category-type');
    const listContainer = document.getElementById('category-list');
    const toggleBtn = document.getElementById('edit-mode-toggle');

    displayCategories();

    toggleBtn.onclick = () => {
        listContainer.classList.toggle('edit-off');
        listContainer.classList.toggle('edit-on');
        toggleBtn.textContent = listContainer.classList.contains('edit-on') ? '整理を完了する' : 'カテゴリを整理する';
        toggleBtn.classList.toggle('active');
    };

    if (typeof Sortable !== 'undefined' && !listContainer.dataset.sortableInit) {
        new Sortable(listContainer, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: saveCurrentOrder
        });
        listContainer.dataset.sortableInit = "true";
    }

    addButton.onclick = () => {
        const name = nameInput.value.trim();
        if (name === "") return;
        const categories = JSON.parse(localStorage.getItem(STORAGE_KEY_CATEGORIES) || '[]');
        categories.push({ name: name, type: typeSelect.value });
        localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(categories));
        nameInput.value = "";
        displayCategories();
    };
}

function displayCategories() {
    const categories = JSON.parse(localStorage.getItem(STORAGE_KEY_CATEGORIES) || '[]');
    const listContainer = document.getElementById('category-list');
    listContainer.innerHTML = categories.map((cat, index) => `
        <li data-name="${cat.name}" data-type="${cat.type}">
            <span><i class="drag-handle">☰</i> <strong>${cat.name}</strong> (${cat.type})</span>
            <button class="delete-btn" onclick="deleteCategory(${index})">削除</button>
        </li>
    `).join("");
}

function saveCurrentOrder() {
    const listContainer = document.getElementById('category-list');
    const newCategories = Array.from(listContainer.querySelectorAll('li')).map(li => ({
        name: li.getAttribute('data-name'),
        type: li.getAttribute('data-type')
    }));
    localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(newCategories));
}

// ==========================================
// 削除用グローバル関数
// ==========================================

window.deleteCategory = (index) => {
    if (!confirm("削除しますか？")) return;
    const categories = JSON.parse(localStorage.getItem(STORAGE_KEY_CATEGORIES) || '[]');
    categories.splice(index, 1);
    localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(categories));
    displayCategories();
};

window.deleteItem = (id) => {
    if (!confirm("記録を削除しますか？")) return;
    let records = JSON.parse(localStorage.getItem(STORAGE_KEY_RECORDS) || '[]');
    records = records.filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
    showHistory();
    // 集計画面が表示中なら更新
    if (document.getElementById('page-summary').classList.contains('active')) {
        renderSummary(document.getElementById('view-month').value);
    }
};