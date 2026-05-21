const STORAGE_KEY = "petmind-state-v1";

const moodLabels = {
  relaxed: "放松",
  active: "活跃",
  tired: "疲惫",
  nervous: "紧张",
  uncomfortable: "可能不适",
  unknown: "无法判断"
};

const healthLabels = {
  normal: "未见明显异常",
  observe: "建议继续观察",
  consult_vet: "建议咨询兽医",
  unknown: "无法判断"
};

const speciesLabels = {
  cat: "猫",
  dog: "狗"
};

const genderLabels = {
  male: "公",
  female: "母",
  unknown: "未知"
};

const state = loadState();

const els = {
  navItems: document.querySelectorAll(".nav-item"),
  views: document.querySelectorAll(".view"),
  petList: document.querySelector("#petList"),
  recordList: document.querySelector("#recordList"),
  trendGrid: document.querySelector("#trendGrid"),
  todaySummary: document.querySelector("#todaySummary"),
  petModal: document.querySelector("#petModal"),
  petForm: document.querySelector("#petForm"),
  recordModal: document.querySelector("#recordModal"),
  recordForm: document.querySelector("#recordForm"),
  analysisModal: document.querySelector("#analysisModal"),
  analysisDetail: document.querySelector("#analysisDetail"),
  recordPet: document.querySelector("#recordPet"),
  recordImage: document.querySelector("#recordImage"),
  cameraFieldButton: document.querySelector("#cameraFieldButton"),
  uploadPreview: document.querySelector("#uploadPreview"),
  profileName: document.querySelector("#profileName"),
  profileEmail: document.querySelector("#profileEmail")
};

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      authenticated: false,
      profile: { name: "", email: "" },
      pets: [],
      records: []
    };
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {
      authenticated: false,
      profile: { name: "", email: "" },
      pets: [],
      records: []
    };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(new Date(value));
}

function fullDate(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function calculateAge(birthday) {
  if (!birthday) return "年龄未知";
  const birth = new Date(birthday);
  const today = new Date();
  const months = (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth();
  if (months < 12) return `${Math.max(months, 1)} 个月`;
  return `${Math.floor(months / 12)} 岁`;
}

function showView(viewName) {
  els.views.forEach((view) => view.classList.toggle("active", view.id === `${viewName}View`));
  els.navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === viewName));
  render();
}

function openModal(modal) {
  if (!modal.open) modal.showModal();
}

function closeModal(modal) {
  if (modal.open) modal.close();
}

function getPet(petId) {
  return state.pets.find((pet) => pet.id === petId);
}

function recordsForPet(petId) {
  return state.records
    .filter((record) => record.petId === petId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function latestRecord() {
  return [...state.records].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
}

function render() {
  document.body.classList.toggle("is-authenticated", Boolean(state.authenticated));
  renderPets();
  renderPetOptions();
  renderToday();
  renderRecords();
  renderTrends();
  renderProfile();
}

function renderPets() {
  if (!state.pets.length) {
    els.petList.innerHTML = `
      <div class="empty-state">
        <strong>还没有宠物档案</strong>
        <p>先添加一只猫或狗，之后就可以上传照片并生成每日分析。</p>
        <button class="primary-button" type="button" data-action="add-pet">新增宠物</button>
      </div>
    `;
    return;
  }

  els.petList.innerHTML = state.pets
    .map((pet) => {
      const latest = recordsForPet(pet.id)[0];
      const avatar = pet.avatar
        ? `<img src="${pet.avatar}" alt="${pet.name} 的头像" />`
        : `<div class="avatar-fallback">${pet.species === "cat" ? "猫" : "狗"}</div>`;
      return `
        <article class="pet-card" data-pet-id="${pet.id}">
          <div class="pet-avatar">${avatar}</div>
          <div class="pet-info">
            <div class="pet-title">
              <h4>${escapeHtml(pet.name)}</h4>
              <span>${speciesLabels[pet.species]}</span>
            </div>
            <p>${escapeHtml(pet.breed || "未知品种")} · ${genderLabels[pet.gender]} · ${calculateAge(pet.birthday)}</p>
            <div class="status-row">
              <span>${pet.weight ? `${pet.weight} kg` : "体重未填"}</span>
              <span>${latest ? `最近：${moodLabels[latest.analysis.mood]}` : "暂无记录"}</span>
            </div>
          </div>
          <div class="pet-actions">
            <button class="secondary-button small" type="button" data-action="upload" data-pet-id="${pet.id}">拍照</button>
            <button class="ghost-button small" type="button" data-action="delete-pet" data-pet-id="${pet.id}">删除</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderPetOptions() {
  els.recordPet.innerHTML = state.pets
    .map((pet) => `<option value="${pet.id}">${escapeHtml(pet.name)} · ${speciesLabels[pet.species]}</option>`)
    .join("");
}

function renderToday() {
  const record = latestRecord();
  if (!record) {
    els.todaySummary.className = "empty-state";
    els.todaySummary.innerHTML = `
      <strong>今天还没有分析</strong>
      <p>上传一张清晰的宠物照片后，这里会显示 AI 总结、风险等级和照护建议。</p>
    `;
    return;
  }

  const pet = getPet(record.petId);
  els.todaySummary.className = `today-card risk-${record.analysis.riskLevel}`;
  els.todaySummary.innerHTML = `
    <img src="${record.image}" alt="${pet?.name || "宠物"} 的记录照片" />
    <div>
      <span class="risk-badge ${record.analysis.riskLevel}">${riskLabel(record.analysis.riskLevel)}</span>
      <h4>${escapeHtml(pet?.name || "宠物")} · ${moodLabels[record.analysis.mood]}</h4>
      <p>${escapeHtml(record.analysis.summary)}</p>
      <button class="secondary-button small" type="button" data-action="view-analysis" data-record-id="${record.id}">查看报告</button>
    </div>
  `;
}

function renderRecords() {
  if (!state.records.length) {
    els.recordList.innerHTML = `
      <div class="empty-state">
        <strong>暂无历史记录</strong>
        <p>每次上传照片后，分析结果都会保存在这里。</p>
      </div>
    `;
    return;
  }

  const rows = [...state.records].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  els.recordList.innerHTML = rows
    .map((record) => {
      const pet = getPet(record.petId);
      return `
        <article class="record-card">
          <img src="${record.image}" alt="${pet?.name || "宠物"} 的记录照片" />
          <div class="record-main">
            <div class="record-top">
              <div>
                <h3>${escapeHtml(pet?.name || "已删除宠物")}</h3>
                <p>${fullDate(record.createdAt)}</p>
              </div>
              <span class="risk-badge ${record.analysis.riskLevel}">${riskLabel(record.analysis.riskLevel)}</span>
            </div>
            <p>${escapeHtml(record.analysis.summary)}</p>
            <div class="chip-row">
              <span>${moodLabels[record.analysis.mood]}</span>
              <span>${healthLabels[record.analysis.healthStatus]}</span>
              <span>情绪分 ${record.analysis.moodScore}</span>
            </div>
          </div>
          <div class="record-actions">
            <button class="secondary-button small" type="button" data-action="view-analysis" data-record-id="${record.id}">报告</button>
            <button class="ghost-button small" type="button" data-action="delete-record" data-record-id="${record.id}">删除</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderTrends() {
  if (!state.records.length) {
    els.trendGrid.innerHTML = `
      <div class="empty-state">
        <strong>趋势需要更多记录</strong>
        <p>上传几天照片后，这里会出现情绪、风险和异常提醒趋势。</p>
      </div>
    `;
    return;
  }

  const sorted = [...state.records].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).slice(-7);
  const avgMood = Math.round(sorted.reduce((sum, record) => sum + record.analysis.moodScore, 0) / sorted.length);
  const warnings = sorted.filter((record) => record.analysis.warning).length;
  const highRisk = sorted.filter((record) => record.analysis.riskLevel === "high").length;

  els.trendGrid.innerHTML = `
    <section class="metric-card">
      <span>平均情绪分</span>
      <strong>${avgMood}</strong>
      <p>基于最近 ${sorted.length} 条记录</p>
    </section>
    <section class="metric-card">
      <span>异常提醒</span>
      <strong>${warnings}</strong>
      <p>建议结合饮食、排便和精神状态观察</p>
    </section>
    <section class="metric-card">
      <span>高风险次数</span>
      <strong>${highRisk}</strong>
      <p>出现高风险时请优先咨询兽医</p>
    </section>
    <section class="panel wide">
      <div class="panel-header">
        <div>
          <p class="eyebrow">7 Days</p>
          <h3>情绪趋势</h3>
        </div>
      </div>
      <div class="bars">
        ${sorted
          .map(
            (record) => `
              <div class="bar-item">
                <div class="bar-track">
                  <div class="bar-fill risk-${record.analysis.riskLevel}" style="height: ${record.analysis.moodScore}%"></div>
                </div>
                <span>${formatDate(record.createdAt).slice(0, 4)}</span>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderProfile() {
  els.profileName.value = state.profile.name || "";
  els.profileEmail.value = state.profile.email || "";
}

async function handlePetSubmit(event) {
  event.preventDefault();
  const avatarFile = document.querySelector("#petAvatar").files[0];
  const avatar = avatarFile ? await readFileAsDataUrl(avatarFile) : "";

  state.pets.push({
    id: uid("pet"),
    name: document.querySelector("#petName").value.trim(),
    species: document.querySelector("#petSpecies").value,
    breed: document.querySelector("#petBreed").value.trim(),
    gender: document.querySelector("#petGender").value,
    birthday: document.querySelector("#petBirthday").value,
    weight: document.querySelector("#petWeight").value,
    neutered: document.querySelector("#petNeutered").value,
    medical: document.querySelector("#petMedical").value.trim(),
    personality: document.querySelector("#petPersonality").value.trim(),
    avatar
  });

  saveState();
  els.petForm.reset();
  closeModal(els.petModal);
  render();
}

async function handleRecordSubmit(event) {
  event.preventDefault();
  if (!state.pets.length) return;

  const file = els.recordImage.files[0];
  const image = await readFileAsDataUrl(file);
  const petId = els.recordPet.value;
  const pet = getPet(petId);
  const note = document.querySelector("#recordNote").value.trim();
  const createdAt = new Date().toISOString();

  const record = {
    id: uid("record"),
    petId,
    image,
    note,
    createdAt,
    analysis: createAnalysis({ pet, note, createdAt })
  };

  state.records.push(record);
  saveState();
  els.recordForm.reset();
  els.uploadPreview.innerHTML = "";
  closeModal(els.recordModal);
  render();
  showAnalysis(record.id);
}

function createAnalysis({ pet, note, createdAt }) {
  const text = `${pet?.medical || ""} ${pet?.personality || ""} ${note || ""}`.toLowerCase();
  const riskyWords = ["不吃", "呕吐", "拉稀", "腹泻", "流血", "伤口", "抽搐", "呼吸", "疼", "痛", "没精神"];
  const observeWords = ["疲惫", "害怕", "紧张", "躲", "少吃", "咳", "打喷嚏", "眼屎"];
  const activeWords = ["活跃", "开心", "玩", "跑", "精神好", "正常"];

  let riskLevel = "low";
  let healthStatus = "normal";
  let mood = pet?.personality?.includes("胆小") ? "nervous" : "relaxed";
  let moodScore = 76 + Math.floor(Math.random() * 15);
  let warning = false;

  if (riskyWords.some((word) => text.includes(word))) {
    riskLevel = "high";
    healthStatus = "consult_vet";
    mood = "uncomfortable";
    moodScore = 38 + Math.floor(Math.random() * 15);
    warning = true;
  } else if (observeWords.some((word) => text.includes(word))) {
    riskLevel = "medium";
    healthStatus = "observe";
    mood = text.includes("疲惫") ? "tired" : "nervous";
    moodScore = 55 + Math.floor(Math.random() * 12);
    warning = true;
  } else if (activeWords.some((word) => text.includes(word))) {
    mood = "active";
    moodScore = 84 + Math.floor(Math.random() * 10);
  }

  const observations = [
    `${pet?.name || "宠物"} 今日记录已完成，可作为长期趋势的一部分。`,
    pet?.weight ? `档案体重为 ${pet.weight} kg，后续可结合体重变化观察。` : "体重信息尚未填写，建议补充以便长期追踪。",
    note ? "用户备注已纳入本次分析。" : "本次未填写备注，建议记录饮食、排便和活动情况。"
  ];

  const suggestions =
    riskLevel === "high"
      ? ["建议尽快联系专业兽医。", "保留照片和备注，方便就诊时说明变化。", "继续观察食欲、排便、呼吸和精神状态。"]
      : riskLevel === "medium"
        ? ["未来 24 小时内继续观察状态变化。", "如异常持续或加重，请咨询兽医。", "明天尽量在相同光线下再次拍照记录。"]
        : ["继续保持日常观察。", "可以记录饮食、饮水、排便和活动量。", "建议每天在相似角度拍摄，便于长期对比。"];

  const summary =
    riskLevel === "high"
      ? `${pet?.name || "宠物"} 今天的记录出现需要重视的信号，建议联系专业兽医进一步确认。`
      : riskLevel === "medium"
        ? `${pet?.name || "宠物"} 今天的状态建议继续观察，暂时不要忽略连续变化。`
        : `${pet?.name || "宠物"} 今天整体状态较稳定，适合继续做日常记录。`;

  return {
    mood,
    moodScore,
    healthStatus,
    riskLevel,
    observations,
    suggestions,
    warning,
    summary,
    disclaimer: "该结果仅供日常观察参考，不能替代专业兽医诊断。",
    createdAt
  };
}

function showAnalysis(recordId) {
  const record = state.records.find((item) => item.id === recordId);
  if (!record) return;

  const pet = getPet(record.petId);
  const analysis = record.analysis;

  els.analysisDetail.innerHTML = `
    <div class="analysis-layout">
      <img src="${record.image}" alt="${pet?.name || "宠物"} 的分析照片" />
      <div class="analysis-summary risk-${analysis.riskLevel}">
        <span class="risk-badge ${analysis.riskLevel}">${riskLabel(analysis.riskLevel)}</span>
        <h3>${escapeHtml(pet?.name || "宠物")} · ${moodLabels[analysis.mood]}</h3>
        <p>${escapeHtml(analysis.summary)}</p>
      </div>
    </div>
    <div class="analysis-metrics">
      <div><span>情绪分</span><strong>${analysis.moodScore}</strong></div>
      <div><span>健康状态</span><strong>${healthLabels[analysis.healthStatus]}</strong></div>
      <div><span>记录时间</span><strong>${formatDate(record.createdAt)}</strong></div>
    </div>
    <section class="analysis-section">
      <h4>观察点</h4>
      <ul>${analysis.observations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>
    <section class="analysis-section">
      <h4>建议</h4>
      <ul>${analysis.suggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>
    ${record.note ? `<section class="analysis-section"><h4>用户备注</h4><p>${escapeHtml(record.note)}</p></section>` : ""}
    <p class="disclaimer">${escapeHtml(analysis.disclaimer)}</p>
  `;

  openModal(els.analysisModal);
}

function openRecordModal(petId) {
  if (!state.pets.length) {
    openModal(els.petModal);
    return;
  }
  renderPetOptions();
  if (petId) els.recordPet.value = petId;
  els.recordImage.value = "";
  els.uploadPreview.innerHTML = "";
  openModal(els.recordModal);
}

function riskLabel(level) {
  return level === "high" ? "高风险" : level === "medium" ? "需观察" : "正常";
}

function seedDemo() {
  if (state.pets.length || state.records.length) return;
  const cat = {
    id: uid("pet"),
    name: "糯米",
    species: "cat",
    breed: "英短",
    gender: "female",
    birthday: "2022-08-16",
    weight: "4.6",
    neutered: "yes",
    medical: "无明显既往病史",
    personality: "黏人，偶尔胆小",
    avatar: ""
  };
  const dog = {
    id: uid("pet"),
    name: "阿布",
    species: "dog",
    breed: "柴犬",
    gender: "male",
    birthday: "2021-04-03",
    weight: "10.8",
    neutered: "no",
    medical: "",
    personality: "活跃，喜欢外出",
    avatar: ""
  };
  state.pets.push(cat, dog);

  const demoImages = [makeDemoImage("#5a7c72", "猫"), makeDemoImage("#b86b4b", "狗")];
  state.records.push(
    {
      id: uid("record"),
      petId: cat.id,
      image: demoImages[0],
      note: "今天精神正常，比较黏人。",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      analysis: createAnalysis({ pet: cat, note: "今天精神正常，比较黏人。", createdAt: new Date().toISOString() })
    },
    {
      id: uid("record"),
      petId: dog.id,
      image: demoImages[1],
      note: "今天外出后有点疲惫。",
      createdAt: new Date().toISOString(),
      analysis: createAnalysis({ pet: dog, note: "今天外出后有点疲惫。", createdAt: new Date().toISOString() })
    }
  );
  saveState();
  render();
}

function makeDemoImage(color, text) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="640" viewBox="0 0 900 640">
      <rect width="900" height="640" rx="40" fill="${color}"/>
      <circle cx="450" cy="280" r="150" fill="#fff4e7"/>
      <text x="450" y="320" text-anchor="middle" font-size="120" font-family="Arial" fill="${color}">${text}</text>
      <text x="450" y="470" text-anchor="middle" font-size="38" font-family="Arial" fill="#fff4e7">PetMind demo photo</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.addEventListener("click", (event) => {
  const navTarget = event.target.closest("[data-view-target]");
  if (navTarget) showView(navTarget.dataset.viewTarget);

  const closeTarget = event.target.closest("[data-close-modal]");
  if (closeTarget) closeModal(document.querySelector(`#${closeTarget.dataset.closeModal}`));

  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) return;

  const { action, petId, recordId } = actionTarget.dataset;
  if (action === "add-pet") openModal(els.petModal);
  if (action === "upload") openRecordModal(petId);
  if (action === "view-analysis") showAnalysis(recordId);
  if (action === "delete-record") {
    const index = state.records.findIndex((record) => record.id === recordId);
    if (index >= 0) state.records.splice(index, 1);
    saveState();
    render();
  }
  if (action === "delete-pet") {
    const petIndex = state.pets.findIndex((pet) => pet.id === petId);
    if (petIndex >= 0) state.pets.splice(petIndex, 1);
    state.records = state.records.filter((record) => record.petId !== petId);
    saveState();
    render();
  }
});

els.navItems.forEach((item) => item.addEventListener("click", () => showView(item.dataset.view)));
document.querySelector("#openPetModal").addEventListener("click", () => openModal(els.petModal));
document.querySelector("#addPetInline").addEventListener("click", () => openModal(els.petModal));
document.querySelector("#quickUpload").addEventListener("click", () => openRecordModal());
document.querySelector("#recordUpload").addEventListener("click", () => openRecordModal());
els.cameraFieldButton.addEventListener("click", () => els.recordImage.click());
document.querySelector("#seedDemo").addEventListener("click", seedDemo);
document.querySelector("#logoutButton").addEventListener("click", () => {
  state.authenticated = false;
  saveState();
  render();
});
document.querySelector("#authForm").addEventListener("submit", (event) => {
  event.preventDefault();
  state.authenticated = true;
  state.profile.name = document.querySelector("#authName").value.trim() || "宠物主人";
  state.profile.email = document.querySelector("#authEmail").value.trim();
  saveState();
  render();
});
document.querySelector("#saveProfile").addEventListener("click", () => {
  state.profile.name = els.profileName.value.trim();
  state.profile.email = els.profileEmail.value.trim();
  saveState();
});
document.querySelector("#clearData").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  state.authenticated = false;
  state.profile = { name: "", email: "" };
  state.pets = [];
  state.records = [];
  render();
});

els.petForm.addEventListener("submit", handlePetSubmit);
els.recordForm.addEventListener("submit", handleRecordSubmit);
els.recordImage.addEventListener("change", async () => {
  const file = els.recordImage.files[0];
  if (!file) {
    els.uploadPreview.innerHTML = "";
    return;
  }
  const image = await readFileAsDataUrl(file);
  els.uploadPreview.innerHTML = `<img src="${image}" alt="上传预览" />`;
});

render();
