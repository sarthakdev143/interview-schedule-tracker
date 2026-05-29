(function() {
  const STORAGE_KEY = 'interview_schedule_data';
  const DEFAULT_INTERVIEWS = [
    {
      id: 'sample-1',
      candidate: 'Aarav Mehta',
      role: 'Frontend Engineer',
      round: 'Technical',
      date: '2026-06-02',
      startTime: '10:00',
      endTime: '10:45',
      interviewer: 'Lisa Chen',
      meetingLink: 'https://meet.google.com/abc',
      notes: 'Focus on React and accessibility.',
      status: 'Scheduled',
      updatedAt: '2026-05-29T08:15:00Z'
    },
    {
      id: 'sample-2',
      candidate: 'Priya Sharma',
      role: 'Product Manager',
      round: 'Culture',
      date: '2026-06-02',
      startTime: '10:30',
      endTime: '11:00',
      interviewer: 'Mark Rivera',
      meetingLink: 'https://zoom.us/j/123',
      notes: 'Evaluate roadmap thinking and stakeholder alignment.',
      status: 'Conflict',
      updatedAt: '2026-05-29T08:16:00Z'
    }
  ];

  let interviews = [];
  let conflictFilterActive = false;
  let searchTerm = '';
  let candidateFilter = '';
  let interviewerFilter = '';
  let editingId = null;
  let sortState = { key: 'date', direction: 'asc' };

  const HEADER_ALIASES = {
    candidate: 'candidate',
    name: 'candidate',
    'candidate name': 'candidate',
    role: 'role',
    position: 'role',
    'job role': 'role',
    round: 'round',
    'interview round': 'round',
    date: 'date',
    'interview date': 'date',
    'start time': 'startTime',
    'start_time': 'startTime',
    start: 'startTime',
    'end time': 'endTime',
    'end_time': 'endTime',
    end: 'endTime',
    interviewer: 'interviewer',
    'interviewer name': 'interviewer',
    'meeting link': 'meetingLink',
    link: 'meetingLink',
    url: 'meetingLink',
    notes: 'notes',
    comment: 'notes',
    status: 'status',
    updated: 'updatedAt',
    'last updated': 'updatedAt'
  };

  function normalizeHeader(raw) {
    return HEADER_ALIASES[raw.trim().toLowerCase()] || raw.trim().toLowerCase();
  }

  function getInput(id) {
    return document.getElementById(id);
  }

  function generateId() {
    return window.crypto?.randomUUID?.() || `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function normalizeMeetingLink(link) {
    if (!link) return '';
    const trimmed = link.trim();
    if (!trimmed) return '';
    try {
      return new URL(trimmed).href;
    } catch {
      try {
        return new URL(`https://${trimmed}`).href;
      } catch {
        return trimmed;
      }
    }
  }

  function parseDateTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    const normalizedDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const combined = `${normalizedDate}T${timeStr}`;
    const date = new Date(combined);
    return isNaN(date.getTime()) ? null : date;
  }

  function detectOverlaps(interviewList) {
    const conflicts = new Set();
    const conflictDetails = new Map();

    for (let i = 0; i < interviewList.length; i += 1) {
      const a = interviewList[i];
      const startA = parseDateTime(a.date, a.startTime);
      const endA = parseDateTime(a.date, a.endTime);
      if (!startA || !endA) continue;
      for (let j = i + 1; j < interviewList.length; j += 1) {
        const b = interviewList[j];
        if (a.date !== b.date) continue;
        const startB = parseDateTime(b.date, b.startTime);
        const endB = parseDateTime(b.date, b.endTime);
        if (!startB || !endB) continue;
        if (startA < endB && startB < endA) {
          conflicts.add(a.id);
          conflicts.add(b.id);
          const aNote = `Conflicts with ${b.candidate || b.interviewer || 'another interview'} @ ${b.startTime}`;
          const bNote = `Conflicts with ${a.candidate || a.interviewer || 'another interview'} @ ${a.startTime}`;
          conflictDetails.set(a.id, [...(conflictDetails.get(a.id) || []), aNote]);
          conflictDetails.set(b.id, [...(conflictDetails.get(b.id) || []), bNote]);
        }
      }
    }

    return { conflicts, conflictDetails };
  }

  function updateConflictStatus() {
    const { conflicts, conflictDetails } = detectOverlaps(interviews);
    interviews.forEach((iv) => {
      iv.status = conflicts.has(iv.id) ? 'Conflict' : 'Scheduled';
      iv.conflictDetails = (conflictDetails.get(iv.id) || []).join(' | ');
    });
  }

  function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(interviews));
  }

  function loadFromStorage() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        interviews = JSON.parse(stored);
      } catch (e) {
        interviews = [];
      }
    }
    if (!Array.isArray(interviews) || interviews.length === 0) {
      interviews = DEFAULT_INTERVIEWS.slice();
    }
    interviews = interviews.map((iv) => ({ ...iv, id: iv.id || generateId(), notes: iv.notes || '', updatedAt: iv.updatedAt || new Date().toISOString(), conflictDetails: iv.conflictDetails || '' }));
    updateConflictStatus();
  }

  function renderStats() {
    const total = interviews.length;
    const conflicts = interviews.filter((i) => i.status === 'Conflict').length;
    const today = new Date().toISOString().split('T')[0];
    const upcomingToday = interviews.filter((i) => i.date === today).length;
    const uniqueCandidates = new Set(interviews.map((i) => (i.candidate || '').trim().toLowerCase())).size;
    const uniqueInterviewers = new Set(interviews.map((i) => (i.interviewer || '').trim().toLowerCase())).size;

    getInput('statsContainer').innerHTML = `
      <div class="stat-card"><span class="stat-label">Total Interviews</span><span class="stat-value">${total}</span></div>
      <div class="stat-card conflict-stat"><span class="stat-label">⚠ Conflicts</span><span class="stat-value">${conflicts}</span></div>
      <div class="stat-card"><span class="stat-label">Upcoming Today</span><span class="stat-value">${upcomingToday}</span></div>
      <div class="stat-card"><span class="stat-label">Unique Interviewers</span><span class="stat-value">${uniqueInterviewers}</span></div>
      <div class="stat-card"><span class="stat-label">Unique Candidates</span><span class="stat-value">${uniqueCandidates}</span></div>
    `;
  }

  function buildFilterOptions() {
    const candidates = Array.from(new Set(interviews.map((i) => (i.candidate || '').trim()).filter(Boolean))).sort();
    const interviewers = Array.from(new Set(interviews.map((i) => (i.interviewer || '').trim()).filter(Boolean))).sort();

    const candidateSelect = getInput('candidateFilter');
    const interviewerSelect = getInput('interviewerFilter');

    candidateSelect.innerHTML = `<option value="">All candidates</option>${candidates.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('')}`;
    interviewerSelect.innerHTML = `<option value="">All interviewers</option>${interviewers.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('')}`;

    if (candidateFilter) candidateSelect.value = candidateFilter;
    if (interviewerFilter) interviewerSelect.value = interviewerFilter;
  }

  function sortInterviews(list) {
    const copy = [...list];
    copy.sort((a, b) => {
      const aValue = (a[sortState.key] || '').toString().toLowerCase();
      const bValue = (b[sortState.key] || '').toString().toLowerCase();
      if (aValue === bValue) return 0;
      const result = aValue < bValue ? -1 : 1;
      return sortState.direction === 'asc' ? result : -result;
    });
    return copy;
  }

  function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>\"]/g, (m) => {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      if (m === '"') return '&quot;';
      return m;
    });
  }

  function renderTable(filteredInterviews = []) {
    const tbody = getInput('interviewTableBody');
    tbody.innerHTML = '';

    if (filteredInterviews.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:2rem; color:#64748b;">No interviews matched your filters.</td></tr>';
      return;
    }

    filteredInterviews.forEach((iv) => {
      const row = document.createElement('tr');
      if (iv.status === 'Conflict') row.classList.add('conflict-row');
      if (editingId === iv.id) row.classList.add('editing-row');
      row.innerHTML = `
        <td>${escapeHtml(iv.candidate || '—')}</td>
        <td>${escapeHtml(iv.role || '—')}</td>
        <td>${escapeHtml(iv.round || '—')}</td>
        <td>${escapeHtml(iv.date || '—')}</td>
        <td>${escapeHtml(iv.startTime || '—')}</td>
        <td>${escapeHtml(iv.endTime || '—')}</td>
        <td>${escapeHtml(iv.interviewer || '—')}</td>
        <td>${iv.meetingLink ? `<a href="${escapeHtml(iv.meetingLink)}" target="_blank" rel="noopener" class="meeting-link">Join</a>` : '—'}</td>
        <td><span class="badge ${iv.status === 'Conflict' ? 'conflict' : 'scheduled'}" title="${escapeHtml(iv.conflictDetails || iv.status)}">${escapeHtml(iv.status)}</span></td>
        <td>${escapeHtml(iv.updatedAt ? iv.updatedAt.split('T')[0] : '—')}</td>
        <td class="button-cell">
          <button class="small-btn edit-btn" type="button" data-id="${iv.id}" aria-label="Edit interview for ${escapeHtml(iv.candidate)}">✏️</button>
          <button class="small-btn duplicate-btn" type="button" data-id="${iv.id}" aria-label="Duplicate interview for ${escapeHtml(iv.candidate)}">⎘</button>
          <button class="small-btn danger delete-btn" type="button" data-id="${iv.id}" aria-label="Delete interview for ${escapeHtml(iv.candidate)}">🗑</button>
        </td>
      `;
      tbody.appendChild(row);
    });

    tbody.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        removeInterviewById(event.currentTarget.dataset.id);
      });
    });

    tbody.querySelectorAll('.edit-btn').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        setEditing(event.currentTarget.dataset.id);
      });
    });

    tbody.querySelectorAll('.duplicate-btn').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        duplicateInterviewById(event.currentTarget.dataset.id);
      });
    });
  }

  function applyCurrentFiltersAndRender() {
    let filtered = [...interviews];

    if (conflictFilterActive) {
      filtered = filtered.filter((iv) => iv.status === 'Conflict');
    }

    if (candidateFilter) {
      filtered = filtered.filter((iv) => iv.candidate === candidateFilter);
    }

    if (interviewerFilter) {
      filtered = filtered.filter((iv) => iv.interviewer === interviewerFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      filtered = filtered.filter((iv) =>
        (iv.candidate || '').toLowerCase().includes(term) ||
        (iv.role || '').toLowerCase().includes(term) ||
        (iv.round || '').toLowerCase().includes(term) ||
        (iv.interviewer || '').toLowerCase().includes(term) ||
        (iv.notes || '').toLowerCase().includes(term)
      );
    }

    filtered = sortInterviews(filtered);
    buildFilterOptions();
    renderTable(filtered);
    renderStats();
  }

  function resetForm() {
    ['candidateInput', 'roleInput', 'roundInput', 'dateInput', 'startTimeInput', 'endTimeInput', 'interviewerInput', 'meetingLinkInput', 'notesInput'].forEach((id) => {
      getInput(id).value = '';
    });
    editingId = null;
    setEditingMode(false);
  }

  function populateForm(interview) {
    getInput('candidateInput').value = interview.candidate || '';
    getInput('roleInput').value = interview.role || '';
    getInput('roundInput').value = interview.round || '';
    getInput('dateInput').value = interview.date || '';
    getInput('startTimeInput').value = interview.startTime || '';
    getInput('endTimeInput').value = interview.endTime || '';
    getInput('interviewerInput').value = interview.interviewer || '';
    getInput('meetingLinkInput').value = interview.meetingLink || '';
    getInput('notesInput').value = interview.notes || '';
  }

  function setEditingMode(isEditing) {
    const addBtn = getInput('addInterviewBtn');
    const cancelBtn = getInput('cancelEditBtn');
    if (isEditing) {
      addBtn.textContent = 'Save Changes';
      cancelBtn.style.display = 'inline-flex';
    } else {
      addBtn.textContent = 'Add';
      cancelBtn.style.display = 'none';
    }
  }

  function setEditing(id) {
    const interview = interviews.find((iv) => iv.id === id);
    if (!interview) return;
    editingId = id;
    populateForm(interview);
    setEditingMode(true);
    getInput('candidateInput').focus();
    applyCurrentFiltersAndRender();
  }

  function validateInterview(data) {
    if (!data.candidate || !data.role) {
      return { valid: false, message: 'Candidate and Role are required.' };
    }

    if (data.startTime && data.endTime) {
      const start = parseDateTime(data.date, data.startTime);
      const end = parseDateTime(data.date, data.endTime);
      if (!start || !end) {
        return { valid: false, message: 'Start time and end time must be valid values.' };
      }
      if (start >= end) {
        return { valid: false, message: 'End Time must be later than Start Time.' };
      }
    }

    if (data.meetingLink) {
      const normalized = normalizeMeetingLink(data.meetingLink);
      if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
        return { valid: false, message: 'Please enter a valid meeting link including the protocol or a valid URL format.' };
      }
      data.meetingLink = normalized;
    }

    return { valid: true };
  }

  function addOrSaveInterview() {
    const interviewData = {
      id: editingId || generateId(),
      candidate: getInput('candidateInput').value.trim(),
      role: getInput('roleInput').value.trim(),
      round: getInput('roundInput').value.trim(),
      date: getInput('dateInput').value,
      startTime: getInput('startTimeInput').value,
      endTime: getInput('endTimeInput').value,
      interviewer: getInput('interviewerInput').value.trim(),
      meetingLink: getInput('meetingLinkInput').value.trim(),
      notes: getInput('notesInput').value.trim(),
      updatedAt: new Date().toISOString(),
      status: 'Scheduled'
    };

    const validation = validateInterview(interviewData);
    if (!validation.valid) {
      showToast(validation.message, 'error');
      return;
    }

    const existingIndex = interviews.findIndex((iv) => iv.id === interviewData.id);
    if (existingIndex >= 0) {
      interviews[existingIndex] = interviewData;
      showToast('Interview updated successfully.', 'success');
    } else {
      interviews.push(interviewData);
      showToast('Interview added successfully.', 'success');
    }

    updateConflictStatus();
    saveToStorage();
    resetForm();
    applyCurrentFiltersAndRender();
  }

  function removeInterviewById(id) {
    const index = interviews.findIndex((iv) => iv.id === id);
    if (index === -1) return;
    interviews.splice(index, 1);
    if (editingId === id) resetForm();
    updateConflictStatus();
    saveToStorage();
    showToast('Interview deleted.', 'info');
    applyCurrentFiltersAndRender();
  }

  function duplicateInterviewById(id) {
    const original = interviews.find((iv) => iv.id === id);
    if (!original) return;
    const clone = {
      ...original,
      id: generateId(),
      updatedAt: new Date().toISOString(),
      status: 'Scheduled'
    };
    interviews.push(clone);
    updateConflictStatus();
    saveToStorage();
    showToast('Interview duplicated.', 'success');
    applyCurrentFiltersAndRender();
  }

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter((row) => row.trim());
    if (lines.length === 0) return [];

    const rawHeaders = lines[0].split(',').map((h) => h.trim());
    const headers = rawHeaders.map(normalizeHeader);
    const parsed = [];

    for (let i = 1; i < lines.length; i += 1) {
      const values = lines[i].split(',').map((value) => value.trim());
      if (values.every((value) => value === '')) continue;
      const row = {
        candidate: '',
        role: '',
        round: '',
        date: '',
        startTime: '',
        endTime: '',
        interviewer: '',
        meetingLink: '',
        notes: '',
        status: 'Scheduled'
      };
      headers.forEach((key, idx) => {
        if (idx < values.length && key in row) {
          row[key] = values[idx];
        }
      });
      if (!row.candidate && !row.role) continue;
      row.id = generateId();
      row.updatedAt = new Date().toISOString();
      parsed.push(row);
    }

    return parsed;
  }

  function mergeInterviews(newInterviews) {
    const deduped = [];
    let duplicateCount = 0;

    newInterviews.forEach((iv) => {
      const existing = interviews.some((existingInterview) =>
        existingInterview.candidate === iv.candidate &&
        existingInterview.role === iv.role &&
        existingInterview.date === iv.date &&
        existingInterview.startTime === iv.startTime &&
        existingInterview.interviewer === iv.interviewer
      );
      if (existing) {
        duplicateCount += 1;
      } else {
        deduped.push(iv);
      }
    });

    interviews.push(...deduped);
    updateConflictStatus();
    saveToStorage();
    applyCurrentFiltersAndRender();

    if (deduped.length > 0) {
      showToast(`${deduped.length} interview(s) imported successfully.`, 'success');
    }
    if (duplicateCount > 0) {
      showToast(`${duplicateCount} duplicate row(s) were skipped.`, 'info');
    }
  }

  function exportToCSV() {
    if (interviews.length === 0) {
      showToast('No interviews to export.', 'info');
      return;
    }

    const headers = ['Candidate', 'Role', 'Round', 'Date', 'Start Time', 'End Time', 'Interviewer', 'Meeting Link', 'Notes', 'Status', 'Updated At'];
    const rows = interviews.map((iv) => [
      iv.candidate,
      iv.role,
      iv.round,
      iv.date,
      iv.startTime,
      iv.endTime,
      iv.interviewer,
      iv.meetingLink,
      iv.notes,
      iv.status,
      iv.updatedAt
    ]);

    let csvContent = `${headers.join(',')}\n`;
    rows.forEach((row) => {
      csvContent += row.map((cell) => `"${(cell ?? '').replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `interview_schedule_${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast('CSV export started.', 'success');
  }

  function showToast(message, type = 'success') {
    const container = getInput('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    window.setTimeout(() => {
      toast.classList.add('visible');
    }, 20);
    window.setTimeout(() => {
      toast.classList.remove('visible');
      window.setTimeout(() => container.removeChild(toast), 250);
    }, 3800);
  }

  function setSort(key) {
    if (sortState.key === key) {
      sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
      sortState.key = key;
      sortState.direction = 'asc';
    }
    applyCurrentFiltersAndRender();
  }

  function getSortIndicator(key) {
    if (sortState.key !== key) return '';
    return sortState.direction === 'asc' ? '▲' : '▼';
  }

  function bindEvents() {
    getInput('parseCsvBtn').addEventListener('click', () => {
      const text = getInput('csvTextarea').value;
      if (!text.trim()) {
        showToast('Paste CSV text before importing.', 'info');
        return;
      }
      const parsed = parseCSV(text);
      if (parsed.length > 0) {
        mergeInterviews(parsed);
        getInput('csvTextarea').value = '';
      } else {
        showToast('No valid interview rows found in CSV.', 'error');
      }
    });

    getInput('clearImportBtn').addEventListener('click', () => {
      getInput('csvTextarea').value = '';
    });

    getInput('addInterviewBtn').addEventListener('click', addOrSaveInterview);
    getInput('cancelEditBtn').addEventListener('click', resetForm);
    getInput('exportCsvBtn').addEventListener('click', exportToCSV);

    getInput('searchInput').addEventListener('input', (event) => {
      searchTerm = event.target.value;
      applyCurrentFiltersAndRender();
    });

    getInput('candidateFilter').addEventListener('change', (event) => {
      candidateFilter = event.target.value;
      applyCurrentFiltersAndRender();
    });

    getInput('interviewerFilter').addEventListener('change', (event) => {
      interviewerFilter = event.target.value;
      applyCurrentFiltersAndRender();
    });

    getInput('toggleConflictFilter').addEventListener('click', function () {
      conflictFilterActive = !conflictFilterActive;
      this.textContent = conflictFilterActive ? '✅ Show All Interviews' : '⚠ Show Conflicts Only';
      this.classList.toggle('danger', conflictFilterActive);
      applyCurrentFiltersAndRender();
    });

    getInput('clearFiltersBtn').addEventListener('click', () => {
      searchTerm = '';
      candidateFilter = '';
      interviewerFilter = '';
      conflictFilterActive = false;
      getInput('searchInput').value = '';
      getInput('candidateFilter').value = '';
      getInput('interviewerFilter').value = '';
      const toggle = getInput('toggleConflictFilter');
      toggle.textContent = '⚠ Show Conflicts Only';
      toggle.classList.add('danger');
      applyCurrentFiltersAndRender();
    });

    document.querySelectorAll('th.sortable').forEach((header) => {
      header.addEventListener('click', () => setSort(header.dataset.sortKey));
    });
  }

  loadFromStorage();
  window.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    applyCurrentFiltersAndRender();
  });
})();
