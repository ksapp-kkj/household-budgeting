// main.js - 認証＆クラウドデータベース対応・インラインスタイル完全排除版

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, setDoc, getDoc, query, orderBy, where, arrayUnion } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

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
const auth = getAuth(app);

let charts = {};
let currentUser = null;
let currentHouseholdId = null;

// ==========================================
// 認証・画面制御ロジック
// ==========================================

function showAppScreen(screenId) {
    document.querySelectorAll('.app-screen').forEach(sec => sec.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

window.showRegisterForm = () => {
    document.getElementById('login-form-container').classList.add('hidden');
    document.getElementById('register-form-container').classList.remove('hidden');
};

window.showLoginForm = () => {
    document.getElementById('register-form-container').classList.add('hidden');
    document.getElementById('login-form-container').classList.remove('hidden');
};

// ログイン状態の監視
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        showAppScreen('mypage-screen');
        loadUserHouseholds(); // ログイン時に家計簿一覧を読み込む
    } else {
        currentUser = null;
        showAppScreen('login-screen');
    }
});

// マイページ：家計簿一覧の読み込み
async function loadUserHouseholds() {
    const listEl = document.getElementById('user-team-list');
    listEl.innerHTML = '<p class="empty-message">読み込み中...</p>';
    try {
        const q = query(collection(db, "households"), where("members", "array-contains", currentUser.uid));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            listEl.innerHTML = '<p class="empty-message">管理中の家計簿がありません。<br>新しく作成するか、招待IDを入力してください。</p>';
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            html += `
                <div class="team-item-wrapper">
                    <button class="team-select-btn" onclick="selectHousehold('${doc.id}', '${data.name}')">${data.name} にアクセス</button>
                </div>
            `;
        });
        listEl.innerHTML = html;
    } catch(e) {
        listEl.innerHTML = '<p class="empty-message" style="color:red;">読み込みエラーが発生しました。</p>';
        console.error(e);
    }
}

// マイページ：新しい家計簿の作成
window.showCreateHouseholdModal = async () => {
    const name = prompt("新しい家計簿の名前を入力してください\n（例：山田家の家計簿）");
    if (!name) return;
    
    try {
        await addDoc(collection(db, "households"), {
            name: name,
            owner: currentUser.uid,
            members: [currentUser.uid],
            createdAt: Date.now()
        });
        alert("家計簿を作成しました！");
        loadUserHouseholds();
    } catch (e) { alert("作成エラー: " + e.message); }
};

// マイページ：招待IDで家計簿に参加
window.joinHousehold = async () => {
    const input = document.getElementById('join-team-id');
    const householdId = input.value.trim();
    if (!householdId) return alert("招待IDを入力してください");
    
    try {
        const docRef = doc(db, "households", householdId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return alert("入力されたIDの家計簿が見つかりません。");
        
        await updateDoc(docRef, {
            members: arrayUnion(currentUser.uid)
        });
        alert("家計簿に参加しました！");
        input.value = "";
        loadUserHouseholds();
    } catch (e) { alert("参加エラー: " + e.message); }
};

window.loginAccount = async () => {
    const email = document.getElementById('login-email-input').value;
    const password = document.getElementById('login-password-input').value;
    if (!email || !password) return alert("入力してください");
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (e) { alert("ログイン失敗: " + e.message); }
};

window.registerAccount = async () => {
    const email = document.getElementById('register-email-input').value;
    const password = document.getElementById('register-password-input').value;
    if (!email || !password) return alert("入力してください");
    try { await createUserWithEmailAndPassword(auth, email, password); } 
    catch (e) { alert("登録失敗: " + e.message); }
};

window.logout = () => {
    if (confirm("ログアウトしますか？")) signOut(auth);
};

window.selectHousehold = (id, name) => {
    currentHouseholdId = id;
    
    document.getElementById('current-team-display').innerText = name;
    
    document.getElementById('settings-household-id-display').innerHTML = `ID: ${id}<br><span class="copy-text copy-text-small">(タップでコピー)</span>`;
    document.getElementById('edit-household-name').value = name;

    showAppScreen('main-app-screen');
    window.showPage('record'); 
};

window.backToMyPage = () => {
    currentHouseholdId = null;
    showAppScreen('mypage-screen');
};

// ==========================================
// Firebase データ通信ヘルパー
// ==========================================

async function getRecords() {
    if (!currentHouseholdId) return [];
    const q = query(collection(db, "households", currentHouseholdId, "records"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
}

async function getCategories() {
    if (!currentHouseholdId) return [];
    const docRef = doc(db, "households", currentHouseholdId, "settings", "categories");
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data().list : [];
}

async function saveCategories(categories) {
    if (!currentHouseholdId) return;
    await setDoc(doc(db, "households", currentHouseholdId, "settings", "categories"), { list: categories });
}

// ==========================================
// 家計簿の画面切り替え制御
// ==========================================

window.showPage = async (pageId) => {
    document.querySelectorAll('.page-content').forEach(section => section.classList.remove('active'));
    const activeSection = document.getElementById('page-' + pageId);
    if (activeSection) activeSection.classList.add('active');

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

window.addEventListener('DOMContentLoaded', async () => {
    initRecordPage();
    initModalEvents();
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
        
        typeDisplay.className = ''; 
        if (type === '固定費') typeDisplay.classList.add('text-fixed');
        else if (type === '変動費') typeDisplay.classList.add('text-variable');
        else typeDisplay.classList.add('text-default');
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

        const submitBtn = document.getElementById('save-button');
        submitBtn.disabled = true;
        submitBtn.textContent = "保存中...";

        await addDoc(collection(db, "households", currentHouseholdId, "records"), {
            date: dateInput.value,
            amount: amount,
            category: category,
            type: type,
            memo: document.getElementById('memo').value,
            createdAt: Date.now()
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
            <td class="text-right"><strong>${r.amount.toLocaleString()}円</strong></td>
            <td class="text-center">
                <button onclick="openModal('${r.docId}')" class="btn-table-action btn-table-edit">編集</button>
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
                <td class="text-right"><strong>${r.amount.toLocaleString()}円</strong></td>
                <td class="text-center">
                    <button onclick="openModal('${r.docId}')" class="btn-table-action btn-table-detail">詳細</button>
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

    document.getElementById('edit-modal').classList.add('active');
};

function closeModal() {
    document.getElementById('edit-modal').classList.remove('active');
}

function initModalEvents() {
    document.getElementById('update-button').onclick = async () => {
        const docId = document.getElementById('edit-id').value;
        const category = document.getElementById('edit-category').value;
        
        const categories = await getCategories();
        const catInfo = categories.find(c => c.name === category);

        await updateDoc(doc(db, "households", currentHouseholdId, "records", docId), {
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
        
        await deleteDoc(doc(db, "households", currentHouseholdId, "records", docId));
        
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

// ==========================================
// その他の追加機能（名前変更・IDコピー・ヘルプ）
// ==========================================

window.updateHouseholdName = async () => {
    const newName = document.getElementById('edit-household-name').value.trim();
    if (!newName) return alert("名前を入力してください");
    try {
        await updateDoc(doc(db, "households", currentHouseholdId), { name: newName });
        document.getElementById('current-team-display').innerText = newName;
        alert("家計簿の名前を変更しました！");
    } catch(e) { alert("名前の変更に失敗しました: " + e.message); }
};

window.copyHouseholdId = () => {
    if (!currentHouseholdId) return;
    navigator.clipboard.writeText(currentHouseholdId).then(() => {
        alert("招待ID「" + currentHouseholdId + "」をコピーしました！\nパートナーに共有してください。");
    }).catch(err => { 
        alert("コピーに失敗しました。このIDを手動でコピーしてください: " + currentHouseholdId); 
    });
};

window.showHelpModal = (pageId) => {
    const helpData = {
        record: {
            title: "支出記録の使い方",
            content: `
                <p>日々の支出を記録する画面です。</p>
                <ul class="ul-padded">
                    <li>日付、金額、カテゴリを入力して「記録する」を押してください。</li>
                    <li>「費目タイプ」は設定画面でカテゴリに紐づけたものが自動で表示されます。</li>
                    <li>最近の記録は下の表に表示され、「編集」ボタンから修正・削除が可能です。</li>
                </ul>
            `
        },
        summary: {
            title: "月別集計の使い方",
            content: `
                <p>月ごとの支出状況を確認する画面です。</p>
                <ul class="ul-padded">
                    <li>上部の「表示月」を変更すると、その月のデータに切り替わります。</li>
                    <li>固定費と変動費の合計や、カテゴリごとの割合がグラフで確認できます。</li>
                    <li>「今月の明細」から、該当月のすべての記録を確認・「詳細」ボタンから編集できます。</li>
                </ul>
            `
        },
        settings: {
            title: "設定・マスター管理の使い方",
            content: `
                <p>家計簿の基本設定を行う画面です。</p>
                <ul class="ul-padded">
                    <li><strong>家計簿の名前:</strong> アプリ上部に表示される名前をいつでも変更できます。</li>
                    <li><strong>カテゴリ管理:</strong> 支出記録で使うカテゴリを追加・削除したり、並べ替えたりできます。</li>
                    <li><strong>家族を招待:</strong> 一番下にある招待IDをコピーしてパートナーに送ることで、同じ家計簿を共有できます。</li>
                </ul>
            `
        }
    };
    
    const data = helpData[pageId];
    if (!data) return;
    
    document.getElementById('help-modal-title').innerText = data.title;
    document.getElementById('help-modal-body').innerHTML = data.content;
    document.getElementById('help-modal').classList.add('active');
};

window.closeHelpModal = () => {
    document.getElementById('help-modal').classList.remove('active');
};
