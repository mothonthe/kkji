// period-tracker.js - 月经记录应用（专业版）

/**
 * 全局变量
 */
let currentPeriodView = 'calendar'; // calendar | history | report | settings
let selectedDate = null; // 当前选中的日期
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-11
let reportTimeRange = 'all'; // all | year | 6months | 3months
let periodChart = null; // Chart.js 实例
let painChart = null;
let symptomsChart = null;
let durationChart = null;

/**
 * 数据库表初始化（在main-app.js的Dexie实例中添加）
 * 需要在数据库版本升级时添加以下表：
 * 
 * periodRecords: 'id++, startDate, endDate, flow, symptoms, mood, notes, createdAt'
 * periodSettings: 'id, characterId, enabled, avgCycleLength, avgPeriodLength'
 */

/**
 * 打开月经记录应用
 */
async function openPeriodTracker() {
  console.log('打开月经记录应用...');
  showScreen('period-tracker-screen');
  
  // 重置视图
  currentPeriodView = 'calendar';
  currentYear = new Date().getFullYear();
  currentMonth = new Date().getMonth();
  
  // 渲染日历视图
  await renderPeriodCalendar();
}

/**
 * 切换视图
 */
function switchPeriodView(view) {
  currentPeriodView = view;
  
  // 更新导航按钮状态
  document.querySelectorAll('.period-nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-view="${view}"]`)?.classList.add('active');
  
  // 显示对应内容
  document.getElementById('period-calendar-view').style.display = 
    view === 'calendar' ? 'block' : 'none';
  document.getElementById('period-history-view').style.display = 
    view === 'history' ? 'block' : 'none';
  document.getElementById('period-report-view').style.display = 
    view === 'report' ? 'block' : 'none';
  document.getElementById('period-settings-view').style.display = 
    view === 'settings' ? 'block' : 'none';
  
  // 渲染对应视图
  if (view === 'calendar') {
    renderPeriodCalendar();
  } else if (view === 'history') {
    renderPeriodHistory();
  } else if (view === 'report') {
    renderPeriodReport();
  } else if (view === 'settings') {
    renderPeriodSettings();
  }
}

/**
 * 渲染日历视图
 */
async function renderPeriodCalendar() {
  const container = document.getElementById('period-calendar-content');
  if (!container) return;
  
  // 获取当前月份的所有记录
  const records = await getPeriodRecordsForMonth(currentYear, currentMonth);
  
  // 生成日历HTML
  const firstDay = new Date(currentYear, currentMonth, 1).getDay(); // 0-6
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = new Date();
  
  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', 
                      '七月', '八月', '九月', '十月', '十一月', '十二月'];
  
  let html = `
    <div class="period-calendar-header">
      <button class="period-month-nav" onclick="changePeriodMonth(-1)">‹</button>
      <span class="period-month-title">${currentYear}年 ${monthNames[currentMonth]}</span>
      <button class="period-month-nav" onclick="changePeriodMonth(1)">›</button>
    </div>
    <div class="period-calendar-weekdays">
      <div>日</div><div>一</div><div>二</div><div>三</div>
      <div>四</div><div>五</div><div>六</div>
    </div>
    <div class="period-calendar-days">
  `;
  
  // 填充空白
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="period-day empty"></div>';
  }
  
  // 填充日期
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const record = records.find(r => isDateInRange(dateStr, r.startDate, r.endDate));
    const predicted = isPredictedPeriod(dateStr, records);
    const ovulation = isOvulationPeriod(dateStr, records);
    
    const isToday = today.getFullYear() === currentYear && 
                    today.getMonth() === currentMonth && 
                    today.getDate() === day;
    
    let classes = 'period-day';
    if (isToday) classes += ' today';
    if (record) classes += ' period-day';
    if (predicted) classes += ' predicted';
    if (ovulation && !record) classes += ' ovulation';
    
    html += `
      <div class="${classes}" data-date="${dateStr}" onclick="selectPeriodDate('${dateStr}')">
        <span class="day-number">${day}</span>
        ${record ? '<div class="period-dot"></div>' : ''}
        ${predicted ? '<div class="predicted-mark"></div>' : ''}
        ${ovulation && !record ? '<div class="ovulation-mark"></div>' : ''}
      </div>
    `;
  }
  
  html += '</div>';
  
  // 添加图例
  html += `
    <div class="period-legend">
      <div class="legend-item">
        <div class="legend-dot period-dot"></div>
        <span>经期</span>
      </div>
      <div class="legend-item">
        <div class="legend-dot predicted-mark"></div>
        <span>预测</span>
      </div>
    </div>
  `;
  
  // 添加统计信息
  const stats = await calculatePeriodStats(records);
  if (stats) {
    html += `
      <div class="period-stats">
        <div class="stat-item">
          <div class="stat-label">平均周期</div>
          <div class="stat-value">${stats.avgCycle || '--'}天</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">经期天数</div>
          <div class="stat-value">${stats.avgDuration || '--'}天</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">下次预测</div>
          <div class="stat-value">${stats.nextPredicted || '--'}</div>
        </div>
      </div>
    `;
  }
  
  // 快速添加按钮
  html += `
    <button class="period-add-btn" onclick="showPeriodAddModal()">
      <span style="font-size: 24px;">+</span> 记录本次经期
    </button>
  `;
  
  container.innerHTML = html;
}

/**
 * 切换月份
 */
function changePeriodMonth(delta) {
  currentMonth += delta;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  } else if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }
  renderPeriodCalendar();
}

/**
 * 选择日期
 */
function selectPeriodDate(dateStr) {
  selectedDate = dateStr;
  showPeriodDetailModal(dateStr);
}

/**
 * 显示添加记录弹窗
 */
async function showPeriodAddModal() {
  const modal = document.getElementById('period-add-modal');
  const today = new Date().toISOString().split('T')[0];
  
  // 重置表单
  document.getElementById('period-start-date').value = today;
  document.getElementById('period-end-date').value = '';
  document.getElementById('period-flow').value = 'medium';
  document.getElementById('period-symptoms').value = '';
  document.getElementById('period-mood').value = 'normal';
  document.getElementById('period-notes').value = '';
  
  // 重置新字段
  document.getElementById('period-pain-level').value = 0;
  document.getElementById('pain-level-display').textContent = '0';
  document.querySelectorAll('.pms-checkbox').forEach(cb => cb.checked = false);
  document.getElementById('period-pms-custom').value = '';
  document.getElementById('period-product-changes').value = '';
  document.getElementById('period-sleep-quality').value = 3;
  updateStarDisplay(3);
  document.getElementById('period-exercise-duration').value = '';
  
  modal.style.display = 'flex';
}

/**
 * 隐藏添加记录弹窗
 */
function hidePeriodAddModal() {
  document.getElementById('period-add-modal').style.display = 'none';
}

/**
 * 保存经期记录
 */
async function savePeriodRecord() {
  const startDate = document.getElementById('period-start-date').value;
  const endDate = document.getElementById('period-end-date').value;
  const flow = document.getElementById('period-flow').value;
  const symptoms = document.getElementById('period-symptoms').value;
  const mood = document.getElementById('period-mood').value;
  const notes = document.getElementById('period-notes').value;
  
  // 新字段
  const painLevel = parseInt(document.getElementById('period-pain-level').value) || 0;
  
  // PMS症状收集
  const pmsSymptoms = [];
  document.querySelectorAll('.pms-checkbox:checked').forEach(cb => {
    pmsSymptoms.push(cb.value);
  });
  const customPms = document.getElementById('period-pms-custom').value.trim();
  if (customPms) {
    pmsSymptoms.push(...customPms.split(/[,，、]/).map(s => s.trim()).filter(s => s));
  }
  
  const productChanges = document.getElementById('period-product-changes').value.trim();
  const sleepQuality = parseInt(document.getElementById('period-sleep-quality').value) || 3;
  const exerciseDuration = parseInt(document.getElementById('period-exercise-duration').value) || 0;
  
  if (!startDate) {
    alert('请选择开始日期');
    return;
  }
  
  // 验证日期
  if (endDate && new Date(endDate) < new Date(startDate)) {
    alert('结束日期不能早于开始日期');
    return;
  }
  
  try {
    // 保存到数据库
    await db.periodRecords.add({
      startDate,
      endDate: endDate || null,
      flow,
      symptoms,
      mood,
      notes,
      painLevel,
      pmsSymptoms: JSON.stringify(pmsSymptoms),
      productChanges,
      sleepQuality,
      exerciseDuration,
      createdAt: new Date().toISOString()
    });
    
    // 关闭弹窗
    hidePeriodAddModal();
    
    // 根据当前视图智能刷新
    if (currentPeriodView === 'calendar') {
      await renderPeriodCalendar();
    } else if (currentPeriodView === 'history') {
      await renderPeriodHistory();
    } else if (currentPeriodView === 'report') {
      await renderPeriodReport();
    }
    
    // 提示
    showToast('记录保存成功');
    
    // 检查是否需要发送通知提醒
    await checkAndScheduleNotifications();
  } catch (error) {
    console.error('保存经期记录失败:', error);
    alert('保存失败，请重试');
  }
}

/**
 * 显示日期详情弹窗
 */
async function showPeriodDetailModal(dateStr) {
  const records = await db.periodRecords.toArray();
  const record = records.find(r => isDateInRange(dateStr, r.startDate, r.endDate));
  
  const modal = document.getElementById('period-detail-modal');
  const content = document.getElementById('period-detail-content');
  
  if (record) {
    const duration = calculateDuration(record.startDate, record.endDate);
    content.innerHTML = `
      <h3>经期详情</h3>
      <div class="detail-row">
        <span class="detail-label">日期:</span>
        <span>${record.startDate}${record.endDate ? ' ~ ' + record.endDate : ' (进行中)'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">持续天数:</span>
        <span>${duration}天</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">流量:</span>
        <span>${getFlowText(record.flow)}</span>
      </div>
      ${record.symptoms ? `
      <div class="detail-row">
        <span class="detail-label">症状:</span>
        <span>${record.symptoms}</span>
      </div>` : ''}
      ${record.mood ? `
      <div class="detail-row">
        <span class="detail-label">心情:</span>
        <span>${getMoodText(record.mood)}</span>
      </div>` : ''}
      ${record.notes ? `
      <div class="detail-row">
        <span class="detail-label">备注:</span>
        <span>${record.notes}</span>
      </div>` : ''}
      <div style="margin-top: 20px; display: flex; gap: 10px;">
        <button class="period-btn-secondary" onclick="editPeriodRecord(${record.id})">编辑</button>
        <button class="period-btn-danger" onclick="deletePeriodRecord(${record.id})">删除</button>
      </div>
    `;
  } else {
    content.innerHTML = `
      <h3>${dateStr}</h3>
      <p style="text-align: center; color: var(--text-secondary); margin: 20px 0;">
        该日期暂无记录
      </p>
      <button class="period-btn-primary" onclick="hidePeriodDetailModal(); showPeriodAddModal();">
        添加记录
      </button>
    `;
  }
  
  modal.style.display = 'flex';
}

/**
 * 隐藏详情弹窗
 */
function hidePeriodDetailModal() {
  document.getElementById('period-detail-modal').style.display = 'none';
}

/**
 * 删除记录
 */
async function deletePeriodRecord(id) {
  if (!confirm('确定要删除这条记录吗？')) return;
  
  try {
    await db.periodRecords.delete(id);
    hidePeriodDetailModal();
    
    // 根据当前视图智能刷新
    if (currentPeriodView === 'calendar') {
      await renderPeriodCalendar();
    } else if (currentPeriodView === 'history') {
      await renderPeriodHistory();
    } else if (currentPeriodView === 'report') {
      await renderPeriodReport();
    }
    
    showToast('删除成功');
  } catch (error) {
    console.error('删除记录失败:', error);
    alert('删除失败');
  }
}

/**
 * 渲染历史记录视图
 */
async function renderPeriodHistory() {
  const container = document.getElementById('period-history-content');
  if (!container) return;
  
  const records = await db.periodRecords.orderBy('startDate').reverse().toArray();
  
  if (records.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
        <p>暂无记录</p>
        <button class="period-btn-primary" onclick="switchPeriodView('calendar'); showPeriodAddModal();">
          添加第一条记录
        </button>
      </div>
    `;
    return;
  }
  
  let html = '<div class="period-history-list">';
  
  for (const record of records) {
    const duration = calculateDuration(record.startDate, record.endDate);
    html += `
      <div class="period-history-item" onclick="showPeriodDetailModal('${record.startDate}')">
        <div class="history-date">
          <div class="history-month">${new Date(record.startDate).getMonth() + 1}月</div>
          <div class="history-day">${new Date(record.startDate).getDate()}</div>
        </div>
        <div class="history-info">
          <div class="history-title">${record.startDate}${record.endDate ? ' ~ ' + record.endDate : ''}</div>
          <div class="history-meta">
            持续${duration}天 · 流量${getFlowText(record.flow)}
            ${record.symptoms ? ' · ' + record.symptoms : ''}
          </div>
        </div>
        <div class="history-arrow">›</div>
      </div>
    `;
  }
  
  html += '</div>';
  container.innerHTML = html;
}

/**
 * 渲染设置视图
 */
async function renderPeriodSettings() {
  const container = document.getElementById('period-settings-content');
  if (!container) return;
  
  // 获取所有角色（非群聊）
  const characters = await db.chats.filter(chat => !chat.isGroup).toArray();
  
  // 获取通知设置
  const notifSettings = await db.periodNotificationSettings.get('main');
  const notifEnabled = notifSettings?.enabled || false;
  
  let html = `
    <div class="period-settings-section">
      <h3>智能提醒</h3>
      <p class="settings-hint">
        开启后，会在经期临近、周期异常等情况下推送通知提醒
      </p>
      ${notifEnabled ? `
        <button class="period-btn-secondary" onclick="disableNotifications()">
          关闭通知
        </button>
        <div class="notif-settings-form" style="margin-top: 15px;">
          <div class="notif-form-row">
            <label>经期临近提醒：提前 
              <input type="number" id="notif-upcoming-days" value="${notifSettings.upcomingDays}" min="1" max="7" style="width: 50px;"> 天
            </label>
            <label style="margin-left: 15px;">时间 
              <input type="time" id="notif-upcoming-time" value="${notifSettings.upcomingTime}" style="width: 80px;">
            </label>
          </div>
          <div class="notif-form-row">
            <label>每日记录提醒：
              <input type="time" id="notif-record-time" value="${notifSettings.recordTime}" style="width: 80px;">
            </label>
          </div>
          <div class="notif-form-row">
            <label>周期异常判断：
              <input type="number" id="notif-cycle-min" value="${notifSettings.abnormalCycleMin}" min="15" max="25" style="width: 50px;"> 
              ~ 
              <input type="number" id="notif-cycle-max" value="${notifSettings.abnormalCycleMax}" min="30" max="45" style="width: 50px;"> 天
            </label>
          </div>
          <div class="notif-form-row">
            <label>延迟判断：比平均周期晚 
              <input type="number" id="notif-delay-days" value="${notifSettings.delayDays}" min="3" max="14" style="width: 50px;"> 天
            </label>
          </div>
          <button class="period-btn-primary" onclick="updateNotificationSettings()" style="margin-top: 10px;">
            保存设置
          </button>
        </div>
      ` : `
        <button class="period-btn-primary" onclick="enableNotifications()">
          开启通知
        </button>
      `}
    </div>
    
    <div class="period-settings-section">
      <h3>角色记忆权限</h3>
      <p class="settings-hint">
        开启后，角色会知道你的大致周期时间，<br>
        可以在聊天中自然地关心你。
      </p>
      
      <!-- 主开关 -->
      <div class="memory-master-switch-container">
        <div class="master-switch-label">
          <span class="master-switch-icon"></span>
          <div>
            <div class="master-switch-title">启用角色记忆功能</div>
            <div class="master-switch-hint">开启后可选择具体角色</div>
          </div>
        </div>
        <label class="ios-toggle-switch ios-toggle-switch-large">
          <input type="checkbox" id="memory-master-switch" 
                 onchange="toggleMemoryMasterSwitch(this.checked)">
          <span class="ios-toggle-slider"></span>
        </label>
      </div>
      
      <!-- 角色选择区域 -->
      <div id="character-memory-selection" style="display: none;">
        <div class="character-selection-header">
          <span>选择可以查看您周期信息的角色：</span>
          <button class="select-all-btn" onclick="toggleSelectAllCharacters()">
            <span id="select-all-text">全选</span>
          </button>
        </div>
        
        <div class="period-character-checkboxes">
  `;
  
  // 检查是否有任何角色已启用
  let anyEnabled = false;
  for (const char of characters) {
    const setting = await db.periodSettings.where('characterId').equals(char.id).first();
    if (setting?.enabled) {
      anyEnabled = true;
      break;
    }
  }
  
  for (const char of characters) {
    const setting = await db.periodSettings.where('characterId').equals(char.id).first();
    const enabled = setting?.enabled || false;
    
    html += `
      <label class="character-checkbox-item">
        <input type="checkbox" 
               class="character-memory-checkbox"
               data-character-id="${char.id}"
               ${enabled ? 'checked' : ''}>
        <div class="checkbox-character-info">
          <img src="${char.settings?.aiAvatar || 'https://i.postimg.cc/qRqpK5kP/anime-avatar.jpg'}" class="checkbox-char-avatar">
          <div class="checkbox-char-details">
            <div class="checkbox-char-name">${char.name}</div>
            <div class="checkbox-char-status">${enabled ? '✅ 已授权' : '未授权'}</div>
          </div>
        </div>
        <span class="checkbox-checkmark">✓</span>
      </label>
    `;
  }
  
  html += `
        </div>
        
        ${characters.length === 0 ? `
          <div class="no-characters-hint">
            <p style="font-size: 16px; margin: 0;">😊 您还没有创建任何角色</p>
            <p style="font-size: 14px; color: var(--text-secondary); margin-top: 8px;">
              请先在聊天中创建角色，然后再来设置权限
            </p>
          </div>
        ` : `
          <button class="period-btn-primary save-memory-btn" onclick="saveCharacterMemorySettings()">
            💾 保存设置
          </button>
        `}
      </div>
      
      <script>
        // 初始化主开关状态
        (function() {
          const anyEnabled = ${anyEnabled ? 'true' : 'false'};
          const masterSwitch = document.getElementById('memory-master-switch');
          const selectionArea = document.getElementById('character-memory-selection');
          if (anyEnabled && masterSwitch && selectionArea) {
            masterSwitch.checked = true;
            selectionArea.style.display = 'block';
          }
        })();
      </script>
    </div>
    
    <div class="period-settings-section">
      <h3>数据管理</h3>
      <button class="period-btn-secondary" onclick="exportPeriodData()">
        导出数据
      </button>
      <button class="period-btn-danger" onclick="clearAllPeriodData()">
        清空所有记录
      </button>
    </div>
    
    <div class="period-settings-section">
      <h3>关于</h3>
      <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
        此功能仅用于记录和预测月经周期，<br>
        不构成医疗建议。如有健康问题，<br>
        请咨询专业医生。
      </p>
    </div>
  `;
  
  container.innerHTML = html;
}

/**
 * 切换角色记忆权限（旧版本，保留兼容）
 */
async function toggleCharacterPeriodMemory(characterId, enabled) {
  try {
    // 修复：使用where查询而不是get
    const existing = await db.periodSettings.where('characterId').equals(characterId).first();
    
    if (existing) {
      await db.periodSettings.update(existing.id, {enabled});
    } else {
      await db.periodSettings.add({
        characterId,
        enabled,
        avgCycleLength: 28,
        avgPeriodLength: 5
      });
    }
    
    showToast(enabled ? '已开启角色记忆' : '已关闭角色记忆');
  } catch (error) {
    console.error('更新设置失败:', error);
    alert('操作失败，请重试');
  }
}

/**
 * 切换主开关
 */
function toggleMemoryMasterSwitch(enabled) {
  const selectionArea = document.getElementById('character-memory-selection');
  if (!selectionArea) return;
  
  if (enabled) {
    selectionArea.style.display = 'block';
  } else {
    selectionArea.style.display = 'none';
    // 关闭时清除所有选择
    const checkboxes = document.querySelectorAll('.character-memory-checkbox');
    checkboxes.forEach(cb => cb.checked = false);
  }
}

/**
 * 全选/取消全选
 */
function toggleSelectAllCharacters() {
  const checkboxes = document.querySelectorAll('.character-memory-checkbox');
  const selectAllText = document.getElementById('select-all-text');
  
  // 检查是否全选
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  
  checkboxes.forEach(cb => {
    cb.checked = !allChecked;
  });
  
  selectAllText.textContent = allChecked ? '全选' : '取消全选';
}

/**
 * 保存角色记忆设置
 */
async function saveCharacterMemorySettings() {
  const checkboxes = document.querySelectorAll('.character-memory-checkbox');
  const masterSwitch = document.getElementById('memory-master-switch');
  
  if (!masterSwitch.checked) {
    showToast('请先开启主开关');
    return;
  }
  
  try {
    let savedCount = 0;
    
    for (const checkbox of checkboxes) {
      const characterIdStr = checkbox.dataset.characterId;
      
      // 验证 characterId 是否存在
      if (!characterIdStr) {
        console.warn('缺少 characterId');
        continue;
      }
      
      // 尝试转换为数字，如果失败则使用原始字符串
      let characterId = parseInt(characterIdStr);
      if (isNaN(characterId)) {
        characterId = characterIdStr; // 保持为字符串
      }
      
      const enabled = checkbox.checked;
      
      // 使用 filter 代替 where().equals()，更安全
      const allSettings = await db.periodSettings.toArray();
      const existing = allSettings.find(s => s.characterId == characterId); // 使用 == 允许类型转换
      
      if (existing) {
        await db.periodSettings.update(existing.id, {enabled});
      } else {
        await db.periodSettings.add({
          characterId,
          enabled,
          avgCycleLength: 28,
          avgPeriodLength: 5
        });
      }
      
      if (enabled) savedCount++;
    }
    
    showToast(`✅ 设置已保存！已为 ${savedCount} 个角色开启记忆权限`);
    
    // 刷新显示
    setTimeout(() => {
      renderPeriodSettings();
    }, 1500);
    
  } catch (error) {
    console.error('保存设置失败:', error);
    alert('保存失败，请重试');
  }
}

/**
 * 导出数据
 */
async function exportPeriodData() {
  try {
    const records = await db.periodRecords.toArray();
    const dataStr = JSON.stringify(records, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `period-records-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('导出失败:', error);
    alert('导出失败');
  }
}

/**
 * 清空所有数据
 */
async function clearAllPeriodData() {
  if (!confirm('确定要清空所有记录吗？此操作不可恢复！')) return;
  if (!confirm('再次确认：真的要删除所有月经记录吗？')) return;
  
  try {
    await db.periodRecords.clear();
    
    // 根据当前视图智能刷新
    if (currentPeriodView === 'calendar') {
      await renderPeriodCalendar();
    } else if (currentPeriodView === 'history') {
      await renderPeriodHistory();
    } else if (currentPeriodView === 'report') {
      await renderPeriodReport();
    }
    
    showToast('已清空所有记录');
  } catch (error) {
    console.error('清空失败:', error);
    alert('操作失败');
  }
}

/**
 * ========== 工具函数 ==========
 */

/**
 * 获取指定月份的记录
 */
async function getPeriodRecordsForMonth(year, month) {
  const startOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const endOfMonth = new Date(year, month + 1, 0).getDate();
  const endOfMonthStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(endOfMonth).padStart(2, '0')}`;
  
  const records = await db.periodRecords
    .where('startDate')
    .between(startOfMonth, endOfMonthStr, true, true)
    .toArray();
  
  return records;
}

/**
 * 判断日期是否在范围内
 */
function isDateInRange(date, startDate, endDate) {
  if (!startDate) return false;
  if (!endDate) endDate = startDate;
  return date >= startDate && date <= endDate;
}

/**
 * 预测经期
 */
function isPredictedPeriod(dateStr, records) {
  if (records.length < 2) return false;
  
  // 简单预测：基于最近两次的周期
  const sorted = records.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  const last = sorted[0];
  const secondLast = sorted[1];
  
  if (!last || !secondLast) return false;
  
  const cycleLength = Math.round(
    (new Date(last.startDate) - new Date(secondLast.startDate)) / (1000 * 60 * 60 * 24)
  );
  
  const nextPredictedStart = new Date(last.startDate);
  nextPredictedStart.setDate(nextPredictedStart.getDate() + cycleLength);
  
  const predictedStr = nextPredictedStart.toISOString().split('T')[0];
  const predictedEndDate = new Date(nextPredictedStart);
  predictedEndDate.setDate(predictedEndDate.getDate() + 5); // 假设5天
  
  return isDateInRange(dateStr, predictedStr, predictedEndDate.toISOString().split('T')[0]);
}

/**
 * 计算统计数据
 */
async function calculatePeriodStats(records) {
  if (records.length === 0) return null;
  
  const sorted = records.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  
  // 平均周期
  let totalCycle = 0;
  let cycleCount = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const cycle = Math.round(
      (new Date(sorted[i].startDate) - new Date(sorted[i + 1].startDate)) / (1000 * 60 * 60 * 24)
    );
    totalCycle += cycle;
    cycleCount++;
  }
  const avgCycle = cycleCount > 0 ? Math.round(totalCycle / cycleCount) : 28;
  
  // 平均经期天数
  let totalDuration = 0;
  let durationCount = 0;
  for (const record of sorted) {
    if (record.endDate) {
      const duration = calculateDuration(record.startDate, record.endDate);
      totalDuration += duration;
      durationCount++;
    }
  }
  const avgDuration = durationCount > 0 ? Math.round(totalDuration / durationCount) : 5;
  
  // 下次预测
  const lastRecord = sorted[0];
  const nextDate = new Date(lastRecord.startDate);
  nextDate.setDate(nextDate.getDate() + avgCycle);
  const nextPredicted = `${nextDate.getMonth() + 1}月${nextDate.getDate()}日`;
  
  return {
    avgCycle,
    avgDuration,
    nextPredicted
  };
}

/**
 * 计算持续天数
 */
function calculateDuration(startDate, endDate) {
  if (!endDate) return 1;
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * 获取流量文字
 */
function getFlowText(flow) {
  const map = {
    light: '少量',
    medium: '中等',
    heavy: '较多'
  };
  return map[flow] || flow;
}

/**
 * 获取心情文字
 */
function getMoodText(mood) {
  const map = {
    great: '很好',
    good: '不错',
    normal: '一般',
    bad: '不好',
    terrible: '很差'
  };
  return map[mood] || mood;
}

/**
 * 获取角色的经期摘要（用于注入AI对话）
 */
async function getPeriodSummaryForCharacter(characterId) {
  // 检查该角色是否开启了记忆权限
  const setting = await db.periodSettings.where('characterId').equals(characterId).first();
  if (!setting || !setting.enabled) {
    return null; // 未开启，返回null
  }
  
  // 获取最近的记录
  const records = await db.periodRecords.orderBy('startDate').reverse().limit(3).toArray();
  if (records.length === 0) return null;
  
  const lastRecord = records[0];
  const stats = await calculatePeriodStats(records);
  
  // 构建摘要文本
  const summary = `
【生理周期信息】
- 上次经期：${lastRecord.startDate}${lastRecord.endDate ? ' 至 ' + lastRecord.endDate : ''}
- 平均周期：约${stats?.avgCycle || 28}天
- 预计下次：${stats?.nextPredicted || '暂无数据'}
${lastRecord.symptoms ? '- 最近症状：' + lastRecord.symptoms : ''}

注意：你是她的亲密伴侣/朋友，知道这些信息。在对话中可以自然地关心她，但不要表现得像工具或提醒功能。
`.trim();
  
  return summary;
}

/**
 * 显示提示消息
 */
function showToast(message) {
  // 简单实现，可以后续优化
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    z-index: 10000;
    font-size: 14px;
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 2000);
}

/**
 * ========== 新增功能：UI辅助函数 ==========
 */

/**
 * 更新痛经程度滑块显示
 */
function updatePainLevelDisplay(value) {
  document.getElementById('pain-level-display').textContent = value;
}

/**
 * 更新睡眠质量星星显示
 */
function updateStarDisplay(value) {
  const container = document.getElementById('sleep-stars-display');
  if (!container) return;
  
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += i <= value ? '⭐' : '☆';
  }
  container.innerHTML = html;
}

/**
 * 计算排卵期
 * @param {Array} records - 历史记录
 * @returns {Object} {ovulationDate, ovulationPeriodStart, ovulationPeriodEnd}
 */
function calculateOvulation(records) {
  if (records.length === 0) return null;
  
  const stats = calculatePeriodStatsSync(records);
  if (!stats || !stats.avgCycle) return null;
  
  const sorted = records.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  const lastPeriod = new Date(sorted[0].startDate);
  
  // 下次月经日期
  const nextPeriod = new Date(lastPeriod);
  nextPeriod.setDate(nextPeriod.getDate() + stats.avgCycle);
  
  // 排卵日 = 下次月经前14天
  const ovulationDate = new Date(nextPeriod);
  ovulationDate.setDate(ovulationDate.getDate() - 14);
  
  // 排卵期 = 排卵日前后3天
  const ovulationStart = new Date(ovulationDate);
  ovulationStart.setDate(ovulationStart.getDate() - 3);
  
  const ovulationEnd = new Date(ovulationDate);
  ovulationEnd.setDate(ovulationEnd.getDate() + 3);
  
  return {
    ovulationDate: ovulationDate.toISOString().split('T')[0],
    ovulationStart: ovulationStart.toISOString().split('T')[0],
    ovulationEnd: ovulationEnd.toISOString().split('T')[0]
  };
}

/**
 * 判断日期是否在排卵期
 */
function isOvulationPeriod(dateStr, records) {
  const ovulation = calculateOvulation(records);
  if (!ovulation) return false;
  
  return dateStr >= ovulation.ovulationStart && dateStr <= ovulation.ovulationEnd;
}

/**
 * 同步版本的统计计算（用于排卵期计算）
 */
function calculatePeriodStatsSync(records) {
  if (records.length === 0) return null;
  
  const sorted = records.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  
  let totalCycle = 0;
  let cycleCount = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const cycle = Math.round(
      (new Date(sorted[i].startDate) - new Date(sorted[i + 1].startDate)) / (1000 * 60 * 60 * 24)
    );
    totalCycle += cycle;
    cycleCount++;
  }
  const avgCycle = cycleCount > 0 ? Math.round(totalCycle / cycleCount) : 28;
  
  return { avgCycle };
}

/**
 * ========== 报告页面渲染 ==========
 */

/**
 * 渲染报告视图
 */
async function renderPeriodReport() {
  const container = document.getElementById('period-report-content');
  if (!container) return;
  
  const allRecords = await db.periodRecords.orderBy('startDate').reverse().toArray();
  
  if (allRecords.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: var(--pt-text-secondary);">
        <p style="font-size: 16px; margin-bottom: 10px;">暂无数据</p>
        <p style="font-size: 14px;">至少需要2条记录才能生成报告</p>
        <button class="period-btn-primary" style="margin-top: 20px; max-width: 200px;" 
                onclick="switchPeriodView('calendar'); showPeriodAddModal();">
          添加第一条记录
        </button>
      </div>
    `;
    return;
  }
  
  // 根据时间范围筛选数据
  const records = filterRecordsByTimeRange(allRecords, reportTimeRange);
  
  // 计算健康评分
  const healthScore = calculateHealthScore(records);
  
  let html = `
    <!-- 时间范围选择器 -->
    <div class="report-time-selector">
      <button class="time-range-btn ${reportTimeRange === 'all' ? 'active' : ''}" 
              onclick="changeReportTimeRange('all')">全部历史</button>
      <button class="time-range-btn ${reportTimeRange === 'year' ? 'active' : ''}" 
              onclick="changeReportTimeRange('year')">近1年</button>
      <button class="time-range-btn ${reportTimeRange === '6months' ? 'active' : ''}" 
              onclick="changeReportTimeRange('6months')">近6月</button>
      <button class="time-range-btn ${reportTimeRange === '3months' ? 'active' : ''}" 
              onclick="changeReportTimeRange('3months')">近3月</button>
    </div>
    
    <!-- 健康评分卡片 -->
    <div class="health-score-card">
      <div class="score-main">
        <div class="score-number">${healthScore.total}</div>
        <div class="score-label">健康评分</div>
        <div class="score-stars">${getStars(healthScore.stars)}</div>
        <div class="score-status">${healthScore.status}</div>
      </div>
      <div class="score-details">
        <div class="score-item">
          <span class="score-item-label">周期规律</span>
          <span class="score-item-value">${healthScore.regularity}%</span>
        </div>
        <div class="score-item">
          <span class="score-item-label">经期正常</span>
          <span class="score-item-value">${healthScore.durationNormal ? '✓' : '注意'}</span>
        </div>
        <div class="score-item">
          <span class="score-item-label">痛经程度</span>
          <span class="score-item-value">${healthScore.painLevel}</span>
        </div>
      </div>
    </div>
    
    <!-- 图表区域 -->
    <div class="report-charts-grid">
      <div class="chart-container">
        <h3 class="chart-title">周期长度趋势</h3>
        <canvas id="cycle-trend-chart"></canvas>
      </div>
      
      <div class="chart-container">
        <h3 class="chart-title">经期天数统计</h3>
        <canvas id="duration-chart"></canvas>
      </div>
      
      <div class="chart-container">
        <h3 class="chart-title">症状频率分布</h3>
        <div class="chart-wrapper-doughnut">
           <canvas id="symptoms-chart"></canvas>
        </div>
      </div>
      
      <div class="chart-container">
        <h3 class="chart-title">痛经程度趋势</h3>
        <canvas id="pain-trend-chart"></canvas>
      </div>
    </div>
    
    <!-- 健康建议 -->
    <div class="health-suggestions">
      <h3>健康建议</h3>
      ${generateHealthSuggestions(records, healthScore)}
    </div>
  `;
  
  container.innerHTML = html;
  
  // 渲染图表
  setTimeout(() => {
    renderCycleTrendChart(records);
    renderDurationChart(records);
    renderSymptomsChart(records);
    renderPainTrendChart(records);
  }, 100);
}

/**
 * 切换报告时间范围
 */
function changeReportTimeRange(range) {
  reportTimeRange = range;
  renderPeriodReport();
}

/**
 * 根据时间范围筛选记录
 */
function filterRecordsByTimeRange(records, range) {
  if (range === 'all') return records;
  
  const now = new Date();
  const cutoffDate = new Date(now);
  
  if (range === '3months') {
    cutoffDate.setMonth(now.getMonth() - 3);
  } else if (range === '6months') {
    cutoffDate.setMonth(now.getMonth() - 6);
  } else if (range === 'year') {
    cutoffDate.setFullYear(now.getFullYear() - 1);
  }
  
  const cutoffStr = cutoffDate.toISOString().split('T')[0];
  return records.filter(r => r.startDate >= cutoffStr);
}

/**
 * 计算健康评分
 */
function calculateHealthScore(records) {
  if (records.length < 2) {
    return {
      total: 0,
      stars: 0,
      status: '数据不足',
      regularity: 0,
      durationNormal: true,
      painLevel: '未知'
    };
  }
  
  const sorted = records.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  
  // 1. 周期规律性 (0-40分)
  let cycles = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const cycle = Math.round(
      (new Date(sorted[i].startDate) - new Date(sorted[i + 1].startDate)) / (1000 * 60 * 60 * 24)
    );
    cycles.push(cycle);
  }
  
  const avgCycle = cycles.reduce((a, b) => a + b, 0) / cycles.length;
  const variance = cycles.reduce((sum, c) => sum + Math.pow(c - avgCycle, 2), 0) / cycles.length;
  const stdDev = Math.sqrt(variance);
  
  let regularityScore = 40;
  if (stdDev > 7) regularityScore = 20;
  else if (stdDev > 5) regularityScore = 30;
  else if (stdDev > 3) regularityScore = 35;
  
  const regularity = Math.round((1 - Math.min(stdDev / 10, 1)) * 100);
  
  // 2. 经期天数正常性 (0-30分)
  let durationScore = 30;
  let durationNormal = true;
  const durations = sorted.filter(r => r.endDate).map(r => 
    calculateDuration(r.startDate, r.endDate)
  );
  if (durations.length > 0) {
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    if (avgDuration < 3 || avgDuration > 7) {
      durationScore = 15;
      durationNormal = false;
    }
  }
  
  // 3. 痛经程度 (0-30分)
  let painScore = 30;
  let painLevel = '轻度';
  const painLevels = sorted.filter(r => r.painLevel !== undefined).map(r => r.painLevel);
  if (painLevels.length > 0) {
    const avgPain = painLevels.reduce((a, b) => a + b, 0) / painLevels.length;
    if (avgPain > 7) {
      painScore = 10;
      painLevel = '重度';
    } else if (avgPain > 4) {
      painScore = 20;
      painLevel = '中度';
    } else {
      painLevel = '轻度';
    }
  } else {
    painLevel = '未记录';
  }
  
  const total = regularityScore + durationScore + painScore;
  let stars = 5;
  let status = '优秀';
  if (total < 50) {
    stars = 2;
    status = '需关注';
  } else if (total < 70) {
    stars = 3;
    status = '一般';
  } else if (total < 85) {
    stars = 4;
    status = '良好';
  }
  
  return {
    total,
    stars,
    status,
    regularity,
    durationNormal,
    painLevel
  };
}

/**
 * 获取星星显示
 */
function getStars(count) {
  return '⭐'.repeat(count) + '☆'.repeat(5 - count);
}

/**
 * 生成健康建议
 */
function generateHealthSuggestions(records, healthScore) {
  const suggestions = [];
  
  if (healthScore.regularity < 70) {
    suggestions.push('• 您的周期不太规律，建议保持规律作息，避免熬夜和过度劳累');
  } else {
    suggestions.push('• 您的周期非常规律，继续保持良好的生活习惯');
  }
  
  if (!healthScore.durationNormal) {
    suggestions.push('• 经期天数异常，建议关注身体变化，必要时咨询医生');
  }
  
  if (healthScore.painLevel === '重度') {
    suggestions.push('• 痛经较为严重，建议经期避免生冷食物，适当热敷腹部，症状严重请就医');
  } else if (healthScore.painLevel === '中度') {
    suggestions.push('• 有一定程度的痛经，建议经期注意保暖，避免剧烈运动');
  }
  
  // 根据PMS症状给建议
  const sorted = records.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  const recentRecords = sorted.slice(0, 3);
  const allSymptoms = [];
  recentRecords.forEach(r => {
    if (r.pmsSymptoms) {
      try {
        allSymptoms.push(...JSON.parse(r.pmsSymptoms));
      } catch (e) {}
    }
  });
  
  if (allSymptoms.includes('失眠')) {
    suggestions.push('• 近期多次出现失眠，建议睡前避免使用电子设备，可尝试热水泡脚');
  }
  if (allSymptoms.includes('易怒')) {
    suggestions.push('• 经期情绪波动较大，可以适当进行轻度运动，如瑜伽、散步');
  }
  
  if (suggestions.length === 0) {
    suggestions.push('• 您的整体状况良好，继续保持健康的生活方式');
  }
  
  return '<ul>' + suggestions.map(s => `<li>${s}</li>`).join('') + '</ul>';
}

/**
 * ========== Chart.js 图表渲染 ==========
 */

/**
 * 渲染周期趋势图
 */
function renderCycleTrendChart(records) {
  const canvas = document.getElementById('cycle-trend-chart');
  if (!canvas) return;
  
  if (periodChart) {
    periodChart.destroy();
  }
  
  const sorted = records.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  const cycles = [];
  const labels = [];
  
  for (let i = 1; i < sorted.length; i++) {
    const cycle = Math.round(
      (new Date(sorted[i].startDate) - new Date(sorted[i - 1].startDate)) / (1000 * 60 * 60 * 24)
    );
    cycles.push(cycle);
    labels.push(new Date(sorted[i].startDate).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }));
  }
  
  const ctx = canvas.getContext('2d');
  periodChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: '周期长度(天)',
        data: cycles,
        borderColor: '#FF9EAA',
        backgroundColor: 'rgba(255, 158, 170, 0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          min: 20,
          max: 40
        }
      }
    }
  });
}

/**
 * 渲染经期天数统计
 */
function renderDurationChart(records) {
  const canvas = document.getElementById('duration-chart');
  if (!canvas) return;
  
  if (durationChart) {
    durationChart.destroy();
  }
  
  const sorted = records.filter(r => r.endDate).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  const durations = sorted.map(r => calculateDuration(r.startDate, r.endDate));
  const labels = sorted.map(r => new Date(r.startDate).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }));
  
  const ctx = canvas.getContext('2d');
  durationChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '经期天数',
        data: durations,
        backgroundColor: '#FFB7C5',
        borderColor: '#FF9EAA',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 10
        }
      }
    }
  });
}

/**
 * 渲染症状频率分布
 */
function renderSymptomsChart(records) {
  const canvas = document.getElementById('symptoms-chart');
  if (!canvas) return;
  
  if (symptomsChart) {
    symptomsChart.destroy();
  }
  
  // 统计症状频率
  const symptomCount = {};
  records.forEach(r => {
    if (r.pmsSymptoms) {
      try {
        const symptoms = JSON.parse(r.pmsSymptoms);
        symptoms.forEach(s => {
          symptomCount[s] = (symptomCount[s] || 0) + 1;
        });
      } catch (e) {}
    }
  });
  
  const sortedSymptoms = Object.entries(symptomCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  
  if (sortedSymptoms.length === 0) {
    canvas.style.display = 'none';
    return;
  }
  
  const ctx = canvas.getContext('2d');
  symptomsChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sortedSymptoms.map(s => s[0]),
      datasets: [{
        data: sortedSymptoms.map(s => s[1]),
        backgroundColor: [
          '#FFB7C5',
          '#FFC5CD',
          '#FFD1DC',
          '#FFDBE4',
          '#FFE4EC',
          '#FFECF4'
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}

/**
 * 渲染痛经趋势
 */
function renderPainTrendChart(records) {
  const canvas = document.getElementById('pain-trend-chart');
  if (!canvas) return;
  
  if (painChart) {
    painChart.destroy();
  }
  
  const sorted = records.filter(r => r.painLevel !== undefined).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  const painLevels = sorted.map(r => r.painLevel);
  const labels = sorted.map(r => new Date(r.startDate).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }));
  
  if (painLevels.length === 0) {
    canvas.style.display = 'none';
    return;
  }
  
  const ctx = canvas.getContext('2d');
  painChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: '痛经程度',
        data: painLevels,
        borderColor: '#FF6B9D',
        backgroundColor: 'rgba(255, 107, 157, 0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 10
        }
      }
    }
  });
}

/**
 * ========== 通知系统 ==========
 */

/**
 * 请求浏览器通知权限
 */
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    alert('您的浏览器不支持通知功能');
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission === 'denied') {
    alert('通知权限已被拒绝，请在浏览器设置中允许通知');
    return false;
  }
  
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

/**
 * 开启通知功能
 */
async function enableNotifications() {
  const granted = await requestNotificationPermission();
  
  if (!granted) {
    return;
  }
  
  // 保存通知设置（默认值）
  await db.periodNotificationSettings.put({
    id: 'main',
    enabled: true,
    upcomingDays: 3,      // 提前3天
    upcomingTime: '09:00', // 早上9点
    recordTime: '20:00',   // 晚上8点
    abnormalCycleMin: 21,  // 最短21天
    abnormalCycleMax: 35,  // 最长35天
    delayDays: 7           // 延迟7天算异常
  });
  
  showToast('通知已开启');
  renderPeriodSettings();
  
  // 立即检查并调度通知
  await checkAndScheduleNotifications();
}

/**
 * 关闭通知功能
 */
async function disableNotifications() {
  await db.periodNotificationSettings.put({
    id: 'main',
    enabled: false
  });
  
  showToast('通知已关闭');
  renderPeriodSettings();
}

/**
 * 检查并调度通知
 */
async function checkAndScheduleNotifications() {
  const settings = await db.periodNotificationSettings.get('main');
  if (!settings || !settings.enabled) return;
  
  const records = await db.periodRecords.orderBy('startDate').reverse().toArray();
  if (records.length === 0) return;
  
  const stats = await calculatePeriodStats(records);
  if (!stats) return;
  
  const lastRecord = records[0];
  const lastDate = new Date(lastRecord.startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const daysSinceLastPeriod = Math.round((today - lastDate) / (1000 * 60 * 60 * 24));
  
  // 预测下次经期日期
  const nextPeriodDate = new Date(lastDate);
  nextPeriodDate.setDate(nextPeriodDate.getDate() + stats.avgCycle);
  
  const daysUntilNext = Math.round((nextPeriodDate - today) / (1000 * 60 * 60 * 24));
  
  // 1. 经期临近提醒
  if (daysUntilNext === settings.upcomingDays) {
    scheduleNotification('经期提醒', `预计${settings.upcomingDays}天后到来，记得做好准备哦`, settings.upcomingTime);
  }
  
  // 2. 周期异常提醒
  if (daysSinceLastPeriod > settings.abnormalCycleMax) {
    sendNotificationNow('周期异常', '本次周期较长，建议关注身体状况');
  } else if (stats.avgCycle < settings.abnormalCycleMin) {
    sendNotificationNow('周期异常', '您的平均周期较短，建议咨询医生');
  }
  
  // 3. 延迟提醒
  if (daysSinceLastPeriod > stats.avgCycle + settings.delayDays) {
    sendNotificationNow('经期延迟', `已延迟${daysSinceLastPeriod - stats.avgCycle}天，注意身体变化`);
  }
}

/**
 * 发送即时通知
 */
function sendNotificationNow(title, body) {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body: body,
      icon: 'https://i.postimg.cc/RVGt0yMN/calendar-pink.png',
      badge: 'https://i.postimg.cc/RVGt0yMN/calendar-pink.png'
    });
  }
}

/**
 * 调度通知（简化版，实际应该用Service Worker）
 */
function scheduleNotification(title, body, time) {
  // 简化实现：检查当前时间是否接近设定时间
  const now = new Date();
  const [hour, minute] = time.split(':');
  const targetTime = new Date();
  targetTime.setHours(parseInt(hour), parseInt(minute), 0, 0);
  
  const diff = targetTime - now;
  if (diff > 0 && diff < 60 * 60 * 1000) { // 1小时内
    setTimeout(() => {
      sendNotificationNow(title, body);
    }, diff);
  }
}

/**
 * 更新提醒设置
 */
async function updateNotificationSettings() {
  const settings = {
    id: 'main',
    enabled: true,
    upcomingDays: parseInt(document.getElementById('notif-upcoming-days').value) || 3,
    upcomingTime: document.getElementById('notif-upcoming-time').value || '09:00',
    recordTime: document.getElementById('notif-record-time').value || '20:00',
    abnormalCycleMin: parseInt(document.getElementById('notif-cycle-min').value) || 21,
    abnormalCycleMax: parseInt(document.getElementById('notif-cycle-max').value) || 35,
    delayDays: parseInt(document.getElementById('notif-delay-days').value) || 7
  };
  
  await db.periodNotificationSettings.put(settings);
  showToast('设置已保存');
}

/**
 * ========== 暴露函数到全局作用域（供HTML内联事件使用）==========
 */
window.openPeriodTracker = openPeriodTracker;
window.switchPeriodView = switchPeriodView;
window.changePeriodMonth = changePeriodMonth;
window.selectPeriodDate = selectPeriodDate;
window.showPeriodAddModal = showPeriodAddModal;
window.hidePeriodAddModal = hidePeriodAddModal;
window.savePeriodRecord = savePeriodRecord;
window.showPeriodDetailModal = showPeriodDetailModal;
window.hidePeriodDetailModal = hidePeriodDetailModal;
window.deletePeriodRecord = deletePeriodRecord;
window.toggleCharacterPeriodMemory = toggleCharacterPeriodMemory;
window.toggleMemoryMasterSwitch = toggleMemoryMasterSwitch;
window.saveCharacterMemorySettings = saveCharacterMemorySettings;
window.toggleSelectAllCharacters = toggleSelectAllCharacters;
window.enableNotifications = enableNotifications;
window.disableNotifications = disableNotifications;
window.updateNotificationSettings = updateNotificationSettings;
window.exportPeriodData = exportPeriodData;
window.clearAllPeriodData = clearAllPeriodData;
window.updatePainLevelDisplay = updatePainLevelDisplay;
window.updateStarDisplay = updateStarDisplay;
window.changeReportTimeRange = changeReportTimeRange;
window.getPeriodSummaryForCharacter = getPeriodSummaryForCharacter;

console.log('月经记录模块已加载（专业版）');
