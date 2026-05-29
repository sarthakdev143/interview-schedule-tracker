
  (function() {
    // ----- MODULAR STATE & STORAGE -----
    const STORAGE_KEY = 'interview_schedule_data';
    let interviews = [];
    let editingId = null;
    let sortKey = 'date';
    let sortDirection = 'asc';

    // ----- UTILITIES -----
    function generateId() {
      return `iv-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }

    function getTimestamp() {
      return new Date().toISOString();
    }

    function showToast(message, type = 'success') {
      const toast = document.createElement('div');
      toast.className = `toast ${type === 'error' ? 'error' : 'success'} visible`;
      toast.textContent = message;
      document.getElementById('toastContainer').appendChild(toast);
      setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 200);
      }, 2400);
    }

    function isValidMeetingLink(link) {
      if (!link) return true;
      try {
        const url = new URL(link);
        return ['http:', 'https:'].includes(url.protocol);
      } catch {
        return false;
      }
    }

    // ----- NORMALIZATION MAP for CSV headers -----
    const HEADER_ALIASES = {
      'candidate': 'candidate', 'name': 'candidate', 'candidate name': 'candidate',
      'role': 'role', 'position': 'role', 'job role': 'role',
      'round': 'round', 'interview round': 'round',
      'date': 'date', 'interview date': 'date',
      'start time': 'startTime', 'start_time': 'startTime', 'start': 'startTime',
      'end time': 'endTime', 'end_time': 'endTime', 'end': 'endTime',
      'interviewer': 'interviewer', 'interviewer name': 'interviewer',
      'meeting link': 'meetingLink', 'link': 'meetingLink', 'url': 'meetingLink',
      'status': 'status'
    };

    function normalizeHeader(raw) {
      return HEADER_ALIASES[raw.trim().toLowerCase()] || raw.trim().toLowerCase();
    }

    // ----- UTILS: Date/Time parsing -----
    function parseDateTime(dateStr, timeStr) {
      if (!dateStr || !timeStr) return null;
      try {
        const normalizedDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        const combined = `${normalizedDate}T${timeStr}`;
        const date = new Date(combined);
        return isNaN(date.getTime()) ? null : date;
      } catch {
        return null;
      }
    }

    // ----- OVERLAP DETECTION (same date + time intersection) -----
    function detectOverlaps(interviewList) {
      const conflictMap = new Map();
      const n = interviewList.length;
      for (let i = 0; i < n; i++) {
        const a = interviewList[i];
        const startA = parseDateTime(a.date, a.startTime);
        const endA = parseDateTime(a.date, a.endTime);
        if (!startA || !endA) continue;
        for (let j = i + 1; j < n; j++) {
          const b = interviewList[j];
          if (a.date !== b.date) continue;
          const startB = parseDateTime(b.date, b.startTime);
          const endB = parseDateTime(b.date, b.endTime);
          if (!startB || !endB) continue;
          if (startA < endB && startB < endA) {
            const aDetails = conflictMap.get(a.id) || new Set();
            const bDetails = conflictMap.get(b.id) || new Set();
            aDetails.add(`${b.candidate || 'Unknown'} ${b.startTime}-${b.endTime}`);
            bDetails.add(`${a.candidate || 'Unknown'} ${a.startTime}-${a.endTime}`);
            conflictMap.set(a.id, aDetails);
            conflictMap.set(b.id, bDetails);
          }
        }
      }
      return conflictMap;
    }

    function updateConflictStatus() {
      const conflictMap = detectOverlaps(interviews);
      interviews.forEach(iv => {
        const details = conflictMap.get(iv.id);
        iv.status = details ? 'Conflict' : 'Scheduled';
        iv.conflictWith = details ? Array.from(details) : [];
      });
    }

    // ----- LOCAL STORAGE -----
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
      } else {
        // seed with sample data for professional look
        interviews = [
          { candidate: 'Aarav Mehta', role: 'Frontend Engineer', round: 'Technical', date: '2026-06-02', startTime: '10:00', endTime: '10:45', interviewer: 'Lisa Chen', meetingLink: 'https://meet.google.com/abc', status: 'Scheduled' },
          { candidate: 'Priya Sharma', role: 'Product Manager', round: 'Culture', date: '2026-06-02', startTime: '10:30', endTime: '11:00', interviewer: 'Mark Rivera', meetingLink: 'https://zoom.us/j/123', status: 'Conflict' }
        ];
      }
      interviews = interviews.map(iv => ({
        id: iv.id || generateId(),
        updatedAt: iv.updatedAt || getTimestamp(),
        conflictWith: iv.conflictWith || [],
        ...iv
      }));
      updateConflictStatus();
    }

    // ----- RENDER TABLE -----
    const tableBody = document.querySelector('#interviewTable tbody');
    const statsContainer = document.getElementById('statsContainer');

    function renderStats() {
      const total = interviews.length;
      const conflicts = interviews.filter(i => i.status === 'Conflict').length;
      const today = new Date().toISOString().split('T')[0];
      const upcomingToday = interviews.filter(i => i.date === today).length;
      const uniqueCandidates = new Set(interviews.map(i => i.candidate?.trim().toLowerCase())).size;
      
      statsContainer.innerHTML = `
        <div class="stat-card"><span class="stat-label">Total Interviews</span><span class="stat-value">${total}</span></div>
        <div class="stat-card conflict-stat"><span class="stat-label">⚠ Conflicts</span><span class="stat-value">${conflicts}</span></div>
        <div class="stat-card"><span class="stat-label">Upcoming Today</span><span class="stat-value">${upcomingToday}</span></div>
        <div class="stat-card"><span class="stat-label">Unique Candidates</span><span class="stat-value">${uniqueCandidates}</span></div>
      `;
    }

    function renderTable(filteredInterviews = null) {
      const dataToRender = filteredInterviews ?? interviews;
      tableBody.innerHTML = '';
      
      if (dataToRender.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding:2rem; color:#64748b;">No interviews found.</td></tr>`;
        return;
      }

      dataToRender.forEach(iv => {
        const originalIndex = interviews.findIndex(item => item.id === iv.id);
        const isConflict = iv.status === 'Conflict';
        const isEditingRow = editingId === iv.id;
        const row = document.createElement('tr');
        if (isConflict) row.classList.add('conflict-row');
        if (isEditingRow) row.classList.add('selected-row');

        const conflictTooltip = isConflict ? `Conflicts with ${iv.conflictWith.join(', ')}` : '';
        row.innerHTML = `
          <td>${escapeHtml(iv.candidate || '—')}</td>
          <td>${escapeHtml(iv.role || '—')}</td>
          <td>${escapeHtml(iv.round || '—')}</td>
          <td>${escapeHtml(iv.date || '—')}</td>
          <td>${escapeHtml(iv.startTime || '—')}</td>
          <td>${escapeHtml(iv.endTime || '—')}</td>
          <td>${escapeHtml(iv.interviewer || '—')}</td>
          <td>${iv.meetingLink ? `<a href="${escapeHtml(iv.meetingLink)}" target="_blank" rel="noopener" class="meeting-link">Join</a>` : '—'}</td>
          <td><span class="badge ${isConflict ? 'conflict' : 'scheduled'}" title="${escapeHtml(conflictTooltip)}">${escapeHtml(iv.status)}</span></td>
          <td>${iv.updatedAt ? escapeHtml(new Date(iv.updatedAt).toLocaleString()) : '—'}</td>
          <td>
            <button class="duplicate-btn" data-id="${iv.id}" aria-label="Duplicate interview for ${escapeHtml(iv.candidate || 'candidate')}" style="padding:0.3rem 0.6rem;">⧉</button>
            <button class="edit-btn" data-id="${iv.id}" aria-label="Edit interview for ${escapeHtml(iv.candidate || 'candidate')}" style="padding:0.3rem 0.6rem; margin-left:0.35rem;">✏️</button>
            <button class="delete-btn" data-id="${iv.id}" aria-label="Delete interview for ${escapeHtml(iv.candidate || 'candidate')}" style="padding:0.3rem 0.6rem; margin-left:0.35rem;">🗑</button>
          </td>
        `;
        tableBody.appendChild(row);
      });

      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const interviewId = e.currentTarget.getAttribute('data-id');
          const idx = interviews.findIndex(item => item.id === interviewId);
          if (idx !== -1) {
            interviews.splice(idx, 1);
            updateConflictStatus();
            saveToStorage();
            if (editingId === interviewId) {
              resetForm();
            }
            showToast('Interview removed', 'success');
            applyCurrentFiltersAndRender();
          }
        });
      });

      document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const interviewId = e.currentTarget.getAttribute('data-id');
          const interview = interviews.find(item => item.id === interviewId);
          if (interview) {
            editingId = interviewId;
            populateForm(interview);
            setEditingMode(true);
            document.getElementById('candidateInput').focus();
            updateFormStateIndicator();
            refreshUI();
          }
        });
      });

      document.querySelectorAll('.duplicate-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const interviewId = e.currentTarget.getAttribute('data-id');
          const original = interviews.find(item => item.id === interviewId);
          if (original) {
            const clone = {
              ...original,
              id: generateId(),
              updatedAt: getTimestamp(),
              status: 'Scheduled'
            };
            interviews.push(clone);
            updateConflictStatus();
            saveToStorage();
            showToast('Interview duplicated', 'success');
            applyCurrentFiltersAndRender();
          }
        });
      });
    }

    function escapeHtml(text) {
      return String(text ?? '').replace(/[&<>"]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '"') return '&quot;';
        return m;
      });
    }

    // ----- FILTER & SEARCH LOGIC -----
    let conflictFilterActive = false;
    let searchTerm = '';

    function setEditingMode(isEditing) {
      const addBtn = document.getElementById('addInterviewBtn');
      const cancelBtn = document.getElementById('cancelEditBtn');
      if (isEditing) {
        addBtn.textContent = 'Save Changes';
        addBtn.classList.add('primary');
        cancelBtn.style.display = 'inline-flex';
      } else {
        addBtn.textContent = 'Add';
        cancelBtn.style.display = 'none';
      }
    }

    function updateFormStateIndicator() {
      const indicator = document.getElementById('formStateIndicator');
      if (editingId) {
        indicator.textContent = 'Editing existing interview. Save changes or cancel to reset.';
      } else {
        indicator.textContent = '';
      }
    }

    function populateForm(interview) {
      document.getElementById('candidateInput').value = interview.candidate || '';
      document.getElementById('roleInput').value = interview.role || '';
      document.getElementById('roundInput').value = interview.round || '';
      document.getElementById('dateInput').value = interview.date || '';
      document.getElementById('startTimeInput').value = interview.startTime || '';
      document.getElementById('endTimeInput').value = interview.endTime || '';
      document.getElementById('interviewerInput').value = interview.interviewer || '';
      document.getElementById('meetingLinkInput').value = interview.meetingLink || '';
    }

    function resetForm() {
      ['candidateInput','roleInput','roundInput','dateInput','startTimeInput','endTimeInput','interviewerInput','meetingLinkInput'].forEach(id => {
        document.getElementById(id).value = '';
      });
      editingId = null;
      setEditingMode(false);
      updateFormStateIndicator();
    }

    function applyCurrentFiltersAndRender() {
      let filtered = [...interviews];
      
      if (conflictFilterActive) {
        filtered = filtered.filter(iv => iv.status === 'Conflict');
      }
      
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        filtered = filtered.filter(iv => 
          (iv.candidate?.toLowerCase().includes(term)) ||
          (iv.role?.toLowerCase().includes(term)) ||
          (iv.interviewer?.toLowerCase().includes(term))
        );
      }
      
      filtered.sort((a, b) => {
        const valueA = (a[sortKey] || '').toString().toLowerCase();
        const valueB = (b[sortKey] || '').toString().toLowerCase();
        if (sortKey === 'date') {
          return sortDirection === 'asc'
            ? valueA.localeCompare(valueB)
            : valueB.localeCompare(valueA);
        }
        if (sortKey === 'startTime') {
          return sortDirection === 'asc'
            ? valueA.localeCompare(valueB)
            : valueB.localeCompare(valueA);
        }
        if (valueA === valueB) {
          return (a.date || '9999').localeCompare(b.date || '9999') || (a.startTime || '').localeCompare(b.startTime || '');
        }
        return sortDirection === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
      });
      
      renderTable(filtered);
      renderStats();
    }

    function updateSortIndicators() {
      document.querySelectorAll('th.sortable').forEach(header => {
        header.classList.remove('sorted-asc', 'sorted-desc');
        const key = header.getAttribute('data-sort-key');
        if (key === sortKey) {
          header.classList.add(sortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
        }
      });
    }

    function refreshUI() {
      updateSortIndicators();
      applyCurrentFiltersAndRender();
    }

    // ----- CSV PARSING & MERGE -----
    function parseCSV(text) {
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length === 0) return [];
      const rawHeaders = lines[0].split(',').map(h => h.trim());
      const headers = rawHeaders.map(normalizeHeader);
      
      const parsed = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length === 0 || values.every(v => v === '')) continue;
        const obj = {
          id: generateId(),
          updatedAt: getTimestamp(),
          candidate: '', role: '', round: '', date: '', startTime: '', endTime: '', interviewer: '', meetingLink: '', status: 'Scheduled', conflictWith: []
        };
        headers.forEach((key, idx) => {
          if (idx < values.length && key in obj) {
            obj[key] = values[idx];
          }
        });
        if (!obj.candidate && !obj.role) continue; // skip empty rows
        parsed.push(obj);
      }
      return parsed;
    }

    function mergeInterviews(newInterviews) {
      newInterviews.forEach(iv => {
        iv.status = 'Scheduled';
        iv.updatedAt = iv.updatedAt || getTimestamp();
        iv.id = iv.id || generateId();
        iv.conflictWith = iv.conflictWith || [];
        interviews.push(iv);
      });
      updateConflictStatus();
      saveToStorage();
      showToast('CSV imported successfully', 'success');
      refreshUI();
    }

    // ----- QUICK ADD -----
    function addInterviewFromForm() {
      const candidate = document.getElementById('candidateInput').value.trim();
      const role = document.getElementById('roleInput').value.trim();
      const date = document.getElementById('dateInput').value;
      const startTime = document.getElementById('startTimeInput').value;
      const endTime = document.getElementById('endTimeInput').value;
      const meetingLink = document.getElementById('meetingLinkInput').value.trim();

      if (!candidate || !role) {
        showToast('Candidate and Role are required.', 'error');
        return;
      }
      if (startTime && endTime && startTime >= endTime) {
        showToast('End Time must be after Start Time.', 'error');
        return;
      }
      if (meetingLink && !isValidMeetingLink(meetingLink)) {
        showToast('Please enter a valid meeting link.', 'error');
        return;
      }

      const interviewData = {
        id: editingId || generateId(),
        updatedAt: getTimestamp(),
        candidate,
        role,
        round: document.getElementById('roundInput').value.trim(),
        date,
        startTime,
        endTime,
        interviewer: document.getElementById('interviewerInput').value.trim(),
        meetingLink,
        status: 'Scheduled',
        conflictWith: []
      };

      if (editingId) {
        const idx = interviews.findIndex(item => item.id === editingId);
        if (idx !== -1) {
          interviews[idx] = interviewData;
          showToast('Interview updated', 'success');
        }
      } else {
        interviews.push(interviewData);
        showToast('Interview added', 'success');
      }
      updateConflictStatus();
      saveToStorage();
      resetForm();
      refreshUI();
    }

    // ----- EXPORT CSV -----
    function exportToCSV() {
      if (interviews.length === 0) {
        showToast('No data to export.', 'error');
        return;
      }
      const headers = ['Candidate','Role','Round','Date','Start Time','End Time','Interviewer','Meeting Link','Status','Updated'];
      const rows = interviews.map(iv => [
        iv.candidate, iv.role, iv.round, iv.date, iv.startTime, iv.endTime, iv.interviewer, iv.meetingLink, iv.status, iv.updatedAt || ''
      ]);
      let csvContent = headers.join(',') + '\n';
      rows.forEach(row => {
        csvContent += row.map(cell => `"${(cell??'').replace(/"/g, '""')}"`).join(',') + '\n';
      });
      const blob = new Blob([csvContent], {type: 'text/csv'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `interview_schedule_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }

    // ----- EVENT LISTENERS -----
    function bindEvents() {
      document.getElementById('parseCsvBtn').addEventListener('click', () => {
        const text = document.getElementById('csvTextarea').value;
        if (!text.trim()) {
          showToast('Paste CSV content to import.', 'error');
          return;
        }
        const parsed = parseCSV(text);
        if (parsed.length) {
          mergeInterviews(parsed);
          document.getElementById('csvTextarea').value = '';
        } else {
          showToast('No valid interview rows found.', 'error');
        }
      });

      document.getElementById('clearImportBtn').addEventListener('click', () => {
        document.getElementById('csvTextarea').value = '';
      });

      document.getElementById('addInterviewBtn').addEventListener('click', addInterviewFromForm);
      document.getElementById('cancelEditBtn').addEventListener('click', () => {
        resetForm();
        refreshUI();
      });

      document.getElementById('exportCsvBtn').addEventListener('click', exportToCSV);

      document.querySelectorAll('th.sortable').forEach(header => {
        header.addEventListener('click', () => {
          const key = header.getAttribute('data-sort-key');
          if (key === sortKey) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
          } else {
            sortKey = key;
            sortDirection = 'asc';
          }
          refreshUI();
        });
      });

      document.getElementById('searchInput').addEventListener('input', (e) => {
        searchTerm = e.target.value;
        refreshUI();
      });

      const toggleBtn = document.getElementById('toggleConflictFilter');
      toggleBtn.addEventListener('click', function() {
        conflictFilterActive = !conflictFilterActive;
        this.textContent = conflictFilterActive ? '✅ Show All Interviews' : '⚠ Show Conflicts Only';
        this.classList.toggle('danger', conflictFilterActive);
        refreshUI();
      });

      document.getElementById('clearFiltersBtn').addEventListener('click', () => {
        searchTerm = '';
        document.getElementById('searchInput').value = '';
        conflictFilterActive = false;
        const toggle = document.getElementById('toggleConflictFilter');
        toggle.textContent = '⚠ Show Conflicts Only';
        toggle.classList.add('danger');
        refreshUI();
      });
    }

    // ----- INITIAL BOOT -----
    loadFromStorage();
    window.addEventListener('DOMContentLoaded', () => {
      bindEvents();
      refreshUI();
    });
  })();
