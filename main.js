// main.js - Firebase クラウドデータベース対応版

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, setDoc, getDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// ご自身のFirebaseプロジェクト設定情報
const firebaseConfig = {
  apiKey: "AIzaSyAyBFPe2br0E_Nubc1ZYMGoTMh09vEKVCw",
  authDomain: "family-portal-79822.firebaseapp.com",
  projectId: "family-portal-79822",
  storageBucket: "family-portal-79822.firebasestorage.app",
  messagingSenderId: "825094653178",
  appId: "1:825094653178:web:9e5f8ca95889a4fb44b543"
};

// Firebaseの初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let charts = {};

// ==========================================
// Firebase データ通信ヘルパー
// ==========================================

// 支出記録の取得
async function getRecords() {
    // 作成日時の新しい順に並べて取得
    const q = query(collection(db, "records"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    // データを扱いやすい配列に変換（各データに固有のIDを持たせる）
    return snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
}

// カテゴリ一覧の取得
async function getCategories() {
    const docRef = doc(db, "settings", "categories");
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data().list : [];
}

// カテゴリ一覧の保存
async function saveCategories(categories) {
    await setDoc(doc(db, "settings", "categories"), { list: categories });
}

// ==========================================
// 画面切り替え制御
// ==========================================

// HTMLから直接呼ばれる関数は window オブジェクトに登録する必要があります
window.showPage = async (pageId) => {
    document.querySelectorAll('.page-content').forEach(section => section.classList.remove('active'));
    const activeSection = document.getElementById('page-' + pageId);
    if (activeSection) activeSection.classList.add('active');

    // ページが開かれるたびにクラウドから最新データを取得
    if (pageId === 'record') {
        await updateCategorySelect();
        await showHistory();
    } else if (pageId === 'summary') {
        await initSummaryPage();
    } else if (pageId === 'settings') {
        await initSettingsPage();
    }
};

async function refreshUI() {
    await showHistory();
    const summaryPage = document.getElementById('page-summary');
    if (summaryPage.classList.contains('active')) {
        const monthInput = document.getElementById('view-month');
        await renderSummary(monthInput.value);
    }
}

// アプリ起動時の処理
window.addEventListener('DOMContentLoaded', async () => {
    initRecordPage();
    initModalEvents();
    await window.showPage('record');
});

// ==========================================
// 支出記録画面
// ==========================================

async function updateCategorySelect() {
    const categorySelect = document.getElementById('category');
    const typeDisplay = document.getElementById('type-display');
    const categories = await getCategories();

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

    document.getElementById('expense-form').onsubmit = async (e) => {
        e.preventDefault();
        const amount = parseInt(document.getElementById('amount').value);
        const category = document.getElementById('category').value;
        const type = document.getElementById('type-display').textContent;

        if (!category || isNaN(amount)) return alert("正しく入力してください");

        // 通信中はボタンを「保存中」にする
        const submitBtn = document.getElementById('save-button');
        submitBtn.disabled = true;
        submitBtn.textContent = "保存中...";

        // Firebaseへの保存
        await addDoc(collection(db, "records"), {
            date: dateInput.value,
            amount: amount,
            category: category,
            type: type,
            memo: document.getElementById('memo').value,
            createdAt: Date.now() // 並べ替え用
        });

        await refreshUI();
        e.target.reset();
        dateInput.value = new Date().toLocaleDateString('sv-SE');
        document.getElementById('type-display').textContent = "--";

        submitBtn.disabled = false;
        submitBtn.textContent = "記録する";
    };
}

async function showHistory() {
    const list = document.getElementById('recent-records-list');
    if (!list) return;

    const records = await getRecords();
    const latest = records.slice(0, 5);

    list.innerHTML = latest.map(r => `
        <tr>
            <td>${r.date.substring(5)}</td>
            <td><strong>${r.category}</strong></td>
            <td class="text-right" style="font-weight:bold;">${r.amount.toLocaleString()}円</td>
            <td style="text-align: center;">
                <button onclick="openModal('${r.docId}')" style="background-color: #3498db; width: auto; padding: 4px 12px; margin: 0; font-size: 0.8rem;">編集</button>
            </td>
        </tr>
    `).join("");
}

// ==========================================
// 月別集計画面
// ==========================================

async function initSummaryPage() {
    const monthInput = document.getElementById('view-month');
    if (!monthInput.value) {
        const now = new Date();
        monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    monthInput.onchange = async () => await renderSummary(monthInput.value);
    await renderSummary(monthInput.value);
}

async function renderSummary(targetMonth) {
    const allRecords = await getRecords();
    const records = allRecords.filter(r => r.date.startsWith(targetMonth));
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
                    <button onclick="openModal('${r.docId}')" style="background-color: #95a5a6; width: auto; padding: 4px 12px; margin: 0; font-size: 0.8rem;">詳細</button>
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
    const ctx = canvas.getContext('2d');
    if (charts[canvasId]) charts[canvasId].destroy();
    if (!data.length || data.every(v => v === 0)) return;

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
// 編集・詳細モーダル
// ==========================================

window.openModal = async (docId) => {
    const records = await getRecords();
    const record = records.find(r => r.docId === docId);
    if (!record) return;

    document.getElementById('edit-id').value = record.docId; 
    document.getElementById('edit-date').value = record.date;
    document.getElementById('edit-amount').value = record.amount;
    document.getElementById('edit-memo').value = record.memo || "";

    const editCatSelect = document.getElementById('edit-category');
    const categories = await getCategories();
    editCatSelect.innerHTML = categories.map(c => `<option value="${c.name}">${c.name}</option>`).join("");
    editCatSelect.value = record.category;

    document.getElementById('edit-modal').style.display = 'flex';
};

function closeModal() {
    document.getElementById('edit-modal').style.display = 'none';
}

function initModalEvents() {
    document.getElementById('update-button').onclick = async () => {
        const docId = document.getElementById('edit-id').value;
        const category = document.getElementById('edit-category').value;
        
        const categories = await getCategories();
        const catInfo = categories.find(c => c.name === category);

        // Firebaseのデータを更新
        await updateDoc(doc(db, "records", docId), {
            date: document.getElementById('edit-date').value,
            amount: parseInt(document.getElementById('edit-amount').value),
            category: category,
            memo: document.getElementById('edit-memo').value,
            type: catInfo ? catInfo.type : "--"
        });

        await refreshUI();
        closeModal();
    };

    document.getElementById('delete-button').onclick = async () => {
        const docId = document.getElementById('edit-id').value;
        if (!confirm("本当に削除しますか？")) return;
        
        // Firebaseから削除
        await deleteDoc(doc(db, "records", docId));
        
        await refreshUI();
        closeModal();
    };

    document.getElementById('close-modal-button').onclick = closeModal;
}

// ==========================================
// 設定画面（カテゴリ管理）
// ==========================================

async function initSettingsPage() {
    const listContainer = document.getElementById('category-list');
    await displayCategories();

    document.getElementById('edit-mode-toggle').onclick = (e) => {
        const isEdit = listContainer.classList.toggle('edit-on');
        listContainer.classList.toggle('edit-off');
        e.target.textContent = isEdit ? '整理を完了する' : 'カテゴリを整理する';
        e.target.classList.toggle('active');
    };

    if (typeof Sortable !== 'undefined' && !listContainer.dataset.sortableInit) {
        new Sortable(listContainer, { 
            animation: 150, 
            ghostClass: 'sortable-ghost', 
            onEnd: async () => {
                const newCategories = Array.from(document.querySelectorAll('#category-list li')).map(li => ({
                    name: li.dataset.name,
                    type: li.dataset.type
                }));
                await saveCategories(newCategories);
            } 
        });
        listContainer.dataset.sortableInit = "true";
    }

    const addBtn = document.getElementById('add-category-button');
    addBtn.onclick = async () => {
        const name = document.getElementById('new-category-name').value.trim();
        if (!name) return;

        addBtn.disabled = true;
        addBtn.textContent = "追加中...";
        
        const categories = await getCategories();
        categories.push({ name, type: document.getElementById('new-category-type').value });
        await saveCategories(categories);
        
        document.getElementById('new-category-name').value = "";
        await displayCategories();
        
        addBtn.disabled = false;
        addBtn.textContent = "カテゴリを追加する";
    };
}

async function displayCategories() {
    const listContainer = document.getElementById('category-list');
    const categories = await getCategories();
    listContainer.innerHTML = categories.map((cat, i) => `
        <li data-name="${cat.name}" data-type="${cat.type}">
            <span><i class="drag-handle">☰</i> <strong>${cat.name}</strong> (${cat.type})</span>
            <button class="delete-btn" onclick="deleteCategory(${i})">削除</button>
        </li>
    `).join("");
}

window.deleteCategory = async (index) => {
    if (!confirm("削除しますか？")) return;
    const categories = await getCategories();
    categories.splice(index, 1);
    await saveCategories(categories);
    await displayCategories();
};
