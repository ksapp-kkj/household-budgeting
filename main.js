// main.js - 統合・整理版

const STORAGE_KEY_CATEGORIES = 'household_categories';
const STORAGE_KEY_RECORDS = 'household_records';

let charts = {};

// --- データ取得ヘルパー ---
const getRecords = () => JSON.parse(localStorage.getItem(STORAGE_KEY_RECORDS) || '[]');
const getCategories = () => JSON.parse(localStorage.getItem(STORAGE_KEY_CATEGORIES) || '[]');
const saveRecords = (records) => localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));

/**
 * 画面切り替え制御
 */
function showPage(pageId) {
    document.querySelectorAll('.page-content').forEach(section => section.classList.remove('active'));
    const activeSection = document.getElementById('page-' + pageId);
    if (activeSection) activeSection.classList.add('active');

    // 初期化が必要なページのみ実行
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
 * 共通：表示の全体更新
 */
function refreshUI() {
    showHistory();
    const summaryPage = document.getElementById('page-summary');
    if (summaryPage.classList.contains('active')) {
        const monthInput = document.getElementById('view-month');
        renderSummary(monthInput.value);
    }
}

// ==========================================
// 初期化
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    showPage('record');
    initRecordPage();
    initModalEvents();
});

// ==========================================
// 支出記録（record）
// ==========================================

function updateCategorySelect() {
    const categorySelect = document.getElementById('category');
    const typeDisplay = document.getElementById('type-display');
    const categories = getCategories();

    categorySelect.innerHTML = '<option value="">選択してください</option>';
    categories.forEach(cat => {
        const option = new Option(cat.name, cat.name);
        option.dataset.type = cat.type;
        categorySelect.add(option);
    });

    categorySelect.onchange = () => {
        const type = categorySelect.selectedOptions[0]?.dataset.type || '--';
        typeDisplay.textContent = type;
        typeDisplay.style.color = type === '固定費' ? '#e74c3c' : (type === '変動費' ? '#2980b9' : '#333');
    };
}

function initRecordPage() {
    const dateInput = document.getElementById('date');
    dateInput.value = new Date().toLocaleDateString('sv-SE');

    document.getElementById('expense-form').onsubmit = (e) => {
        e.preventDefault();
        const amount = parseInt(document.getElementById('amount').value);
        const category = document.getElementById('category').value;
        const type = document.getElementById('type-display').textContent;

        if (!category || isNaN(amount)) return alert("正しく入力してください");

        const records = getRecords();
        records.push({
            id: Date.now(),
            date: dateInput.value,
            amount: amount,
            category: category,
            type: type,
            memo: document.getElementById('memo').value
        });

        saveRecords(records);
        refreshUI();
        e.target.reset();
        dateInput.value = new Date().toLocaleDateString('sv-SE');
        document.getElementById('type-display').textContent = "--";
    };
}

function showHistory() {
    const list = document.getElementById('recent-records-list');
    if (!list) return;

    const records = getRecords().sort((a, b) => b.id - a.id).slice(0, 5);
    list.innerHTML = records.map(r => `
        <tr>
            <td>${r.date.substring(5)}</td>
            <td><strong>${r.category}</strong></td>
            <td class="text-right" style="font-weight:bold;">${r.amount.toLocaleString()}円</td>
            <td style="text-align: center;">
                <button onclick="openModal(${r.id})" style="background-color: #3498db; width: auto; padding: 4px 12px; margin: 0; font-size: 0.8rem;">編集</button>
            </td>
        </tr>
    `).join("");
}

// ==========================================
// 月別集計（summary）
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
    const records = getRecords().filter(r => r.date.startsWith(targetMonth));
    const recordList = document.getElementById('record-list');
    
    let stats = { total: 0, fixed: 0, variable: 0 };
    let details = { fixed: {}, variable: {} };

    recordList.innerHTML = records.sort((a, b) => new Date(a.date) - new Date(b.date)).map(r => {
        stats.total += r.amount;
        const group = r.type === '固定費' ? 'fixed' : 'variable';
        stats[group] += r.amount;
        details[group][r.category] = (details[group][r.category] || 0) + r.amount;

        return `
            <tr>
                <td>${r.date.split('-')[2]}日</td>
                <td>${r.category}</td>
                <td class="text-right" style="font-weight: bold;">${r.amount.toLocaleString()}円</td>
                <td style="text-align: center;">
                    <button onclick="openModal(${r.id})" style="background-color: #95a5a6; width: auto; padding: 4px 12px; margin: 0; font-size: 0.8rem;">詳細</button>
                </td>
            </tr>
        `;
    }).join("");

    updateChart('chart-total', ['固定費', '変動費'], [stats.fixed, stats.variable], ['#ffffff', 'rgba(255,255,255,0.4)']);
    updateChart('chart-fixed', Object.keys(details.fixed), Object.values(details.fixed));
    updateChart('chart-variable', Object.keys(details.variable), Object.values(details.variable));

    document.getElementById('total-amount').textContent = `${stats.total.toLocaleString()}円`;
    document.getElementById('fixed-total').textContent = `${stats.fixed.toLocaleString()}円`;
    document.getElementById('variable-total').textContent = `${stats.variable.toLocaleString()}円`;
}

function updateChart(canvasId, labels, data, customColors = null) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (charts[canvasId]) charts[canvasId].destroy();
    if (!data.length || data.every(v => v === 0)) return;

    charts[canvasId] = new Chart(canvas.getContext('2d'), {
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
// モーダル（編集・詳細）
// ==========================================

function openModal(id) {
    const record = getRecords().find(r => r.id === id);
    if (!record) return;

    document.getElementById('edit-id').value = record.id;
    document.getElementById('edit-date').value = record.date;
    document.getElementById('edit-amount').value = record.amount;
    document.getElementById('edit-memo').value = record.memo || "";

    const editCatSelect = document.getElementById('edit-category');
    editCatSelect.innerHTML = getCategories().map(c => `<option value="${c.name}">${c.name}</option>`).join("");
    editCatSelect.value = record.category;

    document.getElementById('edit-modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('edit-modal').style.display = 'none';
}

function initModalEvents() {
    document.getElementById('update-button').onclick = () => {
        const id = parseInt(document.getElementById('edit-id').value);
        let records = getRecords();
        const index = records.findIndex(r => r.id === id);

        if (index !== -1) {
            const category = document.getElementById('edit-category').value;
            const catInfo = getCategories().find(c => c.name === category);
            
            records[index] = {
                ...records[index],
                date: document.getElementById('edit-date').value,
                amount: parseInt(document.getElementById('edit-amount').value),
                category: category,
                memo: document.getElementById('edit-memo').value,
                type: catInfo ? catInfo.type : "--"
            };

            saveRecords(records);
            refreshUI();
            closeModal();
        }
    };

    document.getElementById('delete-button').onclick = () => {
        const id = parseInt(document.getElementById('edit-id').value);
        if (!confirm("削除しますか？")) return;
        let records = getRecords().filter(r => r.id !== id);
        saveRecords(records);
        refreshUI();
        closeModal();
    };

    document.getElementById('close-modal-button').onclick = closeModal;
}

// ==========================================
// 設定画面（settings）
// ==========================================

function initSettingsPage() {
    const listContainer = document.getElementById('category-list');
    displayCategories();

    document.getElementById('edit-mode-toggle').onclick = (e) => {
        const isEdit = listContainer.classList.toggle('edit-on');
        listContainer.classList.toggle('edit-off');
        e.target.textContent = isEdit ? '整理を完了する' : 'カテゴリを整理する';
        e.target.classList.toggle('active');
    };

    if (typeof Sortable !== 'undefined' && !listContainer.dataset.sortableInit) {
        new Sortable(listContainer, { animation: 150, ghostClass: 'sortable-ghost', onEnd: saveCategoryOrder });
        listContainer.dataset.sortableInit = "true";
    }

    document.getElementById('add-category-button').onclick = () => {
        const name = document.getElementById('new-category-name').value.trim();
        if (!name) return;
        const categories = getCategories();
        categories.push({ name, type: document.getElementById('new-category-type').value });
        localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(categories));
        document.getElementById('new-category-name').value = "";
        displayCategories();
    };
}

function displayCategories() {
    const listContainer = document.getElementById('category-list');
    listContainer.innerHTML = getCategories().map((cat, i) => `
        <li data-name="${cat.name}" data-type="${cat.type}">
            <span><i class="drag-handle">☰</i> <strong>${cat.name}</strong> (${cat.type})</span>
            <button class="delete-btn" onclick="deleteCategory(${i})">削除</button>
        </li>
    `).join("");
}

function saveCategoryOrder() {
    const newCategories = Array.from(document.querySelectorAll('#category-list li')).map(li => ({
        name: li.dataset.name,
        type: li.dataset.type
    }));
    localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(newCategories));
}

window.deleteCategory = (index) => {
    if (!confirm("削除しますか？")) return;
    const categories = getCategories();
    categories.splice(index, 1);
    localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(categories));
    displayCategories();
};
