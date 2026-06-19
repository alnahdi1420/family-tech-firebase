const FAMILY_CODE = "NHD2026";
const STORAGE = {
  currentUser: "currentUser"
};

const FIRESTORE_DOC = db.collection("familyTech").doc("mainState");

const LEVELS = [
  { name: "🌱 مبتدئ", xp: 0 },
  { name: "🥉 برونزي", xp: 100 },
  { name: "🥈 فضي", xp: 250 },
  { name: "🥇 ذهبي", xp: 500 },
  { name: "💎 أسطوري", xp: 1000 }
];

let selectedTaskId = null;
let dataLoaded = false;
let writingToFirebase = false;

window.addEventListener("load", () => {
  setTimeout(() => document.getElementById("splash")?.classList.add("hide"), 1000);
  if(localStorage.getItem("familyAccess")){

    document
        .getElementById("familyLock")
        .classList
        .add("hide");

}
  populateUsers();
  populateAdminTargets();

  const savedUserId = localStorage.getItem(STORAGE.currentUser);
  if (savedUserId && users.some(u => u.id === savedUserId)) {
    App.currentUser = users.find(u => u.id === savedUserId);
    showScreen("home", false);
  } else {
    showScreen("userSelection", false);
  }

  startFirebaseSync();
});

async function startFirebaseSync() {
  try {
    FIRESTORE_DOC.onSnapshot(async snapshot => {
      if (!snapshot.exists) {
        await FIRESTORE_DOC.set(getDefaultState());
        return;
      }

      const data = snapshot.data() || {};
      App.tasks = Array.isArray(data.tasks) ? data.tasks : [];
      App.submissions = Array.isArray(data.submissions) ? data.submissions : [];
      App.progress = data.progress || {};
      App.activity = Array.isArray(data.activity) ? data.activity : [];
      App.online = true;
      dataLoaded = true;

      const changed = ensureProgress(false);
      refreshAll();

      if (changed && !writingToFirebase) {
        await saveData();
      }
    }, error => {
      console.error(error);
      toast("تعذر الاتصال بقاعدة البيانات.");
    });
  } catch (error) {
    console.error(error);
    toast("حدث خطأ في Firebase.");
  }
}

function getDefaultState() {
  const progress = {};
  users.forEach(user => {
    progress[user.id] = { xp: 0, completedTasks: [], badges: [], latestAchievement: "" };
  });

  return {
    tasks: [],
    submissions: [],
    progress,
    activity: [],
    updatedAt: new Date().toISOString()
  };
}

async function saveData() {
  try {
    writingToFirebase = true;
    await FIRESTORE_DOC.set({
      tasks: App.tasks,
      submissions: App.submissions,
      progress: App.progress,
      activity: App.activity || [],
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    console.error(error);
    toast("لم يتم حفظ البيانات في Firebase.");
  } finally {
    writingToFirebase = false;
  }
}

function ensureProgress(save = true) {
  let changed = false;
  users.forEach(user => {
    if (!App.progress[user.id]) {
      App.progress[user.id] = { xp: 0, completedTasks: [], badges: [], latestAchievement: "" };
      changed = true;
    }
  });

  if (changed && save) saveData();
  return changed;
}

function showScreen(screenId, showNav = false) {
  document.querySelectorAll(".screen").forEach(screen => screen.classList.remove("active"));
  document.getElementById(screenId)?.classList.add("active");
  document.getElementById("bottomNav")?.classList.toggle("show", showNav);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function populateUsers() {
  const container = document.getElementById("usersContainer");
  if (!container) return;
  container.innerHTML = users.map(user => `
    <div class="user-card" onclick="selectUser('${user.id}')" style="border-right:6px solid ${user.color}">
      <div class="user-avatar">${user.avatar}</div>
      <div>
        <div class="user-name">${user.name}</div>
        <div class="user-title">${user.nickname}</div>
      </div>
    </div>
  `).join("");
}

function selectUser(id) {
  App.currentUser = users.find(user => user.id === id);
  localStorage.setItem(STORAGE.currentUser, id);
  ensureProgress();
  refreshAll();
  showScreen("home", false);
}

function logout() {
  if (!confirm("هل تريد تبديل المستخدم؟")) return;
  localStorage.removeItem(STORAGE.currentUser);
  App.currentUser = null;
  showScreen("userSelection", false);
}

function getProgress(userId = App.currentUser?.id) {
  return App.progress[userId] || { xp: 0, completedTasks: [], badges: [], latestAchievement: "" };
}

function getLevelName(xp) {
  return [...LEVELS].reverse().find(level => xp >= level.xp)?.name || LEVELS[0].name;
}

function getNextLevel(xp) {
  return LEVELS.find(level => xp < level.xp) || LEVELS[LEVELS.length - 1];
}

function refreshAll() {
  renderDashboard();
  renderAdminVisibility();
  renderTasksForUser();
  renderAdminTasks();
  renderPendingReviews();
  renderActivityLog();
  renderLeaderboard();
  renderAchievements();
}

function renderDashboard() {
  if (!App.currentUser) return;
  const user = App.currentUser;
  const progress = getProgress(user.id);
  const nextLevel = getNextLevel(progress.xp);
  const percent = Math.min(100, nextLevel.xp === 0 ? 100 : (progress.xp / nextLevel.xp) * 100);

  setText("welcomeText", user.welcomeMessage);
  setText("profileAvatar", user.avatar);
  setText("profileNickname", user.nickname);
  setText("profileName", user.name);
  setText("profileStats", `${progress.xp} نقطة • ${getLevelName(progress.xp)}`);
  const xpBar = document.getElementById("xpBar");
  if (xpBar) xpBar.style.width = `${percent}%`;
  const profileCard = document.getElementById("profileCard");
  if (profileCard) profileCard.style.borderRight = `7px solid ${user.color}`;

  const available = getAvailableTasks();
  const nextTask = available[0];
  setText("nextTaskTitle", nextTask ? nextTask.title : "لا توجد مهام حالية");
  setText("nextTaskDescription", nextTask ? nextTask.description || "بدون وصف." : "أضف مهام من لوحة المدير وستظهر هنا.");
  setText("nextTaskXP", nextTask ? `+${nextTask.xp} نقطة` : "+0 نقطة");

  const ranked = getRankedUsers();
  const rankIndex = ranked.findIndex(item => item.user.id === user.id);
  setText("rankNumber", rankIndex >= 0 ? rankIndex + 1 : "-");
  setText("badgeCount", getUserBadges(user.id).filter(b => b.unlocked).length);
  setText("latestAchievement", progress.latestAchievement || "لا يوجد إنجاز بعد.");
}

function renderAdminVisibility() {
  document.querySelectorAll(".admin-only").forEach(el => {
    el.classList.toggle("hidden", !App.currentUser?.isAdmin);
  });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value;
}

function openDashboard() {
  refreshAll();
  showScreen("dashboard", true);
}

function openAdmin() {
  if (!App.currentUser?.isAdmin) {
    toast("ليس لديك صلاحية الوصول للوحة المدير.");
    return;
  }
  refreshAll();
  showScreen("admin", false);
}

function populateAdminTargets() {
  const select = document.getElementById("taskTarget");
  if (!select) return;
  select.innerHTML = users.map(user => `<option value="${user.id}">${user.name}</option>`).join("");
}

function toggleTargetUser() {
  const type = document.querySelector('input[name="taskType"]:checked')?.value;
  document.getElementById("targetUser")?.classList.toggle("show", type === "private");
}

function saveTask() {
  if (!App.currentUser?.isAdmin) return toast("ليس لديك صلاحية إنشاء المهام.");

  const title = document.getElementById("taskTitle").value.trim();
  if (!title) return toast("اكتب عنوان المهمة أولًا.");

  const editingId = document.getElementById("editingTaskId").value;
  const task = {
    id: editingId || String(Date.now()),
    title,
    description: document.getElementById("taskDescription").value.trim(),
    type: document.querySelector('input[name="taskType"]:checked').value,
    target: document.getElementById("taskTarget").value,
    xp: Number(document.getElementById("taskXP").value || 0),
    start: document.getElementById("taskStart").value,
    end: document.getElementById("taskEnd").value,
    status: "active"
  };

  if (editingId) {
    App.tasks = App.tasks.map(item => item.id === editingId ? task : item);
    toast("تم تعديل المهمة.");
  } else {
    App.tasks.push(task);
    toast("تمت إضافة المهمة.");
  }

  saveData();
  resetTaskForm();
  refreshAll();
}

function resetTaskForm() {
  document.getElementById("taskForm").reset();
  document.getElementById("editingTaskId").value = "";
  document.getElementById("taskFormTitle").innerText = "➕ إضافة مهمة";
  document.getElementById("targetUser").classList.remove("show");
}

function editTask(id) {
  const task = App.tasks.find(item => item.id === id);
  if (!task) return;
  document.getElementById("editingTaskId").value = task.id;
  document.getElementById("taskTitle").value = task.title;
  document.getElementById("taskDescription").value = task.description;
  document.querySelector(`input[name="taskType"][value="${task.type}"]`).checked = true;
  document.getElementById("taskTarget").value = task.target;
  document.getElementById("taskXP").value = task.xp;
  document.getElementById("taskStart").value = task.start;
  document.getElementById("taskEnd").value = task.end;
  document.getElementById("taskFormTitle").innerText = "✏️ تعديل مهمة";
  toggleTargetUser();
  toast("تم تحميل المهمة للتعديل.");
}

function deleteTask(id) {
  if (!confirm("هل تريد حذف المهمة؟")) return;
  App.tasks = App.tasks.filter(task => task.id !== id);
  App.submissions = App.submissions.filter(sub => sub.taskId !== id);
  saveData();
  refreshAll();
  toast("تم حذف المهمة.");
}

function renderAdminTasks() {
  const list = document.getElementById("adminTasksList");
  if (!list) return;
  if (!App.tasks.length) {
    list.innerHTML = `<div class="empty">لا توجد مهام حتى الآن.</div>`;
    return;
  }
  list.innerHTML = App.tasks.map(task => `
    <div class="task-card">
      <h3>${task.title}</h3>
      <p>${task.description || "بدون وصف."}</p>
      <div class="meta">
        <span class="chip">${task.type === "general" ? "🌍 عامة" : `👤 ${getUserName(task.target)}`}</span>
        <span class="chip">⭐ ${task.xp} نقطة</span>
      </div>
      <div class="card-actions">
        <button class="edit-btn" onclick="editTask('${task.id}')">تعديل</button>
        <button class="delete-btn" onclick="deleteTask('${task.id}')">حذف</button>
      </div>
    </div>
  `).join("");
}

function getAvailableTasks() {
  if (!App.currentUser) return [];
  const completed = new Set(getProgress().completedTasks);
  const pending = new Set(App.submissions.filter(s => s.userId === App.currentUser.id && s.status === "pending").map(s => s.taskId));
  return App.tasks.filter(task => {
    const assigned = task.type === "general" || task.target === App.currentUser.id;
    return assigned && !completed.has(task.id) && !pending.has(task.id);
  });
}

function openTasksPage() {
  renderTasksForUser();
  showScreen("tasksPage", true);
}

function renderTasksForUser() {
  const list = document.getElementById("userTasksList");
  if (!list) return;
  const available = getAvailableTasks();
  const pending = App.submissions.filter(s => s.userId === App.currentUser?.id && s.status === "pending");

  if (!available.length && !pending.length) {
    list.innerHTML = `<div class="empty">لا توجد مهام متاحة حاليًا.</div>`;
    return;
  }

  list.innerHTML = "";
  if (available.length) {
    list.innerHTML += available.map(task => `
      <div class="task-card">
        <h3>${task.title}</h3>
        <p>${task.description || "بدون وصف."}</p>
        <div class="meta">
          <span class="chip">${task.type === "general" ? "🌍 عامة" : "👤 خاصة"}</span>
          <span class="chip">⭐ ${task.xp} نقطة</span>
        </div>
        <button class="main-btn" onclick="openTaskModal('${task.id}')">ابدأ المهمة</button>
      </div>
    `).join("");
  }
  if (pending.length) {
    list.innerHTML += `<div class="empty">⏳ لديك ${pending.length} مهمة بانتظار مراجعة المدير.</div>`;
  }
}

function openTaskModal(taskId) {
  const task = App.tasks.find(t => t.id === taskId);
  if (!task) return;
  selectedTaskId = task.id;
  setText("modalType", task.type === "general" ? "مهمة عامة" : "مهمة خاصة");
  setText("modalTaskTitle", task.title);
  setText("modalTaskDescription", task.description || "بدون وصف.");
  setText("modalTaskXP", `+${task.xp} نقطة`);
  document.getElementById("submissionAnswer").value = "";
  document.getElementById("taskModal").classList.add("show");
}

function closeModal() {
  document.getElementById("taskModal").classList.remove("show");
  selectedTaskId = null;
}

function submitCurrentTask() {
  const answer = document.getElementById("submissionAnswer").value.trim();
  if (!answer) return toast("اكتب إنجازك أو إجابتك أولًا.");
  if (!selectedTaskId || !App.currentUser) return;

  App.submissions.push({
    id: String(Date.now()),
    taskId: selectedTaskId,
    userId: App.currentUser.id,
    answer,
    status: "pending",
    createdAt: new Date().toISOString()
  });
  saveData();
  closeModal();
  refreshAll();
  toast("تم إرسال المهمة، بانتظار مراجعة المدير.");
}

function renderPendingReviews() {
  const list = document.getElementById("pendingReviewsList");
  if (!list) return;
  const pending = App.submissions.filter(s => s.status === "pending");
  if (!pending.length) {
    list.innerHTML = `<div class="empty">لا توجد مهام بانتظار المراجعة.</div>`;
    return;
  }
  list.innerHTML = pending.map(sub => {
    const task = App.tasks.find(t => t.id === sub.taskId);
    return `
      <div class="review-card">
        <h3>${task?.title || "مهمة محذوفة"}</h3>
        <p><b>المشارك:</b> ${getUserName(sub.userId)}</p>
        <p><b>الإجابة:</b> ${sub.answer}</p>
        <div class="meta"><span class="chip">⭐ ${task?.xp || 0} نقطة</span></div>
        <div class="card-actions">
          <button class="approve-btn" onclick="reviewSubmission('${sub.id}','approved')">قبول</button>
          <button class="reject-btn" onclick="reviewSubmission('${sub.id}','rejected')">رفض</button>
        </div>
      </div>
    `;
  }).join("");
}

function reviewSubmission(submissionId, status) {
  const sub = App.submissions.find(s => s.id === submissionId);
  if (!sub) return;

  const task = App.tasks.find(t => t.id === sub.taskId);

  if (status === "approved") {
    if (!confirm(`اعتماد المهمة وإضافة ${task?.xp || 0} نقطة إلى ${getUserName(sub.userId)}؟`)) return;
  }

  sub.status = status;
  sub.reviewedAt = new Date().toISOString();

  if (status === "approved") {
    const progress = getProgress(sub.userId);
    if (!progress.completedTasks.includes(sub.taskId)) {
      progress.completedTasks.push(sub.taskId);
      progress.xp += Number(task?.xp || 0);
      progress.latestAchievement = `${getUserName(sub.userId)} أنجز: ${task?.title || "مهمة"}`;
      progress.badges = getUserBadges(sub.userId).filter(b => b.unlocked).map(b => b.id);
      logActivity({
        type: "approve",
        submissionId: sub.id,
        taskId: sub.taskId,
        userId: sub.userId,
        xp: Number(task?.xp || 0),
        message: `تم اعتماد مهمة ${task?.title || "مهمة"} لـ ${getUserName(sub.userId)}`,
        undone: false
      });
    }
    toast("تم قبول المهمة وإضافة النقاط.");
  } else {
    logActivity({
      type: "reject",
      submissionId: sub.id,
      taskId: sub.taskId,
      userId: sub.userId,
      xp: 0,
      message: `تم رفض مهمة ${task?.title || "مهمة"} لـ ${getUserName(sub.userId)}`,
      undone: false
    });
    toast("تم رفض المهمة.");
  }
  saveData();
  refreshAll();
}

function logActivity(item) {
  App.activity = App.activity || [];
  App.activity.unshift({
    id: String(Date.now()) + Math.random().toString(16).slice(2),
    createdAt: new Date().toISOString(),
    adminId: App.currentUser?.id || "unknown",
    ...item
  });
}

function renderActivityLog() {
  const list = document.getElementById("activityLogList");
  if (!list) return;

  const logs = App.activity || [];
  if (!logs.length) {
    list.innerHTML = `<div class="empty">لا يوجد سجل عمليات حتى الآن.</div>`;
    return;
  }

  list.innerHTML = logs.map(log => {
    const sign = log.type === "approve" ? "+" : log.type === "undo" ? "−" : "";
    const canUndo = log.type === "approve" && !log.undone;
    const date = new Date(log.createdAt).toLocaleString("ar-SA");
    return `
      <div class="activity-card">
        <h3>${log.type === "approve" ? "✅ اعتماد" : log.type === "undo" ? "↩️ تراجع" : "❌ رفض"}</h3>
        <p>${log.message}</p>
        <div class="meta">
          <span class="chip">👤 ${getUserName(log.userId)}</span>
          <span class="chip">${sign}${log.xp || 0} نقطة</span>
          <span class="chip">🕒 ${date}</span>
        </div>
        ${canUndo ? `<button class="undo-btn" onclick="undoApproval('${log.id}')">↩️ تراجع وسحب النقاط</button>` : log.undone ? `<small class="muted-note">تم التراجع عن هذه العملية</small>` : ""}
      </div>
    `;
  }).join("");
}

function undoApproval(activityId) {
  const log = (App.activity || []).find(item => item.id === activityId);
  if (!log || log.type !== "approve" || log.undone) return;

  if (!confirm(`هل تريد سحب ${log.xp} نقطة من ${getUserName(log.userId)} وإرجاع المهمة للمراجعة؟`)) return;

  const progress = getProgress(log.userId);
  progress.xp = Math.max(0, Number(progress.xp || 0) - Number(log.xp || 0));
  progress.completedTasks = progress.completedTasks.filter(taskId => taskId !== log.taskId);
  progress.latestAchievement = "تم التراجع عن اعتماد سابق.";
  progress.badges = getUserBadges(log.userId).filter(b => b.unlocked).map(b => b.id);

  const sub = App.submissions.find(s => s.id === log.submissionId);
  if (sub) {
    sub.status = "pending";
    sub.reviewedAt = "";
  }

  log.undone = true;

  logActivity({
    type: "undo",
    submissionId: log.submissionId,
    taskId: log.taskId,
    userId: log.userId,
    xp: Number(log.xp || 0),
    message: `تم التراجع عن اعتماد مهمة ${App.tasks.find(t => t.id === log.taskId)?.title || "مهمة"} لـ ${getUserName(log.userId)}`,
    undone: false
  });

  saveData();
  refreshAll();
  toast("تم التراجع وسحب النقاط.");
}

function getUserBadges(userId) {
  const xp = getProgress(userId).xp;
  return LEVELS.map((level, index) => ({
    id: `level-${index}`,
    title: level.name,
    description: `الوصول إلى ${level.xp} نقطة`,
    unlocked: xp >= level.xp
  }));
}

function openAchievements() {
  renderAchievements();
  showScreen("achievementsPage", true);
}

function renderAchievements() {
  const list = document.getElementById("achievementsList");
  if (!list || !App.currentUser) return;
  const badges = getUserBadges(App.currentUser.id);
  list.innerHTML = badges.map(badge => `
    <div class="achievement-card ${badge.unlocked ? "" : "locked"}">
      <h3>${badge.unlocked ? "✅" : "🔒"} ${badge.title}</h3>
      <p>${badge.description}</p>
    </div>
  `).join("");
}

function openLeaderboard() {
  renderLeaderboard();
  showScreen("leaderboardPage", true);
}

function getRankedUsers() {
  return users.map(user => ({ user, xp: getProgress(user.id).xp }))
    .sort((a, b) => b.xp - a.xp);
}

function renderLeaderboard() {
  const list = document.getElementById("leaderboardList");
  if (!list) return;
  const medals = ["🥇", "🥈", "🥉"];
  list.innerHTML = getRankedUsers().map((item, index) => `
    <div class="leader-card" style="border-right:6px solid ${item.user.color}">
      <div class="leader-rank">${medals[index] || index + 1}</div>
      <div class="leader-info">
        <h3>${item.user.avatar} ${item.user.name}</h3>
        <p>${item.xp} نقطة • ${getLevelName(item.xp)}</p>
      </div>
    </div>
  `).join("");
}

function showAdminTab(tabId, btn) {
  document.querySelectorAll(".admin-tab").forEach(tab => tab.classList.remove("active"));
  document.getElementById(tabId).classList.add("active");
  document.querySelectorAll(".admin-tabs button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  refreshAll();
}

function getUserName(id) {
  return users.find(u => u.id === id)?.name || id;
}

function toast(message) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.innerText = message;
  el.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}
function checkFamilyCode(){

    const code = document
        .getElementById("familyCode")
        .value;

    if(code===FAMILY_CODE){

        localStorage.setItem(
            "familyAccess",
            "true"
        );

        document
            .getElementById("familyLock")
            .classList
            .add("hide");

    }

    else{

        alert("رمز العائلة غير صحيح");

    }

}