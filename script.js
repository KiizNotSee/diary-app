document.addEventListener('DOMContentLoaded', () => {
    // ======== DOM Elements ========
    const onboardingBanner = document.getElementById('onboarding-banner');
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const entryTitle = document.getElementById('entry-title');
    const wordCountEl = document.getElementById('word-count');
    const charCountEl = document.getElementById('char-count');
    const moodBtns = document.querySelectorAll('.mood-btn');
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
    const tagGroupsContainer = document.getElementById('tag-groups');
    const tagSearchInput = document.getElementById('tag-search');

    let editor;
    let currentEntryId = null;
    let undoTimeout;
    let allTagsExpanded = false;
    let isEditorReady = false;

    // ======== Tag System ========
    const tagData = {
        '😊 Cảm xúc': {
            tags: ['Vui vẻ', 'Bình thường', 'Buồn', 'Lo lắng', 'Căng thẳng', 'Mệt mỏi', 'Tức giận', 'Hạnh phúc', 'Bình yên', 'Áp lực', 'Quá tải', 'Chán', 'Kiệt sức', 'Cảm động', 'Phấn khích'],
            icon: '😊'
        },
        '📚 Công việc & Học tập': {
            tags: ['Học', 'Đi làm', 'Coding', 'Làm dự án', 'Đọc sách', 'Ôn thi', 'Thuyết trình', 'Làm bài tập', 'Nghiên cứu'],
            icon: '📚'
        },
        '💪 Sức khỏe': {
            tags: ['Tập gym', 'Chạy bộ', 'Đi bộ', 'Yoga', 'Ăn healthy', 'Ăn vặt', 'Ngủ ngon', 'Thiếu ngủ', 'Uống đủ nước', 'Ốm'],
            icon: '💪'
        },
        '🏡 Cuộc sống': {
            tags: ['Dọn dẹp', 'Nấu ăn', 'Mua sắm', 'Giặt giũ', 'Ở nhà', 'Ra ngoài', 'Đi siêu thị', 'Làm việc nhà', 'Chăm thú cưng', 'Lái xe'],
            icon: '🏡'
        },
        '👥 Mối quan hệ': {
            tags: ['Gia đình', 'Bạn bè', 'Hẹn hò', 'Tiệc tùng', 'Gọi điện', 'Đồng nghiệp', 'Lớp học', 'CLB', 'Họp mặt', 'Nhắn tin'],
            icon: '👥'
        },
        '🎮 Giải trí': {
            tags: ['Game', 'Anime', 'Manga', 'Phim', 'Âm nhạc', 'Đọc truyện', 'Viết nhật ký', 'Vẽ', 'Nhiếp ảnh', 'Cafe', 'Du lịch'],
            icon: '🎮'
        },
        '💰 Tài chính': {
            tags: ['Chi tiêu', 'Tiết kiệm', 'Thu nhập', 'Đầu tư', 'Mua sắm', 'Ăn ngoài', 'Hóa đơn'],
            icon: '💰'
        },
        '🌤️ Thời tiết': {
            tags: ['Nắng', 'Mưa', 'Mây', 'Nóng', 'Gió', 'Lạnh', 'Âm u', 'Bão', 'Sương mù'],
            icon: '🌤️'
        },
        '✨ Sự kiện': {
            tags: ['Du lịch', 'Sinh nhật', 'Kỷ niệm', 'Ngày đầu tiên', 'Thành tựu', 'Thất bại', 'Ý tưởng mới', 'Quyết định lớn', 'Mốc quan trọng'],
            icon: '✨'
        },
        '🏷️ Phổ biến': {
            tags: ['Cafe', 'Thức khuya', 'Coding', 'Focus', 'Check-in', 'Di chuyển', 'Ăn ngon', 'Quà tặng', 'Ý tưởng', 'Deadline', 'Achievement', 'Crush', 'Pet'],
            icon: '🏷️'
        }
    };

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
        favoriteTags: getFromStorage('diaryFavoriteTags', {}),
    };

    // ======== Tag Rendering ========
    const renderTags = (filter = '') => {
        tagGroupsContainer.innerHTML = '';
        const MAX_VISIBLE = 5;
        
        Object.entries(tagData).forEach(([groupName, groupData]) => {
            const groupEl = document.createElement('div');
            groupEl.className = 'tag-group';
            
            const filteredTags = filter 
                ? groupData.tags.filter(tag => tag.toLowerCase().includes(filter.toLowerCase()))
                : groupData.tags;

            if (filteredTags.length === 0 && filter) return;

            const visibleTags = allTagsExpanded ? filteredTags : filteredTags.slice(0, MAX_VISIBLE);
            const hasMore = filteredTags.length > MAX_VISIBLE && !allTagsExpanded;

            groupEl.innerHTML = `
                <h4>${groupName}</h4>
                <div class="tags">
                    ${visibleTags.map(tag => `<button class="tag-btn" data-tag="${tag.toLowerCase().replace(/\s+/g, '-')}">${tag}</button>`).join('')}
                    ${hasMore ? `<button class="tag-btn tag-btn-more" onclick="toggleAllTags()" style="font-size:0.8rem; opacity:0.7;">+${filteredTags.length - MAX_VISIBLE}...</button>` : ''}
                </div>
            `;
            tagGroupsContainer.appendChild(groupEl);
        });

        // Re-attach event listeners
        document.querySelectorAll('.tag-btn[data-tag]').forEach(btn => {
            btn.addEventListener('click', () => btn.classList.toggle('active'));
        });

        // Load active tags from draft or editing entry
        loadActiveTags();
    };

    const loadActiveTags = () => {
        // Check if we're editing an entry
        if (currentEntryId) {
            const entry = state.entries.find(e => e.id === currentEntryId);
            if (entry && entry.tags) {
                document.querySelectorAll('.tag-btn[data-tag]').forEach(btn => {
                    btn.classList.toggle('active', entry.tags.includes(btn.dataset.tag));
                });
            }
        } else {
            // Check draft
            const draft = getFromStorage('diaryDraft', null);
            if (draft && draft.tags) {
                document.querySelectorAll('.tag-btn[data-tag]').forEach(btn => {
                    btn.classList.toggle('active', draft.tags.includes(btn.dataset.tag));
                });
            }
        }
    };

    window.toggleAllTags = () => {
        // Lưu trạng thái active hiện tại trước khi render lại
        const activeTags = getActiveTags();
        
        allTagsExpanded = !allTagsExpanded;
        const filterVal = tagSearchInput ? tagSearchInput.value : '';
        renderTags(filterVal);
        
        // Khôi phục trạng thái active
        activeTags.forEach(tag => {
            const btn = document.querySelector(`.tag-btn[data-tag="${tag}"]`);
            if (btn) btn.classList.add('active');
        });
        
        const btn = document.querySelector('.tags-section > .btn-secondary');
        if (btn) btn.textContent = allTagsExpanded ? 'Thu gọn' : 'Xem thêm';
    };

    // ======== Tag Rendering (Must be independent of CKEditor) ========
    renderTags();

    // ======== CKEditor 5 Initialization ========
    setTimeout(() => {
        if (typeof ClassicEditor !== 'undefined') {
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
                    isEditorReady = true;
                    editor.model.document.on('change:data', () => {
                        updateWordCount();
                        saveDraft();
                    });
                    loadDraft();
                })
                .catch(error => {
                    console.error('CKEditor initialization error:', error);
                    showToast('Lỗi tải trình soạn thảo văn bản! Bạn vẫn có thể gắn thẻ và lưu nhật ký.', 'error');
                    isEditorReady = false;
                });
        } else {
            console.warn('CKEditor not loaded');
            showToast('Trình soạn thảo chưa sẵn sàng. Vui lòng tải lại trang.', 'error');
        }
    }, 500);

    // ======== Event Listeners ========
    tabs.forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));
    moodBtns.forEach(btn => btn.addEventListener('click', (e) => selectMood(e.currentTarget.dataset.mood))); // Use currentTarget
    searchInput.addEventListener('input', () => renderEntries(state.entries, entriesList, { filter: searchInput.value }));
    importFileInput.addEventListener('change', handleFileImport);
    
    if (tagSearchInput) {
        tagSearchInput.addEventListener('input', (e) => {
            renderTags(e.target.value);
        });
    }

    document.body.addEventListener('click', (e) => {
        const card = e.target.closest('.entry-card');
        const clickedButton = e.target.closest('.btn'); // Check if the click was on a button
        
        // Only trigger editEntry if the click was on the card itself, not its buttons
        if (card && !clickedButton) {
            const entryId = card.dataset.id;
            editEntry(entryId);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveEntry(); }
        if (e.key === 'Escape') {
            if (document.body.classList.contains('focus-mode')) { toggleFocusMode(); }
            else if (currentEntryId) { cancelEdit(); }
        }
    });

    // ======== Functions ========
    const handleOnboarding = () => {
        if (!state.lastVisit) {
            onboardingBanner.classList.remove('hidden');
            state.lastVisit = new Date().toISOString();
            saveToStorage('diaryLastVisit', state.lastVisit);
        }
    };
    window.closeOnboarding = () => { onboardingBanner.classList.add('hidden'); };

    window.switchTab = (tabName) => {
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
        tabContents.forEach(c => c.classList.toggle('active', c.id === `${tabName}-tab`));
        
        // Only render the appropriate content based on which tab is selected
        if (tabName === 'entries') {
            renderEntries(state.entries, entriesList);
        } else if (tabName === 'trash') {
            renderEntries(state.trash, trashList, { isTrash: true });
        } else if (tabName === 'stats') {
            renderStats();
        }
    };

    const updateWordCount = () => {
        const text = editor.getData().replace(/<[^>]+>/g, '');
        const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
        const charCount = text.length;
        wordCountEl.textContent = `${wordCount} từ`;
        charCountEl.textContent = `${charCount} ký tự`;
    };

    const saveDraft = () => {
        if (!currentEntryId) {
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
        }
    };

    const clearDraft = () => { localStorage.removeItem('diaryDraft'); };

    window.selectMood = (moodValue) => {
        moodBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.mood === moodValue));
    };

    const getActiveTags = () => Array.from(document.querySelectorAll('.tag-btn.active')).map(t => t.dataset.tag);

    const getMetadata = () => ({
        rating: document.getElementById('entry-rating')?.value || '',
        location: document.getElementById('entry-location')?.value?.trim() || '',
        drink: document.getElementById('entry-drink')?.value?.trim() || '',
        weather: document.getElementById('entry-weather')?.value?.trim() || '',
    });

    const setMetadata = (metadata) => {
        if (metadata) {
            document.getElementById('entry-rating').value = metadata.rating || '';
            document.getElementById('entry-location').value = metadata.location || '';
            document.getElementById('entry-drink').value = metadata.drink || '';
            document.getElementById('entry-weather').value = metadata.weather || '';
        }
    };

    const clearMetadata = () => {
        document.getElementById('entry-rating').value = '';
        document.getElementById('entry-location').value = '';
        document.getElementById('entry-drink').value = '';
        document.getElementById('entry-weather').value = '';
    };

    // CRUD
    window.saveEntry = () => {
        const title = entryTitle.value.trim();
        const content = editor.getData();
        const mood = document.querySelector('.mood-btn.active')?.dataset.mood;
        const tags = getActiveTags();
        const songUrl = document.getElementById('song-url')?.value?.trim() || '';
        const metadata = getMetadata();
        const date = new Date().toISOString();
        const imageInput = document.getElementById('image-upload');

        const saveWithImage = (imageUrl) => {
            if (!title && !content) { showToast('Vui lòng nhập tiêu đề hoặc nội dung.', 'error'); return; }

            const entryData = { title, content, mood, tags, songUrl, imageUrl: imageUrl || '', metadata, modifiedAt: date };

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
            setMetadata(entry.metadata);
            document.getElementById('cancel-edit-btn').classList.remove('hidden');
            renderTags();
            // Mark active tags
            document.querySelectorAll('.tag-btn[data-tag]').forEach(btn => {
                btn.classList.toggle('active', entry.tags.includes(btn.dataset.tag));
            });
        }
    };
    
    window.cancelEdit = () => { resetEditor(); };

    const resetEditor = () => {
        currentEntryId = null;
        entryTitle.value = '';
        editor.setData('');
        moodBtns.forEach(btn => btn.classList.remove('active'));
        clearMetadata();
        document.getElementById('cancel-edit-btn').classList.add('hidden');
        clearDraft();
        renderTags();
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
            state.entries.unshift(restoredEntry);
            saveToStorage('diaryEntries', state.entries);
            saveToStorage('diaryTrash', state.trash);
            renderEntries(state.entries, entriesList);
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
        if (confirm('Bạn có chắc muốn xóa vĩnh viễn?')) {
            state.trash = state.trash.filter(e => e.id !== id);
            saveToStorage('diaryTrash', state.trash);
            renderEntries(state.trash, trashList, { isTrash: true });
            showToast('Đã xóa vĩnh viễn.');
        }
    };

    window.emptyTrash = () => {
        if (state.trash.length > 0 && confirm(`Xóa vĩnh viễn ${state.trash.length} mục?`)) {
            state.trash = [];
            saveToStorage('diaryTrash', state.trash);
            renderEntries([], trashList, { isTrash: true });
            showToast('Thùng rác đã dọn sạch.');
        }
    };

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
            const moodEmoji = { '5': '😄', '4': '🙂', '3': '😐', '2': '😟', '1': '😢' }[entry.mood] || '—';
            const date = new Date(entry.modifiedAt);
            const formattedDate = `${date.toLocaleDateString('vi-VN')} ${date.toLocaleTimeString('vi-VN')}`;
            const stars = entry.metadata?.rating ? '⭐'.repeat(parseInt(entry.metadata.rating)) : '';

            const entryCard = document.createElement('div');
            entryCard.className = 'entry-card card';
            entryCard.dataset.id = entry.id;

            let metadataHtml = '';
            if (entry.metadata) {
                const meta = [];
                if (entry.metadata.location) meta.push(`📍 ${entry.metadata.location}`);
                if (entry.metadata.weather) meta.push(`🌤️ ${entry.metadata.weather}`);
                if (entry.metadata.drink) meta.push(`☕ ${entry.metadata.drink}`);
                if (entry.metadata.rating) meta.push(stars);
                if (meta.length > 0) {
                    metadataHtml = `<div class="entry-metadata">${meta.map(m => `<span class="entry-meta-item">${m}</span>`).join('')}</div>`;
                }
            }

            entryCard.innerHTML = `
                <div class="screw screw-tl"></div><div class="screw screw-tr"></div>
                <div class="screw screw-bl"></div><div class="screw screw-br"></div>
                ${entry.imageUrl ? `<div class="entry-image"><img src="${entry.imageUrl}" alt="ảnh"></div>` : ''}
                <div class="entry-meta">
                    <span class="entry-date">${formattedDate}</span>
                    <span class="entry-mood">${moodEmoji}</span>
                </div>
                <h3 class="entry-title-display">${entry.title || 'Không có tiêu đề'}</h3>
                <p class="entry-preview">${entry.content.replace(/<[^>]+>/g, '').substring(0, 150)}...</p>
                ${metadataHtml}
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
        const monthlyEntries = state.entries.filter(e => {
            const d = new Date(e.createdAt);
            const now = new Date();
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });

        const moodData = Array(new Date().getDate()).fill(null);
        monthlyEntries.forEach(entry => {
            const day = new Date(entry.createdAt).getDate() - 1;
            if (entry.mood) {
                if (!moodData[day]) moodData[day] = [];
                moodData[day].push(parseInt(entry.mood, 10));
            }
        });
        
        const averageMoods = moodData.map(d => d ? d.reduce((s, v) => s + v, 0) / d.length : null);

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
                    tension: 0.3, spanGaps: true,
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true, max: 5, min: 1,
                        ticks: { callback: (v) => ['😢', '😟', '😐', '🙂', '😄'][v - 1] || '' }
                    }
                }
            }
        });

        const allTags = state.entries.flatMap(e => e.tags);
        const tagCounts = allTags.reduce((acc, tag) => { acc[tag] = (acc[tag] || 0) + 1; return acc; }, {});
        const sortedTags = Object.entries(tagCounts).sort(([, a], [, b]) => b - a).slice(0, 10);
        popularTagsEl.innerHTML = sortedTags.length > 0 ? sortedTags.map(([tag, count]) => `
            <div class="popular-tag">${tag} <span class="tag-count">${count}</span></div>
        `).join('') : '<p>Chưa có tag nào phổ biến.</p>';
    };

    // Streak
    const updateStreak = () => {
        const today = new Date().setHours(0, 0, 0, 0);
        const entryDates = state.entries
            .map(e => new Date(e.createdAt).setHours(0, 0, 0, 0))
            .filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => b - a);
        let s = 0;
        if (entryDates.length > 0 && entryDates[0] === today) {
            s = 1;
            for (let i = 1; i < entryDates.length; i++) {
                if (entryDates[i - 1] - entryDates[i] === 86400000) s++; else break;
            }
        }
        if (s > 0) { streakCount.textContent = s; streakBadge.classList.remove('hidden'); }
        else { streakBadge.classList.add('hidden'); }
    };
    
    // Dark Mode
    window.toggleDarkMode = () => {
        state.settings.darkMode = !state.settings.darkMode;
        saveToStorage('diarySettings', state.settings);
        applyTheme();
    };
    const applyTheme = () => {
        if (state.settings.darkMode) { document.documentElement.setAttribute('data-theme', 'dark'); themeIcon.textContent = '☀️'; }
        else { document.documentElement.removeAttribute('data-theme'); themeIcon.textContent = '🌙'; }
    };

    // Important Dates
    window.addImportantDate = () => {
        const name = document.getElementById('event-name').value.trim();
        const date = document.getElementById('event-date').value;
        const icon = document.getElementById('event-icon').value;
        if (!name || !date) { showToast('Vui lòng nhập tên và ngày.', 'error'); return; }
        state.importantDates.push({ id: `date-${Date.now()}`, name, date, icon });
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
        state.importantDates.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(item => {
            const target = new Date(item.date);
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const diff = Math.ceil((target - today) / 86400000);
            const text = diff < 0 ? 'Đã qua' : diff === 0 ? 'Hôm nay!' : `Còn ${diff} ngày`;
            const dateItem = document.createElement('div');
            dateItem.className = 'date-item';
            dateItem.innerHTML = `
                <span class="date-icon">${item.icon}</span>
                <span class="date-name">${item.name} (${target.toLocaleDateString('vi-VN')})</span>
                <span class="date-countdown">${text}</span>
                <button onclick="deleteImportantDate('${item.id}')" class="btn-icon">🗑️</button>
            `;
            importantDatesList.appendChild(dateItem);
        });
    };

    // Settings
    window.showSettings = () => settingsModal.classList.remove('hidden');
    window.closeSettings = () => settingsModal.classList.add('hidden');

    // Data Management
    window.exportData = () => {
        const data = JSON.stringify({ entries: state.entries, trash: state.trash, importantDates: state.importantDates, settings: state.settings }, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `diary_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        showToast('Đã xuất dữ liệu.');
    };

    window.importData = () => {
        if (confirm('Nhập dữ liệu sẽ ghi đè hiện tại. Tiếp tục?')) importFileInput.click();
    };

    function handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const d = JSON.parse(e.target.result);
                if (d.entries) state.entries = d.entries;
                if (d.trash) state.trash = d.trash;
                if (d.importantDates) state.importantDates = d.importantDates;
                if (d.settings) state.settings = { ...state.settings, ...d.settings };
                saveToStorage('diaryEntries', state.entries);
                saveToStorage('diaryTrash', state.trash);
                saveToStorage('diaryImportantDates', state.importantDates);
                saveToStorage('diarySettings', state.settings);
                showToast('Nhập dữ liệu thành công!');
                initialize();
            } catch (err) { showToast('Tệp không hợp lệ.', 'error'); }
        };
        reader.readAsText(file);
    }
    
    window.clearAllData = () => {
        if (confirm('Xóa TẤT CẢ dữ liệu? Không thể hoàn tác!')) {
            localStorage.clear();
            state = { entries: [], trash: [], importantDates: [], settings: { darkMode: false, notifications: {} }, lastVisit: state.lastVisit, favoriteTags: {} };
            showToast('Đã xóa tất cả dữ liệu.');
            initialize();
        }
    };

    // Focus Mode
    window.toggleFocusMode = () => {
        document.body.classList.toggle('focus-mode');
        window.dispatchEvent(new Event('resize'));
    };
    
    // Toast
    const showToast = (message, type = 'success', onAction = null) => {
        clearTimeout(undoTimeout);
        toastMessage.textContent = message;
        toast.className = `toast ${type}`;
        if (onAction) { toastAction.classList.remove('hidden'); toastAction.onclick = () => { onAction(); toast.classList.add('hidden'); clearTimeout(undoTimeout); }; }
        else { toastAction.classList.add('hidden'); }
        toast.classList.remove('hidden');
        undoTimeout = setTimeout(() => toast.classList.add('hidden'), 5000);
    };

    // Notifications
    window.requestNotificationPermission = () => {
        if (!('Notification' in window)) { showToast('Trình duyệt không hỗ trợ thông báo.', 'error'); return; }
        Notification.requestPermission().then(p => { p === 'granted' ? showToast('Đã cấp quyền.') : showToast('Bị từ chối.', 'error'); });
    };
    
    window.updateNotificationSettings = () => {
        state.settings.notifications = {
            water: { enabled: document.getElementById('notify-water').checked, time: document.getElementById('notify-water-time').value },
            exercise: { enabled: document.getElementById('notify-exercise').checked, time: document.getElementById('notify-exercise-time').value },
            diary: { enabled: document.getElementById('notify-diary').checked, time: document.getElementById('notify-diary-time').value },
            rest: { enabled: document.getElementById('notify-rest').checked, time: document.getElementById('notify-rest-time').value }
        };
        saveToStorage('diarySettings', state.settings);
        scheduleNotifications();
    };
    
    const scheduleNotifications = () => {
        if (window.notificationIntervals) window.notificationIntervals.forEach(i => clearInterval(i));
        window.notificationIntervals = [];
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        const msgs = {
            water: { title: '💧 Uống nước', body: 'Đến lúc uống nước rồi!' },
            exercise: { title: '🏃 Vận động', body: 'Hãy vận động!' },
            diary: { title: '📖 Viết nhật ký', body: 'Đến giờ ghi lại ngày hôm nay!' },
            rest: { title: '🌙 Nghỉ ngơi', body: 'Hãy nghỉ ngơi!' }
        };
        Object.keys(msgs).forEach(k => {
            const s = state.settings.notifications[k];
            if (s?.enabled && s.time) {
                window.notificationIntervals.push(setInterval(() => {
                    const now = new Date();
                    const t = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                    if (t === s.time) new Notification(msgs[k].title, { body: msgs[k].body });
                }, 60000));
            }
        });
    };
    
    const loadNotificationSettings = () => {
        const n = state.settings.notifications;
        if (n) {
            document.getElementById('notify-water').checked = n.water?.enabled || false;
            document.getElementById('notify-water-time').value = n.water?.time || '09:00';
            document.getElementById('notify-exercise').checked = n.exercise?.enabled || false;
            document.getElementById('notify-exercise-time').value = n.exercise?.time || '17:00';
            document.getElementById('notify-diary').checked = n.diary?.enabled || false;
            document.getElementById('notify-diary-time').value = n.diary?.time || '21:00';
            document.getElementById('notify-rest').checked = n.rest?.enabled || false;
            document.getElementById('notify-rest-time').value = n.rest?.time || '23:00';
        }
    };
    
    // ======== New Features ========
    const quotes = [
        "Mỗi ngày là một cơ hội mới.",
        "Hạnh phúc là hành trình, không phải đích đến.",
        "Hãy tin rằng bạn có thể.",
        "Đừng để ngày hôm qua chiếm dụng ngày hôm nay.",
        "Sự kiên trì là chìa khóa thành công.",
        "Bạn xứng đáng với những điều tốt đẹp nhất.",
        "Hôm nay là món quà, đó gọi là Present.",
        "Mỗi bước nhỏ đều là tiến bộ.",
    ];

    const questions = [
        "🤔 Hôm nay bạn thế nào?",
        "🌟 Điều gì làm bạn mỉm cười hôm nay?",
        "💪 Bạn đã vượt qua thử thách nào?",
        "🌱 Bạn học được điều gì mới?",
        "💭 Bạn biết ơn điều gì nhất?",
        "⭐ Điểm nổi bật nhất trong ngày?",
        "🎵 Bài hát nào hợp mood hôm nay?",
        "🌅 Bạn muốn nhớ điều gì về hôm nay?",
    ];

    const updateMotivation = () => {
        document.getElementById('daily-quote').textContent = `"${quotes[Math.floor(Math.random() * quotes.length)]}"`;
        document.getElementById('daily-question').textContent = questions[Math.floor(Math.random() * questions.length)];
    };

    window.insertTemplate = () => {
        const t = document.getElementById('template-select').value;
        let c = '';
        if (t === 'daily') c = `
            <h2>📅 Daily Reflection</h2>
            <p><strong>Ngày:</strong> ${new Date().toLocaleDateString('vi-VN')}</p>
            <h3>✨ Hôm nay có gì đáng nhớ?</h3><p></p>
            <h3>🎯 Điều mình đã làm tốt</h3><ul><li></li></ul>
            <h3>😕 Điều chưa hài lòng</h3><ul><li></li></ul>
            <h3>💡 Bài học hôm nay</h3><p></p>
            <h3>🙏 Điều mình biết ơn</h3><p></p>
            <h3>🌙 Mục tiêu cho ngày mai</h3><p></p>
        `;
        else if (t === 'deep') c = `
            <h2>🌱 Deep Journal</h2>
            <h3>💭 Mình đang nghĩ gì?</h3><p></p>
            <h3>❤️ Cảm xúc lớn nhất hôm nay?</h3><p></p>
            <h3>⚡ Điều gì khiến mình vui/buồn nhất?</h3><p></p>
            <h3>🧠 Nếu quay lại, mình sẽ thay đổi gì?</h3><p></p>
            <h3>🚀 Phiên bản ngày mai cần nhớ gì?</h3><p></p>
        `;
        if (c) editor.setData(c);
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
        renderTags();
        switchTab('editor');
    };

    initialize();
});