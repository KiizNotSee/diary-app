document.addEventListener('DOMContentLoaded', () => {
    // ======== DOM Elements ========
    const onboardingBanner = document.getElementById('onboarding-banner');
    const header = document.querySelector('.header');
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const entryTitle = document.getElementById('entry-title');
    const wordCountEl = document.getElementById('word-count');
    const charCountEl = document.getElementById('char-count');
    const moodBtns = document.querySelectorAll('.mood-btn');
    const tagBtns = document.querySelectorAll('.tag-btn');
    const entriesList = document.getElementById('entries-list');
    const trashList = document.getElementById('trash-list');
    const searchInput = document.getElementById('search-input');
    const settingsModal = document.getElementById('settings-modal');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    const toastAction = document.getElementById('toast-action');
    const themeIcon = document.getElementById('theme-icon');
    const streakBadge = document.getElementById('streak-badge');
    const streakCount = document.getElementById('streak-count');
    const moodChartCanvas = document.getElementById('mood-chart');
    const popularTagsEl = document.getElementById('popular-tags');
    const importFileInput = document.getElementById('import-file-input');
    const importantDatesList = document.getElementById('important-dates-list');

    let editor;
    let currentEntryId = null;
    let undoTimeout;

    // ======== State Management (localStorage) ========
    const getFromStorage = (key, defaultValue = []) => {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    };
    const saveToStorage = (key, value) => {
        localStorage.setItem(key, JSON.stringify(value));
    };

    let state = {
        entries: getFromStorage('diaryEntries'),
        trash: getFromStorage('diaryTrash'),
        importantDates: getFromStorage('diaryImportantDates'),
        settings: getFromStorage('diarySettings', {
            darkMode: false,
            notifications: {
                water: { enabled: false, time: '09:00' },
                exercise: { enabled: false, time: '17:00' },
                diary: { enabled: false, time: '21:00' },
                rest: { enabled: false, time: '23:00' },
            },
        }),
        lastVisit: getFromStorage('diaryLastVisit', null),
    };

    // ======== CKEditor 5 Initialization ========
    ClassicEditor
        .create(document.querySelector('#editor-container'), {
            toolbar: [
                'heading', '|', 'bold', 'italic', 'underline', 'strikethrough', '|',
                'bulletedList', 'numberedList', '|', 'blockQuote', 'link', 'horizontalLine', '|',
                'undo', 'redo', '|', 'removeFormat'
            ],
            language: 'vi'
        })
        .then(newEditor => {
            editor = newEditor;
            editor.model.document.on('change:data', () => {
                updateWordCount();
                saveDraft();
            });
            loadDraft();
        })
        .catch(error => {
            console.error('CKEditor initialization error:', error);
            showToast('Lỗi tải trình soạn thảo!', 'error');
        });

    // ======== Event Listeners ========
    tabs.forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));
    moodBtns.forEach(btn => btn.addEventListener('click', () => selectMood(btn.dataset.mood)));
    tagBtns.forEach(btn => btn.addEventListener('click', () => btn.classList.toggle('active')));
    searchInput.addEventListener('input', () => renderEntries(state.entries, entriesList, { filter: searchInput.value }));
    importFileInput.addEventListener('change', handleFileImport);
    
    // Global click listener for closing modals, etc.
    document.body.addEventListener('click', (e) => {
        if (e.target.closest('.entry-card') && !e.target.closest('.btn')) {
            const entryId = e.target.closest('.entry-card').dataset.id;
            editEntry(entryId);
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            saveEntry();
        }
        if (e.key === 'Escape') {
            if (document.body.classList.contains('focus-mode')) {
                toggleFocusMode();
            } else if (currentEntryId) {
                cancelEdit();
            }
        }
    });

    // ======== Functions ========

    // Onboarding
    const handleOnboarding = () => {
        if (!state.lastVisit) {
            onboardingBanner.classList.remove('hidden');
            state.lastVisit = new Date().toISOString();
            saveToStorage('diaryLastVisit', state.lastVisit);
        }
    };

    window.closeOnboarding = () => {
        onboardingBanner.classList.add('hidden');
    };

    // Tabs
    window.switchTab = (tabName) => {
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
        tabContents.forEach(c => c.classList.toggle('active', c.id === `${tabName}-tab`));
        if (tabName === 'entries') renderEntries(state.entries, entriesList);
        if (tabName === 'trash') renderEntries(state.trash, trashList, { isTrash: true });
        if (tabName === 'stats') renderStats();
    };

    // Editor & Word Count
    const updateWordCount = () => {
        const text = editor.getData().replace(/<[^>]+>/g, '');
        const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
        const charCount = text.length;
        wordCountEl.textContent = `${wordCount} từ`;
        charCountEl.textContent = `${charCount} ký tự`;
    };

    // Auto-save draft
    const saveDraft = () => {
        if (!currentEntryId) { // Only save draft for new entries
            const draft = {
                title: entryTitle.value,
                content: editor.getData(),
                mood: document.querySelector('.mood-btn.active')?.dataset.mood,
                tags: Array.from(document.querySelectorAll('.tag-btn.active')).map(t => t.dataset.tag),
            };
            saveToStorage('diaryDraft', draft);
        }
    };

    const loadDraft = () => {
        const draft = getFromStorage('diaryDraft', null);
        if (draft) {
            entryTitle.value = draft.title || '';
            editor.setData(draft.content || '');
            if (draft.mood) selectMood(draft.mood);
            if (draft.tags) {
                tagBtns.forEach(btn => btn.classList.toggle('active', draft.tags.includes(btn.dataset.tag)));
            }
        }
    };

    const clearDraft = () => {
        localStorage.removeItem('diaryDraft');
    };

    // Mood
    window.selectMood = (moodValue) => {
        moodBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.mood === moodValue));
    };

    // CRUD
    window.saveEntry = () => {
        const title = entryTitle.value.trim();
        const content = editor.getData();
        const mood = document.querySelector('.mood-btn.active')?.dataset.mood;
        const tags = Array.from(document.querySelectorAll('.tag-btn.active')).map(t => t.dataset.tag);
        const songUrl = document.getElementById('song-url')?.value?.trim() || '';
        const date = new Date().toISOString();

        // Handle image upload
        const imageInput = document.getElementById('image-upload');
        const saveWithImage = (imageUrl) => {
            if (!title && !content) {
                showToast('Vui lòng nhập tiêu đề hoặc nội dung.', 'error');
                return;
            }

            const entryData = { title, content, mood, tags, songUrl, imageUrl: imageUrl || '', modifiedAt: date };

            if (currentEntryId) {
                const index = state.entries.findIndex(e => e.id === currentEntryId);
                if (index > -1) {
                    state.entries[index] = { ...state.entries[index], ...entryData };
                    showToast('Cập nhật thành công!');
                }
            } else {
                const newEntry = { id: `entry-${Date.now()}`, ...entryData, createdAt: date };
                state.entries.unshift(newEntry);
                showToast('Lưu nhật ký thành công!');
            }
            
            saveToStorage('diaryEntries', state.entries);
            clearDraft();
            resetEditor();
            updateStreak();
            switchTab('entries');
        };

        if (imageInput && imageInput.files.length > 0) {
            const reader = new FileReader();
            reader.onload = (e) => saveWithImage(e.target.result);
            reader.readAsDataURL(imageInput.files[0]);
            return;
        }
        saveWithImage('');
    };
    
    window.editEntry = (id) => {
        const entry = state.entries.find(e => e.id === id);
        if (entry) {
            switchTab('editor');
            currentEntryId = id;
            entryTitle.value = entry.title;
            editor.setData(entry.content);
            selectMood(entry.mood);
            tagBtns.forEach(btn => btn.classList.toggle('active', entry.tags.includes(btn.dataset.tag)));
            document.getElementById('cancel-edit-btn').classList.remove('hidden');
        }
    };
    
    window.cancelEdit = () => {
        resetEditor();
    };

    const resetEditor = () => {
        currentEntryId = null;
        entryTitle.value = '';
        editor.setData('');
        moodBtns.forEach(btn => btn.classList.remove('active'));
        tagBtns.forEach(btn => btn.classList.remove('active'));
        document.getElementById('cancel-edit-btn').classList.add('hidden');
        clearDraft();
    };

    window.deleteEntry = (id) => {
        const index = state.entries.findIndex(e => e.id === id);
        if (index > -1) {
            const [deletedEntry] = state.entries.splice(index, 1);
            state.trash.unshift(deletedEntry);
            saveToStorage('diaryEntries', state.entries);
            saveToStorage('diaryTrash', state.trash);
            renderEntries(state.entries, entriesList);
            showToast('Đã chuyển vào thùng rác.', 'info', () => undoDelete(id));
        }
    };

    const undoDelete = (id) => {
        const index = state.trash.findIndex(e => e.id === id);
        if (index > -1) {
            const [restoredEntry] = state.trash.splice(index, 1);
            state.entries.unshift(restoredEntry); // Add back to top
            saveToStorage('diaryEntries', state.entries);
            saveToStorage('diaryTrash', state.trash);
            renderEntries(state.entries, entriesList);
            if (document.querySelector('.tab-btn.active').dataset.tab === 'trash') {
                renderEntries(state.trash, trashList, { isTrash: true });
            }
            showToast('Đã hoàn tác.');
        }
    };

    window.restoreEntry = (id) => {
        const index = state.trash.findIndex(e => e.id === id);
        if (index > -1) {
            const [restoredEntry] = state.trash.splice(index, 1);
            state.entries.unshift(restoredEntry);
            saveToStorage('diaryEntries', state.entries);
            saveToStorage('diaryTrash', state.trash);
            renderEntries(state.trash, trashList, { isTrash: true });
            showToast('Đã khôi phục.');
        }
    };

    window.deletePermanently = (id) => {
        if (confirm('Bạn có chắc muốn xóa vĩnh viễn? Hành động này không thể hoàn tác.')) {
            state.trash = state.trash.filter(e => e.id !== id);
            saveToStorage('diaryTrash', state.trash);
            renderEntries(state.trash, trashList, { isTrash: true });
            showToast('Đã xóa vĩnh viễn.');
        }
    };

    window.emptyTrash = () => {
        if (state.trash.length > 0 && confirm(`Bạn có chắc muốn xóa vĩnh viễn ${state.trash.length} mục?`)) {
            state.trash = [];
            saveToStorage('diaryTrash', state.trash);
            renderEntries([], trashList, { isTrash: true });
            showToast('Thùng rác đã được dọn sạch.');
        }
    };

    // Rendering
    const renderEntries = (entries, container, options = {}) => {
        const { isTrash = false, filter = '' } = options;
        container.innerHTML = '';
        
        const filteredEntries = filter ? entries.filter(e => 
            e.title.toLowerCase().includes(filter.toLowerCase()) ||
            e.content.toLowerCase().includes(filter.toLowerCase()) ||
            e.tags.some(t => t.toLowerCase().includes(filter.toLowerCase()))
        ) : entries;

        if (filteredEntries.length === 0) {
            container.innerHTML = `<p class="empty-list-message">${isTrash ? 'Thùng rác trống.' : 'Chưa có nhật ký nào.'}</p>`;
            return;
        }

        filteredEntries.forEach(entry => {
            const moodEmoji = {
                '5': '😄', '4': '🙂', '3': '😐', '2': '😟', '1': '😢'
            }[entry.mood] || '—';
            const date = new Date(entry.modifiedAt);
            const formattedDate = `${date.toLocaleDateString('vi-VN')} ${date.toLocaleTimeString('vi-VN')}`;

            const entryCard = document.createElement('div');
            entryCard.className = 'entry-card card';
            entryCard.dataset.id = entry.id;

            entryCard.innerHTML = `
                <div class="screw screw-tl"></div><div class="screw screw-tr"></div>
                <div class="screw screw-bl"></div><div class="screw screw-br"></div>
                ${entry.imageUrl ? `<div class="entry-image"><img src="${entry.imageUrl}" alt="ảnh nhật ký"></div>` : ''}
                <div class="entry-meta">
                    <span class="entry-date">${formattedDate}</span>
                    <span class="entry-mood">${moodEmoji}</span>
                </div>
                <h3 class="entry-title-display">${entry.title || 'Không có tiêu đề'}</h3>
                <p class="entry-preview">${entry.content.replace(/<[^>]+>/g, '').substring(0, 150)}...</p>
                ${entry.songUrl ? `<div class="entry-song">🎵 <a href="${entry.songUrl}" target="_blank">Bài hát hôm nay</a></div>` : ''}
                <div class="entry-tags">
                    ${entry.tags.map(tag => `<span class="entry-tag">${tag}</span>`).join('')}
                </div>
                <div class="entry-actions">
                    ${isTrash ? `
                        <button onclick="restoreEntry('${entry.id}')" class="btn btn-secondary">♻️ Khôi phục</button>
                        <button onclick="deletePermanently('${entry.id}')" class="btn btn-danger">❌ Xóa vĩnh viễn</button>
                    ` : `
                        <button onclick="editEntry('${entry.id}')" class="btn btn-secondary">✏️ Sửa</button>
                        <button onclick="deleteEntry('${entry.id}')" class="btn btn-danger">🗑️ Xóa</button>
                    `}
                </div>
            `;
            container.appendChild(entryCard);
        });
    };

    // Stats
    const renderStats = () => {
        // Mood Chart
        const monthlyEntries = state.entries.filter(e => {
            const entryDate = new Date(e.createdAt);
            const now = new Date();
            return entryDate.getMonth() === now.getMonth() && entryDate.getFullYear() === now.getFullYear();
        });

        const moodData = Array(new Date().getDate()).fill(null);
        monthlyEntries.forEach(entry => {
            const day = new Date(entry.createdAt).getDate() - 1;
            if (entry.mood) {
                if (!moodData[day]) moodData[day] = [];
                moodData[day].push(parseInt(entry.mood, 10));
            }
        });
        
        const averageMoods = moodData.map(dayData => {
            if (!dayData) return null;
            return dayData.reduce((sum, val) => sum + val, 0) / dayData.length;
        });

        if (window.moodLineChart) window.moodLineChart.destroy();
        window.moodLineChart = new Chart(moodChartCanvas, {
            type: 'line',
            data: {
                labels: Array.from({ length: new Date().getDate() }, (_, i) => i + 1),
                datasets: [{
                    label: 'Tâm trạng trung bình',
                    data: averageMoods,
                    borderColor: 'var(--accent)',
                    backgroundColor: 'rgba(108, 92, 231, 0.1)',
                    tension: 0.3,
                    spanGaps: true,
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 5,
                        min: 1,
                        ticks: {
                            callback: (value) => ['😢', '😟', '😐', '🙂', '😄'][value - 1] || ''
                        }
                    }
                }
            }
        });

        // Popular Tags
        const allTags = state.entries.flatMap(e => e.tags);
        const tagCounts = allTags.reduce((acc, tag) => {
            acc[tag] = (acc[tag] || 0) + 1;
            return acc;
        }, {});

        const sortedTags = Object.entries(tagCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10);

        popularTagsEl.innerHTML = sortedTags.length > 0 ? sortedTags.map(([tag, count]) => `
            <div class="popular-tag">
                ${tag} <span class="tag-count">${count}</span>
            </div>
        `).join('') : '<p>Chưa có tag nào phổ biến.</p>';
    };

    // Streak
    const updateStreak = () => {
        const today = new Date().setHours(0, 0, 0, 0);
        const entryDates = state.entries
            .map(e => new Date(e.createdAt).setHours(0, 0, 0, 0))
            .filter((v, i, a) => a.indexOf(v) === i) // Unique dates
            .sort((a, b) => b - a);

        let currentStreak = 0;
        if (entryDates.length > 0 && entryDates[0] === today) {
            currentStreak = 1;
            for (let i = 1; i < entryDates.length; i++) {
                const prevDate = entryDates[i - 1];
                const currDate = entryDates[i];
                if (prevDate - currDate === 24 * 60 * 60 * 1000) {
                    currentStreak++;
                } else {
                    break;
                }
            }
        }
        
        if (currentStreak > 0) {
            streakCount.textContent = currentStreak;
            streakBadge.classList.remove('hidden');
        } else {
            streakBadge.classList.add('hidden');
        }
    };
    
    // Dark Mode
    window.toggleDarkMode = () => {
        state.settings.darkMode = !state.settings.darkMode;
        saveToStorage('diarySettings', state.settings);
        applyTheme();
    };

    const applyTheme = () => {
        if (state.settings.darkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
            themeIcon.textContent = '☀️';
        } else {
            document.documentElement.removeAttribute('data-theme');
            themeIcon.textContent = '🌙';
        }
    };

    // Important Dates
    window.addImportantDate = () => {
        const name = document.getElementById('event-name').value.trim();
        const date = document.getElementById('event-date').value;
        const icon = document.getElementById('event-icon').value;

        if (!name || !date) {
            showToast('Vui lòng nhập tên và ngày cho sự kiện.', 'error');
            return;
        }

        const newDate = {
            id: `date-${Date.now()}`,
            name,
            date,
            icon,
        };
        state.importantDates.push(newDate);
        saveToStorage('diaryImportantDates', state.importantDates);
        renderImportantDates();
        document.getElementById('event-name').value = '';
        document.getElementById('event-date').value = '';
    };

    window.deleteImportantDate = (id) => {
        state.importantDates = state.importantDates.filter(d => d.id !== id);
        saveToStorage('diaryImportantDates', state.importantDates);
        renderImportantDates();
    };
    
    const renderImportantDates = () => {
        importantDatesList.innerHTML = '';
        state.importantDates
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .forEach(item => {
                const targetDate = new Date(item.date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const diffTime = targetDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                let countdownText;
                if (diffDays < 0) {
                    countdownText = 'Đã qua';
                } else if (diffDays === 0) {
                    countdownText = 'Hôm nay!';
                } else {
                    countdownText = `Còn ${diffDays} ngày`;
                }

                const dateItem = document.createElement('div');
                dateItem.className = 'date-item';
                dateItem.innerHTML = `
                    <span class="date-icon">${item.icon}</span>
                    <span class="date-name">${item.name} (${targetDate.toLocaleDateString('vi-VN')})</span>
                    <span class="date-countdown">${countdownText}</span>
                    <button onclick="deleteImportantDate('${item.id}')" class="btn-icon">🗑️</button>
                `;
                importantDatesList.appendChild(dateItem);
            });
    };

    // Settings Modal
    window.showSettings = () => settingsModal.classList.remove('hidden');
    window.closeSettings = () => settingsModal.classList.add('hidden');

    // Data Management
    window.exportData = () => {
        const dataToExport = {
            entries: state.entries,
            trash: state.trash,
            importantDates: state.importantDates,
            settings: state.settings,
        };
        const dataStr = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `diary_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Đã xuất dữ liệu.');
    };

    window.importData = () => {
        if (confirm('Nhập dữ liệu sẽ ghi đè lên dữ liệu hiện tại. Bạn có chắc muốn tiếp tục?')) {
            importFileInput.click();
        }
    };

    function handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                // Validate and merge
                if (importedData.entries) state.entries = importedData.entries;
                if (importedData.trash) state.trash = importedData.trash;
                if (importedData.importantDates) state.importantDates = importedData.importantDates;
                if (importedData.settings) state.settings = { ...state.settings, ...importedData.settings };

                saveToStorage('diaryEntries', state.entries);
                saveToStorage('diaryTrash', state.trash);
                saveToStorage('diaryImportantDates', state.importantDates);
                saveToStorage('diarySettings', state.settings);
                
                showToast('Nhập dữ liệu thành công!');
                // Re-render everything
                initialize();
            } catch (err) {
                console.error('Import error:', err);
                showToast('Tệp không hợp lệ hoặc bị lỗi.', 'error');
            }
        };
        reader.readAsText(file);
    }
    
    window.clearAllData = () => {
        if (confirm('CẢNH BÁO: Hành động này sẽ xóa TẤT CẢ dữ liệu (bài viết, thùng rác, cài đặt) và không thể hoàn tác. Bạn có chắc chắn muốn tiếp tục?')) {
            localStorage.clear();
            state = {
                entries: [],
                trash: [],
                importantDates: [],
                settings: { darkMode: false, notifications: {} },
                lastVisit: state.lastVisit, // Keep onboarding status
            };
            showToast('Đã xóa tất cả dữ liệu.');
            initialize();
        }
    };

    // Focus Mode
    window.toggleFocusMode = () => {
        document.body.classList.toggle('focus-mode');
        const isFocus = document.body.classList.contains('focus-mode');
        document.getElementById('focus-icon').textContent = isFocus ? '🎯' : '🎯';
        // Resize CKEditor properly
        window.dispatchEvent(new Event('resize'));
    };
    
    // Toast Notifications
    const showToast = (message, type = 'success', onAction = null) => {
        clearTimeout(undoTimeout);
        toastMessage.textContent = message;
        toast.className = `toast ${type}`;
        
        if (onAction) {
            toastAction.classList.remove('hidden');
            toastAction.onclick = () => {
                onAction();
                toast.classList.add('hidden');
                clearTimeout(undoTimeout);
            };
        } else {
            toastAction.classList.add('hidden');
        }

        toast.classList.remove('hidden');
        undoTimeout = setTimeout(() => {
            toast.classList.add('hidden');
        }, 5000);
    };

    // Notifications
    window.requestNotificationPermission = () => {
        if (!('Notification' in window)) {
            showToast('Trình duyệt không hỗ trợ thông báo.', 'error');
            return;
        }
        
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                showToast('Đã cấp quyền thông báo.');
                scheduleNotifications();
            } else {
                showToast('Bạn đã từ chối quyền thông báo.', 'error');
            }
        });
    };
    
    window.updateNotificationSettings = () => {
        state.settings.notifications = {
            water: {
                enabled: document.getElementById('notify-water').checked,
                time: document.getElementById('notify-water-time').value
            },
            exercise: {
                enabled: document.getElementById('notify-exercise').checked,
                time: document.getElementById('notify-exercise-time').value
            },
            diary: {
                enabled: document.getElementById('notify-diary').checked,
                time: document.getElementById('notify-diary-time').value
            },
            rest: {
                enabled: document.getElementById('notify-rest').checked,
                time: document.getElementById('notify-rest-time').value
            }
        };
        saveToStorage('diarySettings', state.settings);
        scheduleNotifications();
    };
    
    const scheduleNotifications = () => {
        // Clear existing intervals
        if (window.notificationIntervals) {
            window.notificationIntervals.forEach(interval => clearInterval(interval));
        }
        window.notificationIntervals = [];
        
        // Check permissions
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            return;
        }
        
        // Schedule each notification
        const notifications = {
            water: { title: '💧 Nhắc nhở uống nước', body: 'Đã đến lúc uống nước rồi! Giữ sức khỏe nhé.' },
            exercise: { title: '🏃 Nhắc nhở vận động', body: 'Hãy dành chút thời gian để vận động cơ thể.' },
            diary: { title: '📖 Nhắc nhở viết nhật ký', body: 'Đến giờ ghi lại khoảnh khắc hôm nay rồi!' },
            rest: { title: '🌙 Nhắc nhở nghỉ ngơi', body: 'Đã muộn rồi, hãy nghỉ ngơi để cơ thể phục hồi.' }
        };
        
        Object.keys(notifications).forEach(key => {
            const setting = state.settings.notifications[key];
            if (setting && setting.enabled && setting.time) {
                const checkInterval = setInterval(() => {
                    const now = new Date();
                    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                    
                    if (currentTime === setting.time) {
                        new Notification(notifications[key].title, {
                            body: notifications[key].body,
                            icon: '/favicon.ico',
                            badge: '/favicon.ico'
                        });
                    }
                }, 60000); // Check every minute
                
                window.notificationIntervals.push(checkInterval);
            }
        });
    };
    
    const loadNotificationSettings = () => {
        if (state.settings.notifications) {
            document.getElementById('notify-water').checked = state.settings.notifications.water?.enabled || false;
            document.getElementById('notify-water-time').value = state.settings.notifications.water?.time || '09:00';
            
            document.getElementById('notify-exercise').checked = state.settings.notifications.exercise?.enabled || false;
            document.getElementById('notify-exercise-time').value = state.settings.notifications.exercise?.time || '17:00';
            
            document.getElementById('notify-diary').checked = state.settings.notifications.diary?.enabled || false;
            document.getElementById('notify-diary-time').value = state.settings.notifications.diary?.time || '21:00';
            
            document.getElementById('notify-rest').checked = state.settings.notifications.rest?.enabled || false;
            document.getElementById('notify-rest-time').value = state.settings.notifications.rest?.time || '23:00';
        }
    };
    
    // ======== New Features Logic ========
    const quotes = [
        "Mỗi ngày là một cơ hội mới để viết nên câu chuyện của riêng bạn.",
        "Hạnh phúc không phải là đích đến, mà là hành trình chúng ta đang đi.",
        "Hãy tin rằng bạn có thể và bạn đã đi được nửa chặng đường.",
        "Đừng để ngày hôm qua chiếm dụng quá nhiều ngày hôm nay.",
        "Sự kiên trì là chìa khóa của mọi thành công."
    ];

    const questions = [
        "🤔 Hôm nay bạn thế nào?",
        "🌟 Điều gì làm bạn mỉm cười hôm nay?",
        "💪 Bạn đã vượt qua thử thách nào hôm nay?",
        "🌱 Bạn đã học được điều gì mới chưa?",
        "💭 Bạn đang cảm thấy biết ơn điều gì nhất?"
    ];

    const updateMotivation = () => {
        document.getElementById('daily-quote').textContent = `"${quotes[Math.floor(Math.random() * quotes.length)]}"`;
        document.getElementById('daily-question').textContent = questions[Math.floor(Math.random() * questions.length)];
    };

    window.insertTemplate = () => {
        const template = document.getElementById('template-select').value;
        let content = '';
        if (template === 'daily') {
            content = `
                <h2>📅 Daily Reflection</h2>
                <p><strong>Ngày:</strong> ${new Date().toLocaleDateString()}</p>
                <h3>✨ Hôm nay có gì đáng nhớ?</h3><p></p>
                <h3>🎯 Điều mình đã làm tốt</h3><ul><li></li></ul>
                <h3>😕 Điều chưa hài lòng</h3><ul><li></li></ul>
                <h3>💡 Bài học hôm nay</h3><p></p>
                <h3>🙏 Điều mình biết ơn</h3><p></p>
                <h3>🌙 Mục tiêu cho ngày mai</h3><p></p>
            `;
        } else if (template === 'deep') {
            content = `
                <h2>🌱 Deep Journal</h2>
                <h3>💭 Mình đang nghĩ gì?</h3><p></p>
                <h3>❤️ Cảm xúc lớn nhất hôm nay?</h3><p></p>
                <h3>⚡ Điều gì khiến mình vui/buồn nhất?</h3><p></p>
                <h3>🧠 Nếu quay lại hôm nay, mình sẽ thay đổi gì?</h3><p></p>
                <h3>🚀 Phiên bản ngày mai của mình cần nhớ gì?</h3><p></p>
            `;
        }
        if (content) editor.setData(content);
    };

    // ======== Initialization ========
    const initialize = () => {
        handleOnboarding();
        applyTheme();
        updateStreak();
        renderImportantDates();
        loadNotificationSettings();
        scheduleNotifications();
        updateMotivation();
        switchTab('editor'); // Start on editor tab
    };

    initialize();
});
